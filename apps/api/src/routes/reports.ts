import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildStaffReportProjection,
  buildStaffReportingWorkspace,
  getStaffSavedReportDefinition,
  isStaffReportDefinitionKey,
  isStaffReportExportProfileId,
  isStaffReportGroupingKey,
  STAFF_REPORT_EXPORT_PROFILES,
  type JobLifecycleRecord,
  type StaffReportDefinitionKey,
  type StaffReportExportProfileId,
  type StaffReportGroupingKey,
  type StaffReportHistoryItem,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const reportDefinitionKeySchema = z.enum([
  "invoice_aging",
  "reconciliation_freshness",
  "productivity",
  "operational_follow_up",
]);

const exportProfileIdSchema = z.enum(["summary_json", "review_csv"]);

const groupingKeySchema = z.enum(["aging_bucket", "account", "staff_member", "priority", "matter"]);

const reportExportRequestBodySchema = z
  .object({
    reportDefinitionKey: reportDefinitionKeySchema,
    exportProfileId: exportProfileIdSchema.default("summary_json"),
    groupingKey: groupingKeySchema.optional(),
    idempotencyKey: z.string().min(1).max(160).optional(),
  })
  .strict();

const reportExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
});

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function assertStaffReportAccess(context: ApiAuthContext, action: "read" | "export"): void {
  const access = requireAccess(context, { resource: "report", action });
  if (!access.ok) throw access.error;
  if (!hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(403, "REPORT_ACCESS_REQUIRED", "Report access required");
  }
}

function staffReportExportJobId(): string {
  return `staff-report-export-${crypto.randomUUID()}`;
}

function reportRequestFingerprint(input: {
  auth: ApiAuthContext;
  definitionKey: StaffReportDefinitionKey;
  exportProfileId: StaffReportExportProfileId;
  groupingKey: StaffReportGroupingKey;
}): string {
  return [
    "staff-report",
    input.auth.firmId,
    input.auth.user.id,
    input.definitionKey,
    input.exportProfileId,
    input.groupingKey,
  ].join(":");
}

function metadataDefinitionKey(job: JobLifecycleRecord): StaffReportDefinitionKey | undefined {
  const value = job.metadata.reportDefinitionKey;
  return typeof value === "string" && isStaffReportDefinitionKey(value) ? value : undefined;
}

function metadataExportProfileId(job: JobLifecycleRecord): StaffReportExportProfileId | undefined {
  const value = job.metadata.exportProfileId;
  return typeof value === "string" && isStaffReportExportProfileId(value) ? value : undefined;
}

function metadataGroupingKey(job: JobLifecycleRecord): StaffReportGroupingKey | undefined {
  const value = job.metadata.groupingKey;
  return typeof value === "string" && isStaffReportGroupingKey(value) ? value : undefined;
}

function metadataNumber(job: JobLifecycleRecord, key: string): number | undefined {
  const value = job.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function serializeReportExportRequest(job: JobLifecycleRecord): StaffReportHistoryItem {
  return {
    id: job.id,
    jobId: job.id,
    status: job.status,
    reportDefinitionKey: metadataDefinitionKey(job),
    exportProfileId: metadataExportProfileId(job),
    groupingKey: metadataGroupingKey(job),
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    rowCount: metadataNumber(job, "rowCount"),
    pollUrl: `/api/reports/export-requests/${job.id}`,
    downloadUrl: `/api/reports/export-requests/${job.id}/download`,
  };
}

async function listStaffReportJobs(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
): Promise<JobLifecycleRecord[]> {
  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" }))
    .filter((job) => job.jobName === "staff_report_export")
    .sort((left, right) => Date.parse(right.queuedAt) - Date.parse(left.queuedAt));
}

async function findStaffReportExportJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
): Promise<JobLifecycleRecord | undefined> {
  return (await listStaffReportJobs(repository, firmId)).find((job) => job.id === jobId);
}

async function loadStaffReportProjectionInput(input: {
  repository: ApiRouteDependencies["repository"];
  auth: ApiAuthContext;
}) {
  const overview = await input.repository.getOverview(input.auth.firmId);
  const firmWideMatterReader =
    overview.users.find((user) => user.role === "owner_admin") ??
    overview.users.find((user) => user.role === "auditor") ??
    input.auth.user;
  const [matters, invoices, ledger, reconciliations, timeEntries, taskDeadlines] =
    await Promise.all([
      input.repository.listMattersForUser(firmWideMatterReader),
      input.repository.listInvoices(input.auth.firmId),
      input.repository.getLedger(input.auth.firmId),
      input.repository.listLedgerReconciliations(input.auth.firmId),
      input.repository.listTimeEntries(input.auth.firmId),
      input.repository.listTaskDeadlines(input.auth.firmId, { includeCompleted: true }),
    ]);

  return {
    firmId: input.auth.firmId,
    matters,
    users: overview.users,
    invoices,
    ledgerAccounts: ledger.accounts,
    reconciliations,
    timeEntries,
    taskDeadlines,
  };
}

