import type {
  TaskChecklistItemRecord,
  TaskCommentRecord,
  TaskDependencyRecord,
  TaskRecord,
  TaskTemplateItemRecord,
  TaskTemplateRecord,
} from "@open-practice/domain";
import { and, asc, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  mapTaskChecklistItemRow,
  mapTaskCommentRow,
  mapTaskDeadlineRow,
  mapTaskDependencyRow,
  mapTaskTemplateItemRow,
  mapTaskTemplateRow,
} from "../drizzle-mappers.js";
import type {
  TaskArchiveInput,
  TaskChecklistItemArchiveInput,
  TaskChecklistItemCreateInput,
  TaskChecklistItemListOptions,
  TaskChecklistItemUpdateInput,
  TaskCommentArchiveInput,
  TaskCommentCreateInput,
  TaskCommentListOptions,
  TaskCreateInput,
  TaskDeadlineCompletionInput,
  TaskDeadlineReopenInput,
  TaskDependencyArchiveInput,
  TaskDependencyCreateInput,
  TaskDependencyListOptions,
  TaskListOptions,
  TaskTemplateArchiveInput,
  TaskTemplateCreateInput,
  TaskTemplateListOptions,
  TaskTemplateUpdateInput,
  TaskTemplateWithItems,
  TaskUpdateInput,
} from "../tasks-contracts.js";

function dateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

function listValue<T extends string>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function activeTaskFilter(options: Pick<TaskListOptions, "includeArchived">): SQL | undefined {
  return options.includeArchived ? undefined : ne(schema.tasks.status, "archived");
}

function taskIdsFromOptions(options: {
  taskId?: string;
  taskIds?: string[];
}): string[] | undefined {
  if (options.taskId) return [options.taskId];
  return options.taskIds;
}

function templateIdsFromOptions(options: {
  templateId?: string;
  templateIds?: string[];
}): string[] | undefined {
  if (options.templateId) return [options.templateId];
  return options.templateIds;
}

function assertTaskSourcePair(sourceType: unknown, sourceId: unknown): void {
  if (Boolean(sourceType) !== Boolean(sourceId)) {
    throw new Error("Task source type and source id must be set together");
  }
}

async function wouldCreateBlockingCycle(
  db: OpenPracticeDatabase,
  input: TaskDependencyCreateInput,
): Promise<boolean> {
  if (input.dependencyType !== "blocks") return false;
  const rows = await db
    .select()
    .from(schema.taskDependencies)
    .where(
      and(
        eq(schema.taskDependencies.firmId, input.firmId),
        eq(schema.taskDependencies.dependencyType, "blocks"),
        isNull(schema.taskDependencies.archivedAt),
      ),
    );
  const graph = new Map<string, string[]>();
  for (const dependency of rows) {
    const next = graph.get(dependency.taskId) ?? [];
    next.push(dependency.dependsOnTaskId);
    graph.set(dependency.taskId, next);
  }
  const newNext = graph.get(input.taskId) ?? [];
  newNext.push(input.dependsOnTaskId);
  graph.set(input.taskId, newNext);

  const seen = new Set<string>();
  const stack = [input.dependsOnTaskId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === input.taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(graph.get(current) ?? []));
  }
  return false;
}

function taskInsertValues(task: TaskCreateInput): typeof schema.tasks.$inferInsert {
  assertTaskSourcePair(task.sourceType, task.sourceId);
  const createdAt = task.createdAt ?? task.updatedAt ?? new Date().toISOString();
  const updatedAt = task.updatedAt ?? createdAt;
  return {
    id: task.id,
    firmId: task.firmId,
    matterId: task.matterId,
    assignedToUserId: task.assignedToUserId ?? null,
    title: task.title,
    description: task.description ?? null,
    status: "open",
    priority: task.priority ?? "medium",
    sourceType: task.sourceType ?? null,
    sourceId: task.sourceId ?? null,
    dueAt: task.dueAt ? new Date(task.dueAt) : null,
    completedAt: null,
    completedByUserId: null,
    archivedAt: null,
    archivedByUserId: null,
    createdAt: new Date(createdAt),
    createdByUserId: task.createdByUserId ?? null,
    updatedAt: new Date(updatedAt),
    updatedByUserId: task.updatedByUserId ?? task.createdByUserId ?? null,
    version: 1,
  };
}

