import { describe, it, expect } from "vitest";
import {
  appendPlainTextToTipTapDocument,
  assertDraftAssistTask,
  buildBasicDraftTemplates,
  buildDraftAssistAuditMetadata,
  extractTipTapPlainText,
  reviewDraftAssistRecord,
  sanitizeDraftHtml,
  tipTapDocumentSchema,
  type DraftAssistRecord,
  type TipTapDocument,
} from "./drafting.js";

describe("drafting domain", () => {
  describe("tipTapDocumentSchema", () => {
    it("accepts structured TipTap document JSON", () => {
      const result = tipTapDocumentSchema.safeParse({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Synthetic drafting note" }],
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("rejects non-document roots and non-json attrs", () => {
      expect(tipTapDocumentSchema.safeParse({ type: "paragraph" }).success).toBe(false);
      expect(
        tipTapDocumentSchema.safeParse({
          type: "doc",
          attrs: { callback: () => "not json" },
        }).success,
      ).toBe(false);
    });
  });

  describe("sanitizeDraftHtml", () => {
    it("preserves allowed tags and attributes", () => {
      const input =
        '<h1 data-draft-block="title">Hello</h1><p>This is a <strong>test</strong>.</p><img src="test.png" alt="Test Image" />';
      const output = sanitizeDraftHtml(input);
      expect(output).toContain('<h1 data-draft-block="title">Hello</h1>');
      expect(output).toContain("<p>This is a <strong>test</strong>.</p>");
      expect(output).toContain('<img src="test.png" alt="Test Image" />');
    });

    it("removes disallowed tags", () => {
      const input =
        '<script>alert("xss")</script><p>Safe content</p><iframe src="malicious.com"></iframe>';
      const output = sanitizeDraftHtml(input);
      expect(output).not.toContain("<script>");
      expect(output).not.toContain("<iframe>");
      expect(output).toBe("<p>Safe content</p>");
    });

    it("removes disallowed attributes", () => {
      const input =
        '<p onclick="alert(\'xss\')">Click me</p><img src="test.png" onerror="alert(\'xss\')" />';
      const output = sanitizeDraftHtml(input);
      expect(output).not.toContain("onclick");
      expect(output).not.toContain("onerror");
      expect(output).toBe('<p>Click me</p><img src="test.png" />');
    });

    it("removes style attributes from rendered snapshots", () => {
      const output = sanitizeDraftHtml('<p style="position:fixed">Styled</p>');

      expect(output).toBe("<p>Styled</p>");
    });
  });

  describe("buildBasicDraftTemplates", () => {
    it("creates deterministic firm-scoped templates", () => {
      const templates = buildBasicDraftTemplates("firm-example", "2026-04-28T12:00:00.000Z");

      expect(templates).toMatchObject([
        {
          id: "draft-template-legal-letter",
          firmId: "firm-example",
          category: "correspondence",
          active: true,
          editorJson: { type: "doc" },
        },
        {
          id: "draft-template-meeting-notes",
          firmId: "firm-example",
          category: "internal",
          active: true,
          editorJson: { type: "doc" },
        },
      ]);
      expect(templates.map((template) => template.createdAt)).toEqual([
        "2026-04-28T12:00:00.000Z",
        "2026-04-28T12:00:00.000Z",
      ]);
    });
  });

  describe("draft assist helpers", () => {
    const document: TipTapDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Existing draft" }] }],
    };
    const record: DraftAssistRecord = {
      id: "assist-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      sourceType: "draft",
      draftId: "draft-001",
      task: "continue_draft",
      providerKey: "fake-local",
      providerModel: "test-model",
      status: "suggested",
      suggestedText: "Suggested private text",
      summary: "Short summary",
      createdByUserId: "user-admin",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      metadata: { sourceTextLength: 42 },
    };

    it("validates supported draft assist tasks", () => {
      expect(() => assertDraftAssistTask("summarize")).not.toThrow();
      expect(() => assertDraftAssistTask("unsupported")).toThrow("Unsupported draft assist task");
    });

    it("transitions review status without mutating suggested text", () => {
      expect(
        reviewDraftAssistRecord({
          record,
          decision: "rejected",
          reviewedByUserId: "user-reviewer",
          reviewedAt: "2026-05-01T00:05:00.000Z",
        }),
      ).toMatchObject({
        id: "assist-001",
        status: "rejected",
        reviewDecision: "rejected",
        suggestedText: "Suggested private text",
        reviewedByUserId: "user-reviewer",
      });
    });

    it("builds redacted audit metadata", () => {
      const metadata = buildDraftAssistAuditMetadata(record);

      expect(metadata).toMatchObject({
        matterId: "matter-001",
        draftAssistRecordId: "assist-001",
        task: "continue_draft",
        provider: "fake-local",
        model: "test-model",
        suggestedTextLength: 22,
      });
      expect(JSON.stringify(metadata)).not.toContain("Suggested private text");
      expect(JSON.stringify(metadata)).not.toContain("Short summary");
    });

    it("extracts and appends plain text to TipTap documents", () => {
      const updated = appendPlainTextToTipTapDocument(document, "First suggestion\n\nSecond block");

      expect(extractTipTapPlainText(updated)).toBe("Existing draft First suggestion Second block");
      expect(document.content).toHaveLength(1);
    });
  });
});
