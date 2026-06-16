import { describe, expect, it } from "vitest";
import { ledgerPostingRequestFromTransaction } from "@open-practice/domain";
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

  it("prepares, approves, and rejects trust posting requests before posting", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const prepared = ledgerPostingRequestFromTransaction({
      id: "posting-request-001",
      preparedByUserId: "user-admin",
      preparedAt: now,
      preparationNotes: "Synthetic posting request note",
      transaction: {
        id: "prepared-trust-posting",
        firmId: "firm-west-legal",
        idempotencyKey: "prepared-trust-posting",
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
            memo: "Synthetic prepared trust posting",
          },
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 13230,
            memo: "Synthetic prepared trust posting",
          },
        ],
      },
    });

    await expect(repository.prepareLedgerPostingRequest(prepared)).resolves.toMatchObject({
      id: "posting-request-001",
      status: "pending_approval",
      preparationNotes: "Synthetic posting request note",
    });
    const replay = await repository.prepareLedgerPostingRequest({ ...prepared, id: "replay-id" });
    expect(replay.id).toBe("posting-request-001");
    const conflictingPrepared = ledgerPostingRequestFromTransaction({
      id: "posting-request-conflict",
      preparedByUserId: "user-admin",
      preparedAt: now,
      transaction: {
        id: "prepared-trust-posting-conflict",
        firmId: "firm-west-legal",
        idempotencyKey: "prepared-trust-posting",
        postedByUserId: "user-admin",
        postedAt: now,
        entries: prepared.entries.map((entry, index) =>
          index === 0 ? { ...entry, memo: "Changed synthetic prepared trust posting" } : entry,
        ),
      },
    });
    await expect(repository.prepareLedgerPostingRequest(conflictingPrepared)).rejects.toThrow(
      /different ledger payload/,
    );
    const cloned = await repository.getLedgerPostingRequest(
      "firm-west-legal",
      "posting-request-001",
    );
    if (!cloned) throw new Error("Expected posting request clone");
    cloned.matterIds.push("matter-mutated");
    await expect(
      repository.getLedgerPostingRequest("firm-west-legal", "posting-request-001"),
    ).resolves.toMatchObject({ matterIds: ["matter-001"] });

    await expect(
      repository.listLedgerPostingRequests("firm-west-legal", {
        matterId: "matter-001",
        status: "pending_approval",
      }),
    ).resolves.toEqual([expect.objectContaining({ id: "posting-request-001" })]);
    await expect(
      repository.getLedger("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.not.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ transactionId: "prepared-trust-posting" }),
      ]),
    });
    await expect(
      repository.approveLedgerPostingRequest("firm-west-legal", "posting-request-001", {
        reviewedByUserId: "user-admin",
        reviewedAt: now,
      }),
    ).rejects.toThrow(/different user/);

    const approved = await repository.approveLedgerPostingRequest(
      "firm-west-legal",
      "posting-request-001",
      {
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-04-02T19:00:00.000Z",
        reviewNotes: "Synthetic checker note",
      },
    );
    expect(approved.request).toMatchObject({
      status: "posted",
      ledgerTransactionId: "prepared-trust-posting",
      reviewedByUserId: "user-licensee",
    });
    expect(approved.postedTransaction.entries).toHaveLength(2);
    const approvedReplay = await repository.approveLedgerPostingRequest(
      "firm-west-legal",
      "posting-request-001",
      {
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-04-02T19:01:00.000Z",
      },
    );
    expect(approvedReplay.postedTransaction.id).toBe("prepared-trust-posting");
    await expect(
      repository.getLedger("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ transactionId: "prepared-trust-posting" }),
      ]),
    });

    const rejected = ledgerPostingRequestFromTransaction({
      id: "posting-request-rejected",
      preparedByUserId: "user-admin",
      preparedAt: now,
      transaction: {
        id: "prepared-rejected-posting",
        firmId: "firm-west-legal",
        idempotencyKey: "prepared-rejected-posting",
        postedByUserId: "user-admin",
        postedAt: now,
        entries: prepared.entries,
      },
    });
    await repository.prepareLedgerPostingRequest(rejected);
    await expect(
      repository.rejectLedgerPostingRequest("firm-west-legal", "posting-request-rejected", {
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-04-02T19:02:00.000Z",
        rejectionReason: "Synthetic rejection reason",
      }),
    ).resolves.toMatchObject({ status: "rejected" });
    await expect(
      repository.getLedger("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.not.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ transactionId: "prepared-rejected-posting" }),
      ]),
    });
  });

  it("leaves stale-balance posting requests pending when approval would overdraw", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const prepared = ledgerPostingRequestFromTransaction({
      id: "posting-request-overdraft",
      preparedByUserId: "user-admin",
      preparedAt: now,
      transaction: {
        id: "prepared-overdraft-posting",
        firmId: "firm-west-legal",
        idempotencyKey: "prepared-overdraft-posting",
        postedByUserId: "user-admin",
        postedAt: now,
        entries: [
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 140000,
            creditCents: 0,
            memo: "Synthetic prepared stale-balance transfer",
          },
          {
            firmId: "firm-west-legal",
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 0,
            creditCents: 140000,
            memo: "Synthetic prepared stale-balance transfer",
          },
        ],
      },
    });

    await repository.prepareLedgerPostingRequest(prepared);
    await repository.postLedgerTransaction({
      id: "intervening-trust-posting",
      firmId: "firm-west-legal",
      idempotencyKey: "intervening-trust-posting",
      postedByUserId: "user-admin",
      postedAt: "2026-04-02T18:30:00.000Z",
      entries: [
        {
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 20000,
          creditCents: 0,
          memo: "Synthetic intervening transfer",
        },
        {
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 0,
          creditCents: 20000,
          memo: "Synthetic intervening transfer",
        },
      ],
    });

    await expect(
      repository.approveLedgerPostingRequest("firm-west-legal", "posting-request-overdraft", {
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-04-02T19:00:00.000Z",
      }),
    ).rejects.toThrow(/overdraw/);
    await expect(
      repository.getLedgerPostingRequest("firm-west-legal", "posting-request-overdraft"),
    ).resolves.toMatchObject({ status: "pending_approval", ledgerTransactionId: undefined });
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

    await expect(
      repository.createLedgerStatementImportBatch({
        id: "statement-import-batch-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 12,
        duplicateStatementRowCount: 2,
        status: "review_ready",
        matchingProfileId: "statement-match-profile-standard-trust",
        createdByUserId: "user-admin",
        createdAt: now,
      }),
    ).resolves.toMatchObject({
      accountId: "acct-trust-bank",
      status: "review_ready",
      matchingProfileId: "statement-match-profile-standard-trust",
    });
    await expect(
      repository.createLedgerStatementImportBatch({
        id: "statement-import-batch-older",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic April trust statement",
        checksumSha256: "b".repeat(64),
        importedStatementRowCount: 5,
        duplicateStatementRowCount: 0,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: "2026-04-24T12:00:00.000Z",
      }),
    ).resolves.toMatchObject({ id: "statement-import-batch-older" });
    await expect(
      repository.listLedgerStatementImportBatches("firm-west-legal", {
        accountId: "acct-trust-bank",
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "statement-import-batch-older" }),
      expect.objectContaining({ id: "statement-import-batch-001" }),
    ]);
    await expect(
      repository.createLedgerStatementImportBatch({
        id: "statement-import-batch-operating-account",
        firmId: "firm-west-legal",
        accountId: "acct-operating-revenue",
        sourceLabel: "Synthetic operating statement",
        checksumSha256: "c".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 0,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: now,
      }),
    ).rejects.toThrow(/trust asset account/);
    await expect(
      repository.createLedgerStatementImportBatch({
        id: "statement-import-batch-missing-profile",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "e".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 0,
        status: "previewed",
        matchingProfileId: "missing-profile",
        createdByUserId: "user-admin",
        createdAt: now,
      }),
    ).rejects.toThrow(/matching profile/);
    await expect(
      repository.createLedgerStatementImportBatch({
        id: "statement-import-batch-invalid-counts",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "d".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 2,
        status: "previewed",
        createdByUserId: "user-admin",
        createdAt: now,
      }),
    ).rejects.toThrow(/duplicate count/);

    await expect(
      repository.createLedgerStatementMatchRuleProfile({
        id: "statement-match-profile-route-test",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        name: "Synthetic statement review profile",
        referenceStrategy: "normalized_reference",
        descriptionStrategy: "normalized_contains",
        dateWindowDays: 2,
        amountToleranceCents: 0,
        varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
        reviewerExplanationRequired: true,
        reviewOnly: true,
        createdByUserId: "user-admin",
        createdAt: now,
        updatedAt: now,
      }),
    ).resolves.toMatchObject({
      accountId: "acct-trust-bank",
      referenceStrategy: "normalized_reference",
      reviewOnly: true,
    });
    await expect(
      repository.listLedgerStatementMatchRuleProfiles("firm-west-legal", {
        accountId: "acct-trust-bank",
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "statement-match-profile-route-test" }),
      ]),
    );
    await expect(
      repository.createLedgerStatementMatchRuleProfile({
        id: "statement-match-profile-operating",
        firmId: "firm-west-legal",
        accountId: "acct-operating-revenue",
        name: "Synthetic operating statement review profile",
        referenceStrategy: "normalized_reference",
        descriptionStrategy: "normalized_contains",
        dateWindowDays: 2,
        amountToleranceCents: 0,
        varianceCategories: ["ledger_entry_expected"],
        reviewerExplanationRequired: true,
        reviewOnly: true,
        createdByUserId: "user-admin",
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow(/trust asset account/);

    await expect(
      repository.createLedgerAccountingReviewProfile({
        id: "accounting-review-profile-client-liability",
        firmId: "firm-west-legal",
        accountId: "acct-client-liability",
        accountType: "client_liability",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: true,
          reason: "Synthetic client liability account requires protected-funds cues.",
          reviewCadence: "monthly",
        },
        bankFeedImport: {
          status: "not_configured",
          automaticMatching: false,
        },
        dimensions: {
          vendorTracking: "not_applicable",
          expenseCategoryTracking: "optional",
          clientMatterTracking: "required",
        },
        reviewOnly: true,
        createdByUserId: "user-admin",
        createdAt: now,
        updatedAt: now,
      }),
    ).resolves.toMatchObject({
      accountId: "acct-client-liability",
      accountType: "client_liability",
      boundaryPosture: "trust_only",
      reviewOnly: true,
    });
    await expect(
      repository.listLedgerAccountingReviewProfiles("firm-west-legal", {
        accountId: "acct-client-liability",
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: "accounting-review-profile-client-liability" }),
    ]);
    await expect(
      repository.createLedgerAccountingReviewProfile({
        id: "accounting-review-profile-invalid-boundary",
        firmId: "firm-west-legal",
        accountId: "acct-operating-revenue",
        accountType: "operating_revenue",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: false,
          reviewCadence: "monthly",
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
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow(/boundary posture/);

    await expect(
      repository.createLedgerReconciliationExceptionResolution({
        id: "resolution-001",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementRow: {
          id: "statement-row-unmatched",
          postedAt: "2026-04-29T17:00:00.000Z",
          description: "Synthetic unresolved service charge",
          amountCents: -125,
          duplicateKey: "2026-04-29|-125|synthetic unresolved service charge|",
          reviewDecision: "unmatched",
        },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note for later ledger review.",
        recordedByUserId: "user-admin",
        recordedAt: now,
      }),
    ).resolves.toMatchObject({
      accountId: "acct-trust-bank",
      varianceDecision: "needs_follow_up",
    });
    await expect(
      repository.createLedgerReconciliationExceptionResolution({
        id: "resolution-older",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementRow: {
          id: "statement-row-older-unmatched",
          postedAt: "2026-04-24T17:00:00.000Z",
          description: "Synthetic older unresolved transfer",
          amountCents: -250,
          duplicateKey: "2026-04-24|-250|synthetic older unresolved transfer|",
          reviewDecision: "unmatched",
        },
        varianceDecision: "ledger_entry_expected",
        resolutionNote: "Synthetic older staff note for chronological ordering.",
        recordedByUserId: "user-admin",
        recordedAt: "2026-04-24T12:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      id: "resolution-older",
      varianceDecision: "ledger_entry_expected",
    });
    await expect(
      repository.listLedgerReconciliationExceptionResolutions("firm-west-legal", {
        accountId: "acct-trust-bank",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "resolution-older",
        statementRow: expect.objectContaining({ reviewDecision: "unmatched" }),
      }),
      expect.objectContaining({
        id: "resolution-001",
        statementRow: expect.objectContaining({ reviewDecision: "unmatched" }),
      }),
    ]);
    await expect(
      repository.createLedgerReconciliationExceptionResolution({
        id: "resolution-operating-account",
        firmId: "firm-west-legal",
        accountId: "acct-operating-revenue",
        statementRow: {
          id: "statement-row-unmatched",
          postedAt: "2026-04-29T17:00:00.000Z",
          description: "Synthetic unresolved service charge",
          amountCents: -125,
          duplicateKey: "2026-04-29|-125|synthetic unresolved service charge|",
          reviewDecision: "unmatched",
        },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note for later ledger review.",
        recordedByUserId: "user-admin",
        recordedAt: now,
      }),
    ).rejects.toThrow(/trust asset account/);
    await expect(
      repository.createLedgerReconciliationExceptionResolution({
        id: "resolution-missing-reviewer",
        firmId: "firm-west-legal",
        accountId: "acct-trust-bank",
        statementRow: {
          id: "statement-row-unmatched",
          postedAt: "2026-04-29T17:00:00.000Z",
          description: "Synthetic unresolved service charge",
          amountCents: -125,
          duplicateKey: "2026-04-29|-125|synthetic unresolved service charge|",
          reviewDecision: "unmatched",
        },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note for later ledger review.",
        recordedByUserId: "missing-user",
        recordedAt: now,
      }),
    ).rejects.toThrow(/Unknown user/);
  });
});
