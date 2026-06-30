import { sanitizeDraftHtml } from "./drafting.js";
export {
  compareEmailTemplateDraftWithPublishedVersion,
  type EmailTemplateComparableDraft,
  type EmailTemplateComparablePublishedVersion,
  type EmailTemplateComparisonField,
  type EmailTemplateComparisonFieldName,
  type EmailTemplateDraftPublishedVersionComparison,
} from "./email-template-draft-comparison.js";

export type EmailTemplateDraftStatus = "draft" | "archived";

export interface EmailTemplateDraftRecord {
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
  status: EmailTemplateDraftStatus;
  version: number;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface EmailTemplateRecipientSummary {
  toCount: number;
  ccCount: number;
  bccCount: number;
  recipientCount: number;
}

export interface EmailTemplatePreviewSnapshotRecord {
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
  recipientSummary: EmailTemplateRecipientSummary;
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
  metadata: Record<string, unknown>;
}

export type EmailTemplateReviewedOutboundPreviewStatus = "reviewed_preview";

export interface EmailTemplateReviewedOutboundPreviewRecord {
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
  recipientSummary: EmailTemplateRecipientSummary;
  reviewStatus: EmailTemplateReviewedOutboundPreviewStatus;
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
  metadata: Record<string, unknown>;
}

export interface EmailTemplatePublishedVersionRecord {
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
  metadata: Record<string, unknown>;
}

export const emailTemplatePreviewTextMaxLength = 1200;
export const emailTemplatePreviewHtmlMaxLength = 1600;

export function normalizeEmailTemplateTextPreview(
  value: string,
): { value: string; truncated: boolean } | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return {
    value: normalized.slice(0, emailTemplatePreviewTextMaxLength),
    truncated: normalized.length > emailTemplatePreviewTextMaxLength,
  };
}

export function normalizeEmailTemplateHtmlPreview(
  value: string,
): { value: string; sanitized: boolean; truncated: boolean } | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const sanitized = sanitizeDraftHtml(trimmed);
  return {
    value: sanitized.slice(0, emailTemplatePreviewHtmlMaxLength),
    sanitized: sanitized !== trimmed,
    truncated: sanitized.length > emailTemplatePreviewHtmlMaxLength,
  };
}

export function summarizeEmailTemplateRecipients(input: {
  to?: string[];
  cc?: string[];
  bcc?: string[];
}): EmailTemplateRecipientSummary {
  const toCount = input.to?.length ?? 0;
  const ccCount = input.cc?.length ?? 0;
  const bccCount = input.bcc?.length ?? 0;
  return {
    toCount,
    ccCount,
    bccCount,
    recipientCount: toCount + ccCount + bccCount,
  };
}

export function emailTemplatePreviewWarningCodes(input: {
  recipientCount: number;
  textTruncated: boolean;
  htmlSanitized: boolean;
  htmlTruncated: boolean;
}): string[] {
  return [
    input.recipientCount === 0 ? "no_recipients" : undefined,
    input.textTruncated ? "text_body_truncated" : undefined,
    input.htmlSanitized ? "html_body_sanitized" : undefined,
    input.htmlTruncated ? "html_body_truncated" : undefined,
  ].filter((warning): warning is string => Boolean(warning));
}

export function buildEmailTemplatePreviewSnapshot(input: {
  id: string;
  firmId: string;
  templateDraft: EmailTemplateDraftRecord;
  matterId: string;
  createdByUserId: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  relatedResource?: {
    type: string;
    id: string;
  };
  createdAt: string;
  metadata?: Record<string, unknown>;
}): EmailTemplatePreviewSnapshotRecord {
  const textPreview = normalizeEmailTemplateTextPreview(input.templateDraft.textBody);
  const htmlPreview = normalizeEmailTemplateHtmlPreview(input.templateDraft.htmlBody);
  const recipientSummary = summarizeEmailTemplateRecipients(input);
  const warnings = emailTemplatePreviewWarningCodes({
    recipientCount: recipientSummary.recipientCount,
    textTruncated: Boolean(textPreview?.truncated),
    htmlSanitized: Boolean(htmlPreview?.sanitized),
    htmlTruncated: Boolean(htmlPreview?.truncated),
  });

  return {
    id: input.id,
    firmId: input.firmId,
    templateDraftId: input.templateDraft.id,
    matterId: input.matterId,
    createdByUserId: input.createdByUserId,
    templateKey: input.templateDraft.templateKey,
    subjectPreview: input.templateDraft.subject.slice(0, 240),
    body: {
      textPreview: textPreview?.value,
      htmlPreview: htmlPreview?.value,
      contentTypes: {
        text: Boolean(textPreview),
        html: Boolean(htmlPreview),
      },
    },
    recipientSummary,
    relatedResource: input.relatedResource,
    warnings,
    delivery: {
      persisted: true,
      queued: false,
    },
    createdAt: input.createdAt,
    metadata: {
      templateDraftId: input.templateDraft.id,
      templateKey: input.templateDraft.templateKey,
      subjectLength: input.templateDraft.subject.length,
      textLength: input.templateDraft.textBody.length,
      htmlLength: input.templateDraft.htmlBody.length,
      warningCount: warnings.length,
      persisted: true,
      queued: false,
      ...(input.metadata ?? {}),
    },
  };
}

