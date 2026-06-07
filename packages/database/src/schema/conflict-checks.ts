import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";

export const conflictChecks = pgTable("conflict_checks", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  requestedByUserId: text("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  prospectiveName: text("prospective_name").notNull(),
  querySnapshot: jsonb("query_snapshot").notNull(),
  resultSnapshot: jsonb("result_snapshot").notNull(),
  disposition: text("disposition").notNull().default("pending_review"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
