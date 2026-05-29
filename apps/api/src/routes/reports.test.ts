import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
type QueuedReportJob = { name: string; data: unknown; jobId?: string };

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

function fakeReportQueue(
  jobs: QueuedReportJob[] = [],
): NonNullable<CreateServerOptions["reportJobQueue"]> {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "report-job" };
    },
  };
}

async function auditEvents(repository: InMemoryOpenPracticeRepository) {
  return (await repository.listAuditEvents("firm-west-legal")).events;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("staff reporting routes", () => {
  it("returns staff report definitions, first projections, export profiles, and history", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createJobLifecycleRecord({
      id: "staff-report-history-test",
      firmId: "firm-west-legal",
      queueName: "reports",
      jobName: "staff_report_export",
      status: "completed",
      targetResourceType: "staff_report_export",
      targetResourceId: "staff-report-history-test",
      attemptsMade: 0,
      maxAttempts: 1,
      queuedAt: "2026-05-28T10:00:00.000Z",
      finishedAt: "2026-05-28T10:01:00.000Z",
      metadata: {
        reportType: "staff_reporting",
        reportDefinitionKey: "invoice_aging",
        exportProfileId: "summary_json",
        groupingKey: "aging_bucket",
        rowCount: 1,
      },
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/reports/workspace",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      definitions: expect.arrayContaining([
        expect.objectContaining({
          key: "invoice_aging",
          filters: expect.arrayContaining([expect.objectContaining({ key: "asOf" })]),
          groupings: expect.arrayContaining([expect.objectContaining({ key: "aging_bucket" })]),
        }),
      ]),
      exportProfiles: expect.arrayContaining([
        expect.objectContaining({
          id: "summary_json",
          manualDownloadOnly: true,
          scheduledEmailDelivery: false,
          includesRawReportBody: false,
        }),
      ]),
      reports: expect.arrayContaining([
        expect.objectContaining({
          definitionKey: "invoice_aging",
          rowCount: expect.any(Number),
          projectionPolicy: expect.objectContaining({
            rawBodiesStoredInJobMetadata: false,
          }),
        }),
      ]),
      history: [
        expect.objectContaining({
          jobId: "staff-report-history-test",
          reportDefinitionKey: "invoice_aging",
          rowCount: 1,
        }),
      ],
      workspacePolicy: {
        customSql: false,
        biEmbeds: false,
        scheduledEmailDelivery: false,
        rawReportBodiesInJobMetadata: false,
      },
    });
  });

  it("queues report exports, gates downloads, and keeps job metadata bounded", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: QueuedReportJob[] = [];
    const server = testServer({
      repository,
      reportJobQueue: fakeReportQueue(queuedReports),
    });
    await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-report-private-body",
        matterId: "matter-001",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic private productivity report body",
        billingStatus: "approved",
      },
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/reports/export-requests",
      payload: {
        reportDefinitionKey: "productivity",
        exportProfileId: "summary_json",
        groupingKey: "staff_member",
        idempotencyKey: "staff-report-export-route-test",
      },
    });

    expect(created.statusCode).toBe(202);
    const exportRequest = created.json<{
      exportRequest: { jobId: string; status: string; pollUrl: string; downloadUrl: string };
    }>().exportRequest;
    expect(exportRequest).toMatchObject({
      status: "queued",
      pollUrl: `/api/reports/export-requests/${exportRequest.jobId}`,
      downloadUrl: `/api/reports/export-requests/${exportRequest.jobId}/download`,
    });
    expect(queuedReports).toEqual([
      expect.objectContaining({
        name: "staff_report_export",
        jobId: exportRequest.jobId,
      }),
    ]);
    expect(JSON.stringify(queuedReports)).not.toContain("Synthetic private productivity");

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: exportRequest.jobId,
      jobName: "staff_report_export",
      status: "queued",
      targetResourceType: "staff_report_export",
      metadata: {
        reportType: "staff_reporting",
        reportDefinitionKey: "productivity",
        exportProfileId: "summary_json",
        groupingKey: "staff_member",
        requestedByUserId: "user-admin",
        enqueueStatus: "queued_for_local_report_worker",
      },
    });
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic private productivity");

    const earlyDownload = await server.inject({
      method: "GET",
      url: `/api/reports/export-requests/${exportRequest.jobId}/download`,
    });
    expect(earlyDownload.statusCode).toBe(409);
    expect(earlyDownload.json()).toMatchObject({ code: "REPORT_EXPORT_NOT_READY" });

    await repository.updateJobLifecycleRecord("firm-west-legal", exportRequest.jobId, {
      status: "completed",
      finishedAt: "2026-05-28T12:00:00.000Z",
      metadata: {
        reportType: "staff_reporting",
        reportDefinitionKey: "productivity",
        exportProfileId: "summary_json",
        groupingKey: "staff_member",
        rowCount: 2,
      },
    });

    const downloaded = await server.inject({
      method: "GET",
      url: `/api/reports/export-requests/${exportRequest.jobId}/download`,
    });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.json()).toMatchObject({
      exportRequest: { jobId: exportRequest.jobId, status: "completed", rowCount: 2 },
      export: {
        reportType: "staff_reporting",
        exportProfile: expect.objectContaining({ id: "summary_json" }),
        report: expect.objectContaining({
          definitionKey: "productivity",
          rows: expect.arrayContaining([
            expect.objectContaining({
              userId: "user-licensee",
              metadata: expect.objectContaining({ billableMinutes: expect.any(Number) }),
            }),
          ]),
        }),
      },
    });

    const serializedAuditAndJobs = JSON.stringify({
      events: await auditEvents(repository),
      jobs: await repository.listJobLifecycleRecords("firm-west-legal"),
    });
    expect(serializedAuditAndJobs).not.toContain("Synthetic private productivity");
  });

  it("denies staff reports to users without firm reporting access", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/reports/workspace",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
