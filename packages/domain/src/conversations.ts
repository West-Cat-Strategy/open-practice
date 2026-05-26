import type {
  ConversationMessageNotificationPosture,
  ConversationMessageNotificationRecord,
  ConversationMessageRecord,
  ConversationThreadRecord,
} from "./models.js";

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
  notificationBoundary?: ConversationThreadRecord["notificationBoundary"];
  notificationCount?: number;
  unreadNotificationCount?: number;
  mutedNotificationCount?: number;
};

export function conversationMessageAuditMetadata(
  message: ConversationMessageRecord,
  notificationSummary?: {
    notificationBoundary?: ConversationThreadRecord["notificationBoundary"];
    notificationCount?: number;
    unreadNotificationCount?: number;
    mutedNotificationCount?: number;
  },
): ConversationMessageAuditMetadata {
  return {
    matterId: message.matterId,
    threadId: message.threadId,
    messageId: message.id,
    kind: message.kind,
    bodyLength: message.bodyText.length,
    authoredByUserIdPresent: Boolean(message.authoredByUserId),
    ...notificationSummary,
  };
}

export type ConversationMessageNotificationAuditMetadata = {
  matterId: string;
  threadId: string;
  messageId: string;
  notificationBoundary: ConversationThreadRecord["notificationBoundary"];
  notificationCount: number;
  unreadNotificationCount: number;
  mutedNotificationCount: number;
};

export function conversationMessageNotificationAuditMetadata(input: {
  thread: ConversationThreadRecord;
  message: ConversationMessageRecord;
  notificationCount: number;
  unreadNotificationCount: number;
  mutedNotificationCount: number;
}): ConversationMessageNotificationAuditMetadata {
  return {
    matterId: input.thread.matterId,
    threadId: input.thread.id,
    messageId: input.message.id,
    notificationBoundary: input.thread.notificationBoundary,
    notificationCount: input.notificationCount,
    unreadNotificationCount: input.unreadNotificationCount,
    mutedNotificationCount: input.mutedNotificationCount,
  };
}

export function conversationMessageNotificationPosture(
  notification: ConversationMessageNotificationRecord,
): ConversationMessageNotificationPosture {
  if (notification.mutedAt) return "muted";
  if (notification.readAt) return "read";
  return "unread";
}

export interface RedactedConversationExportArtifact {
  generatedAt: string;
  reportType: "conversation_thread";
  reportScope: "matter";
  redactionPolicy: "message_bodies_and_metadata_values_redacted";
  thread: {
    id: string;
    matterId: string;
    topic: string;
    status: ConversationThreadRecord["status"];
    retentionUntil?: string;
    exportState: ConversationThreadRecord["exportState"];
    accessRevokedAt?: string;
    notificationBoundary: ConversationThreadRecord["notificationBoundary"];
    createdAt: string;
    updatedAt: string;
    createdByUserId: string;
    updatedByUserId: string;
    metadataKeys: string[];
  };
  messageCount: number;
  messages: Array<{
    id: string;
    matterId: string;
    threadId: string;
    kind: ConversationMessageRecord["kind"];
    authoredAt: string;
    authoredByUserId?: string;
    authoredByUserIdPresent: boolean;
    createdAt: string;
    createdByUserId: string;
    bodyLength: number;
    bodyRedacted: true;
    metadataKeys: string[];
  }>;
}

function metadataKeys(metadata: Record<string, unknown>): string[] {
  return Object.keys(metadata).sort();
}

export function buildRedactedConversationExportArtifact(input: {
  thread: ConversationThreadRecord;
  messages: ConversationMessageRecord[];
  generatedAt?: string;
}): RedactedConversationExportArtifact {
  const messages = input.messages.filter(
    (message) =>
      message.firmId === input.thread.firmId &&
      message.matterId === input.thread.matterId &&
      message.threadId === input.thread.id,
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    reportType: "conversation_thread",
    reportScope: "matter",
    redactionPolicy: "message_bodies_and_metadata_values_redacted",
    thread: {
      id: input.thread.id,
      matterId: input.thread.matterId,
      topic: input.thread.topic,
      status: input.thread.status,
      retentionUntil: input.thread.retentionUntil,
      exportState: input.thread.exportState,
      accessRevokedAt: input.thread.accessRevokedAt,
      notificationBoundary: input.thread.notificationBoundary,
      createdAt: input.thread.createdAt,
      updatedAt: input.thread.updatedAt,
      createdByUserId: input.thread.createdByUserId,
      updatedByUserId: input.thread.updatedByUserId,
      metadataKeys: metadataKeys(input.thread.metadata),
    },
    messageCount: messages.length,
    messages: messages.map((message) => ({
      id: message.id,
      matterId: message.matterId,
      threadId: message.threadId,
      kind: message.kind,
      authoredAt: message.authoredAt,
      authoredByUserId: message.authoredByUserId,
      authoredByUserIdPresent: Boolean(message.authoredByUserId),
      createdAt: message.createdAt,
      createdByUserId: message.createdByUserId,
      bodyLength: message.bodyText.length,
      bodyRedacted: true,
      metadataKeys: metadataKeys(message.metadata),
    })),
  };
}
