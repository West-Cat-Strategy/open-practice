import type { ProfessionalRole } from "./models.js";

export type WorkflowAuditActorType = ProfessionalRole | "system";
export type WorkflowAuditStatus = "queued" | "active" | "succeeded" | "failed" | "skipped";

export interface WorkflowAuditMetadata extends Record<string, unknown> {
  requestId?: string;
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
