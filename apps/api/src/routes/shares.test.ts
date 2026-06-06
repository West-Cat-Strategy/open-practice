import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { PUBLIC_TOKEN_HEADER, hashToken } from "../http/auth-helpers.js";
import {
  PUBLIC_TOKEN_MUTATION_RATE_LIMIT,
  PUBLIC_TOKEN_VIEW_RATE_LIMIT,
} from "./public-token-rate-limits.js";
import { registerShareRoutes } from "./shares.js";

const jwtSecret = "test-share-secret-at-least-32-chars";
const servers: FastifyInstance[] = [];
const emailJobQueue = {
  async add(_name: string, _data: unknown, options?: { jobId?: string }) {
    return { id: options?.jobId ?? "email-job-test" };
  },
};

function deliveryConfirmation(recipientCount = 1) {
  return { confirmed: true, channel: "email", recipientCount };
}

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

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
  withAuthHook?: boolean;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  if (input.withAuthHook ?? true) {
    const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
    server.addHook("preHandler", async (request) => {
      request.auth = { firmId: authUser.firmId, user: authUser };
    });
  }
  server.register(async (app) => {
    await app.register(rateLimit, {
      global: true,
      max: 1_000,
      timeWindow: "1 minute",
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests",
      }),
    });
    registerShareRoutes(app, { repository: input.repository, jwtSecret, emailJobQueue });
  });
  servers.push(server);
  return server;
}

async function addShareableDocument(repository: InMemoryOpenPracticeRepository): Promise<void> {
  await repository.createDocumentUploadIntent({
    id: "doc-shareable-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Client disclosure.pdf",
    storageKey: "matters/matter-001/client-disclosure.pdf",
    checksumSha256: "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2",
    classification: "general",
    legalHold: false,
  });
  await repository.completeDocumentUpload({
    firmId: "firm-west-legal",
    documentId: "doc-shareable-001",
    checksumSha256: "b8f3bcb433c2666c1f9f72d8c9f6f2bf792ee18f746375a42dbf17447275d4b2",
    scanStatus: "passed",
  });
}

