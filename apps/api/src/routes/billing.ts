import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertBillingStatusTransition,
  billingTrustExportKinds,
  billingTrustExportResourceType,
  calculateInvoiceTotals,
  clientTrustBalanceByMatter,
  createInvoiceLineTotals,
  isBillableUnbilled,
  isBillingEntrySnapshotMutable,
  isBillingPeriodLockActiveForEntry,
  isBillingRatePresetEffectiveForDate,
  summarizeBillingTrustExportCounts,
  summarizeTrustTransferLedgerLink,
  trustTransferRequestAvailableBalanceCents,
  type AccessRequest,
  type BillingPeriodLockRecord,
  type BillingRatePresetRecord,
  type BillingTrustExportKind,
  type BillingTrustExportSnapshot,
} from "@open-practice/domain";
import type {
  ExpenseEntry,
  InvoiceLineRecord,
  InvoiceRecord,
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

const timeEntryBaseBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  userId: z.string().min(1).optional(),
  performedAt: z.string().datetime().optional(),
  minutes: z.number().int().positive(),
  rateCents: z.number().int().nonnegative().optional(),
  ratePresetId: z.string().min(1).optional(),
  narrative: z.string().min(1),
  billable: z.boolean().default(true),
  billingStatus: z
    .enum(["draft", "submitted", "approved", "billed", "written_off"])
    .default("draft"),
});

const timeEntryBodySchema = timeEntryBaseBodySchema.refine(
  (body) => body.rateCents !== undefined || body.ratePresetId,
  {
    message: "Either rateCents or ratePresetId is required",
    path: ["rateCents"],
  },
);

const timeEntryPatchBodySchema = timeEntryBaseBodySchema
  .omit({ id: true, matterId: true, userId: true, ratePresetId: true })
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

const billingTrustExportRequestBodySchema = z
  .object({
    exportKind: z.enum(billingTrustExportKinds).default("billing"),
    matterId: z.string().min(1).optional(),
    idempotencyKey: z.string().min(1).max(160).optional(),
  })
  .strict();

const billingTrustExportParamsSchema = z.object({
  exportJobId: z.string().min(1),
});

const billingDateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const billingRatePresetQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

const billingRatePresetBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    label: z.string().min(1),
    rateCents: z.number().int().nonnegative(),
    currency: z.string().min(3).max(3).default("CAD"),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const billingPeriodLockQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["active", "released"]).optional(),
});

