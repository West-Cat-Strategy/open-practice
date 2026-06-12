import { describe, expect, it } from "vitest";
import {
  appendAuditEvent,
  calculateInvoiceTotals,
  canAccess,
  postLedgerTransaction,
  runConflictCheck,
  verifyAuditChain,
} from "../src/index.js";

describe("domain package root exports", () => {
  it("keeps high-risk legal-operation helpers available from the package root", () => {
    expect(typeof appendAuditEvent).toBe("function");
    expect(typeof calculateInvoiceTotals).toBe("function");
    expect(typeof canAccess).toBe("function");
    expect(typeof postLedgerTransaction).toBe("function");
    expect(typeof runConflictCheck).toBe("function");
    expect(typeof verifyAuditChain).toBe("function");
  });
});