export async function listDrizzleTaskDeadlines(
  db: OpenPracticeDatabase,
  firmId: string,
  options: TaskListOptions = {},
): Promise<TaskRecord[]> {
  const filters: SQL[] = [eq(schema.tasks.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.tasks.matterId, options.matterId));
  } else if (options.matterIds) {
    if (options.matterIds.length === 0) return [];
    filters.push(inArray(schema.tasks.matterId, options.matterIds));
  }
  if (!options.includeCompleted) {
    filters.push(isNull(schema.tasks.completedAt));
  }
  const statuses = listValue(options.status);
  if (statuses) filters.push(inArray(schema.tasks.status, statuses));
  const priorities = listValue(options.priority);
  if (priorities) filters.push(inArray(schema.tasks.priority, priorities));
  if (options.assignedToUserId) {
    filters.push(eq(schema.tasks.assignedToUserId, options.assignedToUserId));
  }
  if (options.sourceType) filters.push(eq(schema.tasks.sourceType, options.sourceType));
  if (options.sourceId) filters.push(eq(schema.tasks.sourceId, options.sourceId));
  const activeFilter = activeTaskFilter(options);
  if (activeFilter) filters.push(activeFilter);
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(and(...filters))
    .orderBy(asc(schema.tasks.dueAt), asc(schema.tasks.id));
  return rows.map(mapTaskDeadlineRow);
}

export async function getDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  firmId: string,
  taskId: string,
  options: { includeArchived?: boolean } = {},
): Promise<TaskRecord | undefined> {
  const filters: SQL[] = [eq(schema.tasks.firmId, firmId), eq(schema.tasks.id, taskId)];
  const activeFilter = activeTaskFilter(options);
  if (activeFilter) filters.push(activeFilter);
  const [row] = await db
    .select()
    .from(schema.tasks)
    .where(and(...filters));
  return row ? mapTaskDeadlineRow(row) : undefined;
}

export async function createDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  task: TaskCreateInput,
): Promise<TaskRecord> {
  const [row] = await db.insert(schema.tasks).values(taskInsertValues(task)).returning();
  return mapTaskDeadlineRow(row!);
}

export async function updateDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  input: TaskUpdateInput,
): Promise<TaskRecord | undefined> {
  const existing = await getDrizzleTaskDeadline(db, input.firmId, input.taskId);
  if (!existing) return undefined;
  const nextSourceType =
    input.sourceType === undefined ? existing.sourceType : (input.sourceType ?? undefined);
  const nextSourceId =
    input.sourceId === undefined ? existing.sourceId : (input.sourceId ?? undefined);
  assertTaskSourcePair(nextSourceType, nextSourceId);
  const [row] = await db
    .update(schema.tasks)
    .set({
      title: input.title ?? existing.title,
      description:
        input.description === undefined
          ? (existing.description ?? null)
          : (input.description ?? null),
      assignedToUserId:
        input.assignedToUserId === undefined
          ? (existing.assignedToUserId ?? null)
          : input.assignedToUserId,
      priority: input.priority ?? existing.priority,
      dueAt:
        input.dueAt === undefined
          ? existing.dueAt
            ? new Date(existing.dueAt)
            : null
          : dateOrNull(input.dueAt),
      sourceType: nextSourceType ?? null,
      sourceId: nextSourceType ? (nextSourceId ?? null) : null,
      updatedAt: new Date(input.updatedAt),
      updatedByUserId: input.updatedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.tasks.firmId, input.firmId),
        eq(schema.tasks.id, input.taskId),
        ne(schema.tasks.status, "archived"),
      ),
    )
    .returning();
  return row ? mapTaskDeadlineRow(row) : undefined;
}

