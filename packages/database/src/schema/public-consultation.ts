import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { PublicConsultationIntakeRecord } from "@open-practice/domain";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const publicConsultationIntakeStatus = pgEnum("public_consultation_intake_status", [
  "pending",
  "converted",
  "dismissed",
]);

export const publicConsultationIntakes = pgTable(
  "public_consultation_intakes",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    status: publicConsultationIntakeStatus("status").notNull().default("pending"),
    clientName: text("client_name").notNull(),
    telephone: text("telephone").notNull(),
    email: text("email"),
    opposingPartyNames: jsonb("opposing_party_names").$type<string[]>().notNull().default([]),
    matterDescription: text("matter_description").notNull(),
    sourceUrl: text("source_url"),
    disclosureAcceptedAt: timestamp("disclosure_accepted_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    dismissedReason: text("dismissed_reason"),
    convertedMatterId: text("converted_matter_id").references(() => matters.id),
    notificationEmailId: text("notification_email_id"),
    metadata: jsonb("metadata")
      .$type<PublicConsultationIntakeRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmStatusSubmitted: index("public_consultation_intakes_firm_status_submitted_idx").on(
      table.firmId,
      table.status,
      table.submittedAt,
    ),
    convertedMatter: index("public_consultation_intakes_converted_matter_idx").on(
      table.convertedMatterId,
    ),
  }),
);
