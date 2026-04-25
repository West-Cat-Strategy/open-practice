export interface SignatureSigner {
  name: string;
  email: string;
  role: string;
}

export interface CreateSignatureRequestInput {
  matterId: string;
  documentId: string;
  title: string;
  signers: SignatureSigner[];
  consentText: string;
}

export interface SignatureProviderSubmission {
  provider: "docuseal" | "manual";
  externalId: string;
  status?: SignatureProviderStatus;
  signingUrl?: string;
  evidence?: Record<string, unknown>;
}

export interface SignatureProvider {
  createSubmission(input: CreateSignatureRequestInput): Promise<SignatureProviderSubmission>;
  getSubmission?(externalId: string): Promise<SignatureProviderSubmission>;
}

export type SignatureProviderStatus =
  | "draft"
  | "pending_provider_submission"
  | "sent"
  | "viewed"
  | "completed"
  | "declined"
  | "provider_error";

export interface SignatureProviderEvent {
  provider: SignatureProviderSubmission["provider"];
  externalId: string;
  status: SignatureProviderStatus;
  occurredAt: string;
  evidence: Record<string, unknown>;
}

export interface SignatureRequestRecord {
  id: string;
  firmId: string;
  matterId: string;
  documentId: string;
  title: string;
  requestedByUserId: string;
  provider: SignatureProviderSubmission["provider"];
  externalId: string;
  status: SignatureProviderStatus;
  signingUrl?: string;
  consentText: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  declinedAt?: string;
}

export interface SignatureRequestSignerRecord extends SignatureSigner {
  id: string;
  firmId: string;
  signatureRequestId: string;
  status: SignatureProviderStatus;
  signingUrl?: string;
  completedAt?: string;
}

export interface SignatureProviderEventRecord extends SignatureProviderEvent {
  id: string;
  firmId: string;
  signatureRequestId: string;
}

export interface SignatureWebhookAttemptRecord {
  id: string;
  firmId: string;
  provider: SignatureProviderSubmission["provider"];
  externalId: string;
  receivedAt: string;
  processedAt?: string;
  status: "received" | "processed" | "failed";
  errorMessage?: string;
  payload: Record<string, unknown>;
}

export interface StartAutomationInterviewInput {
  firmId: string;
  matterId: string;
  templateId: string;
  clientContactId?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AutomationSessionRef {
  provider: "docassemble" | "manual";
  externalId: string;
  interviewUrl?: string;
  status: "created" | "in_progress" | "ready_to_generate" | "completed" | "provider_error";
  evidence?: Record<string, unknown>;
}

export interface RenderAutomatedDocumentInput {
  firmId: string;
  matterId: string;
  sessionExternalId: string;
  documentTitle: string;
}

export interface GeneratedDocumentRef {
  provider: AutomationSessionRef["provider"];
  externalId: string;
  title: string;
  storageKey?: string;
  checksumSha256?: string;
  evidence?: Record<string, unknown>;
}

export interface DocumentAutomationProvider {
  startInterview(input: StartAutomationInterviewInput): Promise<AutomationSessionRef>;
  getInterviewStatus(externalId: string): Promise<AutomationSessionRef>;
  renderDocument(input: RenderAutomatedDocumentInput): Promise<GeneratedDocumentRef>;
}

export interface IntakeTemplateRecord {
  id: string;
  firmId: string;
  name: string;
  provider: AutomationSessionRef["provider"];
  externalTemplateId: string;
  active: boolean;
}

export interface IntakeSessionRecord {
  id: string;
  firmId: string;
  matterId: string;
  templateId: string;
  provider: AutomationSessionRef["provider"];
  externalId: string;
  status: AutomationSessionRef["status"];
  clientContactId?: string;
  interviewUrl?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerSnapshotRecord {
  id: string;
  firmId: string;
  intakeSessionId: string;
  capturedAt: string;
  answers: Record<string, unknown>;
}

export interface GeneratedDocumentRecord {
  id: string;
  firmId: string;
  matterId: string;
  intakeSessionId: string;
  provider: GeneratedDocumentRef["provider"];
  externalId: string;
  title: string;
  documentId?: string;
  storageKey?: string;
  checksumSha256?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
}
