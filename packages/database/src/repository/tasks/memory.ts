import type { TaskDeadlineRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { TaskDeadlineCompletionInput } from "../tasks-contracts.js";

export interface MemoryTaskStore {
  taskDeadlines: TaskDeadlineRecord[];
}

export function listMemoryTaskDeadlines(
  store: MemoryTaskStore,
  firmId: string,
  options: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean } = {},
): TaskDeadlineRecord[] {
  const matterIds = options.matterId ? [options.matterId] : options.matterIds;
  return clone(
    store.taskDeadlines
      .filter((task) => {
        if (task.firmId !== firmId) return false;
        if (matterIds && !matterIds.includes(task.matterId)) return false;
        if (!options.includeCompleted && task.completedAt) return false;
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
): TaskDeadlineRecord | undefined {
  return clone(store.taskDeadlines.find((task) => task.firmId === firmId && task.id === taskId));
}

export function createMemoryTaskDeadline(
  store: MemoryTaskStore,
  task: TaskDeadlineRecord,
): TaskDeadlineRecord {
  if (store.taskDeadlines.some((candidate) => candidate.id === task.id)) {
    throw new Error("Task deadline already exists");
  }
  store.taskDeadlines.push(clone(task));
  return clone(task);
}

export function completeMemoryTaskDeadline(
  store: MemoryTaskStore,
  input: TaskDeadlineCompletionInput,
): TaskDeadlineRecord | undefined {
  const index = store.taskDeadlines.findIndex(
    (task) => task.firmId === input.firmId && task.id === input.taskId,
  );
  if (index < 0) return undefined;
  const completed = {
    ...store.taskDeadlines[index]!,
    completedAt: store.taskDeadlines[index]!.completedAt ?? input.completedAt,
  };
  store.taskDeadlines[index] = clone(completed);
  return clone(completed);
}
