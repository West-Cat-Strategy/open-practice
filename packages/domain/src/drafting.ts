import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export type TipTapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
};

export type TipTapDocument = TipTapNode & {
  type: "doc";
};

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type JsonValue = z.infer<typeof jsonPrimitiveSchema> | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const markSchema: z.ZodType<TipTapMark> = z.object({
  type: z.string().min(1),
  attrs: z.record(z.string(), jsonValueSchema).optional(),
});

const nodeSchema: z.ZodType<TipTapNode> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      attrs: z.record(z.string(), jsonValueSchema).optional(),
      content: z.array(nodeSchema).optional(),
      marks: z.array(markSchema).optional(),
      text: z.string().optional(),
    })
    .strict(),
);

export const tipTapDocumentSchema: z.ZodType<TipTapDocument> = nodeSchema.refine(
  (node): node is TipTapDocument => node.type === "doc",
  { message: "TipTap document root must be a doc node" },
);

export interface DraftRecord {
  id: string;
  firmId: string;
  matterId?: string;
  title: string;
  editorJson: TipTapDocument;
  renderedHtml?: string;
  version: number;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DraftTemplateRecord {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  editorJson: TipTapDocument;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export const draftAssistTasks = ["summarize", "suggest_revision", "continue_draft"] as const;
export type DraftAssistTask = (typeof draftAssistTasks)[number];
export type DraftAssistSourceType = "draft" | "document";
export type DraftAssistStatus = "suggested" | "reviewed" | "rejected";
export type DraftAssistReviewDecision = "reviewed" | "rejected";

export interface DraftAssistRecord {
  id: string;
  firmId: string;
  matterId: string;
  sourceType: DraftAssistSourceType;
  draftId?: string;
  documentId?: string;
  task: DraftAssistTask;
  providerKey: string;
  providerModel: string;
  status: DraftAssistStatus;
  suggestedText: string;
  summary?: string;
  reviewDecision?: DraftAssistReviewDecision;
  reviewedByUserId?: string;
  reviewedAt?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DraftAssistStatusResult {
  status: "disabled" | "configured";
  reason?: "not_configured" | "provider_not_injected";
  provider?: string;
  model?: string;
  supportedTasks: DraftAssistTask[];
}

export interface DraftAssistRequest {
  firmId: string;
  matterId: string;
  sourceType: DraftAssistSourceType;
  task: DraftAssistTask;
  sourceText: string;
  instruction?: string;
  draftId?: string;
  documentId?: string;
  metadata?: Record<string, unknown>;
}

export interface DraftAssistResult {
  providerKey: string;
  providerModel: string;
  suggestedText: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface DraftAssistProvider {
  getStatus(): DraftAssistStatusResult;
  createSuggestion(request: DraftAssistRequest): Promise<DraftAssistResult>;
}

export const draftExportFormats = ["pdf", "docx"] as const;
export type DraftExportFormat = (typeof draftExportFormats)[number];

export type DraftExportTextMark = "bold" | "italic" | "underline" | "link";

export interface DraftExportTextRun {
  text: string;
  marks: DraftExportTextMark[];
  href?: string;
}

export interface DraftExportBlock {
  type: "paragraph" | "heading" | "bullet_list_item" | "ordered_list_item" | "blockquote";
  level?: 1 | 2;
  order?: number;
  runs: DraftExportTextRun[];
}

export interface DraftExportDocument {
  title: string;
  blocks: DraftExportBlock[];
}

export interface DraftMergeContext {
  firm: {
    name: string;
    officeEmail?: string;
    officePhone?: string;
  };
  matter: {
    number: string;
    title: string;
    practiceArea: string;
    jurisdiction: string;
  };
  client?: {
    displayName: string;
    email?: string;
    phone?: string;
  };
}

const mergeFieldPattern = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+)\s*\}\}/g;

export const draftMergeFieldCatalog = [
  "firm.name",
  "firm.officeEmail",
  "firm.officePhone",
  "matter.number",
  "matter.title",
  "matter.practiceArea",
  "matter.jurisdiction",
  "client.displayName",
  "client.email",
  "client.phone",
] as const;

export type DraftMergeField = (typeof draftMergeFieldCatalog)[number];

const draftMergeFieldSet = new Set<string>(draftMergeFieldCatalog);

export class UnknownDraftMergeFieldError extends Error {
  constructor(readonly fields: string[]) {
    super(`Unknown draft merge field${fields.length === 1 ? "" : "s"}: ${fields.join(", ")}`);
    this.name = "UnknownDraftMergeFieldError";
  }
}

export function listDraftMergeFields(document: TipTapDocument): string[] {
  const fields = new Set<string>();

  function visit(node: TipTapNode): void {
    if (typeof node.text === "string") {
      for (const match of node.text.matchAll(mergeFieldPattern)) {
        fields.add(match[1]!);
      }
    }
    for (const child of node.content ?? []) visit(child);
  }

  visit(document);
  return [...fields].sort();
}

export function assertKnownDraftMergeFields(document: TipTapDocument): void {
  const unknownFields = listDraftMergeFields(document).filter(
    (field) => !draftMergeFieldSet.has(field),
  );
  if (unknownFields.length > 0) {
    throw new UnknownDraftMergeFieldError(unknownFields);
  }
}

function mergeFieldValue(field: string, context: DraftMergeContext): string {
  switch (field) {
    case "firm.name":
      return context.firm.name;
    case "firm.officeEmail":
      return context.firm.officeEmail ?? "";
    case "firm.officePhone":
      return context.firm.officePhone ?? "";
    case "matter.number":
      return context.matter.number;
    case "matter.title":
      return context.matter.title;
    case "matter.practiceArea":
      return context.matter.practiceArea;
    case "matter.jurisdiction":
      return context.matter.jurisdiction;
    case "client.displayName":
      return context.client?.displayName ?? "";
    case "client.email":
      return context.client?.email ?? "";
    case "client.phone":
      return context.client?.phone ?? "";
    default:
      return "";
  }
}

export function resolveDraftMergeFields(text: string, context: DraftMergeContext): string {
  return text.replace(mergeFieldPattern, (_match, field: string) =>
    mergeFieldValue(field, context),
  );
}

export function safeDraftExportHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function textMarks(node: TipTapNode): { marks: DraftExportTextMark[]; href?: string } {
  const marks: DraftExportTextMark[] = [];
  let href: string | undefined;

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") marks.push("bold");
    if (mark.type === "italic") marks.push("italic");
    if (mark.type === "underline") marks.push("underline");
    if (mark.type === "link") {
      const safeHref =
        typeof mark.attrs?.href === "string" ? safeDraftExportHref(mark.attrs.href) : undefined;
      if (safeHref) {
        marks.push("link");
        href = safeHref;
      }
    }
  }

