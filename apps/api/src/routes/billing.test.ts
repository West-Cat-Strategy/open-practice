import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function fakeReportQueue(
  jobs: Array<{ name: string; data: unknown; jobId?: string }> = [],
): NonNullable<CreateServerOptions["reportJobQueue"]> {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "report-job" };
    },
  };
}

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    webAuthn: {
      rpName: "Test RP",
      rpID: "localhost",
      origin: "http://localhost:3000",
    },
    ...overrides,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function auditEvents(repository: InMemoryOpenPracticeRepository) {
  return (await repository.listAuditEvents("firm-west-legal")).events;
}

type SyntheticLedgerOptions = {
  id?: string;
  idempotencyKey?: string;
  matterId?: string;
  clientId?: string;
  amountCents?: number;
};

async function postSyntheticTrustTransferLedger(
  repository: InMemoryOpenPracticeRepository,
  {
    id = "trust-transfer-link-route-posting",
    idempotencyKey = `${id}-key`,
    matterId = "matter-001",
    clientId = "contact-ada",
    amountCents = 13230,
  }: SyntheticLedgerOptions = {},
) {
  return repository.postLedgerTransaction({
    id,
    firmId: "firm-west-legal",
    idempotencyKey,
    postedByUserId: "user-admin",
    postedAt: "2026-04-24T12:00:00.000Z",
    entries: [
      {
        firmId: "firm-west-legal",
        matterId,
        clientId,
        accountId: "acct-client-liability",
        debitCents: amountCents,
        creditCents: 0,
        memo: "Synthetic trust transfer request link",
      },
      {
        firmId: "firm-west-legal",
        matterId,
        clientId,
        accountId: "acct-trust-bank",
        debitCents: 0,
        creditCents: amountCents,
        memo: "Synthetic trust transfer request link",
      },
    ],
  });
}

async function postSyntheticTrustRetainerLedger(
  repository: InMemoryOpenPracticeRepository,
  {
    id = "trust-transfer-link-route-retainer",
    idempotencyKey = `${id}-key`,
    matterId = "matter-001",
    clientId = "contact-ada",
    amountCents = 13230,
  }: SyntheticLedgerOptions = {},
) {
  return repository.postLedgerTransaction({
    id,
    firmId: "firm-west-legal",
    idempotencyKey,
    postedByUserId: "user-admin",
    postedAt: "2026-04-24T11:00:00.000Z",
    entries: [
      {
        firmId: "firm-west-legal",
        matterId,
        clientId,
        accountId: "acct-trust-bank",
        debitCents: amountCents,
        creditCents: 0,
        memo: "Synthetic trust retainer for link validation",
      },
      {
        firmId: "firm-west-legal",
        matterId,
        clientId,
        accountId: "acct-client-liability",
        debitCents: 0,
        creditCents: amountCents,
        memo: "Synthetic trust retainer for link validation",
      },
    ],
  });
}

