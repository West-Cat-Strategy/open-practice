import { describe, expect, it } from "vitest";
import { ledgerControlsDiagnostics } from "./ledger.js";
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
    expectedBalanceCents: 5000,
    actualBalanceCents: 4000,
    status: "exception",
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
});
