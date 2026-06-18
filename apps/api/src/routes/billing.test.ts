import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { PaymentProcessorCheckoutSessionInput } from "@open-practice/domain";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];
type QueuedReportJob = { name: string; data: unknown; jobId?: string };

function futureIso(msFromNow = 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString();
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

  it("denies billing export requests to non-billing roles", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/billing/export-requests",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { matterId: "matter-001" },
    });

    expect(response.statusCode).toBe(403);
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
    const reconciledPayment = await invoiceServer.inject({
      method: "POST",
      url: "/api/payments/payment-before-trust-transfer-approval/reconcile",
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
