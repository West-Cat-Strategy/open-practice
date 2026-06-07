import type {
  LedgerAccountingReviewProfileRecord,
  LedgerReconciliationExceptionResolutionRecord,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
} from "@open-practice/domain";

export interface LedgerReviewRepository {
  createLedgerTransactionApproval(
    approval: LedgerTransactionApprovalRecord,
  ): Promise<LedgerTransactionApprovalRecord>;
  listLedgerTransactionApprovals(
    firmId: string,
    options?: { transactionId?: string },
  ): Promise<LedgerTransactionApprovalRecord[]>;
  createLedgerReconciliation(
    reconciliation: LedgerReconciliationRecord,
  ): Promise<LedgerReconciliationRecord>;
  listLedgerReconciliations(firmId: string): Promise<LedgerReconciliationRecord[]>;
  createLedgerStatementImportBatch(
    batch: LedgerStatementImportBatchRecord,
  ): Promise<LedgerStatementImportBatchRecord>;
  listLedgerStatementImportBatches(
    firmId: string,
    options?: { accountId?: string },
  ): Promise<LedgerStatementImportBatchRecord[]>;
  createLedgerStatementMatchRuleProfile(
    profile: LedgerStatementMatchRuleProfileRecord,
  ): Promise<LedgerStatementMatchRuleProfileRecord>;
  listLedgerStatementMatchRuleProfiles(
    firmId: string,
    options?: { accountId?: string },
  ): Promise<LedgerStatementMatchRuleProfileRecord[]>;
  createLedgerAccountingReviewProfile(
    profile: LedgerAccountingReviewProfileRecord,
  ): Promise<LedgerAccountingReviewProfileRecord>;
  listLedgerAccountingReviewProfiles(
    firmId: string,
    options?: { accountId?: string },
  ): Promise<LedgerAccountingReviewProfileRecord[]>;
  createLedgerReconciliationExceptionResolution(
    resolution: LedgerReconciliationExceptionResolutionRecord,
  ): Promise<LedgerReconciliationExceptionResolutionRecord>;
  listLedgerReconciliationExceptionResolutions(
    firmId: string,
    options?: { accountId?: string },
  ): Promise<LedgerReconciliationExceptionResolutionRecord[]>;
}
