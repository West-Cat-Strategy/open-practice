import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { SignatureProvider } from "@open-practice/domain";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
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

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("signature routes", () => {
  it("creates signature requests and returns event history through the extracted registrar", async () => {
    const server = testServer();
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

  it("rejects mismatched provider events for signature requests", async () => {
    const server = testServer();
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
        provider: "docuseal",
        externalId: "docuseal-submission-001",
        status: "completed",
      },
    });

    expect(event.statusCode).toBe(409);
    expect(event.json()).toMatchObject({
      error: "Error",
      message: "Provider event does not match signature request",
    });
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
    const server = testServer();
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
