import type { DraftAssistRecord, DraftRecord, DraftTemplateRecord } from "@open-practice/domain";

export interface DraftListOptions {
  matterId?: string;
  userId?: string;
}

export type DraftUpdateInput = Partial<
  Pick<DraftRecord, "title" | "editorJson" | "renderedHtml" | "updatedByUserId">
>;

export interface DraftAssistListOptions {
  matterId?: string;
  draftId?: string;
  documentId?: string;
}

export interface DraftTemplateListOptions {
  category?: string;
  activeOnly?: boolean;
}

export interface DraftRepository {
  listDrafts(firmId: string, options?: DraftListOptions): Promise<DraftRecord[]>;
  getDraft(firmId: string, draftId: string): Promise<DraftRecord | undefined>;
  createDraft(draft: DraftRecord): Promise<DraftRecord>;
  updateDraft(firmId: string, draftId: string, updates: DraftUpdateInput): Promise<DraftRecord>;
  deleteDraft(firmId: string, draftId: string): Promise<void>;
  listDraftAssistRecords(
    firmId: string,
    options?: DraftAssistListOptions,
  ): Promise<DraftAssistRecord[]>;
  getDraftAssistRecord(firmId: string, id: string): Promise<DraftAssistRecord | undefined>;
  createDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord>;
  updateDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord>;
  listDraftTemplates(
    firmId: string,
    options?: DraftTemplateListOptions,
  ): Promise<DraftTemplateRecord[]>;
  createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord>;
}
