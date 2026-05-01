import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  appendAuditEvent,
  buildBasicDraftTemplates,
  calculateInvoiceTotals,
  canShareDocumentThroughPortal,
  clientTrustBalanceByMatter,
  clientTrustBalanceDeltas,
  invoiceStatusForPayment,
  ledgerBalanceByMatter,
  ledgerRequestFingerprint,
  postLedgerTransaction,
  runConflictCheck,
  shouldUpdateSignatureRequestStatus,
  verifyAuditChain,
  type ActivityTimelineEntry,
  type AccessLogRecord,
  type AuditEvent,
  type NewAuditEvent,
  type CalendarCredentialRecord,
  type CalendarEventRecord,
  type Contact,
  type DocumentRecord,
  type ExpenseEntry,
  type ExternalUploadLinkRecord,
  type Firm,
  type FirmSettings,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerReconciliationRecord,
  type LedgerTransaction,
  type LedgerTransactionApprovalRecord,
  type EmailEventRecord,
  type EmailOutboxRecord,
  type ManualPaymentRecord,
  type Matter,
  type MatterParty,
  type RecoveryCodeRecord,
  type PaymentAllocationRecord,
  type PortalGrant,
  type PostedLedgerTransaction,
  type JobLifecycleRecord,
  type ProviderSettingRecord,
  type TimeEntry,
  type TrustTransferRequestRecord,
  type User,
  type WebAuthnChallengeRecord,
  type WebAuthnCredentialRecord,
  type DraftRecord,
  type DraftTemplateRecord,
  type InboundEmailAddressRecord,
  type InboundEmailAttachmentRecord,
  type InboundEmailMessageRecord,
  type ShareLinkRecord,
} from "@open-practice/domain";
import {
  sampleAuditEvents,
  sampleCalendarEvents,
  sampleContacts,
  sampleDraftTemplates,
  sampleDocuments,
  sampleExpenseEntries,
  sampleFirm,
  sampleGeneratedDocuments,
  sampleIntakeSessions,
  sampleIntakeTemplates,
  sampleInvoiceLines,
  sampleInvoices,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleManualPayments,
  sampleMatterParties,
  sampleMatters,
  samplePaymentAllocations,
  samplePortalGrants,
  sampleSignatureProviderEvents,
  sampleSignatureRequestSigners,
  sampleSignatureRequests,
  sampleSignatureWebhookAttempts,
  sampleTimeEntries,
  sampleTrustTransferRequests,
  sampleUsers,
} from "@open-practice/domain/sample-data";
import type {
  AnswerSnapshotRecord,
  DocumentTextExtractionRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import type { OpenPracticeDatabase } from "./runtime.js";
import * as schema from "./schema.js";

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
  supersedesDocumentId?: string;
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

function isPostgresUniqueViolation(error: unknown, constraintName: string): boolean {
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
  getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined>;
  listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]>;
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
  listSignatureRequests(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<SignatureRequestRecord[]>;
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
  listIntakeSessions(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<IntakeSessionRecord[]>;
  getIntakeSession(firmId: string, sessionId: string): Promise<IntakeSessionRecord | undefined>;
  createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord>;
  createAnswerSnapshot(snapshot: AnswerSnapshotRecord): Promise<AnswerSnapshotRecord>;
  listAnswerSnapshots(
    firmId: string,
    options?: { intakeSessionId?: string },
  ): Promise<AnswerSnapshotRecord[]>;
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
  listDraftTemplates(
    firmId: string,
    options?: { category?: string; activeOnly?: boolean },
  ): Promise<DraftTemplateRecord[]>;
  createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord>;
  getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined>;
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
}

function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

function dateToIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function mapAuthAccountRow(row: typeof schema.authAccounts.$inferSelect): AuthAccountRecord {
  return {
    firmId: row.firmId,
    userId: row.userId,
    passwordHash: row.passwordHash,
    passwordUpdatedAt: row.passwordUpdatedAt.toISOString(),
  };
}

function mapAuthSessionRow(row: typeof schema.authSessions.$inferSelect): AuthSessionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: dateToIso(row.revokedAt),
    lastSeenAt: dateToIso(row.lastSeenAt),
  };
}

function mapShareLinkRow(row: typeof schema.shareLinks.$inferSelect): ShareLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    tokenHash: row.tokenHash,
    grantedByUserId: row.grantedByUserId,
    permissions: row.permissions as ShareLinkRecord["permissions"],
    requireEmailVerification: row.requireEmailVerification,
    expiresAt: dateToIso(row.expiresAt),
    revokedAt: dateToIso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapWebAuthnCredentialRow(
  row: typeof schema.webAuthnCredentials.$inferSelect,
): WebAuthnCredentialRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    credentialId: row.credentialId,
    publicKey: row.publicKey,
    counter: row.counter,
    transports: row.transports,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: dateToIso(row.lastUsedAt),
    disabledAt: dateToIso(row.disabledAt),
  };
}

function mapAuthChallengeRow(
  row: typeof schema.authChallenges.$inferSelect,
): WebAuthnChallengeRecord {
  return {
    id: row.id,
    firmId: row.firmId ?? undefined,
    userId: row.userId ?? undefined,
    challengeHash: row.challengeHash,
    purpose: row.purpose,
    expiresAt: row.expiresAt.toISOString(),
    consumedAt: dateToIso(row.consumedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPasswordSetupTokenRow(
  row: typeof schema.authPasswordSetupTokens.$inferSelect,
): AuthPasswordSetupTokenRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdByUserId: row.createdByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: dateToIso(row.usedAt),
  };
}

function mapRecoveryCodeRow(row: typeof schema.recoveryCodes.$inferSelect): RecoveryCodeRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    codeHash: row.codeHash,
    usedAt: dateToIso(row.usedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCalendarCredentialRow(
  row: typeof schema.calendarCredentials.$inferSelect,
): CalendarCredentialRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    username: row.username,
    label: row.label,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    lastUsedAt: dateToIso(row.lastUsedAt),
    revokedAt: dateToIso(row.revokedAt),
  };
}

function mapCalendarEventRow(row: typeof schema.calendarEvents.$inferSelect): CalendarEventRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    uid: row.uid,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    status: row.status as CalendarEventRecord["status"],
    sequence: row.sequence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: dateToIso(row.deletedAt),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
  };
}

function setupStatusFromCounts(firmCount: number, userCount: number): FirstRunSetupStatus {
  if (firmCount === 0 && userCount === 0) {
    return { required: true, blocked: false };
  }
  if (firmCount > 0 && userCount > 0) {
    return { required: false, blocked: false };
  }
  return {
    required: false,
    blocked: true,
    reason: "Found partial setup state. Resolve firm/user records before running first-run setup.",
  };
}

function mapFirmSettingsRow(row: typeof schema.firmSettings.$inferSelect): FirmSettings {
  return {
    firmId: row.firmId,
    businessAddress: row.businessAddress,
    officeEmail: row.officeEmail,
    officePhone: row.officePhone,
    practiceAreas: row.practiceAreas,
    invoicePrefix: row.invoicePrefix,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    trustAccountLabel: row.trustAccountLabel,
    trustFundsCaveatAcceptedAt: row.trustFundsCaveatAcceptedAt.toISOString(),
    trustFundsCaveatAcceptedByUserId: row.trustFundsCaveatAcceptedByUserId,
    website: row.website ?? undefined,
    description: row.description ?? undefined,
    businessNumber: row.businessNumber ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProviderSettingRow(
  row: typeof schema.providerSettings.$inferSelect,
): ProviderSettingRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    kind: row.kind,
    key: row.key,
    enabled: row.enabled,
    encryptedConfig: row.encryptedConfig,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapJobLifecycleRow(
  row: typeof schema.jobLifecycleRecords.$inferSelect,
): JobLifecycleRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    queueName: row.queueName,
    jobName: row.jobName,
    bullJobId: row.bullJobId ?? undefined,
    status: row.status,
    targetResourceType: row.targetResourceType ?? undefined,
    targetResourceId: row.targetResourceId ?? undefined,
    attemptsMade: row.attemptsMade,
    maxAttempts: row.maxAttempts,
    queuedAt: row.queuedAt.toISOString(),
    startedAt: dateToIso(row.startedAt),
    finishedAt: dateToIso(row.finishedAt),
    failedAt: dateToIso(row.failedAt),
    errorMessage: row.errorMessage ?? undefined,
    metadata: row.metadata,
  };
}

function mapEmailOutboxRow(row: typeof schema.emailOutbox.$inferSelect): EmailOutboxRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    templateKey: row.templateKey,
    status: row.status as EmailOutboxRecord["status"],
    to: row.to,
    cc: row.cc,
    bcc: row.bcc,
    from: row.from,
    subject: row.subject,
    htmlBody: row.htmlBody,
    textBody: row.textBody,
    relatedResourceType: row.relatedResourceType ?? undefined,
    relatedResourceId: row.relatedResourceId ?? undefined,
    queuedAt: row.queuedAt.toISOString(),
    sentAt: dateToIso(row.sentAt),
    failedAt: dateToIso(row.failedAt),
    errorMessage: row.errorMessage ?? undefined,
    metadata: row.metadata,
  };
}

function emailOutboxInsert(record: EmailOutboxRecord): typeof schema.emailOutbox.$inferInsert {
  return {
    ...record,
    queuedAt: new Date(record.queuedAt),
    sentAt: record.sentAt ? new Date(record.sentAt) : null,
    failedAt: record.failedAt ? new Date(record.failedAt) : null,
  };
}

function mapEmailEventRow(row: typeof schema.emailEvents.$inferSelect): EmailEventRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    emailId: row.emailId,
    eventType: row.eventType as EmailEventRecord["eventType"],
    providerMessageId: row.providerMessageId ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    metadata: row.metadata,
  };
}

function emailEventInsert(record: EmailEventRecord): typeof schema.emailEvents.$inferInsert {
  return {
    ...record,
    occurredAt: new Date(record.occurredAt),
  };
}

function jobLifecycleInsert(
  record: JobLifecycleRecord,
): typeof schema.jobLifecycleRecords.$inferInsert {
  return {
    ...record,
    queuedAt: new Date(record.queuedAt),
    startedAt: record.startedAt ? new Date(record.startedAt) : null,
    finishedAt: record.finishedAt ? new Date(record.finishedAt) : null,
    failedAt: record.failedAt ? new Date(record.failedAt) : null,
  };
}

function matterTrustBalance(
  entries: LedgerEntry[],
  accounts: LedgerAccount[],
  matter: Matter,
  parties: MatterParty[],
): number {
  const clientParty = parties.find((party) => party.matterId === matter.id && !party.adverse);
  if (!clientParty) return 0;
  const key = `${clientParty.contactId}:${matter.id}`;
  return clientTrustBalanceByMatter(entries, accounts)[key] ?? 0;
}

function userHasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}

function mapDocumentRow(row: typeof schema.documents.$inferSelect): DocumentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    title: row.title,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    version: row.version,
    classification: row.classification,
    legalHold: row.legalHold,
    uploadStatus: row.uploadStatus as DocumentRecord["uploadStatus"],
    checksumStatus: row.checksumStatus as DocumentRecord["checksumStatus"],
    scanStatus: row.scanStatus as DocumentRecord["scanStatus"],
    duplicateOfDocumentId: row.duplicateOfDocumentId ?? undefined,
    supersedesDocumentId: row.supersedesDocumentId ?? undefined,
    supersededAt: dateToIso(row.supersededAt),
    uploadedAt: dateToIso(row.uploadedAt),
  };
}

function mapDocumentTextExtractionRow(
  row: typeof schema.documentTextExtractions.$inferSelect,
): DocumentTextExtractionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    documentId: row.documentId,
    engine: row.engine as DocumentTextExtractionRecord["engine"],
    status: row.status as DocumentTextExtractionRecord["status"],
    language: row.language,
    confidence: row.confidence ?? undefined,
    textStorageKey: row.textStorageKey ?? undefined,
    extractedText: row.extractedText ?? undefined,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    completedAt: dateToIso(row.completedAt),
  };
}

function mapExternalUploadLinkRow(
  row: typeof schema.externalUploadLinks.$inferSelect,
): ExternalUploadLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    tokenHash: row.tokenHash,
    requestedByUserId: row.requestedByUserId,
    expiresAt: row.expiresAt.toISOString(),
    maxUploads: row.maxUploads,
    usedUploads: row.usedUploads,
    createdAt: row.createdAt.toISOString(),
    revokedAt: dateToIso(row.revokedAt),
  };
}

function externalUploadLinkInsert(
  link: ExternalUploadLinkRecord,
): typeof schema.externalUploadLinks.$inferInsert {
  return {
    ...link,
    expiresAt: new Date(link.expiresAt),
    revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
    createdAt: new Date(link.createdAt),
  };
}

function mapAccessLogRow(row: typeof schema.accessLogs.$inferSelect): AccessLogRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    actorId: row.actorId ?? undefined,
    shareLinkId: row.shareLinkId ?? undefined,
    externalUploadLinkId: row.externalUploadLinkId ?? undefined,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    action: row.action as AccessLogRecord["action"],
    occurredAt: row.occurredAt.toISOString(),
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
    metadata: row.metadata as Record<string, unknown>,
  };
}

function accessLogInsert(log: AccessLogRecord): typeof schema.accessLogs.$inferInsert {
  return {
    id: log.id,
    firmId: log.firmId,
    actorId: log.actorId ?? null,
    shareLinkId: log.shareLinkId ?? null,
    externalUploadLinkId: log.externalUploadLinkId ?? null,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    action: log.action,
    occurredAt: new Date(log.occurredAt),
    ipAddress: log.ipAddress ?? null,
    userAgent: log.userAgent ?? null,
    metadata: log.metadata,
  };
}

function mapSignatureRequestRow(
  row: typeof schema.signatureRequests.$inferSelect,
): SignatureRequestRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    documentId: row.documentId,
    title: row.title,
    requestedByUserId: row.requestedByUserId,
    provider: row.provider as SignatureRequestRecord["provider"],
    externalId: row.externalId,
    status: row.status as SignatureProviderStatus,
    signingUrl: row.signingUrl ?? undefined,
    consentText: row.consentText,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    completedAt: dateToIso(row.completedAt),
    declinedAt: dateToIso(row.declinedAt),
  };
}

function mapIntakeSessionRow(row: typeof schema.intakeSessions.$inferSelect): IntakeSessionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    templateId: row.templateId,
    provider: row.provider as IntakeSessionRecord["provider"],
    externalId: row.externalId,
    status: row.status as IntakeSessionRecord["status"],
    clientContactId: row.clientContactId ?? undefined,
    interviewUrl: row.interviewUrl ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAnswerSnapshotRow(
  row: typeof schema.answerSnapshots.$inferSelect,
): AnswerSnapshotRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    intakeSessionId: row.intakeSessionId,
    capturedAt: row.capturedAt.toISOString(),
    answers: row.answers as Record<string, unknown>,
    resolution: row.resolution as AnswerSnapshotRecord["resolution"],
  };
}

function mapSignatureProviderEventRow(
  row: typeof schema.signatureProviderEvents.$inferSelect,
): SignatureProviderEventRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    signatureRequestId: row.signatureRequestId,
    provider: row.provider as SignatureProviderEventRecord["provider"],
    externalId: row.externalId,
    status: row.status as SignatureProviderStatus,
    occurredAt: row.occurredAt.toISOString(),
    evidence: row.evidence as Record<string, unknown>,
  };
}

function mapSignatureWebhookAttemptRow(
  row: typeof schema.signatureWebhookAttempts.$inferSelect,
): SignatureWebhookAttemptRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    provider: row.provider as SignatureWebhookAttemptRecord["provider"],
    externalId: row.externalId,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: dateToIso(row.processedAt),
    status: row.status as SignatureWebhookAttemptRecord["status"],
    errorMessage: row.errorMessage ?? undefined,
    payload: row.payload as Record<string, unknown>,
  };
}

function mapLedgerApprovalRow(
  row: typeof schema.trustTransactionApprovals.$inferSelect,
): LedgerTransactionApprovalRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    transactionId: row.transactionId,
    decidedByUserId: row.decidedByUserId,
    decision: row.decision as LedgerTransactionApprovalRecord["decision"],
    decidedAt: row.decidedAt.toISOString(),
    notes: row.notes ?? undefined,
  };
}

