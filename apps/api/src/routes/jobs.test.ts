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
}): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: user("owner_admin") };
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
        { queueName: "ocr", status: "not_configured", reason: "queue_not_configured" },
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
          errorSummary: expect.stringContaining("OCR failed"),
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
  });
});
