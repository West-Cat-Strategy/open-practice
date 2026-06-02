import { describe, expect, it } from "vitest";
import {
  compareSignatureProviderEvents,
  compareSignatureProviderStatuses,
  getSignatureProviderEventReplayMetadata,
  getSignatureStatusUpdateDecision,
  orderSignatureProviderEvents,
  orderSignatureProviderStatuses,
  shouldUpdateSignatureRequestStatus,
} from "../../domain/src/signatures.js";
import {
  EmbeddedAutomationProvider,
  EmbeddedSignatureProvider,
  FakeDraftAssistProvider,
} from "../src/index.js";

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

describe("signature provider lifecycle helpers", () => {
  it("orders provider statuses by lifecycle progress", () => {
    expect(compareSignatureProviderStatuses("viewed", "sent")).toBe(1);
    expect(compareSignatureProviderStatuses("sent", "viewed")).toBe(-1);
    expect(compareSignatureProviderStatuses("completed", "declined")).toBe(0);
    expect(
      orderSignatureProviderStatuses([
        "completed",
        "draft",
        "viewed",
        "pending_provider_submission",
        "sent",
      ]),
    ).toEqual(["draft", "pending_provider_submission", "sent", "viewed", "completed"]);
  });

  it("orders provider events by lifecycle progress and occurrence time", () => {
    const events = [
      { status: "completed" as const, occurredAt: "2026-04-24T10:03:00.000Z" },
      { status: "sent" as const, occurredAt: "2026-04-24T10:02:00.000Z" },
      { status: "sent" as const, occurredAt: "2026-04-24T10:01:00.000Z" },
    ];

    expect(compareSignatureProviderEvents(events[1], events[2])).toBe(1);
    expect(orderSignatureProviderEvents(events)).toEqual([
      { status: "sent", occurredAt: "2026-04-24T10:01:00.000Z" },
      { status: "sent", occurredAt: "2026-04-24T10:02:00.000Z" },
      { status: "completed", occurredAt: "2026-04-24T10:03:00.000Z" },
    ]);
  });

  it("allows advancing events while preserving terminal request statuses", () => {
    expect(shouldUpdateSignatureRequestStatus("sent", { status: "viewed" })).toBe(true);
    expect(shouldUpdateSignatureRequestStatus("viewed", { status: "sent" })).toBe(false);
    expect(shouldUpdateSignatureRequestStatus("sent", { status: "sent" })).toBe(false);
    expect(shouldUpdateSignatureRequestStatus("completed", { status: "declined" })).toBe(false);

    expect(getSignatureStatusUpdateDecision("completed", { status: "declined" })).toMatchObject({
      shouldUpdate: false,
      reason: "terminal_status_preserved",
    });
    expect(getSignatureStatusUpdateDecision("viewed", { status: "sent" })).toMatchObject({
      shouldUpdate: false,
      reason: "status_regression",
    });
  });

  it("extracts replay metadata from legacy provider evidence when available", () => {
    expect(
      getSignatureProviderEventReplayMetadata({
        provider: "docuseal",
        externalId: "submission-001",
        status: "completed",
        occurredAt: "2026-04-24T10:00:00.000Z",
        evidence: {
          event_id: 12345,
          deliveryId: "delivery-001",
        },
      }),
    ).toEqual({
      replayKey: "docuseal:submission-001:12345",
      providerEventId: "12345",
      providerWebhookId: "delivery-001",
    });

    expect(
      getSignatureProviderEventReplayMetadata({
        provider: "embedded",
        externalId: "embedded:matter-001:doc-001",
        status: "viewed",
        occurredAt: "2026-04-24T10:01:00.000Z",
        evidence: {},
      }).replayKey,
    ).toBe("embedded:embedded%3Amatter-001%3Adoc-001:viewed:2026-04-24T10%3A01%3A00.000Z");
  });
});
