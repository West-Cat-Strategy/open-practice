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
