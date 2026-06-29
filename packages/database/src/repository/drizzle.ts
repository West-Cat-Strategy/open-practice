import {
  type BillingPeriodLockRecord,
  type BillingRateRuleRecord,
  type Contact,
  type ConversationMessageRecord,
  type ConversationMessageNotificationRecord,
  type ConversationThreadRecord,
  type DocumentRecord,
  type EmailOutboxRecord,
  type InboundEmailAddressRecord,
  type InboundEmailAttachmentRecord,
  type InboundEmailMessageRecord,
  type LegalClinicMatterProfile,
  type LegalClinicProgram,
  type MatterParty,
  type PortalGrant,
  type TaskDeadlineRecord,
  type User,
} from "@open-practice/domain";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import type { EmailTemplateDraftRepository } from "./email-template-drafts-contracts.js";
import type { EmailJobsRepository } from "./jobs-email-contracts.js";
import type { FirmSettingsRepository } from "./firm-settings-contracts.js";
import type { ProviderSettingsRepository } from "./provider-settings-contracts.js";
import type { InvoiceWithLines } from "./billing-invoices-payments-contracts.js";
import { createDrizzleAuthRepository } from "./auth/drizzle.js";
import {
  appendDrizzleAuditEvent,
  listDrizzleFilteredAuditEvents,
  listDrizzleAuditEvents,
  recordDrizzleAuditEvent,
} from "./audit/drizzle.js";
import {
  createDrizzleAppointmentBookingLink,
  createDrizzleAppointmentBookingTentativeHold,
  getDrizzleAppointmentBookingLinkByTokenHash,
  getDrizzleAppointmentBookingProfile,
  getDrizzleAppointmentBookingRequest,
  listDrizzleAppointmentBookingProfiles,
  listDrizzleAppointmentBookingRequests,
  recordDrizzleAppointmentBookingAgingReviewDecision,
  reviewDrizzleAppointmentBookingRequest,
  upsertDrizzleAppointmentBookingProfile,
} from "./appointment-booking/drizzle.js";
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
  getDrizzleCalendarSchedulingRequest,
  getDrizzleCalendarGuestLink,
  getDrizzleCalendarGuestLinkByTokenHash,
  getDrizzleCalendarMeetingSession,
  listDrizzleCalendarEvents,
  listDrizzleCalendarEventAttendees,
  listDrizzleCalendarEventReminders,
  listDrizzleCalendarGuestLinks,
  listDrizzleCalendarMeetingSessions,
  listDrizzleCalendarSchedulingRequests,
  recordDrizzleCalendarSchedulingRequestAgingReviewDecision,
  replaceDrizzleCalendarEventAttendees,
  revokeDrizzleCalendarGuestLink,
  updateDrizzleCalendarGuestLinkStatus,
  updateDrizzleCalendarMeetingSessionStatus,
  updateDrizzleCalendarSchedulingRequestReview,
  upsertDrizzleCalendarEvent,
  upsertDrizzleCalendarEventAttendee,
  upsertDrizzleCalendarEventReminder,
} from "./calendar-events/drizzle.js";
import { runDrizzleConflictCheck } from "./conflict-checks/drizzle.js";
import {
  createDrizzleContact,
  createDrizzleContactDataQualityResolution,
  createDrizzleContactRelationship,
  createDrizzleMatterContactAssociation,
  getDrizzleContact,
  listDrizzleContactDataQualityResolutions,
  listDrizzleContactDossiersForUser,
  listDrizzleContactPortalGrantsForUser,
  listDrizzleContactsForUser,
  listDrizzleContactTimelineForUser,
  updateDrizzleContact,
  updateDrizzleContactRelationship,
  updateDrizzleMatterContactAssociation,
} from "./contacts/drizzle.js";
import {
  createDrizzleIntakeTemplateVersion,
  createDrizzleIntakeTemplate,
  getDrizzleIntakeTemplateVersion,
  getLatestDrizzleIntakeTemplateVersion,
  listDrizzleIntakeTemplates,
  listDrizzleIntakeTemplateVersions,
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
  createDrizzleBillingExpenseCategory,
  createDrizzleExpenseEntry,
  createDrizzleTimeEntry,
  getDrizzleBillingExpenseCategory,
  getDrizzleBillingExpenseCategoryByCode,
  getDrizzleExpenseEntry,
  getDrizzleTimeEntry,
  listDrizzleBillingExpenseCategories,
  listDrizzleExpenseEntries,
  listDrizzleTimeEntries,
  updateDrizzleBillingExpenseCategory,
  updateDrizzleExpenseEntry,
  updateDrizzleTimeEntry,
} from "./billing-entries/drizzle.js";
import {
  createDrizzleInvoice,
  createDrizzlePayment,
  getDrizzleInvoice,
  listDrizzleInvoices,
  listDrizzlePayments,
  reconcileDrizzlePayment,
  updateDrizzleInvoice,
} from "./billing-invoices-payments/drizzle.js";
import {
  createDrizzleHostedPaymentRequest,
  getDrizzleHostedPaymentRequest,
  listDrizzleHostedPaymentRequests,
  updateDrizzleHostedPaymentRequest,
} from "./hosted-payment-requests/drizzle.js";
import {
  createDrizzlePaymentImportDepositMatchReview,
  createDrizzlePaymentImportReviewRecord,
  getDrizzlePaymentImportReviewRecord,
  listDrizzlePaymentImportDepositMatchReviews,
  listDrizzlePaymentImportReviewRecords,
} from "./payment-import-review-records/drizzle.js";
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
  approveDrizzleLedgerPostingRequest,
  getDrizzleLedgerPostingRequest,
  listDrizzleLedgerPostingRequests,
  prepareDrizzleLedgerPostingRequest,
  rejectDrizzleLedgerPostingRequest,
} from "./ledger-posting-requests/drizzle.js";
import {
  getDrizzleMatterWorkspaceOverview,
  listDrizzleMatterWorkspaceMattersForUser,
} from "./matter-workspace/drizzle.js";
import {
  convertDrizzlePublicConsultationIntakeToMatter,
  createDrizzleMatterLifecycleTransition,
  createDrizzleMatterWithClient,
  executeDrizzleMatterLifecycleCommand,
  listDrizzleMatterLifecycleTransitions,
} from "./matter-lifecycle/drizzle.js";
import {
  completeDrizzleFirstRunSetup,
  getDrizzleSetupStatus,
  resolveDrizzleConfiguredFirm,
} from "./setup/drizzle.js";

