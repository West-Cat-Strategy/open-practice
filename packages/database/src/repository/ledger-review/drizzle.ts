import { and, asc, eq } from "drizzle-orm";
import {
  validateLedgerAccountingReviewProfileRecord,
  validateLedgerReconciliationExceptionResolutionRecord,
  validateLedgerReconciliationRecord,
  validateLedgerStatementImportBatchRecord,
  validateLedgerStatementMatchRuleProfileRecord,
  type LedgerAccountingReviewProfileRecord,
  type LedgerReconciliationExceptionResolutionRecord,
  type LedgerReconciliationRecord,
  type LedgerStatementImportBatchRecord,
  type LedgerStatementMatchRuleProfileRecord,
  type LedgerTransactionApprovalRecord,
} from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  mapLedgerAccountingReviewProfileRow,
  mapLedgerApprovalRow,
  mapLedgerReconciliationExceptionResolutionRow,
  mapLedgerReconciliationRow,
  mapLedgerStatementImportBatchRow,
  mapLedgerStatementMatchRuleProfileRow,
} from "../drizzle-mappers.js";

export async function createDrizzleLedgerTransactionApproval(
  db: OpenPracticeDatabase,
  approval: LedgerTransactionApprovalRecord,
): Promise<LedgerTransactionApprovalRecord> {
  const [transaction] = await db
    .select()
    .from(schema.trustTransactions)
    .where(
      and(
        eq(schema.trustTransactions.firmId, approval.firmId),
        eq(schema.trustTransactions.id, approval.transactionId),
      ),
    );
  if (!transaction) {
    throw new Error(`Unknown ledger transaction ${approval.transactionId}`);
  }
  const [duplicateReviewer] = await db
    .select()
    .from(schema.trustTransactionApprovals)
    .where(
      and(
        eq(schema.trustTransactionApprovals.firmId, approval.firmId),
        eq(schema.trustTransactionApprovals.transactionId, approval.transactionId),
        eq(schema.trustTransactionApprovals.decidedByUserId, approval.decidedByUserId),
      ),
    );
  if (duplicateReviewer) {
    throw new Error("Ledger approval reviewer has already recorded a decision");
  }
  await db.insert(schema.trustTransactionApprovals).values({
    ...approval,
    decidedAt: new Date(approval.decidedAt),
  });
  return approval;
}

export async function listDrizzleLedgerTransactionApprovals(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { transactionId?: string } = {},
): Promise<LedgerTransactionApprovalRecord[]> {
  const rows = await db
    .select()
    .from(schema.trustTransactionApprovals)
    .where(
      options.transactionId
        ? and(
            eq(schema.trustTransactionApprovals.firmId, firmId),
            eq(schema.trustTransactionApprovals.transactionId, options.transactionId),
          )
        : eq(schema.trustTransactionApprovals.firmId, firmId),
    );
  return rows.map(mapLedgerApprovalRow);
}

export async function createDrizzleLedgerReconciliation(
  db: OpenPracticeDatabase,
  reconciliation: LedgerReconciliationRecord,
): Promise<LedgerReconciliationRecord> {
  const [account] = await db
    .select()
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.firmId, reconciliation.firmId),
        eq(schema.ledgerAccounts.id, reconciliation.accountId),
      ),
    );
  if (!account) {
    throw new Error(`Unknown ledger account ${reconciliation.accountId}`);
  }
  validateLedgerReconciliationRecord(reconciliation);
  await db.insert(schema.trustReconciliations).values({
    ...reconciliation,
    statementPeriodStart: new Date(reconciliation.statementPeriodStart),
    statementPeriodEnd: new Date(reconciliation.statementPeriodEnd),
    createdAt: new Date(reconciliation.createdAt),
  });
  return reconciliation;
}

export async function listDrizzleLedgerReconciliations(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<LedgerReconciliationRecord[]> {
  const rows = await db
    .select()
    .from(schema.trustReconciliations)
    .where(eq(schema.trustReconciliations.firmId, firmId))
    .orderBy(asc(schema.trustReconciliations.createdAt));
  return rows.map(mapLedgerReconciliationRow);
}

export async function createDrizzleLedgerStatementImportBatch(
  db: OpenPracticeDatabase,
  batch: LedgerStatementImportBatchRecord,
): Promise<LedgerStatementImportBatchRecord> {
  const [account] = await db
    .select()
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.firmId, batch.firmId),
        eq(schema.ledgerAccounts.id, batch.accountId),
      ),
    );
  if (!account || account.type !== "trust_asset") {
    throw new Error("Statement import batches require an existing trust asset account");
  }
  validateLedgerStatementImportBatchRecord(batch);
  if (batch.matchingProfileId) {
    const [matchingProfile] = await db
      .select({ id: schema.trustStatementMatchRuleProfiles.id })
      .from(schema.trustStatementMatchRuleProfiles)
      .where(
        and(
          eq(schema.trustStatementMatchRuleProfiles.firmId, batch.firmId),
          eq(schema.trustStatementMatchRuleProfiles.accountId, batch.accountId),
          eq(schema.trustStatementMatchRuleProfiles.id, batch.matchingProfileId),
        ),
      );
    if (!matchingProfile) {
      throw new Error(
        "Statement import batch matching profile must belong to the same trust asset account",
      );
    }
  }
  await db.insert(schema.trustStatementImportBatches).values({
    ...batch,
    matchingProfileId: batch.matchingProfileId ?? null,
    createdAt: new Date(batch.createdAt),
  });
  return batch;
}

