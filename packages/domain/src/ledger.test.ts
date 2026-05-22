import { describe, expect, it } from "vitest";
import {
  buildLedgerReconciliationExceptionResolutionStatementRow,
  buildJurisdictionalTrustReport,
  ledgerControlsDiagnostics,
  ledgerReconciliationReviewSummary,
  previewLedgerStatementImport,
  validateLedgerReconciliationExceptionResolutionRecord,
  validateLedgerReconciliationRecord,
  validateLedgerStatementImportBatchRecord,
} from "./ledger.js";
import type {
  LedgerAccount,
  LedgerEntry,
  LedgerReconciliationRecord,
  LedgerTransactionApprovalRecord,
} from "./ledger.js";

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

  it("builds cautious jurisdictional trust report summaries from existing controls", () => {
    const report = buildJurisdictionalTrustReport({
      matters: [
        { id: "matter-001", jurisdiction: "BC" },
        { id: "matter-002", jurisdiction: "ON" },
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
    expect(report.summaries).toEqual([
      {
        jurisdiction: "BC",
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
      },
      {
        jurisdiction: "ON",
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
      },
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
      {
        jurisdiction: "OTHER",
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
      },
    ]);
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
});
