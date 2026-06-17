import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BillingDashboardResponse } from "../_features/billing/models";
import { summarizePaymentSettlementReview } from "../billing-dashboard";
import { BillingSection } from "./billing-section";

function formatCurrency(value: number): string {
  return `$${(value / 100).toFixed(2)}`;
}

function formatMinutes(value: number): string {
  return `${value}m`;
}

function buildSyntheticBillingDashboard(): BillingDashboardResponse {
  return {
    canView: true,
    summary: {
      unbilledTimeCents: 30000,
      unbilledExpenseCents: 4500,
      draftInvoiceCents: 0,
      issuedBalanceDueCents: 50000,
      hostedPaymentRequestCents: 50000,
      lockedPeriodCount: 1,
      activeLockedPeriodCount: 1,
      activeRateRuleCount: 1,
    },
    periodLocks: [
      {
        id: "lock_synthetic",
        firmId: "firm_synthetic",
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-06-30T00:00:00.000Z",
        reason: "Synthetic month close",
        lockedByUserId: "user_synthetic",
        lockedAt: "2026-06-30T00:00:00.000Z",
      },
    ],
    rateRules: [
      {
        id: "rate_synthetic",
        firmId: "firm_synthetic",
        label: "Synthetic counsel rate",
        scope: "matter",
        matterId: "matter_synthetic",
        rateCents: 30000,
        effectiveFrom: "2026-06-01T00:00:00.000Z",
        active: true,
        createdByUserId: "user_synthetic",
        createdAt: "2026-06-06T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:00.000Z",
      },
    ],
    timerDraftPolicy: {
      createsDraftOnly: true,
      autoSubmitEnabled: false,
      autoApproveEnabled: false,
      lockBypassAllowed: false,
    },
    expenseCategoryProfiles: [
      {
        key: "filing_service",
        label: "Filing and service",
        category: "Filing and service",
        defaultReimbursable: true,
        reviewCue: "Attach receipt or registry confirmation before billing approval.",
        reviewOnly: true,
      },
    ],
    matters: [
      {
        matterId: "matter_synthetic",
        captureReviewTime: [
          {
            id: "time_draft_synthetic",
            matterId: "matter_synthetic",
            performedAt: "2026-06-06T09:00:00.000Z",
            minutes: 30,
            rateCents: 30000,
            amountCents: 15000,
            narrative: "Synthetic draft preparation",
            billable: true,
            status: "draft",
          },
        ],
        captureReviewExpenses: [
          {
            id: "expense_draft_synthetic",
            matterId: "matter_synthetic",
            incurredAt: "2026-06-06T00:00:00.000Z",
            amountCents: 4500,
            category: "Filing and service",
            categoryProfileKey: "filing_service",
            description: "Synthetic registry receipt",
            status: "draft",
          },
        ],
        unbilledTime: [
          {
            id: "time_unbilled_synthetic",
            matterId: "matter_synthetic",
            performedAt: "2026-06-06T09:00:00.000Z",
            minutes: 60,
            rateCents: 30000,
            rateSnapshot: {
              source: "rate_rule",
              rateCents: 30000,
              resolvedAt: "2026-06-06T09:00:00.000Z",
              label: "Synthetic counsel rate",
            },
            amountCents: 30000,
            narrative: "Synthetic hearing preparation",
            billable: true,
            status: "approved",
          },
        ],
        unbilledExpenses: [
          {
            id: "expense_unbilled_synthetic",
            matterId: "matter_synthetic",
            incurredAt: "2026-06-06T00:00:00.000Z",
            amountCents: 4500,
            category: "Filing and service",
            description: "Synthetic filing expense",
            status: "approved",
          },
        ],
        invoices: [
          {
            id: "invoice_synthetic",
            matterId: "matter_synthetic",
            number: "INV-SYNTHETIC",
            status: "issued",
            totalCents: 50000,
            balanceDueCents: 50000,
            issuedAt: "2026-06-06T00:00:00.000Z",
            dueAt: "2026-07-06T00:00:00.000Z",
          },
        ],
        payments: [
          {
            id: "payment_synthetic",
            matterId: "matter_synthetic",
            invoiceId: "invoice_synthetic",
            amountCents: 12500,
            method: "eft",
            status: "pending_reconciliation",
            receivedAt: "2026-06-07T00:00:00.000Z",
            reference: "Synthetic EFT",
            evidencePresent: true,
          },
        ],
        paymentRequests: [
          {
            id: "payment_request_synthetic",
            matterId: "matter_synthetic",
            invoiceId: "invoice_synthetic",
            status: "sent",
            amountCents: 50000,
            hostedPath: "/pay/synthetic",
            delivery: {
              status: "sent",
              channel: "email",
              recipientCount: 1,
              deliveredAt: "2026-06-06T00:00:00.000Z",
            },
            reminder: {
              status: "scheduled",
              reminderCount: 1,
              nextReminderAt: "2026-06-13T00:00:00.000Z",
            },
            paymentPlan: {
              status: "not_offered",
              enforcement: "none",
            },
            creditWriteOffPosture: {
              status: "none",
              movement: "none",
            },
            processor: {
              status: "checkout_session_created",
              provider: "stripe",
              externalSessionId: "cs_synthetic",
              settlementReview: {
                status: "needs_review",
                provider: "stripe",
                eventType: "checkout_session_completed",
                paymentStatus: "paid",
                externalEventId: "evt_synthetic",
                externalSessionId: "cs_synthetic",
                amountCents: 50000,
                currency: "CAD",
                observedAt: "2026-06-07T00:00:00.000Z",
                receivedAt: "2026-06-07T00:00:00.000Z",
                reviewAction: "staff_reconciliation_review_required",
                invoiceBalanceMutation: "none",
                reconciliationMutation: "none",
                trustPosting: "none",
                webhookBoundary: {
                  signatureVerified: false,
                  rawWebhookBodyStored: false,
                  automaticInvoiceMutation: false,
                  automaticReconciliation: false,
                  trustPosting: false,
                  refundHandling: "review_only",
                  chargebackHandling: "review_only",
                },
              },
            },
            evidencePresent: true,
            createdAt: "2026-06-06T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z",
            expiresAt: "2026-07-06T00:00:00.000Z",
          },
        ],
      },
    ],
  };
}

