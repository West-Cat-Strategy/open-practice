import type { PaymentImportReviewRecord, TrustTransferRequestRecord } from "./billing.js";
import type { LegalClinicMatterProfile } from "./legal-clinics.js";
import type { Matter, Province } from "./models.js";

export type LedgerAccountType =
  | "trust_asset"
  | "client_liability"
  | "operating_revenue"
  | "expense";

export interface LedgerAccount {
  id: string;
  firmId: string;
  name: string;
  type: LedgerAccountType;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  firmId: string;
  matterId: string;
  clientId: string;
  accountId: string;
  debitCents: number;
  creditCents: number;
  memo: string;
  postedAt: string;
  reversingTransactionId?: string;
}

export interface LedgerTransaction {
  id: string;
  firmId: string;
  idempotencyKey: string;
  requestFingerprint?: string;
  postedByUserId: string;
  postedAt: string;
  entries: Omit<LedgerEntry, "id" | "transactionId" | "postedAt">[];
  reversesTransactionId?: string;
}

export interface PostedLedgerTransaction {
  id: string;
  firmId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  entries: LedgerEntry[];
  reversesTransactionId?: string;
}

export const ledgerPostingRequestStatuses = ["pending_approval", "posted", "rejected"] as const;

export type LedgerPostingRequestStatus = (typeof ledgerPostingRequestStatuses)[number];

export interface LedgerPostingRequestRecord {
  id: string;
  firmId: string;
  transactionId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: LedgerPostingRequestStatus;
  proposedPostedAt: string;
  entries: Omit<LedgerEntry, "id" | "transactionId" | "postedAt">[];
  matterIds: string[];
  clientIds: string[];
  accountIds: string[];
  reversesTransactionId?: string;
  preparedByUserId: string;
  preparedAt: string;
  preparationNotes?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  ledgerTransactionId?: string;
}

export interface LedgerPostingRequestReviewSummary {
  pendingApprovalCount: number;
  postedCount: number;
  rejectedCount: number;
  totalCount: number;
}

export type LedgerApprovalDecision = "approved" | "rejected";

export interface LedgerTransactionApprovalRecord {
  id: string;
  firmId: string;
  transactionId: string;
  decidedByUserId: string;
  decision: LedgerApprovalDecision;
  decidedAt: string;
  notes?: string;
}

export type LedgerReconciliationStatus = "draft" | "matched" | "exception" | "reviewed";

export type LedgerStatementRowReviewDecision = "matched" | "unmatched";

export const ledgerReconciliationExceptionVarianceDecisions = [
  "ledger_entry_expected",
  "statement_duplicate",
  "statement_source_issue",
  "operational_variance_acknowledged",
  "needs_follow_up",
] as const;

export type LedgerReconciliationExceptionVarianceDecision =
  (typeof ledgerReconciliationExceptionVarianceDecisions)[number];

