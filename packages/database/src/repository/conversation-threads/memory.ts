import {
  canAccess,
  type ConversationMessageNotificationRecord,
  type ConversationMessageRecord,
  type ConversationThreadRecord,
  type User,
} from "@open-practice/domain";
import {
  applyConversationThreadLifecycleAction,
  type ConversationThreadLifecycleAction,
} from "../conversation-threads-contracts.js";
import { clone } from "../contracts.js";

export interface MemoryConversationThreadStore {
  conversationThreads: ConversationThreadRecord[];
  conversationMessages: ConversationMessageRecord[];
  conversationMessageNotifications: ConversationMessageNotificationRecord[];
  users: User[];
}

export function listMemoryConversationThreads(
  store: MemoryConversationThreadStore,
  firmId: string,
  options: { matterIds?: string[]; matterId?: string } = {},
): ConversationThreadRecord[] {
  const matterIds = options.matterId ? [options.matterId] : options.matterIds;
  return clone(
    store.conversationThreads
      .filter((thread) => {
        if (thread.firmId !== firmId) return false;
        if (matterIds && !matterIds.includes(thread.matterId)) return false;
        return true;
      })
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) || left.topic.localeCompare(right.topic),
      ),
  );
}

export function getMemoryConversationThread(
  store: MemoryConversationThreadStore,
  firmId: string,
  threadId: string,
): ConversationThreadRecord | undefined {
  return clone(
    store.conversationThreads.find((thread) => thread.firmId === firmId && thread.id === threadId),
  );
}

export function createMemoryConversationThread(
  store: MemoryConversationThreadStore,
  thread: ConversationThreadRecord,
): ConversationThreadRecord {
  if (
    store.conversationThreads.some(
      (candidate) =>
        candidate.firmId === thread.firmId &&
        candidate.matterId === thread.matterId &&
        candidate.topic.trim().toLowerCase() === thread.topic.trim().toLowerCase(),
    )
  ) {
    throw new Error("Conversation thread already exists");
  }
  store.conversationThreads.push(clone(thread));
  return clone(thread);
}

export function updateMemoryConversationThreadLifecycle(
  store: MemoryConversationThreadStore,
  input: {
    firmId: string;
    threadId: string;
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  },
): ConversationThreadRecord | undefined {
  const index = store.conversationThreads.findIndex(
    (thread) => thread.firmId === input.firmId && thread.id === input.threadId,
  );
  if (index < 0) return undefined;
  const updated = applyConversationThreadLifecycleAction(store.conversationThreads[index]!, input);
  store.conversationThreads[index] = clone(updated);
  return clone(updated);
}

export function createMemoryConversationMessageNotifications(
  store: MemoryConversationThreadStore,
  input: {
    firmId: string;
    threadId: string;
    messageId: string;
    matterId: string;
    notificationBoundary: ConversationThreadRecord["notificationBoundary"];
    createdAt: string;
    createdByUserId: string;
  },
): ConversationMessageNotificationRecord[] {
  if (input.notificationBoundary !== "internal_only") return [];

  const recipients = store.users.filter(
    (user) =>
      user.firmId === input.firmId &&
      user.id !== input.createdByUserId &&
      canAccess({
        user,
        firmId: input.firmId,
        resource: "conversation_thread",
        action: "read",
        matterId: input.matterId,
      }),
  );
  const notifications = recipients.map((recipient, index) => ({
    id: `conversation-message-notification-${input.messageId}-${String(index + 1).padStart(2, "0")}`,
    firmId: input.firmId,
    matterId: input.matterId,
    threadId: input.threadId,
    messageId: input.messageId,
    recipientUserId: recipient.id,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    updatedByUserId: input.createdByUserId,
    metadata: {},
  }));
  store.conversationMessageNotifications.push(...notifications.map(clone));
  return notifications.map(clone);
}

export function listMemoryConversationMessageNotifications(
  store: MemoryConversationThreadStore,
  firmId: string,
  options: {
    threadId?: string;
    threadIds?: string[];
    matterId?: string;
    recipientUserId?: string;
    messageId?: string;
  } = {},
): ConversationMessageNotificationRecord[] {
  const threadIds = options.threadId ? [options.threadId] : options.threadIds;
  if (threadIds?.length === 0) return [];
  return clone(
    store.conversationMessageNotifications
      .filter((notification) => {
        if (notification.firmId !== firmId) return false;
        if (threadIds && !threadIds.includes(notification.threadId)) return false;
        if (options.matterId && notification.matterId !== options.matterId) return false;
        if (options.recipientUserId && notification.recipientUserId !== options.recipientUserId)
          return false;
        if (options.messageId && notification.messageId !== options.messageId) return false;
        return true;
      })
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      ),
  );
}

export function updateMemoryConversationMessageNotificationPosture(
  store: MemoryConversationThreadStore,
  input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  },
): ConversationMessageNotificationRecord | undefined {
  const index = store.conversationMessageNotifications.findIndex(
    (notification) =>
      notification.firmId === input.firmId && notification.id === input.notificationId,
  );
  if (index < 0) return undefined;
  const existing = store.conversationMessageNotifications[index]!;
  if (existing.recipientUserId !== input.actorUserId) return undefined;
  const updated = {
    ...existing,
    readAt: input.action === "mark_read" ? (existing.readAt ?? input.occurredAt) : existing.readAt,
    mutedAt:
      input.action === "mute"
        ? (existing.mutedAt ?? input.occurredAt)
        : input.action === "unmute"
          ? undefined
          : existing.mutedAt,
    updatedAt: input.occurredAt,
    updatedByUserId: input.actorUserId,
  };
  store.conversationMessageNotifications[index] = clone(updated);
  return clone(updated);
}

export function listMemoryConversationMessages(
  store: MemoryConversationThreadStore,
  firmId: string,
  options: { threadId?: string; threadIds?: string[]; matterId?: string } = {},
): ConversationMessageRecord[] {
  const threadIds = options.threadId ? [options.threadId] : options.threadIds;
  if (threadIds?.length === 0) return [];
  return clone(
    store.conversationMessages
      .filter((message) => {
        if (message.firmId !== firmId) return false;
        if (threadIds && !threadIds.includes(message.threadId)) return false;
        if (options.matterId && message.matterId !== options.matterId) return false;
        return true;
      })
      .sort(
        (left, right) =>
          left.authoredAt.localeCompare(right.authoredAt) || left.id.localeCompare(right.id),
      ),
  );
}

export function createMemoryConversationMessage(
  store: MemoryConversationThreadStore,
  message: ConversationMessageRecord,
): ConversationMessageRecord {
  store.conversationMessages.push(clone(message));
  const threadIndex = store.conversationThreads.findIndex(
    (thread) => thread.firmId === message.firmId && thread.id === message.threadId,
  );
  if (threadIndex >= 0) {
    store.conversationThreads[threadIndex] = {
      ...store.conversationThreads[threadIndex]!,
      updatedAt: message.authoredAt,
      updatedByUserId: message.createdByUserId,
    };
  }
  const thread = threadIndex >= 0 ? store.conversationThreads[threadIndex] : undefined;
  if (thread) {
    createMemoryConversationMessageNotifications(store, {
      firmId: message.firmId,
      threadId: message.threadId,
      messageId: message.id,
      matterId: message.matterId,
      notificationBoundary: thread.notificationBoundary,
      createdAt: message.createdAt,
      createdByUserId: message.createdByUserId,
    });
  }
  return clone(message);
}
