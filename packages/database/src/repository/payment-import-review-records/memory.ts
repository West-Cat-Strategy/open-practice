import type { PaymentImportReviewRecord } from "@open-practice/domain";
import { IdempotencyKeyConflictError, clone } from "../contracts.js";
import type { PaymentImportReviewRecordListOptions } from "../payment-import-review-records-contracts.js";

export interface MemoryPaymentImportReviewRecordStore {
  paymentImportReviewRecords: PaymentImportReviewRecord[];
}

function matchesOptions(
  record: PaymentImportReviewRecord,
  options: PaymentImportReviewRecordListOptions,
): boolean {
  return (
    (!options.matterId || record.matterId === options.matterId) &&
    (!options.candidateInvoiceId || record.candidateInvoiceId === options.candidateInvoiceId) &&
    (!options.candidateHostedPaymentRequestId ||
      record.candidateHostedPaymentRequestId === options.candidateHostedPaymentRequestId) &&
    (!options.eventFamily || record.eventFamily === options.eventFamily)
  );
}

export function createMemoryPaymentImportReviewRecord(
  store: MemoryPaymentImportReviewRecordStore,
  record: PaymentImportReviewRecord,
): PaymentImportReviewRecord {
  const existing = store.paymentImportReviewRecords.find(
    (candidate) =>
      candidate.firmId === record.firmId &&
      candidate.providerLabel === record.providerLabel &&
      candidate.externalEventId === record.externalEventId,
  );
  if (existing) {
    if (existing.normalizedEvidenceFingerprint !== record.normalizedEvidenceFingerprint) {
      throw new IdempotencyKeyConflictError();
    }
    return clone(existing);
  }
  store.paymentImportReviewRecords = [...store.paymentImportReviewRecords, clone(record)];
  return clone(record);
}

export function listMemoryPaymentImportReviewRecords(
  store: MemoryPaymentImportReviewRecordStore,
  firmId: string,
  options: PaymentImportReviewRecordListOptions = {},
): PaymentImportReviewRecord[] {
  return clone(
    store.paymentImportReviewRecords
      .filter((record) => record.firmId === firmId && matchesOptions(record, options))
      .sort((left, right) => Date.parse(right.importedAt) - Date.parse(left.importedAt)),
  );
}
