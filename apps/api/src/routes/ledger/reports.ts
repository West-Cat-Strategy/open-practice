import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JobLifecycleRecord, Province } from "@open-practice/domain";
import { buildJurisdictionalTrustReport, ledgerControlsDiagnostics } from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";

const jurisdictionalTrustReportQuerySchema = z.object({
  jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).optional(),
});

const jurisdictionalTrustExportRequestBodySchema = z
  .object({
    idempotencyKey: z.string().min(1).max(160).optional(),
    jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).optional(),
  })
  .strict();

const jurisdictionalTrustExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
});

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function jurisdictionalTrustExportJobId(): string {
  return `jurisdictional-trust-export-${crypto.randomUUID()}`;
}

function jurisdictionalTrustExportRequestFingerprint(
  auth: ApiAuthContext,
  jurisdiction: Province | undefined,
) {
  return `jurisdictional-trust:${auth.firmId}:${auth.user.id}:${jurisdiction ?? "all"}`;
}

function assertJurisdictionalTrustExportAccess(context: ApiAuthContext): void {
  const access = requireAccess(context, {
    resource: "trust_ledger",
    action: "export",
  });
  if (!access.ok) throw access.error;
  if (!hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(403, "TRUST_LEDGER_ACCESS_REQUIRED", "Trust ledger access required");
  }
}

async function jurisdictionalTrustReportForRequest(input: {
  repository: ApiRouteDependencies["repository"];
  auth: ApiAuthContext;
  jurisdiction?: Province;
}) {
  const [ledger, approvals, reconciliations, matters] = await Promise.all([
    input.repository.getLedger(input.auth.firmId),
    input.repository.listLedgerTransactionApprovals(input.auth.firmId),
    input.repository.listLedgerReconciliations(input.auth.firmId),
    input.repository.listMattersForUser(input.auth.user),
  ]);
  const diagnostics = ledgerControlsDiagnostics({
    ledger,
    approvals,
    reconciliations,
    includeReconciliationDiagnostics: true,
  });

  return buildJurisdictionalTrustReport({
    matters,
    ledger,
    approvals,
    reconciliations,
    diagnostics,
    jurisdiction: input.jurisdiction,
  });
}

async function findJurisdictionalTrustExportJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
): Promise<JobLifecycleRecord | undefined> {
  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" })).find(
    (record) => record.id === jobId && record.jobName === "jurisdictional_trust_export",
  );
}

function jurisdictionalTrustExportJurisdiction(job: JobLifecycleRecord): Province | undefined {
  const value = job.metadata.jurisdiction;
  return value === "BC" || value === "ON" || value === "CANADA" || value === "OTHER"
    ? value
    : undefined;
}

