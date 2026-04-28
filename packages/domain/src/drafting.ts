import sanitizeHtml from "sanitize-html";

export interface DraftRecord {
  id: string;
  firmId: string;
  matterId?: string;
  title: string;
  editorJson: Record<string, unknown>;
  renderedHtml?: string;
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
  editorJson: Record<string, unknown>;
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
    "*": ["style", "class", "data-*"],
    img: ["src", "alt", "width", "height"],
  },
};

export function sanitizeDraftHtml(html: string): string {
  return sanitizeHtml(html, DRAFT_SANITIZATION_OPTIONS);
}

/**
 * Basic templates for common legal drafting tasks.
 */
export const BASIC_DRAFT_TEMPLATES: Array<Partial<DraftTemplateRecord>> = [
  {
    name: "Generic Legal Letter",
    category: "correspondence",
    description: "A standard letterhead template for external correspondence.",
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
  },
  {
    name: "Meeting Notes",
    category: "internal",
    description: "Template for recording matter-scoped meeting notes and action items.",
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
  },
];
