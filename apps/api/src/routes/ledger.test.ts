import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import {
  defaultPaymentImportReviewBoundary,
  financialCommandJournalActions,
  type LedgerReconciliationRecord,
} from "@open-practice/domain";
import { registerLedgerRoutes } from "./ledger.js";
import type { ApiJobQueue } from "./types.js";

const servers: FastifyInstance[] = [];

interface TestServerOptions {
  repository?: OpenPracticeRepository;
  reportJobQueue?: ApiJobQueue;
}

type QueuedReportJob = { name: string; data: unknown; jobId?: string };

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

function testServer({
  repository = new InMemoryOpenPracticeRepository(),
  reportJobQueue,
}: TestServerOptions = {}) {
  const server = Fastify({ logger: false });
  server.register(rateLimit, { global: true, max: 1_000, timeWindow: "1 minute" });
  server.addHook("preHandler", async (request) => {
    request.auth = await authenticateTestRequest(repository, request.headers);
  });
  registerLedgerRoutes(server, { repository, reportJobQueue });
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

function fakeReportQueue(jobs: QueuedReportJob[] = []): ApiJobQueue {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "report-job" };
    },
  };
}

class FinancialCommandAuditReadRepository extends InMemoryOpenPracticeRepository {
  fullAuditReadCount = 0;
  readonly filteredAuditReads: Array<
    Parameters<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]>[1]
  > = [];

  override async listAuditEvents(
    firmId: Parameters<InMemoryOpenPracticeRepository["listAuditEvents"]>[0],
  ): ReturnType<InMemoryOpenPracticeRepository["listAuditEvents"]> {
    this.fullAuditReadCount += 1;
    return super.listAuditEvents(firmId);
  }

  override async listFilteredAuditEvents(
    firmId: Parameters<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]>[0],
    filter: Parameters<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]>[1],
  ): ReturnType<InMemoryOpenPracticeRepository["listFilteredAuditEvents"]> {
    this.filteredAuditReads.push(filter);
    return super.listFilteredAuditEvents(firmId, filter);
  }
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

function preparedPostingRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "posting-request-route-test",
    preparedAt: "2026-04-24T12:10:00.000Z",
    preparationNotes: "Synthetic preparation note for checker review.",
    proposedTransaction: ledgerTransactionPayload({
      id: "prepared-route-posting",
      idempotencyKey: "prepared-route-posting-key",
      postedAt: "2026-04-24T12:05:00.000Z",
      entries: [
        {
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-client-liability",
          debitCents: 2500,
          creditCents: 0,
          memo: "Route test prepared trust transfer",
        },
        {
          matterId: "matter-001",
          clientId: "contact-ada",
          accountId: "acct-trust-bank",
          debitCents: 0,
          creditCents: 2500,
          memo: "Route test prepared trust transfer",
        },
      ],
    }),
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
    await repository.createLedgerStatementImportBatch({
      id: "statement-import-batch-route-review",
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
    });
    await repository.createTrustTransferRequest({
      id: "trust-transfer-route-packet",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      clientContactId: "contact-ada",
      invoiceId: "invoice-001",
      requestedByUserId: "user-admin",
      amountCents: 4800,
      status: "approved",
      reason: "Synthetic route packet transfer reason must stay out of controls.",
      requestedAt: "2026-05-31T18:20:00.000Z",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-05-31T18:25:00.000Z",
      evidence: { privateNote: "Synthetic private trust-transfer evidence" },
    });
    await repository.createPaymentImportReviewRecord({
      id: "payment-import-route-packet",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      providerLabel: "synthetic_processor",
      eventFamily: "deposit",
      eventStatus: "posted",
      externalEventId: "evt_route_packet",
      externalDepositId: "dep_route_packet",
      amountCents: 4800,
      currency: "CAD",
      importedAt: "2026-05-31T18:30:00.000Z",
      importedByUserId: "user-admin",
      candidateManualPaymentId: "payment-001",
      duplicateOfRecordId: "payment-import-review-001",
      reviewState: "needs_review",
      normalizedEvidenceFingerprint: "route-packet-fingerprint",
      boundaries: defaultPaymentImportReviewBoundary(),
      updatedAt: "2026-05-31T18:35:00.000Z",
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
      balanceSnapshotComparison: {
        generatedAt: expect.any(String),
        reviewOnly: true,
        currentTrustBalance: {
          totalCents: 152500,
          balanceCount: 2,
          overdrawnBalanceCount: 0,
        },
        latestPostedTransaction: {
          transactionId: "matter-002-retainer",
          postedAt: "2026-04-24T12:00:00.000Z",
          entryCount: 2,
          matterCount: 1,
          clientCount: 1,
          accountCount: 2,
          trustAssetDeltaCents: 2500,
          clientLiabilityDeltaCents: 2500,
          reversal: false,
        },
        latestReconciliationPreview: {
          importBatchId: "statement-import-batch-route-review",
          accountId: "acct-trust-bank",
          accountName: "Pooled trust bank",
          status: "review_ready",
          importedStatementRowCount: 12,
          duplicateStatementRowCount: 2,
          matchingProfilePresent: true,
          sourceLabelPresent: true,
          storagePosture: "metadata_only_no_statement_rows",
        },
        latestReconciliationSnapshot: {
          reconciliationId: "reconciliation-exception",
          accountId: "acct-trust-bank",
          accountName: "Pooled trust bank",
          status: "exception",
          expectedBalanceCents: 152500,
          actualBalanceCents: 150000,
          varianceCents: -2500,
          unmatchedStatementRowCount: 0,
        },
        reviewReasons: ["reconciliation_variance"],
        policy: {
          source: "ledger_snapshot_and_reconciliation_metadata",
          previewStoragePosture: "latest_import_batch_metadata_only_no_statement_rows",
          automaticMatching: false,
          automaticLedgerPosting: false,
          automaticReconciliation: false,
          settlementAutomation: false,
          liveBankFeedConnection: false,
          jurisdictionCertifiedAccounting: false,
        },
      },
      reconciliationFreshness: {
        summary: {
          accountCount: 1,
          exceptionCount: 1,
          unmatchedStatementRowCount: 0,
          reviewOnly: true,
        },
        rows: [
          expect.objectContaining({
            accountId: "acct-trust-bank",
            latestReviewedStatementPeriodEnd: "2026-04-30T23:59:59.000Z",
            exceptionCount: 1,
            reviewOnly: true,
          }),
        ],
        reviewOnly: true,
      },
      reconciliationPacketReview: {
        reviewOnly: true,
        summary: {
          packetCount: 6,
          reviewOnly: true,
        },
        packets: expect.arrayContaining([
          expect.objectContaining({
            kind: "ledger",
            reviewOnly: true,
          }),
          expect.objectContaining({
            kind: "statement_import",
            evidenceCount: expect.any(Number),
            reviewOnly: true,
          }),
          expect.objectContaining({
            kind: "exception",
            exceptionCount: expect.any(Number),
            reviewOnly: true,
          }),
          expect.objectContaining({
            kind: "trust_transfer",
            pendingCount: expect.any(Number),
            amountCents: expect.any(Number),
            reviewOnly: true,
          }),
          expect.objectContaining({
            kind: "posting_request",
            reviewOnly: true,
          }),
          expect.objectContaining({
            kind: "payment_import",
            conflictCount: expect.any(Number),
            reviewOnly: true,
          }),
        ]),
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
      },
      makerCheckerReadiness: {
        reviewOnly: true,
        summary: {
          categoryCount: 6,
          categoriesRequiringPolicyCount: expect.any(Number),
          matterCount: expect.any(Number),
          mattersRequiringPolicyCount: expect.any(Number),
          reviewOnly: true,
        },
        categories: expect.arrayContaining([
          expect.objectContaining({
            category: "ledger",
            readiness: "policy_required_if_enabled",
            reasonCodes: expect.arrayContaining([
              "pending_ledger_transaction_approval",
              "rejected_ledger_transaction_approval",
            ]),
            reviewOnly: true,
          }),
          expect.objectContaining({
            category: "statement_import",
            reasonCodes: expect.arrayContaining([
              "statement_import_review_ready",
              "statement_import_duplicate_rows",
            ]),
            reviewOnly: true,
          }),
          expect.objectContaining({
            category: "payment_import",
            reasonCodes: expect.arrayContaining([
              "payment_import_review_required",
              "payment_import_conflict",
            ]),
            reviewOnly: true,
          }),
        ]),
        matters: expect.arrayContaining([
          expect.objectContaining({
            matterId: "matter-001",
            categoryKeys: expect.arrayContaining(["trust_transfer", "payment_import"]),
            reviewOnly: true,
          }),
          expect.objectContaining({
            matterId: "matter-002",
            categoryKeys: expect.arrayContaining(["ledger"]),
            reviewOnly: true,
          }),
        ]),
        policy: {
          source: "existing_trust_controls_projection",
          makerCheckerPolicyEnabled: false,
          directPostingSemantics: "unchanged",
          approvalMutation: false,
          automaticTrustPosting: false,
          settlementAutomation: false,
          bankFeedMatching: false,
          jurisdictionCertifiedAccounting: false,
        },
      },
      diagnostics: {
        pendingApprovalTransactionIds: ["trust-retainer"],
        rejectedApprovalTransactionIds: ["matter-002-retainer"],
        unreconciledAccountIds: ["acct-trust-bank"],
        exceptionReconciliationIds: ["reconciliation-exception"],
        overdrawnBalanceKeys: [],
      },
      accountingReview: {
        importBatches: [
          {
            id: "statement-import-batch-route-review",
            accountId: "acct-trust-bank",
            status: "review_ready",
            importedStatementRowCount: 12,
            duplicateStatementRowCount: 2,
          },
        ],
        summary: {
          matchRuleProfileCount: 1,
          accountingProfileCount: 2,
          protectedAccountCount: 1,
          bankFeedShellCount: 1,
          reviewOnly: true,
        },
        bankFeedReviewSummary: {
          bankFeedShellCount: 1,
          metadataOnlyFeedCount: 1,
          reviewReadyFeedCount: 0,
          importBatchCount: 1,
          previewedImportBatchCount: 0,
          reviewReadyImportBatchCount: 1,
          discardedImportBatchCount: 0,
          importedStatementRowCount: 12,
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
        },
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
    const serializedControls = JSON.stringify(response.json());
    expect(serializedControls).not.toContain("Synthetic private trust-transfer evidence");
    expect(serializedControls).not.toContain("Synthetic route packet transfer reason");
    expect(serializedControls).not.toContain("route-packet-fingerprint");
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

  it("returns a read-only financial command journal from safe audit metadata cues", async () => {
    const repository = new FinancialCommandAuditReadRepository();
    await repository.appendAuditEvent({
      id: "audit-financial-ledger-posted",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T15:55:00.000Z",
      action: "ledger.transaction.posted",
      resourceType: "ledger_transaction",
      resourceId: "trust-retainer",
      metadata: {
        transactionId: "trust-retainer",
        matterIds: ["matter-001"],
        accountIds: ["acct-trust-bank", "acct-client-liability"],
        status: "posted",
        entryCount: 2,
        memo: "Synthetic ledger memo must stay out of the journal.",
      },
    });
    await repository.appendAuditEvent({
      id: "audit-financial-ledger-approval",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T16:00:00.000Z",
      action: "ledger.transaction_approval.decided",
      resourceType: "ledger_transaction_approval",
      resourceId: "approval-trust-retainer",
      metadata: {
        transactionId: "trust-retainer",
        matterIds: ["matter-001"],
        decision: "approved",
        notes: "Synthetic privileged approval note must stay out of the journal.",
      },
    });
    await repository.appendAuditEvent({
      id: "audit-financial-trust-transfer",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T16:05:00.000Z",
      action: "trust_transfer_request.approved",
      resourceType: "trust_transfer_request",
      resourceId: "trust-transfer-journal",
      metadata: {
        matterId: "matter-001",
        trustTransferRequestId: "trust-transfer-journal",
        invoiceId: "invoice-journal",
        previousStatus: "pending_approval",
        status: "approved",
        amountCents: 12000,
        evidencePresent: true,
        rawEvidence: "Synthetic trust evidence payload must stay out of the journal.",
      },
    });
    await repository.appendAuditEvent({
      id: "audit-financial-invoice",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T16:10:00.000Z",
      action: "invoice.approved",
      resourceType: "invoice",
      resourceId: "invoice-journal",
      metadata: {
        matterId: "matter-001",
        invoiceId: "invoice-journal",
        previousStatus: "draft",
        status: "approved",
        totalCents: 12000,
        balanceDueCents: 12000,
        narrative: "Synthetic billing narrative must stay out of the journal.",
      },
    });
    await repository.appendAuditEvent({
      id: "audit-financial-reconciliation",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T16:15:00.000Z",
      action: "ledger.reconciliation.created",
      resourceType: "ledger_reconciliation",
      resourceId: "reconciliation-journal",
      metadata: {
        accountId: "acct-trust-bank",
        status: "exception",
        statementRowCount: 4,
        matchedStatementRowCount: 3,
        unmatchedStatementRowCount: 1,
        varianceCents: -250,
        statementRows: ["Synthetic row body must stay out of the journal."],
      },
    });
    await repository.appendAuditEvent({
      id: "audit-financial-manual-payment",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T16:20:00.000Z",
      action: "manual_payment.reconciled",
      resourceType: "manual_payment",
      resourceId: "payment-journal",
      metadata: {
        matterId: "matter-001",
        paymentId: "payment-journal",
        invoiceId: "invoice-journal",
        status: "received",
        amountCents: 5000,
        allocationCount: 1,
        evidencePresent: true,
        receiptBody: "Synthetic private receipt body must stay out of the journal.",
      },
    });
    await repository.appendAuditEvent({
      id: "audit-financial-hidden-matter",
      firmId: "firm-west-legal",
      actorId: "user-admin",
      occurredAt: "2026-06-16T16:25:00.000Z",
      action: "trust_transfer_request.rejected",
      resourceType: "trust_transfer_request",
      resourceId: "trust-transfer-hidden",
      metadata: {
        matterId: "matter-002",
        trustTransferRequestId: "trust-transfer-hidden",
        invoiceId: "invoice-hidden",
        previousStatus: "pending_approval",
        status: "rejected",
        amountCents: 7000,
        evidencePresent: true,
      },
    });

    const firmResponse = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ledger/controls",
    });
    const matterResponse = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ledger/controls?matterId=matter-001",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(firmResponse.statusCode).toBe(200);
    const firmJournal = firmResponse.json<{
      financialCommandJournal: {
        chainValid: boolean;
        entries: Array<Record<string, unknown>>;
        policy: Record<string, unknown>;
        summary: {
          total: number;
          byFamily: Record<string, number>;
          byDecision: Record<string, number>;
        };
      };
    }>().financialCommandJournal;
    expect(firmJournal).toMatchObject({
      chainValid: true,
      policy: {
        source: "audit_metadata",
        rawMetadataValues: "redacted_allowlisted_cues_only",
        postingAutomation: false,
        settlementAutomation: false,
        publicExposure: false,
      },
      summary: {
        total: 6,
        byFamily: {
          trust_transfer: 2,
          trust_transaction: 1,
          invoice_approval: 1,
          reconciliation: 2,
        },
        byDecision: {
          approved: 3,
          exception: 1,
          reconciled: 1,
          rejected: 1,
        },
      },
    });
    expect(firmJournal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditEventId: "audit-financial-trust-transfer",
          family: "trust_transfer",
          decision: "approved",
          matterId: "matter-001",
          trustTransferRequestId: "trust-transfer-journal",
          invoiceId: "invoice-journal",
          amountCents: 12000,
          evidencePresent: true,
        }),
        expect.objectContaining({
          auditEventId: "audit-financial-manual-payment",
          family: "reconciliation",
          decision: "reconciled",
          paymentId: "payment-journal",
          allocationCount: 1,
        }),
        expect.objectContaining({
          auditEventId: "audit-financial-reconciliation",
          family: "reconciliation",
          decision: "exception",
          accountId: "acct-trust-bank",
          statementRowCount: 4,
          varianceCents: -250,
        }),
      ]),
    );
    const serializedFirmJournal = JSON.stringify(firmJournal);
    expect(serializedFirmJournal).not.toContain("audit-financial-ledger-posted");
    expect(serializedFirmJournal).not.toContain("Synthetic ledger memo");
    expect(serializedFirmJournal).not.toContain("Synthetic privileged approval note");
    expect(serializedFirmJournal).not.toContain("Synthetic trust evidence payload");
    expect(serializedFirmJournal).not.toContain("Synthetic billing narrative");
    expect(serializedFirmJournal).not.toContain("Synthetic row body");
    expect(serializedFirmJournal).not.toContain("Synthetic private receipt body");

    expect(matterResponse.statusCode).toBe(200);
    const matterJournal = matterResponse.json<{
      financialCommandJournal: {
        scope: Record<string, unknown>;
        entries: Array<{ auditEventId: string; resourceId: string }>;
        summary: { total: number };
      };
    }>().financialCommandJournal;
    expect(matterJournal.scope).toEqual({ kind: "matter", matterId: "matter-001" });
    expect(matterJournal.summary.total).toBe(4);
    expect(matterJournal.entries.map((entry) => entry.auditEventId).sort()).toEqual([
      "audit-financial-invoice",
      "audit-financial-ledger-approval",
      "audit-financial-manual-payment",
      "audit-financial-trust-transfer",
    ]);
    expect(matterJournal.entries.map((entry) => entry.resourceId)).not.toContain(
      "reconciliation-journal",
    );
    expect(matterJournal.entries.map((entry) => entry.resourceId)).not.toContain(
      "trust-transfer-hidden",
    );
    expect(repository.fullAuditReadCount).toBe(2);
    expect(repository.filteredAuditReads).toEqual([
      { actions: financialCommandJournalActions },
      { actions: financialCommandJournalActions, matterId: "matter-001" },
    ]);
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
      groupBy: "jurisdiction",
      filters: { jurisdiction: "BC" },
      dimensionOptions: expect.objectContaining({
        jurisdictions: ["BC"],
        practiceAreas: expect.arrayContaining(["Residential tenancy"]),
        clinicProgramIds: expect.arrayContaining(["clinic-program-tenancy-stability"]),
        restrictedFundReviewStatuses: expect.arrayContaining(["not_reviewed"]),
      }),
      compliancePosture: "operational_controls_only_not_jurisdiction_certified",
      summaries: [
        {
          jurisdiction: "BC",
          dimensionKey: "BC",
          practiceArea: "multiple",
          clinicProgramId: "multiple",
          restrictedFundReviewStatus: "not_reviewed",
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

  it("groups jurisdictional trust reports by existing clinic dimensions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedMatterTwoLedgerControls(repository);

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/ledger/reports/jurisdictional-trust?groupBy=clinicProgramId&restrictedFundReviewStatus=not_reviewed",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      groupBy: "clinicProgramId",
      filters: { restrictedFundReviewStatus: "not_reviewed" },
      summaries: expect.arrayContaining([
        expect.objectContaining({
          dimensionKey: "clinic-program-tenancy-stability",
          clinicProgramId: "clinic-program-tenancy-stability",
          restrictedFundReviewStatus: "not_reviewed",
          matterCount: 1,
        }),
        expect.objectContaining({
          dimensionKey: "clinic-program-records-access",
          clinicProgramId: "clinic-program-records-access",
          restrictedFundReviewStatus: "not_reviewed",
          matterCount: 1,
        }),
      ]),
    });
    expect(JSON.stringify(response.json())).not.toContain("Synthetic operational note");
  });

  it("queues jurisdictional trust exports and downloads only after worker completion", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: QueuedReportJob[] = [];
    await seedMatterTwoLedgerControls(repository);
    await repository.createLedgerReconciliation({
      ...reconciliationRecord({
        id: "reconciliation-export-private-evidence",
        expectedBalanceCents: 152500,
        status: "exception",
        varianceExplanation: "Synthetic statement is short one manual review item.",
        evidence: { statement: "synthetic-april-trust.pdf" },
      }),
    });
    const server = testServer({
      repository,
      reportJobQueue: fakeReportQueue(queuedReports),
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/ledger/reports/jurisdictional-trust/export-requests",
      payload: {
        jurisdiction: "BC",
        idempotencyKey: "jurisdictional-trust-export-route-test",
      },
    });

    expect(created.statusCode).toBe(202);
    const exportRequest = created.json<{
      exportRequest: { jobId: string; status: string; pollUrl: string; downloadUrl: string };
    }>().exportRequest;
    expect(exportRequest).toMatchObject({
      status: "queued",
      pollUrl: `/api/ledger/reports/jurisdictional-trust/export-requests/${exportRequest.jobId}`,
      downloadUrl: `/api/ledger/reports/jurisdictional-trust/export-requests/${exportRequest.jobId}/download`,
    });
    expect(queuedReports).toEqual([
      expect.objectContaining({
        name: "jurisdictional_trust_export",
        jobId: exportRequest.jobId,
      }),
    ]);
    expect(JSON.stringify(queuedReports)).toContain("jurisdictional_trust_summary_json");
    expect(JSON.stringify(queuedReports)).not.toContain("fieldKeys");
    expect(JSON.stringify(queuedReports)).not.toContain("synthetic-april-trust.pdf");

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: exportRequest.jobId,
      jobName: "jurisdictional_trust_export",
      status: "queued",
      targetResourceType: "jurisdictional_trust_export",
      metadata: {
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        fieldProfileId: "jurisdictional_trust_summary_json",
        jurisdiction: "BC",
        requestedByUserId: "user-admin",
        enqueueStatus: "queued_for_local_report_worker",
      },
    });
    expect(JSON.stringify(job.metadata)).not.toContain("synthetic-april-trust.pdf");

    const earlyDownload = await server.inject({
      method: "GET",
      url: `/api/ledger/reports/jurisdictional-trust/export-requests/${exportRequest.jobId}/download`,
    });
    expect(earlyDownload.statusCode).toBe(409);
    expect(earlyDownload.json()).toMatchObject({
      message: "Jurisdictional trust export is not ready yet",
    });

    await repository.updateJobLifecycleRecord("firm-west-legal", exportRequest.jobId, {
      status: "completed",
      finishedAt: "2026-05-19T12:00:00.000Z",
      metadata: {
        reportType: "jurisdictional_trust",
        reportScope: "firm",
        fieldProfileId: "jurisdictional_trust_summary_json",
        jurisdiction: "BC",
        requestedByUserId: "user-admin",
        summaryCount: 1,
      },
    });

    const status = await server.inject({
      method: "GET",
      url: `/api/ledger/reports/jurisdictional-trust/export-requests/${exportRequest.jobId}`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      exportRequest: { jobId: exportRequest.jobId, status: "completed" },
    });

    const downloaded = await server.inject({
      method: "GET",
      url: `/api/ledger/reports/jurisdictional-trust/export-requests/${exportRequest.jobId}/download`,
    });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.json()).toMatchObject({
      exportRequest: { jobId: exportRequest.jobId, status: "completed" },
      export: {
        fieldProfile: expect.objectContaining({
          id: "jurisdictional_trust_summary_json",
          format: "json",
          source: "generated_local_projection",
          manualDownloadOnly: true,
          storesRawExportBody: false,
        }),
        compliancePosture: "operational_controls_only_not_jurisdiction_certified",
        summaries: [
          expect.objectContaining({
            jurisdiction: "BC",
            exceptionReconciliationCount: 1,
          }),
        ],
      },
    });
    const downloadedPayload = downloaded.json();
    expect(downloadedPayload.export.fieldProfile.fieldKeys).toEqual(
      expect.arrayContaining(["summaries.trustBalanceCents", "summaries.totalVarianceCents"]),
    );
    const forbiddenFieldKeys = new Set([
      "rawBody",
      "rawExportBody",
      "storageKey",
      "objectKey",
      "evidence",
    ]);
    expect(
      downloadedPayload.export.fieldProfile.fieldKeys.some((key: string) =>
        forbiddenFieldKeys.has(key.split(".").at(-1) ?? key),
      ),
    ).toBe(false);

    const serializedAuditAndJobs = JSON.stringify({
      audit: await repository.listAuditEvents("firm-west-legal"),
      jobs: await repository.listJobLifecycleRecords("firm-west-legal"),
    });
    expect(serializedAuditAndJobs).not.toContain("synthetic-april-trust.pdf");
    expect(serializedAuditAndJobs).not.toContain("fieldKeys");
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

  it("denies jurisdictional trust export requests to matter-scoped users", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/reports/jurisdictional-trust/export-requests",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { jurisdiction: "BC" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: "Trust ledger access required",
    });
  });

  it("filters matter-scoped ledger controls and hides reconciliation data", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedMatterTwoLedgerControls(repository);
    await repository.createTrustTransferRequest({
      id: "trust-transfer-hidden-matter-002-controls",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      clientContactId: "contact-northstar",
      invoiceId: "invoice-hidden-matter-002",
      requestedByUserId: "user-admin",
      amountCents: 990000,
      status: "pending_approval",
      reason: "Synthetic hidden matter transfer reason must not leak.",
      requestedAt: "2026-05-31T18:20:00.000Z",
      evidence: { privateNote: "Synthetic hidden matter trust-transfer evidence" },
    });
    await repository.createPaymentImportReviewRecord({
      id: "payment-import-hidden-matter-002-controls",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      providerLabel: "synthetic_processor",
      eventFamily: "deposit",
      eventStatus: "posted",
      externalEventId: "evt_hidden_matter_002_controls",
      externalDepositId: "dep_hidden_matter_002_controls",
      amountCents: 880000,
      currency: "CAD",
      importedAt: "2026-05-31T18:30:00.000Z",
      importedByUserId: "user-admin",
      reviewState: "needs_review",
      normalizedEvidenceFingerprint: "hidden-matter-002-controls-fingerprint",
      boundaries: defaultPaymentImportReviewBoundary(),
      updatedAt: "2026-05-31T18:35:00.000Z",
    });
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
    const server = testServer({ repository });
    const hiddenPostingRequest = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/prepare",
      payload: preparedPostingRequestPayload({
        id: "posting-request-hidden-matter-002-controls",
        proposedTransaction: ledgerTransactionPayload({
          id: "prepared-hidden-matter-002-controls",
          idempotencyKey: "prepared-hidden-matter-002-controls-key",
          entries: [
            {
              matterId: "matter-002",
              clientId: "contact-northstar",
              accountId: "acct-client-liability",
              debitCents: 99000,
              creditCents: 0,
              memo: "Hidden matter prepared transfer",
            },
            {
              matterId: "matter-002",
              clientId: "contact-northstar",
              accountId: "acct-trust-bank",
              debitCents: 0,
              creditCents: 99000,
              memo: "Hidden matter prepared transfer",
            },
          ],
        }),
      }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/ledger/controls?matterId=matter-001",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(hiddenPostingRequest.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      ledger: { entries: Array<{ matterId: string }> };
      postingRequests: Array<{ id: string }>;
      postingRequestSummary: { totalCount: number };
      reconciliationPacketReview: {
        packets: Array<{
          kind: string;
          evidenceCount: number;
          pendingCount: number;
          amountCents: number;
        }>;
      };
      makerCheckerReadiness: {
        matters: Array<{
          matterId: string;
          categoryKeys: string[];
          reasonCodes: string[];
          reviewOnly: true;
        }>;
        policy: {
          makerCheckerPolicyEnabled: false;
          directPostingSemantics: "unchanged";
          approvalMutation: false;
          automaticTrustPosting: false;
          settlementAutomation: false;
          bankFeedMatching: false;
          jurisdictionCertifiedAccounting: false;
        };
      };
    }>();
    expect(body.ledger.entries.map((entry) => entry.matterId)).toEqual([
      "matter-001",
      "matter-001",
    ]);
    expect(body).toMatchObject({
      approvals: [
        {
          id: "approval-matter-001",
          transactionId: "trust-retainer",
          decision: "approved",
        },
      ],
      reconciliations: [],
      balanceSnapshotComparison: {
        generatedAt: expect.any(String),
        reviewOnly: true,
        currentTrustBalance: {
          totalCents: 150000,
          balanceCount: 1,
          overdrawnBalanceCount: 0,
        },
        latestPostedTransaction: {
          transactionId: "trust-retainer",
          postedAt: "2026-04-02T17:00:00.000Z",
          entryCount: 2,
          matterCount: 1,
          clientCount: 1,
          accountCount: 2,
          trustAssetDeltaCents: 150000,
          clientLiabilityDeltaCents: 150000,
          reversal: false,
        },
        reviewReasons: ["no_reconciliation_preview_metadata", "no_reconciliation_snapshot"],
        policy: {
          automaticMatching: false,
          automaticLedgerPosting: false,
          automaticReconciliation: false,
          settlementAutomation: false,
          liveBankFeedConnection: false,
          jurisdictionCertifiedAccounting: false,
        },
      },
      diagnostics: {
        pendingApprovalTransactionIds: [],
        rejectedApprovalTransactionIds: [],
        unreconciledAccountIds: [],
        exceptionReconciliationIds: [],
        overdrawnBalanceKeys: [],
      },
      accountingReview: {
        importBatches: [],
        matchRuleProfiles: [],
        accountingProfiles: [],
        bankFeedReviewSummary: {
          importBatchCount: 0,
          automaticMatching: false,
          automaticLedgerPosting: false,
          automaticReconciliation: false,
          liveBankFeedConnection: false,
          trustDisbursementAutomation: false,
          reviewOnly: true,
        },
      },
    });
    expect(body.postingRequests).toEqual([]);
    expect(body.postingRequestSummary.totalCount).toBe(0);
    const packetsByKind = new Map(
      body.reconciliationPacketReview.packets.map((packet) => [packet.kind, packet]),
    );
    expect(packetsByKind.get("trust_transfer")).toMatchObject({
      evidenceCount: 1,
      pendingCount: 1,
      amountCents: 13230,
    });
    expect(packetsByKind.get("payment_import")).toMatchObject({
      evidenceCount: 1,
      pendingCount: 1,
      amountCents: 13230,
    });
    expect(packetsByKind.get("posting_request")).toMatchObject({
      evidenceCount: 0,
      pendingCount: 0,
      amountCents: 0,
    });
    expect(body.makerCheckerReadiness.matters).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        categoryKeys: expect.arrayContaining(["trust_transfer", "payment_import"]),
        reasonCodes: expect.arrayContaining([
          "pending_trust_transfer_request",
          "payment_import_review_required",
        ]),
        reviewOnly: true,
      }),
    ]);
    expect(body.makerCheckerReadiness.policy).toMatchObject({
      makerCheckerPolicyEnabled: false,
      directPostingSemantics: "unchanged",
      approvalMutation: false,
      automaticTrustPosting: false,
      settlementAutomation: false,
      bankFeedMatching: false,
      jurisdictionCertifiedAccounting: false,
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("trust-transfer-hidden-matter-002-controls");
    expect(serialized).not.toContain("payment-import-hidden-matter-002-controls");
    expect(serialized).not.toContain("posting-request-hidden-matter-002-controls");
    expect(serialized).not.toContain("Synthetic hidden matter transfer reason");
    expect(serialized).not.toContain("hidden-matter-002-controls-fingerprint");
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

  it("prepares, lists, approves, and rejects selected trust posting requests", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const preparePayload = preparedPostingRequestPayload();

    const prepared = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/prepare",
      payload: preparePayload,
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.json()).toMatchObject({
      id: "posting-request-route-test",
      transactionId: "prepared-route-posting",
      status: "pending_approval",
      preparedByUserId: "user-admin",
      preparationNotes: "Synthetic preparation note for checker review.",
    });
    const ledgerAfterPrepare = await repository.getLedger("firm-west-legal", {
      matterId: "matter-001",
    });
    expect(
      ledgerAfterPrepare.entries.some((entry) => entry.transactionId === "prepared-route-posting"),
    ).toBe(false);

    const list = await server.inject({
      method: "GET",
      url: "/api/ledger/posting-requests?status=pending_approval",
    });
    const controls = await server.inject({
      method: "GET",
      url: "/api/ledger/controls",
    });
    const bypass = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: preparePayload.proposedTransaction,
    });
    const selfApproval = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/posting-request-route-test/approve",
      payload: {
        reviewedAt: "2026-04-24T12:30:00.000Z",
        reviewNotes: "Synthetic self approval should be blocked.",
      },
    });
    const approved = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/posting-request-route-test/approve",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        reviewedAt: "2026-04-24T12:31:00.000Z",
        reviewNotes: "Synthetic checker note.",
      },
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([
      expect.objectContaining({ id: "posting-request-route-test", status: "pending_approval" }),
    ]);
    expect(controls.statusCode).toBe(200);
    expect(controls.json()).toMatchObject({
      postingRequests: [
        expect.objectContaining({ id: "posting-request-route-test", status: "pending_approval" }),
      ],
      postingRequestSummary: {
        pendingApprovalCount: 1,
        postedCount: 0,
        rejectedCount: 0,
        totalCount: 1,
      },
      trustControlPolicy: {
        automaticTrustPosting: false,
        makerChecker: {
          ledgerPostingRequest: "prepared_postings_require_checker_approval_before_posting",
        },
      },
    });
    expect(bypass.statusCode).toBe(409);
    expect(bypass.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Selected trust posting is pending approval",
    });
    expect(selfApproval.statusCode).toBe(403);
    expect(selfApproval.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Ledger posting request requires checker approval by a different user",
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({
      id: "posting-request-route-test",
      status: "posted",
      reviewedByUserId: "user-licensee",
      ledgerTransactionId: "prepared-route-posting",
    });
    await expect(
      repository.getLedger("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ transactionId: "prepared-route-posting" }),
      ]),
    });

    const rejectedPrepare = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/prepare",
      payload: preparedPostingRequestPayload({
        id: "posting-request-route-rejected",
        proposedTransaction: ledgerTransactionPayload({
          id: "prepared-route-rejected",
          idempotencyKey: "prepared-route-rejected-key",
          postedAt: "2026-04-24T13:05:00.000Z",
          entries: preparePayload.proposedTransaction.entries,
        }),
      }),
    });
    const rejected = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/posting-request-route-rejected/reject",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        reviewedAt: "2026-04-24T13:31:00.000Z",
        rejectionReason: "Synthetic rejection reason.",
      },
    });

    expect(rejectedPrepare.statusCode).toBe(200);
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({
      id: "posting-request-route-rejected",
      status: "rejected",
    });
    expect(rejected.json()).not.toHaveProperty("ledgerTransactionId");
    const ledgerAfterReject = await repository.getLedger("firm-west-legal", {
      matterId: "matter-001",
    });
    expect(
      ledgerAfterReject.entries.some((entry) => entry.transactionId === "prepared-route-rejected"),
    ).toBe(false);

    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.posting_request.prepared",
          resourceType: "ledger_posting_request",
          resourceId: "posting-request-route-test",
          metadata: expect.objectContaining({
            postingRequestId: "posting-request-route-test",
            transactionId: "prepared-route-posting",
            preparationNotesPresent: true,
          }),
        }),
        expect.objectContaining({
          action: "ledger.posting_request.approved",
          metadata: expect.objectContaining({
            postingRequestId: "posting-request-route-test",
            ledgerTransactionId: "prepared-route-posting",
            reviewNotesPresent: true,
          }),
        }),
        expect.objectContaining({
          action: "ledger.posting_request.rejected",
          metadata: expect.objectContaining({
            postingRequestId: "posting-request-route-rejected",
            rejectionReasonPresent: true,
          }),
        }),
        expect.objectContaining({
          action: "ledger.transaction.posted",
          resourceId: "prepared-route-posting",
          metadata: expect.objectContaining({
            postingRequestId: "posting-request-route-test",
            workflowStatus: "succeeded",
          }),
        }),
      ]),
      valid: true,
    });
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic checker note.");
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic rejection reason.");
  });

  it("enforces matter-scoped posting request list and decision restrictions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const prepared = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/prepare",
      payload: preparedPostingRequestPayload({
        id: "posting-request-matter-002",
        proposedTransaction: ledgerTransactionPayload({
          id: "prepared-route-matter-002",
          idempotencyKey: "prepared-route-matter-002-key",
          entries: [
            {
              matterId: "matter-002",
              clientId: "contact-northstar",
              accountId: "acct-client-liability",
              debitCents: 500,
              creditCents: 0,
              memo: "Matter 002 prepared transfer",
            },
            {
              matterId: "matter-002",
              clientId: "contact-northstar",
              accountId: "acct-trust-bank",
              debitCents: 0,
              creditCents: 500,
              memo: "Matter 002 prepared transfer",
            },
          ],
        }),
      }),
    });
    const scopedWithoutMatter = await server.inject({
      method: "GET",
      url: "/api/ledger/posting-requests",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const scopedAssignedMatter = await server.inject({
      method: "GET",
      url: "/api/ledger/posting-requests?matterId=matter-001",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const scopedOtherMatter = await server.inject({
      method: "GET",
      url: "/api/ledger/posting-requests?matterId=matter-002",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const approveOtherMatter = await server.inject({
      method: "POST",
      url: "/api/ledger/posting-requests/posting-request-matter-002/approve",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { reviewedAt: "2026-04-24T14:00:00.000Z" },
    });

    expect(prepared.statusCode).toBe(200);
    expect(scopedWithoutMatter.statusCode).toBe(400);
    expect(scopedWithoutMatter.json()).toMatchObject({
      message: "matterId is required for matter-scoped ledger access",
    });
    expect(scopedAssignedMatter.statusCode).toBe(200);
    expect(scopedAssignedMatter.json()).toEqual([]);
    expect(scopedOtherMatter.statusCode).toBe(403);
    expect(scopedOtherMatter.json()).toMatchObject({
      message: "Trust ledger access required",
    });
    expect(approveOtherMatter.statusCode).toBe(403);
    expect(approveOtherMatter.json()).toMatchObject({
      message: "Trust ledger access required",
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
      error: "ApiHttpError",
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

  it("records statement import batch metadata without posting or reconciling", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await repository.getLedger("firm-west-legal");
    const response = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: {
        accountId: "acct-trust-bank",
        sourceLabel: "  Synthetic May trust statement  ",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 12,
        duplicateStatementRowCount: 2,
        matchingProfileId: "statement-match-profile-standard-trust",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accountId: "acct-trust-bank",
      sourceLabel: "Synthetic May trust statement",
      checksumSha256: "a".repeat(64),
      importedStatementRowCount: 12,
      duplicateStatementRowCount: 2,
      status: "previewed",
      matchingProfileId: "statement-match-profile-standard-trust",
      createdByUserId: "user-admin",
    });
    expect(response.json()).not.toHaveProperty("statementRows");
    expect(response.json()).not.toHaveProperty("evidence");

    const listResponse = await server.inject({
      method: "GET",
      url: "/api/ledger/reconciliations/import-batches?accountId=acct-trust-bank",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject([
      {
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        status: "previewed",
      },
    ]);
    await expect(repository.getLedger("firm-west-legal")).resolves.toMatchObject({
      entries: ledgerBefore.entries,
    });
    await expect(repository.listLedgerReconciliations("firm-west-legal")).resolves.toEqual([]);
    const auditEvents = await repository.listAuditEvents("firm-west-legal");
    expect(auditEvents).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.statement_import_batch.recorded",
          resourceType: "ledger_statement_import_batch",
          metadata: {
            accountId: "acct-trust-bank",
            importedStatementRowCount: 12,
            duplicateStatementRowCount: 2,
            status: "previewed",
            sourceLabelPresent: true,
            checksumPresent: true,
            matchingProfilePresent: true,
          },
        }),
      ]),
      valid: true,
    });
    const event = auditEvents.events.find(
      (candidate) => candidate.action === "ledger.statement_import_batch.recorded",
    );
    expect(event?.metadata).not.toHaveProperty("sourceLabel");
    expect(event?.metadata).not.toHaveProperty("checksumSha256");
    expect(event?.metadata).not.toHaveProperty("statementRows");
  });

  it("rejects unsafe statement import batch inputs without side effects", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const auditBefore = await repository.listAuditEvents("firm-west-legal");
    const basePayload = {
      accountId: "acct-trust-bank",
      sourceLabel: "Synthetic May trust statement",
      checksumSha256: "a".repeat(64),
      importedStatementRowCount: 12,
      duplicateStatementRowCount: 2,
    };

    const blankSource = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: { ...basePayload, sourceLabel: "   " },
    });
    const invalidChecksum = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: { ...basePayload, checksumSha256: "A".repeat(64) },
    });
    const invalidCounts = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: { ...basePayload, importedStatementRowCount: 1, duplicateStatementRowCount: 2 },
    });
    const invalidStatus = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: { ...basePayload, status: "posted" },
    });
    const operatingAccount = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: { ...basePayload, accountId: "acct-operating-revenue" },
    });
    const missingProfile = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      payload: { ...basePayload, matchingProfileId: "missing-profile" },
    });

    expect(blankSource.statusCode).toBe(400);
    expect(blankSource.json()).toMatchObject({
      error: "Error",
      message: "Statement import batch source label is required",
    });
    expect(invalidChecksum.statusCode).toBe(400);
    expect(invalidChecksum.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(invalidCounts.statusCode).toBe(400);
    expect(invalidCounts.json()).toMatchObject({
      error: "Error",
      message: "Statement import batch duplicate count must fit within row count",
    });
    expect(invalidStatus.statusCode).toBe(400);
    expect(invalidStatus.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(operatingAccount.statusCode).toBe(400);
    expect(operatingAccount.json()).toMatchObject({
      error: "Error",
      message: "Statement import batches require an existing trust asset account",
    });
    expect(missingProfile.statusCode).toBe(400);
    expect(missingProfile.json()).toMatchObject({
      error: "Error",
      message:
        "Statement import batch matching profile must belong to the same trust asset account",
    });
    await expect(
      repository.listLedgerStatementImportBatches("firm-west-legal", {
        accountId: "acct-trust-bank",
      }),
    ).resolves.toEqual([]);
    await expect(repository.listLedgerReconciliations("firm-west-legal")).resolves.toEqual([]);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: auditBefore.events,
      valid: true,
    });
  });

  it("records statement match-rule and accounting review profiles without posting", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await repository.getLedger("firm-west-legal");

    const matchRule = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/match-rule-profiles",
      payload: {
        accountId: "acct-trust-bank",
        name: "  Synthetic trust match profile  ",
        referenceStrategy: "normalized_reference",
        descriptionStrategy: "normalized_contains",
        dateWindowDays: 2,
        amountToleranceCents: 0,
        varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
      },
    });
    const accountingReview = await server.inject({
      method: "POST",
      url: "/api/ledger/accounting-review-profiles",
      payload: {
        accountId: "acct-client-liability",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: true,
          reason: "Synthetic liability account review cue.",
          reviewCadence: "monthly",
        },
        bankFeedImport: {
          status: "not_configured",
        },
        dimensions: {
          vendorTracking: "not_applicable",
          expenseCategoryTracking: "optional",
        },
      },
    });

    expect(matchRule.statusCode).toBe(200);
    expect(matchRule.json()).toMatchObject({
      accountId: "acct-trust-bank",
      name: "Synthetic trust match profile",
      referenceStrategy: "normalized_reference",
      descriptionStrategy: "normalized_contains",
      dateWindowDays: 2,
      amountToleranceCents: 0,
      varianceCategories: ["ledger_entry_expected", "needs_follow_up"],
      reviewerExplanationRequired: true,
      reviewOnly: true,
      createdByUserId: "user-admin",
    });
    expect(accountingReview.statusCode).toBe(200);
    expect(accountingReview.json()).toMatchObject({
      accountId: "acct-client-liability",
      accountType: "client_liability",
      boundaryPosture: "trust_only",
      protectedFunds: {
        protected: true,
        reason: "Synthetic liability account review cue.",
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
    });

    const matchRuleList = await server.inject({
      method: "GET",
      url: "/api/ledger/reconciliations/match-rule-profiles?accountId=acct-trust-bank",
    });
    const accountingReviewList = await server.inject({
      method: "GET",
      url: "/api/ledger/accounting-review-profiles?accountId=acct-client-liability",
    });
    expect(matchRuleList.statusCode).toBe(200);
    expect(matchRuleList.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Synthetic trust match profile" })]),
    );
    expect(accountingReviewList.statusCode).toBe(200);
    expect(accountingReviewList.json()).toEqual([
      expect.objectContaining({ accountId: "acct-client-liability" }),
    ]);
    await expect(repository.getLedger("firm-west-legal")).resolves.toMatchObject({
      entries: ledgerBefore.entries,
    });
    await expect(repository.listLedgerReconciliations("firm-west-legal")).resolves.toEqual([]);

    const auditEvents = await repository.listAuditEvents("firm-west-legal");
    expect(auditEvents).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.statement_match_rule_profile.recorded",
          resourceType: "ledger_statement_match_rule_profile",
          metadata: expect.objectContaining({
            accountId: "acct-trust-bank",
            varianceCategoryCount: 2,
            reviewOnly: true,
          }),
        }),
        expect.objectContaining({
          action: "ledger.accounting_review_profile.recorded",
          resourceType: "ledger_accounting_review_profile",
          metadata: expect.objectContaining({
            accountId: "acct-client-liability",
            accountType: "client_liability",
            automaticMatching: false,
            clientMatterTracking: "required",
            reviewOnly: true,
          }),
        }),
      ]),
      valid: true,
    });
    const accountingEvent = auditEvents.events.find(
      (candidate) => candidate.action === "ledger.accounting_review_profile.recorded",
    );
    expect(accountingEvent?.metadata).not.toHaveProperty("sourceLabel");
    expect(accountingEvent?.metadata).not.toHaveProperty("protectedFundsReason");
    expect(accountingEvent?.metadata).not.toHaveProperty("notes");
  });

  it("rejects unsafe statement match-rule and accounting review profile inputs", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const auditBefore = await repository.listAuditEvents("firm-west-legal");

    const operatingMatchProfile = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/match-rule-profiles",
      payload: {
        accountId: "acct-operating-revenue",
        name: "Synthetic operating match profile",
        referenceStrategy: "normalized_reference",
        descriptionStrategy: "normalized_contains",
        dateWindowDays: 2,
        amountToleranceCents: 0,
        varianceCategories: ["ledger_entry_expected"],
      },
    });
    const automaticMatching = await server.inject({
      method: "POST",
      url: "/api/ledger/accounting-review-profiles",
      payload: {
        accountId: "acct-trust-bank",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: true,
          reason: "Synthetic trust account review cue.",
          reviewCadence: "monthly",
        },
        bankFeedImport: {
          status: "metadata_only",
          sourceLabel: "Synthetic trust statement export",
          automaticMatching: true,
        },
        dimensions: {
          vendorTracking: "not_applicable",
          expenseCategoryTracking: "optional",
        },
      },
    });
    const missingSourceLabel = await server.inject({
      method: "POST",
      url: "/api/ledger/accounting-review-profiles",
      payload: {
        accountId: "acct-trust-bank",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: true,
          reason: "Synthetic trust account review cue.",
          reviewCadence: "monthly",
        },
        bankFeedImport: {
          status: "metadata_only",
        },
        dimensions: {
          vendorTracking: "not_applicable",
          expenseCategoryTracking: "optional",
        },
      },
    });
    const invalidBoundary = await server.inject({
      method: "POST",
      url: "/api/ledger/accounting-review-profiles",
      payload: {
        accountId: "acct-operating-revenue",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: false,
          reviewCadence: "monthly",
        },
        bankFeedImport: {
          status: "not_configured",
        },
        dimensions: {
          vendorTracking: "optional",
          expenseCategoryTracking: "required",
        },
      },
    });

    expect(operatingMatchProfile.statusCode).toBe(400);
    expect(operatingMatchProfile.json()).toMatchObject({
      error: "Error",
      message: "Statement match-rule profiles require an existing trust asset account",
    });
    expect(automaticMatching.statusCode).toBe(400);
    expect(automaticMatching.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(missingSourceLabel.statusCode).toBe(400);
    expect(missingSourceLabel.json()).toMatchObject({
      error: "Error",
      message: "Accounting bank-feed shell records require a source label",
    });
    expect(invalidBoundary.statusCode).toBe(400);
    expect(invalidBoundary.json()).toMatchObject({
      error: "Error",
      message: "Accounting review boundary posture must match the account type or require review",
    });
    await expect(
      repository.listLedgerAccountingReviewProfiles("firm-west-legal", {
        accountId: "acct-client-liability",
      }),
    ).resolves.toEqual([]);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: auditBefore.events,
      valid: true,
    });
  });

  it("records reconciliation exception resolution decisions without posting or reconciling", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await repository.getLedger("firm-west-legal");
    const response = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliation-exception-resolutions",
      payload: {
        accountId: "acct-trust-bank",
        statementRow: {
          id: "statement-import-unmatched",
          postedAt: "2026-04-29T17:00:00.000Z",
          description: "Synthetic unresolved service charge",
          amountCents: -125,
          reference: "synthetic-bank-reference",
          reviewDecision: "unmatched",
        },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note: confirm whether a ledger entry is still expected.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      accountId: "acct-trust-bank",
      statementRow: {
        id: "statement-import-unmatched",
        reviewDecision: "unmatched",
        duplicateKey:
          "2026-04-29|-125|synthetic unresolved service charge|synthetic-bank-reference",
      },
      varianceDecision: "needs_follow_up",
      resolutionNote: "Synthetic staff note: confirm whether a ledger entry is still expected.",
      recordedByUserId: "user-admin",
    });
    const listResponse = await server.inject({
      method: "GET",
      url: "/api/ledger/reconciliation-exception-resolutions?accountId=acct-trust-bank",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject([
      {
        accountId: "acct-trust-bank",
        statementRow: { id: "statement-import-unmatched", reviewDecision: "unmatched" },
        varianceDecision: "needs_follow_up",
      },
    ]);
    await expect(
      repository.listLedgerReconciliationExceptionResolutions("firm-west-legal", {
        accountId: "acct-trust-bank",
      }),
    ).resolves.toHaveLength(1);
    await expect(repository.getLedger("firm-west-legal")).resolves.toMatchObject({
      entries: ledgerBefore.entries,
    });
    await expect(repository.listLedgerReconciliations("firm-west-legal")).resolves.toEqual([]);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "ledger.reconciliation_exception_resolution.recorded",
          resourceType: "ledger_reconciliation_exception_resolution",
          metadata: {
            accountId: "acct-trust-bank",
            statementRowId: "statement-import-unmatched",
            varianceDecision: "needs_follow_up",
            resolutionNotePresent: true,
          },
        }),
      ]),
      valid: true,
    });
  });

  it("rejects unsafe reconciliation exception resolution inputs without side effects", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const auditBefore = await repository.listAuditEvents("firm-west-legal");
    const basePayload = {
      accountId: "acct-trust-bank",
      statementRow: {
        id: "statement-import-unmatched",
        postedAt: "2026-04-29T17:00:00.000Z",
        description: "Synthetic unresolved service charge",
        amountCents: -125,
        reviewDecision: "unmatched",
      },
      varianceDecision: "needs_follow_up",
      resolutionNote: "Synthetic staff note for later ledger review.",
    };

    const matchedRow = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliation-exception-resolutions",
      payload: {
        ...basePayload,
        statementRow: { ...basePayload.statementRow, reviewDecision: "matched" },
      },
    });
    const whitespaceNote = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliation-exception-resolutions",
      payload: { ...basePayload, resolutionNote: "   " },
    });
    const operatingAccount = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliation-exception-resolutions",
      payload: { ...basePayload, accountId: "acct-operating-revenue" },
    });

    expect(matchedRow.statusCode).toBe(400);
    expect(matchedRow.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(whitespaceNote.statusCode).toBe(400);
    expect(whitespaceNote.json()).toMatchObject({
      error: "Error",
      message: "Reconciliation exception resolution note is required",
    });
    expect(operatingAccount.statusCode).toBe(400);
    expect(operatingAccount.json()).toMatchObject({
      error: "Error",
      message: "Reconciliation exception resolutions require an existing trust asset account",
    });
    await expect(
      repository.listLedgerReconciliationExceptionResolutions("firm-west-legal", {
        accountId: "acct-trust-bank",
      }),
    ).resolves.toEqual([]);
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
    const importBatch = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/import-batches",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        accountId: "acct-trust-bank",
        sourceLabel: "Synthetic May trust statement",
        checksumSha256: "a".repeat(64),
        importedStatementRowCount: 1,
        duplicateStatementRowCount: 0,
      },
    });
    const importBatchList = await server.inject({
      method: "GET",
      url: "/api/ledger/reconciliations/import-batches?accountId=acct-trust-bank",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const matchRuleProfile = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations/match-rule-profiles",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        accountId: "acct-trust-bank",
        name: "Synthetic trust match profile",
        referenceStrategy: "normalized_reference",
        descriptionStrategy: "normalized_contains",
        dateWindowDays: 2,
        amountToleranceCents: 0,
        varianceCategories: ["ledger_entry_expected"],
      },
    });
    const matchRuleProfileList = await server.inject({
      method: "GET",
      url: "/api/ledger/reconciliations/match-rule-profiles?accountId=acct-trust-bank",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const accountingReviewProfile = await server.inject({
      method: "POST",
      url: "/api/ledger/accounting-review-profiles",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        accountId: "acct-client-liability",
        boundaryPosture: "trust_only",
        protectedFunds: {
          protected: true,
          reason: "Synthetic liability account review cue.",
          reviewCadence: "monthly",
        },
        bankFeedImport: {
          status: "not_configured",
        },
        dimensions: {
          vendorTracking: "not_applicable",
          expenseCategoryTracking: "optional",
        },
      },
    });
    const accountingReviewProfileList = await server.inject({
      method: "GET",
      url: "/api/ledger/accounting-review-profiles?accountId=acct-client-liability",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const exceptionResolution = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliation-exception-resolutions",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: {
        accountId: "acct-trust-bank",
        statementRow: {
          id: "statement-import-unmatched",
          postedAt: "2026-04-29T17:00:00.000Z",
          description: "Synthetic unresolved service charge",
          amountCents: -125,
          reviewDecision: "unmatched",
        },
        varianceDecision: "needs_follow_up",
        resolutionNote: "Synthetic staff note for later ledger review.",
      },
    });
    const exceptionResolutionList = await server.inject({
      method: "GET",
      url: "/api/ledger/reconciliation-exception-resolutions?accountId=acct-trust-bank",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
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
    expect(importBatch.statusCode).toBe(403);
    expect(importBatch.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(importBatchList.statusCode).toBe(403);
    expect(importBatchList.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(matchRuleProfile.statusCode).toBe(403);
    expect(matchRuleProfile.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(matchRuleProfileList.statusCode).toBe(403);
    expect(matchRuleProfileList.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(accountingReviewProfile.statusCode).toBe(403);
    expect(accountingReviewProfile.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(accountingReviewProfileList.statusCode).toBe(403);
    expect(accountingReviewProfileList.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(exceptionResolution.statusCode).toBe(403);
    expect(exceptionResolution.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Trust ledger access required",
    });
    expect(exceptionResolutionList.statusCode).toBe(403);
    expect(exceptionResolutionList.json()).toMatchObject({
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
