import { describe, expect, it } from "vitest";
import {
  assertBillingStatusTransition,
  billingDateFallsInsideLock,
  billingPeriodLocksOverlap,
  billingRateRulesOverlapAtSameActiveScope,
  billingRuleScope,
  billingTimerDraftPolicy,
  billingTimerWindowOverlapsLock,
  billingExpenseCategoryAppliesToMatter,
  billingExpenseCategoryProfileFromRecord,
  defaultBillDeliveryState,
  defaultBillReminderState,
  defaultCreditWriteOffPosture,
  defaultBillingExpenseCategoriesForFirm,
  defaultHostedPaymentProcessorState,
  defaultPaymentImportDepositMatchReviewBoundary,
  defaultPaymentImportRefundChargebackReviewBoundary,
  defaultPaymentImportRefundChargebackResolutionRecordNoSideEffectFlags,
  defaultPaymentImportReviewBoundary,
  defaultPaymentPlanPlaceholder,
  buildPaymentSettlementReview,
  calculateInvoiceTotals,
  defaultPaymentSettlementReview,
  expenseCategoryProfileCues,
  expenseCategoryProfileForKey,
  hostedPaymentRequestPath,
  isBillableUnbilled,
  normalizeExpenseCategoryCode,
  paymentImportDepositMatchReconciliationReadiness,
  paymentImportReviewDepositMatchCue,
  paymentImportReviewHasConflict,
  paymentImportRefundChargebackReviewDecisionMatchesCue,
  paymentImportRefundChargebackReviewCue,
  paymentImportRefundChargebackResolutionPacketPreview,
  paymentImportRefundChargebackResolutionRecordFromPreview,
  resolveBillingRateRule,
  summarizeTrustTransferLedgerLink,
  timerDraftMinutesFromWindow,
  trustTransferRequestAvailableBalanceCents,
  validateBillingExpenseCategory,
  type BillingRateRuleRecord,
  type InvoiceRecord,
  type ManualPaymentRecord,
  type PaymentImportDepositMatchReviewRecord,
  type PaymentImportRefundChargebackReviewRecord,
  type PaymentImportReviewRecord,
} from "./billing.js";
import {
  sampleInvoiceLines,
  samplePaymentAllocations,
  sampleTimeEntries,
  sampleTrustTransferRequests,
} from "./sample-data.js";

