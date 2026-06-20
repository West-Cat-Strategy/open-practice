import { describe, expect, it } from "vitest";
import {
  EmbeddedAutomationProvider,
  EmbeddedSignatureProvider,
  LocalDocumentConversionReviewProvider,
} from "../src/index.js";
import { FakeDraftAssistProvider } from "../src/testing.js";

describe("embedded providers", () => {
  it("returns a deterministic embedded signature submission", async () => {
    const provider = new EmbeddedSignatureProvider();

    await expect(
      provider.createSubmission({
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
        consentText: "I consent to electronic signature.",
      }),
    ).resolves.toMatchObject({
      provider: "embedded",
      externalId: "embedded:matter-001:doc-001",
      status: "sent",
      evidence: { mode: "embedded" },
    });
  });

  it("returns embedded automation references without network calls", async () => {
    const provider = new EmbeddedAutomationProvider();

    await expect(
      provider.startInterview({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateId: "intake-retainer",
      }),
    ).resolves.toMatchObject({
      provider: "embedded",
      externalId: "embedded:matter-001:intake-retainer",
      status: "created",
    });

    await expect(
      provider.renderDocument({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        sessionExternalId: "embedded:matter-001:intake-retainer",
        documentTitle: "Repair notice letter",
        packageId: "repair_notice_package",
        packageDocumentId: "repair_notice_letter",
      }),
    ).resolves.toMatchObject({
      provider: "embedded",
      externalId:
        "embedded:embedded:matter-001:intake-retainer:repair_notice_package:repair_notice_letter",
      title: "Repair notice letter",
      evidence: {
        mode: "embedded",
        packageId: "repair_notice_package",
        packageDocumentId: "repair_notice_letter",
      },
    });
  });
});

describe("document conversion review providers", () => {
  it("returns deterministic metadata-only conversion review posture", () => {
    const provider = new LocalDocumentConversionReviewProvider();
    const privateText = "Synthetic provider-backed text.\nSecond line.\fThird page marker.";

    const result = provider.createMetadata({
      sourceText: privateText,
      sourceTextLength: 999,
    });

    expect(result).toEqual({
      provider: "local-document-conversion-metadata",
      providerStatus: "metadata_only",
      conversionReviewPosture: "ready_for_review",
      summaryPosture: "op_authored_metadata_only",
      metadataOnly: true,
      reviewOnly: true,
      sourceTextLength: privateText.length,
      wordCount: 8,
      lineCount: 2,
      nonEmptyLineCount: 2,
      paragraphCount: 1,
      pageBreakCount: 1,
      estimatedPageCount: 2,
      counts: {
        sourceTextLength: privateText.length,
        wordCount: 8,
        lineCount: 2,
        nonEmptyLineCount: 2,
        paragraphCount: 1,
        pageBreakCount: 1,
        estimatedPageCount: 2,
      },
      policy: {
        metadataOnly: true,
        reviewOnly: true,
        rawOcrTextStored: false,
        rawMarkdownStored: false,
        annotationBodiesStored: false,
        chunksStored: false,
        embeddingsStored: false,
        providerPayloadsStored: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(privateText);
    expect(result).not.toHaveProperty("rawOcrText");
    expect(result).not.toHaveProperty("rawMarkdown");
    expect(result).not.toHaveProperty("annotationBodies");
    expect(result).not.toHaveProperty("annotationSpans");
    expect(result).not.toHaveProperty("chunks");
    expect(result).not.toHaveProperty("embeddings");
    expect(result).not.toHaveProperty("storageKey");
    expect(result).not.toHaveProperty("objectBody");
    expect(result).not.toHaveProperty("prompt");
    expect(result).not.toHaveProperty("providerPayload");
    expect(result).not.toHaveProperty("summary");
  });
});

describe("draft assist providers", () => {
  it("returns deterministic fake suggestions without network calls", async () => {
    const provider = new FakeDraftAssistProvider({ providerKey: "fake-ai", model: "fake-model" });

    expect(provider.getStatus()).toMatchObject({
      status: "configured",
      provider: "fake-ai",
      model: "fake-model",
      supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
    });
    await expect(
      provider.createSuggestion({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        sourceType: "draft",
        draftId: "draft-001",
        task: "summarize",
        sourceText: "Synthetic source text.",
        instruction: "Focus on risk.",
      }),
    ).resolves.toMatchObject({
      providerKey: "fake-ai",
      providerModel: "fake-model",
      suggestedText: expect.stringContaining("[summarize]"),
      metadata: { sourceWordCount: 3, instructionLength: 14 },
    });
  });

  it("returns synthetic operational proposals for every review family", async () => {
    const provider = new FakeDraftAssistProvider({ providerKey: "fake-ai", model: "fake-model" });

    await expect(
      provider.createOperationalProposals({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        sourceType: "draft",
        draftId: "draft-001",
        sourceText: "Synthetic source text for operational review.",
        requestedKinds: [
          "deadline_extraction",
          "task_creation",
          "document_organization",
          "draft_invoice_cue",
          "client_update_draft",
        ],
      }),
    ).resolves.toMatchObject({
      providerKey: "fake-ai",
      providerModel: "fake-model",
      proposals: [
        { kind: "deadline_extraction", proposal: { deadline: expect.any(Object) } },
        { kind: "task_creation", proposal: { task: expect.any(Object) } },
        { kind: "document_organization", proposal: { documentOrganization: expect.any(Object) } },
        { kind: "draft_invoice_cue", proposal: { invoiceCue: expect.any(Object) } },
        { kind: "client_update_draft", proposal: { clientUpdate: expect.any(Object) } },
      ],
    });
  });
});
