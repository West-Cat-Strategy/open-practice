import type { TrustTransferRequestRecord } from "@open-practice/domain";

export type TrustTransferRequestUpdate = Partial<
  Pick<
    TrustTransferRequestRecord,
    "status" | "reviewedByUserId" | "reviewedAt" | "ledgerTransactionId" | "evidence"
  >
>;

export interface TrustTransferRequestUpdateOptions {
  expectedStatus?: TrustTransferRequestRecord["status"];
  requireLedgerTransactionUnlinked?: boolean;
}

export interface TrustTransferRequestRepository {
  createTrustTransferRequest(
    request: TrustTransferRequestRecord,
  ): Promise<TrustTransferRequestRecord>;
  getTrustTransferRequest(
    firmId: string,
    requestId: string,
  ): Promise<TrustTransferRequestRecord | undefined>;
  listTrustTransferRequests(
    firmId: string,
    options?: { matterId?: string; status?: TrustTransferRequestRecord["status"] },
  ): Promise<TrustTransferRequestRecord[]>;
  updateTrustTransferRequest(
    firmId: string,
    requestId: string,
    updates: TrustTransferRequestUpdate,
    options?: TrustTransferRequestUpdateOptions,
  ): Promise<TrustTransferRequestRecord>;
}
