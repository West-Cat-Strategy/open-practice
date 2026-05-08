import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import { createApiServer } from "../server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

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
