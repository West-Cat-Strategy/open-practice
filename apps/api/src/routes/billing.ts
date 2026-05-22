import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertBillingStatusTransition,
  billingDateFallsInsideLock,
  billingRuleScope,
  calculateInvoiceTotals,
  clientTrustBalanceByMatter,
  createInvoiceLineTotals,
  isBillableUnbilled,
  resolveBillingRateRule,
  summarizeTrustTransferLedgerLink,
  trustTransferRequestAvailableBalanceCents,
  type AccessRequest,
} from "@open-practice/domain";
import type {
  BillingPeriodLockRecord,
  BillingRateRuleRecord,
  BillingRateSnapshot,
  ExpenseEntry,
  InvoiceLineRecord,
  InvoiceRecord,
  JobLifecycleRecord,
  ManualPaymentRecord,
  PaymentAllocationRecord,
  TimeEntry,
  TrustTransferRequestRecord,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

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

const billingEntryQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["draft", "submitted", "approved", "billed", "written_off"]).optional(),
});

const invoiceQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["draft", "approved", "issued", "partially_paid", "paid", "void"]).optional(),
});

const invoiceBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  clientContactId: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  memo: z.string().min(1).optional(),
  timeEntryIds: z.array(z.string().min(1)).default([]),
  expenseEntryIds: z.array(z.string().min(1)).default([]),
  adjustmentLines: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        unitAmountCents: z.number().int(),
        taxName: z.string().min(1).optional(),
        taxRateBps: z.number().int().nonnegative().default(0),
      }),
    )
    .default([]),
  taxName: z.string().min(1).optional(),
  taxRateBps: z.number().int().nonnegative().default(0),
});

const paymentBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  invoiceId: z.string().min(1),
  clientContactId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  receivedAt: z.string().datetime().optional(),
  method: z.enum(["cash", "cheque", "card", "eft", "other"]).default("other"),
  reference: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const paymentQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
});

const billingTrustTransferRequestBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1),
    invoiceId: z.string().min(1),
    clientContactId: z.string().min(1).optional(),
    amountCents: z.number().int().positive(),
    reason: z.string().min(1).optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const trustTransferRequestQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["pending_approval", "approved", "rejected", "linked", "cancelled"]).optional(),
});

const trustTransferRequestReviewBodySchema = z
  .object({
    evidence: z.record(z.string(), z.unknown()).default({}),
  })
  .default({ evidence: {} });

const trustTransferRequestLinkBodySchema = z.object({
  ledgerTransactionId: z.string().min(1),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

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

const billingExportRequestBodySchema = z
  .object({
    idempotencyKey: z.string().min(1).max(160).optional(),
    matterId: z.string().min(1).optional(),
  })
  .strict();

const billingExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function hasEvidence(evidence: Record<string, unknown>): boolean {
  return Object.keys(evidence).length > 0;
}

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function billingExportJobId(): string {
  return `billing-export-${crypto.randomUUID()}`;
}

function billingExportScope(matterId: string | undefined): "firm" | "matter" {
  return matterId ? "matter" : "firm";
}

function billingExportRequestFingerprint(auth: ApiAuthContext, matterId: string | undefined) {
  return `billing:${auth.firmId}:${auth.user.id}:${matterId ?? "firm"}`;
}

function assertBillingExportAccess(context: ApiAuthContext, matterId: string | undefined): void {
  const access = requireAccess(context, {
    resource: "trust_ledger",
    action: "export",
    matterId,
  });
  if (!access.ok) throw access.error;
  if (!matterId && !hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(403, "BILLING_EXPORT_ACCESS_REQUIRED", "Billing export access required");
  }
}

async function findBillingExportJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
): Promise<JobLifecycleRecord | undefined> {
  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" })).find(
    (record) => record.id === jobId && record.jobName === "billing_export",
  );
}

