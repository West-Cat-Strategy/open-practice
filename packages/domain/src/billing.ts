import type { LedgerAccount, LedgerEntry } from "./ledger.js";
import type { ExpenseEntry, Matter, Province, TimeEntry } from "./models.js";

export type BillingStatus = "draft" | "submitted" | "approved" | "billed" | "written_off";

export type InvoiceStatus = "draft" | "approved" | "issued" | "partially_paid" | "paid" | "void";

export type InvoiceLineKind = "time" | "expense" | "adjustment";

export interface BillingTimerDraftPolicy {
  createsDraftOnly: true;
  autoSubmitEnabled: false;
  autoApproveEnabled: false;
  lockBypassAllowed: false;
}

export const billingTimerDraftPolicy: BillingTimerDraftPolicy = {
  createsDraftOnly: true,
  autoSubmitEnabled: false,
  autoApproveEnabled: false,
  lockBypassAllowed: false,
};

export interface ExpenseCategoryProfileCue {
  key: string;
  label: string;
  category: string;
  defaultReimbursable: boolean;
  reviewCue: string;
  reviewOnly: true;
}

export const expenseCategoryProfileCues = [
  {
    key: "filing_service",
    label: "Filing and service",
    category: "Filing and service",
    defaultReimbursable: true,
    reviewCue: "Attach receipt or registry confirmation before billing approval.",
    reviewOnly: true,
  },
  {
    key: "courier_postage",
    label: "Courier and postage",
    category: "Courier and postage",
    defaultReimbursable: true,
    reviewCue: "Confirm matter purpose and delivery evidence before approval.",
    reviewOnly: true,
  },
  {
    key: "research_database",
    label: "Research database",
    category: "Research database",
    defaultReimbursable: false,
    reviewCue: "Confirm client billing agreement before marking reimbursable.",
    reviewOnly: true,
  },
  {
    key: "travel_meal",
    label: "Travel and meals",
    category: "Travel and meals",
    defaultReimbursable: false,
    reviewCue: "Review policy, purpose, and receipts before approval.",
    reviewOnly: true,
  },
] as const satisfies readonly ExpenseCategoryProfileCue[];

export type ExpenseCategoryProfileKey = ExpenseCategoryProfileCue["key"];

