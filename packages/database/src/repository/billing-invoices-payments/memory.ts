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
