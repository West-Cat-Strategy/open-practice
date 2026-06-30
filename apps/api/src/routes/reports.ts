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
  type StaffReportDimensionFilters,
  type StaffReportExportProfileId,
  type StaffReportGroupingKey,
  type StaffReportHistoryItem,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { rethrowIdempotencyConflict } from "./idempotency.js";
import type { ApiRouteDependencies } from "./types.js";

const reportDefinitionKeySchema = z.enum([
  "invoice_aging",
  "aged_receivables",
  "billing_period_lock_impact",
  "reconciliation_freshness",
  "productivity",
  "operational_follow_up",
]);

const exportProfileIdSchema = z.enum(["summary_json", "review_csv"]);

const groupingKeySchema = z.enum([
  "aging_bucket",
  "account",
  "client",
  "staff_member",
  "priority",
  "invoice",
  "lock",
  "matter",
  "source_type",
  "status",
  "jurisdiction",
  "practiceArea",
  "clinicProgramId",
  "restrictedFundReviewStatus",
]);

const dimensionFiltersSchema = z
  .object({
    jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).optional(),
    practiceArea: z.string().trim().min(1).max(120).optional(),
    clinicProgramId: z.string().trim().min(1).max(120).optional(),
    restrictedFundReviewStatus: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const reportExportRequestBodySchema = z
  .object({
    reportDefinitionKey: reportDefinitionKeySchema,
    exportProfileId: exportProfileIdSchema.default("summary_json"),
    groupingKey: groupingKeySchema.optional(),
    dimensionFilters: dimensionFiltersSchema.optional(),
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
  dimensionFilters?: StaffReportDimensionFilters;
}): string {
  return [
    "staff-report",
    input.auth.firmId,
    input.auth.user.id,
    input.definitionKey,
    input.exportProfileId,
    input.groupingKey,
    input.dimensionFilters?.jurisdiction ?? "all",
    input.dimensionFilters?.practiceArea ?? "all",
    input.dimensionFilters?.clinicProgramId ?? "all",
    input.dimensionFilters?.restrictedFundReviewStatus ?? "all",
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

function metadataString(job: JobLifecycleRecord, key: string): string | undefined {
  const value = job.metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function metadataDimensionFilters(job: JobLifecycleRecord): StaffReportDimensionFilters {
  return compactMetadata({
    jurisdiction: metadataString(job, "jurisdiction"),
    practiceArea: metadataString(job, "practiceArea"),
    clinicProgramId: metadataString(job, "clinicProgramId"),
    restrictedFundReviewStatus: metadataString(job, "restrictedFundReviewStatus"),
  }) as StaffReportDimensionFilters;
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
  const matters = await input.repository.listMattersForUser(input.auth.user);
  const visibleMatterIds = new Set(matters.map((matter) => matter.id));
  const visibleMatterIdList = [...visibleMatterIds];
  const [
    contacts,
    invoices,
    ledger,
    reconciliations,
    timeEntries,
    expenseEntries,
    billingPeriodLocks,
    taskDeadlines,
  ] = await Promise.all([
    input.repository.listContactsForUser(input.auth.user),
    input.repository.listInvoices(input.auth.firmId, { matterIds: visibleMatterIdList }),
    input.repository.getLedger(input.auth.firmId),
    input.repository.listLedgerReconciliations(input.auth.firmId),
    input.repository.listTimeEntries(input.auth.firmId, { matterIds: visibleMatterIdList }),
    input.repository.listExpenseEntries(input.auth.firmId, { matterIds: visibleMatterIdList }),
    input.repository.listBillingPeriodLocks(input.auth.firmId),
    input.repository.listTaskDeadlines(input.auth.firmId, { includeCompleted: true }),
  ]);
  const canViewFirmWideLedgerReports =
    input.auth.user.role === "owner_admin" || input.auth.user.role === "auditor";
  const legalClinicMatterProfiles = (
    await Promise.all(
      matters.map((matter) =>
        input.repository.getLegalClinicMatterProfile(input.auth.firmId, matter.id),
      ),
    )
  ).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

  return {
    firmId: input.auth.firmId,
    matters,
    contacts: contacts.map((contact) => ({ id: contact.id, displayName: contact.displayName })),
    users: overview.users,
    invoices,
    ledgerAccounts: canViewFirmWideLedgerReports ? ledger.accounts : [],
    ledgerEntries: canViewFirmWideLedgerReports ? ledger.entries : [],
    reconciliations: canViewFirmWideLedgerReports ? reconciliations : [],
    legalClinicMatterProfiles,
    billingPeriodLocks,
    timeEntries,
    expenseEntries,
    taskDeadlines: taskDeadlines.filter((task) => visibleMatterIds.has(task.matterId)),
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
    const dimensionFilters = compactMetadata(
      body.dimensionFilters ?? {},
    ) as StaffReportDimensionFilters;

    const jobId = staffReportExportJobId();
    const queueConfigured = Boolean(reportJobQueue);
    const now = new Date().toISOString();
    const idempotencyKey =
      body.idempotencyKey ??
      [
        "staff-report-export",
        request.auth.user.id,
        body.reportDefinitionKey,
        body.exportProfileId,
        groupingKey,
        dimensionFilters.jurisdiction ?? "all",
        dimensionFilters.practiceArea ?? "all",
        dimensionFilters.clinicProgramId ?? "all",
        dimensionFilters.restrictedFundReviewStatus ?? "all",
        now.slice(0, 10),
      ].join(":");
    const metadata = compactMetadata({
      reportType: "staff_reporting",
      reportDefinitionKey: body.reportDefinitionKey,
      exportProfileId: body.exportProfileId,
      groupingKey,
      jurisdiction: dimensionFilters.jurisdiction,
      practiceArea: dimensionFilters.practiceArea,
      clinicProgramId: dimensionFilters.clinicProgramId,
      restrictedFundReviewStatus: dimensionFilters.restrictedFundReviewStatus,
      requestedByUserId: request.auth.user.id,
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      idempotencyFingerprint: reportRequestFingerprint({
        auth: request.auth,
        definitionKey: body.reportDefinitionKey,
        exportProfileId: body.exportProfileId,
        groupingKey,
        dimensionFilters,
      }),
    });

    let job: JobLifecycleRecord;
    try {
      job = await repository.createJobLifecycleRecord({
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
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    const created = job.id === jobId;

    if (reportJobQueue && created) {
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
              jurisdiction: dimensionFilters.jurisdiction,
              practiceArea: dimensionFilters.practiceArea,
              clinicProgramId: dimensionFilters.clinicProgramId,
              restrictedFundReviewStatus: dimensionFilters.restrictedFundReviewStatus,
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

    if (created) {
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
          jurisdiction: dimensionFilters.jurisdiction,
          practiceArea: dimensionFilters.practiceArea,
          clinicProgramId: dimensionFilters.clinicProgramId,
          restrictedFundReviewStatus: dimensionFilters.restrictedFundReviewStatus,
          idempotencyKeyPresent: Boolean(body.idempotencyKey),
          enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        }),
      });
    }

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
    const dimensionFilters = metadataDimensionFilters(job);
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
          dimensionFilters,
        }),
      },
    };
  });
}
