import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  LedgerPostingRequestRecord,
  LedgerAccountingReviewProfileRecord,
  LedgerReconciliationExceptionResolutionStatementRow,
  LedgerReconciliationStatementRow,
  LedgerStatementMatchRuleProfileRecord,
} from "@open-practice/domain";
import { contacts } from "./contacts.js";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const ledgerAccountType = pgEnum("ledger_account_type", [
  "trust_asset",
  "client_liability",
  "operating_revenue",
  "expense",
]);

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    type: ledgerAccountType("type").notNull(),
  },
  (table) => ({
    firm: index("ledger_accounts_firm_idx").on(table.firmId),
  }),
);

export const trustTransactions = pgTable(
  "trust_transactions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    postedByUserId: text("posted_by_user_id")
      .notNull()
      .references(() => users.id),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    reversesTransactionId: text("reverses_transaction_id"),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("trust_transactions_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
    firmPosted: index("trust_transactions_firm_posted_idx").on(table.firmId, table.postedAt),
  }),
);

export const trustLedgerEntries = pgTable(
  "trust_ledger_entries",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => trustTransactions.id),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    clientId: text("client_id")
      .notNull()
      .references(() => contacts.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    debitCents: integer("debit_cents").notNull(),
    creditCents: integer("credit_cents").notNull(),
    memo: text("memo").notNull(),
  },
  (table) => ({
    firmMatter: index("trust_ledger_entries_firm_matter_idx").on(table.firmId, table.matterId),
    transaction: index("trust_ledger_entries_transaction_idx").on(table.transactionId),
    nonNegativeAmounts: check(
      "trust_ledger_entries_non_negative_amounts",
      sql`${table.debitCents} >= 0 and ${table.creditCents} >= 0`,
    ),
    oneSidedAmount: check(
      "trust_ledger_entries_one_sided_amount",
      sql`(${table.debitCents} > 0 and ${table.creditCents} = 0) or (${table.creditCents} > 0 and ${table.debitCents} = 0)`,
    ),
  }),
);

export const trustClientBalances = pgTable(
  "trust_client_balances",
  {
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    clientId: text("client_id")
      .notNull()
      .references(() => contacts.id),
    balanceCents: integer("balance_cents").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.firmId, table.matterId, table.clientId] }),
    nonNegativeBalance: check(
      "trust_client_balances_non_negative_balance",
      sql`${table.balanceCents} >= 0`,
    ),
  }),
);

export const trustTransactionApprovals = pgTable(
  "trust_transaction_approvals",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => trustTransactions.id),
    decidedByUserId: text("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    decision: text("decision").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
  },
  (table) => ({
    reviewerDecision: uniqueIndex("trust_transaction_approvals_reviewer_decision_idx").on(
      table.firmId,
      table.transactionId,
      table.decidedByUserId,
    ),
    decisionValue: check(
      "trust_transaction_approvals_decision_value",
      sql`${table.decision} in ('approved', 'rejected')`,
    ),
  }),
);

export const trustPostingRequests = pgTable(
  "trust_posting_requests",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    transactionId: text("transaction_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    status: text("status").notNull().default("pending_approval"),
    proposedPostedAt: timestamp("proposed_posted_at", { withTimezone: true }).notNull(),
    entries: jsonb("entries").$type<LedgerPostingRequestRecord["entries"]>().notNull().default([]),
    matterIds: jsonb("matter_ids")
      .$type<LedgerPostingRequestRecord["matterIds"]>()
      .notNull()
      .default([]),
    clientIds: jsonb("client_ids")
      .$type<LedgerPostingRequestRecord["clientIds"]>()
      .notNull()
      .default([]),
    accountIds: jsonb("account_ids")
      .$type<LedgerPostingRequestRecord["accountIds"]>()
      .notNull()
      .default([]),
    reversesTransactionId: text("reverses_transaction_id").references(() => trustTransactions.id),
    preparedByUserId: text("prepared_by_user_id")
      .notNull()
      .references(() => users.id),
    preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull(),
    preparationNotes: text("preparation_notes"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    rejectionReason: text("rejection_reason"),
    ledgerTransactionId: text("ledger_transaction_id").references(() => trustTransactions.id),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("trust_posting_requests_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
    statusPreparedAt: index("trust_posting_requests_status_prepared_idx").on(
      table.firmId,
      table.status,
      table.preparedAt,
    ),
    transaction: index("trust_posting_requests_transaction_idx").on(
      table.firmId,
      table.transactionId,
    ),
    statusValue: check(
      "trust_posting_requests_status_value",
      sql`${table.status} in ('pending_approval', 'posted', 'rejected')`,
    ),
    entriesPresent: check(
      "trust_posting_requests_entries_present",
      sql`jsonb_array_length(${table.entries}) > 0`,
    ),
    preparedDifferentFromReviewer: check(
      "trust_posting_requests_checker_differs",
      sql`${table.reviewedByUserId} is null or ${table.reviewedByUserId} <> ${table.preparedByUserId}`,
    ),
    postedFields: check(
      "trust_posting_requests_posted_fields",
      sql`${table.status} <> 'posted' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null and ${table.ledgerTransactionId} is not null)`,
    ),
    rejectedFields: check(
      "trust_posting_requests_rejected_fields",
      sql`${table.status} <> 'rejected' or (${table.reviewedByUserId} is not null and ${table.reviewedAt} is not null and ${table.rejectionReason} is not null and length(trim(${table.rejectionReason})) > 0 and ${table.ledgerTransactionId} is null)`,
    ),
  }),
);

export const trustReconciliations = pgTable(
  "trust_reconciliations",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    statementPeriodStart: timestamp("statement_period_start", { withTimezone: true }).notNull(),
    statementPeriodEnd: timestamp("statement_period_end", { withTimezone: true }).notNull(),
    beginningBalanceCents: integer("beginning_balance_cents").notNull(),
    endingBalanceCents: integer("ending_balance_cents").notNull(),
    expectedBalanceCents: integer("expected_balance_cents").notNull(),
    actualBalanceCents: integer("actual_balance_cents").notNull(),
    status: text("status").notNull(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    statementRows: jsonb("statement_rows")
      .$type<LedgerReconciliationStatementRow[]>()
      .notNull()
      .default([]),
    varianceExplanation: text("variance_explanation"),
    evidence: jsonb("evidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    validPeriod: check(
      "trust_reconciliations_valid_period",
      sql`${table.statementPeriodEnd} > ${table.statementPeriodStart}`,
    ),
    statusValue: check(
      "trust_reconciliations_status_value",
      sql`${table.status} in ('draft', 'matched', 'exception', 'reviewed')`,
    ),
  }),
);

