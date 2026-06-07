import type {
  LedgerAccount,
  LedgerEntry,
  LedgerTransaction,
  PostedLedgerTransaction,
  User,
} from "@open-practice/domain";

export interface LedgerSnapshot {
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
  balances: Record<string, number>;
  trustBalances: Record<string, number>;
}

export interface LedgerCoreRepository {
  getLedger(firmId: string, options?: { matterId?: string }): Promise<LedgerSnapshot>;
  validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void>;
  postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction>;
}
