import type {
  JurisdictionalTrustReportResponse,
  TrustControlsDashboardResponse,
} from "./_features/billing/models";
import type { MatterSummary } from "./types";

export interface RecentTrustPosting {
  transactionId: string;
  postedAt: string;
  memo: string;
  entryCount: number;
  matterDeltaCents: number;
}

export interface TrustReviewSummary {
  pendingApprovalCount: number;
  approvedApprovalCount: number;
  rejectedApprovalCount: number;
  totalApprovalCount: number;
  pendingPostingRequestCount: number;
  postedPostingRequestCount: number;
  rejectedPostingRequestCount: number;
  totalPostingRequestCount: number;
  exceptionReconciliationCount: number;
  importedStatementRowCount: number;
  matchedStatementRowCount: number;
  unmatchedStatementRowCount: number;
  totalVarianceCents: number;
  unreconciledAccountCount: number;
  overdrawnBalanceCount: number;
}

export interface ActiveJurisdictionTrustReportSummary {
  jurisdiction: string;
  matterCount: number;
  trustBalanceCents: number;
  pendingApprovalCount: number;
  rejectedApprovalCount: number;
  exceptionReconciliationCount: number;
  importedStatementRowCount: number;
  matchedStatementRowCount: number;
  unmatchedStatementRowCount: number;
  totalVarianceCents: number;
  unreconciledAccountCount: number;
  overdrawnBalanceCount: number;
  compliancePosture: string;
}

export function buildTrustControlsPath(matterId: string): string {
  return `/api/ledger/controls?matterId=${encodeURIComponent(matterId)}`;
}

