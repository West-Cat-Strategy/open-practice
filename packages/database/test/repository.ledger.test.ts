import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository ledger approvals and reconciliations", () => {
  it("guards trust approval and reconciliation persistence", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.createLedgerTransactionApproval({
        id: "approval-1",
        firmId: "firm-west-legal",
        transactionId: "trust-retainer",
        decidedByUserId: "user-admin",
        decision: "approved",
        decidedAt: now,
      }),
    ).resolves.toMatchObject({ transactionId: "trust-retainer", decision: "approved" });

    await expect(
      repository.createLedgerTransactionApproval({
        id: "approval-duplicate",
        firmId: "firm-west-legal",
        transactionId: "trust-retainer",
        decidedByUserId: "user-admin",
        decision: "rejected",
        decidedAt: now,
      }),
    ).rejects.toThrow(/already recorded/);
    await expect(
      repository.createLedgerTransactionApproval({
        id: "approval-missing",
        firmId: "firm-west-legal",
        transactionId: "missing-transaction",
        decidedByUserId: "user-admin",
        decision: "approved",
        decidedAt: now,
      }),
    ).rejects.toThrow(/Unknown ledger transaction/);

    await expect(
      repository.createLedgerReconciliation({
        id: "reconciliation-invalid-period",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-30T00:00:00.000Z",
        statementPeriodEnd: "2026-04-01T00:00:00.000Z",
        beginningBalanceCents: 0,
        endingBalanceCents: 150000,
        expectedBalanceCents: 150000,
        actualBalanceCents: 150000,
        status: "matched",
        reviewedByUserId: "user-admin",
        statementRows: [
          {
            id: "statement-row-invalid-period",
            postedAt: "2026-04-02T17:00:00.000Z",
            description: "Synthetic retainer deposit",
            amountCents: 150000,
            matchedLedgerEntryIds: ["trust-retainer-1"],
            reviewDecision: "matched",
          },
        ],
        evidence: {},
        createdAt: now,
      }),
    ).rejects.toThrow(/period end/);
    await expect(
      repository.createLedgerReconciliation({
        id: "reconciliation-missing-account",
        firmId: "firm-west-legal",
        accountId: "missing-account",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T00:00:00.000Z",
        beginningBalanceCents: 0,
        endingBalanceCents: 150000,
        expectedBalanceCents: 150000,
        actualBalanceCents: 150000,
        status: "matched",
        reviewedByUserId: "user-admin",
        statementRows: [
          {
            id: "statement-row-missing-account",
            postedAt: "2026-04-02T17:00:00.000Z",
            description: "Synthetic retainer deposit",
            amountCents: 150000,
            matchedLedgerEntryIds: ["trust-retainer-1"],
            reviewDecision: "matched",
          },
        ],
        evidence: {},
        createdAt: now,
      }),
    ).rejects.toThrow(/Unknown ledger account/);
  });
});
