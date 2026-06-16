import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository billing invoices and manual payments", () => {
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
