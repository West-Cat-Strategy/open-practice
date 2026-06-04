import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { SignatureProvider } from "@open-practice/domain";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
const emailJobQueue = {
  async add(_name: string, _data: unknown, options?: { jobId?: string }) {
    return { id: options?.jobId ?? "email-job-test" };
  },
};

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
    emailJobQueue,
    ...overrides,
  });
  servers.push(server);
  return server;
}

function signaturePayload(overrides: Record<string, unknown> = {}) {
  return {
    matterId: "matter-001",
    documentId: "doc-001",
    title: "Retainer agreement",
    consentText: "I consent to electronic signature.",
    signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
    deliveryConfirmation: { confirmed: true, channel: "email", recipientCount: 1 },
    ...overrides,
  };
}

async function createMatterTwoDocument(repository: InMemoryOpenPracticeRepository) {
  await repository.createDocumentUploadIntent({
    id: "doc-matter-002",
    firmId: "firm-west-legal",
    matterId: "matter-002",
    title: "North Star minute book.pdf",
    storageKey: "matters/matter-002/minute-book.pdf",
    checksumSha256: "d".repeat(64),
    classification: "general",
    legalHold: false,
  });
}

async function enableSmtp(repository: InMemoryOpenPracticeRepository) {
  await repository.upsertProviderSetting({
    id: "provider-smtp-mailpit",
    firmId: "firm-west-legal",
    kind: "smtp",
    key: "mailpit",
    enabled: true,
    encryptedConfig: "local-mailpit-profile",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("signature routes", () => {
  it("creates signature requests and returns event history through the extracted registrar", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      request: {
        firmId: "firm-west-legal",
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer agreement",
        provider: "embedded",
        status: "sent",
      },
      signers: [
        {
          firmId: "firm-west-legal",
          name: "Ada Morgan",
          email: "ada@example.test",
          role: "client",
          status: "sent",
        },
      ],
    });
    expect(created.json()).not.toHaveProperty("success");

    const requestId = created.json<{ request: { id: string } }>().request.id;
    const list = await server.inject({ method: "GET", url: "/api/signature-requests" });
    const events = await server.inject({
      method: "GET",
      url: `/api/signature-requests/${requestId}/events`,
    });

    expect(list.json<Array<{ id: string }>>()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requestId })]),
    );
    expect(events.json()).toMatchObject({
      events: [expect.objectContaining({ signatureRequestId: requestId, status: "sent" })],
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "signature_request.created",
          resourceType: "signature_request",
          resourceId: requestId,
          metadata: {
            matterId: "matter-001",
            documentId: "doc-001",
            provider: "embedded",
            status: "sent",
            signerCount: 1,
          },
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find((event) => event.action === "signature_request.created");
    expect(auditEvent?.metadata).not.toHaveProperty("consentText");
    expect(auditEvent?.metadata).not.toHaveProperty("signers");
  });

  it("returns an audit-safe evidence packet with signer roles and redacted evidence", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });
    const createdPayload = created.json<{
      request: { id: string; externalId: string };
      signers: Array<{ id: string }>;
    }>();
    const signerId = createdPayload.signers[0].id;

    const embeddedEvent = await server.inject({
      method: "POST",
      url: `/api/signature-requests/${createdPayload.request.id}/embedded-events`,
      payload: {
        signerId,
        status: "completed",
        consentText: "I consent to this synthetic signature.",
        evidence: {
          publicEventId: "embedded-event-001",
          completedBy: "Ada Morgan",
          clientEmail: "ada@example.test",
          tokenHash: "synthetic-token-hash",
          ip: "203.0.113.10",
          userAgent: "Synthetic browser",
        },
      },
    });
    const packet = await server.inject({
      method: "GET",
      url: `/api/signature-requests/${createdPayload.request.id}/evidence-packet`,
    });

    expect(embeddedEvent.statusCode).toBe(200);
    expect(packet.statusCode).toBe(200);
    expect(packet.json()).toMatchObject({
      signatureRequestId: createdPayload.request.id,
      matterId: "matter-001",
      documentId: "doc-001",
      status: "completed",
      auditSafe: true,
      signers: [
        expect.objectContaining({
          id: signerId,
          role: "client",
          evidenceStatus: "event_recorded",
        }),
      ],
      timeline: expect.arrayContaining([
        expect.objectContaining({
          status: "completed",
          signerId,
          evidence: {
            present: true,
            keys: expect.arrayContaining(["mode", "signerId"]),
          },
        }),
      ]),
    });
    const serialized = JSON.stringify(packet.json());
    expect(serialized).not.toContain("ada@example.test");
    expect(serialized).not.toContain("I consent to this synthetic signature.");
    expect(serialized).not.toContain("203.0.113.10");
    expect(serialized).not.toContain("Synthetic browser");
    expect(serialized).not.toContain("clientEmail");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("completedBy");
    expect(serialized).not.toContain(createdPayload.request.externalId);
  });

  it("keeps matter-scoped users out of other matters' evidence packets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createMatterTwoDocument(repository);
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload({
        matterId: "matter-002",
        documentId: "doc-matter-002",
        title: "North Star authorization",
      }),
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const denied = await server.inject({
      method: "GET",
      url: `/api/signature-requests/${requestId}/evidence-packet`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(denied.statusCode).toBe(404);
    expect(denied.json()).toMatchObject({
      error: "Error",
      message: "Signature request was not found",
    });
    expect(JSON.stringify(denied.json())).not.toContain("matter-002");
  });

  it("lists only assigned-matter signatures for matter-scoped users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createMatterTwoDocument(repository);
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload({
        matterId: "matter-002",
        documentId: "doc-matter-002",
        title: "North Star authorization",
      }),
    });
    const scopedList = await server.inject({
      method: "GET",
      url: "/api/signature-requests",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(scopedList.statusCode).toBe(200);
    expect(
      scopedList.json<Array<{ matterId: string }>>().map((request) => request.matterId),
    ).toEqual(["matter-001"]);
  });

  it("rejects signature request creation before provider submission when delivery is not confirmed", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const submissions: unknown[] = [];
    const provider: SignatureProvider = {
      async createSubmission(input) {
        submissions.push(input);
        return {
          provider: "embedded",
          externalId: "embedded:not-called",
          status: "sent",
        };
      },
    };
    const existing = await repository.listSignatureRequests("firm-west-legal");
    const server = testServer({ repository, signatureProvider: provider });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload({ deliveryConfirmation: undefined }),
    });

    expect(created.statusCode).toBe(400);
    expect(created.json()).toMatchObject({ code: "SEND_CONFIRMATION_REQUIRED" });
    expect(submissions).toEqual([]);
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual([]);
    await expect(repository.listSignatureRequests("firm-west-legal")).resolves.toHaveLength(
      existing.length,
    );
  });

  it("queues signer email through the SMTP outbox when configured", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableSmtp(repository);
    const server = testServer({ repository });

    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      queuedEmail: {
        templateKey: "signature.requested",
        status: "queued",
      },
    });
    await expect(repository.listJobLifecycleRecords("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueName: "email",
          jobName: "send_email",
          targetResourceType: "email_outbox",
          metadata: expect.objectContaining({
            provider: "mailpit",
            templateKey: "signature.requested",
            recipientCount: 1,
            relatedResourceType: "signature_request",
          }),
        }),
      ]),
    );
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "email_outbox.queued",
          resourceType: "email_outbox",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            templateKey: "signature.requested",
            provider: "mailpit",
            recipientCount: 1,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("rejects mismatched provider events for signature requests", async () => {
    const provider: SignatureProvider = {
      async createSubmission(input) {
        return {
          provider: "embedded",
          externalId: `embedded:${input.matterId}:${input.documentId}`,
          status: "sent",
        };
      },
      async getSubmission() {
        return {
          provider: "docuseal",
          externalId: "docuseal-submission-001",
          status: "completed",
        };
      },
    };
    const server = testServer({ signatureProvider: provider });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const event = await server.inject({
      method: "POST",
      url: "/api/signature-requests/provider-events",
      payload: {
        signatureRequestId: requestId,
      },
    });

    expect(event.statusCode).toBe(409);
    expect(event.json()).toMatchObject({
      error: "Error",
      message: "Provider sync does not match signature request",
    });
  });

  it("records successful provider events in the route audit log", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const provider: SignatureProvider = {
      async createSubmission(input) {
        return {
          provider: "embedded",
          externalId: `embedded:${input.matterId}:${input.documentId}`,
          status: "sent",
        };
      },
      async getSubmission(externalId) {
        return {
          provider: "embedded",
          externalId,
          status: "completed",
          evidence: { rawProviderBlob: "not for route audit" },
        };
      },
    };
    const server = testServer({ repository, signatureProvider: provider });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });
    const signatureRequest = created.json<{
      request: { id: string; externalId: string; provider: string };
    }>().request;
    const event = await server.inject({
      method: "POST",
      url: "/api/signature-requests/provider-events",
      payload: {
        signatureRequestId: signatureRequest.id,
      },
    });

    expect(event.statusCode).toBe(200);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "signature_provider_event.recorded",
          resourceType: "signature_request",
          resourceId: signatureRequest.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            signatureRequestId: signatureRequest.id,
            provider: "embedded",
            externalId: signatureRequest.externalId,
            status: "completed",
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find(
      (candidate) => candidate.action === "signature_provider_event.recorded",
    );
    expect(auditEvent?.metadata).not.toHaveProperty("evidence");
    expect(auditEvent?.metadata).not.toHaveProperty("rawProviderBlob");
  });

  it("rejects embedded signature events for unknown requests", async () => {
    const unknownRequest = await testServer().inject({
      method: "POST",
      url: "/api/signature-requests/missing-signature/embedded-events",
      payload: { status: "completed" },
    });

    expect(unknownRequest.statusCode).toBe(404);
    expect(unknownRequest.json()).toMatchObject({
      error: "Error",
      message: "Signature request was not found",
    });
  });

  it("preserves terminal ordering for embedded signature events", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const completed = await server.inject({
      method: "POST",
      url: `/api/signature-requests/${requestId}/embedded-events`,
      payload: {
        status: "completed",
        occurredAt: "2026-04-24T12:00:00.000Z",
        evidence: { completedBy: "Ada Morgan" },
      },
    });
    const outOfOrder = await server.inject({
      method: "POST",
      url: `/api/signature-requests/${requestId}/embedded-events`,
      payload: { status: "viewed", occurredAt: "2026-04-24T12:01:00.000Z" },
    });
    const list = await server.inject({ method: "GET", url: "/api/signature-requests" });

    expect(completed.statusCode).toBe(200);
    expect(outOfOrder.statusCode).toBe(200);
    expect(list.json<Array<{ id: string; status: string }>>()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requestId, status: "completed" })]),
    );
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "signature_embedded_event.recorded",
          resourceType: "signature_request",
          resourceId: requestId,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            signatureRequestId: requestId,
            provider: "embedded",
            status: "completed",
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const auditEvent = audit.events.find(
      (candidate) =>
        candidate.action === "signature_embedded_event.recorded" &&
        candidate.metadata.status === "completed",
    );
    expect(auditEvent?.metadata).not.toHaveProperty("consentText");
    expect(auditEvent?.metadata).not.toHaveProperty("evidence");
    expect(auditEvent?.metadata).not.toHaveProperty("ip");
  });

  it("keeps unauthorized matter access at 403", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/signature-requests",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: signaturePayload({ matterId: "matter-002" }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Signature request access required",
    });
  });

  it("returns legacy top-level error shape for invalid signature requests", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload({ signers: [] }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(response.json()).not.toHaveProperty("success");
  });

  it("rejects embedded events for deprecated DocuSeal signature requests", async () => {
    const docusealProvider: SignatureProvider = {
      async createSubmission() {
        return {
          provider: "docuseal",
          externalId: "docuseal-submission-001",
          status: "sent",
        };
      },
    };
    const server = testServer({ signatureProvider: docusealProvider });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: signaturePayload(),
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const response = await server.inject({
      method: "POST",
      url: `/api/signature-requests/${requestId}/embedded-events`,
      payload: { status: "completed" },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({
      error: "Error",
      message: "DocuSeal signature events are deprecated",
    });
  });
});
