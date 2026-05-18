import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { LedgerReconciliationRecord } from "@open-practice/domain";
import { registerLedgerRoutes } from "./ledger.js";

const servers: FastifyInstance[] = [];

interface TestServerOptions {
  repository?: OpenPracticeRepository;
}

async function authenticateTestRequest(
  repository: OpenPracticeRepository,
  headers: Record<string, string | string[] | undefined>,
) {
  const userIdHeader = headers["x-open-practice-user-id"];
  const firmIdHeader = headers["x-open-practice-firm-id"];
  const userId = typeof userIdHeader === "string" ? userIdHeader : "user-admin";
  const firmId = typeof firmIdHeader === "string" ? firmIdHeader : "firm-west-legal";
  const user = await repository.getUser(firmId, userId);
  if (!user) {
    throw Object.assign(new Error("Authenticated user was not found"), { statusCode: 401 });
  }
  return { user, firmId };
}

function testServer({ repository = new InMemoryOpenPracticeRepository() }: TestServerOptions = {}) {
  const server = Fastify({ logger: false });
  server.register(rateLimit, { global: true, max: 1_000, timeWindow: "1 minute" });
  server.addHook("preHandler", async (request) => {
    request.auth = await authenticateTestRequest(repository, request.headers);
  });
  registerLedgerRoutes(server, { repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number };
    const statusCode =
      typeof normalizedError.statusCode === "number" ? normalizedError.statusCode : 400;
    reply.status(statusCode).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });
  servers.push(server);
  return server;
}

function ledgerTransactionPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "ledger-route-transaction",
    idempotencyKey: "ledger-route-transaction-key",
    postedAt: "2026-04-24T12:00:00.000Z",
    entries: [
      {
        matterId: "matter-001",
        clientId: "contact-ada",
        accountId: "acct-trust-bank",
        debitCents: 2500,
        creditCents: 0,
        memo: "Route test trust receipt",
      },
      {
        matterId: "matter-001",
        clientId: "contact-ada",
        accountId: "acct-client-liability",
        debitCents: 0,
        creditCents: 2500,
        memo: "Route test client liability",
      },
    ],
    ...overrides,
  };
}

function reconciliationRecord(
  overrides: Partial<LedgerReconciliationRecord> = {},
): LedgerReconciliationRecord {
  return {
    id: "reconciliation-route-test",
    firmId: "firm-west-legal",
    accountId: "acct-trust-bank",
    statementPeriodStart: "2026-04-01T00:00:00.000Z",
    statementPeriodEnd: "2026-04-30T23:59:59.000Z",
    beginningBalanceCents: 0,
    endingBalanceCents: 150000,
    expectedBalanceCents: 150000,
    actualBalanceCents: 150000,
    statementRows: [
      {
        id: "statement-row-001",
        postedAt: "2026-04-02T17:00:00.000Z",
        description: "Synthetic retainer deposit",
        amountCents: 150000,
        reference: "synthetic-april-001",
        matchedLedgerEntryIds: ["trust-retainer-1"],
        reviewDecision: "matched",
      },
    ],
    status: "matched",
    reviewedByUserId: "user-admin",
    evidence: { statement: "synthetic-april-trust.pdf" },
    createdAt: "2026-04-24T14:00:00.000Z",
    ...overrides,
  };
}

function reconciliationPayload(
  overrides: Partial<
    Omit<LedgerReconciliationRecord, "id" | "firmId" | "createdAt" | "reviewedByUserId">
  > = {},
) {
  const record = reconciliationRecord(overrides);
  return {
    accountId: record.accountId,
    statementPeriodStart: record.statementPeriodStart,
    statementPeriodEnd: record.statementPeriodEnd,
    beginningBalanceCents: record.beginningBalanceCents,
    endingBalanceCents: record.endingBalanceCents,
    expectedBalanceCents: record.expectedBalanceCents,
    actualBalanceCents: record.actualBalanceCents,
    status: overrides.status,
    statementRows: record.statementRows,
    varianceExplanation: record.varianceExplanation,
    evidence: record.evidence,
  };
}

