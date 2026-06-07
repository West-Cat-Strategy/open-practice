import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { JobLifecycleRecord } from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";

const billingExportRequestBodySchema = z
  .object({
    idempotencyKey: z.string().min(1).max(160).optional(),
    matterId: z.string().min(1).optional(),
  })
  .strict();

const billingExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
});

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function billingExportJobId(): string {
  return `billing-export-${crypto.randomUUID()}`;
}

function billingExportScope(matterId: string | undefined): "firm" | "matter" {
  return matterId ? "matter" : "firm";
}

function billingExportRequestFingerprint(auth: ApiAuthContext, matterId: string | undefined) {
  return `billing:${auth.firmId}:${auth.user.id}:${matterId ?? "firm"}`;
}

function assertBillingExportAccess(context: ApiAuthContext, matterId: string | undefined): void {
  const access = requireAccess(context, {
    resource: "trust_ledger",
    action: "export",
    matterId,
  });
  if (!access.ok) throw access.error;
  if (!matterId && !hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(403, "BILLING_EXPORT_ACCESS_REQUIRED", "Billing export access required");
  }
}

async function findBillingExportJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
): Promise<JobLifecycleRecord | undefined> {
  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" })).find(
    (record) => record.id === jobId && record.jobName === "billing_export",
  );
}

function billingExportMatterId(job: JobLifecycleRecord): string | undefined {
  const value = job.metadata.matterId;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function serializeBillingExportRequest(job: JobLifecycleRecord) {
  return {
    id: job.id,
    jobId: job.id,
    status: job.status,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/billing/export-requests/${job.id}`,
    downloadUrl: `/api/billing/export-requests/${job.id}/download`,
  };
}

async function serializeBillingExport(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  matterId: string | undefined,
) {
  const scope = billingExportScope(matterId);
  const [timeEntries, expenseEntries, invoices, payments, paymentRequests, trustTransferRequests] =
    await Promise.all([
      repository.listTimeEntries(firmId, matterId ? { matterId } : {}),
      repository.listExpenseEntries(firmId, matterId ? { matterId } : {}),
      repository.listInvoices(firmId, matterId ? { matterId } : {}),
      repository.listPayments(firmId, matterId ? { matterId } : {}),
      repository.listHostedPaymentRequests(firmId, matterId ? { matterId } : {}),
      repository.listTrustTransferRequests(firmId, matterId ? { matterId } : {}),
    ]);

  return compactMetadata({
    generatedAt: new Date().toISOString(),
    reportType: "billing",
    reportScope: scope,
    matterId,
    billingPosture: "operational_records_only_no_live_payment_processing_or_tax_advice",
    trustTransferPolicy: "review_only_no_automatic_trust_ledger_posting",
    timeEntries,
    expenseEntries,
    invoices,
    payments,
    paymentRequests,
    trustTransferRequests,
  });
}

type BillingExportRouteDependencies = Pick<ApiRouteDependencies, "repository" | "reportJobQueue">;

export function createBillingExportRouteHandlers({
  repository,
  reportJobQueue,
}: BillingExportRouteDependencies) {
  return {
    create: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseRequestPart(billingExportRequestBodySchema, request.body, "body");
      assertBillingExportAccess(request.auth, body.matterId);
      const jobId = billingExportJobId();
      const queueConfigured = Boolean(reportJobQueue);
      const scope = billingExportScope(body.matterId);
      const now = new Date().toISOString();
      const idempotencyKey =
        body.idempotencyKey ??
        `billing-export:${request.auth.user.id}:${body.matterId ?? "firm"}:${now.slice(0, 10)}`;
      const metadata = compactMetadata({
        reportType: "billing",
        reportScope: scope,
        matterId: body.matterId,
        requestedByUserId: request.auth.user.id,
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        idempotencyFingerprint: billingExportRequestFingerprint(request.auth, body.matterId),
      });

      const job = await repository.createJobLifecycleRecord({
        id: jobId,
        firmId: request.auth.firmId,
        queueName: "reports",
        jobName: "billing_export",
        bullJobId: queueConfigured ? jobId : undefined,
        idempotencyKey,
        status: queueConfigured ? "queued" : "completed",
        targetResourceType: "billing_export",
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
            "billing_export",
            {
              firmId: request.auth.firmId,
              resourceType: "billing_export",
              resourceId: job.id,
              metadata: compactMetadata({
                reportType: "billing",
                reportScope: scope,
                matterId: body.matterId,
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
        action: "billing_export.requested",
        resourceType: "billing_export",
        resourceId: job.id,
        metadata: compactMetadata({
          jobId: job.id,
          reportType: "billing",
          reportScope: scope,
          matterId: body.matterId,
          idempotencyKeyPresent: Boolean(body.idempotencyKey),
          enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        }),
      });

      reply.status(202);
      return { exportRequest: serializeBillingExportRequest(job) };
    },
    status: async (request: FastifyRequest) => {
      const params = parseRequestPart(billingExportParamsSchema, request.params, "params");
      const job = await findBillingExportJob(repository, request.auth.firmId, params.exportJobId);
      if (!job)
        throw new ApiHttpError(404, "BILLING_EXPORT_NOT_FOUND", "Billing export was not found");
      assertBillingExportAccess(request.auth, billingExportMatterId(job));
      return { exportRequest: serializeBillingExportRequest(job) };
    },
    download: async (request: FastifyRequest) => {
      const params = parseRequestPart(billingExportParamsSchema, request.params, "params");
      const job = await findBillingExportJob(repository, request.auth.firmId, params.exportJobId);
      if (!job)
        throw new ApiHttpError(404, "BILLING_EXPORT_NOT_FOUND", "Billing export was not found");
      const matterId = billingExportMatterId(job);
      assertBillingExportAccess(request.auth, matterId);
      if (job.status === "failed" || job.status === "dead_letter") {
        throw new ApiHttpError(409, "BILLING_EXPORT_FAILED", "Billing export did not complete");
      }
      if (job.status !== "completed") {
        throw new ApiHttpError(409, "BILLING_EXPORT_NOT_READY", "Billing export is not ready yet");
      }

      return {
        exportRequest: serializeBillingExportRequest(job),
        export: await serializeBillingExport(repository, request.auth.firmId, matterId),
      };
    },
  };
}

export function registerBillingExportRoutes(
  server: FastifyInstance,
  dependencies: BillingExportRouteDependencies,
): void {
  const billingExportRoutes = createBillingExportRouteHandlers(dependencies);

  server.post("/api/billing/export-requests", billingExportRoutes.create);

  server.get("/api/billing/export-requests/:exportJobId", billingExportRoutes.status);

  server.get("/api/billing/export-requests/:exportJobId/download", billingExportRoutes.download);
}
