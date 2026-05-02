import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerDocumentProcessingRoutes } from "./document-processing.js";
import type { ApiJobQueue } from "./types.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  return {
    id: `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function fakeOcrQueue() {
  const jobs: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const queue: ApiJobQueue = {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "bull-ocr-job" };
    },
  };
  return { queue, jobs };
}

function testServer(
  input: {
    repository?: InMemoryOpenPracticeRepository;
    authUser?: User;
    ocrJobQueue?: ApiJobQueue;
  } = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerDocumentProcessingRoutes(server, {
    repository,
    ocrJobQueue: input.ocrJobQueue,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("document processing routes", () => {
  it("reports disabled providers, worker queue availability, and redacted job summaries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-ocr-disabled",
      firmId,
      kind: "ocr",
      key: "local-tesseract",
      enabled: false,
      encryptedConfig: "synthetic-disabled-config",
      createdAt: "2026-05-02T09:00:00.000Z",
      updatedAt: "2026-05-02T09:00:00.000Z",
    });
    await repository.createJobLifecycleRecord({
      id: "job-ocr-dead",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "dead_letter",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 3,
      maxAttempts: 3,
      queuedAt: "2026-05-02T09:10:00.000Z",
      failedAt: "2026-05-02T09:12:00.000Z",
      errorMessage: "Synthetic OCR provider unavailable",
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        providerConfigured: false,
        content: "Do not return document text",
        storageKey: "matters/matter-001/doc-001.pdf",
      },
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/document-processing/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "provider_disabled",
      workerQueues: expect.arrayContaining([
        { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
      ]),
      providerStatus: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          status: "disabled",
          reason: "provider_disabled",
          providers: [
            {
              key: "local-tesseract",
              enabled: false,
              updatedAt: "2026-05-02T09:00:00.000Z",
            },
          ],
        }),
      ]),
      summary: {
        total: 1,
        failed: 1,
        terminal: 1,
      },
      jobs: [
        expect.objectContaining({
          id: "job-ocr-dead",
          queueName: "ocr",
          status: "dead_letter",
          failed: true,
          terminal: true,
          retryable: false,
          metadata: {
            matterId: "matter-001",
            documentId: "doc-001",
            task: "ocr",
            providerConfigured: false,
          },
        }),
      ],
    });
    expect(response.json().jobs[0].metadata).not.toHaveProperty("content");
    expect(response.json().jobs[0].metadata).not.toHaveProperty("storageKey");
  });

  it("queues OCR jobs with durable redacted lifecycle metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeOcrQueue();
    const response = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "queued",
      task: "ocr",
      language: "eng",
      documentId: "doc-001",
      job: {
        queueName: "ocr",
        jobName: "extract_document_text",
        status: "queued",
        targetResourceType: "document",
        targetResourceId: "doc-001",
        language: "eng",
        bullJobId: expect.any(String),
      },
    });
    expect(payload).not.toHaveProperty("document");
    expect(jobs).toEqual([
      {
        name: "extract_document_text",
        data: expect.objectContaining({
          firmId,
          resourceType: "document",
          resourceId: "doc-001",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-001",
            jobId: payload.job.id,
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "passed",
          }),
        }),
        jobId: payload.job.id,
      },
    ]);
    await expect(repository.listJobLifecycleRecords(firmId, { queueName: "ocr" })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: payload.job.id,
          status: "queued",
          bullJobId: payload.job.id,
          metadata: {
            matterId: "matter-001",
            documentId: "doc-001",
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "passed",
          },
        }),
      ]),
    );
    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "document_processing.ocr.queued",
          resourceId: "doc-001",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-001",
            jobId: payload.job.id,
            bullJobId: payload.job.id,
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "passed",
          }),
        }),
      ]),
    );
    const queueMetadata = jobs[0]?.data as { metadata?: Record<string, unknown> };
    const auditMetadata = audit.events.find(
      (event) => event.action === "document_processing.ocr.queued",
    )?.metadata;
    for (const metadata of [queueMetadata.metadata, auditMetadata]) {
      expect(metadata).toBeDefined();
      expect(metadata).not.toHaveProperty("storageKey");
      expect(metadata).not.toHaveProperty("checksumSha256");
      expect(metadata).not.toHaveProperty("content");
    }
  });

  it("returns 503 when the OCR queue is not configured", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR queue is not configured" });
  });

  it("allows duplicate-checksum verified documents to queue OCR", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeOcrQueue();
    await repository.createDocumentUploadIntent({
      id: "doc-duplicate",
      firmId,
      matterId: "matter-001",
      title: "Duplicate retainer.pdf",
      storageKey: "matters/matter-001/doc-duplicate.pdf",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      classification: "general",
      legalHold: false,
    });
    const duplicate = await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-duplicate",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    });
    expect(duplicate.checksumStatus).toBe("duplicate");

    const response = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-duplicate/queue",
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      documentId: "doc-duplicate",
      job: { targetResourceId: "doc-duplicate" },
    });
    expect(jobs[0]?.data).toEqual(
      expect.objectContaining({
        resourceId: "doc-duplicate",
        metadata: expect.objectContaining({ checksumStatus: "duplicate" }),
      }),
    );
  });

  it("rejects cross-matter and unverified document processing", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue } = fakeOcrQueue();
    const wrongMatter = await testServer({
      repository,
      ocrJobQueue: queue,
      authUser: user("licensee", ["matter-002"]),
    }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
    });
    expect(wrongMatter.statusCode).toBe(403);

    const intent = await repository.createDocumentUploadIntent({
      id: "doc-unverified",
      firmId,
      matterId: "matter-001",
      title: "Unverified upload.pdf",
      storageKey: "matters/matter-001/doc-unverified.pdf",
      checksumSha256: "b".repeat(64),
      classification: "general",
      legalHold: false,
    });
    expect(intent.uploadStatus).toBe("intent_created");
    const unverified = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-unverified/queue",
    });
    expect(unverified.statusCode).toBe(409);

    await repository.createDocumentUploadIntent({
      id: "doc-rejected",
      firmId,
      matterId: "matter-001",
      title: "Rejected upload.pdf",
      storageKey: "matters/matter-001/doc-rejected.pdf",
      checksumSha256: "c".repeat(64),
      classification: "general",
      legalHold: false,
    });
    const rejected = await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-rejected",
      checksumSha256: "d".repeat(64),
    });
    expect(rejected.uploadStatus).toBe("rejected");
    expect(rejected.checksumStatus).toBe("mismatch");
    const rejectedQueue = await testServer({ repository, ocrJobQueue: queue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-rejected/queue",
    });
    expect(rejectedQueue.statusCode).toBe(409);
  });
});