function mapLedgerReconciliationRow(
  row: typeof schema.trustReconciliations.$inferSelect,
): LedgerReconciliationRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    accountId: row.accountId,
    statementPeriodStart: row.statementPeriodStart.toISOString(),
    statementPeriodEnd: row.statementPeriodEnd.toISOString(),
    expectedBalanceCents: row.expectedBalanceCents,
    actualBalanceCents: row.actualBalanceCents,
    status: row.status as LedgerReconciliationRecord["status"],
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildActivityTimeline(input: {
  firmId: string;
  matterId: string;
  documents: DocumentRecord[];
  portalGrants: PortalGrant[];
  auditEvents: AuditEvent[];
  signatureRequests: SignatureRequestRecord[];
  intakeSessions: IntakeSessionRecord[];
}): ActivityTimelineEntry[] {
  const entries: ActivityTimelineEntry[] = [
    ...input.auditEvents
      .filter((event) => event.firmId === input.firmId)
      .filter(
        (event) =>
          event.resourceId === input.matterId ||
          event.metadata.matterId === input.matterId ||
          event.resourceType === "conflict_check",
      )
      .map((event) => ({
        id: event.id,
        firmId: event.firmId,
        matterId:
          typeof event.metadata.matterId === "string" ? event.metadata.matterId : input.matterId,
        occurredAt: event.occurredAt,
        title: event.action.replaceAll("_", " ").replaceAll(".", " "),
        kind: event.resourceType === "conflict_check" ? ("conflict" as const) : ("audit" as const),
        actorId: event.actorId,
        metadata: event.metadata,
      })),
    ...input.documents
      .filter((document) => document.matterId === input.matterId)
      .map((document) => ({
        id: `document:${document.id}`,
        firmId: document.firmId,
        matterId: document.matterId,
        occurredAt: document.verifiedAt ?? document.uploadedAt ?? new Date(0).toISOString(),
        title: `Document ${document.uploadStatus}: ${document.title}`,
        kind: "document" as const,
        metadata: {
          checksumStatus: document.checksumStatus,
          scanStatus: document.scanStatus,
          portalShareable: input.portalGrants.some((grant) =>
            canShareDocumentThroughPortal({ document, grant }),
          ),
        },
      })),
    ...input.portalGrants
      .filter((grant) => grant.matterId === input.matterId)
      .map((grant) => ({
        id: `portal:${grant.id}`,
        firmId: grant.firmId,
        matterId: grant.matterId,
        occurredAt: grant.expiresAt ?? new Date(0).toISOString(),
        title: grant.revokedAt ? "Portal grant revoked" : "Portal grant active",
        kind: "portal" as const,
        actorId: grant.grantedByUserId,
        metadata: { permissions: grant.permissions, contactId: grant.contactId },
      })),
    ...input.signatureRequests
      .filter((request) => request.matterId === input.matterId)
      .map((request) => ({
        id: `signature:${request.id}`,
        firmId: request.firmId,
        matterId: request.matterId,
        occurredAt: request.completedAt ?? request.declinedAt ?? request.createdAt,
        title: `Signature ${request.status}: ${request.title}`,
        kind: "signature" as const,
        actorId: request.requestedByUserId,
        metadata: { provider: request.provider, documentId: request.documentId },
      })),
    ...input.intakeSessions
      .filter((session) => session.matterId === input.matterId)
      .map((session) => ({
        id: `intake:${session.id}`,
        firmId: session.firmId,
        matterId: session.matterId,
        occurredAt: session.updatedAt,
        title: `Intake ${session.status}`,
        kind: "intake" as const,
        metadata: { templateId: session.templateId, provider: session.provider },
      })),
  ];

  return entries
    .filter((entry) => entry.occurredAt !== new Date(0).toISOString())
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

function mapDraftRow(row: typeof schema.drafts.$inferSelect): DraftRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId ?? undefined,
    title: row.title,
    editorJson: row.editorJson as DraftRecord["editorJson"],
    renderedHtml: row.renderedHtml ?? undefined,
    version: row.version,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata as Record<string, unknown>,
  };
}

function mapDraftTemplateRow(row: typeof schema.draftTemplates.$inferSelect): DraftTemplateRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    name: row.name,
    description: row.description ?? undefined,
    editorJson: row.editorJson as DraftTemplateRecord["editorJson"],
    category: row.category,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata as Record<string, unknown>,
  };
}

function mapInboundEmailAddressRow(
  row: typeof schema.inboundEmailAddresses.$inferSelect,
): InboundEmailAddressRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    address: row.address,
    matterId: row.matterId ?? undefined,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapInboundEmailMessageRow(
  row: typeof schema.inboundEmailMessages.$inferSelect,
): InboundEmailMessageRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    addressId: row.addressId ?? undefined,
    matterId: row.matterId ?? undefined,
    messageId: row.messageId ?? undefined,
    fromAddress: row.fromAddress,
    toAddresses: row.toAddresses,
    subject: row.subject,
    receivedAt: row.receivedAt.toISOString(),
    rawStorageKey: row.rawStorageKey,
    parsedText: row.parsedText ?? undefined,
    parsedHtmlStorageKey: row.parsedHtmlStorageKey ?? undefined,
    labels: row.labels,
    status: row.status as InboundEmailMessageRecord["status"],
    metadata: row.metadata as Record<string, unknown>,
  };
}

function mapInboundEmailAttachmentRow(
  row: typeof schema.inboundEmailAttachments.$inferSelect,
): InboundEmailAttachmentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    inboundMessageId: row.inboundMessageId,
    documentId: row.documentId ?? undefined,
    filename: row.filename,
    contentType: row.contentType ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256 ?? undefined,
  };
}

export class InMemoryOpenPracticeRepository implements OpenPracticeRepository {
  private firms: Firm[];
  private users: User[];
  private contacts: Contact[];
  private matters: Matter[];
  private matterParties: MatterParty[];
  private documents: DocumentRecord[];
  private calendarEvents: CalendarEventRecord[];
  private portalGrants: PortalGrant[];
  private externalUploadLinks: ExternalUploadLinkRecord[] = [];
  private timeEntries: TimeEntry[];
  private expenseEntries: ExpenseEntry[];
  private invoices: InvoiceRecord[];
  private invoiceLines: InvoiceLineRecord[];
  private manualPayments: ManualPaymentRecord[];
  private paymentAllocations: PaymentAllocationRecord[];
  private trustTransferRequests: TrustTransferRequestRecord[];
  private ledgerAccounts: LedgerAccount[];
  private ledgerApprovals: LedgerTransactionApprovalRecord[] = [];
  private ledgerReconciliations: LedgerReconciliationRecord[] = [];
  private intakeTemplates: IntakeTemplateRecord[];
  private signatureRequestSigners: SignatureRequestSignerRecord[];
  private signatureProviderEvents: SignatureProviderEventRecord[];
  private signatureWebhookAttempts: SignatureWebhookAttemptRecord[];
  private signatureRequests: SignatureRequestRecord[];
  private intakeSessions: IntakeSessionRecord[];
  private answerSnapshots: AnswerSnapshotRecord[] = [];
  private generatedDocuments: GeneratedDocumentRecord[];
  private firmSettings: FirmSettings[] = [];
  private providerSettings: ProviderSettingRecord[] = [];
  private jobLifecycleRecords: JobLifecycleRecord[] = [];
  private emailOutbox: EmailOutboxRecord[] = [];
  private emailEvents: EmailEventRecord[] = [];
  private authAccounts: AuthAccountRecord[] = [];
  private authSessions: AuthSessionRecord[] = [];
  private calendarCredentials: CalendarCredentialRecord[] = [];
  private passwordSetupTokens: AuthPasswordSetupTokenRecord[] = [];
  private authChallenges: WebAuthnChallengeRecord[] = [];
  private webAuthnCredentials: WebAuthnCredentialRecord[] = [];
  private recoveryCodes: RecoveryCodeRecord[] = [];
  private auditEvents: AuditEvent[];
  private postedTransactions: PostedLedgerTransaction[];
  private documentTextExtractions: DocumentTextExtractionRecord[] = [];
  private drafts: DraftRecord[] = [];
  private draftTemplates: DraftTemplateRecord[] = [];
  private inboundEmailAddresses: InboundEmailAddressRecord[] = [];
  private inboundEmailMessages: InboundEmailMessageRecord[] = [];
  private inboundEmailAttachments: InboundEmailAttachmentRecord[] = [];
  private shareLinks: ShareLinkRecord[] = [];
  private accessLogs: AccessLogRecord[] = [];

  constructor(options: { seedSampleData?: boolean; firms?: Firm[]; users?: User[] } = {}) {
    const seeded = options.seedSampleData ?? true;
    this.firms = options.firms ? clone(options.firms) : seeded ? [clone(sampleFirm)] : [];
    this.users = options.users ? clone(options.users) : seeded ? clone(sampleUsers) : [];
    this.contacts = seeded ? clone(sampleContacts) : [];
    this.matters = seeded ? clone(sampleMatters) : [];
    this.matterParties = seeded ? clone(sampleMatterParties) : [];
    this.documents = seeded ? clone(sampleDocuments) : [];
    this.calendarEvents = seeded ? clone(sampleCalendarEvents) : [];
    this.portalGrants = seeded ? clone(samplePortalGrants) : [];
    this.timeEntries = seeded ? clone(sampleTimeEntries) : [];
    this.expenseEntries = seeded ? clone(sampleExpenseEntries) : [];
    this.invoices = seeded ? clone(sampleInvoices) : [];
    this.invoiceLines = seeded ? clone(sampleInvoiceLines) : [];
    this.manualPayments = seeded ? clone(sampleManualPayments) : [];
    this.paymentAllocations = seeded ? clone(samplePaymentAllocations) : [];
    this.trustTransferRequests = seeded ? clone(sampleTrustTransferRequests) : [];
    this.ledgerAccounts = seeded ? clone(sampleLedgerAccounts) : [];
    this.intakeTemplates = seeded ? clone(sampleIntakeTemplates) : [];
    this.draftTemplates = seeded ? clone(sampleDraftTemplates) : [];
    this.signatureRequestSigners = seeded ? clone(sampleSignatureRequestSigners) : [];
    this.signatureProviderEvents = seeded ? clone(sampleSignatureProviderEvents) : [];
    this.signatureWebhookAttempts = seeded ? clone(sampleSignatureWebhookAttempts) : [];
    this.signatureRequests = seeded ? clone(sampleSignatureRequests) : [];
    this.intakeSessions = seeded ? clone(sampleIntakeSessions) : [];
    this.generatedDocuments = seeded ? clone(sampleGeneratedDocuments) : [];
    this.auditEvents = seeded ? clone(sampleAuditEvents) : [];
    this.postedTransactions = seeded
      ? [
          {
            id: "trust-retainer",
            firmId: sampleFirm.id,
            idempotencyKey: "retainer",
            requestFingerprint: "seed:retainer",
            entries: clone(sampleLedgerEntries),
          },
        ]
      : [];
  }

  async getSetupStatus(): Promise<FirstRunSetupStatus> {
    return setupStatusFromCounts(this.firms.length, this.users.length);
  }

  async completeFirstRunSetup(input: FirstRunSetupInput): Promise<FirstRunSetupResult> {
    const status = await this.getSetupStatus();
    if (!status.required || status.blocked) {
      throw new FirstRunSetupConflictError(status.reason ?? "First-run setup is already complete");
    }

    this.firms = [clone(input.firm)];
    this.users = [clone(input.owner)];
    this.firmSettings = [clone(input.settings)];
    this.authAccounts = [
      {
        firmId: input.owner.firmId,
        userId: input.owner.id,
        passwordHash: input.ownerPasswordHash,
        passwordUpdatedAt: input.ownerPasswordUpdatedAt,
      },
    ];
    if (input.firstContact) this.contacts = [clone(input.firstContact)];
    if (input.firstMatter) this.matters = [clone(input.firstMatter)];
    if (input.firstMatterParty) this.matterParties = [clone(input.firstMatterParty)];
    if (input.webAuthnCredential) this.webAuthnCredentials = [clone(input.webAuthnCredential)];
    this.draftTemplates = buildBasicDraftTemplates(input.firm.id, input.settings.createdAt);
    this.auditEvents = [clone(input.auditEvent)];

    return {
      firm: clone(input.firm),
      settings: clone(input.settings),
      owner: clone(input.owner),
      firstMatter: clone(input.firstMatter),
    };
  }

  async getFirmSettings(firmId: string): Promise<FirmSettings | undefined> {
    return clone(this.firmSettings.find((settings) => settings.firmId === firmId));
  }

  async listProviderSettings(
    firmId: string,
    options: { kind?: ProviderSettingRecord["kind"] } = {},
  ): Promise<ProviderSettingRecord[]> {
    return clone(
      this.providerSettings.filter(
        (setting) => setting.firmId === firmId && (!options.kind || setting.kind === options.kind),
      ),
    );
  }

  async upsertProviderSetting(setting: ProviderSettingRecord): Promise<ProviderSettingRecord> {
    const existingIndex = this.providerSettings.findIndex(
      (candidate) =>
        candidate.firmId === setting.firmId &&
        candidate.kind === setting.kind &&
        candidate.key === setting.key,
    );
    if (existingIndex >= 0) {
      this.providerSettings[existingIndex] = clone(setting);
    } else {
      this.providerSettings.push(clone(setting));
    }
    return clone(setting);
  }

  async createJobLifecycleRecord(record: JobLifecycleRecord): Promise<JobLifecycleRecord> {
    this.jobLifecycleRecords.push(clone(record));
    return clone(record);
  }

