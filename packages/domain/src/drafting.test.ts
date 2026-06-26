import { describe, it, expect } from "vitest";
import {
  appendPlainTextToTipTapDocument,
  assertDraftAssistTask,
  buildBasicDraftTemplates,
  buildDraftAssistAuditMetadata,
  buildDraftExportDocument,
  extractTipTapPlainText,
  listDraftMergeFields,
  reviewDraftAssistRecord,
  sanitizeDraftHtml,
  tipTapDocumentSchema,
  UnknownDraftMergeFieldError,
  type DraftAssistRecord,
  type DraftMergeContext,
  type TipTapDocument,
} from "./drafting.js";
import {
  buildPracticePresetTemplates,
  normalizePracticePresetIds,
  PRACTICE_PRESET_CATALOG,
  PRACTICE_PRESET_IDS,
} from "./practice-presets.js";
import { validateEmbeddedIntakeTemplateDefinition } from "./intake.js";

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
          name: "Canadian Matter Correspondence",
          firmId: "firm-example",
          category: "correspondence",
          active: true,
          editorJson: { type: "doc" },
        },
        {
          id: "draft-template-meeting-notes",
          name: "Canadian Matter Meeting Notes",
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
      const serialized = JSON.stringify(templates);
      expect(serialized).toContain("Canadian");
      expect(serialized).toContain("{{ matter.jurisdiction }}");
      expect(serialized).toContain("{{ firm.name }}");
      expect(serialized).not.toMatch(/\bstate\b|\bcounty\b|\battorney\b|zip code/i);
    });
  });

  describe("draft export helpers", () => {
    const mergeContext: DraftMergeContext = {
      firm: {
        name: "West Coast Legal Services Collective",
        officeEmail: "office@example.test",
        officePhone: "604-555-0100",
      },
      matter: {
        number: "2026-0001",
        title: "Morgan tenancy dispute",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
      },
      client: {
        displayName: "Ada Morgan",
        email: "ada@example.test",
        phone: "604-555-0101",
        address: "123 Synthetic Street, Vancouver, BC",
        preferredLanguage: "English",
        timezone: "America/Vancouver",
        communicationNotes: "Use plain-language email updates.",
        notes: "Synthetic client note.",
      },
    };

    it("resolves safe matter, client, and firm merge fields into export blocks", () => {
      const document = buildDraftExportDocument({
        title: "Letter for {{ matter.number }}",
        mergeContext,
        editorJson: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "{{ firm.name }}" }],
            },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Dear " },
                {
                  type: "text",
                  text: "{{ client.displayName }} at {{ client.address }}",
                  marks: [{ type: "bold" }],
                },
                {
                  type: "text",
                  text: ", regarding {{ matter.title }}. Language: {{ client.preferredLanguage }}.",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "{{ matter.practiceArea }}" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(document.title).toBe("Letter for 2026-0001");
      expect(document.blocks).toEqual([
        {
          type: "heading",
          level: 1,
          runs: [{ text: "West Coast Legal Services Collective", marks: [] }],
        },
        {
          type: "paragraph",
          runs: [
            { text: "Dear ", marks: [] },
            {
              text: "Ada Morgan at 123 Synthetic Street, Vancouver, BC",
              marks: ["bold"],
            },
            { text: ", regarding Morgan tenancy dispute. Language: English.", marks: [] },
          ],
        },
        {
          type: "bullet_list_item",
          order: undefined,
          runs: [{ text: "Residential tenancy", marks: [] }],
        },
      ]);
    });

    it("rejects unknown merge fields before rendering", () => {
      const editorJson: TipTapDocument = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "{{ intake.answer }} {{ matter.title }}" }],
          },
        ],
      };

      expect(listDraftMergeFields(editorJson)).toEqual(["intake.answer", "matter.title"]);
      expect(() =>
        buildDraftExportDocument({
          title: "Blocked",
          editorJson,
          mergeContext,
        }),
      ).toThrow(UnknownDraftMergeFieldError);
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

  describe("practice preset builders", () => {
    it("exposes the four clean-room starter presets", () => {
      expect(PRACTICE_PRESET_IDS).toEqual([
        "general-canada",
        "bc-residential-tenancy",
        "bc-notarial",
        "canada-small-business-records",
      ]);
      expect(PRACTICE_PRESET_CATALOG).toHaveLength(4);
      expect(
        PRACTICE_PRESET_CATALOG.flatMap((preset) => [
          ...preset.draftTemplates.map((template) => template.metadata.source),
          ...preset.intakeTemplates.map((template) => template.metadata.source),
        ]),
      ).toEqual(expect.arrayContaining(["open-practice-preset"]));
      for (const template of PRACTICE_PRESET_CATALOG.flatMap((preset) => preset.intakeTemplates)) {
        expect(template.definition.schemaVersion).toBe(2);
        expect(validateEmbeddedIntakeTemplateDefinition(template.definition)).toBe(
          template.definition,
        );
      }
      const serialized = JSON.stringify(PRACTICE_PRESET_CATALOG);
      expect(serialized).toContain("Canadian");
      expect(serialized).toContain("BC Residential Tenancy");
      expect(serialized).not.toMatch(/\bstate\b|\bcounty\b|\battorney\b|zip code/i);
    });

    it("deduplicates selected presets in catalog order", () => {
      expect(
        normalizePracticePresetIds([
          "bc-notarial",
          "general-canada",
          "bc-notarial",
          "canada-small-business-records",
        ]),
      ).toEqual(["general-canada", "bc-notarial", "canada-small-business-records"]);
    });

    it("creates deterministic firm-scoped draft and intake templates", () => {
      const built = buildPracticePresetTemplates({
        firmId: "firm-example",
        timestamp: "2026-04-30T12:00:00.000Z",
        selectedPresetIds: ["bc-residential-tenancy", "general-canada"],
      });

      expect(built.selectedPresetIds).toEqual(["general-canada", "bc-residential-tenancy"]);
      expect(built.draftTemplates).toMatchObject([
        {
          id: "draft-template-preset-general-canada-matter-summary",
          name: "Canadian Matter Summary Note",
          firmId: "firm-example",
          category: "general-practice",
          active: true,
          createdAt: "2026-04-30T12:00:00.000Z",
          metadata: {
            presetId: "general-canada",
            presetVersion: 1,
            jurisdictions: ["CANADA", "OTHER"],
            editable: true,
          },
        },
        {
          id: "draft-template-preset-bc-tenancy-chronology",
          name: "Tenancy Issue Chronology",
          category: "residential-tenancy",
          metadata: { presetId: "bc-residential-tenancy", jurisdictions: ["BC"] },
        },
      ]);
      expect(built.intakeTemplates).toMatchObject([
        {
          id: "intake-template-preset-general-canada",
          category: "general-practice",
          provider: "embedded",
          definitionVersion: 2,
          definition: {
            schemaVersion: 2,
            questions: expect.arrayContaining([
              expect.objectContaining({ id: "jurisdiction", label: "Canadian jurisdiction" }),
            ]),
          },
          metadata: { presetId: "general-canada" },
        },
        {
          id: "intake-template-preset-bc-tenancy",
          category: "residential-tenancy",
          provider: "embedded",
          definitionVersion: 2,
          definition: {
            schemaVersion: 2,
            packages: expect.arrayContaining([
              expect.objectContaining({ title: "BC repair notice review package" }),
            ]),
          },
          metadata: { presetId: "bc-residential-tenancy" },
        },
      ]);
      expect(built.intakeTemplateVersions).toMatchObject([
        {
          id: "intake-template-preset-general-canada:v2",
          version: 2,
          definitionVersion: 2,
          metadata: { source: "open-practice-preset", presetId: "general-canada" },
        },
        {
          id: "intake-template-preset-bc-tenancy:v2",
          version: 2,
          definitionVersion: 2,
          metadata: { source: "open-practice-preset", presetId: "bc-residential-tenancy" },
        },
      ]);
    });
  });
});
