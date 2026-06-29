import { sql } from "drizzle-orm";
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
import type {
  AppointmentBookingLinkRecord,
  AppointmentBookingProfileRecord,
  AppointmentBookingRequestRecord,
} from "@open-practice/domain";
import { calendarEvents } from "./calendar.js";
import { contacts } from "./contacts.js";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";
import { publicConsultationIntakes } from "./public-consultation.js";

export const appointmentBookingProfiles = pgTable(
  "appointment_booking_profiles",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    label: text("label").notNull(),
    publicLabel: text("public_label").notNull(),
    description: text("description"),
    timezone: text("timezone").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    slotIntervalMinutes: integer("slot_interval_minutes").notNull(),
    minLeadMinutes: integer("min_lead_minutes").notNull(),
    maxLeadDays: integer("max_lead_days").notNull(),
    status: text("status").notNull().default("active"),
    weeklyWindows: jsonb("weekly_windows")
      .$type<AppointmentBookingProfileRecord["weeklyWindows"]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    firmStatus: index("appointment_booking_profiles_firm_status_idx").on(
      table.firmId,
      table.status,
    ),
    labelPresent: check(
      "appointment_booking_profiles_label_present",
      sql`length(trim(${table.label})) > 0`,
    ),
    publicLabelPresent: check(
      "appointment_booking_profiles_public_label_present",
      sql`length(trim(${table.publicLabel})) > 0`,
    ),
    statusValue: check(
      "appointment_booking_profiles_status_value",
      sql`${table.status} in ('active', 'paused')`,
    ),
    durationPositive: check(
      "appointment_booking_profiles_duration_positive",
      sql`${table.durationMinutes} > 0 and ${table.durationMinutes} <= 480`,
    ),
    slotIntervalPositive: check(
      "appointment_booking_profiles_slot_interval_positive",
      sql`${table.slotIntervalMinutes} > 0 and ${table.slotIntervalMinutes} <= 480`,
    ),
    leadBounds: check(
      "appointment_booking_profiles_lead_bounds",
      sql`${table.minLeadMinutes} >= 0 and ${table.maxLeadDays} > 0`,
    ),
  }),
);

export const appointmentBookingLinks = pgTable(
  "appointment_booking_links",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    profileId: text("profile_id")
      .notNull()
      .references(() => appointmentBookingProfiles.id),
    tokenHash: text("token_hash").notNull(),
    matterId: text("matter_id").references(() => matters.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    metadata: jsonb("metadata")
      .$type<AppointmentBookingLinkRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    tokenHash: uniqueIndex("appointment_booking_links_token_hash_idx").on(table.tokenHash),
    firmProfile: index("appointment_booking_links_firm_profile_idx").on(
      table.firmId,
      table.profileId,
    ),
  }),
);

export const appointmentBookingRequests = pgTable(
  "appointment_booking_requests",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    profileId: text("profile_id")
      .notNull()
      .references(() => appointmentBookingProfiles.id),
    linkId: text("link_id").references(() => appointmentBookingLinks.id),
    source: text("source").notNull(),
    status: text("status").notNull().default("tentative_hold"),
    calendarEventId: text("calendar_event_id")
      .notNull()
      .references(() => calendarEvents.id),
    publicConsultationIntakeId: text("public_consultation_intake_id").references(
      () => publicConsultationIntakes.id,
    ),
    matterId: text("matter_id").references(() => matters.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email"),
    requesterTelephone: text("requester_telephone"),
    requestedStartsAt: timestamp("requested_starts_at", { withTimezone: true }).notNull(),
    requestedEndsAt: timestamp("requested_ends_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    dismissedReason: text("dismissed_reason"),
    reviewAgingDecision:
      text("review_aging_decision").$type<AppointmentBookingRequestRecord["reviewAgingDecision"]>(),
    reviewAgingDecidedAt: timestamp("review_aging_decided_at", { withTimezone: true }),
    reviewAgingDecidedByUserId: text("review_aging_decided_by_user_id").references(() => users.id),
    reviewAgingCueStatus:
      text("review_aging_cue_status").$type<
        AppointmentBookingRequestRecord["reviewAgingCueStatus"]
      >(),
    reviewAgingAgeHours: integer("review_aging_age_hours"),
    metadata: jsonb("metadata")
      .$type<AppointmentBookingRequestRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmStatus: index("appointment_booking_requests_firm_status_idx").on(
      table.firmId,
      table.status,
      table.submittedAt,
    ),
    matterStatus: index("appointment_booking_requests_matter_status_idx").on(
      table.firmId,
      table.matterId,
      table.status,
    ),
    event: uniqueIndex("appointment_booking_requests_event_idx").on(table.calendarEventId),
    sourceValue: check(
      "appointment_booking_requests_source_value",
      sql`${table.source} in ('website', 'direct_link')`,
    ),
    statusValue: check(
      "appointment_booking_requests_status_value",
      sql`${table.status} in ('tentative_hold', 'confirmed', 'dismissed')`,
    ),
    reviewAgingDecisionValue: check(
      "appointment_booking_requests_review_aging_decision_value",
      sql`${table.reviewAgingDecision} is null or ${table.reviewAgingDecision} in ('acknowledged', 'follow_up_required', 'defer_review')`,
    ),
    reviewAgingCueStatusValue: check(
      "appointment_booking_requests_review_aging_cue_status_value",
      sql`${table.reviewAgingCueStatus} is null or ${table.reviewAgingCueStatus} in ('aging', 'stale')`,
    ),
    reviewAgingAgeNonnegative: check(
      "appointment_booking_requests_review_aging_age_nonnegative",
      sql`${table.reviewAgingAgeHours} is null or ${table.reviewAgingAgeHours} >= 0`,
    ),
    reviewAgingDecisionComplete: check(
      "appointment_booking_requests_review_aging_decision_complete",
      sql`(${table.reviewAgingDecision} is null and ${table.reviewAgingDecidedAt} is null and ${table.reviewAgingDecidedByUserId} is null and ${table.reviewAgingCueStatus} is null and ${table.reviewAgingAgeHours} is null) or (${table.reviewAgingDecision} is not null and ${table.reviewAgingDecidedAt} is not null and ${table.reviewAgingDecidedByUserId} is not null and ${table.reviewAgingCueStatus} is not null and ${table.reviewAgingAgeHours} is not null)`,
    ),
    requesterNamePresent: check(
      "appointment_booking_requests_requester_name_present",
      sql`length(trim(${table.requesterName})) > 0`,
    ),
  }),
);
