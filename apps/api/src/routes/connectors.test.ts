import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerConnectorRoutes } from "./connectors.js";
import type { ApiJobQueue, ConnectorDnsResolver } from "./types.js";

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
  connectorJobQueue?: ApiJobQueue;
  connectorDnsResolver?: ConnectorDnsResolver;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin");
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerConnectorRoutes(server, {
    repository: input.repository,
    connectorJobQueue: input.connectorJobQueue,
    connectorDnsResolver: input.connectorDnsResolver ?? (async () => ["203.0.113.10"]),
  });
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

function fakeConnectorQueue(): {
  queue: ApiJobQueue;
  jobs: Array<{
    name: string;
    data: Parameters<ApiJobQueue["add"]>[1];
    options: Parameters<ApiJobQueue["add"]>[2];
  }>;
} {
  const jobs: Array<{
    name: string;
    data: Parameters<ApiJobQueue["add"]>[1];
    options: Parameters<ApiJobQueue["add"]>[2];
  }> = [];
  return {
    jobs,
    queue: {
      async add(name, data, options) {
        jobs.push({ name, data, options });
        return { id: options?.jobId ?? `connector-bull-job-${jobs.length}` };
      },
    },
  };
}

async function createRecoveryConnector(
  repository: InMemoryOpenPracticeRepository,
  status = "enabled",
) {
  return repository.createConnector({
    id: `connector-recovery-${status}`,
    firmId,
    type: "generic",
    key: `synthetic.recovery-${status}`,
    displayName: `Synthetic Recovery ${status}`,
    status: status as "enabled" | "paused" | "disabled" | "error",
    secretReference: { id: `secret-ref/recovery-${status}` },
    configSummary: { deliveryUrl: "https://webhooks.example.test/open-practice" },
    createdAt: "2026-05-26T12:00:00.000Z",
    updatedAt: "2026-05-26T12:00:00.000Z",
  });
}

function retryConfirmation(outboxId: string, expectedStatus: "failed" | "dead_letter") {
  return { confirmed: true, action: "retry", outboxId, expectedStatus };
}