  async createQueuedEmailOutbox(input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }): Promise<{
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }> {
    this.emailOutbox.push(clone(input.email));
    this.emailEvents.push(clone(input.event));
    this.jobLifecycleRecords.push(clone(input.job));
    return clone(input);
  }

  async getEmailOutbox(firmId: string, emailId: string): Promise<EmailOutboxRecord | undefined> {
    return clone(this.emailOutbox.find((email) => email.firmId === firmId && email.id === emailId));
  }

  async updateJobLifecycleRecord(
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
  ): Promise<JobLifecycleRecord> {
    const index = this.jobLifecycleRecords.findIndex(
      (record) => record.firmId === firmId && record.id === id,
    );
    if (index === -1) throw new Error(`Job lifecycle record ${id} was not found`);
    this.jobLifecycleRecords[index] = { ...this.jobLifecycleRecords[index], ...clone(updates) };
    return clone(this.jobLifecycleRecords[index]);
  }

  async listJobLifecycleRecords(
    firmId: string,
    options: {
      status?: JobLifecycleRecord["status"];
      queueName?: JobLifecycleRecord["queueName"];
    } = {},
  ): Promise<JobLifecycleRecord[]> {
    return clone(
      this.jobLifecycleRecords.filter(
        (record) =>
          record.firmId === firmId &&
          (!options.status || record.status === options.status) &&
          (!options.queueName || record.queueName === options.queueName),
      ),
    );
  }

  async getUser(firmId: string, userId: string): Promise<User | undefined> {
    return clone(this.users.find((user) => user.firmId === firmId && user.id === userId));
  }

  async createUser(user: User): Promise<User> {
    this.users = [...this.users, clone(user)];
    return clone(user);
  }

  async getUserByEmail(firmId: string, email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    return clone(
      this.users.find(
        (user) => user.firmId === firmId && user.email.trim().toLowerCase() === normalized,
      ),
    );
  }

  async getAuthAccount(firmId: string, userId: string): Promise<AuthAccountRecord | undefined> {
    return clone(
      this.authAccounts.find((account) => account.firmId === firmId && account.userId === userId),
    );
  }

  async setAuthPassword(input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  }): Promise<AuthAccountRecord> {
    const account: AuthAccountRecord = { ...input };
    this.authAccounts = [
      ...this.authAccounts.filter(
        (candidate) => candidate.firmId !== input.firmId || candidate.userId !== input.userId,
      ),
      account,
    ];
    return clone(account);
  }

  async createAuthSession(session: AuthSessionRecord): Promise<AuthSessionRecord> {
    this.authSessions = [...this.authSessions, clone(session)];
    return clone(session);
  }

  async getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined> {
    return clone(this.authSessions.find((session) => session.tokenHash === tokenHash));
  }

  async touchAuthSession(tokenHash: string, seenAt: string): Promise<void> {
    this.authSessions = this.authSessions.map((session) =>
      session.tokenHash === tokenHash ? { ...session, lastSeenAt: seenAt } : session,
    );
  }

  async revokeAuthSession(tokenHash: string, revokedAt: string): Promise<void> {
    this.authSessions = this.authSessions.map((session) =>
      session.tokenHash === tokenHash ? { ...session, revokedAt } : session,
    );
  }

  async createPasswordSetupToken(
    token: AuthPasswordSetupTokenRecord,
  ): Promise<AuthPasswordSetupTokenRecord> {
    this.passwordSetupTokens = [...this.passwordSetupTokens, clone(token)];
    return clone(token);
  }

  async consumePasswordSetupToken(
    tokenHash: string,
    usedAt: string,
  ): Promise<AuthPasswordSetupTokenRecord | undefined> {
    const token = this.passwordSetupTokens.find((candidate) => candidate.tokenHash === tokenHash);
    if (!token || token.usedAt || Date.parse(token.expiresAt) <= Date.parse(usedAt)) {
      return undefined;
    }
    token.usedAt = usedAt;
    return clone(token);
  }

  async createWebAuthnChallenge(
    challenge: WebAuthnChallengeRecord,
  ): Promise<WebAuthnChallengeRecord> {
    this.authChallenges = [...this.authChallenges, clone(challenge)];
    return clone(challenge);
  }

  async getWebAuthnChallenge(challengeHash: string): Promise<WebAuthnChallengeRecord | undefined> {
    return clone(this.authChallenges.find((c) => c.challengeHash === challengeHash));
  }

  async consumeWebAuthnChallenge(challengeHash: string, consumedAt: string): Promise<boolean> {
    const challenge = this.authChallenges.find(
      (c) => c.challengeHash === challengeHash && !c.consumedAt,
    );
    if (challenge) {
      challenge.consumedAt = consumedAt;
      return true;
    }
    return false;
  }

  async registerWebAuthnCredential(
    credential: WebAuthnCredentialRecord,
  ): Promise<WebAuthnCredentialRecord> {
    this.webAuthnCredentials = [...this.webAuthnCredentials, clone(credential)];
    return clone(credential);
  }

  async listWebAuthnCredentials(
    firmId: string,
    userId: string,
  ): Promise<WebAuthnCredentialRecord[]> {
    return clone(
      this.webAuthnCredentials.filter((c) => c.firmId === firmId && c.userId === userId),
    );
  }

  async getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined> {
    return clone(this.webAuthnCredentials.find((c) => c.credentialId === credentialId));
  }

  async updateWebAuthnCredentialCounter(id: string, counter: number): Promise<void> {
    const cred = this.webAuthnCredentials.find((c) => c.id === id);
    if (cred) {
      cred.counter = counter;
      cred.lastUsedAt = new Date().toISOString();
    }
  }

  async deleteWebAuthnCredential(firmId: string, id: string): Promise<void> {
    this.webAuthnCredentials = this.webAuthnCredentials.filter(
      (c) => !(c.firmId === firmId && c.id === id),
    );
  }

  async updateUserMfaStatus(firmId: string, userId: string, mfaEnabled: boolean): Promise<void> {
    const user = this.users.find((u) => u.firmId === firmId && u.id === userId);
    if (user) {
      user.mfaEnabled = mfaEnabled;
    }
  }

  async createRecoveryCodes(
    firmId: string,
    userId: string,
    codes: RecoveryCodeRecord[],
  ): Promise<void> {
    // Invalidate old codes
    this.recoveryCodes = this.recoveryCodes.filter(
      (c) => !(c.firmId === firmId && c.userId === userId),
    );
    this.recoveryCodes = [...this.recoveryCodes, ...clone(codes)];
  }

  async useRecoveryCode(
    firmId: string,
    userId: string,
    codeHash: string,
    consumedAt: string,
  ): Promise<boolean> {
    const code = this.recoveryCodes.find(
      (c) => c.firmId === firmId && c.userId === userId && c.codeHash === codeHash && !c.usedAt,
    );
    if (code) {
      code.usedAt = consumedAt;
      return true;
    }
    return false;
  }

  async listRecoveryCodes(firmId: string, userId: string): Promise<RecoveryCodeRecord[]> {
    return clone(this.recoveryCodes.filter((c) => c.firmId === firmId && c.userId === userId));
  }

  async getOverview(firmId: string): Promise<PracticeOverview> {
    const firm = this.firms.find((candidate) => candidate.id === firmId);
    if (!firm) throw new Error(`Unknown firm ${firmId}`);
    const matters = this.matters.filter((matter) => matter.firmId === firmId);
    const ledger = await this.getLedger(firmId);
    return {
      firm: clone(firm),
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        intakeMatters: matters.filter((matter) => matter.status === "intake").length,
        portalGrants: this.portalGrants.filter(
          (grant) => grant.firmId === firmId && !grant.revokedAt,
        ).length,
        trustBalanceCents: Object.values(ledger.trustBalances).reduce(
          (sum, value) => sum + value,
          0,
        ),
        unbilledMinutes: this.timeEntries
          .filter(
            (entry) =>
              entry.firmId === firmId &&
              entry.billable &&
              ["draft", "submitted", "approved"].includes(entry.billingStatus),
          )
          .reduce((sum, entry) => sum + entry.minutes, 0),
      },
      users: clone(this.users.filter((user) => user.firmId === firmId)),
    };
  }

  async listMattersForUser(user: User): Promise<MatterSummary[]> {
    const entries = this.postedTransactions.flatMap((transaction) => transaction.entries);
    return this.matters
      .filter(
        (matter) => matter.firmId === user.firmId && user.assignedMatterIds.includes(matter.id),
      )
      .map((matter) => {
        const parties = this.matterParties
          .filter((party) => party.matterId === matter.id)
          .map((party) => ({
            ...party,
            contact: this.contacts.find((contact) => contact.id === party.contactId)!,
          }));
        return {
          ...matter,
          parties,
          documents: this.documents.filter((document) => document.matterId === matter.id),
          timeEntries: this.timeEntries.filter((entry) => entry.matterId === matter.id),
          expenses: this.expenseEntries.filter((entry) => entry.matterId === matter.id),
          activity: buildActivityTimeline({
            firmId: user.firmId,
            matterId: matter.id,
            documents: this.documents,
            portalGrants: this.portalGrants,
            auditEvents: this.auditEvents,
            signatureRequests: this.signatureRequests,
            intakeSessions: this.intakeSessions,
          }),
          trustBalanceCents: matterTrustBalance(
            entries,
            this.ledgerAccounts,
            matter,
            this.matterParties,
          ),
        };
      });
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    return clone(
      this.documents.find((document) => document.firmId === firmId && document.id === documentId),
    );
  }

  async listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]> {
    return clone(
      this.documents.filter(
        (document) => document.firmId === firmId && document.matterId === matterId,
      ),
    );
  }

  async listCalendarEvents(
    firmId: string,
    options: { matterId: string; startsAfter?: string; startsBefore?: string },
  ): Promise<CalendarEventRecord[]> {
    return clone(
      this.calendarEvents
        .filter(
          (event) =>
            event.firmId === firmId &&
            event.matterId === options.matterId &&
            !event.deletedAt &&
            (!options.startsAfter ||
              Date.parse(event.startsAt) >= Date.parse(options.startsAfter)) &&
            (!options.startsBefore ||
              Date.parse(event.startsAt) < Date.parse(options.startsBefore)),
        )
        .sort((left, right) => {
          const startDifference = Date.parse(left.startsAt) - Date.parse(right.startsAt);
          return startDifference === 0 ? left.id.localeCompare(right.id) : startDifference;
        }),
    );
  }

  async getCalendarEvent(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventRecord | undefined> {
    return clone(
      this.calendarEvents.find(
        (event) =>
          event.firmId === firmId &&
          event.matterId === matterId &&
          event.id === eventId &&
          !event.deletedAt,
      ),
    );
  }

  async getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): Promise<CalendarEventRecord | undefined> {
    return clone(
      this.calendarEvents.find(
        (event) =>
          event.firmId === firmId &&
          event.matterId === matterId &&
          event.uid === uid &&
          !event.deletedAt,
      ),
    );
  }

  async upsertCalendarEvent(event: CalendarEventUpsertInput): Promise<CalendarEventRecord> {
    const eventIdCollision = this.calendarEvents.find((candidate) => candidate.id === event.id);
    if (
      eventIdCollision &&
      (eventIdCollision.firmId !== event.firmId || eventIdCollision.matterId !== event.matterId)
    ) {
      throw new CalendarEventScopeConflictError(event.id);
    }

    const activeUidCollision = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === event.firmId &&
        candidate.matterId === event.matterId &&
        candidate.uid === event.uid &&
        candidate.id !== event.id &&
        !candidate.deletedAt,
    );
    if (activeUidCollision) {
      throw new CalendarEventUidConflictError(event.uid);
    }

    const existingIndex = this.calendarEvents.findIndex(
      (candidate) =>
        candidate.firmId === event.firmId &&
        candidate.matterId === event.matterId &&
        candidate.id === event.id,
    );
    if (existingIndex >= 0) {
      this.calendarEvents[existingIndex] = clone(event);
    } else {
      this.calendarEvents.push(clone(event));
    }
    return clone(event);
  }

  async deleteCalendarEvent(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventRecord | undefined> {
    const existing = this.calendarEvents.find(
      (event) =>
        event.firmId === input.firmId &&
        event.matterId === input.matterId &&
        event.id === input.eventId &&
        !event.deletedAt,
    );
    if (!existing) return undefined;
    existing.deletedAt = input.deletedAt;
    existing.updatedAt = input.deletedAt;
    existing.updatedByUserId = input.updatedByUserId;
    existing.sequence += 1;
    return clone(existing);
  }

  async createCalendarCredential(
    credential: CalendarCredentialRecord,
  ): Promise<CalendarCredentialRecord> {
    this.calendarCredentials.push(clone(credential));
    return clone(credential);
  }

  async listCalendarCredentials(
    firmId: string,
    userId: string,
  ): Promise<CalendarCredentialRecord[]> {
    return clone(
      this.calendarCredentials
        .filter((credential) => credential.firmId === firmId && credential.userId === userId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    );
  }

  async getCalendarCredentialByUsername(
    username: string,
  ): Promise<CalendarCredentialRecord | undefined> {
    return clone(
      this.calendarCredentials.find(
        (credential) => credential.username === username && !credential.revokedAt,
      ),
    );
  }

  async touchCalendarCredential(id: string, lastUsedAt: string): Promise<void> {
    const credential = this.calendarCredentials.find((candidate) => candidate.id === id);
    if (credential) credential.lastUsedAt = lastUsedAt;
  }

  async revokeCalendarCredential(input: {
    firmId: string;
    userId: string;
    credentialId: string;
    revokedAt: string;
  }): Promise<CalendarCredentialRecord | undefined> {
    const credential = this.calendarCredentials.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.userId === input.userId &&
        candidate.id === input.credentialId,
    );
    if (!credential) return undefined;
    credential.revokedAt = input.revokedAt;
    return clone(credential);
  }
  async runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }> {
    const results = runConflictCheck({
      ...input,
      contacts: this.contacts,
      matters: this.matters,
      matterParties: this.matterParties,
    });
    this.auditEvents = [
      ...this.auditEvents,
      appendAuditEvent(this.auditEvents.at(-1), {
        id: `audit-${String(this.auditEvents.length + 1).padStart(3, "0")}`,
        firmId: input.firmId,
        actorId: input.actorId,
        action: "conflict_check.completed",
        resourceType: "conflict_check",
        resourceId: `conflict-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
      }),
    ];
    return { results, auditChainValid: this.auditEvents.length > 0 };
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }> {
    const accounts = this.ledgerAccounts.filter((account) => account.firmId === firmId);
    const entries = this.postedTransactions
      .flatMap((transaction) => transaction.entries)
      .filter(
        (entry) =>
          entry.firmId === firmId && (!options.matterId || entry.matterId === options.matterId),
      );
    return {
      accounts: clone(accounts),
      entries: clone(entries),
      balances: ledgerBalanceByMatter(entries),
      trustBalances: clientTrustBalanceByMatter(entries, accounts),
    };
  }

  async validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void> {
    if (input.transaction.firmId !== input.user.firmId) {
      throw new Error("Ledger transaction firm does not match authenticated user");
    }

    const firmWide = userHasFirmWideLedgerAccess(input.user);
    for (const entry of input.transaction.entries) {
      if (entry.firmId !== input.user.firmId) {
        throw new Error("Ledger entry firm does not match authenticated user");
      }
      if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
        throw new Error("Ledger entry is outside the authenticated matter scope");
      }
      const matter = this.matters.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
      );
      if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
      const contact = this.contacts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
      );
      if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
      const account = this.ledgerAccounts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
      );
      if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
      const party = this.matterParties.find(
        (candidate) =>
          candidate.firmId === input.user.firmId &&
          candidate.matterId === entry.matterId &&
          candidate.contactId === entry.clientId &&
          !candidate.adverse,
      );
      if (!party) {
        throw new Error("Ledger client must be a non-adverse party on the matter");
      }
    }
  }

  async postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction> {
    const posted = postLedgerTransaction(
      { postedTransactions: this.postedTransactions, accounts: this.ledgerAccounts },
      transaction,
    );
    if (!this.postedTransactions.some((existing) => existing.id === posted.id)) {
      this.postedTransactions = [...this.postedTransactions, posted];
    }
    return clone(posted);
  }

  async listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const events = this.auditEvents.filter((event) => event.firmId === firmId);
    return { events: clone(events), valid: verifyAuditChain(events) };
  }

  async appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const firmEvents = this.auditEvents.filter((candidate) => candidate.firmId === event.firmId);
    const appended = appendAuditEvent(firmEvents.at(-1), event);
    this.auditEvents = [...this.auditEvents, appended];
    return clone(appended);
  }

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    this.auditEvents = [...this.auditEvents, clone(event)];
  }

  async listPortalGrants(firmId: string): Promise<PortalGrant[]> {
    return clone(this.portalGrants.filter((grant) => grant.firmId === firmId));
  }

  async listShareLinks(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<ShareLinkRecord[]> {
    return clone(
      this.shareLinks
        .filter(
          (link) =>
            link.firmId === firmId && (!options.matterId || link.matterId === options.matterId),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
        ),
    );
  }

  async listExternalUploadLinks(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<ExternalUploadLinkRecord[]> {
    return clone(
      this.externalUploadLinks
        .filter(
          (link) =>
            link.firmId === firmId && (!options.matterId || link.matterId === options.matterId),
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  }

  async createExternalUploadLink(
    link: ExternalUploadLinkRecord,
  ): Promise<ExternalUploadLinkRecord> {
    if (this.externalUploadLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
      throw new Error("External upload link token hash already exists");
    }
    this.externalUploadLinks = [...this.externalUploadLinks, clone(link)];
    return clone(link);
  }

  async getExternalUploadLinkByTokenHash(
    tokenHash: string,
  ): Promise<ExternalUploadLinkRecord | undefined> {
    return clone(this.externalUploadLinks.find((link) => link.tokenHash === tokenHash));
  }

  async revokeExternalUploadLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined> {
    const link = this.externalUploadLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!link) return undefined;
    link.revokedAt = input.revokedAt;
    return clone(link);
  }

  async claimExternalUploadUse(input: {
    firmId: string;
    id: string;
    usedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined> {
    const link = this.externalUploadLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (
      !link ||
      link.revokedAt ||
      Date.parse(link.expiresAt) <= Date.parse(input.usedAt) ||
      link.usedUploads >= link.maxUploads
    ) {
      return undefined;
    }
    link.usedUploads += 1;
    return clone(link);
  }

  async createShareLink(link: ShareLinkRecord): Promise<ShareLinkRecord> {
    if (this.shareLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
      throw new Error("Share link token hash already exists");
    }
    const matter = this.matters.find(
      (candidate) => candidate.firmId === link.firmId && candidate.id === link.matterId,
    );
    if (!matter) throw new Error(`Unknown share link matter ${link.matterId}`);
    const user = this.users.find(
      (candidate) => candidate.firmId === link.firmId && candidate.id === link.grantedByUserId,
    );
    if (!user) throw new Error(`Unknown share link grantor ${link.grantedByUserId}`);

    this.shareLinks = [...this.shareLinks, clone(link)];
    return clone(link);
  }

  async getShareLink(firmId: string, id: string): Promise<ShareLinkRecord | undefined> {
    return clone(this.shareLinks.find((link) => link.firmId === firmId && link.id === id));
  }

  async getShareLinkByTokenHash(tokenHash: string): Promise<ShareLinkRecord | undefined> {
    return clone(this.shareLinks.find((link) => link.tokenHash === tokenHash));
  }

  async revokeShareLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ShareLinkRecord | undefined> {
    const link = this.shareLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!link) return undefined;
    link.revokedAt = input.revokedAt;
    return clone(link);
  }

  async createAccessLog(log: AccessLogRecord): Promise<AccessLogRecord> {
    this.accessLogs = [...this.accessLogs, clone(log)];
    return clone(log);
  }

  async listAccessLogs(
    firmId: string,
    options: {
      shareLinkId?: string;
      externalUploadLinkId?: string;
      resourceType?: string;
      resourceId?: string;
    } = {},
  ): Promise<AccessLogRecord[]> {
    return clone(
      this.accessLogs
        .filter(
          (log) =>
            log.firmId === firmId &&
            (!options.shareLinkId || log.shareLinkId === options.shareLinkId) &&
            (!options.externalUploadLinkId ||
              log.externalUploadLinkId === options.externalUploadLinkId) &&
            (!options.resourceType || log.resourceType === options.resourceType) &&
            (!options.resourceId || log.resourceId === options.resourceId),
        )
        .sort(
          (left, right) =>
            right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id),
        ),
    );
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    const supersededDocument = input.supersedesDocumentId
      ? this.documents.find(
          (candidate) =>
            candidate.firmId === input.firmId &&
            candidate.matterId === input.matterId &&
            candidate.id === input.supersedesDocumentId,
        )
      : undefined;
    if (input.supersedesDocumentId && !supersededDocument) {
      throw new Error(`Unknown superseded document ${input.supersedesDocumentId}`);
    }
    const now = new Date().toISOString();
    if (supersededDocument) {
      supersededDocument.supersededAt = now;
    }
    const document: DocumentRecord = {
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: input.storageKey,
      checksumSha256: input.checksumSha256,
      version: supersededDocument ? supersededDocument.version + 1 : 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "intent_created",
      checksumStatus: "pending",
      scanStatus: "pending",
      supersedesDocumentId: input.supersedesDocumentId,
    };
    this.documents.push(document);
    return clone(document);
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const document = this.documents.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
    );
    if (!document) throw new Error(`Unknown document ${input.documentId}`);

    const duplicate = this.documents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.id !== input.documentId &&
        candidate.checksumSha256 === input.checksumSha256 &&
        candidate.checksumStatus === "verified",
    );
    const now = new Date().toISOString();
    document.uploadedAt = now;
    document.verifiedAt = now;

    if (document.checksumSha256 !== input.checksumSha256) {
      document.uploadStatus = "rejected";
      document.checksumStatus = "mismatch";
      document.scanStatus = "failed";
      return clone(document);
    }

    document.uploadStatus = "verified";
    document.checksumStatus = duplicate ? "duplicate" : "verified";
    document.duplicateOfDocumentId = duplicate?.id;
    document.scanStatus = input.scanStatus ?? "queued";
    return clone(document);
  }

  async updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const document = this.documents.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
    );
    if (!document) throw new Error(`Unknown document ${input.documentId}`);
    document.scanStatus = input.scanStatus;
    return clone(document);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<SignatureRequestRecord[]> {
    return clone(
      this.signatureRequests.filter(
        (request) =>
          request.firmId === firmId && (!options.matterId || request.matterId === options.matterId),
      ),
    );
  }

  async createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }> {
    this.signatureRequests = [...this.signatureRequests, clone(input.request)];
    this.signatureRequestSigners = [...this.signatureRequestSigners, ...clone(input.signers)];
    this.signatureProviderEvents = [...this.signatureProviderEvents, clone(input.event)];
    return { request: clone(input.request), signers: clone(input.signers) };
  }

  async recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord> {
    this.signatureProviderEvents = [...this.signatureProviderEvents, clone(event)];
    if (webhookAttempt) {
      this.signatureWebhookAttempts = [...this.signatureWebhookAttempts, clone(webhookAttempt)];
    }
    this.signatureRequests = this.signatureRequests.map((request) => {
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

  async recordSignatureWebhookAttempt(
    attempt: SignatureWebhookAttemptRecord,
  ): Promise<SignatureWebhookAttemptRecord> {
    this.signatureWebhookAttempts = [...this.signatureWebhookAttempts, clone(attempt)];
    return clone(attempt);
  }

  async listSignatureProviderEvents(
    firmId: string,
    options: { signatureRequestId?: string } = {},
  ): Promise<SignatureProviderEventRecord[]> {
    return clone(
      this.signatureProviderEvents.filter(
        (event) =>
          event.firmId === firmId &&
          (!options.signatureRequestId || event.signatureRequestId === options.signatureRequestId),
      ),
    );
  }

  async listSignatureWebhookAttempts(
    firmId: string,
    options: { provider?: SignatureWebhookAttemptRecord["provider"]; externalId?: string } = {},
  ): Promise<SignatureWebhookAttemptRecord[]> {
    return clone(
      this.signatureWebhookAttempts.filter(
        (attempt) =>
          attempt.firmId === firmId &&
          (!options.provider || attempt.provider === options.provider) &&
          (!options.externalId || attempt.externalId === options.externalId),
      ),
    );
  }

  async listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]> {
    return clone(this.intakeTemplates.filter((template) => template.firmId === firmId));
  }

  async listIntakeSessions(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<IntakeSessionRecord[]> {
    return clone(
      this.intakeSessions.filter(
        (session) =>
          session.firmId === firmId && (!options.matterId || session.matterId === options.matterId),
      ),
    );
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): Promise<IntakeSessionRecord | undefined> {
    return clone(
      this.intakeSessions.find((session) => session.firmId === firmId && session.id === sessionId),
    );
  }

  async createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord> {
    this.intakeSessions = [...this.intakeSessions, clone(session)];
    return clone(session);
  }

  async createAnswerSnapshot(snapshot: AnswerSnapshotRecord): Promise<AnswerSnapshotRecord> {
    this.answerSnapshots = [...this.answerSnapshots, clone(snapshot)];
    return clone(snapshot);
  }

  async listAnswerSnapshots(
    firmId: string,
    options: { intakeSessionId?: string } = {},
  ): Promise<AnswerSnapshotRecord[]> {
    return clone(
      this.answerSnapshots.filter(
        (snapshot) =>
          snapshot.firmId === firmId &&
          (!options.intakeSessionId || snapshot.intakeSessionId === options.intakeSessionId),
      ),
    );
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    this.generatedDocuments = [...this.generatedDocuments, clone(document)];
    return clone(document);
  }

  async createLedgerTransactionApproval(
    approval: LedgerTransactionApprovalRecord,
  ): Promise<LedgerTransactionApprovalRecord> {
    const transaction = this.postedTransactions.find(
      (posted) => posted.firmId === approval.firmId && posted.id === approval.transactionId,
    );
    if (!transaction) {
      throw new Error(`Unknown ledger transaction ${approval.transactionId}`);
    }
    const duplicateReviewer = this.ledgerApprovals.find(
      (candidate) =>
        candidate.firmId === approval.firmId &&
        candidate.transactionId === approval.transactionId &&
        candidate.decidedByUserId === approval.decidedByUserId,
    );
    if (duplicateReviewer) {
      throw new Error("Ledger approval reviewer has already recorded a decision");
    }
    this.ledgerApprovals = [...this.ledgerApprovals, clone(approval)];
    return clone(approval);
  }

  async listLedgerTransactionApprovals(
    firmId: string,
    options: { transactionId?: string } = {},
  ): Promise<LedgerTransactionApprovalRecord[]> {
    return clone(
      this.ledgerApprovals.filter(
        (approval) =>
          approval.firmId === firmId &&
          (!options.transactionId || approval.transactionId === options.transactionId),
      ),
    );
  }

  async createLedgerReconciliation(
    reconciliation: LedgerReconciliationRecord,
  ): Promise<LedgerReconciliationRecord> {
    const account = this.ledgerAccounts.find(
      (candidate) =>
        candidate.firmId === reconciliation.firmId && candidate.id === reconciliation.accountId,
    );
    if (!account) {
      throw new Error(`Unknown ledger account ${reconciliation.accountId}`);
    }
    if (
      new Date(reconciliation.statementPeriodEnd).getTime() <=
      new Date(reconciliation.statementPeriodStart).getTime()
    ) {
      throw new Error("Ledger reconciliation period end must be after period start");
    }
    this.ledgerReconciliations = [...this.ledgerReconciliations, clone(reconciliation)];
    return clone(reconciliation);
  }

  async listLedgerReconciliations(firmId: string): Promise<LedgerReconciliationRecord[]> {
    return clone(
      this.ledgerReconciliations.filter((reconciliation) => reconciliation.firmId === firmId),
    );
  }

  async listTimeEntries(
    firmId: string,
    options: { matterId?: string; status?: TimeEntry["billingStatus"] } = {},
  ): Promise<TimeEntry[]> {
    return clone(
      this.timeEntries.filter(
        (entry) =>
          entry.firmId === firmId &&
          (!options.matterId || entry.matterId === options.matterId) &&
          (!options.status || entry.billingStatus === options.status),
      ),
    );
  }

  async getTimeEntry(firmId: string, entryId: string): Promise<TimeEntry | undefined> {
    return clone(this.timeEntries.find((entry) => entry.firmId === firmId && entry.id === entryId));
  }

  async createTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
    this.timeEntries = [...this.timeEntries, clone(entry)];
    return clone(entry);
  }

  async updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Partial<TimeEntry>,
  ): Promise<TimeEntry> {
    const index = this.timeEntries.findIndex(
      (entry) => entry.firmId === firmId && entry.id === entryId,
    );
    if (index === -1) throw new Error("Time entry was not found");
    const updated = { ...this.timeEntries[index]!, ...updates };
    this.timeEntries = this.timeEntries.map((entry, candidateIndex) =>
      candidateIndex === index ? updated : entry,
    );
    return clone(updated);
  }

  async listExpenseEntries(
    firmId: string,
    options: { matterId?: string; status?: ExpenseEntry["billingStatus"] } = {},
  ): Promise<ExpenseEntry[]> {
    return clone(
      this.expenseEntries.filter(
        (entry) =>
          entry.firmId === firmId &&
          (!options.matterId || entry.matterId === options.matterId) &&
          (!options.status || entry.billingStatus === options.status),
      ),
    );
  }

  async getExpenseEntry(firmId: string, entryId: string): Promise<ExpenseEntry | undefined> {
    return clone(
      this.expenseEntries.find((entry) => entry.firmId === firmId && entry.id === entryId),
    );
  }

  async createExpenseEntry(entry: ExpenseEntry): Promise<ExpenseEntry> {
    this.expenseEntries = [...this.expenseEntries, clone(entry)];
    return clone(entry);
  }

  async updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Partial<ExpenseEntry>,
  ): Promise<ExpenseEntry> {
    const index = this.expenseEntries.findIndex(
      (entry) => entry.firmId === firmId && entry.id === entryId,
    );
    if (index === -1) throw new Error("Expense entry was not found");
    const updated = { ...this.expenseEntries[index]!, ...updates };
    this.expenseEntries = this.expenseEntries.map((entry, candidateIndex) =>
      candidateIndex === index ? updated : entry,
    );
    return clone(updated);
  }

  async listInvoices(
    firmId: string,
    options: { matterId?: string; status?: InvoiceRecord["status"] } = {},
  ): Promise<InvoiceWithLines[]> {
    return clone(
      this.invoices
        .filter(
          (invoice) =>
            invoice.firmId === firmId &&
            (!options.matterId || invoice.matterId === options.matterId) &&
            (!options.status || invoice.status === options.status),
        )
        .map((invoice) => ({
          ...invoice,
          lines: this.invoiceLines.filter((line) => line.invoiceId === invoice.id),
        })),
    );
  }

  async getInvoice(firmId: string, invoiceId: string): Promise<InvoiceWithLines | undefined> {
    const invoice = this.invoices.find(
      (candidate) => candidate.firmId === firmId && candidate.id === invoiceId,
    );
    if (!invoice) return undefined;
    return clone({
      ...invoice,
      lines: this.invoiceLines.filter((line) => line.invoiceId === invoice.id),
    });
  }

  async createInvoice(input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  }): Promise<InvoiceWithLines> {
    this.invoices = [...this.invoices, clone(input.invoice)];
    this.invoiceLines = [...this.invoiceLines, ...clone(input.lines)];
    return clone({ ...input.invoice, lines: input.lines });
  }

  async updateInvoice(invoice: InvoiceRecord): Promise<InvoiceWithLines> {
    const index = this.invoices.findIndex(
      (candidate) => candidate.firmId === invoice.firmId && candidate.id === invoice.id,
    );
    if (index === -1) throw new Error("Invoice was not found");
    this.invoices = this.invoices.map((candidate, candidateIndex) =>
      candidateIndex === index ? clone(invoice) : candidate,
    );
    return (await this.getInvoice(invoice.firmId, invoice.id))!;
  }

  async createPayment(input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  }): Promise<PaymentWithAllocations> {
    const allocatedCents = input.allocations.reduce(
      (sum, allocation) => sum + allocation.amountCents,
      0,
    );
    if (allocatedCents > input.payment.amountCents) {
      throw new Error("Payment allocations exceed payment amount");
    }
    for (const allocation of input.allocations) {
      const invoice = await this.getInvoice(input.payment.firmId, allocation.invoiceId);
      if (!invoice) throw new Error("Payment allocation invoice was not found");
      if (allocation.amountCents > invoice.balanceDueCents) {
        throw new Error("Payment allocation exceeds invoice balance");
      }
      const totals = calculateInvoiceTotals({
        lines: invoice.lines,
        allocations: [
          ...this.paymentAllocations.filter((existing) => existing.invoiceId === invoice.id),
          allocation,
        ],
      });
      await this.updateInvoice({
        ...invoice,
        ...totals,
        status: invoiceStatusForPayment({
          currentStatus: invoice.status,
          totalCents: totals.totalCents,
          paidCents: totals.paidCents,
        }),
      });
    }
    this.manualPayments = [...this.manualPayments, clone(input.payment)];
    this.paymentAllocations = [...this.paymentAllocations, ...clone(input.allocations)];
    return clone({ ...input.payment, allocations: input.allocations });
  }

  async listPayments(
    firmId: string,
    options: { matterId?: string; invoiceId?: string } = {},
  ): Promise<PaymentWithAllocations[]> {
    return clone(
      this.manualPayments
        .filter(
          (payment) =>
            payment.firmId === firmId &&
            (!options.matterId || payment.matterId === options.matterId) &&
            (!options.invoiceId || payment.invoiceId === options.invoiceId),
        )
        .map((payment) => ({
          ...payment,
          allocations: this.paymentAllocations.filter(
            (allocation) => allocation.paymentId === payment.id,
          ),
        })),
    );
  }

  async createTrustTransferRequest(
    request: TrustTransferRequestRecord,
  ): Promise<TrustTransferRequestRecord> {
    this.trustTransferRequests = [...this.trustTransferRequests, clone(request)];
    return clone(request);
  }

  async listTrustTransferRequests(
    firmId: string,
    options: { matterId?: string; status?: TrustTransferRequestRecord["status"] } = {},
  ): Promise<TrustTransferRequestRecord[]> {
    return clone(
      this.trustTransferRequests.filter(
        (request) =>
          request.firmId === firmId &&
          (!options.matterId || request.matterId === options.matterId) &&
          (!options.status || request.status === options.status),
      ),
    );
  }

  async createDocumentTextExtraction(
    extraction: DocumentTextExtractionRecord,
  ): Promise<DocumentTextExtractionRecord> {
    this.documentTextExtractions = [...this.documentTextExtractions, clone(extraction)];
    return clone(extraction);
  }

  async getDocumentTextExtractions(
    firmId: string,
    documentId: string,
  ): Promise<DocumentTextExtractionRecord[]> {
    return clone(
      this.documentTextExtractions.filter(
        (ext) => ext.firmId === firmId && ext.documentId === documentId,
      ),
    );
  }

  async listDrafts(
    firmId: string,
    options: { matterId?: string; userId?: string } = {},
  ): Promise<DraftRecord[]> {
    return clone(
      this.drafts.filter(
        (draft) =>
          draft.firmId === firmId &&
          (!options.matterId || draft.matterId === options.matterId) &&
          (!options.userId || draft.createdByUserId === options.userId),
      ),
    );
  }

  async getDraft(firmId: string, draftId: string): Promise<DraftRecord | undefined> {
    return clone(this.drafts.find((draft) => draft.firmId === firmId && draft.id === draftId));
  }

  async createDraft(draft: DraftRecord): Promise<DraftRecord> {
    this.drafts = [...this.drafts, clone(draft)];
    return clone(draft);
  }

  async updateDraft(
    firmId: string,
    draftId: string,
    updates: Partial<
      Pick<DraftRecord, "title" | "editorJson" | "renderedHtml" | "updatedByUserId">
    >,
  ): Promise<DraftRecord> {
    const draftIndex = this.drafts.findIndex((d) => d.firmId === firmId && d.id === draftId);
    if (draftIndex === -1) {
      throw new Error(`Draft ${draftId} not found`);
    }
    const updatedDraft = {
      ...this.drafts[draftIndex],
      ...updates,
      version: this.drafts[draftIndex]!.version + 1,
      updatedAt: new Date().toISOString(),
    } as DraftRecord;
    this.drafts[draftIndex] = updatedDraft;
    return clone(updatedDraft);
  }

  async deleteDraft(firmId: string, draftId: string): Promise<void> {
    this.drafts = this.drafts.filter((d) => d.firmId !== firmId || d.id !== draftId);
  }

  async listDraftTemplates(
    firmId: string,
    options: { category?: string; activeOnly?: boolean } = {},
  ): Promise<DraftTemplateRecord[]> {
    return clone(
      this.draftTemplates.filter(
        (t) =>
          t.firmId === firmId &&
          (!options.category || t.category === options.category) &&
          (!options.activeOnly || t.active),
      ),
    );
  }

  async createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord> {
    this.draftTemplates = [...this.draftTemplates, clone(template)];
    return clone(template);
  }

  async getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined> {
    const normalized = address.trim().toLowerCase();
    return clone(
      this.inboundEmailAddresses.find(
        (candidate) =>
          candidate.firmId === firmId && candidate.address.trim().toLowerCase() === normalized,
      ),
    );
  }

  async listInboundEmailMessages(
    firmId: string,
    options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
  ): Promise<InboundEmailMessageRecord[]> {
    return clone(
      this.inboundEmailMessages
        .filter(
          (message) =>
            message.firmId === firmId &&
            (!options.matterId || message.matterId === options.matterId) &&
            (!options.status || message.status === options.status),
        )
        .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
    );
  }

  async getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined> {
    return clone(
      this.inboundEmailMessages.find(
        (message) => message.firmId === firmId && message.id === messageId,
      ),
    );
  }

  async createInboundEmailMessage(
    message: InboundEmailMessageRecord,
  ): Promise<InboundEmailMessageRecord> {
    this.inboundEmailMessages = [...this.inboundEmailMessages, clone(message)];
    return clone(message);
  }

  async updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord> {
    const index = this.inboundEmailMessages.findIndex(
      (message) => message.firmId === firmId && message.id === messageId,
    );
    if (index === -1) throw new Error("Inbound email message was not found");
    const updated = { ...this.inboundEmailMessages[index]!, ...clone(updates) };
    this.inboundEmailMessages[index] = updated;
    return clone(updated);
  }

  async createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord> {
    this.inboundEmailAttachments = [...this.inboundEmailAttachments, clone(attachment)];
    return clone(attachment);
  }

  async listInboundEmailAttachments(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailAttachmentRecord[]> {
    return clone(
      this.inboundEmailAttachments.filter(
        (attachment) => attachment.firmId === firmId && attachment.inboundMessageId === messageId,
      ),
    );
  }
}

export class DrizzleOpenPracticeRepository implements OpenPracticeRepository {
  constructor(private readonly db: OpenPracticeDatabase) {}

  async getSetupStatus(): Promise<FirstRunSetupStatus> {
    const firms = await this.db.select({ id: schema.firms.id }).from(schema.firms).limit(2);
    const users = await this.db.select({ id: schema.users.id }).from(schema.users).limit(2);
    return setupStatusFromCounts(firms.length, users.length);
  }

  async completeFirstRunSetup(input: FirstRunSetupInput): Promise<FirstRunSetupResult> {
    return this.db.transaction(async (tx) => {
      const firms = await tx.select({ id: schema.firms.id }).from(schema.firms).limit(2);
      const users = await tx.select({ id: schema.users.id }).from(schema.users).limit(2);
      const status = setupStatusFromCounts(firms.length, users.length);
      if (!status.required || status.blocked) {
        throw new FirstRunSetupConflictError(
          status.reason ?? "First-run setup is already complete",
        );
      }

      await tx.insert(schema.firms).values(input.firm);
      await tx.insert(schema.users).values({
        id: input.owner.id,
        firmId: input.owner.firmId,
        displayName: input.owner.displayName,
        email: input.owner.email,
        role: input.owner.role,
        mfaEnabled: input.owner.mfaEnabled,
        practitionerProfile: input.owner.practitionerProfile || null,
      });
      await tx.insert(schema.authAccounts).values({
        firmId: input.owner.firmId,
        userId: input.owner.id,
        passwordHash: input.ownerPasswordHash,
        passwordUpdatedAt: new Date(input.ownerPasswordUpdatedAt),
      });
      await tx.insert(schema.firmSettings).values({
        firmId: input.settings.firmId,
        businessAddress: input.settings.businessAddress,
        officeEmail: input.settings.officeEmail,
        officePhone: input.settings.officePhone,
        practiceAreas: input.settings.practiceAreas,
        invoicePrefix: input.settings.invoicePrefix,
        defaultPaymentTermsDays: input.settings.defaultPaymentTermsDays,
        trustAccountLabel: input.settings.trustAccountLabel,
        trustFundsCaveatAcceptedAt: new Date(input.settings.trustFundsCaveatAcceptedAt),
        trustFundsCaveatAcceptedByUserId: input.settings.trustFundsCaveatAcceptedByUserId,
        website: input.settings.website || null,
        description: input.settings.description || null,
        businessNumber: input.settings.businessNumber || null,
        createdAt: new Date(input.settings.createdAt),
        updatedAt: new Date(input.settings.updatedAt),
      });

      if (input.firstContact) {
        await tx.insert(schema.contacts).values(input.firstContact);
      }
      if (input.firstMatter) {
        await tx.insert(schema.matters).values({
          ...input.firstMatter,
          openedOn: input.firstMatter.openedOn ? new Date(input.firstMatter.openedOn) : null,
          closedOn: input.firstMatter.closedOn ? new Date(input.firstMatter.closedOn) : null,
        });
        await tx.insert(schema.matterAssignments).values({
          matterId: input.firstMatter.id,
          userId: input.owner.id,
        });
      }
      if (input.firstMatterParty) {
        await tx.insert(schema.matterParties).values(input.firstMatterParty);
      }
      if (input.webAuthnCredential) {
        await tx.insert(schema.webAuthnCredentials).values({
          ...input.webAuthnCredential,
          createdAt: new Date(input.webAuthnCredential.createdAt),
          lastUsedAt: input.webAuthnCredential.lastUsedAt
            ? new Date(input.webAuthnCredential.lastUsedAt)
            : null,
          disabledAt: input.webAuthnCredential.disabledAt
            ? new Date(input.webAuthnCredential.disabledAt)
            : null,
        });
      }
      await tx.insert(schema.draftTemplates).values(
        buildBasicDraftTemplates(input.firm.id, input.settings.createdAt).map((template) => ({
          ...template,
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt),
        })),
      );
      await tx.insert(schema.auditEvents).values({
        ...input.auditEvent,
        occurredAt: new Date(input.auditEvent.occurredAt),
      });

      return {
        firm: input.firm,
        settings: input.settings,
        owner: input.owner,
        firstMatter: input.firstMatter,
      };
    });
  }

  async getFirmSettings(firmId: string): Promise<FirmSettings | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.firmSettings)
      .where(eq(schema.firmSettings.firmId, firmId));
    return row ? mapFirmSettingsRow(row) : undefined;
  }

  async listProviderSettings(
    firmId: string,
    options: { kind?: ProviderSettingRecord["kind"] } = {},
  ): Promise<ProviderSettingRecord[]> {
    const conditions = [eq(schema.providerSettings.firmId, firmId)];
    if (options.kind) conditions.push(eq(schema.providerSettings.kind, options.kind));
    const rows = await this.db
      .select()
      .from(schema.providerSettings)
      .where(and(...conditions))
      .orderBy(asc(schema.providerSettings.kind), asc(schema.providerSettings.key));
    return rows.map(mapProviderSettingRow);
  }

  async upsertProviderSetting(setting: ProviderSettingRecord): Promise<ProviderSettingRecord> {
    const [row] = await this.db
      .insert(schema.providerSettings)
      .values({
        ...setting,
        createdAt: new Date(setting.createdAt),
        updatedAt: new Date(setting.updatedAt),
      })
      .onConflictDoUpdate({
        target: [
          schema.providerSettings.firmId,
          schema.providerSettings.kind,
          schema.providerSettings.key,
        ],
        set: {
          enabled: setting.enabled,
          encryptedConfig: setting.encryptedConfig,
          updatedAt: new Date(setting.updatedAt),
        },
      })
      .returning();
    return mapProviderSettingRow(row);
  }

  async createJobLifecycleRecord(record: JobLifecycleRecord): Promise<JobLifecycleRecord> {
    const [row] = await this.db
      .insert(schema.jobLifecycleRecords)
      .values(jobLifecycleInsert(record))
      .returning();
    return mapJobLifecycleRow(row);
  }

  async createQueuedEmailOutbox(input: {
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }): Promise<{
    email: EmailOutboxRecord;
    event: EmailEventRecord;
    job: JobLifecycleRecord;
  }> {
    return this.db.transaction(async (tx) => {
      const [emailRow] = await tx
        .insert(schema.emailOutbox)
        .values(emailOutboxInsert(input.email))
        .returning();
      const [eventRow] = await tx
        .insert(schema.emailEvents)
        .values(emailEventInsert(input.event))
        .returning();
      const [jobRow] = await tx
        .insert(schema.jobLifecycleRecords)
        .values(jobLifecycleInsert(input.job))
        .returning();
      return {
        email: mapEmailOutboxRow(emailRow),
        event: mapEmailEventRow(eventRow),
        job: mapJobLifecycleRow(jobRow),
      };
    });
  }

  async getEmailOutbox(firmId: string, emailId: string): Promise<EmailOutboxRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(and(eq(schema.emailOutbox.firmId, firmId), eq(schema.emailOutbox.id, emailId)));
    return row ? mapEmailOutboxRow(row) : undefined;
  }

  async updateJobLifecycleRecord(
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
  ): Promise<JobLifecycleRecord> {
    const [row] = await this.db
      .update(schema.jobLifecycleRecords)
      .set({
        ...updates,
        startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
        finishedAt: updates.finishedAt ? new Date(updates.finishedAt) : undefined,
        failedAt: updates.failedAt ? new Date(updates.failedAt) : undefined,
      })
      .where(
        and(eq(schema.jobLifecycleRecords.firmId, firmId), eq(schema.jobLifecycleRecords.id, id)),
      )
      .returning();
    if (!row) throw new Error(`Job lifecycle record ${id} was not found`);
    return mapJobLifecycleRow(row);
  }

  async listJobLifecycleRecords(
    firmId: string,
    options: {
      status?: JobLifecycleRecord["status"];
      queueName?: JobLifecycleRecord["queueName"];
    } = {},
  ): Promise<JobLifecycleRecord[]> {
    const conditions = [eq(schema.jobLifecycleRecords.firmId, firmId)];
    if (options.status) conditions.push(eq(schema.jobLifecycleRecords.status, options.status));
    if (options.queueName)
      conditions.push(eq(schema.jobLifecycleRecords.queueName, options.queueName));
    const rows = await this.db
      .select()
      .from(schema.jobLifecycleRecords)
      .where(and(...conditions))
      .orderBy(asc(schema.jobLifecycleRecords.queuedAt));
    return rows.map(mapJobLifecycleRow);
  }

  async getUser(firmId: string, userId: string): Promise<User | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
    if (!row) return undefined;
    const assignments = await this.db
      .select()
      .from(schema.matterAssignments)
      .where(eq(schema.matterAssignments.userId, userId));
    return {
      id: row.id,
      firmId: row.firmId,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      assignedMatterIds: assignments.map((assignment) => assignment.matterId),
      mfaEnabled: row.mfaEnabled,
      practitionerProfile: row.practitionerProfile ?? undefined,
    };
  }

  async createUser(user: User): Promise<User> {
    const [row] = await this.db
      .insert(schema.users)
      .values({
        id: user.id,
        firmId: user.firmId,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        practitionerProfile: user.practitionerProfile,
      })
      .returning();
    return {
      ...user,
      id: row.id,
    };
  }

  async getUserByEmail(firmId: string, email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const users = await this.listUsers(firmId);
    return users.find((user) => user.email.trim().toLowerCase() === normalized);
  }

  async getAuthAccount(firmId: string, userId: string): Promise<AuthAccountRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authAccounts)
      .where(and(eq(schema.authAccounts.firmId, firmId), eq(schema.authAccounts.userId, userId)));
    return row ? mapAuthAccountRow(row) : undefined;
  }

  async setAuthPassword(input: {
    firmId: string;
    userId: string;
    passwordHash: string;
    passwordUpdatedAt: string;
  }): Promise<AuthAccountRecord> {
    const [row] = await this.db
      .insert(schema.authAccounts)
      .values({
        firmId: input.firmId,
        userId: input.userId,
        passwordHash: input.passwordHash,
        passwordUpdatedAt: new Date(input.passwordUpdatedAt),
      })
      .onConflictDoUpdate({
        target: [schema.authAccounts.firmId, schema.authAccounts.userId],
        set: {
          passwordHash: input.passwordHash,
          passwordUpdatedAt: new Date(input.passwordUpdatedAt),
        },
      })
      .returning();
    return mapAuthAccountRow(row);
  }

  async createAuthSession(session: AuthSessionRecord): Promise<AuthSessionRecord> {
    await this.db.insert(schema.authSessions).values({
      ...session,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
      revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt) : null,
    });
    return session;
  }

  async getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authSessions)
      .where(eq(schema.authSessions.tokenHash, tokenHash));
    return row ? mapAuthSessionRow(row) : undefined;
  }

  async touchAuthSession(tokenHash: string, seenAt: string): Promise<void> {
    await this.db
      .update(schema.authSessions)
      .set({ lastSeenAt: new Date(seenAt) })
      .where(eq(schema.authSessions.tokenHash, tokenHash));
  }

  async revokeAuthSession(tokenHash: string, revokedAt: string): Promise<void> {
    await this.db
      .update(schema.authSessions)
      .set({ revokedAt: new Date(revokedAt) })
      .where(eq(schema.authSessions.tokenHash, tokenHash));
  }

  async createPasswordSetupToken(
    token: AuthPasswordSetupTokenRecord,
  ): Promise<AuthPasswordSetupTokenRecord> {
    await this.db.insert(schema.authPasswordSetupTokens).values({
      ...token,
      createdByUserId: token.createdByUserId ?? null,
      createdAt: new Date(token.createdAt),
      expiresAt: new Date(token.expiresAt),
      usedAt: token.usedAt ? new Date(token.usedAt) : null,
    });
    return token;
  }

  async consumePasswordSetupToken(
    tokenHash: string,
    usedAt: string,
  ): Promise<AuthPasswordSetupTokenRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authPasswordSetupTokens)
      .where(eq(schema.authPasswordSetupTokens.tokenHash, tokenHash));
    if (!row || row.usedAt || row.expiresAt <= new Date(usedAt)) return undefined;
    const [updated] = await this.db
      .update(schema.authPasswordSetupTokens)
      .set({ usedAt: new Date(usedAt) })
      .where(eq(schema.authPasswordSetupTokens.tokenHash, tokenHash))
      .returning();
    return updated ? mapPasswordSetupTokenRow(updated) : undefined;
  }

  async createWebAuthnChallenge(
    challenge: WebAuthnChallengeRecord,
  ): Promise<WebAuthnChallengeRecord> {
    const [row] = await this.db
      .insert(schema.authChallenges)
      .values({
        id: challenge.id,
        firmId: challenge.firmId,
        userId: challenge.userId,
        challengeHash: challenge.challengeHash,
        purpose: challenge.purpose,
        expiresAt: new Date(challenge.expiresAt),
        createdAt: new Date(challenge.createdAt),
      })
      .returning();
    return mapAuthChallengeRow(row);
  }

  async getWebAuthnChallenge(challengeHash: string): Promise<WebAuthnChallengeRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authChallenges)
      .where(eq(schema.authChallenges.challengeHash, challengeHash));
    return row ? mapAuthChallengeRow(row) : undefined;
  }

  async consumeWebAuthnChallenge(challengeHash: string, consumedAt: string): Promise<boolean> {
    const [row] = await this.db
      .update(schema.authChallenges)
      .set({ consumedAt: new Date(consumedAt) })
      .where(
        and(
          eq(schema.authChallenges.challengeHash, challengeHash),
          isNull(schema.authChallenges.consumedAt),
        ),
      )
      .returning();
    return !!row;
  }

  async registerWebAuthnCredential(
    credential: WebAuthnCredentialRecord,
  ): Promise<WebAuthnCredentialRecord> {
    const [row] = await this.db
      .insert(schema.webAuthnCredentials)
      .values({
        id: credential.id,
        firmId: credential.firmId,
        userId: credential.userId,
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
        deviceType: credential.deviceType,
        backedUp: credential.backedUp,
        createdAt: new Date(credential.createdAt),
      })
      .returning();
    return mapWebAuthnCredentialRow(row);
  }

  async listWebAuthnCredentials(
    firmId: string,
    userId: string,
  ): Promise<WebAuthnCredentialRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.webAuthnCredentials)
      .where(
        and(
          eq(schema.webAuthnCredentials.firmId, firmId),
          eq(schema.webAuthnCredentials.userId, userId),
        ),
      );
    return rows.map(mapWebAuthnCredentialRow);
  }

  async getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.webAuthnCredentials)
      .where(eq(schema.webAuthnCredentials.credentialId, credentialId));
    return row ? mapWebAuthnCredentialRow(row) : undefined;
  }

  async updateWebAuthnCredentialCounter(id: string, counter: number): Promise<void> {
    await this.db
      .update(schema.webAuthnCredentials)
      .set({ counter, lastUsedAt: new Date() })
      .where(eq(schema.webAuthnCredentials.id, id));
  }

  async deleteWebAuthnCredential(firmId: string, id: string): Promise<void> {
    await this.db
      .delete(schema.webAuthnCredentials)
      .where(
        and(eq(schema.webAuthnCredentials.firmId, firmId), eq(schema.webAuthnCredentials.id, id)),
      );
  }

  async updateUserMfaStatus(firmId: string, userId: string, mfaEnabled: boolean): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ mfaEnabled })
      .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
  }

  async createRecoveryCodes(
    firmId: string,
    userId: string,
    codes: RecoveryCodeRecord[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Invalidate old codes
      await tx
        .delete(schema.recoveryCodes)
        .where(
          and(eq(schema.recoveryCodes.firmId, firmId), eq(schema.recoveryCodes.userId, userId)),
        );

      if (codes.length > 0) {
        await tx.insert(schema.recoveryCodes).values(
          codes.map((c) => ({
            id: c.id,
            firmId: c.firmId,
            userId: c.userId,
            codeHash: c.codeHash,
            createdAt: new Date(c.createdAt),
          })),
        );
      }
    });
  }

  async useRecoveryCode(
    firmId: string,
    userId: string,
    codeHash: string,
    consumedAt: string,
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(schema.recoveryCodes)
      .set({ usedAt: new Date(consumedAt) })
      .where(
        and(
          eq(schema.recoveryCodes.firmId, firmId),
          eq(schema.recoveryCodes.userId, userId),
          eq(schema.recoveryCodes.codeHash, codeHash),
          isNull(schema.recoveryCodes.usedAt),
        ),
      )
      .returning();
    return !!updated;
  }

  async listRecoveryCodes(firmId: string, userId: string): Promise<RecoveryCodeRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.recoveryCodes)
      .where(and(eq(schema.recoveryCodes.firmId, firmId), eq(schema.recoveryCodes.userId, userId)));
    return rows.map(mapRecoveryCodeRow);
  }

  async getOverview(firmId: string): Promise<PracticeOverview> {
    const [firmRow] = await this.db.select().from(schema.firms).where(eq(schema.firms.id, firmId));
    if (!firmRow) throw new Error(`Unknown firm ${firmId}`);
    const users = await this.listUsers(firmId);
    const matters = await this.db
      .select()
      .from(schema.matters)
      .where(eq(schema.matters.firmId, firmId));
    const grants = await this.listPortalGrants(firmId);
    const ledger = await this.getLedger(firmId);
    const timeEntries = await this.db
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.firmId, firmId));
    return {
      firm: { id: firmRow.id, name: firmRow.name, defaultProvince: firmRow.defaultProvince },
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        intakeMatters: matters.filter((matter) => matter.status === "intake").length,
        portalGrants: grants.filter((grant) => !grant.revokedAt).length,
        trustBalanceCents: Object.values(ledger.trustBalances).reduce(
          (sum, value) => sum + value,
          0,
        ),
        unbilledMinutes: timeEntries
          .filter(
            (entry) =>
              entry.billable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
          )
          .reduce((sum, entry) => sum + entry.minutes, 0),
      },
      users,
    };
  }

  async listMattersForUser(user: User): Promise<MatterSummary[]> {
    if (user.assignedMatterIds.length === 0) return [];
    const matterRows = await this.db
      .select()
      .from(schema.matters)
      .where(inArray(schema.matters.id, user.assignedMatterIds));
    const ledger = await this.getLedger(user.firmId);
    const allParties = await this.listMatterParties(user.firmId);
    const contacts = await this.listContacts(user.firmId);
    const documents = await this.listDocuments(user.firmId);
    const timeEntries = await this.listTimeEntries(user.firmId);
    const expenses = await this.listExpenseEntries(user.firmId);
    const grants = await this.listPortalGrants(user.firmId);
    const audit = await this.listAuditEvents(user.firmId);
    const signatureRequests = await this.listSignatureRequests(user.firmId);
    const intakeSessions = await this.listIntakeSessions(user.firmId);

    return matterRows.map((row) => {
      const matter = mapMatter(row);
      const parties = allParties
        .filter((party) => party.matterId === matter.id)
        .map((party) => ({
          ...party,
          contact: contacts.find((contact) => contact.id === party.contactId)!,
        }));
      return {
        ...matter,
        parties,
        documents: documents.filter((document) => document.matterId === matter.id),
        timeEntries: timeEntries.filter((entry) => entry.matterId === matter.id),
        expenses: expenses.filter((entry) => entry.matterId === matter.id),
        activity: buildActivityTimeline({
          firmId: user.firmId,
          matterId: matter.id,
          documents,
          portalGrants: grants,
          auditEvents: audit.events,
          signatureRequests,
          intakeSessions,
        }),
        trustBalanceCents: matterTrustBalance(ledger.entries, ledger.accounts, matter, allParties),
      };
    });
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.id, documentId)));
    return row ? mapDocumentRow(row) : undefined;
  }

  async listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.matterId, matterId)));
    return rows.map(mapDocumentRow);
  }

  async listCalendarEvents(
    firmId: string,
    options: { matterId: string; startsAfter?: string; startsBefore?: string },
  ): Promise<CalendarEventRecord[]> {
    const filters = [
      eq(schema.calendarEvents.firmId, firmId),
      eq(schema.calendarEvents.matterId, options.matterId),
      isNull(schema.calendarEvents.deletedAt),
    ];
    if (options.startsAfter) {
      filters.push(sql`${schema.calendarEvents.startsAt} >= ${new Date(options.startsAfter)}`);
    }
    if (options.startsBefore) {
      filters.push(sql`${schema.calendarEvents.startsAt} < ${new Date(options.startsBefore)}`);
    }
    const rows = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(and(...filters))
      .orderBy(asc(schema.calendarEvents.startsAt), asc(schema.calendarEvents.id));
    return rows.map(mapCalendarEventRow);
  }

  async getCalendarEvent(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, firmId),
          eq(schema.calendarEvents.matterId, matterId),
          eq(schema.calendarEvents.id, eventId),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    return row ? mapCalendarEventRow(row) : undefined;
  }

  async getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): Promise<CalendarEventRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, firmId),
          eq(schema.calendarEvents.matterId, matterId),
          eq(schema.calendarEvents.uid, uid),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    return row ? mapCalendarEventRow(row) : undefined;
  }

  async upsertCalendarEvent(event: CalendarEventUpsertInput): Promise<CalendarEventRecord> {
    const values = {
      id: event.id,
      firmId: event.firmId,
      matterId: event.matterId,
      uid: event.uid,
      title: event.title,
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      description: event.description ?? null,
      location: event.location ?? null,
      status: event.status,
      sequence: event.sequence,
      createdAt: new Date(event.createdAt),
      updatedAt: new Date(event.updatedAt),
      deletedAt: event.deletedAt ? new Date(event.deletedAt) : null,
      createdByUserId: event.createdByUserId,
      updatedByUserId: event.updatedByUserId,
    };
    const [eventIdCollision] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.id, event.id));
    if (
      eventIdCollision &&
      (eventIdCollision.firmId !== event.firmId || eventIdCollision.matterId !== event.matterId)
    ) {
      throw new CalendarEventScopeConflictError(event.id);
    }

    const [activeUidCollision] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.firmId, event.firmId),
          eq(schema.calendarEvents.matterId, event.matterId),
          eq(schema.calendarEvents.uid, event.uid),
          isNull(schema.calendarEvents.deletedAt),
        ),
      );
    if (activeUidCollision && activeUidCollision.id !== event.id) {
      throw new CalendarEventUidConflictError(event.uid);
    }

    let row: typeof schema.calendarEvents.$inferSelect | undefined;
    try {
      [row] = await this.db
        .insert(schema.calendarEvents)
        .values(values)
        .onConflictDoUpdate({
          target: schema.calendarEvents.id,
          set: {
            uid: values.uid,
            title: values.title,
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            description: values.description,
            location: values.location,
            status: values.status,
            sequence: values.sequence,
            updatedAt: values.updatedAt,
            deletedAt: values.deletedAt,
            updatedByUserId: values.updatedByUserId,
          },
          setWhere: sql`${schema.calendarEvents.firmId} = ${event.firmId} and ${schema.calendarEvents.matterId} = ${event.matterId}`,
        })
        .returning();
    } catch (error) {
      if (isPostgresUniqueViolation(error, "calendar_events_firm_matter_uid_idx")) {
        throw new CalendarEventUidConflictError(event.uid);
      }
      throw error;
    }
    if (!row) {
      throw new CalendarEventScopeConflictError(event.id);
    }
    return mapCalendarEventRow(row);
  }

  async deleteCalendarEvent(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventRecord | undefined> {
    const [row] = await this.db
      .update(schema.calendarEvents)
      .set({
        deletedAt: new Date(input.deletedAt),
        updatedAt: new Date(input.deletedAt),
        updatedByUserId: input.updatedByUserId,
        sequence: sql`${schema.calendarEvents.sequence} + 1`,
      })
      .where(
        and(
          eq(schema.calendarEvents.firmId, input.firmId),
          eq(schema.calendarEvents.matterId, input.matterId),
          eq(schema.calendarEvents.id, input.eventId),
          isNull(schema.calendarEvents.deletedAt),
        ),
      )
      .returning();
    return row ? mapCalendarEventRow(row) : undefined;
  }

  async createCalendarCredential(
    credential: CalendarCredentialRecord,
  ): Promise<CalendarCredentialRecord> {
    const [row] = await this.db
      .insert(schema.calendarCredentials)
      .values({
        id: credential.id,
        firmId: credential.firmId,
        userId: credential.userId,
        username: credential.username,
        label: credential.label,
        passwordHash: credential.passwordHash,
        createdAt: new Date(credential.createdAt),
        createdByUserId: credential.createdByUserId,
        lastUsedAt: credential.lastUsedAt ? new Date(credential.lastUsedAt) : null,
        revokedAt: credential.revokedAt ? new Date(credential.revokedAt) : null,
      })
      .returning();
    return mapCalendarCredentialRow(row);
  }

  async listCalendarCredentials(
    firmId: string,
    userId: string,
  ): Promise<CalendarCredentialRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.calendarCredentials)
      .where(
        and(
          eq(schema.calendarCredentials.firmId, firmId),
          eq(schema.calendarCredentials.userId, userId),
        ),
      )
      .orderBy(asc(schema.calendarCredentials.createdAt));
    return rows.map(mapCalendarCredentialRow);
  }

  async getCalendarCredentialByUsername(
    username: string,
  ): Promise<CalendarCredentialRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.calendarCredentials)
      .where(
        and(
          eq(schema.calendarCredentials.username, username),
          isNull(schema.calendarCredentials.revokedAt),
        ),
      );
    return row ? mapCalendarCredentialRow(row) : undefined;
  }

  async touchCalendarCredential(id: string, lastUsedAt: string): Promise<void> {
    await this.db
      .update(schema.calendarCredentials)
      .set({ lastUsedAt: new Date(lastUsedAt) })
      .where(eq(schema.calendarCredentials.id, id));
  }

  async revokeCalendarCredential(input: {
    firmId: string;
    userId: string;
    credentialId: string;
    revokedAt: string;
  }): Promise<CalendarCredentialRecord | undefined> {
    const [row] = await this.db
      .update(schema.calendarCredentials)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(
        and(
          eq(schema.calendarCredentials.firmId, input.firmId),
          eq(schema.calendarCredentials.userId, input.userId),
          eq(schema.calendarCredentials.id, input.credentialId),
        ),
      )
      .returning();
    return row ? mapCalendarCredentialRow(row) : undefined;
  }

  async runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }> {
    const contacts = await this.listContacts(input.firmId);
    const matters = (
      await this.db.select().from(schema.matters).where(eq(schema.matters.firmId, input.firmId))
    ).map(mapMatter);
    const matterParties = await this.listMatterParties(input.firmId);
    const results = runConflictCheck({ ...input, contacts, matters, matterParties });
    const previous = (await this.listAuditEvents(input.firmId)).events.at(-1);
    const event = appendAuditEvent(previous, {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      actorId: input.actorId,
      action: "conflict_check.completed",
      resourceType: "conflict_check",
      resourceId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
    });
    await this.db.insert(schema.auditEvents).values({
      ...event,
      occurredAt: new Date(event.occurredAt),
    });
    return { results, auditChainValid: (await this.listAuditEvents(input.firmId)).valid };
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }> {
    const accounts = (await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.firmId, firmId))) as LedgerAccount[];
    const rows = await this.db
      .select()
      .from(schema.trustLedgerEntries)
      .where(
        options.matterId
          ? and(
              eq(schema.trustLedgerEntries.firmId, firmId),
              eq(schema.trustLedgerEntries.matterId, options.matterId),
            )
          : eq(schema.trustLedgerEntries.firmId, firmId),
      );
    const transactionRows = await this.db
      .select()
      .from(schema.trustTransactions)
      .where(eq(schema.trustTransactions.firmId, firmId));
    const postedAtByTransactionId = new Map(
      transactionRows.map((transaction) => [transaction.id, transaction.postedAt.toISOString()]),
    );
    const entries: LedgerEntry[] = rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      firmId: row.firmId,
      matterId: row.matterId,
      clientId: row.clientId,
      accountId: row.accountId,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      memo: row.memo,
      postedAt: postedAtByTransactionId.get(row.transactionId) ?? "",
    }));
    return {
      accounts,
      entries,
      balances: ledgerBalanceByMatter(entries),
      trustBalances: clientTrustBalanceByMatter(entries, accounts),
    };
  }

  async validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void> {
    if (input.transaction.firmId !== input.user.firmId) {
      throw new Error("Ledger transaction firm does not match authenticated user");
    }

    const firmWide = userHasFirmWideLedgerAccess(input.user);
    const matterIds = [...new Set(input.transaction.entries.map((entry) => entry.matterId))];
    const clientIds = [...new Set(input.transaction.entries.map((entry) => entry.clientId))];
    const accountIds = [...new Set(input.transaction.entries.map((entry) => entry.accountId))];

    const [matters, contacts, accounts, parties] = await Promise.all([
      this.db.select().from(schema.matters).where(inArray(schema.matters.id, matterIds)),
      this.db.select().from(schema.contacts).where(inArray(schema.contacts.id, clientIds)),
      this.db
        .select()
        .from(schema.ledgerAccounts)
        .where(inArray(schema.ledgerAccounts.id, accountIds)),
      this.db
        .select()
        .from(schema.matterParties)
        .where(inArray(schema.matterParties.matterId, matterIds)),
    ]);

    for (const entry of input.transaction.entries) {
      if (entry.firmId !== input.user.firmId) {
        throw new Error("Ledger entry firm does not match authenticated user");
      }
      if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
        throw new Error("Ledger entry is outside the authenticated matter scope");
      }
      const matter = matters.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
      );
      if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
      const contact = contacts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
      );
      if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
      const account = accounts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
      );
      if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
      const party = parties.find(
        (candidate) =>
          candidate.firmId === input.user.firmId &&
          candidate.matterId === entry.matterId &&
          candidate.contactId === entry.clientId &&
          !candidate.adverse,
      );
      if (!party) {
        throw new Error("Ledger client must be a non-adverse party on the matter");
      }
    }
  }

  async postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction> {
    return this.db.transaction(async (tx) => {
      const requestFingerprint =
        transaction.requestFingerprint ?? ledgerRequestFingerprint(transaction);
      const [duplicateTransaction] = await tx
        .select()
        .from(schema.trustTransactions)
        .where(
          and(
            eq(schema.trustTransactions.firmId, transaction.firmId),
            eq(schema.trustTransactions.idempotencyKey, transaction.idempotencyKey),
          ),
        );

      if (duplicateTransaction) {
        if (duplicateTransaction.requestFingerprint !== requestFingerprint) {
          throw new Error("Idempotency key was reused with a different ledger payload");
        }
        const duplicateEntries = await tx
          .select()
          .from(schema.trustLedgerEntries)
          .where(eq(schema.trustLedgerEntries.transactionId, duplicateTransaction.id));
        return {
          id: duplicateTransaction.id,
          firmId: duplicateTransaction.firmId,
          idempotencyKey: duplicateTransaction.idempotencyKey,
          requestFingerprint: duplicateTransaction.requestFingerprint,
          reversesTransactionId: duplicateTransaction.reversesTransactionId ?? undefined,
          entries: duplicateEntries.map((entry) => ({
            id: entry.id,
            transactionId: entry.transactionId,
            firmId: entry.firmId,
            matterId: entry.matterId,
            clientId: entry.clientId,
            accountId: entry.accountId,
            debitCents: entry.debitCents,
            creditCents: entry.creditCents,
            memo: entry.memo,
            postedAt: duplicateTransaction.postedAt.toISOString(),
          })),
        };
      }

      const existingRows = await tx
        .select()
        .from(schema.trustTransactions)
        .where(eq(schema.trustTransactions.firmId, transaction.firmId));
      const entryRows = await tx
        .select()
        .from(schema.trustLedgerEntries)
        .where(eq(schema.trustLedgerEntries.firmId, transaction.firmId));
      const postedTransactions: PostedLedgerTransaction[] = existingRows.map((row) => ({
        id: row.id,
        firmId: row.firmId,
        idempotencyKey: row.idempotencyKey,
        requestFingerprint: row.requestFingerprint,
        reversesTransactionId: row.reversesTransactionId ?? undefined,
        entries: entryRows
          .filter((entry) => entry.transactionId === row.id)
          .map((entry) => ({
            id: entry.id,
            transactionId: entry.transactionId,
            firmId: entry.firmId,
            matterId: entry.matterId,
            clientId: entry.clientId,
            accountId: entry.accountId,
            debitCents: entry.debitCents,
            creditCents: entry.creditCents,
            memo: entry.memo,
            postedAt: row.postedAt.toISOString(),
          })),
      }));
      const accounts = (await tx
        .select()
        .from(schema.ledgerAccounts)
        .where(eq(schema.ledgerAccounts.firmId, transaction.firmId))) as LedgerAccount[];
      const posted = postLedgerTransaction(
        { postedTransactions, accounts },
        { ...transaction, requestFingerprint },
      );

      await tx.insert(schema.trustTransactions).values({
        id: posted.id,
        firmId: posted.firmId,
        idempotencyKey: posted.idempotencyKey,
        requestFingerprint: posted.requestFingerprint,
        postedByUserId: transaction.postedByUserId,
        postedAt: new Date(transaction.postedAt),
        reversesTransactionId: posted.reversesTransactionId,
      });
      await tx.insert(schema.trustLedgerEntries).values(posted.entries);

      const updatedAt = new Date(transaction.postedAt);
      for (const delta of clientTrustBalanceDeltas(posted.entries, accounts)) {
        if (delta.deltaCents > 0) {
          await tx
            .insert(schema.trustClientBalances)
            .values({
              firmId: delta.firmId,
              matterId: delta.matterId,
              clientId: delta.clientId,
              balanceCents: delta.deltaCents,
              updatedAt,
            })
            .onConflictDoUpdate({
              target: [
                schema.trustClientBalances.firmId,
                schema.trustClientBalances.matterId,
                schema.trustClientBalances.clientId,
              ],
              set: {
                balanceCents: sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents}`,
                updatedAt,
              },
            });
          continue;
        }

        const updatedBalances = await tx
          .update(schema.trustClientBalances)
          .set({
            balanceCents: sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents}`,
            updatedAt,
          })
          .where(
            and(
              eq(schema.trustClientBalances.firmId, delta.firmId),
              eq(schema.trustClientBalances.matterId, delta.matterId),
              eq(schema.trustClientBalances.clientId, delta.clientId),
              sql`${schema.trustClientBalances.balanceCents} + ${delta.deltaCents} >= 0`,
            ),
          )
          .returning({ balanceCents: schema.trustClientBalances.balanceCents });
        if (updatedBalances.length === 0) {
          throw new Error("Trust transaction would overdraw the client matter balance");
        }
      }

      return posted;
    });
  }

  async listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const rows = await this.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, firmId))
      .orderBy(asc(schema.auditEvents.occurredAt));
    const events = rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
      metadata: row.metadata as Record<string, unknown>,
    }));
    return { events, valid: verifyAuditChain(events) };
  }

  async appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent> {
    const [previousRow] = await this.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, event.firmId))
      .orderBy(desc(schema.auditEvents.occurredAt))
      .limit(1);
    const previous = previousRow
      ? {
          ...previousRow,
          occurredAt: previousRow.occurredAt.toISOString(),
          metadata: previousRow.metadata as Record<string, unknown>,
        }
      : undefined;
    const appended = appendAuditEvent(previous, event);
    await this.db.insert(schema.auditEvents).values({
      ...appended,
      occurredAt: new Date(appended.occurredAt),
      metadata: appended.metadata,
    });
    return appended;
  }

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    await this.db.insert(schema.auditEvents).values({
      ...event,
      occurredAt: new Date(event.occurredAt),
    });
  }

  async listPortalGrants(firmId: string): Promise<PortalGrant[]> {
    const rows = await this.db
      .select()
      .from(schema.portalGrants)
      .where(eq(schema.portalGrants.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      matterId: row.matterId,
      contactId: row.contactId,
      grantedByUserId: row.grantedByUserId,
      permissions: row.permissions as PortalGrant["permissions"],
      expiresAt: dateToIso(row.expiresAt),
      revokedAt: dateToIso(row.revokedAt),
    }));
  }

  async listShareLinks(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<ShareLinkRecord[]> {
    const filters = [eq(schema.shareLinks.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.shareLinks.matterId, options.matterId));
    const rows = await this.db
      .select()
      .from(schema.shareLinks)
      .where(and(...filters))
      .orderBy(desc(schema.shareLinks.createdAt));
    return rows.map(mapShareLinkRow);
  }

  async createShareLink(link: ShareLinkRecord): Promise<ShareLinkRecord> {
    await this.db.insert(schema.shareLinks).values({
      id: link.id,
      firmId: link.firmId,
      matterId: link.matterId,
      tokenHash: link.tokenHash,
      grantedByUserId: link.grantedByUserId,
      permissions: link.permissions,
      requireEmailVerification: link.requireEmailVerification,
      expiresAt: link.expiresAt ? new Date(link.expiresAt) : null,
      revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
      createdAt: new Date(link.createdAt),
    });
    return clone(link);
  }

  async getShareLink(firmId: string, id: string): Promise<ShareLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.shareLinks)
      .where(and(eq(schema.shareLinks.firmId, firmId), eq(schema.shareLinks.id, id)));
    return row ? mapShareLinkRow(row) : undefined;
  }

  async getShareLinkByTokenHash(tokenHash: string): Promise<ShareLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.shareLinks)
      .where(eq(schema.shareLinks.tokenHash, tokenHash));
    return row ? mapShareLinkRow(row) : undefined;
  }

  async revokeShareLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ShareLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.shareLinks)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(and(eq(schema.shareLinks.firmId, input.firmId), eq(schema.shareLinks.id, input.id)))
      .returning();
    return row ? mapShareLinkRow(row) : undefined;
  }

  async listExternalUploadLinks(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<ExternalUploadLinkRecord[]> {
    const conditions = [eq(schema.externalUploadLinks.firmId, firmId)];
    if (options.matterId) {
      conditions.push(eq(schema.externalUploadLinks.matterId, options.matterId));
    }
    const rows = await this.db
      .select()
      .from(schema.externalUploadLinks)
      .where(and(...conditions))
      .orderBy(desc(schema.externalUploadLinks.createdAt));
    return rows.map(mapExternalUploadLinkRow);
  }

  async createExternalUploadLink(
    link: ExternalUploadLinkRecord,
  ): Promise<ExternalUploadLinkRecord> {
    const [row] = await this.db
      .insert(schema.externalUploadLinks)
      .values(externalUploadLinkInsert(link))
      .returning();
    return mapExternalUploadLinkRow(row);
  }

  async getExternalUploadLinkByTokenHash(
    tokenHash: string,
  ): Promise<ExternalUploadLinkRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.externalUploadLinks)
      .where(eq(schema.externalUploadLinks.tokenHash, tokenHash));
    return row ? mapExternalUploadLinkRow(row) : undefined;
  }

  async revokeExternalUploadLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined> {
    const [row] = await this.db
      .update(schema.externalUploadLinks)
      .set({ revokedAt: new Date(input.revokedAt) })
      .where(
        and(
          eq(schema.externalUploadLinks.firmId, input.firmId),
          eq(schema.externalUploadLinks.id, input.id),
        ),
      )
      .returning();
    return row ? mapExternalUploadLinkRow(row) : undefined;
  }

  async claimExternalUploadUse(input: {
    firmId: string;
    id: string;
    usedAt: string;
  }): Promise<ExternalUploadLinkRecord | undefined> {
    const usedAt = new Date(input.usedAt);
    const [row] = await this.db
      .update(schema.externalUploadLinks)
      .set({ usedUploads: sql`${schema.externalUploadLinks.usedUploads} + 1` })
      .where(
        and(
          eq(schema.externalUploadLinks.firmId, input.firmId),
          eq(schema.externalUploadLinks.id, input.id),
          isNull(schema.externalUploadLinks.revokedAt),
          sql`${schema.externalUploadLinks.expiresAt} > ${usedAt}`,
          sql`${schema.externalUploadLinks.usedUploads} < ${schema.externalUploadLinks.maxUploads}`,
        ),
      )
      .returning();
    return row ? mapExternalUploadLinkRow(row) : undefined;
  }

  async createAccessLog(log: AccessLogRecord): Promise<AccessLogRecord> {
    const [row] = await this.db.insert(schema.accessLogs).values(accessLogInsert(log)).returning();
    return mapAccessLogRow(row);
  }

  async listAccessLogs(
    firmId: string,
    options: {
      shareLinkId?: string;
      externalUploadLinkId?: string;
      resourceType?: string;
      resourceId?: string;
    } = {},
  ): Promise<AccessLogRecord[]> {
    const conditions = [eq(schema.accessLogs.firmId, firmId)];
    if (options.shareLinkId) {
      conditions.push(eq(schema.accessLogs.shareLinkId, options.shareLinkId));
    }
    if (options.externalUploadLinkId) {
      conditions.push(eq(schema.accessLogs.externalUploadLinkId, options.externalUploadLinkId));
    }
    if (options.resourceType) {
      conditions.push(eq(schema.accessLogs.resourceType, options.resourceType));
    }
    if (options.resourceId) {
      conditions.push(eq(schema.accessLogs.resourceId, options.resourceId));
    }
    const rows = await this.db
      .select()
      .from(schema.accessLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.accessLogs.occurredAt));
    return rows.map(mapAccessLogRow);
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    const supersededDocument = input.supersedesDocumentId
      ? await this.getDocument(input.firmId, input.supersedesDocumentId)
      : undefined;
    if (
      input.supersedesDocumentId &&
      (!supersededDocument || supersededDocument.matterId !== input.matterId)
    ) {
      throw new Error(`Unknown superseded document ${input.supersedesDocumentId}`);
    }
    const now = new Date();
    const document = {
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: input.storageKey,
      checksumSha256: input.checksumSha256,
      version: supersededDocument ? supersededDocument.version + 1 : 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "intent_created" as const,
      checksumStatus: "pending" as const,
      scanStatus: "pending" as const,
      supersedesDocumentId: input.supersedesDocumentId,
    };
    await this.db.transaction(async (tx) => {
      if (supersededDocument) {
        await tx
          .update(schema.documents)
          .set({ supersededAt: now })
          .where(
            and(
              eq(schema.documents.firmId, input.firmId),
              eq(schema.documents.id, supersededDocument.id),
            ),
          );
      }
      await tx.insert(schema.documents).values(document);
    });
    return document;
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const document = await this.getDocument(input.firmId, input.documentId);
    if (!document) throw new Error(`Unknown document ${input.documentId}`);
    const documents = await this.listDocuments(input.firmId);
    const duplicate = documents.find(
      (candidate) =>
        candidate.id !== input.documentId &&
        candidate.checksumSha256 === input.checksumSha256 &&
        candidate.checksumStatus === "verified",
    );
    const now = new Date();
    const checksumMatches = document.checksumSha256 === input.checksumSha256;
    const [row] = await this.db
      .update(schema.documents)
      .set({
        uploadStatus: checksumMatches ? "verified" : "rejected",
        checksumStatus: checksumMatches ? (duplicate ? "duplicate" : "verified") : "mismatch",
        scanStatus: checksumMatches ? (input.scanStatus ?? "queued") : "failed",
        duplicateOfDocumentId: duplicate?.id,
        uploadedAt: now,
        verifiedAt: now,
      })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  }

  async updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const [row] = await this.db
      .update(schema.documents)
      .set({ scanStatus: input.scanStatus })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<SignatureRequestRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureRequests)
      .where(
        options.matterId
          ? and(
              eq(schema.signatureRequests.firmId, firmId),
              eq(schema.signatureRequests.matterId, options.matterId),
            )
          : eq(schema.signatureRequests.firmId, firmId),
      );
    return rows.map(mapSignatureRequestRow);
  }

  async createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.signatureRequests).values({
        ...input.request,
        createdAt: new Date(input.request.createdAt),
        completedAt: input.request.completedAt ? new Date(input.request.completedAt) : null,
        declinedAt: input.request.declinedAt ? new Date(input.request.declinedAt) : null,
      });
      await tx.insert(schema.signatureRequestSigners).values(
        input.signers.map((signer) => ({
          ...signer,
          completedAt: signer.completedAt ? new Date(signer.completedAt) : null,
        })),
      );
      await tx.insert(schema.signatureProviderEvents).values({
        ...input.event,
        occurredAt: new Date(input.event.occurredAt),
      });
    });
    return { request: input.request, signers: input.signers };
  }

  async recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord> {
    const [current] = await this.db
      .select()
      .from(schema.signatureRequests)
      .where(
        and(
          eq(schema.signatureRequests.firmId, event.firmId),
          eq(schema.signatureRequests.id, event.signatureRequestId),
        ),
      );
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.signatureProviderEvents).values({
        ...event,
        occurredAt: new Date(event.occurredAt),
      });
      if (webhookAttempt) {
        await tx.insert(schema.signatureWebhookAttempts).values({
          ...webhookAttempt,
          receivedAt: new Date(webhookAttempt.receivedAt),
          processedAt: webhookAttempt.processedAt ? new Date(webhookAttempt.processedAt) : null,
        });
      }
      if (
        current &&
        shouldUpdateSignatureRequestStatus(current.status as SignatureProviderStatus, event)
      ) {
        await tx
          .update(schema.signatureRequests)
          .set({
            status: event.status,
            evidence: event.evidence,
            completedAt: event.status === "completed" ? new Date(event.occurredAt) : undefined,
            declinedAt: event.status === "declined" ? new Date(event.occurredAt) : undefined,
          })
          .where(
            and(
              eq(schema.signatureRequests.firmId, event.firmId),
              eq(schema.signatureRequests.id, event.signatureRequestId),
            ),
          );
      }
    });
    return event;
  }

  async recordSignatureWebhookAttempt(
    attempt: SignatureWebhookAttemptRecord,
  ): Promise<SignatureWebhookAttemptRecord> {
    await this.db.insert(schema.signatureWebhookAttempts).values({
      ...attempt,
      receivedAt: new Date(attempt.receivedAt),
      processedAt: attempt.processedAt ? new Date(attempt.processedAt) : null,
    });
    return attempt;
  }

  async listSignatureProviderEvents(
    firmId: string,
    options: { signatureRequestId?: string } = {},
  ): Promise<SignatureProviderEventRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureProviderEvents)
      .where(
        options.signatureRequestId
          ? and(
              eq(schema.signatureProviderEvents.firmId, firmId),
              eq(schema.signatureProviderEvents.signatureRequestId, options.signatureRequestId),
            )
          : eq(schema.signatureProviderEvents.firmId, firmId),
      )
      .orderBy(asc(schema.signatureProviderEvents.occurredAt));
    return rows.map(mapSignatureProviderEventRow);
  }

  async listSignatureWebhookAttempts(
    firmId: string,
    options: { provider?: SignatureWebhookAttemptRecord["provider"]; externalId?: string } = {},
  ): Promise<SignatureWebhookAttemptRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureWebhookAttempts)
      .where(eq(schema.signatureWebhookAttempts.firmId, firmId))
      .orderBy(asc(schema.signatureWebhookAttempts.receivedAt));
    return rows
      .map(mapSignatureWebhookAttemptRow)
      .filter(
        (attempt) =>
          (!options.provider || attempt.provider === options.provider) &&
          (!options.externalId || attempt.externalId === options.externalId),
      );
  }

  async listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.intakeTemplates)
      .where(eq(schema.intakeTemplates.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      name: row.name,
      provider: row.provider as IntakeTemplateRecord["provider"],
      externalTemplateId: row.externalTemplateId,
      active: row.active,
      definitionVersion: row.definitionVersion,
      definition: row.definition,
    }));
  }

  async listIntakeSessions(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<IntakeSessionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.intakeSessions)
      .where(
        options.matterId
          ? and(
              eq(schema.intakeSessions.firmId, firmId),
              eq(schema.intakeSessions.matterId, options.matterId),
            )
          : eq(schema.intakeSessions.firmId, firmId),
      );
    return rows.map(mapIntakeSessionRow);
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): Promise<IntakeSessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.intakeSessions)
      .where(
        and(eq(schema.intakeSessions.firmId, firmId), eq(schema.intakeSessions.id, sessionId)),
      );
    return row ? mapIntakeSessionRow(row) : undefined;
  }

  async createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord> {
    await this.db.insert(schema.intakeSessions).values({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    });
    return session;
  }

  async createAnswerSnapshot(snapshot: AnswerSnapshotRecord): Promise<AnswerSnapshotRecord> {
    await this.db.insert(schema.answerSnapshots).values({
      ...snapshot,
      capturedAt: new Date(snapshot.capturedAt),
    });
    return snapshot;
  }

  async listAnswerSnapshots(
    firmId: string,
    options: { intakeSessionId?: string } = {},
  ): Promise<AnswerSnapshotRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.answerSnapshots)
      .where(
        options.intakeSessionId
          ? and(
              eq(schema.answerSnapshots.firmId, firmId),
              eq(schema.answerSnapshots.intakeSessionId, options.intakeSessionId),
            )
          : eq(schema.answerSnapshots.firmId, firmId),
      );
    return rows.map(mapAnswerSnapshotRow);
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    await this.db.insert(schema.generatedDocuments).values({
      ...document,
      createdAt: new Date(document.createdAt),
    });
    return document;
  }

  async createLedgerTransactionApproval(
    approval: LedgerTransactionApprovalRecord,
  ): Promise<LedgerTransactionApprovalRecord> {
    const [transaction] = await this.db
      .select()
      .from(schema.trustTransactions)
      .where(
        and(
          eq(schema.trustTransactions.firmId, approval.firmId),
          eq(schema.trustTransactions.id, approval.transactionId),
        ),
      );
    if (!transaction) {
      throw new Error(`Unknown ledger transaction ${approval.transactionId}`);
    }
    const [duplicateReviewer] = await this.db
      .select()
      .from(schema.trustTransactionApprovals)
      .where(
        and(
          eq(schema.trustTransactionApprovals.firmId, approval.firmId),
          eq(schema.trustTransactionApprovals.transactionId, approval.transactionId),
          eq(schema.trustTransactionApprovals.decidedByUserId, approval.decidedByUserId),
        ),
      );
    if (duplicateReviewer) {
      throw new Error("Ledger approval reviewer has already recorded a decision");
    }
    await this.db.insert(schema.trustTransactionApprovals).values({
      ...approval,
      decidedAt: new Date(approval.decidedAt),
    });
    return approval;
  }

  async listLedgerTransactionApprovals(
    firmId: string,
    options: { transactionId?: string } = {},
  ): Promise<LedgerTransactionApprovalRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.trustTransactionApprovals)
      .where(
        options.transactionId
          ? and(
              eq(schema.trustTransactionApprovals.firmId, firmId),
              eq(schema.trustTransactionApprovals.transactionId, options.transactionId),
            )
          : eq(schema.trustTransactionApprovals.firmId, firmId),
      );
    return rows.map(mapLedgerApprovalRow);
  }

  async createLedgerReconciliation(
    reconciliation: LedgerReconciliationRecord,
  ): Promise<LedgerReconciliationRecord> {
    const [account] = await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(
        and(
          eq(schema.ledgerAccounts.firmId, reconciliation.firmId),
          eq(schema.ledgerAccounts.id, reconciliation.accountId),
        ),
      );
    if (!account) {
      throw new Error(`Unknown ledger account ${reconciliation.accountId}`);
    }
    if (
      new Date(reconciliation.statementPeriodEnd).getTime() <=
      new Date(reconciliation.statementPeriodStart).getTime()
    ) {
      throw new Error("Ledger reconciliation period end must be after period start");
    }
    await this.db.insert(schema.trustReconciliations).values({
      ...reconciliation,
      statementPeriodStart: new Date(reconciliation.statementPeriodStart),
      statementPeriodEnd: new Date(reconciliation.statementPeriodEnd),
      createdAt: new Date(reconciliation.createdAt),
    });
    return reconciliation;
  }

  async listLedgerReconciliations(firmId: string): Promise<LedgerReconciliationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.trustReconciliations)
      .where(eq(schema.trustReconciliations.firmId, firmId))
      .orderBy(asc(schema.trustReconciliations.createdAt));
    return rows.map(mapLedgerReconciliationRow);
  }

  private async listUsers(firmId: string): Promise<User[]> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.firmId, firmId));
    return Promise.all(rows.map((row) => this.getUser(row.firmId, row.id))).then((users) =>
      users.filter((user): user is User => Boolean(user)),
    );
  }

  private async listContacts(firmId: string): Promise<Contact[]> {
    const rows = await this.db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      kind: row.kind,
      displayName: row.displayName,
      aliases: row.aliases,
      identifiers: row.identifiers as Contact["identifiers"],
      notes: row.notes ?? undefined,
    }));
  }

  private async listMatterParties(firmId: string): Promise<MatterParty[]> {
    return this.db
      .select()
      .from(schema.matterParties)
      .where(eq(schema.matterParties.firmId, firmId));
  }

  private async listDocuments(firmId: string): Promise<DocumentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.firmId, firmId));
    return rows.map(mapDocumentRow);
  }

  async listTimeEntries(
    firmId: string,
    options: { matterId?: string; status?: TimeEntry["billingStatus"] } = {},
  ): Promise<TimeEntry[]> {
    const filters = [eq(schema.timeEntries.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.timeEntries.matterId, options.matterId));
    if (options.status) filters.push(eq(schema.timeEntries.billingStatus, options.status));
    const rows = await this.db
      .select()
      .from(schema.timeEntries)
      .where(and(...filters));
    return rows.map(mapTimeEntryRow);
  }

  async getTimeEntry(firmId: string, entryId: string): Promise<TimeEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.timeEntries)
      .where(and(eq(schema.timeEntries.firmId, firmId), eq(schema.timeEntries.id, entryId)));
    return row ? mapTimeEntryRow(row) : undefined;
  }

  async createTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
    await this.db.insert(schema.timeEntries).values({
      ...entry,
      performedAt: new Date(entry.performedAt),
    });
    return clone(entry);
  }

  async updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Partial<TimeEntry>,
  ): Promise<TimeEntry> {
    const [row] = await this.db
      .update(schema.timeEntries)
      .set({
        ...updates,
        performedAt: updates.performedAt ? new Date(updates.performedAt) : undefined,
      })
      .where(and(eq(schema.timeEntries.firmId, firmId), eq(schema.timeEntries.id, entryId)))
      .returning();
    if (!row) throw new Error("Time entry was not found");
    return mapTimeEntryRow(row);
  }

  async listExpenseEntries(
    firmId: string,
    options: { matterId?: string; status?: ExpenseEntry["billingStatus"] } = {},
  ): Promise<ExpenseEntry[]> {
    const filters = [eq(schema.expenseEntries.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.expenseEntries.matterId, options.matterId));
    if (options.status) filters.push(eq(schema.expenseEntries.billingStatus, options.status));
    const rows = await this.db
      .select()
      .from(schema.expenseEntries)
      .where(and(...filters));
    return rows.map(mapExpenseEntryRow);
  }

  async getExpenseEntry(firmId: string, entryId: string): Promise<ExpenseEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.expenseEntries)
      .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)));
    return row ? mapExpenseEntryRow(row) : undefined;
  }

  async createExpenseEntry(entry: ExpenseEntry): Promise<ExpenseEntry> {
    await this.db.insert(schema.expenseEntries).values({
      ...entry,
      incurredAt: new Date(entry.incurredAt),
    });
    return clone(entry);
  }

  async updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Partial<ExpenseEntry>,
  ): Promise<ExpenseEntry> {
    const [row] = await this.db
      .update(schema.expenseEntries)
      .set({
        ...updates,
        incurredAt: updates.incurredAt ? new Date(updates.incurredAt) : undefined,
      })
      .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)))
      .returning();
    if (!row) throw new Error("Expense entry was not found");
    return mapExpenseEntryRow(row);
  }

  async listInvoices(
    firmId: string,
    options: { matterId?: string; status?: InvoiceRecord["status"] } = {},
  ): Promise<InvoiceWithLines[]> {
    const filters = [eq(schema.invoices.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.invoices.matterId, options.matterId));
    if (options.status) filters.push(eq(schema.invoices.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.invoices)
      .where(and(...filters));
    const lines = await this.db
      .select()
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.firmId, firmId));
    return rows.map((row) => ({
      ...mapInvoiceRow(row),
      lines: lines.filter((line) => line.invoiceId === row.id).map(mapInvoiceLineRow),
    }));
  }

  async getInvoice(firmId: string, invoiceId: string): Promise<InvoiceWithLines | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.firmId, firmId), eq(schema.invoices.id, invoiceId)));
    if (!row) return undefined;
    const lines = await this.db
      .select()
      .from(schema.invoiceLines)
      .where(eq(schema.invoiceLines.invoiceId, invoiceId));
    return { ...mapInvoiceRow(row), lines: lines.map(mapInvoiceLineRow) };
  }

  async createInvoice(input: {
    invoice: InvoiceRecord;
    lines: InvoiceLineRecord[];
  }): Promise<InvoiceWithLines> {
    await this.db.insert(schema.invoices).values(invoiceInsert(input.invoice));
    if (input.lines.length > 0) {
      await this.db.insert(schema.invoiceLines).values(input.lines.map(invoiceLineInsert));
    }
    return { ...clone(input.invoice), lines: clone(input.lines) };
  }

  async updateInvoice(invoice: InvoiceRecord): Promise<InvoiceWithLines> {
    const [row] = await this.db
      .update(schema.invoices)
      .set(invoiceInsert(invoice))
      .where(and(eq(schema.invoices.firmId, invoice.firmId), eq(schema.invoices.id, invoice.id)))
      .returning();
    if (!row) throw new Error("Invoice was not found");
    return (await this.getInvoice(invoice.firmId, invoice.id))!;
  }

  async createPayment(input: {
    payment: ManualPaymentRecord;
    allocations: PaymentAllocationRecord[];
  }): Promise<PaymentWithAllocations> {
    const allocatedCents = input.allocations.reduce(
      (sum, allocation) => sum + allocation.amountCents,
      0,
    );
    if (allocatedCents > input.payment.amountCents) {
      throw new Error("Payment allocations exceed payment amount");
    }
    for (const allocation of input.allocations) {
      const invoice = await this.getInvoice(input.payment.firmId, allocation.invoiceId);
      if (!invoice) throw new Error("Payment allocation invoice was not found");
      if (allocation.amountCents > invoice.balanceDueCents) {
        throw new Error("Payment allocation exceeds invoice balance");
      }
    }
    await this.db.insert(schema.manualPayments).values(paymentInsert(input.payment));
    if (input.allocations.length > 0) {
      await this.db
        .insert(schema.paymentAllocations)
        .values(input.allocations.map(paymentAllocationInsert));
    }
    for (const allocation of input.allocations) {
      const invoice = await this.getInvoice(input.payment.firmId, allocation.invoiceId);
      if (!invoice) continue;
      const existingAllocations = await this.listPaymentAllocationsForInvoice(
        input.payment.firmId,
        allocation.invoiceId,
      );
      const totals = calculateInvoiceTotals({
        lines: invoice.lines,
        allocations: existingAllocations,
      });
      await this.updateInvoice({
        ...invoice,
        ...totals,
        status: invoiceStatusForPayment({
          currentStatus: invoice.status,
          totalCents: totals.totalCents,
          paidCents: totals.paidCents,
        }),
      });
    }
    return { ...clone(input.payment), allocations: clone(input.allocations) };
  }

  async listPayments(
    firmId: string,
    options: { matterId?: string; invoiceId?: string } = {},
  ): Promise<PaymentWithAllocations[]> {
    const filters = [eq(schema.manualPayments.firmId, firmId)];
    if (options.matterId) filters.push(eq(schema.manualPayments.matterId, options.matterId));
    if (options.invoiceId) filters.push(eq(schema.manualPayments.invoiceId, options.invoiceId));
    const payments = await this.db
      .select()
      .from(schema.manualPayments)
      .where(and(...filters));
    const allocations = await this.db
      .select()
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.firmId, firmId));
    return payments.map((payment) => ({
      ...mapPaymentRow(payment),
      allocations: allocations
        .filter((allocation) => allocation.paymentId === payment.id)
        .map(mapPaymentAllocationRow),
    }));
  }

  async createTrustTransferRequest(
    request: TrustTransferRequestRecord,
  ): Promise<TrustTransferRequestRecord> {
    await this.db
      .insert(schema.billingTrustTransferRequests)
      .values(trustTransferRequestInsert(request));
    return clone(request);
  }

  async listTrustTransferRequests(
    firmId: string,
    options: { matterId?: string; status?: TrustTransferRequestRecord["status"] } = {},
  ): Promise<TrustTransferRequestRecord[]> {
    const filters = [eq(schema.billingTrustTransferRequests.firmId, firmId)];
    if (options.matterId) {
      filters.push(eq(schema.billingTrustTransferRequests.matterId, options.matterId));
    }
    if (options.status) {
      filters.push(eq(schema.billingTrustTransferRequests.status, options.status));
    }
    const rows = await this.db
      .select()
      .from(schema.billingTrustTransferRequests)
      .where(and(...filters));
    return rows.map(mapTrustTransferRequestRow);
  }

  private async listPaymentAllocationsForInvoice(
    firmId: string,
    invoiceId: string,
  ): Promise<PaymentAllocationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.paymentAllocations)
      .where(
        and(
          eq(schema.paymentAllocations.firmId, firmId),
          eq(schema.paymentAllocations.invoiceId, invoiceId),
        ),
      );
    return rows.map(mapPaymentAllocationRow);
  }

  async createDocumentTextExtraction(
    extraction: DocumentTextExtractionRecord,
  ): Promise<DocumentTextExtractionRecord> {
    await this.db.insert(schema.documentTextExtractions).values({
      ...extraction,
      createdAt: new Date(extraction.createdAt),
      completedAt: extraction.completedAt ? new Date(extraction.completedAt) : null,
    });
    return extraction;
  }

  async getDocumentTextExtractions(
    firmId: string,
    documentId: string,
  ): Promise<DocumentTextExtractionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documentTextExtractions)
      .where(
        and(
          eq(schema.documentTextExtractions.firmId, firmId),
          eq(schema.documentTextExtractions.documentId, documentId),
        ),
      );
    return rows.map(mapDocumentTextExtractionRow);
  }

  async listDrafts(
    firmId: string,
    options: { matterId?: string; userId?: string } = {},
  ): Promise<DraftRecord[]> {
    const conditions = [eq(schema.drafts.firmId, firmId)];
    if (options.matterId) conditions.push(eq(schema.drafts.matterId, options.matterId));
    if (options.userId) conditions.push(eq(schema.drafts.createdByUserId, options.userId));

    const rows = await this.db
      .select()
      .from(schema.drafts)
      .where(and(...conditions))
      .orderBy(asc(schema.drafts.createdAt));
    return rows.map(mapDraftRow);
  }

  async getDraft(firmId: string, draftId: string): Promise<DraftRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.drafts)
      .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)));
    return row ? mapDraftRow(row) : undefined;
  }

  async createDraft(draft: DraftRecord): Promise<DraftRecord> {
    await this.db.insert(schema.drafts).values({
      ...draft,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    });
    return draft;
  }

  async updateDraft(
    firmId: string,
    draftId: string,
    updates: Partial<
      Pick<DraftRecord, "title" | "editorJson" | "renderedHtml" | "updatedByUserId">
    >,
  ): Promise<DraftRecord> {
    const [row] = await this.db
      .update(schema.drafts)
      .set({
        ...updates,
        version: sql`${schema.drafts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)))
      .returning();
    if (!row) throw new Error(`Draft ${draftId} not found`);
    return mapDraftRow(row);
  }

  async deleteDraft(firmId: string, draftId: string): Promise<void> {
    await this.db
      .delete(schema.drafts)
      .where(and(eq(schema.drafts.firmId, firmId), eq(schema.drafts.id, draftId)));
  }

  async listDraftTemplates(
    firmId: string,
    options: { category?: string; activeOnly?: boolean } = {},
  ): Promise<DraftTemplateRecord[]> {
    const conditions = [eq(schema.draftTemplates.firmId, firmId)];
    if (options.category) conditions.push(eq(schema.draftTemplates.category, options.category));
    if (options.activeOnly) conditions.push(eq(schema.draftTemplates.active, true));

    const rows = await this.db
      .select()
      .from(schema.draftTemplates)
      .where(and(...conditions))
      .orderBy(asc(schema.draftTemplates.name));
    return rows.map(mapDraftTemplateRow);
  }

  async createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord> {
    await this.db.insert(schema.draftTemplates).values({
      ...template,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
    });
    return template;
  }

  async getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined> {
    const normalized = address.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(schema.inboundEmailAddresses)
      .where(eq(schema.inboundEmailAddresses.firmId, firmId));
    return rows
      .map(mapInboundEmailAddressRow)
      .find((candidate) => candidate.address.trim().toLowerCase() === normalized);
  }

  async listInboundEmailMessages(
    firmId: string,
    options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
  ): Promise<InboundEmailMessageRecord[]> {
    const conditions = [eq(schema.inboundEmailMessages.firmId, firmId)];
    if (options.matterId)
      conditions.push(eq(schema.inboundEmailMessages.matterId, options.matterId));
    if (options.status) conditions.push(eq(schema.inboundEmailMessages.status, options.status));
    const rows = await this.db
      .select()
      .from(schema.inboundEmailMessages)
      .where(and(...conditions))
      .orderBy(desc(schema.inboundEmailMessages.receivedAt));
    return rows.map(mapInboundEmailMessageRow);
  }

  async getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.inboundEmailMessages)
      .where(
        and(
          eq(schema.inboundEmailMessages.firmId, firmId),
          eq(schema.inboundEmailMessages.id, messageId),
        ),
      );
    return row ? mapInboundEmailMessageRow(row) : undefined;
  }

  async createInboundEmailMessage(
    message: InboundEmailMessageRecord,
  ): Promise<InboundEmailMessageRecord> {
    await this.db.insert(schema.inboundEmailMessages).values({
      ...message,
      receivedAt: new Date(message.receivedAt),
    });
    return message;
  }

  async updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord> {
    const [row] = await this.db
      .update(schema.inboundEmailMessages)
      .set(updates)
      .where(
        and(
          eq(schema.inboundEmailMessages.firmId, firmId),
          eq(schema.inboundEmailMessages.id, messageId),
        ),
      )
      .returning();
    if (!row) throw new Error("Inbound email message was not found");
    return mapInboundEmailMessageRow(row);
  }

  async createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord> {
    await this.db.insert(schema.inboundEmailAttachments).values(attachment);
    return attachment;
  }

  async listInboundEmailAttachments(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailAttachmentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.inboundEmailAttachments)
      .where(
        and(
          eq(schema.inboundEmailAttachments.firmId, firmId),
          eq(schema.inboundEmailAttachments.inboundMessageId, messageId),
        ),
      );
    return rows.map(mapInboundEmailAttachmentRow);
  }
}

