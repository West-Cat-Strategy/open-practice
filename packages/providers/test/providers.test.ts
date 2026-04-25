import { describe, expect, it, vi } from "vitest";
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
