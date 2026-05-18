import { Worker } from "bullmq";
import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import type { DraftAssistProvider, OpenPracticeQueueName } from "@open-practice/domain";
import {
  createDatabaseRuntime,
  DrizzleOpenPracticeRepository,
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import {
  TesseractOcrProvider,
  SmtpMailSender,
  DisabledMailSender,
  MailParserProvider,
} from "@open-practice/providers";
import { createOpenPracticeQueue, openPracticeQueues, redisConnectionFromUrl } from "./queues.js";
import {
  processOpenPracticeJob,
  type ConnectorSecretResolver,
  type WorkerJobQueue,
  type WorkerJobEnvelope,
} from "./processors.js";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:6379/0"),
  WORKER_QUEUES: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  DATABASE_URL: optionalString,
  OPEN_PRACTICE_USE_MEMORY_REPO: z.coerce.boolean().default(false),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("local"),
  S3_BUCKET: z.string().default("open-practice-documents"),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().default("Open Practice <no-reply@open-practice.local>"),
  SMTP_USERNAME: optionalString,
  SMTP_PASSWORD: optionalString,
  CONNECTOR_WEBHOOK_SECRETS: optionalString,
});

function selectedQueues(value: string | undefined): OpenPracticeQueueName[] {
  if (!value) return [...openPracticeQueues];
  const requested = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return requested.map((queue) => {
    if (!openPracticeQueues.includes(queue as OpenPracticeQueueName)) {
      throw new Error(`Unknown worker queue: ${queue}`);
    }
    return queue as OpenPracticeQueueName;
  });
}

export function createWorkers(input: {
  redisUrl: string;
  queues: OpenPracticeQueueName[];
  concurrency: number;
  repository: OpenPracticeRepository;
  s3: { client: S3Client; bucket: string };
  ocrProvider: TesseractOcrProvider;
  draftAssistProvider?: DraftAssistProvider;
  mailSender: SmtpMailSender | DisabledMailSender;
  inboundEmailParser: MailParserProvider;
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorJobQueue?: WorkerJobQueue;
}): Worker[] {
  const connection = redisConnectionFromUrl(input.redisUrl);
  return input.queues.map(
    (queueName) =>
      new Worker<WorkerJobEnvelope>(
        queueName,
        async (job) =>
          processOpenPracticeJob({
            queueName,
            jobName: job.name,
            data: job.data,
            jobLifecycleId: job.id ? String(job.id) : undefined,
            attemptsMade: job.attemptsMade,
            maxAttempts:
              typeof job.opts.attempts === "number" && Number.isFinite(job.opts.attempts)
                ? job.opts.attempts
                : undefined,
            repository: input.repository,
            s3: input.s3,
            ocrProvider: input.ocrProvider,
            draftAssistProvider: input.draftAssistProvider,
            mailSender: input.mailSender,
            inboundEmailParser: input.inboundEmailParser,
            connectorSecretResolver: input.connectorSecretResolver,
            connectorJobQueue: input.connectorJobQueue,
          }),
        { connection, concurrency: input.concurrency },
      ),
  );
}

if (process.env.NODE_ENV !== "test") {
  const env = envSchema.parse(process.env);

  const runtime = createDatabaseRuntime(env.DATABASE_URL!);
  const repository: OpenPracticeRepository =
    env.OPEN_PRACTICE_USE_MEMORY_REPO || !env.DATABASE_URL
      ? new InMemoryOpenPracticeRepository()
      : new DrizzleOpenPracticeRepository(runtime.db);

  const s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials:
      env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
        : undefined,
    forcePathStyle: true,
  });

  const ocrProvider = new TesseractOcrProvider();

  const mailSender =
    env.SMTP_HOST && env.SMTP_PORT
      ? new SmtpMailSender({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth:
            env.SMTP_USERNAME && env.SMTP_PASSWORD
              ? { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD }
              : undefined,
        })
      : new DisabledMailSender();

  const connectorSecrets = env.CONNECTOR_WEBHOOK_SECRETS
    ? (JSON.parse(env.CONNECTOR_WEBHOOK_SECRETS) as Record<string, string>)
    : {};

  const queues = selectedQueues(env.WORKER_QUEUES);
  const connectorJobQueue = queues.includes("connectors")
    ? createOpenPracticeQueue("connectors", env.REDIS_URL)
    : undefined;

  const workers = createWorkers({
    redisUrl: env.REDIS_URL,
    queues,
    concurrency: env.WORKER_CONCURRENCY,
    repository,
    s3: { client: s3Client, bucket: env.S3_BUCKET },
    ocrProvider,
    mailSender,
    inboundEmailParser: new MailParserProvider(),
    connectorSecretResolver: (secretReferenceId) => connectorSecrets[secretReferenceId],
    connectorJobQueue,
  });

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`Worker completed ${job.queueName}/${job.name}/${job.id ?? "unknown"}`);
    });
    worker.on("failed", (job, error) => {
      console.error(
        `Worker failed ${job?.queueName ?? "unknown"}/${job?.name ?? "unknown"}/${job?.id ?? "unknown"}`,
        error,
      );
    });
  }

  process.once("SIGTERM", () => {
    void Promise.all([...workers.map((worker) => worker.close()), connectorJobQueue?.close()]).then(
      () => process.exit(0),
    );
  });
}
