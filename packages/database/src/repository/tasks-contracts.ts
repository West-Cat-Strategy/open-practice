import type { TaskDeadlineRecord } from "@open-practice/domain";

export interface TaskDeadlineCompletionInput {
  firmId: string;
  taskId: string;
  completedAt: string;
}

export interface TaskRepository {
  listTaskDeadlines(
    firmId: string,
    options?: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean },
  ): Promise<TaskDeadlineRecord[]>;
  getTaskDeadline(firmId: string, taskId: string): Promise<TaskDeadlineRecord | undefined>;
  createTaskDeadline(task: TaskDeadlineRecord): Promise<TaskDeadlineRecord>;
  completeTaskDeadline(input: TaskDeadlineCompletionInput): Promise<TaskDeadlineRecord | undefined>;
}
