import { primaryKey, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { province, matterStatus } from "./enums.js";
import { firms, users } from "./core.js";

export const matters = pgTable(
  "matters",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    practiceArea: text("practice_area").notNull(),
    status: matterStatus("status").notNull(),
    jurisdiction: province("jurisdiction").notNull(),
    responsibleUserId: text("responsible_user_id")
      .notNull()
      .references(() => users.id),
    openedOn: timestamp("opened_on", { withTimezone: true }),
    closedOn: timestamp("closed_on", { withTimezone: true }),
  },
  (table) => ({
    firmNumber: uniqueIndex("matters_firm_number_idx").on(table.firmId, table.number),
  }),
);

export const matterAssignments = pgTable(
  "matter_assignments",
  {
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.matterId, table.userId] }),
  }),
);
