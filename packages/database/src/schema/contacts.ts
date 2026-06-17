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
import type { ContactIdentifier, ContactMethod, ContactRoleCategory } from "@open-practice/domain";

export const contactKind = pgEnum("contact_kind", ["person", "organization"]);
export const partyRole = pgEnum("party_role", [
  "client",
  "prospective_client",
  "former_client",
  "opposing_party",
  "opposing_counsel",
  "related_party",
  "witness",
  "court",
  "court_tribunal",
  "lawyer",
  "paralegal",
  "authorized_non_lawyer_provider",
  "legal_representative",
  "insurer",
  "expert",
  "vendor",
  "referral_source",
  "internal_team_member",
  "third_party",
  "notary_client",
  "paralegal_client",
  "other",
]);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    kind: contactKind("kind").notNull(),
    status: text("status").notNull().default("active"),
    roleCategories: jsonb("role_categories").$type<ContactRoleCategory[]>().notNull().default([]),
    canonicalName: text("canonical_name"),
    displayName: text("display_name").notNull(),
    givenName: text("given_name"),
    middleName: text("middle_name"),
    familyName: text("family_name"),
    title: text("title"),
    pronouns: text("pronouns"),
    organizationLegalName: text("organization_legal_name"),
    organizationOperatingName: text("organization_operating_name"),
    organizationRegisteredName: text("organization_registered_name"),
    organizationType: text("organization_type"),
    website: text("website"),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    formerNames: jsonb("former_names").$type<string[]>().notNull().default([]),
    identifiers: jsonb("identifiers").$type<ContactIdentifier[]>().notNull().default([]),
    contactMethods: jsonb("contact_methods").$type<ContactMethod[]>().notNull().default([]),
    preferredContactMethodId: text("preferred_contact_method_id"),
    preferredLanguage: text("preferred_language"),
    timezone: text("timezone"),
    communicationNotes: text("communication_notes"),
    accessibilityNotes: text("accessibility_notes"),
    privateNotes: text("private_notes"),
    notes: text("notes"),
    riskFlags: jsonb("risk_flags").$type<string[]>().notNull().default([]),
    conflictSensitive: boolean("conflict_sensitive").notNull().default(false),
    adverse: boolean("adverse").notNull().default(false),
    confidentialityMarker: text("confidentiality_marker").notNull().default("standard"),
    doNotContact: boolean("do_not_contact").notNull().default(false),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmName: index("contacts_firm_name_idx").on(table.firmId, table.displayName),
    firmCreatedBy: index("contacts_firm_created_by_idx").on(table.firmId, table.createdByUserId),
    firmStatus: index("contacts_firm_status_idx").on(table.firmId, table.status),
    firmKindStatus: index("contacts_firm_kind_status_idx").on(
      table.firmId,
      table.kind,
      table.status,
    ),
    firmCanonical: index("contacts_firm_canonical_name_idx").on(table.firmId, table.canonicalName),
    confidentialityValue: check(
      "contacts_confidentiality_marker_value",
      sql`${table.confidentialityMarker} in ('standard', 'confidential', 'restricted')`,
    ),
    statusValue: check(
      "contacts_status_value",
      sql`${table.status} in ('prospective', 'active', 'inactive', 'archived', 'former', 'restricted')`,
    ),
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
      sql`${table.signalKind} in ('duplicate_candidate', 'protected_party_cue', 'conflict_revalidation', 'retention_hold_review')`,
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
    reciprocalLabel: text("reciprocal_label"),
    matterId: text("matter_id").references(() => matters.id),
    source: text("source").notNull().default("manual"),
    status: text("status").notNull().default("active"),
    effectiveOn: timestamp("effective_on", { withTimezone: true }),
    endedOn: timestamp("ended_on", { withTimezone: true }),
    notes: text("notes"),
    privateNotes: text("private_notes"),
    includeInConflictCheck: boolean("include_in_conflict_check").notNull().default(true),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
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
      sql`${table.relationshipKind} in ('authorized_representative', 'director_of', 'employee_of', 'employer_of', 'expert_for', 'family_contact', 'family_member', 'guardian_of', 'insurer_for', 'lawyer_for', 'officer_of', 'owned_by', 'owner_of', 'parent_of', 'paralegal_for', 'partner_of', 'subsidiary_of', 'agent_for', 'opposing_counsel_for', 'opposing_party_for', 'referral_source', 'spouse_partner', 'witness_against', 'witness_for', 'custom')`,
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
    dateOrder: check(
      "contact_relationships_date_order",
      sql`${table.endedOn} is null or ${table.effectiveOn} is null or ${table.endedOn} >= ${table.effectiveOn}`,
    ),
  }),
);

export const matterParties = pgTable(
  "matter_parties",
  {
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
    status: text("status").notNull().default("active"),
    side: text("side"),
    startedOn: timestamp("started_on", { withTimezone: true }),
    endedOn: timestamp("ended_on", { withTimezone: true }),
    notes: text("notes"),
    privateNotes: text("private_notes"),
    conflictCheckIncluded: boolean("conflict_check_included").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
  },
  (table) => ({
    matterStatus: index("matter_parties_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    contactStatus: index("matter_parties_contact_status_idx").on(
      table.firmId,
      table.contactId,
      table.status,
    ),
    roleStatus: index("matter_parties_role_status_idx").on(table.firmId, table.role, table.status),
    statusValue: check(
      "matter_parties_status_value",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    sideValue: check(
      "matter_parties_side_value",
      sql`${table.side} is null or ${table.side} in ('client', 'opposing', 'neutral', 'internal', 'court', 'other')`,
    ),
    dateOrder: check(
      "matter_parties_date_order",
      sql`${table.endedOn} is null or ${table.startedOn} is null or ${table.endedOn} >= ${table.startedOn}`,
    ),
  }),
);
