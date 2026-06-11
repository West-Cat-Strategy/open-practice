import type { TaskPriority, TaskRecord, TaskSourceType, TaskStatus } from "@open-practice/domain";

export interface TaskListOptions {
  matterIds?: string[];
  matterId?: string;
  assignedToUserId?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  sourceType?: TaskSourceType;
  sourceId?: string;
  includeCompleted?: boolean;
  includeArchived?: boolean;
}

export interface TaskCreateInput {
  id: string;
  firmId: string;
  matterId: string;
  assignedToUserId?: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  sourceType?: TaskSourceType;
  sourceId?: string;
  dueAt?: string;
  createdAt?: string;
  createdByUserId?: string;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface TaskUpdateInput {
  firmId: string;
  taskId: string;
  title?: string;
  description?: string | null;
  assignedToUserId?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  sourceType?: TaskSourceType | null;
  sourceId?: string | null;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface TaskDeadlineCompletionInput {
  firmId: string;
  taskId: string;
  completedAt: string;
  completedByUserId?: string;
  updatedByUserId?: string;
}

export interface TaskDeadlineReopenInput {
  firmId: string;
  taskId: string;
  reopenedAt: string;
  reopenedByUserId?: string;
}

export interface TaskArchiveInput {
  firmId: string;
  taskId: string;
  archivedAt: string;
  archivedByUserId?: string;
}

export interface TaskRepository {
  listTaskDeadlines(firmId: string, options?: TaskListOptions): Promise<TaskRecord[]>;
  getTaskDeadline(
    firmId: string,
    taskId: string,
    options?: { includeArchived?: boolean },
  ): Promise<TaskRecord | undefined>;
  createTaskDeadline(task: TaskCreateInput): Promise<TaskRecord>;
  updateTaskDeadline(input: TaskUpdateInput): Promise<TaskRecord | undefined>;
  completeTaskDeadline(input: TaskDeadlineCompletionInput): Promise<TaskRecord | undefined>;
  reopenTaskDeadline(input: TaskDeadlineReopenInput): Promise<TaskRecord | undefined>;
  archiveTaskDeadline(input: TaskArchiveInput): Promise<TaskRecord | undefined>;
}