export const trustStatementImportBatches = pgTable(
  "trust_statement_import_batches",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    sourceLabel: text("source_label").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    importedStatementRowCount: integer("imported_statement_row_count").notNull(),
    duplicateStatementRowCount: integer("duplicate_statement_row_count").notNull(),
    status: text("status").notNull(),
    matchingProfileId: text("matching_profile_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    accountCreatedAt: index("trust_statement_import_batches_account_created_idx").on(
      table.firmId,
      table.accountId,
      table.createdAt,
    ),
    checksum: index("trust_statement_import_batches_checksum_idx").on(
      table.firmId,
      table.checksumSha256,
    ),
    sourceLabelPresent: check(
      "trust_statement_import_batches_source_label_present",
      sql`length(trim(${table.sourceLabel})) > 0`,
    ),
    checksumValue: check(
      "trust_statement_import_batches_checksum_value",
      sql`${table.checksumSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    positiveRowCount: check(
      "trust_statement_import_batches_positive_row_count",
      sql`${table.importedStatementRowCount} > 0`,
    ),
    duplicateCountRange: check(
      "trust_statement_import_batches_duplicate_count_range",
      sql`${table.duplicateStatementRowCount} >= 0 and ${table.duplicateStatementRowCount} <= ${table.importedStatementRowCount}`,
    ),
    statusValue: check(
      "trust_statement_import_batches_status_value",
      sql`${table.status} in ('previewed', 'review_ready', 'discarded')`,
    ),
    matchingProfilePresent: check(
      "trust_statement_import_batches_matching_profile_present",
      sql`${table.matchingProfileId} is null or length(trim(${table.matchingProfileId})) > 0`,
    ),
  }),
);

export const trustStatementMatchRuleProfiles = pgTable(
  "trust_statement_match_rule_profiles",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    name: text("name").notNull(),
    referenceStrategy: text("reference_strategy")
      .$type<LedgerStatementMatchRuleProfileRecord["referenceStrategy"]>()
      .notNull(),
    descriptionStrategy: text("description_strategy")
      .$type<LedgerStatementMatchRuleProfileRecord["descriptionStrategy"]>()
      .notNull(),
    dateWindowDays: integer("date_window_days").notNull(),
    amountToleranceCents: integer("amount_tolerance_cents").notNull(),
    varianceCategories: jsonb("variance_categories")
      .$type<LedgerStatementMatchRuleProfileRecord["varianceCategories"]>()
      .notNull()
      .default([]),
    reviewerExplanationRequired: boolean("reviewer_explanation_required").notNull().default(true),
    reviewOnly: boolean("review_only").notNull().default(true),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountCreatedAt: index("trust_statement_match_profiles_account_created_idx").on(
      table.firmId,
      table.accountId,
      table.createdAt,
    ),
    namePresent: check(
      "trust_statement_match_profiles_name_present",
      sql`length(trim(${table.name})) > 0`,
    ),
    referenceStrategyValue: check(
      "trust_statement_match_profiles_reference_strategy_value",
      sql`${table.referenceStrategy} in ('strict_reference', 'normalized_reference', 'date_amount_reference', 'amount_only_review')`,
    ),
    descriptionStrategyValue: check(
      "trust_statement_match_profiles_description_strategy_value",
      sql`${table.descriptionStrategy} in ('exact', 'normalized_contains', 'review_required')`,
    ),
    dateWindowRange: check(
      "trust_statement_match_profiles_date_window_range",
      sql`${table.dateWindowDays} >= 0 and ${table.dateWindowDays} <= 30`,
    ),
    toleranceRange: check(
      "trust_statement_match_profiles_tolerance_range",
      sql`${table.amountToleranceCents} >= 0 and ${table.amountToleranceCents} <= 100000`,
    ),
    varianceCategoriesNonempty: check(
      "trust_statement_match_profiles_variance_categories_nonempty",
      sql`jsonb_typeof(${table.varianceCategories}) = 'array' and jsonb_array_length(${table.varianceCategories}) > 0`,
    ),
    reviewOnlyValue: check(
      "trust_statement_match_profiles_review_only_value",
      sql`${table.reviewOnly} = true`,
    ),
  }),
);

export const ledgerAccountingReviewProfiles = pgTable(
  "ledger_accounting_review_profiles",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    accountType: text("account_type")
      .$type<LedgerAccountingReviewProfileRecord["accountType"]>()
      .notNull(),
    boundaryPosture: text("boundary_posture")
      .$type<LedgerAccountingReviewProfileRecord["boundaryPosture"]>()
      .notNull(),
    protectedFunds: jsonb("protected_funds")
      .$type<LedgerAccountingReviewProfileRecord["protectedFunds"]>()
      .notNull(),
    bankFeedImport: jsonb("bank_feed_import")
      .$type<LedgerAccountingReviewProfileRecord["bankFeedImport"]>()
      .notNull(),
    dimensions: jsonb("dimensions")
      .$type<LedgerAccountingReviewProfileRecord["dimensions"]>()
      .notNull(),
    reviewOnly: boolean("review_only").notNull().default(true),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountCreatedAt: index("ledger_accounting_review_profiles_account_created_idx").on(
      table.firmId,
      table.accountId,
      table.createdAt,
    ),
    accountTypeValue: check(
      "ledger_accounting_review_profiles_account_type_value",
      sql`${table.accountType} in ('trust_asset', 'client_liability', 'operating_revenue', 'expense')`,
    ),
    boundaryPostureValue: check(
      "ledger_accounting_review_profiles_boundary_posture_value",
      sql`${table.boundaryPosture} in ('trust_only', 'operating_only', 'expense_only', 'review_required')`,
    ),
    protectedFundsReason: check(
      "ledger_accounting_review_profiles_protected_funds_reason",
      sql`(${table.protectedFunds}->>'protected') <> 'true' or length(trim(coalesce(${table.protectedFunds}->>'reason', ''))) > 0`,
    ),
    bankFeedAutomaticMatchingOff: check(
      "ledger_accounting_review_profiles_bank_feed_auto_match_off",
      sql`${table.bankFeedImport}->>'automaticMatching' = 'false'`,
    ),
    bankFeedSourceLabel: check(
      "ledger_accounting_review_profiles_bank_feed_source_label",
      sql`${table.bankFeedImport}->>'status' = 'not_configured' or length(trim(coalesce(${table.bankFeedImport}->>'sourceLabel', ''))) > 0`,
    ),
    clientMatterTrackingRequired: check(
      "ledger_accounting_review_profiles_client_matter_required",
      sql`${table.dimensions}->>'clientMatterTracking' = 'required'`,
    ),
    reviewOnlyValue: check(
      "ledger_accounting_review_profiles_review_only_value",
      sql`${table.reviewOnly} = true`,
    ),
  }),
);

export const trustReconciliationExceptionResolutions = pgTable(
  "trust_reconciliation_exception_resolutions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    statementRow: jsonb("statement_row")
      .$type<LedgerReconciliationExceptionResolutionStatementRow>()
      .notNull(),
    varianceDecision: text("variance_decision").notNull(),
    resolutionNote: text("resolution_note").notNull(),
    recordedByUserId: text("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    accountRecordedAt: index("trust_reconciliation_exception_resolutions_account_recorded_idx").on(
      table.firmId,
      table.accountId,
      table.recordedAt,
    ),
    varianceDecisionValue: check(
      "trust_reconciliation_exception_resolutions_variance_decision_value",
      sql`${table.varianceDecision} in ('ledger_entry_expected', 'statement_duplicate', 'statement_source_issue', 'operational_variance_acknowledged', 'needs_follow_up')`,
    ),
    resolutionNotePresent: check(
      "trust_reconciliation_exception_resolutions_note_present",
      sql`length(trim(${table.resolutionNote})) > 0`,
    ),
  }),
);
