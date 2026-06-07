import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertBillingStatusTransition,
  expenseCategoryProfileCues,
  expenseCategoryProfileForKey,
  type ExpenseEntry,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertBillingTimestampUnlocked,
  assertMatterAccess,
  billingEntryQuerySchema,
  idParamsSchema,
} from "./shared.js";

const expenseCategoryProfileKeySchema = z.enum(
  expenseCategoryProfileCues.map((profile) => profile.key) as [
    (typeof expenseCategoryProfileCues)[number]["key"],
    ...(typeof expenseCategoryProfileCues)[number]["key"][],
  ],
);

const expenseEntryBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  incurredAt: z.string().datetime().optional(),
  amountCents: z.number().int().positive(),
  category: z.string().min(1),
  description: z.string().min(1),
  reimbursable: z.boolean().default(true),
  billingStatus: z
    .enum(["draft", "submitted", "approved", "billed", "written_off"])
    .default("draft"),
});

const expenseEntryPatchBodySchema = expenseEntryBodySchema
  .omit({ id: true, matterId: true })
  .partial();

const expenseEntryReviewDraftBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    incurredAt: z.string().datetime().optional(),
    amountCents: z.number().int().positive(),
    categoryProfileKey: expenseCategoryProfileKeySchema.optional(),
    category: z.string().min(1).optional(),
    description: z.string().min(1),
    reimbursable: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Boolean(body.categoryProfileKey ?? body.category?.trim()), {
    message: "Expense review draft requires a profile key or category",
    path: ["category"],
  });

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

    const entries = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listExpenseEntries(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { entries };
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
    const entry: ExpenseEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      incurredAt,
      amountCents: body.amountCents,
      category: body.category,
      description: body.description,
      reimbursable: body.reimbursable,
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
    const profile = body.categoryProfileKey
      ? expenseCategoryProfileForKey(body.categoryProfileKey)
      : undefined;
    const category = profile?.category ?? body.category?.trim();
    if (!category) {
      throw Object.assign(new Error("Expense review draft requires a category"), {
        statusCode: 400,
      });
    }
    const entry: ExpenseEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      incurredAt,
      amountCents: body.amountCents,
      category,
      description: body.description,
      reimbursable: body.reimbursable ?? profile?.defaultReimbursable ?? true,
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
        categoryProfileKey: profile?.key,
        category: created.category,
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
    const updated = await repository.updateExpenseEntry(request.auth.firmId, params.id, body);
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
