import { describe, expect, it } from "vitest";
import {
  billingDateFallsInsideLock,
  billingPeriodLocksOverlap,
  billingRateRulesOverlapAtSameActiveScope,
  billingRuleScope,
  timerElapsedMsToDraftMinutes,
  resolveBillingRateRule,
  summarizeTrustTransferLedgerLink,
  trustTransferRequestAvailableBalanceCents,
  type BillingRateRuleRecord,
} from "./billing.js";

describe("billing period locks and rate rules", () => {
  it("rounds timer elapsed milliseconds into reviewable draft minutes", () => {
    expect(timerElapsedMsToDraftMinutes(1)).toBe(1);
    expect(timerElapsedMsToDraftMinutes(59_999)).toBe(1);
    expect(timerElapsedMsToDraftMinutes(60_000)).toBe(1);
    expect(timerElapsedMsToDraftMinutes(60_001)).toBe(2);
    expect(timerElapsedMsToDraftMinutes(14 * 60_000 + 1)).toBe(15);
    expect(() => timerElapsedMsToDraftMinutes(0)).toThrow("Timer elapsed time must be positive");
    expect(() => timerElapsedMsToDraftMinutes(Number.NaN)).toThrow(
      "Timer elapsed time must be positive",
    );
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