const billingPeriodLockBodySchema = z
  .object({
    id: z.string().min(1).optional(),
    matterId: z.string().min(1).optional(),
    startsOn: billingDateOnlySchema,
    endsOn: billingDateOnlySchema,
    reason: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .refine((body) => body.startsOn <= body.endsOn, {
    message: "Billing period lock start date must be on or before end date",
    path: ["endsOn"],
  });

const billingPeriodLockReleaseBodySchema = z
  .object({
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .default({ metadata: {} });

const idParamsSchema = z.object({ id: z.string().min(1) });

type BillingTrustExportCountsMetadata = Record<string, number | undefined>;

function assertMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function assertFirmWideBillingControlAccess(context: ApiAuthContext): void {
  if (!["owner_admin", "billing_bookkeeper"].includes(context.user.role)) {
    throw new ApiHttpError(
      403,
      "BILLING_CONTROL_ACCESS_REQUIRED",
      "Billing control access required",
    );
  }
}

function assertFirmWideBillingReadAccess(context: ApiAuthContext): void {
  if (!hasFirmWideLedgerAccess(context.user)) {
    throw new ApiHttpError(
      403,
      "BILLING_CONTROL_ACCESS_REQUIRED",
      "Billing control access required",
    );
  }
}

function assertBillingControlAccess(context: ApiAuthContext, matterId: string | undefined): void {
  if (!matterId) {
    assertFirmWideBillingControlAccess(context);
    return;
  }

  assertMatterAccess(context, { resource: "time_entry", action: "approve", matterId });
  assertMatterAccess(context, { resource: "expense_entry", action: "update", matterId });
}

function assertRatePresetEffectiveRange(
  preset: Pick<BillingRatePresetRecord, "effectiveFrom" | "effectiveTo">,
): void {
  if (preset.effectiveTo && Date.parse(preset.effectiveTo) < Date.parse(preset.effectiveFrom)) {
    throw new ApiHttpError(
      400,
      "BILLING_RATE_PRESET_RANGE_INVALID",
      "Billing rate preset effective range is invalid",
    );
  }
}

function assertBillingEntryPatchAllowed(status: TimeEntry["billingStatus"], label: string): void {
  if (!isBillingEntrySnapshotMutable(status)) {
    throw new ApiHttpError(
      409,
      "BILLING_ENTRY_LOCKED",
      `${label} entries that are submitted, approved, billed, or written off cannot be edited`,
    );
  }
}

async function assertBillingPeriodUnlocked(
  repository: ApiRouteDependencies["repository"],
  input: { firmId: string; matterId: string; occurredAt: string },
): Promise<void> {
  const locks = await repository.listBillingPeriodLocks(input.firmId, {
    matterId: input.matterId,
    status: "active",
  });
  const lock = locks.find((candidate) => isBillingPeriodLockActiveForEntry(candidate, input));
  if (lock) {
    throw new ApiHttpError(409, "BILLING_PERIOD_LOCKED", "Billing period is locked", {
      billingPeriodLockId: lock.id,
      matterId: input.matterId,
      startsOn: lock.startsOn,
      endsOn: lock.endsOn,
    });
  }
}

async function resolveTimeEntryRateCents(
  repository: ApiRouteDependencies["repository"],
  input: {
    firmId: string;
    matterId: string;
    userId: string;
    performedAt: string;
    rateCents?: number;
    ratePresetId?: string;
  },
): Promise<{ rateCents: number; ratePresetId?: string }> {
  if (!input.ratePresetId) {
    return { rateCents: input.rateCents ?? 0 };
  }

  const preset = await repository.getBillingRatePreset(input.firmId, input.ratePresetId);
  if (!preset) {
    throw new ApiHttpError(
      404,
      "BILLING_RATE_PRESET_NOT_FOUND",
      "Billing rate preset was not found",
    );
  }
  if (preset.matterId && preset.matterId !== input.matterId) {
    throw new ApiHttpError(
      400,
      "BILLING_RATE_PRESET_SCOPE_MISMATCH",
      "Billing rate preset does not apply to this matter",
    );
  }
  if (preset.userId && preset.userId !== input.userId) {
    throw new ApiHttpError(
      400,
      "BILLING_RATE_PRESET_SCOPE_MISMATCH",
      "Billing rate preset does not apply to this timekeeper",
    );
  }
  if (!isBillingRatePresetEffectiveForDate(preset, input.performedAt)) {
    throw new ApiHttpError(
      409,
      "BILLING_RATE_PRESET_NOT_EFFECTIVE",
      "Billing rate preset is not effective for the time entry date",
    );
  }

  return { rateCents: preset.rateCents, ratePresetId: preset.id };
}

function hasEvidence(evidence: Record<string, unknown>): boolean {
  return Object.keys(evidence).length > 0;
}

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
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

function billingTrustExportJobId(exportKind: BillingTrustExportKind): string {
  return `${billingTrustExportResourceType(exportKind)}-${crypto.randomUUID()}`;
}

function billingTrustExportRequestFingerprint(input: {
  firmId: string;
  userId: string;
  exportKind: BillingTrustExportKind;
  matterId?: string;
}): string {
  return [
    "billing-trust-export",
    input.firmId,
    input.userId,
    input.exportKind,
    input.matterId ?? "firm",
  ].join(":");
}

function billingTrustExportCountsMetadata(
  counts: BillingTrustExportSnapshot["counts"],
): BillingTrustExportCountsMetadata {
  return {
    recordCount: counts.recordCount,
    timeEntryCount: counts.timeEntryCount,
    expenseEntryCount: counts.expenseEntryCount,
    invoiceCount: counts.invoiceCount,
    paymentCount: counts.paymentCount,
    trustTransferRequestCount: counts.trustTransferRequestCount,
    ledgerAccountCount: counts.ledgerAccountCount,
    ledgerEntryCount: counts.ledgerEntryCount,
    balanceCount: counts.balanceCount,
    trustBalanceCount: counts.trustBalanceCount,
  };
}

function requireBillingTrustExportAccess(
  context: ApiAuthContext,
  exportKind: BillingTrustExportKind,
  matterId: string | undefined,
): void {
  if (exportKind === "billing") {
    if (!matterId) {
      if (!hasFirmWideLedgerAccess(context.user)) {
        throw new ApiHttpError(
          403,
          "BILLING_EXPORT_ACCESS_REQUIRED",
          "Billing export access required",
        );
      }
      return;
    }

    assertMatterAccess(context, { resource: "time_entry", action: "export", matterId });
    assertMatterAccess(context, { resource: "expense_entry", action: "export", matterId });
    return;
  }

  if (!matterId) {
    if (!hasFirmWideLedgerAccess(context.user)) {
      throw new ApiHttpError(
        403,
        "TRUST_LEDGER_EXPORT_ACCESS_REQUIRED",
        "Trust ledger export access required",
      );
    }
    return;
  }

  assertMatterAccess(context, { resource: "trust_ledger", action: "export", matterId });
}

async function buildBillingTrustExportSnapshot(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  exportKind: BillingTrustExportKind;
  matterId?: string;
}): Promise<BillingTrustExportSnapshot> {
  if (input.exportKind === "billing") {
    const [timeEntries, expenseEntries, invoices, payments] = await Promise.all([
      input.repository.listTimeEntries(input.firmId, { matterId: input.matterId }),
      input.repository.listExpenseEntries(input.firmId, { matterId: input.matterId }),
      input.repository.listInvoices(input.firmId, { matterId: input.matterId }),
      input.repository.listPayments(input.firmId, { matterId: input.matterId }),
    ]);
    const snapshot = {
      exportKind: input.exportKind,
      matterId: input.matterId,
      billing: { timeEntries, expenseEntries, invoices, payments },
    } satisfies Omit<BillingTrustExportSnapshot, "generatedAt" | "counts">;

    return {
      generatedAt: new Date().toISOString(),
      ...snapshot,
      counts: summarizeBillingTrustExportCounts(snapshot),
    };
  }

  const [ledger, trustTransferRequests] = await Promise.all([
    input.repository.getLedger(input.firmId, { matterId: input.matterId }),
    input.repository.listTrustTransferRequests(input.firmId, { matterId: input.matterId }),
  ]);
  const snapshot = {
    exportKind: input.exportKind,
    matterId: input.matterId,
    trust: {
      accounts: ledger.accounts,
      entries: ledger.entries,
      balances: ledger.balances,
      trustBalances: ledger.trustBalances,
      trustTransferRequests,
    },
  } satisfies Omit<BillingTrustExportSnapshot, "generatedAt" | "counts">;

  return {
    generatedAt: new Date().toISOString(),
    ...snapshot,
    counts: summarizeBillingTrustExportCounts(snapshot),
  };
}

function isBillingTrustExportJob(
  job: Awaited<ReturnType<ApiRouteDependencies["repository"]["listJobLifecycleRecords"]>>[number],
): boolean {
  return job.queueName === "reports" && ["billing_export", "trust_export"].includes(job.jobName);
}

function billingTrustExportKindFromJob(
  job: Awaited<ReturnType<ApiRouteDependencies["repository"]["listJobLifecycleRecords"]>>[number],
): BillingTrustExportKind {
  return job.jobName === "trust_export" ? "trust" : "billing";
}

async function findBillingTrustExportJob(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
  jobId: string,
) {
  return (await repository.listJobLifecycleRecords(firmId, { queueName: "reports" })).find(
    (record) => record.id === jobId && isBillingTrustExportJob(record),
  );
}

function serializeBillingTrustExportRequest(
  job: Awaited<ReturnType<ApiRouteDependencies["repository"]["listJobLifecycleRecords"]>>[number],
) {
  const exportKind = billingTrustExportKindFromJob(job);
  const matterId = typeof job.metadata.matterId === "string" ? job.metadata.matterId : undefined;
  return {
    id: job.id,
    jobId: job.id,
    exportKind,
    matterId,
    status: job.status,
    queuedAt: job.queuedAt,
    finishedAt: job.finishedAt,
    failedAt: job.failedAt,
    pollUrl: `/api/billing/export-requests/${job.id}`,
    downloadUrl: `/api/billing/export-requests/${job.id}/download`,
  };
}

export function registerBillingRoutes(
  server: FastifyInstance,
  { repository, reportJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/billing/rate-presets", async (request) => {
    const query = parseRequestPart(billingRatePresetQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "time_entry",
        action: "read",
        matterId: query.matterId,
      });
    } else {
      assertFirmWideBillingReadAccess(request.auth);
    }

    return { ratePresets: await repository.listBillingRatePresets(request.auth.firmId, query) };
  });

  server.post("/api/billing/rate-presets", async (request) => {
    const body = parseRequestPart(billingRatePresetBodySchema, request.body, "body");
    assertBillingControlAccess(request.auth, body.matterId);
    const now = new Date().toISOString();
    const preset: BillingRatePresetRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId: body.userId,
      label: body.label,
      rateCents: body.rateCents,
      currency: body.currency,
      effectiveFrom: body.effectiveFrom ?? now,
      effectiveTo: body.effectiveTo,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      metadata: body.metadata,
    };
    assertRatePresetEffectiveRange(preset);
    const created = await repository.createBillingRatePreset(preset);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_rate_preset.created",
      resourceType: "billing_rate_preset",
      resourceId: created.id,
      metadata: compactMetadata({
        matterId: created.matterId,
        ratePresetId: created.id,
        userId: created.userId,
        rateCents: created.rateCents,
        currency: created.currency,
        effectiveFrom: created.effectiveFrom,
        effectiveTo: created.effectiveTo,
      }),
    });
    return created;
  });

  server.get("/api/billing/period-locks", async (request) => {
    const query = parseRequestPart(billingPeriodLockQuerySchema, request.query, "query");
    if (query.matterId) {
      assertMatterAccess(request.auth, {
        resource: "time_entry",
        action: "read",
        matterId: query.matterId,
      });
    } else {
      assertFirmWideBillingReadAccess(request.auth);
    }

    return { periodLocks: await repository.listBillingPeriodLocks(request.auth.firmId, query) };
  });

  server.post("/api/billing/period-locks", async (request) => {
    const body = parseRequestPart(billingPeriodLockBodySchema, request.body, "body");
    assertBillingControlAccess(request.auth, body.matterId);
    const lockedAt = new Date().toISOString();
    const lock: BillingPeriodLockRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      status: "active",
      lockedByUserId: request.auth.user.id,
      lockedAt,
      reason: body.reason,
      metadata: body.metadata,
    };
    const created = await repository.createBillingPeriodLock(lock);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_period_lock.created",
      resourceType: "billing_period_lock",
      resourceId: created.id,
      metadata: compactMetadata({
        matterId: created.matterId,
        billingPeriodLockId: created.id,
        startsOn: created.startsOn,
        endsOn: created.endsOn,
        status: created.status,
      }),
    });
    return created;
  });

  server.post("/api/billing/period-locks/:id/release", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(billingPeriodLockReleaseBodySchema, request.body, "body");
    const existing = await repository.getBillingPeriodLock(request.auth.firmId, params.id);
    if (!existing)
      throw new ApiHttpError(
        404,
        "BILLING_PERIOD_LOCK_NOT_FOUND",
        "Billing period lock was not found",
      );
    assertBillingControlAccess(request.auth, existing.matterId);
    if (existing.status === "released") {
      throw new ApiHttpError(
        409,
        "BILLING_PERIOD_LOCK_RELEASED",
        "Billing period lock is already released",
      );
    }
    const released = await repository.updateBillingPeriodLock(request.auth.firmId, existing.id, {
      status: "released",
      releasedByUserId: request.auth.user.id,
      releasedAt: new Date().toISOString(),
      metadata: { ...existing.metadata, ...body.metadata },
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "billing_period_lock.released",
      resourceType: "billing_period_lock",
      resourceId: released.id,
      metadata: compactMetadata({
        matterId: released.matterId,
        billingPeriodLockId: released.id,
        startsOn: released.startsOn,
        endsOn: released.endsOn,
        status: released.status,
      }),
    });
    return released;
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
    const performedAt = body.performedAt ?? new Date().toISOString();
    await assertBillingPeriodUnlocked(repository, {
      firmId: request.auth.firmId,
      matterId: body.matterId,
      occurredAt: performedAt,
    });
    const rate = await resolveTimeEntryRateCents(repository, {
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId: body.userId ?? request.auth.user.id,
      performedAt,
      rateCents: body.rateCents,
      ratePresetId: body.ratePresetId,
    });
    const entry: TimeEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId: body.userId ?? request.auth.user.id,
      performedAt,
      minutes: body.minutes,
      rateCents: rate.rateCents,
      narrative: body.narrative,
      billable: body.billable,
      billingStatus: body.billingStatus,
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
        ratePresetId: rate.ratePresetId,
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
    const body = parseRequestPart(timeEntryPatchBodySchema, request.body, "body");
    assertBillingEntryPatchAllowed(existing.billingStatus, "Time");
    await assertBillingPeriodUnlocked(repository, {
      firmId: request.auth.firmId,
      matterId: existing.matterId,
      occurredAt: existing.performedAt,
    });
    if (body.performedAt && body.performedAt !== existing.performedAt) {
      await assertBillingPeriodUnlocked(repository, {
        firmId: request.auth.firmId,
        matterId: existing.matterId,
        occurredAt: body.performedAt,
      });
    }
    const updated = await repository.updateTimeEntry(request.auth.firmId, params.id, body);
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
    await assertBillingPeriodUnlocked(repository, {
      firmId: request.auth.firmId,
      matterId: body.matterId,
      occurredAt: incurredAt,
    });
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
    const body = parseRequestPart(expenseEntryPatchBodySchema, request.body, "body");
    assertBillingEntryPatchAllowed(existing.billingStatus, "Expense");
    await assertBillingPeriodUnlocked(repository, {
      firmId: request.auth.firmId,
      matterId: existing.matterId,
      occurredAt: existing.incurredAt,
    });
    if (body.incurredAt && body.incurredAt !== existing.incurredAt) {
      await assertBillingPeriodUnlocked(repository, {
        firmId: request.auth.firmId,
        matterId: existing.matterId,
        occurredAt: body.incurredAt,
      });
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

  server.post("/api/billing/export-requests", async (request, reply) => {
    const body = parseRequestPart(billingTrustExportRequestBodySchema, request.body, "body");
    requireBillingTrustExportAccess(request.auth, body.exportKind, body.matterId);

    const now = new Date().toISOString();
    const jobId = billingTrustExportJobId(body.exportKind);
    const resourceType = billingTrustExportResourceType(body.exportKind);
    const queueConfigured = Boolean(reportJobQueue);
    const snapshot = await buildBillingTrustExportSnapshot({
      repository,
      firmId: request.auth.firmId,
      exportKind: body.exportKind,
      matterId: body.matterId,
    });
    const countMetadata = billingTrustExportCountsMetadata(snapshot.counts);
    const idempotencyFingerprint = billingTrustExportRequestFingerprint({
      firmId: request.auth.firmId,
      userId: request.auth.user.id,
      exportKind: body.exportKind,
      matterId: body.matterId,
    });
    const metadata = compactMetadata({
      exportKind: body.exportKind,
      matterId: body.matterId,
      requestedByUserId: request.auth.user.id,
      ...countMetadata,
      enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
    });
    const idempotencyKey =
      body.idempotencyKey === undefined
        ? [
            resourceType,
            request.auth.user.id,
            body.matterId ?? "firm",
            new Date(now).toISOString().slice(0, 10),
          ].join(":")
        : `${body.idempotencyKey}:${idempotencyFingerprint}`;

    const job = await repository.createJobLifecycleRecord({
      id: jobId,
      firmId: request.auth.firmId,
      queueName: "reports",
      jobName: resourceType,
      bullJobId: queueConfigured ? jobId : undefined,
      idempotencyKey,
      status: queueConfigured ? "queued" : "completed",
      targetResourceType: resourceType,
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
          resourceType,
          {
            firmId: request.auth.firmId,
            resourceType,
            resourceId: job.id,
            metadata: compactMetadata({
              exportKind: body.exportKind,
              matterId: body.matterId,
              requestedByUserId: request.auth.user.id,
              ...countMetadata,
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
      action: `${resourceType}.requested`,
      resourceType,
      resourceId: job.id,
      metadata: compactMetadata({
        jobId: job.id,
        exportKind: body.exportKind,
        matterId: body.matterId,
        requestedByUserId: request.auth.user.id,
        ...countMetadata,
        enqueueStatus: queueConfigured ? "queued_for_local_report_worker" : "completed_inline",
      }),
    });

    reply.status(202);
    return { exportRequest: serializeBillingTrustExportRequest(job) };
  });

  server.get("/api/billing/export-requests/:exportJobId", async (request) => {
    const params = parseRequestPart(billingTrustExportParamsSchema, request.params, "params");
    const job = await findBillingTrustExportJob(
      repository,
      request.auth.firmId,
      params.exportJobId,
    );
    if (!job) {
      throw new ApiHttpError(404, "BILLING_EXPORT_NOT_FOUND", "Billing export was not found");
    }
    requireBillingTrustExportAccess(
      request.auth,
      billingTrustExportKindFromJob(job),
      typeof job.metadata.matterId === "string" ? job.metadata.matterId : undefined,
    );

    return { exportRequest: serializeBillingTrustExportRequest(job) };
  });

  server.get("/api/billing/export-requests/:exportJobId/download", async (request) => {
    const params = parseRequestPart(billingTrustExportParamsSchema, request.params, "params");
    const job = await findBillingTrustExportJob(
      repository,
      request.auth.firmId,
      params.exportJobId,
    );
    if (!job) {
      throw new ApiHttpError(404, "BILLING_EXPORT_NOT_FOUND", "Billing export was not found");
    }
    const exportKind = billingTrustExportKindFromJob(job);
    const matterId = typeof job.metadata.matterId === "string" ? job.metadata.matterId : undefined;
    requireBillingTrustExportAccess(request.auth, exportKind, matterId);

    if (job.status === "failed" || job.status === "dead_letter") {
      throw new ApiHttpError(409, "BILLING_EXPORT_FAILED", "Billing export did not complete");
    }
    if (job.status !== "completed") {
      throw new ApiHttpError(409, "BILLING_EXPORT_NOT_READY", "Billing export is not ready yet");
    }

    return {
      exportRequest: serializeBillingTrustExportRequest(job),
      export: await buildBillingTrustExportSnapshot({
        repository,
        firmId: request.auth.firmId,
        exportKind,
        matterId,
      }),
    };
  });

  server.get("/api/billing/dashboard", async (request) => {
    const access = requireAccess(request.auth, { resource: "trust_ledger", action: "read" });
    if (!access.ok) throw access.error;
    const matters = await repository.listMattersForUser(request.auth.user);
    const matterIds = matters.map((matter) => matter.id);
    const [timeEntries, expenseEntries, invoices, payments] = await Promise.all([
      repository.listTimeEntries(request.auth.firmId),
      repository.listExpenseEntries(request.auth.firmId),
      repository.listInvoices(request.auth.firmId),
      repository.listPayments(request.auth.firmId),
    ]);
    const matterSummaries = matterIds.map((matterId) => {
      const unbilledTime = timeEntries
        .filter((entry) => entry.matterId === matterId && entry.billingStatus === "approved")
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          userId: entry.userId,
          minutes: entry.minutes,
          rateCents: entry.rateCents,
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
      },
      matters: matterSummaries,
    };
  });
}
