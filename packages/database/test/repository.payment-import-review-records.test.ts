import { describe, expect, it } from "vitest";
import {
  defaultPaymentImportReviewBoundary,
  type PaymentImportReviewRecord,
} from "@open-practice/domain";
import {
  createDrizzlePaymentImportReviewRecord,
  listDrizzlePaymentImportReviewRecords,
} from "../src/repository/payment-import-review-records/drizzle.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { IdempotencyKeyConflictError } from "../src/repository/contracts.js";
import type { OpenPracticeDatabase } from "../src/runtime.js";
import * as schema from "../src/schema.js";

function paymentImportReviewRecord(
  overrides: Partial<PaymentImportReviewRecord> = {},
): PaymentImportReviewRecord {
  return {
    id: "payment-import-review-test",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    providerLabel: "synthetic_processor",
    eventFamily: "payment",
    eventStatus: "payment_observed",
    externalEventId: "evt_synthetic_import_review_test",
    externalPaymentId: "pay_synthetic_import_review_test",
    amountCents: 13230,
    currency: "CAD",
    observedAt: "2026-06-19T16:00:00.000Z",
    importedAt: "2026-06-19T16:05:00.000Z",
    importedByUserId: "user-licensee",
    candidateInvoiceId: "invoice-001",
    candidateHostedPaymentRequestId: "payment-request-001",
    candidateManualPaymentId: "payment-001",
    reviewState: "needs_review",
    normalizedEvidenceFingerprint: "synthetic-fingerprint",
    boundaries: defaultPaymentImportReviewBoundary(),
    updatedAt: "2026-06-19T16:05:00.000Z",
    ...overrides,
  };
}

function rowFromRecord(record: PaymentImportReviewRecord) {
  return {
    id: record.id,
    firmId: record.firmId,
    matterId: record.matterId,
    providerLabel: record.providerLabel,
    eventFamily: record.eventFamily,
    eventStatus: record.eventStatus,
    externalEventId: record.externalEventId,
    externalPaymentId: record.externalPaymentId ?? null,
    externalDepositId: record.externalDepositId ?? null,
    amountCents: record.amountCents,
    currency: record.currency,
    observedAt: record.observedAt ? new Date(record.observedAt) : null,
    importedAt: new Date(record.importedAt),
    importedByUserId: record.importedByUserId,
    candidateInvoiceId: record.candidateInvoiceId ?? null,
    candidateHostedPaymentRequestId: record.candidateHostedPaymentRequestId ?? null,
    candidateManualPaymentId: record.candidateManualPaymentId ?? null,
    duplicateOfRecordId: record.duplicateOfRecordId ?? null,
    conflictReason: record.conflictReason ?? null,
    reviewState: record.reviewState,
    normalizedEvidenceFingerprint: record.normalizedEvidenceFingerprint,
    boundaries: record.boundaries,
    updatedAt: new Date(record.updatedAt),
  } satisfies typeof schema.paymentImportReviewRecords.$inferSelect;
}

function drizzleRowsDb(rows: Array<typeof schema.paymentImportReviewRecords.$inferSelect>) {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => rows,
        }),
      }),
    }),
  } as unknown as OpenPracticeDatabase;
  return db;
}

function drizzleExistingDb(row: typeof schema.paymentImportReviewRecords.$inferSelect) {
  const db = {
    select: () => ({
      from: () => ({
        where: async () => [row],
      }),
    }),
  } as unknown as OpenPracticeDatabase;
  return db;
}

describe("payment import review record repositories", () => {
  it("stores normalized memory records and reuses identical provider evidence", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const record = paymentImportReviewRecord();
    const invoiceBefore = await repository.getInvoice("firm-west-legal", "invoice-001");

    await expect(repository.createPaymentImportReviewRecord(record)).resolves.toEqual(record);
    await expect(
      repository.createPaymentImportReviewRecord({ ...record, id: "payment-import-review-retry" }),
    ).resolves.toEqual(record);
    await expect(
      repository.createPaymentImportReviewRecord({
        ...record,
        normalizedEvidenceFingerprint: "changed-fingerprint",
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);

    await expect(
      repository.listPaymentImportReviewRecords("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual(expect.arrayContaining([record]));
    await expect(
      repository.listPaymentImportReviewRecords("firm-west-legal", {
        candidateManualPaymentId: "payment-001",
      }),
    ).resolves.toEqual([record]);
    await expect(repository.getInvoice("firm-west-legal", "invoice-001")).resolves.toMatchObject({
      paidCents: invoiceBefore?.paidCents,
      balanceDueCents: invoiceBefore?.balanceDueCents,
      status: invoiceBefore?.status,
    });
  });

  it("reuses identical Drizzle rows and rejects conflicting evidence before insert", async () => {
    const record = paymentImportReviewRecord();
    const db = drizzleExistingDb(rowFromRecord(record));

    await expect(createDrizzlePaymentImportReviewRecord(db, record)).resolves.toEqual(record);
    await expect(
      createDrizzlePaymentImportReviewRecord(db, {
        ...record,
        normalizedEvidenceFingerprint: "changed-fingerprint",
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
  });

  it("lists Drizzle rows through normalized repository options", async () => {
    const records = [
      paymentImportReviewRecord({
        id: "payment-import-review-later",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalDepositId: "dep_synthetic_import_review_test",
      }),
      paymentImportReviewRecord({
        id: "payment-import-review-earlier",
        eventFamily: "deposit",
        eventStatus: "deposit_observed",
        externalDepositId: "dep_synthetic_import_review_earlier",
        importedAt: "2026-06-18T16:05:00.000Z",
      }),
    ];
    const db = drizzleRowsDb(records.map(rowFromRecord));

    await expect(
      listDrizzlePaymentImportReviewRecords(db, "firm-west-legal", {
        eventFamily: "deposit",
        candidateManualPaymentId: "payment-001",
      }),
    ).resolves.toEqual(records);
  });
});
