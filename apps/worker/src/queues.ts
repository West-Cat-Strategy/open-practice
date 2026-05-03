import { Queue, type JobsOptions } from "bullmq";
import type {
  JobLifecycleRecord,
  OpenPracticeJobStatus,
  OpenPracticeQueueName,
} from "@open-practice/domain";

export const openPracticeQueues = [
  "email",
  "inbound_email",
  "ai_triage",
  "ocr",
  "transcription",
  "media",
] as const satisfies readonly OpenPracticeQueueName[];

export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

export const defaultJobOptionsByQueue: Record<OpenPracticeQueueName, JobsOptions> = {
  email: {
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 1_000,
    removeOnFail: false,
  },
  inbound_email: {
    attempts: 4,
    backoff: { type: "exponential", delay: 15_000 },
    removeOnComplete: 1_000,
    removeOnFail: false,
  },
  ai_triage: {
    attempts: 2,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 500,
    removeOnFail: false,
  },
  ocr: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 500,
    removeOnFail: false,
  },
  transcription: {
    attempts: 2,
    backoff: { type: "exponential", delay: 120_000 },
    removeOnComplete: 250,
    removeOnFail: false,
  },
  media: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 500,
    removeOnFail: false,
  },
};

export function redisConnectionFromUrl(redisUrl: string): RedisConnectionOptions {
  const parsed = new URL(redisUrl);
  const db = parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
}

export function createOpenPracticeQueue(queueName: OpenPracticeQueueName, redisUrl: string): Queue {
  return new Queue(queueName, {
    connection: redisConnectionFromUrl(redisUrl),
    defaultJobOptions: defaultJobOptionsByQueue[queueName],
  });
}

const allowedJobMetadataKeys = new Set([
  "attachmentCount",
  "attachmentId",
  "attemptNumber",
  "bullJobId",
  "checksumStatus",
  "confidence",
  "documentId",
  "emailId",
  "firmId",
  "inboundMessageId",
  "idempotencyKeyPresent",
  "jobId",
  "language",
  "matterId",
  "maxAttempts",
  "nextRetryAt",
  "provider",
  "providerConfigured",
  "providerMessageId",
  "recipientCount",
  "resourceId",
  "resourceType",
  "scanStatus",
  "source",
  "task",
  "templateKey",
  "terminal",
  "textLength",
]);

function safeMetadataValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") return value.slice(0, 256);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

export function sanitizeJobMetadata(
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedJobMetadataKeys.has(key)) continue;
    const safeValue = safeMetadataValue(value);
    if (safeValue !== undefined) sanitized[key] = safeValue;
  }
  return sanitized;
}

export function createQueuedJobLifecycleRecord(input: {
  id: string;
  firmId: string;
  queueName: OpenPracticeQueueName;
  jobName: string;
  bullJobId?: string;
  idempotencyKey?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
  now?: string;
}): JobLifecycleRecord {
  return {
    id: input.id,
    firmId: input.firmId,
    queueName: input.queueName,
    jobName: input.jobName,
    bullJobId: input.bullJobId,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    targetResourceType: input.targetResourceType,
    targetResourceId: input.targetResourceId,
    attemptsMade: 0,
    maxAttempts:
      input.maxAttempts ?? Number(defaultJobOptionsByQueue[input.queueName].attempts ?? 1),
    queuedAt: input.now ?? new Date().toISOString(),
    metadata: sanitizeJobMetadata(input.metadata),
  };
}

export function terminalJobStatus(status: OpenPracticeJobStatus): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "dead_letter" ||
    status === "skipped"
  );
}
