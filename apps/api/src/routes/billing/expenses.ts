import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertBillingStatusTransition,
  billingExpenseCategoryAllowsReimbursable,
  billingExpenseCategoryAppliesToMatter,
  normalizeExpenseCategoryCode,
  type BillingExpenseCategoryRecord,
  type ExpenseEntry,
  type Matter,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertBillingTimestampUnlocked,
  assertMatterAccess,
  billingEntryQuerySchema,
  idParamsSchema,
  orderByMatterIds,
} from "./shared.js";

const expenseEntryBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    incurredAt: z.string().datetime().optional(),
    amountCents: z.number().int().positive(),
    categoryCode: z.string().min(1),
    description: z.string().min(1),
    reimbursable: z.boolean().optional(),
    billingStatus: z
      .enum(["draft", "submitted", "approved", "billed", "written_off"])
      .default("draft"),
  })
  .strict();

const expenseEntryPatchBodySchema = z
  .object({
    incurredAt: z.string().datetime().optional(),
    amountCents: z.number().int().positive().optional(),
    categoryCode: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    reimbursable: z.boolean().optional(),
    billingStatus: z.enum(["draft", "submitted", "approved", "billed", "written_off"]).optional(),
  })
  .strict();

const expenseEntryReviewDraftBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    incurredAt: z.string().datetime().optional(),
    amountCents: z.number().int().positive(),
    categoryCode: z.string().min(1),
    description: z.string().min(1),
    reimbursable: z.boolean().optional(),
  })
  .strict();

type ExpenseCategoryRepository = Pick<
  ApiRouteDependencies["repository"],
  "getBillingExpenseCategoryByCode" | "listMattersForUser"
>;

async function resolveExpenseCategoryForMatter(
  repository: ExpenseCategoryRepository,
  auth: ApiAuthContext,
  input: {
    categoryCode: string;
    matterId: string;
    reimbursable?: boolean;
    requireActive: boolean;
  },
): Promise<{
  category: BillingExpenseCategoryRecord;
  matter: Pick<Matter, "id" | "practiceArea" | "jurisdiction">;
  reimbursable: boolean;
}> {
  const categoryCode = normalizeExpenseCategoryCode(input.categoryCode);
  if (input.categoryCode !== categoryCode) {
    throw new ApiHttpError(
      400,
      "EXPENSE_CATEGORY_CODE_NORMALIZED",
      "Expense category code must be lowercase letters, numbers, and underscores",
    );
  }
  const [category, matter] = await Promise.all([
    repository.getBillingExpenseCategoryByCode(auth.firmId, categoryCode),
    repository
      .listMattersForUser(auth.user)
      .then((matters) => matters.find((candidate) => candidate.id === input.matterId)),
  ]);
  if (!category) {
    throw new ApiHttpError(
      400,
      "EXPENSE_CATEGORY_NOT_FOUND",
      "Expense category code is not available for this firm",
    );
  }
  if (input.requireActive && !category.active) {
    throw new ApiHttpError(400, "EXPENSE_CATEGORY_INACTIVE", "Expense category is inactive");
  }
  if (!matter) {
    throw new ApiHttpError(404, "MATTER_NOT_FOUND", "Matter was not found");
  }
  if (!billingExpenseCategoryAppliesToMatter(category, matter)) {
    throw new ApiHttpError(
      400,
      "EXPENSE_CATEGORY_NOT_APPLICABLE",
      "Expense category is not applicable to this matter",
    );
  }
  const reimbursable = input.reimbursable ?? category.defaultReimbursable;
  if (!billingExpenseCategoryAllowsReimbursable(category, reimbursable)) {
    throw new ApiHttpError(
      400,
      "EXPENSE_CATEGORY_REIMBURSABLE_NOT_ALLOWED",
      "Expense category cannot be marked reimbursable",
    );
  }
  return { category, matter, reimbursable };
}

