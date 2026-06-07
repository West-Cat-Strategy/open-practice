import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";
import { intakeFormLinks } from "./intake.js";
import { externalUploadLinks, shareLinks } from "./portal-links.js";

export const accessLogs = pgTable(
  "access_logs",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    actorId: text("actor_id").references(() => users.id),
    shareLinkId: text("share_link_id").references(() => shareLinks.id),
    externalUploadLinkId: text("external_upload_link_id").references(() => externalUploadLinks.id),
    intakeFormLinkId: text("intake_form_link_id").references(() => intakeFormLinks.id),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    action: text("action").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmResource: index("access_logs_firm_resource_idx").on(
      table.firmId,
      table.resourceType,
      table.resourceId,
    ),
  }),
);
