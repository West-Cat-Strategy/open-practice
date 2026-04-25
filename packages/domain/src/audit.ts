import { createHash } from "node:crypto";

export const GENESIS_AUDIT_HASH = "0".repeat(64);

export interface AuditEvent {
  id: string;
  firmId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export type NewAuditEvent = Omit<AuditEvent, "previousHash" | "hash">;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
    .join(",")}}`;
}

export function hashAuditPayload(payload: Omit<AuditEvent, "hash">): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

export function appendAuditEvent(
  previous: AuditEvent | undefined,
  next: NewAuditEvent,
): AuditEvent {
  const previousHash = previous?.hash ?? GENESIS_AUDIT_HASH;
  const eventWithoutHash = { ...next, previousHash };
  return {
    ...eventWithoutHash,
    hash: hashAuditPayload(eventWithoutHash),
  };
}

export function verifyAuditChain(events: AuditEvent[]): boolean {
  let previousHash = GENESIS_AUDIT_HASH;
  for (const event of events) {
    if (event.previousHash !== previousHash) return false;
    const withoutHash = {
      id: event.id,
      firmId: event.firmId,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      previousHash: event.previousHash,
    };
    if (event.hash !== hashAuditPayload(withoutHash)) return false;
    previousHash = event.hash;
  }
  return true;
}