describe("billing routes", () => {
  it("returns legacy top-level error shape for invalid billing requests", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        matterId: "matter-001",
        minutes: 0,
        rateCents: 18000,
        narrative: "Draft invoice review.",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Invalid request body",
    });
    expect(response.json()).not.toHaveProperty("success");
  });

  it("keeps unauthorized matter access at 403", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/time-entries?matterId=matter-002",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      message: "Time entry access required",
    });
  });

  it("denies non-billing roles from the billing dashboard", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/billing/dashboard",
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

  it("returns the direct payload shape for successful migrated routes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({ repository }).inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-route-test",
        matterId: "matter-001",
        minutes: 45,
        rateCents: 18000,
        narrative: "Prepare billing route extraction test.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "time-route-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      userId: "user-admin",
      minutes: 45,
      rateCents: 18000,
      narrative: "Prepare billing route extraction test.",
      billable: true,
      billingStatus: "draft",
    });
    expect(response.json()).not.toHaveProperty("success");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "time_entry.created",
          resourceType: "time_entry",
          resourceId: "time-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            timeEntryId: "time-route-test",
            status: "draft",
            minutes: 45,
            rateCents: 18000,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("creates a draft invoice from approved billing dashboard sources without trust ledger postings", async () => {
    const server = testServer();
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;

    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-dashboard-draft-invoice",
        matterId: "matter-001",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic dashboard invoice preparation.",
        billingStatus: "approved",
      },
    });
    const expense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-dashboard-draft-invoice",
        matterId: "matter-001",
        amountCents: 1200,
        category: "Courier",
        description: "Synthetic courier disbursement.",
        billingStatus: "approved",
      },
    });
    const dashboardBefore = await server.inject({
      method: "GET",
      url: "/api/billing/dashboard",
    });

    expect(time.statusCode).toBe(200);
    expect(expense.statusCode).toBe(200);
    expect(
      dashboardBefore
        .json<{
          matters: Array<{
            matterId: string;
            unbilledTime: Array<{ id: string }>;
            unbilledExpenses: Array<{ id: string }>;
          }>;
        }>()
        .matters.find((matter) => matter.matterId === "matter-001"),
    ).toMatchObject({
      unbilledTime: expect.arrayContaining([
        expect.objectContaining({ id: "time-dashboard-draft-invoice" }),
      ]),
      unbilledExpenses: expect.arrayContaining([
        expect.objectContaining({ id: "expense-dashboard-draft-invoice" }),
      ]),
    });

    const invoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-dashboard-draft",
        matterId: "matter-001",
        clientContactId: "contact-ada",
        timeEntryIds: ["time-dashboard-draft-invoice"],
        expenseEntryIds: ["expense-dashboard-draft-invoice"],
        taxRateBps: 0,
      },
    });
    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });

    expect(invoice.statusCode).toBe(200);
    expect(invoice.json()).toMatchObject({
      id: "invoice-dashboard-draft",
      status: "draft",
      totalCents: 10200,
      balanceDueCents: 10200,
      lines: expect.arrayContaining([
        expect.objectContaining({ timeEntryId: "time-dashboard-draft-invoice", taxRateBps: 0 }),
        expect.objectContaining({
          expenseEntryId: "expense-dashboard-draft-invoice",
          taxRateBps: 0,
        }),
      ]),
    });
    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);
  });

  it("keeps trust transfer request creation review-gated and unlinked", async () => {
    const server = testServer();

    const bypass = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-create-bypass-route",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: 1000,
        status: "linked",
        reviewedByUserId: "user-admin",
        ledgerTransactionId: "trust-retainer",
      },
    });
    expect(bypass.statusCode).toBe(400);
    expect(bypass.json()).toMatchObject({ message: "Invalid request body" });

    const valid = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-create-route",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: 1000,
        evidence: { syntheticRequest: true },
      },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toMatchObject({
      id: "trust-transfer-create-route",
      status: "pending_approval",
      clientContactId: "contact-ada",
      requestedByUserId: "user-admin",
      evidence: { syntheticRequest: true },
    });
    expect(valid.json()).not.toHaveProperty("reviewedByUserId");
    expect(valid.json()).not.toHaveProperty("ledgerTransactionId");

    const mismatchedClient = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-create-client-mismatch",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-river",
        amountCents: 1000,
      },
    });
    expect(mismatchedClient.statusCode).toBe(400);
    expect(mismatchedClient.json()).toMatchObject({
      message: "Trust transfer request client must match the invoice client",
    });

    const highAmountRequest = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-create-high-amount",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: 13231,
      },
    });
    expect(highAmountRequest.statusCode).toBe(200);
    expect(highAmountRequest.json()).toMatchObject({
      id: "trust-transfer-create-high-amount",
      status: "pending_approval",
      amountCents: 13231,
    });
  });

  it("requires trust ledger approval for trust transfer review and link routes", async () => {
    const server = testServer();

    for (const request of [
      {
        url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
        payload: {},
      },
      {
        url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/reject",
        payload: {},
      },
      {
        url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
        payload: { ledgerTransactionId: "trust-retainer" },
      },
    ]) {
      const response = await server.inject({
        method: "POST",
        url: request.url,
        headers: {
          "x-open-practice-user-id": "user-staff",
          "x-open-practice-firm-id": "firm-west-legal",
        },
        payload: request.payload,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ message: "Trust ledger access required" });
    }
  });

  it("approves pending trust transfer requests without linking or posting ledger entries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await repository.getLedger("firm-west-legal");

    const response = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
      payload: { evidence: { syntheticReview: true } },
    });
    const ledgerAfter = await repository.getLedger("firm-west-legal");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "trust-transfer-request-001",
      status: "approved",
      reviewedByUserId: "user-admin",
      evidence: { syntheticReview: true },
    });
    expect(response.json()).not.toHaveProperty("ledgerTransactionId");
    expect(ledgerAfter.entries).toHaveLength(ledgerBefore.entries.length);
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "trust_transfer_request.approved",
          resourceId: "trust-transfer-request-001",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-001",
            previousStatus: "pending_approval",
            status: "approved",
            amountCents: 13230,
            evidencePresent: true,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("rejects trust transfer approval when invoice or trust balances no longer cover the request", async () => {
    const invoiceRepository = new InMemoryOpenPracticeRepository();
    const invoiceServer = testServer({ repository: invoiceRepository });
    const invoiceBeforePayment = await invoiceServer.inject({
      method: "GET",
      url: "/api/invoices/invoice-001",
    });
    const paymentAmountCents =
      invoiceBeforePayment.json<{ balanceDueCents: number }>().balanceDueCents - 13229;
    expect(paymentAmountCents).toBeGreaterThan(0);
    const payment = await invoiceServer.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-before-trust-transfer-approval",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: paymentAmountCents,
        method: "eft",
      },
    });
    expect(payment.statusCode).toBe(200);
    const overInvoiceBalance = await invoiceServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
    });
    expect(overInvoiceBalance.statusCode).toBe(409);
    expect(overInvoiceBalance.json()).toMatchObject({
      message: "Trust transfer amount exceeds invoice balance due",
    });

    const trustRepository = new InMemoryOpenPracticeRepository();
    const trustServer = testServer({ repository: trustRepository });
    await postSyntheticTrustTransferLedger(trustRepository, {
      id: "trust-transfer-balance-reduction",
      amountCents: 140000,
    });
    const overTrustBalance = await trustServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
    });
    expect(overTrustBalance.statusCode).toBe(409);
    expect(overTrustBalance.json()).toMatchObject({
      message: "Trust transfer amount exceeds available trust balance",
    });
  });

  it("rejects pending trust transfer requests without posting or linking ledger entries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const create = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-reject-route",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: 1000,
      },
    });
    const ledgerBefore = await repository.getLedger("firm-west-legal");
    const reject = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-reject-route/reject",
      payload: { evidence: { syntheticDecision: true } },
    });
    const ledgerAfter = await repository.getLedger("firm-west-legal");

    expect(create.statusCode).toBe(200);
    expect(reject.statusCode).toBe(200);
    expect(reject.json()).toMatchObject({
      id: "trust-transfer-reject-route",
      status: "rejected",
      reviewedByUserId: "user-admin",
      evidence: { syntheticDecision: true },
    });
    expect(reject.json()).not.toHaveProperty("ledgerTransactionId");
    expect(ledgerAfter.entries).toHaveLength(ledgerBefore.entries.length);
  });

  it("links approved trust transfer requests to matching posted ledger transactions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const approve = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
    });
    await postSyntheticTrustTransferLedger(repository);
    const link = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      payload: {
        ledgerTransactionId: "trust-transfer-link-route-posting",
        evidence: { syntheticLink: true },
      },
    });

    expect(approve.statusCode).toBe(200);
    expect(link.statusCode).toBe(200);
    expect(link.json()).toMatchObject({
      id: "trust-transfer-request-001",
      status: "linked",
      reviewedByUserId: "user-admin",
      ledgerTransactionId: "trust-transfer-link-route-posting",
      evidence: { syntheticLink: true },
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "trust_transfer_request.linked",
          resourceId: "trust-transfer-request-001",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-001",
            ledgerTransactionId: "trust-transfer-link-route-posting",
            previousStatus: "approved",
            status: "linked",
            amountCents: 13230,
            evidencePresent: true,
          }),
        }),
      ]),
      valid: true,
    });

    const duplicateRequest = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-duplicate-ledger-route",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: 13230,
      },
    });
    const duplicateApproval = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-duplicate-ledger-route/approve",
    });
    const duplicateLink = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-duplicate-ledger-route/link",
      payload: { ledgerTransactionId: "trust-transfer-link-route-posting" },
    });

    expect(duplicateRequest.statusCode).toBe(200);
    expect(duplicateApproval.statusCode).toBe(200);
    expect(duplicateLink.statusCode).toBe(409);
    expect(duplicateLink.json()).toMatchObject({
      message: "Ledger transaction is already linked to a trust transfer request",
    });
  });

  it("rejects trust transfer review and link lifecycle violations", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const unauthorized = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    const linkBeforeApproval = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      payload: { ledgerTransactionId: "trust-retainer" },
    });
    const approve = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
    });
    const approveAgain = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
    });
    await postSyntheticTrustRetainerLedger(repository, {
      id: "trust-transfer-wrong-matter-retainer",
      matterId: "matter-002",
      clientId: "contact-northstar",
    });
    await postSyntheticTrustTransferLedger(repository, {
      id: "trust-transfer-wrong-matter-posting",
      matterId: "matter-002",
      clientId: "contact-northstar",
    });
    const wrongMatterLink = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      payload: { ledgerTransactionId: "trust-transfer-wrong-matter-posting" },
    });
    const badAmountLink = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      payload: { ledgerTransactionId: "trust-retainer" },
    });
    const crossMatterLink = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { ledgerTransactionId: "trust-transfer-wrong-matter-posting" },
    });

    expect(unauthorized.statusCode).toBe(403);
    expect(linkBeforeApproval.statusCode).toBe(409);
    expect(approve.statusCode).toBe(200);
    expect(approveAgain.statusCode).toBe(409);
    expect(wrongMatterLink.statusCode).toBe(404);
    expect(wrongMatterLink.json()).toMatchObject({
      message: "Ledger transaction was not found",
    });
    expect(badAmountLink.statusCode).toBe(400);
    expect(badAmountLink.json()).toMatchObject({
      message: "Ledger transaction amount must match the request amount",
    });
    expect(crossMatterLink.statusCode).toBe(404);
    expect(crossMatterLink.json()).toMatchObject({
      message: "Ledger transaction was not found",
    });
  });

  it("rejects selected source entries already linked to a non-void invoice", async () => {
    const server = testServer();
    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-duplicate-source",
        matterId: "matter-001",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic duplicate source time.",
        billingStatus: "approved",
      },
    });
    expect(time.statusCode).toBe(200);

    const firstInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-duplicate-source",
        matterId: "matter-001",
        timeEntryIds: ["time-duplicate-source"],
        taxRateBps: 0,
      },
    });
    expect(firstInvoice.statusCode).toBe(200);

    const duplicate = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-duplicate-source-blocked",
        matterId: "matter-001",
        timeEntryIds: ["time-duplicate-source"],
        taxRateBps: 0,
      },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      message: "Selected source entries are already linked to a non-void invoice",
    });

    const voided = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-duplicate-source/void",
    });
    expect(voided.statusCode).toBe(200);

    const replacement = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-duplicate-source-after-void",
        matterId: "matter-001",
        timeEntryIds: ["time-duplicate-source"],
        taxRateBps: 0,
      },
    });
    expect(replacement.statusCode).toBe(200);
    expect(replacement.json()).toMatchObject({
      id: "invoice-duplicate-source-after-void",
      status: "draft",
    });
  });

  it("creates queued async billing export requests with count-only job and audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: Array<{ name: string; data: unknown; jobId?: string }> = [];
    const server = testServer({
      repository,
      reportJobQueue: fakeReportQueue(queuedReports),
    });

    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-async-billing-export",
        matterId: "matter-001",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic private async billing export narrative",
        billingStatus: "approved",
      },
    });
    expect(time.statusCode).toBe(200);

    const created = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      payload: {
        exportKind: "billing",
        matterId: "matter-001",
        idempotencyKey: "billing-export-route-test",
      },
    });

    expect(created.statusCode).toBe(202);
    expect(created.json()).toMatchObject({
      exportRequest: {
        exportKind: "billing",
        matterId: "matter-001",
        status: "queued",
        pollUrl: expect.stringContaining("/api/billing/export-requests/"),
        downloadUrl: expect.stringContaining("/api/billing/export-requests/"),
      },
    });
    const jobId = created.json<{ exportRequest: { jobId: string } }>().exportRequest.jobId;
    expect(queuedReports).toEqual([
      expect.objectContaining({
        name: "billing_export",
        jobId,
        data: expect.objectContaining({
          resourceType: "billing_export",
          resourceId: jobId,
          metadata: expect.objectContaining({
            exportKind: "billing",
            matterId: "matter-001",
            recordCount: expect.any(Number),
            timeEntryCount: expect.any(Number),
          }),
        }),
      }),
    ]);

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: jobId,
      jobName: "billing_export",
      targetResourceType: "billing_export",
      status: "queued",
      metadata: expect.objectContaining({
        exportKind: "billing",
        matterId: "matter-001",
        recordCount: expect.any(Number),
        timeEntryCount: expect.any(Number),
        expenseEntryCount: expect.any(Number),
        invoiceCount: expect.any(Number),
        paymentCount: expect.any(Number),
        enqueueStatus: "queued_for_local_report_worker",
      }),
    });
    const events = await auditEvents(repository);
    const requested = events.find((event) => event.action === "billing_export.requested");
    expect(requested?.metadata).toMatchObject({
      jobId,
      exportKind: "billing",
      matterId: "matter-001",
      recordCount: expect.any(Number),
      timeEntryCount: expect.any(Number),
    });
    const serializedMetadata = JSON.stringify({
      queuedReports,
      job,
      auditMetadata: requested?.metadata,
    });
    expect(serializedMetadata).not.toContain("Synthetic private async billing export narrative");
    expect(serializedMetadata).not.toContain("Reviewed tenancy branch materials");
    expect(serializedMetadata).not.toContain("Initial tenancy dispute invoice");

    const status = await server.inject({
      method: "GET",
      url: `/api/billing/export-requests/${jobId}`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ exportRequest: { jobId, status: "queued" } });

    const earlyDownload = await server.inject({
      method: "GET",
      url: `/api/billing/export-requests/${jobId}/download`,
    });
    expect(earlyDownload.statusCode).toBe(409);
    expect(earlyDownload.json()).toMatchObject({ code: "BILLING_EXPORT_NOT_READY" });
  });

  it("downloads completed async trust exports without persisting ledger detail in metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const created = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      payload: {
        exportKind: "trust",
        matterId: "matter-001",
        idempotencyKey: "trust-export-route-test",
      },
    });

    expect(created.statusCode).toBe(202);
    const jobId = created.json<{ exportRequest: { jobId: string } }>().exportRequest.jobId;
    expect(created.json()).toMatchObject({
      exportRequest: { jobId, exportKind: "trust", matterId: "matter-001", status: "completed" },
    });

    const downloaded = await server.inject({
      method: "GET",
      url: `/api/billing/export-requests/${jobId}/download`,
    });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.json()).toMatchObject({
      exportRequest: { jobId, exportKind: "trust", status: "completed" },
      export: {
        exportKind: "trust",
        matterId: "matter-001",
        counts: {
          trustTransferRequestCount: expect.any(Number),
          ledgerAccountCount: expect.any(Number),
          ledgerEntryCount: expect.any(Number),
        },
        trust: {
          entries: expect.arrayContaining([
            expect.objectContaining({ memo: "Retainer received into pooled trust" }),
          ]),
        },
      },
    });

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    const events = await auditEvents(repository);
    const serializedMetadata = JSON.stringify({
      jobMetadata: job?.metadata,
      auditMetadata: events.find((event) => event.action === "trust_export.requested")?.metadata,
    });
    expect(serializedMetadata).not.toContain("Retainer received into pooled trust");
    expect(serializedMetadata).not.toContain("Client trust liability");
    expect(serializedMetadata).not.toContain("Apply trust funds to issued invoice");
  });

  it("denies async billing export create, status, and download to users without export access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const deniedCreate = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { exportKind: "billing", matterId: "matter-001" },
    });
    expect(deniedCreate.statusCode).toBe(403);

    const created = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      payload: {
        exportKind: "billing",
        matterId: "matter-001",
        idempotencyKey: "billing-export-denial-route-test",
      },
    });
    expect(created.statusCode).toBe(202);
    const jobId = created.json<{ exportRequest: { jobId: string } }>().exportRequest.jobId;

    for (const url of [
      `/api/billing/export-requests/${jobId}`,
      `/api/billing/export-requests/${jobId}/download`,
    ]) {
      const response = await server.inject({
        method: "GET",
        url,
        headers: {
          "x-open-practice-user-id": "user-staff",
          "x-open-practice-firm-id": "firm-west-legal",
        },
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it("records concise audit events for billing mutation routes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-audit-route-test",
        matterId: "matter-001",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic billing audit time entry.",
      },
    });
    expect(time.statusCode).toBe(200);

    const timeUpdate = await server.inject({
      method: "PATCH",
      url: "/api/time-entries/time-audit-route-test",
      payload: { minutes: 45 },
    });
    expect(timeUpdate.statusCode).toBe(200);
    expect(timeUpdate.json()).toMatchObject({ minutes: 45 });

    for (const route of ["submit", "approve"] as const) {
      const response = await server.inject({
        method: "POST",
        url: `/api/time-entries/time-audit-route-test/${route}`,
      });
      expect(response.statusCode).toBe(200);
    }

    const writeOffTime = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-writeoff-audit-route-test",
        matterId: "matter-001",
        minutes: 10,
        rateCents: 18000,
        narrative: "Synthetic write-off time entry.",
      },
    });
    expect(writeOffTime.statusCode).toBe(200);
    const writeOffTimeResponse = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-writeoff-audit-route-test/write-off",
    });
    expect(writeOffTimeResponse.statusCode).toBe(200);

    const expense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-audit-route-test",
        matterId: "matter-001",
        amountCents: 2500,
        category: "Filing",
        description: "Synthetic billing audit expense.",
      },
    });
    expect(expense.statusCode).toBe(200);

    const expenseUpdate = await server.inject({
      method: "PATCH",
      url: "/api/expense-entries/expense-audit-route-test",
      payload: { amountCents: 3000 },
    });
    expect(expenseUpdate.statusCode).toBe(200);
    expect(expenseUpdate.json()).toMatchObject({ amountCents: 3000 });

    for (const route of ["submit", "approve"] as const) {
      const response = await server.inject({
        method: "POST",
        url: `/api/expense-entries/expense-audit-route-test/${route}`,
      });
      expect(response.statusCode).toBe(200);
    }

    const writeOffExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-writeoff-audit-route-test",
        matterId: "matter-001",
        amountCents: 1100,
        category: "Courier",
        description: "Synthetic write-off expense.",
      },
    });
    expect(writeOffExpense.statusCode).toBe(200);
    const writeOffExpenseResponse = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-writeoff-audit-route-test/write-off",
    });
    expect(writeOffExpenseResponse.statusCode).toBe(200);

    const invoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-audit-route-test",
        matterId: "matter-001",
        timeEntryIds: ["time-audit-route-test"],
        expenseEntryIds: ["expense-audit-route-test"],
        taxName: "GST",
        taxRateBps: 500,
      },
    });
    expect(invoice.statusCode).toBe(200);
    expect(invoice.json()).toMatchObject({
      id: "invoice-audit-route-test",
      status: "draft",
      totalCents: 17325,
    });

    const approveInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-audit-route-test/approve",
    });
    expect(approveInvoice.statusCode).toBe(200);

    const issueInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-audit-route-test/issue",
    });
    expect(issueInvoice.statusCode).toBe(200);

    const payment = await server.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-audit-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-audit-route-test",
        amountCents: 2500,
        method: "eft",
        reference: "SYNTH-REF-1",
        notes: "Synthetic operator note.",
      },
    });
    expect(payment.statusCode).toBe(200);

    const trustRequest = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-audit-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-audit-route-test",
        amountCents: 1000,
        reason: "Synthetic trust transfer request.",
      },
    });
    expect(trustRequest.statusCode).toBe(200);
    expect(trustRequest.json()).toMatchObject({
      id: "trust-transfer-audit-route-test",
      status: "pending_approval",
    });
    expect(trustRequest.json()).not.toHaveProperty("ledgerTransactionId");

    const voidInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-void-audit-route-test",
        matterId: "matter-001",
        adjustmentLines: [{ description: "Synthetic fixed fee.", unitAmountCents: 5000 }],
      },
    });
    expect(voidInvoice.statusCode).toBe(200);
    const voidResponse = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-void-audit-route-test/void",
    });
    expect(voidResponse.statusCode).toBe(200);

    const events = await auditEvents(repository);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "time_entry.created",
          resourceId: "time-audit-route-test",
        }),
        expect.objectContaining({
          action: "time_entry.updated",
          resourceId: "time-audit-route-test",
          metadata: expect.objectContaining({ minutes: 45, status: "draft" }),
        }),
        expect.objectContaining({
          action: "time_entry.submitted",
          resourceId: "time-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "draft", status: "submitted" }),
        }),
        expect.objectContaining({
          action: "time_entry.approved",
          resourceId: "time-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "submitted", status: "approved" }),
        }),
        expect.objectContaining({
          action: "time_entry.written_off",
          resourceId: "time-writeoff-audit-route-test",
        }),
        expect.objectContaining({
          action: "expense_entry.created",
          resourceId: "expense-audit-route-test",
        }),
        expect.objectContaining({
          action: "expense_entry.updated",
          resourceId: "expense-audit-route-test",
          metadata: expect.objectContaining({ amountCents: 3000, status: "draft" }),
        }),
        expect.objectContaining({
          action: "expense_entry.submitted",
          resourceId: "expense-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "draft", status: "submitted" }),
        }),
        expect.objectContaining({
          action: "expense_entry.approved",
          resourceId: "expense-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "submitted", status: "approved" }),
        }),
        expect.objectContaining({
          action: "expense_entry.written_off",
          resourceId: "expense-writeoff-audit-route-test",
        }),
        expect.objectContaining({
          action: "invoice.created",
          resourceId: "invoice-audit-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            timeEntryIds: ["time-audit-route-test"],
            expenseEntryIds: ["expense-audit-route-test"],
            totalCents: 17325,
          }),
        }),
        expect.objectContaining({
          action: "invoice.approved",
          resourceId: "invoice-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "draft", status: "approved" }),
        }),
        expect.objectContaining({
          action: "invoice.issued",
          resourceId: "invoice-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "approved", status: "issued" }),
        }),
        expect.objectContaining({
          action: "invoice.voided",
          resourceId: "invoice-void-audit-route-test",
          metadata: expect.objectContaining({ previousStatus: "draft", status: "void" }),
        }),
        expect.objectContaining({
          action: "manual_payment.created",
          resourceId: "payment-audit-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-audit-route-test",
            amountCents: 2500,
            status: "received",
          }),
        }),
        expect.objectContaining({
          action: "trust_transfer_request.created",
          resourceId: "trust-transfer-audit-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-audit-route-test",
            amountCents: 1000,
            status: "pending_approval",
          }),
        }),
      ]),
    );

    const privateMetadataKeys = ["narrative", "description", "memo", "notes", "reason", "evidence"];
    const routeEvents = events.filter((event) =>
      [
        "time_entry.",
        "expense_entry.",
        "invoice.",
        "manual_payment.",
        "trust_transfer_request.",
      ].some((prefix) => event.action.startsWith(prefix)),
    );
    for (const event of routeEvents) {
      expect(Object.keys(event.metadata ?? {})).not.toEqual(
        expect.arrayContaining(privateMetadataKeys),
      );
    }

    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      valid: true,
    });
  });
});
