import type { DraftAssistRecord, DraftRecord, DraftTemplateRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  DraftAssistListOptions,
  DraftListOptions,
  DraftTemplateListOptions,
  DraftUpdateInput,
} from "../drafts-contracts.js";

export interface MemoryDraftStore {
  drafts: DraftRecord[];
  draftAssistRecords: DraftAssistRecord[];
  draftTemplates: DraftTemplateRecord[];
}

export function listMemoryDrafts(
  store: MemoryDraftStore,
  firmId: string,
  options: DraftListOptions = {},
): DraftRecord[] {
  return clone(
    store.drafts.filter(
      (draft) =>
        draft.firmId === firmId &&
        (!options.matterId || draft.matterId === options.matterId) &&
        (!options.userId || draft.createdByUserId === options.userId),
    ),
  );
}

export function getMemoryDraft(
  store: MemoryDraftStore,
  firmId: string,
  draftId: string,
): DraftRecord | undefined {
  return clone(store.drafts.find((draft) => draft.firmId === firmId && draft.id === draftId));
}

export function createMemoryDraft(store: MemoryDraftStore, draft: DraftRecord): DraftRecord {
  store.drafts = [...store.drafts, clone(draft)];
  return clone(draft);
}

export function updateMemoryDraft(
  store: MemoryDraftStore,
  firmId: string,
  draftId: string,
  updates: DraftUpdateInput,
): DraftRecord {
  const draftIndex = store.drafts.findIndex(
    (draft) => draft.firmId === firmId && draft.id === draftId,
  );
  if (draftIndex === -1) {
    throw new Error(`Draft ${draftId} not found`);
  }
  const updatedDraft = {
    ...store.drafts[draftIndex],
    ...updates,
    version: store.drafts[draftIndex]!.version + 1,
    updatedAt: new Date().toISOString(),
  } as DraftRecord;
  store.drafts[draftIndex] = updatedDraft;
  return clone(updatedDraft);
}

export function deleteMemoryDraft(store: MemoryDraftStore, firmId: string, draftId: string): void {
  store.drafts = store.drafts.filter((draft) => draft.firmId !== firmId || draft.id !== draftId);
}

export function listMemoryDraftAssistRecords(
  store: MemoryDraftStore,
  firmId: string,
  options: DraftAssistListOptions = {},
): DraftAssistRecord[] {
  return clone(
    store.draftAssistRecords
      .filter(
        (record) =>
          record.firmId === firmId &&
          (!options.matterId || record.matterId === options.matterId) &&
          (!options.draftId || record.draftId === options.draftId) &&
          (!options.documentId || record.documentId === options.documentId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
}

export function getMemoryDraftAssistRecord(
  store: MemoryDraftStore,
  firmId: string,
  id: string,
): DraftAssistRecord | undefined {
  return clone(
    store.draftAssistRecords.find((record) => record.firmId === firmId && record.id === id),
  );
}

export function createMemoryDraftAssistRecord(
  store: MemoryDraftStore,
  record: DraftAssistRecord,
): DraftAssistRecord {
  store.draftAssistRecords = [...store.draftAssistRecords, clone(record)];
  return clone(record);
}

export function updateMemoryDraftAssistRecord(
  store: MemoryDraftStore,
  record: DraftAssistRecord,
): DraftAssistRecord {
  const index = store.draftAssistRecords.findIndex(
    (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
  );
  if (index === -1) throw new Error(`Draft assist record ${record.id} was not found`);
  store.draftAssistRecords[index] = clone(record);
  return clone(record);
}

export function listMemoryDraftTemplates(
  store: MemoryDraftStore,
  firmId: string,
  options: DraftTemplateListOptions = {},
): DraftTemplateRecord[] {
  return clone(
    store.draftTemplates.filter(
      (template) =>
        template.firmId === firmId &&
        (!options.category || template.category === options.category) &&
        (!options.activeOnly || template.active),
    ),
  );
}

export function createMemoryDraftTemplate(
  store: MemoryDraftStore,
  template: DraftTemplateRecord,
): DraftTemplateRecord {
  store.draftTemplates = [...store.draftTemplates, clone(template)];
  return clone(template);
}
