import type {
  TaskChecklistItemRecord,
  TaskCommentRecord,
  TaskDependencyRecord,
  TaskRecord,
  TaskTemplateItemRecord,
  TaskTemplateRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
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

export interface MemoryTaskStore {
  taskDeadlines: TaskRecord[];
  taskChecklistItems: TaskChecklistItemRecord[];
  taskComments: TaskCommentRecord[];
  taskDependencies: TaskDependencyRecord[];
  taskTemplates: TaskTemplateRecord[];
  taskTemplateItems: TaskTemplateItemRecord[];
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

function activeDependencies(store: MemoryTaskStore, firmId: string): TaskDependencyRecord[] {
  return store.taskDependencies.filter(
    (dependency) =>
      dependency.firmId === firmId &&
      dependency.dependencyType === "blocks" &&
      !dependency.archivedAt,
  );
}

function wouldCreateBlockingCycle(
  store: MemoryTaskStore,
  input: TaskDependencyCreateInput,
): boolean {
  if (input.dependencyType !== "blocks") return false;
  const graph = new Map<string, string[]>();
  for (const dependency of activeDependencies(store, input.firmId)) {
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

export function listMemoryTaskChecklistItems(
  store: MemoryTaskStore,
  firmId: string,
  options: TaskChecklistItemListOptions = {},
): TaskChecklistItemRecord[] {
  const taskIds = taskIdsFromOptions(options);
  return clone(
    store.taskChecklistItems
      .filter((item) => {
        if (item.firmId !== firmId) return false;
        if (options.matterId && item.matterId !== options.matterId) return false;
        if (taskIds && !taskIds.includes(item.taskId)) return false;
        if (!options.includeArchived && item.archivedAt) return false;
        return true;
      })
      .sort((left, right) =>
        left.sortOrder === right.sortOrder
          ? left.id.localeCompare(right.id)
          : left.sortOrder - right.sortOrder,
      ),
  );
}

export function getMemoryTaskChecklistItem(
  store: MemoryTaskStore,
  firmId: string,
  itemId: string,
  options: { includeArchived?: boolean } = {},
): TaskChecklistItemRecord | undefined {
  return clone(
    store.taskChecklistItems.find(
      (item) =>
        item.firmId === firmId &&
        item.id === itemId &&
        (options.includeArchived || !item.archivedAt),
    ),
  );
}

export function createMemoryTaskChecklistItem(
  store: MemoryTaskStore,
  input: TaskChecklistItemCreateInput,
): TaskChecklistItemRecord {
  if (store.taskChecklistItems.some((item) => item.id === input.id)) {
    throw new Error("Task checklist item already exists");
  }
  const createdAt = input.createdAt ?? input.updatedAt ?? new Date().toISOString();
  const status = input.status ?? "open";
  const item: TaskChecklistItemRecord = {
    id: input.id,
    firmId: input.firmId,
    matterId: input.matterId,
    taskId: input.taskId,
    title: input.title,
    status,
    assignedToUserId: input.assignedToUserId,
    dueAt: input.dueAt,
    sortOrder: input.sortOrder ?? 0,
    completedAt: status === "completed" ? createdAt : undefined,
    completedByUserId: status === "completed" ? input.createdByUserId : undefined,
    createdAt,
    createdByUserId: input.createdByUserId,
    updatedAt: input.updatedAt ?? createdAt,
    updatedByUserId: input.updatedByUserId ?? input.createdByUserId,
    version: 1,
  };
  store.taskChecklistItems.push(clone(item));
  return clone(item);
}

export function updateMemoryTaskChecklistItem(
  store: MemoryTaskStore,
  input: TaskChecklistItemUpdateInput,
): TaskChecklistItemRecord | undefined {
  const index = store.taskChecklistItems.findIndex(
    (item) => item.firmId === input.firmId && item.id === input.itemId && !item.archivedAt,
  );
  if (index < 0) return undefined;
  const existing = store.taskChecklistItems[index]!;
  const status = input.status ?? existing.status;
  const completedAt =
    status === "completed"
      ? input.completedAt === null
        ? undefined
        : (input.completedAt ?? existing.completedAt ?? input.updatedAt)
      : input.completedAt === undefined
        ? undefined
        : (input.completedAt ?? undefined);
  const updated: TaskChecklistItemRecord = {
    ...existing,
    title: input.title ?? existing.title,
    status,
    assignedToUserId:
      input.assignedToUserId === undefined
        ? existing.assignedToUserId
        : (input.assignedToUserId ?? undefined),
    dueAt: input.dueAt === undefined ? existing.dueAt : (input.dueAt ?? undefined),
    sortOrder: input.sortOrder ?? existing.sortOrder,
    completedAt,
    completedByUserId:
      status === "completed"
        ? input.completedByUserId === null
          ? undefined
          : (input.completedByUserId ?? existing.completedByUserId ?? input.updatedByUserId)
        : undefined,
    updatedAt: input.updatedAt,
    updatedByUserId: input.updatedByUserId,
    version: existing.version + 1,
  };
  store.taskChecklistItems[index] = clone(updated);
  return clone(updated);
}

export function archiveMemoryTaskChecklistItem(
  store: MemoryTaskStore,
  input: TaskChecklistItemArchiveInput,
): TaskChecklistItemRecord | undefined {
  const index = store.taskChecklistItems.findIndex(
    (item) => item.firmId === input.firmId && item.id === input.itemId,
  );
  if (index < 0) return undefined;
  if (store.taskChecklistItems[index]!.archivedAt) return clone(store.taskChecklistItems[index]);
  const archived: TaskChecklistItemRecord = {
    ...store.taskChecklistItems[index]!,
    archivedAt: input.archivedAt,
    archivedByUserId: input.archivedByUserId,
    updatedAt: input.archivedAt,
    updatedByUserId: input.archivedByUserId,
    version: store.taskChecklistItems[index]!.version + 1,
  };
  store.taskChecklistItems[index] = clone(archived);
  return clone(archived);
}

export function listMemoryTaskComments(
  store: MemoryTaskStore,
  firmId: string,
  options: TaskCommentListOptions = {},
): TaskCommentRecord[] {
  const taskIds = taskIdsFromOptions(options);
  return clone(
    store.taskComments
      .filter((comment) => {
        if (comment.firmId !== firmId) return false;
        if (options.matterId && comment.matterId !== options.matterId) return false;
        if (taskIds && !taskIds.includes(comment.taskId)) return false;
        if (!options.includeArchived && comment.archivedAt) return false;
        return true;
      })
      .sort((left, right) => {
        const leftTime = Date.parse(left.createdAt);
        const rightTime = Date.parse(right.createdAt);
        return leftTime === rightTime ? left.id.localeCompare(right.id) : leftTime - rightTime;
      }),
  );
}

export function getMemoryTaskComment(
  store: MemoryTaskStore,
  firmId: string,
  commentId: string,
  options: { includeArchived?: boolean } = {},
): TaskCommentRecord | undefined {
  return clone(
    store.taskComments.find(
      (comment) =>
        comment.firmId === firmId &&
        comment.id === commentId &&
        (options.includeArchived || !comment.archivedAt),
    ),
  );
}

export function createMemoryTaskComment(
  store: MemoryTaskStore,
  input: TaskCommentCreateInput,
): TaskCommentRecord {
  if (store.taskComments.some((comment) => comment.id === input.id)) {
    throw new Error("Task comment already exists");
  }
  const comment: TaskCommentRecord = {
    id: input.id,
    firmId: input.firmId,
    matterId: input.matterId,
    taskId: input.taskId,
    body: input.body,
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
  };
  store.taskComments.push(clone(comment));
  return clone(comment);
}

export function archiveMemoryTaskComment(
  store: MemoryTaskStore,
  input: TaskCommentArchiveInput,
): TaskCommentRecord | undefined {
  const index = store.taskComments.findIndex(
    (comment) => comment.firmId === input.firmId && comment.id === input.commentId,
  );
  if (index < 0) return undefined;
  if (store.taskComments[index]!.archivedAt) return clone(store.taskComments[index]);
  const archived: TaskCommentRecord = {
    ...store.taskComments[index]!,
    archivedAt: input.archivedAt,
    archivedByUserId: input.archivedByUserId,
  };
  store.taskComments[index] = clone(archived);
  return clone(archived);
}

export function listMemoryTaskDependencies(
  store: MemoryTaskStore,
  firmId: string,
  options: TaskDependencyListOptions = {},
): TaskDependencyRecord[] {
  const taskIds = taskIdsFromOptions(options);
  return clone(
    store.taskDependencies
      .filter((dependency) => {
        if (dependency.firmId !== firmId) return false;
        if (options.matterId && dependency.matterId !== options.matterId) return false;
        if (taskIds && !taskIds.includes(dependency.taskId)) return false;
        if (options.dependsOnTaskId && dependency.dependsOnTaskId !== options.dependsOnTaskId) {
          return false;
        }
        if (!options.includeArchived && dependency.archivedAt) return false;
        return true;
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

export function getMemoryTaskDependency(
  store: MemoryTaskStore,
  firmId: string,
  dependencyId: string,
  options: { includeArchived?: boolean } = {},
): TaskDependencyRecord | undefined {
  return clone(
    store.taskDependencies.find(
      (dependency) =>
        dependency.firmId === firmId &&
        dependency.id === dependencyId &&
        (options.includeArchived || !dependency.archivedAt),
    ),
  );
}

export function createMemoryTaskDependency(
  store: MemoryTaskStore,
  input: TaskDependencyCreateInput,
): TaskDependencyRecord {
  if (input.taskId === input.dependsOnTaskId) {
    throw new Error("Task dependency cannot reference itself");
  }
  if (
    store.taskDependencies.some(
      (dependency) =>
        dependency.firmId === input.firmId &&
        dependency.taskId === input.taskId &&
        dependency.dependsOnTaskId === input.dependsOnTaskId &&
        dependency.dependencyType === input.dependencyType &&
        !dependency.archivedAt,
    )
  ) {
    throw new Error("Task dependency already exists");
  }
  if (wouldCreateBlockingCycle(store, input)) {
    throw new Error("Task dependency would create a blocking cycle");
  }
  const dependency: TaskDependencyRecord = { ...input };
  store.taskDependencies.push(clone(dependency));
  return clone(dependency);
}

export function archiveMemoryTaskDependency(
  store: MemoryTaskStore,
  input: TaskDependencyArchiveInput,
): TaskDependencyRecord | undefined {
  const index = store.taskDependencies.findIndex(
    (dependency) => dependency.firmId === input.firmId && dependency.id === input.dependencyId,
  );
  if (index < 0) return undefined;
  if (store.taskDependencies[index]!.archivedAt) return clone(store.taskDependencies[index]);
  const archived: TaskDependencyRecord = {
    ...store.taskDependencies[index]!,
    archivedAt: input.archivedAt,
    archivedByUserId: input.archivedByUserId,
  };
  store.taskDependencies[index] = clone(archived);
  return clone(archived);
}

export function listMemoryTaskTemplates(
  store: MemoryTaskStore,
  firmId: string,
  options: TaskTemplateListOptions = {},
): TaskTemplateRecord[] {
  return clone(
    store.taskTemplates
      .filter((template) => {
        if (template.firmId !== firmId) return false;
        if (!options.includeArchived && template.status === "archived") return false;
        if (options.status && template.status !== options.status) return false;
        return true;
      })
      .sort(
        (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
      ),
  );
}

export function getMemoryTaskTemplate(
  store: MemoryTaskStore,
  firmId: string,
  templateId: string,
  options: { includeArchived?: boolean } = {},
): TaskTemplateRecord | undefined {
  return clone(
    store.taskTemplates.find(
      (template) =>
        template.firmId === firmId &&
        template.id === templateId &&
        (options.includeArchived || template.status !== "archived"),
    ),
  );
}

export function listMemoryTaskTemplateItems(
  store: MemoryTaskStore,
  firmId: string,
  options: { templateId?: string; templateIds?: string[] } = {},
): TaskTemplateItemRecord[] {
  const templateIds = templateIdsFromOptions(options);
  return clone(
    store.taskTemplateItems
      .filter((item) => {
        if (item.firmId !== firmId) return false;
        if (templateIds && !templateIds.includes(item.templateId)) return false;
        return true;
      })
      .sort((left, right) =>
        left.sortOrder === right.sortOrder
          ? left.id.localeCompare(right.id)
          : left.sortOrder - right.sortOrder,
      ),
  );
}

function normalizeTemplateInput(input: TaskTemplateCreateInput): TaskTemplateWithItems {
  const updatedAt = input.template.updatedAt ?? input.template.createdAt;
  const template: TaskTemplateRecord = {
    id: input.template.id,
    firmId: input.template.firmId,
    name: input.template.name,
    description: input.template.description ?? undefined,
    defaultTitle: input.template.defaultTitle ?? undefined,
    defaultPriority: input.template.defaultPriority ?? "medium",
    status: "active",
    createdAt: input.template.createdAt,
    createdByUserId: input.template.createdByUserId,
    updatedAt,
    updatedByUserId: input.template.updatedByUserId ?? input.template.createdByUserId,
    version: 1,
  };
  const items = input.items.map(
    (item): TaskTemplateItemRecord => ({
      id: item.id,
      firmId: item.firmId,
      templateId: input.template.id,
      title: item.title,
      sortOrder: item.sortOrder ?? 0,
      defaultAssigneeUserId: item.defaultAssigneeUserId ?? undefined,
      dueOffsetDays: item.dueOffsetDays ?? undefined,
      createdAt: item.createdAt,
      createdByUserId: item.createdByUserId,
      updatedAt: item.updatedAt ?? item.createdAt,
      updatedByUserId: item.updatedByUserId ?? item.createdByUserId,
    }),
  );
  return { template, items };
}

export function createMemoryTaskTemplate(
  store: MemoryTaskStore,
  input: TaskTemplateCreateInput,
): TaskTemplateWithItems {
  if (store.taskTemplates.some((template) => template.id === input.template.id)) {
    throw new Error("Task template already exists");
  }
  if (
    store.taskTemplates.some(
      (template) =>
        template.firmId === input.template.firmId &&
        template.status === "active" &&
        template.name === input.template.name,
    )
  ) {
    throw new Error("Active task template name already exists");
  }
  const normalized = normalizeTemplateInput(input);
  store.taskTemplates.push(clone(normalized.template));
  store.taskTemplateItems.push(...clone(normalized.items));
  return clone(normalized);
}

export function updateMemoryTaskTemplate(
  store: MemoryTaskStore,
  input: TaskTemplateUpdateInput,
): TaskTemplateWithItems | undefined {
  const index = store.taskTemplates.findIndex(
    (template) =>
      template.firmId === input.firmId &&
      template.id === input.templateId &&
      template.status !== "archived",
  );
  if (index < 0) return undefined;
  const existing = store.taskTemplates[index]!;
  const nextName = input.name ?? existing.name;
  if (
    nextName !== existing.name &&
    store.taskTemplates.some(
      (template) =>
        template.firmId === input.firmId &&
        template.id !== input.templateId &&
        template.status === "active" &&
        template.name === nextName,
    )
  ) {
    throw new Error("Active task template name already exists");
  }
  const template: TaskTemplateRecord = {
    ...existing,
    name: nextName,
    description:
      input.description === undefined ? existing.description : (input.description ?? undefined),
    defaultTitle:
      input.defaultTitle === undefined ? existing.defaultTitle : (input.defaultTitle ?? undefined),
    defaultPriority: input.defaultPriority ?? existing.defaultPriority,
    updatedAt: input.updatedAt,
    updatedByUserId: input.updatedByUserId,
    version: existing.version + 1,
  };
  store.taskTemplates[index] = clone(template);
  if (input.items) {
    store.taskTemplateItems = store.taskTemplateItems.filter(
      (item) => !(item.firmId === input.firmId && item.templateId === input.templateId),
    );
    store.taskTemplateItems.push(
      ...clone(
        input.items.map(
          (item): TaskTemplateItemRecord => ({
            id: item.id,
            firmId: input.firmId,
            templateId: input.templateId,
            title: item.title,
            sortOrder: item.sortOrder ?? 0,
            defaultAssigneeUserId: item.defaultAssigneeUserId ?? undefined,
            dueOffsetDays: item.dueOffsetDays ?? undefined,
            createdAt: item.createdAt,
            createdByUserId: item.createdByUserId,
            updatedAt: item.updatedAt ?? item.createdAt,
            updatedByUserId: item.updatedByUserId ?? item.createdByUserId,
          }),
        ),
      ),
    );
  }
  return clone({
    template,
    items: listMemoryTaskTemplateItems(store, input.firmId, { templateId: input.templateId }),
  });
}

export function archiveMemoryTaskTemplate(
  store: MemoryTaskStore,
  input: TaskTemplateArchiveInput,
): TaskTemplateRecord | undefined {
  const index = store.taskTemplates.findIndex(
    (template) => template.firmId === input.firmId && template.id === input.templateId,
  );
  if (index < 0) return undefined;
  if (store.taskTemplates[index]!.status === "archived") return clone(store.taskTemplates[index]);
  const archived: TaskTemplateRecord = {
    ...store.taskTemplates[index]!,
    status: "archived",
    archivedAt: input.archivedAt,
    archivedByUserId: input.archivedByUserId,
    updatedAt: input.archivedAt,
    updatedByUserId: input.archivedByUserId,
    version: store.taskTemplates[index]!.version + 1,
  };
  store.taskTemplates[index] = clone(archived);
  return clone(archived);
}
