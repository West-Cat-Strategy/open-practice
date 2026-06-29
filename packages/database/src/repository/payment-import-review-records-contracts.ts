import type {
  PaymentImportDepositMatchReviewRecord,
  PaymentImportReviewRecord,
} from "@open-practice/domain";

export interface PaymentImportReviewRecordListOptions {
  matterId?: string;
  candidateInvoiceId?: string;
  candidateHostedPaymentRequestId?: string;
  candidateManualPaymentId?: string;
  eventFamily?: PaymentImportReviewRecord["eventFamily"];
}

export interface PaymentImportDepositMatchReviewListOptions {
  matterId?: string;
  paymentImportReviewRecordId?: string;
  candidateManualPaymentId?: string;
  decision?: PaymentImportDepositMatchReviewRecord["decision"];
}

export interface PaymentImportReviewRecordRepository {
  createPaymentImportReviewRecord(
    record: PaymentImportReviewRecord,
  ): Promise<PaymentImportReviewRecord>;
  getPaymentImportReviewRecord(
    firmId: string,
    recordId: string,
  ): Promise<PaymentImportReviewRecord | undefined>;
  listPaymentImportReviewRecords(
    firmId: string,
    options?: PaymentImportReviewRecordListOptions,
  ): Promise<PaymentImportReviewRecord[]>;
  createPaymentImportDepositMatchReview(
    record: PaymentImportDepositMatchReviewRecord,
  ): Promise<PaymentImportDepositMatchReviewRecord>;
  listPaymentImportDepositMatchReviews(
    firmId: string,
    options?: PaymentImportDepositMatchReviewListOptions,
  ): Promise<PaymentImportDepositMatchReviewRecord[]>;
}
