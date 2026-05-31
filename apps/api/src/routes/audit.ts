import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import {
  summarizeAuditEventTaxonomy,
  type AuditEvent,
  type ProfessionalRole,
} from "@open-practice/domain";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiJobQueue } from "./types.js";

const auditExportRequestBodySchema = z.object({
  idempotencyKey: z.string().min(1).max(160).optional(),
});

const auditExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
});

const auditListQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

function auditExportJobId(): string {
  return `audit-export-${crypto.randomUUID()}`;
}

function auditExportRequestFingerprint(auth: { firmId: string; user: { id: string } }): string {
  return `audit-log:${auth.firmId}:${auth.user.id}`;
}

async function findAuditExportJob(
  repository: OpenPracticeRepository,
  firmId: string,
  jobId: string,
) {
  const [job] = await repository.listJobLifecycleRecords(firmId, {
    queueName: "reports",
    limit: 1,
  });
  if (job?.id === jobId && job.jobName === "audit_export") return job;

  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" })).find(
    (record) => record.id === jobId && record.jobName === "audit_export",
  );
}

function serializeAuditEvents(
  events: Awaited<ReturnType<OpenPracticeRepository["listAuditEvents"]>>,
) {
  return {
    generatedAt: new Date().toISOString(),
    valid: events.valid,
    taxonomySummary: summarizeAuditEventTaxonomy(events.events),
    events: events.events.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      occurredAt: event.occurredAt,
      metadataKeys: Object.keys(event.metadata).sort(),
      previousHash: event.previousHash,
      hash: event.hash,
    })),
  };
}

function canReadFirmWideAudit(role: ProfessionalRole): boolean {
  return role === "owner_admin" || role === "auditor";
}

function metadataContainsMatterId(value: unknown, matterId: string): boolean {
  if (value === matterId) return true;
  return Array.isArray(value) && value.includes(matterId);
}

function auditEventTouchesMatter(event: AuditEvent, matterId: string): boolean {
  return (
    (event.resourceType === "matter" && event.resourceId === matterId) ||
    metadataContainsMatterId(event.metadata.matterId, matterId) ||
    metadataContainsMatterId(event.metadata.matterIds, matterId) ||
    metadataContainsMatterId(event.metadata.previousMatterId, matterId)
  );
}

function serializeMatterScopedAuditEvents(input: {
  audit: Awaited<ReturnType<OpenPracticeRepository["listAuditEvents"]>>;
  matterId: string;
}) {
  const events = input.audit.events.filter((event) =>
    auditEventTouchesMatter(event, input.matterId),
  );
  return {
    generatedAt: new Date().toISOString(),
    scope: { kind: "matter", matterId: input.matterId },
    chainValidation: "not_shown_for_filtered_view",
    taxonomySummary: summarizeAuditEventTaxonomy(events),
    events: events.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      occurredAt: event.occurredAt,
      metadataKeys: Object.keys(event.metadata).sort(),
    })),
  };
}

