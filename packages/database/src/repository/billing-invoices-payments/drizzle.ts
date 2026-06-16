import {
  calculateInvoiceTotals,
  invoiceStatusForPayment,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type ManualPaymentRecord,
  type PaymentAllocationRecord,
} from "@open-practice/domain";
import { and, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  InvoiceWithLines,
  PaymentWithAllocations,
} from "../billing-invoices-payments-contracts.js";
import { clone } from "../contracts.js";
import {
  invoiceInsert,
  invoiceLineInsert,
  mapInvoiceLineRow,
  mapInvoiceRow,
  mapPaymentAllocationRow,
  mapPaymentRow,
  paymentAllocationInsert,
  paymentInsert,
} from "../drizzle-mappers.js";

export async function listDrizzleInvoices(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; status?: InvoiceRecord["status"] } = {},
): Promise<InvoiceWithLines[]> {
  const filters = [eq(schema.invoices.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.invoices.matterId, options.matterId));
  if (options.status) filters.push(eq(schema.invoices.status, options.status));
  const rows = await db
    .select()
    .from(schema.invoices)
    .where(and(...filters));
  const lines = await db
    .select()
    .from(schema.invoiceLines)
    .where(eq(schema.invoiceLines.firmId, firmId));
  return rows.map((row) => ({
    ...mapInvoiceRow(row),
    lines: lines.filter((line) => line.invoiceId === row.id).map(mapInvoiceLineRow),
  }));
}

export async function getDrizzleInvoice(
  db: OpenPracticeDatabase,
  firmId: string,
  invoiceId: string,
): Promise<InvoiceWithLines | undefined> {
  const [row] = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.firmId, firmId), eq(schema.invoices.id, invoiceId)));
  if (!row) return undefined;
  const lines = await db
    .select()
    .from(schema.invoiceLines)
    .where(eq(schema.invoiceLines.invoiceId, invoiceId));
  return { ...mapInvoiceRow(row), lines: lines.map(mapInvoiceLineRow) };
}

export async function createDrizzleInvoice(
  db: OpenPracticeDatabase,
  input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  },
): Promise<InvoiceWithLines> {
  await db.insert(schema.invoices).values(invoiceInsert(input.invoice));
  if (input.lines.length > 0) {
    await db.insert(schema.invoiceLines).values(input.lines.map(invoiceLineInsert));
  }
  return { ...clone(input.invoice), lines: clone(input.lines) };
}

export async function updateDrizzleInvoice(
  db: OpenPracticeDatabase,
  invoice: InvoiceRecord,
): Promise<InvoiceWithLines> {
  const [row] = await db
    .update(schema.invoices)
    .set(invoiceInsert(invoice))
    .where(and(eq(schema.invoices.firmId, invoice.firmId), eq(schema.invoices.id, invoice.id)))
    .returning();
  if (!row) throw new Error("Invoice was not found");
  return (await getDrizzleInvoice(db, invoice.firmId, invoice.id))!;
}

export async function createDrizzlePayment(
  db: OpenPracticeDatabase,
  input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  },
): Promise<PaymentWithAllocations> {
  if (input.payment.status === "pending_reconciliation" && input.allocations.length > 0) {
    throw new Error("Pending reconciliation payments cannot have effective allocations");
  }
  const allocatedCents = input.allocations.reduce(
    (sum, allocation) => sum + allocation.amountCents,
    0,
  );
  if (allocatedCents > input.payment.amountCents) {
    throw new Error("Payment allocations exceed payment amount");
  }
  for (const allocation of input.allocations) {
    const invoice = await getDrizzleInvoice(db, input.payment.firmId, allocation.invoiceId);
    if (!invoice) throw new Error("Payment allocation invoice was not found");
    if (allocation.amountCents > invoice.balanceDueCents) {
      throw new Error("Payment allocation exceeds invoice balance");
    }
  }
  await db.insert(schema.manualPayments).values(paymentInsert(input.payment));
  if (input.allocations.length > 0) {
    await db
      .insert(schema.paymentAllocations)
      .values(input.allocations.map(paymentAllocationInsert));
  }
  for (const allocation of input.allocations) {
    const invoice = await getDrizzleInvoice(db, input.payment.firmId, allocation.invoiceId);
    if (!invoice) continue;
    const existingAllocations = await listDrizzlePaymentAllocationsForInvoice(
      db,
      input.payment.firmId,
      allocation.invoiceId,
    );
    const totals = calculateInvoiceTotals({
      lines: invoice.lines,
      allocations: existingAllocations,
    });
    await updateDrizzleInvoice(db, {
      ...invoice,
      ...totals,
      status: invoiceStatusForPayment({
        currentStatus: invoice.status,
        totalCents: totals.totalCents,
        paidCents: totals.paidCents,
      }),
    });
  }
  return { ...clone(input.payment), allocations: clone(input.allocations) };
}