  return { marks, href };
}

function collectTextRuns(node: TipTapNode, context: DraftMergeContext): DraftExportTextRun[] {
  const runs: DraftExportTextRun[] = [];

  function visit(current: TipTapNode): void {
    if (typeof current.text === "string") {
      const { marks, href } = textMarks(current);
      runs.push({
        text: resolveDraftMergeFields(current.text, context),
        marks,
        href,
      });
    }
    for (const child of current.content ?? []) visit(child);
  }

  visit(node);
  return runs.length > 0 ? runs : [{ text: "", marks: [] }];
}

function exportBlocksFromNode(node: TipTapNode, context: DraftMergeContext): DraftExportBlock[] {
  if (node.type === "paragraph") {
    return [{ type: "paragraph", runs: collectTextRuns(node, context) }];
  }
  if (node.type === "heading") {
    const requestedLevel = node.attrs?.level === 2 ? 2 : 1;
    return [{ type: "heading", level: requestedLevel, runs: collectTextRuns(node, context) }];
  }
  if (node.type === "blockquote") {
    return [
      {
        type: "blockquote",
        runs: collectTextRuns(node, context),
      },
    ];
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return (node.content ?? []).flatMap((item, index) => ({
      type: node.type === "bulletList" ? "bullet_list_item" : "ordered_list_item",
      order: node.type === "orderedList" ? index + 1 : undefined,
      runs: collectTextRuns(item, context),
    }));
  }
  return (node.content ?? []).flatMap((child) => exportBlocksFromNode(child, context));
}

