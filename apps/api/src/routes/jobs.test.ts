import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
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
  connectorJobQueue?: ApiJobQueue;
  inboundEmailJobQueue?: ApiJobQueue;
  aiAssistJobQueue?: ApiJobQueue;
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
  it("returns default queue status when no lifecycle jobs exist", async () => {
    const response = await testServer({ repository: new InMemoryOpenPracticeRepository() }).inject({
      method: "GET",
      url: "/api/jobs",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "default",
      queues: [
        "email",
        "connectors",
        "document_assembly",
        "inbound_email",
        "reports",
        "ai_triage",
        "ocr",
        "transcription",
        "media",
      ],
      reservedQueues: expect.arrayContaining([
        expect.objectContaining({ queueName: "ai_triage", status: "reserved" }),
        expect.objectContaining({ queueName: "transcription", status: "reserved" }),
        expect.objectContaining({ queueName: "media", status: "reserved" }),
      ]),
      jobs: [],
    });
  });

  it("reports ai_triage as configured when async assist queue injection is present", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      aiAssistJobQueue: fakeQueue,
    }).inject({
      method: "GET",
      url: "/api/jobs",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      workers: expect.arrayContaining([{ queueName: "ai_triage", status: "configured" }]),
      workerQueues: expect.arrayContaining([{ queueName: "ai_triage", status: "configured" }]),
    });
    expect(response.json().reservedQueues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ queueName: "ai_triage" })]),
    );
  });

  it("reports inbound_email as configured when the parser producer queue is injected", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      inboundEmailJobQueue: fakeQueue,
    }).inject({
      method: "GET",
      url: "/api/jobs",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      workers: expect.arrayContaining([{ queueName: "inbound_email", status: "configured" }]),
      workerQueues: expect.arrayContaining([{ queueName: "inbound_email", status: "configured" }]),
    });
  });

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

  it("scans past invisible newer jobs when paginating matter-scoped job runs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    for (let index = 0; index < 3; index += 1) {
      await repository.createJobLifecycleRecord({
        id: `job-hidden-${index}`,
        firmId,
        queueName: "reports",
        jobName: "audit_export",
        status: "completed",
        targetResourceType: "audit_export",
        targetResourceId: `audit-export-${index}`,
        attemptsMade: 1,
        maxAttempts: 1,
        queuedAt: `2026-05-02T10:0${index}:00.000Z`,
        finishedAt: `2026-05-02T10:0${index}:10.000Z`,
        metadata: { reportType: "audit_log", reportScope: "firm" },
      });
    }
    await repository.createJobLifecycleRecord({
      id: "job-visible-older",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "completed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 1,
      maxAttempts: 1,
      queuedAt: "2026-05-02T09:00:00.000Z",
      finishedAt: "2026-05-02T09:01:00.000Z",
      metadata: { matterId: "matter-001", documentId: "doc-001", task: "ocr" },
    });

    const response = await testServer({ repository, role: "licensee" }).inject({
      method: "GET",
      url: "/api/jobs?limit=1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      jobs: [expect.objectContaining({ id: "job-visible-older" })],
      pagination: {
        limit: 1,
        hasMore: false,
      },
    });
  });

  it("returns compact worker health without job bodies or credentials", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-email-complete",
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
      metadata: {
        emailId: "email-001",
        rawBody: "raw email body must not be exposed",
        token: "synthetic-token",
      },
    });
    await repository.createJobLifecycleRecord({
      id: "job-ocr-failed",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 2,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:00:00.000Z",
      startedAt: "2026-05-02T10:00:10.000Z",
      failedAt: "2026-05-02T10:05:00.000Z",
      errorMessage: "Synthetic provider failed with private content",
      metadata: {
        matterId: "matter-001",
        documentId: "doc-001",
        storageKey: "private/storage/key.pdf",
      },
    });

    const response = await testServer({
      repository,
      emailJobQueue: fakeQueue,
      ocrJobQueue: fakeQueue,
    }).inject({
      method: "GET",
      url: "/api/jobs/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "degraded",
      configuredQueues: 2,
      reservedQueues: 3,
      totalRuns: 2,
      activeOrQueued: 0,
      failed: 1,
      stalled: 0,
      lastObservedAt: "2026-05-02T10:05:00.000Z",
      queues: expect.arrayContaining([
        expect.objectContaining({
          queueName: "email",
          status: "configured",
          health: "healthy",
          total: 1,
          failed: 0,
          lastObservedAt: "2026-05-02T09:01:00.000Z",
        }),
        expect.objectContaining({
          queueName: "ocr",
          status: "configured",
          health: "degraded",
          total: 1,
          failed: 1,
          lastFailureAt: "2026-05-02T10:05:00.000Z",
          degradedReasons: ["failed_jobs_observed"],
        }),
        expect.objectContaining({
          queueName: "ai_triage",
          status: "reserved",
          health: "unknown",
        }),
      ]),
    });
    const serialized = JSON.stringify(response.json());
    expect(serialized).not.toContain("raw email body");
    expect(serialized).not.toContain("synthetic-token");
    expect(serialized).not.toContain("private/storage/key");
    expect(serialized).not.toContain("private content");
  });

  it("returns read-only workflow history over visible jobs and workflow audit events", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-ocr-workflow",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "completed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 1,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:00:05.000Z",
      finishedAt: "2026-05-02T10:01:00.000Z",
      idempotencyKey: "private-idempotency-key",
      metadata: {
        requestId: "req-ocr-workflow",
        matterId: "matter-001",
        documentId: "doc-001",
        task: "ocr",
        templateId: "template-ocr-001",
        rawBody: "raw document text must not be exposed",
        storageKey: "matters/matter-001/private.pdf",
        token: "synthetic-token",
      },
    });
    await repository.appendAuditEvent({
      id: "audit-ocr-workflow",
      firmId,
      actorId: "user-licensee",
      action: "document_processing.ocr.queued",
      resourceType: "document",
      resourceId: "doc-001",
      occurredAt: "2026-05-02T10:00:00.000Z",
      metadata: {
        requestId: "req-ocr-workflow",
        actorType: "licensee",
        actorId: "user-licensee",
        matterId: "matter-001",
        workflowStatus: "queued",
        beforeStatus: "verified",
        expectedStatus: "queued",
        afterStatus: "queued",
        idempotencyKeyPresent: true,
        rawBody: "raw audit body must not be exposed",
        providerPayload: { private: true },
      },
    });

    const response = await testServer({ repository, ocrJobQueue: fakeQueue }).inject({
      method: "GET",
      url: "/api/jobs/workflows?matterId=matter-001&queueName=ocr",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "available",
      summary: { total: 1, active: 0, failed: 0, terminal: 1 },
      workflows: [
        expect.objectContaining({
          id: "request:req-ocr-workflow",
          status: "succeeded",
          matterIds: ["matter-001"],
          queueNames: ["ocr"],
          jobIds: ["job-ocr-workflow"],
          stepCount: 2,
          reviewPacket: {
            reviewOnly: true,
            automationDisabled: true,
            externalConnectorDisabled: true,
            backgroundMutationDisabled: true,
            cues: [
              { kind: "matter", label: "matter", value: "matter-001" },
              { kind: "task", label: "task", value: "ocr" },
              { kind: "template", label: "template", value: "template-ocr-001" },
              { kind: "document", label: "document", value: "doc-001" },
              { kind: "resource", label: "resource", value: "document:doc-001" },
            ],
          },
        }),
      ],
    });
    expect(
      response.json().workflows[0].steps.map((step: { source: string }) => step.source),
    ).toEqual(["audit", "job"]);
    const serialized = response.body;
    expect(serialized).not.toContain("raw document text");
    expect(serialized).not.toContain("raw audit body");
    expect(serialized).not.toContain("private.pdf");
    expect(serialized).not.toContain("synthetic-token");
    expect(serialized).not.toContain("private-idempotency-key");
  });

  it("keeps workflow history scoped to visible matter job and audit events", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-visible-workflow",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-001",
      attemptsMade: 2,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:00:00.000Z",
      failedAt: "2026-05-02T10:05:00.000Z",
      errorMessage: "Synthetic private provider detail",
      metadata: { matterId: "matter-001", documentId: "doc-001", task: "ocr" },
    });
    await repository.createJobLifecycleRecord({
      id: "job-hidden-workflow",
      firmId,
      queueName: "ocr",
      jobName: "extract_document_text",
      status: "failed",
      targetResourceType: "document",
      targetResourceId: "doc-002",
      attemptsMade: 2,
      maxAttempts: 3,
      queuedAt: "2026-05-02T10:10:00.000Z",
      failedAt: "2026-05-02T10:15:00.000Z",
      errorMessage: "Synthetic private provider detail",
      metadata: { matterId: "matter-002", documentId: "doc-002", task: "ocr" },
    });
    await repository.appendAuditEvent({
      id: "audit-hidden-workflow",
      firmId,
      actorId: "user-licensee",
      action: "document_processing.ocr.queued",
      resourceType: "document",
      resourceId: "doc-002",
      occurredAt: "2026-05-02T10:09:00.000Z",
      metadata: {
        requestId: "req-hidden",
        matterId: "matter-002",
        workflowStatus: "queued",
      },
    });

    const response = await testServer({ repository, role: "licensee" }).inject({
      method: "GET",
      url: "/api/jobs/workflows",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workflows).toHaveLength(1);
    expect(response.json().workflows[0]).toMatchObject({
      id: "job:job-visible-workflow",
      status: "failed",
      matterIds: ["matter-001"],
      jobIds: ["job-visible-workflow"],
    });
    expect(response.body).not.toContain("matter-002");
    expect(response.body).not.toContain("Synthetic private provider detail");
  });

  it("marks old queued and active jobs as stalled in worker health", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-email-stalled",
      firmId,
      queueName: "email",
      jobName: "send",
      status: "queued",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-02T08:00:00.000Z",
      metadata: { emailId: "email-001" },
    });

    const response = await testServer({ repository, emailJobQueue: fakeQueue }).inject({
      method: "GET",
      url: "/api/jobs/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "degraded",
      stalled: 1,
      queues: expect.arrayContaining([
        expect.objectContaining({
          queueName: "email",
          health: "degraded",
          stalled: 1,
          degradedReasons: ["stalled_jobs_observed"],
        }),
      ]),
    });
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

  it("returns bounded lifecycle pages with stable cursors", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    for (const [index, queuedAt] of [
      "2026-05-02T12:00:00.000Z",
      "2026-05-02T11:00:00.000Z",
      "2026-05-02T10:00:00.000Z",
    ].entries()) {
      await repository.createJobLifecycleRecord({
        id: `job-report-${index}`,
        firmId,
        queueName: "reports",
        jobName: "audit_export",
        status: "completed",
        targetResourceType: "audit_export",
        targetResourceId: `audit-export-${index}`,
        attemptsMade: 1,
        maxAttempts: 1,
        queuedAt,
        finishedAt: queuedAt,
        metadata: {
          reportType: "audit_log",
          reportScope: "firm",
          requestedByUserId: "user-owner_admin",
          eventCount: 3,
        },
      });
    }

    const firstPage = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/jobs?queueName=reports&limit=2",
    });

    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json()).toMatchObject({
      pagination: {
        limit: 2,
        hasMore: true,
        nextCursor: "2026-05-02T11:00:00.000Z",
      },
      jobs: [
        expect.objectContaining({ id: "job-report-0" }),
        expect.objectContaining({ id: "job-report-1" }),
      ],
    });

    const secondPage = await testServer({ repository }).inject({
      method: "GET",
      url: `/api/jobs?queueName=reports&limit=2&cursor=${encodeURIComponent(
        firstPage.json().pagination.nextCursor,
      )}`,
    });
    expect(secondPage.json()).toMatchObject({
      pagination: { hasMore: false },
      jobs: [expect.objectContaining({ id: "job-report-2" })],
    });
  });

  it("accepts connector queue filters as a worker status surface", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-connectors-001",
      firmId: "firm-west-legal",
      queueName: "connectors",
      jobName: "deliver_connectors",
      status: "queued",
      targetResourceType: "connector_outbox",
      targetResourceId: "connector-outbox-001",
      attemptsMade: 0,
      maxAttempts: 3,
      queuedAt: "2026-05-12T12:00:00.000Z",
      metadata: {
        leasedCount: 1,
        deliveredCount: 0,
        failedCount: 0,
        deadLetterCount: 0,
        rawBody: "Synthetic private body must not be exposed",
      },
    });
    const response = await testServer({ repository, connectorJobQueue: fakeQueue }).inject({
      method: "GET",
      url: "/api/jobs?queueName=connectors",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      jobs: [
        {
          queueName: "connectors",
          targetResourceType: "connector_outbox",
          targetResourceId: "connector-outbox-001",
          metadata: {
            leasedCount: 1,
            deliveredCount: 0,
            failedCount: 0,
            deadLetterCount: 0,
          },
        },
      ],
      workerQueues: expect.arrayContaining([{ queueName: "connectors", status: "configured" }]),
    });
    expect(JSON.stringify(response.json())).not.toContain("Synthetic private body");
  });

  it("limits non-admin lifecycle run summaries to assigned matter jobs", async () => {
    expect(
      authorizationFixtureCases.filter((item) => item.family === "job").map((item) => item.id),
    ).toEqual([
      "job:firm-wide:no-matter-visible",
      "job:assigned:matter-job-visible",
      "job:unassigned:matter-job-hidden",
      "job:unassigned:no-matter-hidden",
    ]);
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
    const hiddenQueueResponse = await testServer({ repository, role: "licensee" }).inject({
      method: "GET",
      url: "/api/jobs?queueName=media",
    });
    const hiddenDetailResponse = await testServer({ repository, role: "licensee" }).inject({
      method: "GET",
      url: "/api/jobs/job-firm-wide",
    });

    expect(licenseeResponse.statusCode).toBe(200);
    expect(licenseeResponse.json()).toMatchObject({
      summary: { total: 1, terminal: 1, failed: 0 },
      jobs: [expect.objectContaining({ id: "job-assigned" })],
    });
    expect(licenseeResponse.json().jobs.map((job: { id: string }) => job.id)).toEqual([
      "job-assigned",
    ]);
    expect(hiddenQueueResponse.statusCode).toBe(200);
    expect(hiddenQueueResponse.json()).toMatchObject({
      summary: { total: 0, terminal: 0, failed: 0 },
      jobs: [],
    });
    expect(hiddenDetailResponse.statusCode).toBe(404);

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

  it("redacts inbound parser raw-object metadata from lifecycle list and detail", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "job-inbound-parser-recovery",
      firmId,
      queueName: "inbound_email",
      jobName: "parse_inbound_email",
      status: "failed",
      targetResourceType: "inbound_email_raw",
      targetResourceId: "synthetic-token-hash",
      attemptsMade: 1,
      maxAttempts: 4,
      queuedAt: "2026-05-02T10:00:00.000Z",
      failedAt: "2026-05-02T10:01:00.000Z",
      errorMessage: "Synthetic parser failed with private raw MIME content",
      metadata: {
        recoveryPosture: "owner_reviewed_raw_object_replay",
        ownerReviewRequired: true,
        rawObjectRecoverable: true,
        providerPayloadStored: false,
        automaticDocumentPromotion: false,
        automaticMatterCreation: false,
        providerFailureStage: "parser_retry_enqueue",
        provider: "mailgun",
        source: "api.inbound_email.parser_job.replay_request",
        resourceType: "inbound_email_raw",
        resourceId: "synthetic-token-hash",
        retryOfJobId: "job-inbound-parser-original",
        reviewOnly: true,
        redactedAuthorizedProjection: true,
        requestType: "inbound_email_parser_safe_replay",
        reviewState: "replay_requested",
        providerPayload: { private: "Synthetic provider payload" },
        rawStorageKey:
          "inbound-email/firm-west-legal/raw/provider-webhooks/mailgun/raw-mime/private.eml",
        rawContentSha256: "a".repeat(64),
        webhookSigningKey: "synthetic-mailgun-signing-key",
        rawMime: "From: client@example.test\n\nSynthetic body",
      },
    });

    const server = testServer({ repository, inboundEmailJobQueue: fakeQueue });
    const list = await server.inject({ method: "GET", url: "/api/jobs?queueName=inbound_email" });
    const detail = await server.inject({
      method: "GET",
      url: "/api/jobs/job-inbound-parser-recovery",
    });

    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    expect(list.json().jobs[0]).toMatchObject({
      id: "job-inbound-parser-recovery",
      queueName: "inbound_email",
      metadata: {
        provider: "mailgun",
        source: "api.inbound_email.parser_job.replay_request",
        resourceType: "inbound_email_raw",
        resourceId: "synthetic-token-hash",
        recoveryPosture: "owner_reviewed_raw_object_replay",
        ownerReviewRequired: true,
        rawObjectRecoverable: true,
        providerPayloadStored: false,
        automaticDocumentPromotion: false,
        automaticMatterCreation: false,
        providerFailureStage: "parser_retry_enqueue",
        reviewOnly: true,
        redactedAuthorizedProjection: true,
        requestType: "inbound_email_parser_safe_replay",
        reviewState: "replay_requested",
      },
    });
    expect(detail.json().job).toMatchObject({
      id: "job-inbound-parser-recovery",
      queueName: "inbound_email",
      metadata: {
        provider: "mailgun",
        source: "api.inbound_email.parser_job.replay_request",
        resourceType: "inbound_email_raw",
        resourceId: "synthetic-token-hash",
        recoveryPosture: "owner_reviewed_raw_object_replay",
        ownerReviewRequired: true,
        rawObjectRecoverable: true,
        providerPayloadStored: false,
        automaticDocumentPromotion: false,
        automaticMatterCreation: false,
        providerFailureStage: "parser_retry_enqueue",
        reviewOnly: true,
        redactedAuthorizedProjection: true,
        requestType: "inbound_email_parser_safe_replay",
        reviewState: "replay_requested",
      },
    });
    expect(list.body).not.toContain("rawStorageKey");
    expect(list.body).not.toContain("private.eml");
    expect(list.body).not.toContain("Synthetic body");
    expect(list.body).not.toContain("synthetic-mailgun-signing-key");
    expect(detail.body).not.toContain("rawStorageKey");
    expect(detail.body).not.toContain("private.eml");
    expect(detail.body).not.toContain("private raw MIME content");
    expect(detail.body).not.toMatch(/"providerPayload"\s*:/);
    expect(detail.body).not.toContain("Synthetic provider payload");
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
