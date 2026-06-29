import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BillingDashboardResponse } from "../_features/billing/models";
import {
  summarizePaymentImportReviews,
  summarizePaymentSettlementReview,
} from "../billing-dashboard";
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
      paymentImportReviewCount: 3,
      paymentImportConflictCount: 0,
      depositMatchReconciliationReadyCount: 1,
      refundReviewCueCount: 1,
      chargebackReviewCueCount: 1,
      refundChargebackReviewCueCount: 2,
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
    expenseCategories: [
      {
        id: "expense_category_filing_service",
        firmId: "firm_synthetic",
        code: "filing_service",
        label: "Filing and service",
        active: true,
        defaultReimbursable: true,
        reimbursableAllowed: true,
        practiceAreas: [],
        jurisdictions: [],
        reviewCue: "Attach receipt or registry confirmation before billing approval.",
        createdByUserId: "user_synthetic",
        updatedByUserId: "user_synthetic",
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
    ],
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
            categoryCode: "filing_service",
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
            categoryCode: "filing_service",
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
        paymentImportReviewRecords: [
          {
            id: "payment_import_review_synthetic",
            matterId: "matter_synthetic",
            providerLabel: "synthetic_processor",
            eventFamily: "deposit",
            eventStatus: "deposit_observed",
            externalEventId: "evt_synthetic_import_review",
            externalPaymentIdPresent: true,
            externalDepositIdPresent: true,
            amountCents: 50000,
            currency: "CAD",
            observedAt: "2026-06-07T00:00:00.000Z",
            importedAt: "2026-06-07T00:05:00.000Z",
            candidateInvoiceId: "invoice_synthetic",
            candidateHostedPaymentRequestId: "payment_request_synthetic",
            candidateManualPaymentId: "payment_synthetic",
            duplicateCuePresent: false,
            reviewState: "needs_review",
            boundaries: {
              rawProviderPayloadRetained: false,
              invoiceBalanceMutation: "none",
              settlementAutomation: false,
              reconciliationMutation: "none",
              refundHandling: "review_only",
              chargebackHandling: "review_only",
              trustPosting: "none",
              providerCommand: "none",
              clientNotification: "none",
              depositMatching: "review_cue_only",
            },
            depositMatchReviewCount: 1,
            latestDepositMatchReview: {
              id: "deposit_match_review_synthetic",
              decision: "candidate_supported",
              reason: "candidate_evidence_matches",
              candidateManualPaymentId: "payment_synthetic",
              candidateInvoiceId: "invoice_synthetic",
              importAmountCents: 50000,
              manualPaymentAmountCents: 50000,
              currency: "CAD",
              candidateManualPaymentStatus: "pending_reconciliation",
              reviewerEvidencePresent: true,
              reviewedAt: "2026-06-07T00:10:00.000Z",
              boundaries: {
                rawProviderPayloadRetained: false,
                invoiceBalanceMutation: "none",
                settlementAutomation: false,
                reconciliationMutation: "none",
                refundHandling: "none",
                chargebackHandling: "none",
                trustPosting: "none",
                providerCommand: "none",
                clientNotification: "none",
                depositMatching: "review_decision_only",
              },
            },
            reconciliationReadiness: {
              eligible: true,
              reason: "supported_candidate_ready",
              reviewAction: "manual_payment_reconcile_review",
              candidateManualPaymentId: "payment_synthetic",
              candidateInvoiceId: "invoice_synthetic",
              amountCents: 50000,
              reasonDetails: [
                {
                  code: "latest_supported_decision",
                  status: "satisfied",
                  label: "Latest decision supports candidate",
                },
                {
                  code: "no_duplicate_or_conflict_cue",
                  status: "satisfied",
                  label: "No duplicate or conflict cue",
                },
                {
                  code: "manual_payment_candidate_matches",
                  status: "satisfied",
                  label: "Manual payment candidate still matches",
                },
                {
                  code: "manual_payment_found",
                  status: "satisfied",
                  label: "Manual payment evidence found",
                },
                {
                  code: "manual_payment_pending",
                  status: "satisfied",
                  label: "Manual payment remains pending",
                },
                {
                  code: "amounts_match",
                  status: "satisfied",
                  label: "Import and manual payment amounts match",
                },
                {
                  code: "invoice_found",
                  status: "satisfied",
                  label: "Candidate invoice found",
                },
                {
                  code: "invoice_candidate_matches",
                  status: "satisfied",
                  label: "Invoice candidate still matches",
                },
                {
                  code: "invoice_balance_covers_payment",
                  status: "satisfied",
                  label: "Invoice balance covers payment",
                },
              ],
              mutation: "none",
            },
          },
          {
            id: "payment_import_review_now_ineligible_synthetic",
            matterId: "matter_synthetic",
            providerLabel: "synthetic_processor",
            eventFamily: "deposit",
            eventStatus: "deposit_observed",
            externalEventId: "evt_synthetic_import_review_now_ineligible",
            externalDepositIdPresent: true,
            amountCents: 50000,
            currency: "CAD",
            observedAt: "2026-06-07T00:20:00.000Z",
            importedAt: "2026-06-07T00:25:00.000Z",
            candidateInvoiceId: "invoice_synthetic",
            candidateManualPaymentId: "payment_synthetic_received",
            duplicateCuePresent: false,
            reviewState: "needs_review",
            boundaries: {
              rawProviderPayloadRetained: false,
              invoiceBalanceMutation: "none",
              settlementAutomation: false,
              reconciliationMutation: "none",
              refundHandling: "review_only",
              chargebackHandling: "review_only",
              trustPosting: "none",
              providerCommand: "none",
              clientNotification: "none",
              depositMatching: "review_cue_only",
            },
            depositMatchReviewCount: 1,
            latestDepositMatchReview: {
              id: "deposit_match_review_now_ineligible_synthetic",
              decision: "candidate_supported",
              reason: "candidate_evidence_matches",
              candidateManualPaymentId: "payment_synthetic_received",
              candidateInvoiceId: "invoice_synthetic",
              importAmountCents: 50000,
              manualPaymentAmountCents: 50000,
              currency: "CAD",
              candidateManualPaymentStatus: "pending_reconciliation",
              reviewerEvidencePresent: true,
              reviewedAt: "2026-06-07T00:30:00.000Z",
              boundaries: {
                rawProviderPayloadRetained: false,
                invoiceBalanceMutation: "none",
                settlementAutomation: false,
                reconciliationMutation: "none",
                refundHandling: "none",
                chargebackHandling: "none",
                trustPosting: "none",
                providerCommand: "none",
                clientNotification: "none",
                depositMatching: "review_decision_only",
              },
            },
            reconciliationReadiness: {
              eligible: false,
              reason: "manual_payment_not_pending",
              reviewAction: "manual_payment_reconcile_review",
              candidateManualPaymentId: "payment_synthetic_received",
              candidateInvoiceId: "invoice_synthetic",
              amountCents: 50000,
              reasonDetails: [
                {
                  code: "latest_supported_decision",
                  status: "satisfied",
                  label: "Latest decision supports candidate",
                },
                {
                  code: "manual_payment_pending",
                  status: "blocked",
                  label: "Manual payment remains pending",
                },
              ],
              mutation: "none",
            },
          },
          {
            id: "payment_import_refund_review_synthetic",
            matterId: "matter_synthetic",
            providerLabel: "synthetic_processor",
            eventFamily: "payment",
            eventStatus: "refund_observed",
            externalEventId: "evt_synthetic_refund_review",
            externalPaymentIdPresent: true,
            amountCents: 12500,
            currency: "CAD",
            observedAt: "2026-06-07T01:00:00.000Z",
            importedAt: "2026-06-07T01:05:00.000Z",
            candidateInvoiceId: "invoice_synthetic",
            reviewState: "needs_review",
            boundaries: {
              rawProviderPayloadRetained: false,
              invoiceBalanceMutation: "none",
              settlementAutomation: false,
              reconciliationMutation: "none",
              refundHandling: "review_only",
              chargebackHandling: "review_only",
              trustPosting: "none",
              providerCommand: "none",
              clientNotification: "none",
              depositMatching: "review_cue_only",
            },
            refundChargebackReviewCue: {
              category: "refund",
              status: "needs_review",
              reviewAction: "staff_refund_chargeback_review_required",
              rawProviderPayloadRetained: false,
              invoiceBalanceMutation: "none",
              ledgerReversal: "none",
              trustPosting: "none",
              providerCommand: "none",
              clientNotification: "none",
            },
          },
          {
            id: "payment_import_chargeback_review_synthetic",
            matterId: "matter_synthetic",
            providerLabel: "synthetic_processor",
            eventFamily: "payment",
            eventStatus: "chargeback_observed",
            externalEventId: "evt_synthetic_chargeback_review",
            externalPaymentIdPresent: true,
            amountCents: 12500,
            currency: "CAD",
            observedAt: "2026-06-07T01:10:00.000Z",
            importedAt: "2026-06-07T01:15:00.000Z",
            candidateInvoiceId: "invoice_synthetic",
            reviewState: "needs_review",
            boundaries: {
              rawProviderPayloadRetained: false,
              invoiceBalanceMutation: "none",
              settlementAutomation: false,
              reconciliationMutation: "none",
              refundHandling: "review_only",
              chargebackHandling: "review_only",
              trustPosting: "none",
              providerCommand: "none",
              clientNotification: "none",
              depositMatching: "review_cue_only",
            },
            refundChargebackReviewCue: {
              category: "chargeback",
              status: "needs_review",
              reviewAction: "staff_refund_chargeback_review_required",
              rawProviderPayloadRetained: false,
              invoiceBalanceMutation: "none",
              ledgerReversal: "none",
              trustPosting: "none",
              providerCommand: "none",
              clientNotification: "none",
            },
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
    const activePaymentImportReviewRecords = activeBilling.paymentImportReviewRecords ?? [];
    const html = renderToStaticMarkup(
      createElement(BillingSection, {
        activeBalanceDueCents: 50000,
        activeCaptureReviewCount:
          activeBilling.captureReviewTime.length + activeBilling.captureReviewExpenses.length,
        activeCaptureReviewExpenses: activeBilling.captureReviewExpenses,
        activeCaptureReviewTime: activeBilling.captureReviewTime,
        activeInvoices: activeBilling.invoices,
        activeManualPayments: activeBilling.payments,
        activeMatter: {
          id: "matter_synthetic",
          number: "SYN-001",
          practiceArea: "Residential tenancy",
          jurisdiction: "BC",
        },
        activePaymentImportReviewRecords,
        activePaymentImportReviewSummary: summarizePaymentImportReviews(
          activePaymentImportReviewRecords,
        ),
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
        createExpenseCategory: async () => {},
        createExpenseDraft: async () => {},
        createTimerDraft: async () => {},
        creatingDraftInvoice: false,
        creatingExpenseCategory: false,
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
        expenseCategoryCode: "",
        expenseCategoryDefaultReimbursable: true,
        expenseCategoryJurisdictions: "",
        expenseCategoryLabel: "",
        expenseCategoryMatterScoped: false,
        expenseCategoryPracticeAreas: "",
        expenseCategoryReimbursableAllowed: true,
        expenseCategoryReviewCue: "",
        expenseCategoryStatus: "No expense category change recorded.",
        manualPaymentReconciliationStatus: "No manual payment reconciled.",
        minutes: formatMinutes,
        onReconcileManualPayment: async () => {},
        reconcilingManualPaymentId: "",
        setDraftInvoiceDueAt: () => {},
        setDraftInvoiceTaxName: () => {},
        setDraftInvoiceTaxRate: () => {},
        setExpenseCategoryCode: () => {},
        setExpenseCategoryDefaultReimbursable: () => {},
        setExpenseCategoryJurisdictions: () => {},
        setExpenseCategoryLabel: () => {},
        setExpenseCategoryMatterScoped: () => {},
        setExpenseCategoryPracticeAreas: () => {},
        setExpenseCategoryReimbursableAllowed: () => {},
        setExpenseCategoryReviewCue: () => {},
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
        toggleExpenseCategoryActive: async () => {},
        updatingExpenseCategoryId: "",
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
    expect(html).toContain("Processor import review");
    expect(html).toContain("synthetic_processor");
    expect(html).toContain("deposit observed");
    expect(html).toContain("Deposit match reviews");
    expect(html).toContain("Review decisions");
    expect(html).toContain("Ready to reconcile");
    expect(html).toContain("Exception cues");
    expect(html).toContain("Refund cues");
    expect(html).toContain("Chargeback cues");
    expect(html).toContain("deposit match review");
    expect(html).toContain("latest review candidate supported");
    expect(html).toContain("Latest deposit review:");
    expect(html).toContain("candidate evidence matches");
    expect(html).toContain("No settlement command");
    expect(html).toContain("Ready for manual reconcile review");
    expect(html).toContain("Read-only cue");
    expect(html).toContain("Readiness details:");
    expect(html).toContain("Latest decision supports candidate satisfied");
    expect(html).toContain("Invoice balance covers payment satisfied");
    expect(html).toContain("Not ready for manual reconcile review");
    expect(html).toContain("Manual payment is not pending");
    expect(html).toContain("Manual payment remains pending blocked");
    expect(html).toContain("refund observed");
    expect(html).toContain("chargeback observed");
    expect(html).toContain("refund review cue");
    expect(html).toContain("chargeback review cue");
    expect(html).toContain("Refund/chargeback review:");
    expect(html).toContain("refund · needs review · No provider command");
    expect(html).toContain("chargeback · needs review · No provider command");
    expect(html).toContain("No raw payload");
    expect(html).toContain("No invoice balance mutation");
    expect(html).toContain("No reconciliation mutation");
    expect(html).toContain("No automatic reconciliation");
    expect(html).toContain("Synthetic EFT");
    expect(html).toContain("Pending reconciliation");
    expect(html).toContain("Reconcile");
    expect(html).toContain("No manual payment reconciled.");
  });
});
