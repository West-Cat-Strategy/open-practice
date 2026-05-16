import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerConnectorRoutes } from "./connectors.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole): User {
  return {
    id: `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  };
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin");
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerConnectorRoutes(server, { repository: input.repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number; code?: string };
    reply.status(normalizedError.statusCode ?? 400).send({
      error: normalizedError.name,
      code: normalizedError.code,
      message: normalizedError.message,
    });
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("connector routes", () => {
  it("creates and lists redacted connector registry records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const created = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.case-status",
        displayName: "Synthetic Case Status Connector",
        status: "enabled",
        secretReference: {
          id: "secret-ref/synthetic-case-status",
          label: "Synthetic API credential",
          version: "v1",
        },
        configSummary: {
          mode: "disabled_worker_preview",
          scopes: ["case_status.read"],
        },
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      connector: {
        type: "generic",
        key: "synthetic.case-status",
        status: "enabled",
        secretReference: {
          id: "__open_practice_connector_secret_unchanged__",
          label: "Synthetic API credential",
          version: "v1",
          redacted: true,
        },
        configSummary: {
          mode: "disabled_worker_preview",
        },
      },
    });
    expect(JSON.stringify(created.json())).not.toContain("credential-value");

    const listed = await server.inject({ method: "GET", url: "/api/connectors?type=generic" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().connectors).toHaveLength(1);
    expect(JSON.stringify(listed.json())).not.toContain("secret-ref/synthetic-case-status");

    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "connector.created",
          resourceType: "connector",
          metadata: expect.objectContaining({
            connectorType: "generic",
            secretReferencePresent: true,
          }),
        }),
      ]),
    );
  });

  it("preserves stored connector secrets when clients write the masked sentinel", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await repository.createConnector({
      id: "connector-secret-preserve",
      firmId,
      type: "generic",
      key: "synthetic.secret-preserve",
      displayName: "Synthetic Secret Preserve",
      status: "enabled",
      secretReference: {
        id: "secret-ref/raw-stored-value",
        label: "Synthetic stored secret",
        version: "v1",
      },
      configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice" },
      createdAt: "2026-05-14T12:00:00.000Z",
      updatedAt: "2026-05-14T12:00:00.000Z",
    });

    const listed = await server.inject({ method: "GET", url: "/api/connectors" });
    const maskedSecret = listed.json().connectors[0].secretReference;
    expect(maskedSecret).toMatchObject({
      id: "__open_practice_connector_secret_unchanged__",
      label: "Synthetic stored secret",
      redacted: true,
    });

    const updated = await server.inject({
      method: "PATCH",
      url: `/api/connectors/${connector.id}`,
      payload: {
        displayName: "Synthetic Secret Preserve Updated",
        secretReference: maskedSecret,
        configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice", retry: true },
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      connector: {
        displayName: "Synthetic Secret Preserve Updated",
        secretReference: {
          id: "__open_practice_connector_secret_unchanged__",
          label: "Synthetic stored secret",
          version: "v1",
          redacted: true,
        },
      },
    });
    expect(JSON.stringify(updated.json())).not.toContain("secret-ref/raw-stored-value");
    await expect(repository.getConnector(firmId, connector.id)).resolves.toMatchObject({
      secretReference: {
        id: "secret-ref/raw-stored-value",
        label: "Synthetic stored secret",
        version: "v1",
      },
    });
  });

  it("rejects raw credential-looking config summaries", async () => {
    const response = await testServer({ repository: new InMemoryOpenPracticeRepository() }).inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "email",
        key: "synthetic.mail",
        displayName: "Synthetic Mail",
        configSummary: {
          apiKey: "credential-value",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "CONNECTOR_SECRET_SUMMARY_REJECTED",
    });
  });

  it("rejects secret-looking connector summary values", async () => {
    const response = await testServer({ repository: new InMemoryOpenPracticeRepository() }).inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.webhook",
        displayName: "Synthetic Webhook",
        configSummary: {
          note: "Bearer synthetic-token-value",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "CONNECTOR_SECRET_SUMMARY_REJECTED",
    });
  });

  it("queues provider-neutral outbox rows idempotently without payload secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connectorResponse = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.review",
        displayName: "Synthetic Review Connector",
      },
    });
    const connectorId = connectorResponse.json().connector.id;
    const payload = {
      connectorId,
      eventType: "matter.created",
      resourceType: "matter",
      resourceId: "matter-001",
      idempotencyKey: "matter-001:matter-created:v1",
      payloadSummary: {
        matterId: "matter-001",
        fieldCount: 3,
      },
      maxAttempts: 4,
    };

    const first = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload,
    });
    const second = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      created: true,
      outbox: {
        connectorId,
        eventType: "matter.created",
        idempotencyKeyPresent: true,
        status: "pending",
        attemptCount: 0,
        maxAttempts: 4,
      },
    });
    expect(second.json()).toMatchObject({
      created: false,
      outbox: {
        id: first.json().outbox.id,
        idempotencyKeyPresent: true,
      },
    });
    expect(first.json().outbox).not.toHaveProperty("idempotencyKey");
    expect(first.json().outbox).not.toHaveProperty("leaseId");

    const listed = await server.inject({
      method: "GET",
      url: `/api/connectors/outbox?connectorId=${connectorId}`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().outbox).toHaveLength(1);

    const conflict = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload: {
        ...payload,
        payloadSummary: { matterId: "matter-001", fieldCount: 4 },
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: "IDEMPOTENCY_KEY_CONFLICT" });
  });

  it("rejects connector outbox events outside the delivery allowlist", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connectorResponse = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.review",
        displayName: "Synthetic Review Connector",
      },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload: {
        connectorId: connectorResponse.json().connector.id,
        eventType: "matter.summary.ready",
        resourceType: "matter",
        resourceId: "matter-001",
        idempotencyKey: "matter-001:summary-ready:v1",
        payloadSummary: { matterId: "matter-001", fieldCount: 3 },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "CONNECTOR_EVENT_NOT_ALLOWLISTED" });
  });

  it("rejects non-allowlisted connector payload summary fields before delivery", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connectorResponse = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.review",
        displayName: "Synthetic Review Connector",
      },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload: {
        connectorId: connectorResponse.json().connector.id,
        eventType: "matter.created",
        resourceType: "matter",
        resourceId: "matter-001",
        idempotencyKey: "matter-001:private-narrative:v1",
        payloadSummary: {
          matterId: "matter-001",
          narrative: "Synthetic client facts should not leave the system.",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "CONNECTOR_PAYLOAD_SUMMARY_REJECTED" });
  });

  it("rejects nested connector payload summary values", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connectorResponse = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.nested",
        displayName: "Synthetic Nested Connector",
      },
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload: {
        connectorId: connectorResponse.json().connector.id,
        eventType: "document.verified",
        resourceType: "document",
        resourceId: "doc-001",
        idempotencyKey: "doc-001:nested:v1",
        payloadSummary: {
          documentId: "doc-001",
          status: { reviewed: true },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "CONNECTOR_PAYLOAD_SUMMARY_REJECTED" });
  });

  it("returns redacted connector delivery and dead-letter status", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await repository.createConnector({
      id: "connector-webhook-status",
      firmId,
      type: "generic",
      key: "synthetic.webhook-status",
      displayName: "Synthetic Webhook Status",
      status: "enabled",
      secretReference: { id: "secret-ref/webhook-status" },
      configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice" },
      createdAt: "2026-05-12T12:00:00.000Z",
      updatedAt: "2026-05-12T12:00:00.000Z",
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-status",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      resourceType: "document",
      resourceId: "doc-001",
      idempotencyKey: "doc-001:verified:v1",
      status: "pending",
      payloadSummary: { documentId: "doc-001" },
      attemptCount: 0,
      maxAttempts: 1,
      nextAttemptAt: "2026-05-12T12:00:00.000Z",
      createdAt: "2026-05-12T12:00:00.000Z",
      updatedAt: "2026-05-12T12:00:00.000Z",
    });
    const [leased] = await repository.leaseConnectorOutbox({
      firmId,
      leaseId: "lease-status",
      leasedUntil: "2026-05-12T12:10:00.000Z",
      now: "2026-05-12T12:05:00.000Z",
      limit: 1,
    });
    await repository.recordConnectorDeliveryResult({
      firmId,
      connectorId: connector.id,
      outboxId: "connector-outbox-status",
      attemptId: leased.attempt.id,
      leaseId: "lease-status",
      status: "failed",
      occurredAt: "2026-05-12T12:05:30.000Z",
      terminal: true,
      errorSummary: "Connector delivery failed with HTTP 403",
      metadata: {
        destinationHost: "webhooks.example.test",
        signature: "raw-signature-must-not-return",
      },
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/connectors/outbox?connectorId=${connector.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outbox: [
        {
          id: "connector-outbox-status",
          status: "dead_letter",
          idempotencyKeyPresent: true,
          leasePresent: false,
          deadLetteredAt: "2026-05-12T12:05:30.000Z",
          lastErrorSummary: "Connector delivery failed with HTTP 403",
        },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("doc-001:verified:v1");
    expect(JSON.stringify(response.json())).not.toContain("raw-signature-must-not-return");
    expect(JSON.stringify(response.json())).not.toContain("secret-ref/webhook-status");
  });

  it("limits connector writes to owner admins", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      authUser: user("licensee"),
    }).inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.denied",
        displayName: "Denied Connector",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "CONNECTOR_ACCESS_REQUIRED",
    });
  });
});