export function registerAuditRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository; reportJobQueue?: ApiJobQueue },
): void {
  server.get("/api/audit", async (request) => {
    const query = parseRequestPart(auditListQuerySchema, request.query, "query");
    if (!query.matterId) {
      if (!canReadFirmWideAudit(request.auth.user.role)) {
        throw new ApiHttpError(
          403,
          "FIRM_WIDE_AUDIT_FORBIDDEN",
          "Firm-wide audit logs are restricted to owner administrators and auditors.",
        );
      }
      const access = requireAccess(request.auth, { resource: "audit_log", action: "read" });
      if (!access.ok) throw access.error;
      return serializeAuditEvents(await options.repository.listAuditEvents(request.auth.firmId));
    }

    const matterAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "read",
      matterId: query.matterId,
    });
    if (!matterAccess.ok) throw matterAccess.error;

    return serializeMatterScopedAuditEvents({
      audit: await options.repository.listAuditEvents(request.auth.firmId),
      matterId: query.matterId,
    });
  });

  server.post("/api/audit/export-requests", async (request, reply) => {
    const access = requireAccess(request.auth, { resource: "audit_log", action: "export" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(auditExportRequestBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const audit = await options.repository.listAuditEvents(request.auth.firmId);
    const idempotencyKey =
      body.idempotencyKey ??
      `audit-export:${request.auth.user.id}:${new Date(now).toISOString().slice(0, 10)}`;
    const jobId = auditExportJobId();
    const queueConfigured = Boolean(options.reportJobQueue);
    const metadata = {
      reportType: "audit_log",
      reportScope: "firm",
      requestedByUserId: request.auth.user.id,
      ...(queueConfigured ? {} : { eventCount: audit.events.length }),
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      idempotencyFingerprint: auditExportRequestFingerprint(request.auth),
    };

    const job = await options.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: request.auth.firmId,
      queueName: "reports",
      jobName: "audit_export",
      bullJobId: queueConfigured ? jobId : undefined,
      idempotencyKey,
      status: queueConfigured ? "queued" : "completed",
      targetResourceType: "audit_export",
      targetResourceId: jobId,
      attemptsMade: 0,
      maxAttempts: queueConfigured ? 2 : 1,
      queuedAt: now,
      finishedAt: queueConfigured ? undefined : now,
      metadata,
    });

    if (options.reportJobQueue && job.id === jobId) {
      try {
        await options.reportJobQueue.add(
          "audit_export",
          {
            firmId: request.auth.firmId,
            resourceType: "audit_export",
            resourceId: job.id,
            metadata: {
              reportType: "audit_log",
              reportScope: "firm",
              requestedByUserId: request.auth.user.id,
            },
          },
          { jobId: job.id },
        );
      } catch (error) {
        await options.repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
          status: "failed",
          failedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "audit_export.requested",
      resourceType: "audit_export",
      resourceId: job.id,
      metadata: {
        jobId: job.id,
        reportType: "audit_log",
        reportScope: "firm",
        eventCount: audit.events.length,
        idempotencyKeyPresent: Boolean(body.idempotencyKey),
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      },
    });

    reply.status(202);
    return {
      exportRequest: {
        id: job.id,
        jobId: job.id,
        status: job.status,
        queuedAt: job.queuedAt,
        finishedAt: job.finishedAt,
        pollUrl: `/api/jobs/${job.id}`,
        downloadUrl: `/api/audit/export-requests/${job.id}/download`,
      },
    };
  });

  server.get("/api/audit/export-requests/:exportJobId", async (request) => {
    const access = requireAccess(request.auth, { resource: "audit_log", action: "export" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(auditExportParamsSchema, request.params, "params");
    const job = await findAuditExportJob(
      options.repository,
      request.auth.firmId,
      params.exportJobId,
    );
    if (!job) throw new ApiHttpError(404, "AUDIT_EXPORT_NOT_FOUND", "Audit export was not found");
    return {
      exportRequest: {
        id: job.id,
        jobId: job.id,
        status: job.status,
        queuedAt: job.queuedAt,
        finishedAt: job.finishedAt,
        failedAt: job.failedAt,
        pollUrl: `/api/jobs/${job.id}`,
        downloadUrl: `/api/audit/export-requests/${job.id}/download`,
      },
    };
  });

  server.get("/api/audit/export-requests/:exportJobId/download", async (request) => {
    const access = requireAccess(request.auth, { resource: "audit_log", action: "export" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(auditExportParamsSchema, request.params, "params");
    const job = await findAuditExportJob(
      options.repository,
      request.auth.firmId,
      params.exportJobId,
    );
    if (!job) throw new ApiHttpError(404, "AUDIT_EXPORT_NOT_FOUND", "Audit export was not found");
    if (job.status === "failed" || job.status === "dead_letter") {
      throw new ApiHttpError(409, "AUDIT_EXPORT_FAILED", "Audit export did not complete");
    }
    if (job.status !== "completed") {
      throw new ApiHttpError(409, "AUDIT_EXPORT_NOT_READY", "Audit export is not ready yet");
    }

    return {
      exportRequest: {
        id: job.id,
        jobId: job.id,
        status: job.status,
        queuedAt: job.queuedAt,
        finishedAt: job.finishedAt,
      },
      export: serializeAuditEvents(await options.repository.listAuditEvents(request.auth.firmId)),
    };
  });
}
