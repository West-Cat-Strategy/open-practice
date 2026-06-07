import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";
import { documents } from "./documents.js";
import { matters } from "./matters.js";

export const signatureRequests = pgTable("signature_requests", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id),
  title: text("title").notNull(),
  requestedByUserId: text("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  signingUrl: text("signing_url"),
  consentText: text("consent_text").notNull().default(""),
  evidence: jsonb("evidence").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signatureRequestSigners = pgTable("signature_request_signers", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  signatureRequestId: text("signature_request_id")
    .notNull()
    .references(() => signatureRequests.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  signingUrl: text("signing_url"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const signatureProviderEvents = pgTable("signature_provider_events", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  signatureRequestId: text("signature_request_id")
    .notNull()
    .references(() => signatureRequests.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  evidence: jsonb("evidence").notNull(),
});

export const signatureWebhookAttempts = pgTable("signature_webhook_attempts", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  payload: jsonb("payload").notNull(),
});
