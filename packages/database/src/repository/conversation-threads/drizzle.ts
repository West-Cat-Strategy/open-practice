import {
  canAccess,
  type ConversationMessageNotificationRecord,
  type ConversationMessageRecord,
  type ConversationThreadRecord,
  type User,
} from "@open-practice/domain";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  applyConversationThreadLifecycleAction,
  type ConversationThreadLifecycleAction,
} from "../conversation-threads-contracts.js";
import {
  mapConversationMessageNotificationRow,
  mapConversationMessageRow,
  mapConversationThreadRow,
} from "../drizzle-mappers.js";

export interface DrizzleConversationThreadDependencies {
  listUsers(firmId: string): Promise<User[]>;
}

export async function listDrizzleConversationThreads(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterIds?: string[]; matterId?: string } = {},
): Promise<ConversationThreadRecord[]> {
  const matterIds = options.matterId ? [options.matterId] : options.matterIds;
  const filters = [eq(schema.conversationThreads.firmId, firmId)];
  if (matterIds && matterIds.length > 0) {
    filters.push(inArray(schema.conversationThreads.matterId, matterIds));
  }
  const rows = await db
    .select()
    .from(schema.conversationThreads)
    .where(and(...filters))
    .orderBy(desc(schema.conversationThreads.updatedAt), asc(schema.conversationThreads.topic));
  return rows.map(mapConversationThreadRow);
}

export async function getDrizzleConversationThread(
  db: OpenPracticeDatabase,
  firmId: string,
  threadId: string,
): Promise<ConversationThreadRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.conversationThreads)
    .where(
      and(
        eq(schema.conversationThreads.firmId, firmId),
        eq(schema.conversationThreads.id, threadId),
      ),
    );
  return row ? mapConversationThreadRow(row) : undefined;
}

export async function createDrizzleConversationThread(
  db: OpenPracticeDatabase,
  thread: ConversationThreadRecord,
): Promise<ConversationThreadRecord> {
  const [row] = await db
    .insert(schema.conversationThreads)
    .values({
      ...thread,
      retentionUntil: thread.retentionUntil ? new Date(thread.retentionUntil) : null,
      accessRevokedAt: thread.accessRevokedAt ? new Date(thread.accessRevokedAt) : null,
      createdAt: new Date(thread.createdAt),
      updatedAt: new Date(thread.updatedAt),
    })
    .returning();
  return mapConversationThreadRow(row!);
}

export async function updateDrizzleConversationThreadLifecycle(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    threadId: string;
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  },
): Promise<ConversationThreadRecord | undefined> {
  const existing = await getDrizzleConversationThread(db, input.firmId, input.threadId);
  if (!existing) return undefined;
  const updated = applyConversationThreadLifecycleAction(existing, input);
  const [row] = await db
    .update(schema.conversationThreads)
    .set({
      status: updated.status,
      exportState: updated.exportState,
      accessRevokedAt: updated.accessRevokedAt ? new Date(updated.accessRevokedAt) : null,
      updatedAt: new Date(updated.updatedAt),
      updatedByUserId: updated.updatedByUserId,
    })
    .where(
      and(
        eq(schema.conversationThreads.firmId, input.firmId),
        eq(schema.conversationThreads.id, input.threadId),
      ),
    )
    .returning();
  return row ? mapConversationThreadRow(row) : undefined;
}

export async function createDrizzleConversationMessageNotifications(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    threadId: string;
    messageId: string;
    matterId: string;
    notificationBoundary: ConversationThreadRecord["notificationBoundary"];
    createdAt: string;
    createdByUserId: string;
  },
  dependencies: DrizzleConversationThreadDependencies,
): Promise<ConversationMessageNotificationRecord[]> {
  if (input.notificationBoundary !== "internal_only") return [];

  const [thread, users] = await Promise.all([
    getDrizzleConversationThread(db, input.firmId, input.threadId),
    dependencies.listUsers(input.firmId),
  ]);
  if (!thread) return [];

  const recipients = users.filter(
    (user) =>
      user.id !== input.createdByUserId &&
      canAccess({
        user,
        firmId: input.firmId,
        resource: "conversation_thread",
        action: "read",
        matterId: input.matterId,
      }),
  );
  if (recipients.length === 0) return [];

  const rows = await db.transaction(async (tx) => {
    const inserted: Array<typeof schema.conversationMessageNotifications.$inferSelect> = [];
    for (const recipient of recipients) {
      const [row] = await tx
        .insert(schema.conversationMessageNotifications)
        .values({
          id: `conversation-message-notification-${input.messageId}-${recipient.id}`,
          firmId: input.firmId,
          matterId: input.matterId,
          threadId: input.threadId,
          messageId: input.messageId,
          recipientUserId: recipient.id,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.createdAt),
          createdByUserId: input.createdByUserId,
          updatedByUserId: input.createdByUserId,
          metadata: {},
        })
        .onConflictDoNothing()
        .returning();
      if (row) inserted.push(row);
    }
    return inserted;
  });
  return rows.map(mapConversationMessageNotificationRow);
}

