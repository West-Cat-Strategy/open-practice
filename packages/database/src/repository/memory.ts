import type {
  AnswerSnapshotRecord,
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  DocumentTextExtractionRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureEnvelopeRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import {
  appendAuditEvent,
  buildBasicDraftTemplates,
  buildMatterSetupProfile,
  buildContactDossiers,
  buildPracticePresetTemplates,
  canAccess,
  billingPeriodLocksOverlap,
  billingRateRulesOverlapAtSameActiveScope,
  calculateInvoiceTotals,
  clientTrustBalanceByMatter,
  transitionCalendarGuestLinkStatus,
  transitionCalendarMeetingSessionStatus,
  invoiceStatusForPayment,
  ledgerBalanceByMatter,
  postLedgerTransaction,
  runConflictCheck,
  shouldUpdateSignatureRequestStatus,
  validateAiOperationalProposalRecord,
  validateLedgerReconciliationExceptionResolutionRecord,
  validateLedgerReconciliationRecord,
  validateLedgerStatementImportBatchRecord,
  validateBillingPeriodLock,
  validateBillingRateRule,
  validateContactDataQualityResolutionRecord,
  validateContactRelationshipRecord,
  verifyAuditChain,
  type AccessLogRecord,
  type AiOperationalProposalKind,
  type AiOperationalProposalRecord,
  type AiOperationalProposalStatus,
  type AuditEvent,
  type CalendarCredentialRecord,
  type CalendarEventAttendeeRecord,
  type CalendarEventRecord,
  type CalendarEventReminderRecord,
  type CalendarGuestLinkRecord,
  type CalendarMeetingSessionRecord,
  type CalendarSchedulingRequestRecord,
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
  type ConflictCheckRecord,
  type ConnectorDeliveryAttemptRecord,
  type ConnectorOutboxRecord,
  type ConnectorRecord,
  type Contact,
  type ContactDataQualityResolutionRecord,
  type ContactDossier,
  type ContactIdentifier,
  type ContactRelationshipRecord,
  type ConversationMessageRecord,
  type ConversationMessageNotificationRecord,
  type ConversationThreadRecord,
  type DocumentRecord,
  type DraftAssistRecord,
  type DraftRecord,
  type DraftTemplateRecord,
  type EmailEventRecord,
  type EmailOutboxRecord,
  type EmailReceiptTokenRecord,
  type ExpenseEntry,
  type ExternalUploadLinkRecord,
  type Firm,
  type FirmSettings,
  type InboundEmailAddressRecord,
  type InboundEmailAttachmentRecord,
  type InboundEmailMessageRecord,
  type IntegrationApiCredentialRecord,
  type IntegrationDeveloperAppRecord,
  type IntegrationWebhookSubscriptionRecord,
  type IntakeFormItemActionRecord,
  type IntakeFormLinkRecord,
  type IntakeFormReviewRecord,
  type IntakeVariableProposal,
  type HostedPaymentRequestRecord,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type JobLifecycleRecord,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerReconciliationExceptionResolutionRecord,
  type LedgerReconciliationRecord,
  type LedgerStatementImportBatchRecord,
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
  type PublicConsultationIntakeRecord,
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
import {
  sampleAuditEvents,
  sampleCalendarEvents,
  sampleCalendarSchedulingRequests,
  sampleContactRelationships,
  sampleDocumentAssemblyPackages,
  sampleDocumentAssemblySetDefinitions,
  sampleAiOperationalProposals,
  sampleContacts,
  sampleDocuments,
  sampleDraftTemplates,
  sampleExpenseEntries,
  sampleFirm,
  sampleGeneratedDocuments,
  sampleIntakeSessions,
  sampleIntakeTemplates,
  sampleInvoiceLines,
  sampleInvoices,
  sampleHostedPaymentRequests,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleLegalClinicMatterProfiles,
  sampleLegalClinicPrograms,
  sampleManualPayments,
  sampleMatterParties,
  sampleMatters,
  samplePaymentAllocations,
  samplePortalGrants,
  sampleSignatureProviderEvents,
  sampleSignatureEnvelopes,
  sampleSignatureRequestSigners,
  sampleSignatureRequests,
  sampleSignatureWebhookAttempts,
  sampleTaskDeadlines,
  sampleTimeEntries,
  sampleTrustTransferRequests,
  sampleUsers,
} from "@open-practice/domain/sample-data";
import type {
  AuthAccountRecord,
  AuthPasswordSetupTokenRecord,
  AuthSessionRecord,
  CalendarGuestLinkCreateInput,
  CalendarEventAttendeeUpsertInput,
  CalendarEventReminderUpsertInput,
  CalendarEventUpsertInput,
  CalendarMeetingSessionCreateInput,
  ConvertPublicConsultationIntakeInput,
  CreateMatterWithClientInput,
  DocumentUploadIntent,
  FirstRunSetupInput,
  FirstRunSetupResult,
  FirstRunSetupStatus,
  ConfiguredFirmResolution,
  InboundAttachmentPromotionInput,
  InboundAttachmentPromotionResult,
  InvoiceWithLines,
  MatterSummary,
  OpenPracticeRepository,
  PaymentWithAllocations,
  PracticeOverview,
  PublicConsultationIntakeListOptions,
  PublicConsultationIntakeUpdateInput,
  TaskDeadlineCompletionInput,
  HostedPaymentRequestUpdate,
  TrustTransferRequestUpdate,
  TrustTransferRequestUpdateOptions,
} from "./contracts.js";
import {
  CalendarEventScopeConflictError,
  CalendarEventUidConflictError,
  FirstRunSetupConflictError,
  IdempotencyKeyConflictError,
  applyConversationThreadLifecycleAction,
  assertSameIdempotencyFingerprint,
  canonicalizeForIdempotency,
  clone,
  sanitizeConnectorDeliveryMetadata,
  sanitizeConnectorDeliverySummary,
  type ConversationThreadLifecycleAction,
} from "./contracts.js";

import {
  activeCalendarAttendees,
  activeCalendarReminders,
  buildActivityTimeline,
  matterTrustBalance,
  nextEmailAttemptCount,
  sanitizeEmailFailureSummary,
  setupStatusFromCounts,
  userHasFirmWideLedgerAccess,
} from "./drizzle-mappers.js";

function isFirmWideMatterReader(user: User): boolean {
  return user.role === "owner_admin" || user.role === "auditor";
}

function nextMatterNumber(matters: Matter[], firmId: string, openedOn: string): string {
  const year = new Date(openedOn).getUTCFullYear();
  const prefix = `${year}-`;
  const maxExisting = matters
    .filter((matter) => matter.firmId === firmId && matter.number.startsWith(prefix))
    .reduce((max, matter) => {
      const value = Number.parseInt(matter.number.slice(prefix.length), 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
  return `${prefix}${String(maxExisting + 1).padStart(4, "0")}`;
}

export class InMemoryOpenPracticeRepository implements OpenPracticeRepository {
  private firms: Firm[];
  private users: User[];
  private contacts: Contact[];
  private contactRelationships: ContactRelationshipRecord[];
  private contactDataQualityResolutions: ContactDataQualityResolutionRecord[] = [];
  private matters: Matter[];
  private matterParties: MatterParty[];
  private documents: DocumentRecord[];
  private legalClinicPrograms: LegalClinicProgram[];
  private legalClinicMatterProfiles: LegalClinicMatterProfile[];
  private conversationThreads: ConversationThreadRecord[] = [];
  private conversationMessages: ConversationMessageRecord[] = [];
  private conversationMessageNotifications: ConversationMessageNotificationRecord[] = [];
  private calendarEvents: CalendarEventRecord[];
  private calendarSchedulingRequests: CalendarSchedulingRequestRecord[];
  private calendarMeetingSessions: CalendarMeetingSessionRecord[] = [];
  private calendarGuestLinks: CalendarGuestLinkRecord[] = [];
  private taskDeadlines: TaskDeadlineRecord[];
  private portalGrants: PortalGrant[];
  private externalUploadLinks: ExternalUploadLinkRecord[] = [];
  private savedOperationalViewDefinitions: SavedOperationalViewDefinition[] = [];
  private timeEntries: TimeEntry[];
  private expenseEntries: ExpenseEntry[];
  private billingPeriodLocks: BillingPeriodLockRecord[] = [];
  private billingRateRules: BillingRateRuleRecord[] = [];
  private invoices: InvoiceRecord[];
  private invoiceLines: InvoiceLineRecord[];
  private manualPayments: ManualPaymentRecord[];
  private paymentAllocations: PaymentAllocationRecord[];
  private hostedPaymentRequests: HostedPaymentRequestRecord[];
  private trustTransferRequests: TrustTransferRequestRecord[];
  private ledgerAccounts: LedgerAccount[];
  private ledgerApprovals: LedgerTransactionApprovalRecord[] = [];
  private ledgerReconciliations: LedgerReconciliationRecord[] = [];
  private ledgerStatementImportBatches: LedgerStatementImportBatchRecord[] = [];
  private ledgerReconciliationExceptionResolutions: LedgerReconciliationExceptionResolutionRecord[] =
    [];
  private intakeTemplates: IntakeTemplateRecord[];
  private signatureRequestSigners: SignatureRequestSignerRecord[];
  private signatureProviderEvents: SignatureProviderEventRecord[];
  private signatureWebhookAttempts: SignatureWebhookAttemptRecord[];
  private signatureRequests: SignatureRequestRecord[];
  private intakeSessions: IntakeSessionRecord[];
  private answerSnapshots: AnswerSnapshotRecord[] = [];
  private intakeFormLinks: IntakeFormLinkRecord[] = [];
  private intakeFormReviews: IntakeFormReviewRecord[] = [];
  private intakeFormItemActions: IntakeFormItemActionRecord[] = [];
  private intakeVariableProposals: IntakeVariableProposal[] = [];
  private conflictChecks: ConflictCheckRecord[] = [];
  private generatedDocuments: GeneratedDocumentRecord[];
  private documentAssemblySetDefinitions: DocumentAssemblySetDefinitionRecord[];
  private documentAssemblyPackages: DocumentAssemblyPackageRecord[];
  private signatureEnvelopes: SignatureEnvelopeRecord[];
  private firmSettings: FirmSettings[] = [];
  private providerSettings: ProviderSettingRecord[] = [];
  private publicConsultationIntakes: PublicConsultationIntakeRecord[] = [];
  private connectors: ConnectorRecord[] = [];
  private connectorOutbox: ConnectorOutboxRecord[] = [];
  private connectorDeliveryAttempts: ConnectorDeliveryAttemptRecord[] = [];
  private integrationDeveloperApps: IntegrationDeveloperAppRecord[] = [];
  private integrationApiCredentials: IntegrationApiCredentialRecord[] = [];
  private integrationWebhookSubscriptions: IntegrationWebhookSubscriptionRecord[] = [];
  private jobLifecycleRecords: JobLifecycleRecord[] = [];
  private emailOutbox: EmailOutboxRecord[] = [];
  private emailEvents: EmailEventRecord[] = [];
  private emailReceiptTokens: EmailReceiptTokenRecord[] = [];
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
  private draftAssistRecords: DraftAssistRecord[] = [];
  private aiOperationalProposals: AiOperationalProposalRecord[] = [];
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
    this.contactRelationships = seeded ? clone(sampleContactRelationships) : [];
    this.matters = seeded ? clone(sampleMatters) : [];
    this.matterParties = seeded ? clone(sampleMatterParties) : [];
    this.documents = seeded ? clone(sampleDocuments) : [];
    this.legalClinicPrograms = seeded ? clone(sampleLegalClinicPrograms) : [];
    this.legalClinicMatterProfiles = seeded ? clone(sampleLegalClinicMatterProfiles) : [];
    this.calendarEvents = seeded ? clone(sampleCalendarEvents) : [];
    this.calendarSchedulingRequests = seeded ? clone(sampleCalendarSchedulingRequests) : [];
    this.taskDeadlines = seeded ? clone(sampleTaskDeadlines) : [];
    this.portalGrants = seeded ? clone(samplePortalGrants) : [];
    this.timeEntries = seeded ? clone(sampleTimeEntries) : [];
    this.expenseEntries = seeded ? clone(sampleExpenseEntries) : [];
    this.invoices = seeded ? clone(sampleInvoices) : [];
    this.invoiceLines = seeded ? clone(sampleInvoiceLines) : [];
    this.manualPayments = seeded ? clone(sampleManualPayments) : [];
    this.paymentAllocations = seeded ? clone(samplePaymentAllocations) : [];
    this.hostedPaymentRequests = seeded ? clone(sampleHostedPaymentRequests) : [];
    this.trustTransferRequests = seeded ? clone(sampleTrustTransferRequests) : [];
    this.ledgerAccounts = seeded ? clone(sampleLedgerAccounts) : [];
    this.intakeTemplates = seeded ? clone(sampleIntakeTemplates) : [];
    this.draftTemplates = seeded ? clone(sampleDraftTemplates) : [];
    this.aiOperationalProposals = seeded ? clone(sampleAiOperationalProposals) : [];
    this.signatureRequestSigners = seeded ? clone(sampleSignatureRequestSigners) : [];
    this.signatureProviderEvents = seeded ? clone(sampleSignatureProviderEvents) : [];
    this.signatureWebhookAttempts = seeded ? clone(sampleSignatureWebhookAttempts) : [];
    this.signatureRequests = seeded ? clone(sampleSignatureRequests) : [];
    this.intakeSessions = seeded ? clone(sampleIntakeSessions) : [];
    this.generatedDocuments = seeded ? clone(sampleGeneratedDocuments) : [];
    this.documentAssemblySetDefinitions = seeded ? clone(sampleDocumentAssemblySetDefinitions) : [];
    this.documentAssemblyPackages = seeded ? clone(sampleDocumentAssemblyPackages) : [];
    this.signatureEnvelopes = seeded ? clone(sampleSignatureEnvelopes) : [];
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

  async resolveConfiguredFirm(): Promise<ConfiguredFirmResolution> {
    const status = setupStatusFromCounts(this.firms.length, this.users.length);
    if (status.blocked) {
      return {
        status: "blocked",
        reason: status.reason ?? "Practice setup state requires operator review.",
      };
    }
    if (status.required) {
      return { status: "setup_required" };
    }
    if (this.firms.length > 1) {
      return {
        status: "blocked",
        reason:
          "Multiple firm records found. Resolve practice records before using single-tenant authentication.",
      };
    }
    return { status: "ready", firm: clone(this.firms[0]) };
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
    const presetTemplates = buildPracticePresetTemplates({
      firmId: input.firm.id,
      timestamp: input.settings.createdAt,
      selectedPresetIds: input.selectedPresetIds ?? [],
    });
    this.draftTemplates = [
      ...buildBasicDraftTemplates(input.firm.id, input.settings.createdAt),
      ...presetTemplates.draftTemplates,
    ];
    this.intakeTemplates = presetTemplates.intakeTemplates;
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

  async createConnector(connector: ConnectorRecord): Promise<ConnectorRecord> {
    const duplicate = this.connectors.find(
      (candidate) => candidate.firmId === connector.firmId && candidate.key === connector.key,
    );
    if (duplicate) throw new Error(`Connector key ${connector.key} already exists`);
    this.connectors.push(clone(connector));
    return clone(connector);
  }

  async updateConnector(
    firmId: string,
    connectorId: string,
    updates: Partial<
      Pick<ConnectorRecord, "displayName" | "status" | "secretReference" | "configSummary">
    > & { updatedAt: string },
  ): Promise<ConnectorRecord | undefined> {
    const index = this.connectors.findIndex(
      (connector) => connector.firmId === firmId && connector.id === connectorId,
    );
    if (index < 0) return undefined;
    const current = this.connectors[index];
    const next: ConnectorRecord = {
      ...current,
      ...updates,
      secretReference:
        "secretReference" in updates ? updates.secretReference : current.secretReference,
      configSummary: updates.configSummary ?? current.configSummary,
      updatedAt: updates.updatedAt,
    };
    this.connectors[index] = clone(next);
    return clone(next);
  }

  async listConnectors(
    firmId: string,
    options: { type?: ConnectorRecord["type"]; status?: ConnectorRecord["status"] } = {},
  ): Promise<ConnectorRecord[]> {
    return clone(
      this.connectors
        .filter((connector) => {
          if (connector.firmId !== firmId) return false;
          if (options.type && connector.type !== options.type) return false;
          if (options.status && connector.status !== options.status) return false;
          return true;
        })
        .sort((left, right) => left.key.localeCompare(right.key)),
    );
  }

  async getConnector(firmId: string, connectorId: string): Promise<ConnectorRecord | undefined> {
    return clone(
      this.connectors.find(
        (connector) => connector.firmId === firmId && connector.id === connectorId,
      ),
    );
  }

  async createConnectorOutbox(
    input: ConnectorOutboxRecord,
  ): Promise<{ outbox: ConnectorOutboxRecord; created: boolean }> {
    const existing = this.connectorOutbox.find(
      (outbox) => outbox.firmId === input.firmId && outbox.idempotencyKey === input.idempotencyKey,
    );
    if (existing) {
      const existingFingerprint = canonicalizeForIdempotency({
        connectorId: existing.connectorId,
        eventType: existing.eventType,
        resourceType: existing.resourceType,
        resourceId: existing.resourceId,
        payloadSummary: existing.payloadSummary,
        maxAttempts: existing.maxAttempts,
      });
      const inputFingerprint = canonicalizeForIdempotency({
        connectorId: input.connectorId,
        eventType: input.eventType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        payloadSummary: input.payloadSummary,
        maxAttempts: input.maxAttempts,
      });
      if (existingFingerprint !== inputFingerprint) throw new IdempotencyKeyConflictError();
      return { outbox: clone(existing), created: false };
    }
    const connector = this.connectors.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.connectorId,
    );
    if (!connector) throw new Error(`Connector ${input.connectorId} was not found`);
    this.connectorOutbox.push(clone(input));
    return { outbox: clone(input), created: true };
  }

  async listConnectorOutbox(
    firmId: string,
    options: {
      connectorId?: string;
      status?: ConnectorOutboxRecord["status"];
      limit?: number;
    } = {},
  ): Promise<ConnectorOutboxRecord[]> {
    const limit = options.limit ?? 50;
    return clone(
      this.connectorOutbox
        .filter((outbox) => {
          if (outbox.firmId !== firmId) return false;
          if (options.connectorId && outbox.connectorId !== options.connectorId) return false;
          if (options.status && outbox.status !== options.status) return false;
          return true;
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit),
    );
  }

  async getConnectorOutbox(
    firmId: string,
    outboxId: string,
  ): Promise<ConnectorOutboxRecord | undefined> {
    return clone(
      this.connectorOutbox.find((outbox) => outbox.firmId === firmId && outbox.id === outboxId),
    );
  }

  async retryConnectorOutbox(input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "failed" | "dead_letter">;
    occurredAt: string;
  }): Promise<ConnectorOutboxRecord | undefined> {
    const index = this.connectorOutbox.findIndex(
      (outbox) =>
        outbox.firmId === input.firmId &&
        outbox.id === input.outboxId &&
        outbox.status === input.expectedStatus,
    );
    if (index < 0) return undefined;
    const current = this.connectorOutbox[index];
    const next: ConnectorOutboxRecord = {
      ...current,
      status: "pending",
      maxAttempts:
        current.attemptCount >= current.maxAttempts
          ? current.attemptCount + 1
          : current.maxAttempts,
      nextAttemptAt: input.occurredAt,
      leaseId: undefined,
      leasedUntil: undefined,
      deadLetteredAt: undefined,
      lastErrorSummary: undefined,
      updatedAt: input.occurredAt,
    };
    this.connectorOutbox[index] = clone(next);
    return clone(next);
  }

  async deadLetterConnectorOutbox(input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "pending" | "failed" | "leased">;
    occurredAt: string;
    errorSummary: string;
  }): Promise<ConnectorOutboxRecord | undefined> {
    const index = this.connectorOutbox.findIndex(
      (outbox) =>
        outbox.firmId === input.firmId &&
        outbox.id === input.outboxId &&
        outbox.status === input.expectedStatus,
    );
    if (index < 0) return undefined;
    const current = this.connectorOutbox[index];
    const next: ConnectorOutboxRecord = {
      ...current,
      status: "dead_letter",
      nextAttemptAt: undefined,
      leaseId: undefined,
      leasedUntil: undefined,
      deadLetteredAt: input.occurredAt,
      lastErrorSummary: sanitizeConnectorDeliverySummary(input.errorSummary),
      updatedAt: input.occurredAt,
    };
    this.connectorOutbox[index] = clone(next);
    return clone(next);
  }

  async createConnectorDeliveryAttempt(
    attempt: ConnectorDeliveryAttemptRecord,
  ): Promise<ConnectorDeliveryAttemptRecord> {
    const outbox = this.connectorOutbox.find(
      (candidate) =>
        candidate.firmId === attempt.firmId &&
        candidate.id === attempt.outboxId &&
        candidate.connectorId === attempt.connectorId,
    );
    if (!outbox) throw new Error(`Connector outbox ${attempt.outboxId} was not found`);
    this.connectorDeliveryAttempts.push(clone(attempt));
    return clone(attempt);
  }

  async leaseConnectorOutbox(input: {
    firmId: string;
    leaseId: string;
    leasedUntil: string;
    now: string;
    limit?: number;
  }): Promise<
    Array<{
      connector: ConnectorRecord;
      outbox: ConnectorOutboxRecord;
      attempt: ConnectorDeliveryAttemptRecord;
    }>
  > {
    const limit = input.limit ?? 10;
    const nowMs = Date.parse(input.now);
    const candidates = this.connectorOutbox
      .filter((outbox) => {
        if (outbox.firmId !== input.firmId) return false;
        if (outbox.status === "cancelled" || outbox.status === "delivered") return false;
        const connector = this.connectors.find(
          (candidate) =>
            candidate.firmId === outbox.firmId &&
            candidate.id === outbox.connectorId &&
            candidate.status === "enabled",
        );
        if (!connector) return false;
        if (outbox.status === "leased") {
          return outbox.leasedUntil ? Date.parse(outbox.leasedUntil) <= nowMs : true;
        }
        if (outbox.status !== "pending" && outbox.status !== "failed") return false;
        return !outbox.nextAttemptAt || Date.parse(outbox.nextAttemptAt) <= nowMs;
      })
      .sort((left, right) => {
        const leftNext = left.nextAttemptAt ?? left.createdAt;
        const rightNext = right.nextAttemptAt ?? right.createdAt;
        return leftNext.localeCompare(rightNext);
      })
      .slice(0, limit);

    return candidates.map((candidate) => {
      const index = this.connectorOutbox.findIndex(
        (outbox) => outbox.firmId === candidate.firmId && outbox.id === candidate.id,
      );
      const current = this.connectorOutbox[index];
      const attemptNumber = current.attemptCount + 1;
      const outbox: ConnectorOutboxRecord = {
        ...current,
        status: "leased",
        attemptCount: attemptNumber,
        leaseId: input.leaseId,
        leasedUntil: input.leasedUntil,
        lastErrorSummary: undefined,
        updatedAt: input.now,
      };
      this.connectorOutbox[index] = outbox;
      const connector = this.connectors.find(
        (item) => item.firmId === outbox.firmId && item.id === outbox.connectorId,
      );
      if (!connector) throw new Error(`Connector ${outbox.connectorId} was not found`);
      const attempt: ConnectorDeliveryAttemptRecord = {
        id: crypto.randomUUID(),
        firmId: outbox.firmId,
        connectorId: outbox.connectorId,
        outboxId: outbox.id,
        attemptNumber,
        status: "leased",
        idempotencyKey: outbox.idempotencyKey,
        leaseId: input.leaseId,
        startedAt: input.now,
        metadata: {
          eventType: outbox.eventType,
          resourceType: outbox.resourceType,
          resourceId: outbox.resourceId,
        },
      };
      this.connectorDeliveryAttempts.push(clone(attempt));
      return { connector: clone(connector), outbox: clone(outbox), attempt: clone(attempt) };
    });
  }

  async recordConnectorDeliveryResult(input: {
    firmId: string;
    connectorId: string;
    outboxId: string;
    attemptId: string;
    leaseId: string;
    status: "delivered" | "failed";
    occurredAt: string;
    terminal?: boolean;
    nextAttemptAt?: string;
    errorSummary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    outbox: ConnectorOutboxRecord;
    attempt: ConnectorDeliveryAttemptRecord;
  }> {
    const outboxIndex = this.connectorOutbox.findIndex(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.id === input.outboxId &&
        candidate.connectorId === input.connectorId &&
        candidate.leaseId === input.leaseId,
    );
    if (outboxIndex < 0) throw new Error(`Connector outbox ${input.outboxId} lease was not found`);
    const outbox = this.connectorOutbox[outboxIndex];
    const attemptIndex = this.connectorDeliveryAttempts.findIndex(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.id === input.attemptId &&
        candidate.outboxId === input.outboxId &&
        candidate.leaseId === input.leaseId,
    );
    if (attemptIndex < 0) throw new Error(`Connector attempt ${input.attemptId} was not found`);
    const failureSummary = sanitizeConnectorDeliverySummary(input.errorSummary);
    const updatedOutbox: ConnectorOutboxRecord =
      input.status === "delivered"
        ? {
            ...outbox,
            status: "delivered",
            leaseId: undefined,
            leasedUntil: undefined,
            deliveredAt: input.occurredAt,
            nextAttemptAt: undefined,
            lastErrorSummary: undefined,
            updatedAt: input.occurredAt,
          }
        : {
            ...outbox,
            status: input.terminal ? "dead_letter" : "failed",
            leaseId: undefined,
            leasedUntil: undefined,
            nextAttemptAt: input.terminal ? undefined : input.nextAttemptAt,
            deadLetteredAt: input.terminal ? input.occurredAt : outbox.deadLetteredAt,
            lastErrorSummary: failureSummary,
            updatedAt: input.occurredAt,
          };
    const attempt: ConnectorDeliveryAttemptRecord = {
      ...this.connectorDeliveryAttempts[attemptIndex],
      status: input.status,
      finishedAt: input.occurredAt,
      errorSummary: failureSummary,
      metadata: {
        ...this.connectorDeliveryAttempts[attemptIndex].metadata,
        ...sanitizeConnectorDeliveryMetadata(input.metadata),
        terminal: input.status === "failed" ? Boolean(input.terminal) : true,
      },
    };
    this.connectorOutbox[outboxIndex] = updatedOutbox;
    this.connectorDeliveryAttempts[attemptIndex] = attempt;
    return { outbox: clone(updatedOutbox), attempt: clone(attempt) };
  }

  async listConnectorDeliveryAttempts(
    firmId: string,
    options: { outboxId?: string; connectorId?: string } = {},
  ): Promise<ConnectorDeliveryAttemptRecord[]> {
    return clone(
      this.connectorDeliveryAttempts
        .filter((attempt) => {
          if (attempt.firmId !== firmId) return false;
          if (options.outboxId && attempt.outboxId !== options.outboxId) return false;
          if (options.connectorId && attempt.connectorId !== options.connectorId) return false;
          return true;
        })
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    );
  }

  async createIntegrationDeveloperApp(
    app: IntegrationDeveloperAppRecord,
  ): Promise<IntegrationDeveloperAppRecord> {
    const connector = this.connectors.find(
      (candidate) => candidate.firmId === app.firmId && candidate.id === app.connectorId,
    );
    if (!connector) throw new Error(`Connector ${app.connectorId} was not found`);
    const duplicate = this.integrationDeveloperApps.find(
      (candidate) => candidate.firmId === app.firmId && candidate.clientId === app.clientId,
    );
    if (duplicate) throw new Error(`Integration client ${app.clientId} already exists`);
    this.integrationDeveloperApps.push(clone(app));
    return clone(app);
  }

  async updateIntegrationDeveloperApp(
    firmId: string,
    appId: string,
    updates: Partial<
      Pick<
        IntegrationDeveloperAppRecord,
        | "displayName"
        | "status"
        | "redirectUris"
        | "allowedOrigins"
        | "allowedScopes"
        | "regionalEndpoint"
        | "rateLimit"
        | "customActionPlaceholders"
      >
    > & { updatedAt: string },
  ): Promise<IntegrationDeveloperAppRecord | undefined> {
    const index = this.integrationDeveloperApps.findIndex(
      (app) => app.firmId === firmId && app.id === appId,
    );
    if (index < 0) return undefined;
    const current = this.integrationDeveloperApps[index];
    const next: IntegrationDeveloperAppRecord = {
      ...current,
      ...updates,
      updatedAt: updates.updatedAt,
    };
    this.integrationDeveloperApps[index] = clone(next);
    return clone(next);
  }

  async listIntegrationDeveloperApps(
    firmId: string,
    options: { connectorId?: string; status?: IntegrationDeveloperAppRecord["status"] } = {},
  ): Promise<IntegrationDeveloperAppRecord[]> {
    return clone(
      this.integrationDeveloperApps
        .filter((app) => {
          if (app.firmId !== firmId) return false;
          if (options.connectorId && app.connectorId !== options.connectorId) return false;
          if (options.status && app.status !== options.status) return false;
          return true;
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getIntegrationDeveloperApp(
    firmId: string,
    appId: string,
  ): Promise<IntegrationDeveloperAppRecord | undefined> {
    return clone(
      this.integrationDeveloperApps.find((app) => app.firmId === firmId && app.id === appId),
    );
  }

  async createIntegrationApiCredential(
    credential: IntegrationApiCredentialRecord,
  ): Promise<IntegrationApiCredentialRecord> {
    const app = this.integrationDeveloperApps.find(
      (candidate) => candidate.firmId === credential.firmId && candidate.id === credential.appId,
    );
    if (!app) throw new Error(`Integration app ${credential.appId} was not found`);
    this.integrationApiCredentials.push(clone(credential));
    return clone(credential);
  }

  async listIntegrationApiCredentials(
    firmId: string,
    options: { appId?: string; status?: IntegrationApiCredentialRecord["status"] } = {},
  ): Promise<IntegrationApiCredentialRecord[]> {
    return clone(
      this.integrationApiCredentials
        .filter((credential) => {
          if (credential.firmId !== firmId) return false;
          if (options.appId && credential.appId !== options.appId) return false;
          if (options.status && credential.status !== options.status) return false;
          return true;
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getIntegrationApiCredential(
    firmId: string,
    credentialId: string,
  ): Promise<IntegrationApiCredentialRecord | undefined> {
    return clone(
      this.integrationApiCredentials.find(
        (credential) => credential.firmId === firmId && credential.id === credentialId,
      ),
    );
  }

  async revokeIntegrationApiCredential(input: {
    firmId: string;
    credentialId: string;
    revokedAt: string;
  }): Promise<IntegrationApiCredentialRecord | undefined> {
    const index = this.integrationApiCredentials.findIndex(
      (credential) => credential.firmId === input.firmId && credential.id === input.credentialId,
    );
    if (index < 0) return undefined;
    const current = this.integrationApiCredentials[index];
    const next: IntegrationApiCredentialRecord = {
      ...current,
      status: "revoked",
      revokedAt: input.revokedAt,
    };
    this.integrationApiCredentials[index] = clone(next);
    return clone(next);
  }

  async createIntegrationWebhookSubscription(
    subscription: IntegrationWebhookSubscriptionRecord,
  ): Promise<IntegrationWebhookSubscriptionRecord> {
    const app = this.integrationDeveloperApps.find(
      (candidate) =>
        candidate.firmId === subscription.firmId && candidate.id === subscription.appId,
    );
    if (!app) throw new Error(`Integration app ${subscription.appId} was not found`);
    if (app.connectorId !== subscription.connectorId) {
      throw new Error(`Connector ${subscription.connectorId} is not linked to integration app`);
    }
    this.integrationWebhookSubscriptions.push(clone(subscription));
    return clone(subscription);
  }

  async listIntegrationWebhookSubscriptions(
    firmId: string,
    options: {
      appId?: string;
      connectorId?: string;
      status?: IntegrationWebhookSubscriptionRecord["status"];
    } = {},
  ): Promise<IntegrationWebhookSubscriptionRecord[]> {
    return clone(
      this.integrationWebhookSubscriptions
        .filter((subscription) => {
          if (subscription.firmId !== firmId) return false;
          if (options.appId && subscription.appId !== options.appId) return false;
          if (options.connectorId && subscription.connectorId !== options.connectorId) return false;
          if (options.status && subscription.status !== options.status) return false;
          return true;
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async createJobLifecycleRecord(record: JobLifecycleRecord): Promise<JobLifecycleRecord> {
    const existing = record.idempotencyKey
      ? this.jobLifecycleRecords.find(
          (job) => job.firmId === record.firmId && job.idempotencyKey === record.idempotencyKey,
        )
      : undefined;
    if (existing) {
      assertSameIdempotencyFingerprint(existing.metadata, record.metadata);
      return clone(existing);
    }
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
    const existingEmail = input.email.idempotencyKey
      ? this.emailOutbox.find(
          (email) =>
            email.firmId === input.email.firmId &&
            email.idempotencyKey === input.email.idempotencyKey,
        )
      : undefined;
    if (existingEmail) {
      assertSameIdempotencyFingerprint(existingEmail.metadata, input.email.metadata);
      const existingEvent =
        this.emailEvents.find(
          (event) => event.firmId === existingEmail.firmId && event.emailId === existingEmail.id,
        ) ?? input.event;
      const existingJob =
        this.jobLifecycleRecords.find(
          (job) =>
            job.firmId === existingEmail.firmId &&
            job.targetResourceType === "email_outbox" &&
            job.targetResourceId === existingEmail.id,
        ) ?? input.job;
      return {
        email: clone(existingEmail),
        event: clone(existingEvent),
        job: clone(existingJob),
      };
    }
    this.emailOutbox.push(clone(input.email));
    this.emailEvents.push(clone(input.event));
    this.jobLifecycleRecords.push(clone(input.job));
    return clone(input);
  }

  async getEmailOutbox(firmId: string, emailId: string): Promise<EmailOutboxRecord | undefined> {
    return clone(this.emailOutbox.find((email) => email.firmId === firmId && email.id === emailId));
  }

  async listEmailOutbox(
    firmId: string,
    options: { matterId?: string; limit?: number } = {},
  ): Promise<EmailOutboxRecord[]> {
    const limit = options.limit ?? 50;
    return clone(
      this.emailOutbox
        .filter((email) => {
          if (email.firmId !== firmId) return false;
          if (options.matterId && email.matterId !== options.matterId) return false;
          return true;
        })
        .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))
        .slice(0, limit),
    );
  }

  async getEmailOutboxByReceiptTokenHash(
    receiptTokenHash: string,
  ): Promise<EmailOutboxRecord | undefined> {
    const token = this.emailReceiptTokens.find(
      (candidate) => candidate.tokenHash === receiptTokenHash,
    );
    if (!token) return undefined;
    return clone(
      this.emailOutbox.find((email) => email.firmId === token.firmId && email.id === token.emailId),
    );
  }

  async recordEmailDeliveryReceipt(input: {
    firmId: string;
    emailId: string;
    receiptTokenHash: string;
    recordedAt: string;
  }): Promise<{ email: EmailOutboxRecord; recorded: boolean }> {
    const token = await this.recordEmailReceiptToken({
      tokenHash: input.receiptTokenHash,
      recordedAt: input.recordedAt,
    });
    if (token) {
      if (token.firmId !== input.firmId || token.emailId !== input.emailId) {
        throw new Error(`Email outbox receipt ${input.emailId} was not found`);
      }
      const email = await this.getEmailOutbox(token.firmId, token.emailId);
      if (!email) throw new Error(`Email outbox record ${token.emailId} was not found`);
      return { email, recorded: token.recordedAt === input.recordedAt };
    }
    throw new Error(`Email outbox receipt ${input.emailId} was not found`);
  }

  async recordEmailDeliveryResult(input: {
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
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord }> {
    const index = this.emailOutbox.findIndex(
      (email) => email.firmId === input.firmId && email.id === input.emailId,
    );
    if (index === -1) throw new Error(`Email outbox record ${input.emailId} was not found`);

    const existing = this.emailOutbox[index]!;
    const terminal = input.terminal ?? input.status === "failed";
    const failureSummary = sanitizeEmailFailureSummary(input.errorMessage);
    const attemptCount = nextEmailAttemptCount(existing, input.attemptNumber);
    const email: EmailOutboxRecord = {
      ...existing,
      status:
        input.status === "failed" && !terminal
          ? "queued"
          : (input.status as EmailOutboxRecord["status"]),
      sentAt: input.status === "sent" ? input.occurredAt : existing.sentAt,
      failedAt: input.status === "failed" && terminal ? input.occurredAt : undefined,
      attemptCount,
      lastAttemptAt: input.attemptNumber ? input.occurredAt : existing.lastAttemptAt,
      terminalFailureAt: input.status === "failed" && terminal ? input.occurredAt : undefined,
      terminalFailureReason: input.status === "failed" && terminal ? failureSummary : undefined,
      errorMessage: input.status === "failed" && terminal ? failureSummary : undefined,
      metadata: {
        ...existing.metadata,
        deliveryState: input.metadata ?? {},
      },
    };
    const event: EmailEventRecord = {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      emailId: input.emailId,
      eventType: input.status,
      occurredAt: input.occurredAt,
      providerMessageId: input.providerMessageId,
      attemptNumber: input.attemptNumber,
      jobId: input.jobId,
      source: input.source ?? "worker",
      errorMessage: input.status === "failed" ? failureSummary : undefined,
      metadata: input.metadata ?? {},
    };
    this.emailOutbox[index] = clone(email);
    this.emailEvents.push(clone(event));
    return { email: clone(email), event: clone(event) };
  }

  async retryEmailOutbox(input: {
    firmId: string;
    emailId: string;
    occurredAt: string;
    requestedByUserId: string;
    job: JobLifecycleRecord;
    metadata?: Record<string, unknown>;
  }): Promise<{ email: EmailOutboxRecord; event: EmailEventRecord; job: JobLifecycleRecord }> {
    const existingJob = input.job.idempotencyKey
      ? this.jobLifecycleRecords.find(
          (job) =>
            job.firmId === input.firmId &&
            job.idempotencyKey === input.job.idempotencyKey &&
            job.targetResourceType === "email_outbox" &&
            job.targetResourceId === input.emailId,
        )
      : undefined;
    if (existingJob) {
      assertSameIdempotencyFingerprint(existingJob.metadata, input.job.metadata);
      const email = this.emailOutbox.find(
        (candidate) => candidate.firmId === input.firmId && candidate.id === input.emailId,
      );
      if (!email) throw new Error(`Email outbox record ${input.emailId} was not found`);
      const event = this.emailEvents.find(
        (candidate) =>
          candidate.firmId === input.firmId &&
          candidate.emailId === input.emailId &&
          candidate.jobId === existingJob.id,
      ) ?? {
        id: crypto.randomUUID(),
        firmId: input.firmId,
        emailId: input.emailId,
        eventType: "queued" as const,
        occurredAt: existingJob.queuedAt,
        jobId: existingJob.id,
        source: "api" as const,
        metadata: input.metadata ?? {},
      };
      return { email: clone(email), event: clone(event), job: clone(existingJob) };
    }
    const index = this.emailOutbox.findIndex(
      (email) => email.firmId === input.firmId && email.id === input.emailId,
    );
    if (index === -1) throw new Error(`Email outbox record ${input.emailId} was not found`);

    const existing = this.emailOutbox[index]!;
    const email: EmailOutboxRecord = {
      ...existing,
      status: "queued",
      failedAt: undefined,
      errorMessage: undefined,
      metadata: {
        ...existing.metadata,
        deliveryState: {
          ...(input.metadata ?? {}),
          manualRetryRequestedAt: input.occurredAt,
          manualRetryRequestedByUserId: input.requestedByUserId,
          nextRetryAt: input.occurredAt,
          terminal: false,
        },
      },
    };
    const event: EmailEventRecord = {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      emailId: input.emailId,
      eventType: "queued",
      occurredAt: input.occurredAt,
      jobId: input.job.id,
      source: "api",
      metadata: {
        ...(input.metadata ?? {}),
        manualRetry: true,
        requestedByUserId: input.requestedByUserId,
        jobId: input.job.id,
      },
    };
    this.emailOutbox[index] = clone(email);
    this.emailEvents.push(clone(event));
    this.jobLifecycleRecords.push(clone(input.job));
    return { email: clone(email), event: clone(event), job: clone(input.job) };
  }

  async listEmailEvents(
    firmId: string,
    options: { emailId?: string } = {},
  ): Promise<EmailEventRecord[]> {
    return clone(
      this.emailEvents
        .filter(
          (event) =>
            event.firmId === firmId && (!options.emailId || event.emailId === options.emailId),
        )
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)),
    );
  }

  async createEmailReceiptToken(token: EmailReceiptTokenRecord): Promise<EmailReceiptTokenRecord> {
    const email = this.emailOutbox.find(
      (candidate) => candidate.firmId === token.firmId && candidate.id === token.emailId,
    );
    if (!email) throw new Error("Email receipt token email was not found");
    if (email.matterId !== token.matterId) {
      throw new Error("Email receipt token matter must match the email outbox matter");
    }
    this.emailReceiptTokens = [...this.emailReceiptTokens, clone(token)];
    return clone(token);
  }

  async getEmailReceiptTokenByHash(
    tokenHash: string,
  ): Promise<EmailReceiptTokenRecord | undefined> {
    return clone(this.emailReceiptTokens.find((token) => token.tokenHash === tokenHash));
  }

  async recordEmailReceiptToken(input: {
    tokenHash: string;
    recordedAt: string;
  }): Promise<EmailReceiptTokenRecord | undefined> {
    const index = this.emailReceiptTokens.findIndex((token) => token.tokenHash === input.tokenHash);
    if (index === -1) return undefined;
    const existing = this.emailReceiptTokens[index]!;
    if (existing.recordedAt) return clone(existing);
    const updated: EmailReceiptTokenRecord = {
      ...existing,
      recordedAt: input.recordedAt,
    };
    this.emailReceiptTokens[index] = clone(updated);
    this.emailEvents.push({
      id: crypto.randomUUID(),
      firmId: updated.firmId,
      emailId: updated.emailId,
      eventType: "receipt_recorded",
      occurredAt: input.recordedAt,
      source: "api",
      metadata: {
        receiptTokenId: updated.id,
        matterId: updated.matterId,
        purpose: updated.purpose,
      },
    });
    return clone(updated);
  }

  async listEmailReceiptTokens(
    firmId: string,
    options: { emailId?: string; matterId?: string } = {},
  ): Promise<EmailReceiptTokenRecord[]> {
    return clone(
      this.emailReceiptTokens
        .filter(
          (token) =>
            token.firmId === firmId &&
            (!options.emailId || token.emailId === options.emailId) &&
            (!options.matterId || token.matterId === options.matterId),
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    );
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
      queuedBefore?: string;
      limit?: number;
    } = {},
  ): Promise<JobLifecycleRecord[]> {
    const limit = options.limit && options.limit > 0 ? options.limit : undefined;
    return clone(
      this.jobLifecycleRecords
        .filter(
          (record) =>
            record.firmId === firmId &&
            (!options.status || record.status === options.status) &&
            (!options.queueName || record.queueName === options.queueName) &&
            (!options.queuedBefore || record.queuedAt < options.queuedBefore),
        )
        .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))
        .slice(0, limit),
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

  async getWebAuthnCredentialForFirm(
    firmId: string,
    credentialId: string,
  ): Promise<WebAuthnCredentialRecord | undefined> {
    return clone(
      this.webAuthnCredentials.find(
        (credential) => credential.firmId === firmId && credential.credentialId === credentialId,
      ),
    );
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
    const visibleMatterIds = new Set(user.assignedMatterIds);
    return this.matters
      .filter(
        (matter) =>
          matter.firmId === user.firmId &&
          (isFirmWideMatterReader(user) || visibleMatterIds.has(matter.id)),
      )
      .map((matter) => {
        const parties = this.matterParties
          .filter((party) => party.matterId === matter.id)
          .map((party) => ({
            ...party,
            contact: this.contacts.find((contact) => contact.id === party.contactId)!,
          }));
        const documents = this.documents.filter((document) => document.matterId === matter.id);
        const timeEntries = this.timeEntries.filter((entry) => entry.matterId === matter.id);
        const expenses = this.expenseEntries.filter((entry) => entry.matterId === matter.id);
        const activity = buildActivityTimeline({
          firmId: user.firmId,
          matter,
          contacts: this.contacts,
          matterParties: this.matterParties,
          documents: this.documents,
          portalGrants: this.portalGrants,
          shareLinks: this.shareLinks,
          externalUploadLinks: this.externalUploadLinks,
          accessLogs: this.accessLogs,
          auditEvents: this.auditEvents,
          emailOutbox: this.emailOutbox,
          signatureRequests: this.signatureRequests,
          intakeSessions: this.intakeSessions,
          generatedDocuments: this.generatedDocuments,
          calendarEvents: this.calendarEvents,
          taskDeadlines: this.taskDeadlines,
          timeEntries: this.timeEntries,
          expenses: this.expenseEntries,
          invoices: this.invoices.map((invoice) => ({
            ...invoice,
            lines: this.invoiceLines.filter((line) => line.invoiceId === invoice.id),
          })),
          payments: this.manualPayments.map((payment) => ({
            ...payment,
            allocations: this.paymentAllocations.filter(
              (allocation) => allocation.paymentId === payment.id,
            ),
          })),
          trustTransferRequests: this.trustTransferRequests,
          ledgerAccounts: this.ledgerAccounts,
          ledgerEntries: entries,
        });
        const trustBalanceCents = matterTrustBalance(
          entries,
          this.ledgerAccounts,
          matter,
          this.matterParties,
        );
        return {
          ...matter,
          parties,
          documents,
          timeEntries,
          expenses,
          activity,
          trustBalanceCents,
          setupProfile: buildMatterSetupProfile({
            matter,
            parties,
            documents,
            timeEntries,
            expenses,
            activity,
            trustBalanceCents,
            users: this.users.filter((candidate) => candidate.firmId === user.firmId),
          }),
        };
      });
  }

  async createMatterWithClient(input: CreateMatterWithClientInput): Promise<MatterSummary> {
    const actor = this.users.find(
      (user) => user.firmId === input.firmId && user.id === input.actorUserId,
    );
    if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);

    const matter: Matter = {
      id: input.matterId,
      firmId: input.firmId,
      number: nextMatterNumber(this.matters, input.firmId, input.openedOn),
      title: input.title,
      practiceArea: input.practiceArea,
      status: "intake",
      jurisdiction: input.jurisdiction,
      responsibleUserId: input.actorUserId,
      openedOn: input.openedOn,
    };
    const contact: Contact = {
      id: input.contactId,
      firmId: input.firmId,
      kind: input.client.kind,
      displayName: input.client.displayName,
      aliases: [],
      identifiers: input.client.identifiers,
    };
    const party: MatterParty = {
      id: input.partyId,
      firmId: input.firmId,
      matterId: input.matterId,
      contactId: input.contactId,
      role: "prospective_client",
      adverse: false,
      confidential: true,
    };

    this.contacts = [clone(contact), ...this.contacts];
    this.matters = [clone(matter), ...this.matters];
    this.matterParties = [clone(party), ...this.matterParties];
    this.users = this.users.map((user) =>
      user.firmId === input.firmId && user.id === input.actorUserId
        ? {
            ...user,
            assignedMatterIds: Array.from(new Set([input.matterId, ...user.assignedMatterIds])),
          }
        : user,
    );
    await this.appendAuditEvent({
      id: input.auditEventId,
      firmId: input.firmId,
      actorId: input.actorUserId,
      action: "matter.opened",
      resourceType: "matter",
      resourceId: input.matterId,
      occurredAt: input.occurredAt,
      metadata: {
        matterId: input.matterId,
        source: "dashboard_zero_matter",
        clientContactCreated: true,
        partyRole: "prospective_client",
      },
    });

    const [created] = await this.listMattersForUser({
      ...actor,
      assignedMatterIds: Array.from(new Set([input.matterId, ...actor.assignedMatterIds])),
    });
    const summary = created?.id === input.matterId ? created : undefined;
    if (!summary) throw new Error(`Created matter ${input.matterId} was not visible`);
    return summary;
  }

  async listPublicConsultationIntakes(
    firmId: string,
    options: PublicConsultationIntakeListOptions = {},
  ): Promise<PublicConsultationIntakeRecord[]> {
    const limit = options.limit ?? 50;
    return clone(
      this.publicConsultationIntakes
        .filter((intake) => {
          if (intake.firmId !== firmId) return false;
          if (options.status && intake.status !== options.status) return false;
          return true;
        })
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
        .slice(0, limit),
    );
  }

  async getPublicConsultationIntake(
    firmId: string,
    intakeId: string,
  ): Promise<PublicConsultationIntakeRecord | undefined> {
    return clone(
      this.publicConsultationIntakes.find(
        (intake) => intake.firmId === firmId && intake.id === intakeId,
      ),
    );
  }

  async createPublicConsultationIntake(
    record: PublicConsultationIntakeRecord,
  ): Promise<PublicConsultationIntakeRecord> {
    const duplicate = this.publicConsultationIntakes.find(
      (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
    );
    if (duplicate) throw new Error(`Public consultation intake ${record.id} already exists`);
    this.publicConsultationIntakes = [clone(record), ...this.publicConsultationIntakes];
    return clone(record);
  }

  async updatePublicConsultationIntake(
    firmId: string,
    intakeId: string,
    updates: PublicConsultationIntakeUpdateInput,
  ): Promise<PublicConsultationIntakeRecord | undefined> {
    const index = this.publicConsultationIntakes.findIndex(
      (intake) => intake.firmId === firmId && intake.id === intakeId,
    );
    if (index < 0) return undefined;
    const current = this.publicConsultationIntakes[index];
    const next: PublicConsultationIntakeRecord = {
      ...current,
      ...updates,
      metadata: updates.metadata ?? current.metadata,
    };
    this.publicConsultationIntakes[index] = clone(next);
    return clone(next);
  }

  async convertPublicConsultationIntakeToMatter(
    input: ConvertPublicConsultationIntakeInput,
  ): Promise<{ intake: PublicConsultationIntakeRecord; matter: MatterSummary }> {
    const actor = this.users.find(
      (user) => user.firmId === input.firmId && user.id === input.actorUserId,
    );
    if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);
    const intakeIndex = this.publicConsultationIntakes.findIndex(
      (intake) => intake.firmId === input.firmId && intake.id === input.intakeId,
    );
    if (intakeIndex < 0) throw new Error(`Public consultation intake ${input.intakeId} not found`);
    const intake = this.publicConsultationIntakes[intakeIndex];
    if (intake.status !== "pending") throw new Error("PUBLIC_CONSULTATION_INTAKE_NOT_PENDING");

    const clientIdentifiers: ContactIdentifier[] = [];
    if (intake.email) clientIdentifiers.push({ type: "email", value: intake.email });
    if (intake.telephone) clientIdentifiers.push({ type: "phone", value: intake.telephone });

    const matter: Matter = {
      id: input.matterId,
      firmId: input.firmId,
      number: nextMatterNumber(this.matters, input.firmId, input.openedOn),
      title: input.title,
      practiceArea: input.practiceArea,
      status: "intake",
      jurisdiction: input.jurisdiction,
      responsibleUserId: input.actorUserId,
      openedOn: input.openedOn,
    };
    const clientContact: Contact = {
      id: input.clientContactId,
      firmId: input.firmId,
      kind: "person",
      displayName: intake.clientName,
      aliases: [],
      identifiers: clientIdentifiers,
    };
    const clientParty: MatterParty = {
      id: input.clientPartyId,
      firmId: input.firmId,
      matterId: input.matterId,
      contactId: input.clientContactId,
      role: "prospective_client",
      adverse: false,
      confidential: true,
    };
    const opposingContacts: Contact[] = input.opposingParties.map((party) => ({
      id: party.contactId,
      firmId: input.firmId,
      kind: "person",
      displayName: party.displayName,
      aliases: [],
      identifiers: [],
    }));
    const opposingMatterParties: MatterParty[] = input.opposingParties.map((party) => ({
      id: party.partyId,
      firmId: input.firmId,
      matterId: input.matterId,
      contactId: party.contactId,
      role: "opposing_party",
      adverse: true,
      confidential: false,
    }));

    this.contacts = [clone(clientContact), ...opposingContacts.map(clone), ...this.contacts];
    this.matters = [clone(matter), ...this.matters];
    this.matterParties = [
      clone(clientParty),
      ...opposingMatterParties.map(clone),
      ...this.matterParties,
    ];
    this.users = this.users.map((user) =>
      user.firmId === input.firmId && user.id === input.actorUserId
        ? {
            ...user,
            assignedMatterIds: Array.from(new Set([input.matterId, ...user.assignedMatterIds])),
          }
        : user,
    );
    const reviewedIntake: PublicConsultationIntakeRecord = {
      ...intake,
      status: "converted",
      reviewedByUserId: input.actorUserId,
      reviewedAt: input.occurredAt,
      convertedMatterId: input.matterId,
      metadata: {
        ...intake.metadata,
        convertedMatterId: input.matterId,
        opposingPartyCount: opposingMatterParties.length,
      },
    };
    this.publicConsultationIntakes[intakeIndex] = clone(reviewedIntake);

    await this.appendAuditEvent({
      id: input.auditEventId,
      firmId: input.firmId,
      actorId: input.actorUserId,
      action: "matter.opened",
      resourceType: "matter",
      resourceId: input.matterId,
      occurredAt: input.occurredAt,
      metadata: {
        matterId: input.matterId,
        source: "public_consultation_intake",
        publicConsultationIntakeId: input.intakeId,
        clientContactCreated: true,
        partyRole: "prospective_client",
        opposingPartyCount: opposingMatterParties.length,
      },
    });

    const [created] = await this.listMattersForUser({
      ...actor,
      assignedMatterIds: Array.from(new Set([input.matterId, ...actor.assignedMatterIds])),
    });
    const summary = created?.id === input.matterId ? created : undefined;
    if (!summary) throw new Error(`Created matter ${input.matterId} was not visible`);
    return { intake: clone(reviewedIntake), matter: summary };
  }

  async listContactDossiersForUser(user: User): Promise<ContactDossier[]> {
    const matters = await this.listMattersForUser(user);
    const matterParties = matters.flatMap((matter) =>
      matter.parties.map((party) => ({
        id: party.id,
        firmId: party.firmId,
        matterId: party.matterId,
        contactId: party.contactId,
        role: party.role,
        adverse: party.adverse,
        confidential: party.confidential,
      })),
    );
    const contacts = matters.flatMap((matter) => matter.parties.map((party) => party.contact));
    const intakeVariableProposals = this.intakeVariableProposals.filter(
      (proposal) =>
        proposal.firmId === user.firmId &&
        proposal.status === "approved" &&
        Boolean(proposal.appliedAt) &&
        matters.some((matter) => matter.id === proposal.matterId),
    );
    return buildContactDossiers({
      firmId: user.firmId,
      contacts,
      matters,
      matterParties,
      portalGrants: this.portalGrants,
      contactRelationships: this.contactRelationships,
      intakeVariableProposals,
      conflictChecks: this.conflictChecks,
    });
  }

  async createContactRelationship(
    relationship: ContactRelationshipRecord,
  ): Promise<ContactRelationshipRecord> {
    const contact = this.contacts.find(
      (candidate) =>
        candidate.firmId === relationship.firmId && candidate.id === relationship.contactId,
    );
    if (!contact) throw new Error("Contact relationship contact was not found");
    const related = this.contacts.find(
      (candidate) =>
        candidate.firmId === relationship.firmId && candidate.id === relationship.relatedContactId,
    );
    if (!related) throw new Error("Contact relationship related contact was not found");
    if (relationship.matterId) {
      const matter = this.matters.find(
        (candidate) =>
          candidate.firmId === relationship.firmId && candidate.id === relationship.matterId,
      );
      if (!matter) throw new Error("Contact relationship matter was not found");
    }
    validateContactRelationshipRecord(relationship);
    this.contactRelationships = [...this.contactRelationships, clone(relationship)];
    return clone(relationship);
  }

  async getContact(firmId: string, contactId: string): Promise<Contact | undefined> {
    return clone(
      this.contacts.find((contact) => contact.firmId === firmId && contact.id === contactId),
    );
  }

  async createContactDataQualityResolution(
    resolution: ContactDataQualityResolutionRecord,
  ): Promise<ContactDataQualityResolutionRecord> {
    const contact = this.contacts.find(
      (candidate) =>
        candidate.firmId === resolution.firmId && candidate.id === resolution.contactId,
    );
    if (!contact) throw new Error("Contact quality resolution contact was not found");
    if (resolution.matterId) {
      const matter = this.matters.find(
        (candidate) =>
          candidate.firmId === resolution.firmId && candidate.id === resolution.matterId,
      );
      if (!matter) throw new Error("Contact quality resolution matter was not found");
    }
    if (resolution.relatedContactId) {
      const related = this.contacts.find(
        (candidate) =>
          candidate.firmId === resolution.firmId && candidate.id === resolution.relatedContactId,
      );
      if (!related) throw new Error("Related contact was not found");
    }
    validateContactDataQualityResolutionRecord(resolution);
    this.contactDataQualityResolutions = [...this.contactDataQualityResolutions, clone(resolution)];
    return clone(resolution);
  }

  async listContactDataQualityResolutions(
    firmId: string,
    options: { contactId?: string; matterId?: string } = {},
  ): Promise<ContactDataQualityResolutionRecord[]> {
    return clone(
      this.contactDataQualityResolutions
        .filter(
          (resolution) =>
            resolution.firmId === firmId &&
            (!options.contactId || resolution.contactId === options.contactId) &&
            (!options.matterId || resolution.matterId === options.matterId),
        )
        .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt)),
    );
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

  async listTaskDeadlines(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean } = {},
  ): Promise<TaskDeadlineRecord[]> {
    const matterIds = options.matterId ? [options.matterId] : options.matterIds;
    return clone(
      this.taskDeadlines
        .filter((task) => {
          if (task.firmId !== firmId) return false;
          if (matterIds && !matterIds.includes(task.matterId)) return false;
          if (!options.includeCompleted && task.completedAt) return false;
          return true;
        })
        .sort((left, right) => {
          const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
          const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
          if (leftDue !== rightDue) return leftDue - rightDue;
          return left.id.localeCompare(right.id);
        }),
    );
  }

  async getTaskDeadline(firmId: string, taskId: string): Promise<TaskDeadlineRecord | undefined> {
    return clone(this.taskDeadlines.find((task) => task.firmId === firmId && task.id === taskId));
  }

  async createTaskDeadline(task: TaskDeadlineRecord): Promise<TaskDeadlineRecord> {
    if (this.taskDeadlines.some((candidate) => candidate.id === task.id)) {
      throw new Error("Task deadline already exists");
    }
    this.taskDeadlines.push(clone(task));
    return clone(task);
  }

  async completeTaskDeadline(
    input: TaskDeadlineCompletionInput,
  ): Promise<TaskDeadlineRecord | undefined> {
    const index = this.taskDeadlines.findIndex(
      (task) => task.firmId === input.firmId && task.id === input.taskId,
    );
    if (index < 0) return undefined;
    const completed = {
      ...this.taskDeadlines[index]!,
      completedAt: this.taskDeadlines[index]!.completedAt ?? input.completedAt,
    };
    this.taskDeadlines[index] = clone(completed);
    return clone(completed);
  }

  async listConversationThreads(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string } = {},
  ): Promise<ConversationThreadRecord[]> {
    const matterIds = options.matterId ? [options.matterId] : options.matterIds;
    return clone(
      this.conversationThreads
        .filter((thread) => {
          if (thread.firmId !== firmId) return false;
          if (matterIds && !matterIds.includes(thread.matterId)) return false;
          return true;
        })
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) || left.topic.localeCompare(right.topic),
        ),
    );
  }

  async getConversationThread(
    firmId: string,
    threadId: string,
  ): Promise<ConversationThreadRecord | undefined> {
    return clone(
      this.conversationThreads.find((thread) => thread.firmId === firmId && thread.id === threadId),
    );
  }

  async createConversationThread(
    thread: ConversationThreadRecord,
  ): Promise<ConversationThreadRecord> {
    if (
      this.conversationThreads.some(
        (candidate) =>
          candidate.firmId === thread.firmId &&
          candidate.matterId === thread.matterId &&
          candidate.topic.trim().toLowerCase() === thread.topic.trim().toLowerCase(),
      )
    ) {
      throw new Error("Conversation thread already exists");
    }
    this.conversationThreads = [...this.conversationThreads, clone(thread)];
    return clone(thread);
  }

  async updateConversationThreadLifecycle(input: {
    firmId: string;
    threadId: string;
    action: ConversationThreadLifecycleAction;
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationThreadRecord | undefined> {
    const index = this.conversationThreads.findIndex(
      (thread) => thread.firmId === input.firmId && thread.id === input.threadId,
    );
    if (index < 0) return undefined;
    const updated = applyConversationThreadLifecycleAction(this.conversationThreads[index]!, input);
    this.conversationThreads[index] = clone(updated);
    return clone(updated);
  }

  async createConversationMessageNotifications(input: {
    firmId: string;
    threadId: string;
    messageId: string;
    matterId: string;
    notificationBoundary: ConversationThreadRecord["notificationBoundary"];
    createdAt: string;
    createdByUserId: string;
  }): Promise<ConversationMessageNotificationRecord[]> {
    if (input.notificationBoundary !== "internal_only") return [];

    const recipients = this.users.filter(
      (user) =>
        user.firmId === input.firmId &&
        user.id !== input.createdByUserId &&
        canAccess({
          user,
          firmId: input.firmId,
          resource: "conversation_thread",
          action: "read",
          matterId: input.matterId,
        }),
    );
    const notifications = recipients.map((recipient, index) => ({
      id: `conversation-message-notification-${input.messageId}-${String(index + 1).padStart(2, "0")}`,
      firmId: input.firmId,
      matterId: input.matterId,
      threadId: input.threadId,
      messageId: input.messageId,
      recipientUserId: recipient.id,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
      metadata: {},
    }));
    this.conversationMessageNotifications = [
      ...this.conversationMessageNotifications,
      ...notifications.map(clone),
    ];
    return notifications.map(clone);
  }

  async listConversationMessageNotifications(
    firmId: string,
    options: {
      threadId?: string;
      matterId?: string;
      recipientUserId?: string;
      messageId?: string;
    } = {},
  ): Promise<ConversationMessageNotificationRecord[]> {
    return clone(
      this.conversationMessageNotifications
        .filter((notification) => {
          if (notification.firmId !== firmId) return false;
          if (options.threadId && notification.threadId !== options.threadId) return false;
          if (options.matterId && notification.matterId !== options.matterId) return false;
          if (options.recipientUserId && notification.recipientUserId !== options.recipientUserId)
            return false;
          if (options.messageId && notification.messageId !== options.messageId) return false;
          return true;
        })
        .sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
        ),
    );
  }

  async updateConversationMessageNotificationPosture(input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationMessageNotificationRecord | undefined> {
    const index = this.conversationMessageNotifications.findIndex(
      (notification) =>
        notification.firmId === input.firmId && notification.id === input.notificationId,
    );
    if (index < 0) return undefined;
    const existing = this.conversationMessageNotifications[index]!;
    if (existing.recipientUserId !== input.actorUserId) return undefined;
    const updated = {
      ...existing,
      readAt:
        input.action === "mark_read" ? (existing.readAt ?? input.occurredAt) : existing.readAt,
      mutedAt:
        input.action === "mute"
          ? (existing.mutedAt ?? input.occurredAt)
          : input.action === "unmute"
            ? undefined
            : existing.mutedAt,
      updatedAt: input.occurredAt,
      updatedByUserId: input.actorUserId,
    };
    this.conversationMessageNotifications[index] = clone(updated);
    return clone(updated);
  }

  async listConversationMessages(
    firmId: string,
    options: { threadId?: string; matterId?: string } = {},
  ): Promise<ConversationMessageRecord[]> {
    return clone(
      this.conversationMessages
        .filter((message) => {
          if (message.firmId !== firmId) return false;
          if (options.threadId && message.threadId !== options.threadId) return false;
          if (options.matterId && message.matterId !== options.matterId) return false;
          return true;
        })
        .sort(
          (left, right) =>
            left.authoredAt.localeCompare(right.authoredAt) || left.id.localeCompare(right.id),
        ),
    );
  }

  async createConversationMessage(
    message: ConversationMessageRecord,
  ): Promise<ConversationMessageRecord> {
    this.conversationMessages = [...this.conversationMessages, clone(message)];
    const threadIndex = this.conversationThreads.findIndex(
      (thread) => thread.firmId === message.firmId && thread.id === message.threadId,
    );
    if (threadIndex >= 0) {
      this.conversationThreads[threadIndex] = {
        ...this.conversationThreads[threadIndex]!,
        updatedAt: message.authoredAt,
        updatedByUserId: message.createdByUserId,
      };
    }
    const thread = threadIndex >= 0 ? this.conversationThreads[threadIndex] : undefined;
    if (thread) {
      await this.createConversationMessageNotifications({
        firmId: message.firmId,
        threadId: message.threadId,
        messageId: message.id,
        matterId: message.matterId,
        notificationBoundary: thread.notificationBoundary,
        createdAt: message.createdAt,
        createdByUserId: message.createdByUserId,
      });
    }
    return clone(message);
  }

  async listLegalClinicPrograms(
    firmId: string,
    options: { status?: LegalClinicProgram["status"] } = {},
  ): Promise<LegalClinicProgram[]> {
    return clone(
      this.legalClinicPrograms
        .filter(
          (program) =>
            program.firmId === firmId && (!options.status || program.status === options.status),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  async createLegalClinicProgram(program: LegalClinicProgram): Promise<LegalClinicProgram> {
    if (
      this.legalClinicPrograms.some(
        (candidate) =>
          candidate.firmId === program.firmId &&
          candidate.name.trim().toLowerCase() === program.name.trim().toLowerCase(),
      )
    ) {
      throw new Error("Legal clinic program already exists");
    }
    this.legalClinicPrograms = [...this.legalClinicPrograms, clone(program)];
    return clone(program);
  }

  async getLegalClinicMatterProfile(
    firmId: string,
    matterId: string,
  ): Promise<LegalClinicMatterProfile | undefined> {
    return clone(
      this.legalClinicMatterProfiles.find(
        (profile) => profile.firmId === firmId && profile.matterId === matterId,
      ),
    );
  }

  async upsertLegalClinicMatterProfile(
    profile: LegalClinicMatterProfile,
  ): Promise<LegalClinicMatterProfile> {
    const existingIndex = this.legalClinicMatterProfiles.findIndex(
      (candidate) => candidate.firmId === profile.firmId && candidate.matterId === profile.matterId,
    );
    if (existingIndex >= 0) {
      this.legalClinicMatterProfiles[existingIndex] = clone(profile);
    } else {
      this.legalClinicMatterProfiles = [...this.legalClinicMatterProfiles, clone(profile)];
    }
    return clone(profile);
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
        })
        .map((event) => ({
          ...event,
          attendees: activeCalendarAttendees(event.attendees, event),
          reminders: activeCalendarReminders(event.reminders, event),
        })),
    );
  }

  async getCalendarEvent(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventRecord | undefined> {
    const event = this.calendarEvents.find(
      (event) =>
        event.firmId === firmId &&
        event.matterId === matterId &&
        event.id === eventId &&
        !event.deletedAt,
    );
    return event
      ? clone({
          ...event,
          attendees: activeCalendarAttendees(event.attendees, event),
          reminders: activeCalendarReminders(event.reminders, event),
        })
      : undefined;
  }

  async getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): Promise<CalendarEventRecord | undefined> {
    const event = this.calendarEvents.find(
      (event) =>
        event.firmId === firmId &&
        event.matterId === matterId &&
        event.uid === uid &&
        !event.deletedAt,
    );
    return event
      ? clone({
          ...event,
          attendees: activeCalendarAttendees(event.attendees, event),
          reminders: activeCalendarReminders(event.reminders, event),
        })
      : undefined;
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
      this.calendarEvents[existingIndex] = clone({
        ...event,
        attendees: event.attendees ?? this.calendarEvents[existingIndex]!.attendees,
        reminders: event.reminders ?? this.calendarEvents[existingIndex]!.reminders,
      });
    } else {
      this.calendarEvents.push(clone(event));
    }
    const stored = this.calendarEvents.find((candidate) => candidate.id === event.id)!;
    return clone({
      ...stored,
      attendees: activeCalendarAttendees(stored.attendees, stored),
      reminders: activeCalendarReminders(stored.reminders, stored),
    });
  }

  async listCalendarEventAttendees(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventAttendeeRecord[]> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === firmId &&
        candidate.matterId === matterId &&
        candidate.id === eventId &&
        !candidate.deletedAt,
    );
    return clone(activeCalendarAttendees(event?.attendees, { firmId, matterId, id: eventId }));
  }

  async upsertCalendarEventAttendee(
    attendee: CalendarEventAttendeeUpsertInput,
  ): Promise<CalendarEventAttendeeRecord> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === attendee.firmId &&
        candidate.matterId === attendee.matterId &&
        candidate.id === attendee.eventId &&
        !candidate.deletedAt,
    );
    if (!event) {
      throw new Error(`Calendar event ${attendee.eventId} was not found`);
    }
    const attendees = event.attendees ?? [];
    const existingIndex = attendees.findIndex((candidate) => candidate.id === attendee.id);
    if (existingIndex >= 0) {
      attendees[existingIndex] = clone(attendee);
    } else {
      const activeEmailCollision = attendees.find(
        (candidate) =>
          candidate.email.toLowerCase() === attendee.email.toLowerCase() &&
          candidate.id !== attendee.id &&
          !candidate.deletedAt,
      );
      if (activeEmailCollision) {
        throw new Error(`Calendar attendee ${attendee.email} already exists on this event`);
      }
      attendees.push(clone(attendee));
    }
    event.attendees = attendees;
    return clone(attendee);
  }

  async deleteCalendarEventAttendee(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    attendeeId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventAttendeeRecord | undefined> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.matterId === input.matterId &&
        candidate.id === input.eventId &&
        !candidate.deletedAt,
    );
    const attendee = event?.attendees?.find(
      (candidate) => candidate.id === input.attendeeId && !candidate.deletedAt,
    );
    if (!attendee) return undefined;
    attendee.deletedAt = input.deletedAt;
    attendee.updatedAt = input.deletedAt;
    attendee.updatedByUserId = input.updatedByUserId;
    return clone(attendee);
  }

  async replaceCalendarEventAttendees(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    attendees: CalendarEventAttendeeUpsertInput[];
    replacedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventAttendeeRecord[]> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.matterId === input.matterId &&
        candidate.id === input.eventId &&
        !candidate.deletedAt,
    );
    if (!event) return [];
    const retainedDeleted = (event.attendees ?? [])
      .filter((attendee) => attendee.deletedAt)
      .map(clone);
    const replaced = input.attendees.map(clone);
    event.attendees = [...retainedDeleted, ...replaced];
    return clone(activeCalendarAttendees(event.attendees, event));
  }

  async listCalendarEventReminders(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventReminderRecord[]> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === firmId &&
        candidate.matterId === matterId &&
        candidate.id === eventId &&
        !candidate.deletedAt,
    );
    return clone(activeCalendarReminders(event?.reminders, { firmId, matterId, id: eventId }));
  }

  async upsertCalendarEventReminder(
    reminder: CalendarEventReminderUpsertInput,
  ): Promise<CalendarEventReminderRecord> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === reminder.firmId &&
        candidate.matterId === reminder.matterId &&
        candidate.id === reminder.eventId &&
        !candidate.deletedAt,
    );
    if (!event) {
      throw new Error(`Calendar event ${reminder.eventId} was not found`);
    }
    const reminders = event.reminders ?? [];
    const existingIndex = reminders.findIndex((candidate) => candidate.id === reminder.id);
    if (existingIndex >= 0) {
      reminders[existingIndex] = clone(reminder);
    } else {
      reminders.push(clone(reminder));
    }
    event.reminders = reminders;
    return clone(reminder);
  }

  async createCalendarSchedulingRequest(
    request: CalendarSchedulingRequestRecord,
  ): Promise<CalendarSchedulingRequestRecord> {
    const existingIndex = this.calendarSchedulingRequests.findIndex(
      (candidate) => candidate.firmId === request.firmId && candidate.id === request.id,
    );
    if (existingIndex >= 0) {
      this.calendarSchedulingRequests[existingIndex] = clone(request);
    } else {
      this.calendarSchedulingRequests = [...this.calendarSchedulingRequests, clone(request)];
    }
    return clone(request);
  }

  async listCalendarSchedulingRequests(
    firmId: string,
    options: {
      matterId?: string;
      status?: CalendarSchedulingRequestRecord["status"];
      ownerUserId?: string;
    } = {},
  ): Promise<CalendarSchedulingRequestRecord[]> {
    return clone(
      this.calendarSchedulingRequests
        .filter(
          (request) =>
            request.firmId === firmId &&
            (!options.matterId || request.matterId === options.matterId) &&
            (!options.status || request.status === options.status) &&
            (!options.ownerUserId || request.ownerUserId === options.ownerUserId),
        )
        .sort((left, right) => {
          const leftTime = Date.parse(
            left.requestedDueAt ?? left.requestedStartsAt ?? left.createdAt,
          );
          const rightTime = Date.parse(
            right.requestedDueAt ?? right.requestedStartsAt ?? right.createdAt,
          );
          return leftTime === rightTime ? left.id.localeCompare(right.id) : leftTime - rightTime;
        }),
    );
  }

  async deleteCalendarEventReminder(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    reminderId: string;
    deletedAt: string;
    updatedByUserId: string;
  }): Promise<CalendarEventReminderRecord | undefined> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.matterId === input.matterId &&
        candidate.id === input.eventId &&
        !candidate.deletedAt,
    );
    const reminder = event?.reminders?.find(
      (candidate) => candidate.id === input.reminderId && !candidate.deletedAt,
    );
    if (!reminder) return undefined;
    reminder.deletedAt = input.deletedAt;
    reminder.updatedAt = input.deletedAt;
    reminder.updatedByUserId = input.updatedByUserId;
    return clone(reminder);
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

  async createCalendarMeetingSession(
    session: CalendarMeetingSessionCreateInput,
  ): Promise<CalendarMeetingSessionRecord> {
    const event = this.calendarEvents.find(
      (candidate) =>
        candidate.firmId === session.firmId &&
        candidate.matterId === session.matterId &&
        candidate.id === session.eventId &&
        !candidate.deletedAt,
    );
    if (!event) {
      throw new Error(`Calendar event ${session.eventId} was not found`);
    }
    if (this.calendarMeetingSessions.some((candidate) => candidate.id === session.id)) {
      throw new Error("Calendar meeting session already exists");
    }
    this.calendarMeetingSessions = [...this.calendarMeetingSessions, clone(session)];
    return clone(session);
  }

  async listCalendarMeetingSessions(
    firmId: string,
    options: {
      matterId?: string;
      eventId?: string;
      status?: CalendarMeetingSessionRecord["status"];
    } = {},
  ): Promise<CalendarMeetingSessionRecord[]> {
    return clone(
      this.calendarMeetingSessions
        .filter(
          (session) =>
            session.firmId === firmId &&
            (!options.matterId || session.matterId === options.matterId) &&
            (!options.eventId || session.eventId === options.eventId) &&
            (!options.status || session.status === options.status),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
        ),
    );
  }

  async getCalendarMeetingSession(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
  ): Promise<CalendarMeetingSessionRecord | undefined> {
    return clone(
      this.calendarMeetingSessions.find(
        (session) =>
          session.firmId === firmId &&
          session.matterId === matterId &&
          session.eventId === eventId &&
          session.id === sessionId,
      ),
    );
  }

  async updateCalendarMeetingSessionStatus(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    sessionId: string;
    status: CalendarMeetingSessionRecord["status"];
    occurredAt: string;
    actorUserId: string;
  }): Promise<CalendarMeetingSessionRecord | undefined> {
    const index = this.calendarMeetingSessions.findIndex(
      (session) =>
        session.firmId === input.firmId &&
        session.matterId === input.matterId &&
        session.eventId === input.eventId &&
        session.id === input.sessionId,
    );
    if (index < 0) return undefined;
    const updated = transitionCalendarMeetingSessionStatus(this.calendarMeetingSessions[index]!, {
      status: input.status,
      occurredAt: input.occurredAt,
      actorUserId: input.actorUserId,
    });
    this.calendarMeetingSessions[index] = clone(updated);
    return clone(updated);
  }

  async createCalendarGuestLink(
    link: CalendarGuestLinkCreateInput,
  ): Promise<CalendarGuestLinkRecord> {
    const session = this.calendarMeetingSessions.find(
      (candidate) =>
        candidate.firmId === link.firmId &&
        candidate.matterId === link.matterId &&
        candidate.eventId === link.eventId &&
        candidate.id === link.sessionId,
    );
    if (!session) {
      throw new Error(`Calendar meeting session ${link.sessionId} was not found`);
    }
    if (this.calendarGuestLinks.some((candidate) => candidate.tokenHash === link.tokenHash)) {
      throw new Error("Calendar guest link token hash already exists");
    }
    this.calendarGuestLinks = [...this.calendarGuestLinks, clone(link)];
    return clone(link);
  }

  async listCalendarGuestLinks(
    firmId: string,
    options: {
      matterId?: string;
      eventId?: string;
      sessionId?: string;
      status?: CalendarGuestLinkRecord["status"];
    } = {},
  ): Promise<CalendarGuestLinkRecord[]> {
    return clone(
      this.calendarGuestLinks
        .filter(
          (link) =>
            link.firmId === firmId &&
            (!options.matterId || link.matterId === options.matterId) &&
            (!options.eventId || link.eventId === options.eventId) &&
            (!options.sessionId || link.sessionId === options.sessionId) &&
            (!options.status || link.status === options.status),
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
        ),
    );
  }

  async getCalendarGuestLink(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
    linkId: string,
  ): Promise<CalendarGuestLinkRecord | undefined> {
    return clone(
      this.calendarGuestLinks.find(
        (link) =>
          link.firmId === firmId &&
          link.matterId === matterId &&
          link.eventId === eventId &&
          link.sessionId === sessionId &&
          link.id === linkId,
      ),
    );
  }

  async getCalendarGuestLinkByTokenHash(
    tokenHash: string,
  ): Promise<CalendarGuestLinkRecord | undefined> {
    return clone(this.calendarGuestLinks.find((link) => link.tokenHash === tokenHash));
  }

  async updateCalendarGuestLinkStatus(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    sessionId: string;
    linkId: string;
    status: CalendarGuestLinkRecord["status"];
    occurredAt: string;
    actorUserId: string;
  }): Promise<CalendarGuestLinkRecord | undefined> {
    const index = this.calendarGuestLinks.findIndex(
      (link) =>
        link.firmId === input.firmId &&
        link.matterId === input.matterId &&
        link.eventId === input.eventId &&
        link.sessionId === input.sessionId &&
        link.id === input.linkId,
    );
    if (index < 0) return undefined;
    const updated = transitionCalendarGuestLinkStatus(this.calendarGuestLinks[index]!, {
      status: input.status,
      occurredAt: input.occurredAt,
      actorUserId: input.actorUserId,
    });
    this.calendarGuestLinks[index] = clone(updated);
    return clone(updated);
  }

  async revokeCalendarGuestLink(input: {
    firmId: string;
    matterId: string;
    eventId: string;
    sessionId: string;
    linkId: string;
    revokedAt: string;
    actorUserId: string;
  }): Promise<CalendarGuestLinkRecord | undefined> {
    return this.updateCalendarGuestLinkStatus({
      firmId: input.firmId,
      matterId: input.matterId,
      eventId: input.eventId,
      sessionId: input.sessionId,
      linkId: input.linkId,
      status: "revoked",
      occurredAt: input.revokedAt,
      actorUserId: input.actorUserId,
    });
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
    const checkId = `conflict-check-${String(this.conflictChecks.length + 1).padStart(3, "0")}`;
    const createdAt = new Date().toISOString();
    this.conflictChecks = [
      ...this.conflictChecks,
      {
        id: checkId,
        firmId: input.firmId,
        requestedByUserId: input.actorId,
        prospectiveName: input.prospectiveName,
        querySnapshot: {
          prospectiveName: input.prospectiveName,
          aliases: input.aliases ?? [],
          identifiers: input.identifiers ?? [],
          includeClosedMatters: input.includeClosedMatters,
          ...(input.prospectiveRole ? { prospectiveRole: input.prospectiveRole } : {}),
        },
        resultSnapshot: clone(results),
        disposition: "pending_review",
        createdAt,
      },
    ];
    this.auditEvents = [
      ...this.auditEvents,
      appendAuditEvent(this.auditEvents.at(-1), {
        id: `audit-${String(this.auditEvents.length + 1).padStart(3, "0")}`,
        firmId: input.firmId,
        actorId: input.actorId,
        action: "conflict_check.completed",
        resourceType: "conflict_check",
        resourceId: checkId,
        occurredAt: createdAt,
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

  async createPortalGrant(grant: PortalGrant): Promise<PortalGrant> {
    this.portalGrants = [...this.portalGrants, clone(grant)];
    return clone(grant);
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
    const existing = link.idempotencyKey
      ? this.externalUploadLinks.find(
          (candidate) =>
            candidate.firmId === link.firmId && candidate.idempotencyKey === link.idempotencyKey,
        )
      : undefined;
    if (existing) {
      const existingFingerprint = canonicalizeForIdempotency({
        matterId: existing.matterId,
        requestedByUserId: existing.requestedByUserId,
        maxUploads: existing.maxUploads,
        expiresAt: existing.expiresAt,
      });
      const inputFingerprint = canonicalizeForIdempotency({
        matterId: link.matterId,
        requestedByUserId: link.requestedByUserId,
        maxUploads: link.maxUploads,
        expiresAt: link.expiresAt,
      });
      if (existingFingerprint !== inputFingerprint) throw new IdempotencyKeyConflictError();
      return clone(existing);
    }
    if (this.externalUploadLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
      throw new Error("External upload link token hash already exists");
    }
    this.externalUploadLinks = [...this.externalUploadLinks, clone(link)];
    return clone(link);
  }

  async listSavedOperationalViewDefinitions(
    firmId: string,
    options: {
      ownerUserId: string;
      surface?: SavedOperationalViewDefinition["surface"];
      includeArchived?: boolean;
    },
  ): Promise<SavedOperationalViewDefinition[]> {
    return clone(
      this.savedOperationalViewDefinitions
        .filter(
          (definition) =>
            definition.firmId === firmId &&
            definition.ownerUserId === options.ownerUserId &&
            (!options.surface || definition.surface === options.surface) &&
            (options.includeArchived || definition.status === "active"),
        )
        .sort(
          (left, right) =>
            left.name.localeCompare(right.name) || left.createdAt.localeCompare(right.createdAt),
        ),
    );
  }

  async getSavedOperationalViewDefinition(
    firmId: string,
    id: string,
  ): Promise<SavedOperationalViewDefinition | undefined> {
    return clone(
      this.savedOperationalViewDefinitions.find(
        (definition) => definition.firmId === firmId && definition.id === id,
      ),
    );
  }

  async createSavedOperationalViewDefinition(
    input: SavedOperationalViewDefinitionInput,
  ): Promise<SavedOperationalViewDefinition> {
    const now = new Date().toISOString();
    const definition: SavedOperationalViewDefinition = {
      id: input.id ?? crypto.randomUUID(),
      firmId: input.firmId,
      ownerUserId: input.ownerUserId,
      surface: input.surface,
      name: input.name,
      filters: input.filters ?? {},
      columns: input.columns ?? [],
      sort: input.sort ?? {},
      rowLimit: input.rowLimit ?? 25,
      dashboardBehavior: input.dashboardBehavior ?? {},
      permissionScope: input.permissionScope ?? ["matter:read"],
      status: input.status ?? "active",
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      archivedAt: input.archivedAt,
    };
    this.savedOperationalViewDefinitions = [
      ...this.savedOperationalViewDefinitions,
      clone(definition),
    ];
    return clone(definition);
  }

  async updateSavedOperationalViewDefinition(
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
  ): Promise<SavedOperationalViewDefinition | undefined> {
    const index = this.savedOperationalViewDefinitions.findIndex(
      (definition) => definition.firmId === firmId && definition.id === id,
    );
    if (index === -1) return undefined;
    const updated = {
      ...this.savedOperationalViewDefinitions[index]!,
      ...clone(updates),
      updatedAt: updates.updatedAt ?? new Date().toISOString(),
    };
    this.savedOperationalViewDefinitions = this.savedOperationalViewDefinitions.map(
      (definition, definitionIndex) => (definitionIndex === index ? updated : definition),
    );
    return clone(updated);
  }

  async archiveSavedOperationalViewDefinition(input: {
    firmId: string;
    id: string;
    archivedAt: string;
  }): Promise<SavedOperationalViewDefinition | undefined> {
    const index = this.savedOperationalViewDefinitions.findIndex(
      (definition) => definition.firmId === input.firmId && definition.id === input.id,
    );
    if (index === -1) return undefined;
    const archived: SavedOperationalViewDefinition = {
      ...this.savedOperationalViewDefinitions[index]!,
      status: "archived",
      archivedAt: input.archivedAt,
      updatedAt: input.archivedAt,
    };
    this.savedOperationalViewDefinitions = this.savedOperationalViewDefinitions.map(
      (definition, definitionIndex) => (definitionIndex === index ? archived : definition),
    );
    return clone(archived);
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
      intakeFormLinkId?: string;
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
            (!options.intakeFormLinkId || log.intakeFormLinkId === options.intakeFormLinkId) &&
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
      reviewStatus: input.reviewStatus ?? "not_required",
      reviewMetadata: {},
      externalUploadLinkId: input.externalUploadLinkId,
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
      if (document.externalUploadLinkId) {
        document.reviewStatus = "retry_requested";
        document.reviewReason = "checksum_mismatch";
        document.reviewMetadata = { automatedOutcome: "checksum_mismatch" };
      }
      return clone(document);
    }

    document.uploadStatus = "verified";
    document.checksumStatus = duplicate ? "duplicate" : "verified";
    document.duplicateOfDocumentId = duplicate?.id;
    document.scanStatus = input.scanStatus ?? "queued";
    document.reviewStatus = document.externalUploadLinkId ? "pending_review" : "not_required";
    document.reviewReason = duplicate ? "duplicate" : undefined;
    document.reviewMetadata = duplicate
      ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicate.id }
      : {};
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

  async reviewUploadedDocument(input: {
    firmId: string;
    documentId: string;
    status: DocumentRecord["reviewStatus"];
    decision: DocumentRecord["reviewDecision"];
    reason?: DocumentRecord["reviewReason"];
    metadata: Record<string, unknown>;
    reviewedByUserId: string;
    reviewedAt: string;
  }): Promise<DocumentRecord> {
    const document = this.documents.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
    );
    if (!document) throw new Error(`Unknown document ${input.documentId}`);
    document.reviewStatus = input.status;
    document.reviewDecision = input.decision;
    document.reviewReason = input.reason;
    document.reviewMetadata = clone(input.metadata);
    document.reviewedByUserId = input.reviewedByUserId;
    document.reviewedAt = input.reviewedAt;
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

  async listSignatureRequestSigners(
    firmId: string,
    signatureRequestId: string,
  ): Promise<SignatureRequestSignerRecord[]> {
    return clone(
      this.signatureRequestSigners.filter(
        (signer) => signer.firmId === firmId && signer.signatureRequestId === signatureRequestId,
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

  async createIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord> {
    if (this.intakeTemplates.some((existing) => existing.id === template.id)) {
      throw new Error(`Intake template ${template.id} already exists`);
    }
    this.intakeTemplates = [...this.intakeTemplates, clone(template)];
    return clone(template);
  }

  async updateIntakeTemplate(template: IntakeTemplateRecord): Promise<IntakeTemplateRecord> {
    const index = this.intakeTemplates.findIndex(
      (candidate) => candidate.firmId === template.firmId && candidate.id === template.id,
    );
    if (index === -1) throw new Error(`Unknown intake template ${template.id}`);
    this.intakeTemplates[index] = clone(template);
    return clone(template);
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

  async listIntakeFormLinks(
    firmId: string,
    options: { matterId?: string; intakeSessionId?: string } = {},
  ): Promise<IntakeFormLinkRecord[]> {
    return clone(
      this.intakeFormLinks
        .filter(
          (link) =>
            link.firmId === firmId &&
            (!options.matterId || link.matterId === options.matterId) &&
            (!options.intakeSessionId || link.intakeSessionId === options.intakeSessionId),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async createIntakeFormLink(link: IntakeFormLinkRecord): Promise<IntakeFormLinkRecord> {
    if (this.intakeFormLinks.some((existing) => existing.tokenHash === link.tokenHash)) {
      throw new Error("Intake form link token hash already exists");
    }
    this.intakeFormLinks = [...this.intakeFormLinks, clone(link)];
    return clone(link);
  }

  async getIntakeFormLink(firmId: string, id: string): Promise<IntakeFormLinkRecord | undefined> {
    return clone(this.intakeFormLinks.find((link) => link.firmId === firmId && link.id === id));
  }

  async getIntakeFormLinkByTokenHash(tokenHash: string): Promise<IntakeFormLinkRecord | undefined> {
    return clone(this.intakeFormLinks.find((link) => link.tokenHash === tokenHash));
  }

  async revokeIntakeFormLink(input: {
    firmId: string;
    id: string;
    revokedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const link = this.intakeFormLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!link) return undefined;
    link.revokedAt = input.revokedAt;
    return clone(link);
  }

  async markIntakeFormLinkSubmitted(input: {
    firmId: string;
    id: string;
    submittedAt: string;
    answerSnapshotId: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const link = this.intakeFormLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!link || link.submittedAt || link.revokedAt) return undefined;
    link.submittedAt = input.submittedAt;
    link.answerSnapshotId = input.answerSnapshotId;
    return clone(link);
  }

  async reserveIntakeFormLinkSubmission(input: {
    firmId: string;
    id: string;
    clientSubmissionId: string;
    submissionFingerprint: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const link = this.intakeFormLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!link || link.revokedAt) return clone(link);
    if (!link.submittedAt && !link.clientSubmissionId) {
      link.clientSubmissionId = input.clientSubmissionId;
      link.submissionFingerprint = input.submissionFingerprint;
    }
    return clone(link);
  }

  async saveIntakeFormLinkDraft(input: {
    firmId: string;
    id: string;
    answers: Record<string, unknown>;
    draftUpdatedAt: string;
  }): Promise<IntakeFormLinkRecord | undefined> {
    const link = this.intakeFormLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!link || link.revokedAt || link.submittedAt) return clone(link);
    link.draftAnswers = clone(input.answers);
    link.draftUpdatedAt = input.draftUpdatedAt;
    return clone(link);
  }

  async listIntakeFormReviews(
    firmId: string,
    options: { matterId?: string; intakeSessionId?: string; formLinkId?: string } = {},
  ): Promise<IntakeFormReviewRecord[]> {
    return clone(
      this.intakeFormReviews
        .filter(
          (review) =>
            review.firmId === firmId &&
            (!options.matterId || review.matterId === options.matterId) &&
            (!options.intakeSessionId || review.intakeSessionId === options.intakeSessionId) &&
            (!options.formLinkId || review.formLinkId === options.formLinkId),
        )
        .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt)),
    );
  }

  async createIntakeFormReview(review: IntakeFormReviewRecord): Promise<IntakeFormReviewRecord> {
    if (
      this.intakeFormReviews.some(
        (existing) =>
          existing.firmId === review.firmId && existing.formLinkId === review.formLinkId,
      )
    ) {
      throw new Error("Intake form link has already been reviewed");
    }
    this.intakeFormReviews = [...this.intakeFormReviews, clone(review)];
    return clone(review);
  }

  async listIntakeFormItemActions(
    firmId: string,
    options: { formLinkId?: string; intakeSessionId?: string; itemId?: string } = {},
  ): Promise<IntakeFormItemActionRecord[]> {
    return clone(
      this.intakeFormItemActions.filter(
        (action) =>
          action.firmId === firmId &&
          (!options.formLinkId || action.formLinkId === options.formLinkId) &&
          (!options.intakeSessionId || action.intakeSessionId === options.intakeSessionId) &&
          (!options.itemId || action.itemId === options.itemId),
      ),
    );
  }

  async upsertIntakeFormItemAction(
    action: IntakeFormItemActionRecord,
  ): Promise<IntakeFormItemActionRecord> {
    const existingIndex = this.intakeFormItemActions.findIndex(
      (candidate) => candidate.firmId === action.firmId && candidate.id === action.id,
    );
    if (existingIndex >= 0) {
      this.intakeFormItemActions[existingIndex] = clone(action);
    } else {
      this.intakeFormItemActions = [...this.intakeFormItemActions, clone(action)];
    }
    return clone(action);
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

  async createIntakeVariableProposals(
    proposals: IntakeVariableProposal[],
  ): Promise<IntakeVariableProposal[]> {
    const newIds = new Set(proposals.map((proposal) => proposal.id));
    this.intakeVariableProposals = [
      ...this.intakeVariableProposals.filter((proposal) => !newIds.has(proposal.id)),
      ...clone(proposals),
    ];
    return clone(proposals);
  }

  async listIntakeVariableProposals(
    firmId: string,
    options: { matterId?: string; status?: IntakeVariableProposal["status"] } = {},
  ): Promise<IntakeVariableProposal[]> {
    return clone(
      this.intakeVariableProposals.filter(
        (proposal) =>
          proposal.firmId === firmId &&
          (!options.matterId || proposal.matterId === options.matterId) &&
          (!options.status || proposal.status === options.status),
      ),
    );
  }

  async reviewIntakeVariableProposal(input: {
    firmId: string;
    id: string;
    status: "approved" | "rejected";
    reviewedByUserId: string;
    reviewedAt: string;
    rejectionReason?: string;
  }): Promise<IntakeVariableProposal | undefined> {
    const proposal = this.intakeVariableProposals.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.id,
    );
    if (!proposal || proposal.status !== "pending") return undefined;
    proposal.status = input.status;
    proposal.reviewedByUserId = input.reviewedByUserId;
    proposal.reviewedAt = input.reviewedAt;
    proposal.rejectionReason = input.status === "rejected" ? input.rejectionReason : undefined;
    if (input.status === "approved") {
      this.applyVariableProposal(proposal);
      proposal.appliedAt = input.reviewedAt;
    }
    return clone(proposal);
  }

  private applyVariableProposal(proposal: IntakeVariableProposal): void {
    if (proposal.targetScope === "client") {
      const contact = this.contacts.find(
        (candidate) =>
          candidate.firmId === proposal.firmId && candidate.id === proposal.targetRecordId,
      );
      if (!contact) throw new Error(`Unknown intake proposal contact ${proposal.targetRecordId}`);
      if (proposal.targetField === "displayName") contact.displayName = proposal.proposedValue;
      if (proposal.targetField === "notes") contact.notes = proposal.proposedValue;
      return;
    }
    const matter = this.matters.find(
      (candidate) =>
        candidate.firmId === proposal.firmId && candidate.id === proposal.targetRecordId,
    );
    if (!matter) throw new Error(`Unknown intake proposal matter ${proposal.targetRecordId}`);
    if (proposal.targetField === "title") matter.title = proposal.proposedValue;
    if (proposal.targetField === "practiceArea") matter.practiceArea = proposal.proposedValue;
    if (proposal.targetField === "jurisdiction") {
      if (!["BC", "ON", "CANADA", "OTHER"].includes(proposal.proposedValue)) {
        throw new Error(`Unsupported intake proposal jurisdiction ${proposal.proposedValue}`);
      }
      matter.jurisdiction = proposal.proposedValue as Matter["jurisdiction"];
    }
  }

  async listGeneratedDocuments(
    firmId: string,
    options: { matterId?: string; documentId?: string } = {},
  ): Promise<GeneratedDocumentRecord[]> {
    return clone(
      this.generatedDocuments
        .filter(
          (document) =>
            document.firmId === firmId &&
            (!options.matterId || document.matterId === options.matterId) &&
            (!options.documentId || document.documentId === options.documentId),
        )
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    );
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    this.generatedDocuments = [...this.generatedDocuments, clone(document)];
    return clone(document);
  }

  async listDocumentAssemblySetDefinitions(
    firmId: string,
    options: { activeOnly?: boolean } = {},
  ): Promise<DocumentAssemblySetDefinitionRecord[]> {
    return clone(
      this.documentAssemblySetDefinitions
        .filter(
          (definition) =>
            definition.firmId === firmId && (!options.activeOnly || definition.active),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  async listDocumentAssemblyPackages(
    firmId: string,
    options: { matterId?: string; definitionId?: string } = {},
  ): Promise<DocumentAssemblyPackageRecord[]> {
    return clone(
      this.documentAssemblyPackages
        .filter(
          (item) =>
            item.firmId === firmId &&
            (!options.matterId || item.matterId === options.matterId) &&
            (!options.definitionId || item.definitionId === options.definitionId),
        )
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    );
  }

  async listSignatureEnvelopes(
    firmId: string,
    options: { matterId?: string; assemblyPackageId?: string; signatureRequestId?: string } = {},
  ): Promise<SignatureEnvelopeRecord[]> {
    return clone(
      this.signatureEnvelopes
        .filter(
          (envelope) =>
            envelope.firmId === firmId &&
            (!options.matterId || envelope.matterId === options.matterId) &&
            (!options.assemblyPackageId ||
              envelope.assemblyPackageId === options.assemblyPackageId) &&
            (!options.signatureRequestId ||
              envelope.signatureRequestId === options.signatureRequestId),
        )
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    );
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
    validateLedgerReconciliationRecord(reconciliation);
    this.ledgerReconciliations = [...this.ledgerReconciliations, clone(reconciliation)];
    return clone(reconciliation);
  }

  async listLedgerReconciliations(firmId: string): Promise<LedgerReconciliationRecord[]> {
    return clone(
      this.ledgerReconciliations.filter((reconciliation) => reconciliation.firmId === firmId),
    );
  }

  async createLedgerStatementImportBatch(
    batch: LedgerStatementImportBatchRecord,
  ): Promise<LedgerStatementImportBatchRecord> {
    const account = this.ledgerAccounts.find(
      (candidate) => candidate.firmId === batch.firmId && candidate.id === batch.accountId,
    );
    if (!account || account.type !== "trust_asset") {
      throw new Error("Statement import batches require an existing trust asset account");
    }
    const creator = this.users.find(
      (candidate) => candidate.firmId === batch.firmId && candidate.id === batch.createdByUserId,
    );
    if (!creator) {
      throw new Error(`Unknown user ${batch.createdByUserId}`);
    }
    validateLedgerStatementImportBatchRecord(batch);
    this.ledgerStatementImportBatches = [...this.ledgerStatementImportBatches, clone(batch)];
    return clone(batch);
  }

  async listLedgerStatementImportBatches(
    firmId: string,
    options: { accountId?: string } = {},
  ): Promise<LedgerStatementImportBatchRecord[]> {
    return clone(
      this.ledgerStatementImportBatches
        .filter(
          (batch) =>
            batch.firmId === firmId &&
            (!options.accountId || batch.accountId === options.accountId),
        )
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    );
  }

  async createLedgerReconciliationExceptionResolution(
    resolution: LedgerReconciliationExceptionResolutionRecord,
  ): Promise<LedgerReconciliationExceptionResolutionRecord> {
    const account = this.ledgerAccounts.find(
      (candidate) =>
        candidate.firmId === resolution.firmId && candidate.id === resolution.accountId,
    );
    if (!account || account.type !== "trust_asset") {
      throw new Error(
        "Reconciliation exception resolutions require an existing trust asset account",
      );
    }
    const reviewer = this.users.find(
      (candidate) =>
        candidate.firmId === resolution.firmId && candidate.id === resolution.recordedByUserId,
    );
    if (!reviewer) {
      throw new Error(`Unknown user ${resolution.recordedByUserId}`);
    }
    validateLedgerReconciliationExceptionResolutionRecord(resolution);
    this.ledgerReconciliationExceptionResolutions = [
      ...this.ledgerReconciliationExceptionResolutions,
      clone(resolution),
    ];
    return clone(resolution);
  }

  async listLedgerReconciliationExceptionResolutions(
    firmId: string,
    options: { accountId?: string } = {},
  ): Promise<LedgerReconciliationExceptionResolutionRecord[]> {
    return clone(
      this.ledgerReconciliationExceptionResolutions
        .filter(
          (resolution) =>
            resolution.firmId === firmId &&
            (!options.accountId || resolution.accountId === options.accountId),
        )
        .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt)),
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

  async listBillingPeriodLocks(firmId: string): Promise<BillingPeriodLockRecord[]> {
    return clone(
      this.billingPeriodLocks
        .filter((lock) => lock.firmId === firmId)
        .sort((left, right) => left.periodStart.localeCompare(right.periodStart)),
    );
  }

  async createBillingPeriodLock(lock: BillingPeriodLockRecord): Promise<BillingPeriodLockRecord> {
    validateBillingPeriodLock(lock);
    const overlaps = this.billingPeriodLocks.some((candidate) =>
      billingPeriodLocksOverlap(candidate, lock),
    );
    if (overlaps) throw new Error("Billing period lock overlaps an existing lock");
    this.billingPeriodLocks = [...this.billingPeriodLocks, clone(lock)];
    return clone(lock);
  }

  async listBillingRateRules(
    firmId: string,
    options: { activeOnly?: boolean; matterId?: string; userId?: string } = {},
  ): Promise<BillingRateRuleRecord[]> {
    return clone(
      this.billingRateRules
        .filter(
          (rule) =>
            rule.firmId === firmId &&
            (!options.activeOnly || rule.active) &&
            (!options.matterId || !rule.matterId || rule.matterId === options.matterId) &&
            (!options.userId || !rule.userId || rule.userId === options.userId),
        )
        .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom)),
    );
  }

  async createBillingRateRule(rule: BillingRateRuleRecord): Promise<BillingRateRuleRecord> {
    validateBillingRateRule(rule);
    const overlaps = this.billingRateRules.some((candidate) =>
      billingRateRulesOverlapAtSameActiveScope(candidate, rule),
    );
    if (overlaps) throw new Error("Billing rate rule overlaps an active rule at the same scope");
    this.billingRateRules = [...this.billingRateRules, clone(rule)];
    return clone(rule);
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

  async createHostedPaymentRequest(
    request: HostedPaymentRequestRecord,
  ): Promise<HostedPaymentRequestRecord> {
    this.hostedPaymentRequests = [...this.hostedPaymentRequests, clone(request)];
    return clone(request);
  }

  async getHostedPaymentRequest(
    firmId: string,
    requestId: string,
  ): Promise<HostedPaymentRequestRecord | undefined> {
    return clone(
      this.hostedPaymentRequests.find(
        (request) => request.firmId === firmId && request.id === requestId,
      ),
    );
  }

  async listHostedPaymentRequests(
    firmId: string,
    options: {
      matterId?: string;
      invoiceId?: string;
      status?: HostedPaymentRequestRecord["status"];
    } = {},
  ): Promise<HostedPaymentRequestRecord[]> {
    return clone(
      this.hostedPaymentRequests.filter(
        (request) =>
          request.firmId === firmId &&
          (!options.matterId || request.matterId === options.matterId) &&
          (!options.invoiceId || request.invoiceId === options.invoiceId) &&
          (!options.status || request.status === options.status),
      ),
    );
  }

  async updateHostedPaymentRequest(
    firmId: string,
    requestId: string,
    updates: HostedPaymentRequestUpdate,
  ): Promise<HostedPaymentRequestRecord> {
    const existing = await this.getHostedPaymentRequest(firmId, requestId);
    if (!existing) throw new Error("Hosted payment request was not found");
    const updated = clone({ ...existing, ...updates });
    this.hostedPaymentRequests = this.hostedPaymentRequests.map((request) =>
      request.firmId === firmId && request.id === requestId ? updated : request,
    );
    return clone(updated);
  }

  async createTrustTransferRequest(
    request: TrustTransferRequestRecord,
  ): Promise<TrustTransferRequestRecord> {
    this.trustTransferRequests = [...this.trustTransferRequests, clone(request)];
    return clone(request);
  }

  async getTrustTransferRequest(
    firmId: string,
    requestId: string,
  ): Promise<TrustTransferRequestRecord | undefined> {
    return clone(
      this.trustTransferRequests.find(
        (request) => request.firmId === firmId && request.id === requestId,
      ),
    );
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

  async updateTrustTransferRequest(
    firmId: string,
    requestId: string,
    updates: TrustTransferRequestUpdate,
    options: TrustTransferRequestUpdateOptions = {},
  ): Promise<TrustTransferRequestRecord> {
    const existing = await this.getTrustTransferRequest(firmId, requestId);
    if (!existing) throw new Error("Trust transfer request was not found");
    if (
      (options.expectedStatus && existing.status !== options.expectedStatus) ||
      (options.requireLedgerTransactionUnlinked && existing.ledgerTransactionId)
    ) {
      throw new Error("Trust transfer request update conflict");
    }
    const updated: TrustTransferRequestRecord = { ...existing, ...updates };
    this.trustTransferRequests = this.trustTransferRequests.map((request) =>
      request.firmId === firmId && request.id === requestId ? clone(updated) : request,
    );
    return clone(updated);
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

  async listDraftAssistRecords(
    firmId: string,
    options: { matterId?: string; draftId?: string; documentId?: string } = {},
  ): Promise<DraftAssistRecord[]> {
    return clone(
      this.draftAssistRecords
        .filter(
          (record) =>
            record.firmId === firmId &&
            (!options.matterId || record.matterId === options.matterId) &&
            (!options.draftId || record.draftId === options.draftId) &&
            (!options.documentId || record.documentId === options.documentId),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getDraftAssistRecord(firmId: string, id: string): Promise<DraftAssistRecord | undefined> {
    return clone(
      this.draftAssistRecords.find((record) => record.firmId === firmId && record.id === id),
    );
  }

  async createDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord> {
    this.draftAssistRecords = [...this.draftAssistRecords, clone(record)];
    return clone(record);
  }

  async updateDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord> {
    const index = this.draftAssistRecords.findIndex(
      (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
    );
    if (index === -1) throw new Error(`Draft assist record ${record.id} was not found`);
    this.draftAssistRecords[index] = clone(record);
    return clone(record);
  }

  async listAiOperationalProposals(
    firmId: string,
    options: {
      matterId?: string;
      status?: AiOperationalProposalStatus;
      kind?: AiOperationalProposalKind;
    } = {},
  ): Promise<AiOperationalProposalRecord[]> {
    return clone(
      this.aiOperationalProposals
        .filter(
          (record) =>
            record.firmId === firmId &&
            (!options.matterId || record.matterId === options.matterId) &&
            (!options.status || record.status === options.status) &&
            (!options.kind || record.kind === options.kind),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getAiOperationalProposal(
    firmId: string,
    id: string,
  ): Promise<AiOperationalProposalRecord | undefined> {
    return clone(
      this.aiOperationalProposals.find((record) => record.firmId === firmId && record.id === id),
    );
  }

  async createAiOperationalProposal(
    record: AiOperationalProposalRecord,
  ): Promise<AiOperationalProposalRecord> {
    validateAiOperationalProposalRecord(record);
    if (this.aiOperationalProposals.some((candidate) => candidate.id === record.id)) {
      throw new Error("AI operational proposal already exists");
    }
    this.aiOperationalProposals.push(clone(record));
    return clone(record);
  }

  async updateAiOperationalProposal(
    record: AiOperationalProposalRecord,
  ): Promise<AiOperationalProposalRecord> {
    validateAiOperationalProposalRecord(record);
    const index = this.aiOperationalProposals.findIndex(
      (candidate) => candidate.firmId === record.firmId && candidate.id === record.id,
    );
    if (index === -1) {
      throw new Error(`AI operational proposal ${record.id} was not found`);
    }
    this.aiOperationalProposals[index] = clone(record);
    return clone(record);
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

  async listInboundEmailAddresses(firmId: string): Promise<InboundEmailAddressRecord[]> {
    return clone(this.inboundEmailAddresses.filter((address) => address.firmId === firmId));
  }

  async createInboundEmailAddress(
    address: InboundEmailAddressRecord,
  ): Promise<InboundEmailAddressRecord> {
    const normalized = address.address.trim().toLowerCase();
    if (
      this.inboundEmailAddresses.some(
        (candidate) =>
          candidate.firmId === address.firmId &&
          candidate.address.trim().toLowerCase() === normalized,
      )
    ) {
      throw new Error("Inbound email address already exists");
    }
    this.inboundEmailAddresses = [...this.inboundEmailAddresses, clone(address)];
    return clone(address);
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

  async promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult> {
    const attachmentIndex = this.inboundEmailAttachments.findIndex(
      (attachment) =>
        attachment.firmId === input.firmId &&
        attachment.inboundMessageId === input.messageId &&
        attachment.id === input.attachmentId,
    );
    if (attachmentIndex === -1) throw new Error("Inbound email attachment was not found");
    const attachment = this.inboundEmailAttachments[attachmentIndex]!;
    if (!attachment.checksumSha256) {
      throw new Error("Inbound email attachment checksum is required for document promotion");
    }
    if (attachment.documentId) {
      const document = this.documents.find(
        (candidate) => candidate.firmId === input.firmId && candidate.id === attachment.documentId,
      );
      if (!document) throw new Error("Promoted document was not found");
      return { attachment: clone(attachment), document: clone(document), created: false };
    }

    const duplicate = this.documents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.checksumSha256 === attachment.checksumSha256 &&
        candidate.checksumStatus === "verified",
    );
    const now = input.now ?? new Date().toISOString();
    const document: DocumentRecord = {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: attachment.storageKey,
      checksumSha256: attachment.checksumSha256,
      version: 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "verified",
      checksumStatus: duplicate ? "duplicate" : "verified",
      scanStatus: "queued",
      reviewStatus: "not_required",
      reviewDecision: undefined,
      reviewReason: duplicate ? "duplicate" : "other",
      reviewMetadata: duplicate
        ? { automatedOutcome: "duplicate_detected", duplicateOfDocumentId: duplicate.id }
        : { source: "inbound_email_promotion" },
      duplicateOfDocumentId: duplicate?.id,
      uploadedAt: now,
      verifiedAt: now,
    };
    this.documents = [...this.documents, clone(document)];
    const updatedAttachment = { ...attachment, documentId: document.id };
    this.inboundEmailAttachments[attachmentIndex] = clone(updatedAttachment);
    return {
      attachment: clone(updatedAttachment),
      document: clone(document),
      created: true,
    };
  }
}
