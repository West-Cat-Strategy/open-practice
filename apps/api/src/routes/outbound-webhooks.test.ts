import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerOutboundWebhookRoutes } from "./outbound-webhooks.js";

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

function testServer(
  input: {
    repository?: InMemoryOpenPracticeRepository;
    authUser?: User;
  } = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.authUser ?? user("owner_admin");
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerOutboundWebhookRoutes(server, { repository });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("outbound webhook routes", () => {
  it("simulates a signed test delivery with redacted audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/outbound-webhooks/test-deliveries",
      payload: {
        destinationUrl: "https://webhooks.example.test/open-practice#private",
        events: ["matter.created", "document.verified"],
        signingKeyReference: "secret://outbound-webhooks/synthetic",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      simulation: {
        status: "simulated",
        destination: { scheme: "https", host: "webhooks.example.test" },
        eventCount: 2,
        events: ["matter.created", "document.verified"],
        signing: {
          algorithm: "hmac-sha256",
          signatureHeader: "x-open-practice-signature",
          timestampHeader: "x-open-practice-timestamp",
          deliveryIdHeader: "x-open-practice-delivery-id",
          eventHeader: "x-open-practice-event",
          secretReference: "secret://outbound-webhooks/synthetic",
        },
        bodyShape: {
          deliveryId: "string",
          event: "allowlisted_event",
          createdAt: "iso8601",
          data: "synthetic_object",
        },
      },
    });

    const audit = await repository.listAuditEvents(firmId);
    const event = audit.events.find(
      (candidate) => candidate.action === "outbound_webhook.test_delivery_simulated",
    );
    expect(event).toMatchObject({
      resourceType: "outbound_webhook",
      metadata: {
        destinationScheme: "https",
        destinationHost: "webhooks.example.test",
        eventCount: 2,
        events: ["matter.created", "document.verified"],
        signingAlgorithm: "hmac-sha256",
        signatureHeader: "x-open-practice-signature",
        simulationOnly: true,
      },
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("/open-practice");
    expect(JSON.stringify(event?.metadata)).not.toContain("synthetic");
  });

  it("denies localhost and loopback destinations before audit events", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/outbound-webhooks/test-deliveries",
      payload: {
        destinationUrl: "https://127.0.0.1/webhook",
        events: ["matter.created"],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "OUTBOUND_WEBHOOK_DESTINATION_DENIED",
    });
    const audit = await repository.listAuditEvents(firmId);
    expect(
      audit.events.some(
        (candidate) => candidate.action === "outbound_webhook.test_delivery_simulated",
      ),
    ).toBe(false);
  });

  it("rejects non-allowlisted events and matter-scoped users without firm integration access", async () => {
    const badEventResponse = await testServer().inject({
      method: "POST",
      url: "/api/outbound-webhooks/test-deliveries",
      payload: {
        destinationUrl: "https://webhooks.example.test/open-practice",
        events: ["contact.deleted"],
      },
    });
    expect(badEventResponse.statusCode).toBe(400);

    const unauthorizedResponse = await testServer({ authUser: user("firm_member") }).inject({
      method: "POST",
      url: "/api/outbound-webhooks/test-deliveries",
      payload: {
        destinationUrl: "https://webhooks.example.test/open-practice",
        events: ["matter.created"],
      },
    });
    expect(unauthorizedResponse.statusCode).toBe(403);
  });
});
