import type {
  InvoiceLineRecord,
  InvoiceRecord,
  ManualPaymentRecord,
  PaymentAllocationRecord,
} from "@open-practice/domain";

export interface InvoiceWithLines extends InvoiceRecord {
  lines: InvoiceLineRecord[];
}

export interface PaymentWithAllocations extends ManualPaymentRecord {
  allocations: PaymentAllocationRecord[];
}

export interface BillingInvoicePaymentRepository {
  listInvoices(
    firmId: string,
    options?: { matterId?: string; status?: InvoiceRecord["status"] },
  ): Promise<InvoiceWithLines[]>;
  getInvoice(firmId: string, invoiceId: string): Promise<InvoiceWithLines | undefined>;
  createInvoice(input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  }): Promise<InvoiceWithLines>;
  updateInvoice(invoice: InvoiceRecord): Promise<InvoiceWithLines>;
  createPayment(input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  }): Promise<PaymentWithAllocations>;
  listPayments(
    firmId: string,
    options?: { matterId?: string; invoiceId?: string },
  ): Promise<PaymentWithAllocations[]>;
}