export { DrizzleOpenPracticeRepository as PostgresOpenPracticeRepository };

function mapMatter(row: typeof schema.matters.$inferSelect): Matter {
  return {
    id: row.id,
    firmId: row.firmId,
    number: row.number,
    title: row.title,
    practiceArea: row.practiceArea,
    status: row.status,
    jurisdiction: row.jurisdiction,
    responsibleUserId: row.responsibleUserId,
    openedOn: dateToIso(row.openedOn),
    closedOn: dateToIso(row.closedOn),
  };
}

function mapTimeEntryRow(row: typeof schema.timeEntries.$inferSelect): TimeEntry {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    userId: row.userId,
    performedAt: row.performedAt.toISOString(),
    minutes: row.minutes,
    rateCents: row.rateCents,
    narrative: row.narrative,
    billable: row.billable,
    billingStatus: row.billingStatus as TimeEntry["billingStatus"],
  };
}

function mapExpenseEntryRow(row: typeof schema.expenseEntries.$inferSelect): ExpenseEntry {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    incurredAt: row.incurredAt.toISOString(),
    amountCents: row.amountCents,
    category: row.category,
    description: row.description,
    reimbursable: row.reimbursable,
    billingStatus: row.billingStatus as ExpenseEntry["billingStatus"],
  };
}

