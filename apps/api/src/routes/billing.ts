import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertBillingStatusTransition,
  calculateInvoiceTotals,
  createInvoiceLineTotals,
  isBillableUnbilled,
  type AccessRequest,
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
  rateCents: z.number().int().nonnegative(),
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

const billingTrustTransferRequestBodySchema = z.object({
  id: z.string().min(1).optional(),
  matterId: z.string().min(1),
  invoiceId: z.string().min(1),
  clientContactId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).optional(),
  status: z
    .enum(["pending_approval", "approved", "rejected", "linked", "cancelled"])
    .default("pending_approval"),
  ledgerTransactionId: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

const trustTransferRequestQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(["pending_approval", "approved", "rejected", "linked", "cancelled"]).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerBillingRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
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
    const entry: TimeEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      userId: body.userId ?? request.auth.user.id,
      performedAt: body.performedAt ?? new Date().toISOString(),
      minutes: body.minutes,
      rateCents: body.rateCents,
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
    const entry: ExpenseEntry = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      incurredAt: body.incurredAt ?? new Date().toISOString(),
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
    const requestRecord: TrustTransferRequestRecord = {
      id: body.id ?? crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      clientContactId: body.clientContactId,
      invoiceId: body.invoiceId,
      amountCents: body.amountCents,
      reason: body.reason,
      status: body.status,
      requestedByUserId: request.auth.user.id,
      requestedAt: new Date().toISOString(),
      ledgerTransactionId: body.ledgerTransactionId,
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
