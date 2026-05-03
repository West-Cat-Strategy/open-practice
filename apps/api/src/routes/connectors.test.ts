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
          id: "secret-ref/synthetic-case-status",
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
      eventType: "matter.summary.ready",
      resourceType: "matter",
      resourceId: "matter-001",
      idempotencyKey: "matter-001:summary-ready:v1",
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
        eventType: "matter.summary.ready",
        idempotencyKey: "matter-001:summary-ready:v1",
        status: "pending",
        attemptCount: 0,
        maxAttempts: 4,
      },
    });
    expect(second.json()).toMatchObject({
      created: false,
      outbox: {
        id: first.json().outbox.id,
        idempotencyKey: "matter-001:summary-ready:v1",
      },
    });

    const listed = await server.inject({
      method: "GET",
      url: `/api/connectors/outbox?connectorId=${connectorId}`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().outbox).toHaveLength(1);
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
