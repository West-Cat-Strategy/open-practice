import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  buildLegalClinicCadenceSignals,
  buildTaskStructuredDetail,
  buildTaskDeadlineWorkbench,
  projectTaskDeadline,
} from "@open-practice/domain";
import type { LegalClinicMatterProfile, TaskDeadlineRecord } from "@open-practice/domain";
import type { ApiAuthContext } from "../server.js";
import { requireAccess, requireStaffAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { createSessionToken } from "../http/auth-helpers.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiRouteDependencies } from "./types.js";

const optionalQueryBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().default(true));

const taskWorkbenchQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  includeCompleted: optionalQueryBoolean,
});

const taskStatusSchema = z.enum(["open", "completed", "archived"]);
const taskPrioritySchema = z.enum(["high", "medium", "low"]);
const taskSourceTypeSchema = z.enum([
  "manual",
  "intake_review",
  "inbound_email_follow_up",
  "signature_follow_up",
  "calendar_scheduling",
  "operational_view",
  "system_import",
]);
const taskListQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  assignedToUserId: z.string().min(1).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  bucket: z.enum(["overdue", "today", "upcoming", "unscheduled", "completed"]).optional(),
  includeCompleted: optionalQueryBoolean,
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});
const taskParamsSchema = z.object({
  taskId: z.string().min(1),
});
const checklistItemParamsSchema = taskParamsSchema.extend({
  itemId: z.string().min(1),
});
const commentParamsSchema = taskParamsSchema.extend({
  commentId: z.string().min(1),
});
const dependencyParamsSchema = taskParamsSchema.extend({
  dependencyId: z.string().min(1),
});
const templateParamsSchema = z.object({
  templateId: z.string().min(1),
});

const taskSourceSchema = z
  .object({
    sourceType: taskSourceTypeSchema.optional(),
    sourceId: z.string().trim().min(1).max(160).optional(),
  })
  .refine((value) => !value.sourceType || Boolean(value.sourceId), {
    message: "Task source id is required when source type is set",
    path: ["sourceId"],
  })
  .refine((value) => !value.sourceId || Boolean(value.sourceType), {
    message: "Task source type is required when source id is set",
    path: ["sourceType"],
  });

const taskCreateBodySchema = taskSourceSchema.extend({
  matterId: z.string().min(1),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional(),
  assignedToUserId: z.string().min(1).optional(),
  priority: taskPrioritySchema.default("medium"),
  dueAt: z.string().datetime().optional(),
});

const nullableSourceSchema = z
  .object({
    sourceType: taskSourceTypeSchema.nullable().optional(),
    sourceId: z.string().trim().min(1).max(160).nullable().optional(),
  })
  .refine((value) => (value.sourceType === undefined) === (value.sourceId === undefined), {
    message: "Task source type and source id must be updated together",
    path: ["sourceType"],
  })
  .refine(
    (value) => value.sourceType !== null || value.sourceId === undefined || value.sourceId === null,
    {
      message: "Task source id must be cleared when source type is cleared",
      path: ["sourceId"],
    },
  )
  .refine(
    (value) =>
      value.sourceType === undefined || value.sourceType === null || Boolean(value.sourceId),
    {
      message: "Task source id is required when source type is set",
      path: ["sourceId"],
    },
  );

const taskPatchBodySchema = nullableSourceSchema.extend({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assignedToUserId: z.string().min(1).nullable().optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

const taskCompletionBodySchema = z.object({
  completedAt: z.string().datetime().optional(),
});

const emptyBodySchema = z.object({});

const checklistItemStatusSchema = z.enum(["open", "completed", "blocked"]);
const checklistItemCreateBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  status: checklistItemStatusSchema.default("open"),
  assignedToUserId: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});
const checklistItemPatchBodySchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  status: checklistItemStatusSchema.optional(),
  assignedToUserId: z.string().min(1).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});
const taskCommentCreateBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
const taskDependencyTypeSchema = z.enum(["blocks", "relates_to"]);
const taskDependencyCreateBodySchema = z.object({
  dependsOnTaskId: z.string().min(1),
  dependencyType: taskDependencyTypeSchema.default("blocks"),
});
const templateItemBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  defaultAssigneeUserId: z.string().min(1).nullable().optional(),
  dueOffsetDays: z.number().int().min(-365).max(365).nullable().optional(),
});
const taskTemplateQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});
const taskTemplateCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  defaultTitle: z.string().trim().min(1).max(180).nullable().optional(),
  defaultPriority: taskPrioritySchema.default("medium"),
  items: z.array(templateItemBodySchema).max(50).default([]),
});
const taskTemplatePatchBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  defaultTitle: z.string().trim().min(1).max(180).nullable().optional(),
  defaultPriority: taskPrioritySchema.optional(),
  items: z.array(templateItemBodySchema).max(50).optional(),
});
const applyTemplateToMatterBodySchema = z.object({
  matterId: z.string().min(1),
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(2000).optional(),
  assignedToUserId: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
});
const applyTemplateToTaskBodySchema = z.object({
  templateId: z.string().min(1),
});