export function buildDraftExportDocument(input: {
  title: string;
  editorJson: TipTapDocument;
  mergeContext: DraftMergeContext;
}): DraftExportDocument {
  assertKnownDraftMergeFields(input.editorJson);
  const blocks = (input.editorJson.content ?? []).flatMap((node) =>
    exportBlocksFromNode(node, input.mergeContext),
  );

  return {
    title: resolveDraftMergeFields(input.title, input.mergeContext),
    blocks: blocks.length > 0 ? blocks : [{ type: "paragraph", runs: [{ text: "", marks: [] }] }],
  };
}

export function assertDraftAssistTask(task: string): asserts task is DraftAssistTask {
  if (!draftAssistTasks.includes(task as DraftAssistTask)) {
    throw new Error(`Unsupported draft assist task: ${task}`);
  }
}

export function reviewDraftAssistRecord(input: {
  record: DraftAssistRecord;
  decision: DraftAssistReviewDecision;
  reviewedByUserId: string;
  reviewedAt: string;
}): DraftAssistRecord {
  return {
    ...input.record,
    status: input.decision,
    reviewDecision: input.decision,
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: input.reviewedAt,
    updatedAt: input.reviewedAt,
  };
}

export function buildDraftAssistAuditMetadata(record: DraftAssistRecord): Record<string, unknown> {
  return {
    matterId: record.matterId,
    draftAssistRecordId: record.id,
    sourceType: record.sourceType,
    draftId: record.draftId,
    documentId: record.documentId,
    task: record.task,
    status: record.status,
    provider: record.providerKey,
    model: record.providerModel,
    suggestedTextLength: record.suggestedText.length,
    summaryLength: record.summary?.length ?? 0,
    reviewDecision: record.reviewDecision,
  };
}

export function extractTipTapPlainText(node: TipTapNode | TipTapDocument): string {
  const parts: string[] = [];

  function visit(current: TipTapNode): void {
    if (typeof current.text === "string") parts.push(current.text);
    for (const child of current.content ?? []) visit(child);
  }

  visit(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function appendPlainTextToTipTapDocument(
  document: TipTapDocument,
  plainText: string,
): TipTapDocument {
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map<TipTapNode>((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    }));

  if (paragraphs.length === 0) return structuredClone(document);
  return {
    ...structuredClone(document),
    content: [...(document.content ?? []), ...paragraphs],
  };
}

export const DRAFT_SANITIZATION_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "span", "img"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["data-*"],
    img: ["src", "alt", "width", "height"],
  },
};

export function sanitizeDraftHtml(html: string): string {
  return sanitizeHtml(html, DRAFT_SANITIZATION_OPTIONS);
}

type BasicDraftTemplate = Omit<DraftTemplateRecord, "firmId" | "createdAt" | "updatedAt">;

export const BASIC_DRAFT_TEMPLATES: BasicDraftTemplate[] = [
  {
    id: "draft-template-legal-letter",
    name: "Generic Legal Letter",
    category: "correspondence",
    description: "A standard letterhead template for external correspondence.",
    active: true,
    editorJson: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Legal Correspondence" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Date: [Current Date]" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Recipient: [Recipient Name]" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Subject: [Subject Matter]" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Dear [Name]," }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "[Body of letter...]" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Sincerely," }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "[Firm Name]" }],
        },
      ],
    },
    metadata: { source: "open-practice-basic" },
  },
  {
    id: "draft-template-meeting-notes",
    name: "Meeting Notes",
    category: "internal",
    description: "Template for recording matter-scoped meeting notes and action items.",
    active: true,
    editorJson: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Meeting Notes" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Matter: [Matter Number]" },
            { type: "hardBreak" },
            { type: "text", text: "Participants: [List]" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Discussion" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "[Notes...]" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Action Items" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "[Action Item 1]" }],
                },
              ],
            },
          ],
        },
      ],
    },
    metadata: { source: "open-practice-basic" },
  },
];

export function buildBasicDraftTemplates(firmId: string, timestamp: string): DraftTemplateRecord[] {
  return BASIC_DRAFT_TEMPLATES.map((template) => ({
    ...template,
    firmId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}