async function seedMatterTwoLedgerControls(repository: OpenPracticeRepository) {
  await repository.postLedgerTransaction({
    id: "matter-002-retainer",
    firmId: "firm-west-legal",
    idempotencyKey: "matter-002-retainer-key",
    postedByUserId: "user-admin",
    postedAt: "2026-04-24T12:00:00.000Z",
    entries: [
      {
        firmId: "firm-west-legal",
        matterId: "matter-002",
        clientId: "contact-northstar",
        accountId: "acct-trust-bank",
        debitCents: 2500,
        creditCents: 0,
        memo: "Matter 002 trust receipt",
      },
      {
        firmId: "firm-west-legal",
        matterId: "matter-002",
        clientId: "contact-northstar",
        accountId: "acct-client-liability",
        debitCents: 0,
        creditCents: 2500,
        memo: "Matter 002 client liability",
      },
    ],
  });
  await repository.createLedgerTransactionApproval({
    id: "approval-matter-002",
    firmId: "firm-west-legal",
    transactionId: "matter-002-retainer",
    decidedByUserId: "user-admin",
    decision: "rejected",
    decidedAt: "2026-04-24T13:00:00.000Z",
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("ledger routes", () => {
  it("returns all firm ledger controls for firm-wide ledger users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedMatterTwoLedgerControls(repository);
    await repository.createLedgerReconciliation({
      ...reconciliationRecord({
        id: "reconciliation-exception",
        expectedBalanceCents: 152500,
        status: "exception",
        varianceExplanation: "Synthetic statement is short one manual review item.",
      }),
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ledger/controls",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      approvals: [
        {
          id: "approval-matter-002",
          transactionId: "matter-002-retainer",
          decision: "rejected",
        },
      ],
      reconciliations: [
        {
          id: "reconciliation-exception",
          accountId: "acct-trust-bank",
          status: "exception",
        },
      ],
      diagnostics: {
        pendingApprovalTransactionIds: ["trust-retainer"],
        rejectedApprovalTransactionIds: ["matter-002-retainer"],
        unreconciledAccountIds: ["acct-trust-bank"],
        exceptionReconciliationIds: ["reconciliation-exception"],
        overdrawnBalanceKeys: [],
      },
      trustControlPolicy: {
        automaticTrustPosting: false,
        transferRequestPosting: "requires_explicit_approval_and_manual_post",
        makerChecker: {
          ledgerTransactionApproval: "second_review_required",
          trustTransferRequest: "request_and_posting_are_separate_records",
          reconciliation: "firm_wide_review_required",
        },
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      },
    });
    expect(
      response
        .json<{ ledger: { entries: Array<{ matterId: string }> } }>()
        .ledger.entries.map((entry) => entry.matterId),
    ).toEqual(["matter-001", "matter-001", "matter-002", "matter-002"]);
  });

  it("requires matterId for matter-scoped ledger control reads", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ledger/controls",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Error",
      message: "matterId is required for matter-scoped ledger access",
    });
  });

  it("returns aggregate-only jurisdictional trust reports for firm-wide ledger users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedMatterTwoLedgerControls(repository);
    await repository.createLedgerReconciliation({
      ...reconciliationRecord({
        id: "reconciliation-exception",
        expectedBalanceCents: 152500,
        status: "exception",
        varianceExplanation: "Synthetic statement is short one manual review item.",
      }),
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ledger/reports/jurisdictional-trust?jurisdiction=BC",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      summaries: [
        {
          jurisdiction: "BC",
          matterCount: 2,
          trustBalanceCents: 152500,
          pendingApprovalCount: 1,
          rejectedApprovalCount: 1,
          exceptionReconciliationCount: 1,
          importedStatementRowCount: 1,
          matchedStatementRowCount: 1,
          unmatchedStatementRowCount: 0,
          totalVarianceCents: -2500,
          unreconciledAccountCount: 1,
          overdrawnBalanceCount: 0,
          compliancePosture: "operational_controls_only_not_jurisdiction_certified",
        },
      ],
    });
    expect(response.json()).not.toHaveProperty("reconciliations");
    expect(JSON.stringify(response.json())).not.toContain("synthetic-april-trust.pdf");
  });

  it("denies jurisdictional trust reports to matter-scoped users", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ledger/reports/jurisdictional-trust",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Trust ledger access required",
    });
  });

  it("filters matter-scoped ledger controls and hides reconciliation data", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedMatterTwoLedgerControls(repository);
    await repository.createLedgerTransactionApproval({
      id: "approval-matter-001",
      firmId: "firm-west-legal",
      transactionId: "trust-retainer",
      decidedByUserId: "user-admin",
      decision: "approved",
      decidedAt: "2026-04-24T13:10:00.000Z",
    });
    await repository.createLedgerReconciliation({
      ...reconciliationRecord({ id: "reconciliation-hidden" }),
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ledger/controls?matterId=matter-001",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(
      response
        .json<{ ledger: { entries: Array<{ matterId: string }> } }>()
        .ledger.entries.map((entry) => entry.matterId),
    ).toEqual(["matter-001", "matter-001"]);
    expect(response.json()).toMatchObject({
      approvals: [
        {
          id: "approval-matter-001",
          transactionId: "trust-retainer",
          decision: "approved",
        },
      ],
      reconciliations: [],
      diagnostics: {
        pendingApprovalTransactionIds: [],
        rejectedApprovalTransactionIds: [],
        unreconciledAccountIds: [],
        exceptionReconciliationIds: [],
        overdrawnBalanceKeys: [],
      },
    });
  });

  it("denies unauthorized ledger control reads", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ledger/controls?matterId=matter-001",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
  });

  it("requires matterId for matter-scoped ledger reads", async () => {
    const server = testServer();
    const noMatterId = await server.inject({
      method: "GET",
      url: "/api/ledger",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const assignedMatter = await server.inject({
      method: "GET",
      url: "/api/ledger?matterId=matter-001",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const otherMatter = await server.inject({
      method: "GET",
      url: "/api/ledger?matterId=matter-002",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(noMatterId.statusCode).toBe(400);
    expect(noMatterId.json()).toMatchObject({
      error: "Error",
      message: "matterId is required for matter-scoped ledger access",
    });
    expect(assignedMatter.statusCode).toBe(200);
    expect(
      assignedMatter
        .json<{ entries: Array<{ matterId: string }> }>()
        .entries.map((entry) => entry.matterId),
    ).toEqual(["matter-001", "matter-001"]);
    expect(otherMatter.statusCode).toBe(403);
    expect(otherMatter.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
  });

  it("posts transactions through validated bodies", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: ledgerTransactionPayload(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "ledger-route-transaction",
      firmId: "firm-west-legal",
      idempotencyKey: "ledger-route-transaction-key",
      entries: [
        {
          id: "ledger-route-transaction:1",
          transactionId: "ledger-route-transaction",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 2500,
          creditCents: 0,
          postedAt: "2026-04-24T12:00:00.000Z",
        },
        {
          id: "ledger-route-transaction:2",
          transactionId: "ledger-route-transaction",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 0,
          creditCents: 2500,
          postedAt: "2026-04-24T12:00:00.000Z",
        },
      ],
    });
    expect(response.json()).not.toHaveProperty("success");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.transaction.posted",
          resourceType: "ledger_transaction",
          resourceId: "ledger-route-transaction",
          metadata: expect.objectContaining({
            transactionId: "ledger-route-transaction",
            matterIds: ["matter-001"],
            accountIds: ["acct-trust-bank", "acct-client-liability"],
            status: "posted",
            entryCount: 2,
            requestId: expect.any(String),
            actorType: "owner_admin",
            actorId: "user-admin",
            workflowStatus: "succeeded",
            idempotencyKeyPresent: true,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("returns existing ledger transactions on replay and rejects conflicting key reuse", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const payload = ledgerTransactionPayload({
      id: "ledger-route-replay",
      idempotencyKey: "ledger-route-replay-key",
    });

    const first = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload,
    });
    const replay = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: { ...payload, id: "ledger-route-replay-duplicate" },
    });
    const conflict = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        ...payload,
        id: "ledger-route-replay-conflict",
        entries: payload.entries.map((entry, index) =>
          index === 0 ? { ...entry, memo: "Changed memo" } : entry,
        ),
      },
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe("ledger-route-replay");
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Idempotency key was reused with a different payload",
    });
  });

  it("rejects ledger client and matter scope mismatches", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: ledgerTransactionPayload({
        id: "ledger-route-client-mismatch",
        idempotencyKey: "ledger-route-client-mismatch-key",
        entries: [
          {
            matterId: "matter-001",
            clientId: "contact-northstar",
            accountId: "acct-trust-bank",
            debitCents: 2500,
            creditCents: 0,
            memo: "Wrong client for matter",
          },
          {
            matterId: "matter-001",
            clientId: "contact-northstar",
            accountId: "acct-client-liability",
            debitCents: 0,
            creditCents: 2500,
            memo: "Wrong client liability",
          },
        ],
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Error",
      message: "Ledger client must be a non-adverse party on the matter",
    });
  });

  it("records approvals and reconciliations", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const approval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      payload: {
        decision: "approved",
        notes: "Reviewed against receipt batch.",
        decidedAt: "2026-04-24T13:00:00.000Z",
      },
    });
    const reconciliation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: reconciliationPayload({ evidence: { statement: "april-trust.pdf" } }),
    });

    expect(approval.statusCode).toBe(200);
    expect(approval.json()).toMatchObject({
      firmId: "firm-west-legal",
      transactionId: "trust-retainer",
      decidedByUserId: "user-admin",
      decision: "approved",
      decidedAt: "2026-04-24T13:00:00.000Z",
      notes: "Reviewed against receipt batch.",
    });
    await expect(
      repository.listLedgerTransactionApprovals("firm-west-legal", {
        transactionId: "trust-retainer",
      }),
    ).resolves.toHaveLength(1);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.transaction_approval.decided",
          resourceType: "ledger_transaction_approval",
          resourceId: approval.json<{ id: string }>().id,
          metadata: {
            transactionId: "trust-retainer",
            matterIds: ["matter-001"],
            decision: "approved",
          },
        }),
      ]),
      valid: true,
    });

    expect(reconciliation.statusCode).toBe(200);
    expect(reconciliation.json()).toMatchObject({
      firmId: "firm-west-legal",
      accountId: "acct-trust-bank",
      expectedBalanceCents: 150000,
      actualBalanceCents: 150000,
      beginningBalanceCents: 0,
      endingBalanceCents: 150000,
      statementRows: [
        {
          id: "statement-row-001",
          postedAt: "2026-04-02T17:00:00.000Z",
          description: "Synthetic retainer deposit",
          amountCents: 150000,
          reference: "synthetic-april-001",
          matchedLedgerEntryIds: ["trust-retainer-1"],
          reviewDecision: "matched",
          reviewedByUserId: "user-admin",
          reviewedAt: expect.any(String),
        },
      ],
      status: "matched",
      reviewedByUserId: "user-admin",
      evidence: { statement: "april-trust.pdf" },
    });
    await expect(repository.listLedgerReconciliations("firm-west-legal")).resolves.toHaveLength(1);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.reconciliation.created",
          resourceType: "ledger_reconciliation",
          resourceId: reconciliation.json<{ id: string }>().id,
          metadata: {
            accountId: "acct-trust-bank",
            status: "matched",
            statementRowCount: 1,
            matchedStatementRowCount: 1,
            unmatchedStatementRowCount: 0,
            varianceCents: 0,
            varianceExplanationPresent: false,
          },
        }),
      ]),
      valid: true,
    });
  });

  it("previews trust statement rows without posting ledger entries or creating reconciliations", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await repository.getLedger("firm-west-legal");
    const auditBefore = await repository.listAuditEvents("firm-west-legal");
    const response = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/preview",
      payload: {
        accountId: "acct-trust-bank",
        statementRows: [
          {
            id: "statement-import-001",
            postedAt: "2026-04-02T17:00:00.000Z",
            description: "Retainer received into pooled trust",
            amountCents: 150000,
            reference: "trust-retainer",
          },
          {
            id: "statement-import-duplicate",
            postedAt: "2026-04-02T08:00:00.000Z",
            description: "retainer   received into pooled trust",
            amountCents: 150000,
            reference: "TRUST-RETAINER",
          },
          {
            id: "statement-import-unmatched",
            postedAt: "2026-04-29T17:00:00.000Z",
            description: "Synthetic unresolved service charge",
            amountCents: -125,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accountId: "acct-trust-bank",
      importedStatementRowCount: 3,
      uniqueStatementRowCount: 2,
      duplicateStatementRowCount: 1,
      proposedMatchedStatementRowCount: 1,
      postingPolicy: "review_only_no_automatic_ledger_posting",
      rows: [
        {
          id: "statement-import-001",
          reviewDecision: "matched",
          proposedMatches: [
            {
              ledgerEntryId: "trust-retainer-1",
              transactionId: "trust-retainer",
              amountCents: 150000,
              confidence: "exact",
              reasons: ["amount", "date", "description", "reference"],
            },
          ],
        },
        {
          id: "statement-import-duplicate",
          duplicateOfRowId: "statement-import-001",
          reviewDecision: "unmatched",
          proposedMatches: [],
        },
        {
          id: "statement-import-unmatched",
          reviewDecision: "unmatched",
          proposedMatches: [],
        },
      ],
    });
    await expect(repository.getLedger("firm-west-legal")).resolves.toMatchObject({
      entries: ledgerBefore.entries,
    });
    await expect(repository.listLedgerReconciliations("firm-west-legal")).resolves.toEqual([]);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: auditBefore.events,
      valid: true,
    });
  });

  it("rejects invalid ledger approval and reconciliation controls", async () => {
    const server = testServer({ repository: new InMemoryOpenPracticeRepository() });
    const firstApproval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      payload: {
        decision: "approved",
        decidedAt: "2026-04-24T13:00:00.000Z",
      },
    });
    const duplicateApproval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      payload: {
        decision: "rejected",
        decidedAt: "2026-04-24T13:05:00.000Z",
      },
    });
    const unknownApproval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/missing-transaction/approvals",
      payload: { decision: "approved" },
    });
    const invalidPeriod = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: reconciliationPayload({
        statementPeriodStart: "2026-04-30T00:00:00.000Z",
        statementPeriodEnd: "2026-04-01T00:00:00.000Z",
      }),
    });
    const missingVarianceExplanation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: reconciliationPayload({
        actualBalanceCents: 149000,
        endingBalanceCents: 149000,
        statementRows: [
          {
            id: "statement-row-unmatched",
            postedAt: "2026-04-29T17:00:00.000Z",
            description: "Synthetic unresolved bank fee",
            amountCents: 149000,
            matchedLedgerEntryIds: [],
            reviewDecision: "unmatched",
          },
        ],
      }),
    });

    expect(firstApproval.statusCode).toBe(200);
    expect(duplicateApproval.statusCode).toBe(400);
    expect(duplicateApproval.json()).toMatchObject({
      error: "Error",
      message: "Ledger approval reviewer has already recorded a decision",
    });
    expect(unknownApproval.statusCode).toBe(400);
    expect(unknownApproval.json()).toMatchObject({
      error: "Error",
      message: "Unknown ledger transaction missing-transaction",
    });
    expect(invalidPeriod.statusCode).toBe(400);
    expect(invalidPeriod.json()).toMatchObject({
      error: "Error",
      message: "Ledger reconciliation period end must be after period start",
    });
    expect(missingVarianceExplanation.statusCode).toBe(400);
    expect(missingVarianceExplanation.json()).toMatchObject({
      error: "Error",
      message: "Variance explanation is required for unmatched reconciliation differences",
    });
  });

  it("rejects unauthorized ledger control writes", async () => {
    const headers = {
      "x-open-practice-user-id": "user-staff",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const server = testServer();
    const approval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      headers,
      payload: { decision: "approved" },
    });
    const reconciliation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      headers,
      payload: reconciliationPayload(),
    });

    expect(approval.statusCode).toBe(403);
    expect(approval.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(reconciliation.statusCode).toBe(403);
    expect(reconciliation.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
  });

  it("rejects matter-scoped ledger approvals outside the transaction matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.postLedgerTransaction({
      id: "matter-002-retainer",
      firmId: "firm-west-legal",
      idempotencyKey: "matter-002-retainer-key",
      postedByUserId: "user-admin",
      postedAt: "2026-04-24T12:00:00.000Z",
      entries: [
        {
          firmId: "firm-west-legal",
          matterId: "matter-002",
          clientId: "contact-northstar",
          accountId: "acct-trust-bank",
          debitCents: 2500,
          creditCents: 0,
          memo: "Matter 002 trust receipt",
        },
        {
          firmId: "firm-west-legal",
          matterId: "matter-002",
          clientId: "contact-northstar",
          accountId: "acct-client-liability",
          debitCents: 0,
          creditCents: 2500,
          memo: "Matter 002 client liability",
        },
      ],
    });
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/ledger/transactions/matter-002-retainer/approvals",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { decision: "approved" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    await expect(
      repository.listLedgerTransactionApprovals("firm-west-legal", {
        transactionId: "matter-002-retainer",
      }),
    ).resolves.toEqual([]);
  });

  it("requires firm-wide ledger authority for account reconciliations", async () => {
    const server = testServer();
    const preview = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/preview",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        accountId: "acct-trust-bank",
        statementRows: [
          {
            id: "statement-import-001",
            postedAt: "2026-04-02T17:00:00.000Z",
            description: "Synthetic retainer deposit",
            amountCents: 150000,
          },
        ],
      },
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: reconciliationPayload(),
    });

    expect(preview.statusCode).toBe(403);
    expect(preview.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
  });

  it("returns legacy top-level error shape for invalid ledger bodies", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: {
        accountId: "acct-trust-bank",
        statementPeriodStart: "not-a-date",
        statementPeriodEnd: "2026-04-30T23:59:59.000Z",
        expectedBalanceCents: 150000,
        actualBalanceCents: 150000,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(response.json()).not.toHaveProperty("success");
  });
});
