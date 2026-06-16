import type { AuditEvent } from "./audit.js";
import type { ProfessionalRole } from "./models.js";
import type {
  JobLifecycleRecord,
  OpenPracticeJobStatus,
  OpenPracticeQueueName,
} from "./operations.js";
import { redactJobMetadata } from "./permissions.js";

export type WorkflowAuditActorType = ProfessionalRole | "system";
export type WorkflowAuditStatus = "queued" | "active" | "succeeded" | "failed" | "skipped";

export interface WorkflowAuditMetadata extends Record<string, unknown> {
  requestId?: string;
  jobId?: string;
  actorType?: WorkflowAuditActorType;
  actorId?: string;
  matterId?: string;
  matterIds?: string[];
  workflowStatus?: WorkflowAuditStatus;
  beforeStatus?: string;
  expectedStatus?: string;
  afterStatus?: string;
  attemptNumber?: number;
  maxAttempts?: number;
  retryOfJobId?: string;
  nextAttemptAt?: string;
  idempotencyKeyPresent?: boolean;
  errorSummary?: string;
}

export interface WorkflowAuditMetadataInput extends WorkflowAuditMetadata {
  [key: string]: unknown;
}

export type WorkflowHistoryStatus = WorkflowAuditStatus;
export type WorkflowHistoryStepSource = "audit" | "job";

export interface WorkflowHistoryStep {
  id: string;
  source: WorkflowHistoryStepSource;
  label: string;
  status: WorkflowHistoryStatus;
  occurredAt: string;
  matterIds: string[];
  resourceType?: string;
  resourceId?: string;
  action?: string;
  queueName?: OpenPracticeQueueName;
  jobName?: string;
  jobId?: string;
  retryOfJobId?: string;
  idempotencyKeyPresent?: boolean;
  attemptsMade?: number;
  maxAttempts?: number;
  metadata: Record<string, string | number | boolean>;
}

export interface WorkflowHistoryItem {
  id: string;
  groupKey: string;
  title: string;
  status: WorkflowHistoryStatus;
  startedAt: string;
  lastObservedAt: string;
  finishedAt?: string;
  matterIds: string[];
  resourceType?: string;
  resourceId?: string;
  queueNames: OpenPracticeQueueName[];
  jobIds: string[];
  stepCount: number;
  steps: WorkflowHistoryStep[];
}

export interface WorkflowHistoryProjection {
  status: "available" | "default";
  generatedAt: string;
  summary: {
    total: number;
    active: number;
    failed: number;
    terminal: number;
  };
  workflows: WorkflowHistoryItem[];
}

export interface BuildWorkflowHistoryProjectionInput {
  jobs: JobLifecycleRecord[];
  auditEvents: AuditEvent[];
  generatedAt?: string;
  limit?: number;
  matterId?: string;
  queueName?: OpenPracticeQueueName;
  status?: WorkflowHistoryStatus;
}

function safeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function safeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = [
    ...new Set(value.map(safeString).filter((item): item is string => Boolean(item))),
  ];
  return values.length > 0 ? values : undefined;
}

function safeNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function safeWorkflowStatus(value: unknown): WorkflowAuditStatus | undefined {
  return value === "queued" ||
    value === "active" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "skipped"
    ? value
    : undefined;
}

function safeActorType(value: unknown): WorkflowAuditActorType | undefined {
  return value === "owner_admin" ||
    value === "licensee" ||
    value === "firm_member" ||
    value === "billing_bookkeeper" ||
    value === "client_external" ||
    value === "auditor" ||
    value === "system"
    ? value
    : undefined;
}

