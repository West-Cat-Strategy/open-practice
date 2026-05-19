import type { LedgerAccount, LedgerEntry } from "./ledger.js";
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

export const billingTrustExportKinds = ["billing", "trust"] as const;

export type BillingTrustExportKind = (typeof billingTrustExportKinds)[number];

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

export function trustTransferRequestAvailableBalanceCents(input: {
  request: Pick<TrustTransferRequestRecord, "matterId" | "clientContactId">;
  trustBalances: Record<string, number>;
}): number {
  if (input.request.clientContactId) {
    return Math.max(
      0,
      input.trustBalances[`${input.request.clientContactId}:${input.request.matterId}`] ?? 0,
    );
  }

  return Object.entries(input.trustBalances)
    .filter(([key]) => key.endsWith(`:${input.request.matterId}`))
    .reduce((sum, [, balance]) => sum + Math.max(0, balance), 0);
}

export interface TrustTransferLedgerLinkSummary {
  transactionExists: boolean;
  matterMatches: boolean;
  clientMatches: boolean;
  trustAssetCreditCents: number;
  clientLiabilityDebitCents: number;
  amountMatches: boolean;
}

export interface BillingTrustExportCounts {
  recordCount: number;
  timeEntryCount?: number;
  expenseEntryCount?: number;
  invoiceCount?: number;
  paymentCount?: number;
  trustTransferRequestCount?: number;
  ledgerAccountCount?: number;
  ledgerEntryCount?: number;
  balanceCount?: number;
  trustBalanceCount?: number;
}

export interface BillingTrustExportSnapshot {
  generatedAt: string;
  exportKind: BillingTrustExportKind;
  matterId?: string;
  counts: BillingTrustExportCounts;
  billing?: {
    timeEntries: TimeEntry[];
    expenseEntries: ExpenseEntry[];
    invoices: Array<InvoiceRecord & { lines: InvoiceLineRecord[] }>;
    payments: Array<ManualPaymentRecord & { allocations: PaymentAllocationRecord[] }>;
  };
  trust?: {
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
    trustTransferRequests: TrustTransferRequestRecord[];
  };
}

export function billingTrustExportResourceType(exportKind: BillingTrustExportKind): string {
  return exportKind === "billing" ? "billing_export" : "trust_export";
}

export function summarizeBillingTrustExportCounts(
  snapshot: Omit<BillingTrustExportSnapshot, "generatedAt" | "counts">,
): BillingTrustExportCounts {
  if (snapshot.exportKind === "billing") {
    const timeEntryCount = snapshot.billing?.timeEntries.length ?? 0;
    const expenseEntryCount = snapshot.billing?.expenseEntries.length ?? 0;
    const invoiceCount = snapshot.billing?.invoices.length ?? 0;
    const paymentCount = snapshot.billing?.payments.length ?? 0;
    return {
      recordCount: timeEntryCount + expenseEntryCount + invoiceCount + paymentCount,
      timeEntryCount,
      expenseEntryCount,
      invoiceCount,
      paymentCount,
    };
  }

  const trustTransferRequestCount = snapshot.trust?.trustTransferRequests.length ?? 0;
  const ledgerAccountCount = snapshot.trust?.accounts.length ?? 0;
  const ledgerEntryCount = snapshot.trust?.entries.length ?? 0;
  const balanceCount = Object.keys(snapshot.trust?.balances ?? {}).length;
  const trustBalanceCount = Object.keys(snapshot.trust?.trustBalances ?? {}).length;
  return {
    recordCount:
      trustTransferRequestCount +
      ledgerAccountCount +
      ledgerEntryCount +
      balanceCount +
      trustBalanceCount,
    trustTransferRequestCount,
    ledgerAccountCount,
    ledgerEntryCount,
    balanceCount,
    trustBalanceCount,
  };
}

export function summarizeTrustTransferLedgerLink(input: {
  request: Pick<TrustTransferRequestRecord, "matterId" | "clientContactId" | "amountCents">;
  ledgerTransactionId: string;
  accounts: Array<Pick<LedgerAccount, "id" | "type">>;
  entries: Array<
    Pick<
      LedgerEntry,
      "transactionId" | "matterId" | "clientId" | "accountId" | "debitCents" | "creditCents"
    >
  >;
}): TrustTransferLedgerLinkSummary {
  const entries = input.entries.filter(
    (entry) => entry.transactionId === input.ledgerTransactionId,
  );
  const accountTypeById = new Map(input.accounts.map((account) => [account.id, account.type]));
  const matterEntries = entries.filter((entry) => entry.matterId === input.request.matterId);
  const requestScopedEntries = input.request.clientContactId
    ? matterEntries.filter((entry) => entry.clientId === input.request.clientContactId)
    : matterEntries;
  const trustAssetCreditCents = matterEntries
    .filter((entry) => accountTypeById.get(entry.accountId) === "trust_asset")
    .reduce((sum, entry) => sum + entry.creditCents, 0);
  const clientLiabilityDebitCents = matterEntries
    .filter((entry) => accountTypeById.get(entry.accountId) === "client_liability")
    .reduce((sum, entry) => sum + entry.debitCents, 0);
  const hasOnlyExpectedTrustTransferEntries = requestScopedEntries.every((entry) => {
    const accountType = accountTypeById.get(entry.accountId);
    if (accountType === "trust_asset") return entry.debitCents === 0 && entry.creditCents > 0;
    if (accountType === "client_liability") return entry.debitCents > 0 && entry.creditCents === 0;
    return entry.debitCents === 0 && entry.creditCents === 0;
  });
  const matterMatches =
    entries.length > 0 && matterEntries.length > 0 && entries.length === matterEntries.length;
  const clientMatches =
    !input.request.clientContactId ||
    (matterEntries.length > 0 &&
      matterEntries.every((entry) => entry.clientId === input.request.clientContactId));

  return {
    transactionExists: entries.length > 0,
    matterMatches,
    clientMatches,
    trustAssetCreditCents,
    clientLiabilityDebitCents,
    amountMatches:
      matterMatches &&
      clientMatches &&
      hasOnlyExpectedTrustTransferEntries &&
      trustAssetCreditCents === input.request.amountCents &&
      clientLiabilityDebitCents === input.request.amountCents,
  };
}
