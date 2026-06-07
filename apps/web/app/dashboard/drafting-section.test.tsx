import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { emptyAiOperationalProposalsResponse } from "../ai-operational-proposals-dashboard";
import type {
  DraftAssistRecordsResponse,
  DraftAssistStatusResponse,
  DraftExportResponse,
  DraftingDashboardResponse,
} from "../types";
import { DraftingSection } from "./drafting-section";

const editorJson = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Synthetic letter opening" }],
    },
  ],
};

const template: DraftingDashboardResponse["templates"][number] = {
  id: "draft-template-synthetic",
  firmId: "firm_synthetic",
  name: "Synthetic Legal Letter",
  description: "Synthetic correspondence template.",
  editorJson,
  category: "correspondence",
  active: true,
  createdAt: "2026-06-06T12:00:00.000Z",
  updatedAt: "2026-06-06T12:00:00.000Z",
  metadata: {},
};

const draft: DraftingDashboardResponse["draftsByMatterId"][string][number] = {
  id: "draft_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  title: "Synthetic Legal Letter - 2026-0001",
  editorJson,
  version: 2,
  createdByUserId: "user_synthetic",
  updatedByUserId: "user_synthetic",
  createdAt: "2026-06-06T12:00:00.000Z",
  updatedAt: "2026-06-06T12:00:00.000Z",
  metadata: { templateId: "draft-template-synthetic" },
};

const draftExport: DraftExportResponse = {
  format: "pdf",
  title: "Synthetic Legal Letter Export",
  contentType: "application/pdf",
  byteLength: 2048,
  checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  storageKey: "synthetic/draft-export.pdf",
  document: {
    id: "document_synthetic",
    firmId: "firm_synthetic",
    matterId: "matter_synthetic",
    title: "Synthetic export document",
    storageKey: "synthetic/document.pdf",
    checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    version: 1,
    classification: "general",
    legalHold: false,
    uploadStatus: "verified",
    checksumStatus: "verified",
    scanStatus: "passed",
    reviewStatus: "accepted",
    reviewMetadata: {},
  },
  generatedDocument: {
    id: "generated_document_synthetic",
    firmId: "firm_synthetic",
    matterId: "matter_synthetic",
    provider: "manual",
    externalId: "generated-document-synthetic",
    title: "Synthetic generated document",
    documentId: "document_synthetic",
    evidence: {},
    createdAt: "2026-06-06T00:00:00.000Z",
  },
};

const assistRecord: DraftAssistRecordsResponse["records"][number] = {
  id: "draft_assist_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  sourceType: "draft",
  draftId: "draft_synthetic",
  task: "suggest_revision",
  providerKey: "synthetic_provider",
  providerModel: "synthetic_model",
  status: "suggested",
  suggestedText: "Synthetic suggested revision.",
  summary: "Synthetic summary.",
  createdByUserId: "user_synthetic",
  createdAt: "2026-06-06T00:00:00.000Z",
  updatedAt: "2026-06-06T00:00:00.000Z",
  metadata: {},
};

function noop(): void {}

const supportedDraftAssistTasks: DraftAssistStatusResponse["supportedTasks"] = [
  "summarize",
  "suggest_revision",
  "continue_draft",
];