export function registerReportRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/reports/workspace", async (request) => {
    assertStaffReportAccess(request.auth, "read");
    const generatedAt = new Date().toISOString();
    const [projectionInput, jobs] = await Promise.all([
      loadStaffReportProjectionInput({ repository, auth: request.auth }),
      listStaffReportJobs(repository, request.auth.firmId),
    ]);

    return buildStaffReportingWorkspace({
      ...projectionInput,
      generatedAt,
      history: jobs.map(serializeReportExportRequest),
    });
  });

  server.post("/api/reports/export-requests", async (request, reply) => {
    assertStaffReportAccess(request.auth, "export");
    const body = parseRequestPart(reportExportRequestBodySchema, request.body, "body");
    const definition = getStaffSavedReportDefinition(body.reportDefinitionKey);
    if (!definition.exportProfileIds.includes(body.exportProfileId)) {
      throw new ApiHttpError(
        400,
        "REPORT_EXPORT_PROFILE_UNSUPPORTED",
        "Report export profile is not available for this definition",
      );
    }
    const groupingKey = body.groupingKey ?? definition.defaultGrouping;
    if (!definition.groupings.some((grouping) => grouping.key === groupingKey)) {
      throw new ApiHttpError(
        400,
        "REPORT_GROUPING_UNSUPPORTED",
        "Report grouping is not available for this definition",
      );
    }

    const jobId = staffReportExportJobId();
    const queueConfigured = Boolean(reportJobQueue);
    const now = new Date().toISOString();
    const idempotencyKey =
      body.idempotencyKey ??
      `staff-report-export:${request.auth.user.id}:${body.reportDefinitionKey}:${body.exportProfileId}:${now.slice(
        0,
        10,
      )}`;
    const metadata = compactMetadata({
      reportType: "staff_reporting",
      reportDefinitionKey: body.reportDefinitionKey,
      exportProfileId: body.exportProfileId,
      groupingKey,
      requestedByUserId: request.auth.user.id,
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      idempotencyFingerprint: reportRequestFingerprint({
        auth: request.auth,
        definitionKey: body.reportDefinitionKey,
        exportProfileId: body.exportProfileId,
        groupingKey,
      }),
    });

    const job = await repository.createJobLifecycleRecord({
      id: jobId,
      firmId: request.auth.firmId,
      queueName: "reports",
      jobName: "staff_report_export",
      bullJobId: queueConfigured ? jobId : undefined,
      idempotencyKey,
      status: queueConfigured ? "queued" : "completed",
      targetResourceType: "staff_report_export",
      targetResourceId: jobId,
      attemptsMade: 0,
      maxAttempts: queueConfigured ? 2 : 1,
      queuedAt: now,
      finishedAt: queueConfigured ? undefined : now,
      metadata,
    });

    if (reportJobQueue && job.id === jobId) {
      try {
        await reportJobQueue.add(
          "staff_report_export",
          {
            firmId: request.auth.firmId,
            resourceType: "staff_report_export",
            resourceId: job.id,
            metadata: compactMetadata({
              reportType: "staff_reporting",
              reportDefinitionKey: body.reportDefinitionKey,
              exportProfileId: body.exportProfileId,
              groupingKey,
              requestedByUserId: request.auth.user.id,
            }),
          },
          { jobId: job.id },
        );
      } catch (error) {
        await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
          status: "failed",
          failedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "staff_report_export.requested",
      resourceType: "staff_report_export",
      resourceId: job.id,
      metadata: compactMetadata({
        jobId: job.id,
        reportType: "staff_reporting",
        reportDefinitionKey: body.reportDefinitionKey,
        exportProfileId: body.exportProfileId,
        groupingKey,
        idempotencyKeyPresent: Boolean(body.idempotencyKey),
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      }),
    });

    reply.status(202);
    return { exportRequest: serializeReportExportRequest(job) };
  });

  server.get("/api/reports/export-requests/:exportJobId", async (request) => {
    assertStaffReportAccess(request.auth, "read");
    const params = parseRequestPart(reportExportParamsSchema, request.params, "params");
    const job = await findStaffReportExportJob(repository, request.auth.firmId, params.exportJobId);
    if (!job) {
      throw new ApiHttpError(404, "REPORT_EXPORT_NOT_FOUND", "Report export was not found");
    }
    return { exportRequest: serializeReportExportRequest(job) };
  });

  server.get("/api/reports/export-requests/:exportJobId/download", async (request) => {
    assertStaffReportAccess(request.auth, "read");
    const params = parseRequestPart(reportExportParamsSchema, request.params, "params");
    const job = await findStaffReportExportJob(repository, request.auth.firmId, params.exportJobId);
    if (!job) {
      throw new ApiHttpError(404, "REPORT_EXPORT_NOT_FOUND", "Report export was not found");
    }
    if (job.status === "failed" || job.status === "dead_letter") {
      throw new ApiHttpError(409, "REPORT_EXPORT_FAILED", "Report export did not complete");
    }
    if (job.status !== "completed") {
      throw new ApiHttpError(409, "REPORT_EXPORT_NOT_READY", "Report export is not ready yet");
    }

    const reportDefinitionKey = metadataDefinitionKey(job);
    const exportProfileId = metadataExportProfileId(job);
    if (!reportDefinitionKey || !exportProfileId) {
      throw new ApiHttpError(
        409,
        "REPORT_EXPORT_METADATA_INVALID",
        "Report export metadata is incomplete",
      );
    }
    const definition = getStaffSavedReportDefinition(reportDefinitionKey);
    const groupingKey = metadataGroupingKey(job) ?? definition.defaultGrouping;
    const projectionInput = await loadStaffReportProjectionInput({
      repository,
      auth: request.auth,
    });
    const profile = STAFF_REPORT_EXPORT_PROFILES.find(
      (candidate) => candidate.id === exportProfileId,
    );

    return {
      exportRequest: serializeReportExportRequest(job),
      export: {
        reportType: "staff_reporting",
        exportProfile: profile,
        report: buildStaffReportProjection({
          ...projectionInput,
          definitionKey: reportDefinitionKey,
          groupingKey,
        }),
      },
    };
  });
}
