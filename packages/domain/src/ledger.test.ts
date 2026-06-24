import { describe, expect, it } from "vitest";
import {
  buildLedgerBalanceSnapshotComparison,
  buildLedgerReconciliationExceptionResolutionStatementRow,
  buildJurisdictionalTrustReport,
  clientTrustBalanceByMatter,
  clientTrustBalanceDeltas,
  createReversalTransaction,
  ledgerAccountingReviewSummary,
  ledgerBalanceByMatter,
  ledgerBankFeedReconciliationReviewSummary,
  ledgerControlsDiagnostics,
  ledgerPostingRequestFromTransaction,
  ledgerPostingRequestReviewSummary,
  ledgerReconciliationPacketReview,
  ledgerReconciliationFreshnessReview,
  ledgerReconciliationReviewSummary,
  ledgerTransactionFromPostingRequest,
  postLedgerTransaction,
  previewLedgerStatementImport,
  validateLedgerPostingRequestRecord,
  validateLedgerAccountingReviewProfileRecord,
  validateLedgerReconciliationExceptionResolutionRecord,
  validateLedgerReconciliationRecord,
  validateLedgerStatementMatchRuleProfileRecord,
  validateLedgerStatementImportBatchRecord,
} from "./ledger.js";
import type {
  LedgerAccountingReviewProfileRecord,
  LedgerAccount,
  LedgerEntry,
  LedgerPostingRequestRecord,
  LedgerReconciliationExceptionResolutionRecord,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransaction,
  LedgerTransactionApprovalRecord,
  PostedLedgerTransaction,
} from "./ledger.js";
import {
  defaultPaymentImportReviewBoundary,
  type PaymentImportReviewRecord,
  type TrustTransferRequestRecord,
} from "./billing.js";
import { sampleFirm, sampleLedgerAccounts, sampleLedgerEntries } from "./sample-data.js";

const accounts: LedgerAccount[] = [
  { id: "acct-trust-bank", firmId: "firm-west-legal", name: "Pooled trust", type: "trust_asset" },
  {
    id: "acct-client-liability",
    firmId: "firm-west-legal",
    name: "Client liability",
    type: "client_liability",
  },
  {
    id: "acct-operating",
    firmId: "firm-west-legal",
    name: "Operating revenue",
    type: "operating_revenue",
  },
];

const entries: LedgerEntry[] = [
  {
    id: "entry-001",
    transactionId: "tx-pending",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    clientId: "contact-ada",
    accountId: "acct-trust-bank",
    debitCents: 5000,
    creditCents: 0,
    memo: "Trust receipt",
    postedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    id: "entry-002",
    transactionId: "tx-pending",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    clientId: "contact-ada",
    accountId: "acct-client-liability",
    debitCents: 0,
    creditCents: 5000,
    memo: "Client liability",
    postedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    id: "entry-003",
    transactionId: "tx-rejected",
    firmId: "firm-west-legal",
    matterId: "matter-002",
    clientId: "contact-northstar",
    accountId: "acct-client-liability",
    debitCents: 1000,
    creditCents: 0,
    memo: "Rejected transfer",
    postedAt: "2026-05-01T13:00:00.000Z",
  },
];

const approvals: LedgerTransactionApprovalRecord[] = [
  {
    id: "approval-001",
    firmId: "firm-west-legal",
    transactionId: "tx-rejected",
    decidedByUserId: "user-admin",
    decision: "rejected",
    decidedAt: "2026-05-01T14:00:00.000Z",
  },
];

const reconciliations: LedgerReconciliationRecord[] = [
  {
    id: "reconciliation-001",
    firmId: "firm-west-legal",
    accountId: "acct-trust-bank",
    statementPeriodStart: "2026-05-01T00:00:00.000Z",
    statementPeriodEnd: "2026-05-31T23:59:59.000Z",
    beginningBalanceCents: 0,
    endingBalanceCents: 4000,
    expectedBalanceCents: 5000,
    actualBalanceCents: 4000,
    status: "exception",
    statementRows: [
      {
        id: "statement-row-001",
        postedAt: "2026-05-01T12:00:00.000Z",
        description: "Synthetic trust deposit",
        amountCents: 4000,
        matchedLedgerEntryIds: [],
        reviewDecision: "unmatched",
      },
    ],
    varianceExplanation: "Synthetic statement row is not matched to a ledger entry.",
    evidence: {},
    createdAt: "2026-05-01T15:00:00.000Z",
  },
];

