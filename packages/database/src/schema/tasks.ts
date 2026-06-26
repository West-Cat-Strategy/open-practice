import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("open"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
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
    taskOrder: index("task_checklist_items_task_order_idx").on(
      table.firmId,
      table.taskId,
      table.archivedAt,
      table.sortOrder,
    ),
    matterStatusDue: index("task_checklist_items_matter_status_due_idx").on(
      table.firmId,
      table.matterId,
      table.status,
      table.dueAt,
    ),
    statusValue: check(
      "task_checklist_items_status_value",
      sql`${table.status} in ('open', 'completed', 'blocked')`,
    ),
    completedFields: check(
      "task_checklist_items_completed_fields",
      sql`${table.status} <> 'completed' or ${table.completedAt} is not null`,
    ),
    versionPositive: check("task_checklist_items_version_positive", sql`${table.version} >= 1`),
  }),
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    body: text("body").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    taskCreated: index("task_comments_task_created_idx").on(
      table.firmId,
      table.taskId,
      table.archivedAt,
      table.createdAt,
    ),
  }),
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    dependsOnTaskId: text("depends_on_task_id")
      .notNull()
      .references(() => tasks.id),
    dependencyType: text("dependency_type").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    taskActive: index("task_dependencies_task_active_idx").on(
      table.firmId,
      table.taskId,
      table.archivedAt,
    ),
    dependencyActive: index("task_dependencies_dependency_active_idx").on(
      table.firmId,
      table.dependsOnTaskId,
      table.archivedAt,
    ),
    activePair: uniqueIndex("task_dependencies_active_pair_idx")
      .on(table.firmId, table.taskId, table.dependsOnTaskId, table.dependencyType)
      .where(sql`${table.archivedAt} is null`),
    dependencyTypeValue: check(
      "task_dependencies_type_value",
      sql`${table.dependencyType} in ('blocks', 'relates_to')`,
    ),
    noSelfDependency: check(
      "task_dependencies_no_self_dependency",
      sql`${table.taskId} <> ${table.dependsOnTaskId}`,
    ),
  }),
);

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    description: text("description"),
    defaultTitle: text("default_title"),
    defaultPriority: text("default_priority").notNull().default("medium"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByUserId: text("archived_by_user_id").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => ({
    firmStatusName: index("task_templates_firm_status_name_idx").on(
      table.firmId,
      table.status,
      table.name,
    ),
    activeName: uniqueIndex("task_templates_active_name_idx")
      .on(table.firmId, table.name)
      .where(sql`${table.status} = 'active'`),
    priorityValue: check(
      "task_templates_default_priority_value",
      sql`${table.defaultPriority} in ('high', 'medium', 'low')`,
    ),
    statusValue: check(
      "task_templates_status_value",
      sql`${table.status} in ('active', 'archived')`,
    ),
    archiveFields: check(
      "task_templates_archive_fields",
      sql`${table.status} <> 'archived' or ${table.archivedAt} is not null`,
    ),
    versionPositive: check("task_templates_version_positive", sql`${table.version} >= 1`),
  }),
);

export const taskTemplateItems = pgTable(
  "task_template_items",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    templateId: text("template_id")
      .notNull()
      .references(() => taskTemplates.id),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    defaultAssigneeUserId: text("default_assignee_user_id").references(() => users.id),
    dueOffsetDays: integer("due_offset_days"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id),
  },
  (table) => ({
    templateOrder: index("task_template_items_template_order_idx").on(
      table.firmId,
      table.templateId,
      table.sortOrder,
    ),
  }),
);
