import type {
  WorkerRunQueueFilter,
  WorkerHealthResponse,
  WorkerRunSummaryItem,
  WorkerRunsDashboardResponse,
  WorkerRunsResponse,
  WorkflowHistoryItem,
  WorkflowHistoryResponse,
  WorkflowHistoryStatus,
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

export function buildWorkflowHistoryPath(): string {
  return "/api/jobs/workflows";
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

export function emptyWorkflowHistoryResponse(status = "default"): WorkflowHistoryResponse {
  return {
    status,
    generatedAt: "",
    summary: { total: 0, active: 0, failed: 0, terminal: 0 },
    workflows: [],
  };
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

export function summarizeWorkflowHistory(response: WorkflowHistoryResponse): string {
  return `${response.summary.total} workflow histories. ${response.summary.active} active or queued. ${response.summary.failed} failed. ${response.summary.terminal} terminal.`;
}

const workflowReviewPacketCueLimit = 3;
const workflowReviewPacketCueTextLimit = 32;
const workflowReviewPacketSummaryLimit = 220;

function boundedText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

export function workflowReviewPacketSummary(workflow: WorkflowHistoryItem): string | undefined {
  const packet = workflow.reviewPacket;
  if (!packet) return undefined;

  const posture = [
    packet.reviewOnly ? "review only" : undefined,
    packet.automationDisabled ? "automation disabled" : undefined,
    packet.externalConnectorDisabled ? "external connector disabled" : undefined,
    packet.backgroundMutationDisabled ? "background mutation disabled" : undefined,
  ].filter(Boolean);
  const visibleCues = packet.cues
    .slice(0, workflowReviewPacketCueLimit)
    .map((cue) => boundedText(`${cue.label} ${cue.value}`, workflowReviewPacketCueTextLimit));
  const hiddenCueCount = packet.cues.length - visibleCues.length;
  const cueSummary = [
    ...visibleCues,
    hiddenCueCount > 0 ? `${hiddenCueCount} more cue${hiddenCueCount === 1 ? "" : "s"}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return boundedText(
    [posture.join(", "), cueSummary ? `cues ${cueSummary}` : "no safe cues available"]
      .filter(Boolean)
      .join(" · "),
    workflowReviewPacketSummaryLimit,
  );
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

export function describeWorkflowHistoryStatus(status: WorkflowHistoryStatus): {
  label: string;
  tone: "neutral" | "ready" | "risk";
} {
  if (status === "failed") return { label: "failed", tone: "risk" };
  if (status === "succeeded" || status === "skipped") {
    return { label: status, tone: "ready" };
  }
  return { label: status, tone: "neutral" };
}

export function workflowHistorySafeContext(workflow: WorkflowHistoryItem): string {
  const parts = [
    workflow.resourceType && workflow.resourceId
      ? `target ${workflow.resourceType}:${workflow.resourceId}`
      : undefined,
    workflow.matterIds.length > 0 ? `matters ${workflow.matterIds.join(", ")}` : undefined,
    workflow.queueNames.length > 0 ? `queues ${workflow.queueNames.join(", ")}` : undefined,
    workflow.jobIds.length > 0 ? `${workflow.jobIds.length} job refs` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No redacted context available.";
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
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}
