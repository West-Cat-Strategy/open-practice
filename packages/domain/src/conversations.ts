import type { ConversationMessageRecord, ConversationThreadRecord } from "./models.js";

export type ConversationThreadAuditMetadata = {
  matterId: string;
  threadId: string;
  status: ConversationThreadRecord["status"];
  exportState: ConversationThreadRecord["exportState"];
  retentionBoundary: "set" | "unset";
  notificationBoundary: ConversationThreadRecord["notificationBoundary"];
  accessRevoked: boolean;
};

export function conversationThreadAuditMetadata(
  thread: ConversationThreadRecord,
): ConversationThreadAuditMetadata {
  return {
    matterId: thread.matterId,
    threadId: thread.id,
    status: thread.status,
    exportState: thread.exportState,
    retentionBoundary: thread.retentionUntil ? "set" : "unset",
    notificationBoundary: thread.notificationBoundary,
    accessRevoked: Boolean(thread.accessRevokedAt),
  };
}

export type ConversationMessageAuditMetadata = {
  matterId: string;
  threadId: string;
  messageId: string;
  kind: ConversationMessageRecord["kind"];
  bodyLength: number;
  authoredByUserIdPresent: boolean;
};

export function conversationMessageAuditMetadata(
  message: ConversationMessageRecord,
): ConversationMessageAuditMetadata {
  return {
    matterId: message.matterId,
    threadId: message.threadId,
    messageId: message.id,
    kind: message.kind,
    bodyLength: message.bodyText.length,
    authoredByUserIdPresent: Boolean(message.authoredByUserId),
  };
}
