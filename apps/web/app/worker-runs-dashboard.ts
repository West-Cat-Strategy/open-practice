import type {
  WorkerRunQueueFilter,
  WorkerHealthResponse,
  WorkerRunSummaryItem,
  WorkerRunsDashboardResponse,
  WorkerRunsResponse,
} from "./types";

export const workerRunFilters: Array<{ key: WorkerRunQueueFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "email", label: "Email" },
  { key: "ocr", label: "OCR" },
];

const reservedWorkerQueues = [
  {
    queueName: "ai_triage",
    status: "reserved",
    reason: "deferred_worker",
    task: "classification",
    actionable: false,
  },
  {
    queueName: "transcription",
    status: "reserved",
    reason: "deferred_worker",
    task: "transcription",
    actionable: false,
  },
  {
    queueName: "media",
    status: "reserved",
    reason: "deferred_worker",
    task: "media",
    actionable: false,
  },
] satisfies NonNullable<WorkerRunsResponse["reservedQueues"]>;

export function buildWorkerRunsPath(filter: WorkerRunQueueFilter = "all"): string {
  return filter === "all" ? "/api/jobs" : `/api/jobs?queueName=${encodeURIComponent(filter)}`;
}

export function buildWorkerHealthPath(): string {
  return "/api/jobs/health";
}

export function emptyWorkerRunsResponse(status = "default"): WorkerRunsResponse {
  return {
    status,
    queues: [
      "email",
      "connectors",
      "inbound_email",
      "reports",
      "ai_triage",
      "ocr",
      "transcription",
      "media",
    ],
    workers: [],
    workerQueues: [],
    reservedQueues: reservedWorkerQueues,
    summary: { total: 0, queued: 0, active: 0, failed: 0, terminal: 0, byQueue: [] },
    jobs: [],
  };
}

export function emptyWorkerHealthResponse(status: WorkerHealthResponse["status"] = "unknown") {
  return {
    status,
    generatedAt: "",
    configuredQueues: 0,
    reservedQueues: reservedWorkerQueues.length,
    notConfiguredQueues: 0,
    totalRuns: 0,
    activeOrQueued: 0,
    failed: 0,
    stalled: 0,
    queues: [],
  } satisfies WorkerHealthResponse;
}

export function workerRunsForFilter(
  dashboard: WorkerRunsDashboardResponse,
  filter: WorkerRunQueueFilter,
): WorkerRunsResponse {
  return dashboard[filter] ?? dashboard.all;
}

export function summarizeWorkerRuns(response: WorkerRunsResponse): string {
  const active = response.summary.queued + response.summary.active;
  return `${response.summary.total} worker runs. ${active} active or queued. ${response.summary.failed} failed. ${response.summary.terminal} terminal.`;
}

export function summarizeWorkerHealth(response: WorkerHealthResponse): string {
  const observed = response.lastObservedAt
    ? ` Last activity ${compactDate(response.lastObservedAt)}.`
    : "";
  return `${response.configuredQueues} configured queues, ${response.reservedQueues} reserved, ${response.notConfiguredQueues} not configured. ${response.failed} failed and ${response.stalled} stalled.${observed}`;
}

export function workerHealthTone(
  status: WorkerHealthResponse["status"],
): "neutral" | "ready" | "risk" {
  if (status === "healthy") return "ready";
  if (status === "degraded") return "risk";
  return "neutral";
}

export function describeWorkerRunStatus(job: WorkerRunSummaryItem): {
  label: string;
  tone: "neutral" | "ready" | "risk";
} {
  if (job.failed) return { label: job.retryable ? "retry pending" : "failed", tone: "risk" };
  if (job.terminal || job.status === "completed" || job.status === "skipped") {
    return { label: job.status.replaceAll("_", " "), tone: "ready" };
  }
  return { label: job.status.replaceAll("_", " "), tone: "neutral" };
}

export function formatWorkerRunAttempts(job: WorkerRunSummaryItem): string {
  const attemptsMade = typeof job.attemptsMade === "number" ? job.attemptsMade : 0;
  const maxAttempts = typeof job.maxAttempts === "number" ? job.maxAttempts : 0;
  return `${attemptsMade}/${maxAttempts} attempts`;
}

export function formatWorkerRunTiming(job: WorkerRunSummaryItem): string {
  if (job.nextAttemptAt) return `next ${compactDate(job.nextAttemptAt)}`;
  if (job.finishedAt) return `finished ${compactDate(job.finishedAt)}`;
  if (job.failedAt) return `failed ${compactDate(job.failedAt)}`;
  if (job.startedAt) return `started ${compactDate(job.startedAt)}`;
  if (job.queuedAt) return `queued ${compactDate(job.queuedAt)}`;
  return "timing unavailable";
}

export function workerRunSafeContext(job: WorkerRunSummaryItem): string {
  const parts = [
    job.targetResourceType && job.targetResourceId
      ? `target ${job.targetResourceType}:${job.targetResourceId}`
      : undefined,
    metadataLabel(job, "matterId", "matter"),
    metadataLabel(job, "emailId", "email"),
    metadataLabel(job, "documentId", "document"),
    metadataLabel(job, "task", "task"),
    metadataLabel(job, "provider", "provider"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No redacted context available.";
}

function metadataLabel(job: WorkerRunSummaryItem, key: string, label: string): string | undefined {
  const value = job.metadata?.[key];
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }
  return `${label} ${String(value)}`;
}

function compactDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-CA");
}