export async function listDrizzleConversationMessageNotifications(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    threadId?: string;
    threadIds?: string[];
    matterId?: string;
    recipientUserId?: string;
    messageId?: string;
  } = {},
): Promise<ConversationMessageNotificationRecord[]> {
  const threadIds = options.threadId ? [options.threadId] : options.threadIds;
  if (threadIds?.length === 0) return [];
  const filters = [eq(schema.conversationMessageNotifications.firmId, firmId)];
  if (threadIds) {
    filters.push(inArray(schema.conversationMessageNotifications.threadId, threadIds));
  }
  if (options.matterId) {
    filters.push(eq(schema.conversationMessageNotifications.matterId, options.matterId));
  }
  if (options.recipientUserId) {
    filters.push(
      eq(schema.conversationMessageNotifications.recipientUserId, options.recipientUserId),
    );
  }
  if (options.messageId) {
    filters.push(eq(schema.conversationMessageNotifications.messageId, options.messageId));
  }
  const rows = await db
    .select()
    .from(schema.conversationMessageNotifications)
    .where(and(...filters))
    .orderBy(
      asc(schema.conversationMessageNotifications.createdAt),
      asc(schema.conversationMessageNotifications.id),
    );
  return rows.map(mapConversationMessageNotificationRow);
}

export async function updateDrizzleConversationMessageNotificationPosture(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  },
): Promise<ConversationMessageNotificationRecord | undefined> {
  const [current] = await db
    .select()
    .from(schema.conversationMessageNotifications)
    .where(
      and(
        eq(schema.conversationMessageNotifications.firmId, input.firmId),
        eq(schema.conversationMessageNotifications.id, input.notificationId),
      ),
    );
  if (!current || current.recipientUserId !== input.actorUserId) return undefined;

  const [row] = await db
    .update(schema.conversationMessageNotifications)
    .set({
      readAt:
        input.action === "mark_read"
          ? (current.readAt ?? new Date(input.occurredAt))
          : current.readAt,
      mutedAt:
        input.action === "mute"
          ? (current.mutedAt ?? new Date(input.occurredAt))
          : input.action === "unmute"
            ? null
            : current.mutedAt,
      updatedAt: new Date(input.occurredAt),
      updatedByUserId: input.actorUserId,
    })
    .where(
      and(
        eq(schema.conversationMessageNotifications.firmId, input.firmId),
        eq(schema.conversationMessageNotifications.id, input.notificationId),
      ),
    )
    .returning();
  return row ? mapConversationMessageNotificationRow(row) : undefined;
}

export async function listDrizzleConversationMessages(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { threadId?: string; threadIds?: string[]; matterId?: string } = {},
): Promise<ConversationMessageRecord[]> {
  const threadIds = options.threadId ? [options.threadId] : options.threadIds;
  if (threadIds?.length === 0) return [];
  const filters = [eq(schema.conversationMessages.firmId, firmId)];
  if (threadIds) filters.push(inArray(schema.conversationMessages.threadId, threadIds));
  if (options.matterId) filters.push(eq(schema.conversationMessages.matterId, options.matterId));
  const rows = await db
    .select()
    .from(schema.conversationMessages)
    .where(and(...filters))
    .orderBy(asc(schema.conversationMessages.authoredAt), asc(schema.conversationMessages.id));
  return rows.map(mapConversationMessageRow);
}

export async function createDrizzleConversationMessage(
  db: OpenPracticeDatabase,
  message: ConversationMessageRecord,
  dependencies: DrizzleConversationThreadDependencies,
): Promise<ConversationMessageRecord> {
  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.conversationMessages)
      .values({
        ...message,
        authoredAt: new Date(message.authoredAt),
        createdAt: new Date(message.createdAt),
      })
      .returning();
    await tx
      .update(schema.conversationThreads)
      .set({
        updatedAt: new Date(message.authoredAt),
        updatedByUserId: message.createdByUserId,
      })
      .where(
        and(
          eq(schema.conversationThreads.firmId, message.firmId),
          eq(schema.conversationThreads.id, message.threadId),
        ),
      );
    return inserted;
  });
  const thread = await getDrizzleConversationThread(db, message.firmId, message.threadId);
  if (thread) {
    await createDrizzleConversationMessageNotifications(
      db,
      {
        firmId: message.firmId,
        threadId: message.threadId,
        messageId: message.id,
        matterId: message.matterId,
        notificationBoundary: thread.notificationBoundary,
        createdAt: message.createdAt,
        createdByUserId: message.createdByUserId,
      },
      dependencies,
    );
  }
  return mapConversationMessageRow(row!);
}