export interface LedgerReconciliationStatementRow {
  id: string;
  postedAt: string;
  description: string;
  amountCents: number;
  reference?: string;
  matchedLedgerEntryIds: string[];
  reviewDecision: LedgerStatementRowReviewDecision;
  reviewedByUserId?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface LedgerReconciliationRecord {
  id: string;
  firmId: string;
  accountId: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  beginningBalanceCents: number;
  endingBalanceCents: number;
  expectedBalanceCents: number;
  actualBalanceCents: number;
  status: LedgerReconciliationStatus;
  reviewedByUserId?: string;
  statementRows: LedgerReconciliationStatementRow[];
  varianceExplanation?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface LedgerReconciliationExceptionResolutionStatementRow {
  id: string;
  postedAt: string;
  description: string;
  amountCents: number;
  reference?: string;
  duplicateKey: string;
  duplicateOfRowId?: string;
  reviewDecision: "unmatched";
}

export interface LedgerReconciliationExceptionResolutionStatementRowInput extends LedgerStatementImportPreviewRowInput {
  duplicateOfRowId?: string;
  reviewDecision: LedgerStatementRowReviewDecision;
}

export interface LedgerReconciliationExceptionResolutionRecord {
  id: string;
  firmId: string;
  accountId: string;
  statementRow: LedgerReconciliationExceptionResolutionStatementRow;
  varianceDecision: LedgerReconciliationExceptionVarianceDecision;
  resolutionNote: string;
  recordedByUserId: string;
  recordedAt: string;
}

export interface LedgerReconciliationReviewSummary {
  importedStatementRowCount: number;
  matchedStatementRowCount: number;
  unmatchedStatementRowCount: number;
  varianceCents: number;
}

export interface LedgerStatementImportPreviewRowInput {
  id: string;
  postedAt: string;
  description: string;
  amountCents: number;
  reference?: string;
}

export interface LedgerStatementImportPreviewMatch {
  ledgerEntryId: string;
  transactionId: string;
  postedAt: string;
  amountCents: number;
  memo: string;
  confidence: "exact" | "amount_and_description" | "amount_only";
  reasons: string[];
}

export interface LedgerStatementImportPreviewRow {
  id: string;
  postedAt: string;
  description: string;
  amountCents: number;
  reference?: string;
  duplicateKey: string;
  duplicateOfRowId?: string;
  reviewDecision: LedgerStatementRowReviewDecision;
  proposedMatches: LedgerStatementImportPreviewMatch[];
}

export interface LedgerStatementImportPreview {
  accountId: string;
  importedStatementRowCount: number;
  uniqueStatementRowCount: number;
  duplicateStatementRowCount: number;
  proposedMatchedStatementRowCount: number;
  rows: LedgerStatementImportPreviewRow[];
  postingPolicy: "review_only_no_automatic_ledger_posting";
}

export const ledgerStatementImportBatchStatuses = [
  "previewed",
  "review_ready",
  "discarded",
] as const;

export type LedgerStatementImportBatchStatus = (typeof ledgerStatementImportBatchStatuses)[number];

export interface LedgerStatementImportBatchRecord {
  id: string;
  firmId: string;
  accountId: string;
  sourceLabel: string;
  checksumSha256: string;
  importedStatementRowCount: number;
  duplicateStatementRowCount: number;
  status: LedgerStatementImportBatchStatus;
  matchingProfileId?: string;
  createdByUserId: string;
  createdAt: string;
}

export const ledgerStatementMatchReferenceStrategies = [
  "strict_reference",
  "normalized_reference",
  "date_amount_reference",
  "amount_only_review",
] as const;

export type LedgerStatementMatchReferenceStrategy =
  (typeof ledgerStatementMatchReferenceStrategies)[number];

export const ledgerStatementMatchDescriptionStrategies = [
  "exact",
  "normalized_contains",
  "review_required",
] as const;

export type LedgerStatementMatchDescriptionStrategy =
  (typeof ledgerStatementMatchDescriptionStrategies)[number];

export interface LedgerStatementMatchRuleProfileRecord {
  id: string;
  firmId: string;
  accountId: string;
  name: string;
  referenceStrategy: LedgerStatementMatchReferenceStrategy;
  descriptionStrategy: LedgerStatementMatchDescriptionStrategy;
  dateWindowDays: number;
  amountToleranceCents: number;
  varianceCategories: LedgerReconciliationExceptionVarianceDecision[];
  reviewerExplanationRequired: boolean;
  reviewOnly: true;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export const ledgerAccountingProtectedFundsReviewCadences = [
  "monthly",
  "quarterly",
  "manual_review",
] as const;

export type LedgerAccountingProtectedFundsReviewCadence =
  (typeof ledgerAccountingProtectedFundsReviewCadences)[number];

export const ledgerAccountingBankFeedImportStatuses = [
  "not_configured",
  "metadata_only",
  "review_ready",
] as const;

export type LedgerAccountingBankFeedImportStatus =
  (typeof ledgerAccountingBankFeedImportStatuses)[number];

export const ledgerAccountingDimensionPostures = [
  "not_applicable",
  "optional",
  "required",
] as const;

export type LedgerAccountingDimensionPosture = (typeof ledgerAccountingDimensionPostures)[number];

export type LedgerAccountingBoundaryPosture =
  | "trust_only"
  | "operating_only"
  | "expense_only"
  | "review_required";

export interface LedgerAccountingReviewProfileRecord {
  id: string;
  firmId: string;
  accountId: string;
  accountType: LedgerAccountType;
  boundaryPosture: LedgerAccountingBoundaryPosture;
  protectedFunds: {
    protected: boolean;
    reason?: string;
    reviewCadence: LedgerAccountingProtectedFundsReviewCadence;
  };
  bankFeedImport: {
    status: LedgerAccountingBankFeedImportStatus;
    sourceLabel?: string;
    lastImportedAt?: string;
    automaticMatching: false;
  };
  dimensions: {
    vendorTracking: LedgerAccountingDimensionPosture;
    expenseCategoryTracking: LedgerAccountingDimensionPosture;
    clientMatterTracking: "required";
    notes?: string;
  };
  reviewOnly: true;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientTrustBalanceDelta {
  firmId: string;
  matterId: string;
  clientId: string;
  deltaCents: number;
}

export interface LedgerPostingState {
  postedTransactions: PostedLedgerTransaction[];
  accounts: LedgerAccount[];
}

export interface LedgerControlsLedgerSnapshot {
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
  trustBalances: Record<string, number>;
}

export interface LedgerControlsDiagnostics {
  pendingApprovalTransactionIds: string[];
  rejectedApprovalTransactionIds: string[];
  unreconciledAccountIds: string[];
  exceptionReconciliationIds: string[];
  overdrawnBalanceKeys: string[];
}

export interface LedgerAccountingReviewSummary {
  matchRuleProfileCount: number;
  accountingProfileCount: number;
  protectedAccountCount: number;
  bankFeedShellCount: number;
  reviewOnly: true;
}

export interface LedgerBankFeedReconciliationReviewSummary {
  bankFeedShellCount: number;
  metadataOnlyFeedCount: number;
  reviewReadyFeedCount: number;
  importBatchCount: number;
  previewedImportBatchCount: number;
  reviewReadyImportBatchCount: number;
  discardedImportBatchCount: number;
  importedStatementRowCount: number;
  duplicateStatementRowCount: number;
  completedReconciliationCount: number;
  exceptionReconciliationCount: number;
  accountsPendingReconciliationCount: number;
  protectedFundsFeedCount: number;
  automaticMatching: false;
  automaticLedgerPosting: false;
  automaticReconciliation: false;
  liveBankFeedConnection: false;
  trustDisbursementAutomation: false;
  importBatchStoragePosture: "metadata_only_no_statement_rows";
  reviewOnly: true;
}

export type LedgerReconciliationPacketKind =
  | "ledger"
  | "statement_import"
  | "exception"
  | "trust_transfer"
  | "posting_request"
  | "payment_import";

export interface LedgerReconciliationPacketSummary {
  kind: LedgerReconciliationPacketKind;
  label: string;
  evidenceCount: number;
  reviewCueCount: number;
  pendingCount: number;
  exceptionCount: number;
  conflictCount: number;
  amountCents: number;
  latestEvidenceAt?: string;
  posture: "clear" | "needs_review";
  reviewOnly: true;
}

export interface LedgerReconciliationPacketReview {
  generatedAt: string;
  reviewOnly: true;
  packets: LedgerReconciliationPacketSummary[];
  summary: {
    packetCount: number;
    evidenceCount: number;
    reviewCueCount: number;
    packetsNeedingReviewCount: number;
    latestEvidenceAt?: string;
    reviewOnly: true;
  };
  policy: {
    source: "existing_ledger_billing_review_records";
    rawEvidencePayloads: "excluded";
    automaticReconciliation: false;
    automaticTrustPosting: false;
    invoiceMutation: "explicit_command_only";
    liveSettlement: false;
    providerCommands: false;
    publicExposure: false;
  };
}

export type LedgerMakerCheckerReadinessReason =
  | "pending_ledger_transaction_approval"
  | "rejected_ledger_transaction_approval"
  | "overdrawn_trust_balance"
  | "statement_import_review_ready"
  | "statement_import_duplicate_rows"
  | "reconciliation_exception"
  | "unmatched_statement_rows"
  | "pending_posting_request"
  | "rejected_posting_request"
  | "pending_trust_transfer_request"
  | "approved_unlinked_trust_transfer_request"
  | "rejected_trust_transfer_request"
  | "payment_import_review_required"
  | "payment_import_conflict";

export interface LedgerMakerCheckerReadinessCategoryRow {
  category: LedgerReconciliationPacketKind;
  label: string;
  evidenceCount: number;
  reviewCueCount: number;
  pendingCount: number;
  exceptionCount: number;
  conflictCount: number;
  amountCents: number;
  readiness: "policy_required_if_enabled" | "clear";
  reasonCodes: LedgerMakerCheckerReadinessReason[];
  reviewOnly: true;
}

export interface LedgerMakerCheckerReadinessMatterRow {
  matterId: string;
  categoryKeys: LedgerReconciliationPacketKind[];
  reasonCodes: LedgerMakerCheckerReadinessReason[];
  reviewCueCount: number;
  pendingCount: number;
  exceptionCount: number;
  amountCents: number;
  latestEvidenceAt?: string;
  reviewOnly: true;
}

export interface LedgerMakerCheckerReadiness {
  generatedAt: string;
  reviewOnly: true;
  categories: LedgerMakerCheckerReadinessCategoryRow[];
  matters: LedgerMakerCheckerReadinessMatterRow[];
  summary: {
    categoryCount: number;
    categoriesRequiringPolicyCount: number;
    matterCount: number;
    mattersRequiringPolicyCount: number;
    reviewCueCount: number;
    pendingCount: number;
    exceptionCount: number;
    amountCents: number;
    reviewOnly: true;
  };
  policy: {
    source: "existing_trust_controls_projection";
    makerCheckerPolicyEnabled: false;
    directPostingSemantics: "unchanged";
    approvalMutation: false;
    automaticTrustPosting: false;
    settlementAutomation: false;
    bankFeedMatching: false;
    jurisdictionCertifiedAccounting: false;
  };
}

export type LedgerBalanceSnapshotReviewReason =
  | "no_trust_balances"
  | "overdrawn_trust_balance"
  | "no_posted_transaction"
  | "no_reconciliation_preview_metadata"
  | "no_reconciliation_snapshot"
  | "posting_newer_than_preview"
  | "posting_newer_than_reconciliation"
  | "reconciliation_variance"
  | "unmatched_statement_rows";

export interface LedgerBalanceSnapshotComparison {
  generatedAt: string;
  reviewOnly: true;
  currentTrustBalance: {
    totalCents: number;
    balanceCount: number;
    overdrawnBalanceCount: number;
  };
  latestPostedTransaction?: {
    transactionId: string;
    postedAt: string;
    entryCount: number;
    matterCount: number;
    clientCount: number;
    accountCount: number;
    trustAssetDeltaCents: number;
    clientLiabilityDeltaCents: number;
    reversal: boolean;
  };
  latestReconciliationPreview?: {
    importBatchId: string;
    accountId: string;
    accountName: string;
    status: LedgerStatementImportBatchStatus;
    createdAt: string;
    importedStatementRowCount: number;
    duplicateStatementRowCount: number;
    matchingProfilePresent: boolean;
    sourceLabelPresent: boolean;
    storagePosture: "metadata_only_no_statement_rows";
  };
  latestReconciliationSnapshot?: {
    reconciliationId: string;
    accountId: string;
    accountName: string;
    status: LedgerReconciliationStatus;
    statementPeriodEnd: string;
    expectedBalanceCents: number;
    actualBalanceCents: number;
    varianceCents: number;
    unmatchedStatementRowCount: number;
  };
  reviewReasons: LedgerBalanceSnapshotReviewReason[];
  policy: {
    source: "ledger_snapshot_and_reconciliation_metadata";
    previewStoragePosture: "latest_import_batch_metadata_only_no_statement_rows";
    automaticMatching: false;
    automaticLedgerPosting: false;
    automaticReconciliation: false;
    settlementAutomation: false;
    liveBankFeedConnection: false;
    jurisdictionCertifiedAccounting: false;
  };
}

export const ledgerReconciliationFreshnessPostures = [
  "fresh",
  "watch",
  "stale",
  "never_reconciled",
] as const;

export type LedgerReconciliationFreshnessPosture =
  (typeof ledgerReconciliationFreshnessPostures)[number];

export interface LedgerReconciliationFreshnessRow {
  accountId: string;
  accountName: string;
  posture: LedgerReconciliationFreshnessPosture;
  daysSinceLatestReviewedStatementPeriod?: number;
  staleDayCount: number;
  latestReconciliationId?: string;
  latestReconciliationStatus?: LedgerReconciliationStatus;
  latestReviewedStatementPeriodStart?: string;
  latestReviewedStatementPeriodEnd?: string;
  exceptionCount: number;
  importedStatementRowCount: number;
  matchedStatementRowCount: number;
  unmatchedStatementRowCount: number;
  reviewOnly: true;
}

export interface LedgerReconciliationFreshnessSummary {
  accountCount: number;
  freshCount: number;
  watchCount: number;
  staleCount: number;
  neverReconciledCount: number;
  totalStaleDayCount: number;
  maxStaleDayCount: number;
  latestReviewedStatementPeriodEnd?: string;
  exceptionCount: number;
  unmatchedStatementRowCount: number;
  reviewOnly: true;
}

export interface LedgerReconciliationFreshnessReview {
  generatedAt: string;
  freshWithinDays: number;
  watchWithinDays: number;
  rows: LedgerReconciliationFreshnessRow[];
  summary: LedgerReconciliationFreshnessSummary;
  reviewOnly: true;
}

export type LedgerReportDimensionGroupKey =
  | "jurisdiction"
  | "practiceArea"
  | "clinicProgramId"
  | "restrictedFundReviewStatus";

export interface LedgerReportDimensionFilters {
  jurisdiction?: Province;
  practiceArea?: string;
  clinicProgramId?: string;
  restrictedFundReviewStatus?: string;
}

export interface LedgerReportDimensions {
  jurisdiction: Province | "multiple";
  practiceArea: string;
  clinicProgramId: string;
  restrictedFundReviewStatus: string;
}

export interface JurisdictionalTrustReportSummary {
  jurisdiction: Province;
  groupBy: LedgerReportDimensionGroupKey;
  dimensionKey: string;
  dimensionLabel: string;
  dimensions: LedgerReportDimensions;
  practiceArea: string;
  clinicProgramId: string;
  restrictedFundReviewStatus: string;
  matterCount: number;
  trustBalanceCents: number;
  pendingApprovalCount: number;
  rejectedApprovalCount: number;
  exceptionReconciliationCount: number;
  importedStatementRowCount: number;
  matchedStatementRowCount: number;
  unmatchedStatementRowCount: number;
  totalVarianceCents: number;
  unreconciledAccountCount: number;
  overdrawnBalanceCount: number;
  compliancePosture: "operational_controls_only_not_jurisdiction_certified";
}

export interface JurisdictionalTrustReport {
  groupBy: LedgerReportDimensionGroupKey;
  filters: LedgerReportDimensionFilters;
  dimensionOptions: {
    jurisdictions: Province[];
    practiceAreas: string[];
    clinicProgramIds: string[];
    restrictedFundReviewStatuses: string[];
  };
  summaries: JurisdictionalTrustReportSummary[];
  compliancePosture: "operational_controls_only_not_jurisdiction_certified";
}

function netLiabilityBalance(
  entries: LedgerEntry[],
  matterId: string,
  clientId: string,
  liabilityAccountIds: Set<string>,
): number {
  return entries
    .filter(
      (entry) =>
        entry.matterId === matterId &&
        entry.clientId === clientId &&
        liabilityAccountIds.has(entry.accountId),
    )
    .reduce((balance, entry) => balance + entry.creditCents - entry.debitCents, 0);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
    .join(",")}}`;
}

export function ledgerRequestFingerprint(transaction: LedgerTransaction): string {
  return canonicalize({
    firmId: transaction.firmId,
    entries: transaction.entries.map((entry) => ({
      firmId: entry.firmId,
      matterId: entry.matterId,
      clientId: entry.clientId,
      accountId: entry.accountId,
      debitCents: entry.debitCents,
      creditCents: entry.creditCents,
      memo: entry.memo,
      reversingTransactionId: entry.reversingTransactionId,
    })),
    reversesTransactionId: transaction.reversesTransactionId,
  });
}

export function validateBalancedEntries(
  entries: Array<{ debitCents: number; creditCents: number }>,
): void {
  const debit = entries.reduce((sum, entry) => sum + entry.debitCents, 0);
  const credit = entries.reduce((sum, entry) => sum + entry.creditCents, 0);

  if (debit <= 0 || credit <= 0 || debit !== credit) {
    throw new Error("Ledger transaction must contain balanced non-zero debits and credits");
  }

  for (const entry of entries) {
    if (entry.debitCents < 0 || entry.creditCents < 0) {
      throw new Error("Ledger entries cannot contain negative amounts");
    }
    if (entry.debitCents > 0 && entry.creditCents > 0) {
      throw new Error("A ledger entry cannot be both debit and credit");
    }
  }
}

export function postLedgerTransaction(
  state: LedgerPostingState,
  transaction: LedgerTransaction,
): PostedLedgerTransaction {
  const duplicate = state.postedTransactions.find(
    (posted) =>
      posted.firmId === transaction.firmId && posted.idempotencyKey === transaction.idempotencyKey,
  );
  const requestFingerprint =
    transaction.requestFingerprint ?? ledgerRequestFingerprint(transaction);
  if (duplicate) {
    if (duplicate.requestFingerprint !== requestFingerprint) {
      throw new Error("Idempotency key was reused with a different ledger payload");
    }
    return duplicate;
  }

  validateBalancedEntries(transaction.entries);
  if (transaction.reversesTransactionId) {
    validateReversal(state.postedTransactions, transaction);
  }

  const existingEntries = state.postedTransactions.flatMap((posted) => posted.entries);
  const liabilityAccountIds = new Set(
    state.accounts
      .filter((account) => account.type === "client_liability")
      .map((account) => account.id),
  );
  const nextEntries = transaction.entries.map((entry, index) => ({
    ...entry,
    id: `${transaction.id}:${index + 1}`,
    transactionId: transaction.id,
    postedAt: transaction.postedAt,
  }));

  for (const entry of nextEntries) {
    const account = state.accounts.find((candidate) => candidate.id === entry.accountId);
    if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);

    if (account.type === "client_liability") {
      const nextBalance =
        netLiabilityBalance(existingEntries, entry.matterId, entry.clientId, liabilityAccountIds) +
        netLiabilityBalance(nextEntries, entry.matterId, entry.clientId, liabilityAccountIds);
      if (nextBalance < 0) {
        throw new Error("Trust transaction would overdraw the client matter balance");
      }
    }
  }

  return {
    id: transaction.id,
    firmId: transaction.firmId,
    idempotencyKey: transaction.idempotencyKey,
    requestFingerprint,
    entries: nextEntries,
    reversesTransactionId: transaction.reversesTransactionId,
  };
}

export function ledgerPostingRequestFromTransaction(input: {
  id: string;
  preparedByUserId: string;
  preparedAt: string;
  transaction: LedgerTransaction;
  status?: LedgerPostingRequestStatus;
  reviewedByUserId?: string;
  reviewedAt?: string;
  preparationNotes?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  ledgerTransactionId?: string;
}): LedgerPostingRequestRecord {
  const requestFingerprint =
    input.transaction.requestFingerprint ?? ledgerRequestFingerprint(input.transaction);
  const record: LedgerPostingRequestRecord = {
    id: input.id,
    firmId: input.transaction.firmId,
    transactionId: input.transaction.id,
    idempotencyKey: input.transaction.idempotencyKey,
    requestFingerprint,
    status: input.status ?? "pending_approval",
    proposedPostedAt: input.transaction.postedAt,
    entries: input.transaction.entries,
    matterIds: uniqueInOrder(input.transaction.entries.map((entry) => entry.matterId)),
    clientIds: uniqueInOrder(input.transaction.entries.map((entry) => entry.clientId)),
    accountIds: uniqueInOrder(input.transaction.entries.map((entry) => entry.accountId)),
    reversesTransactionId: input.transaction.reversesTransactionId,
    preparedByUserId: input.preparedByUserId,
    preparedAt: input.preparedAt,
    preparationNotes: input.preparationNotes,
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: input.reviewedAt,
    reviewNotes: input.reviewNotes,
    rejectionReason: input.rejectionReason,
    ledgerTransactionId: input.ledgerTransactionId,
  };
  validateLedgerPostingRequestRecord(record);
  return record;
}

export function ledgerTransactionFromPostingRequest(
  request: LedgerPostingRequestRecord,
  input: { postedByUserId: string; postedAt?: string },
): LedgerTransaction {
  return {
    id: request.transactionId,
    firmId: request.firmId,
    idempotencyKey: request.idempotencyKey,
    requestFingerprint: request.requestFingerprint,
    postedByUserId: input.postedByUserId,
    postedAt: input.postedAt ?? request.proposedPostedAt,
    reversesTransactionId: request.reversesTransactionId,
    entries: request.entries,
  };
}

export function validateLedgerPostingRequestRecord(request: LedgerPostingRequestRecord): void {
  if (!ledgerPostingRequestStatuses.includes(request.status)) {
    throw new Error("Ledger posting request status is invalid");
  }
  if (!request.id.trim()) throw new Error("Ledger posting request id is required");
  if (!request.firmId.trim()) throw new Error("Ledger posting request firm is required");
  if (!request.transactionId.trim()) {
    throw new Error("Ledger posting request transaction id is required");
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error("Ledger posting request idempotency key is required");
  }
  if (!request.preparedByUserId.trim()) {
    throw new Error("Ledger posting request preparer is required");
  }
  if (request.entries.length === 0) {
    throw new Error("Ledger posting request entries are required");
  }
  validateBalancedEntries(request.entries);

  const transaction = ledgerTransactionFromPostingRequest(request, {
    postedByUserId: request.preparedByUserId,
    postedAt: request.proposedPostedAt,
  });
  if (ledgerRequestFingerprint(transaction) !== request.requestFingerprint) {
    throw new Error("Ledger posting request fingerprint does not match proposed transaction");
  }

  const matterIds = uniqueInOrder(request.entries.map((entry) => entry.matterId));
  const clientIds = uniqueInOrder(request.entries.map((entry) => entry.clientId));
  const accountIds = uniqueInOrder(request.entries.map((entry) => entry.accountId));
  if (matterIds.join("\n") !== request.matterIds.join("\n")) {
    throw new Error("Ledger posting request matter ids do not match proposed entries");
  }
  if (clientIds.join("\n") !== request.clientIds.join("\n")) {
    throw new Error("Ledger posting request client ids do not match proposed entries");
  }
  if (accountIds.join("\n") !== request.accountIds.join("\n")) {
    throw new Error("Ledger posting request account ids do not match proposed entries");
  }

  if (request.reviewedByUserId && request.reviewedByUserId === request.preparedByUserId) {
    throw new Error("Ledger posting request requires checker approval by a different user");
  }

  if (request.status === "pending_approval") {
    if (request.reviewedByUserId || request.reviewedAt || request.ledgerTransactionId) {
      throw new Error("Pending ledger posting requests cannot include reviewer or posting fields");
    }
  } else if (request.status === "posted") {
    if (!request.reviewedByUserId || !request.reviewedAt || !request.ledgerTransactionId) {
      throw new Error("Posted ledger posting requests require reviewer and ledger transaction");
    }
  } else if (request.status === "rejected") {
    if (!request.reviewedByUserId || !request.reviewedAt) {
      throw new Error("Rejected ledger posting requests require reviewer fields");
    }
    if (!request.rejectionReason?.trim()) {
      throw new Error("Rejected ledger posting requests require a rejection reason");
    }
    if (request.ledgerTransactionId) {
      throw new Error("Rejected ledger posting requests cannot include a ledger transaction");
    }
  }
}

function validateReversal(
  postedTransactions: PostedLedgerTransaction[],
  transaction: LedgerTransaction,
): void {
  const original = postedTransactions.find(
    (posted) =>
      posted.firmId === transaction.firmId && posted.id === transaction.reversesTransactionId,
  );
  if (!original) {
    throw new Error("Reversing transaction must reference an existing posted transaction");
  }

  const originalEntries = original.entries.map(
    ({ accountId, clientId, creditCents, debitCents, matterId }) => ({
      accountId,
      clientId,
      creditCents,
      debitCents,
      matterId,
    }),
  );
  const reversalEntries = transaction.entries.map(
    ({ accountId, clientId, creditCents, debitCents, matterId }) => ({
      accountId,
      clientId,
      creditCents: debitCents,
      debitCents: creditCents,
      matterId,
    }),
  );

  if (canonicalize(originalEntries) !== canonicalize(reversalEntries)) {
    throw new Error("Reversing transaction must exactly mirror original ledger entries");
  }
}

export function createReversalTransaction(
  original: PostedLedgerTransaction,
  input: {
    id: string;
    idempotencyKey: string;
    postedByUserId: string;
    postedAt: string;
    memoPrefix?: string;
  },
): LedgerTransaction {
  return {
    id: input.id,
    firmId: original.firmId,
    idempotencyKey: input.idempotencyKey,
    postedByUserId: input.postedByUserId,
    postedAt: input.postedAt,
    reversesTransactionId: original.id,
    entries: original.entries.map((entry) => ({
      firmId: entry.firmId,
      matterId: entry.matterId,
      clientId: entry.clientId,
      accountId: entry.accountId,
      debitCents: entry.creditCents,
      creditCents: entry.debitCents,
      memo: `${input.memoPrefix ?? "Reverse"}: ${entry.memo}`,
      reversingTransactionId: original.id,
    })),
  };
}

export function ledgerBalanceByMatter(entries: LedgerEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((balances, entry) => {
    const key = `${entry.clientId}:${entry.matterId}`;
    balances[key] = (balances[key] ?? 0) + entry.creditCents - entry.debitCents;
    return balances;
  }, {});
}

export function clientTrustBalanceByMatter(
  entries: LedgerEntry[],
  accounts: LedgerAccount[],
): Record<string, number> {
  const liabilityAccountIds = new Set(
    accounts.filter((account) => account.type === "client_liability").map((account) => account.id),
  );

  return entries
    .filter((entry) => liabilityAccountIds.has(entry.accountId))
    .reduce<Record<string, number>>((balances, entry) => {
      const key = `${entry.clientId}:${entry.matterId}`;
      balances[key] = (balances[key] ?? 0) + entry.creditCents - entry.debitCents;
      return balances;
    }, {});
}

export function clientTrustBalanceDeltas(
  entries: Array<
    Pick<
      LedgerEntry,
      "firmId" | "matterId" | "clientId" | "accountId" | "debitCents" | "creditCents"
    >
  >,
  accounts: LedgerAccount[],
): ClientTrustBalanceDelta[] {
  const liabilityAccountIds = new Set(
    accounts.filter((account) => account.type === "client_liability").map((account) => account.id),
  );
  const deltas = new Map<string, ClientTrustBalanceDelta>();

  for (const entry of entries) {
    if (!liabilityAccountIds.has(entry.accountId)) continue;

    const key = `${entry.firmId}:${entry.matterId}:${entry.clientId}`;
    const current = deltas.get(key) ?? {
      firmId: entry.firmId,
      matterId: entry.matterId,
      clientId: entry.clientId,
      deltaCents: 0,
    };
    current.deltaCents += entry.creditCents - entry.debitCents;
    deltas.set(key, current);
  }

  return [...deltas.values()].filter((delta) => delta.deltaCents !== 0);
}

export function ledgerPostingRequestReviewSummary(
  requests: LedgerPostingRequestRecord[],
): LedgerPostingRequestReviewSummary {
  return {
    pendingApprovalCount: requests.filter((request) => request.status === "pending_approval")
      .length,
    postedCount: requests.filter((request) => request.status === "posted").length,
    rejectedCount: requests.filter((request) => request.status === "rejected").length,
    totalCount: requests.length,
  };
}

export function ledgerControlsDiagnostics(input: {
  ledger: LedgerControlsLedgerSnapshot;
  approvals: LedgerTransactionApprovalRecord[];
  reconciliations: LedgerReconciliationRecord[];
  includeReconciliationDiagnostics?: boolean;
}): LedgerControlsDiagnostics {
  const visibleTransactionIds = uniqueInOrder(
    input.ledger.entries.map((entry) => entry.transactionId),
  );
  const approvedOrRejectedTransactionIds = new Set(
    input.approvals.map((approval) => approval.transactionId),
  );
  const rejectedApprovalTransactionIds = uniqueInOrder(
    input.approvals
      .filter((approval) => approval.decision === "rejected")
      .map((approval) => approval.transactionId),
  );

  const includeReconciliationDiagnostics = input.includeReconciliationDiagnostics ?? true;
  const reconciledAccountIds = new Set(
    input.reconciliations
      .filter((reconciliation) => ["matched", "reviewed"].includes(reconciliation.status))
      .map((reconciliation) => reconciliation.accountId),
  );
  const ledgerAccountIdsWithEntries = new Set(input.ledger.entries.map((entry) => entry.accountId));

  return {
    pendingApprovalTransactionIds: visibleTransactionIds.filter(
      (transactionId) => !approvedOrRejectedTransactionIds.has(transactionId),
    ),
    rejectedApprovalTransactionIds,
    unreconciledAccountIds: includeReconciliationDiagnostics
      ? input.ledger.accounts
          .filter(
            (account) =>
              account.type === "trust_asset" &&
              ledgerAccountIdsWithEntries.has(account.id) &&
              !reconciledAccountIds.has(account.id),
          )
          .map((account) => account.id)
      : [],
    exceptionReconciliationIds: includeReconciliationDiagnostics
      ? input.reconciliations
          .filter((reconciliation) => reconciliation.status === "exception")
          .map((reconciliation) => reconciliation.id)
      : [],
    overdrawnBalanceKeys: Object.entries(input.ledger.trustBalances)
      .filter(([, balanceCents]) => balanceCents < 0)
      .map(([key]) => key)
      .sort(),
  };
}

export function ledgerReconciliationReviewSummary(
  reconciliation: Pick<
    LedgerReconciliationRecord,
    "actualBalanceCents" | "expectedBalanceCents" | "statementRows"
  >,
): LedgerReconciliationReviewSummary {
  return {
    importedStatementRowCount: reconciliation.statementRows.length,
    matchedStatementRowCount: reconciliation.statementRows.filter(
      (row) => row.reviewDecision === "matched",
    ).length,
    unmatchedStatementRowCount: reconciliation.statementRows.filter(
      (row) => row.reviewDecision === "unmatched",
    ).length,
    varianceCents: reconciliation.actualBalanceCents - reconciliation.expectedBalanceCents,
  };
}

export function ledgerAccountingReviewSummary(input: {
  matchRuleProfiles: LedgerStatementMatchRuleProfileRecord[];
  accountingProfiles: LedgerAccountingReviewProfileRecord[];
}): LedgerAccountingReviewSummary {
  return {
    matchRuleProfileCount: input.matchRuleProfiles.length,
    accountingProfileCount: input.accountingProfiles.length,
    protectedAccountCount: input.accountingProfiles.filter(
      (profile) => profile.protectedFunds.protected,
    ).length,
    bankFeedShellCount: input.accountingProfiles.filter(
      (profile) => profile.bankFeedImport.status !== "not_configured",
    ).length,
    reviewOnly: true,
  };
}

export function ledgerBankFeedReconciliationReviewSummary(input: {
  accountingProfiles: LedgerAccountingReviewProfileRecord[];
  importBatches: LedgerStatementImportBatchRecord[];
  reconciliations: LedgerReconciliationRecord[];
  diagnostics?: Pick<
    LedgerControlsDiagnostics,
    "unreconciledAccountIds" | "exceptionReconciliationIds"
  >;
}): LedgerBankFeedReconciliationReviewSummary {
  const bankFeedProfiles = input.accountingProfiles.filter(
    (profile) => profile.bankFeedImport.status !== "not_configured",
  );
  const reviewAccountIds = new Set<string>([
    ...bankFeedProfiles.map((profile) => profile.accountId),
    ...input.importBatches.map((batch) => batch.accountId),
  ]);
  const relevantReconciliations =
    reviewAccountIds.size > 0
      ? input.reconciliations.filter((reconciliation) =>
          reviewAccountIds.has(reconciliation.accountId),
        )
      : [];
  const exceptionReconciliationIds = new Set(input.diagnostics?.exceptionReconciliationIds ?? []);
  for (const reconciliation of relevantReconciliations) {
    if (reconciliation.status === "exception") exceptionReconciliationIds.add(reconciliation.id);
  }
  const pendingAccountIds = new Set<string>(input.diagnostics?.unreconciledAccountIds ?? []);
  for (const batch of input.importBatches) {
    if (batch.status === "review_ready") pendingAccountIds.add(batch.accountId);
  }
  for (const profile of bankFeedProfiles) {
    if (profile.bankFeedImport.status === "review_ready") pendingAccountIds.add(profile.accountId);
  }

  return {
    bankFeedShellCount: bankFeedProfiles.length,
    metadataOnlyFeedCount: bankFeedProfiles.filter(
      (profile) => profile.bankFeedImport.status === "metadata_only",
    ).length,
    reviewReadyFeedCount: bankFeedProfiles.filter(
      (profile) => profile.bankFeedImport.status === "review_ready",
    ).length,
    importBatchCount: input.importBatches.length,
    previewedImportBatchCount: input.importBatches.filter((batch) => batch.status === "previewed")
      .length,
    reviewReadyImportBatchCount: input.importBatches.filter(
      (batch) => batch.status === "review_ready",
    ).length,
    discardedImportBatchCount: input.importBatches.filter((batch) => batch.status === "discarded")
      .length,
    importedStatementRowCount: input.importBatches.reduce(
      (total, batch) => total + batch.importedStatementRowCount,
      0,
    ),
    duplicateStatementRowCount: input.importBatches.reduce(
      (total, batch) => total + batch.duplicateStatementRowCount,
      0,
    ),
    completedReconciliationCount: relevantReconciliations.filter((reconciliation) =>
      ["matched", "reviewed"].includes(reconciliation.status),
    ).length,
    exceptionReconciliationCount: relevantReconciliations.filter((reconciliation) =>
      exceptionReconciliationIds.has(reconciliation.id),
    ).length,
    accountsPendingReconciliationCount: [...pendingAccountIds].filter((accountId) =>
      reviewAccountIds.has(accountId),
    ).length,
    protectedFundsFeedCount: bankFeedProfiles.filter((profile) => profile.protectedFunds.protected)
      .length,
    automaticMatching: false,
    automaticLedgerPosting: false,
    automaticReconciliation: false,
    liveBankFeedConnection: false,
    trustDisbursementAutomation: false,
    importBatchStoragePosture: "metadata_only_no_statement_rows",
    reviewOnly: true,
  };
}

function packetPosture(input: {
  reviewCueCount: number;
  exceptionCount?: number;
  conflictCount?: number;
}): LedgerReconciliationPacketSummary["posture"] {
  return input.reviewCueCount > 0 ||
    (input.exceptionCount ?? 0) > 0 ||
    (input.conflictCount ?? 0) > 0
    ? "needs_review"
    : "clear";
}

function postingRequestAmountCents(request: LedgerPostingRequestRecord): number {
  const debitCents = request.entries.reduce((sum, entry) => sum + entry.debitCents, 0);
  const creditCents = request.entries.reduce((sum, entry) => sum + entry.creditCents, 0);
  return Math.max(debitCents, creditCents);
}

export function ledgerReconciliationPacketReview(input: {
  ledger: LedgerControlsLedgerSnapshot;
  approvals: LedgerTransactionApprovalRecord[];
  postingRequests: LedgerPostingRequestRecord[];
  reconciliations: LedgerReconciliationRecord[];
  importBatches: LedgerStatementImportBatchRecord[];
  exceptionResolutions: LedgerReconciliationExceptionResolutionRecord[];
  trustTransferRequests: TrustTransferRequestRecord[];
  paymentImportReviewRecords: PaymentImportReviewRecord[];
  diagnostics: LedgerControlsDiagnostics;
  generatedAt?: string;
}): LedgerReconciliationPacketReview {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const ledgerTransactionIds = uniqueInOrder(
    input.ledger.entries.map((entry) => entry.transactionId),
  );
  const trustBalanceValues = Object.values(input.ledger.trustBalances);
  const ledgerReviewCueCount =
    input.diagnostics.pendingApprovalTransactionIds.length +
    input.diagnostics.rejectedApprovalTransactionIds.length +
    input.diagnostics.overdrawnBalanceKeys.length;

  const reviewReadyImportBatchCount = input.importBatches.filter(
    (batch) => batch.status === "review_ready",
  ).length;
  const duplicateStatementRowCount = input.importBatches.reduce(
    (sum, batch) => sum + batch.duplicateStatementRowCount,
    0,
  );

  const exceptionReconciliationIds = new Set(input.diagnostics.exceptionReconciliationIds);
  for (const reconciliation of input.reconciliations) {
    if (reconciliation.status === "exception") exceptionReconciliationIds.add(reconciliation.id);
  }
  const exceptionReconciliations = input.reconciliations.filter((reconciliation) =>
    exceptionReconciliationIds.has(reconciliation.id),
  );
  const unmatchedStatementRowCount = input.reconciliations.reduce(
    (sum, reconciliation) =>
      sum + reconciliation.statementRows.filter((row) => row.reviewDecision === "unmatched").length,
    0,
  );

  const pendingTrustTransferCount = input.trustTransferRequests.filter(
    (request) => request.status === "pending_approval",
  ).length;
  const approvedUnlinkedTrustTransferCount = input.trustTransferRequests.filter(
    (request) => request.status === "approved" && !request.ledgerTransactionId,
  ).length;
  const rejectedTrustTransferCount = input.trustTransferRequests.filter(
    (request) => request.status === "rejected",
  ).length;

  const postingRequestSummary = ledgerPostingRequestReviewSummary(input.postingRequests);
  const paymentImportConflictCount = input.paymentImportReviewRecords.filter(
    (record) => record.conflictReason || record.duplicateOfRecordId,
  ).length;

  const packets: LedgerReconciliationPacketSummary[] = [
    {
      kind: "ledger",
      label: "Ledger evidence",
      evidenceCount: ledgerTransactionIds.length + input.approvals.length,
      reviewCueCount: ledgerReviewCueCount,
      pendingCount: input.diagnostics.pendingApprovalTransactionIds.length,
      exceptionCount: input.diagnostics.overdrawnBalanceKeys.length,
      conflictCount: input.diagnostics.rejectedApprovalTransactionIds.length,
      amountCents: trustBalanceValues.reduce((sum, balanceCents) => sum + balanceCents, 0),
      latestEvidenceAt: latestIso([
        ...input.ledger.entries.map((entry) => entry.postedAt),
        ...input.approvals.map((approval) => approval.decidedAt),
      ]),
      posture: packetPosture({
        reviewCueCount: ledgerReviewCueCount,
        exceptionCount: input.diagnostics.overdrawnBalanceKeys.length,
        conflictCount: input.diagnostics.rejectedApprovalTransactionIds.length,
      }),
      reviewOnly: true,
    },
    {
      kind: "statement_import",
      label: "Statement import evidence",
      evidenceCount: input.importBatches.length,
      reviewCueCount: reviewReadyImportBatchCount + duplicateStatementRowCount,
      pendingCount: reviewReadyImportBatchCount,
      exceptionCount: 0,
      conflictCount: duplicateStatementRowCount,
      amountCents: 0,
      latestEvidenceAt: latestIso(input.importBatches.map((batch) => batch.createdAt)),
      posture: packetPosture({
        reviewCueCount: reviewReadyImportBatchCount + duplicateStatementRowCount,
        conflictCount: duplicateStatementRowCount,
      }),
      reviewOnly: true,
    },
    {
      kind: "exception",
      label: "Exception evidence",
      evidenceCount: exceptionReconciliations.length + input.exceptionResolutions.length,
      reviewCueCount: exceptionReconciliations.length + unmatchedStatementRowCount,
      pendingCount: exceptionReconciliations.length,
      exceptionCount: exceptionReconciliations.length,
      conflictCount: unmatchedStatementRowCount,
      amountCents: exceptionReconciliations.reduce(
        (sum, reconciliation) =>
          sum + Math.abs(reconciliation.actualBalanceCents - reconciliation.expectedBalanceCents),
        0,
      ),
      latestEvidenceAt: latestIso([
        ...exceptionReconciliations.map((reconciliation) => reconciliation.createdAt),
        ...input.exceptionResolutions.map((resolution) => resolution.recordedAt),
      ]),
      posture: packetPosture({
        reviewCueCount: exceptionReconciliations.length + unmatchedStatementRowCount,
        exceptionCount: exceptionReconciliations.length,
        conflictCount: unmatchedStatementRowCount,
      }),
      reviewOnly: true,
    },
    {
      kind: "trust_transfer",
      label: "Trust transfer evidence",
      evidenceCount: input.trustTransferRequests.length,
      reviewCueCount: pendingTrustTransferCount + approvedUnlinkedTrustTransferCount,
      pendingCount: pendingTrustTransferCount + approvedUnlinkedTrustTransferCount,
      exceptionCount: rejectedTrustTransferCount,
      conflictCount: 0,
      amountCents: input.trustTransferRequests.reduce(
        (sum, request) => sum + request.amountCents,
        0,
      ),
      latestEvidenceAt: latestIso(
        input.trustTransferRequests.map((request) => request.reviewedAt ?? request.requestedAt),
      ),
      posture: packetPosture({
        reviewCueCount: pendingTrustTransferCount + approvedUnlinkedTrustTransferCount,
        exceptionCount: rejectedTrustTransferCount,
      }),
      reviewOnly: true,
    },
    {
      kind: "posting_request",
      label: "Posting request evidence",
      evidenceCount: input.postingRequests.length,
      reviewCueCount: postingRequestSummary.pendingApprovalCount,
      pendingCount: postingRequestSummary.pendingApprovalCount,
      exceptionCount: postingRequestSummary.rejectedCount,
      conflictCount: 0,
      amountCents: input.postingRequests.reduce(
        (sum, request) => sum + postingRequestAmountCents(request),
        0,
      ),
      latestEvidenceAt: latestIso(
        input.postingRequests.map((request) => request.reviewedAt ?? request.preparedAt),
      ),
      posture: packetPosture({
        reviewCueCount: postingRequestSummary.pendingApprovalCount,
        exceptionCount: postingRequestSummary.rejectedCount,
      }),
      reviewOnly: true,
    },
    {
      kind: "payment_import",
      label: "Payment import evidence",
      evidenceCount: input.paymentImportReviewRecords.length,
      reviewCueCount: input.paymentImportReviewRecords.length,
      pendingCount: input.paymentImportReviewRecords.filter(
        (record) => record.reviewState === "needs_review",
      ).length,
      exceptionCount: 0,
      conflictCount: paymentImportConflictCount,
      amountCents: input.paymentImportReviewRecords.reduce(
        (sum, record) => sum + record.amountCents,
        0,
      ),
      latestEvidenceAt: latestIso(
        input.paymentImportReviewRecords.map((record) => record.updatedAt),
      ),
      posture: packetPosture({
        reviewCueCount: input.paymentImportReviewRecords.length,
        conflictCount: paymentImportConflictCount,
      }),
      reviewOnly: true,
    },
  ];

  return {
    generatedAt,
    reviewOnly: true,
    packets,
    summary: {
      packetCount: packets.length,
      evidenceCount: packets.reduce((sum, packet) => sum + packet.evidenceCount, 0),
      reviewCueCount: packets.reduce((sum, packet) => sum + packet.reviewCueCount, 0),
      packetsNeedingReviewCount: packets.filter((packet) => packet.posture === "needs_review")
        .length,
      latestEvidenceAt: latestIso(packets.map((packet) => packet.latestEvidenceAt)),
      reviewOnly: true,
    },
    policy: {
      source: "existing_ledger_billing_review_records",
      rawEvidencePayloads: "excluded",
      automaticReconciliation: false,
      automaticTrustPosting: false,
      invoiceMutation: "explicit_command_only",
      liveSettlement: false,
      providerCommands: false,
      publicExposure: false,
    },
  };
}

function categoryReadinessReasonCodes(input: {
  category: LedgerReconciliationPacketKind;
  packet: LedgerReconciliationPacketSummary;
  diagnostics: LedgerControlsDiagnostics;
  postingRequests: LedgerPostingRequestRecord[];
  trustTransferRequests: TrustTransferRequestRecord[];
  paymentImportReviewRecords: PaymentImportReviewRecord[];
}): LedgerMakerCheckerReadinessReason[] {
  const reasons = new Set<LedgerMakerCheckerReadinessReason>();
  if (input.category === "ledger") {
    if (input.diagnostics.pendingApprovalTransactionIds.length > 0) {
      reasons.add("pending_ledger_transaction_approval");
    }
    if (input.diagnostics.rejectedApprovalTransactionIds.length > 0) {
      reasons.add("rejected_ledger_transaction_approval");
    }
    if (input.diagnostics.overdrawnBalanceKeys.length > 0) {
      reasons.add("overdrawn_trust_balance");
    }
  }
  if (input.category === "statement_import") {
    if (input.packet.pendingCount > 0) reasons.add("statement_import_review_ready");
    if (input.packet.conflictCount > 0) reasons.add("statement_import_duplicate_rows");
  }
  if (input.category === "exception") {
    if (input.packet.exceptionCount > 0) reasons.add("reconciliation_exception");
    if (input.packet.conflictCount > 0) reasons.add("unmatched_statement_rows");
  }
  if (input.category === "posting_request") {
    if (input.postingRequests.some((request) => request.status === "pending_approval")) {
      reasons.add("pending_posting_request");
    }
    if (input.postingRequests.some((request) => request.status === "rejected")) {
      reasons.add("rejected_posting_request");
    }
  }
  if (input.category === "trust_transfer") {
    if (input.trustTransferRequests.some((request) => request.status === "pending_approval")) {
      reasons.add("pending_trust_transfer_request");
    }
    if (
      input.trustTransferRequests.some(
        (request) => request.status === "approved" && !request.ledgerTransactionId,
      )
    ) {
      reasons.add("approved_unlinked_trust_transfer_request");
    }
    if (input.trustTransferRequests.some((request) => request.status === "rejected")) {
      reasons.add("rejected_trust_transfer_request");
    }
  }
  if (input.category === "payment_import") {
    if (input.paymentImportReviewRecords.some((record) => record.reviewState === "needs_review")) {
      reasons.add("payment_import_review_required");
    }
    if (
      input.paymentImportReviewRecords.some(
        (record) => record.conflictReason || record.duplicateOfRecordId,
      )
    ) {
      reasons.add("payment_import_conflict");
    }
  }
  return [...reasons];
}

function transactionMatterAmountCents(
  ledger: LedgerControlsLedgerSnapshot,
  transactionId: string,
  matterId: string,
): number {
  const entries = ledger.entries.filter(
    (entry) => entry.transactionId === transactionId && entry.matterId === matterId,
  );
  const debitCents = entries.reduce((sum, entry) => sum + entry.debitCents, 0);
  const creditCents = entries.reduce((sum, entry) => sum + entry.creditCents, 0);
  return Math.max(debitCents, creditCents);
}

function transactionMatterIds(
  ledger: LedgerControlsLedgerSnapshot,
  transactionId: string,
): string[] {
  return uniqueInOrder(
    ledger.entries
      .filter((entry) => entry.transactionId === transactionId)
      .map((entry) => entry.matterId),
  );
}

function transactionLatestEvidenceAt(
  ledger: LedgerControlsLedgerSnapshot,
  transactionId: string,
): string | undefined {
  return latestIso(
    ledger.entries
      .filter((entry) => entry.transactionId === transactionId)
      .map((entry) => entry.postedAt),
  );
}

function visibleMatterIdFromTrustBalanceKey(
  key: string,
  visibleMatterIds: Set<string>,
): string | undefined {
  const parts = key.split(":").filter(Boolean);
  return parts.find((part) => visibleMatterIds.has(part));
}

interface LedgerMakerCheckerReadinessMatterAccumulator {
  matterId: string;
  categoryKeys: Set<LedgerReconciliationPacketKind>;
  reasonCodes: Set<LedgerMakerCheckerReadinessReason>;
  reviewCueCount: number;
  pendingCount: number;
  exceptionCount: number;
  amountCents: number;
  latestEvidenceAt?: string;
}

function addMatterReadinessCue(
  matters: Map<string, LedgerMakerCheckerReadinessMatterAccumulator>,
  input: {
    matterId: string;
    category: LedgerReconciliationPacketKind;
    reasonCodes: LedgerMakerCheckerReadinessReason[];
    amountCents?: number;
    latestEvidenceAt?: string;
    pendingCount?: number;
    exceptionCount?: number;
  },
): void {
  const current = matters.get(input.matterId) ?? {
    matterId: input.matterId,
    categoryKeys: new Set<LedgerReconciliationPacketKind>(),
    reasonCodes: new Set<LedgerMakerCheckerReadinessReason>(),
    reviewCueCount: 0,
    pendingCount: 0,
    exceptionCount: 0,
    amountCents: 0,
  };
  current.categoryKeys.add(input.category);
  for (const reason of input.reasonCodes) current.reasonCodes.add(reason);
  current.reviewCueCount += 1;
  current.pendingCount += input.pendingCount ?? 0;
  current.exceptionCount += input.exceptionCount ?? 0;
  current.amountCents += input.amountCents ?? 0;
  current.latestEvidenceAt = latestIso([current.latestEvidenceAt, input.latestEvidenceAt]);
  matters.set(input.matterId, current);
}

function matterRowsFromReadinessAccumulators(
  matters: Map<string, LedgerMakerCheckerReadinessMatterAccumulator>,
): LedgerMakerCheckerReadinessMatterRow[] {
  return [...matters.values()]
    .map((matter) => ({
      matterId: matter.matterId,
      categoryKeys: [...matter.categoryKeys].sort(),
      reasonCodes: [...matter.reasonCodes].sort(),
      reviewCueCount: matter.reviewCueCount,
      pendingCount: matter.pendingCount,
      exceptionCount: matter.exceptionCount,
      amountCents: matter.amountCents,
      latestEvidenceAt: matter.latestEvidenceAt,
      reviewOnly: true as const,
    }))
    .sort(
      (left, right) =>
        right.reviewCueCount - left.reviewCueCount ||
        right.exceptionCount - left.exceptionCount ||
        left.matterId.localeCompare(right.matterId),
    );
}

export function buildLedgerMakerCheckerReadiness(input: {
  ledger: LedgerControlsLedgerSnapshot;
  postingRequests: LedgerPostingRequestRecord[];
  trustTransferRequests: TrustTransferRequestRecord[];
  paymentImportReviewRecords: PaymentImportReviewRecord[];
  diagnostics: LedgerControlsDiagnostics;
  reconciliationPacketReview: LedgerReconciliationPacketReview;
  generatedAt?: string;
}): LedgerMakerCheckerReadiness {
  const generatedAt = input.generatedAt ?? input.reconciliationPacketReview.generatedAt;
  const categories = input.reconciliationPacketReview.packets.map((packet) => {
    const reasonCodes = categoryReadinessReasonCodes({
      category: packet.kind,
      packet,
      diagnostics: input.diagnostics,
      postingRequests: input.postingRequests,
      trustTransferRequests: input.trustTransferRequests,
      paymentImportReviewRecords: input.paymentImportReviewRecords,
    });
    const readiness =
      reasonCodes.length > 0 || packet.reviewCueCount > 0 || packet.pendingCount > 0
        ? "policy_required_if_enabled"
        : "clear";
    return {
      category: packet.kind,
      label: packet.label,
      evidenceCount: packet.evidenceCount,
      reviewCueCount: packet.reviewCueCount,
      pendingCount: packet.pendingCount,
      exceptionCount: packet.exceptionCount,
      conflictCount: packet.conflictCount,
      amountCents: packet.amountCents,
      readiness,
      reasonCodes,
      reviewOnly: true,
    } satisfies LedgerMakerCheckerReadinessCategoryRow;
  });

  const matters = new Map<string, LedgerMakerCheckerReadinessMatterAccumulator>();
  const visibleMatterIds = new Set<string>([
    ...input.ledger.entries.map((entry) => entry.matterId),
    ...input.postingRequests.flatMap((request) => request.matterIds),
    ...input.trustTransferRequests.map((request) => request.matterId),
    ...input.paymentImportReviewRecords.map((record) => record.matterId),
  ]);

  for (const transactionId of input.diagnostics.pendingApprovalTransactionIds) {
    for (const matterId of transactionMatterIds(input.ledger, transactionId)) {
      addMatterReadinessCue(matters, {
        matterId,
        category: "ledger",
        reasonCodes: ["pending_ledger_transaction_approval"],
        pendingCount: 1,
        amountCents: transactionMatterAmountCents(input.ledger, transactionId, matterId),
        latestEvidenceAt: transactionLatestEvidenceAt(input.ledger, transactionId),
      });
    }
  }
  for (const transactionId of input.diagnostics.rejectedApprovalTransactionIds) {
    for (const matterId of transactionMatterIds(input.ledger, transactionId)) {
      addMatterReadinessCue(matters, {
        matterId,
        category: "ledger",
        reasonCodes: ["rejected_ledger_transaction_approval"],
        exceptionCount: 1,
        amountCents: transactionMatterAmountCents(input.ledger, transactionId, matterId),
        latestEvidenceAt: transactionLatestEvidenceAt(input.ledger, transactionId),
      });
    }
  }
  for (const key of input.diagnostics.overdrawnBalanceKeys) {
    const matterId = visibleMatterIdFromTrustBalanceKey(key, visibleMatterIds);
    if (!matterId) continue;
    addMatterReadinessCue(matters, {
      matterId,
      category: "ledger",
      reasonCodes: ["overdrawn_trust_balance"],
      exceptionCount: 1,
      amountCents: Math.abs(input.ledger.trustBalances[key] ?? 0),
    });
  }
  for (const request of input.postingRequests) {
    if (request.status !== "pending_approval" && request.status !== "rejected") continue;
    for (const matterId of request.matterIds) {
      addMatterReadinessCue(matters, {
        matterId,
        category: "posting_request",
        reasonCodes:
          request.status === "pending_approval"
            ? ["pending_posting_request"]
            : ["rejected_posting_request"],
        pendingCount: request.status === "pending_approval" ? 1 : 0,
        exceptionCount: request.status === "rejected" ? 1 : 0,
        amountCents: postingRequestAmountCents(request),
        latestEvidenceAt: request.reviewedAt ?? request.preparedAt,
      });
    }
  }
  for (const request of input.trustTransferRequests) {
    const reasonCodes: LedgerMakerCheckerReadinessReason[] = [];
    if (request.status === "pending_approval") reasonCodes.push("pending_trust_transfer_request");
    if (request.status === "approved" && !request.ledgerTransactionId) {
      reasonCodes.push("approved_unlinked_trust_transfer_request");
    }
    if (request.status === "rejected") reasonCodes.push("rejected_trust_transfer_request");
    if (reasonCodes.length === 0) continue;
    addMatterReadinessCue(matters, {
      matterId: request.matterId,
      category: "trust_transfer",
      reasonCodes,
      pendingCount: request.status === "pending_approval" ? 1 : 0,
      exceptionCount: request.status === "rejected" ? 1 : 0,
      amountCents: request.amountCents,
      latestEvidenceAt: request.reviewedAt ?? request.requestedAt,
    });
  }
  for (const record of input.paymentImportReviewRecords) {
    if (record.reviewState !== "needs_review") continue;
    const hasConflict = Boolean(record.conflictReason || record.duplicateOfRecordId);
    addMatterReadinessCue(matters, {
      matterId: record.matterId,
      category: "payment_import",
      reasonCodes: hasConflict
        ? ["payment_import_review_required", "payment_import_conflict"]
        : ["payment_import_review_required"],
      pendingCount: 1,
      exceptionCount: hasConflict ? 1 : 0,
      amountCents: record.amountCents,
      latestEvidenceAt: record.updatedAt,
    });
  }

  const matterRows = matterRowsFromReadinessAccumulators(matters);

  return {
    generatedAt,
    reviewOnly: true,
    categories,
    matters: matterRows,
    summary: {
      categoryCount: categories.length,
      categoriesRequiringPolicyCount: categories.filter(
        (category) => category.readiness === "policy_required_if_enabled",
      ).length,
      matterCount: matterRows.length,
      mattersRequiringPolicyCount: matterRows.filter((matter) => matter.reviewCueCount > 0).length,
      reviewCueCount: categories.reduce((sum, category) => sum + category.reviewCueCount, 0),
      pendingCount: categories.reduce((sum, category) => sum + category.pendingCount, 0),
      exceptionCount: categories.reduce((sum, category) => sum + category.exceptionCount, 0),
      amountCents: categories.reduce((sum, category) => sum + category.amountCents, 0),
      reviewOnly: true,
    },
    policy: {
      source: "existing_trust_controls_projection",
      makerCheckerPolicyEnabled: false,
      directPostingSemantics: "unchanged",
      approvalMutation: false,
      automaticTrustPosting: false,
      settlementAutomation: false,
      bankFeedMatching: false,
      jurisdictionCertifiedAccounting: false,
    },
  };
}

export function buildLedgerBalanceSnapshotComparison(input: {
  ledger: LedgerControlsLedgerSnapshot;
  importBatches: LedgerStatementImportBatchRecord[];
  reconciliations: LedgerReconciliationRecord[];
  generatedAt?: string;
}): LedgerBalanceSnapshotComparison {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const accountsById = new Map(input.ledger.accounts.map((account) => [account.id, account]));
  const trustBalanceValues = Object.values(input.ledger.trustBalances);
  const currentTrustBalance = {
    totalCents: trustBalanceValues.reduce((total, balanceCents) => total + balanceCents, 0),
    balanceCount: trustBalanceValues.length,
    overdrawnBalanceCount: trustBalanceValues.filter((balanceCents) => balanceCents < 0).length,
  };

  const postedTransactions = new Map<
    string,
    {
      transactionId: string;
      postedAt: string;
      entryCount: number;
      matterIds: Set<string>;
      clientIds: Set<string>;
      accountIds: Set<string>;
      trustAssetDeltaCents: number;
      clientLiabilityDeltaCents: number;
      reversal: boolean;
    }
  >();
  for (const entry of input.ledger.entries) {
    const current = postedTransactions.get(entry.transactionId) ?? {
      transactionId: entry.transactionId,
      postedAt: entry.postedAt,
      entryCount: 0,
      matterIds: new Set<string>(),
      clientIds: new Set<string>(),
      accountIds: new Set<string>(),
      trustAssetDeltaCents: 0,
      clientLiabilityDeltaCents: 0,
      reversal: false,
    };
    current.entryCount += 1;
    current.matterIds.add(entry.matterId);
    current.clientIds.add(entry.clientId);
    current.accountIds.add(entry.accountId);
    current.reversal = current.reversal || Boolean(entry.reversingTransactionId);
    if ((parseTimestamp(entry.postedAt) ?? 0) > (parseTimestamp(current.postedAt) ?? 0)) {
      current.postedAt = entry.postedAt;
    }
    const accountType = accountsById.get(entry.accountId)?.type;
    if (accountType === "trust_asset") {
      current.trustAssetDeltaCents += entry.debitCents - entry.creditCents;
    } else if (accountType === "client_liability") {
      current.clientLiabilityDeltaCents += entry.creditCents - entry.debitCents;
    }
    postedTransactions.set(entry.transactionId, current);
  }
  const latestPostedTransactionSource = [...postedTransactions.values()].sort(
    (left, right) =>
      (parseTimestamp(right.postedAt) ?? 0) - (parseTimestamp(left.postedAt) ?? 0) ||
      left.transactionId.localeCompare(right.transactionId),
  )[0];
  const latestPostedTransaction = latestPostedTransactionSource
    ? {
        transactionId: latestPostedTransactionSource.transactionId,
        postedAt: latestPostedTransactionSource.postedAt,
        entryCount: latestPostedTransactionSource.entryCount,
        matterCount: latestPostedTransactionSource.matterIds.size,
        clientCount: latestPostedTransactionSource.clientIds.size,
        accountCount: latestPostedTransactionSource.accountIds.size,
        trustAssetDeltaCents: latestPostedTransactionSource.trustAssetDeltaCents,
        clientLiabilityDeltaCents: latestPostedTransactionSource.clientLiabilityDeltaCents,
        reversal: latestPostedTransactionSource.reversal,
      }
    : undefined;

  const latestImportBatch = [...input.importBatches].sort(
    (left, right) =>
      (parseTimestamp(right.createdAt) ?? 0) - (parseTimestamp(left.createdAt) ?? 0) ||
      left.id.localeCompare(right.id),
  )[0];
  const latestReconciliationPreview = latestImportBatch
    ? {
        importBatchId: latestImportBatch.id,
        accountId: latestImportBatch.accountId,
        accountName:
          accountsById.get(latestImportBatch.accountId)?.name ?? latestImportBatch.accountId,
        status: latestImportBatch.status,
        createdAt: latestImportBatch.createdAt,
        importedStatementRowCount: latestImportBatch.importedStatementRowCount,
        duplicateStatementRowCount: latestImportBatch.duplicateStatementRowCount,
        matchingProfilePresent: Boolean(latestImportBatch.matchingProfileId),
        sourceLabelPresent: latestImportBatch.sourceLabel.trim().length > 0,
        storagePosture: "metadata_only_no_statement_rows" as const,
      }
    : undefined;

  const latestReconciliation = [...input.reconciliations].sort(
    (left, right) =>
      (parseTimestamp(right.statementPeriodEnd) ?? 0) -
        (parseTimestamp(left.statementPeriodEnd) ?? 0) ||
      (parseTimestamp(right.createdAt) ?? 0) - (parseTimestamp(left.createdAt) ?? 0) ||
      left.id.localeCompare(right.id),
  )[0];
  const latestReconciliationSummary = latestReconciliation
    ? ledgerReconciliationReviewSummary(latestReconciliation)
    : undefined;
  const latestReconciliationSnapshot =
    latestReconciliation && latestReconciliationSummary
      ? {
          reconciliationId: latestReconciliation.id,
          accountId: latestReconciliation.accountId,
          accountName:
            accountsById.get(latestReconciliation.accountId)?.name ??
            latestReconciliation.accountId,
          status: latestReconciliation.status,
          statementPeriodEnd: latestReconciliation.statementPeriodEnd,
          expectedBalanceCents: latestReconciliation.expectedBalanceCents,
          actualBalanceCents: latestReconciliation.actualBalanceCents,
          varianceCents: latestReconciliationSummary.varianceCents,
          unmatchedStatementRowCount: latestReconciliationSummary.unmatchedStatementRowCount,
        }
      : undefined;

  const reviewReasons = new Set<LedgerBalanceSnapshotReviewReason>();
  if (currentTrustBalance.balanceCount === 0) reviewReasons.add("no_trust_balances");
  if (currentTrustBalance.overdrawnBalanceCount > 0) {
    reviewReasons.add("overdrawn_trust_balance");
  }
  if (!latestPostedTransaction) reviewReasons.add("no_posted_transaction");
  if (!latestReconciliationPreview) reviewReasons.add("no_reconciliation_preview_metadata");
  if (!latestReconciliationSnapshot) reviewReasons.add("no_reconciliation_snapshot");
  if (
    latestPostedTransaction &&
    latestReconciliationPreview &&
    (parseTimestamp(latestPostedTransaction.postedAt) ?? 0) >
      (parseTimestamp(latestReconciliationPreview.createdAt) ?? 0)
  ) {
    reviewReasons.add("posting_newer_than_preview");
  }
  if (
    latestPostedTransaction &&
    latestReconciliationSnapshot &&
    (parseTimestamp(latestPostedTransaction.postedAt) ?? 0) >
      (parseTimestamp(latestReconciliationSnapshot.statementPeriodEnd) ?? 0)
  ) {
    reviewReasons.add("posting_newer_than_reconciliation");
  }
  if (latestReconciliationSnapshot && latestReconciliationSnapshot.varianceCents !== 0) {
    reviewReasons.add("reconciliation_variance");
  }
  if (latestReconciliationSnapshot && latestReconciliationSnapshot.unmatchedStatementRowCount > 0) {
    reviewReasons.add("unmatched_statement_rows");
  }

  return {
    generatedAt,
    reviewOnly: true,
    currentTrustBalance,
    latestPostedTransaction,
    latestReconciliationPreview,
    latestReconciliationSnapshot,
    reviewReasons: [...reviewReasons],
    policy: {
      source: "ledger_snapshot_and_reconciliation_metadata",
      previewStoragePosture: "latest_import_batch_metadata_only_no_statement_rows",
      automaticMatching: false,
      automaticLedgerPosting: false,
      automaticReconciliation: false,
      settlementAutomation: false,
      liveBankFeedConnection: false,
      jurisdictionCertifiedAccounting: false,
    },
  };
}

export function ledgerReconciliationFreshnessReview(input: {
  accounts: LedgerAccount[];
  reconciliations: LedgerReconciliationRecord[];
  generatedAt?: string;
  freshWithinDays?: number;
  watchWithinDays?: number;
}): LedgerReconciliationFreshnessReview {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatedAtMs = parseTimestamp(generatedAt) ?? Date.now();
  const freshWithinDays = input.freshWithinDays ?? 30;
  const watchWithinDays = input.watchWithinDays ?? 60;
  const reviewedStatuses = new Set<LedgerReconciliationStatus>([
    "matched",
    "exception",
    "reviewed",
  ]);
  const reconciliationsByAccountId = new Map<string, LedgerReconciliationRecord[]>();
  for (const reconciliation of input.reconciliations) {
    const current = reconciliationsByAccountId.get(reconciliation.accountId) ?? [];
    current.push(reconciliation);
    reconciliationsByAccountId.set(reconciliation.accountId, current);
  }

  const rows = input.accounts
    .filter((account) => account.type === "trust_asset")
    .map((account): LedgerReconciliationFreshnessRow => {
      const accountReconciliations = reconciliationsByAccountId.get(account.id) ?? [];
      const latestReviewed = accountReconciliations
        .filter((reconciliation) => reviewedStatuses.has(reconciliation.status))
        .sort(
          (left, right) =>
            (parseTimestamp(right.statementPeriodEnd) ?? 0) -
            (parseTimestamp(left.statementPeriodEnd) ?? 0),
        )[0];
      const daysSinceLatestReviewedStatementPeriod = wholeDaysSince(
        generatedAtMs,
        latestReviewed?.statementPeriodEnd,
      );
      const posture = reconciliationFreshnessPosture({
        daysSinceLatestReviewedStatementPeriod,
        freshWithinDays,
        watchWithinDays,
      });
      const staleDayCount =
        posture === "stale" && daysSinceLatestReviewedStatementPeriod !== undefined
          ? Math.max(daysSinceLatestReviewedStatementPeriod - watchWithinDays, 0)
          : 0;
      const summary = accountReconciliations.reduce(
        (current, reconciliation) => {
          const reconciliationSummary = ledgerReconciliationReviewSummary(reconciliation);
          current.exceptionCount += reconciliation.status === "exception" ? 1 : 0;
          current.importedStatementRowCount += reconciliationSummary.importedStatementRowCount;
          current.matchedStatementRowCount += reconciliationSummary.matchedStatementRowCount;
          current.unmatchedStatementRowCount += reconciliationSummary.unmatchedStatementRowCount;
          return current;
        },
        {
          exceptionCount: 0,
          importedStatementRowCount: 0,
          matchedStatementRowCount: 0,
          unmatchedStatementRowCount: 0,
        },
      );

      return {
        accountId: account.id,
        accountName: account.name,
        posture,
        daysSinceLatestReviewedStatementPeriod,
        staleDayCount,
        latestReconciliationId: latestReviewed?.id,
        latestReconciliationStatus: latestReviewed?.status,
        latestReviewedStatementPeriodStart: latestReviewed?.statementPeriodStart,
        latestReviewedStatementPeriodEnd: latestReviewed?.statementPeriodEnd,
        exceptionCount: summary.exceptionCount,
        importedStatementRowCount: summary.importedStatementRowCount,
        matchedStatementRowCount: summary.matchedStatementRowCount,
        unmatchedStatementRowCount: summary.unmatchedStatementRowCount,
        reviewOnly: true,
      };
    })
    .sort((left, right) => {
      const postureRank: Record<LedgerReconciliationFreshnessPosture, number> = {
        stale: 0,
        never_reconciled: 1,
        watch: 2,
        fresh: 3,
      };
      if (postureRank[left.posture] !== postureRank[right.posture]) {
        return postureRank[left.posture] - postureRank[right.posture];
      }
      return (
        right.staleDayCount - left.staleDayCount ||
        left.accountName.localeCompare(right.accountName)
      );
    });

  return {
    generatedAt,
    freshWithinDays,
    watchWithinDays,
    rows,
    summary: {
      accountCount: rows.length,
      freshCount: rows.filter((row) => row.posture === "fresh").length,
      watchCount: rows.filter((row) => row.posture === "watch").length,
      staleCount: rows.filter((row) => row.posture === "stale").length,
      neverReconciledCount: rows.filter((row) => row.posture === "never_reconciled").length,
      totalStaleDayCount: rows.reduce((sum, row) => sum + row.staleDayCount, 0),
      maxStaleDayCount: rows.reduce((max, row) => Math.max(max, row.staleDayCount), 0),
      latestReviewedStatementPeriodEnd: latestIso(
        rows.map((row) => row.latestReviewedStatementPeriodEnd),
      ),
      exceptionCount: rows.reduce((sum, row) => sum + row.exceptionCount, 0),
      unmatchedStatementRowCount: rows.reduce(
        (sum, row) => sum + row.unmatchedStatementRowCount,
        0,
      ),
      reviewOnly: true,
    },
    reviewOnly: true,
  };
}

export function previewLedgerStatementImport(input: {
  accountId: string;
  statementRows: LedgerStatementImportPreviewRowInput[];
  ledgerEntries: LedgerEntry[];
}): LedgerStatementImportPreview {
  const ledgerEntriesForAccount = input.ledgerEntries.filter(
    (entry) => entry.accountId === input.accountId,
  );
  const firstRowIdByDuplicateKey = new Map<string, string>();
  const rows = input.statementRows.map((row) => {
    const duplicateKey = statementRowDuplicateKey(row);
    const duplicateOfRowId = firstRowIdByDuplicateKey.get(duplicateKey);
    if (!duplicateOfRowId) firstRowIdByDuplicateKey.set(duplicateKey, row.id);
    const proposedMatches = duplicateOfRowId
      ? []
      : proposedStatementLedgerMatches(row, ledgerEntriesForAccount);

    return {
      ...row,
      duplicateKey,
      duplicateOfRowId,
      reviewDecision:
        duplicateOfRowId || proposedMatches.length === 0
          ? ("unmatched" as const)
          : ("matched" as const),
      proposedMatches,
    };
  });

  return {
    accountId: input.accountId,
    importedStatementRowCount: rows.length,
    uniqueStatementRowCount: rows.filter((row) => !row.duplicateOfRowId).length,
    duplicateStatementRowCount: rows.filter((row) => row.duplicateOfRowId).length,
    proposedMatchedStatementRowCount: rows.filter((row) => row.proposedMatches.length > 0).length,
    rows,
    postingPolicy: "review_only_no_automatic_ledger_posting",
  };
}

export function ledgerStatementRowDuplicateKey(row: LedgerStatementImportPreviewRowInput): string {
  return [
    statementDateKey(row.postedAt),
    row.amountCents.toString(),
    normalizeStatementText(row.description),
    normalizeStatementText(row.reference ?? ""),
  ].join("|");
}

export function buildLedgerReconciliationExceptionResolutionStatementRow(
  row: LedgerReconciliationExceptionResolutionStatementRowInput,
): LedgerReconciliationExceptionResolutionStatementRow {
  if (row.reviewDecision !== "unmatched") {
    throw new Error("Reconciliation exception resolutions can only reference unmatched rows");
  }

  return {
    id: row.id,
    postedAt: row.postedAt,
    description: row.description,
    amountCents: row.amountCents,
    reference: row.reference,
    duplicateKey: ledgerStatementRowDuplicateKey(row),
    duplicateOfRowId: row.duplicateOfRowId,
    reviewDecision: "unmatched",
  };
}

export function buildJurisdictionalTrustReport(input: {
  matters: Array<Pick<Matter, "id" | "jurisdiction"> & Partial<Pick<Matter, "practiceArea">>>;
  legalClinicMatterProfiles?: Array<
    Pick<LegalClinicMatterProfile, "matterId" | "programId" | "metadata">
  >;
  ledger: LedgerControlsLedgerSnapshot;
  approvals: LedgerTransactionApprovalRecord[];
  reconciliations: LedgerReconciliationRecord[];
  diagnostics: LedgerControlsDiagnostics;
  jurisdiction?: Province;
  filters?: LedgerReportDimensionFilters;
  groupBy?: LedgerReportDimensionGroupKey;
}): JurisdictionalTrustReport {
  const mattersById = new Map(input.matters.map((matter) => [matter.id, matter]));
  const filters: LedgerReportDimensionFilters = {
    ...input.filters,
    jurisdiction: input.jurisdiction ?? input.filters?.jurisdiction,
  };
  const groupBy = input.groupBy ?? "jurisdiction";
  const matterProfilesByMatterId = new Map(
    (input.legalClinicMatterProfiles ?? []).map((profile) => [profile.matterId, profile]),
  );
  const dimensionedMatters = input.matters.map((matter) => ({
    matter,
    dimensions: ledgerReportDimensionsForMatter(matter, matterProfilesByMatterId.get(matter.id)),
  }));
  const filteredMatters = dimensionedMatters.filter(({ dimensions }) =>
    ledgerReportDimensionsMatch(dimensions, filters),
  );
  const groupKeys = reportGroupKeys({
    groupBy,
    filters,
    matters: filteredMatters,
  });
  const entriesByTransactionId = groupEntriesBy(
    input.ledger.entries,
    (entry) => entry.transactionId,
  );
  const entriesByAccountId = groupEntriesBy(input.ledger.entries, (entry) => entry.accountId);
  const rejectedTransactionIds = new Set(input.diagnostics.rejectedApprovalTransactionIds);
  for (const approval of input.approvals) {
    if (approval.decision === "rejected") rejectedTransactionIds.add(approval.transactionId);
  }
  const exceptionReconciliationIds = new Set(input.diagnostics.exceptionReconciliationIds);
  for (const reconciliation of input.reconciliations) {
    if (reconciliation.status === "exception") exceptionReconciliationIds.add(reconciliation.id);
  }

  return {
    groupBy,
    filters,
    dimensionOptions: {
      jurisdictions: uniqueInOrder(input.matters.map((matter) => matter.jurisdiction)).sort(),
      practiceAreas: uniqueInOrder(
        dimensionedMatters.map(({ dimensions }) => dimensions.practiceArea),
      ).sort(),
      clinicProgramIds: uniqueInOrder(
        dimensionedMatters.map(({ dimensions }) => dimensions.clinicProgramId),
      ).sort(),
      restrictedFundReviewStatuses: uniqueInOrder(
        dimensionedMatters.map(({ dimensions }) => dimensions.restrictedFundReviewStatus),
      ).sort(),
    },
    compliancePosture: "operational_controls_only_not_jurisdiction_certified",
    summaries: groupKeys.map((dimensionKey) => {
      const groupMatters = filteredMatters.filter(
        ({ dimensions }) => ledgerReportDimensionValue(dimensions, groupBy) === dimensionKey,
      );
      const matterIds = new Set(groupMatters.map(({ matter }) => matter.id));
      const aggregateDimensions = ledgerReportAggregateDimensions(
        groupMatters.map(({ dimensions }) => dimensions),
      );
      const dimensions = ledgerReportDimensionsForGroup({
        aggregateDimensions,
        groupBy,
        dimensionKey,
      });
      const jurisdictionTransactionIds = transactionIdsForMatterSet(
        input.ledger.entries,
        matterIds,
      );
      const jurisdictionAccountIds = accountIdsForMatterSet(input.ledger.entries, matterIds);
      const reconciliations = input.reconciliations.filter((reconciliation) =>
        accountTouchesMatterSet(entriesByAccountId.get(reconciliation.accountId) ?? [], matterIds),
      );
      const reconciliationSummary = reconciliations.reduce(
        (summary, reconciliation) => {
          const current = ledgerReconciliationReviewSummary(reconciliation);
          summary.importedStatementRowCount += current.importedStatementRowCount;
          summary.matchedStatementRowCount += current.matchedStatementRowCount;
          summary.unmatchedStatementRowCount += current.unmatchedStatementRowCount;
          summary.totalVarianceCents += current.varianceCents;
          return summary;
        },
        {
          importedStatementRowCount: 0,
          matchedStatementRowCount: 0,
          unmatchedStatementRowCount: 0,
          totalVarianceCents: 0,
        },
      );

      return {
        jurisdiction: dimensions.jurisdiction === "multiple" ? "CANADA" : dimensions.jurisdiction,
        groupBy,
        dimensionKey,
        dimensionLabel: ledgerReportDimensionLabel(groupBy, dimensionKey),
        dimensions,
        practiceArea: dimensions.practiceArea,
        clinicProgramId: dimensions.clinicProgramId,
        restrictedFundReviewStatus: dimensions.restrictedFundReviewStatus,
        matterCount: matterIds.size,
        trustBalanceCents: trustBalanceForMatterSet(input.ledger.trustBalances, matterIds),
        pendingApprovalCount: input.diagnostics.pendingApprovalTransactionIds.filter(
          (transactionId) => jurisdictionTransactionIds.has(transactionId),
        ).length,
        rejectedApprovalCount: [...rejectedTransactionIds].filter((transactionId) =>
          accountTouchesMatterSet(entriesByTransactionId.get(transactionId) ?? [], matterIds),
        ).length,
        exceptionReconciliationCount: reconciliations.filter((reconciliation) =>
          exceptionReconciliationIds.has(reconciliation.id),
        ).length,
        importedStatementRowCount: reconciliationSummary.importedStatementRowCount,
        matchedStatementRowCount: reconciliationSummary.matchedStatementRowCount,
        unmatchedStatementRowCount: reconciliationSummary.unmatchedStatementRowCount,
        totalVarianceCents: reconciliationSummary.totalVarianceCents,
        unreconciledAccountCount: input.diagnostics.unreconciledAccountIds.filter((accountId) =>
          jurisdictionAccountIds.has(accountId),
        ).length,
        overdrawnBalanceCount: input.diagnostics.overdrawnBalanceKeys.filter((key) => {
          const matterId = matterIdFromTrustBalanceKey(key, mattersById);
          return matterId ? matterIds.has(matterId) : false;
        }).length,
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      };
    }),
  };
}

export function validateLedgerReconciliationRecord(
  reconciliation: LedgerReconciliationRecord,
): void {
  if (
    new Date(reconciliation.statementPeriodEnd).getTime() <=
    new Date(reconciliation.statementPeriodStart).getTime()
  ) {
    throw new Error("Ledger reconciliation period end must be after period start");
  }

  if (reconciliation.endingBalanceCents !== reconciliation.actualBalanceCents) {
    throw new Error("Ledger reconciliation ending balance must match actual statement balance");
  }

  const statementRowDeltaCents = reconciliation.statementRows.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  if (
    reconciliation.beginningBalanceCents + statementRowDeltaCents !==
    reconciliation.endingBalanceCents
  ) {
    throw new Error(
      "Ledger reconciliation statement rows must bridge beginning and ending balances",
    );
  }

  for (const row of reconciliation.statementRows) {
    if (row.reviewDecision === "matched" && row.matchedLedgerEntryIds.length === 0) {
      throw new Error("Matched statement rows must reference at least one ledger entry");
    }
    if (row.reviewDecision === "unmatched" && row.matchedLedgerEntryIds.length > 0) {
      throw new Error("Unmatched statement rows cannot reference ledger entries");
    }
  }

  const summary = ledgerReconciliationReviewSummary(reconciliation);
  const hasVariance = summary.varianceCents !== 0 || summary.unmatchedStatementRowCount > 0;
  if (hasVariance && !reconciliation.varianceExplanation?.trim()) {
    throw new Error("Variance explanation is required for unmatched reconciliation differences");
  }
  if (reconciliation.status === "matched" && hasVariance) {
    throw new Error("Matched reconciliations cannot contain balance variance or unmatched rows");
  }
}

export function validateLedgerReconciliationExceptionResolutionRecord(
  resolution: LedgerReconciliationExceptionResolutionRecord,
): void {
  if (resolution.statementRow.reviewDecision !== "unmatched") {
    throw new Error("Reconciliation exception resolutions can only reference unmatched rows");
  }
  if (!resolution.resolutionNote.trim()) {
    throw new Error("Reconciliation exception resolution note is required");
  }
  if (!ledgerReconciliationExceptionVarianceDecisions.includes(resolution.varianceDecision)) {
    throw new Error("Reconciliation exception variance decision is invalid");
  }
  if (
    resolution.statementRow.duplicateKey !== ledgerStatementRowDuplicateKey(resolution.statementRow)
  ) {
    throw new Error("Reconciliation exception statement-row duplicate key is invalid");
  }
  if (Number.isNaN(new Date(resolution.recordedAt).getTime())) {
    throw new Error("Reconciliation exception resolution timestamp is invalid");
  }
}

export function validateLedgerStatementImportBatchRecord(
  batch: LedgerStatementImportBatchRecord,
): void {
  if (!batch.sourceLabel.trim()) {
    throw new Error("Statement import batch source label is required");
  }
  if (!/^[a-f0-9]{64}$/.test(batch.checksumSha256)) {
    throw new Error("Statement import batch checksum must be a lowercase SHA-256 hex digest");
  }
  if (!Number.isInteger(batch.importedStatementRowCount) || batch.importedStatementRowCount <= 0) {
    throw new Error("Statement import batch row count must be positive");
  }
  if (
    !Number.isInteger(batch.duplicateStatementRowCount) ||
    batch.duplicateStatementRowCount < 0 ||
    batch.duplicateStatementRowCount > batch.importedStatementRowCount
  ) {
    throw new Error("Statement import batch duplicate count must fit within row count");
  }
  if (!ledgerStatementImportBatchStatuses.includes(batch.status)) {
    throw new Error("Statement import batch status is invalid");
  }
  if (batch.matchingProfileId !== undefined && !batch.matchingProfileId.trim()) {
    throw new Error("Statement import batch matching profile ID cannot be blank");
  }
  if (Number.isNaN(new Date(batch.createdAt).getTime())) {
    throw new Error("Statement import batch timestamp is invalid");
  }
}

function assertIsoTimestamp(value: string, label: string): void {
  if (Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} timestamp is invalid`);
  }
}

