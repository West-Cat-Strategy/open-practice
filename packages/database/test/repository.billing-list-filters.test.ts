import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

const firmId = "firm-west-legal";

function invoice(id: string, matterId: string) {
  return {
    id,
    firmId,
    matterId,
    invoiceNumber: `INV-SYN-${id}`,
    status: "issued" as const,
    createdByUserId: "user-admin",
    createdAt: "2026-05-02T12:00:00.000Z",
    subtotalCents: 1000,
    taxCents: 0,
    totalCents: 1000,
    paidCents: 0,
    balanceDueCents: 1000,
  };
}

function payment(id: string, matterId: string, invoiceId: string) {
  return {
    id,
    firmId,
    matterId,
    invoiceId,
    receivedAt: "2026-05-03T12:00:00.000Z",
    amountCents: 250,
    method: "eft" as const,
    status: "pending_reconciliation" as const,
    receivedByUserId: "user-admin",
    evidence: { source: "synthetic-payment-filter" },
  };
}

describe("repository billing list filters", () => {
  it("filters internal billing lists by matterIds and lets matterId win", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createTimeEntry({
      id: "time-matter-002-filter",
      firmId,
      matterId: "matter-002",
      userId: "user-admin",
      performedAt: "2026-05-01T16:00:00.000Z",
      minutes: 25,
      rateCents: 18000,
      narrative: "Synthetic matterIds filter time.",
      billable: true,
      billingStatus: "approved",
    });
    await repository.createExpenseEntry({
      id: "expense-matter-002-filter",
      firmId,
      matterId: "matter-002",
      incurredAt: "2026-05-01T18:00:00.000Z",
      amountCents: 1600,
      category: "Courier",
      description: "Synthetic matterIds filter expense.",
      reimbursable: true,
      billingStatus: "approved",
    });
    await repository.createInvoice({
      invoice: invoice("invoice-matter-001-filter", "matter-001"),
      lines: [],
    });
    await repository.createInvoice({
      invoice: invoice("invoice-matter-002-filter", "matter-002"),
      lines: [],
    });
    await repository.createPayment({
      payment: payment("payment-matter-001-filter", "matter-001", "invoice-matter-001-filter"),
      allocations: [],
    });
    await repository.createPayment({
      payment: payment("payment-matter-002-filter", "matter-002", "invoice-matter-002-filter"),
      allocations: [],
    });

    await expect(repository.listTimeEntries(firmId, { matterIds: [] })).resolves.toEqual([]);
    await expect(repository.listExpenseEntries(firmId, { matterIds: [] })).resolves.toEqual([]);
    await expect(repository.listInvoices(firmId, { matterIds: [] })).resolves.toEqual([]);
    await expect(repository.listPayments(firmId, { matterIds: [] })).resolves.toEqual([]);

    const timeEntryIds = (
      await repository.listTimeEntries(firmId, { matterIds: ["matter-001"] })
    ).map((entry) => entry.id);
    const expenseEntryIds = (
      await repository.listExpenseEntries(firmId, { matterIds: ["matter-001"] })
    ).map((entry) => entry.id);
    const invoiceIds = (await repository.listInvoices(firmId, { matterIds: ["matter-001"] })).map(
      (record) => record.id,
    );
    const paymentIds = (await repository.listPayments(firmId, { matterIds: ["matter-001"] })).map(
      (record) => record.id,
    );

    expect(timeEntryIds).toContain("time-001");
    expect(timeEntryIds).not.toContain("time-matter-002-filter");
    expect(expenseEntryIds).toContain("expense-001");
    expect(expenseEntryIds).not.toContain("expense-matter-002-filter");
    expect(invoiceIds).toContain("invoice-matter-001-filter");
    expect(invoiceIds).not.toContain("invoice-matter-002-filter");
    expect(paymentIds).toContain("payment-matter-001-filter");
    expect(paymentIds).not.toContain("payment-matter-002-filter");

    expect(
      (
        await repository.listTimeEntries(firmId, {
          matterId: "matter-001",
          matterIds: ["matter-002"],
        })
      ).map((entry) => entry.id),
    ).not.toContain("time-matter-002-filter");
    expect(
      (
        await repository.listExpenseEntries(firmId, {
          matterId: "matter-001",
          matterIds: ["matter-002"],
        })
      ).map((entry) => entry.id),
    ).not.toContain("expense-matter-002-filter");
    expect(
      (
        await repository.listInvoices(firmId, { matterId: "matter-001", matterIds: ["matter-002"] })
      ).map((record) => record.id),
    ).not.toContain("invoice-matter-002-filter");
    expect(
      (
        await repository.listPayments(firmId, { matterId: "matter-001", matterIds: ["matter-002"] })
      ).map((record) => record.id),
    ).not.toContain("payment-matter-002-filter");
  });
});
