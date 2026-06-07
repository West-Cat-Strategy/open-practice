import type {
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";

export interface SignatureRequestCreateInput {
  request: SignatureRequestRecord;
  signers: SignatureRequestSignerRecord[];
  event: SignatureProviderEventRecord;
}

export interface SignatureRepository {
  listSignatureRequests(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<SignatureRequestRecord[]>;
  listSignatureRequestSigners(
    firmId: string,
    signatureRequestId: string,
  ): Promise<SignatureRequestSignerRecord[]>;
  createSignatureRequest(
    input: SignatureRequestCreateInput,
  ): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }>;
  recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord>;
  recordSignatureWebhookAttempt(
    attempt: SignatureWebhookAttemptRecord,
  ): Promise<SignatureWebhookAttemptRecord>;
  listSignatureProviderEvents(
    firmId: string,
    options?: { signatureRequestId?: string },
  ): Promise<SignatureProviderEventRecord[]>;
  listSignatureWebhookAttempts(
    firmId: string,
    options?: { provider?: SignatureWebhookAttemptRecord["provider"]; externalId?: string },
  ): Promise<SignatureWebhookAttemptRecord[]>;
}
