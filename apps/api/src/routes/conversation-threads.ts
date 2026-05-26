import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildRedactedConversationExportArtifact,
  conversationMessageAuditMetadata,
  conversationThreadAuditMetadata,
  type ConversationMessageRecord,
  type ConversationThreadRecord,
  type JobLifecycleRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const conversationThreadsQuerySchema = z.object({
  matterId: z.string().min(1),
});

const conversationThreadParamsSchema = z.object({
  id: z.string().min(1),
});

const createConversationThreadBodySchema = z.object({
  matterId: z.string().min(1),
  topic: z.string().trim().min(1).max(160),
  retentionUntil: z.string().datetime().optional(),
  exportState: z.enum(["not_requested", "requested", "exported"]).default("not_requested"),
  notificationBoundary: z.enum(["disabled", "internal_only"]).default("disabled"),
});

const conversationThreadLifecycleBodySchema = z.object({
  action: z.enum(["close", "reopen", "revoke_access", "request_export"]),
});
type ConversationThreadLifecycleAction = z.infer<
  typeof conversationThreadLifecycleBodySchema
>["action"];

const createConversationMessageBodySchema = z.object({
  bodyText: z.string().trim().min(1).max(4000),
  kind: z.enum(["internal_note", "client_message", "imported_email"]).default("internal_note"),
  authoredAt: z.string().datetime().optional(),
});

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

function assertConversationThreadAccess(
  context: ApiAuthContext,
  action: "create" | "read" | "update" | "export",
  matterId: string,
): void {
  const access = requireAccess(context, { resource: "conversation_thread", action, matterId });
  if (!access.ok) throw access.error;
}

