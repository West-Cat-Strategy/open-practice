import type {
  BillDeliveryState,
  BillingPeriodLockRecord,
  BillingRateRuleRecord,
  BillingRateSnapshot,
  BillingTimerDraftPolicy,
  BillReminderState,
  CreditWriteOffPosture,
  ExpenseCategoryProfileCue,
  HostedPaymentProcessorState,
  JurisdictionalTrustReport,
  LedgerAccount,
  LedgerAccountingReviewProfileRecord,
  LedgerAccountingReviewSummary,
  LedgerBankFeedReconciliationReviewSummary,
  LedgerEntry,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
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

export interface MatterBillingSummary {
  matterId: string;
  captureReviewTime: BillingTimeItem[];
  captureReviewExpenses: BillingExpenseItem[];
  unbilledTime: BillingTimeItem[];
  unbilledExpenses: BillingExpenseItem[];
  invoices: BillingInvoiceSummary[];
  payments: BillingPaymentSummary[];
  paymentRequests: BillingPaymentRequestSummary[];
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
  };
  periodLocks: BillingPeriodLockRecord[];
  rateRules: BillingRateRuleRecord[];
  timerDraftPolicy: BillingTimerDraftPolicy;
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
  reconciliations: LedgerReconciliationRecord[];
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
      trustTransferRequest: string;
      reconciliation: string;
    };
    compliancePosture: string;
  };
}

export type JurisdictionalTrustReportResponse = JurisdictionalTrustReport;
