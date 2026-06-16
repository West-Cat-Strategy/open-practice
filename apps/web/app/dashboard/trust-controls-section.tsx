import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  Clock3,
  FileText,
  ShieldCheck,
} from "lucide-react";

import type { TrustControlsDashboardResponse } from "../_features/billing/models";
import {
  accountLabel,
  describeBankFeedImportBatch,
  describeBankFeedReviewBoundary,
  type ActiveJurisdictionTrustReportSummary,
  type RecentTrustPosting,
  type TrustReviewSummary,
} from "../trust-controls-dashboard";

interface TrustControlsSectionProps {
  activeJurisdictionTrustSummary: ActiveJurisdictionTrustReportSummary;
  activeTrustBalanceCents: number;
  activeTrustControls: TrustControlsDashboardResponse;
  activeTrustPostings: RecentTrustPosting[];
  compactDate: (value: string) => string;
  compactStatus: (value: string) => string;
  formatCurrency: (value: number) => string;
  trustControlsStatus: string;
  trustReviewSummary: TrustReviewSummary;
}

export function TrustControlsSection({
  activeJurisdictionTrustSummary,
  activeTrustBalanceCents,
  activeTrustControls,
  activeTrustPostings,
  compactDate,
  compactStatus,
  formatCurrency,
  trustControlsStatus,
  trustReviewSummary,
}: TrustControlsSectionProps) {
  const accountingReview = activeTrustControls.accountingReview;
  const accountingSummary = accountingReview.summary;
  const bankFeedReviewSummary = accountingReview.bankFeedReviewSummary;
  const bankFeedImportBatches = accountingReview.importBatches;
  const protectedAccountingProfiles = accountingReview.accountingProfiles.filter(
    (profile) => profile.protectedFunds.protected,
  );
  const bankFeedAccountingProfiles = accountingReview.accountingProfiles.filter(
    (profile) => profile.bankFeedImport.status !== "not_configured",
  );
  const exceptionReconciliations = activeTrustControls.reconciliations.filter(
    (reconciliation) =>
      reconciliation.status === "exception" ||
      activeTrustControls.diagnostics.exceptionReconciliationIds.includes(reconciliation.id),
  );
  const unreconciledAccounts = activeTrustControls.diagnostics.unreconciledAccountIds.map(
    (accountId) => ({
      id: accountId,
      label: accountLabel(activeTrustControls, accountId),
    }),
  );
  const postingRequests = activeTrustControls.postingRequests.slice(0, 5);

  return (
    <>
      <div className="detail-grid billing-summary-grid">
        <div>
          <span className="field-label">Matter trust balance</span>
          <strong>{formatCurrency(activeTrustBalanceCents)}</strong>
        </div>
        <div>
          <span className="field-label">Pending maker-checker</span>
          <strong>{trustReviewSummary.pendingApprovalCount}</strong>
        </div>
        <div>
          <span className="field-label">Rejected decisions</span>
          <strong>{trustReviewSummary.rejectedApprovalCount}</strong>
        </div>
        <div>
          <span className="field-label">Prepared postings</span>
          <strong>{trustReviewSummary.pendingPostingRequestCount}</strong>
        </div>
        <div>
          <span className="field-label">Exceptions</span>
          <strong>{trustReviewSummary.exceptionReconciliationCount}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Trust controls workbench</h3>
        <span>{trustControlsStatus}</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <Banknote size={18} />
          <strong>{activeTrustControls.ledger.accounts.length} accounts</strong>
          <span>{activeTrustControls.ledger.entries.length} matter-scoped entries</span>
        </div>
        <div className="activity-card">
          <ShieldCheck size={18} />
          <strong>{trustReviewSummary.totalApprovalCount} decisions</strong>
          <span>{trustReviewSummary.approvedApprovalCount} approved review records</span>
        </div>
        <div className="activity-card">
          <AlertTriangle size={18} />
          <strong>{trustReviewSummary.unreconciledAccountCount} unreconciled</strong>
          <span>{trustReviewSummary.overdrawnBalanceCount} overdrawn diagnostics</span>
        </div>
        <div className="activity-card">
          <FileText size={18} />
          <strong>{trustReviewSummary.importedStatementRowCount} statement rows</strong>
          <span>
            {trustReviewSummary.matchedStatementRowCount} matched ·{" "}
            {trustReviewSummary.unmatchedStatementRowCount} unmatched
          </span>
        </div>
        <div className="activity-card">
          <ClipboardCheck size={18} />
          <strong>{trustReviewSummary.totalPostingRequestCount} prepared postings</strong>
          <span>
            {trustReviewSummary.pendingPostingRequestCount} pending ·{" "}
            {trustReviewSummary.postedPostingRequestCount} posted ·{" "}
            {trustReviewSummary.rejectedPostingRequestCount} rejected
          </span>
        </div>
        <div className="activity-card">
          <Clock3 size={18} />
          <strong>{activeTrustPostings.length} recent postings</strong>
          <span>{formatCurrency(trustReviewSummary.totalVarianceCents)} total variance</span>
        </div>
        <div className="activity-card">
          <FileText size={18} />
          <strong>{accountingSummary.matchRuleProfileCount} match profiles</strong>
          <span>{accountingSummary.accountingProfileCount} accounting review records</span>
        </div>
        <div className="activity-card">
          <ShieldCheck size={18} />
          <strong>{accountingSummary.protectedAccountCount} protected cues</strong>
          <span>{accountingSummary.bankFeedShellCount} bank-feed shells</span>
        </div>
      </div>

      <div className="section-title">
        <h3>Prepared posting requests</h3>
        <span>checker approval before posting</span>
      </div>
      <div className="party-list">
        {postingRequests.map((postingRequest) => (
          <div className="party-row" key={postingRequest.id}>
            <span>
              <strong>{postingRequest.transactionId}</strong>
              <small>
                {postingRequest.entries.length} entries · prepared{" "}
                {compactDate(postingRequest.preparedAt)} · {postingRequest.matterIds.length} matters
              </small>
              <small>
                {postingRequest.ledgerTransactionId
                  ? `posted as ${postingRequest.ledgerTransactionId}`
                  : postingRequest.rejectionReason
                    ? "rejection reason recorded"
                    : "awaiting checker decision"}
              </small>
            </span>
            <em className={postingRequest.status === "rejected" ? "risk" : undefined}>
              {compactStatus(postingRequest.status)}
            </em>
          </div>
        ))}
        {postingRequests.length === 0 ? (
          <p className="inline-empty">
            No prepared posting requests are present for the current controls payload.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Accounting review depth</h3>
        <span>review-only profiles · no automatic matching</span>
      </div>
      <div className="party-list">
        {accountingReview.matchRuleProfiles.slice(0, 4).map((profile) => (
          <div className="party-row" key={profile.id}>
            <span>
              <strong>{profile.name}</strong>
              <small>
                {accountLabel(activeTrustControls, profile.accountId)} ·{" "}
                {profile.referenceStrategy.replaceAll("_", " ")} ·{" "}
                {profile.descriptionStrategy.replaceAll("_", " ")}
              </small>
              <small>
                {profile.dateWindowDays} day window · {formatCurrency(profile.amountToleranceCents)}{" "}
                tolerance · {profile.varianceCategories.length} variance categories
              </small>
            </span>
            <em>review only</em>
          </div>
        ))}
        {protectedAccountingProfiles.slice(0, 4).map((profile) => (
          <div className="party-row" key={profile.id}>
            <span>
              <strong>{accountLabel(activeTrustControls, profile.accountId)}</strong>
              <small>
                {profile.boundaryPosture.replaceAll("_", " ")} · protected funds ·{" "}
                {profile.protectedFunds.reviewCadence.replaceAll("_", " ")}
              </small>
              {profile.protectedFunds.reason ? (
                <small>{profile.protectedFunds.reason}</small>
              ) : null}
            </span>
            <em>{profile.accountType.replaceAll("_", " ")}</em>
          </div>
        ))}
        {bankFeedAccountingProfiles.slice(0, 4).map((profile) => (
          <div className="party-row" key={`${profile.id}-bank-feed`}>
            <span>
              <strong>{accountLabel(activeTrustControls, profile.accountId)}</strong>
              <small>
                {profile.bankFeedImport.status.replaceAll("_", " ")} ·{" "}
                {profile.bankFeedImport.sourceLabel ?? "source pending"}
              </small>
              <small>
                vendor {profile.dimensions.vendorTracking.replaceAll("_", " ")} · expense{" "}
                {profile.dimensions.expenseCategoryTracking.replaceAll("_", " ")} · client/matter
                required
              </small>
            </span>
            <em>no auto-match</em>
          </div>
        ))}
        {accountingReview.matchRuleProfiles.length === 0 &&
        accountingReview.accountingProfiles.length === 0 ? (
          <p className="inline-empty">
            No accounting review profiles are recorded for the current controls payload.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Bank-feed reconciliation review</h3>
        <span>metadata only · manual review required</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <Banknote size={18} />
          <strong>{bankFeedReviewSummary.bankFeedShellCount} feed shells</strong>
          <span>
            {bankFeedReviewSummary.metadataOnlyFeedCount} metadata ·{" "}
            {bankFeedReviewSummary.reviewReadyFeedCount} review ready
          </span>
        </div>
        <div className="activity-card">
          <FileText size={18} />
          <strong>{bankFeedReviewSummary.importBatchCount} import batches</strong>
          <span>
            {bankFeedReviewSummary.importedStatementRowCount} rows ·{" "}
            {bankFeedReviewSummary.duplicateStatementRowCount} duplicates
          </span>
        </div>
        <div className="activity-card">
          <AlertTriangle size={18} />
          <strong>
            {bankFeedReviewSummary.accountsPendingReconciliationCount} pending accounts
          </strong>
          <span>
            {bankFeedReviewSummary.exceptionReconciliationCount} exceptions ·{" "}
            {bankFeedReviewSummary.completedReconciliationCount} completed
          </span>
        </div>
        <div className="activity-card">
          <ShieldCheck size={18} />
          <strong>{bankFeedReviewSummary.protectedFundsFeedCount} protected feeds</strong>
          <span>No auto-match · no ledger posting · no live feed</span>
        </div>
      </div>
      <div className="party-list">
        {bankFeedImportBatches.slice(0, 4).map((batch) => (
          <div className="party-row" key={batch.id}>
            <span>
              <strong>{batch.sourceLabel}</strong>
              <small>{describeBankFeedImportBatch(activeTrustControls, batch)}</small>
              <small>
                checksum tracked ·{" "}
                {batch.matchingProfileId ? "match profile selected" : "match profile pending"}
              </small>
            </span>
            <em>{batch.status.replaceAll("_", " ")}</em>
          </div>
        ))}
        {bankFeedImportBatches.length === 0 ? (
          <p className="inline-empty">
            No bank-feed import batch metadata is recorded for the current controls payload.
          </p>
        ) : null}
        <div className="party-row">
          <span>
            <strong>Review boundary</strong>
            <small>{describeBankFeedReviewBoundary(activeTrustControls)}</small>
            <small>{bankFeedReviewSummary.importBatchStoragePosture.replaceAll("_", " ")}</small>
          </span>
          <em>review only</em>
        </div>
      </div>

      <div className="section-title">
        <h3>Jurisdiction trust report</h3>
        <span>operator review only · not jurisdiction-certified</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <ShieldCheck size={18} />
          <strong>{activeJurisdictionTrustSummary.jurisdiction}</strong>
          <span>{activeJurisdictionTrustSummary.matterCount} matters in report</span>
        </div>
        <div className="activity-card">
          <Banknote size={18} />
          <strong>{formatCurrency(activeJurisdictionTrustSummary.trustBalanceCents)}</strong>
          <span>aggregate recorded trust balance</span>
        </div>
        <div className="activity-card">
          <AlertTriangle size={18} />
          <strong>{activeJurisdictionTrustSummary.exceptionReconciliationCount} exceptions</strong>
          <span>
            {activeJurisdictionTrustSummary.unreconciledAccountCount} unreconciled ·{" "}
            {activeJurisdictionTrustSummary.overdrawnBalanceCount} overdrawn
          </span>
        </div>
        <div className="activity-card">
          <FileText size={18} />
          <strong>{activeJurisdictionTrustSummary.importedStatementRowCount} statement rows</strong>
          <span>
            {activeJurisdictionTrustSummary.matchedStatementRowCount} matched ·{" "}
            {activeJurisdictionTrustSummary.unmatchedStatementRowCount} unmatched ·{" "}
            {formatCurrency(activeJurisdictionTrustSummary.totalVarianceCents)} variance
          </span>
        </div>
      </div>

      <div className="section-title">
        <h3>Recent postings</h3>
        <span>{activeTrustPostings.length} shown</span>
      </div>
      <div className="party-list">
        {activeTrustPostings.map((posting) => (
          <div className="party-row" key={posting.transactionId}>
            <span>
              <strong>{posting.memo}</strong>
              <small>
                {posting.transactionId} · {posting.entryCount} entries ·{" "}
                {compactDate(posting.postedAt)}
              </small>
            </span>
            <em className={posting.matterDeltaCents < 0 ? "risk" : undefined}>
              {formatCurrency(posting.matterDeltaCents)}
            </em>
          </div>
        ))}
        {activeTrustPostings.length === 0 ? (
          <p className="inline-empty">No trust ledger postings are linked to this matter yet.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Reconciliation exceptions</h3>
        <span>
          {exceptionReconciliations.length} exceptions · {unreconciledAccounts.length} unreconciled
          accounts
        </span>
      </div>
      <div className="party-list">
        {exceptionReconciliations.slice(0, 4).map((reconciliation) => (
          <div className="party-row" key={reconciliation.id}>
            <span>
              <strong>{accountLabel(activeTrustControls, reconciliation.accountId)}</strong>
              <small>
                {compactStatus(reconciliation.status)} ·{" "}
                {compactDate(reconciliation.statementPeriodEnd)} ·{" "}
                {reconciliation.statementRows.length} statement rows
              </small>
              <small>
                opening {formatCurrency(reconciliation.beginningBalanceCents)} · closing{" "}
                {formatCurrency(reconciliation.endingBalanceCents)}
              </small>
              {reconciliation.varianceExplanation ? (
                <small>{reconciliation.varianceExplanation}</small>
              ) : null}
            </span>
            <em className="risk">
              {formatCurrency(
                reconciliation.actualBalanceCents - reconciliation.expectedBalanceCents,
              )}
            </em>
          </div>
        ))}
        {unreconciledAccounts.slice(0, 4).map((account) => (
          <div className="party-row" key={account.id}>
            <span>
              <strong>{account.label}</strong>
              <small>{account.id}</small>
            </span>
            <em className="risk">unreconciled</em>
          </div>
        ))}
        {exceptionReconciliations.length === 0 && unreconciledAccounts.length === 0 ? (
          <p className="inline-empty">
            No reconciliation exceptions or unreconciled trust accounts are present in the current
            controls payload.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Diagnostics</h3>
        <span>operator review only</span>
      </div>
      <div className="party-list">
        <div className="party-row">
          <span>
            <strong>Pending approval transaction IDs</strong>
            <small>
              {activeTrustControls.diagnostics.pendingApprovalTransactionIds.join(", ") || "none"}
            </small>
          </span>
          <em>{trustReviewSummary.pendingApprovalCount}</em>
        </div>
        <div className="party-row">
          <span>
            <strong>Rejected approval transaction IDs</strong>
            <small>
              {activeTrustControls.diagnostics.rejectedApprovalTransactionIds.join(", ") || "none"}
            </small>
          </span>
          <em className={trustReviewSummary.rejectedApprovalCount > 0 ? "risk" : undefined}>
            {trustReviewSummary.rejectedApprovalCount}
          </em>
        </div>
        <div className="party-row">
          <span>
            <strong>Overdrawn balance keys</strong>
            <small>
              {activeTrustControls.diagnostics.overdrawnBalanceKeys.join(", ") || "none"}
            </small>
          </span>
          <em className={trustReviewSummary.overdrawnBalanceCount > 0 ? "risk" : undefined}>
            {trustReviewSummary.overdrawnBalanceCount}
          </em>
        </div>
      </div>
    </>
  );
}