describe("BillingSection", () => {
  it("renders billing controls, capture drafts, invoices, settlement review, and payments", () => {
    const billingDashboard = buildSyntheticBillingDashboard();
    const activeBilling = billingDashboard.matters[0];
    const html = renderToStaticMarkup(
      createElement(BillingSection, {
        activeBalanceDueCents: 50000,
        activeCaptureReviewCount:
          activeBilling.captureReviewTime.length + activeBilling.captureReviewExpenses.length,
        activeCaptureReviewExpenses: activeBilling.captureReviewExpenses,
        activeCaptureReviewTime: activeBilling.captureReviewTime,
        activeInvoices: activeBilling.invoices,
        activeManualPayments: activeBilling.payments,
        activeMatter: { number: "SYN-001" },
        activePaymentRequests: activeBilling.paymentRequests,
        activeSettlementReviewSummary: summarizePaymentSettlementReview(
          activeBilling.paymentRequests,
        ),
        activeUnbilledExpenseCents: 4500,
        activeUnbilledExpenses: activeBilling.unbilledExpenses,
        activeUnbilledTime: activeBilling.unbilledTime,
        activeUnbilledTimeCents: 30000,
        billingDashboard,
        canCreateDraftInvoice: true,
        cents: formatCurrency,
        createDraftInvoice: async () => {},
        createExpenseDraft: async () => {},
        createTimerDraft: async () => {},
        creatingDraftInvoice: false,
        creatingExpenseDraft: false,
        creatingTimerDraft: false,
        draftInvoiceDueAt: "2026-07-06",
        draftInvoiceStatus: "Ready to draft.",
        draftInvoiceTaxName: "GST",
        draftInvoiceTaxRate: "5",
        expenseDraftAmount: "45.00",
        expenseDraftCategory: "Filing and service",
        expenseDraftDate: "2026-06-06",
        expenseDraftDescription: "Synthetic receipt",
        expenseDraftProfileKey: "filing_service",
        expenseDraftReimbursable: true,
        expenseDraftStatus: "Expense draft ready.",
        manualPaymentReconciliationStatus: "No manual payment reconciled.",
        minutes: formatMinutes,
        onReconcileManualPayment: async () => {},
        reconcilingManualPaymentId: "",
        setDraftInvoiceDueAt: () => {},
        setDraftInvoiceTaxName: () => {},
        setDraftInvoiceTaxRate: () => {},
        setExpenseDraftAmount: () => {},
        setExpenseDraftCategory: () => {},
        setExpenseDraftDate: () => {},
        setExpenseDraftDescription: () => {},
        setExpenseDraftProfileKey: () => {},
        setExpenseDraftReimbursable: () => {},
        setTimerDraftBillable: () => {},
        setTimerDraftNarrative: () => {},
        setTimerDraftRate: () => {},
        setTimerDraftStartedAt: () => {},
        setTimerDraftStoppedAt: () => {},
        startTimerDraft: () => {},
        stopTimerDraft: () => {},
        timerDraftBillable: true,
        timerDraftNarrative: "Synthetic timer draft",
        timerDraftRate: "300.00",
        timerDraftStartedAt: "2026-06-06T09:00",
        timerDraftStatus: "Timer draft ready.",
        timerDraftStoppedAt: "2026-06-06T10:00",
      }),
    );

    expect(html).toContain("Billing controls");
    expect(html).toContain("Local timer");
    expect(html).toContain("Filing and service");
    expect(html).toContain("Attach receipt or registry confirmation before billing approval.");
    expect(html).toContain("INV-SYNTHETIC");
    expect(html).toContain("Payment request shells");
    expect(html).toContain("No invoice balance mutation");
    expect(html).toContain("No automatic reconciliation");
    expect(html).toContain("Synthetic EFT");
    expect(html).toContain("Pending reconciliation");
    expect(html).toContain("Reconcile");
    expect(html).toContain("No manual payment reconciled.");
  });
});
