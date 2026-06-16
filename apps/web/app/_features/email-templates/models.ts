export interface EmailTemplateDraftItem {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  category: string;
  templateKey: string;
  from: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  recipientHints: string[];
  relatedResourceType?: string;
  status: "draft" | "archived";
  version: number;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplatePreviewSnapshotItem {
  id: string;
  firmId: string;
  templateDraftId: string;
  matterId: string;
  createdByUserId: string;
  templateKey: string;
  subjectPreview: string;
  body: {
    textPreview?: string;
    htmlPreview?: string;
    contentTypes: {
      text: boolean;
      html: boolean;
    };
  };
  recipientSummary: {
    toCount: number;
    ccCount: number;
    bccCount: number;
    recipientCount: number;
  };
  relatedResource?: {
    type: string;
    id: string;
  };
  warnings: string[];
  delivery: {
    persisted: true;
    queued: false;
  };
  createdAt: string;
}

export interface EmailTemplateDraftListResponse {
  templateDrafts: EmailTemplateDraftItem[];
}

export interface EmailTemplateDraftMutationResponse {
  templateDraft: EmailTemplateDraftItem;
}

export interface EmailTemplatePreviewSnapshotListResponse {
  previewSnapshots: EmailTemplatePreviewSnapshotItem[];
}

export interface EmailTemplatePreviewSnapshotMutationResponse {
  status: "previewed";
  mode: "template_snapshot";
  previewSnapshot: EmailTemplatePreviewSnapshotItem;
}

export interface EmailTemplateDashboardResponse {
  templateDrafts: EmailTemplateDraftItem[];
  previewSnapshotsByMatterId: Record<string, EmailTemplatePreviewSnapshotItem[]>;
}
