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

export interface LedgerReconciliationRecord {
  id: string;
  firmId: string;
  accountId: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  expectedBalanceCents: number;
  actualBalanceCents: number;
  status: LedgerReconciliationStatus;
  reviewedByUserId?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
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
