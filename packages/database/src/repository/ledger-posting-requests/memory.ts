import {
  ledgerTransactionFromPostingRequest,
  validateLedgerPostingRequestRecord,
  type LedgerAccount,
  type LedgerPostingRequestRecord,
  type PostedLedgerTransaction,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { ApproveLedgerPostingRequestResult } from "../ledger-posting-requests-contracts.js";
import { postMemoryLedgerTransaction } from "../ledger-core/memory.js";

export interface MemoryLedgerPostingRequestStore {
  ledgerAccounts: LedgerAccount[];
  postedTransactions: PostedLedgerTransaction[];
  ledgerPostingRequests: LedgerPostingRequestRecord[];
}

export function prepareMemoryLedgerPostingRequest(
  store: MemoryLedgerPostingRequestStore,
  request: LedgerPostingRequestRecord,
): LedgerPostingRequestRecord {
  validateLedgerPostingRequestRecord(request);
  const duplicate = store.ledgerPostingRequests.find(
    (candidate) =>
      candidate.firmId === request.firmId && candidate.idempotencyKey === request.idempotencyKey,
  );
  if (duplicate) {
    if (duplicate.requestFingerprint !== request.requestFingerprint) {
      throw new Error("Idempotency key was reused with a different ledger payload");
    }
    return clone(duplicate);
  }
  store.ledgerPostingRequests = [...store.ledgerPostingRequests, clone(request)];
  return clone(request);
}

export function getMemoryLedgerPostingRequest(
  store: MemoryLedgerPostingRequestStore,
  firmId: string,
  requestId: string,
): LedgerPostingRequestRecord | undefined {
  return clone(
    store.ledgerPostingRequests.find(
      (request) => request.firmId === firmId && request.id === requestId,
    ),
  );
}

export function listMemoryLedgerPostingRequests(
  store: MemoryLedgerPostingRequestStore,
  firmId: string,
  options: {
    matterId?: string;
    status?: LedgerPostingRequestRecord["status"];
    idempotencyKey?: string;
  } = {},
): LedgerPostingRequestRecord[] {
  return clone(
    store.ledgerPostingRequests
      .filter(
        (request) =>
          request.firmId === firmId &&
          (!options.matterId || request.matterIds.includes(options.matterId)) &&
          (!options.status || request.status === options.status) &&
          (!options.idempotencyKey || request.idempotencyKey === options.idempotencyKey),
      )
      .sort((left, right) => Date.parse(left.preparedAt) - Date.parse(right.preparedAt)),
  );
}

export function approveMemoryLedgerPostingRequest(
  store: MemoryLedgerPostingRequestStore,
  firmId: string,
  requestId: string,
  input: {
    reviewedByUserId: string;
    reviewedAt: string;
    reviewNotes?: string;
  },
): ApproveLedgerPostingRequestResult {
  const existing = getMemoryLedgerPostingRequest(store, firmId, requestId);
  if (!existing) throw new Error("Ledger posting request was not found");
  if (existing.status === "posted" && existing.ledgerTransactionId) {
    const postedTransaction = store.postedTransactions.find(
      (transaction) =>
        transaction.firmId === firmId && transaction.id === existing.ledgerTransactionId,
    );
    if (!postedTransaction) throw new Error("Ledger posting request ledger transaction is missing");
    return { request: existing, postedTransaction: clone(postedTransaction) };
  }
  if (existing.status !== "pending_approval") {
    throw new Error("Ledger posting request is not pending approval");
  }
  if (existing.preparedByUserId === input.reviewedByUserId) {
    throw new Error("Ledger posting request requires checker approval by a different user");
  }

  const postedTransaction = postMemoryLedgerTransaction(
    {
      ledgerAccounts: store.ledgerAccounts,
      postedTransactions: store.postedTransactions,
      matters: [],
      contacts: [],
      matterParties: [],
    },
    ledgerTransactionFromPostingRequest(existing, {
      postedByUserId: input.reviewedByUserId,
      postedAt: existing.proposedPostedAt,
    }),
  );
  store.postedTransactions = reconcilePostedTransaction(
    store.postedTransactions,
    postedTransaction,
  );

  const postedRequest: LedgerPostingRequestRecord = {
    ...existing,
    status: "posted",
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: input.reviewedAt,
    reviewNotes: input.reviewNotes,
    ledgerTransactionId: postedTransaction.id,
  };
  validateLedgerPostingRequestRecord(postedRequest);
  store.ledgerPostingRequests = store.ledgerPostingRequests.map((request) =>
    request.firmId === firmId && request.id === requestId ? clone(postedRequest) : request,
  );
  return { request: clone(postedRequest), postedTransaction: clone(postedTransaction) };
}

export function rejectMemoryLedgerPostingRequest(
  store: MemoryLedgerPostingRequestStore,
  firmId: string,
  requestId: string,
  input: {
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason: string;
    reviewNotes?: string;
  },
): LedgerPostingRequestRecord {
  const existing = getRequiredPendingPostingRequest(store, firmId, requestId);
  if (existing.preparedByUserId === input.reviewedByUserId) {
    throw new Error("Ledger posting request requires checker approval by a different user");
  }

  const rejectedRequest: LedgerPostingRequestRecord = {
    ...existing,
    status: "rejected",
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: input.reviewedAt,
    reviewNotes: input.reviewNotes,
    rejectionReason: input.rejectionReason,
  };
  validateLedgerPostingRequestRecord(rejectedRequest);
  store.ledgerPostingRequests = store.ledgerPostingRequests.map((request) =>
    request.firmId === firmId && request.id === requestId ? clone(rejectedRequest) : request,
  );
  return clone(rejectedRequest);
}

function getRequiredPendingPostingRequest(
  store: MemoryLedgerPostingRequestStore,
  firmId: string,
  requestId: string,
): LedgerPostingRequestRecord {
  const request = getMemoryLedgerPostingRequest(store, firmId, requestId);
  if (!request) throw new Error("Ledger posting request was not found");
  if (request.status !== "pending_approval") {
    throw new Error("Ledger posting request is not pending approval");
  }
  return request;
}

function reconcilePostedTransaction(
  postedTransactions: PostedLedgerTransaction[],
  postedTransaction: PostedLedgerTransaction,
): PostedLedgerTransaction[] {
  if (postedTransactions.some((transaction) => transaction.id === postedTransaction.id)) {
    return postedTransactions;
  }
  return [...postedTransactions, clone(postedTransaction)];
}
