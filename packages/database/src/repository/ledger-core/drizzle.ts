import {
  clientTrustBalanceByMatter,
  clientTrustBalanceDeltas,
  ledgerBalanceByMatter,
  ledgerRequestFingerprint,
  postLedgerTransaction as postDomainLedgerTransaction,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerTransaction,
  type PostedLedgerTransaction,
  type User,
} from "@open-practice/domain";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { LedgerSnapshot } from "../ledger-core-contracts.js";
import { userHasFirmWideLedgerAccess } from "../drizzle-mappers.js";

export async function getDrizzleLedger(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string } = {},
): Promise<LedgerSnapshot> {
  const accounts = (await db
    .select()
    .from(schema.ledgerAccounts)
    .where(eq(schema.ledgerAccounts.firmId, firmId))) as LedgerAccount[];
  const rows = await db
    .select()
    .from(schema.trustLedgerEntries)
    .where(
      options.matterId
        ? and(
            eq(schema.trustLedgerEntries.firmId, firmId),
            eq(schema.trustLedgerEntries.matterId, options.matterId),
          )
        : eq(schema.trustLedgerEntries.firmId, firmId),
    );
  const transactionRows = await db
    .select()
    .from(schema.trustTransactions)
    .where(eq(schema.trustTransactions.firmId, firmId));
  const postedAtByTransactionId = new Map(
    transactionRows.map((transaction) => [transaction.id, transaction.postedAt.toISOString()]),
  );
  const entries: LedgerEntry[] = rows.map((row) => ({
    id: row.id,
    transactionId: row.transactionId,
    firmId: row.firmId,
    matterId: row.matterId,
    clientId: row.clientId,
    accountId: row.accountId,
    debitCents: row.debitCents,
    creditCents: row.creditCents,
    memo: row.memo,
    postedAt: postedAtByTransactionId.get(row.transactionId) ?? "",
  }));
  return {
    accounts,
    entries,
    balances: ledgerBalanceByMatter(entries),
    trustBalances: clientTrustBalanceByMatter(entries, accounts),
  };
}

