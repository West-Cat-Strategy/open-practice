import type {
  ConversationMessageNotificationRecord,
  ConversationMessageRecord,
  ConversationThreadRecord,
} from "@open-practice/domain";

export type ConversationThreadLifecycleAction =
  | "close"
  | "reopen"
  | "revoke_access"
  | "request_export";

export function applyConversationThreadLifecycleAction(
  thread: ConversationThreadRecord,
  input: {
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  },
): ConversationThreadRecord {
  const accessRevoked = thread.status === "revoked" || Boolean(thread.accessRevokedAt);
  if (accessRevoked && input.action === "reopen") {
    throw new Error("CONVERSATION_THREAD_REVOKED");
  }

  const updated: ConversationThreadRecord = {
    ...thread,
    updatedAt: input.occurredAt,
    updatedByUserId: input.actorUserId,
  };

  if (input.action === "close") return accessRevoked ? updated : { ...updated, status: "closed" };
  if (input.action === "reopen") return { ...updated, status: "open" };
  if (input.action === "revoke_access") {
    return {
      ...updated,
      status: "revoked",
      accessRevokedAt: thread.accessRevokedAt ?? input.occurredAt,
    };
  }
  return { ...updated, exportState: "requested" };
}

export interface ConversationThreadRepository {
  listConversationThreads(
    firmId: string,
    options?: { matterIds?: string[]; matterId?: string },
  ): Promise<ConversationThreadRecord[]>;
  getConversationThread(
    firmId: string,
    threadId: string,
  ): Promise<ConversationThreadRecord | undefined>;
  createConversationThread(thread: ConversationThreadRecord): Promise<ConversationThreadRecord>;
  updateConversationThreadLifecycle(input: {
    firmId: string;
    threadId: string;
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationThreadRecord | undefined>;
  createConversationMessageNotifications(input: {
    firmId: string;
    threadId: string;
    messageId: string;
    matterId: string;
    notificationBoundary: ConversationThreadRecord["notificationBoundary"];
    createdAt: string;
    createdByUserId: string;
  }): Promise<ConversationMessageNotificationRecord[]>;
  listConversationMessageNotifications(
    firmId: string,
    options?: {
      threadId?: string;
      matterId?: string;
      recipientUserId?: string;
      messageId?: string;
    },
  ): Promise<ConversationMessageNotificationRecord[]>;
  updateConversationMessageNotificationPosture(input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationMessageNotificationRecord | undefined>;
  listConversationMessages(
    firmId: string,
    options: { threadId?: string; matterId?: string },
  ): Promise<ConversationMessageRecord[]>;
  createConversationMessage(message: ConversationMessageRecord): Promise<ConversationMessageRecord>;
}
