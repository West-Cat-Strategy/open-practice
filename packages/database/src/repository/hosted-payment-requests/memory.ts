import type { HostedPaymentRequestRecord } from "@open-practice/domain";
import type { HostedPaymentRequestUpdate } from "../hosted-payment-requests-contracts.js";
import { clone } from "../contracts.js";

export interface MemoryHostedPaymentRequestStore {
  hostedPaymentRequests: HostedPaymentRequestRecord[];
}

export function createMemoryHostedPaymentRequest(
  store: MemoryHostedPaymentRequestStore,
  request: HostedPaymentRequestRecord,
): HostedPaymentRequestRecord {
  store.hostedPaymentRequests = [...store.hostedPaymentRequests, clone(request)];
  return clone(request);
}

export function getMemoryHostedPaymentRequest(
  store: MemoryHostedPaymentRequestStore,
  firmId: string,
  requestId: string,
): HostedPaymentRequestRecord | undefined {
  return clone(
    store.hostedPaymentRequests.find(
      (request) => request.firmId === firmId && request.id === requestId,
    ),
  );
}

export function listMemoryHostedPaymentRequests(
  store: MemoryHostedPaymentRequestStore,
  firmId: string,
  options: {
    matterId?: string;
    invoiceId?: string;
    status?: HostedPaymentRequestRecord["status"];
  } = {},
): HostedPaymentRequestRecord[] {
  return clone(
    store.hostedPaymentRequests.filter(
      (request) =>
        request.firmId === firmId &&
        (!options.matterId || request.matterId === options.matterId) &&
        (!options.invoiceId || request.invoiceId === options.invoiceId) &&
        (!options.status || request.status === options.status),
    ),
  );
}

export function updateMemoryHostedPaymentRequest(
  store: MemoryHostedPaymentRequestStore,
  firmId: string,
  requestId: string,
  updates: HostedPaymentRequestUpdate,
): HostedPaymentRequestRecord {
  const existing = getMemoryHostedPaymentRequest(store, firmId, requestId);
  if (!existing) throw new Error("Hosted payment request was not found");
  const updated = clone({ ...existing, ...updates });
  store.hostedPaymentRequests = store.hostedPaymentRequests.map((request) =>
    request.firmId === firmId && request.id === requestId ? updated : request,
  );
  return clone(updated);
}
