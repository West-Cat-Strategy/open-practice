import { describe, expect, it } from "vitest";
import {
  listDrizzleInvoices,
  listDrizzlePayments,
} from "../src/repository/billing-invoices-payments/drizzle.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import type { OpenPracticeDatabase } from "../src/runtime.js";
import * as schema from "../src/schema.js";

type BillingListTable =
  | typeof schema.invoices
  | typeof schema.invoiceLines
  | typeof schema.manualPayments
  | typeof schema.paymentAllocations;

function drizzleBillingListDb(input: {
  rows: Map<BillingListTable, Record<string, unknown>[]>;
  queriedTables: string[];
}) {
  const tableNames = new Map<BillingListTable, string>([
    [schema.invoices, "invoices"],
    [schema.invoiceLines, "invoice_lines"],
    [schema.manualPayments, "manual_payments"],
    [schema.paymentAllocations, "payment_allocations"],
  ]);
  const db = {
    select: () => ({
      from: (table: BillingListTable) => ({
        where: async () => {
          input.queriedTables.push(tableNames.get(table) ?? "unknown");
          return input.rows.get(table) ?? [];
        },
      }),
    }),
  } as unknown as OpenPracticeDatabase;
  return db;
}

describe("repository billing invoices and manual payments", () => {
  it("does not query invoice lines when the selected invoice set is empty", async () => {
    const queriedTables: string[] = [];
    const db = drizzleBillingListDb({
      queriedTables,
      rows: new Map([[schema.invoices, []]]),
    });

    await expect(
      listDrizzleInvoices(db, "firm-west-legal", { matterId: "matter-no-invoices" }),
    ).resolves.toEqual([]);
    expect(queriedTables).toEqual(["invoices"]);
  });

  it("does not query payment allocations when the selected payment set is empty", async () => {
    const queriedTables: string[] = [];
    const db = drizzleBillingListDb({
      queriedTables,
      rows: new Map([[schema.manualPayments, []]]),
    });

    await expect(
      listDrizzlePayments(db, "firm-west-legal", { matterId: "matter-no-payments" }),
    ).resolves.toEqual([]);
    expect(queriedTables).toEqual(["manual_payments"]);
  });

  it("keeps pending manual payments from changing invoice balance until reconciliation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const invoiceBefore = (await repository.getInvoice("firm-west-legal", "invoice-001"))!;

    const pending = await repository.createPayment({
      payment: {
        id: "payment-pending-reconciliation",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        clientContactId: "contact-ada",
        receivedAt: "2026-06-16T12:00:00.000Z",
        amountCents: 2500,
        method: "eft",
        reference: "SYNTH-RECON-1",
        status: "pending_reconciliation",
        receivedByUserId: "user-licensee",
        evidence: { source: "synthetic-payment-evidence" },
      },
      allocations: [],
    });

    const invoiceAfterPending = (await repository.getInvoice("firm-west-legal", "invoice-001"))!;
    expect(pending).toMatchObject({
      id: "payment-pending-reconciliation",
      status: "pending_reconciliation",
      allocations: [],
    });
    expect(invoiceAfterPending).toMatchObject({
      status: invoiceBefore.status,
      paidCents: invoiceBefore.paidCents,
      balanceDueCents: invoiceBefore.balanceDueCents,
    });

    const reconciled = await repository.reconcilePayment({
      firmId: "firm-west-legal",
      paymentId: "payment-pending-reconciliation",
      reconciledByUserId: "user-admin",
      reconciledAt: "2026-06-16T13:00:00.000Z",
      notes: "Synthetic reviewer note.",
      evidence: { source: "synthetic-reviewer-evidence" },
    });
    const invoiceAfterReconcile = (await repository.getInvoice("firm-west-legal", "invoice-001"))!;
    expect(reconciled).toMatchObject({
      id: "payment-pending-reconciliation",
      status: "received",
      reconciledByUserId: "user-admin",
      reconciliationEvidence: { source: "synthetic-reviewer-evidence" },
      allocations: [expect.objectContaining({ invoiceId: "invoice-001", amountCents: 2500 })],
    });
    expect(invoiceAfterReconcile).toMatchObject({
      paidCents: invoiceBefore.paidCents + 2500,
      balanceDueCents: invoiceBefore.balanceDueCents - 2500,
      status: "partially_paid",
    });

    await expect(
      repository.reconcilePayment({
        firmId: "firm-west-legal",
        paymentId: "payment-pending-reconciliation",
        reconciledByUserId: "user-admin",
        reconciledAt: "2026-06-16T14:00:00.000Z",
      }),
    ).rejects.toThrow("Manual payment is not pending reconciliation");
  });

  it("rejects reconciliation when the current invoice balance no longer covers the payment", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const invoice = (await repository.getInvoice("firm-west-legal", "invoice-001"))!;

    await repository.createPayment({
      payment: {
        id: "payment-over-balance-reconciliation",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        invoiceId: "invoice-001",
        receivedAt: "2026-06-16T12:00:00.000Z",
        amountCents: invoice.balanceDueCents + 1,
        method: "eft",
        status: "pending_reconciliation",
        receivedByUserId: "user-licensee",
        evidence: {},
      },
      allocations: [],
    });

    await expect(
      repository.reconcilePayment({
        firmId: "firm-west-legal",
        paymentId: "payment-over-balance-reconciliation",
        reconciledByUserId: "user-admin",
        reconciledAt: "2026-06-16T13:00:00.000Z",
      }),
    ).rejects.toThrow("Payment allocation exceeds invoice balance");
  });
});
