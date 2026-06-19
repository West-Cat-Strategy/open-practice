import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { SignatureRequestRecord } from "@open-practice/domain";
import { firms, users } from "./core.js";
import { documents } from "./documents.js";
import { matters } from "./matters.js";

export const signatureRequests = pgTable(
  "signature_requests",
  {
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
    signerOrder: jsonb("signer_order")
      .$type<NonNullable<SignatureRequestRecord["signerOrder"]>>()
      .notNull()
      .default([]),
    fieldPlacements: jsonb("field_placements")
      .$type<NonNullable<SignatureRequestRecord["fieldPlacements"]>>()
      .notNull()
      .default([]),
    validationStatus: text("validation_status")
      .$type<NonNullable<SignatureRequestRecord["validationStatus"]>>()
      .notNull()
      .default("unchecked"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmMatter: index("signature_requests_firm_matter_idx").on(table.firmId, table.matterId),
  }),
);

export const signatureRequestSigners = pgTable(
  "signature_request_signers",
  {
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
  },
  (table) => ({
    firmRequest: index("signature_request_signers_firm_request_idx").on(
      table.firmId,
      table.signatureRequestId,
    ),
  }),
);

export const signatureProviderEvents = pgTable(
  "signature_provider_events",
  {
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
  },
  (table) => ({
    firmRequestOccurred: index("signature_provider_events_firm_request_occurred_idx").on(
      table.firmId,
      table.signatureRequestId,
      table.occurredAt,
    ),
  }),
);

export const signatureWebhookAttempts = pgTable(
  "signature_webhook_attempts",
  {
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
  },
  (table) => ({
    firmProviderExternal: index("signature_webhook_attempts_firm_provider_external_idx").on(
      table.firmId,
      table.provider,
      table.externalId,
    ),
    firmReceived: index("signature_webhook_attempts_firm_received_idx").on(
      table.firmId,
      table.receivedAt,
    ),
  }),
);
