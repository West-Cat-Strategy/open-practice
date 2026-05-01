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
