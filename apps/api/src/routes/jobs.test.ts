import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerJobsRoutes } from "./jobs.js";
import type { ApiJobQueue } from "./types.js";

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

const fakeQueue: ApiJobQueue = {
  async add(_name, _data, options) {
    return { id: options?.jobId ?? "fake-job" };
  },
};

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  emailJobQueue?: ApiJobQueue;
  ocrJobQueue?: ApiJobQueue;
  role?: ProfessionalRole;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: user(input.role ?? "owner_admin") };
  });
  registerJobsRoutes(server, input);
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("jobs routes", () => {
  it("returns queue status and redacted lifecycle run summaries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-ocr-retry",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      bullJobId: "bull-job-ocr-retry",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:00:00.000Z",
      startedAt: "2026-05-02T10:00:05.000Z",
      failedAt: "2026-05-02T10:01:00.000Z",
      errorMessage: " OCR failed while reading synthetic fixture body ".repeat(20),
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        language: "eng",
        nextRetryAt: "2026-05-02T10:05:00.000Z",
        rawBody: "Do not return this",
        secret: "synthetic-secret",
      },
    });

    const response = await testServer({ repository, emailJobQueue: fakeQueue }).inject({
      method: "GET",
      url: "/api/jobs",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      workerQueues: expect.arrayContaining([
        { queueName: "email", status: "configured" },
        {
          queueName: "ai_triage",
          status: "reserved",
          reason: "deferred_worker",
          task: "classification",
          actionable: false,
        },
        { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
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
      summary: {
        total: 1,
        failed: 1,
        terminal: 0,
      },
      jobs: [
        expect.objectContaining({
          id: "job-ocr-retry",
          queueName: "ocr",
          status: "failed",
          failed: true,
          terminal: false,
          retryable: true,
          nextAttemptAt: "2026-05-02T10:05:00.000Z",
          errorSummary:
            "Job failed. Error details are redacted; review server logs for privileged diagnostics.",
          metadata: {
            matterId: "matter-001",
            documentId: "doc-001",
            task: "ocr",
            language: "eng",
            nextRetryAt: "2026-05-02T10:05:00.000Z",
          },
        }),
      ],
    });
    expect(response.json().jobs[0].metadata).not.toHaveProperty("rawBody");
    expect(response.json().jobs[0].metadata).not.toHaveProperty("secret");
    expect(response.json().jobs[0].errorSummary).not.toContain("synthetic fixture body");
  });

  it("filters lifecycle run summaries by queue name", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-email-sent",
      firmId,
      queueName: "email",
      jobName: "send",
      status: "completed",
      targetResourceType: "email_outbox",
      targetResourceId: "email-001",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T09:00:00.000Z",
      finishedAt: "2026-05-02T09:01:00.000Z",
      metadata: { emailId: "email-001", templateKey: "signature.requested" },
    });
    await repository.createJobLifecycleRecord({
      id: "job-ocr-retry",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 2,
      maxAttempts: 4,
      queuedAt: "2026-05-02T10:00:00.000Z",
      failedAt: "2026-05-02T10:01:00.000Z",
      errorMessage: "Synthetic OCR provider details stay private",
      metadata: {
        documentId: "doc-001",
        matterId: "matter-001",
        nextRetryAt: "2026-05-02T10:10:00.000Z",
        storageKey: "matters/matter-001/private.pdf",
      },
    });

    const emailResponse = await testServer({ repository, emailJobQueue: fakeQueue }).inject({
      method: "GET",
      url: "/api/jobs?queueName=email",
    });
    const ocrResponse = await testServer({ repository, ocrJobQueue: fakeQueue }).inject({
      method: "GET",
      url: "/api/jobs?queueName=ocr",
    });

    expect(emailResponse.statusCode).toBe(200);
    expect(emailResponse.json()).toMatchObject({
      summary: { total: 1, terminal: 1, failed: 0 },
      jobs: [
        expect.objectContaining({
          id: "job-email-sent",
          queueName: "email",
          terminal: true,
          attemptsMade: 1,
          maxAttempts: 3,
          targetResourceType: "email_outbox",
          targetResourceId: "email-001",
        }),
      ],
    });
    expect(emailResponse.json().workerQueues).toEqual(
      expect.arrayContaining([
        { queueName: "email", status: "configured" },
        {
          queueName: "ai_triage",
          status: "reserved",
          reason: "deferred_worker",
          task: "classification",
          actionable: false,
        },
        { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
      ]),
    );
    expect(emailResponse.json().reservedQueues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
      ]),
    );

    expect(ocrResponse.statusCode).toBe(200);
    expect(ocrResponse.json()).toMatchObject({
      summary: { total: 1, terminal: 0, failed: 1 },
      jobs: [
        expect.objectContaining({
          id: "job-ocr-retry",
          queueName: "ocr",
          failed: true,
          retryable: true,
          nextAttemptAt: "2026-05-02T10:10:00.000Z",
          attemptsMade: 2,
          maxAttempts: 4,
          metadata: {
            documentId: "doc-001",
            matterId: "matter-001",
            nextRetryAt: "2026-05-02T10:10:00.000Z",
          },
        }),
      ],
    });
    expect(ocrResponse.json().jobs[0].metadata).not.toHaveProperty("storageKey");
    expect(ocrResponse.json().jobs[0].errorSummary).not.toContain("provider details");
  });

  it("rejects unsupported queue filters", async () => {
    const response = await testServer({ repository: new InMemoryOpenPracticeRepository() }).inject({
      method: "GET",
      url: "/api/jobs?queueName=connectors",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid request query",
    });
  });

  it("limits non-admin lifecycle run summaries to assigned matter jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-assigned",
      firmId,
      queueName: "email",
      jobName: "send_email",
      status: "completed",
      targetResourceType: "email_outbox",
      targetResourceId: "email-001",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T09:00:00.000Z",
      finishedAt: "2026-05-02T09:01:00.000Z",
      metadata: { matterId: "matter-001", emailId: "email-001" },
    });
    await repository.createJobLifecycleRecord({
      id: "job-unassigned",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-002",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:00:00.000Z",
      failedAt: "2026-05-02T10:01:00.000Z",
      metadata: { matterId: "matter-002", documentId: "doc-002" },
    });
    await repository.createJobLifecycleRecord({
      id: "job-firm-wide",
      firmId,
      queueName: "media",
      jobName: "cleanup",
      status: "queued",
      attemptsMade: 0,
      maxAttempts: 1,
      queuedAt: "2026-05-02T11:00:00.000Z",
      metadata: { task: "maintenance" },
    });

    const licenseeResponse = await testServer({ repository, role: "licensee" }).inject({
      method: "GET",
      url: "/api/jobs",
    });
    const auditorResponse = await testServer({ repository, role: "auditor" }).inject({
      method: "GET",
      url: "/api/jobs",
    });

    expect(licenseeResponse.statusCode).toBe(200);
    expect(licenseeResponse.json()).toMatchObject({
      summary: { total: 1, terminal: 1, failed: 0 },
      jobs: [expect.objectContaining({ id: "job-assigned" })],
    });
    expect(licenseeResponse.json().jobs.map((job: { id: string }) => job.id)).toEqual([
      "job-assigned",
    ]);

    expect(auditorResponse.statusCode).toBe(200);
    expect(auditorResponse.json().summary.total).toBe(3);
    expect(auditorResponse.json().summary.byQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ queueName: "media", total: 1, queued: 1 }),
      ]),
    );
    expect(auditorResponse.json().reservedQueues).toEqual(
      expect.arrayContaining([expect.objectContaining({ queueName: "media", status: "reserved" })]),
    );
  });

  it("hides unassigned job detail from non-admin users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-unassigned",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-002",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:00:00.000Z",
      failedAt: "2026-05-02T10:01:00.000Z",
      metadata: { matterId: "matter-002", documentId: "doc-002" },
    });

    const response = await testServer({ repository, role: "licensee" }).inject({
      method: "GET",
      url: "/api/jobs/job-unassigned",
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns one firm-scoped redacted job detail", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-visible",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 2,
      maxAttempts: 3,
      queuedAt: "2026-05-02T11:00:00.000Z",
      failedAt: "2026-05-02T11:01:00.000Z",
      errorMessage: "Synthetic provider timeout with private payload details".repeat(12),
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        nextRetryAt: "2026-05-02T11:05:00.000Z",
        storageKey: "matters/matter-001/private.pdf",
        body: "Do not expose body text",
      },
    });
    await repository.createJobLifecycleRecord({
      id: "job-other-firm",
      firmId: "firm-other",
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "completed",
      targetResourceType: "document",
      targetResourceId: "doc-other",
      attemptsMade: 1,
      maxAttempts: 1,
      queuedAt: "2026-05-02T12:00:00.000Z",
      finishedAt: "2026-05-02T12:01:00.000Z",
      metadata: { matterId: "matter-other", documentId: "doc-other" },
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/jobs/job-visible",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      job: {
        id: "job-visible",
        status: "failed",
        terminal: false,
        failed: true,
        retryable: true,
        nextAttemptAt: "2026-05-02T11:05:00.000Z",
        errorSummary:
          "Job failed. Error details are redacted; review server logs for privileged diagnostics.",
        metadata: {
          matterId: "matter-001",
          documentId: "doc-001",
          task: "ocr",
          nextRetryAt: "2026-05-02T11:05:00.000Z",
        },
      },
    });
    expect(response.json().job.metadata).not.toHaveProperty("storageKey");
    expect(response.json().job.metadata).not.toHaveProperty("body");
    expect(response.json().job.errorSummary).not.toContain("private payload details");

    const otherFirm = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/jobs/job-other-firm",
    });
    expect(otherFirm.statusCode).toBe(404);
  });
});
