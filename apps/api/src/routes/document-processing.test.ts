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
  it("reports OCR-only actionable defaults when no document provider is configured", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/document-processing/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
      actionableTasks: ["ocr"],
      reservedTasks: expect.arrayContaining([
        expect.objectContaining({ task: "classification", queueName: "ai_triage" }),
        expect.objectContaining({ task: "transcription", queueName: "transcription" }),
        expect.objectContaining({ task: "media", queueName: "media" }),
      ]),
      workerQueues: expect.arrayContaining([
        expect.objectContaining({
          queueName: "ai_triage",
          status: "reserved",
          reason: "deferred_worker",
        }),
        expect.objectContaining({
          queueName: "ocr",
          status: "not_configured",
        }),
      ]),
    });
  });

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
        {
          queueName: "ai_triage",
          status: "reserved",
          reason: "deferred_worker",
          task: "classification",
          actionable: false,
        },
        {
          queueName: "ocr",
          status: "not_configured",
          reason: "queue_not_configured",
        },
        {
          queueName: "transcription",
          status: "reserved",
          reason: "deferred_worker",
          task: "transcription",
          actionable: false,
        },
        {
          queueName: "media",
          status: "reserved",
          reason: "deferred_worker",
          task: "media",
          actionable: false,
        },
      ]),
      reservedQueues: expect.arrayContaining([
        expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
        expect.objectContaining({ queueName: "transcription", status: "reserved" }),
        expect.objectContaining({ queueName: "media", status: "reserved" }),
      ]),
      supportedTasks: ["malware_scan", "ocr", "classification", "transcription", "media"],
      actionableTasks: ["ocr"],
      reservedTasks: expect.arrayContaining([
        expect.objectContaining({
          task: "classification",
          queueName: "ai_triage",
          status: "reserved",
        }),
        expect.objectContaining({
          task: "transcription",
          queueName: "transcription",
          status: "reserved",
        }),
        expect.objectContaining({ task: "media", queueName: "media", status: "reserved" }),
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
          metadata: expect.objectContaining({
            matterId: "matter-001",
            documentId: "doc-001",
            task: "ocr",
            language: "eng",
            checksumStatus: "verified",
            scanStatus: "passed",
          }),
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
            requestId: expect.any(String),
            actorType: "owner_admin",
            actorId: "user-owner_admin",
            matterId: "matter-001",
            matterIds: ["matter-001"],
            workflowStatus: "queued",
            beforeStatus: "passed",
            expectedStatus: "queued",
            afterStatus: "queued",
            attemptNumber: 0,
            maxAttempts: 3,
            idempotencyKeyPresent: true,
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
    expect(auditMetadata).not.toHaveProperty("documentId");
    expect(auditMetadata).not.toHaveProperty("jobId");
    expect(auditMetadata).not.toHaveProperty("bullJobId");
    expect(auditMetadata).not.toHaveProperty("task");
    expect(auditMetadata).not.toHaveProperty("language");
    expect(auditMetadata).not.toHaveProperty("checksumStatus");
    expect(auditMetadata).not.toHaveProperty("scanStatus");
  });

  it("returns a matter-scoped sanitized document processing workbench", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertProviderSetting({
      id: "provider-ocr-enabled",
      firmId,
      kind: "ocr",
      key: "local-tesseract",
      enabled: true,
      encryptedConfig: "synthetic-config-not-returned",
      createdAt: "2026-05-02T12:00:00.000Z",
      updatedAt: "2026-05-02T12:00:00.000Z",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-matter-002",
      firmId,
      matterId: "matter-002",
      title: "Other matter record.pdf",
      storageKey: "matters/matter-002/other.pdf",
      checksumSha256: "e".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-matter-002",
      checksumSha256: "e".repeat(64),
      scanStatus: "passed",
    });
    await repository.createJobLifecycleRecord({
      id: "job-doc-001-active",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      bullJobId: "bull-doc-001",
      status: "active",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T12:10:00.000Z",
      startedAt: "2026-05-02T12:10:05.000Z",
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        language: "eng",
        storageKey: "matters/matter-001/private.pdf",
        providerPayload: { private: true },
      },
    });
    await repository.createJobLifecycleRecord({
      id: "job-other-matter",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "queued",
      targetResourceType: "document",
      targetResourceId: "doc-matter-002",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-02T12:15:00.000Z",
      metadata: { matterId: "matter-002", documentId: "doc-matter-002", task: "ocr" },
    });
    await repository.createDocumentTextExtraction({
      id: "extraction-doc-001",
      firmId,
      documentId: "doc-001",
      engine: "tesseract",
      status: "completed",
      language: "eng",
      confidence: 0.93,
      textStorageKey: "matters/matter-001/doc-001.txt",
      extractedText: "Synthetic private extracted text that must not leave the server.",
      metadata: {
        language: "eng",
        textLength: 243,
        storageKey: "matters/matter-001/doc-001.txt",
        token: "private-token",
        providerPayload: { private: true },
      },
      createdAt: "2026-05-02T12:11:00.000Z",
      completedAt: "2026-05-02T12:12:00.000Z",
    });

    const response = await testServer({ repository, ocrJobQueue: fakeOcrQueue().queue }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      matterId: "matter-001",
      status: "configured",
      providerStatus: expect.arrayContaining([
        expect.objectContaining({
          kind: "ocr",
          status: "configured",
          providers: [
            {
              key: "local-tesseract",
              enabled: true,
              updatedAt: "2026-05-02T12:00:00.000Z",
            },
          ],
        }),
      ]),
      workerQueues: expect.arrayContaining([{ queueName: "ocr", status: "configured" }]),
      reservedQueues: expect.arrayContaining([
        expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
        expect.objectContaining({ queueName: "transcription", status: "reserved" }),
        expect.objectContaining({ queueName: "media", status: "reserved" }),
      ]),
      actionableTasks: ["ocr"],
      reservedTasks: expect.arrayContaining([
        expect.objectContaining({ task: "classification", queueName: "ai_triage" }),
        expect.objectContaining({ task: "transcription", queueName: "transcription" }),
        expect.objectContaining({ task: "media", queueName: "media" }),
      ]),
      summary: {
        total: 1,
        active: 1,
      },
      reviewQueue: {
        needsReviewCount: 0,
        duplicateCandidateCount: 0,
        supersessionCount: 0,
        failedScanCount: 0,
      },
      documents: [
        expect.objectContaining({
          group: "queued_or_active",
          queueEligibility: { eligible: false, reason: "already_queued_or_active" },
          document: {
            id: "doc-001",
            matterId: "matter-001",
            title: "Retainer agreement.pdf",
            version: 1,
            classification: "privileged",
            legalHold: true,
            uploadStatus: "verified",
            checksumStatus: "verified",
            scanStatus: "passed",
            reviewStatus: "not_required",
            uploadedAt: "2026-04-01T20:15:00.000Z",
            verifiedAt: "2026-04-01T20:16:00.000Z",
          },
          latestJob: expect.objectContaining({
            id: "job-doc-001-active",
            status: "active",
            terminal: false,
            retryable: false,
            metadata: {
              matterId: "matter-001",
              documentId: "doc-001",
              task: "ocr",
              language: "eng",
            },
          }),
          latestExtraction: {
            id: "extraction-doc-001",
            engine: "tesseract",
            status: "completed",
            language: "eng",
            confidence: 0.93,
            createdAt: "2026-05-02T12:11:00.000Z",
            completedAt: "2026-05-02T12:12:00.000Z",
            metadata: {
              language: "eng",
              textLength: 243,
            },
          },
        }),
      ],
    });
    const documentItem = response.json().documents[0];
    expect(documentItem.document).not.toHaveProperty("firmId");
    expect(documentItem.document).not.toHaveProperty("storageKey");
    expect(documentItem.document).not.toHaveProperty("checksumSha256");
    expect(documentItem.document).not.toHaveProperty("reviewMetadata");
    expect(documentItem.latestJob.metadata).not.toHaveProperty("storageKey");
    expect(documentItem.latestJob.metadata).not.toHaveProperty("providerPayload");
    expect(documentItem.latestExtraction).not.toHaveProperty("extractedText");
    expect(documentItem.latestExtraction).not.toHaveProperty("textStorageKey");
    expect(documentItem.latestExtraction.metadata).not.toHaveProperty("storageKey");
    expect(documentItem.latestExtraction.metadata).not.toHaveProperty("token");
    expect(documentItem.latestExtraction.metadata).not.toHaveProperty("providerPayload");
  });

  it("summarizes visible document review queue states without cross-matter counts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createDocumentUploadIntent({
      id: "doc-review-pending",
      firmId,
      matterId: "matter-001",
      title: "External evidence.pdf",
      storageKey: "matters/matter-001/external-evidence.pdf",
      checksumSha256: "1".repeat(64),
      classification: "general",
      legalHold: false,
      externalUploadLinkId: "external-upload-link-001",
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-review-pending",
      checksumSha256: "1".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-duplicate-review",
      firmId,
      matterId: "matter-001",
      title: "Duplicate retainer.pdf",
      storageKey: "matters/matter-001/duplicate-retainer.pdf",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-duplicate-review",
      checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-superseded-review",
      firmId,
      matterId: "matter-001",
      title: "Old notice.pdf",
      storageKey: "matters/matter-001/old-notice.pdf",
      checksumSha256: "2".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-superseded-review",
      checksumSha256: "2".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-superseding-review",
      firmId,
      matterId: "matter-001",
      title: "Updated notice.pdf",
      storageKey: "matters/matter-001/updated-notice.pdf",
      checksumSha256: "3".repeat(64),
      classification: "general",
      legalHold: false,
      supersedesDocumentId: "doc-superseded-review",
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-superseding-review",
      checksumSha256: "3".repeat(64),
      scanStatus: "passed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-failed-scan-review",
      firmId,
      matterId: "matter-001",
      title: "Failed scan.pdf",
      storageKey: "matters/matter-001/failed-scan.pdf",
      checksumSha256: "4".repeat(64),
      classification: "general",
      legalHold: false,
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-failed-scan-review",
      checksumSha256: "4".repeat(64),
      scanStatus: "failed",
    });
    await repository.createDocumentUploadIntent({
      id: "doc-other-matter-review",
      firmId,
      matterId: "matter-002",
      title: "Other matter review.pdf",
      storageKey: "matters/matter-002/review.pdf",
      checksumSha256: "5".repeat(64),
      classification: "general",
      legalHold: false,
      externalUploadLinkId: "external-upload-link-002",
    });
    await repository.completeDocumentUpload({
      firmId,
      documentId: "doc-other-matter-review",
      checksumSha256: "5".repeat(64),
      scanStatus: "failed",
    });

    const response = await testServer({
      repository,
      authUser: user("licensee", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reviewQueue: {
        needsReviewCount: 1,
        duplicateCandidateCount: 1,
        supersessionCount: 2,
        failedScanCount: 1,
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("doc-other-matter-review");
  });

  it("applies matter access to the document processing workbench", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const denied = await testServer({
      repository,
      authUser: user("licensee", ["matter-002"]),
    }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await testServer({
      repository,
      authUser: user("licensee", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/document-processing/workbench?matterId=matter-001",
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().documents).toEqual([
      expect.objectContaining({
        document: expect.objectContaining({ id: "doc-001", matterId: "matter-001" }),
      }),
    ]);
  });

  it("returns 503 when the OCR queue is not configured", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ message: "OCR queue is not configured" });
  });

  it("marks a durable OCR job failed when BullMQ enqueue fails", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const failingQueue: ApiJobQueue = {
      async add() {
        throw new Error("Redis unavailable with private connection details");
      },
    };

    const response = await testServer({ repository, ocrJobQueue: failingQueue }).inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "QUEUE_ENQUEUE_FAILED" });
    const [job] = await repository.listJobLifecycleRecords(firmId, { queueName: "ocr" });
    expect(job).toMatchObject({
      jobName: "extract_document_text",
      status: "failed",
      attemptsMade: 1,
      errorMessage: "Job enqueue failed; retry after the worker queue is available.",
      metadata: expect.objectContaining({
        documentId: "doc-001",
        matterId: "matter-001",
        enqueueStatus: "failed",
      }),
    });
    expect(job.errorMessage).not.toContain("private connection details");
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

  it("replays OCR queue requests for the same document without adding duplicate jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const { queue, jobs } = fakeOcrQueue();
    const server = testServer({ repository, ocrJobQueue: queue });

    const first = await server.inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });
    const replay = await server.inject({
      method: "POST",
      url: "/api/document-processing/documents/doc-001/queue",
      payload: { language: "eng" },
    });

    expect(first.statusCode).toBe(202);
    expect(replay.statusCode).toBe(202);
    expect(replay.json().job.id).toBe(first.json().job.id);
    expect(replay.json().job.idempotencyKeyPresent).toBe(true);
    expect(jobs).toHaveLength(1);
    await expect(
      repository.listJobLifecycleRecords("firm-west-legal", { queueName: "ocr" }),
    ).resolves.toHaveLength(1);
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
