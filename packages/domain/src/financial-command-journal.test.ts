import { describe, expect, it } from "vitest";
import { appendAuditEvent, type AuditEvent } from "./audit.js";
import {
  buildFinancialCommandJournal,
  financialCommandJournalActions,
} from "./financial-command-journal.js";

function auditEvent(input: {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}): AuditEvent {
  return appendAuditEvent(undefined, {
    id: input.id,
    firmId: "firm-west-legal",
    actorId: "user-admin",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    occurredAt: input.occurredAt,
    metadata: input.metadata,
  });
}

describe("financial command journal", () => {
  it("exports the audit actions used by the journal projection", () => {
    expect(financialCommandJournalActions).toEqual([
      "trust_transfer_request.approved",
      "trust_transfer_request.rejected",
      "trust_transfer_request.linked",
      "ledger.transaction_approval.decided",
      "invoice.approved",
      "ledger.reconciliation.created",
      "ledger.reconciliation_exception_resolution.recorded",
      "manual_payment.reconciled",
    ]);
  });

  it("builds an ordered review-only projection from allowlisted audit metadata", () => {
    const journal = buildFinancialCommandJournal({
      audit: {
        valid: false,
        events: [
          auditEvent({
            id: "audit-ledger-posted",
            action: "ledger.transaction.posted",
            resourceType: "ledger_transaction",
            resourceId: "ledger-transaction-001",
            occurredAt: "2026-06-16T16:00:00.000Z",
            metadata: {
              transactionId: "ledger-transaction-001",
              matterIds: ["matter-001", "matter-001"],
              accountIds: ["acct-trust-bank", "acct-client-liability"],
              status: "posted",
              entryCount: 2,
              memo: "Synthetic ledger memo must stay out of the journal.",
            },
          }),
          auditEvent({
            id: "audit-ledger-approval",
            action: "ledger.transaction_approval.decided",
            resourceType: "ledger_transaction_approval",
            resourceId: "approval-001",
            occurredAt: "2026-06-16T16:05:00.000Z",
            metadata: {
              transactionId: "ledger-transaction-001",
              matterIds: ["matter-001"],
              decision: "approved",
              notes: "Synthetic approval notes must stay out of the journal.",
            },
          }),
          auditEvent({
            id: "audit-trust-transfer",
            action: "trust_transfer_request.approved",
            resourceType: "trust_transfer_request",
            resourceId: "trust-transfer-001",
            occurredAt: "2026-06-16T16:10:00.000Z",
            metadata: {
              matterId: "matter-001",
              trustTransferRequestId: "trust-transfer-001",
              invoiceId: "invoice-001",
              previousStatus: "pending_approval",
              status: "approved",
              amountCents: 12000,
              evidencePresent: true,
              evidence: { private: true },
            },
          }),
          auditEvent({
            id: "audit-invoice-approval",
            action: "invoice.approved",
            resourceType: "invoice",
            resourceId: "invoice-001",
            occurredAt: "2026-06-16T16:15:00.000Z",
            metadata: {
              matterId: "matter-001",
              invoiceId: "invoice-001",
              previousStatus: "draft",
              status: "approved",
              totalCents: 12000,
              balanceDueCents: 12000,
              narrative: "Synthetic invoice narrative must stay out of the journal.",
            },
          }),
          auditEvent({
            id: "audit-manual-payment",
            action: "manual_payment.reconciled",
            resourceType: "manual_payment",
            resourceId: "payment-001",
            occurredAt: "2026-06-16T16:20:00.000Z",
            metadata: {
              matterId: "matter-001",
              paymentId: "payment-001",
              invoiceId: "invoice-001",
              status: "received",
              amountCents: 5000,
              allocationCount: 1,
              evidencePresent: true,
              receiptBody: "Synthetic receipt body must stay out of the journal.",
            },
          }),
          auditEvent({
            id: "audit-reconciliation",
            action: "ledger.reconciliation.created",
            resourceType: "ledger_reconciliation",
            resourceId: "reconciliation-001",
            occurredAt: "2026-06-16T16:25:00.000Z",
            metadata: {
              accountId: "acct-trust-bank",
              status: "exception",
              statementRowCount: 4,
              matchedStatementRowCount: 3,
              unmatchedStatementRowCount: 1,
              varianceCents: -250,
              statementRows: ["Synthetic statement row must stay out of the journal."],
            },
          }),
          auditEvent({
            id: "audit-exception-resolution",
            action: "ledger.reconciliation_exception_resolution.recorded",
            resourceType: "ledger_reconciliation_exception_resolution",
            resourceId: "exception-resolution-001",
            occurredAt: "2026-06-16T16:30:00.000Z",
            metadata: {
              accountId: "acct-trust-bank",
              statementRowId: "statement-row-001",
              varianceDecision: "needs_follow_up",
              resolutionNote: "Synthetic resolution note must stay out of the journal.",
            },
          }),
          auditEvent({
            id: "audit-unknown",
            action: "financial.private_note.recorded",
            resourceType: "private_financial_note",
            resourceId: "private-note-001",
            occurredAt: "2026-06-16T16:35:00.000Z",
            metadata: {
              matterId: "matter-001",
              privateNote: "Synthetic private note must stay out of the journal.",
            },
          }),
        ],
      },
    });

    expect(journal).toMatchObject({
      scope: { kind: "firm" },
      chainValid: false,
      reviewOnly: true,
      summary: {
        total: 6,
        byFamily: {
          trust_transfer: 1,
          trust_transaction: 1,
          invoice_approval: 1,
          reconciliation: 3,
        },
        byDecision: {
          approved: 3,
          reconciled: 1,
          exception: 1,
          needs_follow_up: 1,
        },
      },
    });
    expect(journal.entries.map((entry) => entry.auditEventId)).toEqual([
      "audit-exception-resolution",
      "audit-reconciliation",
      "audit-manual-payment",
      "audit-invoice-approval",
      "audit-trust-transfer",
      "audit-ledger-approval",
    ]);
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditEventId: "audit-exception-resolution",
          family: "reconciliation",
          decision: "needs_follow_up",
          statementRowId: "statement-row-001",
        }),
      ]),
    );
    const serialized = JSON.stringify(journal);
    expect(serialized).not.toContain("Synthetic ledger memo");
    expect(serialized).not.toContain("audit-ledger-posted");
    expect(serialized).not.toContain("Synthetic approval notes");
    expect(serialized).not.toContain("Synthetic invoice narrative");
    expect(serialized).not.toContain("Synthetic receipt body");
    expect(serialized).not.toContain("Synthetic statement row");
    expect(serialized).not.toContain("Synthetic resolution note");
    expect(serialized).not.toContain("Synthetic private note");
  });

  it("filters matter-scoped journal entries without adding account-only reconciliations", () => {
    const journal = buildFinancialCommandJournal({
      audit: {
        valid: true,
        events: [
          auditEvent({
            id: "audit-matter-invoice",
            action: "invoice.approved",
            resourceType: "invoice",
            resourceId: "invoice-001",
            occurredAt: "2026-06-16T16:00:00.000Z",
            metadata: { matterId: "matter-001", invoiceId: "invoice-001" },
          }),
          auditEvent({
            id: "audit-matter-ledger",
            action: "ledger.transaction_approval.decided",
            resourceType: "ledger_transaction_approval",
            resourceId: "approval-001",
            occurredAt: "2026-06-16T16:05:00.000Z",
            metadata: {
              matterIds: ["matter-001"],
              transactionId: "ledger-001",
              decision: "approved",
            },
          }),
          auditEvent({
            id: "audit-account-reconciliation",
            action: "ledger.reconciliation.created",
            resourceType: "ledger_reconciliation",
            resourceId: "reconciliation-001",
            occurredAt: "2026-06-16T16:10:00.000Z",
            metadata: { accountId: "acct-trust-bank", status: "matched" },
          }),
          auditEvent({
            id: "audit-hidden-transfer",
            action: "trust_transfer_request.rejected",
            resourceType: "trust_transfer_request",
            resourceId: "trust-transfer-hidden",
            occurredAt: "2026-06-16T16:15:00.000Z",
            metadata: { matterId: "matter-002", trustTransferRequestId: "trust-transfer-hidden" },
          }),
        ],
      },
      matterId: "matter-001",
    });

    expect(journal.scope).toEqual({ kind: "matter", matterId: "matter-001" });
    expect(journal.summary.total).toBe(2);
    expect(journal.entries.map((entry) => entry.auditEventId).sort()).toEqual([
      "audit-matter-invoice",
      "audit-matter-ledger",
    ]);
    expect(JSON.stringify(journal)).not.toContain("reconciliation-001");
    expect(JSON.stringify(journal)).not.toContain("trust-transfer-hidden");
  });
});
