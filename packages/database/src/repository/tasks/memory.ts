import type { TaskRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  TaskArchiveInput,
  TaskCreateInput,
  TaskDeadlineCompletionInput,
  TaskDeadlineReopenInput,
  TaskListOptions,
  TaskUpdateInput,
} from "../tasks-contracts.js";

export interface MemoryTaskStore {
  taskDeadlines: TaskRecord[];
}

function assertTaskSourcePair(sourceType: unknown, sourceId: unknown): void {
  if (Boolean(sourceType) !== Boolean(sourceId)) {
    throw new Error("Task source type and source id must be set together");
  }
}

function normalizeTaskCreateInput(task: TaskCreateInput): TaskRecord {
  assertTaskSourcePair(task.sourceType, task.sourceId);
  const createdAt = task.createdAt ?? task.updatedAt ?? new Date().toISOString();
  const updatedAt = task.updatedAt ?? createdAt;
  return {
    id: task.id,
    firmId: task.firmId,
    matterId: task.matterId,
    assignedToUserId: task.assignedToUserId,
    title: task.title,
    description: task.description ?? undefined,
    status: "open",
    priority: task.priority ?? "medium",
    sourceType: task.sourceType,
    sourceId: task.sourceId,
    dueAt: task.dueAt,
    completedAt: undefined,
    completedByUserId: undefined,
    archivedAt: undefined,
    archivedByUserId: undefined,
    createdAt,
    createdByUserId: task.createdByUserId,
    updatedAt,
    updatedByUserId: task.updatedByUserId ?? task.createdByUserId,
    version: 1,
  };
}

function listValue<T extends string>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export function listMemoryTaskDeadlines(
  store: MemoryTaskStore,
  firmId: string,
  options: TaskListOptions = {},
): TaskRecord[] {
  const matterIds = options.matterId ? [options.matterId] : options.matterIds;
  const statuses = listValue(options.status);
  const priorities = listValue(options.priority);
  return clone(
    store.taskDeadlines
      .filter((task) => {
        if (task.firmId !== firmId) return false;
        if (matterIds && !matterIds.includes(task.matterId)) return false;
        if (!options.includeArchived && task.status === "archived") return false;
        if (!options.includeCompleted && task.completedAt) return false;
        if (statuses && !statuses.includes(task.status)) return false;
        if (priorities && !priorities.includes(task.priority)) return false;
        if (options.assignedToUserId && task.assignedToUserId !== options.assignedToUserId) {
          return false;
        }
        if (options.sourceType && task.sourceType !== options.sourceType) return false;
        if (options.sourceId && task.sourceId !== options.sourceId) return false;
        return true;
      })
      .sort((left, right) => {
        const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
        const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return left.id.localeCompare(right.id);
      }),
  );
}

export function getMemoryTaskDeadline(
  store: MemoryTaskStore,
  firmId: string,
  taskId: string,
  options: { includeArchived?: boolean } = {},
): TaskRecord | undefined {
  return clone(
    store.taskDeadlines.find(
      (task) =>
        task.firmId === firmId &&
        task.id === taskId &&
        (options.includeArchived || task.status !== "archived"),
    ),
  );
}

export function createMemoryTaskDeadline(
  store: MemoryTaskStore,
  task: TaskCreateInput,
): TaskRecord {
  if (store.taskDeadlines.some((candidate) => candidate.id === task.id)) {
    throw new Error("Task deadline already exists");
  }
  const created = normalizeTaskCreateInput(task);
  store.taskDeadlines.push(clone(created));
  return clone(created);
}

export function updateMemoryTaskDeadline(
  store: MemoryTaskStore,
  input: TaskUpdateInput,
): TaskRecord | undefined {
  const index = store.taskDeadlines.findIndex(
    (task) =>
      task.firmId === input.firmId && task.id === input.taskId && task.status !== "archived",
  );
  if (index < 0) return undefined;
  const existing = store.taskDeadlines[index]!;
  const nextSourceType =
    input.sourceType === undefined ? existing.sourceType : (input.sourceType ?? undefined);
  const nextSourceId =
    input.sourceId === undefined ? existing.sourceId : (input.sourceId ?? undefined);
  assertTaskSourcePair(nextSourceType, nextSourceId);
  const updated: TaskRecord = {
    ...existing,
    title: input.title ?? existing.title,
    description:
      input.description === undefined ? existing.description : (input.description ?? undefined),
    assignedToUserId:
      input.assignedToUserId === undefined
        ? existing.assignedToUserId
        : (input.assignedToUserId ?? undefined),
    priority: input.priority ?? existing.priority,
    dueAt: input.dueAt === undefined ? existing.dueAt : (input.dueAt ?? undefined),
    sourceType: nextSourceType,
    sourceId: nextSourceType ? nextSourceId : undefined,
    updatedAt: input.updatedAt,
    updatedByUserId: input.updatedByUserId,
    version: existing.version + 1,
  };
  store.taskDeadlines[index] = clone(updated);
  return clone(updated);
}

export function completeMemoryTaskDeadline(
  store: MemoryTaskStore,
  input: TaskDeadlineCompletionInput,
): TaskRecord | undefined {
  const index = store.taskDeadlines.findIndex(
    (task) =>
      task.firmId === input.firmId && task.id === input.taskId && task.status !== "archived",
  );
  if (index < 0) return undefined;
  if (store.taskDeadlines[index]!.status === "completed") return clone(store.taskDeadlines[index]);
  const completed = {
    ...store.taskDeadlines[index]!,
    status: "completed" as const,
    completedAt: input.completedAt,
    completedByUserId: input.completedByUserId ?? input.updatedByUserId,
    updatedAt: input.completedAt,
    updatedByUserId: input.updatedByUserId ?? input.completedByUserId,
    version: store.taskDeadlines[index]!.version + 1,
  };
  store.taskDeadlines[index] = clone(completed);
  return clone(completed);
}

export function reopenMemoryTaskDeadline(
  store: MemoryTaskStore,
  input: TaskDeadlineReopenInput,
): TaskRecord | undefined {
  const index = store.taskDeadlines.findIndex(
    (task) =>
      task.firmId === input.firmId && task.id === input.taskId && task.status !== "archived",
  );
  if (index < 0) return undefined;
  if (store.taskDeadlines[index]!.status === "open") return clone(store.taskDeadlines[index]);
  const reopened = {
    ...store.taskDeadlines[index]!,
    status: "open" as const,
    completedAt: undefined,
    completedByUserId: undefined,
    updatedAt: input.reopenedAt,
    updatedByUserId: input.reopenedByUserId,
    version: store.taskDeadlines[index]!.version + 1,
  };
  store.taskDeadlines[index] = clone(reopened);
  return clone(reopened);
}

export function archiveMemoryTaskDeadline(
  store: MemoryTaskStore,
  input: TaskArchiveInput,
): TaskRecord | undefined {
  const index = store.taskDeadlines.findIndex(
    (task) => task.firmId === input.firmId && task.id === input.taskId,
  );
  if (index < 0) return undefined;
  if (store.taskDeadlines[index]!.status === "archived") return clone(store.taskDeadlines[index]);
  const archived = {
    ...store.taskDeadlines[index]!,
    status: "archived" as const,
    archivedAt: input.archivedAt,
    archivedByUserId: input.archivedByUserId,
    updatedAt: input.archivedAt,
    updatedByUserId: input.archivedByUserId,
    version: store.taskDeadlines[index]!.version + 1,
  };
  store.taskDeadlines[index] = clone(archived);
  return clone(archived);
}
