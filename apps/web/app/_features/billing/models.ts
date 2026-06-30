import type { LedgerReconciliationPacketReview } from "@open-practice/domain";
import type {
  BillDeliveryState,
  BillingPeriodLockRecord,
  BillingRateRuleRecord,
  BillingRateSnapshot,
  BillingTimerDraftPolicy,
  BillReminderState,
  BillingExpenseCategoryRecord,
  CreditWriteOffPosture,
  ExpenseCategoryProfileCue,
  FinancialCommandJournal,
  HostedPaymentProcessorState,
  JurisdictionalTrustReport,
  LedgerAccount,
  LedgerAccountingReviewProfileRecord,
  LedgerAccountingReviewSummary,
  LedgerBalanceSnapshotComparison,
  LedgerBankFeedReconciliationReviewSummary,
  LedgerEntry,
  LedgerMakerCheckerReadiness,
  LedgerPostingRequestRecord,
  LedgerPostingRequestReviewSummary,
  LedgerReconciliationFreshnessReview,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
  PaymentImportRefundChargebackResolutionPacketPreview,
  PaymentImportReviewBoundary,
  PaymentPlanPlaceholder,
  StaffReportProjection,
} from "../../types";

export type BillingEntryStatus = "draft" | "submitted" | "approved" | "billed" | "written_off";

export interface BillingTimeItem {
  id: string;
  matterId: string;
  userId?: string;
  performedAt?: string;
  minutes: number;
  rateCents: number;
  rateRuleId?: string;
  rateSnapshot?: BillingRateSnapshot;
  amountCents: number;
  narrative: string;
  billable?: boolean;
  status: BillingEntryStatus;
}

export interface BillingExpenseItem {
  id: string;
  matterId: string;
  incurredAt?: string;
  amountCents: number;
  category: string;
  categoryCode?: string;
  categoryProfileKey?: string;
  description: string;
  status: BillingEntryStatus;
}

export interface BillingInvoiceSummary {
  id: string;
  matterId: string;
  number: string;
  status: "draft" | "approved" | "issued" | "partially_paid" | "paid" | "void";
  totalCents: number;
  balanceDueCents: number;
  issuedAt?: string;
  dueAt?: string;
}

export interface BillingPaymentSummary {
  id: string;
  matterId: string;
  invoiceId?: string;
  amountCents: number;
  method: "cash" | "card" | "eft" | "cheque" | "other";
  status: "pending_reconciliation" | "received" | "void";
  receivedAt: string;
  reconciledAt?: string;
  reference?: string;
  evidencePresent?: boolean;
  reconciliationEvidencePresent?: boolean;
}

