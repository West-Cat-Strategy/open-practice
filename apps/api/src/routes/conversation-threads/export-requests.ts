import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildRedactedConversationExportArtifact,
  conversationThreadAuditMetadata,
  type ConversationThreadRecord,
  type JobLifecycleRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { rethrowIdempotencyConflict } from "../idempotency.js";
import type { ApiRouteDependencies } from "../types.js";
import { assertConversationThreadAccess, conversationThreadParamsSchema } from "./shared.js";

const conversationExportRequestBodySchema = z
  .object({
    idempotencyKey: z.string().min(1).max(160).optional(),
  })
  .strict();

const conversationExportParamsSchema = z.object({
  id: z.string().min(1),
  exportJobId: z.string().min(1),
});

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

async function getAuthorizedExportThread(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
  threadId: string,
): Promise<ConversationThreadRecord> {
  const thread = await repository.getConversationThread(context.firmId, threadId);
  if (!thread) {
    throw new ApiHttpError(
      404,
      "CONVERSATION_THREAD_NOT_FOUND",
      "Conversation thread was not found",
      { threadId },
    );
  }
  assertConversationThreadAccess(context, "export", thread.matterId);
  return thread;
}

function assertConversationExportAvailable(thread: ConversationThreadRecord): void {
  if (thread.status !== "revoked" && !thread.accessRevokedAt) return;
  throw new ApiHttpError(
    409,
    "CONVERSATION_THREAD_ACCESS_REVOKED",
    "Conversation thread export access has been revoked",
    { threadId: thread.id },
  );
}

function conversationExportJobId(): string {
  return `conversation-thread-export-${crypto.randomUUID()}`;
}

function conversationExportRequestFingerprint(
  auth: ApiAuthContext,
  thread: ConversationThreadRecord,
): string {
  return `conversation-thread:${auth.firmId}:${auth.user.id}:${thread.id}`;
}

function conversationExportThreadId(job: JobLifecycleRecord): string | undefined {
  const value = job.metadata.threadId;
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function findConversationExportJob(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  threadId: string;
  jobId: string;
}): Promise<JobLifecycleRecord | undefined> {
  return (
    await input.repository.listJobLifecycleRecords(input.firmId, { queueName: "reports" })
  ).find(
    (record) =>
      record.id === input.jobId &&
      record.jobName === "conversation_thread_export" &&
      conversationExportThreadId(record) === input.threadId,
  );
}

function serializeConversationExportRequest(job: JobLifecycleRecord, threadId: string) {
  return {
    id: job.id,
    jobId: job.id,
    threadId,
    status: job.status,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/conversation-threads/${threadId}/export-requests/${job.id}`,
    downloadUrl: `/api/conversation-threads/${threadId}/export-requests/${job.id}/download`,
  };
}

export function registerConversationThreadExportRequestRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: ApiRouteDependencies,
): void {
  server.post("/api/conversation-threads/:id/export-requests", async (request, reply) => {
    const params = parseRequestPart(conversationThreadParamsSchema, request.params, "params");
    const body = parseRequestPart(conversationExportRequestBodySchema, request.body, "body");
    const thread = await getAuthorizedExportThread(repository, request.auth, params.id);
    assertConversationExportAvailable(thread);
    const messages = await repository.listConversationMessages(request.auth.firmId, {
      threadId: thread.id,
    });
    const now = new Date().toISOString();
    const jobId = conversationExportJobId();
    const queueConfigured = Boolean(reportJobQueue);
    const idempotencyKey =
      body.idempotencyKey ??
      `conversation-thread-export:${request.auth.user.id}:${thread.id}:${now.slice(0, 10)}`;
    const metadata = compactMetadata({
      reportType: "conversation_thread",
      reportScope: "matter",
      matterId: thread.matterId,
      threadId: thread.id,
      requestedByUserId: request.auth.user.id,
      messageCount: messages.length,
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      idempotencyFingerprint: conversationExportRequestFingerprint(request.auth, thread),
    });

    let job: JobLifecycleRecord;
    try {
      job = await repository.createJobLifecycleRecord({
        id: jobId,
        firmId: request.auth.firmId,
        queueName: "reports",
        jobName: "conversation_thread_export",
        bullJobId: queueConfigured ? jobId : undefined,
        idempotencyKey,
        status: queueConfigured ? "queued" : "completed",
        targetResourceType: "conversation_thread_export",
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
          "conversation_thread_export",
          {
            firmId: request.auth.firmId,
            resourceType: "conversation_thread_export",
            resourceId: job.id,
            metadata: compactMetadata({
              reportType: "conversation_thread",
              reportScope: "matter",
              matterId: thread.matterId,
              threadId: thread.id,
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
        action: "conversation_thread.export_artifact_requested",
        resourceType: "conversation_thread",
        resourceId: thread.id,
        metadata: compactMetadata({
          ...conversationThreadAuditMetadata(thread),
          jobId: job.id,
          reportType: "conversation_thread",
          reportScope: "matter",
          messageCount: messages.length,
          idempotencyKeyPresent: Boolean(body.idempotencyKey),
          enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
        }),
      });
    }

    reply.status(202);
    return { exportRequest: serializeConversationExportRequest(job, thread.id) };
  });

  server.get("/api/conversation-threads/:id/export-requests/:exportJobId", async (request) => {
    const params = parseRequestPart(conversationExportParamsSchema, request.params, "params");
    const thread = await getAuthorizedExportThread(repository, request.auth, params.id);
    assertConversationExportAvailable(thread);
    const job = await findConversationExportJob({
      repository,
      firmId: request.auth.firmId,
      threadId: thread.id,
      jobId: params.exportJobId,
    });
    if (!job) {
      throw new ApiHttpError(
        404,
        "CONVERSATION_EXPORT_NOT_FOUND",
        "Conversation export was not found",
      );
    }
    return { exportRequest: serializeConversationExportRequest(job, thread.id) };
  });

  server.get(
    "/api/conversation-threads/:id/export-requests/:exportJobId/download",
    async (request) => {
      const params = parseRequestPart(conversationExportParamsSchema, request.params, "params");
      const thread = await getAuthorizedExportThread(repository, request.auth, params.id);
      assertConversationExportAvailable(thread);
      const job = await findConversationExportJob({
        repository,
        firmId: request.auth.firmId,
        threadId: thread.id,
        jobId: params.exportJobId,
      });
      if (!job) {
        throw new ApiHttpError(
          404,
          "CONVERSATION_EXPORT_NOT_FOUND",
          "Conversation export was not found",
        );
      }
      if (job.status === "failed" || job.status === "dead_letter") {
        throw new ApiHttpError(
          409,
          "CONVERSATION_EXPORT_FAILED",
          "Conversation export did not complete",
        );
      }
      if (job.status !== "completed") {
        throw new ApiHttpError(
          409,
          "CONVERSATION_EXPORT_NOT_READY",
          "Conversation export is not ready yet",
        );
      }
      const messages = await repository.listConversationMessages(request.auth.firmId, {
        threadId: thread.id,
      });

      return {
        exportRequest: serializeConversationExportRequest(job, thread.id),
        export: buildRedactedConversationExportArtifact({ thread, messages }),
      };
    },
  );
}
