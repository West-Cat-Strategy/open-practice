export type EmailTemplateComparisonFieldName =
  | "name"
  | "description"
  | "category"
  | "templateKey"
  | "from"
  | "subject"
  | "textBody"
  | "htmlBody"
  | "recipientHints"
  | "relatedResourceType";

export interface EmailTemplateComparableDraft {
  id: string;
  firmId: string;
  version: number;
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
}

export interface EmailTemplateComparablePublishedVersion {
  id: string;
  firmId: string;
  templateDraftId: string;
  version: number;
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
}

export interface EmailTemplateComparisonField {
  field: EmailTemplateComparisonFieldName;
  label: string;
  draftValue: string | string[] | undefined;
  publishedValue: string | string[] | undefined;
  changed: boolean;
}

export interface EmailTemplateDraftPublishedVersionComparison {
  templateDraftId: string;
  draftVersion: number;
  publishedVersionId: string;
  publishedVersion: number;
  changedFieldCount: number;
  fields: EmailTemplateComparisonField[];
}

const emailTemplateComparisonFields: {
  field: EmailTemplateComparisonFieldName;
  label: string;
}[] = [
  { field: "name", label: "Name" },
  { field: "description", label: "Description" },
  { field: "category", label: "Category" },
  { field: "templateKey", label: "Template key" },
  { field: "from", label: "From" },
  { field: "subject", label: "Subject" },
  { field: "textBody", label: "Text body" },
  { field: "htmlBody", label: "HTML body" },
  { field: "recipientHints", label: "Recipient hints" },
  { field: "relatedResourceType", label: "Related resource type" },
];

function normalizeOptionalEmailTemplateValue(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

function emailTemplateComparisonValueChanged(
  draftValue: string | string[] | undefined,
  publishedValue: string | string[] | undefined,
): boolean {
  if (Array.isArray(draftValue) || Array.isArray(publishedValue)) {
    if (!Array.isArray(draftValue) || !Array.isArray(publishedValue)) return true;
    if (draftValue.length !== publishedValue.length) return true;
    return draftValue.some((value, index) => value !== publishedValue[index]);
  }

  return (
    normalizeOptionalEmailTemplateValue(draftValue) !==
    normalizeOptionalEmailTemplateValue(publishedValue)
  );
}

export function compareEmailTemplateDraftWithPublishedVersion(
  draft: EmailTemplateComparableDraft,
  publishedVersion: EmailTemplateComparablePublishedVersion,
): EmailTemplateDraftPublishedVersionComparison {
  if (draft.firmId !== publishedVersion.firmId) {
    throw new Error("Email template draft and published version must belong to the same firm");
  }
  if (draft.id !== publishedVersion.templateDraftId) {
    throw new Error("Email template published version must belong to the compared draft");
  }

  const fields = emailTemplateComparisonFields.map(({ field, label }) => {
    const draftValue = draft[field];
    const publishedValue = publishedVersion[field];
    return {
      field,
      label,
      draftValue,
      publishedValue,
      changed: emailTemplateComparisonValueChanged(draftValue, publishedValue),
    };
  });

  return {
    templateDraftId: draft.id,
    draftVersion: draft.version,
    publishedVersionId: publishedVersion.id,
    publishedVersion: publishedVersion.version,
    changedFieldCount: fields.filter((field) => field.changed).length,
    fields,
  };
}
