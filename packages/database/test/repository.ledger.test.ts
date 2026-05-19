import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository ledger approvals and reconciliations", () => {
  it("updates trust transfer review and ledger link fields without schema changes", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.getTrustTransferRequest("firm-west-legal", "trust-transfer-request-001"),
    ).resolves.toMatchObject({
      id: "trust-transfer-request-001",
      status: "pending_approval",
    });

    const approved = await repository.updateTrustTransferRequest(
      "firm-west-legal",
      "trust-transfer-request-001",
      {
        status: "approved",
        reviewedByUserId: "user-admin",
        reviewedAt: now,
        evidence: { synthetic: true },
      },
    );

    expect(approved).toMatchObject({
      status: "approved",
      reviewedByUserId: "user-admin",
      reviewedAt: now,
      evidence: { synthetic: true },
    });
    expect(approved).not.toHaveProperty("ledgerTransactionId");

    await repository.postLedgerTransaction({
      id: "trust-transfer-posting",
      firmId: "firm-west-legal",
      idempotencyKey: "trust-transfer-posting-key",
      postedByUserId: "user-admin",
      postedAt: now,
      entries: [
        {
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 13230,
          creditCents: 0,
          memo: "Synthetic trust transfer request link",
        },
        {
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 0,
          creditCents: 13230,
          memo: "Synthetic trust transfer request link",
        },
      ],
    });

    await expect(
      repository.updateTrustTransferRequest("firm-west-legal", "trust-transfer-request-001", {
        status: "linked",
        reviewedByUserId: "user-admin",
        reviewedAt: now,
        ledgerTransactionId: "trust-transfer-posting",
        evidence: { linked: true },
      }),
    ).resolves.toMatchObject({
      status: "linked",
      ledgerTransactionId: "trust-transfer-posting",
      evidence: { linked: true },
    });
  });

  it("keeps trust transfer get/update firm-scoped and clone-safe", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await expect(
      repository.getTrustTransferRequest("firm-other", "trust-transfer-request-001"),
    ).resolves.toBeUndefined();
    await expect(
      repository.updateTrustTransferRequest("firm-west-legal", "missing-request", {
        status: "approved",
      }),
    ).rejects.toThrow(/not found/);
    await expect(
      repository.updateTrustTransferRequest(
        "firm-west-legal",
        "trust-transfer-request-001",
        { status: "approved" },
        { expectedStatus: "rejected" },
      ),
    ).rejects.toThrow(/conflict/);

    const updated = await repository.updateTrustTransferRequest(
      "firm-west-legal",
      "trust-transfer-request-001",
      { evidence: { review: { synthetic: true } } },
    );
    const evidence = updated.evidence as { review: { synthetic: boolean } };
    evidence.review.synthetic = false;

    await expect(
      repository.getTrustTransferRequest("firm-west-legal", "trust-transfer-request-001"),
    ).resolves.toMatchObject({
      evidence: { review: { synthetic: true } },
    });
  });

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
