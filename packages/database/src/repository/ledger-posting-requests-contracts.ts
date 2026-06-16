import type { LedgerPostingRequestRecord, PostedLedgerTransaction } from "@open-practice/domain";

export interface ApproveLedgerPostingRequestResult {
  request: LedgerPostingRequestRecord;
  postedTransaction: PostedLedgerTransaction;
}

export interface LedgerPostingRequestRepository {
  prepareLedgerPostingRequest(
    request: LedgerPostingRequestRecord,
  ): Promise<LedgerPostingRequestRecord>;
  getLedgerPostingRequest(
    firmId: string,
    id: string,
  ): Promise<LedgerPostingRequestRecord | undefined>;
  listLedgerPostingRequests(
    firmId: string,
    options?: {
      matterId?: string;
      status?: LedgerPostingRequestRecord["status"];
      idempotencyKey?: string;
    },
  ): Promise<LedgerPostingRequestRecord[]>;
  approveLedgerPostingRequest(
    firmId: string,
    id: string,
    input: {
      reviewedByUserId: string;
      reviewedAt: string;
      reviewNotes?: string;
    },
  ): Promise<ApproveLedgerPostingRequestResult>;
  rejectLedgerPostingRequest(
    firmId: string,
    id: string,
    input: {
      reviewedByUserId: string;
      reviewedAt: string;
      rejectionReason: string;
      reviewNotes?: string;
    },
  ): Promise<LedgerPostingRequestRecord>;
}
