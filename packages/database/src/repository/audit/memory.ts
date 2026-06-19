import {
  appendAuditEvent,
  verifyAuditChain,
  type AuditEvent,
  type NewAuditEvent,
} from "@open-practice/domain";
import type { AuditEventReadFilter } from "../audit-contracts.js";
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

function metadataContainsMatterId(value: unknown, matterId: string): boolean {
  if (value === matterId) return true;
  return Array.isArray(value) && value.includes(matterId);
}

function auditEventTouchesMatter(event: AuditEvent, matterId: string): boolean {
  return (
    (event.resourceType === "matter" && event.resourceId === matterId) ||
    metadataContainsMatterId(event.metadata.matterId, matterId) ||
    metadataContainsMatterId(event.metadata.matterIds, matterId) ||
    metadataContainsMatterId(event.metadata.previousMatterId, matterId)
  );
}

function auditEventMatchesFilter(event: AuditEvent, filter: AuditEventReadFilter): boolean {
  if (filter.actions && !filter.actions.includes(event.action)) return false;
  if (filter.resourceType && event.resourceType !== filter.resourceType) return false;
  if (filter.resourceId && event.resourceId !== filter.resourceId) return false;
  if (filter.matterId && !auditEventTouchesMatter(event, filter.matterId)) return false;
  return true;
}

export function listMemoryFilteredAuditEvents(
  store: MemoryAuditStore,
  firmId: string,
  filter: AuditEventReadFilter,
): AuditEvent[] {
  if (filter.actions?.length === 0) return [];

  const events = store.auditEvents
    .filter((event) => event.firmId === firmId && auditEventMatchesFilter(event, filter))
    .sort((left, right) => left.sequence - right.sequence);
  return clone(events);
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