describe("ledger controls diagnostics", () => {
  it("keeps core trust ledger posting balanced, idempotent, and reversible", () => {
    expect(() =>
      postLedgerTransaction(
        { postedTransactions: [], accounts: sampleLedgerAccounts },
        {
          id: "bad",
          firmId: sampleFirm.id,
          idempotencyKey: "bad",
          postedByUserId: "user-admin",
          postedAt: "2026-04-05T12:00:00.000Z",
          entries: [
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 100,
              creditCents: 0,
              memo: "Bad transaction",
            },
          ],
        },
      ),
    ).toThrow(/balanced/);

    const first = postLedgerTransaction(
      { postedTransactions: [], accounts: sampleLedgerAccounts },
      {
        id: "trust-retainer",
        firmId: sampleFirm.id,
        idempotencyKey: "bank-event-001",
        postedByUserId: "user-admin",
        postedAt: "2026-04-05T12:00:00.000Z",
        entries: [
          {
            firmId: sampleFirm.id,
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 100,
            creditCents: 0,
            memo: "Retainer",
          },
          {
            firmId: sampleFirm.id,
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 0,
            creditCents: 100,
            memo: "Retainer",
          },
        ],
      },
    );

    expect(() =>
      postLedgerTransaction(
        { postedTransactions: [first], accounts: sampleLedgerAccounts },
        {
          id: "trust-retainer-replay",
          firmId: sampleFirm.id,
          idempotencyKey: "bank-event-001",
          postedByUserId: "user-admin",
          postedAt: "2026-04-05T12:05:00.000Z",
          entries: [
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 200,
              creditCents: 0,
              memo: "Changed retainer",
            },
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-client-liability",
              debitCents: 0,
              creditCents: 200,
              memo: "Changed retainer",
            },
          ],
        },
      ),
    ).toThrow(/different ledger payload/);

    const original: PostedLedgerTransaction = {
      id: "trust-retainer",
      firmId: sampleFirm.id,
      idempotencyKey: "bank-event-002",
      requestFingerprint: "seed",
      entries: sampleLedgerEntries,
    };
    const posted = postLedgerTransaction(
      { postedTransactions: [original], accounts: sampleLedgerAccounts },
      createReversalTransaction(original, {
        id: "trust-retainer-reversal",
        idempotencyKey: "bank-event-002-reversal",
        postedByUserId: "user-admin",
        postedAt: "2026-04-05T12:00:00.000Z",
      }),
    );

    expect(posted.reversesTransactionId).toBe(original.id);
    expect(
      clientTrustBalanceByMatter(posted.entries, sampleLedgerAccounts)["contact-ada:matter-001"],
    ).toBe(-150000);
  });

  it("computes persistent matter trust balances and rejects overdrafts", () => {
    expect(ledgerBalanceByMatter(sampleLedgerEntries)["contact-ada:matter-001"]).toBe(0);
    expect(
      clientTrustBalanceByMatter(sampleLedgerEntries, sampleLedgerAccounts)[
        "contact-ada:matter-001"
      ],
    ).toBe(150000);
    expect(clientTrustBalanceDeltas(sampleLedgerEntries, sampleLedgerAccounts)).toEqual([
      {
        firmId: sampleFirm.id,
        matterId: "matter-001",
        clientId: "contact-ada",
        deltaCents: 150000,
      },
    ]);

    expect(() =>
      postLedgerTransaction(
        {
          postedTransactions: [
            {
              id: "trust-retainer",
              firmId: sampleFirm.id,
              idempotencyKey: "retainer",
              requestFingerprint: "seed",
              entries: sampleLedgerEntries,
            },
          ],
          accounts: sampleLedgerAccounts,
        },
        {
          id: "overdraft",
          firmId: sampleFirm.id,
          idempotencyKey: "overdraft",
          postedByUserId: "user-admin",
          postedAt: "2026-04-05T12:00:00.000Z",
          entries: [
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-client-liability",
              debitCents: 200000,
              creditCents: 0,
              memo: "Overdraw client liability",
            },
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 0,
              creditCents: 200000,
              memo: "Overdraw trust asset",
            },
          ],
        },
      ),
    ).toThrow(/overdraw/);
  });

  it("validates pending posting requests before they become effective", () => {
    const transaction: LedgerTransaction = {
      id: "prepared-trust-transfer",
      firmId: sampleFirm.id,
      idempotencyKey: "prepared-trust-transfer",
      postedByUserId: "user-preparer",
      postedAt: "2026-04-05T12:00:00.000Z",
      entries: [
        {
          firmId: sampleFirm.id,
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 2500,
          creditCents: 0,
          memo: "Prepared fee transfer",
        },
        {
          firmId: sampleFirm.id,
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 0,
          creditCents: 2500,
          memo: "Prepared fee transfer",
        },
      ],
    };
    const pending = ledgerPostingRequestFromTransaction({
      id: "posting-request-001",
      preparedByUserId: "user-preparer",
      preparedAt: "2026-04-05T12:01:00.000Z",
      preparationNotes: "Synthetic prepared posting note",
      transaction,
    });

    expect(pending).toMatchObject({
      status: "pending_approval",
      transactionId: transaction.id,
      matterIds: ["matter-001"],
      clientIds: ["contact-ada"],
      accountIds: ["acct-client-liability", "acct-trust-bank"],
      preparationNotes: "Synthetic prepared posting note",
    });
    expect(() =>
      validateLedgerPostingRequestRecord({
        ...pending,
        requestFingerprint: "changed",
      }),
    ).toThrow(/fingerprint/);
    expect(() =>
      validateLedgerPostingRequestRecord({
        ...pending,
        status: "posted",
        reviewedByUserId: "user-preparer",
        reviewedAt: "2026-04-05T12:03:00.000Z",
        ledgerTransactionId: transaction.id,
      }),
    ).toThrow(/different user/);

    const postedRequest = {
      ...pending,
      status: "posted" as const,
      reviewedByUserId: "user-checker",
      reviewedAt: "2026-04-05T12:03:00.000Z",
      reviewNotes: "Synthetic checker note",
      ledgerTransactionId: transaction.id,
    };
    expect(() => validateLedgerPostingRequestRecord(postedRequest)).not.toThrow();
    expect(
      ledgerTransactionFromPostingRequest(postedRequest, { postedByUserId: "user-checker" }),
    ).toMatchObject({
      id: transaction.id,
      postedByUserId: "user-checker",
      requestFingerprint: pending.requestFingerprint,
    });
    expect(
      ledgerPostingRequestReviewSummary([
        pending,
        postedRequest,
        {
          ...pending,
          id: "posting-request-rejected",
          status: "rejected",
          idempotencyKey: "prepared-rejected",
          reviewedByUserId: "user-checker",
          reviewedAt: "2026-04-05T12:04:00.000Z",
          rejectionReason: "Synthetic rejection reason",
        },
      ]),
    ).toEqual({
      pendingApprovalCount: 1,
      postedCount: 1,
      rejectedCount: 1,
      totalCount: 3,
    });

    const original: PostedLedgerTransaction = {
      id: "trust-retainer",
      firmId: sampleFirm.id,
      idempotencyKey: "retainer",
      requestFingerprint: "seed",
      entries: sampleLedgerEntries,
    };
    const reversalRequest = ledgerPostingRequestFromTransaction({
      id: "posting-request-reversal",
      preparedByUserId: "user-preparer",
      preparedAt: "2026-04-05T12:02:00.000Z",
      transaction: createReversalTransaction(original, {
        id: "trust-retainer-reversal",
        idempotencyKey: "retainer-reversal",
        postedByUserId: "user-preparer",
        postedAt: "2026-04-05T12:02:00.000Z",
      }),
    });
    const approvedReversal = postLedgerTransaction(
      { postedTransactions: [original], accounts: sampleLedgerAccounts },
      ledgerTransactionFromPostingRequest(reversalRequest, { postedByUserId: "user-checker" }),
    );
    expect(approvedReversal.reversesTransactionId).toBe(original.id);
  });

  it("summarizes approval, reconciliation, and overdrawn-balance signals", () => {
    const diagnostics = ledgerControlsDiagnostics({
      ledger: {
        accounts,
        entries,
        trustBalances: {
          "contact-ada:matter-001": 5000,
          "contact-northstar:matter-002": -1000,
        },
      },
      approvals,
      reconciliations,
    });

    expect(diagnostics).toEqual({
      pendingApprovalTransactionIds: ["tx-pending"],
      rejectedApprovalTransactionIds: ["tx-rejected"],
      unreconciledAccountIds: ["acct-trust-bank"],
      exceptionReconciliationIds: ["reconciliation-001"],
      overdrawnBalanceKeys: ["contact-northstar:matter-002"],
    });
  });

  it("can suppress reconciliation-derived diagnostics for matter-scoped controls", () => {
    const diagnostics = ledgerControlsDiagnostics({
      ledger: {
        accounts,
        entries,
        trustBalances: {},
      },
      approvals,
      reconciliations,
      includeReconciliationDiagnostics: false,
    });

    expect(diagnostics.unreconciledAccountIds).toEqual([]);
    expect(diagnostics.exceptionReconciliationIds).toEqual([]);
    expect(diagnostics.pendingApprovalTransactionIds).toEqual(["tx-pending"]);
    expect(diagnostics.rejectedApprovalTransactionIds).toEqual(["tx-rejected"]);
  });

  it("projects reconciliation freshness rows without mutating ledger state", () => {
    const freshness = ledgerReconciliationFreshnessReview({
      accounts: [
        ...accounts,
        {
          id: "acct-never-reconciled",
          firmId: "firm-west-legal",
          name: "Synthetic never reconciled trust",
          type: "trust_asset",
        },
      ],
      reconciliations,
      generatedAt: "2026-08-15T00:00:00.000Z",
    });

    expect(freshness.reviewOnly).toBe(true);
    expect(freshness.summary).toMatchObject({
      accountCount: 2,
      freshCount: 0,
      watchCount: 0,
      staleCount: 1,
      neverReconciledCount: 1,
      exceptionCount: 1,
      unmatchedStatementRowCount: 1,
      reviewOnly: true,
    });
    expect(freshness.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: "acct-trust-bank",
          posture: "stale",
          latestReviewedStatementPeriodEnd: "2026-05-31T23:59:59.000Z",
          exceptionCount: 1,
          unmatchedStatementRowCount: 1,
        }),
        expect.objectContaining({
          accountId: "acct-never-reconciled",
          posture: "never_reconciled",
          staleDayCount: 0,
        }),
      ]),
    );
  });

  it("compares trust balance snapshots without posting or storing preview rows", () => {
    const comparison = buildLedgerBalanceSnapshotComparison({
      ledger: {
        accounts,
        entries,
        trustBalances: {
          "contact-ada:matter-001": 5000,
          "contact-northstar:matter-002": -1000,
        },
      },
      importBatches: [
        {
          id: "import-batch-001",
          firmId: "firm-west-legal",
          accountId: "acct-trust-bank",
          sourceLabel: "Synthetic trust statement",
          checksumSha256: "a".repeat(64),
          importedStatementRowCount: 3,
          duplicateStatementRowCount: 1,
          status: "previewed",
          createdByUserId: "user-admin",
          createdAt: "2026-05-01T12:30:00.000Z",
        },
      ],
      reconciliations,
      generatedAt: "2026-06-17T12:00:00.000Z",
    });

    expect(comparison).toMatchObject({
      generatedAt: "2026-06-17T12:00:00.000Z",
      reviewOnly: true,
      currentTrustBalance: {
        totalCents: 4000,
        balanceCount: 2,
        overdrawnBalanceCount: 1,
      },
      latestPostedTransaction: {
        transactionId: "tx-rejected",
        postedAt: "2026-05-01T13:00:00.000Z",
        entryCount: 1,
        matterCount: 1,
        clientCount: 1,
        accountCount: 1,
        trustAssetDeltaCents: 0,
        clientLiabilityDeltaCents: -1000,
        reversal: false,
      },
      latestReconciliationPreview: {
        importBatchId: "import-batch-001",
        accountId: "acct-trust-bank",
        accountName: "Pooled trust",
        status: "previewed",
        importedStatementRowCount: 3,
        duplicateStatementRowCount: 1,
        matchingProfilePresent: false,
        sourceLabelPresent: true,
        storagePosture: "metadata_only_no_statement_rows",
      },
      latestReconciliationSnapshot: {
        reconciliationId: "reconciliation-001",
        accountId: "acct-trust-bank",
        accountName: "Pooled trust",
        status: "exception",
        statementPeriodEnd: "2026-05-31T23:59:59.000Z",
        expectedBalanceCents: 5000,
        actualBalanceCents: 4000,
        varianceCents: -1000,
        unmatchedStatementRowCount: 1,
      },
      policy: {
        automaticMatching: false,
        automaticLedgerPosting: false,
        automaticReconciliation: false,
        settlementAutomation: false,
        liveBankFeedConnection: false,
        jurisdictionCertifiedAccounting: false,
      },
    });
    expect(comparison.reviewReasons).toEqual([
      "overdrawn_trust_balance",
      "posting_newer_than_preview",
      "reconciliation_variance",
      "unmatched_statement_rows",
    ]);
  });

  it("keeps empty balance snapshot comparison states explicit", () => {
    const comparison = buildLedgerBalanceSnapshotComparison({
      ledger: {
        accounts,
        entries: [],
        trustBalances: {},
      },
      importBatches: [],
      reconciliations: [],
      generatedAt: "2026-06-17T12:00:00.000Z",
    });

    expect(comparison.latestPostedTransaction).toBeUndefined();
    expect(comparison.latestReconciliationPreview).toBeUndefined();
    expect(comparison.latestReconciliationSnapshot).toBeUndefined();
    expect(comparison.reviewReasons).toEqual([
      "no_trust_balances",
      "no_posted_transaction",
      "no_reconciliation_preview_metadata",
      "no_reconciliation_snapshot",
    ]);
  });

  it("summarizes reconciliation packet evidence without carrying raw evidence forward", () => {
    const postingRequests: LedgerPostingRequestRecord[] = [
      {
        id: "posting-request-pending",
        firmId: "firm-west-legal",
        transactionId: "prepared-pending",
        idempotencyKey: "prepared-pending",
        requestFingerprint: "synthetic:fingerprint:pending",
        status: "pending_approval",
        proposedPostedAt: "2026-05-02T12:00:00.000Z",
        entries: [
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 100,
            creditCents: 0,
            memo: "Synthetic prepared debit",
          },
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 100,
            memo: "Synthetic prepared credit",
          },
        ],
        matterIds: ["matter-001"],
        clientIds: ["contact-ada"],
        accountIds: ["acct-client-liability", "acct-trust-bank"],
        preparedByUserId: "user-preparer",
        preparedAt: "2026-05-02T12:00:00.000Z",
      },
      {
        id: "posting-request-rejected",
        firmId: "firm-west-legal",
        transactionId: "prepared-rejected",
        idempotencyKey: "prepared-rejected",
        requestFingerprint: "synthetic:fingerprint:rejected",
        status: "rejected",
        proposedPostedAt: "2026-05-02T13:00:00.000Z",
        entries: [
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 200,
            creditCents: 0,
            memo: "Synthetic rejected debit",
          },
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 200,
            memo: "Synthetic rejected credit",
          },
        ],
        matterIds: ["matter-001"],
        clientIds: ["contact-ada"],
        accountIds: ["acct-client-liability", "acct-trust-bank"],
        preparedByUserId: "user-preparer",
        preparedAt: "2026-05-02T13:00:00.000Z",
        reviewedByUserId: "user-checker",
        reviewedAt: "2026-05-02T13:30:00.000Z",
        rejectionReason: "Synthetic rejection reason",
      },
    ];
    const exceptionResolutions: LedgerReconciliationExceptionResolutionRecord[] = [
      {
        id: "resolution-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementRow: {
          id: "statement-row-resolution",
          postedAt: "2026-05-01T12:00:00.000Z",
          description: "Synthetic unmatched row",
          amountCents: -1000,
          duplicateKey: "synthetic-duplicate-key",
          reviewDecision: "unmatched",
        },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic resolution note must not appear in the packet.",
        recordedByUserId: "user-admin",
        recordedAt: "2026-05-02T15:00:00.000Z",
      },
    ];
    const trustTransferRequests: TrustTransferRequestRecord[] = [
      {
        id: "trust-transfer-pending",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        clientContactId: "contact-ada",
        invoiceId: "invoice-001",
        requestedByUserId: "user-admin",
        amountCents: 2500,
        status: "pending_approval",
        reason: "Synthetic transfer reason must not appear in the packet.",
        requestedAt: "2026-05-02T16:00:00.000Z",
        evidence: { privateNote: "Synthetic private trust evidence" },
      },
      {
        id: "trust-transfer-approved-unlinked",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-002",
        requestedByUserId: "user-admin",
        amountCents: 3500,
        status: "approved",
        requestedAt: "2026-05-02T17:00:00.000Z",
        reviewedByUserId: "user-checker",
        reviewedAt: "2026-05-02T17:30:00.000Z",
      },
    ];
    const paymentImportReviewRecords: PaymentImportReviewRecord[] = [
      {
        id: "payment-import-review",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        providerLabel: "Synthetic provider",
        eventFamily: "payment",
        eventStatus: "succeeded",
        externalEventId: "evt-synthetic",
        externalPaymentId: "pay-synthetic",
        amountCents: 4000,
        currency: "CAD",
        importedAt: "2026-05-02T18:00:00.000Z",
        importedByUserId: "user-admin",
        candidateInvoiceId: "invoice-001",
        conflictReason: "candidate_mismatch",
        reviewState: "needs_review",
        normalizedEvidenceFingerprint: "fingerprint-synthetic",
        boundaries: defaultPaymentImportReviewBoundary(),
        updatedAt: "2026-05-02T18:30:00.000Z",
      },
      {
        id: "deposit-import-review",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        providerLabel: "Synthetic provider",
        eventFamily: "deposit",
        eventStatus: "posted",
        externalEventId: "evt-deposit-synthetic",
        externalDepositId: "dep-synthetic",
        amountCents: 2000,
        currency: "CAD",
        importedAt: "2026-05-02T19:00:00.000Z",
        importedByUserId: "user-admin",
        candidateManualPaymentId: "payment-001",
        duplicateOfRecordId: "payment-import-review",
        reviewState: "needs_review",
        normalizedEvidenceFingerprint: "fingerprint-deposit-synthetic",
        boundaries: defaultPaymentImportReviewBoundary(),
        updatedAt: "2026-05-02T19:30:00.000Z",
      },
    ];

    const review = ledgerReconciliationPacketReview({
      ledger: {
        accounts,
        entries,
        trustBalances: {
          "contact-ada:matter-001": 5000,
          "contact-northstar:matter-002": -1000,
        },
      },
      approvals,
      postingRequests,
      reconciliations,
      importBatches: [
        {
          id: "statement-import-batch-review",
          firmId: "firm-west-legal",
          accountId: "acct-trust-bank",
          sourceLabel: "Synthetic May trust statement",
          checksumSha256: "a".repeat(64),
          importedStatementRowCount: 12,
          duplicateStatementRowCount: 2,
          status: "review_ready",
          matchingProfileId: "statement-match-profile-standard-trust",
          createdByUserId: "user-admin",
          createdAt: "2026-05-31T18:15:00.000Z",
        },
      ],
      exceptionResolutions,
      trustTransferRequests,
      paymentImportReviewRecords,
      diagnostics: ledgerControlsDiagnostics({
        ledger: {
          accounts,
          entries,
          trustBalances: {
            "contact-ada:matter-001": 5000,
            "contact-northstar:matter-002": -1000,
          },
        },
        approvals,
        reconciliations,
      }),
      generatedAt: "2026-06-23T12:00:00.000Z",
    });

    expect(review).toMatchObject({
      generatedAt: "2026-06-23T12:00:00.000Z",
      reviewOnly: true,
      summary: {
        packetCount: 6,
        evidenceCount: 12,
        reviewCueCount: 13,
        packetsNeedingReviewCount: 6,
        latestEvidenceAt: "2026-05-31T18:15:00.000Z",
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
    });
    expect(review.packets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ledger",
          evidenceCount: 3,
          reviewCueCount: 3,
          amountCents: 4000,
          posture: "needs_review",
        }),
        expect.objectContaining({
          kind: "statement_import",
          evidenceCount: 1,
          reviewCueCount: 3,
          conflictCount: 2,
        }),
        expect.objectContaining({
          kind: "exception",
          evidenceCount: 2,
          reviewCueCount: 2,
          exceptionCount: 1,
          amountCents: 1000,
        }),
        expect.objectContaining({
          kind: "trust_transfer",
          evidenceCount: 2,
          reviewCueCount: 2,
          amountCents: 6000,
        }),
        expect.objectContaining({
          kind: "posting_request",
          evidenceCount: 2,
          reviewCueCount: 1,
          exceptionCount: 1,
          amountCents: 300,
        }),
        expect.objectContaining({
          kind: "payment_import",
          evidenceCount: 2,
          reviewCueCount: 2,
          pendingCount: 2,
          conflictCount: 2,
          amountCents: 6000,
        }),
      ]),
    );
    const serialized = JSON.stringify(review);
    expect(serialized).not.toContain("Synthetic private trust evidence");
    expect(serialized).not.toContain("Synthetic transfer reason");
    expect(serialized).not.toContain("Synthetic resolution note");
    expect(serialized).not.toContain("fingerprint-synthetic");
  });

  it("builds cautious jurisdictional trust report summaries from existing controls", () => {
    const report = buildJurisdictionalTrustReport({
      matters: [
        { id: "matter-001", jurisdiction: "BC", practiceArea: "Residential tenancy" },
        { id: "matter-002", jurisdiction: "ON", practiceArea: "Notarial services" },
      ],
      ledger: {
        accounts,
        entries,
        trustBalances: {
          "contact-ada:matter-001": 5000,
          "contact-northstar:matter-002": -1000,
        },
      },
      approvals,
      reconciliations,
      diagnostics: ledgerControlsDiagnostics({
        ledger: {
          accounts,
          entries,
          trustBalances: {
            "contact-ada:matter-001": 5000,
            "contact-northstar:matter-002": -1000,
          },
        },
        approvals,
        reconciliations,
      }),
    });

    expect(report.compliancePosture).toBe("operational_controls_only_not_jurisdiction_certified");
    expect(report).toMatchObject({
      groupBy: "jurisdiction",
      filters: {},
      dimensionOptions: {
        jurisdictions: ["BC", "ON"],
        practiceAreas: ["Notarial services", "Residential tenancy"],
      },
    });
    expect(report.summaries).toEqual([
      expect.objectContaining({
        jurisdiction: "BC",
        dimensionKey: "BC",
        practiceArea: "Residential tenancy",
        clinicProgramId: "none",
        restrictedFundReviewStatus: "not_reviewed",
        matterCount: 1,
        trustBalanceCents: 5000,
        pendingApprovalCount: 1,
        rejectedApprovalCount: 0,
        exceptionReconciliationCount: 1,
        importedStatementRowCount: 1,
        matchedStatementRowCount: 0,
        unmatchedStatementRowCount: 1,
        totalVarianceCents: -1000,
        unreconciledAccountCount: 1,
        overdrawnBalanceCount: 0,
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      }),
      expect.objectContaining({
        jurisdiction: "ON",
        dimensionKey: "ON",
        practiceArea: "Notarial services",
        clinicProgramId: "none",
        restrictedFundReviewStatus: "not_reviewed",
        matterCount: 1,
        trustBalanceCents: -1000,
        pendingApprovalCount: 0,
        rejectedApprovalCount: 1,
        exceptionReconciliationCount: 0,
        importedStatementRowCount: 0,
        matchedStatementRowCount: 0,
        unmatchedStatementRowCount: 0,
        totalVarianceCents: 0,
        unreconciledAccountCount: 0,
        overdrawnBalanceCount: 1,
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      }),
    ]);
  });

  it("keeps jurisdiction filters explicit even when no matter has matching trust activity", () => {
    const report = buildJurisdictionalTrustReport({
      matters: [{ id: "matter-001", jurisdiction: "BC" }],
      ledger: {
        accounts,
        entries,
        trustBalances: { "contact-ada:matter-001": 5000 },
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
      jurisdiction: "OTHER",
    });

    expect(report.summaries).toEqual([
      expect.objectContaining({
        jurisdiction: "OTHER",
        dimensionKey: "OTHER",
        practiceArea: "Unspecified",
        clinicProgramId: "none",
        restrictedFundReviewStatus: "not_reviewed",
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
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      }),
    ]);
  });

  it("groups jurisdictional trust reports by derived clinic and restricted-fund dimensions", () => {
    const report = buildJurisdictionalTrustReport({
      matters: [
        { id: "matter-001", jurisdiction: "BC", practiceArea: "Housing" },
        { id: "matter-002", jurisdiction: "BC", practiceArea: "Housing" },
      ],
      legalClinicMatterProfiles: [
        {
          matterId: "matter-001",
          programId: "clinic-program-housing",
          metadata: { restrictedFund: { reviewStatus: "reviewed" } },
        },
        {
          matterId: "matter-002",
          programId: "clinic-program-housing",
          metadata: { restrictedFund: { reviewStatus: "reviewed" } },
        },
      ],
      ledger: {
        accounts,
        entries,
        trustBalances: {
          "contact-ada:matter-001": 5000,
          "contact-northstar:matter-002": -1000,
        },
      },
      approvals,
      reconciliations,
      diagnostics: ledgerControlsDiagnostics({
        ledger: {
          accounts,
          entries,
          trustBalances: {},
        },
        approvals,
        reconciliations,
      }),
      filters: { restrictedFundReviewStatus: "reviewed" },
      groupBy: "clinicProgramId",
    });

    expect(report).toMatchObject({
      groupBy: "clinicProgramId",
      filters: { restrictedFundReviewStatus: "reviewed" },
      summaries: [
        expect.objectContaining({
          dimensionKey: "clinic-program-housing",
          clinicProgramId: "clinic-program-housing",
          restrictedFundReviewStatus: "reviewed",
          practiceArea: "Housing",
          matterCount: 2,
        }),
      ],
    });
  });

  it("validates statement-row review decisions and variance explanations", () => {
    expect(ledgerReconciliationReviewSummary(reconciliations[0])).toEqual({
      importedStatementRowCount: 1,
      matchedStatementRowCount: 0,
      unmatchedStatementRowCount: 1,
      varianceCents: -1000,
    });
    expect(() => validateLedgerReconciliationRecord(reconciliations[0])).not.toThrow();
    expect(() =>
      validateLedgerReconciliationRecord({
        ...reconciliations[0],
        varianceExplanation: undefined,
      }),
    ).toThrow(/Variance explanation/);
    expect(() =>
      validateLedgerReconciliationRecord({
        ...reconciliations[0],
        status: "matched",
      }),
    ).toThrow(/Matched reconciliations/);
  });

  it("previews statement imports with row dedupe and proposed existing-ledger matches only", () => {
    const preview = previewLedgerStatementImport({
      accountId: "acct-trust-bank",
      ledgerEntries: entries,
      statementRows: [
        {
          id: "statement-import-001",
          postedAt: "2026-05-01T18:30:00.000Z",
          description: "Trust receipt",
          amountCents: 5000,
          reference: "tx-pending",
        },
        {
          id: "statement-import-duplicate",
          postedAt: "2026-05-01T09:00:00.000Z",
          description: "  trust   receipt ",
          amountCents: 5000,
          reference: "TX-PENDING",
        },
        {
          id: "statement-import-unmatched",
          postedAt: "2026-05-02T12:00:00.000Z",
          description: "Synthetic bank fee pending review",
          amountCents: -125,
        },
      ],
    });

    expect(preview).toMatchObject({
      accountId: "acct-trust-bank",
      importedStatementRowCount: 3,
      uniqueStatementRowCount: 2,
      duplicateStatementRowCount: 1,
      proposedMatchedStatementRowCount: 1,
      postingPolicy: "review_only_no_automatic_ledger_posting",
    });
    expect(preview.rows[0]).toMatchObject({
      id: "statement-import-001",
      reviewDecision: "matched",
      proposedMatches: [
        {
          ledgerEntryId: "entry-001",
          transactionId: "tx-pending",
          amountCents: 5000,
          confidence: "exact",
          reasons: ["amount", "date", "description", "reference"],
        },
      ],
    });
    expect(preview.rows[1]).toMatchObject({
      id: "statement-import-duplicate",
      duplicateOfRowId: "statement-import-001",
      reviewDecision: "unmatched",
      proposedMatches: [],
    });
    expect(preview.rows[2]).toMatchObject({
      id: "statement-import-unmatched",
      reviewDecision: "unmatched",
      proposedMatches: [],
    });
  });

  it("builds and validates review-only reconciliation exception resolution rows", () => {
    const statementRow = buildLedgerReconciliationExceptionResolutionStatementRow({
      id: "statement-import-unmatched",
      postedAt: "2026-05-02T12:00:00.000Z",
      description: "Synthetic bank fee pending review",
      amountCents: -125,
      reviewDecision: "unmatched",
    });

    expect(statementRow).toEqual({
      id: "statement-import-unmatched",
      postedAt: "2026-05-02T12:00:00.000Z",
      description: "Synthetic bank fee pending review",
      amountCents: -125,
      duplicateKey: "2026-05-02|-125|synthetic bank fee pending review|",
      reviewDecision: "unmatched",
    });
    expect(() =>
      validateLedgerReconciliationExceptionResolutionRecord({
        id: "resolution-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementRow,
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note for later ledger review.",
        recordedByUserId: "user-admin",
        recordedAt: "2026-05-02T13:00:00.000Z",
      }),
    ).not.toThrow();
    expect(() =>
      buildLedgerReconciliationExceptionResolutionStatementRow({
        ...statementRow,
        reviewDecision: "matched",
      }),
    ).toThrow(/unmatched rows/);
    expect(() =>
      validateLedgerReconciliationExceptionResolutionRecord({
        id: "resolution-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementRow: { ...statementRow, duplicateKey: "trusted-client-value" },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note for later ledger review.",
        recordedByUserId: "user-admin",
        recordedAt: "2026-05-02T13:00:00.000Z",
      }),
    ).toThrow(/duplicate key/);
  });

  it("validates persistent statement import batch metadata without statement rows", () => {
    expect(() =>
      validateLedgerStatementImportBatchRecord({
        id: "statement-import-batch-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 12,
        duplicateStatementRowCount: 2,
        status: "previewed",
        matchingProfileId: "profile-standard-trust",
        createdByUserId: "user-admin",
        createdAt: "2026-05-22T12:00:00.000Z",
      }),
    ).not.toThrow();
    expect(() =>
      validateLedgerStatementImportBatchRecord({
        id: "statement-import-batch-blank-source",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "   ",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 0,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: "2026-05-22T12:00:00.000Z",
      }),
    ).toThrow(/source label/);
    expect(() =>
      validateLedgerStatementImportBatchRecord({
        id: "statement-import-batch-invalid-checksum",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "A".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 0,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: "2026-05-22T12:00:00.000Z",
      }),
    ).toThrow(/checksum/);
    expect(() =>
      validateLedgerStatementImportBatchRecord({
        id: "statement-import-batch-invalid-count",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 2,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: "2026-05-22T12:00:00.000Z",
      }),
    ).toThrow(/duplicate count/);
  });

  it("summarizes and validates review-only statement match-rule profiles", () => {
    const profile: LedgerStatementMatchRuleProfileRecord = {
      id: "statement-match-profile-001",
      firmId: "firm-west-legal",
      accountId: "acct-trust-bank",
      name: "Standard trust statement review",
      referenceStrategy: "normalized_reference",
      descriptionStrategy: "normalized_contains",
      dateWindowDays: 2,
      amountToleranceCents: 0,
      varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
      reviewerExplanationRequired: true,
      reviewOnly: true,
      createdByUserId: "user-admin",
      createdAt: "2026-05-22T12:00:00.000Z",
      updatedAt: "2026-05-22T12:00:00.000Z",
    };

    expect(() => validateLedgerStatementMatchRuleProfileRecord(profile)).not.toThrow();
    expect(() =>
      validateLedgerStatementMatchRuleProfileRecord({
        ...profile,
        varianceCategories: [],
      }),
    ).toThrow(/variance category/);
    expect(() =>
      validateLedgerStatementMatchRuleProfileRecord({
        ...profile,
        reviewOnly: false as true,
      }),
    ).toThrow(/review-only/);
    expect(() =>
      validateLedgerStatementMatchRuleProfileRecord({
        ...profile,
        dateWindowDays: 31,
      }),
    ).toThrow(/date window/);
  });

  it("summarizes and validates review-only accounting review profiles", () => {
    const matchRuleProfile: LedgerStatementMatchRuleProfileRecord = {
      id: "statement-match-profile-001",
      firmId: "firm-west-legal",
      accountId: "acct-trust-bank",
      name: "Standard trust statement review",
      referenceStrategy: "normalized_reference",
      descriptionStrategy: "normalized_contains",
      dateWindowDays: 2,
      amountToleranceCents: 0,
      varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
      reviewerExplanationRequired: true,
      reviewOnly: true,
      createdByUserId: "user-admin",
      createdAt: "2026-05-22T12:00:00.000Z",
      updatedAt: "2026-05-22T12:00:00.000Z",
    };
    const accountingProfile: LedgerAccountingReviewProfileRecord = {
      id: "accounting-review-profile-001",
      firmId: "firm-west-legal",
      accountId: "acct-trust-bank",
      accountType: "trust_asset",
      boundaryPosture: "trust_only",
      protectedFunds: {
        protected: true,
        reason: "Synthetic trust account requires protected-funds review cues.",
        reviewCadence: "monthly",
      },
      bankFeedImport: {
        status: "metadata_only",
        sourceLabel: "Synthetic trust statement export",
        automaticMatching: false,
      },
      dimensions: {
        vendorTracking: "not_applicable",
        expenseCategoryTracking: "optional",
        clientMatterTracking: "required",
      },
      reviewOnly: true,
      createdByUserId: "user-admin",
      createdAt: "2026-05-22T12:00:00.000Z",
      updatedAt: "2026-05-22T12:00:00.000Z",
    };

    expect(() => validateLedgerAccountingReviewProfileRecord(accountingProfile)).not.toThrow();
    expect(
      ledgerAccountingReviewSummary({
        matchRuleProfiles: [matchRuleProfile],
        accountingProfiles: [accountingProfile],
      }),
    ).toEqual({
      matchRuleProfileCount: 1,
      accountingProfileCount: 1,
      protectedAccountCount: 1,
      bankFeedShellCount: 1,
      reviewOnly: true,
    });
    expect(() =>
      validateLedgerAccountingReviewProfileRecord({
        ...accountingProfile,
        protectedFunds: {
          protected: true,
          reviewCadence: "monthly",
        },
      }),
    ).toThrow(/Protected-funds/);
    expect(() =>
      validateLedgerAccountingReviewProfileRecord({
        ...accountingProfile,
        bankFeedImport: {
          status: "metadata_only",
          automaticMatching: false,
        },
      }),
    ).toThrow(/source label/);
    expect(() =>
      validateLedgerAccountingReviewProfileRecord({
        ...accountingProfile,
        bankFeedImport: {
          ...accountingProfile.bankFeedImport,
          automaticMatching: true as false,
        },
      }),
    ).toThrow(/automatic matching/);
    expect(() =>
      validateLedgerAccountingReviewProfileRecord({
        ...accountingProfile,
        boundaryPosture: "operating_only",
      }),
    ).toThrow(/boundary posture/);
  });

  it("summarizes bank-feed reconciliation review posture without enabling automation", () => {
    const trustProfile: LedgerAccountingReviewProfileRecord = {
      id: "accounting-review-profile-trust-bank",
      firmId: "firm-west-legal",
      accountId: "acct-trust-bank",
      accountType: "trust_asset",
      boundaryPosture: "trust_only",
      protectedFunds: {
        protected: true,
        reason: "Synthetic trust account needs reviewer confirmation.",
        reviewCadence: "monthly",
      },
      bankFeedImport: {
        status: "review_ready",
        sourceLabel: "Synthetic trust statement export",
        lastImportedAt: "2026-05-31T18:05:00.000Z",
        automaticMatching: false,
      },
      dimensions: {
        vendorTracking: "not_applicable",
        expenseCategoryTracking: "optional",
        clientMatterTracking: "required",
      },
      reviewOnly: true,
      createdByUserId: "user-admin",
      createdAt: "2026-05-31T18:05:00.000Z",
      updatedAt: "2026-05-31T18:05:00.000Z",
    };
    const operatingProfile: LedgerAccountingReviewProfileRecord = {
      id: "accounting-review-profile-operating",
      firmId: "firm-west-legal",
      accountId: "acct-operating",
      accountType: "operating_revenue",
      boundaryPosture: "operating_only",
      protectedFunds: {
        protected: false,
        reviewCadence: "manual_review",
      },
      bankFeedImport: {
        status: "metadata_only",
        sourceLabel: "Synthetic operating statement export",
        automaticMatching: false,
      },
      dimensions: {
        vendorTracking: "optional",
        expenseCategoryTracking: "required",
        clientMatterTracking: "required",
      },
      reviewOnly: true,
      createdByUserId: "user-admin",
      createdAt: "2026-05-31T18:10:00.000Z",
      updatedAt: "2026-05-31T18:10:00.000Z",
    };
    const importBatches: LedgerStatementImportBatchRecord[] = [
      {
        id: "statement-import-batch-review",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 12,
        duplicateStatementRowCount: 2,
        status: "review_ready",
        matchingProfileId: "statement-match-profile-standard-trust",
        createdByUserId: "user-admin",
        createdAt: "2026-05-31T18:15:00.000Z",
      },
      {
        id: "statement-import-batch-previewed",
        firmId: "firm-west-legal",
        accountId: "acct-operating",
        sourceLabel: "Synthetic operating statement",
        checksumSha256: "b".repeat(64),
        importedStatementRowCount: 3,
        duplicateStatementRowCount: 0,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: "2026-05-31T18:20:00.000Z",
      },
    ];

    expect(
      ledgerBankFeedReconciliationReviewSummary({
        accountingProfiles: [trustProfile, operatingProfile],
        importBatches,
        reconciliations,
        diagnostics: {
          unreconciledAccountIds: ["acct-trust-bank"],
          exceptionReconciliationIds: ["reconciliation-001"],
        },
      }),
    ).toEqual({
      bankFeedShellCount: 2,
      metadataOnlyFeedCount: 1,
      reviewReadyFeedCount: 1,
      importBatchCount: 2,
      previewedImportBatchCount: 1,
      reviewReadyImportBatchCount: 1,
      discardedImportBatchCount: 0,
      importedStatementRowCount: 15,
      duplicateStatementRowCount: 2,
      completedReconciliationCount: 0,
      exceptionReconciliationCount: 1,
      accountsPendingReconciliationCount: 1,
      protectedFundsFeedCount: 1,
      automaticMatching: false,
      automaticLedgerPosting: false,
      automaticReconciliation: false,
      liveBankFeedConnection: false,
      trustDisbursementAutomation: false,
      importBatchStoragePosture: "metadata_only_no_statement_rows",
      reviewOnly: true,
    });
  });
});
