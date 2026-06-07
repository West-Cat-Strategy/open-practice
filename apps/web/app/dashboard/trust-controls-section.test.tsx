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
        trustControlsStatus: "Trust controls loaded.",
        trustReviewSummary: summarizeTrustControls(controls),
      }),
    );

    expect(html).toContain('class="detail-grid billing-summary-grid"');
    expect(html).toContain("Matter trust balance");
    expect(html).toContain("Trust controls workbench");
    expect(html).toContain("Trust controls loaded.");
    expect(html).toContain("review-only profiles · no automatic matching");
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
        trustControlsStatus: "No matter selected.",
        trustReviewSummary: summarizeTrustControls(controls),
      }),
    );

    expect(html).toContain("0 accounts");
    expect(html).toContain("No accounting review profiles are recorded");
    expect(html).toContain("No bank-feed import batch metadata is recorded");
    expect(html).toContain("No trust ledger postings are linked to this matter yet.");
    expect(html).toContain("No reconciliation exceptions or unreconciled trust accounts");
    expect(html).toContain("Pending approval transaction IDs");
    expect(html).toContain("<small>none</small>");
  });
});
