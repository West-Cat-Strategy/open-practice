import { Worker } from "bullmq";
import { z } from "zod";
import type { OpenPracticeQueueName } from "@open-practice/domain";
import { openPracticeQueues, redisConnectionFromUrl } from "./queues.js";
import { processOpenPracticeJob, type WorkerJobEnvelope } from "./processors.js";

const envSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:6379/0"),
  WORKER_QUEUES: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
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
}): Worker[] {
  const connection = redisConnectionFromUrl(input.redisUrl);
  return input.queues.map(
    (queueName) =>
      new Worker<WorkerJobEnvelope>(
        queueName,
        async (job) => processOpenPracticeJob(queueName, job.name, job.data),
        { connection, concurrency: input.concurrency },
      ),
  );
}

if (process.env.NODE_ENV !== "test") {
  const env = envSchema.parse(process.env);
  const workers = createWorkers({
    redisUrl: env.REDIS_URL,
    queues: selectedQueues(env.WORKER_QUEUES),
    concurrency: env.WORKER_CONCURRENCY,
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
    void Promise.all(workers.map((worker) => worker.close())).then(() => process.exit(0));
  });
}
