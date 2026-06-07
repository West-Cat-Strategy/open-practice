import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { LegalClinicMatterProfile, LegalClinicProgram } from "@open-practice/domain";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const legalClinicProgramStatus = pgEnum("legal_clinic_program_status", [
  "active",
  "paused",
  "archived",
]);

export const legalClinicEligibilityStatus = pgEnum("legal_clinic_eligibility_status", [
  "unknown",
  "likely_eligible",
  "ineligible",
  "needs_review",
]);

export const legalClinicReferralStatus = pgEnum("legal_clinic_referral_status", [
  "not_referred",
  "referral_needed",
  "referred",
  "accepted",
  "declined",
]);

export const legalClinicPrograms = pgTable(
  "legal_clinic_programs",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    status: legalClinicProgramStatus("status").notNull().default("active"),
    serviceArea: text("service_area").notNull(),
    eligibilitySummary: text("eligibility_summary").notNull(),
    defaultReferralSource: text("default_referral_source"),
    defaultReferralStatus: legalClinicReferralStatus("default_referral_status")
      .notNull()
      .default("not_referred"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<LegalClinicProgram["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmName: uniqueIndex("legal_clinic_programs_firm_name_idx").on(table.firmId, table.name),
    firmStatus: index("legal_clinic_programs_firm_status_idx").on(table.firmId, table.status),
  }),
);

export const legalClinicMatterProfiles = pgTable(
  "legal_clinic_matter_profiles",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    programId: text("program_id")
      .notNull()
      .references(() => legalClinicPrograms.id),
    eligibilityStatus: legalClinicEligibilityStatus("eligibility_status")
      .notNull()
      .default("unknown"),
    referralSource: text("referral_source"),
    referralStatus: legalClinicReferralStatus("referral_status").notNull().default("not_referred"),
    referralDate: timestamp("referral_date", { withTimezone: true }),
    nextReviewDate: timestamp("next_review_date", { withTimezone: true }),
    clinicRelationshipRole: text("clinic_relationship_role").notNull(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").$type<LegalClinicMatterProfile["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmMatter: uniqueIndex("legal_clinic_matter_profiles_firm_matter_idx").on(
      table.firmId,
      table.matterId,
    ),
    firmProgramStatus: index("legal_clinic_matter_profiles_program_status_idx").on(
      table.firmId,
      table.programId,
      table.referralStatus,
    ),
    matterReview: index("legal_clinic_matter_profiles_review_idx").on(
      table.firmId,
      table.nextReviewDate,
    ),
  }),
);
