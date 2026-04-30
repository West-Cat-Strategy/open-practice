import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerAuthExtensionRoutes } from "./auth-extensions.js";
import { registerDocumentProcessingRoutes } from "./document-processing.js";
import { registerEmailRoutes } from "./email.js";
import { registerExternalUploadRoutes } from "./external-uploads.js";
import { registerInboundEmailRoutes } from "./inbound-email.js";
import { registerJobsRoutes } from "./jobs.js";
import { registerShareRoutes } from "./shares.js";

const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  input: {
    repository?: OpenPracticeRepository;
    authUser?: User;
    jwtSecret?: string;
  } = {},
): FastifyInstance {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  const dependencies = { repository };
  registerAuthExtensionRoutes(server);
  registerDocumentProcessingRoutes(server, dependencies);
  registerEmailRoutes(server, dependencies);
  registerExternalUploadRoutes(server, dependencies);
  registerInboundEmailRoutes(server, dependencies);
  registerJobsRoutes(server, dependencies);
  registerShareRoutes(server, { ...dependencies, jwtSecret: input.jwtSecret });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("planned surface route scaffolds", () => {
  it("returns disabled/default status for provider-backed surfaces", async () => {
    const server = testServer();

    await expect(server.inject({ method: "GET", url: "/api/jobs" })).resolves.toMatchObject({
      statusCode: 200,
    });
    expect((await server.inject({ method: "GET", url: "/api/jobs" })).json()).toMatchObject({
      status: "default",
      queues: ["email", "inbound_email", "ai_triage", "ocr", "transcription", "media"],
      jobs: [],
    });
    expect((await server.inject({ method: "GET", url: "/api/email/status" })).json()).toMatchObject(
      {
        status: "disabled",
        reason: "not_configured",
      },
    );
    expect(
      (await server.inject({ method: "GET", url: "/api/inbound-email/status" })).json(),
    ).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      addresses: [],
    });
    expect(
      (await server.inject({ method: "GET", url: "/api/document-processing/status" })).json(),
    ).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
    });
    expect(
      (await server.inject({ method: "GET", url: "/api/external-uploads/status" })).json(),
    ).toMatchObject({
      status: "not_configured",
      reason: "s3_not_configured",
    });
    expect(
      (await server.inject({ method: "GET", url: "/api/auth/extensions" })).json(),
    ).toMatchObject({
      oidc: { status: "disabled", reason: "not_configured" },
      saml: { status: "disabled", reason: "not_configured" },
    });
  });

  it("lists persisted share links through matter-scoped access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createShareLink({
      id: "share-link-planned-surface",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "planned-surface-token-hash",
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      expiresAt: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-28T00:00:00.000Z",
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/shares?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      shares: [expect.objectContaining({ matterId: "matter-001" })],
    });
    expect(response.json().shares[0]).not.toHaveProperty("tokenHash");
  });

  it("keeps planned actions auth-gated before returning disabled scaffolding", async () => {
    const server = testServer({ authUser: user("licensee", ["matter-001"]) });

    const allowedPreview = await server.inject({
      method: "POST",
      url: "/api/email/previews",
      payload: {
        matterId: "matter-001",
        template: "matter-update",
        to: ["client@example.test"],
      },
    });
    expect(allowedPreview.statusCode).toBe(200);
    expect(allowedPreview.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      preview: null,
    });

    const deniedUpload = await server.inject({
      method: "POST",
      url: "/api/external-uploads/intents",
      payload: { matterId: "matter-002", filename: "records.pdf" },
    });
    expect(deniedUpload.statusCode).toBe(403);
    expect(deniedUpload.json()).toMatchObject({
      message: "Document access required",
    });
  });

  it("does not enqueue document processing without a configured worker", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      message: "Document processing worker is not configured",
    });
  });

  it("lists parsed inbound email messages through matter-scoped access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailMessage({
      id: "inbound-message-001",
      firmId: "firm-west-legal",
      addressId: "inbound-address-001",
      matterId: "matter-001",
      messageId: "<message-001@example.test>",
      fromAddress: "client@example.test",
      toAddresses: ["matter-001@open-practice.test"],
      subject: "Filed materials",
      receivedAt: "2026-04-28T12:00:00.000Z",
      rawStorageKey: "inbound/raw/message-001.eml",
      parsedText: "Please review.",
      labels: [],
      status: "triaged",
      metadata: {},
    });
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const allowed = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-001",
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({
      status: "available",
      messages: [{ id: "inbound-message-001", matterId: "matter-001" }],
    });

    const denied = await server.inject({
      method: "GET",
      url: "/api/inbound-email/messages?matterId=matter-002",
    });
    expect(denied.statusCode).toBe(403);
  });
});
