import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { firms } from "./core.js";
import { documents } from "./documents.js";
import { matters } from "./matters.js";

export const inboundEmailAddresses = pgTable(
  "inbound_email_addresses",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    address: text("address").notNull(),
    matterId: text("matter_id").references(() => matters.id),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmAddress: uniqueIndex("inbound_email_addresses_firm_address_idx").on(
      table.firmId,
      table.address,
    ),
  }),
);

export const inboundEmailMessages = pgTable(
  "inbound_email_messages",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    addressId: text("address_id").references(() => inboundEmailAddresses.id),
    matterId: text("matter_id").references(() => matters.id),
    messageId: text("message_id"),
    fromAddress: text("from_address").notNull(),
    toAddresses: jsonb("to_addresses").$type<string[]>().notNull().default([]),
    subject: text("subject").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    rawStorageKey: text("raw_storage_key").notNull(),
    parsedText: text("parsed_text"),
    parsedHtmlStorageKey: text("parsed_html_storage_key"),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("received"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmReceived: index("inbound_email_messages_firm_received_idx").on(
      table.firmId,
      table.receivedAt,
    ),
  }),
);

export const inboundEmailAttachments = pgTable("inbound_email_attachments", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  inboundMessageId: text("inbound_message_id")
    .notNull()
    .references(() => inboundEmailMessages.id),
  documentId: text("document_id").references(() => documents.id),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  storageKey: text("storage_key").notNull(),
  checksumSha256: text("checksum_sha256"),
});