function serializeJurisdictionalTrustExportRequest(job: JobLifecycleRecord) {
  return {
    id: job.id,
    jobId: job.id,
    status: job.status,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/ledger/reports/jurisdictional-trust/export-requests/${job.id}`,
    downloadUrl: `/api/ledger/reports/jurisdictional-trust/export-requests/${job.id}/download`,
  };
}

type LedgerReportRouteDependencies = Pick<ApiRouteDependencies, "repository" | "reportJobQueue">;

export function registerLedgerReportRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: LedgerReportRouteDependencies,
): void {
  server.get("/api/ledger/reports/jurisdictional-trust", async (request) => {
    const query = parseRequestPart(jurisdictionalTrustReportQuerySchema, request.query, "query");
    const access = requireAccess(request.auth, {
      resource: "trust_ledger",
      action: "read",
    });
    if (!access.ok) throw access.error;
    if (!hasFirmWideLedgerAccess(request.auth.user)) {
      throw new ApiHttpError(403, "TRUST_LEDGER_ACCESS_REQUIRED", "Trust ledger access required");
    }

    return jurisdictionalTrustReportForRequest({
      repository,
      auth: request.auth,
      jurisdiction: query.jurisdiction,
    });
  });

  server.post(
    "/api/ledger/reports/jurisdictional-trust/export-requests",
    async (request, reply) => {
      assertJurisdictionalTrustExportAccess(request.auth);
      const body = parseRequestPart(
        jurisdictionalTrustExportRequestBodySchema,
        request.body,
        "body",
      );
      const jobId = jurisdictionalTrustExportJobId();
      const queueConfigured = Boolean(reportJobQueue);
      const now = new Date().toISOString();
      const idempotencyKey =
        body.idempotencyKey ??
        `jurisdictional-trust-export:${request.auth.user.id}:${body.jurisdiction ?? "all"}:${now.slice(
          0,
          10,
        )}`;
      const metadata = compactMetadata({
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        jurisdiction: body.jurisdiction,
        requestedByUserId: request.auth.user.id,
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        idempotencyFingerprint: jurisdictionalTrustExportRequestFingerprint(
          request.auth,
          body.jurisdiction,
        ),
      });

      const job = await repository.createJobLifecycleRecord({
        id: jobId,
        firmId: request.auth.firmId,
        queueName: "reports",
        jobName: "jurisdictional_trust_export",
        bullJobId: queueConfigured ? jobId : undefined,
        idempotencyKey,
        status: queueConfigured ? "queued" : "completed",
        targetResourceType: "jurisdictional_trust_export",
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
            "jurisdictional_trust_export",
            {
              firmId: request.auth.firmId,
              resourceType: "jurisdictional_trust_export",
              resourceId: job.id,
              metadata: compactMetadata({
                reportType: "jurisdictional_trust",
                reportScope: "firm",
                jurisdiction: body.jurisdiction,
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
        action: "jurisdictional_trust_export.requested",
        resourceType: "jurisdictional_trust_export",
        resourceId: job.id,
        metadata: compactMetadata({
          jobId: job.id,
          reportType: "jurisdictional_trust",
          reportScope: "firm",
          jurisdiction: body.jurisdiction,
          idempotencyKeyPresent: Boolean(body.idempotencyKey),
          enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        }),
      });

      reply.status(202);
      return { exportRequest: serializeJurisdictionalTrustExportRequest(job) };
    },
  );

  server.get(
    "/api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId",
    async (request) => {
      assertJurisdictionalTrustExportAccess(request.auth);
      const params = parseRequestPart(
        jurisdictionalTrustExportParamsSchema,
        request.params,
        "params",
      );
      const job = await findJurisdictionalTrustExportJob(
        repository,
        request.auth.firmId,
        params.exportJobId,
      );
      if (!job) {
        throw new ApiHttpError(
          404,
          "JURISDICTIONAL_TRUST_EXPORT_NOT_FOUND",
          "Jurisdictional trust export was not found",
        );
      }
      return { exportRequest: serializeJurisdictionalTrustExportRequest(job) };
    },
  );

  server.get(
    "/api/ledger/reports/jurisdictional-trust/export-requests/:exportJobId/download",
    async (request) => {
      assertJurisdictionalTrustExportAccess(request.auth);
      const params = parseRequestPart(
        jurisdictionalTrustExportParamsSchema,
        request.params,
        "params",
      );
      const job = await findJurisdictionalTrustExportJob(
        repository,
        request.auth.firmId,
        params.exportJobId,
      );
      if (!job) {
        throw new ApiHttpError(
          404,
          "JURISDICTIONAL_TRUST_EXPORT_NOT_FOUND",
          "Jurisdictional trust export was not found",
        );
      }
      if (job.status === "failed" || job.status === "dead_letter") {
        throw new ApiHttpError(
          409,
          "JURISDICTIONAL_TRUST_EXPORT_FAILED",
          "Jurisdictional trust export did not complete",
        );
      }
      if (job.status !== "completed") {
        throw new ApiHttpError(
          409,
          "JURISDICTIONAL_TRUST_EXPORT_NOT_READY",
          "Jurisdictional trust export is not ready yet",
        );
      }

      return {
        exportRequest: serializeJurisdictionalTrustExportRequest(job),
        export: await jurisdictionalTrustReportForRequest({
          repository,
          auth: request.auth,
          jurisdiction: jurisdictionalTrustExportJurisdiction(job),
        }),
      };
    },
  );
}
