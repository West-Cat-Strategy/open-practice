import {
  index,
  jsonb,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { MatterLifecycleTransitionRecord } from "@open-practice/domain";
import { province, matterStatus } from "./enums.js";
import { firms, users } from "./core.js";

export const matterLifecycleTransition = pgEnum("matter_lifecycle_transition", [
  "pause",
  "close",
  "archive",
  "reopen",
]);

export const matterLifecycleReadiness = pgEnum("matter_lifecycle_readiness", ["ready", "blocked"]);

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

export const matterLifecycleTransitionRecords = pgTable(
  "matter_lifecycle_transition_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    transition: matterLifecycleTransition("transition").notNull(),
    currentStatus: matterStatus("current_status").notNull(),
    targetStatus: matterStatus("target_status").notNull(),
    readiness: matterLifecycleReadiness("readiness").notNull(),
    reason: text("reason").notNull(),
    blockers: jsonb("blockers")
      .$type<MatterLifecycleTransitionRecord["blockers"]>()
      .notNull()
      .default([]),
    reviewedByUserId: text("reviewed_by_user_id")
      .notNull()
      .references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmMatterReviewed: index("matter_lifecycle_transition_records_firm_matter_reviewed_idx").on(
      table.firmId,
      table.matterId,
      table.reviewedAt,
    ),
  }),
);
