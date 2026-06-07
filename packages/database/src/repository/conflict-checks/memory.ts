import {
  runConflictCheck,
  type AuditEvent,
  type ConflictCheckRecord,
  type Contact,
  type Matter,
  type MatterParty,
} from "@open-practice/domain";
import { appendMemoryAuditEvent } from "../audit/memory.js";
import type {
  ConflictCheckRunInput,
  ConflictCheckRunResult,
} from "../conflict-checks-contracts.js";
import { clone } from "../contracts.js";

export interface MemoryConflictCheckStore {
  contacts: Contact[];
  matters: Matter[];
  matterParties: MatterParty[];
  conflictChecks: ConflictCheckRecord[];
  auditEvents: AuditEvent[];
}

export function runMemoryConflictCheck(
  store: MemoryConflictCheckStore,
  input: ConflictCheckRunInput,
): { results: ConflictCheckRunResult; auditChainValid: boolean } {
  const results = runConflictCheck({
    ...input,
    contacts: store.contacts,
    matters: store.matters,
    matterParties: store.matterParties,
  });
  const checkId = `conflict-check-${String(store.conflictChecks.length + 1).padStart(3, "0")}`;
  const createdAt = new Date().toISOString();
  store.conflictChecks = [
    ...store.conflictChecks,
    {
      id: checkId,
      firmId: input.firmId,
      requestedByUserId: input.actorId,
      prospectiveName: input.prospectiveName,
      querySnapshot: {
        prospectiveName: input.prospectiveName,
        aliases: input.aliases ?? [],
        identifiers: input.identifiers ?? [],
        includeClosedMatters: input.includeClosedMatters,
        ...(input.prospectiveRole ? { prospectiveRole: input.prospectiveRole } : {}),
      },
      resultSnapshot: clone(results),
      disposition: "pending_review",
      createdAt,
    },
  ];
  appendMemoryAuditEvent(store, {
    id: `audit-${String(store.auditEvents.length + 1).padStart(3, "0")}`,
    firmId: input.firmId,
    actorId: input.actorId,
    action: "conflict_check.completed",
    resourceType: "conflict_check",
    resourceId: checkId,
    occurredAt: createdAt,
    metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
  });
  return { results, auditChainValid: store.auditEvents.length > 0 };
}