export function validateLedgerStatementMatchRuleProfileRecord(
  profile: LedgerStatementMatchRuleProfileRecord,
): void {
  if (!profile.name.trim()) {
    throw new Error("Statement match-rule profile name is required");
  }
  if (!ledgerStatementMatchReferenceStrategies.includes(profile.referenceStrategy)) {
    throw new Error("Statement match-rule reference strategy is invalid");
  }
  if (!ledgerStatementMatchDescriptionStrategies.includes(profile.descriptionStrategy)) {
    throw new Error("Statement match-rule description strategy is invalid");
  }
  if (
    !Number.isInteger(profile.dateWindowDays) ||
    profile.dateWindowDays < 0 ||
    profile.dateWindowDays > 30
  ) {
    throw new Error("Statement match-rule date window must be between 0 and 30 days");
  }
  if (
    !Number.isInteger(profile.amountToleranceCents) ||
    profile.amountToleranceCents < 0 ||
    profile.amountToleranceCents > 100_000
  ) {
    throw new Error("Statement match-rule amount tolerance must be between 0 and 100000 cents");
  }
  if (profile.varianceCategories.length === 0) {
    throw new Error("Statement match-rule profile needs at least one variance category");
  }
  for (const category of profile.varianceCategories) {
    if (!ledgerReconciliationExceptionVarianceDecisions.includes(category)) {
      throw new Error("Statement match-rule variance category is invalid");
    }
  }
  if (profile.reviewOnly !== true) {
    throw new Error("Statement match-rule profiles must be review-only");
  }
  assertIsoTimestamp(profile.createdAt, "Statement match-rule profile created");
  assertIsoTimestamp(profile.updatedAt, "Statement match-rule profile updated");
}

