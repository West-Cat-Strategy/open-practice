import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import {
  defaultPaymentImportDepositMatchReviewBoundary,
  defaultPaymentImportRefundChargebackReviewBoundary,
  defaultPaymentImportReviewBoundary,
  type PaymentImportDepositMatchReviewRecord,
  type PaymentImportRefundChargebackReviewRecord,
  type PaymentImportReviewRecord,
  type PaymentProcessorCheckoutSessionInput,
} from "@open-practice/domain";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
import { hashToken } from "../http/auth-helpers.js";
import { createApiServer } from "../server.js";

const firmId = "firm-west-legal";
const ownerNoAssignmentUserId = "user-payment-import-owner-no-assignment";
const clientExternalUserId = "user-payment-import-client-external";
const financialCommandJwtSecret = "financial-command-fresh-auth-test-secret-at-least-32";
const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
type QueuedReportJob = { name: string; data: unknown; jobId?: string };
let financialCommandSessionCounter = 0;

function futureIso(msFromNow = 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const repository = overrides.repository ?? new InMemoryOpenPracticeRepository();
  const server = createApiServer({
    repository,
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    jwtSecret: financialCommandJwtSecret,
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

function fakeReportQueue(
  jobs: QueuedReportJob[] = [],
): NonNullable<CreateServerOptions["reportJobQueue"]> {
  return {
    async add(name, data, options) {
      jobs.push({ name, data, jobId: options?.jobId });
      return { id: options?.jobId ?? "report-job" };
    },
  };
}

function fakePaymentProcessor(
  calls: PaymentProcessorCheckoutSessionInput[] = [],
  expiresAt = futureIso(),
): NonNullable<CreateServerOptions["paymentProcessorProvider"]> {
  return {
    async createCheckoutSession(input) {
      calls.push(input);
      return {
        provider: "stripe",
        externalSessionId: "cs_test_payment_request_route",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_payment_request_route",
        expiresAt,
        evidence: {
          mode: "checkout_session",
          liveMode: false,
          sessionStatus: "open",
        },
      };
    },
  };
}

function authHeaders(userId: string) {
  return {
    "x-open-practice-user-id": userId,
    "x-open-practice-firm-id": firmId,
  };
}

async function freshAuthHeaders(
  repository: InMemoryOpenPracticeRepository,
  options: {
    userId?: string;
    freshAuthenticatedAt?: string;
  } = {},
) {
  const userId = options.userId ?? "user-admin";
  const index = ++financialCommandSessionCounter;
  const token = `financial-command-session-${index}`;
  const now = new Date().toISOString();
  await repository.createAuthSession({
    id: `financial-command-session-${index}`,
    firmId,
    userId,
    tokenHash: hashToken(token, financialCommandJwtSecret),
    createdAt: now,
    freshAuthenticatedAt: options.freshAuthenticatedAt ?? now,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return { "x-open-practice-session": token };
}

function staleFreshAuthenticatedAt(): string {
  return new Date(Date.now() - 20 * 60 * 1000).toISOString();
}

function authorizationFixtureCase(id: string) {
  const match = authorizationFixtureCases.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing authorization fixture case ${id}`);
  return match;
}

async function seedPaymentImportAuthorizationUsers(
  repository: InMemoryOpenPracticeRepository,
): Promise<void> {
  await repository.createUser({
    id: ownerNoAssignmentUserId,
    firmId,
    displayName: "Synthetic Payment Import Owner",
    email: "payment-import-owner@example.test",
    role: "owner_admin",
    assignedMatterIds: [],
    mfaEnabled: true,
  });
  await repository.createUser({
    id: clientExternalUserId,
    firmId,
    displayName: "Synthetic Payment Import Client",
    email: "payment-import-client@example.test",
    role: "client_external",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  });
}

async function createAuthorizationFixtureUser(input: {
  repository: InMemoryOpenPracticeRepository;
  id: string;
  role: "auditor" | "billing_bookkeeper" | "client_external";
  assignedMatterIds?: string[];
}): Promise<void> {
  await input.repository.createUser({
    id: input.id,
    firmId,
    displayName: `Synthetic ${input.role} authorization fixture`,
    email: `${input.id}@example.test`,
    role: input.role,
    assignedMatterIds: input.assignedMatterIds ?? [],
    mfaEnabled: true,
  });
}

function syntheticExternalEventId(id: string): string {
  return `evt_synthetic_${id.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function paymentImportReviewPayload(input: { id: string; matterId: string }) {
  return {
    id: input.id,
    matterId: input.matterId,
    providerLabel: "synthetic_processor",
    eventFamily: "payment",
    eventStatus: "payment_observed",
    externalEventId: syntheticExternalEventId(input.id),
    amountCents: 5000,
    currency: "CAD",
  };
}

function paymentImportReviewRecord(
  overrides: Partial<PaymentImportReviewRecord> = {},
): PaymentImportReviewRecord {
  const id = overrides.id ?? "payment-import-review-auth-assigned";
  return {
    id,
    firmId,
    matterId: "matter-001",
    providerLabel: "synthetic_processor",
    eventFamily: "payment",
    eventStatus: "payment_observed",
    externalEventId: syntheticExternalEventId(id),
    amountCents: 5000,
    currency: "CAD",
    importedAt: "2026-06-29T12:00:00.000Z",
    importedByUserId: "user-licensee",
    reviewState: "needs_review",
    normalizedEvidenceFingerprint: `synthetic-${id}-fingerprint`,
    boundaries: defaultPaymentImportReviewBoundary(),
    updatedAt: "2026-06-29T12:00:00.000Z",
    ...overrides,
  };
}

function depositMatchReviewRecord(
  overrides: Partial<PaymentImportDepositMatchReviewRecord> = {},
): PaymentImportDepositMatchReviewRecord {
  const id = overrides.id ?? "deposit-match-review-auth-assigned";
  return {
    id,
    firmId,
    matterId: "matter-001",
    paymentImportReviewRecordId: "payment-import-review-auth-assigned",
    candidateManualPaymentId: "manual-payment-auth-assigned",
    decision: "candidate_supported",
    reason: "candidate_evidence_matches",
    importAmountCents: 5000,
    manualPaymentAmountCents: 5000,
    currency: "CAD",
    candidateManualPaymentStatus: "pending_reconciliation",
    reviewerEvidencePresent: true,
    idempotencyKey: `synthetic-${id}-key`,
    decisionFingerprint: `synthetic-${id}-fingerprint`,
    boundaries: defaultPaymentImportDepositMatchReviewBoundary(),
    reviewedByUserId: "user-licensee",
    reviewedAt: "2026-06-29T12:05:00.000Z",
    createdAt: "2026-06-29T12:05:00.000Z",
    ...overrides,
  };
}

function refundChargebackReviewRecord(
  overrides: Partial<PaymentImportRefundChargebackReviewRecord> = {},
): PaymentImportRefundChargebackReviewRecord {
  const id = overrides.id ?? "refund-chargeback-review-auth-assigned";
  return {
    id,
    firmId,
    matterId: "matter-001",
    paymentImportReviewRecordId: "payment-import-review-refund-auth-assigned",
    category: "refund",
    decision: "needs_more_evidence",
    reason: "status_unclear",
    reviewerEvidencePresent: true,
    idempotencyKey: `synthetic-${id}-key`,
    decisionFingerprint: `synthetic-${id}-fingerprint`,
    boundaries: defaultPaymentImportRefundChargebackReviewBoundary(),
    reviewedByUserId: "user-licensee",
    reviewedAt: "2026-06-29T12:06:00.000Z",
    createdAt: "2026-06-29T12:06:00.000Z",
    ...overrides,
  };
}

async function seedDepositMatchAuthorizationTarget(
  repository: InMemoryOpenPracticeRepository,
  input: { recordId: string; manualPaymentId: string; matterId: string; reviewId?: string },
): Promise<void> {
  await repository.createPayment({
    payment: {
      id: input.manualPaymentId,
      firmId,
      matterId: input.matterId,
      receivedAt: "2026-06-29T12:01:00.000Z",
      amountCents: 5000,
      method: "eft",
      status: "pending_reconciliation",
      receivedByUserId: "user-licensee",
      evidence: { source: "synthetic-payment-import-authorization" },
    },
    allocations: [],
  });
  await repository.createPaymentImportReviewRecord(
    paymentImportReviewRecord({
      id: input.recordId,
      matterId: input.matterId,
      eventFamily: "deposit",
      eventStatus: "deposit_observed",
      externalDepositId: `dep_${input.recordId.replace(/[^a-zA-Z0-9]+/g, "_")}`,
      candidateManualPaymentId: input.manualPaymentId,
    }),
  );
  if (input.reviewId) {
    await repository.createPaymentImportDepositMatchReview(
      depositMatchReviewRecord({
        id: input.reviewId,
        matterId: input.matterId,
        paymentImportReviewRecordId: input.recordId,
        candidateManualPaymentId: input.manualPaymentId,
      }),
    );
  }
}

async function seedRefundChargebackAuthorizationTarget(
  repository: InMemoryOpenPracticeRepository,
  input: {
    recordId: string;
    matterId: string;
    eventStatus: "refund_observed" | "chargeback_observed";
    reviewId?: string;
  },
): Promise<void> {
  await repository.createPaymentImportReviewRecord(
    paymentImportReviewRecord({
      id: input.recordId,
      matterId: input.matterId,
      eventFamily: "payment",
      eventStatus: input.eventStatus,
      externalPaymentId: `pay_${input.recordId.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    }),
  );
  if (input.reviewId) {
    await repository.createPaymentImportRefundChargebackReview(
      refundChargebackReviewRecord({
        id: input.reviewId,
        matterId: input.matterId,
        paymentImportReviewRecordId: input.recordId,
        category: input.eventStatus === "chargeback_observed" ? "chargeback" : "refund",
      }),
    );
  }
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

  it("rejects external client users from broad billing aggregates", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createUser({
      id: "user-client-external",
      firmId: "firm-west-legal",
      displayName: "External Client",
      email: "client@example.test",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    });
    const server = testServer({ repository });
    const headers = {
      "x-open-practice-user-id": "user-client-external",
      "x-open-practice-firm-id": "firm-west-legal",
    };

    for (const url of [
      "/api/time-entries",
      "/api/expense-entries",
      "/api/invoices",
      "/api/payments",
      "/api/billing/payment-import-review-records",
      "/api/billing/payment-requests",
      "/api/billing/trust-transfer-requests",
    ]) {
      const response = await server.inject({ method: "GET", url, headers });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        message: "Staff access required",
      });
    }
  });

  it("batches broad staff billing lists over assigned matters only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const listCalls = {
      timeEntries: [] as Array<Parameters<InMemoryOpenPracticeRepository["listTimeEntries"]>[1]>,
      expenseEntries: [] as Array<
        Parameters<InMemoryOpenPracticeRepository["listExpenseEntries"]>[1]
      >,
      invoices: [] as Array<Parameters<InMemoryOpenPracticeRepository["listInvoices"]>[1]>,
      payments: [] as Array<Parameters<InMemoryOpenPracticeRepository["listPayments"]>[1]>,
    };
    const listTimeEntries = repository.listTimeEntries.bind(repository);
    const listExpenseEntries = repository.listExpenseEntries.bind(repository);
    const listInvoices = repository.listInvoices.bind(repository);
    const listPayments = repository.listPayments.bind(repository);
    repository.listTimeEntries = async (firmId, options) => {
      listCalls.timeEntries.push(options);
      return listTimeEntries(firmId, options);
    };
    repository.listExpenseEntries = async (firmId, options) => {
      listCalls.expenseEntries.push(options);
      return listExpenseEntries(firmId, options);
    };
    repository.listInvoices = async (firmId, options) => {
      listCalls.invoices.push(options);
      return listInvoices(firmId, options);
    };
    repository.listPayments = async (firmId, options) => {
      listCalls.payments.push(options);
      return listPayments(firmId, options);
    };

    await repository.createTimeEntry({
      id: "time-assigned-batch-list",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      userId: "user-staff",
      performedAt: "2026-05-01T15:00:00.000Z",
      minutes: 20,
      rateCents: 18000,
      narrative: "Synthetic assigned matter time.",
      billable: true,
      billingStatus: "approved",
    });
    await repository.createTimeEntry({
      id: "time-unassigned-batch-list",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      userId: "user-admin",
      performedAt: "2026-05-01T16:00:00.000Z",
      minutes: 25,
      rateCents: 18000,
      narrative: "Synthetic unassigned matter time.",
      billable: true,
      billingStatus: "approved",
    });
    await repository.createExpenseEntry({
      id: "expense-assigned-batch-list",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      incurredAt: "2026-05-01T17:00:00.000Z",
      amountCents: 1400,
      category: "Courier",
      description: "Synthetic assigned matter expense.",
      reimbursable: true,
      billingStatus: "approved",
    });
    await repository.createExpenseEntry({
      id: "expense-unassigned-batch-list",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      incurredAt: "2026-05-01T18:00:00.000Z",
      amountCents: 1600,
      category: "Courier",
      description: "Synthetic unassigned matter expense.",
      reimbursable: true,
      billingStatus: "approved",
    });
    await repository.createInvoice({
      invoice: {
        id: "invoice-assigned-batch-list",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceNumber: "INV-SYN-BATCH-001",
        status: "issued",
        createdByUserId: "user-staff",
        createdAt: "2026-05-02T12:00:00.000Z",
        subtotalCents: 1000,
        taxCents: 0,
        totalCents: 1000,
        paidCents: 0,
        balanceDueCents: 1000,
      },
      lines: [],
    });
    await repository.createInvoice({
      invoice: {
        id: "invoice-unassigned-batch-list",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        invoiceNumber: "INV-SYN-BATCH-002",
        status: "issued",
        createdByUserId: "user-admin",
        createdAt: "2026-05-02T13:00:00.000Z",
        subtotalCents: 1000,
        taxCents: 0,
        totalCents: 1000,
        paidCents: 0,
        balanceDueCents: 1000,
      },
      lines: [],
    });
    await repository.createPayment({
      payment: {
        id: "payment-assigned-batch-list",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-assigned-batch-list",
        receivedAt: "2026-05-03T12:00:00.000Z",
        amountCents: 250,
        method: "eft",
        status: "pending_reconciliation",
        receivedByUserId: "user-staff",
        evidence: { source: "synthetic-assigned-payment" },
      },
      allocations: [],
    });
    await repository.createPayment({
      payment: {
        id: "payment-unassigned-batch-list",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        invoiceId: "invoice-unassigned-batch-list",
        receivedAt: "2026-05-03T13:00:00.000Z",
        amountCents: 250,
        method: "eft",
        status: "pending_reconciliation",
        receivedByUserId: "user-admin",
        evidence: { source: "synthetic-unassigned-payment" },
      },
      allocations: [],
    });

    const server = testServer({ repository });
    const headers = {
      "x-open-practice-user-id": "user-staff",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const timeEntries = await server.inject({ method: "GET", url: "/api/time-entries", headers });
    const expenseEntries = await server.inject({
      method: "GET",
      url: "/api/expense-entries",
      headers,
    });
    const invoices = await server.inject({ method: "GET", url: "/api/invoices", headers });
    const payments = await server.inject({ method: "GET", url: "/api/payments", headers });

    expect(timeEntries.statusCode).toBe(200);
    expect(expenseEntries.statusCode).toBe(200);
    expect(invoices.statusCode).toBe(200);
    expect(payments.statusCode).toBe(200);
    const timeEntryIds = timeEntries
      .json<{ entries: Array<{ id: string }> }>()
      .entries.map((entry) => entry.id);
    const expenseEntryIds = expenseEntries
      .json<{ entries: Array<{ id: string }> }>()
      .entries.map((entry) => entry.id);
    const invoiceIds = invoices
      .json<{ invoices: Array<{ id: string }> }>()
      .invoices.map((invoice) => invoice.id);
    const paymentIds = payments
      .json<{ payments: Array<{ id: string }> }>()
      .payments.map((payment) => payment.id);
    expect(timeEntryIds).toContain("time-assigned-batch-list");
    expect(timeEntryIds).not.toContain("time-unassigned-batch-list");
    expect(expenseEntryIds).toContain("expense-assigned-batch-list");
    expect(expenseEntryIds).not.toContain("expense-unassigned-batch-list");
    expect(invoiceIds).toContain("invoice-assigned-batch-list");
    expect(invoiceIds).not.toContain("invoice-unassigned-batch-list");
    expect(paymentIds).toContain("payment-assigned-batch-list");
    expect(paymentIds).not.toContain("payment-unassigned-batch-list");
    expect(listCalls.timeEntries).toEqual([{ matterIds: ["matter-001"] }]);
    expect(listCalls.expenseEntries).toEqual([{ matterIds: ["matter-001"] }]);
    expect(listCalls.invoices).toEqual([{ matterIds: ["matter-001"] }]);
    expect(listCalls.payments).toEqual([{ matterIds: ["matter-001"] }]);
  });

  it("matches payment import review list fixtures across firm-wide, assigned, unassigned, and external users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    const fixtureIds = authorizationFixtureCases
      .filter((item) => item.family === "payment_import_review" && item.action === "read")
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "payment-import-review:firm-wide:list-all",
      "payment-import-review:assigned:list-visible",
      "payment-import-review:unassigned:list-hidden",
      "payment-import-review:portal-client:staff-list-denied",
    ]);
    const firmWideCase = authorizationFixtureCase("payment-import-review:firm-wide:list-all");
    const assignedCase = authorizationFixtureCase("payment-import-review:assigned:list-visible");
    const unassignedCase = authorizationFixtureCase("payment-import-review:unassigned:list-hidden");
    const portalCase = authorizationFixtureCase(
      "payment-import-review:portal-client:staff-list-denied",
    );
    await repository.createPaymentImportReviewRecord(
      paymentImportReviewRecord({
        id: assignedCase.resourceId,
        matterId: assignedCase.matterId,
      }),
    );
    await repository.createPaymentImportReviewRecord(
      paymentImportReviewRecord({
        id: firmWideCase.resourceId,
        matterId: unassignedCase.matterId,
      }),
    );
    const server = testServer({ repository });

    const firmWide = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(ownerNoAssignmentUserId),
    });
    expect(firmWide.statusCode).toBe(200);
    expect(
      firmWide.json<{ records: Array<{ id: string }> }>().records.map((item) => item.id),
    ).toEqual(expect.arrayContaining([assignedCase.resourceId, firmWideCase.resourceId]));

    const assigned = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(assignedCase.subjectId),
    });
    expect(assigned.statusCode).toBe(200);
    const assignedIds = assigned
      .json<{ records: Array<{ id: string }> }>()
      .records.map((item) => item.id);
    expect(assignedIds).toContain(assignedCase.resourceId);
    expect(assignedIds).not.toContain(unassignedCase.resourceId);

    const unassigned = await server.inject({
      method: "GET",
      url: `/api/billing/payment-import-review-records?matterId=${unassignedCase.matterId}`,
      headers: authHeaders(unassignedCase.subjectId),
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassigned.json()).toMatchObject({ message: "Expense entry access required" });

    const portalClient = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(clientExternalUserId),
    });
    expect(portalClient.statusCode).toBe(403);
    expect(portalClient.json()).toMatchObject({ message: "Staff access required" });
    expect(portalCase.listVisible).toBe(false);
  });

  it("matches payment import review create fixtures without creating denied records", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    const fixtureIds = authorizationFixtureCases
      .filter((item) => item.family === "payment_import_review" && item.action === "create")
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "payment-import-review:firm-wide:create",
      "payment-import-review:assigned:create",
      "payment-import-review:unassigned:create-denied",
      "payment-import-review:portal-client:create-denied",
    ]);
    const firmWideCase = authorizationFixtureCase("payment-import-review:firm-wide:create");
    const assignedCase = authorizationFixtureCase("payment-import-review:assigned:create");
    const unassignedCase = authorizationFixtureCase(
      "payment-import-review:unassigned:create-denied",
    );
    const portalCase = authorizationFixtureCase(
      "payment-import-review:portal-client:create-denied",
    );
    const server = testServer({ repository });

    const firmWide = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(ownerNoAssignmentUserId),
      payload: paymentImportReviewPayload({
        id: firmWideCase.resourceId!,
        matterId: firmWideCase.matterId!,
      }),
    });
    expect(firmWide.statusCode).toBe(200);
    expect(firmWide.json()).toMatchObject({ record: { id: firmWideCase.resourceId } });

    const assigned = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(assignedCase.subjectId),
      payload: paymentImportReviewPayload({
        id: assignedCase.resourceId!,
        matterId: assignedCase.matterId!,
      }),
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({ record: { id: assignedCase.resourceId } });

    const unassigned = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(unassignedCase.subjectId),
      payload: paymentImportReviewPayload({
        id: unassignedCase.resourceId!,
        matterId: unassignedCase.matterId!,
      }),
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassigned.json()).toMatchObject({ message: "Expense entry access required" });

    const portalClient = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      headers: authHeaders(clientExternalUserId),
      payload: paymentImportReviewPayload({
        id: portalCase.resourceId!,
        matterId: portalCase.matterId!,
      }),
    });
    expect(portalClient.statusCode).toBe(403);
    expect(portalClient.json()).toMatchObject({ message: "Staff access required" });

    const records = await repository.listPaymentImportReviewRecords(firmId);
    const recordIds = records.map((record) => record.id);
    expect(recordIds).toEqual(
      expect.arrayContaining([firmWideCase.resourceId, assignedCase.resourceId]),
    );
    expect(recordIds).not.toContain(unassignedCase.resourceId);
    expect(recordIds).not.toContain(portalCase.resourceId);
  });

  it("matches deposit-match review list fixtures across firm-wide, assigned, unassigned, and external users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    const fixtureIds = authorizationFixtureCases
      .filter(
        (item) => item.family === "payment_import_deposit_match_review" && item.action === "read",
      )
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "deposit-match-review:firm-wide:list-all",
      "deposit-match-review:assigned:list-visible",
      "deposit-match-review:unassigned:list-hidden",
      "deposit-match-review:portal-client:staff-list-denied",
    ]);
    const firmWideCase = authorizationFixtureCase("deposit-match-review:firm-wide:list-all");
    const assignedCase = authorizationFixtureCase("deposit-match-review:assigned:list-visible");
    const unassignedCase = authorizationFixtureCase("deposit-match-review:unassigned:list-hidden");
    await seedDepositMatchAuthorizationTarget(repository, {
      recordId: "payment-import-review-auth-assigned",
      manualPaymentId: "manual-payment-auth-assigned",
      matterId: assignedCase.matterId!,
      reviewId: assignedCase.resourceId,
    });
    await seedDepositMatchAuthorizationTarget(repository, {
      recordId: "payment-import-review-auth-unassigned",
      manualPaymentId: "manual-payment-auth-unassigned",
      matterId: unassignedCase.matterId!,
      reviewId: firmWideCase.resourceId,
    });
    const server = testServer({ repository });

    const firmWide = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-unassigned/deposit-match-reviews",
      headers: authHeaders(ownerNoAssignmentUserId),
    });
    expect(firmWide.statusCode).toBe(200);
    expect(firmWide.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: firmWideCase.resourceId })],
    });

    const assigned = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-assigned/deposit-match-reviews",
      headers: authHeaders(assignedCase.subjectId),
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: assignedCase.resourceId })],
    });

    const unassigned = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-unassigned/deposit-match-reviews",
      headers: authHeaders(unassignedCase.subjectId),
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassigned.json()).toMatchObject({ message: "Expense entry access required" });

    const portalClient = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-assigned/deposit-match-reviews",
      headers: authHeaders(clientExternalUserId),
    });
    expect(portalClient.statusCode).toBe(403);
    expect(portalClient.json()).toMatchObject({ message: "Staff access required" });
  });

  it("matches deposit-match review create fixtures without creating denied decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    const fixtureIds = authorizationFixtureCases
      .filter(
        (item) => item.family === "payment_import_deposit_match_review" && item.action === "create",
      )
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "deposit-match-review:firm-wide:create",
      "deposit-match-review:assigned:create",
      "deposit-match-review:unassigned:create-denied",
      "deposit-match-review:portal-client:create-denied",
    ]);
    const firmWideCase = authorizationFixtureCase("deposit-match-review:firm-wide:create");
    const assignedCase = authorizationFixtureCase("deposit-match-review:assigned:create");
    const unassignedCase = authorizationFixtureCase(
      "deposit-match-review:unassigned:create-denied",
    );
    const portalCase = authorizationFixtureCase("deposit-match-review:portal-client:create-denied");
    await seedDepositMatchAuthorizationTarget(repository, {
      recordId: "payment-import-review-auth-assigned",
      manualPaymentId: "manual-payment-auth-assigned",
      matterId: assignedCase.matterId!,
    });
    await seedDepositMatchAuthorizationTarget(repository, {
      recordId: "payment-import-review-auth-unassigned",
      manualPaymentId: "manual-payment-auth-unassigned",
      matterId: unassignedCase.matterId!,
    });
    const server = testServer({ repository });

    const firmWide = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-unassigned/deposit-match-reviews",
      headers: authHeaders(ownerNoAssignmentUserId),
      payload: {
        id: firmWideCase.resourceId,
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-deposit-match-firm-wide-create",
      },
    });
    expect(firmWide.statusCode).toBe(200);
    expect(firmWide.json()).toMatchObject({
      review: {
        id: firmWideCase.resourceId,
        paymentImportReviewRecordId: "payment-import-review-auth-unassigned",
      },
    });

    const assigned = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-assigned/deposit-match-reviews",
      headers: authHeaders(assignedCase.subjectId),
      payload: {
        id: assignedCase.resourceId,
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-deposit-match-assigned-create",
      },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({
      review: {
        id: assignedCase.resourceId,
        paymentImportReviewRecordId: "payment-import-review-auth-assigned",
      },
    });

    const unassignedCountBefore = (
      await repository.listPaymentImportDepositMatchReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-review-auth-unassigned",
      })
    ).length;
    const unassigned = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-unassigned/deposit-match-reviews",
      headers: authHeaders(unassignedCase.subjectId),
      payload: {
        id: unassignedCase.resourceId,
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-deposit-match-unassigned-denied",
      },
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassigned.json()).toMatchObject({ message: "Expense entry access required" });
    await expect(
      repository.listPaymentImportDepositMatchReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-review-auth-unassigned",
      }),
    ).resolves.toHaveLength(unassignedCountBefore);

    const assignedCountBefore = (
      await repository.listPaymentImportDepositMatchReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-review-auth-assigned",
      })
    ).length;
    const portalClient = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-auth-assigned/deposit-match-reviews",
      headers: authHeaders(clientExternalUserId),
      payload: {
        id: portalCase.resourceId,
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-deposit-match-portal-denied",
      },
    });
    expect(portalClient.statusCode).toBe(403);
    expect(portalClient.json()).toMatchObject({ message: "Staff access required" });
    await expect(
      repository.listPaymentImportDepositMatchReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-review-auth-assigned",
      }),
    ).resolves.toHaveLength(assignedCountBefore);
  });

  it("matches refund/chargeback review list fixtures across firm-wide, assigned, unassigned, and external users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    const fixtureIds = authorizationFixtureCases
      .filter(
        (item) =>
          item.family === "payment_import_refund_chargeback_review" && item.action === "read",
      )
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "refund-chargeback-review:firm-wide:list-all",
      "refund-chargeback-review:assigned:list-visible",
      "refund-chargeback-review:unassigned:list-hidden",
      "refund-chargeback-review:portal-client:staff-list-denied",
      "refund-chargeback-review:auditor:list-visible",
      "refund-chargeback-review:portal-client:list-denied",
    ]);
    const firmWideCase = authorizationFixtureCase("refund-chargeback-review:firm-wide:list-all");
    const assignedCase = authorizationFixtureCase("refund-chargeback-review:assigned:list-visible");
    const unassignedCase = authorizationFixtureCase(
      "refund-chargeback-review:unassigned:list-hidden",
    );
    const portalCase = authorizationFixtureCase(
      "refund-chargeback-review:portal-client:staff-list-denied",
    );
    await seedRefundChargebackAuthorizationTarget(repository, {
      recordId: "payment-import-refund-auth-assigned",
      matterId: assignedCase.matterId!,
      eventStatus: "refund_observed",
      reviewId: assignedCase.resourceId,
    });
    await seedRefundChargebackAuthorizationTarget(repository, {
      recordId: "payment-import-chargeback-auth-unassigned",
      matterId: unassignedCase.matterId!,
      eventStatus: "chargeback_observed",
      reviewId: firmWideCase.resourceId,
    });
    const server = testServer({ repository });

    const firmWide = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-chargeback-auth-unassigned/refund-chargeback-reviews",
      headers: authHeaders(ownerNoAssignmentUserId),
    });
    expect(firmWide.statusCode).toBe(200);
    expect(firmWide.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: firmWideCase.resourceId })],
    });

    const assigned = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-refund-auth-assigned/refund-chargeback-reviews",
      headers: authHeaders(assignedCase.subjectId),
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: assignedCase.resourceId })],
    });

    const unassigned = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-chargeback-auth-unassigned/refund-chargeback-reviews",
      headers: authHeaders(unassignedCase.subjectId),
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassigned.json()).toMatchObject({ message: "Expense entry access required" });
    expect(unassignedCase.listVisible).toBe(false);

    const portalClient = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-refund-auth-assigned/refund-chargeback-reviews",
      headers: authHeaders(clientExternalUserId),
    });
    expect(portalClient.statusCode).toBe(403);
    expect(portalClient.json()).toMatchObject({ message: "Staff access required" });
    expect(portalCase.listVisible).toBe(false);
  });

  it("matches refund/chargeback review create fixtures without creating denied decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    const fixtureIds = authorizationFixtureCases
      .filter(
        (item) =>
          item.family === "payment_import_refund_chargeback_review" && item.action === "create",
      )
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "refund-chargeback-review:firm-wide:create",
      "refund-chargeback-review:assigned:create",
      "refund-chargeback-review:unassigned:create-denied",
      "refund-chargeback-review:auditor:create-denied",
      "refund-chargeback-review:portal-client:create-denied",
    ]);
    const firmWideCase = authorizationFixtureCase("refund-chargeback-review:firm-wide:create");
    const assignedCase = authorizationFixtureCase("refund-chargeback-review:assigned:create");
    const unassignedCase = authorizationFixtureCase(
      "refund-chargeback-review:unassigned:create-denied",
    );
    const portalCase = authorizationFixtureCase(
      "refund-chargeback-review:portal-client:create-denied",
    );
    await seedRefundChargebackAuthorizationTarget(repository, {
      recordId: "payment-import-refund-auth-assigned",
      matterId: assignedCase.matterId!,
      eventStatus: "refund_observed",
    });
    await seedRefundChargebackAuthorizationTarget(repository, {
      recordId: "payment-import-chargeback-auth-unassigned",
      matterId: unassignedCase.matterId!,
      eventStatus: "chargeback_observed",
    });
    const server = testServer({ repository });

    const firmWide = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-chargeback-auth-unassigned/refund-chargeback-reviews",
      headers: authHeaders(ownerNoAssignmentUserId),
      payload: {
        id: firmWideCase.resourceId,
        decision: "exception_confirmed",
        reason: "chargeback_observed",
        idempotencyKey: "synthetic-refund-chargeback-firm-wide-create",
      },
    });
    expect(firmWide.statusCode).toBe(200);
    expect(firmWide.json()).toMatchObject({
      review: {
        id: firmWideCase.resourceId,
        paymentImportReviewRecordId: "payment-import-chargeback-auth-unassigned",
        category: "chargeback",
      },
    });

    const assigned = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-refund-auth-assigned/refund-chargeback-reviews",
      headers: authHeaders(assignedCase.subjectId),
      payload: {
        id: assignedCase.resourceId,
        decision: "exception_confirmed",
        reason: "refund_observed",
        idempotencyKey: "synthetic-refund-chargeback-assigned-create",
      },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({
      review: {
        id: assignedCase.resourceId,
        paymentImportReviewRecordId: "payment-import-refund-auth-assigned",
        category: "refund",
      },
    });

    const unassignedCountBefore = (
      await repository.listPaymentImportRefundChargebackReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-chargeback-auth-unassigned",
      })
    ).length;
    const unassigned = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-chargeback-auth-unassigned/refund-chargeback-reviews",
      headers: authHeaders(unassignedCase.subjectId),
      payload: {
        id: unassignedCase.resourceId,
        decision: "exception_confirmed",
        reason: "chargeback_observed",
        idempotencyKey: "synthetic-refund-chargeback-unassigned-denied",
      },
    });
    expect(unassigned.statusCode).toBe(403);
    expect(unassigned.json()).toMatchObject({ message: "Expense entry access required" });
    await expect(
      repository.listPaymentImportRefundChargebackReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-chargeback-auth-unassigned",
      }),
    ).resolves.toHaveLength(unassignedCountBefore);

    const assignedCountBefore = (
      await repository.listPaymentImportRefundChargebackReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-refund-auth-assigned",
      })
    ).length;
    const portalClient = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-refund-auth-assigned/refund-chargeback-reviews",
      headers: authHeaders(clientExternalUserId),
      payload: {
        id: portalCase.resourceId,
        decision: "exception_confirmed",
        reason: "refund_observed",
        idempotencyKey: "synthetic-refund-chargeback-portal-denied",
      },
    });
    expect(portalClient.statusCode).toBe(403);
    expect(portalClient.json()).toMatchObject({ message: "Staff access required" });
    await expect(
      repository.listPaymentImportRefundChargebackReviews(firmId, {
        paymentImportReviewRecordId: "payment-import-refund-auth-assigned",
      }),
    ).resolves.toHaveLength(assignedCountBefore);
  });

  it("matches refund/chargeback auditor fixtures without granting mutation access", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await seedPaymentImportAuthorizationUsers(repository);
    await createAuthorizationFixtureUser({
      repository,
      id: "user-refund-chargeback-auditor",
      role: "auditor",
    });
    await createAuthorizationFixtureUser({
      repository,
      id: "user-refund-chargeback-client-external",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
    });
    const assignedListCase = authorizationFixtureCase(
      "refund-chargeback-review:assigned:list-visible",
    );
    const auditorListCase = authorizationFixtureCase(
      "refund-chargeback-review:auditor:list-visible",
    );
    const assignedCreateCase = authorizationFixtureCase("refund-chargeback-review:assigned:create");
    const auditorCreateCase = authorizationFixtureCase(
      "refund-chargeback-review:auditor:create-denied",
    );
    const portalListCase = authorizationFixtureCase(
      "refund-chargeback-review:portal-client:list-denied",
    );
    const refundRecordId = auditorListCase.resourceId!;
    await seedRefundChargebackAuthorizationTarget(repository, {
      recordId: refundRecordId,
      matterId: assignedListCase.matterId!,
      eventStatus: "refund_observed",
      reviewId: assignedCreateCase.resourceId,
    });
    const server = testServer({ repository });

    const assignedList = await server.inject({
      method: "GET",
      url: `/api/billing/payment-import-review-records/${refundRecordId}/refund-chargeback-reviews`,
      headers: authHeaders(assignedListCase.subjectId),
    });
    expect(assignedList.statusCode).toBe(200);
    expect(assignedList.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: assignedCreateCase.resourceId })],
    });

    const auditorList = await server.inject({
      method: "GET",
      url: `/api/billing/payment-import-review-records/${refundRecordId}/refund-chargeback-reviews`,
      headers: authHeaders(auditorListCase.subjectId),
    });
    expect(auditorList.statusCode).toBe(200);
    expect(auditorList.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: assignedCreateCase.resourceId })],
    });

    const beforeDeniedCreates = (
      await repository.listPaymentImportRefundChargebackReviews(firmId, {
        paymentImportReviewRecordId: refundRecordId,
      })
    ).length;
    const auditorCreate = await server.inject({
      method: "POST",
      url: `/api/billing/payment-import-review-records/${refundRecordId}/refund-chargeback-reviews`,
      headers: authHeaders(auditorCreateCase.subjectId),
      payload: {
        id: auditorCreateCase.resourceId,
        decision: "exception_confirmed",
        reason: "refund_observed",
        idempotencyKey: "synthetic-refund-chargeback-auth-auditor-denied",
      },
    });
    expect(auditorCreate.statusCode).toBe(403);
    expect(auditorCreate.json()).toMatchObject({ message: "Expense entry access required" });

    const portalList = await server.inject({
      method: "GET",
      url: `/api/billing/payment-import-review-records/${portalListCase.resourceId}/refund-chargeback-reviews`,
      headers: authHeaders(portalListCase.subjectId),
    });
    expect(portalList.statusCode).toBe(403);
    expect(portalList.json()).toMatchObject({ message: "Staff access required" });

    await expect(
      repository.listPaymentImportRefundChargebackReviews(firmId, {
        paymentImportReviewRecordId: refundRecordId,
      }),
    ).resolves.toHaveLength(beforeDeniedCreates);
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

  it("denies non-billing roles from billing period-lock and rate-rule controls", async () => {
    const headers = {
      "x-open-practice-user-id": "user-staff",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const server = testServer();

    for (const request of [
      { method: "GET", url: "/api/billing/period-locks" },
      {
        method: "POST",
        url: "/api/billing/period-locks",
        payload: {
          periodStart: "2026-04-01T00:00:00.000Z",
          periodEnd: "2026-05-01T00:00:00.000Z",
        },
      },
      { method: "GET", url: "/api/billing/rate-rules" },
      {
        method: "POST",
        url: "/api/billing/rate-rules",
        payload: {
          label: "Synthetic denied rate",
          rateCents: 18000,
        },
      },
    ] as const) {
      const response = await server.inject({ ...request, headers });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ message: "Trust ledger access required" });
    }
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

  it("resolves rate rules when rate cents are omitted and preserves manual override snapshots", async () => {
    const server = testServer();

    const rule = await server.inject({
      method: "POST",
      url: "/api/billing/rate-rules",
      payload: {
        id: "billing-rate-matter-user",
        label: "Synthetic matter user rate",
        matterId: "matter-001",
        userId: "user-licensee",
        rateCents: 21000,
        effectiveFrom: "2026-04-01T00:00:00.000Z",
      },
    });
    expect(rule.statusCode).toBe(200);
    expect(rule.json()).toMatchObject({
      id: "billing-rate-matter-user",
      scope: "matter_user",
      rateCents: 21000,
    });

    const resolved = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-rate-rule-resolution",
        matterId: "matter-001",
        userId: "user-licensee",
        performedAt: "2026-04-15T16:00:00.000Z",
        minutes: 60,
        narrative: "Synthetic rate-rule resolved work.",
        billingStatus: "approved",
      },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({
      id: "time-rate-rule-resolution",
      rateCents: 21000,
      rateRuleId: "billing-rate-matter-user",
      rateSnapshot: expect.objectContaining({
        source: "rate_rule",
        rateRuleId: "billing-rate-matter-user",
        label: "Synthetic matter user rate",
        rateCents: 21000,
      }),
    });

    const manual = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-rate-manual-override",
        matterId: "matter-001",
        userId: "user-licensee",
        performedAt: "2026-04-15T17:00:00.000Z",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic manual override work.",
      },
    });
    expect(manual.statusCode).toBe(200);
    expect(manual.json()).toMatchObject({
      id: "time-rate-manual-override",
      rateCents: 18000,
      rateSnapshot: expect.objectContaining({ source: "manual", rateCents: 18000 }),
    });
    expect(manual.json()).not.toHaveProperty("rateRuleId");

    const dashboard = await server.inject({ method: "GET", url: "/api/billing/dashboard" });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      summary: expect.objectContaining({ activeRateRuleCount: 1 }),
      rateRules: [expect.objectContaining({ id: "billing-rate-matter-user" })],
      matters: expect.arrayContaining([
        expect.objectContaining({
          matterId: "matter-001",
          unbilledTime: expect.arrayContaining([
            expect.objectContaining({
              id: "time-rate-rule-resolution",
              rateSnapshot: expect.objectContaining({ source: "rate_rule" }),
            }),
          ]),
        }),
      ]),
    });
  });

  it("rejects omitted rate cents when no active rate rule matches", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-rate-missing-rule",
        matterId: "matter-001",
        performedAt: "2026-04-15T16:00:00.000Z",
        minutes: 15,
        narrative: "Synthetic missing rate rule work.",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: "Rate cents is required when no billing rate rule matches",
    });
  });

  it("guards time and expense mutations inside locked billing periods", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const lock = await server.inject({
      method: "POST",
      url: "/api/billing/period-locks",
      payload: {
        id: "billing-lock-april",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-05-01T00:00:00.000Z",
        reason: "Synthetic April close.",
      },
    });
    expect(lock.statusCode).toBe(200);

    const blockedTimeCreate = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-locked-create",
        matterId: "matter-001",
        performedAt: "2026-04-15T16:00:00.000Z",
        minutes: 30,
        rateCents: 18000,
        narrative: "Synthetic locked time.",
      },
    });
    expect(blockedTimeCreate.statusCode).toBe(409);

    const blockedExpenseCreate = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-locked-create",
        matterId: "matter-001",
        incurredAt: "2026-04-15T16:00:00.000Z",
        amountCents: 1200,
        categoryCode: "courier_postage",
        description: "Synthetic locked expense.",
      },
    });
    expect(blockedExpenseCreate.statusCode).toBe(409);

    await repository.createTimeEntry({
      id: "time-locked-existing",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      userId: "user-admin",
      performedAt: "2026-04-15T16:00:00.000Z",
      minutes: 30,
      rateCents: 18000,
      narrative: "Synthetic existing locked time.",
      billable: true,
      billingStatus: "draft",
    });
    await repository.createTimeEntry({
      id: "time-unlocked-existing",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      userId: "user-admin",
      performedAt: "2026-05-05T16:00:00.000Z",
      minutes: 30,
      rateCents: 18000,
      narrative: "Synthetic existing unlocked time.",
      billable: true,
      billingStatus: "draft",
    });
    await repository.createExpenseEntry({
      id: "expense-locked-existing",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      incurredAt: "2026-04-15T16:00:00.000Z",
      amountCents: 1200,
      category: "Courier",
      description: "Synthetic existing locked expense.",
      reimbursable: true,
      billingStatus: "draft",
    });
    await repository.createExpenseEntry({
      id: "expense-unlocked-existing",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      incurredAt: "2026-05-05T16:00:00.000Z",
      amountCents: 1200,
      category: "Courier",
      description: "Synthetic existing unlocked expense.",
      reimbursable: true,
      billingStatus: "draft",
    });

    const blockedTimeUpdate = await server.inject({
      method: "PATCH",
      url: "/api/time-entries/time-locked-existing",
      payload: { minutes: 45 },
    });
    const blockedTimeMoveOut = await server.inject({
      method: "PATCH",
      url: "/api/time-entries/time-locked-existing",
      payload: { performedAt: "2026-05-05T16:00:00.000Z" },
    });
    const blockedTimeMoveIn = await server.inject({
      method: "PATCH",
      url: "/api/time-entries/time-unlocked-existing",
      payload: { performedAt: "2026-04-15T16:00:00.000Z" },
    });
    const blockedExpenseStatus = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-locked-existing/submit",
    });
    const blockedTimeStatus = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-locked-existing/submit",
    });
    await repository.updateTimeEntry("firm-west-legal", "time-locked-existing", {
      billingStatus: "submitted",
    });
    const blockedTimeApprove = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-locked-existing/approve",
    });
    const blockedExpenseUpdate = await server.inject({
      method: "PATCH",
      url: "/api/expense-entries/expense-locked-existing",
      payload: { amountCents: 1500 },
    });
    const blockedExpenseMoveOut = await server.inject({
      method: "PATCH",
      url: "/api/expense-entries/expense-locked-existing",
      payload: { incurredAt: "2026-05-05T16:00:00.000Z" },
    });
    const blockedExpenseMoveIn = await server.inject({
      method: "PATCH",
      url: "/api/expense-entries/expense-unlocked-existing",
      payload: { incurredAt: "2026-04-15T16:00:00.000Z" },
    });

    expect(blockedTimeUpdate.statusCode).toBe(409);
    expect(blockedTimeMoveOut.statusCode).toBe(409);
    expect(blockedTimeMoveIn.statusCode).toBe(409);
    expect(blockedTimeStatus.statusCode).toBe(409);
    expect(blockedTimeApprove.statusCode).toBe(409);
    expect(blockedTimeApprove.json()).toMatchObject({
      message: expect.stringContaining("locked billing period"),
    });
    expect(blockedExpenseUpdate.statusCode).toBe(409);
    expect(blockedExpenseMoveOut.statusCode).toBe(409);
    expect(blockedExpenseMoveIn.statusCode).toBe(409);
    expect(blockedExpenseStatus.statusCode).toBe(409);

    await repository.updateTimeEntry("firm-west-legal", "time-locked-existing", {
      billingStatus: "approved",
    });
    const invoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-locked-source",
        matterId: "matter-001",
        timeEntryIds: ["time-locked-existing"],
        taxRateBps: 0,
      },
    });
    expect(invoice.statusCode).toBe(200);

    const approve = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-locked-source/approve",
    });
    expect(approve.statusCode).toBe(409);
    expect(approve.json()).toMatchObject({
      message: expect.stringContaining("locked billing period"),
    });

    const dashboard = await server.inject({ method: "GET", url: "/api/billing/dashboard" });
    expect(dashboard.json()).toMatchObject({
      summary: expect.objectContaining({ lockedPeriodCount: 1 }),
      periodLocks: [expect.objectContaining({ id: "billing-lock-april" })],
    });
  });

  it("creates timer and expense-profile drafts as review-only billing capture rows", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const lock = await server.inject({
      method: "POST",
      url: "/api/billing/period-locks",
      payload: {
        id: "billing-lock-timer-capture",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-05-01T00:00:00.000Z",
        reason: "Synthetic closed month.",
      },
    });
    expect(lock.statusCode).toBe(200);

    const blockedTimer = await server.inject({
      method: "POST",
      url: "/api/time-entries/timer-drafts",
      payload: {
        id: "time-timer-locked-window",
        matterId: "matter-001",
        startedAt: "2026-03-31T23:45:00.000Z",
        stoppedAt: "2026-04-01T00:15:00.000Z",
        rateCents: 18000,
        narrative: "Synthetic locked timer capture.",
      },
    });
    expect(blockedTimer.statusCode).toBe(409);
    expect(blockedTimer.json()).toMatchObject({
      message: expect.stringContaining("Timer window overlaps locked billing period"),
    });

    const statusOverride = await server.inject({
      method: "POST",
      url: "/api/time-entries/timer-drafts",
      payload: {
        id: "time-timer-status-override",
        matterId: "matter-001",
        startedAt: "2026-05-05T10:00:00.000Z",
        stoppedAt: "2026-05-05T10:30:00.000Z",
        rateCents: 18000,
        narrative: "Synthetic timer status override.",
        billingStatus: "approved",
      },
    });
    expect(statusOverride.statusCode).toBe(400);

    const timerDraft = await server.inject({
      method: "POST",
      url: "/api/time-entries/timer-drafts",
      payload: {
        id: "time-timer-review-draft",
        matterId: "matter-001",
        startedAt: "2026-05-05T10:00:00.000Z",
        stoppedAt: "2026-05-05T10:44:01.000Z",
        rateCents: 18000,
        narrative: "Synthetic timer-to-draft review.",
      },
    });
    expect(timerDraft.statusCode).toBe(200);
    expect(timerDraft.json()).toMatchObject({
      id: "time-timer-review-draft",
      performedAt: "2026-05-05T10:00:00.000Z",
      minutes: 45,
      billable: true,
      billingStatus: "draft",
      rateSnapshot: expect.objectContaining({ source: "manual", rateCents: 18000 }),
    });

    const nonBillableTimerDraft = await server.inject({
      method: "POST",
      url: "/api/time-entries/timer-drafts",
      payload: {
        id: "time-timer-non-billable-review-draft",
        matterId: "matter-001",
        startedAt: "2026-05-05T12:00:00.000Z",
        stoppedAt: "2026-05-05T12:10:00.000Z",
        rateCents: 18000,
        narrative: "Synthetic private non-billable timer capture.",
        billable: false,
      },
    });
    expect(nonBillableTimerDraft.statusCode).toBe(200);
    expect(nonBillableTimerDraft.json()).toMatchObject({
      id: "time-timer-non-billable-review-draft",
      billable: false,
      billingStatus: "draft",
    });

    const expenseOverride = await server.inject({
      method: "POST",
      url: "/api/expense-entries/review-drafts",
      payload: {
        id: "expense-review-status-override",
        matterId: "matter-001",
        incurredAt: "2026-05-05T11:00:00.000Z",
        amountCents: 4200,
        categoryCode: "filing_service",
        description: "Synthetic filing status override.",
        billingStatus: "approved",
      },
    });
    expect(expenseOverride.statusCode).toBe(400);

    const expenseDraft = await server.inject({
      method: "POST",
      url: "/api/expense-entries/review-drafts",
      payload: {
        id: "expense-review-profile-draft",
        matterId: "matter-001",
        incurredAt: "2026-05-05T11:00:00.000Z",
        amountCents: 4200,
        categoryCode: "filing_service",
        description: "Synthetic filing disbursement for review.",
      },
    });
    expect(expenseDraft.statusCode).toBe(200);
    expect(expenseDraft.json()).toMatchObject({
      id: "expense-review-profile-draft",
      amountCents: 4200,
      category: "Filing and service",
      categoryCode: "filing_service",
      reimbursable: true,
      billingStatus: "draft",
    });

    const nonReimbursableExpenseDraft = await server.inject({
      method: "POST",
      url: "/api/expense-entries/review-drafts",
      payload: {
        id: "expense-review-non-reimbursable-draft",
        matterId: "matter-001",
        incurredAt: "2026-05-05T12:30:00.000Z",
        amountCents: 1900,
        categoryCode: "research_database",
        description: "Synthetic private non-reimbursable expense.",
        reimbursable: false,
      },
    });
    expect(nonReimbursableExpenseDraft.statusCode).toBe(200);
    expect(nonReimbursableExpenseDraft.json()).toMatchObject({
      id: "expense-review-non-reimbursable-draft",
      category: "Research database",
      categoryCode: "research_database",
      reimbursable: false,
      billingStatus: "draft",
    });

    const invoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-review-drafts-blocked",
        matterId: "matter-001",
        timeEntryIds: ["time-timer-review-draft"],
        expenseEntryIds: ["expense-review-profile-draft"],
        taxRateBps: 0,
      },
    });
    expect(invoice.statusCode).toBe(409);
    expect(invoice.json()).toMatchObject({
      message: "Only approved unbilled entries can be invoiced",
    });

    const dashboard = await server.inject({ method: "GET", url: "/api/billing/dashboard" });
    expect(dashboard.statusCode).toBe(200);
    const dashboardBody = dashboard.json<{
      timerDraftPolicy: {
        createsDraftOnly: true;
        autoSubmitEnabled: false;
        autoApproveEnabled: false;
        lockBypassAllowed: false;
      };
      expenseCategoryProfiles: Array<{ key: string; reviewOnly: boolean }>;
      expenseCategories: Array<{ code: string; active: boolean }>;
      matters: Array<{
        matterId: string;
        unbilledTime: Array<{ id: string }>;
        unbilledExpenses: Array<{ id: string }>;
        captureReviewTime: Array<{ id: string; status: string; billable?: boolean }>;
        captureReviewExpenses: Array<{ id: string; status: string }>;
      }>;
    }>();
    expect(dashboardBody.timerDraftPolicy).toEqual({
      createsDraftOnly: true,
      autoSubmitEnabled: false,
      autoApproveEnabled: false,
      lockBypassAllowed: false,
    });
    const matterBilling = dashboardBody.matters.find((matter) => matter.matterId === "matter-001");
    expect(matterBilling).toMatchObject({
      captureReviewTime: expect.arrayContaining([
        expect.objectContaining({ id: "time-timer-review-draft", status: "draft", billable: true }),
        expect.objectContaining({
          id: "time-timer-non-billable-review-draft",
          status: "draft",
          billable: false,
        }),
      ]),
      captureReviewExpenses: expect.arrayContaining([
        expect.objectContaining({ id: "expense-review-profile-draft", status: "draft" }),
        expect.objectContaining({ id: "expense-review-non-reimbursable-draft", status: "draft" }),
      ]),
    });
    expect(matterBilling?.unbilledTime).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "time-timer-review-draft" })]),
    );
    expect(matterBilling?.unbilledExpenses).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "expense-review-profile-draft" })]),
    );
    expect(matterBilling?.unbilledExpenses).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "expense-review-non-reimbursable-draft" }),
      ]),
    );
    expect(dashboardBody.expenseCategoryProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "filing_service", reviewOnly: true }),
      ]),
    );
    expect(dashboardBody.expenseCategories).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "filing_service", active: true })]),
    );
    const serializedAudit = JSON.stringify(await auditEvents(repository));
    expect(serializedAudit).not.toContain("Synthetic private non-billable timer capture");
    expect(serializedAudit).not.toContain("Synthetic private non-reimbursable expense");
  });

  it("manages firm expense categories and validates new expense entry codes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const categories = await server.inject({
      method: "GET",
      url: "/api/billing/expense-categories",
    });
    expect(categories.statusCode).toBe(200);
    expect(categories.json<{ categories: Array<{ code: string }> }>().categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "filing_service" })]),
    );

    const freeTextCreate = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-free-text-rejected",
        matterId: "matter-001",
        amountCents: 900,
        category: "Synthetic legacy free text",
        description: "Synthetic free-text expense attempt.",
      },
    });
    expect(freeTextCreate.statusCode).toBe(400);

    const createdCategory = await server.inject({
      method: "POST",
      url: "/api/billing/expense-categories",
      payload: {
        id: "expense-category-bc-registry",
        code: "bc_registry_fee",
        label: "BC registry fee",
        defaultReimbursable: true,
        reimbursableAllowed: true,
        practiceAreas: ["Residential tenancy"],
        jurisdictions: ["BC"],
        reviewCue: "Synthetic receipt review.",
      },
    });
    expect(createdCategory.statusCode).toBe(200);
    expect(createdCategory.json()).toMatchObject({
      id: "expense-category-bc-registry",
      code: "bc_registry_fee",
      active: true,
    });

    const codedExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-coded-category",
        matterId: "matter-001",
        amountCents: 900,
        categoryCode: "bc_registry_fee",
        description: "Synthetic coded registry fee.",
      },
    });
    expect(codedExpense.statusCode).toBe(200);
    expect(codedExpense.json()).toMatchObject({
      id: "expense-coded-category",
      category: "BC registry fee",
      categoryCode: "bc_registry_fee",
      reimbursable: true,
    });

    const onOnlyCategory = await server.inject({
      method: "POST",
      url: "/api/billing/expense-categories",
      payload: {
        id: "expense-category-on-registry",
        code: "on_registry_fee",
        label: "ON registry fee",
        defaultReimbursable: true,
        reimbursableAllowed: true,
        jurisdictions: ["ON"],
      },
    });
    expect(onOnlyCategory.statusCode).toBe(200);
    const wrongJurisdictionExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-wrong-jurisdiction",
        matterId: "matter-001",
        amountCents: 900,
        categoryCode: "on_registry_fee",
        description: "Synthetic wrong-jurisdiction expense.",
      },
    });
    expect(wrongJurisdictionExpense.statusCode).toBe(400);
    expect(wrongJurisdictionExpense.json()).toMatchObject({
      message: "Expense category is not applicable to this matter",
    });

    const deactivated = await server.inject({
      method: "PATCH",
      url: "/api/billing/expense-categories/expense-category-bc-registry",
      payload: { active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json()).toMatchObject({ active: false });
    const blockedInactiveExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-inactive-category",
        matterId: "matter-001",
        amountCents: 900,
        categoryCode: "bc_registry_fee",
        description: "Synthetic inactive category expense.",
      },
    });
    expect(blockedInactiveExpense.statusCode).toBe(400);
    expect(blockedInactiveExpense.json()).toMatchObject({
      message: "Expense category is inactive",
    });

    const legacyEdit = await server.inject({
      method: "PATCH",
      url: "/api/expense-entries/expense-coded-category",
      payload: { amountCents: 950 },
    });
    expect(legacyEdit.statusCode).toBe(200);
    expect(legacyEdit.json()).toMatchObject({ amountCents: 950, categoryCode: "bc_registry_fee" });

    const serializedAudit = JSON.stringify(await auditEvents(repository));
    expect(serializedAudit).toContain("billing_expense_category.created");
    expect(serializedAudit).toContain("billing_expense_category.updated");
    expect(serializedAudit).not.toContain("Synthetic receipt review.");
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
        categoryCode: "courier_postage",
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

  it("records hosted payment request shells for issued invoices without settlement or trust postings", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;
    const invoiceBefore = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceBefore.statusCode).toBe(200);

    const created = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests",
      payload: {
        id: "payment-request-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: 5000,
        expiresAt: "2026-05-06T17:00:00.000Z",
        delivery: {
          status: "queued",
          channel: "email",
          recipientCount: 1,
          lastAttemptAt: "2026-04-07T17:00:00.000Z",
        },
        reminder: {
          status: "scheduled",
          reminderCount: 0,
          nextReminderAt: "2026-04-21T17:00:00.000Z",
        },
        paymentPlan: {
          status: "offered",
          installmentCount: 3,
          cadence: "monthly",
          startsAt: "2026-05-01T17:00:00.000Z",
          enforcement: "none",
        },
        creditWriteOffPosture: {
          status: "credit_review",
          amountCents: 500,
          reason: "Synthetic courtesy credit review.",
          movement: "none",
        },
        evidence: { source: "synthetic-bill-delivery" },
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      id: "payment-request-route-test",
      invoiceId: "invoice-001",
      status: "ready_to_send",
      amountCents: 5000,
      currency: "CAD",
      hostedPath: "/payments/requests/payment-request-route-test",
      delivery: expect.objectContaining({ status: "queued", channel: "email" }),
      reminder: expect.objectContaining({ status: "scheduled" }),
      paymentPlan: expect.objectContaining({ status: "offered", enforcement: "none" }),
      creditWriteOffPosture: expect.objectContaining({
        status: "credit_review",
        movement: "none",
      }),
      processor: { status: "not_started" },
    });

    const updated = await server.inject({
      method: "PATCH",
      url: "/api/billing/payment-requests/payment-request-route-test",
      payload: {
        status: "sent",
        delivery: {
          status: "sent",
          channel: "email",
          recipientCount: 1,
          deliveredAt: "2026-04-07T17:05:00.000Z",
          lastAttemptAt: "2026-04-07T17:05:00.000Z",
        },
        reminder: {
          status: "scheduled",
          reminderCount: 1,
          lastReminderAt: "2026-04-21T17:00:00.000Z",
          nextReminderAt: "2026-05-01T17:00:00.000Z",
        },
        evidence: { source: "synthetic-delivery-confirmation" },
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: "payment-request-route-test",
      status: "sent",
      delivery: expect.objectContaining({ status: "sent" }),
      reminder: expect.objectContaining({ reminderCount: 1 }),
    });

    const list = await server.inject({
      method: "GET",
      url: "/api/billing/payment-requests?matterId=matter-001",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      requests: expect.arrayContaining([
        expect.objectContaining({
          id: "payment-request-route-test",
          paymentPlan: expect.objectContaining({ enforcement: "none" }),
        }),
      ]),
    });

    const dashboard = await server.inject({ method: "GET", url: "/api/billing/dashboard" });
    const dashboardMatter = dashboard
      .json<{
        matters: Array<{
          matterId: string;
          paymentRequests: Array<{ id: string; evidencePresent: boolean }>;
        }>;
      }>()
      .matters.find((matter) => matter.matterId === "matter-001");
    expect(dashboardMatter?.paymentRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-request-route-test", evidencePresent: true }),
      ]),
    );

    const invoiceAfter = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceAfter.json()).toMatchObject({
      status: invoiceBefore.json<{ status: string }>().status,
      paidCents: invoiceBefore.json<{ paidCents: number }>().paidCents,
      balanceDueCents: invoiceBefore.json<{ balanceDueCents: number }>().balanceDueCents,
    });
    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });
    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);
  });

  it("records manual payments as pending evidence before reconciliation applies invoice allocations", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const invoiceBefore = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceBefore.statusCode).toBe(200);

    const created = await server.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-pending-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: 2500,
        method: "eft",
        reference: "SYNTH-PENDING-1",
        evidence: { source: "synthetic-payment-evidence" },
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      id: "payment-pending-route-test",
      status: "pending_reconciliation",
      allocations: [],
    });

    const invoiceAfterCreate = await server.inject({
      method: "GET",
      url: "/api/invoices/invoice-001",
    });
    expect(invoiceAfterCreate.json()).toMatchObject({
      status: invoiceBefore.json<{ status: string }>().status,
      paidCents: invoiceBefore.json<{ paidCents: number }>().paidCents,
      balanceDueCents: invoiceBefore.json<{ balanceDueCents: number }>().balanceDueCents,
    });

    const dashboardAfterCreate = await server.inject({
      method: "GET",
      url: "/api/billing/dashboard",
    });
    expect(dashboardAfterCreate.statusCode).toBe(200);
    expect(
      dashboardAfterCreate
        .json<{
          matters: Array<{
            payments: Array<{
              id: string;
              status: string;
              evidencePresent?: boolean;
              reconciliationEvidencePresent?: boolean;
            }>;
          }>;
        }>()
        .matters.flatMap((matter) => matter.payments),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "payment-pending-route-test",
          status: "pending_reconciliation",
          evidencePresent: true,
          reconciliationEvidencePresent: false,
        }),
      ]),
    );

    const reconciled = await server.inject({
      method: "POST",
      url: "/api/payments/payment-pending-route-test/reconcile",
      headers: await freshAuthHeaders(repository),
      payload: {
        reconciledAt: "2026-06-16T13:00:00.000Z",
        notes: "Synthetic reviewer note.",
        evidence: { source: "synthetic-reviewer-evidence" },
      },
    });
    expect(reconciled.statusCode).toBe(200);
    expect(reconciled.json()).toMatchObject({
      id: "payment-pending-route-test",
      status: "received",
      reconciledAt: "2026-06-16T13:00:00.000Z",
      reconciledByUserId: "user-admin",
      reconciliationEvidence: { source: "synthetic-reviewer-evidence" },
      allocations: [expect.objectContaining({ invoiceId: "invoice-001", amountCents: 2500 })],
    });

    const invoiceAfterReconcile = await server.inject({
      method: "GET",
      url: "/api/invoices/invoice-001",
    });
    expect(invoiceAfterReconcile.json()).toMatchObject({
      status: "partially_paid",
      paidCents: invoiceBefore.json<{ paidCents: number }>().paidCents + 2500,
      balanceDueCents: invoiceBefore.json<{ balanceDueCents: number }>().balanceDueCents - 2500,
    });

    const secondReconcile = await server.inject({
      method: "POST",
      url: "/api/payments/payment-pending-route-test/reconcile",
      payload: { reconciledAt: "2026-06-16T14:00:00.000Z" },
    });
    expect(secondReconcile.statusCode).toBe(409);
    expect(secondReconcile.json()).toMatchObject({
      message: "Manual payment is not pending reconciliation",
    });

    const overBalance = await server.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-over-balance-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: invoiceAfterReconcile.json<{ balanceDueCents: number }>().balanceDueCents + 1,
        method: "eft",
      },
    });
    expect(overBalance.statusCode).toBe(200);
    const overBalanceReconcile = await server.inject({
      method: "POST",
      url: "/api/payments/payment-over-balance-route-test/reconcile",
      payload: { reconciledAt: "2026-06-16T15:00:00.000Z" },
    });
    expect(overBalanceReconcile.statusCode).toBe(409);
    expect(overBalanceReconcile.json()).toMatchObject({
      message: "Payment allocation exceeds invoice balance",
    });

    const audit = await auditEvents(repository);
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "manual_payment.created",
          resourceId: "payment-pending-route-test",
          metadata: expect.objectContaining({
            status: "pending_reconciliation",
            allocationCount: 0,
            evidencePresent: true,
          }),
        }),
        expect.objectContaining({
          action: "manual_payment.reconciled",
          resourceId: "payment-pending-route-test",
          metadata: expect.objectContaining({
            status: "received",
            allocationCount: 1,
            evidencePresent: true,
          }),
        }),
      ]),
    );
  });

  it("requires a fresh session before reconciling pending manual payments", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const created = await server.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-fresh-auth-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: 1000,
        method: "eft",
      },
    });
    expect(created.statusCode).toBe(200);

    const missingSession = await server.inject({
      method: "POST",
      url: "/api/payments/payment-fresh-auth-route-test/reconcile",
      payload: { reconciledAt: "2026-06-16T13:00:00.000Z" },
    });
    expect(missingSession.statusCode).toBe(403);
    expect(missingSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const staleSession = await server.inject({
      method: "POST",
      url: "/api/payments/payment-fresh-auth-route-test/reconcile",
      headers: await freshAuthHeaders(repository, {
        freshAuthenticatedAt: staleFreshAuthenticatedAt(),
      }),
      payload: { reconciledAt: "2026-06-16T13:05:00.000Z" },
    });
    expect(staleSession.statusCode).toBe(403);
    expect(staleSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const freshSession = await server.inject({
      method: "POST",
      url: "/api/payments/payment-fresh-auth-route-test/reconcile",
      headers: await freshAuthHeaders(repository),
      payload: { reconciledAt: "2026-06-16T13:10:00.000Z" },
    });
    expect(freshSession.statusCode).toBe(200);
    expect(freshSession.json()).toMatchObject({
      id: "payment-fresh-auth-route-test",
      status: "received",
      reconciledByUserId: "user-admin",
    });
  });

  it("creates Stripe checkout sessions for payment request shells without applying settlement", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checkoutCalls: PaymentProcessorCheckoutSessionInput[] = [];
    const checkoutExpiresAt = futureIso();
    const server = testServer({
      repository,
      paymentProcessorProvider: fakePaymentProcessor(checkoutCalls, checkoutExpiresAt),
      publicWebBaseUrl: "https://app.open-practice.test/dashboard",
    });
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;
    const invoiceBefore = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceBefore.statusCode).toBe(200);
    await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests",
      payload: {
        id: "payment-request-stripe-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: 5000,
      },
    });

    const createdSession = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests/payment-request-stripe-route-test/checkout-session",
    });

    expect(createdSession.statusCode).toBe(200);
    expect(createdSession.json()).toMatchObject({
      checkout: {
        provider: "stripe",
        externalSessionId: "cs_test_payment_request_route",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_payment_request_route",
        expiresAt: checkoutExpiresAt,
        reused: false,
      },
      request: {
        id: "payment-request-stripe-route-test",
        processor: {
          status: "checkout_session_created",
          provider: "stripe",
          externalSessionId: "cs_test_payment_request_route",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_payment_request_route",
          expiresAt: checkoutExpiresAt,
        },
      },
    });
    expect(checkoutCalls).toEqual([
      expect.objectContaining({
        amountCents: 5000,
        currency: "CAD",
        hostedPaymentRequestId: "payment-request-stripe-route-test",
        idempotencyKey: "hosted-payment-request:firm-west-legal:payment-request-stripe-route-test",
        successUrl:
          "https://app.open-practice.test/?paymentRequestId=payment-request-stripe-route-test&stripeCheckout=success&stripeSessionId={CHECKOUT_SESSION_ID}",
        cancelUrl:
          "https://app.open-practice.test/?paymentRequestId=payment-request-stripe-route-test&stripeCheckout=cancelled",
        metadata: expect.objectContaining({
          invoiceId: "invoice-001",
          hostedPaymentRequestId: "payment-request-stripe-route-test",
        }),
      }),
    ]);

    const reused = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests/payment-request-stripe-route-test/checkout-session",
    });
    expect(reused.statusCode).toBe(200);
    expect(reused.json()).toMatchObject({
      checkout: {
        reused: true,
        externalSessionId: "cs_test_payment_request_route",
      },
    });
    expect(checkoutCalls).toHaveLength(1);

    const invoiceAfter = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceAfter.json()).toMatchObject({
      status: invoiceBefore.json<{ status: string }>().status,
      paidCents: invoiceBefore.json<{ paidCents: number }>().paidCents,
      balanceDueCents: invoiceBefore.json<{ balanceDueCents: number }>().balanceDueCents,
    });
    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });
    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);

    const checkoutAudit = (await auditEvents(repository)).find(
      (event) => event.action === "hosted_payment_request.checkout_session_created",
    );
    expect(checkoutAudit).toMatchObject({
      resourceType: "hosted_payment_request",
      resourceId: "payment-request-stripe-route-test",
      metadata: expect.objectContaining({
        provider: "stripe",
        checkoutSessionId: "cs_test_payment_request_route",
        checkoutUrlPresent: true,
        processorStatus: "checkout_session_created",
      }),
    });
    expect(checkoutAudit?.metadata).not.toHaveProperty("checkoutUrl");
  });

  it("records settlement event review evidence without applying payment settlement", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const checkoutCalls: PaymentProcessorCheckoutSessionInput[] = [];
    const server = testServer({
      repository,
      paymentProcessorProvider: fakePaymentProcessor(checkoutCalls),
    });
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;
    const invoiceBefore = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests",
      payload: {
        id: "payment-request-settlement-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: 5000,
      },
    });
    await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests/payment-request-settlement-route-test/checkout-session",
    });

    const settlementEvent = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests/payment-request-settlement-route-test/settlement-events",
      payload: {
        provider: "stripe",
        eventType: "checkout_session_completed",
        paymentStatus: "paid",
        externalEventId: "evt_synthetic_settlement_route",
        externalSessionId: "cs_test_payment_request_route",
        amountCents: 5000,
        currency: "CAD",
        observedAt: "2026-06-04T18:00:00.000Z",
        evidenceSummary: "Synthetic private settlement summary must not be stored",
      },
    });

    expect(settlementEvent.statusCode).toBe(200);
    expect(settlementEvent.json()).toMatchObject({
      request: {
        id: "payment-request-settlement-route-test",
        processor: {
          status: "checkout_session_created",
          provider: "stripe",
          externalSessionId: "cs_test_payment_request_route",
          settlementReview: {
            status: "needs_review",
            provider: "stripe",
            eventType: "checkout_session_completed",
            paymentStatus: "paid",
            externalEventId: "evt_synthetic_settlement_route",
            externalSessionId: "cs_test_payment_request_route",
            amountCents: 5000,
            currency: "CAD",
            reviewAction: "staff_reconciliation_review_required",
            invoiceBalanceMutation: "none",
            reconciliationMutation: "none",
            trustPosting: "none",
            webhookBoundary: expect.objectContaining({
              signatureVerified: false,
              rawWebhookBodyStored: false,
              automaticInvoiceMutation: false,
              automaticReconciliation: false,
              trustPosting: false,
            }),
          },
        },
      },
      settlementReview: expect.objectContaining({
        status: "needs_review",
        invoiceBalanceMutation: "none",
        reconciliationMutation: "none",
        trustPosting: "none",
      }),
    });

    const invoiceAfter = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceAfter.json()).toMatchObject({
      status: invoiceBefore.json<{ status: string }>().status,
      paidCents: invoiceBefore.json<{ paidCents: number }>().paidCents,
      balanceDueCents: invoiceBefore.json<{ balanceDueCents: number }>().balanceDueCents,
    });
    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });
    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);

    const audit = (await auditEvents(repository)).find(
      (event) => event.action === "hosted_payment_request.settlement_event_reviewed",
    );
    expect(audit).toMatchObject({
      resourceType: "hosted_payment_request",
      resourceId: "payment-request-settlement-route-test",
      metadata: expect.objectContaining({
        provider: "stripe",
        eventType: "checkout_session_completed",
        paymentStatus: "paid",
        evidenceSummaryPresent: true,
        invoiceBalanceMutation: "none",
        reconciliationMutation: "none",
        trustPosting: "none",
        rawWebhookBodyStored: false,
      }),
    });
    expect(
      JSON.stringify({
        audit: await auditEvents(repository),
        request: await repository.getHostedPaymentRequest(
          "firm-west-legal",
          "payment-request-settlement-route-test",
        ),
      }),
    ).not.toContain("Synthetic private settlement summary");
  });

  it("records payment import review evidence without retaining raw payloads or mutating balances", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;
    const invoiceBefore = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceBefore.statusCode).toBe(200);
    await repository.createPayment({
      payment: {
        id: "payment-import-review-manual-candidate",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        receivedAt: "2026-06-19T16:01:00.000Z",
        amountCents: 5000,
        method: "eft",
        status: "pending_reconciliation",
        receivedByUserId: "user-licensee",
        evidence: { source: "synthetic-payment-import-review" },
      },
      allocations: [],
    });
    await repository.createPayment({
      payment: {
        id: "payment-import-review-cross-matter",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        receivedAt: "2026-06-19T16:02:00.000Z",
        amountCents: 5000,
        method: "eft",
        status: "pending_reconciliation",
        receivedByUserId: "user-licensee",
        evidence: { source: "synthetic-cross-matter-payment-import-review" },
      },
      allocations: [],
    });
    await repository.createPayment({
      payment: {
        id: "payment-import-review-invoice-mismatch",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-synthetic-other",
        receivedAt: "2026-06-19T16:03:00.000Z",
        amountCents: 5000,
        method: "eft",
        status: "pending_reconciliation",
        receivedByUserId: "user-licensee",
        evidence: { source: "synthetic-invoice-mismatch-payment-import-review" },
      },
      allocations: [],
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-route-test",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_import_route",
        externalPaymentId: "pay_synthetic_import_route",
        externalDepositId: "dep_synthetic_import_route",
        amountCents: 5000,
        currency: "CAD",
        observedAt: "2026-06-19T16:00:00.000Z",
        candidateInvoiceId: "invoice-001",
        candidateHostedPaymentRequestId: "payment-request-001",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
      },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({
      record: {
        id: "payment-import-review-route-test",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_import_route",
        externalPaymentId: "pay_synthetic_import_route",
        externalDepositId: "dep_synthetic_import_route",
        amountCents: 5000,
        currency: "CAD",
        candidateInvoiceId: "invoice-001",
        candidateHostedPaymentRequestId: "payment-request-001",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
        reviewState: "needs_review",
        boundaries: {
          rawProviderPayloadRetained: false,
          invoiceBalanceMutation: "none",
          settlementAutomation: false,
          reconciliationMutation: "none",
          refundHandling: "review_only",
          chargebackHandling: "review_only",
          trustPosting: "none",
          providerCommand: "none",
          clientNotification: "none",
          depositMatching: "review_cue_only",
        },
      },
    });

    const repeated = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-route-retry",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_import_route",
        externalPaymentId: "pay_synthetic_import_route",
        externalDepositId: "dep_synthetic_import_route",
        amountCents: 5000,
        currency: "CAD",
        observedAt: "2026-06-19T16:00:00.000Z",
        candidateInvoiceId: "invoice-001",
        candidateHostedPaymentRequestId: "payment-request-001",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
      },
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toMatchObject({
      record: { id: "payment-import-review-route-test" },
    });

    const conflicting = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_import_route",
        externalPaymentId: "pay_synthetic_import_route",
        externalDepositId: "dep_synthetic_import_route",
        amountCents: 5100,
        currency: "CAD",
        observedAt: "2026-06-19T16:00:00.000Z",
        candidateInvoiceId: "invoice-001",
        candidateHostedPaymentRequestId: "payment-request-001",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
      },
    });
    expect(conflicting.statusCode).toBe(409);
    expect(conflicting.json()).toMatchObject({
      code: "IDEMPOTENCY_KEY_CONFLICT",
    });

    const depositMatchReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/deposit-match-reviews",
      payload: {
        id: "deposit-match-review-route-test",
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-deposit-match-review-key",
      },
    });
    expect(depositMatchReview.statusCode).toBe(200);
    expect(depositMatchReview.json()).toMatchObject({
      review: {
        id: "deposit-match-review-route-test",
        paymentImportReviewRecordId: "payment-import-review-route-test",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
        candidateInvoiceId: "invoice-001",
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        importAmountCents: 5000,
        manualPaymentAmountCents: 5000,
        currency: "CAD",
        candidateManualPaymentStatus: "pending_reconciliation",
        reviewerEvidencePresent: true,
        boundaries: {
          rawProviderPayloadRetained: false,
          invoiceBalanceMutation: "none",
          settlementAutomation: false,
          reconciliationMutation: "none",
          refundHandling: "none",
          chargebackHandling: "none",
          trustPosting: "none",
          providerCommand: "none",
          clientNotification: "none",
          depositMatching: "review_decision_only",
        },
      },
    });

    const repeatedDepositMatchReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/deposit-match-reviews",
      payload: {
        id: "deposit-match-review-route-retry",
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-deposit-match-review-key",
      },
    });
    expect(repeatedDepositMatchReview.statusCode).toBe(200);
    expect(repeatedDepositMatchReview.json()).toMatchObject({
      review: { id: "deposit-match-review-route-test" },
    });

    const conflictingDepositMatchReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/deposit-match-reviews",
      payload: {
        decision: "candidate_rejected",
        reason: "amount_mismatch",
        idempotencyKey: "synthetic-deposit-match-review-key",
      },
    });
    expect(conflictingDepositMatchReview.statusCode).toBe(409);
    expect(conflictingDepositMatchReview.json()).toMatchObject({
      code: "IDEMPOTENCY_KEY_CONFLICT",
    });

    const rawDepositMatchReviewRejected = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/deposit-match-reviews",
      payload: {
        decision: "candidate_rejected",
        reason: "amount_mismatch",
        idempotencyKey: "synthetic-raw-deposit-match-review",
        rawPayload: { private: "Synthetic private deposit review payload" },
      },
    });
    expect(rawDepositMatchReviewRejected.statusCode).toBe(400);

    const listedDepositMatchReviews = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/deposit-match-reviews",
    });
    expect(listedDepositMatchReviews.statusCode).toBe(200);
    expect(listedDepositMatchReviews.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: "deposit-match-review-route-test" })],
    });

    const rawPayloadRejected = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "payment",
        eventStatus: "payment_observed",
        externalEventId: "evt_synthetic_raw_payload",
        amountCents: 5000,
        currency: "CAD",
        rawPayload: { private: "Synthetic private raw provider payload" },
      },
    });
    expect(rawPayloadRejected.statusCode).toBe(400);

    const disputePacketRejected = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "payment",
        eventStatus: "chargeback_observed",
        externalEventId: "evt_synthetic_dispute_packet",
        externalPaymentId: "pay_synthetic_dispute_packet",
        amountCents: 5000,
        currency: "CAD",
        disputePacket: { private: "Synthetic private dispute packet" },
      },
    });
    expect(disputePacketRejected.statusCode).toBe(400);

    const unsafeExternalId = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "payment",
        eventStatus: "payment_observed",
        externalEventId: "evt synthetic raw body",
        amountCents: 5000,
        currency: "CAD",
      },
    });
    expect(unsafeExternalId.statusCode).toBe(400);

    const crossMatterCandidate = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-002",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_cross_matter",
        externalDepositId: "dep_synthetic_cross_matter",
        amountCents: 5000,
        currency: "CAD",
        candidateInvoiceId: "invoice-001",
      },
    });
    expect(crossMatterCandidate.statusCode).toBe(409);
    expect(crossMatterCandidate.json()).toMatchObject({
      code: "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
    });

    const crossMatterManualPayment = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_cross_matter_payment",
        externalDepositId: "dep_synthetic_cross_matter_payment",
        amountCents: 5000,
        currency: "CAD",
        candidateManualPaymentId: "payment-import-review-cross-matter",
      },
    });
    expect(crossMatterManualPayment.statusCode).toBe(409);
    expect(crossMatterManualPayment.json()).toMatchObject({
      code: "PAYMENT_IMPORT_CANDIDATE_MATTER_MISMATCH",
    });

    const invoiceMismatchManualPayment = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_invoice_mismatch_payment",
        externalDepositId: "dep_synthetic_invoice_mismatch_payment",
        amountCents: 5000,
        currency: "CAD",
        candidateInvoiceId: "invoice-001",
        candidateManualPaymentId: "payment-import-review-invoice-mismatch",
      },
    });
    expect(invoiceMismatchManualPayment.statusCode).toBe(409);
    expect(invoiceMismatchManualPayment.json()).toMatchObject({
      code: "PAYMENT_IMPORT_CANDIDATE_INVOICE_MISMATCH",
    });

    const paymentOnlyRecord = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-payment-only",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "payment",
        eventStatus: "payment_observed",
        externalEventId: "evt_synthetic_payment_only",
        externalDepositId: "dep_synthetic_payment_only",
        amountCents: 5000,
        currency: "CAD",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
      },
    });
    expect(paymentOnlyRecord.statusCode).toBe(200);
    const unsupportedDepositReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-payment-only/deposit-match-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "missing_reviewer_evidence",
        idempotencyKey: "synthetic-payment-only-deposit-review",
      },
    });
    expect(unsupportedDepositReview.statusCode).toBe(409);
    expect(unsupportedDepositReview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_DEPOSIT_MATCH_REVIEW_UNSUPPORTED",
    });
    const unsupportedRefundChargebackReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-payment-only/refund-chargeback-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "status_unclear",
        idempotencyKey: "synthetic-payment-only-refund-chargeback-review",
      },
    });
    expect(unsupportedRefundChargebackReview.statusCode).toBe(409);
    expect(unsupportedRefundChargebackReview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_UNSUPPORTED",
    });
    const unsupportedRefundChargebackPreview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-payment-only/refund-chargeback-resolution-packet-preview",
    });
    expect(unsupportedRefundChargebackPreview.statusCode).toBe(409);
    expect(unsupportedRefundChargebackPreview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_UNSUPPORTED",
    });

    const refundCueRecord = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-refund-cue",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "payment",
        eventStatus: "refund_observed",
        externalEventId: "evt_synthetic_refund_cue",
        externalPaymentId: "pay_synthetic_refund_cue",
        amountCents: 2500,
        currency: "CAD",
        observedAt: "2026-06-19T17:00:00.000Z",
        candidateInvoiceId: "invoice-001",
      },
    });
    expect(refundCueRecord.statusCode).toBe(200);
    expect(refundCueRecord.json()).toMatchObject({
      record: {
        id: "payment-import-review-refund-cue",
        eventFamily: "payment",
        eventStatus: "refund_observed",
        candidateInvoiceId: "invoice-001",
        boundaries: expect.objectContaining({
          refundHandling: "review_only",
          chargebackHandling: "review_only",
          providerCommand: "none",
          clientNotification: "none",
          trustPosting: "none",
        }),
      },
    });
    const auditCountBeforeRefundPacketPreview = (await auditEvents(repository)).length;
    const refundPacketPreviewBeforeDecision = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-resolution-packet-preview",
    });
    expect(refundPacketPreviewBeforeDecision.statusCode).toBe(200);
    expect(refundPacketPreviewBeforeDecision.json()).toEqual({
      packetPreview: {
        reviewOnly: true,
        paymentImportReviewRecordId: "payment-import-review-refund-cue",
        matterId: "matter-001",
        candidateInvoiceId: "invoice-001",
        category: "refund",
        cueStatus: "needs_review",
        resolutionPosture: "awaiting_decision",
        reasonCategories: [],
        noSideEffectFlags: {
          rawProviderPayloadRetained: false,
          invoiceBalanceMutation: "none",
          ledgerReversal: "none",
          providerCommand: "none",
          refundArtifactStorage: false,
          disputeArtifactStorage: false,
          freeFormNotes: false,
          clientNotification: "none",
          trustPosting: "none",
          fundsMovement: "none",
        },
      },
    });
    await expect(auditEvents(repository)).resolves.toHaveLength(
      auditCountBeforeRefundPacketPreview,
    );
    const refundChargebackReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
      payload: {
        id: "refund-chargeback-review-route-test",
        decision: "exception_confirmed",
        reason: "refund_observed",
        idempotencyKey: "synthetic-refund-chargeback-review-key",
      },
    });
    expect(refundChargebackReview.statusCode).toBe(200);
    expect(refundChargebackReview.json()).toMatchObject({
      review: {
        id: "refund-chargeback-review-route-test",
        paymentImportReviewRecordId: "payment-import-review-refund-cue",
        category: "refund",
        decision: "exception_confirmed",
        reason: "refund_observed",
        reviewerEvidencePresent: true,
        boundaries: {
          rawProviderPayloadRetained: false,
          refundArtifactRetained: false,
          disputeArtifactRetained: false,
          invoiceBalanceMutation: "none",
          ledgerReversal: "none",
          trustPosting: "none",
          providerCommand: "none",
          clientNotification: "none",
          fundsMovement: "none",
          refundHandling: "review_decision_only",
          chargebackHandling: "review_decision_only",
        },
      },
    });
    const confirmedRefundPacketPreview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-resolution-packet-preview",
    });
    expect(confirmedRefundPacketPreview.statusCode).toBe(200);
    expect(confirmedRefundPacketPreview.json()).toMatchObject({
      packetPreview: {
        reviewOnly: true,
        paymentImportReviewRecordId: "payment-import-review-refund-cue",
        matterId: "matter-001",
        candidateInvoiceId: "invoice-001",
        latestReviewId: "refund-chargeback-review-route-test",
        category: "refund",
        cueStatus: "needs_review",
        resolutionPosture: "confirmed_exception",
        reasonCategories: ["refund_observed"],
        latestReviewerMetadata: {
          decision: "exception_confirmed",
          reason: "refund_observed",
          reviewedByUserId: "user-admin",
          reviewerEvidencePresent: true,
        },
        noSideEffectFlags: {
          rawProviderPayloadRetained: false,
          invoiceBalanceMutation: "none",
          ledgerReversal: "none",
          providerCommand: "none",
          refundArtifactStorage: false,
          disputeArtifactStorage: false,
          freeFormNotes: false,
          clientNotification: "none",
          trustPosting: "none",
          fundsMovement: "none",
        },
      },
    });
    const repeatedRefundChargebackReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
      payload: {
        id: "refund-chargeback-review-route-retry",
        decision: "exception_confirmed",
        reason: "refund_observed",
        idempotencyKey: "synthetic-refund-chargeback-review-key",
      },
    });
    expect(repeatedRefundChargebackReview.statusCode).toBe(200);
    expect(repeatedRefundChargebackReview.json()).toMatchObject({
      review: { id: "refund-chargeback-review-route-test" },
    });
    const conflictingRefundChargebackReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "status_unclear",
        idempotencyKey: "synthetic-refund-chargeback-review-key",
      },
    });
    expect(conflictingRefundChargebackReview.statusCode).toBe(409);
    expect(conflictingRefundChargebackReview.json()).toMatchObject({
      code: "IDEMPOTENCY_KEY_CONFLICT",
    });
    const refundReasonMismatch = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
      payload: {
        decision: "exception_confirmed",
        reason: "chargeback_observed",
        idempotencyKey: "synthetic-refund-reason-mismatch",
      },
    });
    expect(refundReasonMismatch.statusCode).toBe(409);
    expect(refundReasonMismatch.json()).toMatchObject({
      code: "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_REASON_MISMATCH",
    });
    const rawRefundChargebackReviewRejected = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "missing_reviewer_evidence",
        idempotencyKey: "synthetic-raw-refund-chargeback-review",
        disputePacket: { private: "Synthetic private dispute packet" },
      },
    });
    expect(rawRefundChargebackReviewRejected.statusCode).toBe(400);
    const listedRefundChargebackReviews = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
    });
    expect(listedRefundChargebackReviews.statusCode).toBe(200);
    expect(listedRefundChargebackReviews.json()).toMatchObject({
      reviewOnly: true,
      reviews: [expect.objectContaining({ id: "refund-chargeback-review-route-test" })],
    });
    const refundDepositReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/deposit-match-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "missing_reviewer_evidence",
        idempotencyKey: "synthetic-refund-cue-deposit-review",
      },
    });
    expect(refundDepositReview.statusCode).toBe(409);
    expect(refundDepositReview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_DEPOSIT_MATCH_REVIEW_UNSUPPORTED",
    });

    const chargebackCueRecord = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-chargeback-cue",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "payment",
        eventStatus: "chargeback_observed",
        externalEventId: "evt_synthetic_chargeback_cue",
        externalPaymentId: "pay_synthetic_chargeback_cue",
        amountCents: 5000,
        currency: "CAD",
        observedAt: "2026-06-19T17:05:00.000Z",
        candidateInvoiceId: "invoice-001",
      },
    });
    expect(chargebackCueRecord.statusCode).toBe(200);
    expect(chargebackCueRecord.json()).toMatchObject({
      record: {
        id: "payment-import-review-chargeback-cue",
        eventFamily: "payment",
        eventStatus: "chargeback_observed",
      },
    });
    const chargebackReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-chargeback-cue/refund-chargeback-reviews",
      payload: {
        id: "chargeback-review-route-test",
        decision: "needs_more_evidence",
        reason: "status_unclear",
        idempotencyKey: "synthetic-chargeback-review-key",
      },
    });
    expect(chargebackReview.statusCode).toBe(200);
    expect(chargebackReview.json()).toMatchObject({
      review: {
        id: "chargeback-review-route-test",
        category: "chargeback",
        decision: "needs_more_evidence",
        reason: "status_unclear",
        boundaries: expect.objectContaining({
          rawProviderPayloadRetained: false,
          disputeArtifactRetained: false,
          providerCommand: "none",
          fundsMovement: "none",
          trustPosting: "none",
        }),
      },
    });
    const chargebackPacketPreview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-chargeback-cue/refund-chargeback-resolution-packet-preview",
    });
    expect(chargebackPacketPreview.statusCode).toBe(200);
    expect(chargebackPacketPreview.json()).toMatchObject({
      packetPreview: {
        paymentImportReviewRecordId: "payment-import-review-chargeback-cue",
        matterId: "matter-001",
        candidateInvoiceId: "invoice-001",
        latestReviewId: "chargeback-review-route-test",
        category: "chargeback",
        resolutionPosture: "needs_more_evidence",
        reasonCategories: ["status_unclear"],
        latestReviewerMetadata: {
          decision: "needs_more_evidence",
          reason: "status_unclear",
          reviewedByUserId: "user-admin",
          reviewerEvidencePresent: true,
        },
        noSideEffectFlags: expect.objectContaining({
          providerCommand: "none",
          freeFormNotes: false,
          fundsMovement: "none",
        }),
      },
    });

    const depositWithoutCandidateRecord = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-deposit-without-candidate",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_deposit_without_candidate",
        externalDepositId: "dep_synthetic_deposit_without_candidate",
        amountCents: 5000,
        currency: "CAD",
      },
    });
    expect(depositWithoutCandidateRecord.statusCode).toBe(200);
    const missingCandidateDepositReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-deposit-without-candidate/deposit-match-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "missing_reviewer_evidence",
        idempotencyKey: "synthetic-deposit-candidate-required",
      },
    });
    expect(missingCandidateDepositReview.statusCode).toBe(409);
    expect(missingCandidateDepositReview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_DEPOSIT_MATCH_CANDIDATE_REQUIRED",
    });
    const depositRefundChargebackReview = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/refund-chargeback-reviews",
      payload: {
        decision: "needs_more_evidence",
        reason: "status_unclear",
        idempotencyKey: "synthetic-deposit-refund-chargeback-review",
      },
    });
    expect(depositRefundChargebackReview.statusCode).toBe(409);
    expect(depositRefundChargebackReview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_UNSUPPORTED",
    });
    const depositRefundChargebackPacketPreview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/refund-chargeback-resolution-packet-preview",
    });
    expect(depositRefundChargebackPacketPreview.statusCode).toBe(409);
    expect(depositRefundChargebackPacketPreview.json()).toMatchObject({
      code: "PAYMENT_IMPORT_REFUND_CHARGEBACK_REVIEW_UNSUPPORTED",
    });

    const conflictRecord = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-conflict-support",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_conflict_support",
        externalDepositId: "dep_synthetic_conflict_support",
        amountCents: 5000,
        currency: "CAD",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
        conflictReason: "duplicate",
      },
    });
    expect(conflictRecord.statusCode).toBe(200);
    const conflictSupported = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-conflict-support/deposit-match-reviews",
      payload: {
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-conflict-supported",
      },
    });
    expect(conflictSupported.statusCode).toBe(409);
    expect(conflictSupported.json()).toMatchObject({
      code: "PAYMENT_IMPORT_DEPOSIT_MATCH_CONFLICT_REVIEW_REQUIRED",
    });

    const amountMismatchRecord = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records",
      payload: {
        id: "payment-import-review-amount-mismatch",
        matterId: "matter-001",
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_amount_mismatch",
        externalDepositId: "dep_synthetic_amount_mismatch",
        amountCents: 5100,
        currency: "CAD",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
      },
    });
    expect(amountMismatchRecord.statusCode).toBe(200);
    const amountMismatchSupported = await server.inject({
      method: "POST",
      url: "/api/billing/payment-import-review-records/payment-import-review-amount-mismatch/deposit-match-reviews",
      payload: {
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        idempotencyKey: "synthetic-amount-mismatch-supported",
      },
    });
    expect(amountMismatchSupported.statusCode).toBe(409);
    expect(amountMismatchSupported.json()).toMatchObject({
      code: "PAYMENT_IMPORT_DEPOSIT_MATCH_AMOUNT_MISMATCH",
    });

    await repository.createUser({
      id: "user-other-licensee",
      firmId: "firm-west-legal",
      displayName: "Synthetic Other Licensee",
      email: "other-licensee@example.test",
      role: "licensee",
      assignedMatterIds: ["matter-002"],
      mfaEnabled: true,
    });
    const crossMatterDepositReview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-route-test/deposit-match-reviews",
      headers: {
        "x-open-practice-user-id": "user-other-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    expect(crossMatterDepositReview.statusCode).toBe(403);
    const crossMatterRefundChargebackReview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-reviews",
      headers: {
        "x-open-practice-user-id": "user-other-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    expect(crossMatterRefundChargebackReview.statusCode).toBe(403);
    const crossMatterRefundChargebackPacketPreview = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records/payment-import-review-refund-cue/refund-chargeback-resolution-packet-preview",
      headers: {
        "x-open-practice-user-id": "user-other-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });
    expect(crossMatterRefundChargebackPacketPreview.statusCode).toBe(403);

    await repository.createPayment({
      payment: {
        id: "payment-import-review-manual-now-received",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        receivedAt: "2026-06-19T16:10:00.000Z",
        amountCents: 5000,
        method: "eft",
        status: "received",
        receivedByUserId: "user-licensee",
        evidence: { source: "synthetic-payment-import-review-now-received" },
      },
      allocations: [],
    });
    await repository.createPaymentImportReviewRecord({
      id: "payment-import-review-supported-now-ineligible",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      providerLabel: "synthetic_processor",
      eventFamily: "deposit",
      eventStatus: "deposit_observed",
      externalEventId: "evt_synthetic_supported_now_ineligible",
      externalDepositId: "dep_synthetic_supported_now_ineligible",
      amountCents: 5000,
      currency: "CAD",
      observedAt: "2026-06-19T16:10:00.000Z",
      importedAt: "2026-06-19T16:12:00.000Z",
      importedByUserId: "user-licensee",
      candidateInvoiceId: "invoice-001",
      candidateManualPaymentId: "payment-import-review-manual-now-received",
      reviewState: "needs_review",
      normalizedEvidenceFingerprint: "synthetic-supported-now-ineligible-fingerprint",
      boundaries: defaultPaymentImportReviewBoundary(),
      updatedAt: "2026-06-19T16:12:00.000Z",
    });
    await repository.createPaymentImportDepositMatchReview({
      id: "deposit-match-review-supported-now-ineligible",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      paymentImportReviewRecordId: "payment-import-review-supported-now-ineligible",
      candidateManualPaymentId: "payment-import-review-manual-now-received",
      candidateInvoiceId: "invoice-001",
      decision: "candidate_supported",
      reason: "candidate_evidence_matches",
      importAmountCents: 5000,
      manualPaymentAmountCents: 5000,
      currency: "CAD",
      candidateManualPaymentStatus: "pending_reconciliation",
      reviewerEvidencePresent: true,
      idempotencyKey: "synthetic-supported-now-ineligible-key",
      decisionFingerprint: "synthetic-supported-now-ineligible-fingerprint",
      boundaries: defaultPaymentImportDepositMatchReviewBoundary(),
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-19T16:15:00.000Z",
      createdAt: "2026-06-19T16:15:00.000Z",
    });

    const list = await server.inject({
      method: "GET",
      url: "/api/billing/payment-import-review-records?matterId=matter-001",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      records: expect.arrayContaining([
        expect.objectContaining({
          id: "payment-import-review-route-test",
          providerLabel: "synthetic_processor",
        }),
      ]),
    });

    const dashboard = await server.inject({ method: "GET", url: "/api/billing/dashboard" });
    expect(dashboard.statusCode).toBe(200);
    expect(
      dashboard.json<{
        summary: {
          paymentImportReviewCount: number;
          paymentImportConflictCount: number;
          depositMatchReviewCount: number;
          depositMatchDecisionCount: number;
          depositMatchReconciliationReadyCount: number;
          refundReviewCueCount: number;
          chargebackReviewCueCount: number;
          refundChargebackReviewCueCount: number;
          refundChargebackReviewDecisionCount: number;
        };
        matters: Array<{
          matterId: string;
          paymentImportReviewRecords: Array<{
            id: string;
            externalPaymentIdPresent?: boolean;
            externalDepositIdPresent?: boolean;
            candidateManualPaymentId?: string;
            depositMatchReviewCount?: number;
            latestDepositMatchReview?: { decision: string; reason: string };
            boundaries: { rawProviderPayloadRetained: boolean; trustPosting: string };
          }>;
        }>;
      }>().summary,
    ).toMatchObject({
      paymentImportReviewCount: 9,
      depositMatchReviewCount: 6,
      depositMatchDecisionCount: 2,
      depositMatchReconciliationReadyCount: 1,
      refundReviewCueCount: 1,
      chargebackReviewCueCount: 1,
      refundChargebackReviewCueCount: 2,
      refundChargebackReviewDecisionCount: 2,
    });
    expect(
      dashboard
        .json<{
          matters: Array<{
            matterId: string;
            paymentImportReviewRecords: Array<{
              id: string;
              externalPaymentIdPresent?: boolean;
              externalDepositIdPresent?: boolean;
              candidateManualPaymentId?: string;
              refundChargebackReviewCue?: {
                category: string;
                status: string;
                reviewAction: string;
              };
              refundChargebackReviewDecisionCount?: number;
              latestRefundChargebackReview?: {
                category: string;
                decision: string;
                reason: string;
                boundaries: { providerCommand: string; fundsMovement: string };
              };
              refundChargebackResolutionPacketPreview?: {
                resolutionPosture: string;
                reasonCategories: string[];
                noSideEffectFlags: { providerCommand: string; freeFormNotes: boolean };
              };
              reconciliationReadiness?: {
                eligible: boolean;
                reason: string;
                reasonDetails: Array<{ code: string; status: string; label: string }>;
                reviewAction: string;
                mutation: string;
              };
              boundaries: { rawProviderPayloadRetained: boolean; trustPosting: string };
            }>;
          }>;
        }>()
        .matters.find((matter) => matter.matterId === "matter-001")?.paymentImportReviewRecords,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "payment-import-review-route-test",
          externalPaymentIdPresent: true,
          externalDepositIdPresent: true,
          candidateManualPaymentId: "payment-import-review-manual-candidate",
          depositMatchReviewCount: 1,
          latestDepositMatchReview: expect.objectContaining({
            decision: "candidate_supported",
            reason: "candidate_evidence_matches",
          }),
          reconciliationReadiness: expect.objectContaining({
            eligible: true,
            reason: "supported_candidate_ready",
            reasonDetails: expect.arrayContaining([
              {
                code: "latest_supported_decision",
                status: "satisfied",
                label: "Latest decision supports candidate",
              },
              {
                code: "invoice_balance_covers_payment",
                status: "satisfied",
                label: "Invoice balance covers payment",
              },
            ]),
            reviewAction: "manual_payment_reconcile_review",
            mutation: "none",
          }),
          boundaries: expect.objectContaining({
            rawProviderPayloadRetained: false,
            trustPosting: "none",
          }),
        }),
        expect.objectContaining({
          id: "payment-import-review-supported-now-ineligible",
          candidateManualPaymentId: "payment-import-review-manual-now-received",
          latestDepositMatchReview: expect.objectContaining({
            decision: "candidate_supported",
            reason: "candidate_evidence_matches",
          }),
          reconciliationReadiness: expect.objectContaining({
            eligible: false,
            reason: "manual_payment_not_pending",
            reasonDetails: expect.arrayContaining([
              {
                code: "manual_payment_pending",
                status: "blocked",
                label: "Manual payment remains pending",
              },
            ]),
            reviewAction: "manual_payment_reconcile_review",
            mutation: "none",
          }),
        }),
        expect.objectContaining({
          id: "payment-import-review-refund-cue",
          refundChargebackReviewCue: expect.objectContaining({
            category: "refund",
            status: "needs_review",
            reviewAction: "staff_refund_chargeback_review_required",
          }),
          refundChargebackReviewDecisionCount: 1,
          latestRefundChargebackReview: expect.objectContaining({
            category: "refund",
            decision: "exception_confirmed",
            reason: "refund_observed",
            boundaries: expect.objectContaining({
              providerCommand: "none",
              fundsMovement: "none",
            }),
          }),
          refundChargebackResolutionPacketPreview: expect.objectContaining({
            resolutionPosture: "confirmed_exception",
            reasonCategories: ["refund_observed"],
            latestReviewerMetadata: expect.objectContaining({
              decision: "exception_confirmed",
              reason: "refund_observed",
              reviewerEvidencePresent: true,
            }),
            noSideEffectFlags: expect.objectContaining({
              providerCommand: "none",
              freeFormNotes: false,
              fundsMovement: "none",
            }),
          }),
          boundaries: expect.objectContaining({
            rawProviderPayloadRetained: false,
            trustPosting: "none",
          }),
        }),
        expect.objectContaining({
          id: "payment-import-review-chargeback-cue",
          refundChargebackReviewCue: expect.objectContaining({
            category: "chargeback",
            status: "needs_review",
          }),
          refundChargebackReviewDecisionCount: 1,
          latestRefundChargebackReview: expect.objectContaining({
            category: "chargeback",
            decision: "needs_more_evidence",
            reason: "status_unclear",
          }),
          refundChargebackResolutionPacketPreview: expect.objectContaining({
            resolutionPosture: "needs_more_evidence",
            reasonCategories: ["status_unclear"],
            noSideEffectFlags: expect.objectContaining({
              providerCommand: "none",
              freeFormNotes: false,
            }),
          }),
        }),
      ]),
    );

    const invoiceAfter = await server.inject({ method: "GET", url: "/api/invoices/invoice-001" });
    expect(invoiceAfter.json()).toMatchObject({
      status: invoiceBefore.json<{ status: string }>().status,
      paidCents: invoiceBefore.json<{ paidCents: number }>().paidCents,
      balanceDueCents: invoiceBefore.json<{ balanceDueCents: number }>().balanceDueCents,
    });
    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });
    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);
    expect(
      (await auditEvents(repository)).some((event) => event.action === "manual_payment.reconciled"),
    ).toBe(false);

    const audit = (await auditEvents(repository)).find(
      (event) => event.action === "payment_import_review_record.created",
    );
    expect(audit).toMatchObject({
      resourceType: "payment_import_review_record",
      resourceId: "payment-import-review-route-test",
      metadata: expect.objectContaining({
        providerLabel: "synthetic_processor",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalEventId: "evt_synthetic_import_route",
        externalPaymentIdPresent: true,
        externalDepositIdPresent: true,
        candidateManualPaymentId: "payment-import-review-manual-candidate",
        rawProviderPayloadRetained: false,
        invoiceBalanceMutation: "none",
        settlementAutomation: false,
        reconciliationMutation: "none",
        refundHandling: "review_only",
        chargebackHandling: "review_only",
        providerCommand: "none",
        clientNotification: "none",
        trustPosting: "none",
      }),
    });
    const refundCueAudit = (await auditEvents(repository)).find(
      (event) => event.resourceId === "payment-import-review-refund-cue",
    );
    expect(refundCueAudit).toMatchObject({
      resourceType: "payment_import_review_record",
      metadata: expect.objectContaining({
        eventFamily: "payment",
        eventStatus: "refund_observed",
        refundChargebackReviewCueCategory: "refund",
        refundChargebackReviewCueStatus: "needs_review",
        refundChargebackReviewAction: "staff_refund_chargeback_review_required",
        refundHandling: "review_only",
        chargebackHandling: "review_only",
        providerCommand: "none",
        clientNotification: "none",
        trustPosting: "none",
      }),
    });
    const refundChargebackAudit = (await auditEvents(repository)).find(
      (event) => event.action === "payment_import_refund_chargeback_review.recorded",
    );
    expect(refundChargebackAudit).toMatchObject({
      resourceType: "payment_import_refund_chargeback_review",
      resourceId: "refund-chargeback-review-route-test",
      metadata: expect.objectContaining({
        paymentImportRefundChargebackReviewId: "refund-chargeback-review-route-test",
        paymentImportReviewRecordId: "payment-import-review-refund-cue",
        category: "refund",
        decision: "exception_confirmed",
        reason: "refund_observed",
        reviewerEvidencePresent: true,
        idempotencyKeyPresent: true,
        rawProviderPayloadRetained: false,
        refundArtifactRetained: false,
        disputeArtifactRetained: false,
        invoiceBalanceMutation: "none",
        ledgerReversal: "none",
        providerCommand: "none",
        clientNotification: "none",
        fundsMovement: "none",
        trustPosting: "none",
      }),
    });
    const depositMatchAudit = (await auditEvents(repository)).find(
      (event) => event.action === "payment_import_deposit_match_review.recorded",
    );
    expect(depositMatchAudit).toMatchObject({
      resourceType: "payment_import_deposit_match_review",
      resourceId: "deposit-match-review-route-test",
      metadata: expect.objectContaining({
        paymentImportDepositMatchReviewId: "deposit-match-review-route-test",
        paymentImportReviewRecordId: "payment-import-review-route-test",
        candidateManualPaymentId: "payment-import-review-manual-candidate",
        decision: "candidate_supported",
        reason: "candidate_evidence_matches",
        importAmountCents: 5000,
        manualPaymentAmountCents: 5000,
        candidateManualPaymentStatus: "pending_reconciliation",
        reviewerEvidencePresent: true,
        idempotencyKeyPresent: true,
        rawProviderPayloadRetained: false,
        invoiceBalanceMutation: "none",
        settlementAutomation: false,
        reconciliationMutation: "none",
        providerCommand: "none",
        clientNotification: "none",
        trustPosting: "none",
      }),
    });
    expect(JSON.stringify(await auditEvents(repository))).not.toContain(
      "synthetic-deposit-match-review-key",
    );
    expect(JSON.stringify(await auditEvents(repository))).not.toContain(
      "synthetic-refund-chargeback-review-key",
    );
    expect(JSON.stringify(await auditEvents(repository))).not.toContain(
      "Synthetic private raw provider payload",
    );
    expect(JSON.stringify(await auditEvents(repository))).not.toContain(
      "Synthetic private dispute packet",
    );
    expect(JSON.stringify(await auditEvents(repository))).not.toContain(
      "Synthetic private deposit review payload",
    );
  });

  it("keeps Stripe checkout creation disabled when no processor is configured", async () => {
    const server = testServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests/payment-request-001/checkout-session",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: "ApiHttpError",
      code: "PAYMENT_PROCESSOR_NOT_CONFIGURED",
      message: "Payment processor provider is not configured",
    });
  });

  it("rejects payment request shells for non-issued invoices and over-balance amounts", async () => {
    const server = testServer();
    const draft = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-payment-request-draft",
        matterId: "matter-001",
        adjustmentLines: [
          {
            description: "Synthetic adjustment invoice.",
            unitAmountCents: 1000,
          },
        ],
      },
    });
    expect(draft.statusCode).toBe(200);

    const draftRequest = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests",
      payload: {
        id: "payment-request-draft-blocked",
        matterId: "matter-001",
        invoiceId: "invoice-payment-request-draft",
        amountCents: 1000,
      },
    });
    expect(draftRequest.statusCode).toBe(409);
    expect(draftRequest.json()).toMatchObject({
      message: "Hosted payment requests can only be created for issued invoices",
    });

    const overBalance = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests",
      payload: {
        id: "payment-request-over-balance",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        amountCents: 999999,
      },
    });
    expect(overBalance.statusCode).toBe(409);
    expect(overBalance.json()).toMatchObject({
      message: "Payment request amount exceeds invoice balance due",
    });
  });

  it("requires approve access for time and expense approval routes", async () => {
    const server = testServer({ devUserId: "user-staff" });
    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-approve-access-test",
        matterId: "matter-001",
        minutes: 20,
        rateCents: 18000,
        narrative: "Synthetic approval access test.",
      },
    });
    const expense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-approve-access-test",
        matterId: "matter-001",
        amountCents: 500,
        categoryCode: "courier_postage",
        description: "Synthetic expense approval access test.",
      },
    });
    expect(time.statusCode).toBe(200);
    expect(expense.statusCode).toBe(200);

    const submittedTime = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-approve-access-test/submit",
    });
    const submittedExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-approve-access-test/submit",
    });
    expect(submittedTime.statusCode).toBe(200);
    expect(submittedExpense.statusCode).toBe(200);

    const approvedTime = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-approve-access-test/approve",
    });
    const approvedExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-approve-access-test/approve",
    });

    expect(approvedTime.statusCode).toBe(403);
    expect(approvedTime.json()).toMatchObject({ code: "TIME_ENTRY_ACCESS_REQUIRED" });
    expect(approvedExpense.statusCode).toBe(403);
    expect(approvedExpense.json()).toMatchObject({ code: "EXPENSE_ENTRY_ACCESS_REQUIRED" });
  });

  it("queues billing export requests, gates downloads, and keeps job metadata redacted", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const queuedReports: QueuedReportJob[] = [];
    const server = testServer({
      repository,
      reportJobQueue: fakeReportQueue(queuedReports),
    });
    await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-billing-export-private-body",
        matterId: "matter-001",
        minutes: 15,
        rateCents: 18000,
        narrative: "Synthetic private billing export body",
        billingStatus: "approved",
      },
    });

    const created = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      payload: {
        matterId: "matter-001",
        idempotencyKey: "billing-export-route-test",
      },
    });

    expect(created.statusCode).toBe(202);
    const exportRequest = created.json<{
      exportRequest: { jobId: string; status: string; pollUrl: string; downloadUrl: string };
    }>().exportRequest;
    expect(exportRequest).toMatchObject({
      status: "queued",
      pollUrl: `/api/billing/export-requests/${exportRequest.jobId}`,
      downloadUrl: `/api/billing/export-requests/${exportRequest.jobId}/download`,
    });
    expect(queuedReports).toEqual([
      expect.objectContaining({
        name: "billing_export",
        jobId: exportRequest.jobId,
      }),
    ]);
    expect(JSON.stringify(queuedReports)).toContain("billing_operational_records_json");
    expect(JSON.stringify(queuedReports)).not.toContain("fieldKeys");
    expect(JSON.stringify(queuedReports)).not.toContain("Synthetic private billing export body");

    const [job] = await repository.listJobLifecycleRecords("firm-west-legal", {
      queueName: "reports",
    });
    expect(job).toMatchObject({
      id: exportRequest.jobId,
      jobName: "billing_export",
      status: "queued",
      targetResourceType: "billing_export",
      metadata: {
        reportType: "billing",
        reportScope: "matter",
        fieldProfileId: "billing_operational_records_json",
        matterId: "matter-001",
        requestedByUserId: "user-admin",
        enqueueStatus: "queued_for_local_report_worker",
      },
    });
    expect(JSON.stringify(job.metadata)).not.toContain("Synthetic private billing export body");

    const earlyDownload = await server.inject({
      method: "GET",
      url: `/api/billing/export-requests/${exportRequest.jobId}/download`,
    });
    expect(earlyDownload.statusCode).toBe(409);
    expect(earlyDownload.json()).toMatchObject({ code: "BILLING_EXPORT_NOT_READY" });

    await repository.updateJobLifecycleRecord("firm-west-legal", exportRequest.jobId, {
      status: "completed",
      finishedAt: "2026-05-19T12:00:00.000Z",
      metadata: {
        reportType: "billing",
        reportScope: "matter",
        fieldProfileId: "billing_operational_records_json",
        matterId: "matter-001",
        requestedByUserId: "user-admin",
        timeEntryCount: 1,
      },
    });

    const status = await server.inject({
      method: "GET",
      url: `/api/billing/export-requests/${exportRequest.jobId}`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      exportRequest: { jobId: exportRequest.jobId, status: "completed" },
    });

    const downloaded = await server.inject({
      method: "GET",
      url: `/api/billing/export-requests/${exportRequest.jobId}/download`,
    });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.json()).toMatchObject({
      exportRequest: { jobId: exportRequest.jobId, status: "completed" },
      export: {
        reportType: "billing",
        reportScope: "matter",
        fieldProfile: expect.objectContaining({
          id: "billing_operational_records_json",
          format: "json",
          source: "generated_local_projection",
          manualDownloadOnly: true,
          storesRawExportBody: false,
        }),
        matterId: "matter-001",
        timeEntries: expect.arrayContaining([
          expect.objectContaining({
            id: "time-billing-export-private-body",
            narrative: "Synthetic private billing export body",
          }),
        ]),
        invoices: expect.any(Array),
        paymentRequests: expect.any(Array),
        trustTransferRequests: expect.any(Array),
      },
    });
    const downloadedPayload = downloaded.json();
    expect(downloadedPayload.export.fieldProfile.fieldKeys).toEqual(
      expect.arrayContaining(["timeEntries.narrative", "invoices.invoiceNumber"]),
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
      events: await auditEvents(repository),
      jobs: await repository.listJobLifecycleRecords("firm-west-legal"),
    });
    expect(serializedAuditAndJobs).not.toContain("Synthetic private billing export body");
    expect(serializedAuditAndJobs).not.toContain("fieldKeys");
  });

  it("matches billing export fixtures across assigned staff, auditor, bookkeeper, and external users", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createAuthorizationFixtureUser({
      repository,
      id: "user-billing-export-auditor",
      role: "auditor",
    });
    await createAuthorizationFixtureUser({
      repository,
      id: "user-billing-export-bookkeeper",
      role: "billing_bookkeeper",
    });
    await createAuthorizationFixtureUser({
      repository,
      id: "user-billing-export-client-external",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
    });
    const fixtureIds = authorizationFixtureCases
      .filter((item) => item.family === "billing_export")
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "billing-export:assigned:matter-create",
      "billing-export:auditor:firm-create",
      "billing-export:bookkeeper:firm-create",
      "billing-export:portal-client:create-denied",
    ]);
    const assignedCase = authorizationFixtureCase("billing-export:assigned:matter-create");
    const auditorCase = authorizationFixtureCase("billing-export:auditor:firm-create");
    const bookkeeperCase = authorizationFixtureCase("billing-export:bookkeeper:firm-create");
    const portalCase = authorizationFixtureCase("billing-export:portal-client:create-denied");
    const server = testServer({ repository });

    const assigned = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      headers: authHeaders(assignedCase.subjectId),
      payload: {
        matterId: assignedCase.matterId,
        idempotencyKey: assignedCase.resourceId,
      },
    });
    expect(assigned.statusCode).toBe(202);

    const auditor = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      headers: authHeaders(auditorCase.subjectId),
      payload: { idempotencyKey: auditorCase.resourceId },
    });
    expect(auditor.statusCode).toBe(202);

    const bookkeeper = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      headers: authHeaders(bookkeeperCase.subjectId),
      payload: { idempotencyKey: bookkeeperCase.resourceId },
    });
    expect(bookkeeper.statusCode).toBe(202);

    const beforeDenied = await repository.listJobLifecycleRecords(firmId, {
      queueName: "reports",
    });
    const portal = await server.inject({
      method: "POST",
      url: "/api/billing/export-requests",
      headers: authHeaders(portalCase.subjectId),
      payload: { matterId: portalCase.matterId, idempotencyKey: portalCase.resourceId },
    });
    expect(portal.statusCode).toBe(403);
    expect(portal.json()).toMatchObject({ message: "Trust ledger access required" });
    await expect(
      repository.listJobLifecycleRecords(firmId, { queueName: "reports" }),
    ).resolves.toHaveLength(beforeDenied.length);
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

  it("matches trust-transfer review fixtures without granting auditor, bookkeeper, or portal commands", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await createAuthorizationFixtureUser({
      repository,
      id: "user-trust-transfer-auditor",
      role: "auditor",
    });
    await createAuthorizationFixtureUser({
      repository,
      id: "user-trust-transfer-bookkeeper",
      role: "billing_bookkeeper",
      assignedMatterIds: ["matter-001"],
    });
    await createAuthorizationFixtureUser({
      repository,
      id: "user-trust-transfer-client-external",
      role: "client_external",
      assignedMatterIds: ["matter-001"],
    });
    const fixtureIds = authorizationFixtureCases
      .filter((item) => item.family === "trust_transfer_review")
      .map((item) => item.id);
    expect(fixtureIds).toEqual([
      "trust-transfer-review:assigned:list-visible",
      "trust-transfer-review:assigned:approve",
      "trust-transfer-review:auditor:approve-denied",
      "trust-transfer-review:bookkeeper:approve-denied",
      "trust-transfer-review:portal-client:staff-list-denied",
    ]);
    const assignedListCase = authorizationFixtureCase(
      "trust-transfer-review:assigned:list-visible",
    );
    const assignedApproveCase = authorizationFixtureCase("trust-transfer-review:assigned:approve");
    const auditorCase = authorizationFixtureCase("trust-transfer-review:auditor:approve-denied");
    const bookkeeperCase = authorizationFixtureCase(
      "trust-transfer-review:bookkeeper:approve-denied",
    );
    const portalCase = authorizationFixtureCase(
      "trust-transfer-review:portal-client:staff-list-denied",
    );
    const server = testServer({ repository });

    const assignedList = await server.inject({
      method: "GET",
      url: `/api/billing/trust-transfer-requests?matterId=${assignedListCase.matterId}`,
      headers: authHeaders(assignedListCase.subjectId),
    });
    expect(assignedList.statusCode).toBe(200);
    expect(
      assignedList.json<{ requests: Array<{ id: string }> }>().requests.map((item) => item.id),
    ).toContain(assignedListCase.resourceId);

    const assignedApprove = await server.inject({
      method: "POST",
      url: `/api/billing/trust-transfer-requests/${assignedApproveCase.resourceId}/approve`,
      headers: authHeaders(assignedApproveCase.subjectId),
      payload: {},
    });
    expect(assignedApprove.statusCode).toBe(200);
    expect(assignedApprove.json()).toMatchObject({
      id: assignedApproveCase.resourceId,
      status: "approved",
      reviewedByUserId: assignedApproveCase.subjectId,
    });

    for (const request of [
      {
        url: `/api/billing/trust-transfer-requests/${auditorCase.resourceId}/approve`,
        userId: auditorCase.subjectId,
        payload: {},
      },
      {
        url: `/api/billing/trust-transfer-requests/${auditorCase.resourceId}/reject`,
        userId: auditorCase.subjectId,
        payload: {},
      },
      {
        url: `/api/billing/trust-transfer-requests/${bookkeeperCase.resourceId}/link`,
        userId: bookkeeperCase.subjectId,
        payload: { ledgerTransactionId: "trust-retainer" },
      },
    ]) {
      const response = await server.inject({
        method: "POST",
        url: request.url,
        headers: authHeaders(request.userId),
        payload: request.payload,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ message: "Trust ledger access required" });
    }
    const portalList = await server.inject({
      method: "GET",
      url: "/api/billing/trust-transfer-requests",
      headers: authHeaders(portalCase.subjectId),
    });
    expect(portalList.statusCode).toBe(403);
    expect(portalList.json()).toMatchObject({ message: "Staff access required" });
    const requestAfterDeniedLink = await repository.getTrustTransferRequest(
      firmId,
      bookkeeperCase.resourceId!,
    );
    expect(requestAfterDeniedLink?.ledgerTransactionId).toBeUndefined();
  });

  it("requires fresh sessions before trust transfer review and link mutations", async () => {
    const approveRepository = new InMemoryOpenPracticeRepository();
    const approveServer = testServer({ repository: approveRepository });

    const missingApproveSession = await approveServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
    });
    expect(missingApproveSession.statusCode).toBe(403);
    expect(missingApproveSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const staleApproveSession = await approveServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
      headers: await freshAuthHeaders(approveRepository, {
        freshAuthenticatedAt: staleFreshAuthenticatedAt(),
      }),
    });
    expect(staleApproveSession.statusCode).toBe(403);
    expect(staleApproveSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const freshApproveSession = await approveServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
      headers: await freshAuthHeaders(approveRepository),
    });
    expect(freshApproveSession.statusCode).toBe(200);
    expect(freshApproveSession.json()).toMatchObject({
      id: "trust-transfer-request-001",
      status: "approved",
      reviewedByUserId: "user-admin",
    });

    const rejectRepository = new InMemoryOpenPracticeRepository();
    const rejectServer = testServer({ repository: rejectRepository });
    const createRejectTarget = await rejectServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-fresh-reject-route",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        amountCents: 1000,
      },
    });
    expect(createRejectTarget.statusCode).toBe(200);

    const missingRejectSession = await rejectServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-fresh-reject-route/reject",
    });
    expect(missingRejectSession.statusCode).toBe(403);
    expect(missingRejectSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const staleRejectSession = await rejectServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-fresh-reject-route/reject",
      headers: await freshAuthHeaders(rejectRepository, {
        freshAuthenticatedAt: staleFreshAuthenticatedAt(),
      }),
    });
    expect(staleRejectSession.statusCode).toBe(403);
    expect(staleRejectSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const freshRejectSession = await rejectServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-fresh-reject-route/reject",
      headers: await freshAuthHeaders(rejectRepository),
    });
    expect(freshRejectSession.statusCode).toBe(200);
    expect(freshRejectSession.json()).toMatchObject({
      id: "trust-transfer-fresh-reject-route",
      status: "rejected",
      reviewedByUserId: "user-admin",
    });

    const linkRepository = new InMemoryOpenPracticeRepository();
    const linkServer = testServer({ repository: linkRepository });
    const approvedForLink = await linkServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
      headers: await freshAuthHeaders(linkRepository),
    });
    expect(approvedForLink.statusCode).toBe(200);
    await postSyntheticTrustTransferLedger(linkRepository, {
      id: "trust-transfer-fresh-link-posting",
    });

    const linkPayload = { ledgerTransactionId: "trust-transfer-fresh-link-posting" };
    const missingLinkSession = await linkServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      payload: linkPayload,
    });
    expect(missingLinkSession.statusCode).toBe(403);
    expect(missingLinkSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const staleLinkSession = await linkServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      headers: await freshAuthHeaders(linkRepository, {
        freshAuthenticatedAt: staleFreshAuthenticatedAt(),
      }),
      payload: linkPayload,
    });
    expect(staleLinkSession.statusCode).toBe(403);
    expect(staleLinkSession.json()).toMatchObject({
      message: "Fresh session authentication is required for this credential operation",
    });

    const freshLinkSession = await linkServer.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      headers: await freshAuthHeaders(linkRepository),
      payload: linkPayload,
    });
    expect(freshLinkSession.statusCode).toBe(200);
    expect(freshLinkSession.json()).toMatchObject({
      id: "trust-transfer-request-001",
      status: "linked",
      reviewedByUserId: "user-admin",
      ledgerTransactionId: "trust-transfer-fresh-link-posting",
    });
  });

  it("approves pending trust transfer requests without linking or posting ledger entries", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const ledgerBefore = await repository.getLedger("firm-west-legal");

    const response = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/approve",
      headers: await freshAuthHeaders(repository),
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
    const reconciledPayment = await invoiceServer.inject({
      method: "POST",
      url: "/api/payments/payment-before-trust-transfer-approval/reconcile",
      headers: await freshAuthHeaders(invoiceRepository),
      payload: {
        reconciledAt: "2026-06-16T13:00:00.000Z",
        evidence: { source: "synthetic-trust-transfer-balance-proof" },
      },
    });
    expect(reconciledPayment.statusCode).toBe(200);
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
      headers: await freshAuthHeaders(repository),
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
      headers: await freshAuthHeaders(repository),
    });
    await postSyntheticTrustTransferLedger(repository);
    const link = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests/trust-transfer-request-001/link",
      headers: await freshAuthHeaders(repository),
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
      headers: await freshAuthHeaders(repository),
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
      headers: await freshAuthHeaders(repository),
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
        categoryCode: "filing_service",
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
        categoryCode: "courier_postage",
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

    const paymentRequest = await server.inject({
      method: "POST",
      url: "/api/billing/payment-requests",
      payload: {
        id: "payment-request-audit-route-test",
        matterId: "matter-001",
        invoiceId: "invoice-audit-route-test",
        amountCents: 3000,
        evidence: { source: "synthetic-payment-request-audit" },
      },
    });
    expect(paymentRequest.statusCode).toBe(200);

    const paymentRequestUpdate = await server.inject({
      method: "PATCH",
      url: "/api/billing/payment-requests/payment-request-audit-route-test",
      payload: {
        status: "sent",
        delivery: {
          status: "sent",
          channel: "email",
          recipientCount: 1,
          deliveredAt: "2026-04-07T17:05:00.000Z",
          lastAttemptAt: "2026-04-07T17:05:00.000Z",
        },
      },
    });
    expect(paymentRequestUpdate.statusCode).toBe(200);

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

    const reconciledPayment = await server.inject({
      method: "POST",
      url: "/api/payments/payment-audit-route-test/reconcile",
      headers: await freshAuthHeaders(repository),
      payload: {
        reconciledAt: "2026-06-16T13:00:00.000Z",
        notes: "Synthetic reviewer note.",
        evidence: { source: "synthetic-reviewer-evidence" },
      },
    });
    expect(reconciledPayment.statusCode).toBe(200);

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
          action: "hosted_payment_request.created",
          resourceId: "payment-request-audit-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-audit-route-test",
            amountCents: 3000,
            status: "ready_to_send",
            evidencePresent: true,
          }),
        }),
        expect.objectContaining({
          action: "hosted_payment_request.state_updated",
          resourceId: "payment-request-audit-route-test",
          metadata: expect.objectContaining({
            previousStatus: "ready_to_send",
            status: "sent",
            deliveryStatus: "sent",
          }),
        }),
        expect.objectContaining({
          action: "manual_payment.created",
          resourceId: "payment-audit-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-audit-route-test",
            amountCents: 2500,
            status: "pending_reconciliation",
            allocationCount: 0,
          }),
        }),
        expect.objectContaining({
          action: "manual_payment.reconciled",
          resourceId: "payment-audit-route-test",
          metadata: expect.objectContaining({
            matterId: "matter-001",
            invoiceId: "invoice-audit-route-test",
            amountCents: 2500,
            status: "received",
            allocationCount: 1,
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
        "hosted_payment_request.",
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
