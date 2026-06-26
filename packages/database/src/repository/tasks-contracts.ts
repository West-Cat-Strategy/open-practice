import type {
  TaskChecklistItemRecord,
  TaskChecklistItemStatus,
  TaskCommentRecord,
  TaskDependencyRecord,
  TaskDependencyType,
  TaskPriority,
  TaskRecord,
  TaskSourceType,
  TaskStatus,
  TaskTemplateItemRecord,
  TaskTemplateRecord,
} from "@open-practice/domain";

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

export interface TaskChecklistItemListOptions {
  matterId?: string;
  taskId?: string;
  taskIds?: string[];
  includeArchived?: boolean;
}

export interface TaskChecklistItemCreateInput {
  id: string;
  firmId: string;
  matterId: string;
  taskId: string;
  title: string;
  status?: TaskChecklistItemStatus;
  assignedToUserId?: string;
  dueAt?: string;
  sortOrder?: number;
  createdAt?: string;
  createdByUserId?: string;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface TaskChecklistItemUpdateInput {
  firmId: string;
  itemId: string;
  title?: string;
  status?: TaskChecklistItemStatus;
  assignedToUserId?: string | null;
  dueAt?: string | null;
  sortOrder?: number;
  completedAt?: string | null;
  completedByUserId?: string | null;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface TaskChecklistItemArchiveInput {
  firmId: string;
  itemId: string;
  archivedAt: string;
  archivedByUserId?: string;
}

export interface TaskCommentListOptions {
  matterId?: string;
  taskId?: string;
  taskIds?: string[];
  includeArchived?: boolean;
}

export interface TaskCommentCreateInput {
  id: string;
  firmId: string;
  matterId: string;
  taskId: string;
  body: string;
  createdAt: string;
  createdByUserId: string;
}

export interface TaskCommentArchiveInput {
  firmId: string;
  commentId: string;
  archivedAt: string;
  archivedByUserId?: string;
}

export interface TaskDependencyListOptions {
  matterId?: string;
  taskId?: string;
  dependsOnTaskId?: string;
  taskIds?: string[];
  includeArchived?: boolean;
}

export interface TaskDependencyCreateInput {
  id: string;
  firmId: string;
  matterId: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: TaskDependencyType;
  createdAt: string;
  createdByUserId?: string;
}

export interface TaskDependencyArchiveInput {
  firmId: string;
  dependencyId: string;
  archivedAt: string;
  archivedByUserId?: string;
}

export interface TaskTemplateListOptions {
  status?: TaskTemplateRecord["status"];
  includeArchived?: boolean;
}

export interface TaskTemplateCreateInput {
  template: {
    id: string;
    firmId: string;
    name: string;
    description?: string | null;
    defaultTitle?: string | null;
    defaultPriority?: TaskPriority;
    createdAt: string;
    createdByUserId?: string;
    updatedAt?: string;
    updatedByUserId?: string;
  };
  items: Array<{
    id: string;
    firmId: string;
    templateId: string;
    title: string;
    sortOrder?: number;
    defaultAssigneeUserId?: string | null;
    dueOffsetDays?: number | null;
    createdAt: string;
    createdByUserId?: string;
    updatedAt?: string;
    updatedByUserId?: string;
  }>;
}

export interface TaskTemplateUpdateInput {
  firmId: string;
  templateId: string;
  name?: string;
  description?: string | null;
  defaultTitle?: string | null;
  defaultPriority?: TaskPriority;
  updatedAt: string;
  updatedByUserId?: string;
  items?: TaskTemplateCreateInput["items"];
}

export interface TaskTemplateArchiveInput {
  firmId: string;
  templateId: string;
  archivedAt: string;
  archivedByUserId?: string;
}

export interface TaskTemplateWithItems {
  template: TaskTemplateRecord;
  items: TaskTemplateItemRecord[];
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
  listTaskChecklistItems(
    firmId: string,
    options?: TaskChecklistItemListOptions,
  ): Promise<TaskChecklistItemRecord[]>;
  getTaskChecklistItem(
    firmId: string,
    itemId: string,
    options?: { includeArchived?: boolean },
  ): Promise<TaskChecklistItemRecord | undefined>;
  createTaskChecklistItem(input: TaskChecklistItemCreateInput): Promise<TaskChecklistItemRecord>;
  updateTaskChecklistItem(
    input: TaskChecklistItemUpdateInput,
  ): Promise<TaskChecklistItemRecord | undefined>;
  archiveTaskChecklistItem(
    input: TaskChecklistItemArchiveInput,
  ): Promise<TaskChecklistItemRecord | undefined>;
  listTaskComments(firmId: string, options?: TaskCommentListOptions): Promise<TaskCommentRecord[]>;
  getTaskComment(
    firmId: string,
    commentId: string,
    options?: { includeArchived?: boolean },
  ): Promise<TaskCommentRecord | undefined>;
  createTaskComment(input: TaskCommentCreateInput): Promise<TaskCommentRecord>;
  archiveTaskComment(input: TaskCommentArchiveInput): Promise<TaskCommentRecord | undefined>;
  listTaskDependencies(
    firmId: string,
    options?: TaskDependencyListOptions,
  ): Promise<TaskDependencyRecord[]>;
  getTaskDependency(
    firmId: string,
    dependencyId: string,
    options?: { includeArchived?: boolean },
  ): Promise<TaskDependencyRecord | undefined>;
  createTaskDependency(input: TaskDependencyCreateInput): Promise<TaskDependencyRecord>;
  archiveTaskDependency(
    input: TaskDependencyArchiveInput,
  ): Promise<TaskDependencyRecord | undefined>;
  listTaskTemplates(
    firmId: string,
    options?: TaskTemplateListOptions,
  ): Promise<TaskTemplateRecord[]>;
  getTaskTemplate(
    firmId: string,
    templateId: string,
    options?: { includeArchived?: boolean },
  ): Promise<TaskTemplateRecord | undefined>;
  listTaskTemplateItems(
    firmId: string,
    options?: { templateId?: string; templateIds?: string[] },
  ): Promise<TaskTemplateItemRecord[]>;
  createTaskTemplate(input: TaskTemplateCreateInput): Promise<TaskTemplateWithItems>;
  updateTaskTemplate(input: TaskTemplateUpdateInput): Promise<TaskTemplateWithItems | undefined>;
  archiveTaskTemplate(input: TaskTemplateArchiveInput): Promise<TaskTemplateRecord | undefined>;
}