export async function completeDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  input: TaskDeadlineCompletionInput,
): Promise<TaskRecord | undefined> {
  const existing = await getDrizzleTaskDeadline(db, input.firmId, input.taskId);
  if (!existing) return undefined;
  if (existing.status === "completed") return existing;
  const [row] = await db
    .update(schema.tasks)
    .set({
      status: "completed",
      completedAt: new Date(input.completedAt),
      completedByUserId: input.completedByUserId ?? input.updatedByUserId ?? null,
      updatedAt: new Date(input.completedAt),
      updatedByUserId: input.updatedByUserId ?? input.completedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.tasks.firmId, input.firmId),
        eq(schema.tasks.id, input.taskId),
        ne(schema.tasks.status, "archived"),
      ),
    )
    .returning();
  return row ? mapTaskDeadlineRow(row) : undefined;
}

export async function reopenDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  input: TaskDeadlineReopenInput,
): Promise<TaskRecord | undefined> {
  const existing = await getDrizzleTaskDeadline(db, input.firmId, input.taskId);
  if (!existing) return undefined;
  if (existing.status === "open") return existing;
  const [row] = await db
    .update(schema.tasks)
    .set({
      status: "open",
      completedAt: null,
      completedByUserId: null,
      updatedAt: new Date(input.reopenedAt),
      updatedByUserId: input.reopenedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.tasks.firmId, input.firmId),
        eq(schema.tasks.id, input.taskId),
        ne(schema.tasks.status, "archived"),
      ),
    )
    .returning();
  return row ? mapTaskDeadlineRow(row) : undefined;
}