describe("billing period locks and rate rules", () => {
  it("computes invoice totals, outstanding balances, and invalid transitions", () => {
    expect(
      calculateInvoiceTotals({ lines: sampleInvoiceLines, allocations: samplePaymentAllocations }),
    ).toMatchObject({
      subtotalCents: 12600,
      taxCents: 630,
      totalCents: 13230,
      balanceDueCents: 13230,
    });
    expect(sampleTrustTransferRequests[0]?.status).toBe("pending_approval");
    expect(sampleTrustTransferRequests[0]?.ledgerTransactionId).toBeUndefined();
    expect(isBillableUnbilled(sampleTimeEntries[0]!)).toBe(true);
    expect(() => assertBillingStatusTransition("approved", "submitted")).toThrow(
      /Invalid billing status transition/,
    );
  });

  it("keeps pending manual payments as review evidence until reconciliation applies allocations", () => {
    const pendingPayment: ManualPaymentRecord = {
      id: "payment-domain-pending",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      invoiceId: "invoice-001",
      receivedAt: "2026-06-16T12:00:00.000Z",
      amountCents: 2500,
      method: "eft",
      status: "pending_reconciliation",
      receivedByUserId: "user-licensee",
      evidence: { source: "synthetic-review-evidence" },
    };

    expect(pendingPayment.status).toBe("pending_reconciliation");
    expect(calculateInvoiceTotals({ lines: sampleInvoiceLines, allocations: [] })).toMatchObject({
      paidCents: 0,
      balanceDueCents: 13230,
    });
  });

  it("treats billing period locks as start-inclusive and end-exclusive", () => {
    const lock = {
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-05-01T00:00:00.000Z",
    };

    expect(billingDateFallsInsideLock("2026-04-01T00:00:00.000Z", lock)).toBe(true);
    expect(billingDateFallsInsideLock("2026-04-30T23:59:59.999Z", lock)).toBe(true);
    expect(billingDateFallsInsideLock("2026-05-01T00:00:00.000Z", lock)).toBe(false);
  });

  it("detects same-firm billing period lock overlaps without blocking adjacent locks", () => {
    const existing = {
      firmId: "firm-west-legal",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-05-01T00:00:00.000Z",
    };

    expect(
      billingPeriodLocksOverlap(existing, {
        firmId: "firm-west-legal",
        periodStart: "2026-04-15T00:00:00.000Z",
        periodEnd: "2026-05-15T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      billingPeriodLocksOverlap(existing, {
        firmId: "firm-west-legal",
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      billingPeriodLocksOverlap(existing, {
        firmId: "firm-north-legal",
        periodStart: "2026-04-15T00:00:00.000Z",
        periodEnd: "2026-05-15T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("resolves the most specific active rate rule for a time entry snapshot", () => {
    const baseRule = {
      firmId: "firm-west-legal",
      active: true,
      createdByUserId: "user-admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    };
    const rules: BillingRateRuleRecord[] = [
      {
        ...baseRule,
        id: "firm-default-rate",
        label: "Firm default",
        scope: "firm",
        rateCents: 15000,
      },
      {
        ...baseRule,
        id: "matter-rate",
        label: "Matter rate",
        matterId: "matter-001",
        scope: billingRuleScope({ matterId: "matter-001" }),
        rateCents: 20000,
      },
      {
        ...baseRule,
        id: "matter-user-rate",
        label: "Matter user rate",
        matterId: "matter-001",
        userId: "user-licensee",
        scope: billingRuleScope({ matterId: "matter-001", userId: "user-licensee" }),
        rateCents: 25000,
      },
      {
        ...baseRule,
        id: "inactive-rate",
        label: "Inactive rate",
        scope: "firm",
        rateCents: 99999,
        active: false,
      },
    ];

    expect(
      resolveBillingRateRule(rules, {
        matterId: "matter-001",
        userId: "user-licensee",
        performedAt: "2026-04-01T12:00:00.000Z",
      }),
    ).toMatchObject({ id: "matter-user-rate", rateCents: 25000 });
  });

  it("detects active same-scope billing rate rule overlaps", () => {
    const baseRule = {
      id: "matter-user-rate",
      firmId: "firm-west-legal",
      label: "Synthetic matter user rate",
      matterId: "matter-001",
      userId: "user-licensee",
      scope: billingRuleScope({ matterId: "matter-001", userId: "user-licensee" }),
      rateCents: 20000,
      effectiveFrom: "2026-04-01T00:00:00.000Z",
      active: true,
      createdByUserId: "user-admin",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    } satisfies BillingRateRuleRecord;

    expect(
      billingRateRulesOverlapAtSameActiveScope(baseRule, {
        ...baseRule,
        id: "overlapping-rate",
        effectiveFrom: "2026-04-15T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      billingRateRulesOverlapAtSameActiveScope(baseRule, {
        ...baseRule,
        id: "later-open-ended-rate",
        effectiveFrom: "2026-05-01T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      billingRateRulesOverlapAtSameActiveScope(
        { ...baseRule, effectiveUntil: "2026-05-01T00:00:00.000Z" },
        {
          ...baseRule,
          id: "next-period-rate",
          effectiveFrom: "2026-05-01T00:00:00.000Z",
        },
      ),
    ).toBe(false);
    expect(
      billingRateRulesOverlapAtSameActiveScope(baseRule, {
        ...baseRule,
        id: "different-user-rate",
        userId: "user-staff",
      }),
    ).toBe(false);
  });

  it("rounds local timer windows into draft minutes", () => {
    expect(
      timerDraftMinutesFromWindow({
        startedAt: "2026-04-12T10:00:00.000Z",
        stoppedAt: "2026-04-12T10:00:01.000Z",
      }),
    ).toBe(1);
    expect(
      timerDraftMinutesFromWindow({
        startedAt: "2026-04-12T10:00:00.000Z",
        stoppedAt: "2026-04-12T10:44:01.000Z",
      }),
    ).toBe(45);
    expect(() =>
      timerDraftMinutesFromWindow({
        startedAt: "2026-04-12T10:00:00.000Z",
        stoppedAt: "2026-04-12T10:00:00.000Z",
      }),
    ).toThrow("Timer draft stop time must be after start time");
  });

  it("finds billing period locks that overlap a timer window", () => {
    const locks = [
      {
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-05-01T00:00:00.000Z",
      },
    ];

    expect(
      billingTimerWindowOverlapsLock({
        startedAt: "2026-03-31T23:45:00.000Z",
        stoppedAt: "2026-04-01T00:15:00.000Z",
        locks,
      }),
    ).toEqual(locks[0]);
    expect(
      billingTimerWindowOverlapsLock({
        startedAt: "2026-05-01T00:00:00.000Z",
        stoppedAt: "2026-05-01T00:15:00.000Z",
        locks,
      }),
    ).toBeUndefined();
  });

  it("keeps billing capture helper metadata review-only", () => {
    expect(billingTimerDraftPolicy).toEqual({
      createsDraftOnly: true,
      autoSubmitEnabled: false,
      autoApproveEnabled: false,
      lockBypassAllowed: false,
    });
    expect(expenseCategoryProfileForKey("filing_service")).toMatchObject({
      category: "Filing and service",
      defaultReimbursable: true,
      reviewOnly: true,
    });
    expect(expenseCategoryProfileForKey("missing-profile")).toBeUndefined();
    expect(expenseCategoryProfileCues.every((profile) => profile.reviewOnly)).toBe(true);
  });

  it("builds and validates firm-managed expense category records", () => {
    const [category] = defaultBillingExpenseCategoriesForFirm({
      firmId: "firm-synthetic",
      createdByUserId: "user-synthetic",
      now: "2026-06-17T00:00:00.000Z",
    });
    expect(category).toMatchObject({
      code: "filing_service",
      label: "Filing and service",
      active: true,
      practiceAreas: [],
      jurisdictions: [],
    });
    expect(normalizeExpenseCategoryCode(" Filing Service ")).toBe("filing_service");
    expect(() =>
      validateBillingExpenseCategory({
        ...category!,
        code: "Filing",
      }),
    ).toThrow(/lowercase letters/);
    expect(
      billingExpenseCategoryAppliesToMatter(
        { ...category!, practiceAreas: ["Residential tenancy"], jurisdictions: ["BC"] },
        { id: "matter-synthetic", practiceArea: "Residential tenancy", jurisdiction: "BC" },
      ),
    ).toBe(true);
    expect(
      billingExpenseCategoryAppliesToMatter(
        { ...category!, practiceAreas: ["Notarial services"], jurisdictions: ["ON"] },
        { id: "matter-synthetic", practiceArea: "Residential tenancy", jurisdiction: "BC" },
      ),
    ).toBe(false);
    expect(billingExpenseCategoryProfileFromRecord(category!)).toMatchObject({
      key: "filing_service",
      category: "Filing and service",
      reviewOnly: true,
    });
  });

  it("defaults hosted payment request shells to non-settlement posture", () => {
    expect(hostedPaymentRequestPath("payment-request-001")).toBe(
      "/payments/requests/payment-request-001",
    );
    expect(defaultBillDeliveryState()).toMatchObject({
      status: "not_sent",
      channel: "none",
      recipientCount: 0,
    });
    expect(defaultBillReminderState()).toMatchObject({
      status: "not_scheduled",
      reminderCount: 0,
    });
    expect(defaultPaymentPlanPlaceholder()).toMatchObject({
      status: "not_offered",
      enforcement: "none",
    });
    expect(defaultCreditWriteOffPosture()).toMatchObject({
      status: "none",
      movement: "none",
    });
    expect(defaultHostedPaymentProcessorState()).toEqual({
      status: "not_started",
    });
  });

  it("keeps processor settlement review as staff-only evidence without automatic mutation", () => {
    expect(defaultPaymentSettlementReview()).toMatchObject({
      status: "not_received",
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
    });

    expect(
      buildPaymentSettlementReview({
        provider: "stripe",
        eventType: "checkout_session_completed",
        paymentStatus: "paid",
        externalEventId: "evt_synthetic_settlement",
        externalSessionId: "cs_synthetic_settlement",
        amountCents: 5000,
        currency: "CAD",
        observedAt: "2026-06-04T12:00:00.000Z",
        receivedAt: "2026-06-04T12:01:00.000Z",
      }),
    ).toMatchObject({
      status: "needs_review",
      provider: "stripe",
      eventType: "checkout_session_completed",
      paymentStatus: "paid",
      externalEventId: "evt_synthetic_settlement",
      externalSessionId: "cs_synthetic_settlement",
      amountCents: 5000,
      currency: "CAD",
      invoiceBalanceMutation: "none",
      reconciliationMutation: "none",
      trustPosting: "none",
      webhookBoundary: expect.objectContaining({
        signatureVerified: false,
        rawWebhookBodyStored: false,
      }),
    });
  });

  it("keeps processor import review records as normalized cues without side effects", () => {
    const depositMatchCue = paymentImportReviewDepositMatchCue({
      candidateManualPaymentId: "payment-pending-reconciliation",
    });

    expect(defaultPaymentImportReviewBoundary()).toEqual({
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
    });
    expect(paymentImportReviewHasConflict({})).toBe(false);
    expect(paymentImportReviewHasConflict({ conflictReason: "candidate_mismatch" })).toBe(true);
    expect(paymentImportReviewHasConflict({ duplicateOfRecordId: "review-duplicate" })).toBe(true);
    expect(depositMatchCue).toEqual({
      reviewAction: "staff_deposit_match_review_required",
      candidateManualPaymentId: "payment-pending-reconciliation",
      invoiceBalanceMutation: "none",
      reconciliationMutation: "none",
      trustPosting: "none",
    });
    expect(
      paymentImportRefundChargebackReviewCue({
        eventFamily: "payment",
        eventStatus: "refund_observed",
      }),
    ).toEqual({
      category: "refund",
      status: "needs_review",
      reviewAction: "staff_refund_chargeback_review_required",
      rawProviderPayloadRetained: false,
      invoiceBalanceMutation: "none",
      ledgerReversal: "none",
      trustPosting: "none",
      providerCommand: "none",
      clientNotification: "none",
    });
    expect(
      paymentImportRefundChargebackReviewCue({
        eventFamily: "payment",
        eventStatus: "chargeback_observed",
      }),
    ).toMatchObject({
      category: "chargeback",
      status: "needs_review",
      reviewAction: "staff_refund_chargeback_review_required",
    });
    expect(
      paymentImportRefundChargebackReviewCue({
        eventFamily: "payment",
        eventStatus: "payment_observed",
      }),
    ).toBeUndefined();
    expect(
      paymentImportRefundChargebackReviewCue({
        eventFamily: "deposit",
        eventStatus: "refund_observed",
      }),
    ).toBeUndefined();
    expect(defaultPaymentImportDepositMatchReviewBoundary()).toEqual({
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
    });
  });

  it("keeps refund and chargeback review decisions enum-only and side-effect free", () => {
    expect(defaultPaymentImportRefundChargebackReviewBoundary()).toEqual({
      rawProviderPayloadRetained: false,
      refundArtifactRetained: false,
      disputeArtifactRetained: false,
      invoiceBalanceMutation: "none",
      ledgerReversal: "none",
      trustPosting: "none",
      providerCommand: "none",
      clientNotification: "none",
      fundsMovement: "none",
      refundHandling: "review_decision_only",
      chargebackHandling: "review_decision_only",
    });

    const refundReview = {
      id: "refund-chargeback-review-domain",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      paymentImportReviewRecordId: "payment-import-review-domain",
      category: "refund",
      decision: "exception_confirmed",
      reason: "refund_observed",
      reviewerEvidencePresent: true,
      idempotencyKey: "synthetic-refund-review",
      decisionFingerprint: "synthetic-fingerprint",
      boundaries: defaultPaymentImportRefundChargebackReviewBoundary(),
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-29T12:00:00.000Z",
      createdAt: "2026-06-29T12:00:00.000Z",
    } satisfies PaymentImportRefundChargebackReviewRecord;

    expect(paymentImportRefundChargebackReviewDecisionMatchesCue(refundReview)).toBe(true);
    expect(
      paymentImportRefundChargebackReviewDecisionMatchesCue({
        ...refundReview,
        reason: "chargeback_observed",
      }),
    ).toBe(false);
    expect(
      paymentImportRefundChargebackReviewDecisionMatchesCue({
        ...refundReview,
        decision: "needs_more_evidence",
        reason: "status_unclear",
      }),
    ).toBe(true);
  });

  it("builds read-only refund and chargeback resolution packet previews from enum decisions", () => {
    const refundImportRecord = {
      id: "payment-import-review-refund-domain",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      providerLabel: "synthetic_processor",
      eventFamily: "payment",
      eventStatus: "refund_observed",
      externalEventId: "evt_synthetic_refund_domain",
      externalPaymentId: "pay_synthetic_refund_domain",
      amountCents: 2500,
      currency: "CAD",
      importedAt: "2026-06-30T12:00:00.000Z",
      importedByUserId: "user-licensee",
      candidateInvoiceId: "invoice-001",
      reviewState: "needs_review",
      normalizedEvidenceFingerprint: "synthetic-refund-domain-fingerprint",
      boundaries: defaultPaymentImportReviewBoundary(),
      updatedAt: "2026-06-30T12:00:00.000Z",
    } satisfies PaymentImportReviewRecord;
    const awaitingPreview = paymentImportRefundChargebackResolutionPacketPreview({
      importRecord: refundImportRecord,
      reviews: [],
    });
    expect(awaitingPreview).toEqual({
      reviewOnly: true,
      paymentImportReviewRecordId: "payment-import-review-refund-domain",
      matterId: "matter-001",
      candidateInvoiceId: "invoice-001",
      category: "refund",
      cueStatus: "needs_review",
      resolutionPosture: "awaiting_decision",
      reasonCategories: [],
      noSideEffectFlags: {
        rawProviderPayloadRetained: false,
        invoiceBalanceMutation: "none",
        ledgerReversal: "none",
        providerCommand: "none",
        refundArtifactStorage: false,
        disputeArtifactStorage: false,
        freeFormNotes: false,
        clientNotification: "none",
        trustPosting: "none",
        fundsMovement: "none",
      },
    });
    expect(
      awaitingPreview
        ? paymentImportRefundChargebackResolutionRecordFromPreview({
            id: "resolution-record-awaiting-domain",
            firmId: "firm-west-legal",
            idempotencyKey: "synthetic-resolution-awaiting",
            resolutionFingerprint: "synthetic-resolution-awaiting-fingerprint",
            recordedByUserId: "user-licensee",
            recordedAt: "2026-06-30T12:06:00.000Z",
            packetPreview: awaitingPreview,
          })
        : undefined,
    ).toBeUndefined();

    const refundReview = {
      id: "refund-chargeback-review-domain",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      paymentImportReviewRecordId: refundImportRecord.id,
      category: "refund",
      decision: "exception_confirmed",
      reason: "refund_observed",
      reviewerEvidencePresent: true,
      idempotencyKey: "synthetic-refund-review",
      decisionFingerprint: "synthetic-refund-fingerprint",
      boundaries: defaultPaymentImportRefundChargebackReviewBoundary(),
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-30T12:05:00.000Z",
      createdAt: "2026-06-30T12:05:00.000Z",
    } satisfies PaymentImportRefundChargebackReviewRecord;
    const confirmedPreview = paymentImportRefundChargebackResolutionPacketPreview({
      importRecord: refundImportRecord,
      reviews: [refundReview],
    });
    expect(confirmedPreview).toMatchObject({
      latestReviewId: "refund-chargeback-review-domain",
      resolutionPosture: "confirmed_exception",
      reasonCategories: ["refund_observed"],
      latestReviewerMetadata: {
        decision: "exception_confirmed",
        reason: "refund_observed",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-06-30T12:05:00.000Z",
        reviewerEvidencePresent: true,
      },
      noSideEffectFlags: {
        providerCommand: "none",
        freeFormNotes: false,
        fundsMovement: "none",
      },
    });
    expect(
      confirmedPreview
        ? paymentImportRefundChargebackResolutionRecordFromPreview({
            id: "resolution-record-confirmed-domain",
            firmId: "firm-west-legal",
            idempotencyKey: "synthetic-resolution-confirmed",
            resolutionFingerprint: "synthetic-resolution-confirmed-fingerprint",
            recordedByUserId: "user-licensee",
            recordedAt: "2026-06-30T12:06:00.000Z",
            packetPreview: confirmedPreview,
          })
        : undefined,
    ).toEqual({
      id: "resolution-record-confirmed-domain",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      paymentImportReviewRecordId: "payment-import-review-refund-domain",
      candidateInvoiceId: "invoice-001",
      latestReviewId: "refund-chargeback-review-domain",
      category: "refund",
      resolutionPosture: "confirmed_exception",
      reasonCategories: ["refund_observed"],
      latestReviewerMetadata: {
        decision: "exception_confirmed",
        reason: "refund_observed",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-06-30T12:05:00.000Z",
        reviewerEvidencePresent: true,
      },
      noSideEffectFlags: defaultPaymentImportRefundChargebackResolutionRecordNoSideEffectFlags(),
      idempotencyKey: "synthetic-resolution-confirmed",
      resolutionFingerprint: "synthetic-resolution-confirmed-fingerprint",
      recordedByUserId: "user-licensee",
      recordedAt: "2026-06-30T12:06:00.000Z",
      createdAt: "2026-06-30T12:06:00.000Z",
    });
    expect(
      paymentImportRefundChargebackResolutionPacketPreview({
        importRecord: refundImportRecord,
        reviews: [refundReview],
      }),
    ).toMatchObject({
      latestReviewId: "refund-chargeback-review-domain",
      resolutionPosture: "confirmed_exception",
      reasonCategories: ["refund_observed"],
      latestReviewerMetadata: {
        decision: "exception_confirmed",
        reason: "refund_observed",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-06-30T12:05:00.000Z",
        reviewerEvidencePresent: true,
      },
      noSideEffectFlags: {
        providerCommand: "none",
        freeFormNotes: false,
        fundsMovement: "none",
      },
    });

    const chargebackImportRecord = {
      ...refundImportRecord,
      id: "payment-import-review-chargeback-domain",
      eventStatus: "chargeback_observed",
      externalEventId: "evt_synthetic_chargeback_domain",
      externalPaymentId: "pay_synthetic_chargeback_domain",
    } satisfies PaymentImportReviewRecord;
    const chargebackReview = {
      ...refundReview,
      id: "chargeback-review-domain",
      paymentImportReviewRecordId: chargebackImportRecord.id,
      category: "chargeback",
      decision: "needs_more_evidence",
      reason: "status_unclear",
      idempotencyKey: "synthetic-chargeback-review",
      decisionFingerprint: "synthetic-chargeback-fingerprint",
      reviewedAt: "2026-06-30T12:10:00.000Z",
      createdAt: "2026-06-30T12:10:00.000Z",
    } satisfies PaymentImportRefundChargebackReviewRecord;
    expect(
      paymentImportRefundChargebackResolutionPacketPreview({
        importRecord: chargebackImportRecord,
        reviews: [refundReview, chargebackReview],
      }),
    ).toMatchObject({
      paymentImportReviewRecordId: "payment-import-review-chargeback-domain",
      category: "chargeback",
      latestReviewId: "chargeback-review-domain",
      resolutionPosture: "needs_more_evidence",
      reasonCategories: ["status_unclear"],
    });
    expect(
      paymentImportRefundChargebackResolutionPacketPreview({
        importRecord: {
          ...refundImportRecord,
          id: "payment-import-review-deposit-domain",
          eventFamily: "deposit",
          eventStatus: "deposit_observed",
        },
        reviews: [refundReview],
      }),
    ).toBeUndefined();
  });

  it("classifies OP-T162 deposit-match decisions as read-only manual reconcile cues", () => {
    const importRecord = {
      id: "payment-import-review-domain",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      providerLabel: "synthetic_processor",
      eventFamily: "deposit",
      eventStatus: "deposit_observed",
      externalEventId: "evt_synthetic_domain",
      externalDepositId: "dep_synthetic_domain",
      amountCents: 5000,
      currency: "CAD",
      importedAt: "2026-06-27T12:00:00.000Z",
      importedByUserId: "user-licensee",
      candidateInvoiceId: "invoice-001",
      candidateManualPaymentId: "payment-001",
      reviewState: "needs_review",
      normalizedEvidenceFingerprint: "synthetic-domain-fingerprint",
      boundaries: defaultPaymentImportReviewBoundary(),
      updatedAt: "2026-06-27T12:00:00.000Z",
    } satisfies PaymentImportReviewRecord;
    const supportedReview = {
      id: "deposit-match-review-domain",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      paymentImportReviewRecordId: importRecord.id,
      candidateManualPaymentId: "payment-001",
      candidateInvoiceId: "invoice-001",
      decision: "candidate_supported",
      reason: "candidate_evidence_matches",
      importAmountCents: 5000,
      manualPaymentAmountCents: 5000,
      currency: "CAD",
      candidateManualPaymentStatus: "pending_reconciliation",
      reviewerEvidencePresent: true,
      idempotencyKey: "synthetic-readiness-key",
      decisionFingerprint: "synthetic-readiness-fingerprint",
      boundaries: defaultPaymentImportDepositMatchReviewBoundary(),
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-27T12:05:00.000Z",
      createdAt: "2026-06-27T12:05:00.000Z",
    } satisfies PaymentImportDepositMatchReviewRecord;
    const manualPayment = {
      id: "payment-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      invoiceId: "invoice-001",
      receivedAt: "2026-06-27T12:01:00.000Z",
      amountCents: 5000,
      method: "eft",
      status: "pending_reconciliation",
      receivedByUserId: "user-licensee",
    } satisfies ManualPaymentRecord;
    const invoice = {
      id: "invoice-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      invoiceNumber: "INV-001",
      status: "issued",
      createdByUserId: "user-licensee",
      createdAt: "2026-06-27T11:00:00.000Z",
      subtotalCents: 10000,
      taxCents: 0,
      totalCents: 10000,
      paidCents: 0,
      balanceDueCents: 10000,
    } satisfies InvoiceRecord;
    const readinessDetailLabels = {
      latest_supported_decision: "Latest decision supports candidate",
      no_duplicate_or_conflict_cue: "No duplicate or conflict cue",
      manual_payment_candidate_matches: "Manual payment candidate still matches",
      manual_payment_found: "Manual payment evidence found",
      manual_payment_pending: "Manual payment remains pending",
      amounts_match: "Import and manual payment amounts match",
      invoice_found: "Candidate invoice found",
      invoice_candidate_matches: "Invoice candidate still matches",
      invoice_balance_covers_payment: "Invoice balance covers payment",
    } as const;
    const detail = (code: keyof typeof readinessDetailLabels, status: "satisfied" | "blocked") => ({
      code,
      status,
      label: readinessDetailLabels[code],
    });
    const supportedSatisfiedDetails = [
      detail("latest_supported_decision", "satisfied"),
      detail("no_duplicate_or_conflict_cue", "satisfied"),
      detail("manual_payment_candidate_matches", "satisfied"),
      detail("manual_payment_found", "satisfied"),
      detail("manual_payment_pending", "satisfied"),
      detail("amounts_match", "satisfied"),
      detail("invoice_found", "satisfied"),
      detail("invoice_candidate_matches", "satisfied"),
      detail("invoice_balance_covers_payment", "satisfied"),
    ];

    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        manualPayment,
        invoice,
      }),
    ).toEqual({
      eligible: true,
      reason: "supported_candidate_ready",
      reviewAction: "manual_payment_reconcile_review",
      candidateManualPaymentId: "payment-001",
      candidateInvoiceId: "invoice-001",
      amountCents: 5000,
      reasonDetails: supportedSatisfiedDetails,
      mutation: "none",
    });

    expect(
      paymentImportDepositMatchReconciliationReadiness({ importRecord, manualPayment, invoice }),
    ).toMatchObject({
      eligible: false,
      reason: "no_supported_decision",
      reasonDetails: [detail("latest_supported_decision", "blocked")],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: {
          ...supportedReview,
          decision: "candidate_rejected",
          reason: "amount_mismatch",
        },
        manualPayment,
        invoice,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "candidate_not_supported",
      reasonDetails: [detail("latest_supported_decision", "blocked")],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord: { ...importRecord, conflictReason: "duplicate" },
        latestReview: supportedReview,
        manualPayment,
        invoice,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "import_record_conflict",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord: { ...importRecord, candidateManualPaymentId: "payment-other" },
        latestReview: supportedReview,
        manualPayment,
        invoice,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "candidate_manual_payment_mismatch",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        invoice,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "manual_payment_not_found",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "satisfied"),
        detail("manual_payment_found", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        manualPayment: { ...manualPayment, status: "received" },
        invoice,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "manual_payment_not_pending",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "satisfied"),
        detail("manual_payment_found", "satisfied"),
        detail("manual_payment_pending", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        manualPayment: { ...manualPayment, amountCents: 4900 },
        invoice,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "amount_mismatch",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "satisfied"),
        detail("manual_payment_found", "satisfied"),
        detail("manual_payment_pending", "satisfied"),
        detail("amounts_match", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        manualPayment,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "invoice_not_found",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "satisfied"),
        detail("manual_payment_found", "satisfied"),
        detail("manual_payment_pending", "satisfied"),
        detail("amounts_match", "satisfied"),
        detail("invoice_found", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        manualPayment,
        invoice: { ...invoice, matterId: "matter-002" },
      }),
    ).toMatchObject({
      eligible: false,
      reason: "invoice_candidate_mismatch",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "satisfied"),
        detail("manual_payment_found", "satisfied"),
        detail("manual_payment_pending", "satisfied"),
        detail("amounts_match", "satisfied"),
        detail("invoice_found", "satisfied"),
        detail("invoice_candidate_matches", "blocked"),
      ],
    });
    expect(
      paymentImportDepositMatchReconciliationReadiness({
        importRecord,
        latestReview: supportedReview,
        manualPayment,
        invoice: { ...invoice, balanceDueCents: 4000 },
      }),
    ).toMatchObject({
      eligible: false,
      reason: "invoice_balance_insufficient",
      reasonDetails: [
        detail("latest_supported_decision", "satisfied"),
        detail("no_duplicate_or_conflict_cue", "satisfied"),
        detail("manual_payment_candidate_matches", "satisfied"),
        detail("manual_payment_found", "satisfied"),
        detail("manual_payment_pending", "satisfied"),
        detail("amounts_match", "satisfied"),
        detail("invoice_found", "satisfied"),
        detail("invoice_candidate_matches", "satisfied"),
        detail("invoice_balance_covers_payment", "blocked"),
      ],
    });
  });
});

describe("trust transfer request billing helpers", () => {
  it("calculates matter trust balance for client-scoped and matter-scoped requests", () => {
    const trustBalances = {
      "contact-ada:matter-001": 150000,
      "contact-other:matter-001": 25000,
      "contact-overdrawn:matter-001": -10000,
      "contact-northstar:matter-002": 5000,
    };

    expect(
      trustTransferRequestAvailableBalanceCents({
        request: { matterId: "matter-001", clientContactId: "contact-ada" },
        trustBalances,
      }),
    ).toBe(150000);
    expect(
      trustTransferRequestAvailableBalanceCents({
        request: { matterId: "matter-001" },
        trustBalances,
      }),
    ).toBe(175000);
    expect(
      trustTransferRequestAvailableBalanceCents({
        request: { matterId: "matter-001", clientContactId: "contact-overdrawn" },
        trustBalances,
      }),
    ).toBe(0);
  });

  it("summarizes whether a ledger transaction matches a trust transfer request", () => {
    const summary = summarizeTrustTransferLedgerLink({
      request: {
        matterId: "matter-001",
        clientContactId: "contact-ada",
        amountCents: 13230,
      },
      ledgerTransactionId: "trust-transfer-posting",
      accounts: [
        { id: "acct-trust-bank", type: "trust_asset" },
        { id: "acct-client-liability", type: "client_liability" },
      ],
      entries: [
        {
          transactionId: "trust-transfer-posting",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 13230,
          creditCents: 0,
        },
        {
          transactionId: "trust-transfer-posting",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 0,
          creditCents: 13230,
        },
      ],
    });

    expect(summary).toEqual({
      transactionExists: true,
      matterMatches: true,
      clientMatches: true,
      trustAssetCreditCents: 13230,
      clientLiabilityDebitCents: 13230,
      amountMatches: true,
    });
  });

  it("rejects missing, cross-matter, cross-client, and extra-entry ledger link evidence", () => {
    const request = {
      matterId: "matter-001",
      clientContactId: "contact-ada",
      amountCents: 13230,
    };
    const accounts = [
      { id: "acct-trust-bank", type: "trust_asset" as const },
      { id: "acct-client-liability", type: "client_liability" as const },
      { id: "acct-operating-revenue", type: "operating_revenue" as const },
    ];

    expect(
      summarizeTrustTransferLedgerLink({
        request,
        ledgerTransactionId: "missing-posting",
        accounts,
        entries: [],
      }),
    ).toMatchObject({ transactionExists: false, amountMatches: false });
    expect(
      summarizeTrustTransferLedgerLink({
        request,
        ledgerTransactionId: "other-matter-posting",
        accounts,
        entries: [
          {
            transactionId: "other-matter-posting",
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 13230,
            creditCents: 0,
          },
          {
            transactionId: "other-matter-posting",
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 13230,
          },
        ],
      }),
    ).toMatchObject({ transactionExists: true, matterMatches: false, amountMatches: false });
    expect(
      summarizeTrustTransferLedgerLink({
        request,
        ledgerTransactionId: "other-client-posting",
        accounts,
        entries: [
          {
            transactionId: "other-client-posting",
            matterId: "matter-001",
            clientId: "contact-other",
            accountId: "acct-client-liability",
            debitCents: 13230,
            creditCents: 0,
          },
          {
            transactionId: "other-client-posting",
            matterId: "matter-001",
            clientId: "contact-other",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 13230,
          },
        ],
      }),
    ).toMatchObject({ matterMatches: true, clientMatches: false, amountMatches: false });
    expect(
      summarizeTrustTransferLedgerLink({
        request,
        ledgerTransactionId: "extra-entry-posting",
        accounts,
        entries: [
          {
            transactionId: "extra-entry-posting",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 13230,
            creditCents: 0,
          },
          {
            transactionId: "extra-entry-posting",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 13230,
          },
          {
            transactionId: "extra-entry-posting",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-operating-revenue",
            debitCents: 0,
            creditCents: 500,
          },
        ],
      }),
    ).toMatchObject({ matterMatches: true, clientMatches: true, amountMatches: false });
  });
});
