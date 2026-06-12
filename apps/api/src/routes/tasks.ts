import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildTaskDeadlineWorkbench, projectTaskDeadline } from "@open-practice/domain";
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
    action: "task.created" | "task.updated" | "task.completed" | "task.reopened" | "task.archived";
    taskId: string;
    matterId: string;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await repository.appendAuditEvent({
    id: `audit-${createSessionToken().slice(0, 16)}`,
    firmId: context.firmId,
    actorId: context.user.id,
    action: input.action,
    resourceType: "task",
    resourceId: input.taskId,
    occurredAt: input.occurredAt,
    metadata: {
      matterId: input.matterId,
      taskId: input.taskId,
      ...input.metadata,
    },
  });
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

    return buildTaskDeadlineWorkbench({
      tasks,
      matterParties: matters.flatMap((matter) => matter.parties),
      matters: matters.map((matter) => ({
        id: matter.id,
        number: matter.number,
        title: matter.title,
      })),
      schedulingRequests,
      userId: request.auth.user.id,
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