export function buildEmailTemplateReviewedOutboundPreview(input: {
  id: string;
  firmId: string;
  publishedVersion: EmailTemplatePublishedVersionRecord;
  matterId: string;
  contactId: string;
  contactMethodId: string;
  createdByUserId: string;
  relatedResource?: {
    type: string;
    id: string;
  };
  createdAt: string;
  metadata?: Record<string, unknown>;
}): EmailTemplateReviewedOutboundPreviewRecord {
  const textPreview = normalizeEmailTemplateTextPreview(input.publishedVersion.textBody);
  const htmlPreview = normalizeEmailTemplateHtmlPreview(input.publishedVersion.htmlBody);
  const recipientSummary = summarizeEmailTemplateRecipients({
    to: [input.contactMethodId],
  });
  const warnings = emailTemplatePreviewWarningCodes({
    recipientCount: recipientSummary.recipientCount,
    textTruncated: Boolean(textPreview?.truncated),
    htmlSanitized: Boolean(htmlPreview?.sanitized),
    htmlTruncated: Boolean(htmlPreview?.truncated),
  });

  return {
    id: input.id,
    firmId: input.firmId,
    templateDraftId: input.publishedVersion.templateDraftId,
    publishedVersionId: input.publishedVersion.id,
    publishedVersion: input.publishedVersion.version,
    matterId: input.matterId,
    contactId: input.contactId,
    contactMethodId: input.contactMethodId,
    createdByUserId: input.createdByUserId,
    templateKey: input.publishedVersion.templateKey,
    subjectPreview: input.publishedVersion.subject.replace(/\s+/g, " ").trim().slice(0, 240),
    body: {
      textPreview: textPreview?.value,
      htmlPreview: htmlPreview?.value,
      contentTypes: {
        text: Boolean(textPreview),
        html: Boolean(htmlPreview),
      },
    },
    recipientSummary,
    reviewStatus: "reviewed_preview",
    relatedResource: input.relatedResource,
    warnings,
    delivery: {
      persisted: true,
      queued: false,
    },
    createdAt: input.createdAt,
    metadata: {
      reviewedOutboundPreviewId: input.id,
      publishedVersionId: input.publishedVersion.id,
      templateDraftId: input.publishedVersion.templateDraftId,
      publishedVersion: input.publishedVersion.version,
      matterId: input.matterId,
      contactId: input.contactId,
      contactMethodId: input.contactMethodId,
      templateKey: input.publishedVersion.templateKey,
      subjectLength: input.publishedVersion.subject.length,
      textLength: input.publishedVersion.textBody.length,
      htmlLength: input.publishedVersion.htmlBody.length,
      recipientCount: recipientSummary.recipientCount,
      warningCount: warnings.length,
      reviewStatus: "reviewed_preview",
      providerNeutral: true,
      persisted: true,
      queued: false,
      deliveryQueued: false,
      providerDeliverySideEffect: false,
      campaignAutomation: false,
      bulkSend: false,
      subscriptionManagement: false,
      ...(input.metadata ?? {}),
    },
  };
}

export function buildEmailTemplatePublishedVersion(input: {
  id: string;
  firmId: string;
  templateDraft: EmailTemplateDraftRecord;
  version: number;
  publishedByUserId: string;
  publishedAt: string;
  metadata?: Record<string, unknown>;
}): EmailTemplatePublishedVersionRecord {
  return {
    id: input.id,
    firmId: input.firmId,
    templateDraftId: input.templateDraft.id,
    version: input.version,
    draftVersion: input.templateDraft.version,
    name: input.templateDraft.name,
    description: input.templateDraft.description,
    category: input.templateDraft.category,
    templateKey: input.templateDraft.templateKey,
    from: input.templateDraft.from,
    subject: input.templateDraft.subject,
    textBody: input.templateDraft.textBody,
    htmlBody: input.templateDraft.htmlBody,
    recipientHints: [...input.templateDraft.recipientHints],
    relatedResourceType: input.templateDraft.relatedResourceType,
    publishedByUserId: input.publishedByUserId,
    publishedAt: input.publishedAt,
    metadata: {
      publishedVersionId: input.id,
      templateDraftId: input.templateDraft.id,
      publishedVersion: input.version,
      draftVersion: input.templateDraft.version,
      publishedAt: input.publishedAt,
      subjectLength: input.templateDraft.subject.length,
      textLength: input.templateDraft.textBody.length,
      htmlLength: input.templateDraft.htmlBody.length,
      recipientHintCount: input.templateDraft.recipientHints.length,
      providerNeutral: true,
      deliveryQueued: false,
      providerDeliverySideEffect: false,
      campaignAutomation: false,
      bulkSend: false,
      ...(input.metadata ?? {}),
    },
  };
}
