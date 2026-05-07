import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { hashToken } from "../http/auth-helpers.js";
import { createApiServer } from "../server.js";

const jwtSecret = "test-external-upload-secret-at-least-32-chars";
const checksum = "d".repeat(64);
const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
const emailJobQueue = {
  async add(_name: string, _data: unknown, options?: { jobId?: string }) {
    return { id: options?.jobId ?? "email-job-test" };
  },
};

function deliveryConfirmation(recipientCount = 1) {
  return { confirmed: true, channel: "email", recipientCount };
}

function s3Config(): NonNullable<CreateServerOptions["s3"]> {
  return {
    bucket: "open-practice-test-documents",
    client: new S3Client({
      endpoint: "http://127.0.0.1:9000",
      forcePathStyle: true,
      region: "local",
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      },
    }),
  };
}

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    jwtSecret,
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
  return { repository, server };
}

async function createDirectToken(input: {
  repository: InMemoryOpenPracticeRepository;
  id: string;
  expiresAt: string;
  maxUploads?: number;
  usedUploads?: number;
  revokedAt?: string;
  matterId?: string;
}): Promise<string> {
  const token = `${input.id}-opaque-token`;
  await input.repository.createExternalUploadLink({
    id: input.id,
    firmId: "firm-west-legal",
    matterId: input.matterId ?? "matter-001",
    tokenHash: hashToken(token, jwtSecret),
    requestedByUserId: "user-admin",
    expiresAt: input.expiresAt,
    maxUploads: input.maxUploads ?? 1,
    usedUploads: input.usedUploads ?? 0,
    createdAt: "2026-04-29T12:00:00.000Z",
    revokedAt: input.revokedAt,
  });
  return token;
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

describe("external upload routes", () => {
  it("creates, lists, and revokes sanitized matter-scoped upload links", async () => {
    const { repository, server } = testServer({ s3: s3Config() });

    const created = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-001",
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxUploads: 2,
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      upload: {
        matterId: "matter-001",
        maxUploads: 2,
        usedUploads: 0,
        status: "active",
      },
      token: expect.any(String),
    });
    expect(created.json().upload).not.toHaveProperty("tokenHash");

    const listed = await server.inject({
      method: "GET",
      url: "/api/external-uploads?matterId=matter-001",
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      uploads: [expect.objectContaining({ id: created.json().upload.id })],
    });
    expect(listed.json().uploads[0]).not.toHaveProperty("tokenHash");

    const revoked = await server.inject({
      method: "POST",
      url: `/api/external-uploads/${created.json().upload.id}/revoke`,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({
      upload: { id: created.json().upload.id, status: "revoked" },
    });

    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "external_upload.created",
          resourceType: "external_upload",
          resourceId: created.json().upload.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            expiresAt: "2099-01-01T00:00:00.000Z",
            maxUploads: 2,
          }),
        }),
        expect.objectContaining({
          action: "external_upload.revoked",
          resourceType: "external_upload",
          resourceId: created.json().upload.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("keeps creation disabled when signing or S3 is unavailable", async () => {
    const withoutSigning = testServer({ jwtSecret: undefined, s3: s3Config() });
    const signingResponse = await withoutSigning.server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: { matterId: "matter-001" },
    });
    expect(signingResponse.statusCode).toBe(503);
    expect(signingResponse.json()).toMatchObject({
      message: "External upload token signing is not configured",
    });

    const withoutS3 = testServer({ jwtSecret });
    const s3Response = await withoutS3.server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: { matterId: "matter-001" },
    });
    expect(s3Response.statusCode).toBe(503);
    expect(s3Response.json()).toMatchObject({
      message: "S3 upload signing is not configured",
    });
  });

  it("queues optional upload-link notifications while the raw token is available", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableSmtp(repository);
    const { server } = testServer({ repository, s3: s3Config() });

    const created = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-001",
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxUploads: 2,
        notificationEmail: "client@example.test",
        deliveryConfirmation: deliveryConfirmation(),
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      queuedEmail: {
        templateKey: "external_upload.created",
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
            templateKey: "external_upload.created",
            recipientCount: 1,
            relatedResourceType: "external_upload",
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
            templateKey: "external_upload.created",
            provider: "mailpit",
            recipientCount: 1,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("replays external upload creation without returning another raw token or notification job", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await enableSmtp(repository);
    const queuedJobs: string[] = [];
    const replayEmailQueue = {
      async add(_name: string, _data: unknown, options?: { jobId?: string }) {
        queuedJobs.push(options?.jobId ?? "email-job-test");
        return { id: options?.jobId ?? "email-job-test" };
      },
    };
    const { server } = testServer({
      repository,
      s3: s3Config(),
      emailJobQueue: replayEmailQueue,
    });
    const payload = {
      matterId: "matter-001",
      expiresAt: "2099-01-01T00:00:00.000Z",
      maxUploads: 2,
      notificationEmail: "client@example.test",
      idempotencyKey: "external-upload-replay-key",
      deliveryConfirmation: deliveryConfirmation(),
    };

    const first = await server.inject({ method: "POST", url: "/api/external-uploads", payload });
    const replay = await server.inject({ method: "POST", url: "/api/external-uploads", payload });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().upload.id).toBe(first.json().upload.id);
    expect(first.json().token).toEqual(expect.any(String));
    expect(replay.json()).not.toHaveProperty("token");
    expect(replay.json()).toMatchObject({ created: false });
    expect(replay.json()).not.toHaveProperty("queuedEmail");
    expect(queuedJobs).toHaveLength(1);
    await expect(
      repository.listExternalUploadLinks("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toHaveLength(1);
  });

  it("rejects optional upload notifications without delivery confirmation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { server } = testServer({ repository, s3: s3Config() });
    await enableSmtp(repository);

    const response = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-001",
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxUploads: 2,
        notificationEmail: "client@example.test",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "SEND_CONFIRMATION_REQUIRED" });
    await expect(
      repository.listExternalUploadLinks("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([]);
  });

  it("rejects external upload idempotency key reuse with changed payload", async () => {
    const { server } = testServer({ s3: s3Config() });
    const payload = {
      matterId: "matter-001",
      expiresAt: "2099-01-01T00:00:00.000Z",
      maxUploads: 2,
      idempotencyKey: "external-upload-conflict-key",
    };

    await server.inject({ method: "POST", url: "/api/external-uploads", payload });
    const conflict = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: { ...payload, maxUploads: 3 },
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: "IDEMPOTENCY_KEY_CONFLICT" });
  });

  it("enforces matter scope before creating links", async () => {
    const { server } = testServer({ s3: s3Config() });

    const response = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        matterId: "matter-002",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ message: "External upload access required" });
  });

  it("enforces matter scope before listing or revoking links", async () => {
    const { server } = testServer({ s3: s3Config() });
    const created = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-002",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });
    expect(created.statusCode).toBe(200);

    const limitedUserHeaders = {
      "x-open-practice-user-id": "user-licensee",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const listed = await server.inject({
      method: "GET",
      url: "/api/external-uploads?matterId=matter-002",
      headers: limitedUserHeaders,
    });
    expect(listed.statusCode).toBe(403);
    expect(listed.json()).toMatchObject({ message: "External upload access required" });

    const revoked = await server.inject({
      method: "POST",
      url: `/api/external-uploads/${created.json().upload.id}/revoke`,
      headers: limitedUserHeaders,
    });
    expect(revoked.statusCode).toBe(403);
    expect(revoked.json()).toMatchObject({ message: "External upload access required" });
  });

  it("creates public token-scoped upload intents and completes matching documents", async () => {
    const { repository, server } = testServer({ s3: s3Config() });
    const created = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-001",
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxUploads: 1,
      },
    });
    const token = created.json().token as string;

    const intent = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${token}/intents`,
      payload: {
        filename: "external evidence.pdf",
        checksumSha256: checksum,
        classification: "general",
        supersedesDocumentId: "doc-001",
      },
      headers: { "user-agent": "external-upload-test" },
    });

    expect(intent.statusCode).toBe(200);
    expect(intent.json()).toMatchObject({
      method: "PUT",
      expiresInSeconds: 600,
      document: {
        title: "external evidence.pdf",
        uploadStatus: "intent_created",
        checksumStatus: "pending",
        reviewStatus: "pending_review",
      },
    });
    expect(intent.json()).not.toHaveProperty("storageKey");
    expect(intent.json().document).not.toHaveProperty("storageKey");
    expect(intent.json().document).not.toHaveProperty("supersedesDocumentId");
    expect(intent.json().uploadUrl).toContain("open-practice-test-documents");
    await expect(repository.getDocument("firm-west-legal", "doc-001")).resolves.not.toHaveProperty(
      "supersededAt",
    );
    const externalDocument = await repository.getDocument(
      "firm-west-legal",
      intent.json().document.id,
    );
    expect(externalDocument?.version).toBe(1);
    expect(externalDocument?.supersedesDocumentId).toBeUndefined();
    expect(externalDocument?.reviewStatus).toBe("pending_review");

    const listedWithDocument = await server.inject({
      method: "GET",
      url: "/api/external-uploads?matterId=matter-001",
    });
    expect(listedWithDocument.statusCode).toBe(200);
    expect(listedWithDocument.json()).toMatchObject({
      reviewItems: [
        expect.objectContaining({
          id: intent.json().document.id,
          externalUploadLinkId: created.json().upload.id,
          reviewStatus: "pending_review",
          accessLogProof: expect.objectContaining({
            total: expect.any(Number),
            outcomes: expect.arrayContaining(["intent_created"]),
          }),
        }),
      ],
    });

    const complete = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${token}/documents/${intent.json().document.id}/complete`,
      payload: { checksumSha256: checksum, scanStatus: "passed" },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json()).toMatchObject({
      document: {
        id: intent.json().document.id,
        uploadStatus: "verified",
        checksumStatus: "verified",
        scanStatus: "queued",
        reviewStatus: "pending_review",
      },
    });

    const reviewed = await server.inject({
      method: "PATCH",
      url: `/api/external-uploads/documents/${intent.json().document.id}/review`,
      payload: {
        decision: "accept",
        note: "Reviewed\twith synthetic metadata\nonly",
      },
      headers: { "user-agent": "external-upload-review-test" },
    });
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json()).toMatchObject({
      reviewItem: {
        id: intent.json().document.id,
        reviewStatus: "accepted",
        reviewDecision: "accept",
        reviewMetadata: {
          decision: "accept",
          status: "accepted",
          note: "Reviewed with synthetic metadata only",
        },
      },
    });

    await expect(
      repository.listAccessLogs("firm-west-legal", {
        externalUploadLinkId: created.json().upload.id,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "upload",
          metadata: expect.objectContaining({ outcome: "intent_created" }),
        }),
        expect.objectContaining({
          action: "upload",
          metadata: expect.objectContaining({ outcome: "verified" }),
        }),
        expect.objectContaining({
          action: "upload",
          actorId: "user-admin",
          userAgent: "external-upload-review-test",
          metadata: expect.objectContaining({
            outcome: "document_reviewed",
            decision: "accept",
            status: "accepted",
          }),
        }),
      ]),
    );
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "external_upload.document_reviewed",
          resourceType: "document",
          resourceId: intent.json().document.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            matterIds: ["matter-001"],
            externalUploadLinkId: created.json().upload.id,
            decision: "accept",
            status: "accepted",
            noteLength: 37,
            requestId: expect.any(String),
            actorId: "user-admin",
            workflowStatus: "succeeded",
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("flags duplicate uploads for review while preserving the original duplicate pointer", async () => {
    const { repository, server } = testServer({ s3: s3Config() });
    const originalCreated = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-001",
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxUploads: 1,
      },
    });
    const originalIntent = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${originalCreated.json().token}/intents`,
      payload: {
        filename: "original.pdf",
        checksumSha256: checksum,
      },
    });
    await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${originalCreated.json().token}/documents/${originalIntent.json().document.id}/complete`,
      payload: { checksumSha256: checksum },
    });

    const duplicateCreated = await server.inject({
      method: "POST",
      url: "/api/external-uploads",
      payload: {
        matterId: "matter-001",
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxUploads: 1,
      },
    });
    const duplicateIntent = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${duplicateCreated.json().token}/intents`,
      payload: {
        filename: "duplicate.pdf",
        checksumSha256: checksum,
      },
    });
    const duplicateComplete = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${duplicateCreated.json().token}/documents/${duplicateIntent.json().document.id}/complete`,
      payload: { checksumSha256: checksum },
    });

    expect(duplicateComplete.statusCode).toBe(200);
    expect(duplicateComplete.json()).toMatchObject({
      document: {
        checksumStatus: "duplicate",
        reviewStatus: "pending_review",
        reviewReason: "duplicate",
      },
    });

    const reviewedDuplicate = await server.inject({
      method: "PATCH",
      url: `/api/external-uploads/documents/${duplicateIntent.json().document.id}/review`,
      payload: {
        decision: "accept",
        duplicateOfDocumentId: originalIntent.json().document.id,
      },
    });
    expect(reviewedDuplicate.statusCode).toBe(200);
    expect(reviewedDuplicate.json()).toMatchObject({
      reviewItem: {
        id: duplicateIntent.json().document.id,
        duplicateOfDocumentId: originalIntent.json().document.id,
        reviewStatus: "accepted",
        reviewDecision: "accept",
        reviewReason: "duplicate",
      },
    });
    await expect(
      repository.getDocument("firm-west-legal", duplicateIntent.json().document.id),
    ).resolves.toMatchObject({
      duplicateOfDocumentId: originalIntent.json().document.id,
      reviewStatus: "accepted",
    });
  });

  it("matter-scopes upload review decisions and keeps discard as a preserved state", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { server } = testServer({ repository, s3: s3Config() });
    const token = await createDirectToken({
      repository,
      id: "external-upload-review-matter-002",
      matterId: "matter-002",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const intent = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${token}/intents`,
      payload: { filename: "matter-two.pdf", checksumSha256: checksum },
    });
    expect(intent.statusCode).toBe(200);

    const limited = await server.inject({
      method: "PATCH",
      url: `/api/external-uploads/documents/${intent.json().document.id}/review`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { decision: "discard" },
    });
    expect(limited.statusCode).toBe(403);

    const discarded = await server.inject({
      method: "PATCH",
      url: `/api/external-uploads/documents/${intent.json().document.id}/review`,
      payload: { decision: "discard", reason: "wrong_matter" },
    });
    expect(discarded.statusCode).toBe(200);
    expect(discarded.json()).toMatchObject({
      reviewItem: {
        id: intent.json().document.id,
        reviewStatus: "discarded",
        reviewDecision: "discard",
        reviewReason: "wrong_matter",
      },
    });
    await expect(
      repository.getDocument("firm-west-legal", intent.json().document.id),
    ).resolves.toMatchObject({
      id: intent.json().document.id,
      storageKey: expect.stringContaining("external-upload-review-matter-002"),
      reviewStatus: "discarded",
    });
  });

  it("rejects exhausted, revoked, expired, and wrong-scope public uploads", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { server } = testServer({ repository, s3: s3Config() });
    const expiredToken = await createDirectToken({
      repository,
      id: "external-upload-expired",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    const revokedToken = await createDirectToken({
      repository,
      id: "external-upload-revoked",
      expiresAt: "2099-01-01T00:00:00.000Z",
      revokedAt: "2026-04-29T12:00:00.000Z",
    });
    const exhaustedToken = await createDirectToken({
      repository,
      id: "external-upload-exhausted",
      expiresAt: "2099-01-01T00:00:00.000Z",
      maxUploads: 1,
      usedUploads: 1,
    });

    for (const token of [expiredToken, revokedToken, exhaustedToken]) {
      const response = await server.inject({
        method: "POST",
        url: `/api/portal/external-uploads/${token}/intents`,
        payload: { filename: "blocked.pdf", checksumSha256: checksum },
        headers: { "user-agent": "external-upload-denial-test" },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        message: "External upload link is not available",
      });
    }
    await expect(repository.listAccessLogs("firm-west-legal")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalUploadLinkId: "external-upload-expired",
          resourceType: "external_upload_link",
          resourceId: "external-upload-expired",
          action: "upload",
          userAgent: "external-upload-denial-test",
          metadata: { outcome: "denied", reason: "expired" },
        }),
        expect.objectContaining({
          externalUploadLinkId: "external-upload-revoked",
          resourceType: "external_upload_link",
          resourceId: "external-upload-revoked",
          action: "upload",
          userAgent: "external-upload-denial-test",
          metadata: { outcome: "denied", reason: "revoked" },
        }),
        expect.objectContaining({
          externalUploadLinkId: "external-upload-exhausted",
          resourceType: "external_upload_link",
          resourceId: "external-upload-exhausted",
          action: "upload",
          userAgent: "external-upload-denial-test",
          metadata: { outcome: "denied", reason: "upload_limit" },
        }),
      ]),
    );

    const validToken = await createDirectToken({
      repository,
      id: "external-upload-valid",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const wrongScope = await server.inject({
      method: "POST",
      url: `/api/portal/external-uploads/${validToken}/documents/doc-001/complete`,
      payload: { checksumSha256: checksum, scanStatus: "passed" },
    });
    expect(wrongScope.statusCode).toBe(403);
    expect(wrongScope.json()).toMatchObject({
      message: "External upload link is not available",
    });
  });
});