function mapInvoiceRow(row: typeof schema.invoices.$inferSelect): InvoiceRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    clientContactId: row.clientContactId ?? undefined,
    invoiceNumber: row.invoiceNumber,
    status: row.status as InvoiceRecord["status"],
    approvedAt: dateToIso(row.approvedAt),
    issuedAt: dateToIso(row.issuedAt),
    dueAt: dateToIso(row.dueAt),
    memo: row.memo ?? undefined,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    voidedAt: dateToIso(row.voidedAt),
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    paidCents: row.paidCents,
    balanceDueCents: row.balanceDueCents,
  };
}

function invoiceInsert(invoice: InvoiceRecord): typeof schema.invoices.$inferInsert {
  return {
    id: invoice.id,
    firmId: invoice.firmId,
    matterId: invoice.matterId,
    clientContactId: invoice.clientContactId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    approvedAt: invoice.approvedAt ? new Date(invoice.approvedAt) : null,
    issuedAt: invoice.issuedAt ? new Date(invoice.issuedAt) : null,
    dueAt: invoice.dueAt ? new Date(invoice.dueAt) : null,
    memo: invoice.memo,
    createdByUserId: invoice.createdByUserId,
    createdAt: new Date(invoice.createdAt),
    voidedAt: invoice.voidedAt ? new Date(invoice.voidedAt) : null,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    paidCents: invoice.paidCents,
    balanceDueCents: invoice.balanceDueCents,
  };
}

