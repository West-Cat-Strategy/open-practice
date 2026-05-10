import { describe, expect, it } from "vitest";
import { renderDraftExport } from "./draft-exports.js";
import type { DraftExportDocument } from "@open-practice/domain";

const exportDocument: DraftExportDocument = {
  title: "Synthetic office export",
  blocks: [
    {
      type: "heading",
      level: 1,
      runs: [{ text: "Synthetic heading", marks: ["bold"] }],
    },
    {
      type: "paragraph",
      runs: [
        { text: "A reviewed ", marks: [] },
        { text: "draft", marks: ["italic", "underline"] },
        { text: " for export.", marks: [] },
      ],
    },
    {
      type: "bullet_list_item",
      runs: [{ text: "Matter-scoped output", marks: [] }],
    },
    {
      type: "ordered_list_item",
      order: 1,
      runs: [{ text: "Synthetic ordered item", marks: [] }],
    },
    {
      type: "blockquote",
      runs: [{ text: "Synthetic quote", marks: [] }],
    },
  ],
};

describe("draft export renderers", () => {
  it("renders PDF buffers", async () => {
    const rendered = await renderDraftExport({ format: "pdf", document: exportDocument });

    expect(rendered.contentType).toBe("application/pdf");
    expect(rendered.extension).toBe("pdf");
    expect(rendered.buffer.byteLength).toBeGreaterThan(100);
    expect(rendered.buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("renders DOCX buffers", async () => {
    const rendered = await renderDraftExport({ format: "docx", document: exportDocument });

    expect(rendered.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(rendered.extension).toBe("docx");
    expect(rendered.buffer.byteLength).toBeGreaterThan(100);
    expect(rendered.buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
