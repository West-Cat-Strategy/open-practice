import type {
  PaymentImportDepositMatchReviewRecord,
  PaymentImportRefundChargebackResolutionRecord,
  PaymentImportRefundChargebackReviewRecord,
  PaymentImportReviewRecord,
} from "@open-practice/domain";
import { IdempotencyKeyConflictError, clone } from "../contracts.js";
import type {
  PaymentImportDepositMatchReviewListOptions,
  PaymentImportRefundChargebackResolutionRecordListOptions,
  PaymentImportRefundChargebackReviewListOptions,
  PaymentImportReviewRecordListOptions,
} from "../payment-import-review-records-contracts.js";

export interface MemoryPaymentImportReviewRecordStore {
  paymentImportReviewRecords: PaymentImportReviewRecord[];
  paymentImportDepositMatchReviews: PaymentImportDepositMatchReviewRecord[];
  paymentImportRefundChargebackReviews: PaymentImportRefundChargebackReviewRecord[];
  paymentImportRefundChargebackResolutionRecords: PaymentImportRefundChargebackResolutionRecord[];
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
    (!options.candidateManualPaymentId ||
      record.candidateManualPaymentId === options.candidateManualPaymentId) &&
    (!options.eventFamily || record.eventFamily === options.eventFamily)
  );
}

function matchesDepositMatchReviewOptions(
  record: PaymentImportDepositMatchReviewRecord,
  options: PaymentImportDepositMatchReviewListOptions,
): boolean {
  return (
    (!options.matterId || record.matterId === options.matterId) &&
    (!options.paymentImportReviewRecordId ||
      record.paymentImportReviewRecordId === options.paymentImportReviewRecordId) &&
    (!options.candidateManualPaymentId ||
      record.candidateManualPaymentId === options.candidateManualPaymentId) &&
    (!options.decision || record.decision === options.decision)
  );
}

function matchesRefundChargebackReviewOptions(
  record: PaymentImportRefundChargebackReviewRecord,
  options: PaymentImportRefundChargebackReviewListOptions,
): boolean {
  return (
    (!options.matterId || record.matterId === options.matterId) &&
    (!options.paymentImportReviewRecordId ||
      record.paymentImportReviewRecordId === options.paymentImportReviewRecordId) &&
    (!options.category || record.category === options.category) &&
    (!options.decision || record.decision === options.decision)
  );
}

function matchesRefundChargebackResolutionRecordOptions(
  record: PaymentImportRefundChargebackResolutionRecord,
  options: PaymentImportRefundChargebackResolutionRecordListOptions,
): boolean {
  return (
    (!options.matterId || record.matterId === options.matterId) &&
    (!options.paymentImportReviewRecordId ||
      record.paymentImportReviewRecordId === options.paymentImportReviewRecordId) &&
    (!options.category || record.category === options.category) &&
    (!options.resolutionPosture || record.resolutionPosture === options.resolutionPosture)
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

export function getMemoryPaymentImportReviewRecord(
  store: MemoryPaymentImportReviewRecordStore,
  firmId: string,
  recordId: string,
): PaymentImportReviewRecord | undefined {
  return clone(
    store.paymentImportReviewRecords.find(
      (record) => record.firmId === firmId && record.id === recordId,
    ),
  );
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

export function createMemoryPaymentImportDepositMatchReview(
  store: MemoryPaymentImportReviewRecordStore,
  record: PaymentImportDepositMatchReviewRecord,
): PaymentImportDepositMatchReviewRecord {
  const existing = store.paymentImportDepositMatchReviews.find(
    (candidate) =>
      candidate.firmId === record.firmId &&
      candidate.paymentImportReviewRecordId === record.paymentImportReviewRecordId &&
      candidate.idempotencyKey === record.idempotencyKey,
  );
  if (existing) {
    if (existing.decisionFingerprint !== record.decisionFingerprint) {
      throw new IdempotencyKeyConflictError();
    }
    return clone(existing);
  }
  store.paymentImportDepositMatchReviews = [
    ...store.paymentImportDepositMatchReviews,
    clone(record),
  ];
  return clone(record);
}

export function listMemoryPaymentImportDepositMatchReviews(
  store: MemoryPaymentImportReviewRecordStore,
  firmId: string,
  options: PaymentImportDepositMatchReviewListOptions = {},
): PaymentImportDepositMatchReviewRecord[] {
  return clone(
    store.paymentImportDepositMatchReviews
      .filter(
        (record) => record.firmId === firmId && matchesDepositMatchReviewOptions(record, options),
      )
      .sort((left, right) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt)),
  );
}

export function createMemoryPaymentImportRefundChargebackReview(
  store: MemoryPaymentImportReviewRecordStore,
  record: PaymentImportRefundChargebackReviewRecord,
): PaymentImportRefundChargebackReviewRecord {
  const existing = store.paymentImportRefundChargebackReviews.find(
    (candidate) =>
      candidate.firmId === record.firmId &&
      candidate.paymentImportReviewRecordId === record.paymentImportReviewRecordId &&
      candidate.idempotencyKey === record.idempotencyKey,
  );
  if (existing) {
    if (existing.decisionFingerprint !== record.decisionFingerprint) {
      throw new IdempotencyKeyConflictError();
    }
    return clone(existing);
  }
  store.paymentImportRefundChargebackReviews = [
    ...store.paymentImportRefundChargebackReviews,
    clone(record),
  ];
  return clone(record);
}

export function listMemoryPaymentImportRefundChargebackReviews(
  store: MemoryPaymentImportReviewRecordStore,
  firmId: string,
  options: PaymentImportRefundChargebackReviewListOptions = {},
): PaymentImportRefundChargebackReviewRecord[] {
  return clone(
    store.paymentImportRefundChargebackReviews
      .filter(
        (record) =>
          record.firmId === firmId && matchesRefundChargebackReviewOptions(record, options),
      )
      .sort((left, right) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt)),
  );
}

export function createMemoryPaymentImportRefundChargebackResolutionRecord(
  store: MemoryPaymentImportReviewRecordStore,
  record: PaymentImportRefundChargebackResolutionRecord,
): PaymentImportRefundChargebackResolutionRecord {
  const existing = store.paymentImportRefundChargebackResolutionRecords.find(
    (candidate) =>
      candidate.firmId === record.firmId &&
      candidate.paymentImportReviewRecordId === record.paymentImportReviewRecordId &&
      candidate.idempotencyKey === record.idempotencyKey,
  );
  if (existing) {
    if (existing.resolutionFingerprint !== record.resolutionFingerprint) {
      throw new IdempotencyKeyConflictError();
    }
    return clone(existing);
  }
  store.paymentImportRefundChargebackResolutionRecords = [
    ...store.paymentImportRefundChargebackResolutionRecords,
    clone(record),
  ];
  return clone(record);
}

export function listMemoryPaymentImportRefundChargebackResolutionRecords(
  store: MemoryPaymentImportReviewRecordStore,
  firmId: string,
  options: PaymentImportRefundChargebackResolutionRecordListOptions = {},
): PaymentImportRefundChargebackResolutionRecord[] {
  return clone(
    store.paymentImportRefundChargebackResolutionRecords
      .filter(
        (record) =>
          record.firmId === firmId &&
          matchesRefundChargebackResolutionRecordOptions(record, options),
      )
      .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt)),
  );
}
