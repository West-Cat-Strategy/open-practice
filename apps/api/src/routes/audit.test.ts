import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
import { registerAuditRoutes } from "./audit.js";
import type { ApiJobQueue } from "./types.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, id = `user-${role}`): User {
  return {
    id,
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

class MatterScopedFilteredAuditRepository extends InMemoryOpenPracticeRepository {
  readonly filteredAuditReads: Array<
    Parameters<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]>[1]
  > = [];

  override async listAuditEvents(
    firmId: Parameters<InMemoryOpenPracticeRepository["listAuditEvents"]>[0],
  ): ReturnType<InMemoryOpenPracticeRepository["listAuditEvents"]> {
    throw new Error(`matter-scoped audit route should not read the full audit chain for ${firmId}`);
  }

  override async listFilteredAuditEvents(
    firmId: Parameters<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]>[0],
    filter: Parameters<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]>[1],
  ): ReturnType<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]> {
    this.filteredAuditReads.push(filter);
    return super.listFilteredAuditEvents(firmId, filter);
  }
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  reportJobQueue?: ApiJobQueue;
  role?: ProfessionalRole;
  userId?: string;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: user(input.role ?? "owner_admin", input.userId) };
  });
  registerAuditRoutes(server, input);
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function authorizationFixtureCase(id: string) {
  const match = authorizationFixtureCases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing authorization fixture case ${id}`);
  return match;
}

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

  it("denies firm-wide audit reads to non firm-wide roles", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      role: "licensee",
    }).inject({
      method: "GET",
      url: "/api/audit",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FIRM_WIDE_AUDIT_FORBIDDEN" });
  });

  it("returns matter-scoped audit reads without hash-chain internals", async () => {
    const repository = new MatterScopedFilteredAuditRepository({ seedSampleData: false });
    const server = testServer({ repository, role: "firm_member" });
    await repository.appendAuditEvent({
      id: "audit-matter-001",
      firmId,
      actorId: "user-owner_admin",
      action: "matter.updated",
      resourceType: "matter",
      resourceId: "matter-001",
      occurredAt: "2026-05-17T10:00:00.000Z",
      metadata: { matterId: "matter-001", privateNote: "synthetic private note" },
    });
    await repository.appendAuditEvent({
      id: "audit-matter-002",
      firmId,
      actorId: "user-owner_admin",
      action: "matter.updated",
      resourceType: "matter",
      resourceId: "matter-002",
      occurredAt: "2026-05-17T10:01:00.000Z",
      metadata: { matterId: "matter-002" },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/audit?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      scope: { kind: "matter", matterId: "matter-001" },
      chainValidation: "not_shown_for_filtered_view",
      events: [expect.objectContaining({ id: "audit-matter-001" })],
    });
    expect(response.json()).not.toHaveProperty("valid");
    expect(response.json().events[0]).not.toHaveProperty("previousHash");
    expect(response.json().events[0]).not.toHaveProperty("hash");
    expect(repository.filteredAuditReads).toEqual([{ matterId: "matter-001" }]);
    expect(JSON.stringify(response.json())).not.toContain("synthetic private note");
    expect(JSON.stringify(response.json())).not.toContain("audit-matter-002");
  });

  it("includes taxonomy-supported matter metadata aliases in scoped audit reads", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const server = testServer({ repository, role: "firm_member" });
    await repository.appendAuditEvent({
      id: "audit-previous-matter",
      firmId,
      actorId: "user-owner_admin",
      action: "inbound_email.triage.updated",
      resourceType: "inbound_email",
      resourceId: "email-previous-matter",
      occurredAt: "2026-05-17T10:02:00.000Z",
      metadata: { previousMatterId: "matter-001" },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/audit?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events).toEqual([
      expect.objectContaining({ id: "audit-previous-matter" }),
    ]);
  });

  it("returns read-only taxonomy projection summaries for audit operators", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    await repository.appendAuditEvent({
      id: "audit-test-unknown",
      firmId,
      actorId: "user-owner_admin",
      action: "custom.workflow.executed",
      resourceType: "custom_resource",
      resourceId: "custom-001",
      occurredAt: "2026-05-17T10:00:00.000Z",
      metadata: { matterId: "matter-sensitive", privateNote: "synthetic private note" },
    });
    await repository.appendAuditEvent({
      id: "audit-test-matter-gap",
      firmId,
      actorId: "user-owner_admin",
      action: "signature_request.created",
      resourceType: "signature_request",
      resourceId: "signature-001",
      occurredAt: "2026-05-17T10:01:00.000Z",
      metadata: { signerCount: 1 },
    });
    await repository.appendAuditEvent({
      id: "audit-test-resource-mismatch",
      firmId,
      actorId: "user-owner_admin",
      action: "signature_provider_event.recorded",
      resourceType: "provider_event",
      resourceId: "provider-event-001",
      occurredAt: "2026-05-17T10:02:00.000Z",
      metadata: { matterId: "matter-sensitive", provider: "embedded" },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/audit",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      valid: true,
      taxonomySummary: {
        unknown: 1,
        matterScopedWithoutMatterId: 2,
        unknownActions: ["custom.workflow.executed"],
        resourceTypeMismatches: [
          {
            action: "signature_provider_event.recorded",
            expectedResourceType: "signature_request",
            observedResourceType: "provider_event",
            count: 1,
          },
        ],
      },
    });
    expect(JSON.stringify(response.json().taxonomySummary)).not.toContain("matter-sensitive");
    expect(JSON.stringify(response.json().taxonomySummary)).not.toContain("synthetic private note");
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

  it("matches audit export authorization fixtures without creating denied jobs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: Array<{ name: string; data: unknown; jobId?: string }> = [];
    const fixtureIds = authorizationFixtureCases
      .filter((item) => item.family === "audit_export")
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "audit-export:auditor:create",
      "audit-export:bookkeeper:create-denied",
      "audit-export:assigned:create-denied",
      "audit-export:portal-client:create-denied",
    ]);
    const auditorCase = authorizationFixtureCase("audit-export:auditor:create");
    const bookkeeperCase = authorizationFixtureCase("audit-export:bookkeeper:create-denied");
    const assignedCase = authorizationFixtureCase("audit-export:assigned:create-denied");
    const portalCase = authorizationFixtureCase("audit-export:portal-client:create-denied");

    const auditor = await testServer({
      repository,
      reportJobQueue: fakeReportQueue(queuedReports),
      role: "auditor",
      userId: auditorCase.subjectId,
    }).inject({
      method: "POST",
      url: "/api/audit/export-requests",
      payload: { idempotencyKey: auditorCase.resourceId },
    });
    expect(auditor.statusCode).toBe(202);
    expect(auditor.json()).toMatchObject({ exportRequest: { status: "queued" } });
    expect(queuedReports).toHaveLength(1);

    const beforeDenied = await repository.listJobLifecycleRecords(firmId, {
      queueName: "reports",
    });
    for (const fixture of [
      { case: bookkeeperCase, role: "billing_bookkeeper" as const },
      { case: assignedCase, role: "firm_member" as const },
      { case: portalCase, role: "client_external" as const },
    ]) {
      const denied = await testServer({
        repository,
        reportJobQueue: fakeReportQueue(queuedReports),
        role: fixture.role,
        userId: fixture.case.subjectId,
      }).inject({
        method: "POST",
        url: "/api/audit/export-requests",
        payload: { idempotencyKey: fixture.case.resourceId },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toMatchObject({ message: "Audit log access required" });
    }
    await expect(
      repository.listJobLifecycleRecords(firmId, { queueName: "reports" }),
    ).resolves.toHaveLength(beforeDenied.length);
    expect(queuedReports).toHaveLength(1);
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
