import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  answerSnapshots,
  authAccounts,
  authPasswordSetupTokens,
  authSessions,
  billingTrustTransferRequests,
  documents,
  invoiceLines,
  invoices,
  intakeSessions,
  manualPayments,
  paymentAllocations,
  signatureProviderEvents,
  signatureRequestSigners,
  signatureRequests,
  trustReconciliations,
  trustLedgerEntries,
  trustTransactionApprovals,
  trustTransactions,
} from "../src/schema.js";

describe("database schema hardening", () => {
  it("requires idempotency request fingerprints on trust transactions", () => {
    const columns = getTableConfig(trustTransactions).columns;
    const fingerprint = columns.find((column) => column.name === "request_fingerprint");

    expect(fingerprint?.notNull).toBe(true);
  });

  it("defines amount integrity checks for trust ledger entries", () => {
    const checks = getTableConfig(trustLedgerEntries).checks.map((check) => check.name);

    expect(checks).toContain("trust_ledger_entries_non_negative_amounts");
    expect(checks).toContain("trust_ledger_entries_one_sided_amount");
  });

  it("tracks document ingestion state", () => {
    const columns = getTableConfig(documents).columns.map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "upload_status",
        "checksum_status",
        "scan_status",
        "supersedes_document_id",
        "superseded_at",
        "verified_at",
      ]),
    );
  });

  it("persists signature lifecycle tables", () => {
    expect(getTableConfig(signatureRequests).columns.map((column) => column.name)).toContain(
      "requested_by_user_id",
    );
    expect(getTableConfig(signatureRequestSigners).columns.map((column) => column.name)).toContain(
      "signature_request_id",
    );
    expect(getTableConfig(signatureProviderEvents).columns.map((column) => column.name)).toContain(
      "occurred_at",
    );
  });

  it("persists guided intake sessions", () => {
    expect(getTableConfig(intakeSessions).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["matter_id", "template_id", "external_id", "status"]),
    );
  });

  it("persists embedded auth accounts and sessions", () => {
    expect(getTableConfig(authAccounts).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "user_id", "password_hash", "password_updated_at"]),
    );
    expect(getTableConfig(authSessions).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "user_id",
        "token_hash",
        "expires_at",
        "revoked_at",
        "last_seen_at",
      ]),
    );
    expect(getTableConfig(authPasswordSetupTokens).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["token_hash", "expires_at", "used_at", "created_by_user_id"]),
    );
  });

  it("persists answer snapshots for intake sessions", () => {
    expect(getTableConfig(answerSnapshots).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "intake_session_id", "captured_at", "answers"]),
    );
  });

  it("persists trust approval and reconciliation controls", () => {
    expect(getTableConfig(trustTransactionApprovals).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["transaction_id", "decision", "decided_by_user_id", "decided_at"]),
    );
    expect(getTableConfig(trustReconciliations).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "statement_period_start",
        "statement_period_end",
        "expected_balance_cents",
        "actual_balance_cents",
        "status",
      ]),
    );
  });

  it("persists native billing workflow tables", () => {
    expect(getTableConfig(invoices).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "matter_id",
        "invoice_number",
        "status",
        "subtotal_cents",
        "tax_cents",
        "total_cents",
        "paid_cents",
        "balance_due_cents",
      ]),
    );
    expect(getTableConfig(invoiceLines).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "invoice_id",
        "kind",
        "tax_name",
        "tax_rate_bps",
        "tax_cents",
        "time_entry_id",
        "expense_entry_id",
      ]),
    );
    expect(getTableConfig(manualPayments).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["received_at", "amount_cents", "method", "received_by_user_id"]),
    );
    expect(getTableConfig(paymentAllocations).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["payment_id", "invoice_id", "amount_cents", "allocated_at"]),
    );
    expect(
      getTableConfig(billingTrustTransferRequests).columns.map((column) => column.name),
    ).toEqual(
      expect.arrayContaining(["invoice_id", "amount_cents", "status", "ledger_transaction_id"]),
    );
  });
});
