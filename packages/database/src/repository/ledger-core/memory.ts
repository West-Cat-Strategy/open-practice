import {
  clientTrustBalanceByMatter,
  ledgerBalanceByMatter,
  postLedgerTransaction as postDomainLedgerTransaction,
  type Contact,
  type LedgerAccount,
  type LedgerTransaction,
  type Matter,
  type MatterParty,
  type PostedLedgerTransaction,
  type User,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import { userHasFirmWideLedgerAccess } from "../drizzle-mappers.js";
import type { LedgerSnapshot } from "../ledger-core-contracts.js";

export interface MemoryLedgerCoreStore {
  matters: Matter[];
  contacts: Contact[];
  matterParties: MatterParty[];
  ledgerAccounts: LedgerAccount[];
  postedTransactions: PostedLedgerTransaction[];
}

export function getMemoryLedger(
  store: MemoryLedgerCoreStore,
  firmId: string,
  options: { matterId?: string } = {},
): LedgerSnapshot {
  const accounts = store.ledgerAccounts.filter((account) => account.firmId === firmId);
  const entries = store.postedTransactions
    .flatMap((transaction) => transaction.entries)
    .filter(
      (entry) =>
        entry.firmId === firmId && (!options.matterId || entry.matterId === options.matterId),
    );
  return {
    accounts: clone(accounts),
    entries: clone(entries),
    balances: ledgerBalanceByMatter(entries),
    trustBalances: clientTrustBalanceByMatter(entries, accounts),
  };
}

export function validateMemoryLedgerTransactionScope(
  store: MemoryLedgerCoreStore,
  input: {
    user: User;
    transaction: LedgerTransaction;
  },
): void {
  if (input.transaction.firmId !== input.user.firmId) {
    throw new Error("Ledger transaction firm does not match authenticated user");
  }

  const firmWide = userHasFirmWideLedgerAccess(input.user);
  for (const entry of input.transaction.entries) {
    if (entry.firmId !== input.user.firmId) {
      throw new Error("Ledger entry firm does not match authenticated user");
    }
    if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
      throw new Error("Ledger entry is outside the authenticated matter scope");
    }
    const matter = store.matters.find(
      (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
    );
    if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
    const contact = store.contacts.find(
      (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
    );
    if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
    const account = store.ledgerAccounts.find(
      (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
    );
    if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
    const party = store.matterParties.find(
      (candidate) =>
        candidate.firmId === input.user.firmId &&
        candidate.matterId === entry.matterId &&
        candidate.contactId === entry.clientId &&
        !candidate.adverse,
    );
    if (!party) {
      throw new Error("Ledger client must be a non-adverse party on the matter");
    }
  }
}

export function postMemoryLedgerTransaction(
  store: MemoryLedgerCoreStore,
  transaction: LedgerTransaction,
): PostedLedgerTransaction {
  const posted = postDomainLedgerTransaction(
    { postedTransactions: store.postedTransactions, accounts: store.ledgerAccounts },
    transaction,
  );
  if (!store.postedTransactions.some((existing) => existing.id === posted.id)) {
    store.postedTransactions = [...store.postedTransactions, posted];
  }
  return clone(posted);
}
