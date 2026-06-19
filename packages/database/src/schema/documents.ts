import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";
import { externalUploadLinks } from "./portal-links.js";

export const documentClassification = pgEnum("document_classification", [
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
]);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    title: text("title").notNull(),
    storageKey: text("storage_key").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    sizeBytes: integer("size_bytes"),
    version: integer("version").notNull().default(1),
    classification: documentClassification("classification").notNull(),
    legalHold: boolean("legal_hold").notNull().default(false),
    uploadStatus: text("upload_status").notNull().default("intent_created"),
    checksumStatus: text("checksum_status").notNull().default("pending"),
    scanStatus: text("scan_status").notNull().default("pending"),
    reviewStatus: text("review_status").notNull().default("not_required"),
    reviewDecision: text("review_decision"),
    reviewReason: text("review_reason"),
    reviewMetadata: jsonb("review_metadata").$type<Record<string, unknown>>().notNull().default({}),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    externalUploadLinkId: text("external_upload_link_id").references(() => externalUploadLinks.id),
    duplicateOfDocumentId: text("duplicate_of_document_id"),
    supersedesDocumentId: text("supersedes_document_id"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmMatter: index("documents_firm_matter_idx").on(table.firmId, table.matterId),
    firmMatterChecksumStatus: index("documents_firm_matter_checksum_status_idx").on(
      table.firmId,
      table.matterId,
      table.checksumSha256,
      table.checksumStatus,
    ),
  }),
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    version: integer("version").notNull(),
    storageKey: text("storage_key"),
    editorJson: jsonb("editor_json").$type<Record<string, unknown>>(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentVersion: uniqueIndex("document_versions_document_version_idx").on(
      table.documentId,
      table.version,
    ),
  }),
);

export const documentTextExtractions = pgTable(
  "document_text_extractions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    engine: text("engine").notNull(),
    status: text("status").notNull().default("queued"),
    language: text("language").notNull().default("eng"),
    confidence: integer("confidence"),
    textStorageKey: text("text_storage_key"),
    extractedText: text("extracted_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    documentStatus: index("document_text_extractions_document_status_idx").on(
      table.documentId,
      table.status,
    ),
  }),
);

export const mediaTranscripts = pgTable(
  "media_transcripts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    engine: text("engine").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("queued"),
    transcriptStorageKey: text("transcript_storage_key"),
    text: text("text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    documentStatus: index("media_transcripts_document_status_idx").on(
      table.documentId,
      table.status,
    ),
  }),
);

export const mediaDerivatives = pgTable(
  "media_derivatives",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentKind: uniqueIndex("media_derivatives_document_kind_idx").on(
      table.documentId,
      table.kind,
    ),
  }),
);
