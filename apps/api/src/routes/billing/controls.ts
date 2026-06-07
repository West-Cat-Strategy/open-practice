import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { billingRuleScope, type BillingPeriodLockRecord } from "@open-practice/domain";
import type { BillingRateRuleRecord } from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";

const billingPeriodLockBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    reason: z.string().min(1).optional(),
  })
  .strict();

const billingRateRuleBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    label: z.string().min(1),
    matterId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    rateCents: z.number().int().nonnegative(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveUntil: z.string().datetime().optional(),
    active: z.boolean().default(true),
  })
  .strict();

type BillingControlRouteDependencies = Pick<ApiRouteDependencies, "repository">;

function assertBillingControlAccess(context: ApiAuthContext, action: "read" | "create"): void {
  const access = requireAccess(context, { resource: "trust_ledger", action });
  if (!access.ok) throw access.error;
  if (!hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(
      403,
      "BILLING_CONTROLS_ACCESS_REQUIRED",
      "Billing controls access required",
    );
  }
}

export function registerBillingControlRoutes(
  server: FastifyInstance,
  { repository }: BillingControlRouteDependencies,
): void {
  server.get("/api/billing/period-locks", async (request) => {
    assertBillingControlAccess(request.auth, "read");
    return { locks: await repository.listBillingPeriodLocks(request.auth.firmId) };
  });

  server.post("/api/billing/period-locks", async (request) => {
    assertBillingControlAccess(request.auth, "create");
    const body = parseRequestPart(billingPeriodLockBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const lock: BillingPeriodLockRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      reason: body.reason,
      lockedByUserId: request.auth.user.id,
      lockedAt: now,
    };
    const created = await repository.createBillingPeriodLock(lock);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_period_lock.created",
      resourceType: "billing_period_lock",
      resourceId: created.id,
      metadata: {
        billingPeriodLockId: created.id,
        periodStart: created.periodStart,
        periodEnd: created.periodEnd,
        reasonPresent: Boolean(created.reason),
      },
    });
    return created;
  });

  server.get("/api/billing/rate-rules", async (request) => {
    assertBillingControlAccess(request.auth, "read");
    return { rules: await repository.listBillingRateRules(request.auth.firmId) };
  });

  server.post("/api/billing/rate-rules", async (request) => {
    assertBillingControlAccess(request.auth, "create");
    const body = parseRequestPart(billingRateRuleBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const rule: BillingRateRuleRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      label: body.label,
      matterId: body.matterId,
      userId: body.userId,
      role: body.role,
      scope: billingRuleScope(body),
      rateCents: body.rateCents,
      effectiveFrom: body.effectiveFrom ?? now,
      effectiveUntil: body.effectiveUntil,
      active: body.active,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    };
    const created = await repository.createBillingRateRule(rule);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_rate_rule.created",
      resourceType: "billing_rate_rule",
      resourceId: created.id,
      metadata: {
        billingRateRuleId: created.id,
        scope: created.scope,
        matterId: created.matterId,
        userId: created.userId,
        role: created.role,
        rateCents: created.rateCents,
        active: created.active,
      },
    });
    return created;
  });
}