export interface BillingPaymentRequestSummary {
  id: string;
  matterId: string;
  invoiceId: string;
  clientContactId?: string;
  status: "ready_to_send" | "sent" | "viewed" | "cancelled" | "expired";
  amountCents: number;
  hostedPath: string;
  delivery: BillDeliveryState;
  reminder: BillReminderState;
  paymentPlan: PaymentPlanPlaceholder;
  creditWriteOffPosture: CreditWriteOffPosture;
  processor: HostedPaymentProcessorState;
  evidencePresent: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

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

export interface BillingPaymentImportDepositMatchReviewSummary {
  id: string;
  decision: "candidate_supported" | "candidate_rejected" | "needs_more_evidence";
  reason:
    | "candidate_evidence_matches"
    | "amount_mismatch"
    | "status_conflict"
    | "duplicate_or_conflict"
    | "manual_payment_not_pending"
    | "invoice_candidate_mismatch"
    | "missing_reviewer_evidence";
  candidateManualPaymentId: string;
  candidateInvoiceId?: string;
  importAmountCents: number;
  manualPaymentAmountCents: number;
  currency: "CAD";
  candidateManualPaymentStatus: "pending_reconciliation" | "received" | "void";
  reviewerEvidencePresent: true;
  reviewedAt: string;
  boundaries: PaymentImportDepositMatchReviewBoundary;
}

export type BillingPaymentImportDepositMatchReconciliationReadinessReason =
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

export type BillingPaymentImportDepositMatchReconciliationReadinessDetailCode =
  | "latest_supported_decision"
  | "no_duplicate_or_conflict_cue"
  | "manual_payment_candidate_matches"
  | "manual_payment_found"
  | "manual_payment_pending"
  | "amounts_match"
  | "invoice_found"
  | "invoice_candidate_matches"
  | "invoice_balance_covers_payment";

export interface BillingPaymentImportDepositMatchReconciliationReadinessDetail {
  code: BillingPaymentImportDepositMatchReconciliationReadinessDetailCode;
  status: "satisfied" | "blocked";
  label: string;
}

export interface BillingPaymentImportDepositMatchReconciliationReadiness {
  eligible: boolean;
  reason: BillingPaymentImportDepositMatchReconciliationReadinessReason;
  reasonDetails: BillingPaymentImportDepositMatchReconciliationReadinessDetail[];
  reviewAction: "manual_payment_reconcile_review";
  candidateManualPaymentId?: string;
  candidateInvoiceId?: string;
  amountCents?: number;
  mutation: "none";
}

export interface BillingPaymentImportRefundChargebackReviewCue {
  category: "refund" | "chargeback";
  status: "needs_review";
  reviewAction: "staff_refund_chargeback_review_required";
  rawProviderPayloadRetained: false;
  invoiceBalanceMutation: "none";
  ledgerReversal: "none";
  trustPosting: "none";
  providerCommand: "none";
  clientNotification: "none";
}

export interface PaymentImportRefundChargebackReviewBoundary {
  rawProviderPayloadRetained: false;
  refundArtifactRetained: false;
  disputeArtifactRetained: false;
  invoiceBalanceMutation: "none";
  ledgerReversal: "none";
  trustPosting: "none";
  providerCommand: "none";
  clientNotification: "none";
  fundsMovement: "none";
  refundHandling: "review_decision_only";
  chargebackHandling: "review_decision_only";
}

export interface BillingPaymentImportRefundChargebackReviewSummary {
  id: string;
  category: "refund" | "chargeback";
  decision: "exception_confirmed" | "exception_rejected" | "needs_more_evidence";
  reason:
    | "refund_observed"
    | "chargeback_observed"
    | "duplicate_or_conflict"
    | "candidate_reference_mismatch"
    | "missing_reviewer_evidence"
    | "status_unclear";
  reviewerEvidencePresent: true;
  reviewedAt: string;
  boundaries: PaymentImportRefundChargebackReviewBoundary;
}

export interface BillingPaymentImportReviewSummary {
  id: string;
  matterId: string;
  providerLabel: string;
  eventFamily: "payment" | "deposit";
  eventStatus: string;
  externalEventId: string;
  externalPaymentIdPresent?: boolean;
  externalDepositIdPresent?: boolean;
  amountCents: number;
  currency: "CAD";
  observedAt?: string;
  importedAt: string;
  candidateInvoiceId?: string;
  candidateHostedPaymentRequestId?: string;
  candidateManualPaymentId?: string;
  duplicateCuePresent?: boolean;
  conflictReason?: "duplicate" | "candidate_mismatch" | "amount_mismatch" | "status_conflict";
  reviewState: "needs_review";
  boundaries: PaymentImportReviewBoundary;
  refundChargebackReviewCue?: BillingPaymentImportRefundChargebackReviewCue;
  refundChargebackResolutionPacketPreview?: PaymentImportRefundChargebackResolutionPacketPreview;
  refundChargebackReviewDecisionCount?: number;
  latestRefundChargebackReview?: BillingPaymentImportRefundChargebackReviewSummary;
  depositMatchReviewCount?: number;
  latestDepositMatchReview?: BillingPaymentImportDepositMatchReviewSummary;
  reconciliationReadiness?: BillingPaymentImportDepositMatchReconciliationReadiness;
}

export interface MatterBillingSummary {
  matterId: string;
  captureReviewTime: BillingTimeItem[];
  captureReviewExpenses: BillingExpenseItem[];
  unbilledTime: BillingTimeItem[];
  unbilledExpenses: BillingExpenseItem[];
  invoices: BillingInvoiceSummary[];
  payments: BillingPaymentSummary[];
  paymentRequests: BillingPaymentRequestSummary[];
  paymentImportReviewRecords?: BillingPaymentImportReviewSummary[];
}

export interface BillingDashboardResponse {
  canView: boolean;
  summary: {
    unbilledTimeCents: number;
    unbilledExpenseCents: number;
    draftInvoiceCents: number;
    issuedBalanceDueCents: number;
    hostedPaymentRequestCents: number;
    lockedPeriodCount: number;
    activeLockedPeriodCount: number;
    activeRateRuleCount: number;
    paymentImportReviewCount?: number;
    paymentImportConflictCount?: number;
    depositMatchReviewCount?: number;
    depositMatchDecisionCount?: number;
    depositMatchReconciliationReadyCount?: number;
    refundReviewCueCount?: number;
    chargebackReviewCueCount?: number;
    refundChargebackReviewCueCount?: number;
    refundChargebackReviewDecisionCount?: number;
  };
  periodLocks: BillingPeriodLockRecord[];
  billingPeriodLockImpact: StaffReportProjection;
  rateRules: BillingRateRuleRecord[];
  timerDraftPolicy: BillingTimerDraftPolicy;
  expenseCategories: BillingExpenseCategoryRecord[];
  expenseCategoryProfiles: readonly ExpenseCategoryProfileCue[];
  matters: MatterBillingSummary[];
}

export interface TrustControlsDashboardResponse {
  ledger: {
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  };
  approvals: LedgerTransactionApprovalRecord[];
  postingRequests: LedgerPostingRequestRecord[];
  postingRequestSummary: LedgerPostingRequestReviewSummary;
  reconciliations: LedgerReconciliationRecord[];
  balanceSnapshotComparison: LedgerBalanceSnapshotComparison;
  reconciliationFreshness?: LedgerReconciliationFreshnessReview;
  reconciliationPacketReview?: LedgerReconciliationPacketReview;
  makerCheckerReadiness: LedgerMakerCheckerReadiness;
  accountingReview: {
    importBatches: LedgerStatementImportBatchRecord[];
    matchRuleProfiles: LedgerStatementMatchRuleProfileRecord[];
    accountingProfiles: LedgerAccountingReviewProfileRecord[];
    summary: LedgerAccountingReviewSummary;
    bankFeedReviewSummary: LedgerBankFeedReconciliationReviewSummary;
  };
  diagnostics: {
    pendingApprovalTransactionIds: string[];
    rejectedApprovalTransactionIds: string[];
    unreconciledAccountIds: string[];
    exceptionReconciliationIds: string[];
    overdrawnBalanceKeys: string[];
  };
  trustControlPolicy?: {
    automaticTrustPosting: false;
    transferRequestPosting: string;
    makerChecker: {
      ledgerTransactionApproval: string;
      ledgerPostingRequest?: string;
      trustTransferRequest: string;
      reconciliation: string;
    };
    compliancePosture: string;
  };
  financialCommandJournal: FinancialCommandJournal;
}

export type JurisdictionalTrustReportResponse = JurisdictionalTrustReport;
