import {
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
  type Contact,
  type ConversationMessageRecord,
  type ConversationMessageNotificationRecord,
  type ConversationThreadRecord,
  type DocumentRecord,
  type InboundEmailAddressRecord,
  type InboundEmailAttachmentRecord,
  type InboundEmailMessageRecord,
  type LegalClinicMatterProfile,
  type LegalClinicProgram,
  type MatterParty,
  type TaskDeadlineRecord,
  type User,
} from "@open-practice/domain";
import { eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../runtime.js";
import * as schema from "../schema.js";
import type { ProviderConfigCipher } from "../config-encryption.js";

import type {
  DocumentUploadIntent,
  InboundAttachmentPromotionInput,
  InboundAttachmentPromotionResult,
  OpenPracticeRepository,
} from "./contracts.js";
import type { AuthRepository } from "./auth-contracts.js";
import type { ConnectorRepository } from "./connector-contracts.js";
import type { EmailJobsRepository } from "./jobs-email-contracts.js";
import type { FirmSettingsRepository } from "./firm-settings-contracts.js";
import type { ProviderSettingsRepository } from "./provider-settings-contracts.js";
import { createDrizzleAuthRepository } from "./auth/drizzle.js";
import {
  appendDrizzleAuditEvent,
  listDrizzleAuditEvents,
  recordDrizzleAuditEvent,
} from "./audit/drizzle.js";
import {
  createDrizzleAiOperationalProposal,
  getDrizzleAiOperationalProposal,
  listDrizzleAiOperationalProposals,
  updateDrizzleAiOperationalProposal,
} from "./ai-operational-proposals/drizzle.js";
import {
  createDrizzleCalendarCredential,
  getDrizzleCalendarCredentialByUsername,
  listDrizzleCalendarCredentials,
  revokeDrizzleCalendarCredential,
  touchDrizzleCalendarCredential,
} from "./calendar-credentials/drizzle.js";
import {
  createDrizzleCalendarGuestLink,
  createDrizzleCalendarMeetingSession,
  createDrizzleCalendarSchedulingRequest,
  deleteDrizzleCalendarEvent,
  deleteDrizzleCalendarEventAttendee,
  deleteDrizzleCalendarEventReminder,
  getDrizzleCalendarEvent,
  getDrizzleCalendarEventByUid,
  getDrizzleCalendarGuestLink,
  getDrizzleCalendarGuestLinkByTokenHash,
  getDrizzleCalendarMeetingSession,
  listDrizzleCalendarEvents,
  listDrizzleCalendarEventAttendees,
  listDrizzleCalendarEventReminders,
  listDrizzleCalendarGuestLinks,
  listDrizzleCalendarMeetingSessions,
  listDrizzleCalendarSchedulingRequests,
  replaceDrizzleCalendarEventAttendees,
  revokeDrizzleCalendarGuestLink,
  updateDrizzleCalendarGuestLinkStatus,
  updateDrizzleCalendarMeetingSessionStatus,
  upsertDrizzleCalendarEvent,
  upsertDrizzleCalendarEventAttendee,
  upsertDrizzleCalendarEventReminder,
} from "./calendar-events/drizzle.js";
import { runDrizzleConflictCheck } from "./conflict-checks/drizzle.js";
import {
  createDrizzleContactDataQualityResolution,
  createDrizzleContactRelationship,
  getDrizzleContact,
  listDrizzleContactDataQualityResolutions,
  listDrizzleContactDossiersForUser,
} from "./contacts/drizzle.js";
import {
  createDrizzleIntakeTemplate,
  listDrizzleIntakeTemplates,
  updateDrizzleIntakeTemplate,
} from "./intake-templates/drizzle.js";
import {
  createDrizzleAnswerSnapshot,
  createDrizzleIntakeFormLink,
  createDrizzleIntakeFormReview,
  createDrizzleIntakeSession,
  createDrizzleIntakeVariableProposals,
  getDrizzleIntakeFormLink,
  getDrizzleIntakeFormLinkByTokenHash,
  getDrizzleIntakeSession,
  listDrizzleAnswerSnapshots,
  listDrizzleIntakeFormItemActions,
  listDrizzleIntakeFormLinks,
  listDrizzleIntakeFormReviews,
  listDrizzleIntakeSessions,
  listDrizzleIntakeVariableProposals,
  markDrizzleIntakeFormLinkSubmitted,
  reserveDrizzleIntakeFormLinkSubmission,
  reviewDrizzleIntakeVariableProposal,
  revokeDrizzleIntakeFormLink,
  saveDrizzleIntakeFormLinkDraft,
  upsertDrizzleIntakeFormItemAction,
} from "./intake-forms/drizzle.js";
import {
  createDrizzleExpenseEntry,
  createDrizzleTimeEntry,
  getDrizzleExpenseEntry,
  getDrizzleTimeEntry,
  listDrizzleExpenseEntries,
  listDrizzleTimeEntries,
  updateDrizzleExpenseEntry,
  updateDrizzleTimeEntry,
} from "./billing-entries/drizzle.js";
import {
  createDrizzleInvoice,
  createDrizzlePayment,
  getDrizzleInvoice,
  listDrizzleInvoices,
  listDrizzlePayments,
  updateDrizzleInvoice,
} from "./billing-invoices-payments/drizzle.js";
import {
  createDrizzleHostedPaymentRequest,
  getDrizzleHostedPaymentRequest,
  listDrizzleHostedPaymentRequests,
  updateDrizzleHostedPaymentRequest,
} from "./hosted-payment-requests/drizzle.js";
import {
  createDrizzleBillingPeriodLock,
  createDrizzleBillingRateRule,
  listDrizzleBillingPeriodLocks,
  listDrizzleBillingRateRules,
} from "./billing-controls/drizzle.js";
import { createDrizzleFirmSettingsRepository } from "./firm-settings/drizzle.js";
import {
  createDrizzleTrustTransferRequest,
  getDrizzleTrustTransferRequest,
  listDrizzleTrustTransferRequests,
  updateDrizzleTrustTransferRequest,
} from "./trust-transfer-requests/drizzle.js";
import {
  createDrizzleLegalResearchArtifact,
  getDrizzleLegalResearchArtifact,
  listDrizzleLegalResearchArtifacts,
  updateDrizzleLegalResearchArtifact,
} from "./legal-research-artifacts/drizzle.js";
import {
  createDrizzleLedgerAccountingReviewProfile,
  createDrizzleLedgerReconciliation,
  createDrizzleLedgerReconciliationExceptionResolution,
  createDrizzleLedgerStatementImportBatch,
  createDrizzleLedgerStatementMatchRuleProfile,
  createDrizzleLedgerTransactionApproval,
  listDrizzleLedgerAccountingReviewProfiles,
  listDrizzleLedgerReconciliationExceptionResolutions,
  listDrizzleLedgerReconciliations,
  listDrizzleLedgerStatementImportBatches,
  listDrizzleLedgerStatementMatchRuleProfiles,
  listDrizzleLedgerTransactionApprovals,
} from "./ledger-review/drizzle.js";
import {
  getDrizzleLedger,
  postDrizzleLedgerTransaction,
  validateDrizzleLedgerTransactionScope,
} from "./ledger-core/drizzle.js";
import {
  getDrizzleMatterWorkspaceOverview,
  listDrizzleMatterWorkspaceMattersForUser,
} from "./matter-workspace/drizzle.js";
import {
  convertDrizzlePublicConsultationIntakeToMatter,
  createDrizzleMatterWithClient,
} from "./matter-lifecycle/drizzle.js";
import {
  completeDrizzleFirstRunSetup,
  getDrizzleSetupStatus,
  resolveDrizzleConfiguredFirm,
} from "./setup/drizzle.js";

import { mapContactRow, mapDocumentRow } from "./drizzle-mappers.js";
import { createDrizzleProviderSettingsRepository } from "./provider-settings/drizzle.js";
import {
  createDrizzlePublicConsultationIntake,
  getDrizzlePublicConsultationIntake,
  listDrizzlePublicConsultationIntakes,
  updateDrizzlePublicConsultationIntake,
} from "./public-consultation-intakes/drizzle.js";
import {
  completeDrizzleDocumentUpload,
  createDrizzleDocumentTextExtraction,
  createDrizzleDocumentUploadIntent,
  getDrizzleDocument,
  getDrizzleDocumentTextExtractions,
  listDrizzleMatterDocuments,
  reviewDrizzleUploadedDocument,
  updateDrizzleDocumentScanStatus,
} from "./documents/drizzle.js";
import {
  createDrizzleGeneratedDocument,
  listDrizzleDocumentAssemblyPackages,
  listDrizzleDocumentAssemblySetDefinitions,
  listDrizzleGeneratedDocuments,
  listDrizzleSignatureEnvelopes,
} from "./document-assembly/drizzle.js";
import {
  createDrizzleDraft,
  createDrizzleDraftAssistRecord,
  createDrizzleDraftTemplate,
  deleteDrizzleDraft,
  getDrizzleDraft,
  getDrizzleDraftAssistRecord,
  listDrizzleDraftAssistRecords,
  listDrizzleDrafts,
  listDrizzleDraftTemplates,
  updateDrizzleDraft,
  updateDrizzleDraftAssistRecord,
} from "./drafts/drizzle.js";
import {
  completeDrizzleTaskDeadline,
  createDrizzleTaskDeadline,
  getDrizzleTaskDeadline,
  listDrizzleTaskDeadlines,
} from "./tasks/drizzle.js";
import {
  createDrizzleConversationMessage,
  createDrizzleConversationMessageNotifications,
  createDrizzleConversationThread,
  getDrizzleConversationThread,
  listDrizzleConversationMessageNotifications,
  listDrizzleConversationMessages,
  listDrizzleConversationThreads,
  updateDrizzleConversationMessageNotificationPosture,
  updateDrizzleConversationThreadLifecycle,
} from "./conversation-threads/drizzle.js";
import {
  createDrizzleSignatureRequest,
  listDrizzleSignatureProviderEvents,
  listDrizzleSignatureRequests,
  listDrizzleSignatureRequestSigners,
  listDrizzleSignatureWebhookAttempts,
  recordDrizzleSignatureProviderEvent,
  recordDrizzleSignatureWebhookAttempt,
} from "./signatures/drizzle.js";
import { createDrizzleConnectorRepository } from "./connectors/drizzle.js";
import { createDrizzleEmailJobsRepository } from "./jobs-email/drizzle.js";
import {
  createDrizzleInboundEmailAddress,
  createDrizzleInboundEmailAttachment,
  createDrizzleInboundEmailMessage,
  getDrizzleInboundEmailAddressByAddress,
  getDrizzleInboundEmailMessage,
  listDrizzleInboundEmailAddresses,
  listDrizzleInboundEmailAttachments,
  listDrizzleInboundEmailMessages,
  promoteDrizzleInboundEmailAttachmentToDocument,
  updateDrizzleInboundEmailMessage,
} from "./inbound-email/drizzle.js";
import {
  createDrizzleLegalClinicProgram,
  getDrizzleLegalClinicMatterProfile,
  listDrizzleLegalClinicPrograms,
  upsertDrizzleLegalClinicMatterProfile,
} from "./legal-clinics/drizzle.js";
import {
  archiveDrizzleSavedOperationalViewDefinition,
  createDrizzleSavedOperationalViewDefinition,
  getDrizzleSavedOperationalViewDefinition,
  listDrizzleSavedOperationalViewDefinitions,
  updateDrizzleSavedOperationalViewDefinition,
} from "./operational-views/drizzle.js";
import {
  claimDrizzleExternalUploadUse,
  createDrizzleAccessLog,
  createDrizzleExternalUploadLink,
  createDrizzlePortalGrant,
  createDrizzleShareLink,
  getDrizzleExternalUploadLinkByTokenHash,
  getDrizzleShareLink,
  getDrizzleShareLinkByTokenHash,
  listDrizzleAccessLogs,
  listDrizzleExternalUploadLinks,
  listDrizzlePortalGrants,
  listDrizzleShareLinks,
  revokeDrizzleExternalUploadLink,
  revokeDrizzleShareLink,
} from "./portal-access/drizzle.js";

export class DrizzleOpenPracticeRepository implements OpenPracticeRepository {
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

  constructor(
    private readonly db: OpenPracticeDatabase,
    private readonly options: { providerConfigCipher?: ProviderConfigCipher } = {},
  ) {
    Object.assign(this, createDrizzleAuthRepository(db));
    Object.assign(this, createDrizzleConnectorRepository(db));
    Object.assign(this, createDrizzleEmailJobsRepository(db));
    Object.assign(this, createDrizzleFirmSettingsRepository(db));
    Object.assign(
      this,
      createDrizzleProviderSettingsRepository(db, this.options.providerConfigCipher),
    );
  }

  async getSetupStatus(): ReturnType<OpenPracticeRepository["getSetupStatus"]> {
    return getDrizzleSetupStatus(this.db);
  }

  async resolveConfiguredFirm(): ReturnType<OpenPracticeRepository["resolveConfiguredFirm"]> {
    return resolveDrizzleConfiguredFirm(this.db);
  }

  async completeFirstRunSetup(
    input: Parameters<OpenPracticeRepository["completeFirstRunSetup"]>[0],
  ): ReturnType<OpenPracticeRepository["completeFirstRunSetup"]> {
    return completeDrizzleFirstRunSetup(this.db, input);
  }

  async getOverview(firmId: string): ReturnType<OpenPracticeRepository["getOverview"]> {
    return getDrizzleMatterWorkspaceOverview(this.db, firmId, {
      listUsers: (firmId) => this.listUsers(firmId),
      listPortalGrants: (firmId) => this.listPortalGrants(firmId),
      getLedger: (firmId) => this.getLedger(firmId),
    });
  }

  async listMattersForUser(user: User): ReturnType<OpenPracticeRepository["listMattersForUser"]> {
    return listDrizzleMatterWorkspaceMattersForUser(this.db, user, {
      getLedger: (firmId) => this.getLedger(firmId),
      listMatterParties: (firmId) => this.listMatterParties(firmId),
      listContacts: (firmId) => this.listContacts(firmId),
      listUsers: (firmId) => this.listUsers(firmId),
      listDocuments: (firmId) => this.listDocuments(firmId),
      listTimeEntries: (firmId) => this.listTimeEntries(firmId),
      listExpenseEntries: (firmId) => this.listExpenseEntries(firmId),
      listPortalGrants: (firmId) => this.listPortalGrants(firmId),
      listShareLinks: (firmId) => this.listShareLinks(firmId),
      listExternalUploadLinks: (firmId) => this.listExternalUploadLinks(firmId),
      listAccessLogs: (firmId) => this.listAccessLogs(firmId),
      listAuditEvents: (firmId) => this.listAuditEvents(firmId),
      listSignatureRequests: (firmId) => this.listSignatureRequests(firmId),
      listIntakeSessions: (firmId) => this.listIntakeSessions(firmId),
      listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
      listInvoices: (firmId) => this.listInvoices(firmId),
      listPayments: (firmId) => this.listPayments(firmId),
      listTrustTransferRequests: (firmId) => this.listTrustTransferRequests(firmId),
    });
  }

  async createMatterWithClient(
    input: Parameters<OpenPracticeRepository["createMatterWithClient"]>[0],
  ): ReturnType<OpenPracticeRepository["createMatterWithClient"]> {
    return createDrizzleMatterWithClient(this.db, input, {
      getUser: (firmId, userId) => this.getUser(firmId, userId),
      listMattersForUser: (user) => this.listMattersForUser(user),
    });
  }

  async listPublicConsultationIntakes(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPublicConsultationIntakes"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listPublicConsultationIntakes"]> {
    return listDrizzlePublicConsultationIntakes(this.db, firmId, options);
  }

  async getPublicConsultationIntake(
    firmId: string,
    intakeId: string,
  ): ReturnType<OpenPracticeRepository["getPublicConsultationIntake"]> {
    return getDrizzlePublicConsultationIntake(this.db, firmId, intakeId);
  }

  async createPublicConsultationIntake(
    record: Parameters<OpenPracticeRepository["createPublicConsultationIntake"]>[0],
  ): ReturnType<OpenPracticeRepository["createPublicConsultationIntake"]> {
    return createDrizzlePublicConsultationIntake(this.db, record);
  }

  async updatePublicConsultationIntake(
    firmId: string,
    intakeId: string,
    updates: Parameters<OpenPracticeRepository["updatePublicConsultationIntake"]>[2],
  ): ReturnType<OpenPracticeRepository["updatePublicConsultationIntake"]> {
    return updateDrizzlePublicConsultationIntake(this.db, firmId, intakeId, updates);
  }

  async convertPublicConsultationIntakeToMatter(
    input: Parameters<OpenPracticeRepository["convertPublicConsultationIntakeToMatter"]>[0],
  ): ReturnType<OpenPracticeRepository["convertPublicConsultationIntakeToMatter"]> {
    return convertDrizzlePublicConsultationIntakeToMatter(this.db, input, {
      getUser: (firmId, userId) => this.getUser(firmId, userId),
      listMattersForUser: (user) => this.listMattersForUser(user),
    });
  }

  async listContactDossiersForUser(
    user: User,
  ): ReturnType<OpenPracticeRepository["listContactDossiersForUser"]> {
    return listDrizzleContactDossiersForUser(this.db, user, {
      listMattersForUser: (candidate) => this.listMattersForUser(candidate),
      listPortalGrants: (firmId) => this.listPortalGrants(firmId),
      listIntakeVariableProposals: (firmId, options) =>
        this.listIntakeVariableProposals(firmId, options),
    });
  }

  async createContactRelationship(
    relationship: Parameters<OpenPracticeRepository["createContactRelationship"]>[0],
  ): ReturnType<OpenPracticeRepository["createContactRelationship"]> {
    return createDrizzleContactRelationship(this.db, relationship);
  }

  async getContact(
    firmId: string,
    contactId: string,
  ): ReturnType<OpenPracticeRepository["getContact"]> {
    return getDrizzleContact(this.db, firmId, contactId);
  }

  async createContactDataQualityResolution(
    resolution: Parameters<OpenPracticeRepository["createContactDataQualityResolution"]>[0],
  ): ReturnType<OpenPracticeRepository["createContactDataQualityResolution"]> {
    return createDrizzleContactDataQualityResolution(this.db, resolution);
  }

  async listContactDataQualityResolutions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listContactDataQualityResolutions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listContactDataQualityResolutions"]> {
    return listDrizzleContactDataQualityResolutions(this.db, firmId, options);
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    return getDrizzleDocument(this.db, firmId, documentId);
  }

  async listMatterDocuments(firmId: string, matterId: string): Promise<DocumentRecord[]> {
    return listDrizzleMatterDocuments(this.db, firmId, matterId);
  }

  async listTaskDeadlines(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string; includeCompleted?: boolean } = {},
  ): Promise<TaskDeadlineRecord[]> {
    return listDrizzleTaskDeadlines(this.db, firmId, options);
  }

  async getTaskDeadline(firmId: string, taskId: string): Promise<TaskDeadlineRecord | undefined> {
    return getDrizzleTaskDeadline(this.db, firmId, taskId);
  }

  async createTaskDeadline(task: TaskDeadlineRecord): Promise<TaskDeadlineRecord> {
    return createDrizzleTaskDeadline(this.db, task);
  }

  async completeTaskDeadline(
    input: Parameters<OpenPracticeRepository["completeTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return completeDrizzleTaskDeadline(this.db, input);
  }

  async listConversationThreads(
    firmId: string,
    options: { matterIds?: string[]; matterId?: string } = {},
  ): Promise<ConversationThreadRecord[]> {
    return listDrizzleConversationThreads(this.db, firmId, options);
  }

  async getConversationThread(
    firmId: string,
    threadId: string,
  ): Promise<ConversationThreadRecord | undefined> {
    return getDrizzleConversationThread(this.db, firmId, threadId);
  }

  async createConversationThread(
    thread: ConversationThreadRecord,
  ): Promise<ConversationThreadRecord> {
    return createDrizzleConversationThread(this.db, thread);
  }

  async updateConversationThreadLifecycle(input: {
    firmId: string;
    threadId: string;
    action: Parameters<OpenPracticeRepository["updateConversationThreadLifecycle"]>[0]["action"];
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationThreadRecord | undefined> {
    return updateDrizzleConversationThreadLifecycle(this.db, input);
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
    return createDrizzleConversationMessageNotifications(this.db, input, {
      listUsers: (firmId) => this.listUsers(firmId),
    });
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
    return listDrizzleConversationMessageNotifications(this.db, firmId, options);
  }

  async updateConversationMessageNotificationPosture(input: {
    firmId: string;
    notificationId: string;
    action: "mark_read" | "mute" | "unmute";
    occurredAt: string;
    actorUserId: string;
  }): Promise<ConversationMessageNotificationRecord | undefined> {
    return updateDrizzleConversationMessageNotificationPosture(this.db, input);
  }

  async listConversationMessages(
    firmId: string,
    options: { threadId?: string; matterId?: string } = {},
  ): Promise<ConversationMessageRecord[]> {
    return listDrizzleConversationMessages(this.db, firmId, options);
  }

  async createConversationMessage(
    message: ConversationMessageRecord,
  ): Promise<ConversationMessageRecord> {
    return createDrizzleConversationMessage(this.db, message, {
      listUsers: (firmId) => this.listUsers(firmId),
    });
  }

  async listLegalClinicPrograms(
    firmId: string,
    options: { status?: LegalClinicProgram["status"] } = {},
  ): Promise<LegalClinicProgram[]> {
    return listDrizzleLegalClinicPrograms(this.db, firmId, options);
  }

  async createLegalClinicProgram(program: LegalClinicProgram): Promise<LegalClinicProgram> {
    return createDrizzleLegalClinicProgram(this.db, program);
  }

  async getLegalClinicMatterProfile(
    firmId: string,
    matterId: string,
  ): Promise<LegalClinicMatterProfile | undefined> {
    return getDrizzleLegalClinicMatterProfile(this.db, firmId, matterId);
  }

  async upsertLegalClinicMatterProfile(
    profile: LegalClinicMatterProfile,
  ): Promise<LegalClinicMatterProfile> {
    return upsertDrizzleLegalClinicMatterProfile(this.db, profile);
  }

  async listCalendarEvents(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarEvents"]>[1],
  ): ReturnType<OpenPracticeRepository["listCalendarEvents"]> {
    return listDrizzleCalendarEvents(this.db, firmId, options);
  }

  async getCalendarEvent(
    firmId: string,
    matterId: string,
    eventId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarEvent"]> {
    return getDrizzleCalendarEvent(this.db, firmId, matterId, eventId);
  }

  async getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): ReturnType<OpenPracticeRepository["getCalendarEventByUid"]> {
    return getDrizzleCalendarEventByUid(this.db, firmId, matterId, uid);
  }

  async upsertCalendarEvent(
    event: Parameters<OpenPracticeRepository["upsertCalendarEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertCalendarEvent"]> {
    return upsertDrizzleCalendarEvent(this.db, event);
  }

  async listCalendarEventAttendees(
    firmId: string,
    matterId: string,
    eventId: string,
  ): ReturnType<OpenPracticeRepository["listCalendarEventAttendees"]> {
    return listDrizzleCalendarEventAttendees(this.db, firmId, matterId, eventId);
  }

  async upsertCalendarEventAttendee(
    attendee: Parameters<OpenPracticeRepository["upsertCalendarEventAttendee"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertCalendarEventAttendee"]> {
    return upsertDrizzleCalendarEventAttendee(this.db, attendee);
  }

  async deleteCalendarEventAttendee(
    input: Parameters<OpenPracticeRepository["deleteCalendarEventAttendee"]>[0],
  ): ReturnType<OpenPracticeRepository["deleteCalendarEventAttendee"]> {
    return deleteDrizzleCalendarEventAttendee(this.db, input);
  }

  async replaceCalendarEventAttendees(
    input: Parameters<OpenPracticeRepository["replaceCalendarEventAttendees"]>[0],
  ): ReturnType<OpenPracticeRepository["replaceCalendarEventAttendees"]> {
    return replaceDrizzleCalendarEventAttendees(this.db, input);
  }

  async listCalendarEventReminders(
    firmId: string,
    matterId: string,
    eventId: string,
  ): ReturnType<OpenPracticeRepository["listCalendarEventReminders"]> {
    return listDrizzleCalendarEventReminders(this.db, firmId, matterId, eventId);
  }

  async upsertCalendarEventReminder(
    reminder: Parameters<OpenPracticeRepository["upsertCalendarEventReminder"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertCalendarEventReminder"]> {
    return upsertDrizzleCalendarEventReminder(this.db, reminder);
  }

  async createCalendarSchedulingRequest(
    request: Parameters<OpenPracticeRepository["createCalendarSchedulingRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarSchedulingRequest"]> {
    return createDrizzleCalendarSchedulingRequest(this.db, request);
  }

  async listCalendarSchedulingRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarSchedulingRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarSchedulingRequests"]> {
    return listDrizzleCalendarSchedulingRequests(this.db, firmId, options);
  }

  async deleteCalendarEventReminder(
    input: Parameters<OpenPracticeRepository["deleteCalendarEventReminder"]>[0],
  ): ReturnType<OpenPracticeRepository["deleteCalendarEventReminder"]> {
    return deleteDrizzleCalendarEventReminder(this.db, input);
  }

  async deleteCalendarEvent(
    input: Parameters<OpenPracticeRepository["deleteCalendarEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["deleteCalendarEvent"]> {
    return deleteDrizzleCalendarEvent(this.db, input);
  }

  async createCalendarCredential(
    credential: Parameters<OpenPracticeRepository["createCalendarCredential"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarCredential"]> {
    return createDrizzleCalendarCredential(this.db, credential);
  }

  async listCalendarCredentials(
    firmId: string,
    userId: string,
  ): ReturnType<OpenPracticeRepository["listCalendarCredentials"]> {
    return listDrizzleCalendarCredentials(this.db, firmId, userId);
  }

  async getCalendarCredentialByUsername(
    username: string,
  ): ReturnType<OpenPracticeRepository["getCalendarCredentialByUsername"]> {
    return getDrizzleCalendarCredentialByUsername(this.db, username);
  }

  async touchCalendarCredential(id: string, lastUsedAt: string): Promise<void> {
    await touchDrizzleCalendarCredential(this.db, id, lastUsedAt);
  }

  async revokeCalendarCredential(
    input: Parameters<OpenPracticeRepository["revokeCalendarCredential"]>[0],
  ): ReturnType<OpenPracticeRepository["revokeCalendarCredential"]> {
    return revokeDrizzleCalendarCredential(this.db, input);
  }

  async createCalendarMeetingSession(
    session: Parameters<OpenPracticeRepository["createCalendarMeetingSession"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarMeetingSession"]> {
    return createDrizzleCalendarMeetingSession(this.db, session);
  }

  async listCalendarMeetingSessions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarMeetingSessions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarMeetingSessions"]> {
    return listDrizzleCalendarMeetingSessions(this.db, firmId, options);
  }

  async getCalendarMeetingSession(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarMeetingSession"]> {
    return getDrizzleCalendarMeetingSession(this.db, firmId, matterId, eventId, sessionId);
  }

  async updateCalendarMeetingSessionStatus(
    input: Parameters<OpenPracticeRepository["updateCalendarMeetingSessionStatus"]>[0],
  ): ReturnType<OpenPracticeRepository["updateCalendarMeetingSessionStatus"]> {
    return updateDrizzleCalendarMeetingSessionStatus(this.db, input);
  }

  async createCalendarGuestLink(
    link: Parameters<OpenPracticeRepository["createCalendarGuestLink"]>[0],
  ): ReturnType<OpenPracticeRepository["createCalendarGuestLink"]> {
    return createDrizzleCalendarGuestLink(this.db, link);
  }

  async listCalendarGuestLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarGuestLinks"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarGuestLinks"]> {
    return listDrizzleCalendarGuestLinks(this.db, firmId, options);
  }

  async getCalendarGuestLink(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
    linkId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarGuestLink"]> {
    return getDrizzleCalendarGuestLink(this.db, firmId, matterId, eventId, sessionId, linkId);
  }

  async getCalendarGuestLinkByTokenHash(
    tokenHash: string,
  ): ReturnType<OpenPracticeRepository["getCalendarGuestLinkByTokenHash"]> {
    return getDrizzleCalendarGuestLinkByTokenHash(this.db, tokenHash);
  }

  async updateCalendarGuestLinkStatus(
    input: Parameters<OpenPracticeRepository["updateCalendarGuestLinkStatus"]>[0],
  ): ReturnType<OpenPracticeRepository["updateCalendarGuestLinkStatus"]> {
    return updateDrizzleCalendarGuestLinkStatus(this.db, input);
  }

  async revokeCalendarGuestLink(
    input: Parameters<OpenPracticeRepository["revokeCalendarGuestLink"]>[0],
  ): ReturnType<OpenPracticeRepository["revokeCalendarGuestLink"]> {
    return revokeDrizzleCalendarGuestLink(this.db, input);
  }

  async runConflictCheck(
    input: Parameters<OpenPracticeRepository["runConflictCheck"]>[0],
  ): ReturnType<OpenPracticeRepository["runConflictCheck"]> {
    return runDrizzleConflictCheck(this.db, input, {
      listContacts: (firmId) => this.listContacts(firmId),
      listMatterParties: (firmId) => this.listMatterParties(firmId),
      appendAuditEvent: (event) => this.appendAuditEvent(event),
      listAuditEvents: (firmId) => this.listAuditEvents(firmId),
    });
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): ReturnType<OpenPracticeRepository["getLedger"]> {
    return getDrizzleLedger(this.db, firmId, options);
  }

  async validateLedgerTransactionScope(
    input: Parameters<OpenPracticeRepository["validateLedgerTransactionScope"]>[0],
  ): ReturnType<OpenPracticeRepository["validateLedgerTransactionScope"]> {
    return validateDrizzleLedgerTransactionScope(this.db, input);
  }

  async postLedgerTransaction(
    transaction: Parameters<OpenPracticeRepository["postLedgerTransaction"]>[0],
  ): ReturnType<OpenPracticeRepository["postLedgerTransaction"]> {
    return postDrizzleLedgerTransaction(this.db, transaction);
  }

  async listAuditEvents(firmId: string): ReturnType<OpenPracticeRepository["listAuditEvents"]> {
    return listDrizzleAuditEvents(this.db, firmId);
  }

  async appendAuditEvent(
    event: Parameters<OpenPracticeRepository["appendAuditEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["appendAuditEvent"]> {
    return appendDrizzleAuditEvent(this.db, event);
  }

  async recordAuditEvent(
    event: Parameters<OpenPracticeRepository["recordAuditEvent"]>[0],
  ): ReturnType<OpenPracticeRepository["recordAuditEvent"]> {
    return recordDrizzleAuditEvent(this.db, event);
  }

  async listPortalGrants(firmId: string) {
    return listDrizzlePortalGrants(this.db, firmId);
  }

  async createPortalGrant(grant: Parameters<OpenPracticeRepository["createPortalGrant"]>[0]) {
    return createDrizzlePortalGrant(this.db, grant);
  }

  async listShareLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listShareLinks"]>[1] = {},
  ) {
    return listDrizzleShareLinks(this.db, firmId, options);
  }

  async createShareLink(link: Parameters<OpenPracticeRepository["createShareLink"]>[0]) {
    return createDrizzleShareLink(this.db, link);
  }

  async getShareLink(firmId: string, id: string) {
    return getDrizzleShareLink(this.db, firmId, id);
  }

  async getShareLinkByTokenHash(tokenHash: string) {
    return getDrizzleShareLinkByTokenHash(this.db, tokenHash);
  }

  async revokeShareLink(input: Parameters<OpenPracticeRepository["revokeShareLink"]>[0]) {
    return revokeDrizzleShareLink(this.db, input);
  }

  async listExternalUploadLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listExternalUploadLinks"]>[1] = {},
  ) {
    return listDrizzleExternalUploadLinks(this.db, firmId, options);
  }

  async createExternalUploadLink(
    link: Parameters<OpenPracticeRepository["createExternalUploadLink"]>[0],
  ) {
    return createDrizzleExternalUploadLink(this.db, link);
  }

  async listSavedOperationalViewDefinitions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listSavedOperationalViewDefinitions"]>[1],
  ) {
    return listDrizzleSavedOperationalViewDefinitions(this.db, firmId, options);
  }

  async getSavedOperationalViewDefinition(firmId: string, id: string) {
    return getDrizzleSavedOperationalViewDefinition(this.db, firmId, id);
  }

  async createSavedOperationalViewDefinition(
    input: Parameters<OpenPracticeRepository["createSavedOperationalViewDefinition"]>[0],
  ) {
    return createDrizzleSavedOperationalViewDefinition(this.db, input);
  }

  async updateSavedOperationalViewDefinition(
    firmId: string,
    id: string,
    updates: Parameters<OpenPracticeRepository["updateSavedOperationalViewDefinition"]>[2],
  ) {
    return updateDrizzleSavedOperationalViewDefinition(this.db, firmId, id, updates);
  }

  async archiveSavedOperationalViewDefinition(input: {
    firmId: string;
    id: string;
    archivedAt: string;
  }) {
    return archiveDrizzleSavedOperationalViewDefinition(this.db, input);
  }

  async getExternalUploadLinkByTokenHash(tokenHash: string) {
    return getDrizzleExternalUploadLinkByTokenHash(this.db, tokenHash);
  }

  async revokeExternalUploadLink(
    input: Parameters<OpenPracticeRepository["revokeExternalUploadLink"]>[0],
  ) {
    return revokeDrizzleExternalUploadLink(this.db, input);
  }

  async claimExternalUploadUse(
    input: Parameters<OpenPracticeRepository["claimExternalUploadUse"]>[0],
  ) {
    return claimDrizzleExternalUploadUse(this.db, input);
  }

  async createAccessLog(log: Parameters<OpenPracticeRepository["createAccessLog"]>[0]) {
    return createDrizzleAccessLog(this.db, log);
  }

  async listAccessLogs(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAccessLogs"]>[1] = {},
  ) {
    return listDrizzleAccessLogs(this.db, firmId, options);
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    return createDrizzleDocumentUploadIntent(this.db, input);
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    return completeDrizzleDocumentUpload(this.db, input);
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
    return reviewDrizzleUploadedDocument(this.db, input);
  }

  async updateDocumentScanStatus(input: {
    firmId: string;
    documentId: string;
    scanStatus: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    return updateDrizzleDocumentScanStatus(this.db, input);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): ReturnType<OpenPracticeRepository["listSignatureRequests"]> {
    return listDrizzleSignatureRequests(this.db, firmId, options);
  }

  async listSignatureRequestSigners(
    firmId: string,
    signatureRequestId: string,
  ): ReturnType<OpenPracticeRepository["listSignatureRequestSigners"]> {
    return listDrizzleSignatureRequestSigners(this.db, firmId, signatureRequestId);
  }

  async createSignatureRequest(
    input: Parameters<OpenPracticeRepository["createSignatureRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createSignatureRequest"]> {
    return createDrizzleSignatureRequest(this.db, input);
  }

  async recordSignatureProviderEvent(
    event: Parameters<OpenPracticeRepository["recordSignatureProviderEvent"]>[0],
    webhookAttempt?: Parameters<OpenPracticeRepository["recordSignatureProviderEvent"]>[1],
  ): ReturnType<OpenPracticeRepository["recordSignatureProviderEvent"]> {
    return recordDrizzleSignatureProviderEvent(this.db, event, webhookAttempt);
  }

  async recordSignatureWebhookAttempt(
    attempt: Parameters<OpenPracticeRepository["recordSignatureWebhookAttempt"]>[0],
  ): ReturnType<OpenPracticeRepository["recordSignatureWebhookAttempt"]> {
    return recordDrizzleSignatureWebhookAttempt(this.db, attempt);
  }

  async listSignatureProviderEvents(
    firmId: string,
    options: { signatureRequestId?: string } = {},
  ): ReturnType<OpenPracticeRepository["listSignatureProviderEvents"]> {
    return listDrizzleSignatureProviderEvents(this.db, firmId, options);
  }

  async listSignatureWebhookAttempts(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listSignatureWebhookAttempts"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listSignatureWebhookAttempts"]> {
    return listDrizzleSignatureWebhookAttempts(this.db, firmId, options);
  }

  async listIntakeTemplates(
    firmId: string,
  ): ReturnType<OpenPracticeRepository["listIntakeTemplates"]> {
    return listDrizzleIntakeTemplates(this.db, firmId);
  }

  async createIntakeTemplate(
    template: Parameters<OpenPracticeRepository["createIntakeTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeTemplate"]> {
    return createDrizzleIntakeTemplate(this.db, template);
  }

  async updateIntakeTemplate(
    template: Parameters<OpenPracticeRepository["updateIntakeTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["updateIntakeTemplate"]> {
    return updateDrizzleIntakeTemplate(this.db, template);
  }

  async listIntakeSessions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeSessions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeSessions"]> {
    return listDrizzleIntakeSessions(this.db, firmId, options);
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): ReturnType<OpenPracticeRepository["getIntakeSession"]> {
    return getDrizzleIntakeSession(this.db, firmId, sessionId);
  }

  async createIntakeSession(
    session: Parameters<OpenPracticeRepository["createIntakeSession"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeSession"]> {
    return createDrizzleIntakeSession(this.db, session);
  }

  async listIntakeFormLinks(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeFormLinks"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeFormLinks"]> {
    return listDrizzleIntakeFormLinks(this.db, firmId, options);
  }

  async createIntakeFormLink(
    link: Parameters<OpenPracticeRepository["createIntakeFormLink"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeFormLink"]> {
    return createDrizzleIntakeFormLink(this.db, link);
  }

  async getIntakeFormLink(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getIntakeFormLink"]> {
    return getDrizzleIntakeFormLink(this.db, firmId, id);
  }

  async getIntakeFormLinkByTokenHash(
    tokenHash: string,
  ): ReturnType<OpenPracticeRepository["getIntakeFormLinkByTokenHash"]> {
    return getDrizzleIntakeFormLinkByTokenHash(this.db, tokenHash);
  }

  async revokeIntakeFormLink(
    input: Parameters<OpenPracticeRepository["revokeIntakeFormLink"]>[0],
  ): ReturnType<OpenPracticeRepository["revokeIntakeFormLink"]> {
    return revokeDrizzleIntakeFormLink(this.db, input);
  }

  async markIntakeFormLinkSubmitted(
    input: Parameters<OpenPracticeRepository["markIntakeFormLinkSubmitted"]>[0],
  ): ReturnType<OpenPracticeRepository["markIntakeFormLinkSubmitted"]> {
    return markDrizzleIntakeFormLinkSubmitted(this.db, input);
  }

  async reserveIntakeFormLinkSubmission(
    input: Parameters<OpenPracticeRepository["reserveIntakeFormLinkSubmission"]>[0],
  ): ReturnType<OpenPracticeRepository["reserveIntakeFormLinkSubmission"]> {
    return reserveDrizzleIntakeFormLinkSubmission(this.db, input);
  }

  async saveIntakeFormLinkDraft(
    input: Parameters<OpenPracticeRepository["saveIntakeFormLinkDraft"]>[0],
  ): ReturnType<OpenPracticeRepository["saveIntakeFormLinkDraft"]> {
    return saveDrizzleIntakeFormLinkDraft(this.db, input);
  }

  async listIntakeFormReviews(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeFormReviews"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeFormReviews"]> {
    return listDrizzleIntakeFormReviews(this.db, firmId, options);
  }

  async createIntakeFormReview(
    review: Parameters<OpenPracticeRepository["createIntakeFormReview"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeFormReview"]> {
    return createDrizzleIntakeFormReview(this.db, review);
  }

  async listIntakeFormItemActions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeFormItemActions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeFormItemActions"]> {
    return listDrizzleIntakeFormItemActions(this.db, firmId, options);
  }

  async upsertIntakeFormItemAction(
    action: Parameters<OpenPracticeRepository["upsertIntakeFormItemAction"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertIntakeFormItemAction"]> {
    return upsertDrizzleIntakeFormItemAction(this.db, action);
  }

  async createAnswerSnapshot(
    snapshot: Parameters<OpenPracticeRepository["createAnswerSnapshot"]>[0],
  ): ReturnType<OpenPracticeRepository["createAnswerSnapshot"]> {
    return createDrizzleAnswerSnapshot(this.db, snapshot);
  }

  async listAnswerSnapshots(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAnswerSnapshots"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listAnswerSnapshots"]> {
    return listDrizzleAnswerSnapshots(this.db, firmId, options);
  }

  async createIntakeVariableProposals(
    proposals: Parameters<OpenPracticeRepository["createIntakeVariableProposals"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeVariableProposals"]> {
    return createDrizzleIntakeVariableProposals(this.db, proposals);
  }

  async listIntakeVariableProposals(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listIntakeVariableProposals"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listIntakeVariableProposals"]> {
    return listDrizzleIntakeVariableProposals(this.db, firmId, options);
  }

  async reviewIntakeVariableProposal(
    input: Parameters<OpenPracticeRepository["reviewIntakeVariableProposal"]>[0],
  ): ReturnType<OpenPracticeRepository["reviewIntakeVariableProposal"]> {
    return reviewDrizzleIntakeVariableProposal(this.db, input);
  }

  async listGeneratedDocuments(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listGeneratedDocuments"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listGeneratedDocuments"]> {
    return listDrizzleGeneratedDocuments(this.db, firmId, options);
  }

  async createGeneratedDocument(
    document: Parameters<OpenPracticeRepository["createGeneratedDocument"]>[0],
  ): ReturnType<OpenPracticeRepository["createGeneratedDocument"]> {
    return createDrizzleGeneratedDocument(this.db, document);
  }

  async listDocumentAssemblySetDefinitions(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listDocumentAssemblySetDefinitions"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listDocumentAssemblySetDefinitions"]> {
    return listDrizzleDocumentAssemblySetDefinitions(this.db, firmId, options);
  }

  async listDocumentAssemblyPackages(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listDocumentAssemblyPackages"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listDocumentAssemblyPackages"]> {
    return listDrizzleDocumentAssemblyPackages(this.db, firmId, options);
  }

  async listSignatureEnvelopes(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listSignatureEnvelopes"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listSignatureEnvelopes"]> {
    return listDrizzleSignatureEnvelopes(this.db, firmId, options);
  }

  async createLedgerTransactionApproval(
    approval: Parameters<OpenPracticeRepository["createLedgerTransactionApproval"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerTransactionApproval"]> {
    return createDrizzleLedgerTransactionApproval(this.db, approval);
  }

  async listLedgerTransactionApprovals(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerTransactionApprovals"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerTransactionApprovals"]> {
    return listDrizzleLedgerTransactionApprovals(this.db, firmId, options);
  }

  async createLedgerReconciliation(
    reconciliation: Parameters<OpenPracticeRepository["createLedgerReconciliation"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerReconciliation"]> {
    return createDrizzleLedgerReconciliation(this.db, reconciliation);
  }

  async listLedgerReconciliations(
    firmId: string,
  ): ReturnType<OpenPracticeRepository["listLedgerReconciliations"]> {
    return listDrizzleLedgerReconciliations(this.db, firmId);
  }

  async createLedgerStatementImportBatch(
    batch: Parameters<OpenPracticeRepository["createLedgerStatementImportBatch"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerStatementImportBatch"]> {
    return createDrizzleLedgerStatementImportBatch(this.db, batch);
  }

  async listLedgerStatementImportBatches(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerStatementImportBatches"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerStatementImportBatches"]> {
    return listDrizzleLedgerStatementImportBatches(this.db, firmId, options);
  }

  async createLedgerStatementMatchRuleProfile(
    profile: Parameters<OpenPracticeRepository["createLedgerStatementMatchRuleProfile"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerStatementMatchRuleProfile"]> {
    return createDrizzleLedgerStatementMatchRuleProfile(this.db, profile);
  }

  async listLedgerStatementMatchRuleProfiles(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerStatementMatchRuleProfiles"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerStatementMatchRuleProfiles"]> {
    return listDrizzleLedgerStatementMatchRuleProfiles(this.db, firmId, options);
  }

  async createLedgerAccountingReviewProfile(
    profile: Parameters<OpenPracticeRepository["createLedgerAccountingReviewProfile"]>[0],
  ): ReturnType<OpenPracticeRepository["createLedgerAccountingReviewProfile"]> {
    return createDrizzleLedgerAccountingReviewProfile(this.db, profile);
  }

  async listLedgerAccountingReviewProfiles(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerAccountingReviewProfiles"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerAccountingReviewProfiles"]> {
    return listDrizzleLedgerAccountingReviewProfiles(this.db, firmId, options);
  }

  async createLedgerReconciliationExceptionResolution(
    resolution: Parameters<
      OpenPracticeRepository["createLedgerReconciliationExceptionResolution"]
    >[0],
  ): ReturnType<OpenPracticeRepository["createLedgerReconciliationExceptionResolution"]> {
    return createDrizzleLedgerReconciliationExceptionResolution(this.db, resolution);
  }

  async listLedgerReconciliationExceptionResolutions(
    firmId: string,
    options: Parameters<
      OpenPracticeRepository["listLedgerReconciliationExceptionResolutions"]
    >[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerReconciliationExceptionResolutions"]> {
    return listDrizzleLedgerReconciliationExceptionResolutions(this.db, firmId, options);
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
    return rows.map(mapContactRow);
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
    options: Parameters<OpenPracticeRepository["listTimeEntries"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTimeEntries"]> {
    return listDrizzleTimeEntries(this.db, firmId, options);
  }

  async listBillingPeriodLocks(firmId: string): Promise<BillingPeriodLockRecord[]> {
    return listDrizzleBillingPeriodLocks(this.db, firmId);
  }

  async createBillingPeriodLock(lock: BillingPeriodLockRecord): Promise<BillingPeriodLockRecord> {
    return createDrizzleBillingPeriodLock(this.db, lock);
  }

  async listBillingRateRules(
    firmId: string,
    options: { activeOnly?: boolean; matterId?: string; userId?: string } = {},
  ): Promise<BillingRateRuleRecord[]> {
    return listDrizzleBillingRateRules(this.db, firmId, options);
  }

  async createBillingRateRule(rule: BillingRateRuleRecord): Promise<BillingRateRuleRecord> {
    return createDrizzleBillingRateRule(this.db, rule);
  }

  async getTimeEntry(
    firmId: string,
    entryId: string,
  ): ReturnType<OpenPracticeRepository["getTimeEntry"]> {
    return getDrizzleTimeEntry(this.db, firmId, entryId);
  }

  async createTimeEntry(
    entry: Parameters<OpenPracticeRepository["createTimeEntry"]>[0],
  ): ReturnType<OpenPracticeRepository["createTimeEntry"]> {
    return createDrizzleTimeEntry(this.db, entry);
  }

  async updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Parameters<OpenPracticeRepository["updateTimeEntry"]>[2],
  ): ReturnType<OpenPracticeRepository["updateTimeEntry"]> {
    return updateDrizzleTimeEntry(this.db, firmId, entryId, updates);
  }

  async listExpenseEntries(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listExpenseEntries"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listExpenseEntries"]> {
    return listDrizzleExpenseEntries(this.db, firmId, options);
  }

  async getExpenseEntry(
    firmId: string,
    entryId: string,
  ): ReturnType<OpenPracticeRepository["getExpenseEntry"]> {
    return getDrizzleExpenseEntry(this.db, firmId, entryId);
  }

  async createExpenseEntry(
    entry: Parameters<OpenPracticeRepository["createExpenseEntry"]>[0],
  ): ReturnType<OpenPracticeRepository["createExpenseEntry"]> {
    return createDrizzleExpenseEntry(this.db, entry);
  }

  async updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Parameters<OpenPracticeRepository["updateExpenseEntry"]>[2],
  ): ReturnType<OpenPracticeRepository["updateExpenseEntry"]> {
    return updateDrizzleExpenseEntry(this.db, firmId, entryId, updates);
  }

  async listInvoices(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listInvoices"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listInvoices"]> {
    return listDrizzleInvoices(this.db, firmId, options);
  }

  async getInvoice(
    firmId: string,
    invoiceId: string,
  ): ReturnType<OpenPracticeRepository["getInvoice"]> {
    return getDrizzleInvoice(this.db, firmId, invoiceId);
  }

  async createInvoice(
    input: Parameters<OpenPracticeRepository["createInvoice"]>[0],
  ): ReturnType<OpenPracticeRepository["createInvoice"]> {
    return createDrizzleInvoice(this.db, input);
  }

  async updateInvoice(
    invoice: Parameters<OpenPracticeRepository["updateInvoice"]>[0],
  ): ReturnType<OpenPracticeRepository["updateInvoice"]> {
    return updateDrizzleInvoice(this.db, invoice);
  }

  async createPayment(
    input: Parameters<OpenPracticeRepository["createPayment"]>[0],
  ): ReturnType<OpenPracticeRepository["createPayment"]> {
    return createDrizzlePayment(this.db, input);
  }

  async listPayments(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPayments"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listPayments"]> {
    return listDrizzlePayments(this.db, firmId, options);
  }

  async createHostedPaymentRequest(
    request: Parameters<OpenPracticeRepository["createHostedPaymentRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createHostedPaymentRequest"]> {
    return createDrizzleHostedPaymentRequest(this.db, request);
  }

  async getHostedPaymentRequest(
    firmId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getHostedPaymentRequest"]> {
    return getDrizzleHostedPaymentRequest(this.db, firmId, requestId);
  }

  async listHostedPaymentRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listHostedPaymentRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listHostedPaymentRequests"]> {
    return listDrizzleHostedPaymentRequests(this.db, firmId, options);
  }

  async updateHostedPaymentRequest(
    firmId: string,
    requestId: string,
    updates: Parameters<OpenPracticeRepository["updateHostedPaymentRequest"]>[2],
  ): ReturnType<OpenPracticeRepository["updateHostedPaymentRequest"]> {
    return updateDrizzleHostedPaymentRequest(this.db, firmId, requestId, updates);
  }

  async createTrustTransferRequest(
    request: Parameters<OpenPracticeRepository["createTrustTransferRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["createTrustTransferRequest"]> {
    return createDrizzleTrustTransferRequest(this.db, request);
  }

  async getTrustTransferRequest(
    firmId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getTrustTransferRequest"]> {
    return getDrizzleTrustTransferRequest(this.db, firmId, requestId);
  }

  async listTrustTransferRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTrustTransferRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTrustTransferRequests"]> {
    return listDrizzleTrustTransferRequests(this.db, firmId, options);
  }

  async updateTrustTransferRequest(
    firmId: string,
    requestId: string,
    updates: Parameters<OpenPracticeRepository["updateTrustTransferRequest"]>[2],
    options: Parameters<OpenPracticeRepository["updateTrustTransferRequest"]>[3] = {},
  ): ReturnType<OpenPracticeRepository["updateTrustTransferRequest"]> {
    return updateDrizzleTrustTransferRequest(this.db, firmId, requestId, updates, options);
  }

  async createDocumentTextExtraction(
    extraction: Parameters<OpenPracticeRepository["createDocumentTextExtraction"]>[0],
  ) {
    return createDrizzleDocumentTextExtraction(this.db, extraction);
  }

  async getDocumentTextExtractions(firmId: string, documentId: string) {
    return getDrizzleDocumentTextExtractions(this.db, firmId, documentId);
  }

  async listDrafts(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listDrafts"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listDrafts"]> {
    return listDrizzleDrafts(this.db, firmId, options);
  }

  async getDraft(firmId: string, draftId: string): ReturnType<OpenPracticeRepository["getDraft"]> {
    return getDrizzleDraft(this.db, firmId, draftId);
  }

  async createDraft(
    draft: Parameters<OpenPracticeRepository["createDraft"]>[0],
  ): ReturnType<OpenPracticeRepository["createDraft"]> {
    return createDrizzleDraft(this.db, draft);
  }

  async updateDraft(
    firmId: string,
    draftId: string,
    updates: Parameters<OpenPracticeRepository["updateDraft"]>[2],
  ): ReturnType<OpenPracticeRepository["updateDraft"]> {
    return updateDrizzleDraft(this.db, firmId, draftId, updates);
  }

  async deleteDraft(
    firmId: string,
    draftId: string,
  ): ReturnType<OpenPracticeRepository["deleteDraft"]> {
    return deleteDrizzleDraft(this.db, firmId, draftId);
  }

  async listDraftAssistRecords(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listDraftAssistRecords"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listDraftAssistRecords"]> {
    return listDrizzleDraftAssistRecords(this.db, firmId, options);
  }

  async getDraftAssistRecord(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getDraftAssistRecord"]> {
    return getDrizzleDraftAssistRecord(this.db, firmId, id);
  }

  async createDraftAssistRecord(
    record: Parameters<OpenPracticeRepository["createDraftAssistRecord"]>[0],
  ): ReturnType<OpenPracticeRepository["createDraftAssistRecord"]> {
    return createDrizzleDraftAssistRecord(this.db, record);
  }

  async updateDraftAssistRecord(
    record: Parameters<OpenPracticeRepository["updateDraftAssistRecord"]>[0],
  ): ReturnType<OpenPracticeRepository["updateDraftAssistRecord"]> {
    return updateDrizzleDraftAssistRecord(this.db, record);
  }

  async listAiOperationalProposals(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAiOperationalProposals"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listAiOperationalProposals"]> {
    return listDrizzleAiOperationalProposals(this.db, firmId, options);
  }

  async getAiOperationalProposal(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getAiOperationalProposal"]> {
    return getDrizzleAiOperationalProposal(this.db, firmId, id);
  }

  async createAiOperationalProposal(
    record: Parameters<OpenPracticeRepository["createAiOperationalProposal"]>[0],
  ): ReturnType<OpenPracticeRepository["createAiOperationalProposal"]> {
    return createDrizzleAiOperationalProposal(this.db, record);
  }

  async updateAiOperationalProposal(
    record: Parameters<OpenPracticeRepository["updateAiOperationalProposal"]>[0],
  ): ReturnType<OpenPracticeRepository["updateAiOperationalProposal"]> {
    return updateDrizzleAiOperationalProposal(this.db, record);
  }

  async listLegalResearchArtifacts(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLegalResearchArtifacts"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLegalResearchArtifacts"]> {
    return listDrizzleLegalResearchArtifacts(this.db, firmId, options);
  }

  async getLegalResearchArtifact(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getLegalResearchArtifact"]> {
    return getDrizzleLegalResearchArtifact(this.db, firmId, id);
  }

  async createLegalResearchArtifact(
    record: Parameters<OpenPracticeRepository["createLegalResearchArtifact"]>[0],
  ): ReturnType<OpenPracticeRepository["createLegalResearchArtifact"]> {
    return createDrizzleLegalResearchArtifact(this.db, record);
  }

  async updateLegalResearchArtifact(
    record: Parameters<OpenPracticeRepository["updateLegalResearchArtifact"]>[0],
  ): ReturnType<OpenPracticeRepository["updateLegalResearchArtifact"]> {
    return updateDrizzleLegalResearchArtifact(this.db, record);
  }

  async listDraftTemplates(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listDraftTemplates"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listDraftTemplates"]> {
    return listDrizzleDraftTemplates(this.db, firmId, options);
  }

  async createDraftTemplate(
    template: Parameters<OpenPracticeRepository["createDraftTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["createDraftTemplate"]> {
    return createDrizzleDraftTemplate(this.db, template);
  }

  async getInboundEmailAddressByAddress(
    firmId: string,
    address: string,
  ): Promise<InboundEmailAddressRecord | undefined> {
    return getDrizzleInboundEmailAddressByAddress(this.db, firmId, address);
  }

  async listInboundEmailAddresses(firmId: string): Promise<InboundEmailAddressRecord[]> {
    return listDrizzleInboundEmailAddresses(this.db, firmId);
  }

  async createInboundEmailAddress(
    address: InboundEmailAddressRecord,
  ): Promise<InboundEmailAddressRecord> {
    return createDrizzleInboundEmailAddress(this.db, address);
  }

  async listInboundEmailMessages(
    firmId: string,
    options: { matterId?: string; status?: InboundEmailMessageRecord["status"] } = {},
  ): Promise<InboundEmailMessageRecord[]> {
    return listDrizzleInboundEmailMessages(this.db, firmId, options);
  }

  async getInboundEmailMessage(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailMessageRecord | undefined> {
    return getDrizzleInboundEmailMessage(this.db, firmId, messageId);
  }

  async createInboundEmailMessage(
    message: InboundEmailMessageRecord,
  ): Promise<InboundEmailMessageRecord> {
    return createDrizzleInboundEmailMessage(this.db, message);
  }

  async updateInboundEmailMessage(
    firmId: string,
    messageId: string,
    updates: Partial<
      Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
    >,
  ): Promise<InboundEmailMessageRecord> {
    return updateDrizzleInboundEmailMessage(this.db, firmId, messageId, updates);
  }

  async createInboundEmailAttachment(
    attachment: InboundEmailAttachmentRecord,
  ): Promise<InboundEmailAttachmentRecord> {
    return createDrizzleInboundEmailAttachment(this.db, attachment);
  }

  async listInboundEmailAttachments(
    firmId: string,
    messageId: string,
  ): Promise<InboundEmailAttachmentRecord[]> {
    return listDrizzleInboundEmailAttachments(this.db, firmId, messageId);
  }

  async promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult> {
    return promoteDrizzleInboundEmailAttachmentToDocument(this.db, input);
  }
}

export { DrizzleOpenPracticeRepository as PostgresOpenPracticeRepository };
