import type { PaymentImportReviewRecord } from "@open-practice/domain";

export interface PaymentImportReviewRecordListOptions {
  matterId?: string;
  candidateInvoiceId?: string;
  candidateHostedPaymentRequestId?: string;
  eventFamily?: PaymentImportReviewRecord["eventFamily"];
}

export interface PaymentImportReviewRecordRepository {
  createPaymentImportReviewRecord(
    record: PaymentImportReviewRecord,
  ): Promise<PaymentImportReviewRecord>;
  listPaymentImportReviewRecords(
    firmId: string,
    options?: PaymentImportReviewRecordListOptions,
  ): Promise<PaymentImportReviewRecord[]>;
}