function assertTaskAccess(
  context: ApiAuthContext,
  matterId: string,
  action: "create" | "read" | "update" | "delete",
): void {
  const access = requireAccess(context, {
    resource: "task",
    action,
    matterId,
  });
  if (!access.ok) throw access.error;
}

async function visibleMatterIdsForRequest(
  request: FastifyRequest & { auth: ApiAuthContext },
  repository: ApiRouteDependencies["repository"],
): Promise<string[]> {
  const matters = await repository.listMattersForUser(request.auth.user);
  return matters.map((matter) => matter.id);
}

function assertMatterVisible(matterIds: string[], matterId: string): void {
  if (!matterIds.includes(matterId)) {
    throw new ApiHttpError(403, "TASK_ACCESS_REQUIRED", "Task access required", { matterId });
  }
}

function hasTaskPatchChange(body: z.infer<typeof taskPatchBodySchema>): boolean {
  return Object.values(body).some((value) => value !== undefined);
}

async function assertAssignedUserCanReadTask(
  context: ApiAuthContext,
  repository: ApiRouteDependencies["repository"],
  assignedToUserId: string | undefined | null,
  matterId: string,
): Promise<void> {
  if (!assignedToUserId) return;
  const assignedUser = await repository.getUser(context.firmId, assignedToUserId);
  if (!assignedUser) {
    throw new ApiHttpError(404, "TASK_ASSIGNEE_NOT_FOUND", "Assigned user was not found", {
      assignedToUserId,
    });
  }
  assertTaskAccess({ firmId: context.firmId, user: assignedUser }, matterId, "read");
}