export function registerBillingExpenseRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/expense-entries", async (request) => {
    const query = parseRequestPart(billingEntryQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { entries: await repository.listExpenseEntries(request.auth.firmId, query) };
    }

    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { entries: await repository.listExpenseEntries(request.auth.firmId, query) };
    }

    const assignedMatterIds = request.auth.user.assignedMatterIds;
    const entries = await repository.listExpenseEntries(request.auth.firmId, {
      ...query,
      matterIds: assignedMatterIds,
    });
    return { entries: orderByMatterIds(entries, assignedMatterIds) };
  });

  server.post("/api/expense-entries", async (request) => {
    const body = parseRequestPart(expenseEntryBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const incurredAt = body.incurredAt ?? new Date().toISOString();
    await assertBillingTimestampUnlocked(
      repository,
      request.auth.firmId,
      incurredAt,
      "Expense entry",
    );
    const resolvedCategory = await resolveExpenseCategoryForMatter(repository, request.auth, {
      categoryCode: body.categoryCode,
      matterId: body.matterId,
      reimbursable: body.reimbursable,
      requireActive: true,
    });
    const entry: ExpenseEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      incurredAt,
      amountCents: body.amountCents,
      category: resolvedCategory.category.label,
      categoryCode: resolvedCategory.category.code,
      description: body.description,
      reimbursable: resolvedCategory.reimbursable,
      billingStatus: body.billingStatus,
    };
    const created = await repository.createExpenseEntry(entry);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "expense_entry.created",
      resourceType: "expense_entry",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        expenseEntryId: created.id,
        status: created.billingStatus,
        amountCents: created.amountCents,
        categoryCode: created.categoryCode,
      },
    });
    return created;
  });

  server.post("/api/expense-entries/review-drafts", async (request) => {
    const body = parseRequestPart(expenseEntryReviewDraftBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const incurredAt = body.incurredAt ?? new Date().toISOString();
    await assertBillingTimestampUnlocked(
      repository,
      request.auth.firmId,
      incurredAt,
      "Expense entry",
    );
    const resolvedCategory = await resolveExpenseCategoryForMatter(repository, request.auth, {
      categoryCode: body.categoryCode,
      matterId: body.matterId,
      reimbursable: body.reimbursable,
      requireActive: true,
    });
    const entry: ExpenseEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      incurredAt,
      amountCents: body.amountCents,
      category: resolvedCategory.category.label,
      categoryCode: resolvedCategory.category.code,
      description: body.description,
      reimbursable: resolvedCategory.reimbursable,
      billingStatus: "draft",
    };
    const created = await repository.createExpenseEntry(entry);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "expense_entry.created",
      resourceType: "expense_entry",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        expenseEntryId: created.id,
        status: created.billingStatus,
        captureSource: "expense_profile_review",
        categoryCode: created.categoryCode,
        amountCents: created.amountCents,
        reimbursable: created.reimbursable,
      },
    });
    return created;
  });

  server.patch("/api/expense-entries/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = await repository.getExpenseEntry(request.auth.firmId, params.id);
    if (!existing)
      throw Object.assign(new Error("Expense entry was not found"), { statusCode: 404 });
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "update",
      matterId: existing.matterId,
    });
    if (["billed", "written_off"].includes(existing.billingStatus)) {
      throw Object.assign(new Error("Finalized expense entries cannot be edited"), {
        statusCode: 409,
      });
    }
    const body = parseRequestPart(expenseEntryPatchBodySchema, request.body, "body");
    await assertBillingTimestampUnlocked(
      repository,
      request.auth.firmId,
      existing.incurredAt,
      "Expense entry",
    );
    if (body.incurredAt) {
      await assertBillingTimestampUnlocked(
        repository,
        request.auth.firmId,
        body.incurredAt,
        "Expense entry",
      );
    }
    let updates: Parameters<typeof repository.updateExpenseEntry>[2] = body;
    if (body.categoryCode) {
      const resolvedCategory = await resolveExpenseCategoryForMatter(repository, request.auth, {
        categoryCode: body.categoryCode,
        matterId: existing.matterId,
        reimbursable: body.reimbursable ?? existing.reimbursable,
        requireActive: true,
      });
      updates = {
        ...body,
        category: resolvedCategory.category.label,
        categoryCode: resolvedCategory.category.code,
        reimbursable: resolvedCategory.reimbursable,
      };
    } else if (body.reimbursable === true && existing.categoryCode) {
      await resolveExpenseCategoryForMatter(repository, request.auth, {
        categoryCode: existing.categoryCode,
        matterId: existing.matterId,
        reimbursable: true,
        requireActive: false,
      });
    }
    const updated = await repository.updateExpenseEntry(request.auth.firmId, params.id, updates);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "expense_entry.updated",
      resourceType: "expense_entry",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        expenseEntryId: updated.id,
        previousStatus: existing.billingStatus,
        status: updated.billingStatus,
        amountCents: updated.amountCents,
        categoryCode: updated.categoryCode,
      },
    });
    return updated;
  });

  for (const [route, nextStatus] of [
    ["submit", "submitted"],
    ["approve", "approved"],
    ["write-off", "written_off"],
  ] as const) {
    server.post(`/api/expense-entries/:id/${route}`, async (request) => {
      const params = parseRequestPart(idParamsSchema, request.params, "params");
      const existing = await repository.getExpenseEntry(request.auth.firmId, params.id);
      if (!existing)
        throw Object.assign(new Error("Expense entry was not found"), { statusCode: 404 });
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: route === "approve" ? "approve" : "update",
        matterId: existing.matterId,
      });
      await assertBillingTimestampUnlocked(
        repository,
        request.auth.firmId,
        existing.incurredAt,
        "Expense entry",
      );
      assertBillingStatusTransition(existing.billingStatus, nextStatus);
      const updated = await repository.updateExpenseEntry(request.auth.firmId, params.id, {
        billingStatus: nextStatus,
      });
      await appendRouteAuditEvent(repository, request.auth, {
        action: `expense_entry.${route === "write-off" ? "written_off" : nextStatus}`,
        resourceType: "expense_entry",
        resourceId: updated.id,
        metadata: {
          matterId: updated.matterId,
          expenseEntryId: updated.id,
          previousStatus: existing.billingStatus,
          status: updated.billingStatus,
        },
      });
      return updated;
    });
  }
}