function baseProps(
  overrides: Partial<Parameters<typeof DraftingSection>[0]> = {},
): Parameters<typeof DraftingSection>[0] {
  return {
    activeDraftAssistRecords: [],
    activeDraftExports: [],
    activeDrafts: [draft],
    aiOperationalProposals: emptyAiOperationalProposalsResponse(),
    aiOperationalProposalStatus: "No operational proposals queued.",
    creatingTemplateId: "",
    drafting: {
      templates: [template],
      draftsByMatterId: { matter_synthetic: [draft] },
    },
    draftAssistInstruction: "",
    draftAssistMessage: "Draft assist unavailable: not configured.",
    draftAssistStatus: {
      status: "disabled" as const,
      reason: "not_configured",
      supportedTasks: supportedDraftAssistTasks,
    },
    draftAssistTask: "summarize" as const,
    draftEditorJson: null,
    draftExportFormat: "pdf" as const,
    draftExportTitle: "",
    draftHasChanges: false,
    draftMergeField: "matter.number" as const,
    draftStatus: "No draft edits in this session.",
    exportingDraftFormat: "" as const,
    queueingAiOperationalProposals: false,
    runningDraftAssist: false,
    savingDraft: false,
    selectedDraft: undefined,
    onCloseDraftEditor: noop,
    onCreateBlankDraft: noop,
    onCreateDraftFromTemplate: noop,
    onDraftAssistInstructionChange: noop,
    onDraftAssistTaskChange: noop,
    onDraftEditorJsonChange: noop,
    onDraftExportFormatChange: noop,
    onDraftExportTitleChange: noop,
    onDraftMergeFieldChange: noop,
    onExportDraft: noop,
    onInsertDraftAssistRecord: noop,
    onInsertMergeField: noop,
    onOpenDraft: noop,
    onQueueDraftOperationalProposals: noop,
    onReviewDraftAssistRecord: noop,
    onRunDraftAssist: noop,
    onSaveDraft: noop,
    ...overrides,
  };
}

describe("DraftingSection", () => {
  it("renders templates and matter drafts without changing copy or classes", () => {
    const html = renderToStaticMarkup(createElement(DraftingSection, baseProps()));

    expect(html).toContain("Templates");
    expect(html).toContain("1 active");
    expect(html).toContain('class="activity-grid drafting-template-grid"');
    expect(html).toContain('class="activity-card draft-template-card"');
    expect(html).toContain("Blank Draft");
    expect(html).toContain("Synthetic Legal Letter");
    expect(html).toContain("Matter drafts");
    expect(html).toContain('class="party-row draft-row"');
    expect(html).toContain("Synthetic Legal Letter - 2026-0001");
    expect(html).toContain("updated 2026-06-06");
    expect(html).toContain("Synthetic letter opening");
    expect(html).toContain("v2");
    expect(html).toContain("No draft edits in this session.");
  });

  it("keeps selected draft editor controls and empty-state copy visible", () => {
    const html = renderToStaticMarkup(
      createElement(
        DraftingSection,
        baseProps({
          activeDraftAssistRecords: [assistRecord],
          activeDraftExports: [draftExport],
          draftAssistMessage: "Suggestion ready for review.",
          draftAssistStatus: {
            status: "configured",
            provider: "synthetic_provider",
            model: "synthetic_model",
            supportedTasks: supportedDraftAssistTasks,
          },
          draftAssistTask: "suggest_revision",
          draftEditorJson: editorJson,
          draftExportTitle: "Synthetic Legal Letter Export",
          draftHasChanges: true,
          draftMergeField: "client.email",
          draftStatus: "Editing synthetic draft.",
          selectedDraft: draft,
        }),
      ),
    );

    expect(html).toContain('class="draft-editor-panel"');
    expect(html).toContain('class="draft-editor-header"');
    expect(html).toContain("Back to matter drafts");
    expect(html).toContain("v2 · updated 2026-06-06");
    expect(html).toContain("Save");
    expect(html).toContain('class="draft-office-panel"');
    expect(html).toContain("Office output");
    expect(html).toContain("Merge field");
    expect(html).toContain("client.email");
    expect(html).toContain("Export title");
    expect(html).toContain("Format");
    expect(html).toContain("Save draft changes before exporting.");
    expect(html).toContain('class="party-row draft-export-row"');
    expect(html).toContain("Synthetic Legal Letter Export");
    expect(html).toContain("PDF · 2 KB · Synthetic export document");
    expect(html).toContain("checksum abcdef012345...");
    expect(html).toContain('class="draft-assist-panel"');
    expect(html).toContain("Draft assist");
    expect(html).toContain("Suggest revision");
    expect(html).toContain("Optional review instruction");
    expect(html).toContain("Queue proposals");
    expect(html).toContain("Suggestion ready for review.");
    expect(html).toContain('class="party-row draft-assist-row"');
    expect(html).toContain("suggest revision");
    expect(html).toContain("Synthetic summary.");
    expect(html).toContain("Reject assist suggestion");
    expect(html).toContain("Editing synthetic draft.");
  });
});
