import { describe, expect, it, vi } from "vitest";
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
  DocassembleAutomationProvider,
  DocuSealSignatureProvider,
  ManualSignatureProvider,
  ProviderConfigurationError,
  ProviderResponseError,
} from "../src/index.js";

describe("signature providers", () => {
  it("returns a deterministic manual submission for dev/test mode", async () => {
    const provider = new ManualSignatureProvider();

    await expect(
      provider.createSubmission({
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
        consentText: "I consent to electronic signature.",
      }),
    ).resolves.toMatchObject({
      provider: "manual",
      externalId: "manual:matter-001:doc-001",
      status: "sent",
    });
  });

  it("maps DocuSeal submission responses behind the provider boundary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 123, signing_url: "https://sign.example.test/123" }), {
        status: 200,
      }),
    );
    const provider = new DocuSealSignatureProvider(
      "https://docuseal.example.test",
      "secret",
      fetchImpl,
    );

    const result = await provider.createSubmission({
      matterId: "matter-001",
      documentId: "doc-001",
      title: "Retainer",
      signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
      consentText: "I consent to electronic signature.",
    });

    expect(result).toMatchObject({
      provider: "docuseal",
      externalId: "123",
      signingUrl: "https://sign.example.test/123",
      status: "sent",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://docuseal.example.test/api/submissions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails fast when DocuSeal is not configured", async () => {
    const provider = new DocuSealSignatureProvider("", "");

    await expect(
      provider.createSubmission({
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer",
        signers: [],
        consentText: "Consent",
      }),
    ).rejects.toBeInstanceOf(ProviderConfigurationError);
  });

  it("sanitizes failed DocuSeal responses into provider errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const provider = new DocuSealSignatureProvider(
      "https://docuseal.example.test",
      "secret",
      fetchImpl,
    );

    await expect(
      provider.createSubmission({
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer",
        signers: [],
        consentText: "Consent",
      }),
    ).rejects.toBeInstanceOf(ProviderResponseError);
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

  it("extracts replay metadata from provider evidence when available", () => {
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
        provider: "manual",
        externalId: "manual:matter-001:doc-001",
        status: "viewed",
        occurredAt: "2026-04-24T10:01:00.000Z",
        evidence: {},
      }).replayKey,
    ).toBe("manual:manual%3Amatter-001%3Adoc-001:viewed:2026-04-24T10%3A01%3A00.000Z");
  });
});

describe("document automation providers", () => {
  it("maps docassemble interview sessions behind an optional provider boundary", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ session_id: "session-001", interview_url: "https://docassemble/i/1" }),
          { status: 200 },
        ),
      );
    const provider = new DocassembleAutomationProvider(
      "https://docassemble.example.test",
      "secret",
      fetchImpl,
    );

    await expect(
      provider.startInterview({
        firmId: "firm-west-legal",
        matterId: "matter-001",
        templateId: "intake-retainer",
      }),
    ).resolves.toMatchObject({
      provider: "docassemble",
      externalId: "session-001",
      interviewUrl: "https://docassemble/i/1",
      status: "created",
    });
  });
});
