import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  conversationMessageAuditMetadata,
  conversationThreadAuditMetadata,
  type ConversationMessageRecord,
  type ConversationThreadRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { registerConversationThreadExportRequestRoutes } from "./conversation-threads/export-requests.js";
import { registerConversationThreadLifecycleRoutes } from "./conversation-threads/lifecycle.js";
import {
  assertConversationThreadAccess,
  conversationThreadParamsSchema,
  getAuthorizedThread,
  serializeThread,
} from "./conversation-threads/shared.js";
import type { ApiRouteDependencies } from "./types.js";

const conversationThreadsQuerySchema = z.object({
  matterId: z.string().min(1),
});

const createConversationThreadBodySchema = z.object({
  matterId: z.string().min(1),
  topic: z.string().trim().min(1).max(160),
  retentionUntil: z.string().datetime().optional(),
  exportState: z.enum(["not_requested", "requested", "exported"]).default("not_requested"),
  notificationBoundary: z.enum(["disabled", "internal_only"]).default("disabled"),
});

const createConversationMessageBodySchema = z.object({
  bodyText: z.string().trim().min(1).max(4000),
  kind: z.enum(["internal_note", "client_message", "imported_email"]).default("internal_note"),
  authoredAt: z.string().datetime().optional(),
});

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

  registerConversationThreadExportRequestRoutes(server, { repository, reportJobQueue });
  registerConversationThreadLifecycleRoutes(server, { repository });
}
