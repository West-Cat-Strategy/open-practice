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
  defaultPaymentPlanPlaceholder,
  buildPaymentSettlementReview,
  calculateInvoiceTotals,
  defaultPaymentSettlementReview,
  expenseCategoryProfileCues,
  expenseCategoryProfileForKey,
  hostedPaymentRequestPath,
  isBillableUnbilled,
  normalizeExpenseCategoryCode,
  resolveBillingRateRule,
  summarizeTrustTransferLedgerLink,
  timerDraftMinutesFromWindow,
  trustTransferRequestAvailableBalanceCents,
  validateBillingExpenseCategory,
  type BillingRateRuleRecord,
  type ManualPaymentRecord,
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