function deadLetterConfirmation(outboxId: string, expectedStatus: "pending" | "failed" | "leased") {
  return { confirmed: true, action: "dead_letter", outboxId, expectedStatus };
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

  it("rejects connector delivery URLs that target private network ranges", async () => {
    const server = testServer({ repository: new InMemoryOpenPracticeRepository() });

    const created = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.private-url",
        displayName: "Synthetic Private URL",
        status: "enabled",
        configSummary: {
          deliveryUrl: "https://10.0.0.5/open-practice",
        },
      },
    });

    expect(created.statusCode).toBe(400);
    expect(created.json()).toMatchObject({
      code: "CONNECTOR_DELIVERY_URL_REJECTED",
      message: "configSummary.deliveryUrl failed outbound webhook guardrail validation",
    });
  });

  it("rejects connector delivery URLs whose DNS resolves to private addresses", async () => {
    const server = testServer({
      repository: new InMemoryOpenPracticeRepository(),
      connectorDnsResolver: async () => ["10.0.0.5"],
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.private-dns",
        displayName: "Synthetic Private DNS",
        status: "enabled",
        configSummary: {
          deliveryUrl: "https://webhooks.example.test/open-practice",
        },
      },
    });

    expect(created.statusCode).toBe(400);
    expect(created.json()).toMatchObject({
      code: "CONNECTOR_DELIVERY_URL_REJECTED",
      message: "configSummary.deliveryUrl failed outbound webhook DNS guardrail validation",
    });
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

  it("registers integration developer apps with scoped credentials and webhook posture", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await createRecoveryConnector(repository);

    const registered = await server.inject({
      method: "POST",
      url: "/api/connectors/developer/apps",
      payload: {
        connectorId: connector.id,
        displayName: "Synthetic Developer App",
        redirectUris: ["https://developer.example.test/oauth/callback#fragment"],
        allowedOrigins: ["https://developer.example.test/app"],
        allowedScopes: ["document.read", "webhook.deliver"],
        regionalEndpoint: {
          region: "ca",
          endpointBaseUrl: "https://api.ca.example.test/open-practice",
        },
        rateLimit: { windowSeconds: 60, maxRequests: 120 },
        customActionPlaceholders: [
          { key: "document.review", label: "Document Review", status: "reserved" },
        ],
      },
    });

    expect(registered.statusCode).toBe(201);
    expect(registered.json()).toMatchObject({
      app: {
        connectorId: connector.id,
        clientId: expect.stringMatching(/^op_client_/),
        status: "draft",
        redirectUris: ["https://developer.example.test/oauth/callback"],
        allowedOrigins: ["https://developer.example.test"],
        allowedScopes: ["document.read", "webhook.deliver"],
        regionalEndpoint: {
          region: "ca",
          endpointBaseUrl: "https://api.ca.example.test/open-practice",
          posture: "cue_only",
        },
        rateLimit: {
          mode: "documented",
          windowSeconds: 60,
          maxRequests: 120,
          enforcement: "reserved",
        },
        customActionPlaceholders: [
          { key: "document.review", label: "Document Review", status: "reserved" },
        ],
      },
    });

    const appId = registered.json().app.id;
    const credential = await server.inject({
      method: "POST",
      url: `/api/connectors/developer/apps/${appId}/credentials`,
      payload: {
        label: "Synthetic scoped credential",
        scopes: ["document.read"],
        secretReference: {
          id: "secret-ref/integration-api-credential",
          label: "Integration API credential",
        },
      },
    });

    expect(credential.statusCode).toBe(201);
    expect(credential.json()).toMatchObject({
      credential: {
        appId,
        label: "Synthetic scoped credential",
        scopes: ["document.read"],
        secretReference: {
          id: "__open_practice_connector_secret_unchanged__",
          label: "Integration API credential",
          redacted: true,
        },
        status: "active",
      },
    });
    expect(credential.body).not.toContain("secret-ref/integration-api-credential");

    const revoked = await server.inject({
      method: "POST",
      url: `/api/connectors/developer/credentials/${credential.json().credential.id}/revoke`,
    });

    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({
      credential: {
        id: credential.json().credential.id,
        status: "revoked",
        revokedAt: expect.any(String),
      },
    });
    expect(revoked.body).not.toContain("secret-ref/integration-api-credential");

    const subscription = await server.inject({
      method: "POST",
      url: `/api/connectors/developer/apps/${appId}/webhook-subscriptions`,
      payload: {
        status: "paused",
        eventTypes: ["document.verified"],
        destinationUrl: "https://webhooks.example.test/open-practice#secret",
        signingSecretReference: { id: "secret-ref/webhook-signing" },
      },
    });

    expect(subscription.statusCode).toBe(201);
    expect(subscription.json()).toMatchObject({
      subscription: {
        appId,
        connectorId: connector.id,
        status: "paused",
        eventTypes: ["document.verified"],
        destinationHost: "webhooks.example.test",
        destinationUrlPresent: true,
        signingSecretReference: {
          id: "__open_practice_connector_secret_unchanged__",
          redacted: true,
        },
      },
    });
    expect(subscription.body).not.toContain("secret-ref/webhook-signing");
    expect(subscription.body).not.toContain("/open-practice");

    const listed = await server.inject({ method: "GET", url: "/api/connectors/developer/apps" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      apps: [
        {
          id: appId,
          credentialCount: 1,
          webhookSubscriptionCount: 1,
          connector: { id: connector.id, status: "enabled" },
        },
      ],
    });

    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "integration_developer_app.registered",
          metadata: expect.objectContaining({
            appId,
            scopeCount: 2,
            endpointBaseUrlPresent: true,
            rateLimitEnforcement: "reserved",
            customActionCount: 1,
          }),
        }),
        expect.objectContaining({
          action: "integration_api_credential.created",
          metadata: expect.objectContaining({
            appId,
            scopeCount: 1,
            secretReferencePresent: true,
          }),
        }),
        expect.objectContaining({
          action: "integration_api_credential.revoked",
          metadata: expect.objectContaining({
            appId,
            credentialId: credential.json().credential.id,
          }),
        }),
        expect.objectContaining({
          action: "integration_webhook_subscription.created",
          metadata: expect.objectContaining({
            appId,
            eventCount: 1,
            destinationHost: "webhooks.example.test",
            signingSecretReferencePresent: true,
          }),
        }),
      ]),
    );
  });

  it("exposes redacted integration delivery history from connector outbox attempts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await createRecoveryConnector(repository);
    const app = await repository.createIntegrationDeveloperApp({
      id: "integration-app-history",
      firmId,
      connectorId: connector.id,
      clientId: "op_client_history",
      displayName: "Synthetic History App",
      status: "active",
      redirectUris: [],
      allowedOrigins: [],
      allowedScopes: ["webhook.deliver"],
      regionalEndpoint: { region: "ca", posture: "cue_only" },
      rateLimit: {
        mode: "documented",
        windowSeconds: 60,
        maxRequests: 60,
        enforcement: "reserved",
      },
      customActionPlaceholders: [],
      createdByUserId: "user-owner_admin",
      createdAt: "2026-05-28T12:00:00.000Z",
      updatedAt: "2026-05-28T12:00:00.000Z",
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-history",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      resourceType: "document",
      resourceId: "doc-history",
      idempotencyKey: "doc-history:verified:v1",
      status: "delivered",
      payloadSummary: { documentId: "doc-history" },
      attemptCount: 1,
      maxAttempts: 3,
      deliveredAt: "2026-05-28T12:03:00.000Z",
      createdAt: "2026-05-28T12:00:00.000Z",
      updatedAt: "2026-05-28T12:03:00.000Z",
    });
    await repository.createConnectorDeliveryAttempt({
      id: "connector-attempt-history",
      firmId,
      connectorId: connector.id,
      outboxId: "connector-outbox-history",
      attemptNumber: 1,
      status: "delivered",
      idempotencyKey: "doc-history:verified:v1",
      startedAt: "2026-05-28T12:02:00.000Z",
      finishedAt: "2026-05-28T12:03:00.000Z",
      metadata: {
        destinationHost: "webhooks.example.test",
        httpStatus: 202,
        authorization: "Bearer should-not-leak",
        terminal: true,
      },
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/connectors/developer/apps/${app.id}/delivery-history`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      app: { id: app.id, connectorId: connector.id },
      deliveries: [
        {
          outbox: {
            id: "connector-outbox-history",
            idempotencyKeyPresent: true,
            leasePresent: false,
            status: "delivered",
          },
          attempts: [
            {
              id: "connector-attempt-history",
              metadata: {
                destinationHost: "webhooks.example.test",
                httpStatus: 202,
                terminal: true,
              },
            },
          ],
        },
      ],
    });
    expect(response.body).not.toContain("doc-history:verified:v1");
    expect(response.body).not.toContain("should-not-leak");
  });

  it("keeps payment-link scopes and unsafe webhook destinations out of the developer boundary", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await createRecoveryConnector(repository);

    const paymentScope = await server.inject({
      method: "POST",
      url: "/api/connectors/developer/apps",
      payload: {
        connectorId: connector.id,
        displayName: "Synthetic Payment Link App",
        allowedScopes: ["payment_link.write"],
      },
    });

    expect(paymentScope.statusCode).toBe(400);

    const registered = await server.inject({
      method: "POST",
      url: "/api/connectors/developer/apps",
      payload: {
        connectorId: connector.id,
        displayName: "Synthetic Webhook App",
        allowedScopes: ["webhook.deliver"],
      },
    });
    const localhostWebhook = await server.inject({
      method: "POST",
      url: `/api/connectors/developer/apps/${registered.json().app.id}/webhook-subscriptions`,
      payload: {
        eventTypes: ["document.verified"],
        destinationUrl: "https://localhost/hooks",
      },
    });

    expect(localhostWebhook.statusCode).toBe(400);
    expect(localhostWebhook.json()).toMatchObject({
      code: "INTEGRATION_WEBHOOK_DESTINATION_DENIED",
    });

    const privateDnsServer = testServer({
      repository,
      connectorDnsResolver: async () => ["10.0.0.8"],
    });
    const privateDnsWebhook = await privateDnsServer.inject({
      method: "POST",
      url: `/api/connectors/developer/apps/${registered.json().app.id}/webhook-subscriptions`,
      payload: {
        eventTypes: ["document.verified"],
        destinationUrl: "https://webhooks.example.test/hooks",
      },
    });
    expect(privateDnsWebhook.statusCode).toBe(400);
    expect(privateDnsWebhook.json()).toMatchObject({
      code: "CONNECTOR_DELIVERY_URL_REJECTED",
      message: "destinationUrl failed outbound webhook DNS guardrail validation",
    });
  });

  it("queues provider-neutral outbox rows idempotently without payload secrets", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const connectorQueue = fakeConnectorQueue();
    const server = testServer({ repository, connectorJobQueue: connectorQueue.queue });
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
    expect(first.json().deliveryJob).toMatchObject({
      queueName: "connectors",
      jobName: "deliver_connectors",
      status: "queued",
      targetResourceType: "connector_outbox",
      targetResourceId: first.json().outbox.id,
      idempotencyKeyPresent: true,
    });
    expect(second.json().deliveryJob).toBeUndefined();
    expect(connectorQueue.jobs).toEqual([
      expect.objectContaining({
        name: "deliver_connectors",
        data: {
          firmId,
          resourceType: "connector_outbox",
          resourceId: first.json().outbox.id,
          metadata: {
            resourceType: "connector_outbox",
            resourceId: first.json().outbox.id,
            eventCount: 1,
            maxAttempts: 4,
            idempotencyKeyPresent: true,
          },
        },
        options: expect.objectContaining({ jobId: expect.any(String) }),
      }),
    ]);
    expect(connectorQueue.jobs[0]?.options).not.toHaveProperty("delay");
    await expect(
      repository.listJobLifecycleRecords(firmId, { queueName: "connectors" }),
    ).resolves.toEqual([
      expect.objectContaining({
        queueName: "connectors",
        jobName: "deliver_connectors",
        bullJobId: connectorQueue.jobs[0]?.options?.jobId,
        status: "queued",
        targetResourceType: "connector_outbox",
        targetResourceId: first.json().outbox.id,
        metadata: expect.objectContaining({
          resourceType: "connector_outbox",
          resourceId: first.json().outbox.id,
          eventCount: 1,
          maxAttempts: 4,
          idempotencyKeyPresent: true,
        }),
      }),
    ]);

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

  it("rejects connector redirect and origin URLs that contain userinfo credentials", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await createRecoveryConnector(repository);

    const redirect = await server.inject({
      method: "POST",
      url: "/api/connectors/developer/apps",
      payload: {
        connectorId: connector.id,
        displayName: "Synthetic Developer App",
        redirectUris: ["https://client:secret@developer.example.test/oauth/callback"],
      },
    });
    const origin = await server.inject({
      method: "POST",
      url: "/api/connectors/developer/apps",
      payload: {
        connectorId: connector.id,
        displayName: "Synthetic Developer App",
        allowedOrigins: ["https://client:secret@developer.example.test/app"],
      },
    });

    expect(redirect.statusCode).toBe(400);
    expect(redirect.json()).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(redirect.body).not.toContain("client:secret");
    expect(origin.statusCode).toBe(400);
    expect(origin.json()).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(origin.body).not.toContain("client:secret");
  });

  it("keeps connector outbox durable without scheduling when the connector queue is absent", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connectorResponse = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.durable",
        displayName: "Synthetic Durable Connector",
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
        idempotencyKey: "doc-001:durable:v1",
        payloadSummary: { documentId: "doc-001" },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      created: true,
      outbox: { status: "pending", idempotencyKeyPresent: true },
    });
    expect(response.json().deliveryJob).toBeUndefined();
    await expect(repository.listConnectorOutbox(firmId)).resolves.toHaveLength(1);
    await expect(
      repository.listJobLifecycleRecords(firmId, { queueName: "connectors" }),
    ).resolves.toEqual([]);
  });

  it("uses delayed BullMQ options for future connector outbox attempts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const connectorQueue = fakeConnectorQueue();
    const server = testServer({ repository, connectorJobQueue: connectorQueue.queue });
    const connectorResponse = await server.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        type: "generic",
        key: "synthetic.delayed",
        displayName: "Synthetic Delayed Connector",
      },
    });
    const nextAttemptAt = new Date(Date.now() + 120_000).toISOString();

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox",
      payload: {
        connectorId: connectorResponse.json().connector.id,
        eventType: "document.verified",
        resourceType: "document",
        resourceId: "doc-001",
        idempotencyKey: "doc-001:delayed:v1",
        payloadSummary: { documentId: "doc-001" },
        nextAttemptAt,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(connectorQueue.jobs).toHaveLength(1);
    expect(connectorQueue.jobs[0]?.options?.delay).toBeGreaterThan(0);
    expect(connectorQueue.jobs[0]?.options?.delay).toBeLessThanOrEqual(120_000);
    const [job] = await repository.listJobLifecycleRecords(firmId, { queueName: "connectors" });
    expect(job).toMatchObject({
      metadata: expect.objectContaining({ nextRetryAt: nextAttemptAt }),
    });
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

  it("manually retries failed connector outbox rows with confirmation and redacted audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const connectorQueue = fakeConnectorQueue();
    const server = testServer({ repository, connectorJobQueue: connectorQueue.queue });
    const connector = await createRecoveryConnector(repository);
    await repository.createConnectorOutbox({
      id: "connector-outbox-retry",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      resourceType: "document",
      resourceId: "doc-retry",
      idempotencyKey: "doc-retry:verified:v1",
      status: "dead_letter",
      payloadSummary: { documentId: "doc-retry" },
      attemptCount: 3,
      maxAttempts: 3,
      deadLetteredAt: "2026-05-26T12:05:00.000Z",
      lastErrorSummary: "Connector delivery failed for [redacted]",
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:05:00.000Z",
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-retry/retry",
      payload: {
        idempotencyKey: "manual-retry-key",
        confirmation: retryConfirmation("connector-outbox-retry", "dead_letter"),
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      outbox: {
        id: "connector-outbox-retry",
        status: "pending",
        attemptCount: 3,
        maxAttempts: 4,
        idempotencyKeyPresent: true,
        leasePresent: false,
      },
      deliveryJob: {
        queueName: "connectors",
        jobName: "deliver_connectors",
        status: "queued",
        targetResourceType: "connector_outbox",
        targetResourceId: "connector-outbox-retry",
        idempotencyKeyPresent: true,
      },
    });
    expect(response.json().outbox.deadLetteredAt).toBeUndefined();
    expect(response.json().outbox.lastErrorSummary).toBeUndefined();
    expect(connectorQueue.jobs).toEqual([
      expect.objectContaining({
        name: "deliver_connectors",
        data: expect.objectContaining({
          resourceType: "connector_outbox",
          resourceId: "connector-outbox-retry",
          metadata: expect.objectContaining({
            manualRecoveryAction: "retry",
            previousStatus: "dead_letter",
            idempotencyKeyPresent: true,
          }),
        }),
      }),
    ]);
    const audit = await repository.listAuditEvents(firmId);
    const event = audit.events.find(
      (candidate) => candidate.action === "connector_outbox.manual_retry",
    );
    expect(event).toMatchObject({
      resourceType: "connector_outbox",
      resourceId: "connector-outbox-retry",
      metadata: expect.objectContaining({
        connectorId: connector.id,
        outboxId: "connector-outbox-retry",
        beforeStatus: "dead_letter",
        expectedStatus: "dead_letter",
        afterStatus: "pending",
        attemptCount: 3,
        maxAttempts: 4,
        idempotencyKeyPresent: true,
        deliveryJobQueued: true,
        queueName: "connectors",
      }),
    });
    expect(JSON.stringify(event?.metadata)).not.toContain("manual-retry-key");
    expect(JSON.stringify(event?.metadata)).not.toContain("doc-retry:verified:v1");
    expect(JSON.stringify(event?.metadata)).not.toContain("secret-ref/recovery");
    expect(JSON.stringify(response.json())).not.toContain("doc-retry:verified:v1");
  });

  it("manually dead-letters eligible connector outbox rows with confirmation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await createRecoveryConnector(repository);
    await repository.createConnectorOutbox({
      id: "connector-outbox-dead-letter",
      firmId,
      connectorId: connector.id,
      eventType: "matter.created",
      resourceType: "matter",
      resourceId: "matter-001",
      idempotencyKey: "matter-001:created:v1",
      status: "failed",
      payloadSummary: { matterId: "matter-001" },
      attemptCount: 1,
      maxAttempts: 3,
      nextAttemptAt: "2026-05-26T12:30:00.000Z",
      lastErrorSummary: "Connector delivery failed for [redacted]",
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:05:00.000Z",
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-dead-letter/dead-letter",
      payload: {
        confirmation: deadLetterConfirmation("connector-outbox-dead-letter", "failed"),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outbox: {
        id: "connector-outbox-dead-letter",
        status: "dead_letter",
        leasePresent: false,
        lastErrorSummary: "Connector outbox manually moved to dead letter by owner review",
      },
    });
    expect(response.json().outbox.nextAttemptAt).toBeUndefined();
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "connector_outbox.manual_dead_letter",
          resourceType: "connector_outbox",
          resourceId: "connector-outbox-dead-letter",
          metadata: expect.objectContaining({
            connectorId: connector.id,
            beforeStatus: "failed",
            expectedStatus: "failed",
            afterStatus: "dead_letter",
            deliveryJobQueued: false,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("matter-001:created:v1");
    expect(JSON.stringify(audit.events)).not.toContain("secret-ref/recovery");
  });

  it("requires matching recovery confirmation before mutating connector outbox rows", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const connectorQueue = fakeConnectorQueue();
    const server = testServer({ repository, connectorJobQueue: connectorQueue.queue });
    const connector = await createRecoveryConnector(repository);
    await repository.createConnectorOutbox({
      id: "connector-outbox-confirmation",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-confirmation:verified:v1",
      status: "failed",
      payloadSummary: { documentId: "doc-confirmation" },
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:05:00.000Z",
    });

    const missing = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-confirmation/retry",
      payload: { idempotencyKey: "manual-retry-key" },
    });
    const mismatched = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-confirmation/retry",
      payload: {
        idempotencyKey: "manual-retry-key",
        confirmation: retryConfirmation("other-outbox", "failed"),
      },
    });

    expect(missing.statusCode).toBe(400);
    expect(mismatched.statusCode).toBe(409);
    expect(mismatched.json()).toMatchObject({
      code: "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
    });
    await expect(
      repository.getConnectorOutbox(firmId, "connector-outbox-confirmation"),
    ).resolves.toMatchObject({
      status: "failed",
    });
    expect(connectorQueue.jobs).toEqual([]);
  });

  it("rejects connector outbox recovery when guards are not satisfied", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const connectorQueue = fakeConnectorQueue();
    const server = testServer({ repository, connectorJobQueue: connectorQueue.queue });
    const connector = await createRecoveryConnector(repository);
    const pausedConnector = await createRecoveryConnector(repository, "paused");
    const createdAt = "2026-05-26T12:00:00.000Z";
    await repository.createConnectorOutbox({
      id: "connector-outbox-delivered",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-delivered:verified:v1",
      status: "delivered",
      payloadSummary: { documentId: "doc-delivered" },
      attemptCount: 1,
      maxAttempts: 3,
      deliveredAt: "2026-05-26T12:05:00.000Z",
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-cancelled",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-cancelled:verified:v1",
      status: "cancelled",
      payloadSummary: { documentId: "doc-cancelled" },
      attemptCount: 0,
      maxAttempts: 3,
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-active-lease",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-active-lease:verified:v1",
      status: "leased",
      payloadSummary: { documentId: "doc-active-lease" },
      attemptCount: 1,
      maxAttempts: 3,
      leaseId: "active-lease",
      leasedUntil: new Date(Date.now() + 60_000).toISOString(),
      createdAt,
      updatedAt: createdAt,
    });
    await repository.createConnectorOutbox({
      id: "connector-outbox-paused-connector",
      firmId,
      connectorId: pausedConnector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-paused-connector:verified:v1",
      status: "failed",
      payloadSummary: { documentId: "doc-paused-connector" },
      attemptCount: 1,
      maxAttempts: 3,
      createdAt,
      updatedAt: createdAt,
    });

    const deliveredRetry = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-delivered/retry",
      payload: {
        idempotencyKey: "manual-retry-delivered",
        confirmation: retryConfirmation("connector-outbox-delivered", "failed"),
      },
    });
    const cancelledDeadLetter = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-cancelled/dead-letter",
      payload: {
        confirmation: deadLetterConfirmation("connector-outbox-cancelled", "pending"),
      },
    });
    const activeLeaseDeadLetter = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-active-lease/dead-letter",
      payload: {
        confirmation: deadLetterConfirmation("connector-outbox-active-lease", "leased"),
      },
    });
    const pausedRetry = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-paused-connector/retry",
      payload: {
        idempotencyKey: "manual-retry-paused",
        confirmation: retryConfirmation("connector-outbox-paused-connector", "failed"),
      },
    });
    const missing = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/missing-outbox/retry",
      payload: {
        idempotencyKey: "manual-retry-missing",
        confirmation: retryConfirmation("missing-outbox", "failed"),
      },
    });

    expect(deliveredRetry.statusCode).toBe(409);
    expect(deliveredRetry.json()).toMatchObject({
      code: "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
    });
    expect(cancelledDeadLetter.statusCode).toBe(409);
    expect(cancelledDeadLetter.json()).toMatchObject({
      code: "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
    });
    expect(activeLeaseDeadLetter.statusCode).toBe(409);
    expect(activeLeaseDeadLetter.json()).toMatchObject({
      code: "CONNECTOR_OUTBOX_LEASE_ACTIVE",
    });
    expect(pausedRetry.statusCode).toBe(409);
    expect(pausedRetry.json()).toMatchObject({ code: "CONNECTOR_NOT_ENABLED" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "CONNECTOR_OUTBOX_NOT_FOUND" });
  });

  it("rejects connector manual retry when the connector queue is unavailable", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const connector = await createRecoveryConnector(repository);
    await repository.createConnectorOutbox({
      id: "connector-outbox-no-queue",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-no-queue:verified:v1",
      status: "failed",
      payloadSummary: { documentId: "doc-no-queue" },
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:05:00.000Z",
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-no-queue/retry",
      payload: {
        idempotencyKey: "manual-retry-no-queue",
        confirmation: retryConfirmation("connector-outbox-no-queue", "failed"),
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "CONNECTOR_QUEUE_NOT_CONFIGURED" });
    await expect(
      repository.getConnectorOutbox(firmId, "connector-outbox-no-queue"),
    ).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("limits connector recovery writes to owner admins", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const connector = await createRecoveryConnector(repository);
    await repository.createConnectorOutbox({
      id: "connector-outbox-denied",
      firmId,
      connectorId: connector.id,
      eventType: "document.verified",
      idempotencyKey: "doc-denied:verified:v1",
      status: "failed",
      payloadSummary: { documentId: "doc-denied" },
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:05:00.000Z",
    });

    const response = await testServer({
      repository,
      authUser: user("licensee"),
      connectorJobQueue: fakeConnectorQueue().queue,
    }).inject({
      method: "POST",
      url: "/api/connectors/outbox/connector-outbox-denied/retry",
      payload: {
        idempotencyKey: "manual-retry-denied",
        confirmation: retryConfirmation("connector-outbox-denied", "failed"),
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "CONNECTOR_ACCESS_REQUIRED",
    });
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
