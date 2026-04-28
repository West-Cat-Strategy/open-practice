import { describe, it, expect } from "vitest";
import { buildBasicDraftTemplates, sanitizeDraftHtml, tipTapDocumentSchema } from "./drafting.js";

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
});
