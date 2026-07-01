import type {
  PaymentImportDepositMatchReviewRecord,
  PaymentImportRefundChargebackResolutionRecord,
  PaymentImportRefundChargebackReviewRecord,
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

export interface PaymentImportRefundChargebackReviewListOptions {
  matterId?: string;
  paymentImportReviewRecordId?: string;
  category?: PaymentImportRefundChargebackReviewRecord["category"];
  decision?: PaymentImportRefundChargebackReviewRecord["decision"];
}

export interface PaymentImportRefundChargebackResolutionRecordListOptions {
  matterId?: string;
  paymentImportReviewRecordId?: string;
  category?: PaymentImportRefundChargebackResolutionRecord["category"];
  resolutionPosture?: PaymentImportRefundChargebackResolutionRecord["resolutionPosture"];
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
  createPaymentImportRefundChargebackReview(
    record: PaymentImportRefundChargebackReviewRecord,
  ): Promise<PaymentImportRefundChargebackReviewRecord>;
  listPaymentImportRefundChargebackReviews(
    firmId: string,
    options?: PaymentImportRefundChargebackReviewListOptions,
  ): Promise<PaymentImportRefundChargebackReviewRecord[]>;
  createPaymentImportRefundChargebackResolutionRecord(
    record: PaymentImportRefundChargebackResolutionRecord,
  ): Promise<PaymentImportRefundChargebackResolutionRecord>;
  listPaymentImportRefundChargebackResolutionRecords(
    firmId: string,
    options?: PaymentImportRefundChargebackResolutionRecordListOptions,
  ): Promise<PaymentImportRefundChargebackResolutionRecord[]>;
}
