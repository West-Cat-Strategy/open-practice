import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  documents,
  intakeSessions,
  signatureProviderEvents,
  signatureRequestSigners,
  signatureRequests,
  trustLedgerEntries,
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
      expect.arrayContaining(["upload_status", "checksum_status", "scan_status", "verified_at"]),
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
});
