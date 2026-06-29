import type {
  EmailTemplateDraftRecord,
  EmailTemplatePublishedVersionRecord,
  EmailTemplatePreviewSnapshotRecord,
} from "@open-practice/domain";

export interface EmailTemplateDraftRepository {
  listEmailTemplateDrafts(
    firmId: string,
    options?: {
      category?: string;
      activeOnly?: boolean;
      limit?: number;
    },
  ): Promise<EmailTemplateDraftRecord[]>;
  getEmailTemplateDraft(
    firmId: string,
    templateDraftId: string,
  ): Promise<EmailTemplateDraftRecord | undefined>;
  createEmailTemplateDraft(record: EmailTemplateDraftRecord): Promise<EmailTemplateDraftRecord>;
  updateEmailTemplateDraft(
    firmId: string,
    templateDraftId: string,
    updates: {
      name?: string;
      description?: string;
      category?: string;
      templateKey?: string;
      from?: string;
      subject?: string;
      textBody?: string;
      htmlBody?: string;
      recipientHints?: string[];
      relatedResourceType?: string;
      status?: EmailTemplateDraftRecord["status"];
      updatedByUserId: string;
      updatedAt: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<EmailTemplateDraftRecord>;
  createEmailTemplatePreviewSnapshot(
    record: EmailTemplatePreviewSnapshotRecord,
  ): Promise<EmailTemplatePreviewSnapshotRecord>;
  listEmailTemplatePreviewSnapshots(
    firmId: string,
    templateDraftId: string,
    options?: {
      matterId?: string;
      limit?: number;
    },
  ): Promise<EmailTemplatePreviewSnapshotRecord[]>;
  createEmailTemplatePublishedVersion(
    record: EmailTemplatePublishedVersionRecord,
  ): Promise<EmailTemplatePublishedVersionRecord>;
  listEmailTemplatePublishedVersions(
    firmId: string,
    templateDraftId: string,
    options?: {
      limit?: number;
    },
  ): Promise<EmailTemplatePublishedVersionRecord[]>;
  getLatestEmailTemplatePublishedVersion(
    firmId: string,
    templateDraftId: string,
  ): Promise<EmailTemplatePublishedVersionRecord | undefined>;
}
