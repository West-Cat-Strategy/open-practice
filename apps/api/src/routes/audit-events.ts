import type { OpenPracticeRepository } from "@open-practice/database";
import type { NewAuditEvent } from "@open-practice/domain";
import type { ApiAuthContext } from "../server.js";

export type RouteAuditMetadata = Record<string, unknown>;

function compactMetadata(metadata: RouteAuditMetadata = {}): RouteAuditMetadata {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

export async function appendRouteAuditEvent(
  repository: OpenPracticeRepository,
  auth: ApiAuthContext,
  event: Omit<NewAuditEvent, "id" | "firmId" | "actorId" | "occurredAt"> & {
    occurredAt?: string;
  },
): Promise<void> {
  await repository.appendAuditEvent({
    id: crypto.randomUUID(),
    firmId: auth.firmId,
    actorId: auth.user.id,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: compactMetadata(event.metadata),
  });
}

export type WorkflowAuditEnvelopeInput = {
  requestId: string;
  matterIds?: string[];
  status: "succeeded" | "failed" | "queued" | "skipped";
  idempotencyKeyPresent?: boolean;
  errorSummary?: string;
};

export async function appendWorkflowAuditEvent(
  repository: OpenPracticeRepository,
  auth: ApiAuthContext,
  event: Omit<NewAuditEvent, "id" | "firmId" | "actorId" | "occurredAt"> & {
    occurredAt?: string;
    metadata?: RouteAuditMetadata;
    workflow: WorkflowAuditEnvelopeInput;
  },
): Promise<void> {
  await appendRouteAuditEvent(repository, auth, {
    ...event,
    metadata: {
      ...event.metadata,
      requestId: event.workflow.requestId,
      actorId: auth.user.id,
      matterIds: event.workflow.matterIds,
      workflowStatus: event.workflow.status,
      idempotencyKeyPresent: event.workflow.idempotencyKeyPresent,
      errorSummary: event.workflow.errorSummary,
    },
  });
}
