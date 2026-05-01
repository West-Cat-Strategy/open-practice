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