export function buildJurisdictionalTrustReportPath(
  filters:
    | string
    | {
        jurisdiction?: string;
        practiceArea?: string;
        clinicProgramId?: string;
        restrictedFundReviewStatus?: string;
        groupBy?: string;
      } = {},
): string {
  const basePath = "/api/ledger/reports/jurisdictional-trust";
  const normalizedFilters = typeof filters === "string" ? { jurisdiction: filters } : filters;
  const params = new URLSearchParams();
  if (normalizedFilters.jurisdiction) params.set("jurisdiction", normalizedFilters.jurisdiction);
  if (normalizedFilters.practiceArea) params.set("practiceArea", normalizedFilters.practiceArea);
  if (normalizedFilters.clinicProgramId) {
    params.set("clinicProgramId", normalizedFilters.clinicProgramId);
  }
  if (normalizedFilters.restrictedFundReviewStatus) {
    params.set("restrictedFundReviewStatus", normalizedFilters.restrictedFundReviewStatus);
  }
  if (normalizedFilters.groupBy) params.set("groupBy", normalizedFilters.groupBy);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function emptyReconciliationPacketReview(): NonNullable<
  TrustControlsDashboardResponse["reconciliationPacketReview"]
> {
  return {
    generatedAt: new Date(0).toISOString(),
    reviewOnly: true,
    packets: [],
    summary: {
      packetCount: 0,
      evidenceCount: 0,
      reviewCueCount: 0,
      packetsNeedingReviewCount: 0,
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
}

export function emptyTrustControlsDashboard(): TrustControlsDashboardResponse {
  return {
    ledger: {
      accounts: [],
      entries: [],
      balances: {},
      trustBalances: {},
    },
    approvals: [],
    postingRequests: [],
    postingRequestSummary: {
      pendingApprovalCount: 0,
      postedCount: 0,
      rejectedCount: 0,
      totalCount: 0,
    },
    reconciliations: [],
    balanceSnapshotComparison: {
      generatedAt: new Date(0).toISOString(),
      reviewOnly: true,
      currentTrustBalance: {
        totalCents: 0,
        balanceCount: 0,
        overdrawnBalanceCount: 0,
      },
      reviewReasons: [
        "no_trust_balances",
        "no_posted_transaction",
        "no_reconciliation_preview_metadata",
        "no_reconciliation_snapshot",
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
    },
    reconciliationFreshness: {
      generatedAt: new Date(0).toISOString(),
      freshWithinDays: 30,
      watchWithinDays: 60,
      rows: [],
      summary: {
        accountCount: 0,
        freshCount: 0,
        watchCount: 0,
        staleCount: 0,
        neverReconciledCount: 0,
        totalStaleDayCount: 0,
        maxStaleDayCount: 0,
        exceptionCount: 0,
        unmatchedStatementRowCount: 0,
        reviewOnly: true,
      },
      reviewOnly: true,
    },
    reconciliationPacketReview: emptyReconciliationPacketReview(),
    makerCheckerReadiness: {
      generatedAt: new Date(0).toISOString(),
      reviewOnly: true,
      categories: [],
      matters: [],
      policyPreviewMatrix: {
        generatedAt: new Date(0).toISOString(),
        reviewOnly: true,
        columns: [],
        rows: [],
        cells: [],
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
      },
      summary: {
        categoryCount: 0,
        categoriesRequiringPolicyCount: 0,
        matterCount: 0,
        mattersRequiringPolicyCount: 0,
        reviewCueCount: 0,
        pendingCount: 0,
        exceptionCount: 0,
        amountCents: 0,
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
    },
    accountingReview: {
      importBatches: [],
      matchRuleProfiles: [],
      accountingProfiles: [],
      summary: {
        matchRuleProfileCount: 0,
        accountingProfileCount: 0,
        protectedAccountCount: 0,
        bankFeedShellCount: 0,
        reviewOnly: true,
      },
      bankFeedReviewSummary: {
        bankFeedShellCount: 0,
        metadataOnlyFeedCount: 0,
        reviewReadyFeedCount: 0,
        importBatchCount: 0,
        previewedImportBatchCount: 0,
        reviewReadyImportBatchCount: 0,
        discardedImportBatchCount: 0,
        importedStatementRowCount: 0,
        duplicateStatementRowCount: 0,
        completedReconciliationCount: 0,
        exceptionReconciliationCount: 0,
        accountsPendingReconciliationCount: 0,
        protectedFundsFeedCount: 0,
        automaticMatching: false,
        automaticLedgerPosting: false,
        automaticReconciliation: false,
        liveBankFeedConnection: false,
        trustDisbursementAutomation: false,
        importBatchStoragePosture: "metadata_only_no_statement_rows",
        reviewOnly: true,
      },
    },
    diagnostics: {
      pendingApprovalTransactionIds: [],
      rejectedApprovalTransactionIds: [],
      unreconciledAccountIds: [],
      exceptionReconciliationIds: [],
      overdrawnBalanceKeys: [],
    },
    trustControlPolicy: {
      automaticTrustPosting: false,
      transferRequestPosting: "requires_explicit_approval_and_manual_post",
      makerChecker: {
        ledgerTransactionApproval: "second_review_required",
        ledgerPostingRequest: "prepared_postings_require_checker_approval_before_posting",
        trustTransferRequest: "request_and_posting_are_separate_records",
        reconciliation: "firm_wide_review_required",
      },
      compliancePosture: "operational_controls_only_not_jurisdiction_certified",
    },
    financialCommandJournal: {
      scope: { kind: "firm" },
      chainValid: true,
      reviewOnly: true,
      entries: [],
      summary: {
        total: 0,
        byFamily: {
          trust_transfer: 0,
          trust_transaction: 0,
          invoice_approval: 0,
          reconciliation: 0,
        },
        byDecision: {},
      },
      policy: {
        source: "audit_metadata",
        rawMetadataValues: "redacted_allowlisted_cues_only",
        postingAutomation: false,
        settlementAutomation: false,
        publicExposure: false,
      },
    },
  };
}

export function emptyJurisdictionalTrustReport(): JurisdictionalTrustReportResponse {
  return {
    groupBy: "jurisdiction",
    filters: {},
    dimensionOptions: {
      jurisdictions: [],
      practiceAreas: [],
      clinicProgramIds: [],
      restrictedFundReviewStatuses: [],
    },
    summaries: [],
    compliancePosture: "operational_controls_only_not_jurisdiction_certified",
  };
}

export async function loadTrustControlsDashboardData({
  matter,
  getControls,
}: {
  matter?: MatterSummary;
  getControls: (matterId: string) => Promise<TrustControlsDashboardResponse>;
}): Promise<TrustControlsDashboardResponse> {
  if (!matter) return emptyTrustControlsDashboard();
  return getControls(matter.id);
}

export function trustControlsForMatter(
  current: Record<string, TrustControlsDashboardResponse>,
  matterId: string,
  controls: TrustControlsDashboardResponse,
): Record<string, TrustControlsDashboardResponse> {
  return {
    ...current,
    [matterId]: controls,
  };
}

export function accountLabel(controls: TrustControlsDashboardResponse, accountId: string): string {
  return controls.ledger.accounts.find((account) => account.id === accountId)?.name ?? accountId;
}

export function describeBankFeedImportBatch(
  controls: TrustControlsDashboardResponse,
  batch: TrustControlsDashboardResponse["accountingReview"]["importBatches"][number],
): string {
  return `${accountLabel(controls, batch.accountId)} · ${batch.status.replaceAll(
    "_",
    " ",
  )} · ${batch.importedStatementRowCount} rows · ${batch.duplicateStatementRowCount} duplicates`;
}

export function describeBankFeedReviewBoundary(controls: TrustControlsDashboardResponse): string {
  const summary = controls.accountingReview.bankFeedReviewSummary;
  const pending =
    summary.accountsPendingReconciliationCount === 1
      ? "1 account pending reconciliation review"
      : `${summary.accountsPendingReconciliationCount} accounts pending reconciliation review`;
  return `${pending} · no automatic matching · no ledger posting`;
}

export function matterTrustBalanceCents(
  controls: TrustControlsDashboardResponse,
  matterId: string,
  fallbackCents: number,
): number {
  if (Object.prototype.hasOwnProperty.call(controls.ledger.trustBalances, matterId)) {
    return controls.ledger.trustBalances[matterId] ?? fallbackCents;
  }

  const keyedBalances = Object.entries(controls.ledger.trustBalances)
    .filter(([key]) => key === matterId || key.endsWith(`:${matterId}`))
    .map(([, value]) => value);
  if (keyedBalances.length > 0) {
    return keyedBalances.reduce((sum, value) => sum + value, 0);
  }

  return fallbackCents;
}

export function summarizeTrustControls(
  controls: TrustControlsDashboardResponse,
): TrustReviewSummary {
  const rejectedTransactionIds = new Set(controls.diagnostics.rejectedApprovalTransactionIds);
  for (const approval of controls.approvals) {
    if (approval.decision === "rejected") rejectedTransactionIds.add(approval.transactionId);
  }

  const exceptionReconciliationIds = new Set(controls.diagnostics.exceptionReconciliationIds);
  for (const reconciliation of controls.reconciliations) {
    if (reconciliation.status === "exception") exceptionReconciliationIds.add(reconciliation.id);
  }
  const importedStatementRowCount = controls.reconciliations.reduce(
    (total, reconciliation) => total + reconciliation.statementRows.length,
    0,
  );
  const matchedStatementRowCount = controls.reconciliations.reduce(
    (total, reconciliation) =>
      total + reconciliation.statementRows.filter((row) => row.reviewDecision === "matched").length,
    0,
  );
  const unmatchedStatementRowCount = controls.reconciliations.reduce(
    (total, reconciliation) =>
      total +
      reconciliation.statementRows.filter((row) => row.reviewDecision === "unmatched").length,
    0,
  );
  const totalVarianceCents = controls.reconciliations.reduce(
    (total, reconciliation) =>
      total + reconciliation.actualBalanceCents - reconciliation.expectedBalanceCents,
    0,
  );

  return {
    pendingApprovalCount: controls.diagnostics.pendingApprovalTransactionIds.length,
    approvedApprovalCount: controls.approvals.filter((approval) => approval.decision === "approved")
      .length,
    rejectedApprovalCount: rejectedTransactionIds.size,
    totalApprovalCount: controls.approvals.length,
    pendingPostingRequestCount: controls.postingRequestSummary.pendingApprovalCount,
    postedPostingRequestCount: controls.postingRequestSummary.postedCount,
    rejectedPostingRequestCount: controls.postingRequestSummary.rejectedCount,
    totalPostingRequestCount: controls.postingRequestSummary.totalCount,
    exceptionReconciliationCount: exceptionReconciliationIds.size,
    importedStatementRowCount,
    matchedStatementRowCount,
    unmatchedStatementRowCount,
    totalVarianceCents,
    unreconciledAccountCount: controls.diagnostics.unreconciledAccountIds.length,
    overdrawnBalanceCount: controls.diagnostics.overdrawnBalanceKeys.length,
  };
}

export function activeJurisdictionTrustReportSummary({
  matter,
  report,
}: {
  matter?: MatterSummary;
  report: JurisdictionalTrustReportResponse;
}): ActiveJurisdictionTrustReportSummary {
  const jurisdiction = matter?.jurisdiction ?? "OTHER";
  return (
    report.summaries.find((summary) => summary.jurisdiction === jurisdiction) ?? {
      jurisdiction,
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
      compliancePosture: report.compliancePosture,
    }
  );
}

export function recentTrustPostings(
  controls: TrustControlsDashboardResponse,
  matterId: string,
  limit = 5,
): RecentTrustPosting[] {
  const liabilityAccountIds = new Set(
    controls.ledger.accounts
      .filter((account) => account.type === "client_liability")
      .map((account) => account.id),
  );
  const postingsByTransaction = new Map<string, RecentTrustPosting>();

  for (const entry of controls.ledger.entries) {
    if (entry.matterId !== matterId) continue;
    const current = postingsByTransaction.get(entry.transactionId) ?? {
      transactionId: entry.transactionId,
      postedAt: entry.postedAt,
      memo: entry.memo,
      entryCount: 0,
      matterDeltaCents: 0,
    };
    current.postedAt =
      new Date(entry.postedAt).getTime() > new Date(current.postedAt).getTime()
        ? entry.postedAt
        : current.postedAt;
    current.memo = current.memo || entry.memo;
    current.entryCount += 1;
    if (liabilityAccountIds.has(entry.accountId)) {
      current.matterDeltaCents += entry.creditCents - entry.debitCents;
    }
    postingsByTransaction.set(entry.transactionId, current);
  }

  return [...postingsByTransaction.values()]
    .sort((left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime())
    .slice(0, limit);
}
