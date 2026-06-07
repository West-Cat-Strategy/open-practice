import {
  shouldUpdateSignatureRequestStatus,
  type SignatureProviderEventRecord,
  type SignatureRequestRecord,
  type SignatureRequestSignerRecord,
  type SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type { SignatureRequestCreateInput } from "../signatures-contracts.js";

export interface MemorySignatureStore {
  signatureRequests: SignatureRequestRecord[];
  signatureRequestSigners: SignatureRequestSignerRecord[];
  signatureProviderEvents: SignatureProviderEventRecord[];
  signatureWebhookAttempts: SignatureWebhookAttemptRecord[];
}

export function listMemorySignatureRequests(
  store: MemorySignatureStore,
  firmId: string,
  options: { matterId?: string } = {},
): SignatureRequestRecord[] {
  return clone(
    store.signatureRequests.filter(
      (request) =>
        request.firmId === firmId && (!options.matterId || request.matterId === options.matterId),
    ),
  );
}

export function listMemorySignatureRequestSigners(
  store: MemorySignatureStore,
  firmId: string,
  signatureRequestId: string,
): SignatureRequestSignerRecord[] {
  return clone(
    store.signatureRequestSigners.filter(
      (signer) => signer.firmId === firmId && signer.signatureRequestId === signatureRequestId,
    ),
  );
}

export function createMemorySignatureRequest(
  store: MemorySignatureStore,
  input: SignatureRequestCreateInput,
): { request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] } {
  store.signatureRequests = [...store.signatureRequests, clone(input.request)];
  store.signatureRequestSigners = [...store.signatureRequestSigners, ...clone(input.signers)];
  store.signatureProviderEvents = [...store.signatureProviderEvents, clone(input.event)];
  return { request: clone(input.request), signers: clone(input.signers) };
}

export function recordMemorySignatureProviderEvent(
  store: MemorySignatureStore,
  event: SignatureProviderEventRecord,
  webhookAttempt?: SignatureWebhookAttemptRecord,
): SignatureProviderEventRecord {
  store.signatureProviderEvents = [...store.signatureProviderEvents, clone(event)];
  if (webhookAttempt) {
    store.signatureWebhookAttempts = [...store.signatureWebhookAttempts, clone(webhookAttempt)];
  }
  store.signatureRequests = store.signatureRequests.map((request) => {
    if (request.firmId !== event.firmId || request.id !== event.signatureRequestId) {
      return request;
    }
    if (!shouldUpdateSignatureRequestStatus(request.status, event)) {
      return request;
    }
    return {
      ...request,
      status: event.status,
      completedAt: event.status === "completed" ? event.occurredAt : request.completedAt,
      declinedAt: event.status === "declined" ? event.occurredAt : request.declinedAt,
      evidence: event.evidence,
    };
  });
  return clone(event);
}

export function recordMemorySignatureWebhookAttempt(
  store: MemorySignatureStore,
  attempt: SignatureWebhookAttemptRecord,
): SignatureWebhookAttemptRecord {
  store.signatureWebhookAttempts = [...store.signatureWebhookAttempts, clone(attempt)];
  return clone(attempt);
}

export function listMemorySignatureProviderEvents(
  store: MemorySignatureStore,
  firmId: string,
  options: { signatureRequestId?: string } = {},
): SignatureProviderEventRecord[] {
  return clone(
    store.signatureProviderEvents.filter(
      (event) =>
        event.firmId === firmId &&
        (!options.signatureRequestId || event.signatureRequestId === options.signatureRequestId),
    ),
  );
}

export function listMemorySignatureWebhookAttempts(
  store: MemorySignatureStore,
  firmId: string,
  options: { provider?: SignatureWebhookAttemptRecord["provider"]; externalId?: string } = {},
): SignatureWebhookAttemptRecord[] {
  return clone(
    store.signatureWebhookAttempts.filter(
      (attempt) =>
        attempt.firmId === firmId &&
        (!options.provider || attempt.provider === options.provider) &&
        (!options.externalId || attempt.externalId === options.externalId),
    ),
  );
}
