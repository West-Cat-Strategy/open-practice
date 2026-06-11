import type { TaskRecord } from "@open-practice/domain";
import { and, asc, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapTaskDeadlineRow } from "../drizzle-mappers.js";
import type {
  TaskArchiveInput,
  TaskCreateInput,
  TaskDeadlineCompletionInput,
  TaskDeadlineReopenInput,
  TaskListOptions,
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

function assertTaskSourcePair(sourceType: unknown, sourceId: unknown): void {
  if (Boolean(sourceType) !== Boolean(sourceId)) {
    throw new Error("Task source type and source id must be set together");
  }
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
