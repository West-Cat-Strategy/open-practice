import {
  calculateInvoiceTotals,
  invoiceStatusForPayment,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type ManualPaymentRecord,
  type PaymentAllocationRecord,
} from "@open-practice/domain";
import type {
  InvoiceWithLines,
  PaymentWithAllocations,
} from "../billing-invoices-payments-contracts.js";
import { clone } from "../contracts.js";

export interface MemoryBillingInvoicePaymentStore {
  invoices: InvoiceRecord[];
  invoiceLines: InvoiceLineRecord[];
  manualPayments: ManualPaymentRecord[];
  paymentAllocations: PaymentAllocationRecord[];
}

export function listMemoryInvoices(
  store: MemoryBillingInvoicePaymentStore,
  firmId: string,
  options: { matterId?: string; status?: InvoiceRecord["status"] } = {},
): InvoiceWithLines[] {
  return clone(
    store.invoices
      .filter(
        (invoice) =>
          invoice.firmId === firmId &&
          (!options.matterId || invoice.matterId === options.matterId) &&
          (!options.status || invoice.status === options.status),
      )
      .map((invoice) => ({
        ...invoice,
        lines: store.invoiceLines.filter((line) => line.invoiceId === invoice.id),
      })),
  );
}

export function getMemoryInvoice(
  store: MemoryBillingInvoicePaymentStore,
  firmId: string,
  invoiceId: string,
): InvoiceWithLines | undefined {
  const invoice = store.invoices.find(
    (candidate) => candidate.firmId === firmId && candidate.id === invoiceId,
  );
  if (!invoice) return undefined;
  return clone({
    ...invoice,
    lines: store.invoiceLines.filter((line) => line.invoiceId === invoice.id),
  });
}

export function createMemoryInvoice(
  store: MemoryBillingInvoicePaymentStore,
  input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  },
): InvoiceWithLines {
  store.invoices = [...store.invoices, clone(input.invoice)];
  store.invoiceLines = [...store.invoiceLines, ...clone(input.lines)];
  return clone({ ...input.invoice, lines: input.lines });
}

export function updateMemoryInvoice(
  store: MemoryBillingInvoicePaymentStore,
  invoice: InvoiceRecord,
): InvoiceWithLines {
  const index = store.invoices.findIndex(
    (candidate) => candidate.firmId === invoice.firmId && candidate.id === invoice.id,
  );
  if (index === -1) throw new Error("Invoice was not found");
  store.invoices = store.invoices.map((candidate, candidateIndex) =>
    candidateIndex === index ? clone(invoice) : candidate,
  );
  return getMemoryInvoice(store, invoice.firmId, invoice.id)!;
}

export function createMemoryPayment(
  store: MemoryBillingInvoicePaymentStore,
  input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  },
): PaymentWithAllocations {
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
    const invoice = getMemoryInvoice(store, input.payment.firmId, allocation.invoiceId);
    if (!invoice) throw new Error("Payment allocation invoice was not found");
    if (allocation.amountCents > invoice.balanceDueCents) {
      throw new Error("Payment allocation exceeds invoice balance");
    }
    const totals = calculateInvoiceTotals({
      lines: invoice.lines,
      allocations: [
        ...store.paymentAllocations.filter((existing) => existing.invoiceId === invoice.id),
        allocation,
      ],
    });
    updateMemoryInvoice(store, {
      ...invoice,
      ...totals,
      status: invoiceStatusForPayment({
        currentStatus: invoice.status,
        totalCents: totals.totalCents,
        paidCents: totals.paidCents,
      }),
    });
  }
  store.manualPayments = [...store.manualPayments, clone(input.payment)];
  store.paymentAllocations = [...store.paymentAllocations, ...clone(input.allocations)];
  return clone({ ...input.payment, allocations: input.allocations });
}

export function reconcileMemoryPayment(
  store: MemoryBillingInvoicePaymentStore,
  input: {
    firmId: string;
    paymentId: string;
    reconciledByUserId: string;
    reconciledAt: string;
    notes?: string;
    evidence?: Record<string, unknown>;
  },
): PaymentWithAllocations {
  const payment = store.manualPayments.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.paymentId,
  );
  if (!payment) throw new Error("Manual payment was not found");
  if (payment.status !== "pending_reconciliation") {
    throw new Error("Manual payment is not pending reconciliation");
  }
  if (!payment.invoiceId) throw new Error("Manual payment invoice was not found");
  const invoice = getMemoryInvoice(store, input.firmId, payment.invoiceId);
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
  const totals = calculateInvoiceTotals({
    lines: invoice.lines,
    allocations: [
      ...store.paymentAllocations.filter((existing) => existing.invoiceId === invoice.id),
      allocation,
    ],
  });
  updateMemoryInvoice(store, {
    ...invoice,
    ...totals,
    status: invoiceStatusForPayment({
      currentStatus: invoice.status,
      totalCents: totals.totalCents,
      paidCents: totals.paidCents,
    }),
  });
  const reconciledPayment: ManualPaymentRecord = {
    ...payment,
    status: "received",
    reconciledAt: input.reconciledAt,
    reconciledByUserId: input.reconciledByUserId,
    reconciliationNotes: input.notes,
    reconciliationEvidence: input.evidence ?? {},
  };
  store.manualPayments = store.manualPayments.map((candidate) =>
    candidate.firmId === input.firmId && candidate.id === input.paymentId
      ? clone(reconciledPayment)
      : candidate,
  );
  store.paymentAllocations = [...store.paymentAllocations, clone(allocation)];
  return clone({ ...reconciledPayment, allocations: [allocation] });
}

export function listMemoryPayments(
  store: MemoryBillingInvoicePaymentStore,
  firmId: string,
  options: { matterId?: string; invoiceId?: string } = {},
): PaymentWithAllocations[] {
  return clone(
    store.manualPayments
      .filter(
        (payment) =>
          payment.firmId === firmId &&
          (!options.matterId || payment.matterId === options.matterId) &&
          (!options.invoiceId || payment.invoiceId === options.invoiceId),
      )
      .map((payment) => ({
        ...payment,
        allocations: store.paymentAllocations.filter(
          (allocation) => allocation.paymentId === payment.id,
        ),
      })),
  );
}