function billingExportMatterId(job: JobLifecycleRecord): string | undefined {
  const value = job.metadata.matterId;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function serializeBillingExportRequest(job: JobLifecycleRecord) {
  return {
    id: job.id,
    jobId: job.id,
    status: job.status,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/billing/export-requests/${job.id}`,
    downloadUrl: `/api/billing/export-requests/${job.id}/download`,
  };
}

async function serializeBillingExport(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  matterId: string | undefined,
) {
  const scope = billingExportScope(matterId);
  const [timeEntries, expenseEntries, invoices, payments, trustTransferRequests] =
    await Promise.all([
      repository.listTimeEntries(firmId, matterId ? { matterId } : {}),
      repository.listExpenseEntries(firmId, matterId ? { matterId } : {}),
      repository.listInvoices(firmId, matterId ? { matterId } : {}),
      repository.listPayments(firmId, matterId ? { matterId } : {}),
      repository.listTrustTransferRequests(firmId, matterId ? { matterId } : {}),
    ]);

  return compactMetadata({
    generatedAt: new Date().toISOString(),
    reportType: "billing",
    reportScope: scope,
    matterId,
    billingPosture: "operational_records_only_no_live_payment_processing_or_tax_advice",
    trustTransferPolicy: "review_only_no_automatic_trust_ledger_posting",
    timeEntries,
    expenseEntries,
    invoices,
    payments,
    trustTransferRequests,
  });
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

function lockedBillingPeriodForTimestamp(
  timestamp: string,
  locks: BillingPeriodLockRecord[],
): BillingPeriodLockRecord | undefined {
  return locks.find((lock) => billingDateFallsInsideLock(timestamp, lock));
}

async function assertBillingTimestampUnlocked(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  timestamp: string,
  label: string,
): Promise<void> {
  const lockedPeriod = lockedBillingPeriodForTimestamp(
    timestamp,
    await repository.listBillingPeriodLocks(firmId),
  );
  if (!lockedPeriod) return;
  throw Object.assign(
    new Error(
      `${label} is inside locked billing period ${lockedPeriod.periodStart} to ${lockedPeriod.periodEnd}`,
    ),
    { statusCode: 409 },
  );
}

function snapshotFromRateRule(
  rule: BillingRateRuleRecord,
  resolvedAt: string,
): BillingRateSnapshot {
  return {
    source: "rate_rule",
    rateCents: rule.rateCents,
    resolvedAt,
    rateRuleId: rule.id,
    label: rule.label,
    scope: rule.scope,
    matterId: rule.matterId,
    userId: rule.userId,
    role: rule.role,
  };
}

async function resolveTimeEntryRate(input: {
  repository: ApiRouteDependencies["repository"];
  auth: ApiAuthContext;
  matterId: string;
  userId: string;
  performedAt: string;
  rateCents?: number;
  resolvedAt: string;
}): Promise<Pick<TimeEntry, "rateCents" | "rateRuleId" | "rateSnapshot">> {
  if (input.rateCents !== undefined) {
    return {
      rateCents: input.rateCents,
      rateSnapshot: {
        source: "manual",
        rateCents: input.rateCents,
        resolvedAt: input.resolvedAt,
      },
    };
  }

  const timekeeper =
    input.userId === input.auth.user.id
      ? input.auth.user
      : await input.repository.getUser(input.auth.firmId, input.userId);
  const rule = resolveBillingRateRule(
    await input.repository.listBillingRateRules(input.auth.firmId, {
      activeOnly: true,
      matterId: input.matterId,
      userId: input.userId,
    }),
    {
      matterId: input.matterId,
      userId: input.userId,
      role: timekeeper?.role,
      performedAt: input.performedAt,
    },
  );

  if (!rule) {
    throw Object.assign(new Error("Rate cents is required when no billing rate rule matches"), {
      statusCode: 400,
    });
  }

  return {
    rateCents: rule.rateCents,
    rateRuleId: rule.id,
    rateSnapshot: snapshotFromRateRule(rule, input.resolvedAt),
  };
}

function assertTrustTransferInvoiceClientMatches(
  invoice: Pick<InvoiceRecord, "clientContactId">,
  clientContactId: string | undefined,
): void {
  if (invoice.clientContactId && clientContactId !== invoice.clientContactId) {
    throw Object.assign(new Error("Trust transfer request client must match the invoice client"), {
      statusCode: 400,
    });
  }
}

function assertTrustTransferAmountWithinInvoiceBalance(
  amountCents: number,
  invoice: Pick<InvoiceRecord, "balanceDueCents">,
): void {
  if (amountCents > invoice.balanceDueCents) {
    throw Object.assign(new Error("Trust transfer amount exceeds invoice balance due"), {
      statusCode: 409,
    });
  }
}

export function registerBillingRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: ApiRouteDependencies,
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

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { entries: await repository.listTimeEntries(request.auth.firmId, query) };
    }

    const entries = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listTimeEntries(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { entries };
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

  server.get("/api/invoices", async (request) => {
    const query = parseRequestPart(invoiceQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "time_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { invoices: await repository.listInvoices(request.auth.firmId, query) };
    }

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { invoices: await repository.listInvoices(request.auth.firmId, query) };
    }

    const invoices = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listInvoices(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { invoices };
  });

  server.post("/api/invoices", async (request) => {
    const body = parseRequestPart(invoiceBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "create",
      matterId: body.matterId,
    });
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const availableTimeEntries = await repository.listTimeEntries(request.auth.firmId, {
      matterId: body.matterId,
    });
    const availableExpenseEntries = await repository.listExpenseEntries(request.auth.firmId, {
      matterId: body.matterId,
    });
    const timeEntries = availableTimeEntries.filter((entry) =>
      body.timeEntryIds.includes(entry.id),
    );
    const expenseEntries = availableExpenseEntries.filter((entry) =>
      body.expenseEntryIds.includes(entry.id),
    );
    if (
      timeEntries.length !== body.timeEntryIds.length ||
      expenseEntries.length !== body.expenseEntryIds.length
    ) {
      throw Object.assign(new Error("Invoice entries must belong to the requested matter"), {
        statusCode: 400,
      });
    }
    const existingInvoices = await repository.listInvoices(request.auth.firmId, {
      matterId: body.matterId,
    });
    const selectedTimeEntryIds = new Set(body.timeEntryIds);
    const selectedExpenseEntryIds = new Set(body.expenseEntryIds);
    const duplicateSource = existingInvoices
      .filter((invoice) => invoice.status !== "void")
      .some((invoice) =>
        invoice.lines.some(
          (line) =>
            (line.timeEntryId ? selectedTimeEntryIds.has(line.timeEntryId) : false) ||
            (line.expenseEntryId ? selectedExpenseEntryIds.has(line.expenseEntryId) : false),
        ),
      );
    if (duplicateSource) {
      throw Object.assign(
        new Error("Selected source entries are already linked to a non-void invoice"),
        { statusCode: 409 },
      );
    }
    if (![...timeEntries, ...expenseEntries].every(isBillableUnbilled)) {
      throw Object.assign(new Error("Only approved unbilled entries can be invoiced"), {
        statusCode: 409,
      });
    }
    const now = new Date().toISOString();
    const lines: InvoiceLineRecord[] = [
      ...timeEntries.map((entry) => {
        const totals = createInvoiceLineTotals({
          quantity: entry.minutes,
          unitAmountCents: Math.round(entry.rateCents / 60),
          taxRateBps: body.taxRateBps,
        });
        return {
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          invoiceId: body.id ?? "",
          matterId: body.matterId,
          kind: "time" as const,
          description: entry.narrative,
          quantity: entry.minutes,
          unitAmountCents: Math.round(entry.rateCents / 60),
          taxName: body.taxName,
          taxRateBps: body.taxRateBps,
          timeEntryId: entry.id,
          createdAt: now,
          ...totals,
        };
      }),
      ...expenseEntries.map((entry) => {
        const totals = createInvoiceLineTotals({
          quantity: 1,
          unitAmountCents: entry.amountCents,
          taxRateBps: body.taxRateBps,
        });
        return {
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          invoiceId: body.id ?? "",
          matterId: body.matterId,
          kind: "expense" as const,
          description: entry.description,
          quantity: 1,
          unitAmountCents: entry.amountCents,
          taxName: body.taxName,
          taxRateBps: body.taxRateBps,
          expenseEntryId: entry.id,
          createdAt: now,
          ...totals,
        };
      }),
      ...body.adjustmentLines.map((line) => {
        const totals = createInvoiceLineTotals(line);
        return {
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          invoiceId: body.id ?? "",
          matterId: body.matterId,
          kind: "adjustment" as const,
          description: line.description,
          quantity: line.quantity,
          unitAmountCents: line.unitAmountCents,
          taxName: line.taxName,
          taxRateBps: line.taxRateBps,
          createdAt: now,
          ...totals,
        };
      }),
    ];
    const invoiceId = body.id ?? crypto.randomUUID();
    const invoiceLines = lines.map((line) => ({ ...line, invoiceId }));
    const totals = calculateInvoiceTotals({ lines: invoiceLines, allocations: [] });
    const invoice: InvoiceRecord = {
      id: invoiceId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      clientContactId: body.clientContactId,
      invoiceNumber: body.invoiceNumber ?? `INV-${invoiceId.slice(0, 8)}`,
      status: "draft",
      dueAt: body.dueAt,
      memo: body.memo,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      ...totals,
    };
    const created = await repository.createInvoice({ invoice, lines: invoiceLines });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "invoice.created",
      resourceType: "invoice",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        invoiceId: created.id,
        status: created.status,
        timeEntryIds: body.timeEntryIds,
        expenseEntryIds: body.expenseEntryIds,
        lineCount: created.lines.length,
        subtotalCents: created.subtotalCents,
        taxCents: created.taxCents,
        totalCents: created.totalCents,
        balanceDueCents: created.balanceDueCents,
      },
    });
    return created;
  });

  server.get("/api/invoices/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const invoice = await repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "read",
      matterId: invoice.matterId,
    });
    return invoice;
  });

  server.post("/api/invoices/:id/approve", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const invoice = await repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "approve",
      matterId: invoice.matterId,
    });
    if (invoice.status !== "draft") {
      throw Object.assign(new Error("Only draft invoices can be approved"), { statusCode: 409 });
    }
    for (const line of invoice.lines) {
      if (line.timeEntryId) {
        const entry = await repository.getTimeEntry(request.auth.firmId, line.timeEntryId);
        if (entry) {
          await assertBillingTimestampUnlocked(
            repository,
            request.auth.firmId,
            entry.performedAt,
            "Time entry",
          );
        }
      }
      if (line.expenseEntryId) {
        const entry = await repository.getExpenseEntry(request.auth.firmId, line.expenseEntryId);
        if (entry) {
          await assertBillingTimestampUnlocked(
            repository,
            request.auth.firmId,
            entry.incurredAt,
            "Expense entry",
          );
        }
      }
    }
    for (const line of invoice.lines) {
      if (line.timeEntryId) {
        await repository.updateTimeEntry(request.auth.firmId, line.timeEntryId, {
          billingStatus: "billed",
        });
      }
      if (line.expenseEntryId) {
        await repository.updateExpenseEntry(request.auth.firmId, line.expenseEntryId, {
          billingStatus: "billed",
        });
      }
    }
    const updated = await repository.updateInvoice({
      ...invoice,
      status: "approved",
      approvedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "invoice.approved",
      resourceType: "invoice",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        invoiceId: updated.id,
        previousStatus: invoice.status,
        status: updated.status,
        totalCents: updated.totalCents,
        balanceDueCents: updated.balanceDueCents,
      },
    });
    return updated;
  });

  server.post("/api/invoices/:id/issue", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const invoice = await repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "update",
      matterId: invoice.matterId,
    });
    if (invoice.status !== "approved") {
      throw Object.assign(new Error("Only approved invoices can be issued"), { statusCode: 409 });
    }
    const updated = await repository.updateInvoice({
      ...invoice,
      status: "issued",
      issuedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "invoice.issued",
      resourceType: "invoice",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        invoiceId: updated.id,
        previousStatus: invoice.status,
        status: updated.status,
        totalCents: updated.totalCents,
        balanceDueCents: updated.balanceDueCents,
      },
    });
    return updated;
  });

  server.post("/api/invoices/:id/void", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const invoice = await repository.getInvoice(request.auth.firmId, params.id);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    assertMatterAccess(request.auth, {
      resource: "time_entry",
      action: "delete",
      matterId: invoice.matterId,
    });
    if (invoice.status === "paid") {
      throw Object.assign(new Error("Paid invoices cannot be voided"), { statusCode: 409 });
    }
    const updated = await repository.updateInvoice({
      ...invoice,
      status: "void",
      voidedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "invoice.voided",
      resourceType: "invoice",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        invoiceId: updated.id,
        previousStatus: invoice.status,
        status: updated.status,
        totalCents: updated.totalCents,
        balanceDueCents: updated.balanceDueCents,
      },
    });
    return updated;
  });

  server.get("/api/payments", async (request) => {
    const query = parseRequestPart(paymentQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "expense_entry",
        action: "read",
        matterId: query.matterId,
      });
      return { payments: await repository.listPayments(request.auth.firmId, query) };
    }

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { payments: await repository.listPayments(request.auth.firmId, query) };
    }

    const payments = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listPayments(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { payments };
  });

  server.post("/api/payments", async (request) => {
    const body = parseRequestPart(paymentBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "expense_entry",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await repository.getInvoice(request.auth.firmId, body.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== body.matterId) {
      throw Object.assign(new Error("Payment invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    const now = new Date().toISOString();
    const payment: ManualPaymentRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      invoiceId: body.invoiceId,
      clientContactId: body.clientContactId,
      amountCents: body.amountCents,
      receivedAt: body.receivedAt ?? now,
      method: body.method,
      reference: body.reference,
      status: "received",
      receivedByUserId: request.auth.user.id,
      notes: body.notes,
      evidence: body.evidence,
    };
    const allocation: PaymentAllocationRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amountCents: body.amountCents,
      allocatedAt: now,
    };
    const created = await repository.createPayment({ payment, allocations: [allocation] });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "manual_payment.created",
      resourceType: "manual_payment",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        paymentId: created.id,
        invoiceId: created.invoiceId,
        status: created.status,
        amountCents: created.amountCents,
        allocationCount: created.allocations.length,
      },
    });
    return created;
  });

  server.get("/api/billing/trust-transfer-requests", async (request) => {
    const query = parseRequestPart(trustTransferRequestQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "trust_ledger",
        action: "read",
        matterId: query.matterId,
      });
      return {
        requests: await repository.listTrustTransferRequests(request.auth.firmId, query),
      };
    }

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return {
        requests: await repository.listTrustTransferRequests(request.auth.firmId, query),
      };
    }

    const requests = (
      await Promise.all(
        request.auth.user.assignedMatterIds.map((matterId) =>
          repository.listTrustTransferRequests(request.auth.firmId, { ...query, matterId }),
        ),
      )
    ).flat();
    return { requests };
  });

  server.post("/api/billing/trust-transfer-requests", async (request) => {
    const body = parseRequestPart(billingTrustTransferRequestBodySchema, request.body, "body");
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "create",
      matterId: body.matterId,
    });
    const invoice = await repository.getInvoice(request.auth.firmId, body.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== body.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    const clientContactId = body.clientContactId ?? invoice.clientContactId;
    assertTrustTransferInvoiceClientMatches(invoice, clientContactId);
    const requestRecord: TrustTransferRequestRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      clientContactId,
      invoiceId: body.invoiceId,
      amountCents: body.amountCents,
      reason: body.reason,
      status: "pending_approval",
      requestedByUserId: request.auth.user.id,
      requestedAt: new Date().toISOString(),
      evidence: body.evidence,
    };
    const created = await repository.createTrustTransferRequest(requestRecord);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.created",
      resourceType: "trust_transfer_request",
      resourceId: created.id,
      metadata: {
        matterId: created.matterId,
        trustTransferRequestId: created.id,
        invoiceId: created.invoiceId,
        status: created.status,
        amountCents: created.amountCents,
      },
    });
    return created;
  });

  server.post("/api/billing/trust-transfer-requests/:id/approve", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(trustTransferRequestReviewBodySchema, request.body, "body");
    const existing = await repository.getTrustTransferRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Trust transfer request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: existing.matterId,
    });
    if (existing.status !== "pending_approval") {
      throw Object.assign(new Error("Only pending trust transfer requests can be approved"), {
        statusCode: 409,
      });
    }
    const invoice = await repository.getInvoice(request.auth.firmId, existing.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== existing.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    assertTrustTransferInvoiceClientMatches(invoice, existing.clientContactId);
    assertTrustTransferAmountWithinInvoiceBalance(existing.amountCents, invoice);
    const ledger = await repository.getLedger(request.auth.firmId, { matterId: existing.matterId });
    const availableTrustBalanceCents = trustTransferRequestAvailableBalanceCents({
      request: existing,
      trustBalances: ledger.trustBalances,
    });
    if (existing.amountCents > availableTrustBalanceCents) {
      throw Object.assign(new Error("Trust transfer amount exceeds available trust balance"), {
        statusCode: 409,
      });
    }
    let updated: TrustTransferRequestRecord;
    try {
      updated = await repository.updateTrustTransferRequest(
        request.auth.firmId,
        existing.id,
        {
          status: "approved",
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
          evidence: body.evidence,
        },
        { expectedStatus: "pending_approval" },
      );
    } catch {
      throw Object.assign(new Error("Trust transfer request status changed"), {
        statusCode: 409,
      });
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.approved",
      resourceType: "trust_transfer_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        trustTransferRequestId: updated.id,
        invoiceId: updated.invoiceId,
        previousStatus: existing.status,
        status: updated.status,
        amountCents: updated.amountCents,
        invoiceBalanceDueCents: invoice.balanceDueCents,
        availableTrustBalanceCents,
        evidencePresent: hasEvidence(body.evidence),
      },
    });
    return updated;
  });

  server.post("/api/billing/trust-transfer-requests/:id/reject", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(trustTransferRequestReviewBodySchema, request.body, "body");
    const existing = await repository.getTrustTransferRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Trust transfer request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: existing.matterId,
    });
    if (existing.status !== "pending_approval") {
      throw Object.assign(new Error("Only pending trust transfer requests can be rejected"), {
        statusCode: 409,
      });
    }
    let updated: TrustTransferRequestRecord;
    try {
      updated = await repository.updateTrustTransferRequest(
        request.auth.firmId,
        existing.id,
        {
          status: "rejected",
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
          evidence: body.evidence,
        },
        { expectedStatus: "pending_approval" },
      );
    } catch {
      throw Object.assign(new Error("Trust transfer request status changed"), {
        statusCode: 409,
      });
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.rejected",
      resourceType: "trust_transfer_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        trustTransferRequestId: updated.id,
        invoiceId: updated.invoiceId,
        previousStatus: existing.status,
        status: updated.status,
        amountCents: updated.amountCents,
        evidencePresent: hasEvidence(body.evidence),
      },
    });
    return updated;
  });

  server.post("/api/billing/trust-transfer-requests/:id/link", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(trustTransferRequestLinkBodySchema, request.body, "body");
    const existing = await repository.getTrustTransferRequest(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Trust transfer request was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "trust_ledger",
      action: "approve",
      matterId: existing.matterId,
    });
    if (existing.status !== "approved") {
      throw Object.assign(new Error("Only approved trust transfer requests can be linked"), {
        statusCode: 409,
      });
    }
    if (existing.ledgerTransactionId) {
      throw Object.assign(new Error("Trust transfer request is already linked"), {
        statusCode: 409,
      });
    }
    const invoice = await repository.getInvoice(request.auth.firmId, existing.invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice was not found"), { statusCode: 404 });
    if (invoice.matterId !== existing.matterId) {
      throw Object.assign(new Error("Trust transfer invoice must belong to the matter"), {
        statusCode: 400,
      });
    }
    assertTrustTransferInvoiceClientMatches(invoice, existing.clientContactId);
    assertTrustTransferAmountWithinInvoiceBalance(existing.amountCents, invoice);
    const ledger = await repository.getLedger(request.auth.firmId);
    const linkSummary = summarizeTrustTransferLedgerLink({
      request: existing,
      ledgerTransactionId: body.ledgerTransactionId,
      accounts: ledger.accounts,
      entries: ledger.entries,
    });
    if (!linkSummary.transactionExists) {
      throw Object.assign(new Error("Ledger transaction was not found"), { statusCode: 404 });
    }
    if (!linkSummary.matterMatches) {
      throw Object.assign(new Error("Ledger transaction was not found"), { statusCode: 404 });
    }
    if (!linkSummary.clientMatches) {
      throw Object.assign(new Error("Ledger transaction client must match the request client"), {
        statusCode: 400,
      });
    }
    if (!linkSummary.amountMatches) {
      throw Object.assign(new Error("Ledger transaction amount must match the request amount"), {
        statusCode: 400,
      });
    }
    const alreadyLinked = (await repository.listTrustTransferRequests(request.auth.firmId)).some(
      (candidate) =>
        candidate.id !== existing.id && candidate.ledgerTransactionId === body.ledgerTransactionId,
    );
    if (alreadyLinked) {
      throw Object.assign(
        new Error("Ledger transaction is already linked to a trust transfer request"),
        { statusCode: 409 },
      );
    }
    const trustBalancesBeforeLink = clientTrustBalanceByMatter(
      ledger.entries.filter((entry) => entry.transactionId !== body.ledgerTransactionId),
      ledger.accounts,
    );
    const availableTrustBalanceCents = trustTransferRequestAvailableBalanceCents({
      request: existing,
      trustBalances: trustBalancesBeforeLink,
    });
    if (existing.amountCents > availableTrustBalanceCents) {
      throw Object.assign(new Error("Trust transfer amount exceeds available trust balance"), {
        statusCode: 409,
      });
    }
    let updated: TrustTransferRequestRecord;
    try {
      updated = await repository.updateTrustTransferRequest(
        request.auth.firmId,
        existing.id,
        {
          status: "linked",
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
          ledgerTransactionId: body.ledgerTransactionId,
          evidence: body.evidence,
        },
        { expectedStatus: "approved", requireLedgerTransactionUnlinked: true },
      );
    } catch {
      throw Object.assign(new Error("Trust transfer request link state changed"), {
        statusCode: 409,
      });
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "trust_transfer_request.linked",
      resourceType: "trust_transfer_request",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        trustTransferRequestId: updated.id,
        invoiceId: updated.invoiceId,
        ledgerTransactionId: updated.ledgerTransactionId,
        previousStatus: existing.status,
        status: updated.status,
        amountCents: updated.amountCents,
        invoiceBalanceDueCents: invoice.balanceDueCents,
        availableTrustBalanceCents,
        trustAssetCreditCents: linkSummary.trustAssetCreditCents,
        clientLiabilityDebitCents: linkSummary.clientLiabilityDebitCents,
        evidencePresent: hasEvidence(body.evidence),
      },
    });
    return updated;
  });

  server.get("/api/billing/dashboard", async (request) => {
    const access = requireAccess(request.auth, { resource: "trust_ledger", action: "read" });
    if (!access.ok) throw access.error;
    const matters = await repository.listMattersForUser(request.auth.user);
    const matterIds = matters.map((matter) => matter.id);
    const [timeEntries, expenseEntries, invoices, payments, periodLocks, rateRules] =
      await Promise.all([
        repository.listTimeEntries(request.auth.firmId),
        repository.listExpenseEntries(request.auth.firmId),
        repository.listInvoices(request.auth.firmId),
        repository.listPayments(request.auth.firmId),
        repository.listBillingPeriodLocks(request.auth.firmId),
        repository.listBillingRateRules(request.auth.firmId),
      ]);
    const now = new Date().toISOString();
    const matterSummaries = matterIds.map((matterId) => {
      const unbilledTime = timeEntries
        .filter((entry) => entry.matterId === matterId && entry.billingStatus === "approved")
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          userId: entry.userId,
          minutes: entry.minutes,
          rateCents: entry.rateCents,
          rateRuleId: entry.rateRuleId,
          rateSnapshot: entry.rateSnapshot,
          amountCents: Math.round((entry.minutes * entry.rateCents) / 60),
          narrative: entry.narrative,
          status: entry.billingStatus,
        }));
      const unbilledExpenses = expenseEntries
        .filter((entry) => entry.matterId === matterId && entry.billingStatus === "approved")
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          amountCents: entry.amountCents,
          category: entry.category,
          description: entry.description,
          status: entry.billingStatus,
        }));
      return {
        matterId,
        unbilledTime,
        unbilledExpenses,
        invoices: invoices
          .filter((invoice) => invoice.matterId === matterId)
          .map((invoice) => ({
            id: invoice.id,
            matterId: invoice.matterId,
            number: invoice.invoiceNumber,
            status: invoice.status,
            totalCents: invoice.totalCents,
            balanceDueCents: invoice.balanceDueCents,
            issuedAt: invoice.issuedAt,
            dueAt: invoice.dueAt,
          })),
        payments: payments
          .filter((payment) => payment.matterId === matterId)
          .map((payment) => ({
            id: payment.id,
            matterId: payment.matterId,
            invoiceId: payment.invoiceId,
            amountCents: payment.amountCents,
            method: payment.method,
            receivedAt: payment.receivedAt,
            reference: payment.reference,
          })),
      };
    });
    return {
      canView: true,
      summary: {
        unbilledTimeCents: matterSummaries.reduce(
          (sum, matter) =>
            sum +
            matter.unbilledTime.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
          0,
        ),
        unbilledExpenseCents: matterSummaries.reduce(
          (sum, matter) =>
            sum +
            matter.unbilledExpenses.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
          0,
        ),
        draftInvoiceCents: invoices
          .filter((invoice) => invoice.status === "draft")
          .reduce((sum, invoice) => sum + invoice.totalCents, 0),
        issuedBalanceDueCents: invoices
          .filter((invoice) => ["issued", "partially_paid"].includes(invoice.status))
          .reduce((sum, invoice) => sum + invoice.balanceDueCents, 0),
        lockedPeriodCount: periodLocks.length,
        activeLockedPeriodCount: periodLocks.filter((lock) => billingDateFallsInsideLock(now, lock))
          .length,
        activeRateRuleCount: rateRules.filter((rule) => rule.active).length,
      },
      periodLocks,
      rateRules,
      matters: matterSummaries,
    };
  });

  server.post("/api/billing/export-requests", async (request, reply) => {
    const body = parseRequestPart(billingExportRequestBodySchema, request.body, "body");
    assertBillingExportAccess(request.auth, body.matterId);
    const jobId = billingExportJobId();
    const queueConfigured = Boolean(reportJobQueue);
    const scope = billingExportScope(body.matterId);
    const now = new Date().toISOString();
    const idempotencyKey =
      body.idempotencyKey ??
      `billing-export:${request.auth.user.id}:${body.matterId ?? "firm"}:${now.slice(0, 10)}`;
    const metadata = compactMetadata({
      reportType: "billing",
      reportScope: scope,
      matterId: body.matterId,
      requestedByUserId: request.auth.user.id,
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      idempotencyFingerprint: billingExportRequestFingerprint(request.auth, body.matterId),
    });

    const job = await repository.createJobLifecycleRecord({
      id: jobId,
      firmId: request.auth.firmId,
      queueName: "reports",
      jobName: "billing_export",
      bullJobId: queueConfigured ? jobId : undefined,
      idempotencyKey,
      status: queueConfigured ? "queued" : "completed",
      targetResourceType: "billing_export",
      targetResourceId: jobId,
      attemptsMade: 0,
      maxAttempts: queueConfigured ? 2 : 1,
      queuedAt: now,
      finishedAt: queueConfigured ? undefined : now,
      metadata,
    });

    if (reportJobQueue && job.id === jobId) {
      try {
        await reportJobQueue.add(
          "billing_export",
          {
            firmId: request.auth.firmId,
            resourceType: "billing_export",
            resourceId: job.id,
            metadata: compactMetadata({
              reportType: "billing",
              reportScope: scope,
              matterId: body.matterId,
              requestedByUserId: request.auth.user.id,
            }),
          },
          { jobId: job.id },
        );
      } catch (error) {
        await repository.updateJobLifecycleRecord(request.auth.firmId, job.id, {
          status: "failed",
          failedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_export.requested",
      resourceType: "billing_export",
      resourceId: job.id,
      metadata: compactMetadata({
        jobId: job.id,
        reportType: "billing",
        reportScope: scope,
        matterId: body.matterId,
        idempotencyKeyPresent: Boolean(body.idempotencyKey),
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      }),
    });

    reply.status(202);
    return { exportRequest: serializeBillingExportRequest(job) };
  });

  server.get("/api/billing/export-requests/:exportJobId", async (request) => {
    const params = parseRequestPart(billingExportParamsSchema, request.params, "params");
    const job = await findBillingExportJob(repository, request.auth.firmId, params.exportJobId);
    if (!job)
      throw new ApiHttpError(404, "BILLING_EXPORT_NOT_FOUND", "Billing export was not found");
    assertBillingExportAccess(request.auth, billingExportMatterId(job));
    return { exportRequest: serializeBillingExportRequest(job) };
  });

  server.get("/api/billing/export-requests/:exportJobId/download", async (request) => {
    const params = parseRequestPart(billingExportParamsSchema, request.params, "params");
    const job = await findBillingExportJob(repository, request.auth.firmId, params.exportJobId);
    if (!job)
      throw new ApiHttpError(404, "BILLING_EXPORT_NOT_FOUND", "Billing export was not found");
    const matterId = billingExportMatterId(job);
    assertBillingExportAccess(request.auth, matterId);
    if (job.status === "failed" || job.status === "dead_letter") {
      throw new ApiHttpError(409, "BILLING_EXPORT_FAILED", "Billing export did not complete");
    }
    if (job.status !== "completed") {
      throw new ApiHttpError(409, "BILLING_EXPORT_NOT_READY", "Billing export is not ready yet");
    }

    return {
      exportRequest: serializeBillingExportRequest(job),
      export: await serializeBillingExport(repository, request.auth.firmId, matterId),
    };
  });
}
