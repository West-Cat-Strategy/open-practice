import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  conversationThreadAuditMetadata,
  type ConversationThreadRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertConversationThreadAccess,
  conversationThreadParamsSchema,
  getAuthorizedThread,
  serializeThread,
} from "./shared.js";

const conversationThreadLifecycleBodySchema = z.object({
  action: z.enum(["close", "reopen", "revoke_access", "request_export"]),
});
type ConversationThreadLifecycleAction = z.infer<
  typeof conversationThreadLifecycleBodySchema
>["action"];

function actionAccess(action: ConversationThreadLifecycleAction): "update" | "export" {
  return action === "request_export" ? "export" : "update";
}

function auditAction(action: ConversationThreadLifecycleAction): string {
  if (action === "close") return "conversation_thread.closed";
  if (action === "reopen") return "conversation_thread.reopened";
  if (action === "revoke_access") return "conversation_thread.access_revoked";
  return "conversation_thread.export_requested";
}

export function registerConversationThreadLifecycleRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
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
