import type {
  JobLifecycleRecord,
  OpenPracticeJobStatus,
  OpenPracticeQueueName,
  ProviderSettingKind,
  ProviderSettingRecord,
} from "@open-practice/domain";
import { redactJobMetadata } from "@open-practice/domain";
import type { ApiJobQueue } from "./types.js";

export const openPracticeQueueNames = [
  "email",
  "connectors",
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

export const actionableDocumentProcessingTasks = ["ocr"] as const;

export const reservedDocumentProcessingTasks = [
  {
    task: "classification",
    queueName: "ai_triage",
    status: "reserved",
    reason: "deferred_worker",
    actionable: false,
  },
  {
    task: "transcription",
    queueName: "transcription",
    status: "reserved",
    reason: "deferred_worker",
    actionable: false,
  },
  {
    task: "media",
    queueName: "media",
    status: "reserved",
    reason: "deferred_worker",
    actionable: false,
  },
] as const satisfies readonly {
  task: "classification" | "transcription" | "media";
  queueName: OpenPracticeQueueName;
  status: "reserved";
  reason: "deferred_worker";
  actionable: false;
}[];

const reservedWorkerQueueNames = new Set<OpenPracticeQueueName>(
  reservedDocumentProcessingTasks.map((task) => task.queueName),
);

export interface ConfigurableWorkerQueueStatus {
  queueName: OpenPracticeQueueName;
  status: "configured" | "not_configured";
  reason?: "queue_not_configured";
}

export interface ReservedWorkerQueueStatus {
  queueName: OpenPracticeQueueName;
  status: "reserved";
  reason: "deferred_worker";
  task: (typeof reservedDocumentProcessingTasks)[number]["task"];
  actionable: false;
}

export type WorkerQueueStatus = ConfigurableWorkerQueueStatus | ReservedWorkerQueueStatus;

export type WorkerQueueHealthState = "healthy" | "degraded" | "unknown";

export interface WorkerQueueHealthSummary {
  queueName: OpenPracticeQueueName;
  status: WorkerQueueStatus["status"];
  health: WorkerQueueHealthState;
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  stalled: number;
  lastObservedAt?: string;
  lastFailureAt?: string;
  degradedReasons: string[];
}

export interface WorkerHealthSummary {
  status: WorkerQueueHealthState;
  generatedAt: string;
  configuredQueues: number;
  reservedQueues: number;
  notConfiguredQueues: number;
  totalRuns: number;
  activeOrQueued: number;
  failed: number;
  stalled: number;
  lastObservedAt?: string;
  queues: WorkerQueueHealthSummary[];
}

function isTerminalStatus(status: OpenPracticeJobStatus): boolean {
  return status === "completed" || status === "dead_letter" || status === "skipped";
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function errorSummary(errorMessage: string | undefined): string | undefined {
  return errorMessage
    ? "Job failed. Error details are redacted; review server logs for privileged diagnostics."
    : undefined;
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
    idempotencyKeyPresent: Boolean(record.idempotencyKey),
    attemptsMade: record.attemptsMade,
    maxAttempts: record.maxAttempts,
    queuedAt: record.queuedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    failedAt: record.failedAt,
    errorSummary: errorSummary(record.errorMessage),
    metadata: redactJobMetadata(record.metadata),
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

function observedTime(record: JobLifecycleRecord): string | undefined {
  return record.finishedAt ?? record.failedAt ?? record.startedAt ?? record.queuedAt;
}

function latestIso(values: Array<string | undefined>): string | undefined {
  const timestamps = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function isStalled(record: JobLifecycleRecord, nowMs: number): boolean {
  if (record.status === "active") {
    return nowMs - Date.parse(record.startedAt ?? record.queuedAt) > 30 * 60 * 1000;
  }
  if (record.status === "queued") {
    return nowMs - Date.parse(record.queuedAt) > 60 * 60 * 1000;
  }
  return false;
}

export function summarizeWorkerHealth(input: {
  records: JobLifecycleRecord[];
  workerQueues: WorkerQueueStatus[];
  now?: string;
}): WorkerHealthSummary {
  const generatedAt = input.now ?? new Date().toISOString();
  const nowMs = Date.parse(generatedAt);
  const queues = input.workerQueues.map((queue): WorkerQueueHealthSummary => {
    const queueRecords = input.records.filter((record) => record.queueName === queue.queueName);
    const failedRecords = queueRecords.filter(
      (record) => record.status === "failed" || record.status === "dead_letter",
    );
    const stalled = queueRecords.filter((record) => isStalled(record, nowMs)).length;
    const degradedReasons = [
      failedRecords.length > 0 ? "failed_jobs_observed" : undefined,
      stalled > 0 ? "stalled_jobs_observed" : undefined,
    ].filter((reason): reason is string => Boolean(reason));
    const health: WorkerQueueHealthState =
      degradedReasons.length > 0
        ? "degraded"
        : queue.status === "configured" && queueRecords.length > 0
          ? "healthy"
          : "unknown";

    return {
      queueName: queue.queueName,
      status: queue.status,
      health,
      total: queueRecords.length,
      queued: queueRecords.filter((record) => record.status === "queued").length,
      active: queueRecords.filter((record) => record.status === "active").length,
      failed: failedRecords.length,
      terminal: queueRecords.filter((record) => isTerminalStatus(record.status)).length,
      stalled,
      lastObservedAt: latestIso(queueRecords.map(observedTime)),
      lastFailureAt: latestIso(failedRecords.map((record) => record.failedAt ?? record.finishedAt)),
      degradedReasons,
    };
  });
  const failed = queues.reduce((sum, queue) => sum + queue.failed, 0);
  const stalled = queues.reduce((sum, queue) => sum + queue.stalled, 0);
  const configuredQueues = input.workerQueues.filter(
    (queue) => queue.status === "configured",
  ).length;
  const status: WorkerQueueHealthState =
    failed > 0 || stalled > 0
      ? "degraded"
      : configuredQueues > 0 && queues.some((queue) => queue.health === "healthy")
        ? "healthy"
        : "unknown";

  return {
    status,
    generatedAt,
    configuredQueues,
    reservedQueues: input.workerQueues.filter((queue) => queue.status === "reserved").length,
    notConfiguredQueues: input.workerQueues.filter((queue) => queue.status === "not_configured")
      .length,
    totalRuns: input.records.length,
    activeOrQueued: input.records.filter(
      (record) => record.status === "queued" || record.status === "active",
    ).length,
    failed,
    stalled,
    lastObservedAt: latestIso(input.records.map(observedTime)),
    queues,
  };
}

export function queueStatus(
  queueName: OpenPracticeQueueName,
  queue: ApiJobQueue | undefined,
): WorkerQueueStatus {
  const reserved = reservedDocumentProcessingTasks.find((task) => task.queueName === queueName);
  if (reservedWorkerQueueNames.has(queueName) && reserved) {
    return {
      queueName,
      status: "reserved",
      reason: "deferred_worker",
      task: reserved.task,
      actionable: false,
    };
  }
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
