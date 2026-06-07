import {
  validateLedgerAccountingReviewProfileRecord,
  validateLedgerReconciliationExceptionResolutionRecord,
  validateLedgerReconciliationRecord,
  validateLedgerStatementImportBatchRecord,
  validateLedgerStatementMatchRuleProfileRecord,
  type LedgerAccount,
  type LedgerAccountingReviewProfileRecord,
  type LedgerReconciliationExceptionResolutionRecord,
  type LedgerReconciliationRecord,
  type LedgerStatementImportBatchRecord,
  type LedgerStatementMatchRuleProfileRecord,
  type LedgerTransactionApprovalRecord,
  type PostedLedgerTransaction,
  type User,
} from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryLedgerReviewStore {
  users: User[];
  ledgerAccounts: LedgerAccount[];
  postedTransactions: PostedLedgerTransaction[];
  ledgerApprovals: LedgerTransactionApprovalRecord[];
  ledgerReconciliations: LedgerReconciliationRecord[];
  ledgerStatementImportBatches: LedgerStatementImportBatchRecord[];
  ledgerStatementMatchRuleProfiles: LedgerStatementMatchRuleProfileRecord[];
  ledgerAccountingReviewProfiles: LedgerAccountingReviewProfileRecord[];
  ledgerReconciliationExceptionResolutions: LedgerReconciliationExceptionResolutionRecord[];
}

export function createMemoryLedgerTransactionApproval(
  store: MemoryLedgerReviewStore,
  approval: LedgerTransactionApprovalRecord,
): LedgerTransactionApprovalRecord {
  const transaction = store.postedTransactions.find(
    (posted) => posted.firmId === approval.firmId && posted.id === approval.transactionId,
  );
  if (!transaction) {
    throw new Error(`Unknown ledger transaction ${approval.transactionId}`);
  }
  const duplicateReviewer = store.ledgerApprovals.find(
    (candidate) =>
      candidate.firmId === approval.firmId &&
      candidate.transactionId === approval.transactionId &&
      candidate.decidedByUserId === approval.decidedByUserId,
  );
  if (duplicateReviewer) {
    throw new Error("Ledger approval reviewer has already recorded a decision");
  }
  store.ledgerApprovals = [...store.ledgerApprovals, clone(approval)];
  return clone(approval);
}

export function listMemoryLedgerTransactionApprovals(
  store: MemoryLedgerReviewStore,
  firmId: string,
  options: { transactionId?: string } = {},
): LedgerTransactionApprovalRecord[] {
  return clone(
    store.ledgerApprovals.filter(
      (approval) =>
        approval.firmId === firmId &&
        (!options.transactionId || approval.transactionId === options.transactionId),
    ),
  );
}

export function createMemoryLedgerReconciliation(
  store: MemoryLedgerReviewStore,
  reconciliation: LedgerReconciliationRecord,
): LedgerReconciliationRecord {
  const account = store.ledgerAccounts.find(
    (candidate) =>
      candidate.firmId === reconciliation.firmId && candidate.id === reconciliation.accountId,
  );
  if (!account) {
    throw new Error(`Unknown ledger account ${reconciliation.accountId}`);
  }
  validateLedgerReconciliationRecord(reconciliation);
  store.ledgerReconciliations = [...store.ledgerReconciliations, clone(reconciliation)];
  return clone(reconciliation);
}

export function listMemoryLedgerReconciliations(
  store: MemoryLedgerReviewStore,
  firmId: string,
): LedgerReconciliationRecord[] {
  return clone(
    store.ledgerReconciliations.filter((reconciliation) => reconciliation.firmId === firmId),
  );
}

export function createMemoryLedgerStatementImportBatch(
  store: MemoryLedgerReviewStore,
  batch: LedgerStatementImportBatchRecord,
): LedgerStatementImportBatchRecord {
  const account = store.ledgerAccounts.find(
    (candidate) => candidate.firmId === batch.firmId && candidate.id === batch.accountId,
  );
  if (!account || account.type !== "trust_asset") {
    throw new Error("Statement import batches require an existing trust asset account");
  }
  const creator = store.users.find(
    (candidate) => candidate.firmId === batch.firmId && candidate.id === batch.createdByUserId,
  );
  if (!creator) {
    throw new Error(`Unknown user ${batch.createdByUserId}`);
  }
  validateLedgerStatementImportBatchRecord(batch);
  if (batch.matchingProfileId) {
    const matchingProfile = store.ledgerStatementMatchRuleProfiles.find(
      (profile) =>
        profile.firmId === batch.firmId &&
        profile.accountId === batch.accountId &&
        profile.id === batch.matchingProfileId,
    );
    if (!matchingProfile) {
      throw new Error(
        "Statement import batch matching profile must belong to the same trust asset account",
      );
    }
  }
  store.ledgerStatementImportBatches = [...store.ledgerStatementImportBatches, clone(batch)];
  return clone(batch);
}

