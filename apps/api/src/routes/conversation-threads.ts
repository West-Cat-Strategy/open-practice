import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  conversationThreadAuditMetadata,
  type ConversationThreadRecord,
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

function assertConversationThreadAccess(
  context: ApiAuthContext,
  action: "create" | "read",
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

export function registerConversationThreadRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
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
}