export function validateLedgerAccountingReviewProfileRecord(
  profile: LedgerAccountingReviewProfileRecord,
): void {
  const expectedBoundaryByType: Record<LedgerAccountType, LedgerAccountingBoundaryPosture> = {
    trust_asset: "trust_only",
    client_liability: "trust_only",
    operating_revenue: "operating_only",
    expense: "expense_only",
  };
  if (
    profile.boundaryPosture !== expectedBoundaryByType[profile.accountType] &&
    profile.boundaryPosture !== "review_required"
  ) {
    throw new Error(
      "Accounting review boundary posture must match the account type or require review",
    );
  }
  if (
    !ledgerAccountingProtectedFundsReviewCadences.includes(profile.protectedFunds.reviewCadence)
  ) {
    throw new Error("Accounting protected-funds review cadence is invalid");
  }
  if (profile.protectedFunds.protected && !profile.protectedFunds.reason?.trim()) {
    throw new Error("Protected-funds accounts require a review reason");
  }
  if (!ledgerAccountingBankFeedImportStatuses.includes(profile.bankFeedImport.status)) {
    throw new Error("Accounting bank-feed import status is invalid");
  }
  if (
    profile.bankFeedImport.status !== "not_configured" &&
    !profile.bankFeedImport.sourceLabel?.trim()
  ) {
    throw new Error("Accounting bank-feed shell records require a source label");
  }
  if (profile.bankFeedImport.automaticMatching !== false) {
    throw new Error("Accounting bank-feed shell records cannot enable automatic matching");
  }
  if (
    profile.bankFeedImport.lastImportedAt &&
    Number.isNaN(new Date(profile.bankFeedImport.lastImportedAt).getTime())
  ) {
    throw new Error("Accounting bank-feed import timestamp is invalid");
  }
  if (
    !ledgerAccountingDimensionPostures.includes(profile.dimensions.vendorTracking) ||
    !ledgerAccountingDimensionPostures.includes(profile.dimensions.expenseCategoryTracking)
  ) {
    throw new Error("Accounting dimension posture is invalid");
  }
  if (profile.dimensions.clientMatterTracking !== "required") {
    throw new Error("Accounting review profiles must keep client/matter tracking required");
  }
  if (profile.reviewOnly !== true) {
    throw new Error("Accounting review profiles must be review-only");
  }
  assertIsoTimestamp(profile.createdAt, "Accounting review profile created");
  assertIsoTimestamp(profile.updatedAt, "Accounting review profile updated");
}