function mapInvoiceLineRow(row: typeof schema.invoiceLines.$inferSelect): InvoiceLineRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    invoiceId: row.invoiceId,
    matterId: row.matterId,
    kind: row.kind as InvoiceLineRecord["kind"],
    description: row.description,
    quantity: row.quantity,
    unitAmountCents: row.unitAmountCents,
    subtotalCents: row.subtotalCents,
    taxName: row.taxName ?? undefined,
    taxRateBps: row.taxRateBps,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    timeEntryId: row.timeEntryId ?? undefined,
    expenseEntryId: row.expenseEntryId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function invoiceLineInsert(line: InvoiceLineRecord): typeof schema.invoiceLines.$inferInsert {
  return {
    ...line,
    createdAt: new Date(line.createdAt),
  };
}

function mapPaymentRow(row: typeof schema.manualPayments.$inferSelect): ManualPaymentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    invoiceId: row.invoiceId ?? undefined,
    clientContactId: row.clientContactId ?? undefined,
    receivedAt: row.receivedAt.toISOString(),
    amountCents: row.amountCents,
    method: row.method as ManualPaymentRecord["method"],
    reference: row.reference ?? undefined,
    status: row.status as ManualPaymentRecord["status"],
    receivedByUserId: row.receivedByUserId,
    notes: row.notes ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
  };
}

