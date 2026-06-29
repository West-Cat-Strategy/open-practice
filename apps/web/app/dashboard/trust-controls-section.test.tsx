import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TrustControlsDashboardResponse } from "../_features/billing/models";
import {
  emptyTrustControlsDashboard,
  summarizeTrustControls,
  type ActiveJurisdictionTrustReportSummary,
  type RecentTrustPosting,
} from "../trust-controls-dashboard";
import { TrustControlsSection } from "./trust-controls-section";

function formatCurrency(value: number): string {
  return `$${(value / 100).toFixed(2)}`;
}

function compactDate(value: string): string {
  return value.slice(0, 10);
}

function compactStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function buildSyntheticControls(): TrustControlsDashboardResponse {
  const controls = emptyTrustControlsDashboard();

  controls.ledger.accounts = [
    {
      id: "trust_account_synthetic",
      firmId: "firm_synthetic",
      name: "Synthetic Trust Account",
      type: "trust_asset",
    },
  ];
  controls.ledger.entries = [
    {
      id: "ledger_entry_synthetic",
      transactionId: "trust_txn_synthetic",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      clientId: "contact_synthetic",
      accountId: "trust_account_synthetic",
      debitCents: 12500,
      creditCents: 0,
      memo: "Synthetic retainer deposit",
      postedAt: "2026-06-06T00:00:00.000Z",
    },
  ];
  controls.ledger.trustBalances = {
    matter_synthetic: 12500,
  };
  controls.approvals = [
    {
      id: "approval_synthetic",
      firmId: "firm_synthetic",
      transactionId: "trust_txn_synthetic",
      decidedByUserId: "user_synthetic",
      decision: "approved",
      decidedAt: "2026-06-06T00:00:00.000Z",
    },
  ];
  controls.postingRequests = [
    {
      id: "posting_request_pending",
      firmId: "firm_synthetic",
      transactionId: "trust_txn_prepared_pending",
      idempotencyKey: "prepared-pending",
      requestFingerprint: "synthetic:fingerprint:pending",
      status: "pending_approval",
      proposedPostedAt: "2026-06-08T00:00:00.000Z",
      entries: [
        {
          firmId: "firm_synthetic",
          matterId: "matter_synthetic",
          clientId: "contact_synthetic",
          accountId: "trust_account_synthetic",
          debitCents: 100,
          creditCents: 0,
          memo: "Synthetic prepared debit",
        },
        {
          firmId: "firm_synthetic",
          matterId: "matter_synthetic",
          clientId: "contact_synthetic",
          accountId: "trust_account_synthetic",
          debitCents: 0,
          creditCents: 100,
          memo: "Synthetic prepared credit",
        },
      ],
      matterIds: ["matter_synthetic"],
      clientIds: ["contact_synthetic"],
      accountIds: ["trust_account_synthetic"],
      preparedByUserId: "user_preparer",
      preparedAt: "2026-06-08T00:00:00.000Z",
      preparationNotes: "Synthetic preparation note",
    },
    {
      id: "posting_request_rejected",
      firmId: "firm_synthetic",
      transactionId: "trust_txn_prepared_rejected",
      idempotencyKey: "prepared-rejected",
      requestFingerprint: "synthetic:fingerprint:rejected",
      status: "rejected",
      proposedPostedAt: "2026-06-09T00:00:00.000Z",
      entries: [
        {
          firmId: "firm_synthetic",
          matterId: "matter_synthetic",
          clientId: "contact_synthetic",
          accountId: "trust_account_synthetic",
          debitCents: 200,
          creditCents: 0,
          memo: "Synthetic rejected debit",
        },
        {
          firmId: "firm_synthetic",
          matterId: "matter_synthetic",
          clientId: "contact_synthetic",
          accountId: "trust_account_synthetic",
          debitCents: 0,
          creditCents: 200,
          memo: "Synthetic rejected credit",
        },
      ],
      matterIds: ["matter_synthetic"],
      clientIds: ["contact_synthetic"],
      accountIds: ["trust_account_synthetic"],
      preparedByUserId: "user_preparer",
      preparedAt: "2026-06-09T00:00:00.000Z",
      reviewedByUserId: "user_checker",
      reviewedAt: "2026-06-09T01:00:00.000Z",
      rejectionReason: "Synthetic rejection reason",
    },
  ];
  controls.postingRequestSummary = {
    pendingApprovalCount: 1,
    postedCount: 0,
    rejectedCount: 1,
    totalCount: 2,
  };
  controls.reconciliations = [
    {
      id: "reconciliation_synthetic",
      firmId: "firm_synthetic",
      accountId: "trust_account_synthetic",
      statementPeriodStart: "2026-06-01T00:00:00.000Z",
      statementPeriodEnd: "2026-06-30T00:00:00.000Z",
      beginningBalanceCents: 10000,
      endingBalanceCents: 12500,
      expectedBalanceCents: 12500,
      actualBalanceCents: 12400,
      status: "exception",
      statementRows: [
        {
          id: "statement_row_matched",
          postedAt: "2026-06-06T00:00:00.000Z",
          description: "Synthetic matched deposit",
          amountCents: 12500,
          matchedLedgerEntryIds: ["ledger_entry_synthetic"],
          reviewDecision: "matched",
        },
        {
          id: "statement_row_unmatched",
          postedAt: "2026-06-07T00:00:00.000Z",
          description: "Synthetic unmatched fee",
          amountCents: -100,
          matchedLedgerEntryIds: [],
          reviewDecision: "unmatched",
        },
      ],
      varianceExplanation: "Synthetic statement variance requires review.",
      evidence: {},
      createdAt: "2026-06-30T00:00:00.000Z",
    },
  ];
  controls.reconciliationFreshness = {
    generatedAt: "2026-08-15T00:00:00.000Z",
    freshWithinDays: 30,
    watchWithinDays: 60,
    rows: [
      {
        accountId: "trust_account_synthetic",
        accountName: "Synthetic Trust Account",
        posture: "stale",
        daysSinceLatestReviewedStatementPeriod: 46,
        staleDayCount: 16,
        latestReconciliationId: "reconciliation_synthetic",
        latestReconciliationStatus: "exception",
        latestReviewedStatementPeriodStart: "2026-06-01T00:00:00.000Z",
        latestReviewedStatementPeriodEnd: "2026-06-30T00:00:00.000Z",
        exceptionCount: 1,
        importedStatementRowCount: 2,
        matchedStatementRowCount: 1,
        unmatchedStatementRowCount: 1,
        reviewOnly: true,
      },
    ],
    summary: {
      accountCount: 1,
      freshCount: 0,
      watchCount: 0,
      staleCount: 1,
      neverReconciledCount: 0,
      totalStaleDayCount: 16,
      maxStaleDayCount: 16,
      latestReviewedStatementPeriodEnd: "2026-06-30T00:00:00.000Z",
      exceptionCount: 1,
      unmatchedStatementRowCount: 1,
      reviewOnly: true,
    },
    reviewOnly: true,
  };
  controls.balanceSnapshotComparison = {
    generatedAt: "2026-08-15T00:00:00.000Z",
    reviewOnly: true,
    currentTrustBalance: {
      totalCents: 12500,
      balanceCount: 1,
      overdrawnBalanceCount: 1,
    },
    latestPostedTransaction: {
      transactionId: "trust_txn_synthetic",
      postedAt: "2026-06-06T00:00:00.000Z",
      entryCount: 1,
      matterCount: 1,
      clientCount: 1,
      accountCount: 1,
      trustAssetDeltaCents: 12500,
      clientLiabilityDeltaCents: 0,
      reversal: false,
    },
    latestReconciliationPreview: {
      importBatchId: "import_batch_synthetic",
      accountId: "trust_account_synthetic",
      accountName: "Synthetic Trust Account",
      status: "review_ready",
      createdAt: "2026-06-06T00:00:00.000Z",
      importedStatementRowCount: 2,
      duplicateStatementRowCount: 1,
      matchingProfilePresent: true,
      sourceLabelPresent: true,
      storagePosture: "metadata_only_no_statement_rows",
    },
    latestReconciliationSnapshot: {
      reconciliationId: "reconciliation_synthetic",
      accountId: "trust_account_synthetic",
      accountName: "Synthetic Trust Account",
      status: "exception",
      statementPeriodEnd: "2026-06-30T00:00:00.000Z",
      expectedBalanceCents: 12500,
      actualBalanceCents: 12400,
      varianceCents: -100,
      unmatchedStatementRowCount: 1,
    },
    reviewReasons: [
      "overdrawn_trust_balance",
      "reconciliation_variance",
      "unmatched_statement_rows",
    ],
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
  controls.reconciliationPacketReview = {
    generatedAt: "2026-08-15T00:00:00.000Z",
    reviewOnly: true,
    packets: [
      {
        kind: "ledger",
        label: "Ledger evidence",
        evidenceCount: 2,
        reviewCueCount: 3,
        pendingCount: 1,
        exceptionCount: 1,
        conflictCount: 1,
        amountCents: 12500,
        latestEvidenceAt: "2026-06-06T00:40:00.000Z",
        posture: "needs_review",
        reviewOnly: true,
      },
      {
        kind: "statement_import",
        label: "Statement import evidence",
        evidenceCount: 1,
        reviewCueCount: 2,
        pendingCount: 1,
        exceptionCount: 0,
        conflictCount: 1,
        amountCents: 0,
        latestEvidenceAt: "2026-06-06T00:00:00.000Z",
        posture: "needs_review",
        reviewOnly: true,
      },
      {
        kind: "exception",
        label: "Exception evidence",
        evidenceCount: 1,
        reviewCueCount: 2,
        pendingCount: 1,
        exceptionCount: 1,
        conflictCount: 1,
        amountCents: 100,
        latestEvidenceAt: "2026-06-30T00:00:00.000Z",
        posture: "needs_review",
        reviewOnly: true,
      },
      {
        kind: "trust_transfer",
        label: "Trust transfer evidence",
        evidenceCount: 1,
        reviewCueCount: 1,
        pendingCount: 1,
        exceptionCount: 0,
        conflictCount: 0,
        amountCents: 12500,
        latestEvidenceAt: "2026-06-06T00:30:00.000Z",
        posture: "needs_review",
        reviewOnly: true,
      },
      {
        kind: "posting_request",
        label: "Posting request evidence",
        evidenceCount: 2,
        reviewCueCount: 1,
        pendingCount: 1,
        exceptionCount: 1,
        conflictCount: 0,
        amountCents: 300,
        latestEvidenceAt: "2026-06-09T01:00:00.000Z",
        posture: "needs_review",
        reviewOnly: true,
      },
      {
        kind: "payment_import",
        label: "Payment import evidence",
        evidenceCount: 1,
        reviewCueCount: 1,
        pendingCount: 1,
        exceptionCount: 0,
        conflictCount: 1,
        amountCents: 999,
        latestEvidenceAt: "2026-06-06T00:50:00.000Z",
        posture: "needs_review",
        reviewOnly: true,
      },
    ],
    summary: {
      packetCount: 6,
      evidenceCount: 8,
      reviewCueCount: 10,
      packetsNeedingReviewCount: 6,
      latestEvidenceAt: "2026-06-30T00:00:00.000Z",
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
  controls.makerCheckerReadiness = {
    generatedAt: "2026-08-15T00:00:00.000Z",
    reviewOnly: true,
    categories: [
      {
        category: "ledger",
        label: "Ledger evidence",
        evidenceCount: 2,
        reviewCueCount: 3,
        pendingCount: 1,
        exceptionCount: 1,
        conflictCount: 0,
        amountCents: 12500,
        readiness: "policy_required_if_enabled",
        reasonCodes: ["pending_ledger_transaction_approval", "overdrawn_trust_balance"],
        reviewOnly: true,
      },
      {
        category: "posting_request",
        label: "Posting request evidence",
        evidenceCount: 2,
        reviewCueCount: 2,
        pendingCount: 1,
        exceptionCount: 1,
        conflictCount: 0,
        amountCents: 300,
        readiness: "policy_required_if_enabled",
        reasonCodes: ["pending_posting_request", "rejected_posting_request"],
        reviewOnly: true,
      },
      {
        category: "payment_import",
        label: "Payment import evidence",
        evidenceCount: 1,
        reviewCueCount: 1,
        pendingCount: 1,
        exceptionCount: 0,
        conflictCount: 1,
        amountCents: 999,
        readiness: "policy_required_if_enabled",
        reasonCodes: ["payment_import_review_required", "payment_import_conflict"],
        reviewOnly: true,
      },
    ],
    matters: [
      {
        matterId: "matter_synthetic",
        categoryKeys: ["ledger", "posting_request", "payment_import"],
        reasonCodes: ["pending_posting_request", "payment_import_conflict"],
        reviewCueCount: 4,
        pendingCount: 3,
        exceptionCount: 1,
        amountCents: 13799,
        latestEvidenceAt: "2026-06-09T01:00:00.000Z",
        reviewOnly: true,
      },
    ],
    summary: {
      categoryCount: 3,
      categoriesRequiringPolicyCount: 3,
      matterCount: 1,
      mattersRequiringPolicyCount: 1,
      reviewCueCount: 6,
      pendingCount: 3,
      exceptionCount: 2,
      amountCents: 13799,
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
  controls.accountingReview.matchRuleProfiles = [
    {
      id: "match_profile_synthetic",
      firmId: "firm_synthetic",
      accountId: "trust_account_synthetic",
      name: "Synthetic review profile",
      referenceStrategy: "strict_reference",
      descriptionStrategy: "normalized_contains",
      dateWindowDays: 3,
      amountToleranceCents: 100,
      varianceCategories: ["needs_follow_up"],
      reviewerExplanationRequired: true,
      reviewOnly: true,
      createdByUserId: "user_synthetic",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
    },
  ];
  controls.accountingReview.accountingProfiles = [
    {
      id: "accounting_profile_protected",
      firmId: "firm_synthetic",
      accountId: "trust_account_synthetic",
      accountType: "trust_asset",
      boundaryPosture: "trust_only",
      protectedFunds: {
        protected: true,
        reason: "Synthetic protected client funds",
        reviewCadence: "monthly",
      },
      bankFeedImport: {
        status: "metadata_only",
        sourceLabel: "Synthetic bank feed",
        automaticMatching: false,
      },
      dimensions: {
        vendorTracking: "required",
        expenseCategoryTracking: "optional",
        clientMatterTracking: "required",
      },
      reviewOnly: true,
      createdByUserId: "user_synthetic",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
    },
  ];
  controls.accountingReview.importBatches = [
    {
      id: "import_batch_synthetic",
      firmId: "firm_synthetic",
      accountId: "trust_account_synthetic",
      sourceLabel: "Synthetic CSV import",
      checksumSha256: "synthetic-checksum",
      importedStatementRowCount: 2,
      duplicateStatementRowCount: 1,
      status: "review_ready",
      matchingProfileId: "match_profile_synthetic",
      createdByUserId: "user_synthetic",
      createdAt: "2026-06-06T00:00:00.000Z",
    },
  ];
  controls.accountingReview.summary = {
    matchRuleProfileCount: 1,
    accountingProfileCount: 1,
    protectedAccountCount: 1,
    bankFeedShellCount: 1,
    reviewOnly: true,
  };
  controls.accountingReview.bankFeedReviewSummary = {
    bankFeedShellCount: 1,
    metadataOnlyFeedCount: 1,
    reviewReadyFeedCount: 0,
    importBatchCount: 1,
    previewedImportBatchCount: 0,
    reviewReadyImportBatchCount: 1,
    discardedImportBatchCount: 0,
    importedStatementRowCount: 2,
    duplicateStatementRowCount: 1,
    completedReconciliationCount: 0,
    exceptionReconciliationCount: 1,
    accountsPendingReconciliationCount: 1,
    protectedFundsFeedCount: 1,
    automaticMatching: false,
    automaticLedgerPosting: false,
    automaticReconciliation: false,
    liveBankFeedConnection: false,
    trustDisbursementAutomation: false,
    importBatchStoragePosture: "metadata_only_no_statement_rows",
    reviewOnly: true,
  };
  controls.diagnostics = {
    pendingApprovalTransactionIds: ["pending_txn_synthetic"],
    rejectedApprovalTransactionIds: ["rejected_txn_synthetic"],
    unreconciledAccountIds: ["trust_account_synthetic"],
    exceptionReconciliationIds: ["reconciliation_synthetic"],
    overdrawnBalanceKeys: ["matter_synthetic:trust_account_synthetic"],
  };
  controls.financialCommandJournal = {
    scope: { kind: "matter", matterId: "matter_synthetic" },
    chainValid: true,
    reviewOnly: true,
    entries: [
      {
        auditEventId: "audit_ledger_approval_synthetic",
        actorId: "user_synthetic",
        occurredAt: "2026-06-06T00:40:00.000Z",
        action: "ledger.transaction_approval.decided",
        family: "trust_transaction",
        decision: "approved",
        resourceType: "ledger_transaction_approval",
        resourceId: "approval_synthetic",
        matterIds: ["matter_synthetic"],
        transactionId: "trust_txn_synthetic",
        status: "approved",
      },
      {
        auditEventId: "audit_trust_transfer_synthetic",
        actorId: "user_synthetic",
        occurredAt: "2026-06-06T00:30:00.000Z",
        action: "trust_transfer_request.approved",
        family: "trust_transfer",
        decision: "approved",
        resourceType: "trust_transfer_request",
        resourceId: "trust_transfer_synthetic",
        matterId: "matter_synthetic",
        invoiceId: "invoice_synthetic",
        trustTransferRequestId: "trust_transfer_synthetic",
        previousStatus: "pending_approval",
        status: "approved",
        amountCents: 12500,
        evidencePresent: true,
      },
      {
        auditEventId: "audit_invoice_synthetic",
        actorId: "user_synthetic",
        occurredAt: "2026-06-06T00:20:00.000Z",
        action: "invoice.approved",
        family: "invoice_approval",
        decision: "approved",
        resourceType: "invoice",
        resourceId: "invoice_synthetic",
        matterId: "matter_synthetic",
        invoiceId: "invoice_synthetic",
        totalCents: 12500,
        balanceDueCents: 12500,
      },
      {
        auditEventId: "audit_reconciliation_synthetic",
        actorId: "user_synthetic",
        occurredAt: "2026-06-06T00:10:00.000Z",
        action: "ledger.reconciliation.created",
        family: "reconciliation",
        decision: "exception",
        resourceType: "ledger_reconciliation",
        resourceId: "reconciliation_synthetic",
        accountId: "trust_account_synthetic",
        statementRowCount: 2,
        matchedStatementRowCount: 1,
        unmatchedStatementRowCount: 1,
        varianceCents: -100,
      },
    ],
    summary: {
      total: 4,
      byFamily: {
        trust_transfer: 1,
        trust_transaction: 1,
        invoice_approval: 1,
        reconciliation: 1,
      },
      byDecision: {
        approved: 3,
        exception: 1,
      },
    },
    policy: {
      source: "audit_metadata",
      rawMetadataValues: "redacted_allowlisted_cues_only",
      postingAutomation: false,
      settlementAutomation: false,
      publicExposure: false,
    },
  };

  return controls;
}

const jurisdictionSummary: ActiveJurisdictionTrustReportSummary = {
  jurisdiction: "BC",
  matterCount: 1,
  trustBalanceCents: 12500,
  pendingApprovalCount: 1,
  rejectedApprovalCount: 1,
  exceptionReconciliationCount: 1,
  importedStatementRowCount: 2,
  matchedStatementRowCount: 1,
  unmatchedStatementRowCount: 1,
  totalVarianceCents: -100,
  unreconciledAccountCount: 1,
  overdrawnBalanceCount: 1,
  compliancePosture: "operational_controls_only_not_jurisdiction_certified",
};

const recentPosting: RecentTrustPosting = {
  transactionId: "trust_txn_synthetic",
  postedAt: "2026-06-06T00:00:00.000Z",
  memo: "Synthetic retainer deposit",
  entryCount: 1,
  matterDeltaCents: 12500,
};

describe("TrustControlsSection", () => {
  it("renders trust control review depth without changing copy or classes", () => {
    const controls = buildSyntheticControls();
    const html = renderToStaticMarkup(
      createElement(TrustControlsSection, {
        activeJurisdictionTrustSummary: jurisdictionSummary,
        activeTrustBalanceCents: 12500,
        activeTrustControls: controls,
        activeTrustPostings: [recentPosting],
        compactDate,
        compactStatus,
        formatCurrency,
        onReviewPostingRequest: () => {},
        postingRequestActionKey: "",
        trustControlsStatus: "Trust controls loaded.",
        trustReviewSummary: summarizeTrustControls(controls),
      }),
    );

    expect(html).toContain('class="detail-grid billing-summary-grid"');
    expect(html).toContain("Matter trust balance");
    expect(html).toContain("Trust controls workbench");
    expect(html).toContain("Trust controls loaded.");
    expect(html).toContain("Balance snapshot comparison");
    expect(html).toContain("3 review cues · no posting");
    expect(html).toContain("Overdrawn trust balance");
    expect(html).toContain("latest import batch metadata only no statement rows");
    expect(html).toContain("Comparison boundary");
    expect(html).toContain("Financial command journal");
    expect(html).toContain("4 decisions · audit chain valid");
    expect(html).toContain("Trust transaction · approval_synthetic");
    expect(html).toContain("transaction trust_txn_synthetic");
    expect(html).toContain("ledger.transaction_approval.decided");
    expect(html).toContain("Trust transfer · trust_transfer_synthetic");
    expect(html).toContain("invoice invoice_synthetic");
    expect(html).toContain("reviewer evidence");
    expect(html).toContain("redacted allowlisted cues only");
    expect(html).toContain("Prepared posting requests");
    expect(html).toContain("trust_txn_prepared_pending");
    expect(html).toContain("pending approval");
    expect(html).toContain('data-action-key="ledger_posting_request.approve"');
    expect(html).toContain('data-action-key="ledger_posting_request.reject"');
    expect(html).toContain('aria-label="Approve"');
    expect(html).toContain('aria-label="Reject"');
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
    expect(html).toContain("rejection reason recorded");
    expect(html).not.toContain("Synthetic preparation note");
    expect(html).not.toContain("Synthetic rejection reason");
    expect(html).toContain("review-only profiles · no automatic matching");
    expect(html).toContain("Reconciliation freshness");
    expect(html).toContain("0 fresh · 0 watch · 1 stale · 0 never reconciled");
    expect(html).toContain("reviewed through 2026-06-30");
    expect(html).toContain("1 unmatched · 1 exceptions · 16 stale days");
    expect(html).toContain("Reconciliation packet summaries");
    expect(html).toContain("8 evidence records · 10 review cues");
    expect(html).toContain("6 packets");
    expect(html).toContain("6 need review");
    expect(html).toContain("Ledger evidence");
    expect(html).toContain("Payment import evidence");
    expect(html).toContain("Invoice mutation explicit command only");
    expect(html).toContain("No live settlement · no provider commands · no public exposure");
    expect(html).toContain("Maker-checker readiness");
    expect(html).toContain("3 categories · 1 matters");
    expect(html).toContain("policy required if enabled");
    expect(html).toContain("pending posting request");
    expect(html).toContain("payment import conflict");
    expect(html).toContain("Policy enabled false");
    expect(html).toContain("direct postings unchanged");
    expect(html).toContain(
      "No approval mutation · no auto-posting · no settlement or bank-feed matching",
    );
    expect(html).toContain("readiness only");
    expect(html).toContain("metadata only · manual review required");
    expect(html).toContain("No auto-match · no ledger posting · no live feed");
    expect(html).toContain("operator review only · not jurisdiction-certified");
    expect(html).toContain("Synthetic review profile");
    expect(html).toContain("Synthetic Trust Account");
    expect(html).toContain("Synthetic CSV import");
    expect(html).toContain("Synthetic statement variance requires review.");
    expect(html).toContain("Pending approval transaction IDs");
    expect(html).toContain("rejected_txn_synthetic");
    expect(html).toContain("matter_synthetic:trust_account_synthetic");
  });

  it("keeps empty trust-control states visible", () => {
    const controls = emptyTrustControlsDashboard();
    const html = renderToStaticMarkup(
      createElement(TrustControlsSection, {
        activeJurisdictionTrustSummary: {
          ...jurisdictionSummary,
          matterCount: 0,
          trustBalanceCents: 0,
          pendingApprovalCount: 0,
          rejectedApprovalCount: 0,
          exceptionReconciliationCount: 0,
          importedStatementRowCount: 0,
          matchedStatementRowCount: 0,
          unmatchedStatementRowCount: 0,
          totalVarianceCents: 0,
          unreconciledAccountCount: 0,
          overdrawnBalanceCount: 0,
        },
        activeTrustBalanceCents: 0,
        activeTrustControls: controls,
        activeTrustPostings: [],
        compactDate,
        compactStatus,
        formatCurrency,
        onReviewPostingRequest: () => {},
        postingRequestActionKey: "",
        trustControlsStatus: "No matter selected.",
        trustReviewSummary: summarizeTrustControls(controls),
      }),
    );

    expect(html).toContain("0 accounts");
    expect(html).toContain("No financial command journal entries are present");
    expect(html).toContain("Maker-checker readiness");
    expect(html).toContain("0 categories · 0 matters");
    expect(html).toContain(
      "No maker-checker readiness cues are present in the current controls payload.",
    );
    expect(html).toContain("Policy enabled false");
    expect(html).toContain("direct postings unchanged");
    expect(html).toContain("Reconciliation packet summaries");
    expect(html).toContain("No reconciliation evidence");
    expect(html).toContain("0 packets");
    expect(html).toContain("0 need review");
    expect(html).toContain(
      "No reconciliation evidence is present in the current controls payload.",
    );
    expect(html).not.toContain("Ledger evidence");
    expect(html).not.toContain("Payment import evidence");
    expect(html).toContain("No accounting review profiles are recorded");
    expect(html).toContain("No bank-feed import batch metadata is recorded");
    expect(html).toContain("No prepared posting requests are present");
    expect(html).toContain("No trust balances");
    expect(html).toContain("No preview metadata");
    expect(html).toContain(
      "No stale, unreconciled, or exception freshness rows are present in the current controls payload.",
    );
    expect(html).toContain("No trust ledger postings are linked to this matter yet.");
    expect(html).toContain("No reconciliation exceptions or unreconciled trust accounts");
    expect(html).toContain("Pending approval transaction IDs");
    expect(html).toContain("<small>none</small>");
  });

  it("shows invalid audit-chain state for the command journal", () => {
    const controls = emptyTrustControlsDashboard();
    controls.financialCommandJournal.chainValid = false;
    const html = renderToStaticMarkup(
      createElement(TrustControlsSection, {
        activeJurisdictionTrustSummary: jurisdictionSummary,
        activeTrustBalanceCents: 0,
        activeTrustControls: controls,
        activeTrustPostings: [],
        compactDate,
        compactStatus,
        formatCurrency,
        onReviewPostingRequest: () => {},
        postingRequestActionKey: "",
        trustControlsStatus: "Trust controls loaded.",
        trustReviewSummary: summarizeTrustControls(controls),
      }),
    );

    expect(html).toContain("0 decisions · audit chain invalid");
    expect(html).toContain("Audit chain requires review");
    expect(html).toContain("Use the audit log before relying on this financial journal.");
  });

  it("renders trust posting review busy descriptors without leaking request notes", () => {
    const controls = buildSyntheticControls();
    const html = renderToStaticMarkup(
      createElement(TrustControlsSection, {
        activeJurisdictionTrustSummary: jurisdictionSummary,
        activeTrustBalanceCents: 12500,
        activeTrustControls: controls,
        activeTrustPostings: [recentPosting],
        compactDate,
        compactStatus,
        formatCurrency,
        onReviewPostingRequest: () => {},
        postingRequestActionKey: "approved:posting_request_pending",
        trustControlsStatus: "Trust controls loaded.",
        trustReviewSummary: summarizeTrustControls(controls),
      }),
    );

    expect(html).toContain('aria-label="Approving: approval in progress"');
    expect(html).toContain('title="Approving: approval in progress"');
    expect(html).toContain('aria-label="Reject: review action in progress"');
    expect(html).toContain('title="Reject: review action in progress"');
    expect(html).toContain('data-action-key="ledger_posting_request.approve"');
    expect(html).toContain('data-action-key="ledger_posting_request.reject"');
    expect(html).toContain("Approving");
    expect(html).not.toContain("Synthetic preparation note");
    expect(html).not.toContain("Synthetic rejection reason");
  });
});
