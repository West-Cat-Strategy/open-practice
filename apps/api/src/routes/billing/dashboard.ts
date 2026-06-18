import type { FastifyInstance } from "fastify";
import {
  billingDateFallsInsideLock,
  billingExpenseCategoryProfileFromRecord,
  billingTimerDraftPolicy,
  hasHostedPaymentRequestEvidence,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiRouteDependencies } from "../types.js";

function hasEvidence(evidence: Record<string, unknown>): boolean {
  return Object.keys(evidence).length > 0;
}

export function registerBillingDashboardRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/billing/dashboard", async (request) => {
    const access = requireAccess(request.auth, { resource: "trust_ledger", action: "read" });
    if (!access.ok) throw access.error;
    const matters = await repository.listMattersForUser(request.auth.user);
    const matterIds = matters.map((matter) => matter.id);
    const [
      timeEntries,
      expenseEntries,
      invoices,
      payments,
      paymentRequests,
      periodLocks,
      rateRules,
      expenseCategories,
    ] = await Promise.all([
      repository.listTimeEntries(request.auth.firmId),
      repository.listExpenseEntries(request.auth.firmId),
      repository.listInvoices(request.auth.firmId),
      repository.listPayments(request.auth.firmId),
      repository.listHostedPaymentRequests(request.auth.firmId),
      repository.listBillingPeriodLocks(request.auth.firmId),
      repository.listBillingRateRules(request.auth.firmId),
      repository.listBillingExpenseCategories(request.auth.firmId),
    ]);
    const now = new Date().toISOString();
    const matterSummaries = matterIds.map((matterId) => {
      const unbilledTime = timeEntries
        .filter(
          (entry) =>
            entry.matterId === matterId && entry.billable && entry.billingStatus === "approved",
        )
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
      const unbilledExpenses = expenseEntries
        .filter(
          (entry) =>
            entry.matterId === matterId && entry.reimbursable && entry.billingStatus === "approved",
        )
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          incurredAt: entry.incurredAt,
          amountCents: entry.amountCents,
          category: entry.category,
          categoryCode: entry.categoryCode,
          description: entry.description,
          status: entry.billingStatus,
        }));
      const captureReviewTime = timeEntries
        .filter(
          (entry) =>
            entry.matterId === matterId && ["draft", "submitted"].includes(entry.billingStatus),
        )
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
      const captureReviewExpenses = expenseEntries
        .filter(
          (entry) =>
            entry.matterId === matterId && ["draft", "submitted"].includes(entry.billingStatus),
        )
        .map((entry) => ({
          id: entry.id,
          matterId: entry.matterId,
          incurredAt: entry.incurredAt,
          amountCents: entry.amountCents,
          category: entry.category,
          categoryCode: entry.categoryCode,
          categoryProfileKey: entry.categoryCode,
          description: entry.description,
          status: entry.billingStatus,
        }));
      return {
        matterId,
        captureReviewTime,
        captureReviewExpenses,
        unbilledTime,
        unbilledExpenses,
        invoices: invoices
          .filter((invoice) => invoice.matterId === matterId)
          .map((invoice) => ({
            id: invoice.id,
            matterId: invoice.matterId,
            number: invoice.invoiceNumber,
            status: invoice.status,
            totalCents: invoice.totalCents,
            balanceDueCents: invoice.balanceDueCents,
            issuedAt: invoice.issuedAt,
            dueAt: invoice.dueAt,
          })),
        payments: payments
          .filter((payment) => payment.matterId === matterId)
          .map((payment) => ({
            id: payment.id,
            matterId: payment.matterId,
            invoiceId: payment.invoiceId,
            amountCents: payment.amountCents,
            method: payment.method,
            status: payment.status,
            receivedAt: payment.receivedAt,
            reconciledAt: payment.reconciledAt,
            reference: payment.reference,
            evidencePresent: hasEvidence(payment.evidence ?? {}),
            reconciliationEvidencePresent: hasEvidence(payment.reconciliationEvidence ?? {}),
          })),
        paymentRequests: paymentRequests
          .filter((paymentRequest) => paymentRequest.matterId === matterId)
          .map((paymentRequest) => ({
            id: paymentRequest.id,
            matterId: paymentRequest.matterId,
            invoiceId: paymentRequest.invoiceId,
            clientContactId: paymentRequest.clientContactId,
            status: paymentRequest.status,
            amountCents: paymentRequest.amountCents,
            hostedPath: paymentRequest.hostedPath,
            delivery: paymentRequest.delivery,
            reminder: paymentRequest.reminder,
            paymentPlan: paymentRequest.paymentPlan,
            creditWriteOffPosture: paymentRequest.creditWriteOffPosture,
            processor: paymentRequest.processor,
            evidencePresent: hasHostedPaymentRequestEvidence(paymentRequest),
            createdAt: paymentRequest.createdAt,
            updatedAt: paymentRequest.updatedAt,
            expiresAt: paymentRequest.expiresAt,
          })),
      };
    });
    const visibleInvoices = matterSummaries.flatMap((matter) => matter.invoices);
    const visiblePaymentRequests = matterSummaries.flatMap((matter) => matter.paymentRequests);
    return {
      canView: true,
      summary: {
        unbilledTimeCents: matterSummaries.reduce(
          (sum, matter) =>
            sum +
            matter.unbilledTime.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
          0,
        ),
        unbilledExpenseCents: matterSummaries.reduce(
          (sum, matter) =>
            sum +
            matter.unbilledExpenses.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
          0,
        ),
        draftInvoiceCents: visibleInvoices
          .filter((invoice) => invoice.status === "draft")
          .reduce((sum, invoice) => sum + invoice.totalCents, 0),
        issuedBalanceDueCents: visibleInvoices
          .filter((invoice) => ["issued", "partially_paid"].includes(invoice.status))
          .reduce((sum, invoice) => sum + invoice.balanceDueCents, 0),
        hostedPaymentRequestCents: visiblePaymentRequests
          .filter((paymentRequest) =>
            ["ready_to_send", "sent", "viewed"].includes(paymentRequest.status),
          )
          .reduce((sum, paymentRequest) => sum + paymentRequest.amountCents, 0),
        lockedPeriodCount: periodLocks.length,
        activeLockedPeriodCount: periodLocks.filter((lock) => billingDateFallsInsideLock(now, lock))
          .length,
        activeRateRuleCount: rateRules.filter((rule) => rule.active).length,
      },
      periodLocks,
      rateRules,
      timerDraftPolicy: billingTimerDraftPolicy,
      expenseCategories,
      expenseCategoryProfiles: expenseCategories.map(billingExpenseCategoryProfileFromRecord),
      matters: matterSummaries,
    };
  });
}