async function appendTaskAuditEvent(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
  input: {
    action: string;
    taskId?: string;
    matterId?: string;
    resourceType?: string;
    resourceId?: string;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await repository.appendAuditEvent({
    id: `audit-${createSessionToken().slice(0, 16)}`,
    firmId: context.firmId,
    actorId: context.user.id,
    action: input.action,
    resourceType: input.resourceType ?? "task",
    resourceId: input.resourceId ?? input.taskId ?? "task-structure",
    occurredAt: input.occurredAt,
    metadata: {
      ...(input.matterId ? { matterId: input.matterId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...input.metadata,
    },
  });
}

async function getAuthorizedTask(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
  taskId: string,
  action: "read" | "update" | "delete",
  options: { includeArchived?: boolean } = {},
): Promise<TaskDeadlineRecord> {
  const task = await repository.getTaskDeadline(context.firmId, taskId, options);
  if (!task) {
    throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId });
  }
  assertTaskAccess(context, task.matterId, action);
  return task;
}

function assertTemplateAdministrator(context: ApiAuthContext): void {
  if (context.user.role === "owner_admin" || context.user.role === "licensee") return;
  throw new ApiHttpError(
    403,
    "TASK_TEMPLATE_ADMIN_REQUIRED",
    "Task template administration requires owner administrator or licensee access",
  );
}

function hasChecklistItemPatchChange(body: z.infer<typeof checklistItemPatchBodySchema>): boolean {
  return Object.values(body).some((value) => value !== undefined);
}

function hasTemplatePatchChange(body: z.infer<typeof taskTemplatePatchBodySchema>): boolean {
  return Object.values(body).some((value) => value !== undefined);
}

async function buildTaskStructureResponse(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  task: TaskDeadlineRecord,
) {
  const [checklistItems, comments, dependencies, templates] = await Promise.all([
    repository.listTaskChecklistItems(firmId, { taskId: task.id }),
    repository.listTaskComments(firmId, { taskId: task.id }),
    repository.listTaskDependencies(firmId, { taskId: task.id }),
    repository.listTaskTemplates(firmId),
  ]);
  const [dependencyTasks, templateItems] = await Promise.all([
    dependencies.length > 0
      ? Promise.all(
          dependencies.map((dependency) =>
            repository.getTaskDeadline(firmId, dependency.dependsOnTaskId, {
              includeArchived: true,
            }),
          ),
        )
      : [],
    templates.length > 0
      ? repository.listTaskTemplateItems(firmId, {
          templateIds: templates.map((template) => template.id),
        })
      : [],
  ]);

  const presentDependencyTasks = dependencyTasks.filter(Boolean) as TaskDeadlineRecord[];

  return buildTaskStructuredDetail({
    task,
    checklistItems,
    comments,
    dependencies,
    dependencyTasks: presentDependencyTasks,
    templates,
    templateItems,
  });
}

function dueAtWithOffset(
  baseDueAt: string | undefined,
  offsetDays: number | undefined,
): string | undefined {
  if (!baseDueAt || offsetDays === undefined) return undefined;
  const dueAt = new Date(baseDueAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + offsetDays);
  return dueAt.toISOString();
}

async function createChecklistItemsFromTemplate(
  repository: ApiRouteDependencies["repository"],
  input: {
    firmId: string;
    matterId: string;
    taskId: string;
    taskDueAt?: string;
    items: Awaited<ReturnType<ApiRouteDependencies["repository"]["listTaskTemplateItems"]>>;
    createdAt: string;
    createdByUserId: string;
  },
): Promise<string[]> {
  const createdIds: string[] = [];
  for (const [index, item] of input.items.entries()) {
    const created = await repository.createTaskChecklistItem({
      id: `task-checklist-${createSessionToken().slice(0, 16)}`,
      firmId: input.firmId,
      matterId: input.matterId,
      taskId: input.taskId,
      title: item.title,
      assignedToUserId: item.defaultAssigneeUserId,
      dueAt: dueAtWithOffset(input.taskDueAt, item.dueOffsetDays),
      sortOrder: item.sortOrder ?? index,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
      updatedAt: input.createdAt,
      updatedByUserId: input.createdByUserId,
    });
    createdIds.push(created.id);
  }
  return createdIds;
}

function taskTemplateItemInputs(
  items: z.infer<typeof taskTemplateCreateBodySchema>["items"],
  input: { firmId: string; templateId: string; now: string; userId: string },
) {
  return items.map((item, index) => ({
    id: `task-template-item-${createSessionToken().slice(0, 16)}`,
    firmId: input.firmId,
    templateId: input.templateId,
    title: item.title,
    sortOrder: item.sortOrder ?? index,
    defaultAssigneeUserId: item.defaultAssigneeUserId,
    dueOffsetDays: item.dueOffsetDays,
    createdAt: input.now,
    createdByUserId: input.userId,
    updatedAt: input.now,
    updatedByUserId: input.userId,
  }));
}

export function registerTaskRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/tasks", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const query = parseRequestPart(taskListQuerySchema, request.query, "query");
    const visibleMatterIds = await visibleMatterIdsForRequest(request, repository);
    if (query.matterId) {
      assertTaskAccess(request.auth, query.matterId, "read");
      assertMatterVisible(visibleMatterIds, query.matterId);
    }
    const tasks = await repository.listTaskDeadlines(request.auth.firmId, {
      matterIds: query.matterId ? [query.matterId] : visibleMatterIds,
      assignedToUserId: query.assignedToUserId,
      status: query.status,
      priority: query.priority,
      includeCompleted: query.includeCompleted,
      includeArchived: query.includeArchived,
    });
    const now = new Date();
    const projected = tasks
      .map((task) => projectTaskDeadline(task, now))
      .filter((task) => !query.bucket || task.bucket === query.bucket);
    return { tasks: projected };
  });

  server.get("/api/tasks/workbench", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const query = parseRequestPart(taskWorkbenchQuerySchema, request.query, "query");
    const matters = await repository.listMattersForUser(request.auth.user);
    const visibleMatterIds = matters.map((matter) => matter.id);

    if (query.matterId) {
      assertTaskAccess(request.auth, query.matterId, "read");
      assertMatterVisible(visibleMatterIds, query.matterId);
    }

    const matterIds = query.matterId ? [query.matterId] : visibleMatterIds;
    const tasks = await repository.listTaskDeadlines(request.auth.firmId, {
      matterIds,
      includeCompleted: query.includeCompleted,
    });
    const schedulingRequests =
      matterIds.length > 0
        ? (
            await Promise.all(
              matterIds.map((matterId) =>
                repository.listCalendarSchedulingRequests(request.auth.firmId, { matterId }),
              ),
            )
          ).flat()
        : [];
    const legalClinicProfiles =
      matterIds.length > 0
        ? (
            await Promise.all(
              matterIds.map((matterId) =>
                repository.getLegalClinicMatterProfile(request.auth.firmId, matterId),
              ),
            )
          ).filter((profile): profile is LegalClinicMatterProfile => Boolean(profile))
        : [];
    const legalClinicPrograms =
      legalClinicProfiles.length > 0
        ? await repository.listLegalClinicPrograms(request.auth.firmId)
        : [];

    return buildTaskDeadlineWorkbench({
      tasks,
      matterParties: matters.flatMap((matter) => matter.parties),
      matters: matters.map((matter) => ({
        id: matter.id,
        number: matter.number,
        title: matter.title,
      })),
      schedulingRequests,
      legalClinicCadenceSignals: buildLegalClinicCadenceSignals({
        profiles: legalClinicProfiles,
        programs: legalClinicPrograms,
      }),
      userId: request.auth.user.id,
    });
  });

  server.get("/api/tasks/:taskId/structure", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "read");
    return { structure: await buildTaskStructureResponse(repository, request.auth.firmId, task) };
  });

  server.post("/api/tasks/:taskId/checklist-items", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const body = parseRequestPart(checklistItemCreateBodySchema, request.body, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    await assertAssignedUserCanReadTask(
      request.auth,
      repository,
      body.assignedToUserId,
      task.matterId,
    );
    const now = new Date().toISOString();
    const checklistItem = await repository.createTaskChecklistItem({
      id: `task-checklist-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: task.matterId,
      taskId: task.id,
      title: body.title,
      status: body.status,
      assignedToUserId: body.assignedToUserId,
      dueAt: body.dueAt,
      sortOrder: body.sortOrder,
      createdAt: now,
      createdByUserId: request.auth.user.id,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.checklist_item.created",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        checklistItemId: checklistItem.id,
        status: checklistItem.status,
        assignedToUserId: checklistItem.assignedToUserId,
        dueAt: checklistItem.dueAt,
        sortOrder: checklistItem.sortOrder,
      },
    });
    return reply.code(201).send({
      checklistItem,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    });
  });

  server.patch("/api/tasks/:taskId/checklist-items/:itemId", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(checklistItemParamsSchema, request.params, "params");
    const body = parseRequestPart(checklistItemPatchBodySchema, request.body ?? {}, "body");
    if (!hasChecklistItemPatchChange(body)) {
      throw new ApiHttpError(
        400,
        "TASK_CHECKLIST_UPDATE_EMPTY",
        "Checklist item update requires a changed field",
      );
    }
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const existing = await repository.getTaskChecklistItem(request.auth.firmId, params.itemId);
    if (!existing || existing.taskId !== task.id) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    await assertAssignedUserCanReadTask(
      request.auth,
      repository,
      body.assignedToUserId,
      task.matterId,
    );
    const now = new Date().toISOString();
    const updated = await repository.updateTaskChecklistItem({
      firmId: request.auth.firmId,
      itemId: existing.id,
      title: body.title,
      status: body.status,
      assignedToUserId: body.assignedToUserId,
      dueAt: body.dueAt,
      sortOrder: body.sortOrder,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    if (!updated) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.checklist_item.updated",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        checklistItemId: updated.id,
        previousStatus: existing.status,
        status: updated.status,
        assignedToUserId: updated.assignedToUserId,
        dueAt: updated.dueAt,
        sortOrder: updated.sortOrder,
        titleChanged: body.title !== undefined,
        assignmentChanged: body.assignedToUserId !== undefined,
        dueAtChanged: body.dueAt !== undefined,
      },
    });
    return {
      checklistItem: updated,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.patch("/api/tasks/:taskId/checklist-items/:itemId/complete", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(checklistItemParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const existing = await repository.getTaskChecklistItem(request.auth.firmId, params.itemId);
    if (!existing || existing.taskId !== task.id) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    const now = new Date().toISOString();
    const updated = await repository.updateTaskChecklistItem({
      firmId: request.auth.firmId,
      itemId: existing.id,
      status: "completed",
      completedAt: existing.completedAt ?? now,
      completedByUserId: request.auth.user.id,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    if (!updated) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    if (existing.status !== "completed") {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.checklist_item.completed",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: now,
        metadata: {
          checklistItemId: updated.id,
          previousStatus: existing.status,
          status: updated.status,
          completedByUserId: request.auth.user.id,
        },
      });
    }
    return {
      checklistItem: updated,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.patch("/api/tasks/:taskId/checklist-items/:itemId/reopen", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(checklistItemParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const existing = await repository.getTaskChecklistItem(request.auth.firmId, params.itemId);
    if (!existing || existing.taskId !== task.id) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    const now = new Date().toISOString();
    const updated = await repository.updateTaskChecklistItem({
      firmId: request.auth.firmId,
      itemId: existing.id,
      status: "open",
      completedAt: null,
      completedByUserId: null,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    if (!updated) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    if (existing.status !== "open") {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.checklist_item.reopened",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: now,
        metadata: {
          checklistItemId: updated.id,
          previousStatus: existing.status,
          status: updated.status,
          reopenedByUserId: request.auth.user.id,
        },
      });
    }
    return {
      checklistItem: updated,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.patch("/api/tasks/:taskId/checklist-items/:itemId/archive", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(checklistItemParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const existing = await repository.getTaskChecklistItem(request.auth.firmId, params.itemId, {
      includeArchived: true,
    });
    if (!existing || existing.taskId !== task.id) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    const archivedAt = existing.archivedAt ?? new Date().toISOString();
    const archived = await repository.archiveTaskChecklistItem({
      firmId: request.auth.firmId,
      itemId: existing.id,
      archivedAt,
      archivedByUserId: request.auth.user.id,
    });
    if (!archived) {
      throw new ApiHttpError(404, "TASK_CHECKLIST_ITEM_NOT_FOUND", "Checklist item not found", {
        itemId: params.itemId,
      });
    }
    if (!existing.archivedAt) {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.checklist_item.archived",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: archivedAt,
        metadata: {
          checklistItemId: archived.id,
          archivedByUserId: request.auth.user.id,
          status: archived.status,
        },
      });
    }
    return {
      checklistItem: archived,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.post("/api/tasks/:taskId/comments", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const body = parseRequestPart(taskCommentCreateBodySchema, request.body, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const now = new Date().toISOString();
    const comment = await repository.createTaskComment({
      id: `task-comment-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: task.matterId,
      taskId: task.id,
      body: body.body,
      createdAt: now,
      createdByUserId: request.auth.user.id,
    });
    const comments = await repository.listTaskComments(request.auth.firmId, { taskId: task.id });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.comment.added",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        commentId: comment.id,
        commentCount: comments.length,
        staffOnly: true,
      },
    });
    return reply.code(201).send({
      comment,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    });
  });

  server.patch("/api/tasks/:taskId/comments/:commentId/archive", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(commentParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const existing = await repository.getTaskComment(request.auth.firmId, params.commentId, {
      includeArchived: true,
    });
    if (!existing || existing.taskId !== task.id) {
      throw new ApiHttpError(404, "TASK_COMMENT_NOT_FOUND", "Task comment not found", {
        commentId: params.commentId,
      });
    }
    const archivedAt = existing.archivedAt ?? new Date().toISOString();
    const archived = await repository.archiveTaskComment({
      firmId: request.auth.firmId,
      commentId: existing.id,
      archivedAt,
      archivedByUserId: request.auth.user.id,
    });
    if (!archived) {
      throw new ApiHttpError(404, "TASK_COMMENT_NOT_FOUND", "Task comment not found", {
        commentId: params.commentId,
      });
    }
    if (!existing.archivedAt) {
      const comments = await repository.listTaskComments(request.auth.firmId, { taskId: task.id });
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.comment.archived",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: archivedAt,
        metadata: {
          commentId: archived.id,
          commentCount: comments.length,
          archivedByUserId: request.auth.user.id,
          staffOnly: true,
        },
      });
    }
    return {
      comment: archived,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.post("/api/tasks/:taskId/dependencies", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const body = parseRequestPart(taskDependencyCreateBodySchema, request.body, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    if (task.id === body.dependsOnTaskId) {
      throw new ApiHttpError(
        400,
        "TASK_DEPENDENCY_SELF_LINK",
        "Task dependency cannot reference itself",
      );
    }
    const dependencyTask = await repository.getTaskDeadline(
      request.auth.firmId,
      body.dependsOnTaskId,
    );
    if (!dependencyTask) {
      throw new ApiHttpError(404, "TASK_DEPENDENCY_TARGET_NOT_FOUND", "Dependency task not found", {
        dependsOnTaskId: body.dependsOnTaskId,
      });
    }
    if (dependencyTask.matterId !== task.matterId) {
      throw new ApiHttpError(
        400,
        "TASK_DEPENDENCY_CROSS_MATTER",
        "Task dependencies must stay within the same matter",
        { taskId: task.id, dependsOnTaskId: dependencyTask.id },
      );
    }
    assertTaskAccess(request.auth, dependencyTask.matterId, "read");
    const activeMatches = await repository.listTaskDependencies(request.auth.firmId, {
      taskId: task.id,
      dependsOnTaskId: dependencyTask.id,
    });
    if (activeMatches.some((dependency) => dependency.dependencyType === body.dependencyType)) {
      throw new ApiHttpError(
        409,
        "TASK_DEPENDENCY_ALREADY_EXISTS",
        "Task dependency already exists",
      );
    }
    const now = new Date().toISOString();
    let dependency;
    try {
      dependency = await repository.createTaskDependency({
        id: `task-dependency-${createSessionToken().slice(0, 16)}`,
        firmId: request.auth.firmId,
        matterId: task.matterId,
        taskId: task.id,
        dependsOnTaskId: dependencyTask.id,
        dependencyType: body.dependencyType,
        createdAt: now,
        createdByUserId: request.auth.user.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Task dependency is invalid";
      throw new ApiHttpError(
        message.includes("cycle") ? 409 : 400,
        "TASK_DEPENDENCY_INVALID",
        message,
      );
    }
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.dependency.added",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        dependencyId: dependency.id,
        dependsOnTaskId: dependency.dependsOnTaskId,
        dependencyType: dependency.dependencyType,
      },
    });
    return reply.code(201).send({
      dependency,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    });
  });

  server.patch("/api/tasks/:taskId/dependencies/:dependencyId/archive", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(dependencyParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const existing = await repository.getTaskDependency(request.auth.firmId, params.dependencyId, {
      includeArchived: true,
    });
    if (!existing || existing.taskId !== task.id) {
      throw new ApiHttpError(404, "TASK_DEPENDENCY_NOT_FOUND", "Task dependency not found", {
        dependencyId: params.dependencyId,
      });
    }
    const archivedAt = existing.archivedAt ?? new Date().toISOString();
    const archived = await repository.archiveTaskDependency({
      firmId: request.auth.firmId,
      dependencyId: existing.id,
      archivedAt,
      archivedByUserId: request.auth.user.id,
    });
    if (!archived) {
      throw new ApiHttpError(404, "TASK_DEPENDENCY_NOT_FOUND", "Task dependency not found", {
        dependencyId: params.dependencyId,
      });
    }
    if (!existing.archivedAt) {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.dependency.archived",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: archivedAt,
        metadata: {
          dependencyId: archived.id,
          dependsOnTaskId: archived.dependsOnTaskId,
          dependencyType: archived.dependencyType,
          archivedByUserId: request.auth.user.id,
        },
      });
    }
    return {
      dependency: archived,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.post("/api/tasks/:taskId/apply-template", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const body = parseRequestPart(applyTemplateToTaskBodySchema, request.body, "body");
    const task = await getAuthorizedTask(repository, request.auth, params.taskId, "update");
    const template = await repository.getTaskTemplate(request.auth.firmId, body.templateId);
    if (!template) {
      throw new ApiHttpError(404, "TASK_TEMPLATE_NOT_FOUND", "Task template not found", {
        templateId: body.templateId,
      });
    }
    const templateItems = await repository.listTaskTemplateItems(request.auth.firmId, {
      templateId: template.id,
    });
    const now = new Date().toISOString();
    const createdChecklistItemIds = await createChecklistItemsFromTemplate(repository, {
      firmId: request.auth.firmId,
      matterId: task.matterId,
      taskId: task.id,
      taskDueAt: task.dueAt,
      items: templateItems,
      createdAt: now,
      createdByUserId: request.auth.user.id,
    });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.template.applied",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        templateId: template.id,
        checklistItemCount: createdChecklistItemIds.length,
        checklistItemIds: createdChecklistItemIds,
        appliedToExistingTask: true,
      },
    });
    return {
      template,
      createdChecklistItemIds,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    };
  });

  server.get("/api/task-templates", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const query = parseRequestPart(taskTemplateQuerySchema, request.query, "query");
    const templates = await repository.listTaskTemplates(request.auth.firmId, {
      includeArchived: query.includeArchived,
    });
    const templateItems =
      templates.length > 0
        ? await repository.listTaskTemplateItems(request.auth.firmId, {
            templateIds: templates.map((template) => template.id),
          })
        : [];
    return { templates, templateItems };
  });

  server.post("/api/task-templates", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    assertTemplateAdministrator(request.auth);
    const body = parseRequestPart(taskTemplateCreateBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const templateId = `task-template-${createSessionToken().slice(0, 16)}`;
    const result = await repository.createTaskTemplate({
      template: {
        id: templateId,
        firmId: request.auth.firmId,
        name: body.name,
        description: body.description,
        defaultTitle: body.defaultTitle,
        defaultPriority: body.defaultPriority,
        createdAt: now,
        createdByUserId: request.auth.user.id,
        updatedAt: now,
        updatedByUserId: request.auth.user.id,
      },
      items: taskTemplateItemInputs(body.items, {
        firmId: request.auth.firmId,
        templateId,
        now,
        userId: request.auth.user.id,
      }),
    });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.template.created",
      resourceType: "task_template",
      resourceId: result.template.id,
      occurredAt: now,
      metadata: {
        templateId: result.template.id,
        defaultPriority: result.template.defaultPriority,
        itemCount: result.items.length,
      },
    });
    return reply.code(201).send(result);
  });

  server.patch("/api/task-templates/:templateId", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    assertTemplateAdministrator(request.auth);
    const params = parseRequestPart(templateParamsSchema, request.params, "params");
    const body = parseRequestPart(taskTemplatePatchBodySchema, request.body ?? {}, "body");
    if (!hasTemplatePatchChange(body)) {
      throw new ApiHttpError(
        400,
        "TASK_TEMPLATE_UPDATE_EMPTY",
        "Template update requires a changed field",
      );
    }
    const existing = await repository.getTaskTemplate(request.auth.firmId, params.templateId);
    if (!existing) {
      throw new ApiHttpError(404, "TASK_TEMPLATE_NOT_FOUND", "Task template not found", {
        templateId: params.templateId,
      });
    }
    const now = new Date().toISOString();
    const updated = await repository.updateTaskTemplate({
      firmId: request.auth.firmId,
      templateId: existing.id,
      name: body.name,
      description: body.description,
      defaultTitle: body.defaultTitle,
      defaultPriority: body.defaultPriority,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
      items: body.items
        ? taskTemplateItemInputs(body.items, {
            firmId: request.auth.firmId,
            templateId: existing.id,
            now,
            userId: request.auth.user.id,
          })
        : undefined,
    });
    if (!updated) {
      throw new ApiHttpError(404, "TASK_TEMPLATE_NOT_FOUND", "Task template not found", {
        templateId: params.templateId,
      });
    }
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.template.updated",
      resourceType: "task_template",
      resourceId: updated.template.id,
      occurredAt: now,
      metadata: {
        templateId: updated.template.id,
        defaultPriority: updated.template.defaultPriority,
        itemCount: updated.items.length,
        nameChanged: body.name !== undefined,
        descriptionChanged: body.description !== undefined,
        defaultTitleChanged: body.defaultTitle !== undefined,
        itemSetReplaced: body.items !== undefined,
      },
    });
    return updated;
  });

  server.patch("/api/task-templates/:templateId/archive", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    assertTemplateAdministrator(request.auth);
    const params = parseRequestPart(templateParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const existing = await repository.getTaskTemplate(request.auth.firmId, params.templateId, {
      includeArchived: true,
    });
    if (!existing) {
      throw new ApiHttpError(404, "TASK_TEMPLATE_NOT_FOUND", "Task template not found", {
        templateId: params.templateId,
      });
    }
    const archivedAt = existing.archivedAt ?? new Date().toISOString();
    const archived = await repository.archiveTaskTemplate({
      firmId: request.auth.firmId,
      templateId: existing.id,
      archivedAt,
      archivedByUserId: request.auth.user.id,
    });
    if (!archived) {
      throw new ApiHttpError(404, "TASK_TEMPLATE_NOT_FOUND", "Task template not found", {
        templateId: params.templateId,
      });
    }
    if (existing.status !== "archived") {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.template.archived",
        resourceType: "task_template",
        resourceId: archived.id,
        occurredAt: archivedAt,
        metadata: {
          templateId: archived.id,
          archivedByUserId: request.auth.user.id,
        },
      });
    }
    return { template: archived };
  });

  server.post("/api/task-templates/:templateId/apply", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(templateParamsSchema, request.params, "params");
    const body = parseRequestPart(applyTemplateToMatterBodySchema, request.body, "body");
    const template = await repository.getTaskTemplate(request.auth.firmId, params.templateId);
    if (!template) {
      throw new ApiHttpError(404, "TASK_TEMPLATE_NOT_FOUND", "Task template not found", {
        templateId: params.templateId,
      });
    }
    assertTaskAccess(request.auth, body.matterId, "create");
    const visibleMatterIds = await visibleMatterIdsForRequest(request, repository);
    assertMatterVisible(visibleMatterIds, body.matterId);
    await assertAssignedUserCanReadTask(
      request.auth,
      repository,
      body.assignedToUserId,
      body.matterId,
    );
    const templateItems = await repository.listTaskTemplateItems(request.auth.firmId, {
      templateId: template.id,
    });
    const now = new Date().toISOString();
    const task = await repository.createTaskDeadline({
      id: `task-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.title ?? template.defaultTitle ?? template.name,
      description: body.description,
      assignedToUserId: body.assignedToUserId,
      priority: template.defaultPriority,
      sourceType: "manual",
      sourceId: template.id,
      dueAt: body.dueAt,
      createdAt: now,
      createdByUserId: request.auth.user.id,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    const createdChecklistItemIds = await createChecklistItemsFromTemplate(repository, {
      firmId: request.auth.firmId,
      matterId: task.matterId,
      taskId: task.id,
      taskDueAt: task.dueAt,
      items: templateItems,
      createdAt: now,
      createdByUserId: request.auth.user.id,
    });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.created",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        assignedToUserId: task.assignedToUserId,
        priority: task.priority,
        dueAt: task.dueAt,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
        templateId: template.id,
        checklistItemCount: createdChecklistItemIds.length,
      },
    });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.template.applied",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        templateId: template.id,
        checklistItemCount: createdChecklistItemIds.length,
        checklistItemIds: createdChecklistItemIds,
        appliedToExistingTask: false,
      },
    });
    return reply.code(201).send({
      task: projectTaskDeadline(task),
      template,
      createdChecklistItemIds,
      structure: await buildTaskStructureResponse(repository, request.auth.firmId, task),
    });
  });

  server.get("/api/tasks/:taskId", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const task = await repository.getTaskDeadline(request.auth.firmId, params.taskId);
    if (!task) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    assertTaskAccess(request.auth, task.matterId, "read");
    return { task: projectTaskDeadline(task) };
  });

  server.post("/api/tasks", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const body = parseRequestPart(taskCreateBodySchema, request.body, "body");
    assertTaskAccess(request.auth, body.matterId, "create");
    const visibleMatterIds = await visibleMatterIdsForRequest(request, repository);
    assertMatterVisible(visibleMatterIds, body.matterId);
    await assertAssignedUserCanReadTask(
      request.auth,
      repository,
      body.assignedToUserId,
      body.matterId,
    );
    const now = new Date().toISOString();
    const task = await repository.createTaskDeadline({
      id: `task-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.title,
      description: body.description,
      assignedToUserId: body.assignedToUserId,
      priority: body.priority,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      dueAt: body.dueAt,
      createdAt: now,
      createdByUserId: request.auth.user.id,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.created",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        assignedToUserId: task.assignedToUserId,
        priority: task.priority,
        dueAt: task.dueAt,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
      },
    });
    return reply.code(201).send({ task: projectTaskDeadline(task) });
  });

  server.patch("/api/tasks/:taskId", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const body = parseRequestPart(taskPatchBodySchema, request.body ?? {}, "body");
    if (!hasTaskPatchChange(body)) {
      throw new ApiHttpError(400, "TASK_UPDATE_EMPTY", "Task update requires a changed field");
    }
    const task = await repository.getTaskDeadline(request.auth.firmId, params.taskId);
    if (!task) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    assertTaskAccess(request.auth, task.matterId, "update");
    await assertAssignedUserCanReadTask(
      request.auth,
      repository,
      body.assignedToUserId,
      task.matterId,
    );
    const now = new Date().toISOString();
    const updated = await repository.updateTaskDeadline({
      firmId: request.auth.firmId,
      taskId: task.id,
      title: body.title,
      description: body.description,
      assignedToUserId: body.assignedToUserId,
      priority: body.priority,
      dueAt: body.dueAt,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    if (!updated) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    await appendTaskAuditEvent(repository, request.auth, {
      action: "task.updated",
      taskId: task.id,
      matterId: task.matterId,
      occurredAt: now,
      metadata: {
        assignedToUserId: updated.assignedToUserId,
        priority: updated.priority,
        dueAt: updated.dueAt,
        sourceType: updated.sourceType,
        sourceId: updated.sourceId,
        titleChanged: body.title !== undefined,
        descriptionChanged: body.description !== undefined,
        assignmentChanged: body.assignedToUserId !== undefined,
        dueAtChanged: body.dueAt !== undefined,
        sourceChanged: body.sourceType !== undefined || body.sourceId !== undefined,
      },
    });
    return { task: projectTaskDeadline(updated) };
  });

  server.patch("/api/tasks/:taskId/complete", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    const body = parseRequestPart(taskCompletionBodySchema, request.body ?? {}, "body");
    const task = await repository.getTaskDeadline(request.auth.firmId, params.taskId);
    if (!task) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    assertTaskAccess(request.auth, task.matterId, "update");

    const completedAt = task.completedAt ?? body.completedAt ?? new Date().toISOString();
    const completed = await repository.completeTaskDeadline({
      firmId: request.auth.firmId,
      taskId: task.id,
      completedAt,
      completedByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    });
    if (!completed) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }

    if (task.status !== "completed") {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.completed",
        occurredAt: completedAt,
        taskId: task.id,
        matterId: task.matterId,
        metadata: {
          assignedToUserId: task.assignedToUserId,
          completedByUserId: request.auth.user.id,
        },
      });
    }

    return {
      task: projectTaskDeadline(completed),
      completion: {
        taskId: task.id,
        matterId: task.matterId,
        completedAt,
        completedByUserId: request.auth.user.id,
        auditSafe: true,
      },
    };
  });

  server.patch("/api/tasks/:taskId/reopen", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await repository.getTaskDeadline(request.auth.firmId, params.taskId);
    if (!task) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    assertTaskAccess(request.auth, task.matterId, "update");
    const reopenedAt = new Date().toISOString();
    const reopened = await repository.reopenTaskDeadline({
      firmId: request.auth.firmId,
      taskId: task.id,
      reopenedAt,
      reopenedByUserId: request.auth.user.id,
    });
    if (!reopened) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    if (task.status !== "open") {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.reopened",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: reopenedAt,
        metadata: {
          assignedToUserId: reopened.assignedToUserId,
          reopenedByUserId: request.auth.user.id,
        },
      });
    }
    return {
      task: projectTaskDeadline(reopened),
      reopening: {
        taskId: task.id,
        matterId: task.matterId,
        reopenedAt,
        reopenedByUserId: request.auth.user.id,
        auditSafe: true,
      },
    };
  });

  server.patch("/api/tasks/:taskId/archive", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(taskParamsSchema, request.params, "params");
    parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
    const task = await repository.getTaskDeadline(request.auth.firmId, params.taskId, {
      includeArchived: true,
    });
    if (!task) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    assertTaskAccess(request.auth, task.matterId, "delete");
    const archivedAt = task.archivedAt ?? new Date().toISOString();
    const archived = await repository.archiveTaskDeadline({
      firmId: request.auth.firmId,
      taskId: task.id,
      archivedAt,
      archivedByUserId: request.auth.user.id,
    });
    if (!archived) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }
    if (task.status !== "archived") {
      await appendTaskAuditEvent(repository, request.auth, {
        action: "task.archived",
        taskId: task.id,
        matterId: task.matterId,
        occurredAt: archivedAt,
        metadata: {
          assignedToUserId: task.assignedToUserId,
          archivedByUserId: request.auth.user.id,
        },
      });
    }
    return {
      task: projectTaskDeadline(archived),
      archive: {
        taskId: task.id,
        matterId: task.matterId,
        archivedAt,
        archivedByUserId: request.auth.user.id,
        auditSafe: true,
      },
    };
  });
}
