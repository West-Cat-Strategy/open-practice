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

export interface LedgerReconciliationReviewSummary {
  importedStatementRowCount: number;
  matchedStatementRowCount: number;
  unmatchedStatementRowCount: number;
  varianceCents: number;
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

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}
