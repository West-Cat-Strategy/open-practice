import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
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

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("document routes", () => {
  it("creates upload intents through the extracted document registrar", async () => {
    const response = await testServer({
      s3: {
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
      },
    }).inject({
      method: "GET",
      url:
        "/api/documents/presign-upload?matterId=matter-001&filename=client retainer!!.pdf" +
        `&checksumSha256=${"a".repeat(64)}&classification=privileged&legalHold=true`,
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
      },
      requiredHeaders: {
        "x-open-practice-malware-scan": "required-before-share",
      },
    });
    expect(response.json<{ storageKey: string }>().storageKey).toMatch(
      /^matters\/matter-001\/.+-client_retainer__.pdf$/,
    );
    expect(response.json<{ uploadUrl: string }>().uploadUrl).toContain(
      "open-practice-test-documents",
    );
    expect(response.json()).not.toHaveProperty("success");
  });

  it("keeps document upload signing disabled when S3 is not configured", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: `/api/documents/presign-upload?matterId=matter-001&filename=retainer.pdf&checksumSha256=${"b".repeat(
        64,
      )}`,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "Error",
      message: "S3 upload signing is not configured",
    });
  });

  it("keeps unauthorized matter access at 403", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: `/api/documents/presign-upload?matterId=matter-002&filename=retainer.pdf&checksumSha256=${"c".repeat(
        64,
      )}`,
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
