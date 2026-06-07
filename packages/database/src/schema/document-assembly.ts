import { boolean, check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  SignatureEnvelopeRecord,
} from "@open-practice/domain";
import { firms, users } from "./core.js";
import { documents } from "./documents.js";
import { drafts } from "./drafts.js";
import { intakeSessions } from "./intake.js";
import { matters } from "./matters.js";
import { signatureRequests } from "./signatures.js";

export const generatedDocuments = pgTable("generated_documents", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  intakeSessionId: text("intake_session_id").references(() => intakeSessions.id),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  documentId: text("document_id").references(() => documents.id),
  packageId: text("package_id"),
  packageDocumentId: text("package_document_id"),
  storageKey: text("storage_key"),
  checksumSha256: text("checksum_sha256"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentAssemblySetDefinitions = pgTable(
  "document_assembly_set_definitions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    description: text("description"),
    practiceArea: text("practice_area"),
    documentRefs: jsonb("document_refs")
      .$type<DocumentAssemblySetDefinitionRecord["documentRefs"]>()
      .notNull()
      .default([]),
    requiredMergeFields: jsonb("required_merge_fields").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata")
      .$type<DocumentAssemblySetDefinitionRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmActive: index("document_assembly_sets_firm_active_idx").on(table.firmId, table.active),
  }),
);

export const documentAssemblyPackages = pgTable(
  "document_assembly_packages",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    definitionId: text("definition_id").references(() => documentAssemblySetDefinitions.id),
    title: text("title").notNull(),
    status: text("status").$type<DocumentAssemblyPackageRecord["status"]>().notNull(),
    populationStatus: text("population_status")
      .$type<DocumentAssemblyPackageRecord["populationStatus"]>()
      .notNull(),
    sourceDraftId: text("source_draft_id").references(() => drafts.id),
    intakeSessionId: text("intake_session_id").references(() => intakeSessions.id),
    packageId: text("package_id"),
    documentIds: jsonb("document_ids").$type<string[]>().notNull().default([]),
    generatedDocumentIds: jsonb("generated_document_ids").$type<string[]>().notNull().default([]),
    signatureRequestIds: jsonb("signature_request_ids").$type<string[]>().notNull().default([]),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata")
      .$type<DocumentAssemblyPackageRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    matterStatus: index("document_assembly_packages_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    definition: index("document_assembly_packages_definition_idx").on(table.definitionId),
    statusValue: check(
      "document_assembly_packages_status_value",
      sql`${table.status} in ('planning', 'ready_for_generation', 'assembled', 'blocked')`,
    ),
    populationStatusValue: check(
      "document_assembly_packages_population_status_value",
      sql`${table.populationStatus} in ('needs_review', 'ready', 'populated', 'blocked')`,
    ),
  }),
);

export const signatureEnvelopes = pgTable(
  "signature_envelopes",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    assemblyPackageId: text("assembly_package_id").references(() => documentAssemblyPackages.id),
    signatureRequestId: text("signature_request_id").references(() => signatureRequests.id),
    title: text("title").notNull(),
    status: text("status").$type<SignatureEnvelopeRecord["status"]>().notNull(),
    signerOrder: jsonb("signer_order")
      .$type<SignatureEnvelopeRecord["signerOrder"]>()
      .notNull()
      .default([]),
    fieldPlacements: jsonb("field_placements")
      .$type<SignatureEnvelopeRecord["fieldPlacements"]>()
      .notNull()
      .default([]),
    validationStatus: text("validation_status")
      .$type<SignatureEnvelopeRecord["validationStatus"]>()
      .notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<SignatureEnvelopeRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    package: index("signature_envelopes_package_idx").on(table.assemblyPackageId),
    matterStatus: index("signature_envelopes_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    statusValue: check(
      "signature_envelopes_status_value",
      sql`${table.status} in ('draft', 'ready', 'sent', 'completed', 'blocked')`,
    ),
    validationStatusValue: check(
      "signature_envelopes_validation_status_value",
      sql`${table.validationStatus} in ('unchecked', 'valid', 'needs_review', 'invalid')`,
    ),
  }),
);
