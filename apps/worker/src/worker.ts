import { Worker } from "bullmq";
import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import type {
  AiOperationalProposalProvider,
  DocumentAutomationProvider,
  DraftAssistProvider,
  MailSender,
  OpenPracticeQueueName,
} from "@open-practice/domain";
import {
  createDatabaseRuntime,
  createProviderConfigCipherFromKey,
  DrizzleOpenPracticeRepository,
  InMemoryOpenPracticeRepository,
  isProviderConfigEncryptionKey,
  type OpenPracticeRepository,
} from "@open-practice/database";
import {
  EmbeddedAutomationProvider,
  TesseractOcrProvider,
  ImapMailboxPoller,
  MailParserProvider,
} from "@open-practice/providers";
import { createOpenPracticeQueue, openPracticeQueues, redisConnectionFromUrl } from "./queues.js";
import { ProviderConfiguredSmtpMailSender } from "./provider-mail-sender.js";
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

const optionalConfigEncryptionKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .min(1)
    .refine(isProviderConfigEncryptionKey, {
      message:
        "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes using base64, base64url, or hex",
    })
    .optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const optionalS3ServerSideEncryption = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["AES256"]).optional(),
);

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return value;
}, z.boolean().default(false));

export const workerEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  REDIS_URL: z.string().url().default("redis://localhost:6379/0"),
  WORKER_QUEUES: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  DATABASE_URL: optionalString,
  OPEN_PRACTICE_USE_MEMORY_REPO: booleanFromEnv,
  OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY: optionalConfigEncryptionKey,
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("local"),
  S3_BUCKET: z.string().default("open-practice-documents"),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_SERVER_SIDE_ENCRYPTION: optionalS3ServerSideEncryption,
  CONNECTOR_WEBHOOK_SECRETS: optionalString,
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

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

export function validateWorkerReadiness(env: WorkerEnv): void {
  const s3Values = [env.S3_ENDPOINT, env.S3_ACCESS_KEY, env.S3_SECRET_KEY];
  const s3ConfiguredCount = s3Values.filter(Boolean).length;
  if (s3ConfiguredCount > 0 && s3ConfiguredCount < s3Values.length) {
    throw new Error("S3 configuration must be complete or absent");
  }

  if (env.NODE_ENV === "production") {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required in production");
    }
    if (env.OPEN_PRACTICE_USE_MEMORY_REPO) {
      throw new Error("OPEN_PRACTICE_USE_MEMORY_REPO cannot be true in production");
    }
  } else if (env.OPEN_PRACTICE_USE_MEMORY_REPO && env.DATABASE_URL) {
    throw new Error(
      "Worker memory repository cannot be combined with DATABASE_URL; unset DATABASE_URL or disable OPEN_PRACTICE_USE_MEMORY_REPO",
    );
  }

  if (
    env.DATABASE_URL &&
    !env.OPEN_PRACTICE_USE_MEMORY_REPO &&
    !env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY
  ) {
    throw new Error(
      "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY is required when DATABASE_URL is configured",
    );
  }

  if (
    env.NODE_ENV === "production" &&
    env.S3_ENDPOINT &&
    env.S3_ACCESS_KEY &&
    env.S3_SECRET_KEY &&
    env.S3_SERVER_SIDE_ENCRYPTION !== "AES256"
  ) {
    throw new Error("S3_SERVER_SIDE_ENCRYPTION=AES256 is required when S3 is configured");
  }
}

export function createWorkerRepositoryFromEnv(env: WorkerEnv): {
  repository: OpenPracticeRepository;
  close?: () => Promise<void>;
} {
  validateWorkerReadiness(env);
  if (env.OPEN_PRACTICE_USE_MEMORY_REPO || !env.DATABASE_URL) {
    return { repository: new InMemoryOpenPracticeRepository() };
  }

  const runtime = createDatabaseRuntime(env.DATABASE_URL);
  const rawProviderConfigKey = env.OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY;
  if (!rawProviderConfigKey) {
    throw new Error(
      "OPEN_PRACTICE_CONFIG_ENCRYPTION_KEY is required when DATABASE_URL is configured",
    );
  }
  return {
    repository: new DrizzleOpenPracticeRepository(runtime.db, {
      providerConfigCipher: createProviderConfigCipherFromKey(rawProviderConfigKey),
    }),
    close: runtime.close,
  };
}

export function createWorkers(input: {
  redisUrl: string;
  queues: OpenPracticeQueueName[];
  concurrency: number;
  repository: OpenPracticeRepository;
  s3: { client: S3Client; bucket: string; serverSideEncryption?: "AES256" };
  ocrProvider: TesseractOcrProvider;
  automationProvider?: DocumentAutomationProvider;
  aiOperationalProposalProvider?: AiOperationalProposalProvider;
  draftAssistProvider?: DraftAssistProvider;
  mailSender: MailSender;
  inboundEmailParser: MailParserProvider;
  imapMailboxPoller?: ImapMailboxPoller;
  connectorSecretResolver?: ConnectorSecretResolver;
  connectorJobQueue?: WorkerJobQueue;
  inboundEmailJobQueue?: WorkerJobQueue;
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
            automationProvider: input.automationProvider,
            aiOperationalProposalProvider: input.aiOperationalProposalProvider,
            draftAssistProvider: input.draftAssistProvider,
            mailSender: input.mailSender,
            inboundEmailParser: input.inboundEmailParser,
            imapMailboxPoller: input.imapMailboxPoller,
            connectorSecretResolver: input.connectorSecretResolver,
            connectorJobQueue: input.connectorJobQueue,
            inboundEmailJobQueue: input.inboundEmailJobQueue,
          }),
        { connection, concurrency: input.concurrency },
      ),
  );
}

if (process.env.NODE_ENV !== "test") {
  const env = workerEnvSchema.parse(process.env);
  const { repository, close } = createWorkerRepositoryFromEnv(env);

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

  const mailSender = new ProviderConfiguredSmtpMailSender(repository);

  const connectorSecrets = env.CONNECTOR_WEBHOOK_SECRETS
    ? (JSON.parse(env.CONNECTOR_WEBHOOK_SECRETS) as Record<string, string>)
    : {};

  const queues = selectedQueues(env.WORKER_QUEUES);
  const connectorJobQueue = queues.includes("connectors")
    ? createOpenPracticeQueue("connectors", env.REDIS_URL)
    : undefined;
  const documentAssemblyJobQueue = queues.includes("document_assembly")
    ? createOpenPracticeQueue("document_assembly", env.REDIS_URL)
    : undefined;
  const inboundEmailJobQueue = queues.includes("inbound_email")
    ? createOpenPracticeQueue("inbound_email", env.REDIS_URL)
    : undefined;

  const workers = createWorkers({
    redisUrl: env.REDIS_URL,
    queues,
    concurrency: env.WORKER_CONCURRENCY,
    repository,
    s3: {
      client: s3Client,
      bucket: env.S3_BUCKET,
      serverSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION,
    },
    ocrProvider,
    automationProvider: new EmbeddedAutomationProvider(),
    mailSender,
    inboundEmailParser: new MailParserProvider(),
    imapMailboxPoller: new ImapMailboxPoller(),
    connectorSecretResolver: (secretReferenceId) => connectorSecrets[secretReferenceId],
    connectorJobQueue,
    inboundEmailJobQueue,
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
    void Promise.all([
      ...workers.map((worker) => worker.close()),
      connectorJobQueue?.close(),
      documentAssemblyJobQueue?.close(),
      inboundEmailJobQueue?.close(),
      close?.(),
    ]).then(() => process.exit(0));
  });
}
