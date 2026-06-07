import {
  runConflictCheck,
  type AuditEvent,
  type Contact,
  type MatterParty,
  type NewAuditEvent,
} from "@open-practice/domain";
import { eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  ConflictCheckRunInput,
  ConflictCheckRunResult,
} from "../conflict-checks-contracts.js";
import { mapMatter } from "../drizzle-mappers.js";

export interface DrizzleConflictCheckDependencies {
  listContacts(firmId: string): Promise<Contact[]>;
  listMatterParties(firmId: string): Promise<MatterParty[]>;
  appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent>;
  listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }>;
}

export async function runDrizzleConflictCheck(
  db: OpenPracticeDatabase,
  input: ConflictCheckRunInput,
  dependencies: DrizzleConflictCheckDependencies,
): Promise<{ results: ConflictCheckRunResult; auditChainValid: boolean }> {
  const contacts = await dependencies.listContacts(input.firmId);
  const matters = (
    await db.select().from(schema.matters).where(eq(schema.matters.firmId, input.firmId))
  ).map(mapMatter);
  const matterParties = await dependencies.listMatterParties(input.firmId);
  const results = runConflictCheck({ ...input, contacts, matters, matterParties });
  const checkId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(schema.conflictChecks).values({
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
    resultSnapshot: results,
    disposition: "pending_review",
    createdAt: new Date(createdAt),
  });
  await dependencies.appendAuditEvent({
    id: crypto.randomUUID(),
    firmId: input.firmId,
    actorId: input.actorId,
    action: "conflict_check.completed",
    resourceType: "conflict_check",
    resourceId: checkId,
    occurredAt: createdAt,
    metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
  });
  return { results, auditChainValid: (await dependencies.listAuditEvents(input.firmId)).valid };
}
