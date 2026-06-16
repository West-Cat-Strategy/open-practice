import { S3Client } from "@aws-sdk/client-s3";
import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
const fileSizeBytes = 4096;
const checksumA = "a".repeat(64);

function uploadIntentPayload(input: {
  matterId?: string;
  filename: string;
  checksumSha256?: string;
  classification?: "general" | "privileged" | "settlement" | "identity";
  legalHold?: boolean;
  fileSizeBytes?: number;
}) {
  return {
    matterId: input.matterId ?? "matter-001",
    filename: input.filename,
    checksumSha256: input.checksumSha256 ?? checksumA,
    fileSizeBytes: input.fileSizeBytes ?? fileSizeBytes,
    ...(input.classification ? { classification: input.classification } : {}),
    ...(input.legalHold === undefined ? {} : { legalHold: input.legalHold }),
  };
}

function s3Config(
  checksumSha256 = "a".repeat(64),
  objectExists = true,
  includeChecksum = true,
  contentLength = fileSizeBytes,
  serverSideEncryption?: "AES256",
  reportServerSideEncryption = true,
) {
  const client = new S3Client({
    endpoint: "http://127.0.0.1:9000",
    forcePathStyle: true,
    region: "local",
    credentials: {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
  });
  (
    client as unknown as {
      send: () => Promise<{
        ChecksumSHA256?: string;
        ContentLength?: number;
        ServerSideEncryption?: string;
      }>;
    }
  ).send = async () => {
    if (!objectExists) throw new Error("not found");
    if (!includeChecksum) return { ContentLength: contentLength };
    return {
      ChecksumSHA256: Buffer.from(checksumSha256, "hex").toString("base64"),
      ContentLength: contentLength,
      ...(serverSideEncryption && reportServerSideEncryption
        ? { ServerSideEncryption: serverSideEncryption }
        : {}),
    };
  };
  return {
    bucket: "open-practice-test-documents",
    client,
    serverSideEncryption,
  };
}

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
    ...overrides,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("document routes", () => {
  it("creates upload intents through the extracted document registrar", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({
      repository,
      s3: s3Config(checksumA, true, true, fileSizeBytes, "AES256"),
    }).inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({
        filename: "client retainer!!.pdf",
        checksumSha256: checksumA,
        classification: "privileged",
        legalHold: true,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      method: "PUT",
      expiresInSeconds: 600,
      document: {
        firmId: "firm-west-legal",
        matterId: "matter-001",
        title: "client retainer!!.pdf",
        classification: "privileged",
        legalHold: true,
        uploadStatus: "intent_created",
        sizeBytes: fileSizeBytes,
      },
      requiredHeaders: {
        "x-amz-checksum-sha256": expect.any(String),
        "x-amz-meta-open-practice-size-bytes": String(fileSizeBytes),
        "x-amz-server-side-encryption": "AES256",
        "x-open-practice-malware-scan": "required-before-share",
      },
      maxFileSizeBytes: expect.any(Number),
    });
    expect(response.json<{ storageKey: string }>().storageKey).toMatch(
      /^matters\/matter-001\/.+-client_retainer__.pdf$/,
    );
    expect(response.json<{ uploadUrl: string }>().uploadUrl).toContain(
      "open-practice-test-documents",
    );
    const uploadUrl = new URL(response.json<{ uploadUrl: string }>().uploadUrl);
    const signedHeaders = uploadUrl.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signedHeaders).toContain("content-length");
    expect(signedHeaders).toContain("x-amz-server-side-encryption");
    expect(uploadUrl.searchParams.has("x-amz-server-side-encryption")).toBe(false);
    expect(response.json()).not.toHaveProperty("success");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "document.upload_intent.created",
          resourceType: "document",
          resourceId: response.json<{ document: { id: string } }>().document.id,
          metadata: {
            matterId: "matter-001",
            documentId: response.json<{ document: { id: string } }>().document.id,
            version: 1,
            status: "intent_created",
            checksumStatus: "pending",
            scanStatus: "pending",
            sizeBytes: fileSizeBytes,
          },
        }),
      ]),
      valid: true,
    });
  });

  it("records audit events for upload completion and scan status changes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = "d".repeat(64);
    const server = testServer({
      repository,
      s3: s3Config(checksumSha256, true, true, fileSizeBytes, "AES256"),
    });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({ filename: "retainer.pdf", checksumSha256 }),
    });
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: {
        checksumSha256,
        scanStatus: "passed",
      },
    });
    const scanStatus = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/scan-status`,
      payload: {
        scanStatus: "passed",
      },
    });

    expect(intent.statusCode).toBe(200);
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({
      id: documentId,
      uploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "queued",
    });
    expect(scanStatus.statusCode).toBe(200);
    expect(scanStatus.json()).toMatchObject({
      id: documentId,
      uploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "passed",
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "document.upload.completed",
          resourceType: "document",
          resourceId: documentId,
          metadata: {
            matterId: "matter-001",
            documentId,
            version: 1,
            status: "verified",
            checksumStatus: "verified",
            scanStatus: "queued",
          },
        }),
        expect.objectContaining({
          action: "document.scan_status.updated",
          resourceType: "document",
          resourceId: documentId,
          metadata: {
            matterId: "matter-001",
            documentId,
            version: 1,
            status: "verified",
            checksumStatus: "verified",
            scanStatus: "passed",
          },
        }),
      ]),
      valid: true,
    });
  });

  it("rejects upload completion when the object cannot be verified in storage", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = "e".repeat(64);
    const server = testServer({ repository, s3: s3Config(checksumSha256, false) });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({ filename: "missing.pdf", checksumSha256 }),
    });
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: { checksumSha256 },
    });

    expect(completed.statusCode).toBe(409);
    expect(completed.json()).toMatchObject({
      message: "Uploaded object was not found. Complete the upload before marking it complete.",
    });
  });

  it("rejects upload completion when storage cannot return a checksum", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = "f".repeat(64);
    const server = testServer({ repository, s3: s3Config(checksumSha256, true, false) });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({ filename: "missing-checksum.pdf", checksumSha256 }),
    });
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: { checksumSha256 },
    });

    expect(completed.statusCode).toBe(409);
    expect(completed.json()).toMatchObject({
      message: "Uploaded object checksum was not available for verification.",
    });
  });

  it("rejects upload completion when the storage checksum does not match the request", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = checksumA;
    const server = testServer({ repository, s3: s3Config("b".repeat(64)) });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({ filename: "mismatch.pdf", checksumSha256 }),
    });
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: { checksumSha256 },
    });

    expect(completed.statusCode).toBe(400);
    expect(completed.json()).toMatchObject({
      message: "Uploaded object checksum did not match the expected SHA-256 digest.",
    });
  });

  it("rejects upload completion when the storage size does not match the intent", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = checksumA;
    const server = testServer({
      repository,
      s3: s3Config(checksumSha256, true, true, fileSizeBytes + 1),
    });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({ filename: "size-mismatch.pdf", checksumSha256 }),
    });
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: { checksumSha256 },
    });

    expect(completed.statusCode).toBe(400);
    expect(completed.json()).toMatchObject({
      code: "UPLOAD_SIZE_MISMATCH",
      message: "Uploaded object size did not match the expected byte count.",
      details: { expectedSizeBytes: fileSizeBytes, actualSizeBytes: fileSizeBytes + 1 },
    });
  });

  it("rejects upload completion when configured storage encryption is missing", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = checksumA;
    const server = testServer({
      repository,
      s3: s3Config(checksumSha256, true, true, fileSizeBytes, "AES256", false),
    });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({ filename: "unencrypted.pdf", checksumSha256 }),
    });
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: { checksumSha256 },
    });

    expect(intent.statusCode).toBe(200);
    expect(completed.statusCode).toBe(409);
    expect(completed.json()).toMatchObject({
      code: "UPLOAD_ENCRYPTION_MISMATCH",
      message:
        "Uploaded object encryption did not match the configured server-side encryption setting.",
    });
  });

  it("keeps document upload signing disabled when S3 is not configured", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({
        filename: "retainer.pdf",
        checksumSha256: "b".repeat(64),
      }),
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      code: "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
      message: "S3 upload signing is not configured",
    });
  });

  it("keeps unauthorized matter access at 403", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({
        matterId: "matter-002",
        filename: "retainer.pdf",
        checksumSha256: "c".repeat(64),
      }),
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Document access required",
    });
  });

  it("denies upload completion when the stored document belongs to an unassigned matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checksumSha256 = "c".repeat(64);
    const server = testServer({
      repository,
      s3: s3Config(checksumSha256, true, true, fileSizeBytes, "AES256"),
    });
    const intent = await server.inject({
      method: "POST",
      url: "/api/documents/upload-intents",
      payload: uploadIntentPayload({
        matterId: "matter-002",
        filename: "other-matter.pdf",
        checksumSha256,
      }),
    });
    expect(intent.statusCode).toBe(200);
    const documentId = intent.json<{ document: { id: string } }>().document.id;

    const completed = await server.inject({
      method: "POST",
      url: `/api/documents/${documentId}/upload-complete`,
      payload: { checksumSha256 },
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(completed.statusCode).toBe(403);
    expect(completed.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Document access required",
    });
  });

  it("returns 405 for the legacy GET upload intent route without creating an intent", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({
      repository,
      s3: s3Config(checksumA, true, true, fileSizeBytes, "AES256"),
    }).inject({
      method: "GET",
      url: `/api/documents/presign-upload?matterId=matter-001&filename=legacy.pdf&checksumSha256=${checksumA}&fileSizeBytes=${fileSizeBytes}`,
    });

    expect(response.statusCode).toBe(405);
    expect(response.json()).toMatchObject({
      error: "MethodNotAllowed",
      message: "Use POST /api/documents/upload-intents",
    });
    await expect(repository.listMatterDocuments("firm-west-legal", "matter-001")).resolves.toEqual(
      expect.not.arrayContaining([expect.objectContaining({ title: "legacy.pdf" })]),
    );
  });

  it("returns legacy top-level error shape for invalid document requests", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/doc-001/scan-status",
      payload: {
        scanStatus: "unknown",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(response.json()).not.toHaveProperty("success");
  });
});