function uniqueInOrder<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

const ledgerDayMs = 86_400_000;

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function wholeDaysSince(laterMs: number, earlier: string | undefined): number | undefined {
  const earlierMs = parseTimestamp(earlier);
  if (earlierMs === undefined) return undefined;
  return Math.max(Math.floor((laterMs - earlierMs) / ledgerDayMs), 0);
}

function latestIso(values: Array<string | undefined>): string | undefined {
  const latest = values.reduce<number | undefined>((current, value) => {
    const parsed = parseTimestamp(value);
    if (parsed === undefined) return current;
    return current === undefined || parsed > current ? parsed : current;
  }, undefined);
  return latest === undefined ? undefined : new Date(latest).toISOString();
}

function reconciliationFreshnessPosture(input: {
  daysSinceLatestReviewedStatementPeriod: number | undefined;
  freshWithinDays: number;
  watchWithinDays: number;
}): LedgerReconciliationFreshnessPosture {
  if (input.daysSinceLatestReviewedStatementPeriod === undefined) return "never_reconciled";
  if (input.daysSinceLatestReviewedStatementPeriod <= input.freshWithinDays) return "fresh";
  if (input.daysSinceLatestReviewedStatementPeriod <= input.watchWithinDays) return "watch";
  return "stale";
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function restrictedFundReviewStatus(
  profile: Pick<LegalClinicMatterProfile, "metadata"> | undefined,
): string {
  const metadata = profile?.metadata;
  const restrictedFund =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).restrictedFund
      : undefined;
  if (!restrictedFund || typeof restrictedFund !== "object" || Array.isArray(restrictedFund)) {
    return "not_reviewed";
  }
  return stringMetadata((restrictedFund as Record<string, unknown>).reviewStatus) ?? "not_reviewed";
}