async function getAuthorizedThread(
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
  assertConversationThreadAccess(context, "read", thread.matterId);
  return thread;
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

function actionAccess(action: ConversationThreadLifecycleAction): "update" | "export" {
  return action === "request_export" ? "export" : "update";
}

function auditAction(action: ConversationThreadLifecycleAction): string {
  if (action === "close") return "conversation_thread.closed";
  if (action === "reopen") return "conversation_thread.reopened";
  if (action === "revoke_access") return "conversation_thread.access_revoked";
  return "conversation_thread.export_requested";
}

function serializeThread(thread: ConversationThreadRecord) {
  return {
    id: thread.id,
    matterId: thread.matterId,
    topic: thread.topic,
    status: thread.status,
    retentionUntil: thread.retentionUntil,
    exportState: thread.exportState,
    accessRevokedAt: thread.accessRevokedAt,
    notificationBoundary: thread.notificationBoundary,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    createdByUserId: thread.createdByUserId,
    updatedByUserId: thread.updatedByUserId,
  };
}

function serializeMessage(message: ConversationMessageRecord) {
  return {
    id: message.id,
    matterId: message.matterId,
    threadId: message.threadId,
    kind: message.kind,
    bodyText: message.bodyText,
    authoredAt: message.authoredAt,
    authoredByUserId: message.authoredByUserId,
    createdAt: message.createdAt,
    createdByUserId: message.createdByUserId,
  };
}

function assertMessageReadAllowed(thread: ConversationThreadRecord): void {
  if (thread.status !== "revoked" && !thread.accessRevokedAt) return;
  throw new ApiHttpError(
    409,
    "CONVERSATION_THREAD_ACCESS_REVOKED",
    "Conversation thread message access has been revoked",
    { threadId: thread.id },
  );
}

function assertMessageCreateAllowed(thread: ConversationThreadRecord, now: string): void {
  if (thread.status !== "open") {
    throw new ApiHttpError(
      409,
      "CONVERSATION_THREAD_NOT_OPEN",
      "Conversation messages can only be added to an open thread",
      { threadId: thread.id, status: thread.status },
    );
  }
  if (thread.retentionUntil && Date.parse(thread.retentionUntil) <= Date.parse(now)) {
    throw new ApiHttpError(
      409,
      "CONVERSATION_THREAD_RETENTION_EXPIRED",
      "Conversation thread retention boundary has expired",
      { threadId: thread.id },
    );
  }
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

export function registerConversationThreadRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/conversation-threads", async (request) => {
    const query = parseRequestPart(conversationThreadsQuerySchema, request.query, "query");
    assertConversationThreadAccess(request.auth, "read", query.matterId);
    const threads = await repository.listConversationThreads(request.auth.firmId, {
      matterId: query.matterId,
    });
    return { threads: threads.map(serializeThread) };
  });

  server.get("/api/conversation-threads/:id", async (request) => {
    const params = parseRequestPart(conversationThreadParamsSchema, request.params, "params");
    return {
      thread: serializeThread(await getAuthorizedThread(repository, request.auth, params.id)),
    };
  });

  server.get("/api/conversation-threads/:id/messages", async (request) => {
    const params = parseRequestPart(conversationThreadParamsSchema, request.params, "params");
    const thread = await getAuthorizedThread(repository, request.auth, params.id);
    assertMessageReadAllowed(thread);
    const messages = await repository.listConversationMessages(request.auth.firmId, {
      threadId: thread.id,
    });
    return { messages: messages.map(serializeMessage) };
  });

  server.post("/api/conversation-threads", async (request, reply) => {
    const body = parseRequestPart(createConversationThreadBodySchema, request.body, "body");
    assertConversationThreadAccess(request.auth, "create", body.matterId);

    const now = new Date().toISOString();
    if (body.retentionUntil && Date.parse(body.retentionUntil) <= Date.parse(now)) {
      throw new ApiHttpError(
        400,
        "CONVERSATION_THREAD_RETENTION_EXPIRED",
        "Conversation thread retention boundary must be in the future",
        { matterId: body.matterId },
      );
    }

    const thread: ConversationThreadRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      topic: body.topic,
      status: "open",
      retentionUntil: body.retentionUntil,
      exportState: body.exportState,
      notificationBoundary: body.notificationBoundary,
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      metadata: {},
    };
    const created = await repository.createConversationThread(thread);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "conversation_thread.created",
      resourceType: "conversation_thread",
      resourceId: created.id,
      metadata: conversationThreadAuditMetadata(created),
    });

    reply.code(201);
    return { thread: serializeThread(created) };
  });

  server.post("/api/conversation-threads/:id/messages", async (request, reply) => {
    const params = parseRequestPart(conversationThreadParamsSchema, request.params, "params");
    const body = parseRequestPart(createConversationMessageBodySchema, request.body, "body");
    const thread = await getAuthorizedThread(repository, request.auth, params.id);
    assertConversationThreadAccess(request.auth, "update", thread.matterId);
    const now = new Date().toISOString();
    assertMessageCreateAllowed(thread, now);
    const authoredAt = body.authoredAt ?? now;
    const message: ConversationMessageRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: thread.matterId,
      threadId: thread.id,
      kind: body.kind,
      bodyText: body.bodyText,
      authoredAt,
      authoredByUserId: request.auth.user.id,
      createdAt: now,
      createdByUserId: request.auth.user.id,
      metadata: {},
    };
    const created = await repository.createConversationMessage(message);
    const notifications = await repository.listConversationMessageNotifications(
      request.auth.firmId,
      {
        messageId: created.id,
      },
    );
    const notificationSummary = {
      notificationBoundary: thread.notificationBoundary,
      notificationCount: notifications.length,
      unreadNotificationCount: notifications.filter((notification) => !notification.readAt).length,
      mutedNotificationCount: notifications.filter((notification) => Boolean(notification.mutedAt))
        .length,
    };
    await appendRouteAuditEvent(repository, request.auth, {
      action: "conversation_message.created",
      resourceType: "conversation_message",
      resourceId: created.id,
      occurredAt: created.createdAt,
      metadata: conversationMessageAuditMetadata(created, notificationSummary),
    });

    reply.code(201);
    return { message: serializeMessage(created) };
  });

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

    const job = await repository.createJobLifecycleRecord({
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

    if (reportJobQueue && job.id === jobId) {
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

  server.patch("/api/conversation-threads/:id/lifecycle", async (request) => {
    const params = parseRequestPart(conversationThreadParamsSchema, request.params, "params");
    const body = parseRequestPart(conversationThreadLifecycleBodySchema, request.body, "body");
    const thread = await getAuthorizedThread(repository, request.auth, params.id);
    assertConversationThreadAccess(request.auth, actionAccess(body.action), thread.matterId);

    const occurredAt = new Date().toISOString();
    let updated: ConversationThreadRecord | undefined;
    try {
      updated = await repository.updateConversationThreadLifecycle({
        firmId: request.auth.firmId,
        threadId: params.id,
        action: body.action,
        occurredAt,
        actorUserId: request.auth.user.id,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "CONVERSATION_THREAD_REVOKED") {
        throw new ApiHttpError(
          409,
          "CONVERSATION_THREAD_REVOKED",
          "Revoked conversation thread access cannot be reopened",
          { threadId: params.id },
        );
      }
      throw error;
    }
    if (!updated) {
      throw new ApiHttpError(
        404,
        "CONVERSATION_THREAD_NOT_FOUND",
        "Conversation thread was not found",
        { threadId: params.id },
      );
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: auditAction(body.action),
      resourceType: "conversation_thread",
      resourceId: updated.id,
      occurredAt: updated.updatedAt,
      metadata: {
        ...conversationThreadAuditMetadata(updated),
        lifecycleAction: body.action,
      },
    });

    return { thread: serializeThread(updated) };
  });
}
