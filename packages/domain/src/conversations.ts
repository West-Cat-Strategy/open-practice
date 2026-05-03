import type { ConversationThreadRecord } from "./models.js";

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