export async function listDrizzleLedgerStatementImportBatches(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { accountId?: string } = {},
): Promise<LedgerStatementImportBatchRecord[]> {
  const rows = await db
    .select()
    .from(schema.trustStatementImportBatches)
    .where(
      options.accountId
        ? and(
            eq(schema.trustStatementImportBatches.firmId, firmId),
            eq(schema.trustStatementImportBatches.accountId, options.accountId),
          )
        : eq(schema.trustStatementImportBatches.firmId, firmId),
    )
    .orderBy(asc(schema.trustStatementImportBatches.createdAt));
  return rows.map(mapLedgerStatementImportBatchRow);
}

export async function createDrizzleLedgerStatementMatchRuleProfile(
  db: OpenPracticeDatabase,
  profile: LedgerStatementMatchRuleProfileRecord,
): Promise<LedgerStatementMatchRuleProfileRecord> {
  const [account] = await db
    .select()
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.firmId, profile.firmId),
        eq(schema.ledgerAccounts.id, profile.accountId),
      ),
    );
  if (!account || account.type !== "trust_asset") {
    throw new Error("Statement match-rule profiles require an existing trust asset account");
  }
  validateLedgerStatementMatchRuleProfileRecord(profile);
  await db.insert(schema.trustStatementMatchRuleProfiles).values({
    ...profile,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
  });
  return profile;
}

export async function listDrizzleLedgerStatementMatchRuleProfiles(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { accountId?: string } = {},
): Promise<LedgerStatementMatchRuleProfileRecord[]> {
  const rows = await db
    .select()
    .from(schema.trustStatementMatchRuleProfiles)
    .where(
      options.accountId
        ? and(
            eq(schema.trustStatementMatchRuleProfiles.firmId, firmId),
            eq(schema.trustStatementMatchRuleProfiles.accountId, options.accountId),
          )
        : eq(schema.trustStatementMatchRuleProfiles.firmId, firmId),
    )
    .orderBy(asc(schema.trustStatementMatchRuleProfiles.createdAt));
  return rows.map(mapLedgerStatementMatchRuleProfileRow);
}

export async function createDrizzleLedgerAccountingReviewProfile(
  db: OpenPracticeDatabase,
  profile: LedgerAccountingReviewProfileRecord,
): Promise<LedgerAccountingReviewProfileRecord> {
  const [account] = await db
    .select()
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.firmId, profile.firmId),
        eq(schema.ledgerAccounts.id, profile.accountId),
      ),
    );
  if (!account) {
    throw new Error(`Unknown ledger account ${profile.accountId}`);
  }
  if (account.type !== profile.accountType) {
    throw new Error("Accounting review profile account type must match the ledger account");
  }
  validateLedgerAccountingReviewProfileRecord(profile);
  await db.insert(schema.ledgerAccountingReviewProfiles).values({
    ...profile,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
  });
  return profile;
}

export async function listDrizzleLedgerAccountingReviewProfiles(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { accountId?: string } = {},
): Promise<LedgerAccountingReviewProfileRecord[]> {
  const rows = await db
    .select()
    .from(schema.ledgerAccountingReviewProfiles)
    .where(
      options.accountId
        ? and(
            eq(schema.ledgerAccountingReviewProfiles.firmId, firmId),
            eq(schema.ledgerAccountingReviewProfiles.accountId, options.accountId),
          )
        : eq(schema.ledgerAccountingReviewProfiles.firmId, firmId),
    )
    .orderBy(asc(schema.ledgerAccountingReviewProfiles.createdAt));
  return rows.map(mapLedgerAccountingReviewProfileRow);
}

export async function createDrizzleLedgerReconciliationExceptionResolution(
  db: OpenPracticeDatabase,
  resolution: LedgerReconciliationExceptionResolutionRecord,
): Promise<LedgerReconciliationExceptionResolutionRecord> {
  const [account] = await db
    .select()
    .from(schema.ledgerAccounts)
    .where(
      and(
        eq(schema.ledgerAccounts.firmId, resolution.firmId),
        eq(schema.ledgerAccounts.id, resolution.accountId),
      ),
    );
  if (!account || account.type !== "trust_asset") {
    throw new Error("Reconciliation exception resolutions require an existing trust asset account");
  }
  validateLedgerReconciliationExceptionResolutionRecord(resolution);
  await db.insert(schema.trustReconciliationExceptionResolutions).values({
    ...resolution,
    recordedAt: new Date(resolution.recordedAt),
  });
  return resolution;
}

export async function listDrizzleLedgerReconciliationExceptionResolutions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { accountId?: string } = {},
): Promise<LedgerReconciliationExceptionResolutionRecord[]> {
  const rows = await db
    .select()
    .from(schema.trustReconciliationExceptionResolutions)
    .where(
      options.accountId
        ? and(
            eq(schema.trustReconciliationExceptionResolutions.firmId, firmId),
            eq(schema.trustReconciliationExceptionResolutions.accountId, options.accountId),
          )
        : eq(schema.trustReconciliationExceptionResolutions.firmId, firmId),
    )
    .orderBy(asc(schema.trustReconciliationExceptionResolutions.recordedAt));
  return rows.map(mapLedgerReconciliationExceptionResolutionRow);
}
