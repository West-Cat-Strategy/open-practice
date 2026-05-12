import type {
  AnswerSnapshotRecord,
  DocumentTextExtractionRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import {
  runConflictCheck,
  type AccessLogRecord,
  type ActivityTimelineEntry,
  type AuditEvent,
  type CalendarCredentialRecord,
  type CalendarEventAttendeeRecord,
  type CalendarEventRecord,
  type ConnectorDeliveryAttemptRecord,
  type ConnectorOutboxRecord,
  type ConnectorRecord,
  type Contact,
  type ContactDossier,
  type ConversationThreadRecord,
  type DocumentRecord,
  type DraftAssistRecord,
  type DraftRecord,
  type DraftTemplateRecord,
  type EmailEventRecord,
  type EmailOutboxRecord,
  type ExpenseEntry,
  type ExternalUploadLinkRecord,
  type Firm,
  type FirmSettings,
  type InboundEmailAddressRecord,
  type InboundEmailAttachmentRecord,
  type InboundEmailMessageRecord,
  type IntakeFormItemActionRecord,
  type IntakeFormLinkRecord,
  type IntakeFormReviewRecord,
  type IntakeVariableProposal,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type JobLifecycleRecord,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerReconciliationRecord,
  type LedgerTransaction,
  type LedgerTransactionApprovalRecord,
  type LegalClinicMatterProfile,
  type LegalClinicProgram,
  type ManualPaymentRecord,
  type Matter,
  type MatterParty,
  type NewAuditEvent,
  type PaymentAllocationRecord,
  type PortalGrant,
  type PostedLedgerTransaction,
  type ProviderSettingRecord,
  type RecoveryCodeRecord,
  type SavedOperationalViewDefinition,
  type SavedOperationalViewDefinitionInput,
  type ShareLinkRecord,
  type TaskDeadlineRecord,
  type TimeEntry,
  type TrustTransferRequestRecord,
  type User,
  type WebAuthnChallengeRecord,
  type WebAuthnCredentialRecord,
} from "@open-practice/domain";
export function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

export function dateToIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export interface MatterSummary extends Matter {
  parties: Array<MatterParty & { contact: Contact }>;
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  activity: ActivityTimelineEntry[];
  trustBalanceCents: number;
}

export interface PracticeOverview {
  firm: Firm;
  metrics: {
    openMatters: number;
    intakeMatters: number;
    portalGrants: number;
    trustBalanceCents: number;
    unbilledMinutes: number;
  };
  users: User[];
}

export interface DocumentUploadIntent {
  id: string;
  firmId: string;
  matterId: string;
  title: string;
  storageKey: string;
  checksumSha256: string;
  classification: DocumentRecord["classification"];
  legalHold: boolean;
  reviewStatus?: DocumentRecord["reviewStatus"];
  externalUploadLinkId?: string;
  supersedesDocumentId?: string;
}

export interface InboundAttachmentPromotionInput {
  firmId: string;
  messageId: string;
  attachmentId: string;
  matterId: string;
  title: string;
  classification: DocumentRecord["classification"];
  legalHold: boolean;
  now?: string;
}

export interface InboundAttachmentPromotionResult {
  attachment: InboundEmailAttachmentRecord;
  document: DocumentRecord;
  created: boolean;
}

export interface InvoiceWithLines extends InvoiceRecord {
  lines: InvoiceLineRecord[];
}

export interface PaymentWithAllocations extends ManualPaymentRecord {
  allocations: PaymentAllocationRecord[];
}

export interface AuthAccountRecord {
  firmId: string;
  userId: string;
  passwordHash: string;
  passwordUpdatedAt: string;
}

export interface AuthSessionRecord {
  id: string;
  firmId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastSeenAt?: string;
}

export type CalendarEventUpsertInput = CalendarEventRecord;
export type CalendarEventAttendeeUpsertInput = CalendarEventAttendeeRecord;

export interface TaskDeadlineCompletionInput {
  firmId: string;
  taskId: string;
  completedAt: string;
}

export type ConversationThreadLifecycleAction =
  | "close"
  | "reopen"
  | "revoke_access"
  | "request_export";

export function applyConversationThreadLifecycleAction(
  thread: ConversationThreadRecord,
  input: {
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  },
): ConversationThreadRecord {
  const accessRevoked = thread.status === "revoked" || Boolean(thread.accessRevokedAt);
  if (accessRevoked && input.action === "reopen") {
    throw new Error("CONVERSATION_THREAD_REVOKED");
  }

  const updated: ConversationThreadRecord = {
    ...thread,
    updatedAt: input.occurredAt,
    updatedByUserId: input.actorUserId,
  };

  if (input.action === "close") return accessRevoked ? updated : { ...updated, status: "closed" };
  if (input.action === "reopen") return { ...updated, status: "open" };
  if (input.action === "revoke_access") {
    return {
      ...updated,
      status: "revoked",
      accessRevokedAt: thread.accessRevokedAt ?? input.occurredAt,
    };
  }
  return { ...updated, exportState: "requested" };
}

export class CalendarEventScopeConflictError extends Error {
  constructor(eventId: string) {
    super(`Calendar event ${eventId} already exists in another firm or matter`);
    this.name = "CalendarEventScopeConflictError";
  }
}

export class CalendarEventUidConflictError extends Error {
  constructor(uid: string) {
    super(`Active calendar event UID ${uid} already exists in this matter`);
    this.name = "CalendarEventUidConflictError";
  }
}

export class IdempotencyKeyConflictError extends Error {
  constructor(message = "Idempotency key was reused with a different payload") {
    super(message);
    this.name = "IdempotencyKeyConflictError";
  }
}

export function canonicalizeForIdempotency(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeForIdempotency).join(",")}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeForIdempotency(objectValue[key])}`)
    .join(",")}}`;
}

