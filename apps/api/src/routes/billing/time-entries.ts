import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertBillingStatusTransition,
  timerDraftMinutesFromWindow,
  type TimeEntry,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertBillingTimerWindowUnlocked,
  assertBillingTimestampUnlocked,
  assertMatterAccess,
  billingEntryQuerySchema,
  idParamsSchema,
  orderByMatterIds,
  resolveTimeEntryRate,
} from "./shared.js";

const timeEntryBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  userId: z.string().min(1).optional(),
  performedAt: z.string().datetime().optional(),
  minutes: z.number().int().positive(),
  rateCents: z.number().int().nonnegative().optional(),
  narrative: z.string().min(1),
  billable: z.boolean().default(true),
  billingStatus: z
    .enum(["draft", "submitted", "approved", "billed", "written_off"])
    .default("draft"),
});

const timeEntryPatchBodySchema = timeEntryBodySchema
  .omit({ id: true, matterId: true, userId: true })
  .partial();

const timeEntryTimerDraftBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    userId: z.string().min(1).optional(),
    startedAt: z.string().datetime(),
    stoppedAt: z.string().datetime(),
    rateCents: z.number().int().nonnegative().optional(),
    narrative: z.string().min(1),
    billable: z.boolean().default(true),
  })
  .strict();

export function registerBillingTimeEntryRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/time-entries", async (request) => {
    const query = parseRequestPart(billingEntryQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "time_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { entries: await repository.listTimeEntries(request.auth.firmId, query) };
    }

    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { entries: await repository.listTimeEntries(request.auth.firmId, query) };
    }

    const assignedMatterIds = request.auth.user.assignedMatterIds;
    const entries = await repository.listTimeEntries(request.auth.firmId, {
      ...query,
      matterIds: assignedMatterIds,
    });
    return { entries: orderByMatterIds(entries, assignedMatterIds) };
  });

  server.post("/api/time-entries", async (request) => {
    const body = parseRequestPart(timeEntryBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "create",
      matterId: body.matterId,
    });
    const now = new Date().toISOString();
    const performedAt = body.performedAt ?? now;
    await assertBillingTimestampUnlocked(
      repository,
      request.auth.firmId,
      performedAt,
      "Time entry",
    );
    const userId = body.userId ?? request.auth.user.id;
    const rate = await resolveTimeEntryRate({
      repository,
      auth: request.auth,
      matterId: body.matterId,
      userId,
      performedAt,
      rateCents: body.rateCents,
      resolvedAt: now,
    });
    const entry: TimeEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId,
      performedAt,
      minutes: body.minutes,
      narrative: body.narrative,
      billable: body.billable,
      billingStatus: body.billingStatus,
      ...rate,
    };
    const created = await repository.createTimeEntry(entry);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "time_entry.created",
      resourceType: "time_entry",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        timeEntryId: created.id,
        status: created.billingStatus,
        minutes: created.minutes,
        rateCents: created.rateCents,
        rateRuleId: created.rateRuleId,
        rateSource: created.rateSnapshot?.source,
      },
    });
    return created;
  });

  server.post("/api/time-entries/timer-drafts", async (request) => {
    const body = parseRequestPart(timeEntryTimerDraftBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "create",
      matterId: body.matterId,
    });
    await assertBillingTimerWindowUnlocked(
      repository,
      request.auth.firmId,
      body.startedAt,
      body.stoppedAt,
    );
    const now = new Date().toISOString();
    const userId = body.userId ?? request.auth.user.id;
    const minutes = timerDraftMinutesFromWindow({
      startedAt: body.startedAt,
      stoppedAt: body.stoppedAt,
    });
    const rate = await resolveTimeEntryRate({
      repository,
      auth: request.auth,
      matterId: body.matterId,
      userId,
      performedAt: body.startedAt,
      rateCents: body.rateCents,
      resolvedAt: now,
    });
    const entry: TimeEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId,
      performedAt: body.startedAt,
      minutes,
      narrative: body.narrative,
      billable: body.billable,
      billingStatus: "draft",
      ...rate,
    };
    const created = await repository.createTimeEntry(entry);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "time_entry.created",
      resourceType: "time_entry",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        timeEntryId: created.id,
        status: created.billingStatus,
        captureSource: "local_timer",
        minutes: created.minutes,
        rateCents: created.rateCents,
        rateRuleId: created.rateRuleId,
        rateSource: created.rateSnapshot?.source,
      },
    });
    return created;
  });

  server.patch("/api/time-entries/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = await repository.getTimeEntry(request.auth.firmId, params.id);
    if (!existing) throw Object.assign(new Error("Time entry was not found"), { statusCode: 404 });
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "update",
      matterId: existing.matterId,
    });
    if (["billed", "written_off"].includes(existing.billingStatus)) {
      throw Object.assign(new Error("Finalized time entries cannot be edited"), {
        statusCode: 409,
      });
    }
    const body = parseRequestPart(timeEntryPatchBodySchema, request.body, "body");
    await assertBillingTimestampUnlocked(
      repository,
      request.auth.firmId,
      existing.performedAt,
      "Time entry",
    );
    if (body.performedAt) {
      await assertBillingTimestampUnlocked(
        repository,
        request.auth.firmId,
        body.performedAt,
        "Time entry",
      );
    }
    const updates: Parameters<typeof repository.updateTimeEntry>[2] = { ...body };
    if (body.rateCents !== undefined) {
      updates.rateRuleId = undefined;
      updates.rateSnapshot = {
        source: "manual",
        rateCents: body.rateCents,
        resolvedAt: new Date().toISOString(),
      };
    }
    const updated = await repository.updateTimeEntry(request.auth.firmId, params.id, updates);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "time_entry.updated",
      resourceType: "time_entry",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        timeEntryId: updated.id,
        previousStatus: existing.billingStatus,
        status: updated.billingStatus,
        minutes: updated.minutes,
        rateCents: updated.rateCents,
        rateRuleId: updated.rateRuleId,
        rateSource: updated.rateSnapshot?.source,
      },
    });
    return updated;
  });

  for (const [route, nextStatus] of [
    ["submit", "submitted"],
    ["approve", "approved"],
    ["write-off", "written_off"],
  ] as const) {
    server.post(`/api/time-entries/:id/${route}`, async (request) => {
      const params = parseRequestPart(idParamsSchema, request.params, "params");
      const existing = await repository.getTimeEntry(request.auth.firmId, params.id);
      if (!existing)
        throw Object.assign(new Error("Time entry was not found"), { statusCode: 404 });
      assertMatterAccess(request.auth, {
        resource: "time_entry",
        action: route === "approve" ? "approve" : "update",
        matterId: existing.matterId,
      });
      await assertBillingTimestampUnlocked(
        repository,
        request.auth.firmId,
        existing.performedAt,
        "Time entry",
      );
      assertBillingStatusTransition(existing.billingStatus, nextStatus);
      const updated = await repository.updateTimeEntry(request.auth.firmId, params.id, {
        billingStatus: nextStatus,
      });
      await appendRouteAuditEvent(repository, request.auth, {
        action: `time_entry.${route === "write-off" ? "written_off" : nextStatus}`,
        resourceType: "time_entry",
        resourceId: updated.id,
        metadata: {
          matterId: updated.matterId,
          timeEntryId: updated.id,
          previousStatus: existing.billingStatus,
          status: updated.billingStatus,
        },
      });
      return updated;
    });
  }
}
