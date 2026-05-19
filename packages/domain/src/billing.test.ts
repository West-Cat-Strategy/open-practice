import { describe, expect, it } from "vitest";
import {
  isBillingEntrySnapshotMutable,
  isBillingPeriodLockActiveForEntry,
  isBillingRatePresetEffectiveForDate,
  summarizeBillingTrustExportCounts,
  summarizeTrustTransferLedgerLink,
  trustTransferRequestAvailableBalanceCents,
} from "./billing.js";

describe("billing lock and rate helpers", () => {
  it("treats submitted and later entry snapshots as immutable", () => {
    expect(isBillingEntrySnapshotMutable("draft")).toBe(true);
    for (const status of ["submitted", "approved", "billed", "written_off"] as const) {
      expect(isBillingEntrySnapshotMutable(status)).toBe(false);
    }
  });

  it("matches rate presets and active period locks by effective date", () => {
    expect(
      isBillingRatePresetEffectiveForDate(
        {
          effectiveFrom: "2026-05-01T00:00:00.000Z",
          effectiveTo: "2026-05-31T23:59:59.000Z",
        },
        "2026-05-19T16:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      isBillingRatePresetEffectiveForDate(
        { effectiveFrom: "2026-06-01T00:00:00.000Z" },
        "2026-05-19T16:00:00.000Z",
      ),
    ).toBe(false);
    expect(
      isBillingPeriodLockActiveForEntry(
        {
          matterId: "matter-001",
          startsOn: "2026-05-01",
          endsOn: "2026-05-31",
          status: "active",
        },
        { matterId: "matter-001", occurredAt: "2026-05-19T16:00:00.000Z" },
      ),
    ).toBe(true);
    expect(
      isBillingPeriodLockActiveForEntry(
        {
          matterId: "matter-002",
          startsOn: "2026-05-01",
          endsOn: "2026-05-31",
          status: "active",
        },
        { matterId: "matter-001", occurredAt: "2026-05-19T16:00:00.000Z" },
      ),
    ).toBe(false);
    expect(
      isBillingPeriodLockActiveForEntry(
        {
          startsOn: "2026-05-01",
          endsOn: "2026-05-31",
          status: "released",
        },
        { matterId: "matter-001", occurredAt: "2026-05-19T16:00:00.000Z" },
      ),
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

  it("summarizes async billing and trust export counts without inspecting private fields", () => {
    expect(
      summarizeBillingTrustExportCounts({
        exportKind: "billing",
        billing: {
          timeEntries: [
            {
              id: "time-export-count",
              firmId: "firm-west-legal",
              matterId: "matter-001",
              userId: "user-admin",
              performedAt: "2026-05-18T10:00:00.000Z",
              minutes: 30,
              rateCents: 18000,
              narrative: "Synthetic private billing export narrative",
              billable: true,
              billingStatus: "approved",
            },
          ],
          expenseEntries: [],
          invoices: [],
          payments: [],
        },
      }),
    ).toEqual({
      recordCount: 1,
      timeEntryCount: 1,
      expenseEntryCount: 0,
      invoiceCount: 0,
      paymentCount: 0,
    });

    expect(
      summarizeBillingTrustExportCounts({
        exportKind: "trust",
        trust: {
          accounts: [
            {
              id: "acct-trust-bank",
              firmId: "firm-west-legal",
              name: "Trust",
              type: "trust_asset",
            },
          ],
          entries: [
            {
              id: "ledger-export-count",
              transactionId: "trust-retainer",
              firmId: "firm-west-legal",
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 100,
              creditCents: 0,
              memo: "Synthetic private ledger export memo",
              postedAt: "2026-05-18T10:00:00.000Z",
            },
          ],
          balances: { "matter-001": 100 },
          trustBalances: { "contact-ada:matter-001": 100 },
          trustTransferRequests: [],
        },
      }),
    ).toEqual({
      recordCount: 4,
      trustTransferRequestCount: 0,
      ledgerAccountCount: 1,
      ledgerEntryCount: 1,
      balanceCount: 1,
      trustBalanceCount: 1,
    });
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