export function buildWorkflowAuditMetadata(
  input: WorkflowAuditMetadataInput = {},
): WorkflowAuditMetadata {
  const metadata: WorkflowAuditMetadata = {};
  const requestId = safeString(input.requestId);
  const actorType = safeActorType(input.actorType);
  const jobId = safeString(input.jobId);
  const actorId = safeString(input.actorId);
  const matterId = safeString(input.matterId);
  const matterIds = safeStringArray(input.matterIds);
  const workflowStatus = safeWorkflowStatus(input.workflowStatus);
  const beforeStatus = safeString(input.beforeStatus);
  const expectedStatus = safeString(input.expectedStatus);
  const afterStatus = safeString(input.afterStatus);
  const attemptNumber = safeNonNegativeInteger(input.attemptNumber);
  const maxAttempts = safeNonNegativeInteger(input.maxAttempts);
  const retryOfJobId = safeString(input.retryOfJobId);
  const nextAttemptAt = safeString(input.nextAttemptAt);
  const idempotencyKeyPresent = safeBoolean(input.idempotencyKeyPresent);
  const errorSummary = safeString(input.errorSummary);

  if (requestId) metadata.requestId = requestId;
  if (jobId) metadata.jobId = jobId;
  if (actorType) metadata.actorType = actorType;
  if (actorId) metadata.actorId = actorId;
  if (matterId) metadata.matterId = matterId;
  if (matterIds) metadata.matterIds = matterIds;
  if (workflowStatus) metadata.workflowStatus = workflowStatus;
  if (beforeStatus) metadata.beforeStatus = beforeStatus;
  if (expectedStatus) metadata.expectedStatus = expectedStatus;
  if (afterStatus) metadata.afterStatus = afterStatus;
  if (attemptNumber !== undefined) metadata.attemptNumber = attemptNumber;
  if (maxAttempts !== undefined) metadata.maxAttempts = maxAttempts;
  if (retryOfJobId) metadata.retryOfJobId = retryOfJobId;
  if (nextAttemptAt) metadata.nextAttemptAt = nextAttemptAt;
  if (idempotencyKeyPresent !== undefined) metadata.idempotencyKeyPresent = idempotencyKeyPresent;
  if (errorSummary) metadata.errorSummary = errorSummary;

  return metadata;
}

function safeMetadataValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") return value.slice(0, 256);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function compactSafeMetadata(
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const safeValue = safeMetadataValue(value);
    if (safeValue !== undefined) safe[key] = safeValue;
  }
  return safe;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  return safeString(metadata[key]);
}

function metadataBoolean(metadata: Record<string, unknown>, key: string): boolean | undefined {
  return safeBoolean(metadata[key]);
}

function metadataMatterIds(metadata: Record<string, unknown>): string[] {
  return [
    ...new Set([
      ...(safeStringArray(metadata.matterIds) ?? []),
      ...(metadataString(metadata, "matterId") ? [metadataString(metadata, "matterId")!] : []),
    ]),
  ];
}

function jobStatusToWorkflowStatus(status: OpenPracticeJobStatus): WorkflowHistoryStatus {
  if (status === "completed") return "succeeded";
  if (status === "failed" || status === "dead_letter") return "failed";
  if (status === "active") return "active";
  if (status === "skipped") return "skipped";
  return "queued";
}

function auditStatusToWorkflowStatus(metadata: Record<string, unknown>): WorkflowHistoryStatus {
  return safeWorkflowStatus(metadata.workflowStatus) ?? "succeeded";
}

function observedJobTime(job: JobLifecycleRecord): string {
  return job.finishedAt ?? job.failedAt ?? job.startedAt ?? job.queuedAt;
}

function workflowGroupKey(input: {
  requestId?: string;
  jobId?: string;
  retryOfJobId?: string;
  resourceType?: string;
  resourceId?: string;
}): string {
  if (input.requestId) return `request:${input.requestId}`;
  if (input.jobId) return `job:${input.jobId}`;
  if (input.retryOfJobId) return `job:${input.retryOfJobId}`;
  if (input.resourceType && input.resourceId)
    return `resource:${input.resourceType}:${input.resourceId}`;
  return "workflow:unknown";
}

function workflowTitle(step: WorkflowHistoryStep): string {
  if (step.action) return step.action.replaceAll("_", " ").replaceAll(".", " ");
  if (step.jobName) return step.jobName.replaceAll("_", " ");
  if (step.resourceType) return `${step.resourceType.replaceAll("_", " ")} workflow`;
  return "Workflow history";
}

function auditEventToStep(event: AuditEvent): WorkflowHistoryStep {
  const metadata = buildWorkflowAuditMetadata(event.metadata);
  const retryOfJobId = metadataString(metadata, "retryOfJobId");
  const idempotencyKeyPresent = metadataBoolean(metadata, "idempotencyKeyPresent");
  return {
    id: event.id,
    source: "audit",
    label: event.action.replaceAll("_", " ").replaceAll(".", " "),
    status: auditStatusToWorkflowStatus(metadata),
    occurredAt: event.occurredAt,
    matterIds: metadataMatterIds(metadata),
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    action: event.action,
    retryOfJobId,
    idempotencyKeyPresent,
    attemptsMade: safeNonNegativeInteger(metadata.attemptNumber),
    maxAttempts: safeNonNegativeInteger(metadata.maxAttempts),
    metadata: compactSafeMetadata(metadata),
  };
}