export async function archiveDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  input: TaskArchiveInput,
): Promise<TaskRecord | undefined> {
  const existing = await getDrizzleTaskDeadline(db, input.firmId, input.taskId, {
    includeArchived: true,
  });
  if (!existing) return undefined;
  if (existing.status === "archived") return existing;
  const [row] = await db
    .update(schema.tasks)
    .set({
      status: "archived",
      archivedAt: new Date(input.archivedAt),
      archivedByUserId: input.archivedByUserId ?? null,
      updatedAt: new Date(input.archivedAt),
      updatedByUserId: input.archivedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(and(eq(schema.tasks.firmId, input.firmId), eq(schema.tasks.id, input.taskId)))
    .returning();
  return row ? mapTaskDeadlineRow(row) : undefined;
}

export async function listDrizzleTaskChecklistItems(
  db: OpenPracticeDatabase,
  firmId: string,
  options: TaskChecklistItemListOptions = {},
): Promise<TaskChecklistItemRecord[]> {
  const filters: SQL[] = [eq(schema.taskChecklistItems.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.taskChecklistItems.matterId, options.matterId));
  const taskIds = taskIdsFromOptions(options);
  if (taskIds) {
    if (taskIds.length === 0) return [];
    filters.push(inArray(schema.taskChecklistItems.taskId, taskIds));
  }
  if (!options.includeArchived) filters.push(isNull(schema.taskChecklistItems.archivedAt));
  const rows = await db
    .select()
    .from(schema.taskChecklistItems)
    .where(and(...filters))
    .orderBy(asc(schema.taskChecklistItems.sortOrder), asc(schema.taskChecklistItems.id));
  return rows.map(mapTaskChecklistItemRow);
}

export async function getDrizzleTaskChecklistItem(
  db: OpenPracticeDatabase,
  firmId: string,
  itemId: string,
  options: { includeArchived?: boolean } = {},
): Promise<TaskChecklistItemRecord | undefined> {
  const filters: SQL[] = [
    eq(schema.taskChecklistItems.firmId, firmId),
    eq(schema.taskChecklistItems.id, itemId),
  ];
  if (!options.includeArchived) filters.push(isNull(schema.taskChecklistItems.archivedAt));
  const [row] = await db
    .select()
    .from(schema.taskChecklistItems)
    .where(and(...filters));
  return row ? mapTaskChecklistItemRow(row) : undefined;
}

export async function createDrizzleTaskChecklistItem(
  db: OpenPracticeDatabase,
  input: TaskChecklistItemCreateInput,
): Promise<TaskChecklistItemRecord> {
  const createdAt = input.createdAt ?? input.updatedAt ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? createdAt;
  const status = input.status ?? "open";
  const [row] = await db
    .insert(schema.taskChecklistItems)
    .values({
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      taskId: input.taskId,
      title: input.title,
      status,
      assignedToUserId: input.assignedToUserId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      sortOrder: input.sortOrder ?? 0,
      completedAt: status === "completed" ? new Date(createdAt) : null,
      completedByUserId: status === "completed" ? (input.createdByUserId ?? null) : null,
      createdAt: new Date(createdAt),
      createdByUserId: input.createdByUserId ?? null,
      updatedAt: new Date(updatedAt),
      updatedByUserId: input.updatedByUserId ?? input.createdByUserId ?? null,
      version: 1,
    })
    .returning();
  return mapTaskChecklistItemRow(row!);
}

export async function updateDrizzleTaskChecklistItem(
  db: OpenPracticeDatabase,
  input: TaskChecklistItemUpdateInput,
): Promise<TaskChecklistItemRecord | undefined> {
  const existing = await getDrizzleTaskChecklistItem(db, input.firmId, input.itemId);
  if (!existing) return undefined;
  const status = input.status ?? existing.status;
  const completedAt =
    status === "completed"
      ? input.completedAt === null
        ? null
        : new Date(input.completedAt ?? existing.completedAt ?? input.updatedAt)
      : input.completedAt === undefined
        ? null
        : dateOrNull(input.completedAt);
  const completedByUserId =
    status === "completed"
      ? input.completedByUserId === null
        ? null
        : (input.completedByUserId ?? existing.completedByUserId ?? input.updatedByUserId ?? null)
      : null;
  const [row] = await db
    .update(schema.taskChecklistItems)
    .set({
      title: input.title ?? existing.title,
      status,
      assignedToUserId:
        input.assignedToUserId === undefined
          ? (existing.assignedToUserId ?? null)
          : input.assignedToUserId,
      dueAt:
        input.dueAt === undefined
          ? existing.dueAt
            ? new Date(existing.dueAt)
            : null
          : dateOrNull(input.dueAt),
      sortOrder: input.sortOrder ?? existing.sortOrder,
      completedAt,
      completedByUserId,
      updatedAt: new Date(input.updatedAt),
      updatedByUserId: input.updatedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.taskChecklistItems.firmId, input.firmId),
        eq(schema.taskChecklistItems.id, input.itemId),
        isNull(schema.taskChecklistItems.archivedAt),
      ),
    )
    .returning();
  return row ? mapTaskChecklistItemRow(row) : undefined;
}

export async function archiveDrizzleTaskChecklistItem(
  db: OpenPracticeDatabase,
  input: TaskChecklistItemArchiveInput,
): Promise<TaskChecklistItemRecord | undefined> {
  const existing = await getDrizzleTaskChecklistItem(db, input.firmId, input.itemId, {
    includeArchived: true,
  });
  if (!existing) return undefined;
  if (existing.archivedAt) return existing;
  const [row] = await db
    .update(schema.taskChecklistItems)
    .set({
      archivedAt: new Date(input.archivedAt),
      archivedByUserId: input.archivedByUserId ?? null,
      updatedAt: new Date(input.archivedAt),
      updatedByUserId: input.archivedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.taskChecklistItems.firmId, input.firmId),
        eq(schema.taskChecklistItems.id, input.itemId),
      ),
    )
    .returning();
  return row ? mapTaskChecklistItemRow(row) : undefined;
}

export async function listDrizzleTaskComments(
  db: OpenPracticeDatabase,
  firmId: string,
  options: TaskCommentListOptions = {},
): Promise<TaskCommentRecord[]> {
  const filters: SQL[] = [eq(schema.taskComments.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.taskComments.matterId, options.matterId));
  const taskIds = taskIdsFromOptions(options);
  if (taskIds) {
    if (taskIds.length === 0) return [];
    filters.push(inArray(schema.taskComments.taskId, taskIds));
  }
  if (!options.includeArchived) filters.push(isNull(schema.taskComments.archivedAt));
  const rows = await db
    .select()
    .from(schema.taskComments)
    .where(and(...filters))
    .orderBy(asc(schema.taskComments.createdAt), asc(schema.taskComments.id));
  return rows.map(mapTaskCommentRow);
}

