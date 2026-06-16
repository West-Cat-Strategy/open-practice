import type {
  AnswerSnapshotRecord,
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  DocumentTextExtractionRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  IntakeTemplateVersionRecord,
  SignatureProviderEventRecord,
  SignatureEnvelopeRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
/* eslint-disable @typescript-eslint/no-this-alias -- Store facade getters/setters need live access to repository arrays. */

import {
  type AccessLogRecord,
  type AiOperationalProposalRecord,
  type AuditEvent,
  type CalendarCredentialRecord,
  type CalendarEventRecord,
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
  type LedgerAccountingReviewProfileRecord,
  type LedgerReconciliationExceptionResolutionRecord,
  type LedgerReconciliationRecord,
  type LedgerStatementImportBatchRecord,
  type LedgerStatementMatchRuleProfileRecord,
  type LedgerTransactionApprovalRecord,
  type LegalClinicMatterProfile,
  type LegalClinicProgram,
  type LegalResearchArtifactRecord,
  type ManualPaymentRecord,
  type Matter,
  type MatterParty,
  type PaymentAllocationRecord,
  type PortalGrant,
  type PortalDocumentAccess,
  type PostedLedgerTransaction,
  type ProviderSettingRecord,
  type PublicConsultationIntakeRecord,
  type RecoveryCodeRecord,
  type SavedOperationalViewDefinition,
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
  sampleMatterlessFirm,
  sampleGeneratedDocuments,
  sampleIntakeSessions,
  sampleIntakeTemplates,
  sampleIntakeTemplateVersions,
  sampleInvoiceLines,
  sampleInvoices,
  sampleHostedPaymentRequests,
  sampleLedgerAccountingReviewProfiles,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleLedgerStatementMatchRuleProfiles,
  sampleLegalClinicMatterProfiles,
  sampleLegalClinicPrograms,
  sampleLegalResearchArtifacts,
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
import type { ProviderConfigCipher } from "../config-encryption.js";
import type {
  DocumentUploadIntent,
  InboundAttachmentPromotionInput,
  InboundAttachmentPromotionResult,
  OpenPracticeRepository,
} from "./contracts.js";
import type {
  AuthAccountRecord,
  AuthPasswordSetupTokenRecord,
  AuthRepository,
  AuthSessionRecord,
} from "./auth-contracts.js";
import type { ConnectorRepository } from "./connector-contracts.js";
import type { EmailJobsRepository } from "./jobs-email-contracts.js";
import type { FirmSettingsRepository } from "./firm-settings-contracts.js";
import type { ProviderSettingsRepository } from "./provider-settings-contracts.js";
import { clone } from "./contracts.js";
import { createMemoryAuthRepository, type MemoryAuthStore } from "./auth/memory.js";
import {
  appendMemoryAuditEvent,
  listMemoryAuditEvents,
  recordMemoryAuditEvent,
  type MemoryAuditStore,
} from "./audit/memory.js";
import {
  createMemoryAiOperationalProposal,
  getMemoryAiOperationalProposal,
  listMemoryAiOperationalProposals,
  updateMemoryAiOperationalProposal,
  type MemoryAiOperationalProposalStore,
} from "./ai-operational-proposals/memory.js";
import {
  createMemoryCalendarCredential,
  getMemoryCalendarCredentialByUsername,
  listMemoryCalendarCredentials,
  revokeMemoryCalendarCredential,
  touchMemoryCalendarCredential,
  type MemoryCalendarCredentialStore,
} from "./calendar-credentials/memory.js";
import {
  createMemoryCalendarGuestLink,
  createMemoryCalendarMeetingSession,
  createMemoryCalendarSchedulingRequest,
  deleteMemoryCalendarEvent,
  deleteMemoryCalendarEventAttendee,
  deleteMemoryCalendarEventReminder,
  getMemoryCalendarEvent,
  getMemoryCalendarEventByUid,
  getMemoryCalendarGuestLink,
  getMemoryCalendarGuestLinkByTokenHash,
  getMemoryCalendarMeetingSession,
  listMemoryCalendarEvents,
  listMemoryCalendarEventAttendees,
  listMemoryCalendarEventReminders,
  listMemoryCalendarGuestLinks,
  listMemoryCalendarMeetingSessions,
  listMemoryCalendarSchedulingRequests,
  replaceMemoryCalendarEventAttendees,
  revokeMemoryCalendarGuestLink,
  updateMemoryCalendarGuestLinkStatus,
  updateMemoryCalendarMeetingSessionStatus,
  upsertMemoryCalendarEvent,
  upsertMemoryCalendarEventAttendee,
  upsertMemoryCalendarEventReminder,
  type MemoryCalendarEventStore,
} from "./calendar-events/memory.js";
import { runMemoryConflictCheck, type MemoryConflictCheckStore } from "./conflict-checks/memory.js";
import {
  createMemoryContact,
  createMemoryContactDataQualityResolution,
  createMemoryContactRelationship,
  createMemoryMatterContactAssociation,
  getMemoryContact,
  listMemoryContactDataQualityResolutions,
  listMemoryContactDossiersForUser,
  listMemoryContactPortalGrantsForUser,
  listMemoryContactsForUser,
  listMemoryContactTimelineForUser,
  updateMemoryContact,
  updateMemoryContactRelationship,
  updateMemoryMatterContactAssociation,
  type MemoryContactStore,
} from "./contacts/memory.js";
import {
  createMemoryIntakeTemplate,
  createMemoryIntakeTemplateVersion,
  getLatestMemoryIntakeTemplateVersion,
  getMemoryIntakeTemplateVersion,
  listMemoryIntakeTemplateVersions,
  listMemoryIntakeTemplates,
  updateMemoryIntakeTemplate,
  type MemoryIntakeTemplateStore,
} from "./intake-templates/memory.js";
import {
  createMemoryAnswerSnapshot,
  createMemoryIntakeFormLink,
  createMemoryIntakeFormReview,
  createMemoryIntakeSession,
  createMemoryIntakeVariableProposals,
  getMemoryIntakeFormLink,
  getMemoryIntakeFormLinkByTokenHash,
  getMemoryIntakeSession,
  listMemoryAnswerSnapshots,
  listMemoryIntakeFormItemActions,
  listMemoryIntakeFormLinks,
  listMemoryIntakeFormReviews,
  listMemoryIntakeSessions,
  listMemoryIntakeVariableProposals,
  markMemoryIntakeFormLinkSubmitted,
  reserveMemoryIntakeFormLinkSubmission,
  reviewMemoryIntakeVariableProposal,
  revokeMemoryIntakeFormLink,
  saveMemoryIntakeFormLinkDraft,
  upsertMemoryIntakeFormItemAction,
  type MemoryIntakeFormsStore,
} from "./intake-forms/memory.js";
import {
  createMemoryExpenseEntry,
  createMemoryTimeEntry,
  getMemoryExpenseEntry,
  getMemoryTimeEntry,
  listMemoryExpenseEntries,
  listMemoryTimeEntries,
  updateMemoryExpenseEntry,
  updateMemoryTimeEntry,
  type MemoryBillingEntriesStore,
} from "./billing-entries/memory.js";
import {
  createMemoryInvoice,
  createMemoryPayment,
  getMemoryInvoice,
  listMemoryInvoices,
  listMemoryPayments,
  updateMemoryInvoice,
  type MemoryBillingInvoicePaymentStore,
} from "./billing-invoices-payments/memory.js";
import {
  createMemoryHostedPaymentRequest,
  getMemoryHostedPaymentRequest,
  listMemoryHostedPaymentRequests,
  updateMemoryHostedPaymentRequest,
  type MemoryHostedPaymentRequestStore,
} from "./hosted-payment-requests/memory.js";
import {
  createMemoryBillingPeriodLock,
  createMemoryBillingRateRule,
  listMemoryBillingPeriodLocks,
  listMemoryBillingRateRules,
  type MemoryBillingControlsStore,
} from "./billing-controls/memory.js";
import { createMemoryFirmSettingsRepository } from "./firm-settings/memory.js";
import {
  createMemoryTrustTransferRequest,
  getMemoryTrustTransferRequest,
  listMemoryTrustTransferRequests,
  updateMemoryTrustTransferRequest,
  type MemoryTrustTransferRequestStore,
} from "./trust-transfer-requests/memory.js";
import { createMemoryProviderSettingsRepository } from "./provider-settings/memory.js";
import {
  createMemoryPublicConsultationIntake,
  getMemoryPublicConsultationIntake,
  listMemoryPublicConsultationIntakes,
  updateMemoryPublicConsultationIntake,
  type MemoryPublicConsultationIntakeStore,
} from "./public-consultation-intakes/memory.js";
import {
  completeMemoryDocumentUpload,
  createMemoryDocumentTextExtraction,
  createMemoryDocumentUploadIntent,
  getMemoryDocument,
  getMemoryDocumentTextExtractions,
  listMemoryMatterDocuments,
  reviewMemoryUploadedDocument,
  updateMemoryDocumentScanStatus,
  type MemoryDocumentStore,
} from "./documents/memory.js";
import {
  createMemoryGeneratedDocument,
  listMemoryDocumentAssemblyPackages,
  listMemoryDocumentAssemblySetDefinitions,
  listMemoryGeneratedDocuments,
  listMemorySignatureEnvelopes,
  type MemoryDocumentAssemblyStore,
} from "./document-assembly/memory.js";
import {
  createMemoryDraft,
  createMemoryDraftAssistRecord,
  createMemoryDraftTemplate,
  deleteMemoryDraft,
  getMemoryDraft,
  getMemoryDraftAssistRecord,
  listMemoryDraftAssistRecords,
  listMemoryDrafts,
  listMemoryDraftTemplates,
  updateMemoryDraft,
  updateMemoryDraftAssistRecord,
  type MemoryDraftStore,
} from "./drafts/memory.js";
import {
  archiveMemoryTaskDeadline,
  completeMemoryTaskDeadline,
  createMemoryTaskDeadline,
  getMemoryTaskDeadline,
  listMemoryTaskDeadlines,
  reopenMemoryTaskDeadline,
  updateMemoryTaskDeadline,
  type MemoryTaskStore,
} from "./tasks/memory.js";
import {
  createMemoryConversationMessage,
  createMemoryConversationMessageNotifications,
  createMemoryConversationThread,
  getMemoryConversationThread,
  listMemoryConversationMessageNotifications,
  listMemoryConversationMessages,
  listMemoryConversationThreads,
  updateMemoryConversationMessageNotificationPosture,
  updateMemoryConversationThreadLifecycle,
  type MemoryConversationThreadStore,
} from "./conversation-threads/memory.js";
import {
  createMemorySignatureRequest,
  listMemorySignatureProviderEvents,
  listMemorySignatureRequests,
  listMemorySignatureRequestSigners,
  listMemorySignatureWebhookAttempts,
  recordMemorySignatureProviderEvent,
  recordMemorySignatureWebhookAttempt,
  type MemorySignatureStore,
} from "./signatures/memory.js";
import { createMemoryConnectorRepository, type MemoryConnectorStore } from "./connectors/memory.js";
import { createMemoryEmailJobsRepository, type MemoryEmailJobsStore } from "./jobs-email/memory.js";
import {
  createMemoryInboundEmailAddress,
  createMemoryInboundEmailAttachment,
  createMemoryInboundEmailMessage,
  getMemoryInboundEmailAddressByAddress,
  getMemoryInboundEmailMessage,
  listMemoryInboundEmailAddresses,
  listMemoryInboundEmailAttachments,
  listMemoryInboundEmailMessages,
  promoteMemoryInboundEmailAttachmentToDocument,
  updateMemoryInboundEmailMessage,
  type MemoryInboundEmailStore,
} from "./inbound-email/memory.js";
import {
  createMemoryLegalClinicProgram,
  getMemoryLegalClinicMatterProfile,
  listMemoryLegalClinicPrograms,
  upsertMemoryLegalClinicMatterProfile,
  type MemoryLegalClinicStore,
} from "./legal-clinics/memory.js";
import {
  createMemoryLegalResearchArtifact,
  getMemoryLegalResearchArtifact,
  listMemoryLegalResearchArtifacts,
  updateMemoryLegalResearchArtifact,
  type MemoryLegalResearchArtifactStore,
} from "./legal-research-artifacts/memory.js";
import {
  createMemoryLedgerAccountingReviewProfile,
  createMemoryLedgerReconciliation,
  createMemoryLedgerReconciliationExceptionResolution,
  createMemoryLedgerStatementImportBatch,
  createMemoryLedgerStatementMatchRuleProfile,
  createMemoryLedgerTransactionApproval,
  listMemoryLedgerAccountingReviewProfiles,
  listMemoryLedgerReconciliationExceptionResolutions,
  listMemoryLedgerReconciliations,
  listMemoryLedgerStatementImportBatches,
  listMemoryLedgerStatementMatchRuleProfiles,
  listMemoryLedgerTransactionApprovals,
  type MemoryLedgerReviewStore,
} from "./ledger-review/memory.js";
import {
  getMemoryLedger,
  postMemoryLedgerTransaction,
  validateMemoryLedgerTransactionScope,
  type MemoryLedgerCoreStore,
} from "./ledger-core/memory.js";
import {
  getMemoryMatterWorkspaceOverview,
  listMemoryMatterWorkspaceMattersForUser,
  type MemoryMatterWorkspaceStore,
} from "./matter-workspace/memory.js";
import {
  convertMemoryPublicConsultationIntakeToMatter,
  createMemoryMatterWithClient,
  type MemoryMatterLifecycleStore,
} from "./matter-lifecycle/memory.js";
import {
  completeMemoryFirstRunSetup,
  getMemorySetupStatus,
  resolveMemoryConfiguredFirm,
  type MemorySetupStore,
} from "./setup/memory.js";
import {
  archiveMemorySavedOperationalViewDefinition,
  createMemorySavedOperationalViewDefinition,
  getMemorySavedOperationalViewDefinition,
  listMemorySavedOperationalViewDefinitions,
  updateMemorySavedOperationalViewDefinition,
  type MemoryOperationalViewsStore,
} from "./operational-views/memory.js";
import {
  claimMemoryExternalUploadUse,
  createMemoryAccessLog,
  createMemoryExternalUploadLink,
  createMemoryPortalDocumentAccess,
  createMemoryPortalGrant,
  createMemoryShareLink,
  getMemoryExternalUploadLinkByTokenHash,
  getMemoryShareLink,
  getMemoryShareLinkByTokenHash,
  listMemoryAccessLogs,
  listMemoryExternalUploadLinks,
  listMemoryPortalDocumentAccess,
  listMemoryPortalGrants,
  listMemoryShareLinks,
  revokeMemoryPortalDocumentAccess,
  revokeMemoryExternalUploadLink,
  revokeMemoryShareLink,
  updateMemoryPortalGrant,
  type MemoryPortalAccessStore,
} from "./portal-access/memory.js";

export class InMemoryOpenPracticeRepository implements OpenPracticeRepository {
  declare getUser: AuthRepository["getUser"];
  declare createUser: AuthRepository["createUser"];
  declare getUserByEmail: AuthRepository["getUserByEmail"];
  declare getAuthAccount: AuthRepository["getAuthAccount"];
  declare setAuthPassword: AuthRepository["setAuthPassword"];
  declare createAuthSession: AuthRepository["createAuthSession"];
  declare getAuthSessionByTokenHash: AuthRepository["getAuthSessionByTokenHash"];
  declare touchAuthSession: AuthRepository["touchAuthSession"];
  declare markAuthSessionFresh: AuthRepository["markAuthSessionFresh"];
  declare revokeAuthSession: AuthRepository["revokeAuthSession"];
  declare createPasswordSetupToken: AuthRepository["createPasswordSetupToken"];
  declare consumePasswordSetupToken: AuthRepository["consumePasswordSetupToken"];
  declare createWebAuthnChallenge: AuthRepository["createWebAuthnChallenge"];
  declare getWebAuthnChallenge: AuthRepository["getWebAuthnChallenge"];
  declare consumeWebAuthnChallenge: AuthRepository["consumeWebAuthnChallenge"];
  declare registerWebAuthnCredential: AuthRepository["registerWebAuthnCredential"];
  declare listWebAuthnCredentials: AuthRepository["listWebAuthnCredentials"];
  declare getWebAuthnCredential: AuthRepository["getWebAuthnCredential"];
  declare getWebAuthnCredentialForFirm: AuthRepository["getWebAuthnCredentialForFirm"];
  declare updateWebAuthnCredentialCounter: AuthRepository["updateWebAuthnCredentialCounter"];
  declare deleteWebAuthnCredential: AuthRepository["deleteWebAuthnCredential"];
  declare updateUserMfaStatus: AuthRepository["updateUserMfaStatus"];
  declare createRecoveryCodes: AuthRepository["createRecoveryCodes"];
  declare useRecoveryCode: AuthRepository["useRecoveryCode"];
  declare listRecoveryCodes: AuthRepository["listRecoveryCodes"];
  declare createConnector: ConnectorRepository["createConnector"];
  declare updateConnector: ConnectorRepository["updateConnector"];
  declare listConnectors: ConnectorRepository["listConnectors"];
  declare getConnector: ConnectorRepository["getConnector"];
  declare createConnectorOutbox: ConnectorRepository["createConnectorOutbox"];
  declare listConnectorOutbox: ConnectorRepository["listConnectorOutbox"];
  declare getConnectorOutbox: ConnectorRepository["getConnectorOutbox"];
  declare retryConnectorOutbox: ConnectorRepository["retryConnectorOutbox"];
  declare deadLetterConnectorOutbox: ConnectorRepository["deadLetterConnectorOutbox"];
  declare createConnectorDeliveryAttempt: ConnectorRepository["createConnectorDeliveryAttempt"];
  declare leaseConnectorOutbox: ConnectorRepository["leaseConnectorOutbox"];
  declare recordConnectorDeliveryResult: ConnectorRepository["recordConnectorDeliveryResult"];
  declare listConnectorDeliveryAttempts: ConnectorRepository["listConnectorDeliveryAttempts"];
  declare createIntegrationDeveloperApp: ConnectorRepository["createIntegrationDeveloperApp"];
  declare updateIntegrationDeveloperApp: ConnectorRepository["updateIntegrationDeveloperApp"];
  declare listIntegrationDeveloperApps: ConnectorRepository["listIntegrationDeveloperApps"];
  declare getIntegrationDeveloperApp: ConnectorRepository["getIntegrationDeveloperApp"];
  declare createIntegrationApiCredential: ConnectorRepository["createIntegrationApiCredential"];
  declare listIntegrationApiCredentials: ConnectorRepository["listIntegrationApiCredentials"];
  declare getIntegrationApiCredential: ConnectorRepository["getIntegrationApiCredential"];
  declare revokeIntegrationApiCredential: ConnectorRepository["revokeIntegrationApiCredential"];
  declare createIntegrationWebhookSubscription: ConnectorRepository["createIntegrationWebhookSubscription"];
  declare listIntegrationWebhookSubscriptions: ConnectorRepository["listIntegrationWebhookSubscriptions"];
  declare createJobLifecycleRecord: EmailJobsRepository["createJobLifecycleRecord"];
  declare createQueuedEmailOutbox: EmailJobsRepository["createQueuedEmailOutbox"];
  declare getEmailOutbox: EmailJobsRepository["getEmailOutbox"];
  declare listEmailOutbox: EmailJobsRepository["listEmailOutbox"];
  declare getEmailOutboxByReceiptTokenHash: EmailJobsRepository["getEmailOutboxByReceiptTokenHash"];
  declare recordEmailDeliveryReceipt: EmailJobsRepository["recordEmailDeliveryReceipt"];
  declare recordEmailDeliveryResult: EmailJobsRepository["recordEmailDeliveryResult"];
  declare retryEmailOutbox: EmailJobsRepository["retryEmailOutbox"];
  declare reconcileCalendarReminderDelivery: EmailJobsRepository["reconcileCalendarReminderDelivery"];
  declare listEmailEvents: EmailJobsRepository["listEmailEvents"];
  declare createEmailReceiptToken: EmailJobsRepository["createEmailReceiptToken"];
  declare getEmailReceiptTokenByHash: EmailJobsRepository["getEmailReceiptTokenByHash"];
  declare recordEmailReceiptToken: EmailJobsRepository["recordEmailReceiptToken"];
  declare listEmailReceiptTokens: EmailJobsRepository["listEmailReceiptTokens"];
  declare updateJobLifecycleRecord: EmailJobsRepository["updateJobLifecycleRecord"];
  declare listJobLifecycleRecords: EmailJobsRepository["listJobLifecycleRecords"];
  declare getFirmSettings: FirmSettingsRepository["getFirmSettings"];
  declare listProviderSettings: ProviderSettingsRepository["listProviderSettings"];
  declare upsertProviderSetting: ProviderSettingsRepository["upsertProviderSetting"];

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
  private portalDocumentAccess: PortalDocumentAccess[] = [];
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
  private ledgerStatementMatchRuleProfiles: LedgerStatementMatchRuleProfileRecord[] = [];
  private ledgerAccountingReviewProfiles: LedgerAccountingReviewProfileRecord[] = [];
  private ledgerReconciliationExceptionResolutions: LedgerReconciliationExceptionResolutionRecord[] =
    [];
  private intakeTemplates: IntakeTemplateRecord[];
  private intakeTemplateVersions: IntakeTemplateVersionRecord[];
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
  private legalResearchArtifacts: LegalResearchArtifactRecord[] = [];
  private draftTemplates: DraftTemplateRecord[] = [];
  private inboundEmailAddresses: InboundEmailAddressRecord[] = [];
  private inboundEmailMessages: InboundEmailMessageRecord[] = [];
  private inboundEmailAttachments: InboundEmailAttachmentRecord[] = [];
  private shareLinks: ShareLinkRecord[] = [];
  private accessLogs: AccessLogRecord[] = [];

  private get setupStore(): MemorySetupStore {
    const repository = this;
    return {
      get firms() {
        return repository.firms;
      },
      set firms(value: Firm[]) {
        repository.firms = value;
      },
      get users() {
        return repository.users;
      },
      set users(value: User[]) {
        repository.users = value;
      },
      get firmSettings() {
        return repository.firmSettings;
      },
      set firmSettings(value: FirmSettings[]) {
        repository.firmSettings = value;
      },
      get authAccounts() {
        return repository.authAccounts;
      },
      set authAccounts(value: AuthAccountRecord[]) {
        repository.authAccounts = value;
      },
      get contacts() {
        return repository.contacts;
      },
      set contacts(value: Contact[]) {
        repository.contacts = value;
      },
      get matters() {
        return repository.matters;
      },
      set matters(value: Matter[]) {
        repository.matters = value;
      },
      get matterParties() {
        return repository.matterParties;
      },
      set matterParties(value: MatterParty[]) {
        repository.matterParties = value;
      },
      get webAuthnCredentials() {
        return repository.webAuthnCredentials;
      },
      set webAuthnCredentials(value: WebAuthnCredentialRecord[]) {
        repository.webAuthnCredentials = value;
      },
      get draftTemplates() {
        return repository.draftTemplates;
      },
      set draftTemplates(value: DraftTemplateRecord[]) {
        repository.draftTemplates = value;
      },
      get intakeTemplates() {
        return repository.intakeTemplates;
      },
      set intakeTemplates(value: IntakeTemplateRecord[]) {
        repository.intakeTemplates = value;
      },
      get intakeTemplateVersions() {
        return repository.intakeTemplateVersions;
      },
      set intakeTemplateVersions(value: IntakeTemplateVersionRecord[]) {
        repository.intakeTemplateVersions = value;
      },
      get auditEvents() {
        return repository.auditEvents;
      },
      set auditEvents(value: AuditEvent[]) {
        repository.auditEvents = value;
      },
      get providerSettings() {
        return repository.providerSettings;
      },
      providerConfigCipher: repository.options.providerConfigCipher,
    };
  }

  private get billingControlsStore(): MemoryBillingControlsStore {
    const repository = this;
    return {
      get billingPeriodLocks() {
        return repository.billingPeriodLocks;
      },
      set billingPeriodLocks(value: BillingPeriodLockRecord[]) {
        repository.billingPeriodLocks = value;
      },
      get billingRateRules() {
        return repository.billingRateRules;
      },
      set billingRateRules(value: BillingRateRuleRecord[]) {
        repository.billingRateRules = value;
      },
    };
  }

  private get billingEntriesStore(): MemoryBillingEntriesStore {
    const repository = this;
    return {
      get timeEntries() {
        return repository.timeEntries;
      },
      set timeEntries(value: TimeEntry[]) {
        repository.timeEntries = value;
      },
      get expenseEntries() {
        return repository.expenseEntries;
      },
      set expenseEntries(value: ExpenseEntry[]) {
        repository.expenseEntries = value;
      },
    };
  }

  private get billingInvoicePaymentStore(): MemoryBillingInvoicePaymentStore {
    const repository = this;
    return {
      get invoices() {
        return repository.invoices;
      },
      set invoices(value: InvoiceRecord[]) {
        repository.invoices = value;
      },
      get invoiceLines() {
        return repository.invoiceLines;
      },
      set invoiceLines(value: InvoiceLineRecord[]) {
        repository.invoiceLines = value;
      },
      get manualPayments() {
        return repository.manualPayments;
      },
      set manualPayments(value: ManualPaymentRecord[]) {
        repository.manualPayments = value;
      },
      get paymentAllocations() {
        return repository.paymentAllocations;
      },
      set paymentAllocations(value: PaymentAllocationRecord[]) {
        repository.paymentAllocations = value;
      },
    };
  }

  private get ledgerCoreStore(): MemoryLedgerCoreStore {
    const repository = this;
    return {
      get matters() {
        return repository.matters;
      },
      get contacts() {
        return repository.contacts;
      },
      get matterParties() {
        return repository.matterParties;
      },
      get ledgerAccounts() {
        return repository.ledgerAccounts;
      },
      get postedTransactions() {
        return repository.postedTransactions;
      },
      set postedTransactions(value: PostedLedgerTransaction[]) {
        repository.postedTransactions = value;
      },
    };
  }

  private get matterWorkspaceStore(): MemoryMatterWorkspaceStore {
    return {
      firms: this.firms,
      users: this.users,
      matters: this.matters,
      matterParties: this.matterParties,
      contacts: this.contacts,
      documents: this.documents,
      timeEntries: this.timeEntries,
      expenseEntries: this.expenseEntries,
      portalGrants: this.portalGrants,
      portalDocumentAccess: this.portalDocumentAccess,
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
      invoices: this.invoices,
      invoiceLines: this.invoiceLines,
      manualPayments: this.manualPayments,
      paymentAllocations: this.paymentAllocations,
      trustTransferRequests: this.trustTransferRequests,
      ledgerAccounts: this.ledgerAccounts,
      postedTransactions: this.postedTransactions,
    };
  }

  private get matterLifecycleStore(): MemoryMatterLifecycleStore {
    const repository = this;
    return {
      get users() {
        return repository.users;
      },
      set users(value: User[]) {
        repository.users = value;
      },
      get contacts() {
        return repository.contacts;
      },
      set contacts(value: Contact[]) {
        repository.contacts = value;
      },
      get matters() {
        return repository.matters;
      },
      set matters(value: Matter[]) {
        repository.matters = value;
      },
      get matterParties() {
        return repository.matterParties;
      },
      set matterParties(value: MatterParty[]) {
        repository.matterParties = value;
      },
      get publicConsultationIntakes() {
        return repository.publicConsultationIntakes;
      },
      set publicConsultationIntakes(value: PublicConsultationIntakeRecord[]) {
        repository.publicConsultationIntakes = value;
      },
    };
  }

  private get hostedPaymentRequestStore(): MemoryHostedPaymentRequestStore {
    const repository = this;
    return {
      get hostedPaymentRequests() {
        return repository.hostedPaymentRequests;
      },
      set hostedPaymentRequests(value: HostedPaymentRequestRecord[]) {
        repository.hostedPaymentRequests = value;
      },
    };
  }

  private get trustTransferRequestStore(): MemoryTrustTransferRequestStore {
    const repository = this;
    return {
      get trustTransferRequests() {
        return repository.trustTransferRequests;
      },
      set trustTransferRequests(value: TrustTransferRequestRecord[]) {
        repository.trustTransferRequests = value;
      },
    };
  }

  private get ledgerReviewStore(): MemoryLedgerReviewStore {
    const repository = this;
    return {
      users: this.users,
      ledgerAccounts: this.ledgerAccounts,
      postedTransactions: this.postedTransactions,
      get ledgerApprovals() {
        return repository.ledgerApprovals;
      },
      set ledgerApprovals(value: LedgerTransactionApprovalRecord[]) {
        repository.ledgerApprovals = value;
      },
      get ledgerReconciliations() {
        return repository.ledgerReconciliations;
      },
      set ledgerReconciliations(value: LedgerReconciliationRecord[]) {
        repository.ledgerReconciliations = value;
      },
      get ledgerStatementImportBatches() {
        return repository.ledgerStatementImportBatches;
      },
      set ledgerStatementImportBatches(value: LedgerStatementImportBatchRecord[]) {
        repository.ledgerStatementImportBatches = value;
      },
      get ledgerStatementMatchRuleProfiles() {
        return repository.ledgerStatementMatchRuleProfiles;
      },
      set ledgerStatementMatchRuleProfiles(value: LedgerStatementMatchRuleProfileRecord[]) {
        repository.ledgerStatementMatchRuleProfiles = value;
      },
      get ledgerAccountingReviewProfiles() {
        return repository.ledgerAccountingReviewProfiles;
      },
      set ledgerAccountingReviewProfiles(value: LedgerAccountingReviewProfileRecord[]) {
        repository.ledgerAccountingReviewProfiles = value;
      },
      get ledgerReconciliationExceptionResolutions() {
        return repository.ledgerReconciliationExceptionResolutions;
      },
      set ledgerReconciliationExceptionResolutions(
        value: LedgerReconciliationExceptionResolutionRecord[],
      ) {
        repository.ledgerReconciliationExceptionResolutions = value;
      },
    };
  }

  private get publicConsultationIntakeStore(): MemoryPublicConsultationIntakeStore {
    const repository = this;
    return {
      get publicConsultationIntakes() {
        return repository.publicConsultationIntakes;
      },
      set publicConsultationIntakes(value: PublicConsultationIntakeRecord[]) {
        repository.publicConsultationIntakes = value;
      },
    };
  }

  private get authStore(): MemoryAuthStore {
    const repository = this;
    return {
      get users() {
        return repository.users;
      },
      set users(value: User[]) {
        repository.users = value;
      },
      get authAccounts() {
        return repository.authAccounts;
      },
      set authAccounts(value: AuthAccountRecord[]) {
        repository.authAccounts = value;
      },
      get authSessions() {
        return repository.authSessions;
      },
      set authSessions(value: AuthSessionRecord[]) {
        repository.authSessions = value;
      },
      get passwordSetupTokens() {
        return repository.passwordSetupTokens;
      },
      set passwordSetupTokens(value: AuthPasswordSetupTokenRecord[]) {
        repository.passwordSetupTokens = value;
      },
      get authChallenges() {
        return repository.authChallenges;
      },
      set authChallenges(value: WebAuthnChallengeRecord[]) {
        repository.authChallenges = value;
      },
      get webAuthnCredentials() {
        return repository.webAuthnCredentials;
      },
      set webAuthnCredentials(value: WebAuthnCredentialRecord[]) {
        repository.webAuthnCredentials = value;
      },
      get recoveryCodes() {
        return repository.recoveryCodes;
      },
      set recoveryCodes(value: RecoveryCodeRecord[]) {
        repository.recoveryCodes = value;
      },
    };
  }

  private get auditStore(): MemoryAuditStore {
    const repository = this;
    return {
      get auditEvents() {
        return repository.auditEvents;
      },
      set auditEvents(value: AuditEvent[]) {
        repository.auditEvents = value;
      },
    };
  }

  private get conflictCheckStore(): MemoryConflictCheckStore {
    const repository = this;
    return {
      contacts: this.contacts,
      matters: this.matters,
      matterParties: this.matterParties,
      contactRelationships: this.contactRelationships,
      get conflictChecks() {
        return repository.conflictChecks;
      },
      set conflictChecks(value: ConflictCheckRecord[]) {
        repository.conflictChecks = value;
      },
      get auditEvents() {
        return repository.auditEvents;
      },
      set auditEvents(value: AuditEvent[]) {
        repository.auditEvents = value;
      },
    };
  }

  private get contactStore(): MemoryContactStore {
    const repository = this;
    return {
      get contacts() {
        return repository.contacts;
      },
      set contacts(value: Contact[]) {
        repository.contacts = value;
      },
      get matters() {
        return repository.matters;
      },
      set matters(value: Matter[]) {
        repository.matters = value;
      },
      get matterParties() {
        return repository.matterParties;
      },
      set matterParties(value: MatterParty[]) {
        repository.matterParties = value;
      },
      get portalGrants() {
        return repository.portalGrants;
      },
      set portalGrants(value: PortalGrant[]) {
        repository.portalGrants = value;
      },
      get intakeVariableProposals() {
        return repository.intakeVariableProposals;
      },
      set intakeVariableProposals(value: IntakeVariableProposal[]) {
        repository.intakeVariableProposals = value;
      },
      get conflictChecks() {
        return repository.conflictChecks;
      },
      set conflictChecks(value: ConflictCheckRecord[]) {
        repository.conflictChecks = value;
      },
      get contactRelationships() {
        return repository.contactRelationships;
      },
      set contactRelationships(value: ContactRelationshipRecord[]) {
        repository.contactRelationships = value;
      },
      get contactDataQualityResolutions() {
        return repository.contactDataQualityResolutions;
      },
      set contactDataQualityResolutions(value: ContactDataQualityResolutionRecord[]) {
        repository.contactDataQualityResolutions = value;
      },
    };
  }

  private get intakeTemplateStore(): MemoryIntakeTemplateStore {
    const repository = this;
    return {
      get intakeTemplates() {
        return repository.intakeTemplates;
      },
      set intakeTemplates(value: IntakeTemplateRecord[]) {
        repository.intakeTemplates = value;
      },
      get intakeTemplateVersions() {
        return repository.intakeTemplateVersions;
      },
      set intakeTemplateVersions(value: IntakeTemplateVersionRecord[]) {
        repository.intakeTemplateVersions = value;
      },
    };
  }

  private get intakeFormsStore(): MemoryIntakeFormsStore {
    const repository = this;
    return {
      contacts: this.contacts,
      matters: this.matters,
      get intakeSessions() {
        return repository.intakeSessions;
      },
      set intakeSessions(value: IntakeSessionRecord[]) {
        repository.intakeSessions = value;
      },
      get answerSnapshots() {
        return repository.answerSnapshots;
      },
      set answerSnapshots(value: AnswerSnapshotRecord[]) {
        repository.answerSnapshots = value;
      },
      get intakeFormLinks() {
        return repository.intakeFormLinks;
      },
      set intakeFormLinks(value: IntakeFormLinkRecord[]) {
        repository.intakeFormLinks = value;
      },
      get intakeFormReviews() {
        return repository.intakeFormReviews;
      },
      set intakeFormReviews(value: IntakeFormReviewRecord[]) {
        repository.intakeFormReviews = value;
      },
      get intakeFormItemActions() {
        return repository.intakeFormItemActions;
      },
      set intakeFormItemActions(value: IntakeFormItemActionRecord[]) {
        repository.intakeFormItemActions = value;
      },
      get intakeVariableProposals() {
        return repository.intakeVariableProposals;
      },
      set intakeVariableProposals(value: IntakeVariableProposal[]) {
        repository.intakeVariableProposals = value;
      },
    };
  }

  private get calendarEventStore(): MemoryCalendarEventStore {
    const repository = this;
    return {
      get calendarEvents() {
        return repository.calendarEvents;
      },
      set calendarEvents(value: CalendarEventRecord[]) {
        repository.calendarEvents = value;
      },
      get calendarSchedulingRequests() {
        return repository.calendarSchedulingRequests;
      },
      set calendarSchedulingRequests(value: CalendarSchedulingRequestRecord[]) {
        repository.calendarSchedulingRequests = value;
      },
      get calendarMeetingSessions() {
        return repository.calendarMeetingSessions;
      },
      set calendarMeetingSessions(value: CalendarMeetingSessionRecord[]) {
        repository.calendarMeetingSessions = value;
      },
      get calendarGuestLinks() {
        return repository.calendarGuestLinks;
      },
      set calendarGuestLinks(value: CalendarGuestLinkRecord[]) {
        repository.calendarGuestLinks = value;
      },
    };
  }

  private get calendarCredentialStore(): MemoryCalendarCredentialStore {
    return {
      calendarCredentials: this.calendarCredentials,
    };
  }

  private get connectorStore(): MemoryConnectorStore {
    return {
      connectors: this.connectors,
      connectorOutbox: this.connectorOutbox,
      connectorDeliveryAttempts: this.connectorDeliveryAttempts,
      integrationDeveloperApps: this.integrationDeveloperApps,
      integrationApiCredentials: this.integrationApiCredentials,
      integrationWebhookSubscriptions: this.integrationWebhookSubscriptions,
    };
  }

  private get emailJobsStore(): MemoryEmailJobsStore {
    return {
      jobLifecycleRecords: this.jobLifecycleRecords,
      emailOutbox: this.emailOutbox,
      emailEvents: this.emailEvents,
      emailReceiptTokens: this.emailReceiptTokens,
    };
  }

  private get inboundEmailStore(): MemoryInboundEmailStore {
    return {
      inboundEmailAddresses: this.inboundEmailAddresses,
      inboundEmailMessages: this.inboundEmailMessages,
      inboundEmailAttachments: this.inboundEmailAttachments,
      documents: this.documents,
    };
  }

  private get documentStore(): MemoryDocumentStore {
    return {
      documents: this.documents,
      documentTextExtractions: this.documentTextExtractions,
    };
  }

  private get documentAssemblyStore(): MemoryDocumentAssemblyStore {
    const repository = this;
    return {
      get generatedDocuments() {
        return repository.generatedDocuments;
      },
      set generatedDocuments(value: GeneratedDocumentRecord[]) {
        repository.generatedDocuments = value;
      },
      documentAssemblySetDefinitions: this.documentAssemblySetDefinitions,
      documentAssemblyPackages: this.documentAssemblyPackages,
      signatureEnvelopes: this.signatureEnvelopes,
    };
  }

  private get draftStore(): MemoryDraftStore {
    const repository = this;
    return {
      get drafts() {
        return repository.drafts;
      },
      set drafts(value: DraftRecord[]) {
        repository.drafts = value;
      },
      get draftAssistRecords() {
        return repository.draftAssistRecords;
      },
      set draftAssistRecords(value: DraftAssistRecord[]) {
        repository.draftAssistRecords = value;
      },
      get draftTemplates() {
        return repository.draftTemplates;
      },
      set draftTemplates(value: DraftTemplateRecord[]) {
        repository.draftTemplates = value;
      },
    };
  }

  private get aiOperationalProposalStore(): MemoryAiOperationalProposalStore {
    return {
      aiOperationalProposals: this.aiOperationalProposals,
    };
  }

  private get legalResearchArtifactStore(): MemoryLegalResearchArtifactStore {
    return {
      legalResearchArtifacts: this.legalResearchArtifacts,
    };
  }

  private get taskStore(): MemoryTaskStore {
    return {
      taskDeadlines: this.taskDeadlines,
    };
  }

  private get conversationThreadStore(): MemoryConversationThreadStore {
    return {
      conversationThreads: this.conversationThreads,
      conversationMessages: this.conversationMessages,
      conversationMessageNotifications: this.conversationMessageNotifications,
      users: this.users,
    };
  }

  private get signatureStore(): MemorySignatureStore {
    const repository = this;
    return {
      get signatureRequests() {
        return repository.signatureRequests;
      },
      set signatureRequests(value: SignatureRequestRecord[]) {
        repository.signatureRequests = value;
      },
      get signatureRequestSigners() {
        return repository.signatureRequestSigners;
      },
      set signatureRequestSigners(value: SignatureRequestSignerRecord[]) {
        repository.signatureRequestSigners = value;
      },
      get signatureProviderEvents() {
        return repository.signatureProviderEvents;
      },
      set signatureProviderEvents(value: SignatureProviderEventRecord[]) {
        repository.signatureProviderEvents = value;
      },
      get signatureWebhookAttempts() {
        return repository.signatureWebhookAttempts;
      },
      set signatureWebhookAttempts(value: SignatureWebhookAttemptRecord[]) {
        repository.signatureWebhookAttempts = value;
      },
    };
  }

  private get legalClinicStore(): MemoryLegalClinicStore {
    return {
      legalClinicPrograms: this.legalClinicPrograms,
      legalClinicMatterProfiles: this.legalClinicMatterProfiles,
    };
  }

  private get operationalViewsStore(): MemoryOperationalViewsStore {
    return {
      savedOperationalViewDefinitions: this.savedOperationalViewDefinitions,
    };
  }

  private get portalAccessStore(): MemoryPortalAccessStore {
    return {
      portalGrants: this.portalGrants,
      portalDocumentAccess: this.portalDocumentAccess,
      shareLinks: this.shareLinks,
      externalUploadLinks: this.externalUploadLinks,
      accessLogs: this.accessLogs,
      matters: this.matters,
      users: this.users,
    };
  }

  constructor(
    private readonly options: {
      seedSampleData?: boolean;
      firms?: Firm[];
      users?: User[];
      providerConfigCipher?: ProviderConfigCipher;
    } = {},
  ) {
    const seeded = options.seedSampleData ?? true;
    this.firms = options.firms
      ? clone(options.firms)
      : seeded
        ? [clone(sampleFirm), clone(sampleMatterlessFirm)]
        : [];
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
    this.portalDocumentAccess = [];
    this.timeEntries = seeded ? clone(sampleTimeEntries) : [];
    this.expenseEntries = seeded ? clone(sampleExpenseEntries) : [];
    this.invoices = seeded ? clone(sampleInvoices) : [];
    this.invoiceLines = seeded ? clone(sampleInvoiceLines) : [];
    this.manualPayments = seeded ? clone(sampleManualPayments) : [];
    this.paymentAllocations = seeded ? clone(samplePaymentAllocations) : [];
    this.hostedPaymentRequests = seeded ? clone(sampleHostedPaymentRequests) : [];
    this.trustTransferRequests = seeded ? clone(sampleTrustTransferRequests) : [];
    this.ledgerAccounts = seeded ? clone(sampleLedgerAccounts) : [];
    this.ledgerStatementMatchRuleProfiles = seeded
      ? clone(sampleLedgerStatementMatchRuleProfiles)
      : [];
    this.ledgerAccountingReviewProfiles = seeded ? clone(sampleLedgerAccountingReviewProfiles) : [];
    this.intakeTemplates = seeded ? clone(sampleIntakeTemplates) : [];
    this.intakeTemplateVersions = seeded ? clone(sampleIntakeTemplateVersions) : [];
    this.draftTemplates = seeded ? clone(sampleDraftTemplates) : [];
    this.aiOperationalProposals = seeded ? clone(sampleAiOperationalProposals) : [];
    this.legalResearchArtifacts = seeded ? clone(sampleLegalResearchArtifacts) : [];
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
    Object.assign(this, createMemoryAuthRepository(this.authStore));
    Object.assign(this, createMemoryConnectorRepository(this.connectorStore));
    Object.assign(this, createMemoryEmailJobsRepository(this.emailJobsStore));
    Object.assign(
      this,
      createMemoryFirmSettingsRepository(() => this.firmSettings),
    );
    Object.assign(
      this,
      createMemoryProviderSettingsRepository(
        this.providerSettings,
        this.options.providerConfigCipher,
      ),
    );
  }

  async getSetupStatus(): ReturnType<OpenPracticeRepository["getSetupStatus"]> {
    return Promise.resolve(getMemorySetupStatus(this.setupStore));
  }

  async resolveConfiguredFirm(): ReturnType<OpenPracticeRepository["resolveConfiguredFirm"]> {
    return Promise.resolve(resolveMemoryConfiguredFirm(this.setupStore));
  }

  async completeFirstRunSetup(
    input: Parameters<OpenPracticeRepository["completeFirstRunSetup"]>[0],
  ): ReturnType<OpenPracticeRepository["completeFirstRunSetup"]> {
    return Promise.resolve(completeMemoryFirstRunSetup(this.setupStore, input));
  }

  async getOverview(firmId: string): ReturnType<OpenPracticeRepository["getOverview"]> {
    return getMemoryMatterWorkspaceOverview(this.matterWorkspaceStore, firmId, {
      getLedger: (firmId) => this.getLedger(firmId),
    });
  }

  async listMattersForUser(user: User): ReturnType<OpenPracticeRepository["listMattersForUser"]> {
    return listMemoryMatterWorkspaceMattersForUser(this.matterWorkspaceStore, user);
  }

  async createMatterWithClient(
    input: Parameters<OpenPracticeRepository["createMatterWithClient"]>[0],
  ): ReturnType<OpenPracticeRepository["createMatterWithClient"]> {
    return createMemoryMatterWithClient(this.matterLifecycleStore, input, {
      appendAuditEvent: (event) => this.appendAuditEvent(event),
      listMattersForUser: (user) => this.listMattersForUser(user),
    });
  }

  async listPublicConsultationIntakes(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPublicConsultationIntakes"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listPublicConsultationIntakes"]> {
    return Promise.resolve(
      listMemoryPublicConsultationIntakes(this.publicConsultationIntakeStore, firmId, options),
    );
  }

  async getPublicConsultationIntake(
    firmId: string,
    intakeId: string,
  ): ReturnType<OpenPracticeRepository["getPublicConsultationIntake"]> {
    return Promise.resolve(
      getMemoryPublicConsultationIntake(this.publicConsultationIntakeStore, firmId, intakeId),
    );
  }

  async createPublicConsultationIntake(
    record: Parameters<OpenPracticeRepository["createPublicConsultationIntake"]>[0],
  ): ReturnType<OpenPracticeRepository["createPublicConsultationIntake"]> {
    return Promise.resolve(
      createMemoryPublicConsultationIntake(this.publicConsultationIntakeStore, record),
    );
  }

  async updatePublicConsultationIntake(
    firmId: string,
    intakeId: string,
    updates: Parameters<OpenPracticeRepository["updatePublicConsultationIntake"]>[2],
  ): ReturnType<OpenPracticeRepository["updatePublicConsultationIntake"]> {
    return Promise.resolve(
      updateMemoryPublicConsultationIntake(
        this.publicConsultationIntakeStore,
        firmId,
        intakeId,
        updates,
      ),
    );
  }

  async convertPublicConsultationIntakeToMatter(
    input: Parameters<OpenPracticeRepository["convertPublicConsultationIntakeToMatter"]>[0],
  ): ReturnType<OpenPracticeRepository["convertPublicConsultationIntakeToMatter"]> {
    return convertMemoryPublicConsultationIntakeToMatter(this.matterLifecycleStore, input, {
      appendAuditEvent: (event) => this.appendAuditEvent(event),
      listMattersForUser: (user) => this.listMattersForUser(user),
    });
  }

  async listContactDossiersForUser(
    user: User,
  ): ReturnType<OpenPracticeRepository["listContactDossiersForUser"]> {
    return listMemoryContactDossiersForUser(this.contactStore, user, {
      listMattersForUser: (candidate) => this.listMattersForUser(candidate),
      listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
      listCalendarSchedulingRequests: (firmId, options) =>
        this.listCalendarSchedulingRequests(firmId, options),
    });
  }

  async listContactsForUser(
    user: User,
    options: Parameters<OpenPracticeRepository["listContactsForUser"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listContactsForUser"]> {
    return listMemoryContactsForUser(
      this.contactStore,
      user,
      {
        listMattersForUser: (candidate) => this.listMattersForUser(candidate),
        listTaskDeadlines: (firmId, taskOptions) => this.listTaskDeadlines(firmId, taskOptions),
        listCalendarSchedulingRequests: (firmId, schedulingOptions) =>
          this.listCalendarSchedulingRequests(firmId, schedulingOptions),
      },
      options,
    );
  }

  async createContact(
    contact: Parameters<OpenPracticeRepository["createContact"]>[0],
  ): ReturnType<OpenPracticeRepository["createContact"]> {
    return Promise.resolve(createMemoryContact(this.contactStore, contact));
  }

  async updateContact(
    input: Parameters<OpenPracticeRepository["updateContact"]>[0],
  ): ReturnType<OpenPracticeRepository["updateContact"]> {
    return Promise.resolve(updateMemoryContact(this.contactStore, input));
  }

  async createContactRelationship(
    relationship: Parameters<OpenPracticeRepository["createContactRelationship"]>[0],
  ): ReturnType<OpenPracticeRepository["createContactRelationship"]> {
    return createMemoryContactRelationship(this.contactStore, relationship);
  }

  async updateContactRelationship(
    input: Parameters<OpenPracticeRepository["updateContactRelationship"]>[0],
  ): ReturnType<OpenPracticeRepository["updateContactRelationship"]> {
    return updateMemoryContactRelationship(this.contactStore, input);
  }

  async createMatterContactAssociation(
    party: Parameters<OpenPracticeRepository["createMatterContactAssociation"]>[0],
  ): ReturnType<OpenPracticeRepository["createMatterContactAssociation"]> {
    return createMemoryMatterContactAssociation(this.contactStore, party);
  }

  async updateMatterContactAssociation(
    input: Parameters<OpenPracticeRepository["updateMatterContactAssociation"]>[0],
  ): ReturnType<OpenPracticeRepository["updateMatterContactAssociation"]> {
    return updateMemoryMatterContactAssociation(this.contactStore, input);
  }

  async getContact(
    firmId: string,
    contactId: string,
  ): ReturnType<OpenPracticeRepository["getContact"]> {
    return getMemoryContact(this.contactStore, firmId, contactId);
  }

  async listContactPortalGrantsForUser(
    user: User,
    contactId: string,
  ): ReturnType<OpenPracticeRepository["listContactPortalGrantsForUser"]> {
    return listMemoryContactPortalGrantsForUser(this.contactStore, user, contactId, {
      listMattersForUser: (candidate) => this.listMattersForUser(candidate),
      listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
      listCalendarSchedulingRequests: (firmId, options) =>
        this.listCalendarSchedulingRequests(firmId, options),
    });
  }

  async listContactTimelineForUser(
    user: User,
    contactId: string,
  ): ReturnType<OpenPracticeRepository["listContactTimelineForUser"]> {
    return listMemoryContactTimelineForUser(this.contactStore, user, contactId, {
      listMattersForUser: (candidate) => this.listMattersForUser(candidate),
      listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
      listCalendarSchedulingRequests: (firmId, options) =>
        this.listCalendarSchedulingRequests(firmId, options),
    });
  }

  async createContactDataQualityResolution(
    resolution: Parameters<OpenPracticeRepository["createContactDataQualityResolution"]>[0],
  ): ReturnType<OpenPracticeRepository["createContactDataQualityResolution"]> {
    return createMemoryContactDataQualityResolution(this.contactStore, resolution);
  }

  async listContactDataQualityResolutions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listContactDataQualityResolutions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listContactDataQualityResolutions"]> {
    return listMemoryContactDataQualityResolutions(this.contactStore, firmId, options);
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    return getMemoryDocument(this.documentStore, firmId, documentId);
  }

  async listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]> {
    return listMemoryMatterDocuments(this.documentStore, firmId, matterId);
  }

  async listTaskDeadlines(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTaskDeadlines"]>[1] = {},
  ): Promise<TaskDeadlineRecord[]> {
    return listMemoryTaskDeadlines(this.taskStore, firmId, options);
  }

  async getTaskDeadline(
    firmId: string,
    taskId: string,
    options: Parameters<OpenPracticeRepository["getTaskDeadline"]>[2] = {},
  ): Promise<TaskDeadlineRecord | undefined> {
    return getMemoryTaskDeadline(this.taskStore, firmId, taskId, options);
  }

  async createTaskDeadline(
    task: Parameters<OpenPracticeRepository["createTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord> {
    return createMemoryTaskDeadline(this.taskStore, task);
  }

  async updateTaskDeadline(
    input: Parameters<OpenPracticeRepository["updateTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return updateMemoryTaskDeadline(this.taskStore, input);
  }

  async completeTaskDeadline(
    input: Parameters<OpenPracticeRepository["completeTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return completeMemoryTaskDeadline(this.taskStore, input);
  }

  async reopenTaskDeadline(
    input: Parameters<OpenPracticeRepository["reopenTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return reopenMemoryTaskDeadline(this.taskStore, input);
  }

  async archiveTaskDeadline(
    input: Parameters<OpenPracticeRepository["archiveTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return archiveMemoryTaskDeadline(this.taskStore, input);
  }

  async listConversationThreads(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string } = {},
  ): Promise<ConversationThreadRecord[]> {
    return listMemoryConversationThreads(this.conversationThreadStore, firmId, options);
  }

  async getConversationThread(
    firmId: string,
    threadId: string,
  ): Promise<ConversationThreadRecord | undefined> {
    return getMemoryConversationThread(this.conversationThreadStore, firmId, threadId);
  }

  async createConversationThread(
    thread: ConversationThreadRecord,
  ): Promise<ConversationThreadRecord> {
    return createMemoryConversationThread(this.conversationThreadStore, thread);
  }

  async updateConversationThreadLifecycle(input: {
    firmId: string;
    threadId: string;
    action: Parameters<OpenPracticeRepository["updateConversationThreadLifecycle"]>[0]["action"];
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationThreadRecord | undefined> {
    return updateMemoryConversationThreadLifecycle(this.conversationThreadStore, input);
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
    return createMemoryConversationMessageNotifications(this.conversationThreadStore, input);
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
    return listMemoryConversationMessageNotifications(
      this.conversationThreadStore,
      firmId,
      options,
    );
  }

  async updateConversationMessageNotificationPosture(input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationMessageNotificationRecord | undefined> {
    return updateMemoryConversationMessageNotificationPosture(this.conversationThreadStore, input);
  }

  async listConversationMessages(
    firmId: string,
    options: { threadId?: string; matterId?: string } = {},
  ): Promise<ConversationMessageRecord[]> {
    return listMemoryConversationMessages(this.conversationThreadStore, firmId, options);
  }

  async createConversationMessage(
    message: ConversationMessageRecord,
  ): Promise<ConversationMessageRecord> {
    return createMemoryConversationMessage(this.conversationThreadStore, message);
  }

  async listLegalClinicPrograms(
    firmId: string,
    options: { status?: LegalClinicProgram["status"] } = {},
  ): Promise<LegalClinicProgram[]> {
    return listMemoryLegalClinicPrograms(this.legalClinicStore, firmId, options);
  }

  async createLegalClinicProgram(program: LegalClinicProgram): Promise<LegalClinicProgram> {
    return createMemoryLegalClinicProgram(this.legalClinicStore, program);
  }

  async getLegalClinicMatterProfile(
    firmId: string,
    matterId: string,
  ): Promise<LegalClinicMatterProfile | undefined> {
    return getMemoryLegalClinicMatterProfile(this.legalClinicStore, firmId, matterId);
  }

  async upsertLegalClinicMatterProfile(
    profile: LegalClinicMatterProfile,
  ): Promise<LegalClinicMatterProfile> {
    return upsertMemoryLegalClinicMatterProfile(this.legalClinicStore, profile);
  }

  async listCalendarEvents(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarEvents"]>[1],
  ): ReturnType<OpenPracticeRepository["listCalendarEvents"]> {
    return Promise.resolve(listMemoryCalendarEvents(this.calendarEventStore, firmId, options));
  }

  async getCalendarEvent(
    firmId: string,
    matterId: string | undefined,
    eventId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarEvent"]> {
    return Promise.resolve(
      getMemoryCalendarEvent(this.calendarEventStore, firmId, matterId, eventId),
    );
  }

  async getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): ReturnType<OpenPracticeRepository["getCalendarEventByUid"]> {
    return Promise.resolve(
      getMemoryCalendarEventByUid(this.calendarEventStore, firmId, matterId, uid),
    );
  }

  async upsertCalendarEvent(
    event: Parameters<OpenPracticeRepository["upsertCalendarEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertCalendarEvent"]> {
    return Promise.resolve(upsertMemoryCalendarEvent(this.calendarEventStore, event));
  }

  async listCalendarEventAttendees(
    firmId: string,
    matterId: string,
    eventId: string,
  ): ReturnType<OpenPracticeRepository["listCalendarEventAttendees"]> {
    return Promise.resolve(
      listMemoryCalendarEventAttendees(this.calendarEventStore, firmId, matterId, eventId),
    );
  }

  async upsertCalendarEventAttendee(
    attendee: Parameters<OpenPracticeRepository["upsertCalendarEventAttendee"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertCalendarEventAttendee"]> {
    return Promise.resolve(upsertMemoryCalendarEventAttendee(this.calendarEventStore, attendee));
  }

  async deleteCalendarEventAttendee(
    input: Parameters<OpenPracticeRepository["deleteCalendarEventAttendee"]>[0],
  ): ReturnType<OpenPracticeRepository["deleteCalendarEventAttendee"]> {
    return Promise.resolve(deleteMemoryCalendarEventAttendee(this.calendarEventStore, input));
  }

  async replaceCalendarEventAttendees(
    input: Parameters<OpenPracticeRepository["replaceCalendarEventAttendees"]>[0],
  ): ReturnType<OpenPracticeRepository["replaceCalendarEventAttendees"]> {
    return Promise.resolve(replaceMemoryCalendarEventAttendees(this.calendarEventStore, input));
  }

  async listCalendarEventReminders(
    firmId: string,
    matterId: string | undefined,
    eventId: string,
  ): ReturnType<OpenPracticeRepository["listCalendarEventReminders"]> {
    return Promise.resolve(
      listMemoryCalendarEventReminders(this.calendarEventStore, firmId, matterId, eventId),
    );
  }

  async upsertCalendarEventReminder(
    reminder: Parameters<OpenPracticeRepository["upsertCalendarEventReminder"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertCalendarEventReminder"]> {
    return Promise.resolve(upsertMemoryCalendarEventReminder(this.calendarEventStore, reminder));
  }

  async createCalendarSchedulingRequest(
    request: Parameters<OpenPracticeRepository["createCalendarSchedulingRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarSchedulingRequest"]> {
    return Promise.resolve(createMemoryCalendarSchedulingRequest(this.calendarEventStore, request));
  }

  async listCalendarSchedulingRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarSchedulingRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarSchedulingRequests"]> {
    return Promise.resolve(
      listMemoryCalendarSchedulingRequests(this.calendarEventStore, firmId, options),
    );
  }

  async deleteCalendarEventReminder(
    input: Parameters<OpenPracticeRepository["deleteCalendarEventReminder"]>[0],
  ): ReturnType<OpenPracticeRepository["deleteCalendarEventReminder"]> {
    return Promise.resolve(deleteMemoryCalendarEventReminder(this.calendarEventStore, input));
  }

  async deleteCalendarEvent(
    input: Parameters<OpenPracticeRepository["deleteCalendarEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["deleteCalendarEvent"]> {
    return Promise.resolve(deleteMemoryCalendarEvent(this.calendarEventStore, input));
  }

  async createCalendarCredential(
    credential: Parameters<OpenPracticeRepository["createCalendarCredential"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarCredential"]> {
    return createMemoryCalendarCredential(this.calendarCredentialStore, credential);
  }

  async listCalendarCredentials(
    firmId: string,
    userId: string,
  ): ReturnType<OpenPracticeRepository["listCalendarCredentials"]> {
    return listMemoryCalendarCredentials(this.calendarCredentialStore, firmId, userId);
  }

  async getCalendarCredentialByUsername(
    username: string,
  ): ReturnType<OpenPracticeRepository["getCalendarCredentialByUsername"]> {
    return getMemoryCalendarCredentialByUsername(this.calendarCredentialStore, username);
  }

  async touchCalendarCredential(id: string, lastUsedAt: string): Promise<void> {
    touchMemoryCalendarCredential(this.calendarCredentialStore, id, lastUsedAt);
  }

  async revokeCalendarCredential(
    input: Parameters<OpenPracticeRepository["revokeCalendarCredential"]>[0],
  ): ReturnType<OpenPracticeRepository["revokeCalendarCredential"]> {
    return revokeMemoryCalendarCredential(this.calendarCredentialStore, input);
  }

  async createCalendarMeetingSession(
    session: Parameters<OpenPracticeRepository["createCalendarMeetingSession"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarMeetingSession"]> {
    return Promise.resolve(createMemoryCalendarMeetingSession(this.calendarEventStore, session));
  }

  async listCalendarMeetingSessions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarMeetingSessions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarMeetingSessions"]> {
    return Promise.resolve(
      listMemoryCalendarMeetingSessions(this.calendarEventStore, firmId, options),
    );
  }

  async getCalendarMeetingSession(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarMeetingSession"]> {
    return Promise.resolve(
      getMemoryCalendarMeetingSession(
        this.calendarEventStore,
        firmId,
        matterId,
        eventId,
        sessionId,
      ),
    );
  }

  async updateCalendarMeetingSessionStatus(
    input: Parameters<OpenPracticeRepository["updateCalendarMeetingSessionStatus"]>[0],
  ): ReturnType<OpenPracticeRepository["updateCalendarMeetingSessionStatus"]> {
    return Promise.resolve(
      updateMemoryCalendarMeetingSessionStatus(this.calendarEventStore, input),
    );
  }

  async createCalendarGuestLink(
    link: Parameters<OpenPracticeRepository["createCalendarGuestLink"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarGuestLink"]> {
    return Promise.resolve(createMemoryCalendarGuestLink(this.calendarEventStore, link));
  }

  async listCalendarGuestLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarGuestLinks"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarGuestLinks"]> {
    return Promise.resolve(listMemoryCalendarGuestLinks(this.calendarEventStore, firmId, options));
  }

  async getCalendarGuestLink(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
    linkId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarGuestLink"]> {
    return Promise.resolve(
      getMemoryCalendarGuestLink(
        this.calendarEventStore,
        firmId,
        matterId,
        eventId,
        sessionId,
        linkId,
      ),
    );
  }

  async getCalendarGuestLinkByTokenHash(
    tokenHash: string,
  ): ReturnType<OpenPracticeRepository["getCalendarGuestLinkByTokenHash"]> {
    return Promise.resolve(
      getMemoryCalendarGuestLinkByTokenHash(this.calendarEventStore, tokenHash),
    );
  }

  async updateCalendarGuestLinkStatus(
    input: Parameters<OpenPracticeRepository["updateCalendarGuestLinkStatus"]>[0],
  ): ReturnType<OpenPracticeRepository["updateCalendarGuestLinkStatus"]> {
    return Promise.resolve(updateMemoryCalendarGuestLinkStatus(this.calendarEventStore, input));
  }

  async revokeCalendarGuestLink(
    input: Parameters<OpenPracticeRepository["revokeCalendarGuestLink"]>[0],
  ): ReturnType<OpenPracticeRepository["revokeCalendarGuestLink"]> {
    return Promise.resolve(revokeMemoryCalendarGuestLink(this.calendarEventStore, input));
  }

  async runConflictCheck(
    input: Parameters<OpenPracticeRepository["runConflictCheck"]>[0],
  ): ReturnType<OpenPracticeRepository["runConflictCheck"]> {
    return runMemoryConflictCheck(this.conflictCheckStore, input);
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): ReturnType<OpenPracticeRepository["getLedger"]> {
    return Promise.resolve(getMemoryLedger(this.ledgerCoreStore, firmId, options));
  }

  async validateLedgerTransactionScope(
    input: Parameters<OpenPracticeRepository["validateLedgerTransactionScope"]>[0],
  ): ReturnType<OpenPracticeRepository["validateLedgerTransactionScope"]> {
    validateMemoryLedgerTransactionScope(this.ledgerCoreStore, input);
    return Promise.resolve();
  }

  async postLedgerTransaction(
    transaction: Parameters<OpenPracticeRepository["postLedgerTransaction"]>[0],
  ): ReturnType<OpenPracticeRepository["postLedgerTransaction"]> {
    return Promise.resolve(postMemoryLedgerTransaction(this.ledgerCoreStore, transaction));
  }

  async listAuditEvents(firmId: string): ReturnType<OpenPracticeRepository["listAuditEvents"]> {
    return listMemoryAuditEvents(this.auditStore, firmId);
  }

  async appendAuditEvent(
    event: Parameters<OpenPracticeRepository["appendAuditEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["appendAuditEvent"]> {
    return appendMemoryAuditEvent(this.auditStore, event);
  }

  async recordAuditEvent(
    event: Parameters<OpenPracticeRepository["recordAuditEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["recordAuditEvent"]> {
    recordMemoryAuditEvent(this.auditStore, event);
  }

  async listPortalGrants(firmId: string) {
    return listMemoryPortalGrants(this.portalAccessStore, firmId);
  }

  async createPortalGrant(grant: Parameters<OpenPracticeRepository["createPortalGrant"]>[0]) {
    return createMemoryPortalGrant(this.portalAccessStore, grant);
  }

  async updatePortalGrant(input: Parameters<OpenPracticeRepository["updatePortalGrant"]>[0]) {
    return updateMemoryPortalGrant(this.portalAccessStore, input);
  }

  async listPortalDocumentAccess(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPortalDocumentAccess"]>[1] = {},
  ) {
    return listMemoryPortalDocumentAccess(this.portalAccessStore, firmId, options);
  }

  async createPortalDocumentAccess(
    access: Parameters<OpenPracticeRepository["createPortalDocumentAccess"]>[0],
  ) {
    return createMemoryPortalDocumentAccess(this.portalAccessStore, access);
  }

  async revokePortalDocumentAccess(
    input: Parameters<OpenPracticeRepository["revokePortalDocumentAccess"]>[0],
  ) {
    return revokeMemoryPortalDocumentAccess(this.portalAccessStore, input);
  }

  async listShareLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listShareLinks"]>[1] = {},
  ) {
    return listMemoryShareLinks(this.portalAccessStore, firmId, options);
  }

  async listExternalUploadLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listExternalUploadLinks"]>[1] = {},
  ) {
    return listMemoryExternalUploadLinks(this.portalAccessStore, firmId, options);
  }

  async createExternalUploadLink(
    link: Parameters<OpenPracticeRepository["createExternalUploadLink"]>[0],
  ) {
    return createMemoryExternalUploadLink(this.portalAccessStore, link);
  }

  async listSavedOperationalViewDefinitions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listSavedOperationalViewDefinitions"]>[1],
  ) {
    return listMemorySavedOperationalViewDefinitions(this.operationalViewsStore, firmId, options);
  }

  async getSavedOperationalViewDefinition(firmId: string, id: string) {
    return getMemorySavedOperationalViewDefinition(this.operationalViewsStore, firmId, id);
  }

  async createSavedOperationalViewDefinition(
    input: Parameters<OpenPracticeRepository["createSavedOperationalViewDefinition"]>[0],
  ) {
    return createMemorySavedOperationalViewDefinition(this.operationalViewsStore, input);
  }

  async updateSavedOperationalViewDefinition(
    firmId: string,
    id: string,
    updates: Parameters<OpenPracticeRepository["updateSavedOperationalViewDefinition"]>[2],
  ) {
    return updateMemorySavedOperationalViewDefinition(
      this.operationalViewsStore,
      firmId,
      id,
      updates,
    );
  }

  async archiveSavedOperationalViewDefinition(input: {
    firmId: string;
    id: string;
    archivedAt: string;
  }) {
    return archiveMemorySavedOperationalViewDefinition(this.operationalViewsStore, input);
  }

  async getExternalUploadLinkByTokenHash(tokenHash: string) {
    return getMemoryExternalUploadLinkByTokenHash(this.portalAccessStore, tokenHash);
  }

  async revokeExternalUploadLink(
    input: Parameters<OpenPracticeRepository["revokeExternalUploadLink"]>[0],
  ) {
    return revokeMemoryExternalUploadLink(this.portalAccessStore, input);
  }

  async claimExternalUploadUse(
    input: Parameters<OpenPracticeRepository["claimExternalUploadUse"]>[0],
  ) {
    return claimMemoryExternalUploadUse(this.portalAccessStore, input);
  }

  async createShareLink(link: Parameters<OpenPracticeRepository["createShareLink"]>[0]) {
    return createMemoryShareLink(this.portalAccessStore, link);
  }

  async getShareLink(firmId: string, id: string) {
    return getMemoryShareLink(this.portalAccessStore, firmId, id);
  }

  async getShareLinkByTokenHash(tokenHash: string) {
    return getMemoryShareLinkByTokenHash(this.portalAccessStore, tokenHash);
  }

  async revokeShareLink(input: Parameters<OpenPracticeRepository["revokeShareLink"]>[0]) {
    return revokeMemoryShareLink(this.portalAccessStore, input);
  }

  async createAccessLog(log: Parameters<OpenPracticeRepository["createAccessLog"]>[0]) {
    return createMemoryAccessLog(this.portalAccessStore, log);
  }

  async listAccessLogs(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAccessLogs"]>[1] = {},
  ) {
    return listMemoryAccessLogs(this.portalAccessStore, firmId, options);
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    return createMemoryDocumentUploadIntent(this.documentStore, input);
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    return completeMemoryDocumentUpload(this.documentStore, input);
  }

  async updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    return updateMemoryDocumentScanStatus(this.documentStore, input);
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
    return reviewMemoryUploadedDocument(this.documentStore, input);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): ReturnType<OpenPracticeRepository["listSignatureRequests"]> {
    return listMemorySignatureRequests(this.signatureStore, firmId, options);
  }

  async listSignatureRequestSigners(
    firmId: string,
    signatureRequestId: string,
  ): ReturnType<OpenPracticeRepository["listSignatureRequestSigners"]> {
    return listMemorySignatureRequestSigners(this.signatureStore, firmId, signatureRequestId);
  }

  async createSignatureRequest(
    input: Parameters<OpenPracticeRepository["createSignatureRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createSignatureRequest"]> {
    return createMemorySignatureRequest(this.signatureStore, input);
  }

  async recordSignatureProviderEvent(
    event: Parameters<OpenPracticeRepository["recordSignatureProviderEvent"]>[0],
    webhookAttempt?: Parameters<OpenPracticeRepository["recordSignatureProviderEvent"]>[1],
  ): ReturnType<OpenPracticeRepository["recordSignatureProviderEvent"]> {
    return recordMemorySignatureProviderEvent(this.signatureStore, event, webhookAttempt);
  }

  async recordSignatureWebhookAttempt(
    attempt: Parameters<OpenPracticeRepository["recordSignatureWebhookAttempt"]>[0],
  ): ReturnType<OpenPracticeRepository["recordSignatureWebhookAttempt"]> {
    return recordMemorySignatureWebhookAttempt(this.signatureStore, attempt);
  }

  async listSignatureProviderEvents(
    firmId: string,
    options: { signatureRequestId?: string } = {},
  ): ReturnType<OpenPracticeRepository["listSignatureProviderEvents"]> {
    return listMemorySignatureProviderEvents(this.signatureStore, firmId, options);
  }

  async listSignatureWebhookAttempts(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listSignatureWebhookAttempts"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listSignatureWebhookAttempts"]> {
    return listMemorySignatureWebhookAttempts(this.signatureStore, firmId, options);
  }

  async listIntakeTemplates(
    firmId: string,
  ): ReturnType<OpenPracticeRepository["listIntakeTemplates"]> {
    return listMemoryIntakeTemplates(this.intakeTemplateStore, firmId);
  }

  async createIntakeTemplate(
    template: Parameters<OpenPracticeRepository["createIntakeTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeTemplate"]> {
    return createMemoryIntakeTemplate(this.intakeTemplateStore, template);
  }

  async updateIntakeTemplate(
    template: Parameters<OpenPracticeRepository["updateIntakeTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["updateIntakeTemplate"]> {
    return updateMemoryIntakeTemplate(this.intakeTemplateStore, template);
  }

  async listIntakeTemplateVersions(
    firmId: string,
    templateId: string,
  ): ReturnType<OpenPracticeRepository["listIntakeTemplateVersions"]> {
    return listMemoryIntakeTemplateVersions(this.intakeTemplateStore, firmId, templateId);
  }

  async getIntakeTemplateVersion(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getIntakeTemplateVersion"]> {
    return getMemoryIntakeTemplateVersion(this.intakeTemplateStore, firmId, id);
  }

  async getLatestIntakeTemplateVersion(
    firmId: string,
    templateId: string,
  ): ReturnType<OpenPracticeRepository["getLatestIntakeTemplateVersion"]> {
    return getLatestMemoryIntakeTemplateVersion(this.intakeTemplateStore, firmId, templateId);
  }

  async createIntakeTemplateVersion(
    version: Parameters<OpenPracticeRepository["createIntakeTemplateVersion"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeTemplateVersion"]> {
    return createMemoryIntakeTemplateVersion(this.intakeTemplateStore, version);
  }

  async listIntakeSessions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeSessions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeSessions"]> {
    return listMemoryIntakeSessions(this.intakeFormsStore, firmId, options);
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): ReturnType<OpenPracticeRepository["getIntakeSession"]> {
    return getMemoryIntakeSession(this.intakeFormsStore, firmId, sessionId);
  }

  async createIntakeSession(
    session: Parameters<OpenPracticeRepository["createIntakeSession"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeSession"]> {
    return createMemoryIntakeSession(this.intakeFormsStore, session);
  }

  async listIntakeFormLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeFormLinks"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeFormLinks"]> {
    return listMemoryIntakeFormLinks(this.intakeFormsStore, firmId, options);
  }

  async createIntakeFormLink(
    link: Parameters<OpenPracticeRepository["createIntakeFormLink"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeFormLink"]> {
    return createMemoryIntakeFormLink(this.intakeFormsStore, link);
  }

  async getIntakeFormLink(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getIntakeFormLink"]> {
    return getMemoryIntakeFormLink(this.intakeFormsStore, firmId, id);
  }

  async getIntakeFormLinkByTokenHash(
    tokenHash: string,
  ): ReturnType<OpenPracticeRepository["getIntakeFormLinkByTokenHash"]> {
    return getMemoryIntakeFormLinkByTokenHash(this.intakeFormsStore, tokenHash);
  }

  async revokeIntakeFormLink(
    input: Parameters<OpenPracticeRepository["revokeIntakeFormLink"]>[0],
  ): ReturnType<OpenPracticeRepository["revokeIntakeFormLink"]> {
    return revokeMemoryIntakeFormLink(this.intakeFormsStore, input);
  }

  async markIntakeFormLinkSubmitted(
    input: Parameters<OpenPracticeRepository["markIntakeFormLinkSubmitted"]>[0],
  ): ReturnType<OpenPracticeRepository["markIntakeFormLinkSubmitted"]> {
    return markMemoryIntakeFormLinkSubmitted(this.intakeFormsStore, input);
  }

  async reserveIntakeFormLinkSubmission(
    input: Parameters<OpenPracticeRepository["reserveIntakeFormLinkSubmission"]>[0],
  ): ReturnType<OpenPracticeRepository["reserveIntakeFormLinkSubmission"]> {
    return reserveMemoryIntakeFormLinkSubmission(this.intakeFormsStore, input);
  }

  async saveIntakeFormLinkDraft(
    input: Parameters<OpenPracticeRepository["saveIntakeFormLinkDraft"]>[0],
  ): ReturnType<OpenPracticeRepository["saveIntakeFormLinkDraft"]> {
    return saveMemoryIntakeFormLinkDraft(this.intakeFormsStore, input);
  }

  async listIntakeFormReviews(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeFormReviews"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeFormReviews"]> {
    return listMemoryIntakeFormReviews(this.intakeFormsStore, firmId, options);
  }

  async createIntakeFormReview(
    review: Parameters<OpenPracticeRepository["createIntakeFormReview"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeFormReview"]> {
    return createMemoryIntakeFormReview(this.intakeFormsStore, review);
  }

  async listIntakeFormItemActions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeFormItemActions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeFormItemActions"]> {
    return listMemoryIntakeFormItemActions(this.intakeFormsStore, firmId, options);
  }

  async upsertIntakeFormItemAction(
    action: Parameters<OpenPracticeRepository["upsertIntakeFormItemAction"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertIntakeFormItemAction"]> {
    return upsertMemoryIntakeFormItemAction(this.intakeFormsStore, action);
  }

  async createAnswerSnapshot(
    snapshot: Parameters<OpenPracticeRepository["createAnswerSnapshot"]>[0],
  ): ReturnType<OpenPracticeRepository["createAnswerSnapshot"]> {
    return createMemoryAnswerSnapshot(this.intakeFormsStore, snapshot);
  }

  async listAnswerSnapshots(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAnswerSnapshots"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listAnswerSnapshots"]> {
    return listMemoryAnswerSnapshots(this.intakeFormsStore, firmId, options);
  }

  async createIntakeVariableProposals(
    proposals: Parameters<OpenPracticeRepository["createIntakeVariableProposals"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeVariableProposals"]> {
    return createMemoryIntakeVariableProposals(this.intakeFormsStore, proposals);
  }

  async listIntakeVariableProposals(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeVariableProposals"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeVariableProposals"]> {
    return listMemoryIntakeVariableProposals(this.intakeFormsStore, firmId, options);
  }

  async reviewIntakeVariableProposal(
    input: Parameters<OpenPracticeRepository["reviewIntakeVariableProposal"]>[0],
  ): ReturnType<OpenPracticeRepository["reviewIntakeVariableProposal"]> {
    return reviewMemoryIntakeVariableProposal(this.intakeFormsStore, input);
  }

  async listGeneratedDocuments(
    firmId: string,
    options: { matterId?: string; documentId?: string } = {},
  ): Promise<GeneratedDocumentRecord[]> {
    return listMemoryGeneratedDocuments(this.documentAssemblyStore, firmId, options);
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    return createMemoryGeneratedDocument(this.documentAssemblyStore, document);
  }

  async listDocumentAssemblySetDefinitions(
    firmId: string,
    options: { activeOnly?: boolean } = {},
  ): Promise<DocumentAssemblySetDefinitionRecord[]> {
    return listMemoryDocumentAssemblySetDefinitions(this.documentAssemblyStore, firmId, options);
  }

  async listDocumentAssemblyPackages(
    firmId: string,
    options: { matterId?: string; definitionId?: string } = {},
  ): Promise<DocumentAssemblyPackageRecord[]> {
    return listMemoryDocumentAssemblyPackages(this.documentAssemblyStore, firmId, options);
  }

  async listSignatureEnvelopes(
    firmId: string,
    options: { matterId?: string; assemblyPackageId?: string; signatureRequestId?: string } = {},
  ): Promise<SignatureEnvelopeRecord[]> {
    return listMemorySignatureEnvelopes(this.documentAssemblyStore, firmId, options);
  }

  async createLedgerTransactionApproval(
    approval: Parameters<OpenPracticeRepository["createLedgerTransactionApproval"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerTransactionApproval"]> {
    return Promise.resolve(createMemoryLedgerTransactionApproval(this.ledgerReviewStore, approval));
  }

  async listLedgerTransactionApprovals(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerTransactionApprovals"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerTransactionApprovals"]> {
    return Promise.resolve(
      listMemoryLedgerTransactionApprovals(this.ledgerReviewStore, firmId, options),
    );
  }

  async createLedgerReconciliation(
    reconciliation: Parameters<OpenPracticeRepository["createLedgerReconciliation"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerReconciliation"]> {
    return Promise.resolve(
      createMemoryLedgerReconciliation(this.ledgerReviewStore, reconciliation),
    );
  }

  async listLedgerReconciliations(
    firmId: string,
  ): ReturnType<OpenPracticeRepository["listLedgerReconciliations"]> {
    return Promise.resolve(listMemoryLedgerReconciliations(this.ledgerReviewStore, firmId));
  }

  async createLedgerStatementImportBatch(
    batch: Parameters<OpenPracticeRepository["createLedgerStatementImportBatch"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerStatementImportBatch"]> {
    return Promise.resolve(createMemoryLedgerStatementImportBatch(this.ledgerReviewStore, batch));
  }

  async listLedgerStatementImportBatches(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerStatementImportBatches"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerStatementImportBatches"]> {
    return Promise.resolve(
      listMemoryLedgerStatementImportBatches(this.ledgerReviewStore, firmId, options),
    );
  }

  async createLedgerStatementMatchRuleProfile(
    profile: Parameters<OpenPracticeRepository["createLedgerStatementMatchRuleProfile"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerStatementMatchRuleProfile"]> {
    return Promise.resolve(
      createMemoryLedgerStatementMatchRuleProfile(this.ledgerReviewStore, profile),
    );
  }

  async listLedgerStatementMatchRuleProfiles(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerStatementMatchRuleProfiles"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerStatementMatchRuleProfiles"]> {
    return Promise.resolve(
      listMemoryLedgerStatementMatchRuleProfiles(this.ledgerReviewStore, firmId, options),
    );
  }

  async createLedgerAccountingReviewProfile(
    profile: Parameters<OpenPracticeRepository["createLedgerAccountingReviewProfile"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerAccountingReviewProfile"]> {
    return Promise.resolve(
      createMemoryLedgerAccountingReviewProfile(this.ledgerReviewStore, profile),
    );
  }

  async listLedgerAccountingReviewProfiles(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerAccountingReviewProfiles"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerAccountingReviewProfiles"]> {
    return Promise.resolve(
      listMemoryLedgerAccountingReviewProfiles(this.ledgerReviewStore, firmId, options),
    );
  }

  async createLedgerReconciliationExceptionResolution(
    resolution: Parameters<
      OpenPracticeRepository["createLedgerReconciliationExceptionResolution"]
    >[0],
  ): ReturnType<OpenPracticeRepository["createLedgerReconciliationExceptionResolution"]> {
    return Promise.resolve(
      createMemoryLedgerReconciliationExceptionResolution(this.ledgerReviewStore, resolution),
    );
  }

  async listLedgerReconciliationExceptionResolutions(
    firmId: string,
    options: Parameters<
      OpenPracticeRepository["listLedgerReconciliationExceptionResolutions"]
    >[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerReconciliationExceptionResolutions"]> {
    return Promise.resolve(
      listMemoryLedgerReconciliationExceptionResolutions(this.ledgerReviewStore, firmId, options),
    );
  }

  async listTimeEntries(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTimeEntries"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTimeEntries"]> {
    return Promise.resolve(listMemoryTimeEntries(this.billingEntriesStore, firmId, options));
  }

  async getTimeEntry(
    firmId: string,
    entryId: string,
  ): ReturnType<OpenPracticeRepository["getTimeEntry"]> {
    return Promise.resolve(getMemoryTimeEntry(this.billingEntriesStore, firmId, entryId));
  }

  async createTimeEntry(
    entry: Parameters<OpenPracticeRepository["createTimeEntry"]>[0],
  ): ReturnType<OpenPracticeRepository["createTimeEntry"]> {
    return Promise.resolve(createMemoryTimeEntry(this.billingEntriesStore, entry));
  }

  async updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Parameters<OpenPracticeRepository["updateTimeEntry"]>[2],
  ): ReturnType<OpenPracticeRepository["updateTimeEntry"]> {
    return Promise.resolve(
      updateMemoryTimeEntry(this.billingEntriesStore, firmId, entryId, updates),
    );
  }

  async listExpenseEntries(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listExpenseEntries"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listExpenseEntries"]> {
    return Promise.resolve(listMemoryExpenseEntries(this.billingEntriesStore, firmId, options));
  }

  async getExpenseEntry(
    firmId: string,
    entryId: string,
  ): ReturnType<OpenPracticeRepository["getExpenseEntry"]> {
    return Promise.resolve(getMemoryExpenseEntry(this.billingEntriesStore, firmId, entryId));
  }

  async createExpenseEntry(
    entry: Parameters<OpenPracticeRepository["createExpenseEntry"]>[0],
  ): ReturnType<OpenPracticeRepository["createExpenseEntry"]> {
    return Promise.resolve(createMemoryExpenseEntry(this.billingEntriesStore, entry));
  }

  async updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Parameters<OpenPracticeRepository["updateExpenseEntry"]>[2],
  ): ReturnType<OpenPracticeRepository["updateExpenseEntry"]> {
    return Promise.resolve(
      updateMemoryExpenseEntry(this.billingEntriesStore, firmId, entryId, updates),
    );
  }

  async listBillingPeriodLocks(firmId: string): Promise<BillingPeriodLockRecord[]> {
    return listMemoryBillingPeriodLocks(this.billingControlsStore, firmId);
  }

  async createBillingPeriodLock(lock: BillingPeriodLockRecord): Promise<BillingPeriodLockRecord> {
    return createMemoryBillingPeriodLock(this.billingControlsStore, lock);
  }

  async listBillingRateRules(
    firmId: string,
    options: { activeOnly?: boolean; matterId?: string; userId?: string } = {},
  ): Promise<BillingRateRuleRecord[]> {
    return listMemoryBillingRateRules(this.billingControlsStore, firmId, options);
  }

  async createBillingRateRule(rule: BillingRateRuleRecord): Promise<BillingRateRuleRecord> {
    return createMemoryBillingRateRule(this.billingControlsStore, rule);
  }

  async listInvoices(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listInvoices"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listInvoices"]> {
    return Promise.resolve(listMemoryInvoices(this.billingInvoicePaymentStore, firmId, options));
  }

  async getInvoice(
    firmId: string,
    invoiceId: string,
  ): ReturnType<OpenPracticeRepository["getInvoice"]> {
    return Promise.resolve(getMemoryInvoice(this.billingInvoicePaymentStore, firmId, invoiceId));
  }

  async createInvoice(
    input: Parameters<OpenPracticeRepository["createInvoice"]>[0],
  ): ReturnType<OpenPracticeRepository["createInvoice"]> {
    return Promise.resolve(createMemoryInvoice(this.billingInvoicePaymentStore, input));
  }

  async updateInvoice(
    invoice: Parameters<OpenPracticeRepository["updateInvoice"]>[0],
  ): ReturnType<OpenPracticeRepository["updateInvoice"]> {
    return Promise.resolve(updateMemoryInvoice(this.billingInvoicePaymentStore, invoice));
  }

  async createPayment(
    input: Parameters<OpenPracticeRepository["createPayment"]>[0],
  ): ReturnType<OpenPracticeRepository["createPayment"]> {
    return Promise.resolve(createMemoryPayment(this.billingInvoicePaymentStore, input));
  }

  async listPayments(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPayments"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listPayments"]> {
    return Promise.resolve(listMemoryPayments(this.billingInvoicePaymentStore, firmId, options));
  }

  async createHostedPaymentRequest(
    request: Parameters<OpenPracticeRepository["createHostedPaymentRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createHostedPaymentRequest"]> {
    return Promise.resolve(
      createMemoryHostedPaymentRequest(this.hostedPaymentRequestStore, request),
    );
  }

  async getHostedPaymentRequest(
    firmId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getHostedPaymentRequest"]> {
    return Promise.resolve(
      getMemoryHostedPaymentRequest(this.hostedPaymentRequestStore, firmId, requestId),
    );
  }

  async listHostedPaymentRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listHostedPaymentRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listHostedPaymentRequests"]> {
    return Promise.resolve(
      listMemoryHostedPaymentRequests(this.hostedPaymentRequestStore, firmId, options),
    );
  }

  async updateHostedPaymentRequest(
    firmId: string,
    requestId: string,
    updates: Parameters<OpenPracticeRepository["updateHostedPaymentRequest"]>[2],
  ): ReturnType<OpenPracticeRepository["updateHostedPaymentRequest"]> {
    return Promise.resolve(
      updateMemoryHostedPaymentRequest(this.hostedPaymentRequestStore, firmId, requestId, updates),
    );
  }

  async createTrustTransferRequest(
    request: Parameters<OpenPracticeRepository["createTrustTransferRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createTrustTransferRequest"]> {
    return Promise.resolve(
      createMemoryTrustTransferRequest(this.trustTransferRequestStore, request),
    );
  }

  async getTrustTransferRequest(
    firmId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getTrustTransferRequest"]> {
    return Promise.resolve(
      getMemoryTrustTransferRequest(this.trustTransferRequestStore, firmId, requestId),
    );
  }

  async listTrustTransferRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTrustTransferRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTrustTransferRequests"]> {
    return Promise.resolve(
      listMemoryTrustTransferRequests(this.trustTransferRequestStore, firmId, options),
    );
  }

  async updateTrustTransferRequest(
    firmId: string,
    requestId: string,
    updates: Parameters<OpenPracticeRepository["updateTrustTransferRequest"]>[2],
    options: Parameters<OpenPracticeRepository["updateTrustTransferRequest"]>[3] = {},
  ): ReturnType<OpenPracticeRepository["updateTrustTransferRequest"]> {
    return Promise.resolve(
      updateMemoryTrustTransferRequest(
        this.trustTransferRequestStore,
        firmId,
        requestId,
        updates,
        options,
      ),
    );
  }

  async createDocumentTextExtraction(
    extraction: DocumentTextExtractionRecord,
  ): Promise<DocumentTextExtractionRecord> {
    return createMemoryDocumentTextExtraction(this.documentStore, extraction);
  }

  async getDocumentTextExtractions(
    firmId: string,
    documentId: string,
  ): Promise<DocumentTextExtractionRecord[]> {
    return getMemoryDocumentTextExtractions(this.documentStore, firmId, documentId);
  }

  async listDrafts(
    firmId: string,
    options: { matterId?: string; userId?: string } = {},
  ): Promise<DraftRecord[]> {
    return listMemoryDrafts(this.draftStore, firmId, options);
  }

  async getDraft(firmId: string, draftId: string): Promise<DraftRecord | undefined> {
    return getMemoryDraft(this.draftStore, firmId, draftId);
  }

  async createDraft(draft: DraftRecord): Promise<DraftRecord> {
    return createMemoryDraft(this.draftStore, draft);
  }

  async updateDraft(
    firmId: string,
    draftId: string,
    updates: Partial<
      Pick<DraftRecord, "title" | "editorJson" | "renderedHtml" | "updatedByUserId">
    >,
  ): Promise<DraftRecord> {
    return updateMemoryDraft(this.draftStore, firmId, draftId, updates);
  }

  async deleteDraft(firmId: string, draftId: string): Promise<void> {
    deleteMemoryDraft(this.draftStore, firmId, draftId);
  }

  async listDraftAssistRecords(
    firmId: string,
    options: { matterId?: string; draftId?: string; documentId?: string } = {},
  ): Promise<DraftAssistRecord[]> {
    return listMemoryDraftAssistRecords(this.draftStore, firmId, options);
  }

  async getDraftAssistRecord(firmId: string, id: string): Promise<DraftAssistRecord | undefined> {
    return getMemoryDraftAssistRecord(this.draftStore, firmId, id);
  }

  async createDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord> {
    return createMemoryDraftAssistRecord(this.draftStore, record);
  }

  async updateDraftAssistRecord(record: DraftAssistRecord): Promise<DraftAssistRecord> {
    return updateMemoryDraftAssistRecord(this.draftStore, record);
  }

  async listAiOperationalProposals(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAiOperationalProposals"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listAiOperationalProposals"]> {
    return listMemoryAiOperationalProposals(this.aiOperationalProposalStore, firmId, options);
  }

  async getAiOperationalProposal(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getAiOperationalProposal"]> {
    return getMemoryAiOperationalProposal(this.aiOperationalProposalStore, firmId, id);
  }

  async createAiOperationalProposal(
    record: Parameters<OpenPracticeRepository["createAiOperationalProposal"]>[0],
  ): ReturnType<OpenPracticeRepository["createAiOperationalProposal"]> {
    return createMemoryAiOperationalProposal(this.aiOperationalProposalStore, record);
  }

  async updateAiOperationalProposal(
    record: Parameters<OpenPracticeRepository["updateAiOperationalProposal"]>[0],
  ): ReturnType<OpenPracticeRepository["updateAiOperationalProposal"]> {
    return updateMemoryAiOperationalProposal(this.aiOperationalProposalStore, record);
  }

  async listLegalResearchArtifacts(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLegalResearchArtifacts"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLegalResearchArtifacts"]> {
    return listMemoryLegalResearchArtifacts(this.legalResearchArtifactStore, firmId, options);
  }

  async getLegalResearchArtifact(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getLegalResearchArtifact"]> {
    return getMemoryLegalResearchArtifact(this.legalResearchArtifactStore, firmId, id);
  }

  async createLegalResearchArtifact(
    record: Parameters<OpenPracticeRepository["createLegalResearchArtifact"]>[0],
  ): ReturnType<OpenPracticeRepository["createLegalResearchArtifact"]> {
    return createMemoryLegalResearchArtifact(this.legalResearchArtifactStore, record);
  }

  async updateLegalResearchArtifact(
    record: Parameters<OpenPracticeRepository["updateLegalResearchArtifact"]>[0],
  ): ReturnType<OpenPracticeRepository["updateLegalResearchArtifact"]> {
    return updateMemoryLegalResearchArtifact(this.legalResearchArtifactStore, record);
  }

  async listDraftTemplates(
    firmId: string,
    options: { category?: string; activeOnly?: boolean } = {},
  ): Promise<DraftTemplateRecord[]> {
    return listMemoryDraftTemplates(this.draftStore, firmId, options);
  }

  async createDraftTemplate(template: DraftTemplateRecord): Promise<DraftTemplateRecord> {
    return createMemoryDraftTemplate(this.draftStore, template);
  }

  async getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined> {
    return getMemoryInboundEmailAddressByAddress(this.inboundEmailStore, firmId, address);
  }

  async listInboundEmailAddresses(firmId: string): Promise<InboundEmailAddressRecord[]> {
    return listMemoryInboundEmailAddresses(this.inboundEmailStore, firmId);
  }

  async createInboundEmailAddress(
    address: InboundEmailAddressRecord,
  ): Promise<InboundEmailAddressRecord> {
    return createMemoryInboundEmailAddress(this.inboundEmailStore, address);
  }

  async listInboundEmailMessages(
    firmId: string,
    options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
  ): Promise<InboundEmailMessageRecord[]> {
    return listMemoryInboundEmailMessages(this.inboundEmailStore, firmId, options);
  }

  async getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined> {
    return getMemoryInboundEmailMessage(this.inboundEmailStore, firmId, messageId);
  }

  async createInboundEmailMessage(
    message: InboundEmailMessageRecord,
  ): Promise<InboundEmailMessageRecord> {
    return createMemoryInboundEmailMessage(this.inboundEmailStore, message);
  }

  async updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord> {
    return updateMemoryInboundEmailMessage(this.inboundEmailStore, firmId, messageId, updates);
  }

  async createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord> {
    return createMemoryInboundEmailAttachment(this.inboundEmailStore, attachment);
  }

  async listInboundEmailAttachments(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailAttachmentRecord[]> {
    return listMemoryInboundEmailAttachments(this.inboundEmailStore, firmId, messageId);
  }

  async promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult> {
    return promoteMemoryInboundEmailAttachmentToDocument(this.inboundEmailStore, input);
  }
}