function ledgerReportDimensionsForMatter(
  matter: Pick<Matter, "jurisdiction"> & Partial<Pick<Matter, "practiceArea">>,
  profile: Pick<LegalClinicMatterProfile, "programId" | "metadata"> | undefined,
): LedgerReportDimensions {
  return {
    jurisdiction: matter.jurisdiction,
    practiceArea: matter.practiceArea?.trim() || "Unspecified",
    clinicProgramId: profile?.programId ?? "none",
    restrictedFundReviewStatus: restrictedFundReviewStatus(profile),
  };
}

function ledgerReportDimensionValue(
  dimensions: LedgerReportDimensions,
  groupBy: LedgerReportDimensionGroupKey,
): string {
  return String(dimensions[groupBy]);
}

function ledgerReportDimensionsMatch(
  dimensions: LedgerReportDimensions,
  filters: LedgerReportDimensionFilters,
): boolean {
  return (
    (!filters.jurisdiction || dimensions.jurisdiction === filters.jurisdiction) &&
    (!filters.practiceArea || dimensions.practiceArea === filters.practiceArea) &&
    (!filters.clinicProgramId || dimensions.clinicProgramId === filters.clinicProgramId) &&
    (!filters.restrictedFundReviewStatus ||
      dimensions.restrictedFundReviewStatus === filters.restrictedFundReviewStatus)
  );
}