export async function getDrizzleTaskComment(
  db: OpenPracticeDatabase,
  firmId: string,
  commentId: string,
  options: { includeArchived?: boolean } = {},
): Promise<TaskCommentRecord | undefined> {
  const filters: SQL[] = [
    eq(schema.taskComments.firmId, firmId),
    eq(schema.taskComments.id, commentId),
  ];
  if (!options.includeArchived) filters.push(isNull(schema.taskComments.archivedAt));
  const [row] = await db
    .select()
    .from(schema.taskComments)
    .where(and(...filters));
  return row ? mapTaskCommentRow(row) : undefined;
}

export async function createDrizzleTaskComment(
  db: OpenPracticeDatabase,
  input: TaskCommentCreateInput,
): Promise<TaskCommentRecord> {
  const [row] = await db
    .insert(schema.taskComments)
    .values({
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      taskId: input.taskId,
      body: input.body,
      createdAt: new Date(input.createdAt),
      createdByUserId: input.createdByUserId,
    })
    .returning();
  return mapTaskCommentRow(row!);
}

export async function archiveDrizzleTaskComment(
  db: OpenPracticeDatabase,
  input: TaskCommentArchiveInput,
): Promise<TaskCommentRecord | undefined> {
  const existing = await getDrizzleTaskComment(db, input.firmId, input.commentId, {
    includeArchived: true,
  });
  if (!existing) return undefined;
  if (existing.archivedAt) return existing;
  const [row] = await db
    .update(schema.taskComments)
    .set({
      archivedAt: new Date(input.archivedAt),
      archivedByUserId: input.archivedByUserId ?? null,
    })
    .where(
      and(
        eq(schema.taskComments.firmId, input.firmId),
        eq(schema.taskComments.id, input.commentId),
      ),
    )
    .returning();
  return row ? mapTaskCommentRow(row) : undefined;
}

export async function listDrizzleTaskDependencies(
  db: OpenPracticeDatabase,
  firmId: string,
  options: TaskDependencyListOptions = {},
): Promise<TaskDependencyRecord[]> {
  const filters: SQL[] = [eq(schema.taskDependencies.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.taskDependencies.matterId, options.matterId));
  const taskIds = taskIdsFromOptions(options);
  if (taskIds) {
    if (taskIds.length === 0) return [];
    filters.push(inArray(schema.taskDependencies.taskId, taskIds));
  }
  if (options.dependsOnTaskId) {
    filters.push(eq(schema.taskDependencies.dependsOnTaskId, options.dependsOnTaskId));
  }
  if (!options.includeArchived) filters.push(isNull(schema.taskDependencies.archivedAt));
  const rows = await db
    .select()
    .from(schema.taskDependencies)
    .where(and(...filters))
    .orderBy(asc(schema.taskDependencies.id));
  return rows.map(mapTaskDependencyRow);
}

export async function getDrizzleTaskDependency(
  db: OpenPracticeDatabase,
  firmId: string,
  dependencyId: string,
  options: { includeArchived?: boolean } = {},
): Promise<TaskDependencyRecord | undefined> {
  const filters: SQL[] = [
    eq(schema.taskDependencies.firmId, firmId),
    eq(schema.taskDependencies.id, dependencyId),
  ];
  if (!options.includeArchived) filters.push(isNull(schema.taskDependencies.archivedAt));
  const [row] = await db
    .select()
    .from(schema.taskDependencies)
    .where(and(...filters));
  return row ? mapTaskDependencyRow(row) : undefined;
}

