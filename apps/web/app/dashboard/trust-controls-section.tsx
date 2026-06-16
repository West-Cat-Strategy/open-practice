import { AlertTriangle, Banknote, Clock3, FileText, ShieldCheck } from "lucide-react";

import type { FinancialCommandJournalEntry, FinancialCommandJournalFamily } from "../types";
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

const financialCommandFamilyLabels: Record<FinancialCommandJournalFamily, string> = {
  trust_transfer: "Trust transfer",
  trust_transaction: "Trust transaction",
  invoice_approval: "Invoice approval",
  reconciliation: "Reconciliation",
};

function financialCommandDecisionIsRisk(decision: string): boolean {
  return ["exception", "needs_follow_up", "rejected"].includes(decision);
}

function financialCommandStatusCue(entry: FinancialCommandJournalEntry): string | undefined {
  if (entry.previousStatus && entry.status) return `${entry.previousStatus} to ${entry.status}`;
  return entry.status;
}

function financialCommandAmountCue(
  entry: FinancialCommandJournalEntry,
  formatCurrency: (value: number) => string,
): string | undefined {
  if (entry.amountCents !== undefined) return `amount ${formatCurrency(entry.amountCents)}`;
  if (entry.totalCents !== undefined) return `total ${formatCurrency(entry.totalCents)}`;
  if (entry.balanceDueCents !== undefined)
    return `balance ${formatCurrency(entry.balanceDueCents)}`;
  if (entry.varianceCents !== undefined) return `variance ${formatCurrency(entry.varianceCents)}`;
  return undefined;
}

function financialCommandIdentityCue(entry: FinancialCommandJournalEntry): string {
  return [
    entry.matterId ? `matter ${entry.matterId}` : undefined,
    !entry.matterId && entry.matterIds ? `matters ${entry.matterIds.join(", ")}` : undefined,
    entry.invoiceId ? `invoice ${entry.invoiceId}` : undefined,
    entry.transactionId ? `transaction ${entry.transactionId}` : undefined,
    entry.trustTransferRequestId ? `transfer ${entry.trustTransferRequestId}` : undefined,
    entry.paymentId ? `payment ${entry.paymentId}` : undefined,
    entry.accountId ? `account ${entry.accountId}` : undefined,
    !entry.accountId && entry.accountIds ? `accounts ${entry.accountIds.join(", ")}` : undefined,
    entry.statementRowId ? `statement row ${entry.statementRowId}` : undefined,
  ]
    .filter((cue): cue is string => Boolean(cue))
    .join(" · ");
}

function financialCommandDetailCue(
  entry: FinancialCommandJournalEntry,
  formatCurrency: (value: number) => string,
): string {
  return (
    [
      financialCommandIdentityCue(entry),
      financialCommandStatusCue(entry),
      financialCommandAmountCue(entry, formatCurrency),
      entry.allocationCount !== undefined ? `${entry.allocationCount} allocations` : undefined,
      entry.entryCount !== undefined ? `${entry.entryCount} entries` : undefined,
      entry.statementRowCount !== undefined
        ? `${entry.statementRowCount} statement rows`
        : undefined,
      entry.matchedStatementRowCount !== undefined
        ? `${entry.matchedStatementRowCount} matched`
        : undefined,
      entry.unmatchedStatementRowCount !== undefined
        ? `${entry.unmatchedStatementRowCount} unmatched`
        : undefined,
      entry.evidencePresent ? "reviewer evidence" : undefined,
    ]
      .filter((cue): cue is string => Boolean(cue))
      .join(" · ") || entry.resourceId
  );
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
  const financialCommandJournal = activeTrustControls.financialCommandJournal;
  const financialCommandEntries = financialCommandJournal.entries.slice(0, 6);
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
        <h3>Financial command journal</h3>
        <span>
          {financialCommandJournal.summary.total} decisions · audit chain{" "}
          {financialCommandJournal.chainValid ? "valid" : "invalid"}
        </span>
      </div>
      <div className="party-list">
        {!financialCommandJournal.chainValid ? (
          <div className="party-row">
            <span>
              <strong>Audit chain requires review</strong>
              <small>Use the audit log before relying on this financial journal.</small>
            </span>
            <em className="risk">invalid</em>
          </div>
        ) : null}
        {financialCommandEntries.map((entry) => (
          <div className="party-row" key={entry.auditEventId}>
            <span>
              <strong>
                {financialCommandFamilyLabels[entry.family]} · {entry.resourceId}
              </strong>
              <small>
                {entry.action} · {compactDate(entry.occurredAt)} · actor {entry.actorId}
              </small>
              <small>{financialCommandDetailCue(entry, formatCurrency)}</small>
            </span>
            <em className={financialCommandDecisionIsRisk(entry.decision) ? "risk" : undefined}>
              {entry.decision.replaceAll("_", " ")}
            </em>
          </div>
        ))}
        {financialCommandEntries.length === 0 ? (
          <p className="inline-empty">
            No financial command journal entries are present in the current controls payload.
          </p>
        ) : null}
        <div className="party-row">
          <span>
            <strong>Journal boundary</strong>
            <small>
              {financialCommandJournal.summary.byFamily.trust_transfer} trust transfer ·{" "}
              {financialCommandJournal.summary.byFamily.trust_transaction} trust transaction ·{" "}
              {financialCommandJournal.summary.byFamily.invoice_approval} invoice approval ·{" "}
              {financialCommandJournal.summary.byFamily.reconciliation} reconciliation
            </small>
            <small>{financialCommandJournal.policy.rawMetadataValues.replaceAll("_", " ")}</small>
          </span>
          <em>review only</em>
        </div>
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