function reportGroupKeys(input: {
  groupBy: LedgerReportDimensionGroupKey;
  filters: LedgerReportDimensionFilters;
  matters: Array<{ dimensions: LedgerReportDimensions }>;
}): string[] {
  const explicitFilter = input.filters[input.groupBy];
  if (explicitFilter) return [String(explicitFilter)];
  return uniqueInOrder(
    input.matters.map(({ dimensions }) => ledgerReportDimensionValue(dimensions, input.groupBy)),
  ).sort();
}

function ledgerReportDimensionLabel(
  groupBy: LedgerReportDimensionGroupKey,
  dimensionKey: string,
): string {
  if (groupBy === "clinicProgramId" && dimensionKey === "none") return "No clinic program";
  if (groupBy === "restrictedFundReviewStatus" && dimensionKey === "not_reviewed") {
    return "Not reviewed";
  }
  if (dimensionKey === "multiple") return "Multiple";
  return dimensionKey;
}

function singleOrMultiple<T extends string>(values: T[], fallback: T): T | "multiple" {
  const unique = uniqueInOrder(values.filter(Boolean));
  if (unique.length === 0) return fallback;
  if (unique.length === 1) return unique[0]!;
  return "multiple";
}

function ledgerReportAggregateDimensions(
  dimensions: LedgerReportDimensions[],
): LedgerReportDimensions {
  return {
    jurisdiction: singleOrMultiple(
      dimensions
        .map((dimension) => dimension.jurisdiction)
        .filter((jurisdiction): jurisdiction is Province => jurisdiction !== "multiple"),
      "CANADA",
    ),
    practiceArea: singleOrMultiple(
      dimensions.map((dimension) => dimension.practiceArea),
      "Unspecified",
    ),
    clinicProgramId: singleOrMultiple(
      dimensions.map((dimension) => dimension.clinicProgramId),
      "none",
    ),
    restrictedFundReviewStatus: singleOrMultiple(
      dimensions.map((dimension) => dimension.restrictedFundReviewStatus),
      "not_reviewed",
    ),
  };
}