async function enableSmtp(repository: InMemoryOpenPracticeRepository): Promise<void> {
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

describe("share routes", () => {
  it("denies share provider status to client-external users", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      authUser: user("client_external", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/shares/status",
    });

    expect(response.statusCode).toBe(403);
  });

  it("reports permission-aware share-link creation status", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ownerResponse = await testServer({
      repository,
      authUser: user("owner_admin", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/shares/status",
    });
    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.json()).toMatchObject({
      createStatus: "enabled",
      canCreate: true,
      canManage: true,
    });

    const auditorResponse = await testServer({
      repository,
      authUser: user("auditor", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/shares/status",
    });
    expect(auditorResponse.statusCode).toBe(200);
    expect(auditorResponse.json()).toMatchObject({
      createStatus: "enabled",
      canCreate: false,
      canManage: false,
    });
  });

  it("creates a one-time raw token while storing only the token hash", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const response = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        requireEmailVerification: false,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.share).toMatchObject({
      matterId: "matter-001",
      permissions: ["view_documents"],
      grantedByUserId: "user-licensee",
      requireEmailVerification: false,
    });
    expect(body.share).not.toHaveProperty("tokenHash");

    const stored = await repository.listShareLinks("firm-west-legal", { matterId: "matter-001" });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(body.token);
    expect(stored[0].tokenHash).toHaveLength(64);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "share_link.created",
          resourceType: "share_link",
          resourceId: body.share.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            permissions: ["view_documents"],
            expiresAt: body.share.expiresAt,
            requireEmailVerification: false,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("lists sanitized persisted share links through matter-scoped access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createShareLink({
      id: "share-link-owner-suite",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "owner-suite-token-hash",
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

  it("enforces matter scope and document eligibility before creating document shares", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const wrongMatter = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-002", permissions: ["view_documents"] },
    });
    expect(wrongMatter.statusCode).toBe(403);

    const ineligibleDocument = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });
    expect(ineligibleDocument.statusCode).toBe(422);
    expect(ineligibleDocument.json()).toMatchObject({
      message: "No documents on this matter are eligible for portal sharing",
    });
  });

  it("queues optional share notifications while the raw token is available", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    await enableSmtp(repository);
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const response = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        notificationEmail: "client@example.test",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      queuedEmail: {
        templateKey: "share_link.created",
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
            templateKey: "share_link.created",
            recipientCount: 1,
            relatedResourceType: "share_link",
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
            templateKey: "share_link.created",
            provider: "mailpit",
            recipientCount: 1,
          }),
        }),
      ]),
      valid: true,
    });
    const audit = await repository.listAuditEvents("firm-west-legal");
    const queuedAudit = audit.events.find((event) => event.action === "email_outbox.queued");
    expect(queuedAudit?.metadata).not.toHaveProperty("token");
    expect(queuedAudit?.metadata).not.toHaveProperty("textBody");
    const [queuedEmail] = await repository.listEmailOutbox("firm-west-legal");
    expect(queuedEmail?.textBody).toContain(`Share token: ${response.json().token}`);
    expect(queuedEmail?.textBody).not.toContain("Email verification code:");
  });

  it("requires configured email delivery before creating email-verification shares", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const missingEmail = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        requireEmailVerification: true,
      },
    });
    const missingSmtp = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        notificationEmail: "client@example.test",
        requireEmailVerification: true,
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(missingEmail.statusCode).toBe(400);
    expect(missingEmail.json()).toMatchObject({ message: "Invalid request body" });
    expect(missingSmtp.statusCode).toBe(503);
    expect(missingSmtp.json()).toMatchObject({ code: "SMTP_NOT_CONFIGURED" });
    await expect(
      repository.listShareLinks("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([]);
  });

  it("rejects optional share notification emails without delivery confirmation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    await enableSmtp(repository);
    const server = testServer({ repository, authUser: user("licensee", ["matter-001"]) });

    const response = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        notificationEmail: "client@example.test",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "SEND_CONFIRMATION_REQUIRED" });
    await expect(
      repository.listShareLinks("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([]);
  });

  it("rejects share permissions without implemented public flows", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const server = testServer({ repository });

    const response = await server.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["upload_documents"] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Invalid request body" });
  });

  it("serves public token-scoped document metadata and records access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const authedServer = testServer({ repository });

    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });
    const token = created.json().token;
    const publicServer = testServer({ repository, withAuthHook: false });

    const response = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${token}`,
      headers: { "user-agent": "share-test" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      share: { id: created.json().share.id, permissions: ["view_documents"] },
      documents: [
        {
          id: "doc-shareable-001",
          title: "Client disclosure.pdf",
        },
      ],
    });
    expect(response.json().share).not.toHaveProperty("firmId");
    expect(response.json().share).not.toHaveProperty("matterId");
    expect(response.json().share).not.toHaveProperty("grantedByUserId");
    expect(response.json().documents[0]).not.toHaveProperty("storageKey");

    const headerResponse = await publicServer.inject({
      method: "GET",
      url: "/api/portal/shares",
      headers: { "user-agent": "share-header-test", [PUBLIC_TOKEN_HEADER]: token },
    });
    expect(headerResponse.statusCode).toBe(200);
    expect(headerResponse.json()).toMatchObject({
      share: { id: created.json().share.id, permissions: ["view_documents"] },
      documents: [{ id: "doc-shareable-001" }],
    });

    const accessLogs = await repository.listAccessLogs("firm-west-legal");
    expect(accessLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shareLinkId: created.json().share.id,
          resourceType: "share_link",
          action: "view",
          metadata: { outcome: "granted", documentCount: 1 },
        }),
      ]),
    );
    expect(accessLogs.filter((log) => log.shareLinkId === created.json().share.id)).toHaveLength(2);
  });

  it("rate-limits public share views without leaking token material", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const authedServer = testServer({ repository });
    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });
    const token = created.json<{ token: string }>().token;
    const tokenHash = hashToken(token, jwtSecret);
    const publicServer = testServer({ repository, withAuthHook: false });
    let limited = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${token}`,
    });

    for (let index = 0; index < PUBLIC_TOKEN_VIEW_RATE_LIMIT.max; index += 1) {
      limited = await publicServer.inject({
        method: "GET",
        url: `/api/portal/shares/${token}`,
      });
    }

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests",
    });
    expect(limited.body).not.toContain(token);
    expect(limited.body).not.toContain(tokenHash);
    expect(limited.body).not.toContain("tokenHash");
  });

  it("rate-limits public share email verification without leaking token material", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    await enableSmtp(repository);
    const authedServer = testServer({ repository });
    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        notificationEmail: "client@example.test",
        requireEmailVerification: true,
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    const token = created.json<{ token: string }>().token;
    const tokenHash = hashToken(token, jwtSecret);
    const publicServer = testServer({ repository, withAuthHook: false });
    let limited = await publicServer.inject({
      method: "POST",
      url: `/api/portal/shares/${token}/email-verification`,
      payload: { verificationCode: "WRONG-CODE" },
    });

    for (let index = 0; index < PUBLIC_TOKEN_MUTATION_RATE_LIMIT.max; index += 1) {
      limited = await publicServer.inject({
        method: "POST",
        url: `/api/portal/shares/${token}/email-verification`,
        payload: { verificationCode: "WRONG-CODE" },
      });
    }

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests",
    });
    expect(limited.body).not.toContain(token);
    expect(limited.body).not.toContain(tokenHash);
    expect(limited.body).not.toContain("tokenHash");
  });

  it("blocks revoked share links from public reads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const authedServer = testServer({ repository });
    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: { matterId: "matter-001", permissions: ["view_documents"] },
    });

    const revoked = await authedServer.inject({
      method: "POST",
      url: `/api/shares/${created.json().share.id}/revoke`,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().share.revokedAt).toEqual(expect.any(String));
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "share_link.revoked",
          resourceType: "share_link",
          resourceId: created.json().share.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
          }),
        }),
      ]),
      valid: true,
    });

    const publicServer = testServer({ repository, withAuthHook: false });
    const response = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${created.json().token}`,
    });
    expect(response.statusCode).toBe(404);
    await expect(repository.listAccessLogs("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shareLinkId: created.json().share.id,
          resourceType: "share_link",
          resourceId: created.json().share.id,
          action: "view",
          metadata: { outcome: "revoked" },
        }),
      ]),
    );
  });

  it("hides expired share links from public reads while logging the outcome", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    const token = "expired-share-token-at-least-32-chars";
    await repository.createShareLink({
      id: "share-link-expired",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: hashToken(token, jwtSecret),
      grantedByUserId: "user-admin",
      permissions: ["view_documents"],
      requireEmailVerification: false,
      expiresAt: "2000-01-01T00:00:00.000Z",
      createdAt: "1999-12-31T00:00:00.000Z",
    });

    const publicServer = testServer({ repository, withAuthHook: false });
    const response = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${token}`,
    });

    expect(response.statusCode).toBe(404);
    await expect(repository.listAccessLogs("firm-west-legal")).resolves.toMatchObject([
      expect.objectContaining({
        shareLinkId: "share-link-expired",
        resourceType: "share_link",
        resourceId: "share-link-expired",
        action: "view",
        metadata: { outcome: "expired" },
      }),
    ]);
  });

  it("requires email verification before public share reads while logging the denial", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    await enableSmtp(repository);
    const authedServer = testServer({ repository });
    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        notificationEmail: "client@example.test",
        requireEmailVerification: true,
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    expect(created.statusCode).toBe(201);

    const publicServer = testServer({ repository, withAuthHook: false });
    const response = await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${created.json().token}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Email verification is required for this share link",
    });
    await expect(repository.listAccessLogs("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shareLinkId: created.json().share.id,
          resourceType: "share_link",
          resourceId: created.json().share.id,
          action: "view",
          metadata: { outcome: "email_verification_required" },
        }),
      ]),
    );
  });

  it("completes email verification for a public share without exposing token hashes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await addShareableDocument(repository);
    await enableSmtp(repository);
    const authedServer = testServer({ repository });
    const created = await authedServer.inject({
      method: "POST",
      url: "/api/shares",
      payload: {
        matterId: "matter-001",
        permissions: ["view_documents"],
        notificationEmail: "client@example.test",
        requireEmailVerification: true,
        deliveryConfirmation: deliveryConfirmation(),
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().share).not.toHaveProperty("emailVerificationCodeHash");
    const [stored] = await repository.listShareLinks("firm-west-legal", {
      matterId: "matter-001",
    });
    expect(stored?.emailVerificationCodeHash).toHaveLength(64);
    expect(stored?.emailVerificationExpiresAt).toEqual(expect.any(String));
    const [queuedEmail] = await repository.listEmailOutbox("firm-west-legal");
    const verificationCode = queuedEmail?.textBody.match(
      /Email verification code: ([A-Z0-9]+)/,
    )?.[1];
    expect(verificationCode).toEqual(expect.any(String));
    if (!verificationCode) throw new Error("Expected queued share verification code");

    const publicServer = testServer({ repository, withAuthHook: false });
    await publicServer.inject({
      method: "GET",
      url: `/api/portal/shares/${created.json().token}`,
    });
    const failedVerification = await publicServer.inject({
      method: "POST",
      url: `/api/portal/shares/${created.json().token}/email-verification`,
      payload: { verificationCode: "WRONG-CODE" },
    });
    expect(failedVerification.statusCode).toBe(403);

    const verified = await publicServer.inject({
      method: "POST",
      url: `/api/portal/shares/${created.json().token}/email-verification`,
      headers: { "user-agent": "share-verification-test" },
      payload: { verificationCode },
    });

    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toMatchObject({
      share: {
        id: created.json().share.id,
        permissions: ["view_documents"],
        requireEmailVerification: true,
      },
      documents: [
        {
          id: "doc-shareable-001",
          title: "Client disclosure.pdf",
        },
      ],
    });
    expect(verified.json().share).not.toHaveProperty("tokenHash");
    expect(verified.json().share).not.toHaveProperty("matterId");
    expect(verified.json().documents[0]).not.toHaveProperty("storageKey");

    await expect(repository.listAccessLogs("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shareLinkId: created.json().share.id,
          resourceType: "share_link",
          resourceId: created.json().share.id,
          action: "view",
          metadata: { outcome: "email_verification_required" },
        }),
        expect.objectContaining({
          shareLinkId: created.json().share.id,
          resourceType: "share_link",
          resourceId: created.json().share.id,
          action: "view",
          metadata: {
            outcome: "granted",
            emailVerification: "completed",
            documentCount: 1,
          },
        }),
      ]),
    );
  });
});
