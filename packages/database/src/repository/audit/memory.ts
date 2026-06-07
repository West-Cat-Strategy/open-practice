import {
  appendAuditEvent,
  verifyAuditChain,
  type AuditEvent,
  type NewAuditEvent,
} from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryAuditStore {
  auditEvents: AuditEvent[];
}

export function listMemoryAuditEvents(
  store: MemoryAuditStore,
  firmId: string,
): { events: AuditEvent[]; valid: boolean } {
  const events = store.auditEvents
    .filter((event) => event.firmId === firmId)
    .sort((left, right) => left.sequence - right.sequence);
  return { events: clone(events), valid: verifyAuditChain(events) };
}

export function appendMemoryAuditEvent(store: MemoryAuditStore, event: NewAuditEvent): AuditEvent {
  const firmEvents = store.auditEvents
    .filter((candidate) => candidate.firmId === event.firmId)
    .sort((left, right) => left.sequence - right.sequence);
  const appended = appendAuditEvent(firmEvents.at(-1), event);
  store.auditEvents = [...store.auditEvents, appended];
  return clone(appended);
}

export function recordMemoryAuditEvent(store: MemoryAuditStore, event: AuditEvent): void {
  appendMemoryAuditEvent(store, {
    id: event.id,
    firmId: event.firmId,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    occurredAt: event.occurredAt,
    metadata: event.metadata,
  });
}
