import type {
  EmailTemplateDraftRecord,
  EmailTemplatePreviewSnapshotRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { EmailTemplateDraftRepository } from "../email-template-drafts-contracts.js";

export interface MemoryEmailTemplateDraftStore {
  emailTemplateDrafts: EmailTemplateDraftRecord[];
  emailTemplatePreviewSnapshots: EmailTemplatePreviewSnapshotRecord[];
}

export function listMemoryEmailTemplateDrafts(
  store: MemoryEmailTemplateDraftStore,
  firmId: string,
  options: { category?: string; activeOnly?: boolean; limit?: number } = {},
): EmailTemplateDraftRecord[] {
  const limit = options.limit ?? 50;
  return clone(
    store.emailTemplateDrafts
      .filter((draft) => {
        if (draft.firmId !== firmId) return false;
        if (options.category && draft.category !== options.category) return false;
        if (options.activeOnly !== false && draft.status !== "draft") return false;
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit),
  );
}

export function getMemoryEmailTemplateDraft(
  store: MemoryEmailTemplateDraftStore,
  firmId: string,
  templateDraftId: string,
): EmailTemplateDraftRecord | undefined {
  return clone(
    store.emailTemplateDrafts.find(
      (draft) => draft.firmId === firmId && draft.id === templateDraftId,
    ),
  );
}

export function createMemoryEmailTemplateDraft(
  store: MemoryEmailTemplateDraftStore,
  record: EmailTemplateDraftRecord,
): EmailTemplateDraftRecord {
  store.emailTemplateDrafts.push(clone(record));
  return clone(record);
}

export function updateMemoryEmailTemplateDraft(
  store: MemoryEmailTemplateDraftStore,
  firmId: string,
  templateDraftId: string,
  updates: Parameters<EmailTemplateDraftRepository["updateEmailTemplateDraft"]>[2],
): EmailTemplateDraftRecord {
  const index = store.emailTemplateDrafts.findIndex(
    (draft) => draft.firmId === firmId && draft.id === templateDraftId,
  );
  if (index === -1) throw new Error(`Email template draft ${templateDraftId} was not found`);

  const existing = store.emailTemplateDrafts[index]!;
  const updated: EmailTemplateDraftRecord = {
    ...existing,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    category: updates.category ?? existing.category,
    templateKey: updates.templateKey ?? existing.templateKey,
    from: updates.from ?? existing.from,
    subject: updates.subject ?? existing.subject,
    textBody: updates.textBody ?? existing.textBody,
    htmlBody: updates.htmlBody ?? existing.htmlBody,
    recipientHints: updates.recipientHints ?? existing.recipientHints,
    relatedResourceType: updates.relatedResourceType ?? existing.relatedResourceType,
    status: updates.status ?? existing.status,
    version: existing.version + 1,
    updatedByUserId: updates.updatedByUserId,
    updatedAt: updates.updatedAt,
    metadata: {
      ...existing.metadata,
      ...(updates.metadata ?? {}),
    },
  };
  store.emailTemplateDrafts[index] = clone(updated);
  return clone(updated);
}

export function createMemoryEmailTemplatePreviewSnapshot(
  store: MemoryEmailTemplateDraftStore,
  record: EmailTemplatePreviewSnapshotRecord,
): EmailTemplatePreviewSnapshotRecord {
  store.emailTemplatePreviewSnapshots.push(clone(record));
  return clone(record);
}

export function listMemoryEmailTemplatePreviewSnapshots(
  store: MemoryEmailTemplateDraftStore,
  firmId: string,
  templateDraftId: string,
  options: { matterId?: string; limit?: number } = {},
): EmailTemplatePreviewSnapshotRecord[] {
  const limit = options.limit ?? 25;
  return clone(
    store.emailTemplatePreviewSnapshots
      .filter((snapshot) => {
        if (snapshot.firmId !== firmId) return false;
        if (snapshot.templateDraftId !== templateDraftId) return false;
        if (options.matterId && snapshot.matterId !== options.matterId) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit),
  );
}

export function createMemoryEmailTemplateDraftRepository(
  store: MemoryEmailTemplateDraftStore,
): EmailTemplateDraftRepository {
  return {
    listEmailTemplateDrafts: (firmId, options) =>
      Promise.resolve(listMemoryEmailTemplateDrafts(store, firmId, options)),
    getEmailTemplateDraft: (firmId, templateDraftId) =>
      Promise.resolve(getMemoryEmailTemplateDraft(store, firmId, templateDraftId)),
    createEmailTemplateDraft: (record) =>
      Promise.resolve(createMemoryEmailTemplateDraft(store, record)),
    updateEmailTemplateDraft: (firmId, templateDraftId, updates) =>
      Promise.resolve(updateMemoryEmailTemplateDraft(store, firmId, templateDraftId, updates)),
    createEmailTemplatePreviewSnapshot: (record) =>
      Promise.resolve(createMemoryEmailTemplatePreviewSnapshot(store, record)),
    listEmailTemplatePreviewSnapshots: (firmId, templateDraftId, options) =>
      Promise.resolve(
        listMemoryEmailTemplatePreviewSnapshots(store, firmId, templateDraftId, options),
      ),
  };
}