export async function createDrizzleTaskDependency(
  db: OpenPracticeDatabase,
  input: TaskDependencyCreateInput,
): Promise<TaskDependencyRecord> {
  if (input.taskId === input.dependsOnTaskId) {
    throw new Error("Task dependency cannot reference itself");
  }
  if (await wouldCreateBlockingCycle(db, input)) {
    throw new Error("Task dependency would create a blocking cycle");
  }
  const [row] = await db
    .insert(schema.taskDependencies)
    .values({
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      taskId: input.taskId,
      dependsOnTaskId: input.dependsOnTaskId,
      dependencyType: input.dependencyType,
      createdAt: new Date(input.createdAt),
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return mapTaskDependencyRow(row!);
}

export async function archiveDrizzleTaskDependency(
  db: OpenPracticeDatabase,
  input: TaskDependencyArchiveInput,
): Promise<TaskDependencyRecord | undefined> {
  const existing = await getDrizzleTaskDependency(db, input.firmId, input.dependencyId, {
    includeArchived: true,
  });
  if (!existing) return undefined;
  if (existing.archivedAt) return existing;
  const [row] = await db
    .update(schema.taskDependencies)
    .set({
      archivedAt: new Date(input.archivedAt),
      archivedByUserId: input.archivedByUserId ?? null,
    })
    .where(
      and(
        eq(schema.taskDependencies.firmId, input.firmId),
        eq(schema.taskDependencies.id, input.dependencyId),
      ),
    )
    .returning();
  return row ? mapTaskDependencyRow(row) : undefined;
}

export async function listDrizzleTaskTemplates(
  db: OpenPracticeDatabase,
  firmId: string,
  options: TaskTemplateListOptions = {},
): Promise<TaskTemplateRecord[]> {
  const filters: SQL[] = [eq(schema.taskTemplates.firmId, firmId)];
  if (options.status) filters.push(eq(schema.taskTemplates.status, options.status));
  if (!options.includeArchived) filters.push(ne(schema.taskTemplates.status, "archived"));
  const rows = await db
    .select()
    .from(schema.taskTemplates)
    .where(and(...filters))
    .orderBy(asc(schema.taskTemplates.name), asc(schema.taskTemplates.id));
  return rows.map(mapTaskTemplateRow);
}

export async function getDrizzleTaskTemplate(
  db: OpenPracticeDatabase,
  firmId: string,
  templateId: string,
  options: { includeArchived?: boolean } = {},
): Promise<TaskTemplateRecord | undefined> {
  const filters: SQL[] = [
    eq(schema.taskTemplates.firmId, firmId),
    eq(schema.taskTemplates.id, templateId),
  ];
  if (!options.includeArchived) filters.push(ne(schema.taskTemplates.status, "archived"));
  const [row] = await db
    .select()
    .from(schema.taskTemplates)
    .where(and(...filters));
  return row ? mapTaskTemplateRow(row) : undefined;
}

export async function listDrizzleTaskTemplateItems(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { templateId?: string; templateIds?: string[] } = {},
): Promise<TaskTemplateItemRecord[]> {
  const filters: SQL[] = [eq(schema.taskTemplateItems.firmId, firmId)];
  const templateIds = templateIdsFromOptions(options);
  if (templateIds) {
    if (templateIds.length === 0) return [];
    filters.push(inArray(schema.taskTemplateItems.templateId, templateIds));
  }
  const rows = await db
    .select()
    .from(schema.taskTemplateItems)
    .where(and(...filters))
    .orderBy(asc(schema.taskTemplateItems.sortOrder), asc(schema.taskTemplateItems.id));
  return rows.map(mapTaskTemplateItemRow);
}

function templateInsertValues(
  input: TaskTemplateCreateInput,
): typeof schema.taskTemplates.$inferInsert {
  const updatedAt = input.template.updatedAt ?? input.template.createdAt;
  return {
    id: input.template.id,
    firmId: input.template.firmId,
    name: input.template.name,
    description: input.template.description ?? null,
    defaultTitle: input.template.defaultTitle ?? null,
    defaultPriority: input.template.defaultPriority ?? "medium",
    status: "active",
    createdAt: new Date(input.template.createdAt),
    createdByUserId: input.template.createdByUserId ?? null,
    updatedAt: new Date(updatedAt),
    updatedByUserId: input.template.updatedByUserId ?? input.template.createdByUserId ?? null,
    version: 1,
  };
}

function templateItemInsertValues(
  item: TaskTemplateCreateInput["items"][number],
  templateId: string,
): typeof schema.taskTemplateItems.$inferInsert {
  return {
    id: item.id,
    firmId: item.firmId,
    templateId,
    title: item.title,
    sortOrder: item.sortOrder ?? 0,
    defaultAssigneeUserId: item.defaultAssigneeUserId ?? null,
    dueOffsetDays: item.dueOffsetDays ?? null,
    createdAt: new Date(item.createdAt),
    createdByUserId: item.createdByUserId ?? null,
    updatedAt: new Date(item.updatedAt ?? item.createdAt),
    updatedByUserId: item.updatedByUserId ?? item.createdByUserId ?? null,
  };
}

export async function createDrizzleTaskTemplate(
  db: OpenPracticeDatabase,
  input: TaskTemplateCreateInput,
): Promise<TaskTemplateWithItems> {
  const [templateRow] = await db
    .insert(schema.taskTemplates)
    .values(templateInsertValues(input))
    .returning();
  if (input.items.length > 0) {
    await db
      .insert(schema.taskTemplateItems)
      .values(input.items.map((item) => templateItemInsertValues(item, input.template.id)));
  }
  const items = await listDrizzleTaskTemplateItems(db, input.template.firmId, {
    templateId: input.template.id,
  });
  return { template: mapTaskTemplateRow(templateRow!), items };
}

export async function updateDrizzleTaskTemplate(
  db: OpenPracticeDatabase,
  input: TaskTemplateUpdateInput,
): Promise<TaskTemplateWithItems | undefined> {
  const existing = await getDrizzleTaskTemplate(db, input.firmId, input.templateId);
  if (!existing) return undefined;
  const [templateRow] = await db
    .update(schema.taskTemplates)
    .set({
      name: input.name ?? existing.name,
      description:
        input.description === undefined
          ? (existing.description ?? null)
          : (input.description ?? null),
      defaultTitle:
        input.defaultTitle === undefined
          ? (existing.defaultTitle ?? null)
          : (input.defaultTitle ?? null),
      defaultPriority: input.defaultPriority ?? existing.defaultPriority,
      updatedAt: new Date(input.updatedAt),
      updatedByUserId: input.updatedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.taskTemplates.firmId, input.firmId),
        eq(schema.taskTemplates.id, input.templateId),
        ne(schema.taskTemplates.status, "archived"),
      ),
    )
    .returning();
  if (!templateRow) return undefined;
  if (input.items) {
    await db
      .delete(schema.taskTemplateItems)
      .where(
        and(
          eq(schema.taskTemplateItems.firmId, input.firmId),
          eq(schema.taskTemplateItems.templateId, input.templateId),
        ),
      );
    if (input.items.length > 0) {
      await db
        .insert(schema.taskTemplateItems)
        .values(input.items.map((item) => templateItemInsertValues(item, input.templateId)));
    }
  }
  const items = await listDrizzleTaskTemplateItems(db, input.firmId, {
    templateId: input.templateId,
  });
  return { template: mapTaskTemplateRow(templateRow), items };
}

export async function archiveDrizzleTaskTemplate(
  db: OpenPracticeDatabase,
  input: TaskTemplateArchiveInput,
): Promise<TaskTemplateRecord | undefined> {
  const existing = await getDrizzleTaskTemplate(db, input.firmId, input.templateId, {
    includeArchived: true,
  });
  if (!existing) return undefined;
  if (existing.status === "archived") return existing;
  const [row] = await db
    .update(schema.taskTemplates)
    .set({
      status: "archived",
      archivedAt: new Date(input.archivedAt),
      archivedByUserId: input.archivedByUserId ?? null,
      updatedAt: new Date(input.archivedAt),
      updatedByUserId: input.archivedByUserId ?? null,
      version: existing.version + 1,
    })
    .where(
      and(
        eq(schema.taskTemplates.firmId, input.firmId),
        eq(schema.taskTemplates.id, input.templateId),
      ),
    )
    .returning();
  return row ? mapTaskTemplateRow(row) : undefined;
}