export function listMemoryLedgerStatementImportBatches(
  store: MemoryLedgerReviewStore,
  firmId: string,
  options: { accountId?: string } = {},
): LedgerStatementImportBatchRecord[] {
  return clone(
    store.ledgerStatementImportBatches
      .filter(
        (batch) =>
          batch.firmId === firmId && (!options.accountId || batch.accountId === options.accountId),
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
  );
}

export function createMemoryLedgerStatementMatchRuleProfile(
  store: MemoryLedgerReviewStore,
  profile: LedgerStatementMatchRuleProfileRecord,
): LedgerStatementMatchRuleProfileRecord {
  const account = store.ledgerAccounts.find(
    (candidate) => candidate.firmId === profile.firmId && candidate.id === profile.accountId,
  );
  if (!account || account.type !== "trust_asset") {
    throw new Error("Statement match-rule profiles require an existing trust asset account");
  }
  const creator = store.users.find(
    (candidate) => candidate.firmId === profile.firmId && candidate.id === profile.createdByUserId,
  );
  if (!creator) {
    throw new Error(`Unknown user ${profile.createdByUserId}`);
  }
  validateLedgerStatementMatchRuleProfileRecord(profile);
  store.ledgerStatementMatchRuleProfiles = [
    ...store.ledgerStatementMatchRuleProfiles,
    clone(profile),
  ];
  return clone(profile);
}

export function listMemoryLedgerStatementMatchRuleProfiles(
  store: MemoryLedgerReviewStore,
  firmId: string,
  options: { accountId?: string } = {},
): LedgerStatementMatchRuleProfileRecord[] {
  return clone(
    store.ledgerStatementMatchRuleProfiles
      .filter(
        (profile) =>
          profile.firmId === firmId &&
          (!options.accountId || profile.accountId === options.accountId),
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
  );
}

export function createMemoryLedgerAccountingReviewProfile(
  store: MemoryLedgerReviewStore,
  profile: LedgerAccountingReviewProfileRecord,
): LedgerAccountingReviewProfileRecord {
  const account = store.ledgerAccounts.find(
    (candidate) => candidate.firmId === profile.firmId && candidate.id === profile.accountId,
  );
  if (!account) {
    throw new Error(`Unknown ledger account ${profile.accountId}`);
  }
  if (account.type !== profile.accountType) {
    throw new Error("Accounting review profile account type must match the ledger account");
  }
  const creator = store.users.find(
    (candidate) => candidate.firmId === profile.firmId && candidate.id === profile.createdByUserId,
  );
  if (!creator) {
    throw new Error(`Unknown user ${profile.createdByUserId}`);
  }
  validateLedgerAccountingReviewProfileRecord(profile);
  store.ledgerAccountingReviewProfiles = [...store.ledgerAccountingReviewProfiles, clone(profile)];
  return clone(profile);
}

export function listMemoryLedgerAccountingReviewProfiles(
  store: MemoryLedgerReviewStore,
  firmId: string,
  options: { accountId?: string } = {},
): LedgerAccountingReviewProfileRecord[] {
  return clone(
    store.ledgerAccountingReviewProfiles
      .filter(
        (profile) =>
          profile.firmId === firmId &&
          (!options.accountId || profile.accountId === options.accountId),
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
  );
}

export function createMemoryLedgerReconciliationExceptionResolution(
  store: MemoryLedgerReviewStore,
  resolution: LedgerReconciliationExceptionResolutionRecord,
): LedgerReconciliationExceptionResolutionRecord {
  const account = store.ledgerAccounts.find(
    (candidate) => candidate.firmId === resolution.firmId && candidate.id === resolution.accountId,
  );
  if (!account || account.type !== "trust_asset") {
    throw new Error("Reconciliation exception resolutions require an existing trust asset account");
  }
  const reviewer = store.users.find(
    (candidate) =>
      candidate.firmId === resolution.firmId && candidate.id === resolution.recordedByUserId,
  );
  if (!reviewer) {
    throw new Error(`Unknown user ${resolution.recordedByUserId}`);
  }
  validateLedgerReconciliationExceptionResolutionRecord(resolution);
  store.ledgerReconciliationExceptionResolutions = [
    ...store.ledgerReconciliationExceptionResolutions,
    clone(resolution),
  ];
  return clone(resolution);
}

export function listMemoryLedgerReconciliationExceptionResolutions(
  store: MemoryLedgerReviewStore,
  firmId: string,
  options: { accountId?: string } = {},
): LedgerReconciliationExceptionResolutionRecord[] {
  return clone(
    store.ledgerReconciliationExceptionResolutions
      .filter(
        (resolution) =>
          resolution.firmId === firmId &&
          (!options.accountId || resolution.accountId === options.accountId),
      )
      .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt)),
  );
}
