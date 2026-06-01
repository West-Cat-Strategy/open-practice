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

export interface JurisdictionalTrustReportSummary {
  jurisdiction: Province;
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
  matters: Array<Pick<Matter, "id" | "jurisdiction">>;
  ledger: LedgerControlsLedgerSnapshot;
  approvals: LedgerTransactionApprovalRecord[];
  reconciliations: LedgerReconciliationRecord[];
  diagnostics: LedgerControlsDiagnostics;
  jurisdiction?: Province;
}): JurisdictionalTrustReport {
  const mattersById = new Map(input.matters.map((matter) => [matter.id, matter]));
  const jurisdictions = input.jurisdiction
    ? [input.jurisdiction]
    : uniqueInOrder(input.matters.map((matter) => matter.jurisdiction)).sort();
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
    compliancePosture: "operational_controls_only_not_jurisdiction_certified",
    summaries: jurisdictions.map((jurisdiction) => {
      const matterIds = new Set(
        input.matters
          .filter((matter) => matter.jurisdiction === jurisdiction)
          .map((matter) => matter.id),
      );
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
        jurisdiction,
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
