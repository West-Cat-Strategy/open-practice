import { billingTimerDraftPolicy, expenseCategoryProfileCues } from "@open-practice/domain";
import { apiGetOptional } from "../../_shared/server-api";
import type { MatterSummary, SessionResponse } from "../../types";
import type { BillingDashboardResponse } from "./models";

function canViewBilling(role: string): boolean {
  return ["owner_admin", "billing_bookkeeper", "auditor"].includes(role);
}

function buildBillingFallback(
  matters: MatterSummary[],
  session: SessionResponse,
): BillingDashboardResponse {
  const billingMatters = matters.map((matter) => {
    const captureReviewTime = matter.timeEntries
      .filter((entry) => ["draft", "submitted"].includes(entry.billingStatus))
      .map((entry) => ({
        id: entry.id,
        matterId: entry.matterId,
        userId: entry.userId,
        performedAt: entry.performedAt,
        minutes: entry.minutes,
        rateCents: entry.rateCents,
        rateRuleId: entry.rateRuleId,
        rateSnapshot: entry.rateSnapshot,
        amountCents: Math.round((entry.minutes * entry.rateCents) / 60),
        narrative: entry.narrative,
        billable: entry.billable,
        status: entry.billingStatus,
      }));
    const captureReviewExpenses = matter.expenses
      .filter((entry) => ["draft", "submitted"].includes(entry.billingStatus))
      .map((entry) => {
        const profile = expenseCategoryProfileCues.find(
          (candidate) => candidate.category === entry.category,
        );
        return {
          id: entry.id,
          matterId: entry.matterId,
          incurredAt: entry.incurredAt,
          amountCents: entry.amountCents,
          category: entry.category,
          categoryProfileKey: profile?.key,
          description: entry.description,
          status: entry.billingStatus,
        };
      });
    const unbilledTime = matter.timeEntries
      .filter((entry) => entry.billable && entry.billingStatus === "approved")
      .map((entry) => ({
        id: entry.id,
        matterId: entry.matterId,
        userId: entry.userId,
        performedAt: entry.performedAt,
        minutes: entry.minutes,
        rateCents: entry.rateCents,
        rateRuleId: entry.rateRuleId,
        rateSnapshot: entry.rateSnapshot,
        amountCents: Math.round((entry.minutes * entry.rateCents) / 60),
        narrative: entry.narrative,
        billable: entry.billable,
        status: "approved" as const,
      }));
    const unbilledExpenses = matter.expenses
      .filter((entry) => entry.reimbursable && entry.billingStatus === "approved")
      .map((entry) => ({
        id: entry.id,
        matterId: entry.matterId,
        incurredAt: entry.incurredAt,
        amountCents: entry.amountCents,
        category: entry.category,
        description: entry.description,
        status: "approved" as const,
      }));
    return {
      matterId: matter.id,
      captureReviewTime,
      captureReviewExpenses,
      unbilledTime,
      unbilledExpenses,
      invoices: [],
      payments: [],
      paymentRequests: [],
    };
  });

  return {
    canView: canViewBilling(session.user.role),
    summary: {
      unbilledTimeCents: billingMatters.reduce(
        (sum, matter) =>
          sum + matter.unbilledTime.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
        0,
      ),
      unbilledExpenseCents: billingMatters.reduce(
        (sum, matter) =>
          sum +
          matter.unbilledExpenses.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
        0,
      ),
      draftInvoiceCents: 0,
      issuedBalanceDueCents: 0,
      hostedPaymentRequestCents: 0,
      lockedPeriodCount: 0,
      activeLockedPeriodCount: 0,
      activeRateRuleCount: 0,
    },
    periodLocks: [],
    rateRules: [],
    timerDraftPolicy: billingTimerDraftPolicy,
    expenseCategoryProfiles: expenseCategoryProfileCues,
    matters: billingMatters,
  };
}

function emptyBillingAccessDeniedResponse(): BillingDashboardResponse {
  return {
    canView: false,
    summary: {
      unbilledTimeCents: 0,
      unbilledExpenseCents: 0,
      draftInvoiceCents: 0,
      issuedBalanceDueCents: 0,
      hostedPaymentRequestCents: 0,
      lockedPeriodCount: 0,
      activeLockedPeriodCount: 0,
      activeRateRuleCount: 0,
    },
    periodLocks: [],
    rateRules: [],
    timerDraftPolicy: billingTimerDraftPolicy,
    expenseCategoryProfiles: expenseCategoryProfileCues,
    matters: [],
  };
}

export async function loadBillingDashboardData(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
  session: SessionResponse;
}): Promise<BillingDashboardResponse> {
  return apiGetOptional<BillingDashboardResponse>(
    "/api/billing/dashboard",
    buildBillingFallback(input.matters, input.session),
    input.headers,
    emptyBillingAccessDeniedResponse(),
  );
}
