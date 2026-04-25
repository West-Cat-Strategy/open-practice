import type { ExpenseEntry, TimeEntry } from "./models.js";

export type BillingStatus = "draft" | "submitted" | "approved" | "billed" | "written_off";

export type InvoiceStatus = "draft" | "approved" | "issued" | "partially_paid" | "paid" | "void";

export type InvoiceLineKind = "time" | "expense" | "adjustment";

export type ManualPaymentMethod = "cash" | "cheque" | "card" | "eft" | "other";

export type ManualPaymentStatus = "received" | "void";

export type TrustTransferRequestStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "linked"
  | "cancelled";

export interface InvoiceRecord {
  id: string;
  firmId: string;
  matterId: string;
  clientContactId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  approvedAt?: string;
  issuedAt?: string;
  dueAt?: string;
  memo?: string;
  createdByUserId: string;
  createdAt: string;
  voidedAt?: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceDueCents: number;
}

export interface InvoiceLineRecord {
  id: string;
  firmId: string;
  invoiceId: string;
  matterId: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unitAmountCents: number;
  subtotalCents: number;
  taxName?: string;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  timeEntryId?: string;
  expenseEntryId?: string;
  createdAt: string;
}

export interface ManualPaymentRecord {
  id: string;
  firmId: string;
  matterId: string;
  invoiceId?: string;
  clientContactId?: string;
  receivedAt: string;
  amountCents: number;
  method: ManualPaymentMethod;
  reference?: string;
  status: ManualPaymentStatus;
  receivedByUserId: string;
  notes?: string;
  evidence?: Record<string, unknown>;
}

export interface PaymentAllocationRecord {
  id: string;
  firmId: string;
  paymentId: string;
  invoiceId: string;
  amountCents: number;
  allocatedAt: string;
}

export interface TrustTransferRequestRecord {
  id: string;
  firmId: string;
  matterId: string;
  clientContactId?: string;
  invoiceId: string;
  requestedByUserId: string;
  amountCents: number;
  status: TrustTransferRequestStatus;
  reason?: string;
  requestedAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  ledgerTransactionId?: string;
  evidence?: Record<string, unknown>;
}

export function timeEntryAmountCents(entry: Pick<TimeEntry, "minutes" | "rateCents">): number {
  return Math.round((entry.minutes / 60) * entry.rateCents);
}

export function expenseEntryAmountCents(entry: Pick<ExpenseEntry, "amountCents">): number {
  return entry.amountCents;
}

export function calculateTaxCents(input: { subtotalCents: number; taxRateBps: number }): number {
  return Math.round((input.subtotalCents * input.taxRateBps) / 10_000);
}

export function createInvoiceLineTotals(input: {
  quantity: number;
  unitAmountCents: number;
  taxRateBps: number;
}): Pick<InvoiceLineRecord, "subtotalCents" | "taxCents" | "totalCents"> {
  const subtotalCents = Math.round(input.quantity * input.unitAmountCents);
  const taxCents = calculateTaxCents({ subtotalCents, taxRateBps: input.taxRateBps });
  return {
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
  };
}

export function allocatedPaymentTotalCents(
  allocations: Array<Pick<PaymentAllocationRecord, "amountCents">>,
): number {
  return allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
}

export function calculateInvoiceTotals(input: {
  lines: Array<Pick<InvoiceLineRecord, "subtotalCents" | "taxCents" | "totalCents">>;
  allocations: Array<Pick<PaymentAllocationRecord, "amountCents">>;
}): Pick<
  InvoiceRecord,
  "subtotalCents" | "taxCents" | "totalCents" | "paidCents" | "balanceDueCents"
> {
  const subtotalCents = input.lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const taxCents = input.lines.reduce((sum, line) => sum + line.taxCents, 0);
  const totalCents = input.lines.reduce((sum, line) => sum + line.totalCents, 0);
  const paidCents = allocatedPaymentTotalCents(input.allocations);
  return {
    subtotalCents,
    taxCents,
    totalCents,
    paidCents,
    balanceDueCents: Math.max(0, totalCents - paidCents),
  };
}

export function invoiceStatusForPayment(input: {
  currentStatus: InvoiceStatus;
  totalCents: number;
  paidCents: number;
}): InvoiceStatus {
  if (
    input.currentStatus === "void" ||
    input.currentStatus === "draft" ||
    input.currentStatus === "approved"
  ) {
    return input.currentStatus;
  }
  if (input.paidCents <= 0) return "issued";
  if (input.paidCents >= input.totalCents) return "paid";
  return "partially_paid";
}

export function isBillableUnbilled(
  entry:
    | Pick<TimeEntry, "billable" | "billingStatus">
    | Pick<ExpenseEntry, "reimbursable" | "billingStatus">,
): boolean {
  const chargeable = "billable" in entry ? entry.billable : entry.reimbursable;
  return chargeable && entry.billingStatus === "approved";
}

export function assertBillingStatusTransition(from: BillingStatus, to: BillingStatus): void {
  const allowed: Record<BillingStatus, BillingStatus[]> = {
    draft: ["submitted", "written_off"],
    submitted: ["approved", "written_off"],
    approved: ["billed", "written_off"],
    billed: [],
    written_off: [],
  };
  if (!allowed[from].includes(to)) {
    throw new Error(`Invalid billing status transition: ${from} to ${to}`);
  }
}

export function trustTransferRequestCanPost(
  request: Pick<TrustTransferRequestRecord, "status" | "ledgerTransactionId">,
): boolean {
  return request.status === "approved" && !request.ledgerTransactionId;
}
