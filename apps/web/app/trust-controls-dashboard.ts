import type { MatterSummary, TrustControlsDashboardResponse } from "./types";

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
  exceptionReconciliationCount: number;
  unreconciledAccountCount: number;
  overdrawnBalanceCount: number;
}

export function buildTrustControlsPath(matterId: string): string {
  return `/api/ledger/controls?matterId=${encodeURIComponent(matterId)}`;
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
    reconciliations: [],
    diagnostics: {
      pendingApprovalTransactionIds: [],
      rejectedApprovalTransactionIds: [],
      unreconciledAccountIds: [],
      exceptionReconciliationIds: [],
      overdrawnBalanceKeys: [],
    },
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

  return {
    pendingApprovalCount: controls.diagnostics.pendingApprovalTransactionIds.length,
    approvedApprovalCount: controls.approvals.filter((approval) => approval.decision === "approved")
      .length,
    rejectedApprovalCount: rejectedTransactionIds.size,
    totalApprovalCount: controls.approvals.length,
    exceptionReconciliationCount: exceptionReconciliationIds.size,
    unreconciledAccountCount: controls.diagnostics.unreconciledAccountIds.length,
    overdrawnBalanceCount: controls.diagnostics.overdrawnBalanceKeys.length,
  };
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
