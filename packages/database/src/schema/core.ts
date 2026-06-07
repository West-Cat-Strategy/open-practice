import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { province, userRole } from "./enums.js";

export const firms = pgTable("firms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  defaultProvince: province("default_province").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    role: userRole("role").notNull(),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    oidcSubject: text("oidc_subject"),
    practitionerProfile: jsonb("practitioner_profile").$type<{
      regulator: string;
      licenseStatus: string;
      jurisdictions: string[];
    }>(),
  },
  (table) => ({
    firmEmail: uniqueIndex("users_firm_email_idx").on(table.firmId, table.email),
  }),
);
