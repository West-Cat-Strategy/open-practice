import type {
  JobLifecycleRecord,
  OpenPracticeJobStatus,
  OpenPracticeQueueName,
  ProviderSettingKind,
  ProviderSettingRecord,
} from "@open-practice/domain";
import type { ApiJobQueue } from "./types.js";

export const openPracticeQueueNames = [
  "email",
  "inbound_email",
  "ai_triage",
  "ocr",
  "transcription",
  "media",
] as const satisfies readonly OpenPracticeQueueName[];

export const documentProcessingProviderKinds = [
  "ocr",
  "transcription",
  "media",
  "ai",
] as const satisfies readonly ProviderSettingKind[];

export const documentProcessingQueueNames = [
  "ai_triage",
  "ocr",
  "transcription",
  "media",
] as const satisfies readonly OpenPracticeQueueName[];

const redactedMetadataKeys = new Set([
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

function isTerminalStatus(status: OpenPracticeJobStatus): boolean {
  return status === "completed" || status === "dead_letter" || status === "skipped";
}

function safeMetadataValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") return value.slice(0, 256);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function redactedMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!redactedMetadataKeys.has(key)) continue;
    const safeValue = safeMetadataValue(value);
    if (safeValue !== undefined) redacted[key] = safeValue;
  }
  return redacted;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function errorSummary(errorMessage: string | undefined): string | undefined {
  return errorMessage?.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

export function serializeJobRun(record: JobLifecycleRecord) {
  const terminal = isTerminalStatus(record.status);
  const failed = record.status === "failed" || record.status === "dead_letter";
  const nextAttemptAt = !terminal ? metadataString(record.metadata, "nextRetryAt") : undefined;
  return {
    id: record.id,
    queueName: record.queueName,
    jobName: record.jobName,
    bullJobId: record.bullJobId,
    status: record.status,
    terminal,
    failed,
    retryable: failed && !terminal && record.attemptsMade < record.maxAttempts,
    nextAttemptAt,
    targetResourceType: record.targetResourceType,
    targetResourceId: record.targetResourceId,
    attemptsMade: record.attemptsMade,
    maxAttempts: record.maxAttempts,
    queuedAt: record.queuedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    failedAt: record.failedAt,
    errorSummary: errorSummary(record.errorMessage),
    metadata: redactedMetadata(record.metadata),
  };
}

export function summarizeJobRuns(records: JobLifecycleRecord[]) {
  const byQueue = openPracticeQueueNames.map((queueName) => {
    const queueJobs = records.filter((record) => record.queueName === queueName);
    const failed = queueJobs.filter(
      (record) => record.status === "failed" || record.status === "dead_letter",
    );
    const terminal = queueJobs.filter((record) => isTerminalStatus(record.status));
    const queued = queueJobs.filter((record) => record.status === "queued");
    const active = queueJobs.filter((record) => record.status === "active");
    return {
      queueName,
      total: queueJobs.length,
      queued: queued.length,
      active: active.length,
      failed: failed.length,
      terminal: terminal.length,
      latestQueuedAt: queueJobs.at(-1)?.queuedAt,
    };
  });
  return {
    total: records.length,
    queued: records.filter((record) => record.status === "queued").length,
    active: records.filter((record) => record.status === "active").length,
    failed: records.filter(
      (record) => record.status === "failed" || record.status === "dead_letter",
    ).length,
    terminal: records.filter((record) => isTerminalStatus(record.status)).length,
    byQueue,
  };
}

export function queueStatus(
  queueName: OpenPracticeQueueName,
  queue: ApiJobQueue | undefined,
): {
  queueName: OpenPracticeQueueName;
  status: "configured" | "not_configured";
  reason?: "queue_not_configured";
} {
  return queue
    ? { queueName, status: "configured" }
    : { queueName, status: "not_configured", reason: "queue_not_configured" };
}

export function providerStatus(kind: ProviderSettingKind, providers: ProviderSettingRecord[]) {
  const enabled = providers.filter((provider) => provider.enabled);
  return {
    kind,
    status: enabled.length > 0 ? "configured" : "disabled",
    reason:
      enabled.length > 0
        ? undefined
        : providers.length > 0
          ? "provider_disabled"
          : "not_configured",
    providers: providers.map((provider) => ({
      key: provider.key,
      enabled: provider.enabled,
      updatedAt: provider.updatedAt,
    })),
  };
}