export async function validateDrizzleLedgerTransactionScope(
  db: OpenPracticeDatabase,
  input: {
    user: User;
    transaction: LedgerTransaction;
  },
): Promise<void> {
  if (input.transaction.firmId !== input.user.firmId) {
    throw new Error("Ledger transaction firm does not match authenticated user");
  }

  const firmWide = userHasFirmWideLedgerAccess(input.user);
  const matterIds = [...new Set(input.transaction.entries.map((entry) => entry.matterId))];
  const clientIds = [...new Set(input.transaction.entries.map((entry) => entry.clientId))];
  const accountIds = [...new Set(input.transaction.entries.map((entry) => entry.accountId))];

  const [matters, contacts, accounts, parties] = await Promise.all([
    db.select().from(schema.matters).where(inArray(schema.matters.id, matterIds)),
    db.select().from(schema.contacts).where(inArray(schema.contacts.id, clientIds)),
    db.select().from(schema.ledgerAccounts).where(inArray(schema.ledgerAccounts.id, accountIds)),
    db.select().from(schema.matterParties).where(inArray(schema.matterParties.matterId, matterIds)),
  ]);

  for (const entry of input.transaction.entries) {
    if (entry.firmId !== input.user.firmId) {
      throw new Error("Ledger entry firm does not match authenticated user");
    }
    if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
      throw new Error("Ledger entry is outside the authenticated matter scope");
    }
    const matter = matters.find(
      (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
    );
    if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
    const contact = contacts.find(
      (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
    );
    if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
    const account = accounts.find(
      (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
    );
    if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
    const party = parties.find(
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

export async function postDrizzleLedgerTransaction(
  db: OpenPracticeDatabase,
  transaction: LedgerTransaction,
): Promise<PostedLedgerTransaction> {
  return db.transaction(async (tx) => {
    const requestFingerprint =
      transaction.requestFingerprint ?? ledgerRequestFingerprint(transaction);
    const [duplicateTransaction] = await tx
      .select()
      .from(schema.trustTransactions)
      .where(
        and(
          eq(schema.trustTransactions.firmId, transaction.firmId),
          eq(schema.trustTransactions.idempotencyKey, transaction.idempotencyKey),
        ),
      );

    if (duplicateTransaction) {
      if (duplicateTransaction.requestFingerprint !== requestFingerprint) {
        throw new Error("Idempotency key was reused with a different ledger payload");
      }
      const duplicateEntries = await tx
        .select()
        .from(schema.trustLedgerEntries)
        .where(eq(schema.trustLedgerEntries.transactionId, duplicateTransaction.id));
      return {
        id: duplicateTransaction.id,
        firmId: duplicateTransaction.firmId,
        idempotencyKey: duplicateTransaction.idempotencyKey,
        requestFingerprint: duplicateTransaction.requestFingerprint,
        reversesTransactionId: duplicateTransaction.reversesTransactionId ?? undefined,
        entries: duplicateEntries.map((entry) => ({
          id: entry.id,
          transactionId: entry.transactionId,
          firmId: entry.firmId,
          matterId: entry.matterId,
          clientId: entry.clientId,
          accountId: entry.accountId,
          debitCents: entry.debitCents,
          creditCents: entry.creditCents,
          memo: entry.memo,
          postedAt: duplicateTransaction.postedAt.toISOString(),
        })),
      };
    }

    const existingRows = await tx
      .select()
      .from(schema.trustTransactions)
      .where(eq(schema.trustTransactions.firmId, transaction.firmId));
    const entryRows = await tx
      .select()
      .from(schema.trustLedgerEntries)
      .where(eq(schema.trustLedgerEntries.firmId, transaction.firmId));
    const postedTransactions: PostedLedgerTransaction[] = existingRows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      idempotencyKey: row.idempotencyKey,
      requestFingerprint: row.requestFingerprint,
      reversesTransactionId: row.reversesTransactionId ?? undefined,
      entries: entryRows
        .filter((entry) => entry.transactionId === row.id)
        .map((entry) => ({
          id: entry.id,
          transactionId: entry.transactionId,
          firmId: entry.firmId,
          matterId: entry.matterId,
          clientId: entry.clientId,
          accountId: entry.accountId,
          debitCents: entry.debitCents,
          creditCents: entry.creditCents,
          memo: entry.memo,
          postedAt: row.postedAt.toISOString(),
        })),
    }));
    const accounts = (await tx
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.firmId, transaction.firmId))) as LedgerAccount[];
    const posted = postDomainLedgerTransaction(
      { postedTransactions, accounts },
      { ...transaction, requestFingerprint },
    );

    await tx.insert(schema.trustTransactions).values({
      id: posted.id,
      firmId: posted.firmId,
      idempotencyKey: posted.idempotencyKey,
      requestFingerprint: posted.requestFingerprint,
      postedByUserId: transaction.postedByUserId,
      postedAt: new Date(transaction.postedAt),
      reversesTransactionId: posted.reversesTransactionId,
    });
    await tx.insert(schema.trustLedgerEntries).values(posted.entries);

    const updatedAt = new Date(transaction.postedAt);
    for (const delta of clientTrustBalanceDeltas(posted.entries, accounts)) {
      if (delta.deltaCents > 0) {
        await tx
          .insert(schema.trustClientBalances)
          .values({
            firmId: delta.firmId,
            matterId: delta.matterId,
            clientId: delta.clientId,
            balanceCents: delta.deltaCents,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: [
              schema.trustClientBalances.firmId,
              schema.trustClientBalances.matterId,
              schema.trustClientBalances.clientId,
            ],
            set: {
              balanceCents: sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents}`,
              updatedAt,
            },
          });
        continue;
      }

      const updatedBalances = await tx
        .update(schema.trustClientBalances)
        .set({
          balanceCents: sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents}`,
          updatedAt,
        })
        .where(
          and(
            eq(schema.trustClientBalances.firmId, delta.firmId),
            eq(schema.trustClientBalances.matterId, delta.matterId),
            eq(schema.trustClientBalances.clientId, delta.clientId),
            sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents} >= 0`,
          ),
        )
        .returning({ balanceCents: schema.trustClientBalances.balanceCents });
      if (updatedBalances.length === 0) {
        throw new Error("Trust transaction would overdraw the client matter balance");
      }
    }

    return posted;
  });
}
