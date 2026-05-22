export type ProviderSettingKind =
  | "smtp"
  | "inbound_email"
  | "ai"
  | "ocr"
  | "transcription"
  | "media"
  | "storage";

export interface ProviderSettingRecord {
  id: string;
  firmId: string;
  kind: ProviderSettingKind;
  key: string;
  enabled: boolean;
  encryptedConfig: string;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorType =
  | "calendar"
  | "document_processing"
  | "email"
  | "generic"
  | "inbound_email";

export type ConnectorStatus = "disabled" | "enabled" | "paused" | "error";

export interface ConnectorSecretReference {
  id: string;
  label?: string;
  version?: string;
  lastRotatedAt?: string;
}

export interface ConnectorRecord {
  id: string;
  firmId: string;
  type: ConnectorType;
  key: string;
  displayName: string;
  status: ConnectorStatus;
  secretReference?: ConnectorSecretReference;
  configSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type OpenPracticeQueueName =
  | "email"
  | "connectors"
  | "inbound_email"
  | "reports"
  | "ai_triage"
  | "ocr"
  | "transcription"
  | "media";

export type OpenPracticeJobStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "dead_letter"
  | "skipped";

export interface JobLifecycleRecord {
  id: string;
  firmId: string;
  queueName: OpenPracticeQueueName;
  jobName: string;
  bullJobId?: string;
  idempotencyKey?: string;
  status: OpenPracticeJobStatus;
  targetResourceType?: string;
  targetResourceId?: string;
  attemptsMade: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export type ConnectorOutboxStatus =
  | "pending"
  | "leased"
  | "delivered"
  | "failed"
  | "dead_letter"
  | "cancelled";

export interface ConnectorOutboxRecord {
  id: string;
  firmId: string;
  connectorId: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  idempotencyKey: string;
  status: ConnectorOutboxStatus;
  payloadSummary: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  leaseId?: string;
  leasedUntil?: string;
  deliveredAt?: string;
  deadLetteredAt?: string;
  lastErrorSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorDeliveryAttemptStatus = "leased" | "delivered" | "failed";

export interface ConnectorDeliveryAttemptRecord {
  id: string;
  firmId: string;
  connectorId: string;
  outboxId: string;
  attemptNumber: number;
  status: ConnectorDeliveryAttemptStatus;
  idempotencyKey: string;
  leaseId?: string;
  startedAt: string;
  finishedAt?: string;
  errorSummary?: string;
  metadata: Record<string, unknown>;
}

export interface EmailOutboxRecord {
  id: string;
  firmId: string;
  matterId: string;
  idempotencyKey?: string;
  templateKey: string;
  status: "queued" | "sending" | "sent" | "failed" | "cancelled";
  to: string[];
  cc: string[];
  bcc: string[];
  from: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  queuedAt: string;
  sentAt?: string;
  failedAt?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  terminalFailureAt?: string;
  terminalFailureReason?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface EmailReceiptTokenRecord {
  id: string;
  firmId: string;
  matterId: string;
  emailId: string;
  tokenHash: string;
  purpose: "delivery_receipt";
  expiresAt: string;
  recordedAt?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface EmailEventRecord {
  id: string;
  firmId: string;
  emailId: string;
  eventType:
    | "queued"
    | "sending"
    | "sent"
    | "failed"
    | "bounced"
    | "complained"
    | "opened"
    | "clicked"
    | "receipt_recorded";
  occurredAt: string;
  providerMessageId?: string;
  attemptNumber?: number;
  jobId?: string;
  source: "api" | "worker" | "provider";
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface InboundEmailAddressRecord {
  id: string;
  firmId: string;
  address: string;
  matterId?: string;
  enabled: boolean;
  createdAt: string;
}

export interface InboundEmailMessageRecord {
  id: string;
  firmId: string;
  addressId?: string;
  matterId?: string;
  messageId?: string;
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  receivedAt: string;
  rawStorageKey: string;
  parsedText?: string;
  parsedHtmlStorageKey?: string;
  labels: string[];
  status: "received" | "parsed" | "triage_pending" | "triaged" | "rejected";
  metadata: Record<string, unknown>;
}

export interface InboundEmailAttachmentRecord {
  id: string;
  firmId: string;
  inboundMessageId: string;
  documentId?: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  storageKey: string;
  checksumSha256?: string;
}

export interface AiTriageRecord {
  id: string;
  firmId: string;
  sourceType: "inbound_email" | "document" | "note";
  sourceId: string;
  provider: "ollama" | "lm_studio" | "openai_compatible";
  model: string;
  status: "pending" | "completed" | "failed" | "reviewed";
  classification?: "client" | "court" | "internal" | "spam" | "unknown";
  confidence?: number;
  extractedEntities: Record<string, unknown>;
  suggestedActions: string[];
  suggestedDraft?: string;
  createdAt: string;
  completedAt?: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
}

export interface DocumentVersionRecord {
  id: string;
  firmId: string;
  documentId: string;
  version: number;
  storageKey?: string;
  editorJson?: Record<string, unknown>;
  createdByUserId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface DocumentTextExtractionRecord {
  id: string;
  firmId: string;
  documentId: string;
  engine: "tesseract" | "ocrmypdf" | "vision_llm" | "manual";
  status: "queued" | "completed" | "failed";
  language: string;
  confidence?: number;
  textStorageKey?: string;
  extractedText?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface MediaTranscriptRecord {
  id: string;
  firmId: string;
  documentId: string;
  engine: "whisper_cpp" | "faster_whisper" | "manual";
  model: string;
  status: "queued" | "completed" | "failed";
  transcriptStorageKey?: string;
  text?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface MediaDerivativeRecord {
  id: string;
  firmId: string;
  documentId: string;
  kind: "thumbnail" | "stream" | "proxy" | "waveform";
  storageKey: string;
  contentType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ShareLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  tokenHash: string;
  grantedByUserId: string;
  permissions: Array<"view_documents" | "upload_documents" | "message" | "sign">;
  expiresAt?: string;
  revokedAt?: string;
  requireEmailVerification: boolean;
  createdAt: string;
}

export interface ExternalUploadLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  tokenHash: string;
  idempotencyKey?: string;
  requestedByUserId: string;
  expiresAt: string;
  maxUploads: number;
  usedUploads: number;
  createdAt: string;
  revokedAt?: string;
}

export interface AccessLogRecord {
  id: string;
  firmId: string;
  actorId?: string;
  shareLinkId?: string;
  externalUploadLinkId?: string;
  intakeFormLinkId?: string;
  resourceType: string;
  resourceId: string;
  action: "view" | "download" | "upload" | "message" | "sign" | "submit" | "draft";
  occurredAt: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
}

export interface WebAuthnCredentialRecord {
  id: string;
  firmId: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  createdAt: string;
  lastUsedAt?: string;
  disabledAt?: string;
}

export interface WebAuthnChallengeRecord {
  id: string;
  firmId?: string;
  userId?: string;
  challengeHash: string;
  purpose: "passkey_registration" | "passkey_authentication" | "totp_setup";
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

export interface AuthActionTokenRecord {
  id: string;
  firmId: string;
  userId: string;
  tokenHash: string;
  purpose: "password_reset" | "magic_link" | "account_recovery" | "email_verification";
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

export interface TotpCredentialRecord {
  id: string;
  firmId: string;
  userId: string;
  encryptedSecret: string;
  label: string;
  verifiedAt?: string;
  disabledAt?: string;
  createdAt: string;
}

export interface RecoveryCodeRecord {
  id: string;
  firmId: string;
  userId: string;
  codeHash: string;
  usedAt?: string;
  createdAt: string;
}

export interface MailSender {
  send(message: {
    firmId: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ providerMessageId?: string }>;
}

export interface InboundEmailParser {
  parse(input: { firmId: string; rawContent: Uint8Array }): Promise<{
    messageId?: string;
    subject: string;
    fromAddress: string;
    toAddresses: string[];
    text?: string;
    html?: string;
    attachments: Array<{
      filename: string;
      contentType?: string;
      sizeBytes?: number;
      checksumSha256: string;
      content: Uint8Array;
    }>;
  }>;
}

export interface AiTriageProvider {
  triage(input: {
    firmId: string;
    sourceType: AiTriageRecord["sourceType"];
    sourceId: string;
    text: string;
  }): Promise<
    Pick<
      AiTriageRecord,
      "classification" | "confidence" | "extractedEntities" | "suggestedActions" | "suggestedDraft"
    >
  >;
}

export interface OcrProvider {
  extractText(input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
    language: string;
  }): Promise<Pick<DocumentTextExtractionRecord, "confidence" | "extractedText" | "metadata">>;
}

export interface TranscriptionProvider {
  transcribe(input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
  }): Promise<Pick<MediaTranscriptRecord, "text" | "metadata">>;
}

export interface MediaProcessor {
  createDerivatives(input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
  }): Promise<MediaDerivativeRecord[]>;
}
