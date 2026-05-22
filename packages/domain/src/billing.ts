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

export interface BillingPeriodLockRecord {
  id: string;
  firmId: string;
  periodStart: string;
  periodEnd: string;
  reason?: string;
  lockedByUserId: string;
  lockedAt: string;
}

export type BillingRateRuleScope = "firm" | "role" | "user" | "matter" | "matter_user";

export interface BillingRateRuleRecord {
  id: string;
  firmId: string;
  label: string;
  matterId?: string;
  userId?: string;
  role?: string;
  scope: BillingRateRuleScope;
  rateCents: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  active: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRateSnapshot {
  source: "manual" | "rate_rule";
  rateCents: number;
  resolvedAt: string;
  rateRuleId?: string;
  label?: string;
  scope?: BillingRateRuleScope;
  matterId?: string;
  userId?: string;
  role?: string;
}

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

export function billingRuleScope(input: {
  matterId?: string;
  userId?: string;
  role?: string;
}): BillingRateRuleScope {
  if (input.matterId && input.userId) return "matter_user";
  if (input.matterId) return "matter";
  if (input.userId) return "user";
  if (input.role) return "role";
  return "firm";
}

export function billingRateRuleSpecificity(scope: BillingRateRuleScope): number {
  switch (scope) {
    case "matter_user":
      return 5;
    case "matter":
      return 4;
    case "user":
      return 3;
    case "role":
      return 2;
    case "firm":
      return 1;
  }
}

export function validateBillingPeriodLock(record: BillingPeriodLockRecord): void {
  if (!record.firmId.trim()) throw new Error("Billing period lock requires a firm id");
  if (Number.isNaN(Date.parse(record.periodStart)) || Number.isNaN(Date.parse(record.periodEnd))) {
    throw new Error("Billing period lock dates must be valid timestamps");
  }
  if (Date.parse(record.periodEnd) <= Date.parse(record.periodStart)) {
    throw new Error("Billing period lock end must be after start");
  }
  if (!record.lockedByUserId.trim()) throw new Error("Billing period lock requires an actor");
}

export function validateBillingRateRule(record: BillingRateRuleRecord): void {
  if (!record.firmId.trim()) throw new Error("Billing rate rule requires a firm id");
  if (!record.label.trim()) throw new Error("Billing rate rule label is required");
  if (!Number.isInteger(record.rateCents) || record.rateCents < 0) {
    throw new Error("Billing rate rule rate must be a non-negative integer");
  }
  if (record.scope !== billingRuleScope(record)) {
    throw new Error("Billing rate rule scope does not match identifiers");
  }
  if (Number.isNaN(Date.parse(record.effectiveFrom))) {
    throw new Error("Billing rate rule effectiveFrom must be a valid timestamp");
  }
  if (record.effectiveUntil) {
    if (Number.isNaN(Date.parse(record.effectiveUntil))) {
      throw new Error("Billing rate rule effectiveUntil must be a valid timestamp");
    }
    if (Date.parse(record.effectiveUntil) <= Date.parse(record.effectiveFrom)) {
      throw new Error("Billing rate rule effectiveUntil must be after effectiveFrom");
    }
  }
}

export function billingDateFallsInsideLock(
  dateIso: string,
  lock: Pick<BillingPeriodLockRecord, "periodStart" | "periodEnd">,
): boolean {
  const value = Date.parse(dateIso);
  return value >= Date.parse(lock.periodStart) && value < Date.parse(lock.periodEnd);
}

export function billingPeriodLocksOverlap(
  left: Pick<BillingPeriodLockRecord, "firmId" | "periodStart" | "periodEnd">,
  right: Pick<BillingPeriodLockRecord, "firmId" | "periodStart" | "periodEnd">,
): boolean {
  return (
    left.firmId === right.firmId &&
    Date.parse(left.periodStart) < Date.parse(right.periodEnd) &&
    Date.parse(right.periodStart) < Date.parse(left.periodEnd)
  );
}

export function billingRateRuleEffectivePeriodsOverlap(
  left: Pick<BillingRateRuleRecord, "effectiveFrom" | "effectiveUntil">,
  right: Pick<BillingRateRuleRecord, "effectiveFrom" | "effectiveUntil">,
): boolean {
  const leftEnd = left.effectiveUntil ? Date.parse(left.effectiveUntil) : Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil
    ? Date.parse(right.effectiveUntil)
    : Number.POSITIVE_INFINITY;
  return Date.parse(left.effectiveFrom) < rightEnd && Date.parse(right.effectiveFrom) < leftEnd;
}

export function billingRateRulesOverlapAtSameActiveScope(
  left: BillingRateRuleRecord,
  right: BillingRateRuleRecord,
): boolean {
  return (
    left.firmId === right.firmId &&
    left.active &&
    right.active &&
    left.scope === right.scope &&
    (left.matterId ?? "") === (right.matterId ?? "") &&
    (left.userId ?? "") === (right.userId ?? "") &&
    (left.role ?? "") === (right.role ?? "") &&
    billingRateRuleEffectivePeriodsOverlap(left, right)
  );
}

export function billingRateRuleApplies(
  rule: BillingRateRuleRecord,
  input: { matterId: string; userId: string; role?: string; performedAt: string },
): boolean {
  if (!rule.active) return false;
  const performedAt = Date.parse(input.performedAt);
  if (performedAt < Date.parse(rule.effectiveFrom)) return false;
  if (rule.effectiveUntil && performedAt >= Date.parse(rule.effectiveUntil)) return false;
  if (rule.matterId && rule.matterId !== input.matterId) return false;
  if (rule.userId && rule.userId !== input.userId) return false;
  if (rule.role && rule.role !== input.role) return false;
  return true;
}

export function resolveBillingRateRule(
  rules: BillingRateRuleRecord[],
  input: { matterId: string; userId: string; role?: string; performedAt: string },
): BillingRateRuleRecord | undefined {
  return rules
    .filter((rule) => billingRateRuleApplies(rule, input))
    .sort((left, right) => {
      const specificity =
        billingRateRuleSpecificity(right.scope) - billingRateRuleSpecificity(left.scope);
      if (specificity !== 0) return specificity;
      return Date.parse(right.effectiveFrom) - Date.parse(left.effectiveFrom);
    })[0];
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