function paymentInsert(payment: ManualPaymentRecord): typeof schema.manualPayments.$inferInsert {
  return {
    ...payment,
    receivedAt: new Date(payment.receivedAt),
  };
}

function mapPaymentAllocationRow(
  row: typeof schema.paymentAllocations.$inferSelect,
): PaymentAllocationRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    paymentId: row.paymentId,
    invoiceId: row.invoiceId,
    amountCents: row.amountCents,
    allocatedAt: row.allocatedAt.toISOString(),
  };
}

function paymentAllocationInsert(
  allocation: PaymentAllocationRecord,
): typeof schema.paymentAllocations.$inferInsert {
  return {
    ...allocation,
    allocatedAt: new Date(allocation.allocatedAt),
  };
}

function mapTrustTransferRequestRow(
  row: typeof schema.billingTrustTransferRequests.$inferSelect,
): TrustTransferRequestRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    clientContactId: row.clientContactId ?? undefined,
    invoiceId: row.invoiceId,
    requestedByUserId: row.requestedByUserId,
    amountCents: row.amountCents,
    status: row.status as TrustTransferRequestRecord["status"],
    reason: row.reason ?? undefined,
    requestedAt: row.requestedAt.toISOString(),
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: dateToIso(row.reviewedAt),
    ledgerTransactionId: row.ledgerTransactionId ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
  };
}

function trustTransferRequestInsert(
  request: TrustTransferRequestRecord,
): typeof schema.billingTrustTransferRequests.$inferInsert {
  return {
    ...request,
    requestedAt: new Date(request.requestedAt),
    reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
  };
}
