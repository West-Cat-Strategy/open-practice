import { createHash } from "node:crypto";

export const GENESIS_AUDIT_HASH = "0".repeat(64);

export interface AuditEvent {
  id: string;
  firmId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  sequence: number;
  occurredAt: string;
  metadata: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export type NewAuditEvent = Omit<AuditEvent, "sequence" | "previousHash" | "hash">;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
    .join(",")}}`;
}

type AuditHashPayload = Omit<AuditEvent, "sequence" | "hash">;

export function hashAuditPayload(payload: AuditHashPayload): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

export function appendAuditEvent(
  previous: AuditEvent | undefined,
  next: NewAuditEvent,
): AuditEvent {
  const previousHash = previous?.hash ?? GENESIS_AUDIT_HASH;
  const sequence = (previous?.sequence ?? 0) + 1;
  const eventWithoutHash = { ...next, previousHash };
  return {
    ...eventWithoutHash,
    sequence,
    hash: hashAuditPayload(eventWithoutHash),
  };
}

export function verifyAuditChain(events: AuditEvent[]): boolean {
  let previousHash = GENESIS_AUDIT_HASH;
  let previousSequence = 0;
  for (const event of events) {
    if (event.sequence !== previousSequence + 1) return false;
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
    previousSequence = event.sequence;
    previousHash = event.hash;
  }
  return true;
}
