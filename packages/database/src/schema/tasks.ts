import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
