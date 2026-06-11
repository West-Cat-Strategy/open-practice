import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const contactKind = pgEnum("contact_kind", ["person", "organization"]);
export const partyRole = pgEnum("party_role", [
  "client",
  "prospective_client",
  "opposing_party",
  "opposing_counsel",
  "witness",
  "court",
  "third_party",
  "notary_client",
  "paralegal_client",
]);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    kind: contactKind("kind").notNull(),
    displayName: text("display_name").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    identifiers: jsonb("identifiers")
      .$type<Array<{ type: string; value: string }>>()
      .notNull()
      .default([]),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    firmName: index("contacts_firm_name_idx").on(table.firmId, table.displayName),
    firmCreatedBy: index("contacts_firm_created_by_idx").on(table.firmId, table.createdByUserId),
  }),
);

export const contactDataQualityResolutions = pgTable(
  "contact_data_quality_resolutions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    signalKind: text("signal_kind").notNull(),
    decision: text("decision").notNull(),
    resolutionNote: text("resolution_note").notNull(),
    matterId: text("matter_id").references(() => matters.id),
    relatedContactId: text("related_contact_id").references(() => contacts.id),
    sourceRecordId: text("source_record_id"),
    recordedByUserId: text("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    contactRecorded: index("contact_data_quality_resolutions_contact_recorded_idx").on(
      table.firmId,
      table.contactId,
      table.recordedAt,
    ),
    matterRecorded: index("contact_data_quality_resolutions_matter_recorded_idx").on(
      table.firmId,
      table.matterId,
      table.recordedAt,
    ),
    signalKindValue: check(
      "contact_data_quality_resolutions_signal_kind_value",
      sql`${table.signalKind} in ('duplicate_candidate', 'protected_party_cue', 'conflict_revalidation')`,
    ),
    decisionValue: check(
      "contact_data_quality_resolutions_decision_value",
      sql`${table.decision} in ('acknowledged', 'false_positive', 'needs_follow_up', 'revalidation_requested', 'revalidation_completed')`,
    ),
    resolutionNotePresent: check(
      "contact_data_quality_resolutions_note_present",
      sql`length(trim(${table.resolutionNote})) > 0`,
    ),
  }),
);

export const contactRelationships = pgTable(
  "contact_relationships",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    relatedContactId: text("related_contact_id")
      .notNull()
      .references(() => contacts.id),
    relationshipKind: text("relationship_kind").notNull(),
    label: text("label").notNull(),
    matterId: text("matter_id").references(() => matters.id),
    source: text("source").notNull().default("manual"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    contactStatus: index("contact_relationships_contact_status_idx").on(
      table.firmId,
      table.contactId,
      table.status,
    ),
    relatedContactStatus: index("contact_relationships_related_contact_status_idx").on(
      table.firmId,
      table.relatedContactId,
      table.status,
    ),
    matterStatus: index("contact_relationships_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    kindValue: check(
      "contact_relationships_kind_value",
      sql`${table.relationshipKind} in ('authorized_representative', 'employee_of', 'family_contact', 'opposing_party_for', 'referral_source')`,
    ),
    sourceValue: check(
      "contact_relationships_source_value",
      sql`${table.source} in ('manual', 'matter_party', 'intake')`,
    ),
    statusValue: check(
      "contact_relationships_status_value",
      sql`${table.status} in ('active', 'review_needed', 'ended')`,
    ),
    labelPresent: check(
      "contact_relationships_label_present",
      sql`length(trim(${table.label})) > 0`,
    ),
    differentContacts: check(
      "contact_relationships_different_contacts",
      sql`${table.contactId} <> ${table.relatedContactId}`,
    ),
  }),
);

export const matterParties = pgTable("matter_parties", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  role: partyRole("role").notNull(),
  adverse: boolean("adverse").notNull().default(false),
  confidential: boolean("confidential").notNull().default(false),
});