function jobToStep(job: JobLifecycleRecord): WorkflowHistoryStep {
  const metadata = redactJobMetadata(job.metadata);
  return {
    id: job.id,
    source: "job",
    label: job.jobName.replaceAll("_", " "),
    status: jobStatusToWorkflowStatus(job.status),
    occurredAt: observedJobTime(job),
    matterIds: metadataMatterIds(metadata),
    resourceType: job.targetResourceType,
    resourceId: job.targetResourceId,
    queueName: job.queueName,
    jobName: job.jobName,
    jobId: job.id,
    retryOfJobId: metadataString(metadata, "retryOfJobId"),
    idempotencyKeyPresent:
      Boolean(job.idempotencyKey) || metadataBoolean(metadata, "idempotencyKeyPresent"),
    attemptsMade: job.attemptsMade,
    maxAttempts: job.maxAttempts,
    metadata: compactSafeMetadata(metadata),
  };
}

function stepGroupKey(step: WorkflowHistoryStep): string {
  return workflowGroupKey({
    requestId: metadataString(step.metadata, "requestId"),
    jobId: step.jobId ?? metadataString(step.metadata, "jobId"),
    retryOfJobId: step.retryOfJobId,
    resourceType: step.resourceType,
    resourceId: step.resourceId,
  });
}

function latestIso(values: string[]): string {
  return values.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}

function earliestIso(values: string[]): string {
  return values.reduce((earliest, value) =>
    Date.parse(value) < Date.parse(earliest) ? value : earliest,
  );
}

function summarizeWorkflowStatus(steps: WorkflowHistoryStep[]): WorkflowHistoryStatus {
  return steps.at(-1)?.status ?? "skipped";
}

function workflowFinishedAt(
  status: WorkflowHistoryStatus,
  steps: WorkflowHistoryStep[],
): string | undefined {
  if (status === "active" || status === "queued") return undefined;
  return latestIso(steps.map((step) => step.occurredAt));
}

export function buildWorkflowHistoryProjection(
  input: BuildWorkflowHistoryProjectionInput,
): WorkflowHistoryProjection {
  const grouped = new Map<string, WorkflowHistoryStep[]>();
  const allSteps = [
    ...input.auditEvents
      .filter((event) => safeWorkflowStatus(event.metadata.workflowStatus))
      .map(auditEventToStep),
    ...input.jobs.map(jobToStep),
  ];

  for (const step of allSteps) {
    const key = stepGroupKey(step);
    grouped.set(key, [...(grouped.get(key) ?? []), step]);
  }

  const workflows = [...grouped.entries()]
    .map(([groupKey, steps]): WorkflowHistoryItem => {
      const orderedSteps = [...steps].sort((left, right) => {
        const byTime = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
        return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
      });
      const status = summarizeWorkflowStatus(orderedSteps);
      const matterIds = [...new Set(orderedSteps.flatMap((step) => step.matterIds))].sort();
      const queueNames = [
        ...new Set(
          orderedSteps
            .map((step) => step.queueName)
            .filter((queueName): queueName is OpenPracticeQueueName => Boolean(queueName)),
        ),
      ].sort();
      const jobIds = [
        ...new Set(
          orderedSteps
            .map((step) => step.jobId ?? metadataString(step.metadata, "jobId"))
            .filter((jobId): jobId is string => Boolean(jobId)),
        ),
      ].sort();
      const firstStep = orderedSteps[0]!;
      return {
        id: groupKey,
        groupKey,
        title: workflowTitle(firstStep),
        status,
        startedAt: earliestIso(orderedSteps.map((step) => step.occurredAt)),
        lastObservedAt: latestIso(orderedSteps.map((step) => step.occurredAt)),
        finishedAt: workflowFinishedAt(status, orderedSteps),
        matterIds,
        resourceType: firstStep.resourceType,
        resourceId: firstStep.resourceId,
        queueNames,
        jobIds,
        stepCount: orderedSteps.length,
        steps: orderedSteps,
      };
    })
    .filter(
      (workflow) =>
        (!input.queueName || workflow.queueNames.includes(input.queueName)) &&
        (!input.matterId || workflow.matterIds.includes(input.matterId)),
    )
    .filter((workflow) => !input.status || workflow.status === input.status)
    .sort((left, right) => Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt))
    .slice(0, input.limit ?? 25);

  return {
    status: workflows.length > 0 ? "available" : "default",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      total: workflows.length,
      active: workflows.filter(
        (workflow) => workflow.status === "active" || workflow.status === "queued",
      ).length,
      failed: workflows.filter((workflow) => workflow.status === "failed").length,
      terminal: workflows.filter(
        (workflow) => workflow.status === "succeeded" || workflow.status === "skipped",
      ).length,
    },
    workflows,
  };
}
