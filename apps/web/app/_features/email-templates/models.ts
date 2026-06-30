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

export interface EmailTemplateReviewedOutboundPreviewItem {
  id: string;
  firmId: string;
  templateDraftId: string;
  publishedVersionId: string;
  publishedVersion: number;
  matterId: string;
  contactId: string;
  contactMethodId: string;
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
  reviewStatus: "reviewed_preview";
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

export interface EmailTemplatePublishedVersionItem {
  id: string;
  firmId: string;
  templateDraftId: string;
  version: number;
  draftVersion: number;
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
  publishedByUserId: string;
  publishedAt: string;
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

export interface EmailTemplateReviewedOutboundPreviewListResponse {
  reviewedOutboundPreviews: EmailTemplateReviewedOutboundPreviewItem[];
}

export interface EmailTemplatePreviewSnapshotMutationResponse {
  status: "previewed";
  mode: "template_snapshot";
  previewSnapshot: EmailTemplatePreviewSnapshotItem;
}

export interface EmailTemplateReviewedOutboundPreviewMutationResponse {
  status: "previewed";
  mode: "reviewed_outbound_preview";
  reviewedOutboundPreview: EmailTemplateReviewedOutboundPreviewItem;
}

export interface EmailTemplatePublishedVersionListResponse {
  publishedVersions: EmailTemplatePublishedVersionItem[];
}

export interface EmailTemplatePublishResponse {
  publishedVersion: EmailTemplatePublishedVersionItem;
}

export interface EmailTemplateDashboardResponse {
  templateDrafts: EmailTemplateDraftItem[];
  previewSnapshotsByMatterId: Record<string, EmailTemplatePreviewSnapshotItem[]>;
  publishedVersionsByTemplateDraftId: Record<string, EmailTemplatePublishedVersionItem[]>;
  reviewedOutboundPreviewsByMatterId: Record<string, EmailTemplateReviewedOutboundPreviewItem[]>;
}
