import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type {
  ConversationMessageNotificationRecord,
  ConversationMessageRecord,
  ConversationThreadRecord,
} from "@open-practice/domain";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const conversationThreadStatus = pgEnum("conversation_thread_status", [
  "open",
  "closed",
  "revoked",
]);
export const conversationThreadExportState = pgEnum("conversation_thread_export_state", [
  "not_requested",
  "requested",
  "exported",
]);
export const conversationThreadNotificationBoundary = pgEnum(
  "conversation_thread_notification_boundary",
  ["disabled", "internal_only"],
);
export const conversationMessageKind = pgEnum("conversation_message_kind", [
  "internal_note",
  "client_message",
  "imported_email",
]);

export const conversationThreads = pgTable(
  "conversation_threads",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    topic: text("topic").notNull(),
    status: conversationThreadStatus("status").notNull().default("open"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    exportState: conversationThreadExportState("export_state").notNull().default("not_requested"),
    accessRevokedAt: timestamp("access_revoked_at", { withTimezone: true }),
    notificationBoundary: conversationThreadNotificationBoundary("notification_boundary")
      .notNull()
      .default("disabled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").$type<ConversationThreadRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmMatterUpdated: index("conversation_threads_firm_matter_updated_idx").on(
      table.firmId,
      table.matterId,
      table.updatedAt,
    ),
    firmMatterTopic: uniqueIndex("conversation_threads_firm_matter_topic_idx").on(
      table.firmId,
      table.matterId,
      table.topic,
    ),
  }),
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    threadId: text("thread_id")
      .notNull()
      .references(() => conversationThreads.id),
    kind: conversationMessageKind("kind").notNull().default("internal_note"),
    bodyText: text("body_text").notNull(),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull(),
    authoredByUserId: text("authored_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata")
      .$type<ConversationMessageRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmMatterThreadAuthored: index("conversation_messages_firm_matter_thread_authored_idx").on(
      table.firmId,
      table.matterId,
      table.threadId,
      table.authoredAt,
    ),
  }),
);

export const conversationMessageNotifications = pgTable(
  "conversation_message_notifications",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    threadId: text("thread_id")
      .notNull()
      .references(() => conversationThreads.id),
    messageId: text("message_id")
      .notNull()
      .references(() => conversationMessages.id),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => users.id),
    readAt: timestamp("read_at", { withTimezone: true }),
    mutedAt: timestamp("muted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata")
      .$type<ConversationMessageNotificationRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmMatterThreadCreated: index(
      "conversation_message_notifications_firm_matter_thread_created_idx",
    ).on(table.firmId, table.matterId, table.threadId, table.createdAt),
    firmRecipientCreated: index("conversation_message_notifications_firm_recipient_created_idx").on(
      table.firmId,
      table.recipientUserId,
      table.createdAt,
    ),
    firmMessageRecipient: uniqueIndex(
      "conversation_message_notifications_firm_message_recipient_idx",
    ).on(table.firmId, table.messageId, table.recipientUserId),
  }),
);
