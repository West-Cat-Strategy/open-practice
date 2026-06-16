import type {
  EmailTemplateDraftRecord,
  EmailTemplatePreviewSnapshotRecord,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { EmailTemplateDraftRepository } from "../email-template-drafts-contracts.js";
import {
  emailTemplateDraftInsert,
  emailTemplatePreviewSnapshotInsert,
  mapEmailTemplateDraftRow,
  mapEmailTemplatePreviewSnapshotRow,
} from "../drizzle-mappers.js";

export async function listDrizzleEmailTemplateDrafts(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { category?: string; activeOnly?: boolean; limit?: number } = {},
): Promise<EmailTemplateDraftRecord[]> {
  const conditions = [eq(schema.emailTemplateDrafts.firmId, firmId)];
  if (options.category) conditions.push(eq(schema.emailTemplateDrafts.category, options.category));
  if (options.activeOnly !== false) conditions.push(eq(schema.emailTemplateDrafts.status, "draft"));

  const rows = await db
    .select()
    .from(schema.emailTemplateDrafts)
    .where(and(...conditions))
    .orderBy(desc(schema.emailTemplateDrafts.updatedAt))
    .limit(options.limit ?? 50);
  return rows.map(mapEmailTemplateDraftRow);
}

export async function getDrizzleEmailTemplateDraft(
  db: OpenPracticeDatabase,
  firmId: string,
  templateDraftId: string,
): Promise<EmailTemplateDraftRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.emailTemplateDrafts)
    .where(
      and(
        eq(schema.emailTemplateDrafts.firmId, firmId),
        eq(schema.emailTemplateDrafts.id, templateDraftId),
      ),
    );
  return row ? mapEmailTemplateDraftRow(row) : undefined;
}

export async function createDrizzleEmailTemplateDraft(
  db: OpenPracticeDatabase,
  record: EmailTemplateDraftRecord,
): Promise<EmailTemplateDraftRecord> {
  const [row] = await db
    .insert(schema.emailTemplateDrafts)
    .values(emailTemplateDraftInsert(record))
    .returning();
  return mapEmailTemplateDraftRow(row);
}

export async function updateDrizzleEmailTemplateDraft(
  db: OpenPracticeDatabase,
  firmId: string,
  templateDraftId: string,
  updates: Parameters<EmailTemplateDraftRepository["updateEmailTemplateDraft"]>[2],
): Promise<EmailTemplateDraftRecord> {
  const existing = await getDrizzleEmailTemplateDraft(db, firmId, templateDraftId);
  if (!existing) throw new Error(`Email template draft ${templateDraftId} was not found`);

  const [row] = await db
    .update(schema.emailTemplateDrafts)
    .set({
      name: updates.name ?? existing.name,
      description: updates.description ?? existing.description ?? null,
      category: updates.category ?? existing.category,
      templateKey: updates.templateKey ?? existing.templateKey,
      from: updates.from ?? existing.from,
      subject: updates.subject ?? existing.subject,
      textBody: updates.textBody ?? existing.textBody,
      htmlBody: updates.htmlBody ?? existing.htmlBody,
      recipientHints: updates.recipientHints ?? existing.recipientHints,
      relatedResourceType: updates.relatedResourceType ?? existing.relatedResourceType ?? null,
      status: updates.status ?? existing.status,
      version: existing.version + 1,
      updatedByUserId: updates.updatedByUserId,
      updatedAt: new Date(updates.updatedAt),
      metadata: {
        ...existing.metadata,
        ...(updates.metadata ?? {}),
      },
    })
    .where(
      and(
        eq(schema.emailTemplateDrafts.firmId, firmId),
        eq(schema.emailTemplateDrafts.id, templateDraftId),
      ),
    )
    .returning();
  return mapEmailTemplateDraftRow(row);
}

export async function createDrizzleEmailTemplatePreviewSnapshot(
  db: OpenPracticeDatabase,
  record: EmailTemplatePreviewSnapshotRecord,
): Promise<EmailTemplatePreviewSnapshotRecord> {
  const [row] = await db
    .insert(schema.emailTemplatePreviewSnapshots)
    .values(emailTemplatePreviewSnapshotInsert(record))
    .returning();
  return mapEmailTemplatePreviewSnapshotRow(row);
}

export async function listDrizzleEmailTemplatePreviewSnapshots(
  db: OpenPracticeDatabase,
  firmId: string,
  templateDraftId: string,
  options: { matterId?: string; limit?: number } = {},
): Promise<EmailTemplatePreviewSnapshotRecord[]> {
  const conditions = [
    eq(schema.emailTemplatePreviewSnapshots.firmId, firmId),
    eq(schema.emailTemplatePreviewSnapshots.templateDraftId, templateDraftId),
  ];
  if (options.matterId) {
    conditions.push(eq(schema.emailTemplatePreviewSnapshots.matterId, options.matterId));
  }

  const rows = await db
    .select()
    .from(schema.emailTemplatePreviewSnapshots)
    .where(and(...conditions))
    .orderBy(desc(schema.emailTemplatePreviewSnapshots.createdAt))
    .limit(options.limit ?? 25);
  return rows.map(mapEmailTemplatePreviewSnapshotRow);
}

export function createDrizzleEmailTemplateDraftRepository(
  db: OpenPracticeDatabase,
): EmailTemplateDraftRepository {
  return {
    listEmailTemplateDrafts: (firmId, options) =>
      listDrizzleEmailTemplateDrafts(db, firmId, options),
    getEmailTemplateDraft: (firmId, templateDraftId) =>
      getDrizzleEmailTemplateDraft(db, firmId, templateDraftId),
    createEmailTemplateDraft: (record) => createDrizzleEmailTemplateDraft(db, record),
    updateEmailTemplateDraft: (firmId, templateDraftId, updates) =>
      updateDrizzleEmailTemplateDraft(db, firmId, templateDraftId, updates),
    createEmailTemplatePreviewSnapshot: (record) =>
      createDrizzleEmailTemplatePreviewSnapshot(db, record),
    listEmailTemplatePreviewSnapshots: (firmId, templateDraftId, options) =>
      listDrizzleEmailTemplatePreviewSnapshots(db, firmId, templateDraftId, options),
  };
}
