import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "./server.js";

const servers: Array<{ close: () => Promise<void> }> = [];

function testServer() {
  const server = createApiServer({
    repository: new InMemoryOpenPracticeRepository(),
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("API auth and persistence boundaries", () => {
  it("rejects unauthenticated production requests", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await testServer().inject({ method: "GET", url: "/api/overview" });
      expect(response.statusCode).toBe(401);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("scopes matter lists to the authenticated user", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/matters",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(200);
    const matters = response.json<Array<{ id: string }>>();
    expect(matters.map((matter) => matter.id)).toEqual(["matter-001"]);
  });

  it("returns server-derived dashboard capabilities", async () => {
    const response = await testServer().inject({ method: "GET", url: "/api/capabilities" });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ sections: Array<{ key: string; enabled: boolean }> }>().sections,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "matters", enabled: true }),
        expect.objectContaining({ key: "documents", enabled: true }),
        expect.objectContaining({ key: "signatures", enabled: true }),
      ]),
    );
  });

  it("requires explicit matter scope for matter-scoped ledger reads", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ledger",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("lists signature and intake records across assigned matters for matter-scoped users", async () => {
    const headers = {
      "x-open-practice-user-id": "user-licensee",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const server = testServer();
    const signatures = await server.inject({
      method: "GET",
      url: "/api/signature-requests",
      headers,
    });
    const intake = await server.inject({ method: "GET", url: "/api/intake-sessions", headers });

    expect(signatures.statusCode).toBe(200);
    expect(signatures.json<Array<{ matterId: string }>>().map((record) => record.matterId)).toEqual(
      ["matter-001"],
    );
    expect(intake.statusCode).toBe(200);
    expect(
      intake
        .json<{ sessions: Array<{ matterId: string }> }>()
        .sessions.map((record) => record.matterId),
    ).toEqual(["matter-001"]);
  });

  it("persists conflict audit events through the repository boundary", async () => {
    const server = testServer();
    const before = await server.inject({ method: "GET", url: "/api/audit" });
    const beforeCount = before.json<{ events: unknown[] }>().events.length;

    const conflict = await server.inject({
      method: "POST",
      url: "/api/conflicts/check",
      payload: { prospectiveName: "River City Rentals", includeClosedMatters: true },
    });

    expect(conflict.statusCode).toBe(200);
    const after = await server.inject({ method: "GET", url: "/api/audit" });
    expect(after.json<{ events: unknown[] }>().events).toHaveLength(beforeCount + 1);
  });

  it("posts ledger transactions through validated request bodies", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        id: "earned-fee-001",
        idempotencyKey: "earned-fee-001",
        entries: [
          {
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 75000,
            creditCents: 0,
            memo: "Transfer earned fee from trust liability",
          },
          {
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-operating-revenue",
            debitCents: 0,
            creditCents: 75000,
            memo: "Recognize earned fee",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ firmId: string; idempotencyKey: string }>()).toMatchObject({
      firmId: "firm-west-legal",
      idempotencyKey: "earned-fee-001",
    });
  });

  it("rejects ledger entries whose client is not linked to the target matter", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        id: "bad-client-link",
        idempotencyKey: "bad-client-link",
        entries: [
          {
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 100,
            creditCents: 0,
            memo: "Bad client matter link",
          },
          {
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 0,
            creditCents: 100,
            memo: "Bad client matter link",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toMatch(/non-adverse party/);
  });

  it("marks completed document uploads with checksum and scan states", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/doc-001/upload-complete",
      payload: {
        checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
        scanStatus: "passed",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "doc-001",
      uploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "passed",
    });
  });

  it("persists signature requests and provider events", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: {
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer agreement",
        consentText: "I consent to electronic signature.",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
      },
    });

    expect(created.statusCode).toBe(200);
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const event = await server.inject({
      method: "POST",
      url: "/api/signature-requests/provider-events",
      payload: {
        signatureRequestId: requestId,
        provider: "manual",
        externalId: `manual:matter-001:doc-001`,
        status: "completed",
        evidence: { completedBy: "Ada Morgan" },
      },
    });

    expect(event.statusCode).toBe(200);
    const list = await server.inject({ method: "GET", url: "/api/signature-requests" });
    expect(list.json<Array<{ id: string; status: string }>>()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requestId, status: "completed" })]),
    );
  });

  it("persists intake sessions and generated document records", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-001",
        templateId: "intake-template-001",
        clientContactId: "contact-ada",
      },
    });

    expect(created.statusCode).toBe(200);
    const sessionId = created.json<{ id: string }>().id;
    const generated = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/generated-documents`,
      payload: { title: "Draft notice package" },
    });

    expect(generated.statusCode).toBe(200);
    expect(generated.json()).toMatchObject({
      intakeSessionId: sessionId,
      matterId: "matter-001",
      title: "Draft notice package",
    });
  });
});
