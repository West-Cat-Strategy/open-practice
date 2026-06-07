import {
  validateAiOperationalProposalRecord,
  type AiOperationalProposalRecord,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import type { AiOperationalProposalListOptions } from "../ai-operational-proposals-contracts.js";
import { mapAiOperationalProposalRow } from "../drizzle-mappers.js";

export async function listDrizzleAiOperationalProposals(
  db: OpenPracticeDatabase,
  firmId: string,
  options: AiOperationalProposalListOptions = {},
): Promise<AiOperationalProposalRecord[]> {
  const conditions = [eq(schema.aiOperationalProposals.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.aiOperationalProposals.matterId, options.matterId));
  }
  if (options.status) conditions.push(eq(schema.aiOperationalProposals.status, options.status));
  if (options.kind) conditions.push(eq(schema.aiOperationalProposals.kind, options.kind));

  const rows = await db
    .select()
    .from(schema.aiOperationalProposals)
    .where(and(...conditions))
    .orderBy(desc(schema.aiOperationalProposals.createdAt));
  return rows.map(mapAiOperationalProposalRow);
}

export async function getDrizzleAiOperationalProposal(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<AiOperationalProposalRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.aiOperationalProposals)
    .where(
      and(
        eq(schema.aiOperationalProposals.firmId, firmId),
        eq(schema.aiOperationalProposals.id, id),
      ),
    );
  return row ? mapAiOperationalProposalRow(row) : undefined;
}

export async function createDrizzleAiOperationalProposal(
  db: OpenPracticeDatabase,
  record: AiOperationalProposalRecord,
): Promise<AiOperationalProposalRecord> {
  validateAiOperationalProposalRecord(record);
  await db.insert(schema.aiOperationalProposals).values({
    ...record,
    reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  });
  return clone(record);
}

export async function updateDrizzleAiOperationalProposal(
  db: OpenPracticeDatabase,
  record: AiOperationalProposalRecord,
): Promise<AiOperationalProposalRecord> {
  validateAiOperationalProposalRecord(record);
  const [row] = await db
    .update(schema.aiOperationalProposals)
    .set({
      status: record.status,
      reviewDecision: record.reviewDecision,
      reviewedByUserId: record.reviewedByUserId,
      reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
      updatedAt: new Date(record.updatedAt),
      metadata: record.metadata,
    })
    .where(
      and(
        eq(schema.aiOperationalProposals.firmId, record.firmId),
        eq(schema.aiOperationalProposals.id, record.id),
      ),
    )
    .returning();
  if (!row) throw new Error(`AI operational proposal ${record.id} was not found`);
  return mapAiOperationalProposalRow(row);
}
