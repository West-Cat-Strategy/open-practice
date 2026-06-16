import type { FastifyInstance } from "fastify";
import {
  buildWorkflowHistoryProjection,
  buildWorkflowAuditMetadata,
  canReadJobLifecycleRecord,
  type AuditEvent,
  type User,
} from "@open-practice/domain";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import {
  openPracticeQueueNames,
  queueStatus,
  serializeJobRun,
  summarizeJobRuns,
  summarizeWorkerHealth,
} from "./job-status.js";
import type { ApiRouteDependencies } from "./types.js";

const jobParamsSchema = z.object({ jobId: z.string().min(1) });
const jobQuerySchema = z.object({
  queueName: z.enum(openPracticeQueueNames).optional(),
  status: z.enum(["queued", "active", "completed", "failed", "dead_letter", "skipped"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.preprocess(
    (value) => (typeof value === "string" ? decodeURIComponent(value) : value),
    z.string().datetime().optional(),
  ),
});
const workflowHistoryQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  queueName: z.enum(openPracticeQueueNames).optional(),
  status: z.enum(["queued", "active", "succeeded", "failed", "skipped"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

async function visibleJobPage(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  user: User;
  queueName?: (typeof openPracticeQueueNames)[number];
  status?: "queued" | "active" | "completed" | "failed" | "dead_letter" | "skipped";
  cursor?: string;
  limit: number;
}) {
  const visible = [];
  let cursor = input.cursor;
  const batchLimit = Math.min(Math.max(input.limit + 1, 25), 100);

  while (visible.length <= input.limit) {
    const batch = await input.repository.listJobLifecycleRecords(input.firmId, {
      queueName: input.queueName,
      status: input.status,
      queuedBefore: cursor,
      limit: batchLimit,
    });
    for (const record of batch) {
      if (
        canReadJobLifecycleRecord({
          user: input.user,
          firmId: input.firmId,
          record,
        })
      ) {
        visible.push(record);
      }
      if (visible.length > input.limit) break;
    }
    if (batch.length < batchLimit || visible.length > input.limit) break;
    cursor = batch.at(-1)?.queuedAt;
    if (!cursor) break;
  }

  return visible;
}

function metadataContainsMatterId(value: unknown, matterId: string): boolean {
  if (value === matterId) return true;
  return Array.isArray(value) && value.includes(matterId);
}

function workflowAuditMatterIds(event: AuditEvent): string[] {
  const metadata = buildWorkflowAuditMetadata(event.metadata);
  const matterIds = [
    ...(Array.isArray(metadata.matterIds) ? metadata.matterIds : []),
    metadata.matterId,
  ].filter(
    (matterId): matterId is string => typeof matterId === "string" && matterId.trim() !== "",
  );
  return [...new Set(matterIds)];
}

function canReadWorkflowAuditEvent(input: { user: User; event: AuditEvent }): boolean {
  if (input.user.role === "owner_admin" || input.user.role === "auditor") return true;
  const matterIds = workflowAuditMatterIds(input.event);
  return matterIds.some((matterId) => input.user.assignedMatterIds.includes(matterId));
}

function workflowAuditTouchesMatter(event: AuditEvent, matterId: string): boolean {
  const metadata = buildWorkflowAuditMetadata(event.metadata);
  return (
    (event.resourceType === "matter" && event.resourceId === matterId) ||
    metadataContainsMatterId(metadata.matterId, matterId) ||
    metadataContainsMatterId(metadata.matterIds, matterId)
  );
}

export function registerJobsRoutes(
  server: FastifyInstance,
  {
    repository,
    emailJobQueue,
    connectorJobQueue,
    inboundEmailJobQueue,
    reportJobQueue,
    aiAssistJobQueue,
    ocrJobQueue,
  }: ApiRouteDependencies,
): void {
  function workerQueues() {
    return openPracticeQueueNames.map((queueName) =>
      queueStatus(
        queueName,
        queueName === "email"
          ? emailJobQueue
          : queueName === "connectors"
            ? connectorJobQueue
            : queueName === "inbound_email"
              ? inboundEmailJobQueue
              : queueName === "reports"
                ? reportJobQueue
                : queueName === "ai_triage"
                  ? aiAssistJobQueue
                  : queueName === "ocr"
                    ? ocrJobQueue
                    : undefined,
      ),
    );
  }

  server.get("/api/jobs", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(jobQuerySchema, request.query, "query");

    const visibleJobs = await visibleJobPage({
      repository,
      firmId: request.auth.firmId,
      user: request.auth.user,
      queueName: query.queueName,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    const pageJobs = visibleJobs.slice(0, query.limit);
    const queueSummaries = workerQueues();
    return {
      status: pageJobs.length > 0 ? "available" : "default",
      queues: openPracticeQueueNames,
      workers: queueSummaries.filter((queue) => queue.status === "configured"),
      workerQueues: queueSummaries,
      reservedQueues: queueSummaries.filter((queue) => queue.status === "reserved"),
      summary: summarizeJobRuns(pageJobs),
      pagination: {
        limit: query.limit,
        nextCursor: visibleJobs.length > query.limit ? pageJobs.at(-1)?.queuedAt : undefined,
        hasMore: visibleJobs.length > query.limit,
      },
      jobs: pageJobs.map(serializeJobRun),
    };
  });

  server.get("/api/jobs/health", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;

    const jobs = await repository.listJobLifecycleRecords(request.auth.firmId);
    const visibleJobs = jobs.filter((record) =>
      canReadJobLifecycleRecord({
        user: request.auth.user,
        firmId: request.auth.firmId,
        record,
      }),
    );

    return summarizeWorkerHealth({
      records: visibleJobs,
      workerQueues: workerQueues(),
    });
  });

  server.get("/api/jobs/workflows", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(workflowHistoryQuerySchema, request.query, "query");

    const [jobs, audit] = await Promise.all([
      repository.listJobLifecycleRecords(request.auth.firmId, {
        queueName: query.queueName,
        limit: 100,
      }),
      repository.listAuditEvents(request.auth.firmId),
    ]);
    const visibleJobs = jobs.filter((record) =>
      canReadJobLifecycleRecord({
        user: request.auth.user,
        firmId: request.auth.firmId,
        record,
      }),
    );
    const visibleWorkflowAuditEvents = audit.events.filter((event) => {
      if (!buildWorkflowAuditMetadata(event.metadata).workflowStatus) return false;
      if (query.matterId && !workflowAuditTouchesMatter(event, query.matterId)) return false;
      return canReadWorkflowAuditEvent({ user: request.auth.user, event });
    });

    return buildWorkflowHistoryProjection({
      jobs: visibleJobs,
      auditEvents: visibleWorkflowAuditEvents,
      matterId: query.matterId,
      queueName: query.queueName,
      status: query.status,
      limit: query.limit,
    });
  });

  server.get("/api/jobs/:jobId", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(jobParamsSchema, request.params, "params");

    const job = (await repository.listJobLifecycleRecords(request.auth.firmId)).find(
      (record) => record.id === params.jobId,
    );
    if (
      !job ||
      !canReadJobLifecycleRecord({
        user: request.auth.user,
        firmId: request.auth.firmId,
        record: job,
      })
    ) {
      throw Object.assign(new Error("Job was not found"), { statusCode: 404 });
    }

    return { job: serializeJobRun(job) };
  });
}
