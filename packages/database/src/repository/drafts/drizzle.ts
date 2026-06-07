import type { DraftAssistRecord, DraftRecord, DraftTemplateRecord } from "@open-practice/domain";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import type {
  DraftAssistListOptions,
  DraftListOptions,
  DraftTemplateListOptions,
  DraftUpdateInput,
} from "../drafts-contracts.js";
import { mapDraftAssistRow, mapDraftRow, mapDraftTemplateRow } from "../drizzle-mappers.js";

export async function listDrizzleDrafts(
  db: OpenPracticeDatabase,
  firmId: string,
  options: DraftListOptions = {},
): Promise<DraftRecord[]> {
  const conditions = [eq(schema.drafts.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.drafts.matterId, options.matterId));
  if (options.userId) conditions.push(eq(schema.drafts.createdByUserId, options.userId));

  const rows = await db
    .select()
    .from(schema.drafts)
    .where(and(...conditions))
    .orderBy(asc(schema.drafts.createdAt));
  return rows.map(mapDraftRow);
}

export async function getDrizzleDraft(
  db: OpenPracticeDatabase,
  firmId: string,
  draftId: string,
): Promise<DraftRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.drafts)
    .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)));
  return row ? mapDraftRow(row) : undefined;
}

export async function createDrizzleDraft(
  db: OpenPracticeDatabase,
  draft: DraftRecord,
): Promise<DraftRecord> {
  await db.insert(schema.drafts).values({
    ...draft,
    createdAt: new Date(draft.createdAt),
    updatedAt: new Date(draft.updatedAt),
  });
  return draft;
}

export async function updateDrizzleDraft(
  db: OpenPracticeDatabase,
  firmId: string,
  draftId: string,
  updates: DraftUpdateInput,
): Promise<DraftRecord> {
  const [row] = await db
    .update(schema.drafts)
    .set({
      ...updates,
      version: sql`${schema.drafts.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)))
    .returning();
  if (!row) throw new Error(`Draft ${draftId} not found`);
  return mapDraftRow(row);
}

export async function deleteDrizzleDraft(
  db: OpenPracticeDatabase,
  firmId: string,
  draftId: string,
): Promise<void> {
  await db
    .delete(schema.drafts)
    .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)));
}

export async function listDrizzleDraftAssistRecords(
  db: OpenPracticeDatabase,
  firmId: string,
  options: DraftAssistListOptions = {},
): Promise<DraftAssistRecord[]> {
  const conditions = [eq(schema.draftAssistRecords.firmId, firmId)];
  if (options.matterId) conditions.push(eq(schema.draftAssistRecords.matterId, options.matterId));
  if (options.draftId) conditions.push(eq(schema.draftAssistRecords.draftId, options.draftId));
  if (options.documentId) {
    conditions.push(eq(schema.draftAssistRecords.documentId, options.documentId));
  }

  const rows = await db
    .select()
    .from(schema.draftAssistRecords)
    .where(and(...conditions))
    .orderBy(desc(schema.draftAssistRecords.createdAt));
  return rows.map(mapDraftAssistRow);
}

export async function getDrizzleDraftAssistRecord(
  db: OpenPracticeDatabase,
  firmId: string,
  id: string,
): Promise<DraftAssistRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.draftAssistRecords)
    .where(and(eq(schema.draftAssistRecords.firmId, firmId), eq(schema.draftAssistRecords.id, id)));
  return row ? mapDraftAssistRow(row) : undefined;
}

export async function createDrizzleDraftAssistRecord(
  db: OpenPracticeDatabase,
  record: DraftAssistRecord,
): Promise<DraftAssistRecord> {
  await db.insert(schema.draftAssistRecords).values({
    ...record,
    reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  });
  return clone(record);
}

export async function updateDrizzleDraftAssistRecord(
  db: OpenPracticeDatabase,
  record: DraftAssistRecord,
): Promise<DraftAssistRecord> {
  const [row] = await db
    .update(schema.draftAssistRecords)
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
        eq(schema.draftAssistRecords.firmId, record.firmId),
        eq(schema.draftAssistRecords.id, record.id),
      ),
    )
    .returning();
  if (!row) throw new Error(`Draft assist record ${record.id} was not found`);
  return mapDraftAssistRow(row);
}

export async function listDrizzleDraftTemplates(
  db: OpenPracticeDatabase,
  firmId: string,
  options: DraftTemplateListOptions = {},
): Promise<DraftTemplateRecord[]> {
  const conditions = [eq(schema.draftTemplates.firmId, firmId)];
  if (options.category) conditions.push(eq(schema.draftTemplates.category, options.category));
  if (options.activeOnly) conditions.push(eq(schema.draftTemplates.active, true));

  const rows = await db
    .select()
    .from(schema.draftTemplates)
    .where(and(...conditions))
    .orderBy(asc(schema.draftTemplates.name));
  return rows.map(mapDraftTemplateRow);
}

export async function createDrizzleDraftTemplate(
  db: OpenPracticeDatabase,
  template: DraftTemplateRecord,
): Promise<DraftTemplateRecord> {
  await db.insert(schema.draftTemplates).values({
    ...template,
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
  });
  return template;
}
