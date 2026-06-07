import type { TrustTransferRequestRecord } from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  TrustTransferRequestUpdate,
  TrustTransferRequestUpdateOptions,
} from "../trust-transfer-requests-contracts.js";

export interface MemoryTrustTransferRequestStore {
  trustTransferRequests: TrustTransferRequestRecord[];
}

export function createMemoryTrustTransferRequest(
  store: MemoryTrustTransferRequestStore,
  request: TrustTransferRequestRecord,
): TrustTransferRequestRecord {
  store.trustTransferRequests = [...store.trustTransferRequests, clone(request)];
  return clone(request);
}

export function getMemoryTrustTransferRequest(
  store: MemoryTrustTransferRequestStore,
  firmId: string,
  requestId: string,
): TrustTransferRequestRecord | undefined {
  return clone(
    store.trustTransferRequests.find(
      (request) => request.firmId === firmId && request.id === requestId,
    ),
  );
}

export function listMemoryTrustTransferRequests(
  store: MemoryTrustTransferRequestStore,
  firmId: string,
  options: { matterId?: string; status?: TrustTransferRequestRecord["status"] } = {},
): TrustTransferRequestRecord[] {
  return clone(
    store.trustTransferRequests.filter(
      (request) =>
        request.firmId === firmId &&
        (!options.matterId || request.matterId === options.matterId) &&
        (!options.status || request.status === options.status),
    ),
  );
}

export function updateMemoryTrustTransferRequest(
  store: MemoryTrustTransferRequestStore,
  firmId: string,
  requestId: string,
  updates: TrustTransferRequestUpdate,
  options: TrustTransferRequestUpdateOptions = {},
): TrustTransferRequestRecord {
  const existing = getMemoryTrustTransferRequest(store, firmId, requestId);
  if (!existing) throw new Error("Trust transfer request was not found");
  if (
    (options.expectedStatus && existing.status !== options.expectedStatus) ||
    (options.requireLedgerTransactionUnlinked && existing.ledgerTransactionId)
  ) {
    throw new Error("Trust transfer request update conflict");
  }
  const updated: TrustTransferRequestRecord = { ...existing, ...updates };
  store.trustTransferRequests = store.trustTransferRequests.map((request) =>
    request.firmId === firmId && request.id === requestId ? clone(updated) : request,
  );
  return clone(updated);
}
