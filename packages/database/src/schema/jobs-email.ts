import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { EmailReceiptTokenRecord } from "@open-practice/domain";
import { firms } from "./core.js";
import { jobLifecycleStatus, jobQueueName } from "./enums.js";
import { matters } from "./matters.js";

export const jobLifecycleRecords = pgTable(
  "job_lifecycle_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    queueName: jobQueueName("queue_name").notNull(),
    jobName: text("job_name").notNull(),
    bullJobId: text("bull_job_id"),
    idempotencyKey: text("idempotency_key"),
    status: jobLifecycleStatus("status").notNull().default("queued"),
    targetResourceType: text("target_resource_type"),
    targetResourceId: text("target_resource_id"),
    attemptsMade: integer("attempts_made").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmStatus: index("job_lifecycle_records_firm_status_idx").on(table.firmId, table.status),
    firmQueueQueued: index("job_lifecycle_records_firm_queue_queued_idx").on(
      table.firmId,
      table.queueName,
      table.queuedAt,
    ),
    bullJobId: index("job_lifecycle_records_bull_job_id_idx").on(table.bullJobId),
    firmIdempotency: uniqueIndex("job_lifecycle_records_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
  }),
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id").references(() => matters.id),
    idempotencyKey: text("idempotency_key"),
    templateKey: text("template_key").notNull(),
    status: text("status").notNull().default("queued"),
    to: jsonb("to_addresses").$type<string[]>().notNull().default([]),
    cc: jsonb("cc_addresses").$type<string[]>().notNull().default([]),
    bcc: jsonb("bcc_addresses").$type<string[]>().notNull().default([]),
    from: text("from_address").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull(),
    relatedResourceType: text("related_resource_type"),
    relatedResourceId: text("related_resource_id"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    terminalFailureAt: timestamp("terminal_failure_at", { withTimezone: true }),
    terminalFailureReason: text("terminal_failure_reason"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("email_outbox_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
    firmStatus: index("email_outbox_firm_status_idx").on(table.firmId, table.status),
    firmMatterQueued: index("email_outbox_firm_matter_queued_idx").on(
      table.firmId,
      table.matterId,
      table.queuedAt,
    ),
  }),
);

export const emailReceiptTokens = pgTable(
  "email_receipt_tokens",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    emailId: text("email_id")
      .notNull()
      .references(() => emailOutbox.id),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull().default("delivery_receipt"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<EmailReceiptTokenRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    tokenHash: uniqueIndex("email_receipt_tokens_token_hash_idx").on(table.tokenHash),
    emailPurpose: index("email_receipt_tokens_email_purpose_idx").on(
      table.firmId,
      table.emailId,
      table.purpose,
    ),
    purposeValue: check(
      "email_receipt_tokens_purpose_value",
      sql`${table.purpose} in ('delivery_receipt')`,
    ),
  }),
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    emailId: text("email_id")
      .notNull()
      .references(() => emailOutbox.id),
    eventType: text("event_type").notNull(),
    providerMessageId: text("provider_message_id"),
    attemptNumber: integer("attempt_number"),
    jobId: text("job_id"),
    source: text("source").notNull().default("api"),
    errorMessage: text("error_message"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    emailEvent: index("email_events_email_event_idx").on(table.emailId, table.eventType),
    emailOccurred: index("email_events_email_occurred_idx").on(table.emailId, table.occurredAt),
  }),
);
