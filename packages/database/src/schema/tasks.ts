import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("medium"),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: text("completed_by_user_id").references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => ({
    firmMatterStatusDue: index("tasks_firm_matter_status_due_idx").on(
      table.firmId,
      table.matterId,
      table.status,
      table.dueAt,
    ),
    firmAssigneeStatusDue: index("tasks_firm_assignee_status_due_idx").on(
      table.firmId,
      table.assignedToUserId,
      table.status,
      table.dueAt,
    ),
    firmSource: index("tasks_firm_source_idx").on(table.firmId, table.sourceType, table.sourceId),
    statusValue: check(
      "tasks_status_value",
      sql`${table.status} in ('open', 'completed', 'archived')`,
    ),
    priorityValue: check(
      "tasks_priority_value",
      sql`${table.priority} in ('high', 'medium', 'low')`,
    ),
    sourceTypeValue: check(
      "tasks_source_type_value",
      sql`${table.sourceType} is null or ${table.sourceType} in ('manual', 'intake_review', 'inbound_email_follow_up', 'signature_follow_up', 'calendar_scheduling', 'operational_view', 'system_import')`,
    ),
    sourcePair: check(
      "tasks_source_pair",
      sql`(${table.sourceType} is null and ${table.sourceId} is null) or (${table.sourceType} is not null and length(trim(coalesce(${table.sourceId}, ''))) > 0)`,
    ),
    archiveFields: check(
      "tasks_archive_fields",
      sql`${table.status} <> 'archived' or ${table.archivedAt} is not null`,
    ),
    completedFields: check(
      "tasks_completed_fields",
      sql`${table.status} <> 'completed' or ${table.completedAt} is not null`,
    ),
    versionPositive: check("tasks_version_positive", sql`${table.version} >= 1`),
  }),
);
