import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerAuditRoutes } from "./audit.js";
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

function fakeReportQueue(jobs: Array<{ name: string; data: unknown; jobId?: string }> = []) {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "report-job" };
    },
  } satisfies ApiJobQueue;
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  reportJobQueue?: ApiJobQueue;
  role?: ProfessionalRole;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: user(input.role ?? "owner_admin") };
  });
  registerAuditRoutes(server, input);
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("audit routes", () => {
  it("returns audit events without raw metadata values", async () => {
    const response = await testServer({ repository: new InMemoryOpenPracticeRepository() }).inject({
      method: "GET",
      url: "/api/audit",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      valid: true,
      taxonomySummary: expect.objectContaining({ total: expect.any(Number) }),
      events: expect.any(Array),
    });
    const event = response.json().events[0];
    expect(event).toHaveProperty("metadataKeys");
    expect(event).not.toHaveProperty("metadata");
    expect(JSON.stringify(response.json())).not.toContain("Synthetic billing audit time entry");
  });

  it("creates a redacted audit export request with poll and download links", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: Array<{ name: string; data: unknown; jobId?: string }> = [];
    const server = testServer({
      repository,
      reportJobQueue: fakeReportQueue(queuedReports),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/audit/export-requests",
      payload: { idempotencyKey: "audit-export-test" },
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload.exportRequest).toMatchObject({
      status: "queued",
      pollUrl: expect.stringContaining("/api/jobs/"),
      downloadUrl: expect.stringContaining("/api/audit/export-requests/"),
    });
    expect(queuedReports).toEqual([
      expect.objectContaining({
        name: "audit_export",
        jobId: payload.exportRequest.jobId,
      }),
    ]);

    const [job] = await repository.listJobLifecycleRecords(firmId, { queueName: "reports" });
    expect(job).toMatchObject({
      id: payload.exportRequest.jobId,
      jobName: "audit_export",
      status: "queued",
      targetResourceType: "audit_export",
      metadata: {
        reportType: "audit_log",
        reportScope: "firm",
        requestedByUserId: "user-owner_admin",
        enqueueStatus: "queued_for_local_report_worker",
      },
    });
    expect(JSON.stringify(job.metadata)).not.toContain("metadataValues");
    expect(JSON.stringify(job.metadata)).not.toContain("client");
  });

  it("requires worker completion before downloading a queued audit export", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({
      repository,
      reportJobQueue: fakeReportQueue(),
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/audit/export-requests",
      payload: {},
    });
    const jobId = created.json().exportRequest.jobId;
    const earlyDownload = await server.inject({
      method: "GET",
      url: `/api/audit/export-requests/${jobId}/download`,
    });

    expect(earlyDownload.statusCode).toBe(409);
    expect(earlyDownload.json()).toMatchObject({ code: "AUDIT_EXPORT_NOT_READY" });

    await repository.updateJobLifecycleRecord(firmId, jobId, {
      status: "completed",
      finishedAt: "2026-05-15T12:00:00.000Z",
      attemptsMade: 1,
      metadata: {
        reportType: "audit_log",
        reportScope: "firm",
        requestedByUserId: "user-owner_admin",
        eventCount: 3,
      },
    });

    const readyDownload = await server.inject({
      method: "GET",
      url: `/api/audit/export-requests/${jobId}/download`,
    });

    expect(readyDownload.statusCode).toBe(200);
    expect(readyDownload.json()).toMatchObject({
      exportRequest: { jobId, status: "completed" },
      export: {
        valid: true,
        events: expect.any(Array),
      },
    });
  });

  it("downloads audit exports without raw audit metadata values", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const created = await server.inject({
      method: "POST",
      url: "/api/audit/export-requests",
      payload: {},
    });
    const jobId = created.json().exportRequest.jobId;
    const downloaded = await server.inject({
      method: "GET",
      url: `/api/audit/export-requests/${jobId}/download`,
    });

    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.json()).toMatchObject({
      exportRequest: { jobId, status: "completed" },
      export: {
        valid: true,
        taxonomySummary: expect.objectContaining({ total: expect.any(Number) }),
        events: expect.any(Array),
      },
    });
    const event = downloaded.json().export.events[0];
    expect(event).toHaveProperty("metadataKeys");
    expect(event).not.toHaveProperty("metadata");
    expect(JSON.stringify(downloaded.json())).not.toContain("Synthetic billing audit time entry");
  });

  it("denies audit export requests to users without export permission", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      role: "firm_member",
    }).inject({
      method: "POST",
      url: "/api/audit/export-requests",
      payload: {},
    });

    expect(response.statusCode).toBe(403);
  });
});