import {
  mapCalendarEventRow,
  mapCalendarGuestLinkRow,
  mapContactRelationshipRow,
  mapContactRow,
  mapConversationThreadRow,
  mapDocumentRow,
  mapEmailOutboxRow,
  mapEmailReceiptTokenRow,
  mapExternalUploadLinkRow,
  mapHostedPaymentRequestRow,
  mapIntakeFormItemActionRow,
  mapIntakeFormLinkRow,
  mapInvoiceLineRow,
  mapInvoiceRow,
  mapMatterPartyRow,
  mapPortalDocumentAccessRow,
  mapShareLinkRow,
  mapSignatureProviderEventRow,
  mapSignatureRequestRow,
  mapSignatureRequestSignerRow,
} from "./drizzle-mappers.js";
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
  recordDrizzleDocumentRetentionHoldReviewDecision,
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
  archiveDrizzleTaskChecklistItem,
  archiveDrizzleTaskComment,
  archiveDrizzleTaskDeadline,
  archiveDrizzleTaskDependency,
  archiveDrizzleTaskTemplate,
  completeDrizzleTaskDeadline,
  createDrizzleTaskChecklistItem,
  createDrizzleTaskComment,
  createDrizzleTaskDeadline,
  createDrizzleTaskDependency,
  createDrizzleTaskTemplate,
  getDrizzleTaskChecklistItem,
  getDrizzleTaskComment,
  getDrizzleTaskDeadline,
  getDrizzleTaskDependency,
  getDrizzleTaskTemplate,
  listDrizzleTaskChecklistItems,
  listDrizzleTaskComments,
  listDrizzleTaskDeadlines,
  listDrizzleTaskDependencies,
  listDrizzleTaskTemplateItems,
  listDrizzleTaskTemplates,
  reopenDrizzleTaskDeadline,
  updateDrizzleTaskChecklistItem,
  updateDrizzleTaskDeadline,
  updateDrizzleTaskTemplate,
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
  getDrizzleSignatureRequest,
  listDrizzleSignatureProviderEvents,
  listDrizzleSignatureRequests,
  listDrizzleSignatureRequestSigners,
  listDrizzleSignatureWebhookAttempts,
  recordDrizzleSignatureProviderEvent,
  recordDrizzleSignatureWebhookAttempt,
} from "./signatures/drizzle.js";
import { createDrizzleConnectorRepository } from "./connectors/drizzle.js";
import { createDrizzleEmailTemplateDraftRepository } from "./email-template-drafts/drizzle.js";
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
  createDrizzlePortalDocumentAccess,
  createDrizzlePortalGrant,
  createDrizzleShareLink,
  getDrizzleExternalUploadLinkByTokenHash,
  getDrizzleShareLink,
  getDrizzleShareLinkByTokenHash,
  listDrizzleAccessLogs,
  listDrizzleExternalUploadLinks,
  listDrizzlePortalDocumentAccess,
  listDrizzlePortalGrants,
  listDrizzleShareLinks,
  mapPortalGrantRow,
  revokeDrizzlePortalDocumentAccess,
  revokeDrizzleExternalUploadLink,
  revokeDrizzleShareLink,
  updateDrizzlePortalGrant,
} from "./portal-access/drizzle.js";

function normalizedPortalEmail(value: string): string {
  return value.trim().toLowerCase();
}

function portalContactEmail(contact: Contact): string | undefined {
  return contact.identifiers.find((identifier) => identifier.type === "email")?.value;
}

function activeClientPortalGrant(grant: PortalGrant, now: string): boolean {
  if (["suspended", "revoked", "expired"].includes(grant.status ?? "active")) return false;
  if (grant.revokedAt) return false;
  if (grant.suspendedAt) return false;
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return false;
  return true;
}

function clientPortalGrantMatchesUser(input: {
  grant: PortalGrant;
  contact: Contact;
  userId: string;
  userEmail: string;
}): boolean {
  if (input.grant.accountUserId) return input.grant.accountUserId === input.userId;
  const email = portalContactEmail(input.contact);
  return Boolean(email && normalizedPortalEmail(email) === normalizedPortalEmail(input.userEmail));
}

