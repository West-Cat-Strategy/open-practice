import type { TaskDeadlineRecord } from "@open-practice/domain";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { mapTaskDeadlineRow } from "../drizzle-mappers.js";
import type { TaskDeadlineCompletionInput } from "../tasks-contracts.js";

export async function listDrizzleTaskDeadlines(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean } = {},
): Promise<TaskDeadlineRecord[]> {
  const filters = [eq(schema.tasks.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.tasks.matterId, options.matterId));
  } else if (options.matterIds) {
    if (options.matterIds.length === 0) return [];
    filters.push(inArray(schema.tasks.matterId, options.matterIds));
  }
  if (!options.includeCompleted) {
    filters.push(isNull(schema.tasks.completedAt));
  }
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
): Promise<TaskDeadlineRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.firmId, firmId), eq(schema.tasks.id, taskId)));
  return row ? mapTaskDeadlineRow(row) : undefined;
}

export async function createDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  task: TaskDeadlineRecord,
): Promise<TaskDeadlineRecord> {
  const [row] = await db
    .insert(schema.tasks)
    .values({
      id: task.id,
      firmId: task.firmId,
      matterId: task.matterId,
      assignedToUserId: task.assignedToUserId ?? null,
      title: task.title,
      dueAt: task.dueAt ? new Date(task.dueAt) : null,
      completedAt: task.completedAt ? new Date(task.completedAt) : null,
    })
    .returning();
  return mapTaskDeadlineRow(row!);
}

export async function completeDrizzleTaskDeadline(
  db: OpenPracticeDatabase,
  input: TaskDeadlineCompletionInput,
): Promise<TaskDeadlineRecord | undefined> {
  const [existing] = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.firmId, input.firmId), eq(schema.tasks.id, input.taskId)));
  if (!existing) return undefined;
  const [row] = await db
    .update(schema.tasks)
    .set({ completedAt: existing.completedAt ?? new Date(input.completedAt) })
    .where(and(eq(schema.tasks.firmId, input.firmId), eq(schema.tasks.id, input.taskId)))
    .returning();
  return row ? mapTaskDeadlineRow(row) : undefined;
}
