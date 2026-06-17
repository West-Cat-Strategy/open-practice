import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  billingRuleScope,
  normalizeExpenseCategoryCode,
  type BillingExpenseCategoryRecord,
  type BillingPeriodLockRecord,
} from "@open-practice/domain";
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

const provinceSchema = z.enum(["BC", "ON", "CANADA", "OTHER"]);

const billingExpenseCategoryBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    code: z.string().min(1),
    label: z.string().min(1),
    active: z.boolean().default(true),
    defaultReimbursable: z.boolean().default(true),
    reimbursableAllowed: z.boolean().default(true),
    matterId: z.string().min(1).optional(),
    practiceAreas: z.array(z.string().min(1)).default([]),
    jurisdictions: z.array(provinceSchema).default([]),
    reviewCue: z.string().min(1).optional(),
  })
  .strict();

const billingExpenseCategoryPatchBodySchema = billingExpenseCategoryBodySchema
  .omit({ id: true, code: true })
  .partial()
  .strict();

type BillingControlRouteDependencies = Pick<ApiRouteDependencies, "repository">;

function uniqueTrimmed(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueValues<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function expenseCategoryAuditMetadata(category: BillingExpenseCategoryRecord) {
  return {
    billingExpenseCategoryId: category.id,
    code: category.code,
    active: category.active,
    matterId: category.matterId,
    practiceAreaCount: category.practiceAreas.length,
    jurisdictionCount: category.jurisdictions.length,
    reimbursableAllowed: category.reimbursableAllowed,
  };
}

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

  server.get("/api/billing/expense-categories", async (request) => {
    assertBillingControlAccess(request.auth, "read");
    return {
      categories: await repository.listBillingExpenseCategories(request.auth.firmId),
    };
  });

  server.post("/api/billing/expense-categories", async (request) => {
    assertBillingControlAccess(request.auth, "create");
    const body = parseRequestPart(billingExpenseCategoryBodySchema, request.body, "body");
    const code = normalizeExpenseCategoryCode(body.code);
    if (body.code !== code) {
      throw new ApiHttpError(
        400,
        "BILLING_EXPENSE_CATEGORY_CODE_NORMALIZED",
        "Expense category code must be lowercase letters, numbers, and underscores",
      );
    }
    const existing = await repository.getBillingExpenseCategoryByCode(request.auth.firmId, code);
    if (existing) {
      throw new ApiHttpError(
        409,
        "BILLING_EXPENSE_CATEGORY_CODE_EXISTS",
        "Expense category code already exists",
      );
    }
    const now = new Date().toISOString();
    const category: BillingExpenseCategoryRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      code,
      label: body.label.trim(),
      active: body.active,
      defaultReimbursable: body.defaultReimbursable,
      reimbursableAllowed: body.reimbursableAllowed,
      matterId: body.matterId,
      practiceAreas: uniqueTrimmed(body.practiceAreas),
      jurisdictions: uniqueValues(body.jurisdictions),
      reviewCue: body.reviewCue?.trim(),
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    };
    if (!category.reimbursableAllowed && category.defaultReimbursable) {
      throw new ApiHttpError(
        400,
        "BILLING_EXPENSE_CATEGORY_REIMBURSABLE_DEFAULT",
        "Default reimbursable cannot be true when reimbursable is not allowed",
      );
    }
    const created = await repository.createBillingExpenseCategory(category);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_expense_category.created",
      resourceType: "billing_expense_category",
      resourceId: created.id,
      metadata: expenseCategoryAuditMetadata(created),
    });
    return created;
  });

  server.patch("/api/billing/expense-categories/:id", async (request) => {
    assertBillingControlAccess(request.auth, "create");
    const params = parseRequestPart(z.object({ id: z.string().min(1) }), request.params, "params");
    const existing = await repository.getBillingExpenseCategory(request.auth.firmId, params.id);
    if (!existing) {
      throw new ApiHttpError(
        404,
        "BILLING_EXPENSE_CATEGORY_NOT_FOUND",
        "Expense category was not found",
      );
    }
    const body = parseRequestPart(billingExpenseCategoryPatchBodySchema, request.body, "body");
    const candidateDefaultReimbursable = body.defaultReimbursable ?? existing.defaultReimbursable;
    const candidateReimbursableAllowed = body.reimbursableAllowed ?? existing.reimbursableAllowed;
    if (!candidateReimbursableAllowed && candidateDefaultReimbursable) {
      throw new ApiHttpError(
        400,
        "BILLING_EXPENSE_CATEGORY_REIMBURSABLE_DEFAULT",
        "Default reimbursable cannot be true when reimbursable is not allowed",
      );
    }
    const updates: Parameters<typeof repository.updateBillingExpenseCategory>[2] = {
      updatedByUserId: request.auth.user.id,
      updatedAt: new Date().toISOString(),
    };
    if ("label" in body) updates.label = body.label?.trim();
    if ("active" in body) updates.active = body.active;
    if ("defaultReimbursable" in body) updates.defaultReimbursable = body.defaultReimbursable;
    if ("reimbursableAllowed" in body) updates.reimbursableAllowed = body.reimbursableAllowed;
    if ("matterId" in body) updates.matterId = body.matterId;
    if ("practiceAreas" in body) updates.practiceAreas = uniqueTrimmed(body.practiceAreas ?? []);
    if ("jurisdictions" in body) updates.jurisdictions = uniqueValues(body.jurisdictions ?? []);
    if ("reviewCue" in body) updates.reviewCue = body.reviewCue?.trim();
    const updated = await repository.updateBillingExpenseCategory(
      request.auth.firmId,
      params.id,
      updates,
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_expense_category.updated",
      resourceType: "billing_expense_category",
      resourceId: updated.id,
      metadata: expenseCategoryAuditMetadata(updated),
    });
    return updated;
  });
}