function ledgerReportDimensionsForGroup(input: {
  aggregateDimensions: LedgerReportDimensions;
  groupBy: LedgerReportDimensionGroupKey;
  dimensionKey: string;
}): LedgerReportDimensions {
  if (input.groupBy === "jurisdiction") {
    return {
      ...input.aggregateDimensions,
      jurisdiction: input.dimensionKey as Province,
    };
  }
  return {
    ...input.aggregateDimensions,
    [input.groupBy]: input.dimensionKey,
  };
}

function statementRowDuplicateKey(row: LedgerStatementImportPreviewRowInput): string {
  return ledgerStatementRowDuplicateKey(row);
}

function proposedStatementLedgerMatches(
  row: LedgerStatementImportPreviewRowInput,
  entries: LedgerEntry[],
): LedgerStatementImportPreviewMatch[] {
  const rowDate = statementDateKey(row.postedAt);
  const rowDescription = normalizeStatementText(row.description);
  const rowReference = normalizeStatementText(row.reference ?? "");

  return entries
    .map((entry): LedgerStatementImportPreviewMatch | undefined => {
      const reasons: string[] = [];
      if (entryAmountCents(entry) !== row.amountCents) return undefined;
      reasons.push("amount");

      const entryDate = statementDateKey(entry.postedAt);
      if (entryDate === rowDate) reasons.push("date");

      const entryMemo = normalizeStatementText(entry.memo);
      if (rowDescription && entryMemo.includes(rowDescription)) reasons.push("description");
      if (
        rowReference &&
        [entry.id, entry.transactionId, entry.memo].some((value) =>
          normalizeStatementText(value).includes(rowReference),
        )
      ) {
        reasons.push("reference");
      }

      if (reasons.length === 1) {
        return {
          ledgerEntryId: entry.id,
          transactionId: entry.transactionId,
          postedAt: entry.postedAt,
          amountCents: entryAmountCents(entry),
          memo: entry.memo,
          confidence: "amount_only",
          reasons,
        };
      }

      return {
        ledgerEntryId: entry.id,
        transactionId: entry.transactionId,
        postedAt: entry.postedAt,
        amountCents: entryAmountCents(entry),
        memo: entry.memo,
        confidence:
          reasons.includes("date") &&
          (reasons.includes("description") || reasons.includes("reference"))
            ? "exact"
            : "amount_and_description",
        reasons,
      };
    })
    .filter((match): match is LedgerStatementImportPreviewMatch => Boolean(match))
    .sort((left, right) => matchRank(right) - matchRank(left));
}

function entryAmountCents(entry: Pick<LedgerEntry, "debitCents" | "creditCents">): number {
  return entry.debitCents - entry.creditCents;
}

function statementDateKey(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizeStatementText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchRank(match: LedgerStatementImportPreviewMatch): number {
  return match.confidence === "exact" ? 3 : match.confidence === "amount_and_description" ? 2 : 1;
}

function groupEntriesBy(
  entries: LedgerEntry[],
  keyForEntry: (entry: LedgerEntry) => string,
): Map<string, LedgerEntry[]> {
  const grouped = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    grouped.set(keyForEntry(entry), [...(grouped.get(keyForEntry(entry)) ?? []), entry]);
  }
  return grouped;
}

function accountTouchesMatterSet(entries: LedgerEntry[], matterIds: Set<string>): boolean {
  return entries.some((entry) => matterIds.has(entry.matterId));
}

function transactionIdsForMatterSet(entries: LedgerEntry[], matterIds: Set<string>): Set<string> {
  return new Set(
    entries.filter((entry) => matterIds.has(entry.matterId)).map((entry) => entry.transactionId),
  );
}

function accountIdsForMatterSet(entries: LedgerEntry[], matterIds: Set<string>): Set<string> {
  return new Set(
    entries.filter((entry) => matterIds.has(entry.matterId)).map((entry) => entry.accountId),
  );
}

function trustBalanceForMatterSet(
  trustBalances: Record<string, number>,
  matterIds: Set<string>,
): number {
  return Object.entries(trustBalances)
    .filter(([key]) => {
      const keyParts = key.split(":");
      return keyParts.some((part) => matterIds.has(part));
    })
    .reduce((total, [, balanceCents]) => total + balanceCents, 0);
}

function matterIdFromTrustBalanceKey(
  key: string,
  mattersById: Map<string, Pick<Matter, "id" | "jurisdiction">>,
): string | undefined {
  return key.split(":").find((part) => mattersById.has(part));
}