export async function reconcileDrizzlePayment(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    paymentId: string;
    reconciledByUserId: string;
    reconciledAt: string;
    notes?: string;
    evidence?: Record<string, unknown>;
  },
): Promise<PaymentWithAllocations> {
  const [paymentRow] = await db
    .select()
    .from(schema.manualPayments)
    .where(
      and(
        eq(schema.manualPayments.firmId, input.firmId),
        eq(schema.manualPayments.id, input.paymentId),
      ),
    );
  if (!paymentRow) throw new Error("Manual payment was not found");
  const payment = mapPaymentRow(paymentRow);
  if (payment.status !== "pending_reconciliation") {
    throw new Error("Manual payment is not pending reconciliation");
  }
  if (!payment.invoiceId) throw new Error("Manual payment invoice was not found");
  const invoice = await getDrizzleInvoice(db, input.firmId, payment.invoiceId);
  if (!invoice) throw new Error("Manual payment invoice was not found");
  if (invoice.matterId !== payment.matterId) {
    throw new Error("Manual payment invoice must belong to the payment matter");
  }
  if (payment.amountCents > invoice.balanceDueCents) {
    throw new Error("Payment allocation exceeds invoice balance");
  }
  const allocation: PaymentAllocationRecord = {
    id: crypto.randomUUID(),
    firmId: input.firmId,
    paymentId: payment.id,
    invoiceId: invoice.id,
    amountCents: payment.amountCents,
    allocatedAt: input.reconciledAt,
  };
  await db.insert(schema.paymentAllocations).values(paymentAllocationInsert(allocation));
  const existingAllocations = await listDrizzlePaymentAllocationsForInvoice(
    db,
    input.firmId,
    invoice.id,
  );
  const totals = calculateInvoiceTotals({
    lines: invoice.lines,
    allocations: existingAllocations,
  });
  await updateDrizzleInvoice(db, {
    ...invoice,
    ...totals,
    status: invoiceStatusForPayment({
      currentStatus: invoice.status,
      totalCents: totals.totalCents,
      paidCents: totals.paidCents,
    }),
  });
  const [updatedRow] = await db
    .update(schema.manualPayments)
    .set({
      status: "received",
      reconciledAt: new Date(input.reconciledAt),
      reconciledByUserId: input.reconciledByUserId,
      reconciliationNotes: input.notes ?? null,
      reconciliationEvidence: input.evidence ?? {},
    })
    .where(
      and(
        eq(schema.manualPayments.firmId, input.firmId),
        eq(schema.manualPayments.id, input.paymentId),
      ),
    )
    .returning();
  if (!updatedRow) throw new Error("Manual payment was not found");
  return { ...mapPaymentRow(updatedRow), allocations: [allocation] };
}

export async function listDrizzlePayments(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; invoiceId?: string } = {},
): Promise<PaymentWithAllocations[]> {
  const filters = [eq(schema.manualPayments.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.manualPayments.matterId, options.matterId));
  if (options.invoiceId) filters.push(eq(schema.manualPayments.invoiceId, options.invoiceId));
  const payments = await db
    .select()
    .from(schema.manualPayments)
    .where(and(...filters));
  const allocations = await db
    .select()
    .from(schema.paymentAllocations)
    .where(eq(schema.paymentAllocations.firmId, firmId));
  return payments.map((payment) => ({
    ...mapPaymentRow(payment),
    allocations: allocations
      .filter((allocation) => allocation.paymentId === payment.id)
      .map(mapPaymentAllocationRow),
  }));
}

async function listDrizzlePaymentAllocationsForInvoice(
  db: OpenPracticeDatabase,
  firmId: string,
  invoiceId: string,
): Promise<PaymentAllocationRecord[]> {
  const rows = await db
    .select()
    .from(schema.paymentAllocations)
    .where(
      and(
        eq(schema.paymentAllocations.firmId, firmId),
        eq(schema.paymentAllocations.invoiceId, invoiceId),
      ),
    );
  return rows.map(mapPaymentAllocationRow);
}