function limitEmailsPerMatter(
  emails: EmailOutboxRecord[],
  limitPerMatter: number,
): EmailOutboxRecord[] {
  if (limitPerMatter <= 0) return [];
  const countsByMatterId = new Map<string, number>();
  return emails.filter((email) => {
    if (!email.matterId) return false;
    const count = countsByMatterId.get(email.matterId) ?? 0;
    if (count >= limitPerMatter) return false;
    countsByMatterId.set(email.matterId, count + 1);
    return true;
  });
}

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
  declare reconcileCalendarReminderDelivery: EmailJobsRepository["reconcileCalendarReminderDelivery"];
  declare listEmailEvents: EmailJobsRepository["listEmailEvents"];
  declare createEmailReceiptToken: EmailJobsRepository["createEmailReceiptToken"];
  declare getEmailReceiptTokenByHash: EmailJobsRepository["getEmailReceiptTokenByHash"];
  declare recordEmailReceiptToken: EmailJobsRepository["recordEmailReceiptToken"];
  declare listEmailReceiptTokens: EmailJobsRepository["listEmailReceiptTokens"];
  declare updateJobLifecycleRecord: EmailJobsRepository["updateJobLifecycleRecord"];
  declare listJobLifecycleRecords: EmailJobsRepository["listJobLifecycleRecords"];
  declare listEmailTemplateDrafts: EmailTemplateDraftRepository["listEmailTemplateDrafts"];
  declare getEmailTemplateDraft: EmailTemplateDraftRepository["getEmailTemplateDraft"];
  declare createEmailTemplateDraft: EmailTemplateDraftRepository["createEmailTemplateDraft"];
  declare updateEmailTemplateDraft: EmailTemplateDraftRepository["updateEmailTemplateDraft"];
  declare createEmailTemplatePreviewSnapshot: EmailTemplateDraftRepository["createEmailTemplatePreviewSnapshot"];
  declare listEmailTemplatePreviewSnapshots: EmailTemplateDraftRepository["listEmailTemplatePreviewSnapshots"];
  declare createEmailTemplatePublishedVersion: EmailTemplateDraftRepository["createEmailTemplatePublishedVersion"];
  declare listEmailTemplatePublishedVersions: EmailTemplateDraftRepository["listEmailTemplatePublishedVersions"];
  declare getLatestEmailTemplatePublishedVersion: EmailTemplateDraftRepository["getLatestEmailTemplatePublishedVersion"];
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
    Object.assign(this, createDrizzleEmailTemplateDraftRepository(db));
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
    return completeDrizzleFirstRunSetup(this.db, input, this.options.providerConfigCipher);
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

  async listMatterLifecycleTransitions(
    firmId: string,
    matterId: string,
  ): ReturnType<OpenPracticeRepository["listMatterLifecycleTransitions"]> {
    return listDrizzleMatterLifecycleTransitions(this.db, firmId, matterId);
  }

  async createMatterLifecycleTransition(
    input: Parameters<OpenPracticeRepository["createMatterLifecycleTransition"]>[0],
  ): ReturnType<OpenPracticeRepository["createMatterLifecycleTransition"]> {
    return createDrizzleMatterLifecycleTransition(this.db, input);
  }

  async executeMatterLifecycleCommand(
    input: Parameters<OpenPracticeRepository["executeMatterLifecycleCommand"]>[0],
  ): ReturnType<OpenPracticeRepository["executeMatterLifecycleCommand"]> {
    return executeDrizzleMatterLifecycleCommand(this.db, input, {
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
      listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
      listCalendarSchedulingRequests: (firmId, options) =>
        this.listCalendarSchedulingRequests(firmId, options),
      listIntakeVariableProposals: (firmId, options) =>
        this.listIntakeVariableProposals(firmId, options),
    });
  }

  async listContactsForUser(
    user: User,
    options: Parameters<OpenPracticeRepository["listContactsForUser"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listContactsForUser"]> {
    return listDrizzleContactsForUser(
      this.db,
      user,
      {
        listMattersForUser: (candidate) => this.listMattersForUser(candidate),
        listPortalGrants: (firmId) => this.listPortalGrants(firmId),
        listTaskDeadlines: (firmId, taskOptions) => this.listTaskDeadlines(firmId, taskOptions),
        listCalendarSchedulingRequests: (firmId, schedulingOptions) =>
          this.listCalendarSchedulingRequests(firmId, schedulingOptions),
        listIntakeVariableProposals: (firmId, proposalOptions) =>
          this.listIntakeVariableProposals(firmId, proposalOptions),
      },
      options,
    );
  }

  async createContact(
    contact: Parameters<OpenPracticeRepository["createContact"]>[0],
  ): ReturnType<OpenPracticeRepository["createContact"]> {
    return createDrizzleContact(this.db, contact);
  }

  async updateContact(
    input: Parameters<OpenPracticeRepository["updateContact"]>[0],
  ): ReturnType<OpenPracticeRepository["updateContact"]> {
    return updateDrizzleContact(this.db, input);
  }

  async createContactRelationship(
    relationship: Parameters<OpenPracticeRepository["createContactRelationship"]>[0],
  ): ReturnType<OpenPracticeRepository["createContactRelationship"]> {
    return createDrizzleContactRelationship(this.db, relationship);
  }

  async updateContactRelationship(
    input: Parameters<OpenPracticeRepository["updateContactRelationship"]>[0],
  ): ReturnType<OpenPracticeRepository["updateContactRelationship"]> {
    return updateDrizzleContactRelationship(this.db, input);
  }

  async createMatterContactAssociation(
    party: Parameters<OpenPracticeRepository["createMatterContactAssociation"]>[0],
  ): ReturnType<OpenPracticeRepository["createMatterContactAssociation"]> {
    return createDrizzleMatterContactAssociation(this.db, party);
  }

  async updateMatterContactAssociation(
    input: Parameters<OpenPracticeRepository["updateMatterContactAssociation"]>[0],
  ): ReturnType<OpenPracticeRepository["updateMatterContactAssociation"]> {
    return updateDrizzleMatterContactAssociation(this.db, input);
  }

  async getContact(
    firmId: string,
    contactId: string,
  ): ReturnType<OpenPracticeRepository["getContact"]> {
    return getDrizzleContact(this.db, firmId, contactId);
  }

  async listContactPortalGrantsForUser(
    user: User,
    contactId: string,
    context?: Parameters<OpenPracticeRepository["listContactPortalGrantsForUser"]>[2],
  ): ReturnType<OpenPracticeRepository["listContactPortalGrantsForUser"]> {
    return listDrizzleContactPortalGrantsForUser(
      this.db,
      user,
      contactId,
      {
        listMattersForUser: (candidate) => this.listMattersForUser(candidate),
        listPortalGrants: (firmId) => this.listPortalGrants(firmId),
        listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
        listCalendarSchedulingRequests: (firmId, options) =>
          this.listCalendarSchedulingRequests(firmId, options),
        listIntakeVariableProposals: (firmId, options) =>
          this.listIntakeVariableProposals(firmId, options),
      },
      context,
    );
  }

  async listContactTimelineForUser(
    user: User,
    contactId: string,
    context?: Parameters<OpenPracticeRepository["listContactTimelineForUser"]>[2],
  ): ReturnType<OpenPracticeRepository["listContactTimelineForUser"]> {
    return listDrizzleContactTimelineForUser(
      this.db,
      user,
      contactId,
      {
        listMattersForUser: (candidate) => this.listMattersForUser(candidate),
        listPortalGrants: (firmId) => this.listPortalGrants(firmId),
        listTaskDeadlines: (firmId, options) => this.listTaskDeadlines(firmId, options),
        listCalendarSchedulingRequests: (firmId, options) =>
          this.listCalendarSchedulingRequests(firmId, options),
        listIntakeVariableProposals: (firmId, options) =>
          this.listIntakeVariableProposals(firmId, options),
      },
      context,
    );
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
    options: Parameters<OpenPracticeRepository["listTaskDeadlines"]>[1] = {},
  ): Promise<TaskDeadlineRecord[]> {
    return listDrizzleTaskDeadlines(this.db, firmId, options);
  }

  async getTaskDeadline(
    firmId: string,
    taskId: string,
    options: Parameters<OpenPracticeRepository["getTaskDeadline"]>[2] = {},
  ): Promise<TaskDeadlineRecord | undefined> {
    return getDrizzleTaskDeadline(this.db, firmId, taskId, options);
  }

  async createTaskDeadline(
    task: Parameters<OpenPracticeRepository["createTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord> {
    return createDrizzleTaskDeadline(this.db, task);
  }

  async updateTaskDeadline(
    input: Parameters<OpenPracticeRepository["updateTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return updateDrizzleTaskDeadline(this.db, input);
  }

  async completeTaskDeadline(
    input: Parameters<OpenPracticeRepository["completeTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return completeDrizzleTaskDeadline(this.db, input);
  }

  async reopenTaskDeadline(
    input: Parameters<OpenPracticeRepository["reopenTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return reopenDrizzleTaskDeadline(this.db, input);
  }

  async archiveTaskDeadline(
    input: Parameters<OpenPracticeRepository["archiveTaskDeadline"]>[0],
  ): Promise<TaskDeadlineRecord | undefined> {
    return archiveDrizzleTaskDeadline(this.db, input);
  }

  async listTaskChecklistItems(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTaskChecklistItems"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTaskChecklistItems"]> {
    return listDrizzleTaskChecklistItems(this.db, firmId, options);
  }

  async getTaskChecklistItem(
    firmId: string,
    itemId: string,
    options: Parameters<OpenPracticeRepository["getTaskChecklistItem"]>[2] = {},
  ): ReturnType<OpenPracticeRepository["getTaskChecklistItem"]> {
    return getDrizzleTaskChecklistItem(this.db, firmId, itemId, options);
  }

  async createTaskChecklistItem(
    input: Parameters<OpenPracticeRepository["createTaskChecklistItem"]>[0],
  ): ReturnType<OpenPracticeRepository["createTaskChecklistItem"]> {
    return createDrizzleTaskChecklistItem(this.db, input);
  }

  async updateTaskChecklistItem(
    input: Parameters<OpenPracticeRepository["updateTaskChecklistItem"]>[0],
  ): ReturnType<OpenPracticeRepository["updateTaskChecklistItem"]> {
    return updateDrizzleTaskChecklistItem(this.db, input);
  }

  async archiveTaskChecklistItem(
    input: Parameters<OpenPracticeRepository["archiveTaskChecklistItem"]>[0],
  ): ReturnType<OpenPracticeRepository["archiveTaskChecklistItem"]> {
    return archiveDrizzleTaskChecklistItem(this.db, input);
  }

  async listTaskComments(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTaskComments"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTaskComments"]> {
    return listDrizzleTaskComments(this.db, firmId, options);
  }

  async getTaskComment(
    firmId: string,
    commentId: string,
    options: Parameters<OpenPracticeRepository["getTaskComment"]>[2] = {},
  ): ReturnType<OpenPracticeRepository["getTaskComment"]> {
    return getDrizzleTaskComment(this.db, firmId, commentId, options);
  }

  async createTaskComment(
    input: Parameters<OpenPracticeRepository["createTaskComment"]>[0],
  ): ReturnType<OpenPracticeRepository["createTaskComment"]> {
    return createDrizzleTaskComment(this.db, input);
  }

  async archiveTaskComment(
    input: Parameters<OpenPracticeRepository["archiveTaskComment"]>[0],
  ): ReturnType<OpenPracticeRepository["archiveTaskComment"]> {
    return archiveDrizzleTaskComment(this.db, input);
  }

  async listTaskDependencies(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTaskDependencies"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTaskDependencies"]> {
    return listDrizzleTaskDependencies(this.db, firmId, options);
  }

  async getTaskDependency(
    firmId: string,
    dependencyId: string,
    options: Parameters<OpenPracticeRepository["getTaskDependency"]>[2] = {},
  ): ReturnType<OpenPracticeRepository["getTaskDependency"]> {
    return getDrizzleTaskDependency(this.db, firmId, dependencyId, options);
  }

  async createTaskDependency(
    input: Parameters<OpenPracticeRepository["createTaskDependency"]>[0],
  ): ReturnType<OpenPracticeRepository["createTaskDependency"]> {
    return createDrizzleTaskDependency(this.db, input);
  }

  async archiveTaskDependency(
    input: Parameters<OpenPracticeRepository["archiveTaskDependency"]>[0],
  ): ReturnType<OpenPracticeRepository["archiveTaskDependency"]> {
    return archiveDrizzleTaskDependency(this.db, input);
  }

  async listTaskTemplates(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTaskTemplates"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTaskTemplates"]> {
    return listDrizzleTaskTemplates(this.db, firmId, options);
  }

  async getTaskTemplate(
    firmId: string,
    templateId: string,
    options: Parameters<OpenPracticeRepository["getTaskTemplate"]>[2] = {},
  ): ReturnType<OpenPracticeRepository["getTaskTemplate"]> {
    return getDrizzleTaskTemplate(this.db, firmId, templateId, options);
  }

  async listTaskTemplateItems(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listTaskTemplateItems"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listTaskTemplateItems"]> {
    return listDrizzleTaskTemplateItems(this.db, firmId, options);
  }

  async createTaskTemplate(
    input: Parameters<OpenPracticeRepository["createTaskTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["createTaskTemplate"]> {
    return createDrizzleTaskTemplate(this.db, input);
  }

  async updateTaskTemplate(
    input: Parameters<OpenPracticeRepository["updateTaskTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["updateTaskTemplate"]> {
    return updateDrizzleTaskTemplate(this.db, input);
  }

  async archiveTaskTemplate(
    input: Parameters<OpenPracticeRepository["archiveTaskTemplate"]>[0],
  ): ReturnType<OpenPracticeRepository["archiveTaskTemplate"]> {
    return archiveDrizzleTaskTemplate(this.db, input);
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
    options: Parameters<OpenPracticeRepository["listConversationMessageNotifications"]>[1] = {},
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
    options: Parameters<OpenPracticeRepository["listConversationMessages"]>[1] = {},
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
    matterId: string | undefined,
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
    matterId: string | undefined,
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

  async getCalendarSchedulingRequest(
    firmId: string,
    matterId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getCalendarSchedulingRequest"]> {
    return getDrizzleCalendarSchedulingRequest(this.db, firmId, matterId, requestId);
  }

  async updateCalendarSchedulingRequestReview(
    input: Parameters<OpenPracticeRepository["updateCalendarSchedulingRequestReview"]>[0],
  ): ReturnType<OpenPracticeRepository["updateCalendarSchedulingRequestReview"]> {
    return updateDrizzleCalendarSchedulingRequestReview(this.db, input);
  }

  async recordCalendarSchedulingRequestAgingReviewDecision(
    input: Parameters<
      OpenPracticeRepository["recordCalendarSchedulingRequestAgingReviewDecision"]
    >[0],
  ): ReturnType<OpenPracticeRepository["recordCalendarSchedulingRequestAgingReviewDecision"]> {
    return recordDrizzleCalendarSchedulingRequestAgingReviewDecision(this.db, input);
  }

  async listCalendarSchedulingRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listCalendarSchedulingRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listCalendarSchedulingRequests"]> {
    return listDrizzleCalendarSchedulingRequests(this.db, firmId, options);
  }

  async listAppointmentBookingProfiles(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAppointmentBookingProfiles"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listAppointmentBookingProfiles"]> {
    return listDrizzleAppointmentBookingProfiles(this.db, firmId, options);
  }

  async getAppointmentBookingProfile(
    firmId: string,
    profileId: string,
  ): ReturnType<OpenPracticeRepository["getAppointmentBookingProfile"]> {
    return getDrizzleAppointmentBookingProfile(this.db, firmId, profileId);
  }

  async upsertAppointmentBookingProfile(
    profile: Parameters<OpenPracticeRepository["upsertAppointmentBookingProfile"]>[0],
  ): ReturnType<OpenPracticeRepository["upsertAppointmentBookingProfile"]> {
    return upsertDrizzleAppointmentBookingProfile(this.db, profile);
  }

  async createAppointmentBookingLink(
    link: Parameters<OpenPracticeRepository["createAppointmentBookingLink"]>[0],
  ): ReturnType<OpenPracticeRepository["createAppointmentBookingLink"]> {
    return createDrizzleAppointmentBookingLink(this.db, link);
  }

  async getAppointmentBookingLinkByTokenHash(
    tokenHash: string,
  ): ReturnType<OpenPracticeRepository["getAppointmentBookingLinkByTokenHash"]> {
    return getDrizzleAppointmentBookingLinkByTokenHash(this.db, tokenHash);
  }

  async listAppointmentBookingRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listAppointmentBookingRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listAppointmentBookingRequests"]> {
    return listDrizzleAppointmentBookingRequests(this.db, firmId, options);
  }

  async getAppointmentBookingRequest(
    firmId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getAppointmentBookingRequest"]> {
    return getDrizzleAppointmentBookingRequest(this.db, firmId, requestId);
  }

  async createAppointmentBookingTentativeHold(
    input: Parameters<OpenPracticeRepository["createAppointmentBookingTentativeHold"]>[0],
  ): ReturnType<OpenPracticeRepository["createAppointmentBookingTentativeHold"]> {
    return createDrizzleAppointmentBookingTentativeHold(this.db, input);
  }

  async reviewAppointmentBookingRequest(
    input: Parameters<OpenPracticeRepository["reviewAppointmentBookingRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["reviewAppointmentBookingRequest"]> {
    return reviewDrizzleAppointmentBookingRequest(this.db, input);
  }

  async recordAppointmentBookingAgingReviewDecision(
    input: Parameters<OpenPracticeRepository["recordAppointmentBookingAgingReviewDecision"]>[0],
  ): ReturnType<OpenPracticeRepository["recordAppointmentBookingAgingReviewDecision"]> {
    return recordDrizzleAppointmentBookingAgingReviewDecision(this.db, input);
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
      listContactRelationships: (firmId) => this.listContactRelationships(firmId),
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

  async prepareLedgerPostingRequest(
    request: Parameters<OpenPracticeRepository["prepareLedgerPostingRequest"]>[0],
  ): ReturnType<OpenPracticeRepository["prepareLedgerPostingRequest"]> {
    return prepareDrizzleLedgerPostingRequest(this.db, request);
  }

  async getLedgerPostingRequest(
    firmId: string,
    requestId: string,
  ): ReturnType<OpenPracticeRepository["getLedgerPostingRequest"]> {
    return getDrizzleLedgerPostingRequest(this.db, firmId, requestId);
  }

  async listLedgerPostingRequests(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listLedgerPostingRequests"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listLedgerPostingRequests"]> {
    return listDrizzleLedgerPostingRequests(this.db, firmId, options);
  }

  async approveLedgerPostingRequest(
    firmId: string,
    requestId: string,
    input: Parameters<OpenPracticeRepository["approveLedgerPostingRequest"]>[2],
  ): ReturnType<OpenPracticeRepository["approveLedgerPostingRequest"]> {
    return approveDrizzleLedgerPostingRequest(this.db, firmId, requestId, input);
  }

  async rejectLedgerPostingRequest(
    firmId: string,
    requestId: string,
    input: Parameters<OpenPracticeRepository["rejectLedgerPostingRequest"]>[2],
  ): ReturnType<OpenPracticeRepository["rejectLedgerPostingRequest"]> {
    return rejectDrizzleLedgerPostingRequest(this.db, firmId, requestId, input);
  }

  async listAuditEvents(firmId: string): ReturnType<OpenPracticeRepository["listAuditEvents"]> {
    return listDrizzleAuditEvents(this.db, firmId);
  }

  async listFilteredAuditEvents(
    firmId: string,
    filter: Parameters<OpenPracticeRepository["listFilteredAuditEvents"]>[1],
  ): ReturnType<OpenPracticeRepository["listFilteredAuditEvents"]> {
    return listDrizzleFilteredAuditEvents(this.db, firmId, filter);
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

  async listClientPortalGrantContactPairs(
    input: Parameters<OpenPracticeRepository["listClientPortalGrantContactPairs"]>[0],
  ): ReturnType<OpenPracticeRepository["listClientPortalGrantContactPairs"]> {
    const rows = await this.db
      .select({ grant: schema.portalGrants, contact: schema.contacts })
      .from(schema.portalGrants)
      .innerJoin(
        schema.contacts,
        and(
          eq(schema.contacts.firmId, schema.portalGrants.firmId),
          eq(schema.contacts.id, schema.portalGrants.contactId),
        ),
      )
      .where(eq(schema.portalGrants.firmId, input.firmId));
    return rows.flatMap((row) => {
      const grant = mapPortalGrantRow(row.grant);
      const contact = mapContactRow(row.contact);
      if (!activeClientPortalGrant(grant, input.now)) return [];
      return clientPortalGrantMatchesUser({
        grant,
        contact,
        userId: input.userId,
        userEmail: input.userEmail,
      })
        ? [{ grant, contact }]
        : [];
    });
  }

  async listClientPortalWorkspaceBatch(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listClientPortalWorkspaceBatch"]>[1],
  ): ReturnType<OpenPracticeRepository["listClientPortalWorkspaceBatch"]> {
    const matterIds = [...new Set(options.matterIds)];
    if (matterIds.length === 0) {
      return {
        intakeLinks: [],
        itemActions: [],
        emails: [],
        receiptTokens: [],
        shareLinks: [],
        externalUploadLinks: [],
        documents: [],
        guestLinks: [],
        calendarEvents: [],
        conversationThreads: [],
        invoices: [],
        paymentRequests: [],
        portalDocumentAccess: [],
        signatureRequests: [],
        signatureSigners: [],
        signatureEvents: [],
      };
    }

    const [
      intakeLinkRows,
      itemActionRows,
      emailRows,
      receiptTokenRows,
      shareLinkRows,
      externalUploadLinkRows,
      documentRows,
      guestLinkRows,
      calendarEventRows,
      conversationThreadRows,
      invoiceRows,
      paymentRequestRows,
      portalDocumentAccessRows,
      signatureRequestRows,
    ] = await Promise.all([
      this.db
        .select()
        .from(schema.intakeFormLinks)
        .where(
          and(
            eq(schema.intakeFormLinks.firmId, firmId),
            inArray(schema.intakeFormLinks.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.intakeFormItemActions)
        .where(
          and(
            eq(schema.intakeFormItemActions.firmId, firmId),
            inArray(schema.intakeFormItemActions.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.emailOutbox)
        .where(
          and(
            eq(schema.emailOutbox.firmId, firmId),
            inArray(schema.emailOutbox.matterId, matterIds),
          ),
        )
        .orderBy(desc(schema.emailOutbox.queuedAt)),
      this.db
        .select()
        .from(schema.emailReceiptTokens)
        .where(
          and(
            eq(schema.emailReceiptTokens.firmId, firmId),
            inArray(schema.emailReceiptTokens.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.shareLinks)
        .where(
          and(eq(schema.shareLinks.firmId, firmId), inArray(schema.shareLinks.matterId, matterIds)),
        ),
      this.db
        .select()
        .from(schema.externalUploadLinks)
        .where(
          and(
            eq(schema.externalUploadLinks.firmId, firmId),
            inArray(schema.externalUploadLinks.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.documents)
        .where(
          and(eq(schema.documents.firmId, firmId), inArray(schema.documents.matterId, matterIds)),
        ),
      this.db
        .select()
        .from(schema.calendarGuestLinks)
        .where(
          and(
            eq(schema.calendarGuestLinks.firmId, firmId),
            inArray(schema.calendarGuestLinks.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.calendarEvents)
        .where(
          and(
            eq(schema.calendarEvents.firmId, firmId),
            inArray(schema.calendarEvents.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.conversationThreads)
        .where(
          and(
            eq(schema.conversationThreads.firmId, firmId),
            inArray(schema.conversationThreads.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.invoices)
        .where(
          and(eq(schema.invoices.firmId, firmId), inArray(schema.invoices.matterId, matterIds)),
        ),
      this.db
        .select()
        .from(schema.hostedPaymentRequests)
        .where(
          and(
            eq(schema.hostedPaymentRequests.firmId, firmId),
            inArray(schema.hostedPaymentRequests.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.portalDocumentAccess)
        .where(
          and(
            eq(schema.portalDocumentAccess.firmId, firmId),
            inArray(schema.portalDocumentAccess.matterId, matterIds),
          ),
        ),
      this.db
        .select()
        .from(schema.signatureRequests)
        .where(
          and(
            eq(schema.signatureRequests.firmId, firmId),
            inArray(schema.signatureRequests.matterId, matterIds),
          ),
        ),
    ]);

    const invoiceIds = invoiceRows.map((invoice) => invoice.id);
    const signatureRequestIds = signatureRequestRows.map((signature) => signature.id);
    const [invoiceLineRows, signatureSignerRows, signatureEventRows] = await Promise.all([
      invoiceIds.length > 0
        ? this.db
            .select()
            .from(schema.invoiceLines)
            .where(
              and(
                eq(schema.invoiceLines.firmId, firmId),
                inArray(schema.invoiceLines.invoiceId, invoiceIds),
              ),
            )
        : Promise.resolve([]),
      signatureRequestIds.length > 0
        ? this.db
            .select()
            .from(schema.signatureRequestSigners)
            .where(
              and(
                eq(schema.signatureRequestSigners.firmId, firmId),
                inArray(schema.signatureRequestSigners.signatureRequestId, signatureRequestIds),
              ),
            )
        : Promise.resolve([]),
      signatureRequestIds.length > 0
        ? this.db
            .select()
            .from(schema.signatureProviderEvents)
            .where(
              and(
                eq(schema.signatureProviderEvents.firmId, firmId),
                inArray(schema.signatureProviderEvents.signatureRequestId, signatureRequestIds),
              ),
            )
            .orderBy(schema.signatureProviderEvents.occurredAt)
        : Promise.resolve([]),
    ]);

    const linesByInvoiceId = new Map<string, ReturnType<typeof mapInvoiceLineRow>[]>();
    for (const line of invoiceLineRows.map(mapInvoiceLineRow)) {
      linesByInvoiceId.set(line.invoiceId, [...(linesByInvoiceId.get(line.invoiceId) ?? []), line]);
    }
    const invoices: InvoiceWithLines[] = invoiceRows.map((invoice) => ({
      ...mapInvoiceRow(invoice),
      lines: linesByInvoiceId.get(invoice.id) ?? [],
    }));

    return {
      intakeLinks: intakeLinkRows.map(mapIntakeFormLinkRow),
      itemActions: itemActionRows.map(mapIntakeFormItemActionRow),
      emails: limitEmailsPerMatter(
        emailRows.map(mapEmailOutboxRow),
        options.emailOutboxLimitPerMatter,
      ),
      receiptTokens: receiptTokenRows.map(mapEmailReceiptTokenRow),
      shareLinks: shareLinkRows.map(mapShareLinkRow),
      externalUploadLinks: externalUploadLinkRows.map(mapExternalUploadLinkRow),
      documents: documentRows.map(mapDocumentRow),
      guestLinks: guestLinkRows.map(mapCalendarGuestLinkRow),
      calendarEvents: calendarEventRows.map(mapCalendarEventRow),
      conversationThreads: conversationThreadRows.map(mapConversationThreadRow),
      invoices,
      paymentRequests: paymentRequestRows.map(mapHostedPaymentRequestRow),
      portalDocumentAccess: portalDocumentAccessRows.map(mapPortalDocumentAccessRow),
      signatureRequests: signatureRequestRows.map(mapSignatureRequestRow),
      signatureSigners: signatureSignerRows.map(mapSignatureRequestSignerRow),
      signatureEvents: signatureEventRows.map(mapSignatureProviderEventRow),
    };
  }

  async createPortalGrant(grant: Parameters<OpenPracticeRepository["createPortalGrant"]>[0]) {
    return createDrizzlePortalGrant(this.db, grant);
  }

  async updatePortalGrant(input: Parameters<OpenPracticeRepository["updatePortalGrant"]>[0]) {
    return updateDrizzlePortalGrant(this.db, input);
  }

  async listPortalDocumentAccess(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPortalDocumentAccess"]>[1] = {},
  ) {
    return listDrizzlePortalDocumentAccess(this.db, firmId, options);
  }

  async createPortalDocumentAccess(
    access: Parameters<OpenPracticeRepository["createPortalDocumentAccess"]>[0],
  ) {
    return createDrizzlePortalDocumentAccess(this.db, access);
  }

  async revokePortalDocumentAccess(
    input: Parameters<OpenPracticeRepository["revokePortalDocumentAccess"]>[0],
  ) {
    return revokeDrizzlePortalDocumentAccess(this.db, input);
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

  async recordDocumentRetentionHoldReviewDecision(
    input: Parameters<OpenPracticeRepository["recordDocumentRetentionHoldReviewDecision"]>[0],
  ): ReturnType<OpenPracticeRepository["recordDocumentRetentionHoldReviewDecision"]> {
    return recordDrizzleDocumentRetentionHoldReviewDecision(this.db, input);
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

  async getSignatureRequest(
    firmId: string,
    signatureRequestId: string,
  ): ReturnType<OpenPracticeRepository["getSignatureRequest"]> {
    return getDrizzleSignatureRequest(this.db, firmId, signatureRequestId);
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

  async listIntakeTemplateVersions(
    firmId: string,
    templateId: string,
  ): ReturnType<OpenPracticeRepository["listIntakeTemplateVersions"]> {
    return listDrizzleIntakeTemplateVersions(this.db, firmId, templateId);
  }

  async getIntakeTemplateVersion(
    firmId: string,
    id: string,
  ): ReturnType<OpenPracticeRepository["getIntakeTemplateVersion"]> {
    return getDrizzleIntakeTemplateVersion(this.db, firmId, id);
  }

  async getLatestIntakeTemplateVersion(
    firmId: string,
    templateId: string,
  ): ReturnType<OpenPracticeRepository["getLatestIntakeTemplateVersion"]> {
    return getLatestDrizzleIntakeTemplateVersion(this.db, firmId, templateId);
  }

  async createIntakeTemplateVersion(
    version: Parameters<OpenPracticeRepository["createIntakeTemplateVersion"]>[0],
  ): ReturnType<OpenPracticeRepository["createIntakeTemplateVersion"]> {
    return createDrizzleIntakeTemplateVersion(this.db, version);
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
    const rows = await this.db
      .select()
      .from(schema.matterParties)
      .where(eq(schema.matterParties.firmId, firmId));
    return rows.map(mapMatterPartyRow);
  }

  private async listContactRelationships(firmId: string) {
    const rows = await this.db
      .select()
      .from(schema.contactRelationships)
      .where(eq(schema.contactRelationships.firmId, firmId));
    return rows.map(mapContactRelationshipRow);
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

  async listBillingExpenseCategories(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listBillingExpenseCategories"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listBillingExpenseCategories"]> {
    return listDrizzleBillingExpenseCategories(this.db, firmId, options);
  }

  async getBillingExpenseCategory(
    firmId: string,
    categoryId: string,
  ): ReturnType<OpenPracticeRepository["getBillingExpenseCategory"]> {
    return getDrizzleBillingExpenseCategory(this.db, firmId, categoryId);
  }

  async getBillingExpenseCategoryByCode(
    firmId: string,
    code: string,
  ): ReturnType<OpenPracticeRepository["getBillingExpenseCategoryByCode"]> {
    return getDrizzleBillingExpenseCategoryByCode(this.db, firmId, code);
  }

  async createBillingExpenseCategory(
    category: Parameters<OpenPracticeRepository["createBillingExpenseCategory"]>[0],
  ): ReturnType<OpenPracticeRepository["createBillingExpenseCategory"]> {
    return createDrizzleBillingExpenseCategory(this.db, category);
  }

  async updateBillingExpenseCategory(
    firmId: string,
    categoryId: string,
    updates: Parameters<OpenPracticeRepository["updateBillingExpenseCategory"]>[2],
  ): ReturnType<OpenPracticeRepository["updateBillingExpenseCategory"]> {
    return updateDrizzleBillingExpenseCategory(this.db, firmId, categoryId, updates);
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

  async reconcilePayment(
    input: Parameters<OpenPracticeRepository["reconcilePayment"]>[0],
  ): ReturnType<OpenPracticeRepository["reconcilePayment"]> {
    return reconcileDrizzlePayment(this.db, input);
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

  async createPaymentImportReviewRecord(
    record: Parameters<OpenPracticeRepository["createPaymentImportReviewRecord"]>[0],
  ): ReturnType<OpenPracticeRepository["createPaymentImportReviewRecord"]> {
    return createDrizzlePaymentImportReviewRecord(this.db, record);
  }

  async getPaymentImportReviewRecord(
    firmId: string,
    recordId: string,
  ): ReturnType<OpenPracticeRepository["getPaymentImportReviewRecord"]> {
    return getDrizzlePaymentImportReviewRecord(this.db, firmId, recordId);
  }

  async listPaymentImportReviewRecords(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPaymentImportReviewRecords"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listPaymentImportReviewRecords"]> {
    return listDrizzlePaymentImportReviewRecords(this.db, firmId, options);
  }

  async createPaymentImportDepositMatchReview(
    record: Parameters<OpenPracticeRepository["createPaymentImportDepositMatchReview"]>[0],
  ): ReturnType<OpenPracticeRepository["createPaymentImportDepositMatchReview"]> {
    return createDrizzlePaymentImportDepositMatchReview(this.db, record);
  }

  async listPaymentImportDepositMatchReviews(
    firmId: string,
    options: Parameters<OpenPracticeRepository["listPaymentImportDepositMatchReviews"]>[1] = {},
  ): ReturnType<OpenPracticeRepository["listPaymentImportDepositMatchReviews"]> {
    return listDrizzlePaymentImportDepositMatchReviews(this.db, firmId, options);
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
    options: Parameters<OpenPracticeRepository["listInboundEmailAttachments"]>[1],
  ): Promise<InboundEmailAttachmentRecord[]> {
    return listDrizzleInboundEmailAttachments(this.db, firmId, options);
  }

  async promoteInboundEmailAttachmentToDocument(
    input: InboundAttachmentPromotionInput,
  ): Promise<InboundAttachmentPromotionResult> {
    return promoteDrizzleInboundEmailAttachmentToDocument(this.db, input);
  }
}
