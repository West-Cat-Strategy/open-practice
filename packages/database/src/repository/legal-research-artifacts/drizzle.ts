import {
  validateLegalResearchArtifactRecord,
  type LegalResearchArtifactRecord,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import type { LegalResearchArtifactListOptions } from "../legal-research-artifacts-contracts.js";
import { mapLegalResearchArtifactRow } from "../drizzle-mappers.js";

export async function listDrizzleLegalResearchArtifacts(
  db: OpenPracticeDatabase,
  firmId: string,
  options: LegalResearchArtifactListOptions = {},
): Promise<LegalResearchArtifactRecord[]> {
  const conditions = [eq(schema.legalResearchArtifacts.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.legalResearchArtifacts.matterId, options.matterId));
  }
  if (options.status) {
    conditions.push(eq(schema.legalResearchArtifacts.status, options.status));
  }
  if (options.kind) conditions.push(eq(schema.legalResearchArtifacts.kind, options.kind));

  const rows = await db
    .select()
    .from(schema.legalResearchArtifacts)
    .where(and(...conditions))
    .orderBy(desc(schema.legalResearchArtifacts.updatedAt));
  return rows.map(mapLegalResearchArtifactRow);
}

export async function getDrizzleLegalResearchArtifact(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<LegalResearchArtifactRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.legalResearchArtifacts)
    .where(
      and(
        eq(schema.legalResearchArtifacts.firmId, firmId),
        eq(schema.legalResearchArtifacts.id, id),
      ),
    );
  return row ? mapLegalResearchArtifactRow(row) : undefined;
}

export async function createDrizzleLegalResearchArtifact(
  db: OpenPracticeDatabase,
  record: LegalResearchArtifactRecord,
): Promise<LegalResearchArtifactRecord> {
  validateLegalResearchArtifactRecord(record);
  await db.insert(schema.legalResearchArtifacts).values({
    ...record,
    note: record.note ?? null,
    documentAnalysis: record.documentAnalysis ?? null,
    timeline: record.timeline ?? null,
    checkpoint: record.checkpoint ?? null,
    reviewDecision: record.reviewDecision ?? null,
    reviewedByUserId: record.reviewedByUserId ?? null,
    reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  });
  return clone(record);
}

export async function updateDrizzleLegalResearchArtifact(
  db: OpenPracticeDatabase,
  record: LegalResearchArtifactRecord,
): Promise<LegalResearchArtifactRecord> {
  validateLegalResearchArtifactRecord(record);
  const [row] = await db
    .update(schema.legalResearchArtifacts)
    .set({
      kind: record.kind,
      status: record.status,
      title: record.title,
      note: record.note ?? null,
      sourceReferences: record.sourceReferences,
      contextLinks: record.contextLinks,
      documentAnalysis: record.documentAnalysis ?? null,
      timeline: record.timeline ?? null,
      checkpoint: record.checkpoint ?? null,
      reviewDecision: record.reviewDecision ?? null,
      reviewedByUserId: record.reviewedByUserId ?? null,
      reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
      updatedAt: new Date(record.updatedAt),
      reviewOnly: record.reviewOnly,
      metadata: record.metadata,
    })
    .where(
      and(
        eq(schema.legalResearchArtifacts.firmId, record.firmId),
        eq(schema.legalResearchArtifacts.id, record.id),
      ),
    )
    .returning();
  if (!row) throw new Error(`Legal research artifact ${record.id} was not found`);
  return mapLegalResearchArtifactRow(row);
}
