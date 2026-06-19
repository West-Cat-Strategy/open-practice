import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  calculateInvoiceTotals,
  createInvoiceLineTotals,
  isBillableUnbilled,
  type InvoiceLineRecord,
  type InvoiceRecord,
} from "@open-practice/domain";
import { hasFirmWideLedgerAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertBillingTimestampUnlocked,
  assertMatterAccess,
  idParamsSchema,
  orderByMatterIds,
} from "./shared.js";

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

export function registerBillingInvoiceRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
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

    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    if (hasFirmWideLedgerAccess(request.auth.user)) {
      return { invoices: await repository.listInvoices(request.auth.firmId, query) };
    }

    const assignedMatterIds = request.auth.user.assignedMatterIds;
    const invoices = await repository.listInvoices(request.auth.firmId, {
      ...query,
      matterIds: assignedMatterIds,
    });
    return { invoices: orderByMatterIds(invoices, assignedMatterIds) };
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
}
