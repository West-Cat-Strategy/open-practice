import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { DocumentDispositionReviewScheduleProfile } from "@open-practice/domain";
import { firms, users } from "./core.js";

export const firmSettings = pgTable("firm_settings", {
  firmId: text("firm_id")
    .primaryKey()
    .references(() => firms.id),
  businessAddress: jsonb("business_address")
    .$type<{
      line1: string;
      line2?: string;
      city: string;
      province: "BC" | "ON" | "CANADA" | "OTHER";
      postalCode: string;
      country: string;
    }>()
    .notNull(),
  officeEmail: text("office_email").notNull(),
  officePhone: text("office_phone").notNull(),
  practiceAreas: jsonb("practice_areas").$type<string[]>().notNull().default([]),
  invoicePrefix: text("invoice_prefix").notNull(),
  defaultPaymentTermsDays: integer("default_payment_terms_days").notNull(),
  trustAccountLabel: text("trust_account_label").notNull(),
  trustFundsCaveatAcceptedAt: timestamp("trust_funds_caveat_accepted_at", {
    withTimezone: true,
  }).notNull(),
  trustFundsCaveatAcceptedByUserId: text("trust_funds_caveat_accepted_by_user_id")
    .notNull()
    .references(() => users.id),
  website: text("website"),
  description: text("description"),
  businessNumber: text("business_number"),
  dispositionReviewScheduleProfile: jsonb(
    "disposition_review_schedule_profile",
  ).$type<DocumentDispositionReviewScheduleProfile>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    channel: text("channel").notNull(),
    eventKey: text("event_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userEvent: uniqueIndex("notification_preferences_user_event_idx").on(
      table.firmId,
      table.userId,
      table.channel,
      table.eventKey,
    ),
  }),
);
