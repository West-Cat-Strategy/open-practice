import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildTaskDeadlineWorkbench } from "@open-practice/domain";
import { requireAccess, requireStaffAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { createSessionToken } from "../http/auth-helpers.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
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

const taskParamsSchema = z.object({
  taskId: z.string().min(1),
});

const taskCompletionBodySchema = z.object({
  completedAt: z.string().datetime().optional(),
});

function assertTaskAccess(
  context: ApiAuthContext,
  matterId: string,
  action: "read" | "update",
): void {
  const access = requireAccess(context, {
    resource: "task",
    action,
    matterId,
  });
  if (!access.ok) throw access.error;
}

export function registerTaskRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/tasks/workbench", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const query = parseRequestPart(taskWorkbenchQuerySchema, request.query, "query");
    const matters = await repository.listMattersForUser(request.auth.user);
    const visibleMatterIds = matters.map((matter) => matter.id);

    if (query.matterId) {
      assertTaskAccess(request.auth, query.matterId, "read");
      if (!visibleMatterIds.includes(query.matterId)) {
        throw new ApiHttpError(403, "TASK_ACCESS_REQUIRED", "Task access required", {
          matterId: query.matterId,
        });
      }
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

  server.patch("/api/tasks/:taskId/complete", async (request) => {
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
    });
    if (!completed) {
      throw new ApiHttpError(404, "TASK_NOT_FOUND", "Task not found", { taskId: params.taskId });
    }

    await repository.appendAuditEvent({
      id: `audit-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "task.completed",
      resourceType: "task",
      resourceId: task.id,
      occurredAt: completedAt,
      metadata: {
        matterId: task.matterId,
        taskId: task.id,
        assignedToUserId: task.assignedToUserId,
        completedByUserId: request.auth.user.id,
      },
    });

    return {
      task: completed,
      completion: {
        taskId: task.id,
        matterId: task.matterId,
        completedAt,
        completedByUserId: request.auth.user.id,
        auditSafe: true,
      },
    };
  });
}