export function idempotencyFingerprint(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  return typeof metadata?.idempotencyFingerprint === "string"
    ? metadata.idempotencyFingerprint
    : undefined;
}

export function assertSameIdempotencyFingerprint(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
): void {
  const existingFingerprint = idempotencyFingerprint(existing);
  const incomingFingerprint = idempotencyFingerprint(incoming);
  if (existingFingerprint && incomingFingerprint && existingFingerprint !== incomingFingerprint) {
    throw new IdempotencyKeyConflictError();
  }
}

export function isPostgresUniqueViolation(error: unknown, constraintName: string): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (candidate.code === "23505" && candidate.constraint === constraintName) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export interface AuthPasswordSetupTokenRecord {
  id: string;
  firmId: string;
  userId: string;
  tokenHash: string;
  createdByUserId?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface FirstRunSetupStatus {
  required: boolean;
  blocked: boolean;
  reason?: string;
}

export interface FirstRunSetupInput {
  firm: Firm;
  settings: FirmSettings;
  owner: User;
  ownerPasswordHash: string;
  ownerPasswordUpdatedAt: string;
  webAuthnCredential?: WebAuthnCredentialRecord;
  firstContact?: Contact;
  firstMatter?: Matter;
  firstMatterParty?: MatterParty;
  selectedPresetIds?: string[];
  auditEvent: AuditEvent;
}

export interface FirstRunSetupResult {
  firm: Firm;
  settings: FirmSettings;
  owner: User;
  firstMatter?: Matter;
}

export class FirstRunSetupConflictError extends Error {
  constructor(message = "First-run setup is not available") {
    super(message);
    this.name = "FirstRunSetupConflictError";
  }
}

export interface OpenPracticeRepository {
  getSetupStatus(): Promise<FirstRunSetupStatus>;
  completeFirstRunSetup(input: FirstRunSetupInput): Promise<FirstRunSetupResult>;
  getFirmSettings(firmId: string): Promise<FirmSettings | undefined>;
  listProviderSettings(
    firmId: string,
    options?: { kind?: ProviderSettingRecord["kind"] },
  ): Promise<ProviderSettingRecord[]>;
  upsertProviderSetting(setting: ProviderSettingRecord): Promise<ProviderSettingRecord>;
  createConnector(connector: ConnectorRecord): Promise<ConnectorRecord>;
  listConnectors(
    firmId: string,
    options?: { type?: ConnectorRecord["type"]; status?: ConnectorRecord["status"] },
  ): Promise<ConnectorRecord[]>;
  getConnector(firmId: string, connectorId: string): Promise<ConnectorRecord | undefined>;
  createConnectorOutbox(input: ConnectorOutboxRecord): Promise<{
    outbox: ConnectorOutboxRecord;
    created: boolean;
  }>;
  listConnectorOutbox(
    firmId: string,
    options?: {
      connectorId?: string;
      status?: ConnectorOutboxRecord["status"];
      limit?: number;
    },
  ): Promise<ConnectorOutboxRecord[]>;
  createConnectorDeliveryAttempt(
    attempt: ConnectorDeliveryAttemptRecord,
  ): Promise<ConnectorDeliveryAttemptRecord>;
  listConnectorDeliveryAttempts(
    firmId: string,
    options?: { outboxId?: string; connectorId?: string },
  ): Promise<ConnectorDeliveryAttemptRecord[]>;
  createJobLifecycleRecord(record: JobLifecycleRecord): Promise<JobLifecycleRecord>;
  createQueuedEmailOutbox(input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }): Promise<{
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }>;
  getEmailOutbox(firmId: string, emailId: string): Promise<EmailOutboxRecord | undefined>;
  listEmailOutbox(
    firmId: string,
    options?: { matterId?: string; limit?: number },
  ): Promise<EmailOutboxRecord[]>;
  recordEmailDeliveryResult(input: {
    firmId: string;
    emailId: string;
    status: "sending" | "sent" | "failed";
    occurredAt: string;
    providerMessageId?: string;
    attemptNumber?: number;
    jobId?: string;
    source?: EmailEventRecord["source"];
    terminal?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord }>;
  retryEmailOutbox(input: {
    firmId: string;
    emailId: string;
    occurredAt: string;
    requestedByUserId: string;
    job: JobLifecycleRecord;
    metadata?: Record<string, unknown>;
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord; job: JobLifecycleRecord }>;
  listEmailEvents(firmId: string, options?: { emailId?: string }): Promise<EmailEventRecord[]>;
  updateJobLifecycleRecord(
    firmId: string,
    id: string,
    updates: Partial<
      Pick<
        JobLifecycleRecord,
        | "bullJobId"
        | "status"
        | "attemptsMade"
        | "startedAt"
        | "finishedAt"
        | "failedAt"
        | "errorMessage"
        | "metadata"
      >
    >,
  ): Promise<JobLifecycleRecord>;
  listJobLifecycleRecords(
    firmId: string,
    options?: {
      status?: JobLifecycleRecord["status"];
      queueName?: JobLifecycleRecord["queueName"];
    },
  ): Promise<JobLifecycleRecord[]>;
  getUser(firmId: string, userId: string): Promise<User | undefined>;
  createUser(user: User): Promise<User>;
  getUserByEmail(firmId: string, email: string): Promise<User | undefined>;
  getAuthAccount(firmId: string, userId: string): Promise<AuthAccountRecord | undefined>;
  setAuthPassword(input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  }): Promise<AuthAccountRecord>;
  createAuthSession(session: AuthSessionRecord): Promise<AuthSessionRecord>;
  getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined>;
  touchAuthSession(tokenHash: string, seenAt: string): Promise<void>;
  revokeAuthSession(tokenHash: string, revokedAt: string): Promise<void>;
  createPasswordSetupToken(
    token: AuthPasswordSetupTokenRecord,
  ): Promise<AuthPasswordSetupTokenRecord>;
  consumePasswordSetupToken(
    tokenHash: string,
    usedAt: string,
  ): Promise<AuthPasswordSetupTokenRecord | undefined>;
  createWebAuthnChallenge(challenge: WebAuthnChallengeRecord): Promise<WebAuthnChallengeRecord>;
  getWebAuthnChallenge(challengeHash: string): Promise<WebAuthnChallengeRecord | undefined>;
  consumeWebAuthnChallenge(challengeHash: string, consumedAt: string): Promise<boolean>;
  registerWebAuthnCredential(
    credential: WebAuthnCredentialRecord,
  ): Promise<WebAuthnCredentialRecord>;
  listWebAuthnCredentials(firmId: string, userId: string): Promise<WebAuthnCredentialRecord[]>;
  getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined>;
  updateWebAuthnCredentialCounter(id: string, counter: number): Promise<void>;
  deleteWebAuthnCredential(firmId: string, id: string): Promise<void>;
  updateUserMfaStatus(firmId: string, userId: string, mfaEnabled: boolean): Promise<void>;
  createRecoveryCodes(firmId: string, userId: string, codes: RecoveryCodeRecord[]): Promise<void>;
  useRecoveryCode(
    firmId: string,
    userId: string,
    codeHash: string,
    consumedAt: string,
  ): Promise<boolean>;
  listRecoveryCodes(firmId: string, userId: string): Promise<RecoveryCodeRecord[]>;
  getOverview(firmId: string): Promise<PracticeOverview>;
  listMattersForUser(user: User): Promise<MatterSummary[]>;
  listContactDossiersForUser(user: User): Promise<ContactDossier[]>;
  getContact(firmId: string, contactId: string): Promise<Contact | undefined>;
  getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined>;
  listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]>;
  listTaskDeadlines(
    firmId: string,
    options?: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean },
  ): Promise<TaskDeadlineRecord[]>;
  getTaskDeadline(firmId: string, taskId: string): Promise<TaskDeadlineRecord | undefined>;
  createTaskDeadline(task: TaskDeadlineRecord): Promise<TaskDeadlineRecord>;
  completeTaskDeadline(input: TaskDeadlineCompletionInput): Promise<TaskDeadlineRecord | undefined>;
  listConversationThreads(
    firmId: string,
    options?: { matterIds?: string[]; matterId?: string },
  ): Promise<ConversationThreadRecord[]>;
  getConversationThread(
    firmId: string,
    threadId: string,
  ): Promise<ConversationThreadRecord | undefined>;
  createConversationThread(thread: ConversationThreadRecord): Promise<ConversationThreadRecord>;
  updateConversationThreadLifecycle(input: {
    firmId: string;
    threadId: string;
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationThreadRecord | undefined>;
  listLegalClinicPrograms(
    firmId: string,
    options?: { status?: LegalClinicProgram["status"] },
  ): Promise<LegalClinicProgram[]>;
  createLegalClinicProgram(program: LegalClinicProgram): Promise<LegalClinicProgram>;
  getLegalClinicMatterProfile(
    firmId: string,
    matterId: string,
  ): Promise<LegalClinicMatterProfile | undefined>;
  upsertLegalClinicMatterProfile(
    profile: LegalClinicMatterProfile,
  ): Promise<LegalClinicMatterProfile>;
  listCalendarEvents(
    firmId: string,
    options: { matterId: string; startsAfter?: string; startsBefore?: string },
  ): Promise<CalendarEventRecord[]>;
  getCalendarEvent(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventRecord | undefined>;
  getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): Promise<CalendarEventRecord | undefined>;
  upsertCalendarEvent(event: CalendarEventUpsertInput): Promise<CalendarEventRecord>;
  listCalendarEventAttendees(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventAttendeeRecord[]>;
  upsertCalendarEventAttendee(
    attendee: CalendarEventAttendeeUpsertInput,
  ): Promise<CalendarEventAttendeeRecord>;
  deleteCalendarEventAttendee(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    attendeeId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventAttendeeRecord | undefined>;
  replaceCalendarEventAttendees(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    attendees: CalendarEventAttendeeUpsertInput[];
    replacedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventAttendeeRecord[]>;
  deleteCalendarEvent(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventRecord | undefined>;
  createCalendarCredential(credential: CalendarCredentialRecord): Promise<CalendarCredentialRecord>;
  listCalendarCredentials(firmId: string, userId: string): Promise<CalendarCredentialRecord[]>;
  getCalendarCredentialByUsername(username: string): Promise<CalendarCredentialRecord | undefined>;
  touchCalendarCredential(id: string, lastUsedAt: string): Promise<void>;
  revokeCalendarCredential(input: {
    firmId: string;
    userId: string;
    credentialId: string;
    revokedAt: string;
  }): Promise<CalendarCredentialRecord | undefined>;
  runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }>;
  getLedger(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }>;
  validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void>;
  postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction>;
  recordAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }>;
  appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent>;
  listPortalGrants(firmId: string): Promise<PortalGrant[]>;
  listShareLinks(firmId: string, options?: { matterId?: string }): Promise<ShareLinkRecord[]>;
  createShareLink(link: ShareLinkRecord): Promise<ShareLinkRecord>;
  getShareLink(firmId: string, id: string): Promise<ShareLinkRecord | undefined>;
  getShareLinkByTokenHash(tokenHash: string): Promise<ShareLinkRecord | undefined>;
  revokeShareLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ShareLinkRecord | undefined>;
  listExternalUploadLinks(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<ExternalUploadLinkRecord[]>;
  createExternalUploadLink(link: ExternalUploadLinkRecord): Promise<ExternalUploadLinkRecord>;
  listSavedOperationalViewDefinitions(
    firmId: string,
    options: {
      ownerUserId: string;
      surface?: SavedOperationalViewDefinition["surface"];
      includeArchived?: boolean;
    },
  ): Promise<SavedOperationalViewDefinition[]>;
  getSavedOperationalViewDefinition(
    firmId: string,
    id: string,
  ): Promise<SavedOperationalViewDefinition | undefined>;
  createSavedOperationalViewDefinition(
    input: SavedOperationalViewDefinitionInput,
  ): Promise<SavedOperationalViewDefinition>;
  updateSavedOperationalViewDefinition(
    firmId: string,
    id: string,
    updates: Partial<
      Pick<
        SavedOperationalViewDefinition,
        | "name"
        | "filters"
        | "columns"
        | "sort"
        | "rowLimit"
        | "dashboardBehavior"
        | "permissionScope"
        | "updatedAt"
      >
    >,
  ): Promise<SavedOperationalViewDefinition | undefined>;
  archiveSavedOperationalViewDefinition(input: {
    firmId: string;
    id: string;
    archivedAt: string;
  }): Promise<SavedOperationalViewDefinition | undefined>;
  getExternalUploadLinkByTokenHash(
    tokenHash: string,
  ): Promise<ExternalUploadLinkRecord | undefined>;
  revokeExternalUploadLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined>;
  claimExternalUploadUse(input: {
    firmId: string;
    id: string;
    usedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined>;
  createAccessLog(log: AccessLogRecord): Promise<AccessLogRecord>;
  listAccessLogs(
    firmId: string,
    options?: {
      shareLinkId?: string;
      externalUploadLinkId?: string;
      intakeFormLinkId?: string;
      resourceType?: string;
      resourceId?: string;
    },
  ): Promise<AccessLogRecord[]>;
  createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord>;
  completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord>;
  updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord>;
  reviewUploadedDocument(input: {
    firmId: string;
    documentId: string;
    status: DocumentRecord["reviewStatus"];
    decision: DocumentRecord["reviewDecision"];
    reason?: DocumentRecord["reviewReason"];
    metadata: Record<string, unknown>;
    reviewedByUserId: string;
    reviewedAt: string;
  }): Promise<DocumentRecord>;
  listSignatureRequests(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<SignatureRequestRecord[]>;
  listSignatureRequestSigners(
    firmId: string,
    signatureRequestId: string,
  ): Promise<SignatureRequestSignerRecord[]>;
  createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }>;
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
  listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]>;
  createIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord>;
  updateIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord>;
  listIntakeSessions(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<IntakeSessionRecord[]>;
  getIntakeSession(firmId: string, sessionId: string): Promise<IntakeSessionRecord | undefined>;
  createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord>;
  listIntakeFormLinks(
    firmId: string,
    options?: { matterId?: string; intakeSessionId?: string },
  ): Promise<IntakeFormLinkRecord[]>;
  createIntakeFormLink(link: IntakeFormLinkRecord): Promise<IntakeFormLinkRecord>;
  getIntakeFormLink(firmId: string, id: string): Promise<IntakeFormLinkRecord | undefined>;
  getIntakeFormLinkByTokenHash(tokenHash: string): Promise<IntakeFormLinkRecord | undefined>;
  revokeIntakeFormLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  markIntakeFormLinkSubmitted(input: {
    firmId: string;
    id: string;
    submittedAt: string;
    answerSnapshotId: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  reserveIntakeFormLinkSubmission(input: {
    firmId: string;
    id: string;
    clientSubmissionId: string;
    submissionFingerprint: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  saveIntakeFormLinkDraft(input: {
    firmId: string;
    id: string;
    answers: Record<string, unknown>;
    draftUpdatedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined>;
  listIntakeFormReviews(
    firmId: string,
    options?: { matterId?: string; intakeSessionId?: string; formLinkId?: string },
  ): Promise<IntakeFormReviewRecord[]>;
  createIntakeFormReview(review: IntakeFormReviewRecord): Promise<IntakeFormReviewRecord>;
  listIntakeFormItemActions(
    firmId: string,
    options?: { formLinkId?: string; intakeSessionId?: string; itemId?: string },
  ): Promise<IntakeFormItemActionRecord[]>;
  upsertIntakeFormItemAction(
    action: IntakeFormItemActionRecord,
  ): Promise<IntakeFormItemActionRecord>;
  createAnswerSnapshot(snapshot: AnswerSnapshotRecord): Promise<AnswerSnapshotRecord>;
  listAnswerSnapshots(
    firmId: string,
    options?: { intakeSessionId?: string },
  ): Promise<AnswerSnapshotRecord[]>;
  createIntakeVariableProposals(
    proposals: IntakeVariableProposal[],
  ): Promise<IntakeVariableProposal[]>;
  listIntakeVariableProposals(
    firmId: string,
    options?: { matterId?: string; status?: IntakeVariableProposal["status"] },
  ): Promise<IntakeVariableProposal[]>;
  reviewIntakeVariableProposal(input: {
    firmId: string;
    id: string;
    status: "approved" | "rejected";
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason?: string;
  }): Promise<IntakeVariableProposal | undefined>;
  createGeneratedDocument(document: GeneratedDocumentRecord): Promise<GeneratedDocumentRecord>;
  createLedgerTransactionApproval(
    approval: LedgerTransactionApprovalRecord,
  ): Promise<LedgerTransactionApprovalRecord>;
  listLedgerTransactionApprovals(
    firmId: string,
    options?: { transactionId?: string },
  ): Promise<LedgerTransactionApprovalRecord[]>;
  createLedgerReconciliation(
    reconciliation: LedgerReconciliationRecord,
  ): Promise<LedgerReconciliationRecord>;
  listLedgerReconciliations(firmId: string): Promise<LedgerReconciliationRecord[]>;
  listTimeEntries(
    firmId: string,
    options?: { matterId?: string; status?: TimeEntry["billingStatus"] },
  ): Promise<TimeEntry[]>;
  getTimeEntry(firmId: string, entryId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: TimeEntry): Promise<TimeEntry>;
  updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Partial<
      Pick<
        TimeEntry,
        "performedAt" | "minutes" | "rateCents" | "narrative" | "billable" | "billingStatus"
      >
    >,
  ): Promise<TimeEntry>;
  listExpenseEntries(
    firmId: string,
    options?: { matterId?: string; status?: ExpenseEntry["billingStatus"] },
  ): Promise<ExpenseEntry[]>;
  getExpenseEntry(firmId: string, entryId: string): Promise<ExpenseEntry | undefined>;
  createExpenseEntry(entry: ExpenseEntry): Promise<ExpenseEntry>;
  updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Partial<
      Pick<
        ExpenseEntry,
        "incurredAt" | "amountCents" | "category" | "description" | "reimbursable" | "billingStatus"
      >
    >,
  ): Promise<ExpenseEntry>;
  listInvoices(
    firmId: string,
    options?: { matterId?: string; status?: InvoiceRecord["status"] },
  ): Promise<InvoiceWithLines[]>;
  getInvoice(firmId: string, invoiceId: string): Promise<InvoiceWithLines | undefined>;
  createInvoice(input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  }): Promise<InvoiceWithLines>;
  updateInvoice(invoice: InvoiceRecord): Promise<InvoiceWithLines>;
  createPayment(input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  }): Promise<PaymentWithAllocations>;
  listPayments(
    firmId: string,
    options?: { matterId?: string; invoiceId?: string },
  ): Promise<PaymentWithAllocations[]>;
  createTrustTransferRequest(
    request: TrustTransferRequestRecord,
  ): Promise<TrustTransferRequestRecord>;
  listTrustTransferRequests(
    firmId: string,
    options?: { matterId?: string; status?: TrustTransferRequestRecord["status"] },
  ): Promise<TrustTransferRequestRecord[]>;
  createDocumentTextExtraction(
    extraction: DocumentTextExtractionRecord,
  ): Promise<DocumentTextExtractionRecord>;
  getDocumentTextExtractions(
    firmId: string,
    documentId: string,
  ): Promise<DocumentTextExtractionRecord[]>;
  listDrafts(
    firmId: string,
    options?: { matterId?: string; userId?: string },
  ): Promise<DraftRecord[]>;
  getDraft(firmId: string, draftId: string): Promise<DraftRecord | undefined>;
  createDraft(draft: DraftRecord): Promise<DraftRecord>;
  updateDraft(
    firmId: string,
    draftId: string,
    updates: Partial<
      Pick<DraftRecord, "title" | "editorJson" | "renderedHtml" | "updatedByUserId">
    >,
  ): Promise<DraftRecord>;
  deleteDraft(firmId: string, draftId: string): Promise<void>;
  listDraftAssistRecords(
    firmId: string,
    options?: { matterId?: string; draftId?: string; documentId?: string },
  ): Promise<DraftAssistRecord[]>;
  getDraftAssistRecord(firmId: string, id: string): Promise<DraftAssistRecord | undefined>;
  createDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord>;
  updateDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord>;
  listDraftTemplates(
    firmId: string,
    options?: { category?: string; activeOnly?: boolean },
  ): Promise<DraftTemplateRecord[]>;
  createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord>;
  getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined>;
  listInboundEmailAddresses(firmId: string): Promise<InboundEmailAddressRecord[]>;
  createInboundEmailAddress(address: InboundEmailAddressRecord): Promise<InboundEmailAddressRecord>;
  listInboundEmailMessages(
    firmId: string,
    options?: { matterId?: string; status?: InboundEmailMessageRecord["status"] },
  ): Promise<InboundEmailMessageRecord[]>;
  getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined>;
  createInboundEmailMessage(message: InboundEmailMessageRecord): Promise<InboundEmailMessageRecord>;
  updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord>;
  createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord>;
  listInboundEmailAttachments(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailAttachmentRecord[]>;
  promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult>;
}
