import { z } from "zod";
import type { ConversationThreadRecord } from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export const conversationThreadParamsSchema = z.object({
  id: z.string().min(1),
});

export function assertConversationThreadAccess(
  context: ApiAuthContext,
  action: "create" | "read" | "update" | "export",
  matterId: string,
): void {
  const access = requireAccess(context, { resource: "conversation_thread", action, matterId });
  if (!access.ok) throw access.error;
}

export async function getAuthorizedThread(
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

export function serializeThread(thread: ConversationThreadRecord) {
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
