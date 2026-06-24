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
  LedgerPostingRequestRecord,
  LedgerPostingRequestReviewSummary,
  LedgerReconciliationFreshnessReview,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
  PaymentImportReviewBoundary,
  PaymentPlanPlaceholder,
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
  };
  periodLocks: BillingPeriodLockRecord[];
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
