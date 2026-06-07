import type { HostedPaymentRequestRecord } from "@open-practice/domain";

export type HostedPaymentRequestUpdate = Partial<
  Pick<
    HostedPaymentRequestRecord,
    | "status"
    | "delivery"
    | "reminder"
    | "paymentPlan"
    | "creditWriteOffPosture"
    | "processor"
    | "evidence"
    | "expiresAt"
    | "updatedAt"
  >
>;

export interface HostedPaymentRequestRepository {
  createHostedPaymentRequest(
    request: HostedPaymentRequestRecord,
  ): Promise<HostedPaymentRequestRecord>;
  getHostedPaymentRequest(
    firmId: string,
    requestId: string,
  ): Promise<HostedPaymentRequestRecord | undefined>;
  listHostedPaymentRequests(
    firmId: string,
    options?: {
      matterId?: string;
      invoiceId?: string;
      status?: HostedPaymentRequestRecord["status"];
    },
  ): Promise<HostedPaymentRequestRecord[]>;
  updateHostedPaymentRequest(
    firmId: string,
    requestId: string,
    updates: HostedPaymentRequestUpdate,
  ): Promise<HostedPaymentRequestRecord>;
}