export interface BillingExpenseCategoryRecord {
  id: string;
  firmId: string;
  code: string;
  label: string;
  active: boolean;
  defaultReimbursable: boolean;
  reimbursableAllowed: boolean;
  matterId?: string;
  practiceAreas: string[];
  jurisdictions: Province[];
  reviewCue?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ManualPaymentMethod = "cash" | "cheque" | "card" | "eft" | "other";

export type ManualPaymentStatus = "pending_reconciliation" | "received" | "void";

export const hostedPaymentRequestStatuses = [
  "ready_to_send",
  "sent",
  "viewed",
  "cancelled",
  "expired",
] as const;

export type HostedPaymentRequestStatus = (typeof hostedPaymentRequestStatuses)[number];

export const billDeliveryStatuses = ["not_sent", "queued", "sent", "failed"] as const;

export type BillDeliveryStatus = (typeof billDeliveryStatuses)[number];

export const billDeliveryChannels = ["none", "email", "portal", "manual"] as const;

export type BillDeliveryChannel = (typeof billDeliveryChannels)[number];

export const billReminderStatuses = ["not_scheduled", "scheduled", "sent", "paused"] as const;

export type BillReminderStatus = (typeof billReminderStatuses)[number];

export const paymentPlanPlaceholderStatuses = [
  "not_offered",
  "offered",
  "client_requested",
  "staff_review",
] as const;

export type PaymentPlanPlaceholderStatus = (typeof paymentPlanPlaceholderStatuses)[number];

export const paymentPlanPlaceholderCadences = ["weekly", "biweekly", "monthly"] as const;

export type PaymentPlanPlaceholderCadence = (typeof paymentPlanPlaceholderCadences)[number];

export const creditWriteOffPostureStatuses = ["none", "credit_review", "write_off_review"] as const;

export type CreditWriteOffPostureStatus = (typeof creditWriteOffPostureStatuses)[number];

export const paymentProcessorProviders = ["stripe"] as const;

export type PaymentProcessorProviderKey = (typeof paymentProcessorProviders)[number];

export const hostedPaymentProcessorStatuses = ["not_started", "checkout_session_created"] as const;

export type HostedPaymentProcessorStatus = (typeof hostedPaymentProcessorStatuses)[number];

export const paymentSettlementReviewStatuses = ["not_received", "needs_review"] as const;

export type PaymentSettlementReviewStatus = (typeof paymentSettlementReviewStatuses)[number];

export const paymentSettlementEventTypes = [
  "checkout_session_completed",
  "payment_intent_succeeded",
  "payment_intent_payment_failed",
  "charge_refunded",
  "charge_dispute_created",
] as const;

export type PaymentSettlementEventType = (typeof paymentSettlementEventTypes)[number];

export const paymentSettlementPaymentStatuses = [
  "paid",
  "unpaid",
  "failed",
  "refunded",
  "disputed",
  "unknown",
] as const;

export type PaymentSettlementPaymentStatus = (typeof paymentSettlementPaymentStatuses)[number];

export const paymentImportEventFamilies = ["payment", "deposit"] as const;

export type PaymentImportEventFamily = (typeof paymentImportEventFamilies)[number];

export type PaymentImportReviewState = "needs_review";

export const paymentImportRefundChargebackReviewStatuses = [
  "refund_observed",
  "chargeback_observed",
] as const;

export type PaymentImportRefundChargebackReviewStatus =
  (typeof paymentImportRefundChargebackReviewStatuses)[number];

export type PaymentImportRefundChargebackReviewCategory = "refund" | "chargeback";

export const paymentImportReviewConflictReasons = [
  "duplicate",
  "candidate_mismatch",
  "amount_mismatch",
  "status_conflict",
] as const;

export type PaymentImportReviewConflictReason = (typeof paymentImportReviewConflictReasons)[number];

export interface PaymentImportReviewDepositMatchCue {
  reviewAction: "staff_deposit_match_review_required";
  candidateManualPaymentId?: string;
  invoiceBalanceMutation: "none";
  reconciliationMutation: "none";
  trustPosting: "none";
}

export interface PaymentImportRefundChargebackReviewCue {
  category: PaymentImportRefundChargebackReviewCategory;
  status: "needs_review";
  reviewAction: "staff_refund_chargeback_review_required";
  rawProviderPayloadRetained: false;
  invoiceBalanceMutation: "none";
  ledgerReversal: "none";
  trustPosting: "none";
  providerCommand: "none";
  clientNotification: "none";
}

export const paymentImportDepositMatchReviewDecisions = [
  "candidate_supported",
  "candidate_rejected",
  "needs_more_evidence",
] as const;

export type PaymentImportDepositMatchReviewDecision =
  (typeof paymentImportDepositMatchReviewDecisions)[number];

export const paymentImportDepositMatchReviewReasons = [
  "candidate_evidence_matches",
  "amount_mismatch",
  "status_conflict",
  "duplicate_or_conflict",
  "manual_payment_not_pending",
  "invoice_candidate_mismatch",
  "missing_reviewer_evidence",
] as const;

export type PaymentImportDepositMatchReviewReason =
  (typeof paymentImportDepositMatchReviewReasons)[number];

export interface PaymentImportDepositMatchReviewBoundary {
  rawProviderPayloadRetained: false;
  invoiceBalanceMutation: "none";
  settlementAutomation: false;
  reconciliationMutation: "none";
  refundHandling: "none";
  chargebackHandling: "none";
  trustPosting: "none";
  providerCommand: "none";
  clientNotification: "none";
  depositMatching: "review_decision_only";
}

export type PaymentImportDepositMatchReconciliationReadinessReason =
  | "supported_candidate_ready"
  | "no_supported_decision"
  | "candidate_not_supported"
  | "import_record_conflict"
  | "candidate_manual_payment_mismatch"
  | "manual_payment_not_found"
  | "manual_payment_not_pending"
  | "amount_mismatch"
  | "invoice_not_found"
  | "invoice_candidate_mismatch"
  | "invoice_balance_insufficient";

export interface PaymentImportDepositMatchReconciliationReadiness {
  eligible: boolean;
  reason: PaymentImportDepositMatchReconciliationReadinessReason;
  reviewAction: "manual_payment_reconcile_review";
  candidateManualPaymentId?: string;
  candidateInvoiceId?: string;
  amountCents?: number;
  mutation: "none";
}

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
  reconciledAt?: string;
  reconciledByUserId?: string;
  reconciliationNotes?: string;
  reconciliationEvidence?: Record<string, unknown>;
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

export interface BillDeliveryState {
  status: BillDeliveryStatus;
  channel: BillDeliveryChannel;
  recipientCount: number;
  deliveredAt?: string;
  lastAttemptAt?: string;
  failureSummary?: string;
}

export interface BillReminderState {
  status: BillReminderStatus;
  reminderCount: number;
  nextReminderAt?: string;
  lastReminderAt?: string;
  pausedReason?: string;
}

export interface PaymentPlanPlaceholder {
  status: PaymentPlanPlaceholderStatus;
  installmentCount?: number;
  cadence?: PaymentPlanPlaceholderCadence;
  startsAt?: string;
  reviewNote?: string;
  enforcement: "none";
}

export interface CreditWriteOffPosture {
  status: CreditWriteOffPostureStatus;
  amountCents?: number;
  reason?: string;
  movement: "none";
}

export interface PaymentSettlementWebhookBoundary {
  signatureVerified: false;
  rawWebhookBodyStored: false;
  automaticInvoiceMutation: false;
  automaticReconciliation: false;
  trustPosting: false;
  refundHandling: "review_only";
  chargebackHandling: "review_only";
}

export interface PaymentSettlementReview {
  status: PaymentSettlementReviewStatus;
  provider?: PaymentProcessorProviderKey;
  eventType?: PaymentSettlementEventType;
  paymentStatus?: PaymentSettlementPaymentStatus;
  externalEventId?: string;
  externalSessionId?: string;
  amountCents?: number;
  currency?: "CAD";
  observedAt?: string;
  receivedAt?: string;
  reviewAction: "staff_reconciliation_review_required";
  invoiceBalanceMutation: "none";
  reconciliationMutation: "none";
  trustPosting: "none";
  webhookBoundary: PaymentSettlementWebhookBoundary;
}

export interface HostedPaymentProcessorState {
  status: HostedPaymentProcessorStatus;
  provider?: PaymentProcessorProviderKey;
  externalSessionId?: string;
  checkoutUrl?: string;
  createdAt?: string;
  expiresAt?: string;
  settlementReview?: PaymentSettlementReview;
}

export interface HostedPaymentRequestRecord {
  id: string;
  firmId: string;
  matterId: string;
  invoiceId: string;
  clientContactId?: string;
  status: HostedPaymentRequestStatus;
  amountCents: number;
  currency: "CAD";
  hostedPath: string;
  delivery: BillDeliveryState;
  reminder: BillReminderState;
  paymentPlan: PaymentPlanPlaceholder;
  creditWriteOffPosture: CreditWriteOffPosture;
  processor: HostedPaymentProcessorState;
  evidence?: Record<string, unknown>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface PaymentProcessorCheckoutSessionInput {
  firmId: string;
  matterId: string;
  invoiceId: string;
  hostedPaymentRequestId: string;
  amountCents: number;
  currency: "CAD";
  description: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PaymentProcessorCheckoutSession {
  provider: PaymentProcessorProviderKey;
  externalSessionId: string;
  checkoutUrl: string;
  expiresAt?: string;
  evidence?: Record<string, unknown>;
}

export interface PaymentProcessorProvider {
  createCheckoutSession(
    input: PaymentProcessorCheckoutSessionInput,
  ): Promise<PaymentProcessorCheckoutSession>;
}

export interface PaymentImportReviewBoundary {
  rawProviderPayloadRetained: false;
  invoiceBalanceMutation: "none";
  settlementAutomation: false;
  reconciliationMutation: "none";
  refundHandling: "review_only";
  chargebackHandling: "review_only";
  trustPosting: "none";
  providerCommand: "none";
  clientNotification: "none";
  depositMatching: "review_cue_only";
}

export interface PaymentImportReviewRecord {
  id: string;
  firmId: string;
  matterId: string;
  providerLabel: string;
  eventFamily: PaymentImportEventFamily;
  eventStatus: string;
  externalEventId: string;
  externalPaymentId?: string;
  externalDepositId?: string;
  amountCents: number;
  currency: "CAD";
  observedAt?: string;
  importedAt: string;
  importedByUserId: string;
  candidateInvoiceId?: string;
  candidateHostedPaymentRequestId?: string;
  candidateManualPaymentId?: string;
  duplicateOfRecordId?: string;
  conflictReason?: PaymentImportReviewConflictReason;
  reviewState: PaymentImportReviewState;
  normalizedEvidenceFingerprint: string;
  boundaries: PaymentImportReviewBoundary;
  updatedAt: string;
}

export interface PaymentImportDepositMatchReviewRecord {
  id: string;
  firmId: string;
  matterId: string;
  paymentImportReviewRecordId: string;
  candidateManualPaymentId: string;
  candidateInvoiceId?: string;
  decision: PaymentImportDepositMatchReviewDecision;
  reason: PaymentImportDepositMatchReviewReason;
  importAmountCents: number;
  manualPaymentAmountCents: number;
  currency: "CAD";
  candidateManualPaymentStatus: ManualPaymentStatus;
  reviewerEvidencePresent: true;
  idempotencyKey: string;
  decisionFingerprint: string;
  boundaries: PaymentImportDepositMatchReviewBoundary;
  reviewedByUserId: string;
  reviewedAt: string;
  createdAt: string;
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

export function defaultBillDeliveryState(): BillDeliveryState {
  return {
    status: "not_sent",
    channel: "none",
    recipientCount: 0,
  };
}

export function defaultBillReminderState(): BillReminderState {
  return {
    status: "not_scheduled",
    reminderCount: 0,
  };
}

export function defaultPaymentPlanPlaceholder(): PaymentPlanPlaceholder {
  return {
    status: "not_offered",
    enforcement: "none",
  };
}

export function defaultCreditWriteOffPosture(): CreditWriteOffPosture {
  return {
    status: "none",
    movement: "none",
  };
}

export function defaultHostedPaymentProcessorState(): HostedPaymentProcessorState {
  return {
    status: "not_started",
  };
}

export function defaultPaymentSettlementReview(): PaymentSettlementReview {
  return {
    status: "not_received",
    reviewAction: "staff_reconciliation_review_required",
    invoiceBalanceMutation: "none",
    reconciliationMutation: "none",
    trustPosting: "none",
    webhookBoundary: {
      signatureVerified: false,
      rawWebhookBodyStored: false,
      automaticInvoiceMutation: false,
      automaticReconciliation: false,
      trustPosting: false,
      refundHandling: "review_only",
      chargebackHandling: "review_only",
    },
  };
}

export function buildPaymentSettlementReview(input: {
  provider: PaymentProcessorProviderKey;
  eventType: PaymentSettlementEventType;
  paymentStatus: PaymentSettlementPaymentStatus;
  externalEventId: string;
  externalSessionId?: string;
  amountCents?: number;
  currency?: "CAD";
  observedAt?: string;
  receivedAt?: string;
}): PaymentSettlementReview {
  return {
    ...defaultPaymentSettlementReview(),
    ...input,
    status: "needs_review",
  };
}

export function defaultPaymentImportReviewBoundary(): PaymentImportReviewBoundary {
  return {
    rawProviderPayloadRetained: false,
    invoiceBalanceMutation: "none",
    settlementAutomation: false,
    reconciliationMutation: "none",
    refundHandling: "review_only",
    chargebackHandling: "review_only",
    trustPosting: "none",
    providerCommand: "none",
    clientNotification: "none",
    depositMatching: "review_cue_only",
  };
}

export function defaultPaymentImportDepositMatchReviewBoundary(): PaymentImportDepositMatchReviewBoundary {
  return {
    rawProviderPayloadRetained: false,
    invoiceBalanceMutation: "none",
    settlementAutomation: false,
    reconciliationMutation: "none",
    refundHandling: "none",
    chargebackHandling: "none",
    trustPosting: "none",
    providerCommand: "none",
    clientNotification: "none",
    depositMatching: "review_decision_only",
  };
}

export function paymentImportReviewHasConflict(
  record: Pick<PaymentImportReviewRecord, "conflictReason" | "duplicateOfRecordId">,
): boolean {
  return Boolean(record.conflictReason || record.duplicateOfRecordId);
}

export function paymentImportReviewDepositMatchCue(
  record: Pick<PaymentImportReviewRecord, "candidateManualPaymentId">,
): PaymentImportReviewDepositMatchCue {
  return {
    reviewAction: "staff_deposit_match_review_required",
    candidateManualPaymentId: record.candidateManualPaymentId,
    invoiceBalanceMutation: "none",
    reconciliationMutation: "none",
    trustPosting: "none",
  };
}

function paymentImportDepositMatchReadiness(
  reason: PaymentImportDepositMatchReconciliationReadinessReason,
  details: Pick<
    PaymentImportDepositMatchReconciliationReadiness,
    "candidateManualPaymentId" | "candidateInvoiceId" | "amountCents"
  > = {},
): PaymentImportDepositMatchReconciliationReadiness {
  const readiness: PaymentImportDepositMatchReconciliationReadiness = {
    eligible: reason === "supported_candidate_ready",
    reason,
    reviewAction: "manual_payment_reconcile_review",
    mutation: "none",
  };
  if (details.candidateManualPaymentId) {
    readiness.candidateManualPaymentId = details.candidateManualPaymentId;
  }
  if (details.candidateInvoiceId) readiness.candidateInvoiceId = details.candidateInvoiceId;
  if (details.amountCents !== undefined) readiness.amountCents = details.amountCents;
  return readiness;
}

export function paymentImportDepositMatchReconciliationReadiness(input: {
  importRecord: Pick<
    PaymentImportReviewRecord,
    | "matterId"
    | "amountCents"
    | "candidateManualPaymentId"
    | "candidateInvoiceId"
    | "duplicateOfRecordId"
    | "conflictReason"
  >;
  latestReview?: Pick<
    PaymentImportDepositMatchReviewRecord,
    | "decision"
    | "reason"
    | "matterId"
    | "candidateManualPaymentId"
    | "candidateInvoiceId"
    | "importAmountCents"
    | "manualPaymentAmountCents"
  >;
  manualPayment?: Pick<
    ManualPaymentRecord,
    "id" | "matterId" | "invoiceId" | "amountCents" | "status"
  >;
  invoice?: Pick<InvoiceRecord, "id" | "matterId" | "balanceDueCents">;
}): PaymentImportDepositMatchReconciliationReadiness {
  const { importRecord, latestReview, manualPayment, invoice } = input;
  if (!latestReview) return paymentImportDepositMatchReadiness("no_supported_decision");
  const details = {
    candidateManualPaymentId: latestReview.candidateManualPaymentId,
    candidateInvoiceId:
      latestReview.candidateInvoiceId ??
      importRecord.candidateInvoiceId ??
      manualPayment?.invoiceId,
    amountCents: latestReview.manualPaymentAmountCents,
  };
  if (
    latestReview.decision !== "candidate_supported" ||
    latestReview.reason !== "candidate_evidence_matches"
  ) {
    return paymentImportDepositMatchReadiness("candidate_not_supported", details);
  }
  if (paymentImportReviewHasConflict(importRecord)) {
    return paymentImportDepositMatchReadiness("import_record_conflict", details);
  }
  if (
    !importRecord.candidateManualPaymentId ||
    importRecord.candidateManualPaymentId !== latestReview.candidateManualPaymentId
  ) {
    return paymentImportDepositMatchReadiness("candidate_manual_payment_mismatch", details);
  }
  if (!manualPayment || manualPayment.id !== latestReview.candidateManualPaymentId) {
    return paymentImportDepositMatchReadiness("manual_payment_not_found", details);
  }
  if (
    manualPayment.matterId !== importRecord.matterId ||
    latestReview.matterId !== importRecord.matterId
  ) {
    return paymentImportDepositMatchReadiness("candidate_manual_payment_mismatch", details);
  }
  if (manualPayment.status !== "pending_reconciliation") {
    return paymentImportDepositMatchReadiness("manual_payment_not_pending", details);
  }
  if (
    manualPayment.amountCents !== latestReview.manualPaymentAmountCents ||
    importRecord.amountCents !== latestReview.importAmountCents ||
    latestReview.importAmountCents !== latestReview.manualPaymentAmountCents
  ) {
    return paymentImportDepositMatchReadiness("amount_mismatch", details);
  }
  const candidateInvoiceId = latestReview.candidateInvoiceId ?? importRecord.candidateInvoiceId;
  if (!manualPayment.invoiceId || !candidateInvoiceId || !invoice) {
    return paymentImportDepositMatchReadiness("invoice_not_found", details);
  }
  if (manualPayment.invoiceId !== candidateInvoiceId || invoice.id !== candidateInvoiceId) {
    return paymentImportDepositMatchReadiness("invoice_candidate_mismatch", details);
  }
  if (invoice.matterId !== importRecord.matterId || invoice.matterId !== manualPayment.matterId) {
    return paymentImportDepositMatchReadiness("invoice_candidate_mismatch", details);
  }
  if (manualPayment.amountCents > invoice.balanceDueCents) {
    return paymentImportDepositMatchReadiness("invoice_balance_insufficient", details);
  }
  return paymentImportDepositMatchReadiness("supported_candidate_ready", details);
}

export function paymentImportRefundChargebackReviewCue(
  record: Pick<PaymentImportReviewRecord, "eventFamily" | "eventStatus">,
): PaymentImportRefundChargebackReviewCue | undefined {
  if (record.eventFamily !== "payment") return undefined;
  const categoryByStatus: Record<
    PaymentImportRefundChargebackReviewStatus,
    PaymentImportRefundChargebackReviewCategory
  > = {
    refund_observed: "refund",
    chargeback_observed: "chargeback",
  };
  const category =
    categoryByStatus[record.eventStatus as PaymentImportRefundChargebackReviewStatus];
  if (!category) return undefined;
  return {
    category,
    status: "needs_review",
    reviewAction: "staff_refund_chargeback_review_required",
    rawProviderPayloadRetained: false,
    invoiceBalanceMutation: "none",
    ledgerReversal: "none",
    trustPosting: "none",
    providerCommand: "none",
    clientNotification: "none",
  };
}

export function hostedPaymentRequestPath(requestId: string): string {
  return `/payments/requests/${requestId}`;
}

export function hasHostedPaymentRequestEvidence(
  request: Pick<HostedPaymentRequestRecord, "evidence">,
): boolean {
  return Boolean(request.evidence && Object.keys(request.evidence).length > 0);
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

export const billingExpenseCategoryCodePattern = /^[a-z0-9_]+$/;

export function normalizeExpenseCategoryCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "_");
}

export function validateBillingExpenseCategory(record: BillingExpenseCategoryRecord): void {
  if (!record.firmId.trim()) throw new Error("Billing expense category requires a firm id");
  if (!billingExpenseCategoryCodePattern.test(record.code)) {
    throw new Error(
      "Billing expense category code must use lowercase letters, numbers, and underscores",
    );
  }
  if (!record.label.trim()) throw new Error("Billing expense category label is required");
  if (!record.reimbursableAllowed && record.defaultReimbursable) {
    throw new Error("Default reimbursable cannot be true when reimbursable is not allowed");
  }
  if (Number.isNaN(Date.parse(record.createdAt))) {
    throw new Error("Billing expense category createdAt must be a valid timestamp");
  }
  if (Number.isNaN(Date.parse(record.updatedAt))) {
    throw new Error("Billing expense category updatedAt must be a valid timestamp");
  }
}

export function billingExpenseCategoryAppliesToMatter(
  category: Pick<BillingExpenseCategoryRecord, "matterId" | "practiceAreas" | "jurisdictions">,
  matter: Pick<Matter, "id" | "practiceArea" | "jurisdiction">,
): boolean {
  return (
    (!category.matterId || category.matterId === matter.id) &&
    (category.practiceAreas.length === 0 || category.practiceAreas.includes(matter.practiceArea)) &&
    (category.jurisdictions.length === 0 || category.jurisdictions.includes(matter.jurisdiction))
  );
}

export function billingExpenseCategoryAllowsReimbursable(
  category: Pick<BillingExpenseCategoryRecord, "reimbursableAllowed">,
  reimbursable: boolean,
): boolean {
  return !reimbursable || category.reimbursableAllowed;
}

export function billingExpenseCategoryProfileFromRecord(
  category: Pick<
    BillingExpenseCategoryRecord,
    "code" | "label" | "defaultReimbursable" | "reviewCue"
  >,
): ExpenseCategoryProfileCue {
  return {
    key: category.code,
    label: category.label,
    category: category.label,
    defaultReimbursable: category.defaultReimbursable,
    reviewCue: category.reviewCue ?? "Review expense support before billing approval.",
    reviewOnly: true,
  };
}

export function defaultBillingExpenseCategoriesForFirm(input: {
  firmId: string;
  createdByUserId?: string;
  now?: string;
}): BillingExpenseCategoryRecord[] {
  const now = input.now ?? new Date().toISOString();
  return expenseCategoryProfileCues.map((profile) => ({
    id: `${input.firmId}:expense-category:${profile.key}`,
    firmId: input.firmId,
    code: profile.key,
    label: profile.label,
    active: true,
    defaultReimbursable: profile.defaultReimbursable,
    reimbursableAllowed: true,
    practiceAreas: [],
    jurisdictions: [],
    reviewCue: profile.reviewCue,
    createdByUserId: input.createdByUserId,
    updatedByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  }));
}

export function billingDateFallsInsideLock(
  dateIso: string,
  lock: Pick<BillingPeriodLockRecord, "periodStart" | "periodEnd">,
): boolean {
  const value = Date.parse(dateIso);
  return value >= Date.parse(lock.periodStart) && value < Date.parse(lock.periodEnd);
}

export function expenseCategoryProfileForKey(key: string): ExpenseCategoryProfileCue | undefined {
  return expenseCategoryProfileCues.find((profile) => profile.key === key);
}

export function timerDraftMinutesFromWindow(input: {
  startedAt: string;
  stoppedAt: string;
  minimumMinutes?: number;
}): number {
  const startedAt = Date.parse(input.startedAt);
  const stoppedAt = Date.parse(input.stoppedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(stoppedAt)) {
    throw new Error("Timer draft timestamps must be valid");
  }
  if (stoppedAt <= startedAt) {
    throw new Error("Timer draft stop time must be after start time");
  }
  const minimumMinutes = input.minimumMinutes ?? 1;
  return Math.max(minimumMinutes, Math.ceil((stoppedAt - startedAt) / 60_000));
}

export function billingTimerWindowOverlapsLock(input: {
  startedAt: string;
  stoppedAt: string;
  locks: Array<Pick<BillingPeriodLockRecord, "periodStart" | "periodEnd">>;
}): Pick<BillingPeriodLockRecord, "periodStart" | "periodEnd"> | undefined {
  const startedAt = Date.parse(input.startedAt);
  const stoppedAt = Date.parse(input.stoppedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(stoppedAt)) {
    throw new Error("Timer draft timestamps must be valid");
  }
  if (stoppedAt <= startedAt) {
    throw new Error("Timer draft stop time must be after start time");
  }
  return input.locks.find(
    (lock) => startedAt < Date.parse(lock.periodEnd) && Date.parse(lock.periodStart) < stoppedAt,
  );
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
