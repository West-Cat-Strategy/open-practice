import type {
  AnswerSnapshotRecord,
  DocumentAssemblyPackageRecord,
  DocumentAssemblySetDefinitionRecord,
  DocumentTextExtractionRecord,
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureEnvelopeRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import {
  canShareDocumentThroughPortal,
  clientTrustBalanceByMatter,
  type AiOperationalProposalRecord,
  type AccessLogRecord,
  type ActivityTimelineEntry,
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
  type LedgerEntry,
  type LedgerReconciliationExceptionResolutionRecord,
  type LedgerReconciliationExceptionResolutionStatementRow,
  type LedgerReconciliationRecord,
  type LedgerReconciliationStatementRow,
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
  type PublicConsultationIntakeRecord,
  type ProviderSettingRecord,
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
import { and, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../runtime.js";
import * as schema from "../schema.js";

type OpenPracticeTransaction = Parameters<Parameters<OpenPracticeDatabase["transaction"]>[0]>[0];

import type {
  AuthAccountRecord,
  AuthPasswordSetupTokenRecord,
  AuthSessionRecord,
  FirstRunSetupStatus,
  InvoiceWithLines,
  PaymentWithAllocations,
} from "./contracts.js";
import { dateToIso } from "./contracts.js";

export function mapAuthAccountRow(row: typeof schema.authAccounts.$inferSelect): AuthAccountRecord {
  return {
    firmId: row.firmId,
    userId: row.userId,
    passwordHash: row.passwordHash,
    passwordUpdatedAt: row.passwordUpdatedAt.toISOString(),
  };
}

export function mapAuthSessionRow(row: typeof schema.authSessions.$inferSelect): AuthSessionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    freshAuthenticatedAt: dateToIso(row.freshAuthenticatedAt),
    revokedAt: dateToIso(row.revokedAt),
    lastSeenAt: dateToIso(row.lastSeenAt),
  };
}

export function mapShareLinkRow(row: typeof schema.shareLinks.$inferSelect): ShareLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    tokenHash: row.tokenHash,
    grantedByUserId: row.grantedByUserId,
    permissions: row.permissions as ShareLinkRecord["permissions"],
    requireEmailVerification: row.requireEmailVerification,
    emailVerificationCodeHash: row.emailVerificationCodeHash ?? undefined,
    emailVerificationExpiresAt: dateToIso(row.emailVerificationExpiresAt),
    expiresAt: dateToIso(row.expiresAt),
    revokedAt: dateToIso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapWebAuthnCredentialRow(
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

export function mapAuthChallengeRow(
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

export function mapPasswordSetupTokenRow(
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

export function mapRecoveryCodeRow(
  row: typeof schema.recoveryCodes.$inferSelect,
): RecoveryCodeRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    codeHash: row.codeHash,
    usedAt: dateToIso(row.usedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapCalendarCredentialRow(
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

export function mapCalendarEventRow(
  row: typeof schema.calendarEvents.$inferSelect,
): CalendarEventRecord {
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
    meetingLinkMode: row.meetingLinkMode as CalendarEventRecord["meetingLinkMode"],
    meetingLinkUrl: row.meetingLinkUrl ?? undefined,
    meetingRoomId: row.meetingRoomId ?? undefined,
    meetingProviderKey: row.meetingProviderKey ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: dateToIso(row.deletedAt),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
  };
}

export function mapCalendarEventAttendeeRow(
  row: typeof schema.calendarEventAttendees.$inferSelect,
): CalendarEventAttendeeRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    eventId: row.eventId,
    name: row.name,
    email: row.email,
    role: row.role as CalendarEventAttendeeRecord["role"],
    responseStatus: row.responseStatus as CalendarEventAttendeeRecord["responseStatus"],
    invitationStatus: row.invitationStatus as CalendarEventAttendeeRecord["invitationStatus"],
    invitedAt: dateToIso(row.invitedAt),
    invitationEmailId: row.invitationEmailId ?? undefined,
    invitationJobId: row.invitationJobId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: dateToIso(row.deletedAt),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
  };
}

export function mapCalendarEventReminderRow(
  row: typeof schema.calendarEventReminders.$inferSelect,
): CalendarEventReminderRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    eventId: row.eventId,
    remindAt: row.remindAt.toISOString(),
    channel: row.channel as CalendarEventReminderRecord["channel"],
    status: row.status as CalendarEventReminderRecord["status"],
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: dateToIso(row.deletedAt),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
  };
}

export function mapCalendarSchedulingRequestRow(
  row: typeof schema.calendarSchedulingRequests.$inferSelect,
): CalendarSchedulingRequestRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    kind: row.kind as CalendarSchedulingRequestRecord["kind"],
    status: row.status as CalendarSchedulingRequestRecord["status"],
    title: row.title,
    taskId: row.taskId ?? undefined,
    calendarEventId: row.calendarEventId ?? undefined,
    calendarReminderId: row.calendarReminderId ?? undefined,
    ownerUserId: row.ownerUserId ?? undefined,
    sourceType: row.sourceType as CalendarSchedulingRequestRecord["sourceType"],
    sourceId: row.sourceId ?? undefined,
    sourceLabel: row.sourceLabel,
    requestedDueAt: dateToIso(row.requestedDueAt),
    requestedStartsAt: dateToIso(row.requestedStartsAt),
    requestedEndsAt: dateToIso(row.requestedEndsAt),
    reminderPosture: row.reminderPosture as CalendarSchedulingRequestRecord["reminderPosture"],
    privacy: row.privacy as CalendarSchedulingRequestRecord["privacy"],
    timeCaptureCue: row.timeCaptureCue,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    reviewedAt: dateToIso(row.reviewedAt),
    reviewedByUserId: row.reviewedByUserId ?? undefined,
  };
}

export function mapCalendarMeetingSessionRow(
  row: typeof schema.calendarMeetingSessions.$inferSelect,
): CalendarMeetingSessionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    eventId: row.eventId,
    status: row.status as CalendarMeetingSessionRecord["status"],
    retentionUntil: dateToIso(row.retentionUntil),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    endedAt: dateToIso(row.endedAt),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    metadata: row.metadata,
  };
}

export function calendarMeetingSessionInsert(
  session: CalendarMeetingSessionRecord,
): typeof schema.calendarMeetingSessions.$inferInsert {
  return {
    ...session,
    retentionUntil: session.retentionUntil ? new Date(session.retentionUntil) : null,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    endedAt: session.endedAt ? new Date(session.endedAt) : null,
  };
}

export function mapCalendarGuestLinkRow(
  row: typeof schema.calendarGuestLinks.$inferSelect,
): CalendarGuestLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    eventId: row.eventId,
    sessionId: row.sessionId,
    tokenHash: row.tokenHash,
    status: row.status as CalendarGuestLinkRecord["status"],
    expiresAt: row.expiresAt.toISOString(),
    retentionUntil: dateToIso(row.retentionUntil),
    checkedInAt: dateToIso(row.checkedInAt),
    revokedAt: dateToIso(row.revokedAt),
    admittedAt: dateToIso(row.admittedAt),
    deniedAt: dateToIso(row.deniedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId ?? undefined,
    metadata: row.metadata,
  };
}

export function calendarGuestLinkInsert(
  link: CalendarGuestLinkRecord,
): typeof schema.calendarGuestLinks.$inferInsert {
  return {
    ...link,
    expiresAt: new Date(link.expiresAt),
    retentionUntil: link.retentionUntil ? new Date(link.retentionUntil) : null,
    checkedInAt: link.checkedInAt ? new Date(link.checkedInAt) : null,
    revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
    admittedAt: link.admittedAt ? new Date(link.admittedAt) : null,
    deniedAt: link.deniedAt ? new Date(link.deniedAt) : null,
    createdAt: new Date(link.createdAt),
    updatedAt: new Date(link.updatedAt),
    updatedByUserId: link.updatedByUserId ?? null,
  };
}

export function mapTaskDeadlineRow(row: typeof schema.tasks.$inferSelect): TaskDeadlineRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    assignedToUserId: row.assignedToUserId ?? undefined,
    title: row.title,
    dueAt: dateToIso(row.dueAt),
    completedAt: dateToIso(row.completedAt),
  };
}

export function activeCalendarAttendees(
  attendees: CalendarEventAttendeeRecord[] | undefined,
  event: Pick<CalendarEventRecord, "firmId" | "matterId" | "id">,
): CalendarEventAttendeeRecord[] {
  return (attendees ?? [])
    .filter(
      (attendee) =>
        attendee.firmId === event.firmId &&
        attendee.matterId === event.matterId &&
        attendee.eventId === event.id &&
        !attendee.deletedAt,
    )
    .sort((left, right) => left.email.localeCompare(right.email));
}

export function activeCalendarReminders(
  reminders: CalendarEventReminderRecord[] | undefined,
  event: Pick<CalendarEventRecord, "firmId" | "matterId" | "id">,
): CalendarEventReminderRecord[] {
  return (reminders ?? [])
    .filter(
      (reminder) =>
        reminder.firmId === event.firmId &&
        reminder.matterId === event.matterId &&
        reminder.eventId === event.id &&
        !reminder.deletedAt,
    )
    .sort((left, right) => {
      const remindAtDifference = Date.parse(left.remindAt) - Date.parse(right.remindAt);
      return remindAtDifference === 0 ? left.id.localeCompare(right.id) : remindAtDifference;
    });
}

export function setupStatusFromCounts(firmCount: number, userCount: number): FirstRunSetupStatus {
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

export function mapFirmSettingsRow(row: typeof schema.firmSettings.$inferSelect): FirmSettings {
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

export function mapProviderSettingRow(
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

export function mapConnectorRow(row: typeof schema.connectors.$inferSelect): ConnectorRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    type: row.type as ConnectorRecord["type"],
    key: row.key,
    displayName: row.displayName,
    status: row.status as ConnectorRecord["status"],
    secretReference: row.secretReference ?? undefined,
    configSummary: row.configSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function connectorInsert(record: ConnectorRecord): typeof schema.connectors.$inferInsert {
  return {
    ...record,
    secretReference: record.secretReference ?? null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function mapJobLifecycleRow(
  row: typeof schema.jobLifecycleRecords.$inferSelect,
): JobLifecycleRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    queueName: row.queueName,
    jobName: row.jobName,
    bullJobId: row.bullJobId ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
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

export function mapConnectorOutboxRow(
  row: typeof schema.connectorOutbox.$inferSelect,
): ConnectorOutboxRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    connectorId: row.connectorId,
    eventType: row.eventType,
    resourceType: row.resourceType ?? undefined,
    resourceId: row.resourceId ?? undefined,
    idempotencyKey: row.idempotencyKey,
    status: row.status as ConnectorOutboxRecord["status"],
    payloadSummary: row.payloadSummary,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: dateToIso(row.nextAttemptAt),
    leaseId: row.leaseId ?? undefined,
    leasedUntil: dateToIso(row.leasedUntil),
    deliveredAt: dateToIso(row.deliveredAt),
    deadLetteredAt: dateToIso(row.deadLetteredAt),
    lastErrorSummary: row.lastErrorSummary ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function connectorOutboxInsert(
  record: ConnectorOutboxRecord,
): typeof schema.connectorOutbox.$inferInsert {
  return {
    ...record,
    resourceType: record.resourceType ?? null,
    resourceId: record.resourceId ?? null,
    nextAttemptAt: record.nextAttemptAt ? new Date(record.nextAttemptAt) : null,
    leaseId: record.leaseId ?? null,
    leasedUntil: record.leasedUntil ? new Date(record.leasedUntil) : null,
    deliveredAt: record.deliveredAt ? new Date(record.deliveredAt) : null,
    deadLetteredAt: record.deadLetteredAt ? new Date(record.deadLetteredAt) : null,
    lastErrorSummary: record.lastErrorSummary ?? null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function mapConnectorDeliveryAttemptRow(
  row: typeof schema.connectorDeliveryAttempts.$inferSelect,
): ConnectorDeliveryAttemptRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    connectorId: row.connectorId,
    outboxId: row.outboxId,
    attemptNumber: row.attemptNumber,
    status: row.status as ConnectorDeliveryAttemptRecord["status"],
    idempotencyKey: row.idempotencyKey,
    leaseId: row.leaseId ?? undefined,
    startedAt: row.startedAt.toISOString(),
    finishedAt: dateToIso(row.finishedAt),
    errorSummary: row.errorSummary ?? undefined,
    metadata: row.metadata,
  };
}

export function connectorDeliveryAttemptInsert(
  record: ConnectorDeliveryAttemptRecord,
): typeof schema.connectorDeliveryAttempts.$inferInsert {
  return {
    ...record,
    leaseId: record.leaseId ?? null,
    startedAt: new Date(record.startedAt),
    finishedAt: record.finishedAt ? new Date(record.finishedAt) : null,
    errorSummary: record.errorSummary ?? null,
  };
}

export function mapEmailOutboxRow(row: typeof schema.emailOutbox.$inferSelect): EmailOutboxRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
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
    attemptCount: row.attemptCount,
    lastAttemptAt: dateToIso(row.lastAttemptAt),
    terminalFailureAt: dateToIso(row.terminalFailureAt),
    terminalFailureReason: row.terminalFailureReason ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    metadata: row.metadata,
  };
}

export function emailOutboxInsert(
  record: EmailOutboxRecord,
): typeof schema.emailOutbox.$inferInsert {
  return {
    ...record,
    matterId: record.matterId ?? null,
    idempotencyKey: record.idempotencyKey ?? null,
    queuedAt: new Date(record.queuedAt),
    sentAt: record.sentAt ? new Date(record.sentAt) : null,
    failedAt: record.failedAt ? new Date(record.failedAt) : null,
    lastAttemptAt: record.lastAttemptAt ? new Date(record.lastAttemptAt) : null,
    terminalFailureAt: record.terminalFailureAt ? new Date(record.terminalFailureAt) : null,
  };
}

export function mapPublicConsultationIntakeRow(
  row: typeof schema.publicConsultationIntakes.$inferSelect,
): PublicConsultationIntakeRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    status: row.status,
    clientName: row.clientName,
    telephone: row.telephone,
    email: row.email ?? undefined,
    opposingPartyNames: row.opposingPartyNames,
    matterDescription: row.matterDescription,
    sourceUrl: row.sourceUrl ?? undefined,
    disclosureAcceptedAt: row.disclosureAcceptedAt.toISOString(),
    submittedAt: row.submittedAt.toISOString(),
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: dateToIso(row.reviewedAt),
    dismissedReason: row.dismissedReason ?? undefined,
    convertedMatterId: row.convertedMatterId ?? undefined,
    notificationEmailId: row.notificationEmailId ?? undefined,
    metadata: row.metadata,
  };
}

export function publicConsultationIntakeInsert(
  record: PublicConsultationIntakeRecord,
): typeof schema.publicConsultationIntakes.$inferInsert {
  return {
    ...record,
    email: record.email ?? null,
    sourceUrl: record.sourceUrl ?? null,
    disclosureAcceptedAt: new Date(record.disclosureAcceptedAt),
    submittedAt: new Date(record.submittedAt),
    reviewedByUserId: record.reviewedByUserId ?? null,
    reviewedAt: record.reviewedAt ? new Date(record.reviewedAt) : null,
    dismissedReason: record.dismissedReason ?? null,
    convertedMatterId: record.convertedMatterId ?? null,
    notificationEmailId: record.notificationEmailId ?? null,
  };
}

export function mapEmailEventRow(row: typeof schema.emailEvents.$inferSelect): EmailEventRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    emailId: row.emailId,
    eventType: row.eventType as EmailEventRecord["eventType"],
    providerMessageId: row.providerMessageId ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    attemptNumber: row.attemptNumber ?? undefined,
    jobId: row.jobId ?? undefined,
    source: row.source as EmailEventRecord["source"],
    errorMessage: row.errorMessage ?? undefined,
    metadata: row.metadata,
  };
}

export function emailEventInsert(record: EmailEventRecord): typeof schema.emailEvents.$inferInsert {
  return {
    ...record,
    occurredAt: new Date(record.occurredAt),
    attemptNumber: record.attemptNumber ?? null,
    jobId: record.jobId ?? null,
    source: record.source,
    errorMessage: record.errorMessage ?? null,
  };
}

export function mapIntegrationDeveloperAppRow(
  row: typeof schema.integrationDeveloperApps.$inferSelect,
): IntegrationDeveloperAppRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    connectorId: row.connectorId,
    clientId: row.clientId,
    displayName: row.displayName,
    status: row.status as IntegrationDeveloperAppRecord["status"],
    redirectUris: row.redirectUris,
    allowedOrigins: row.allowedOrigins,
    allowedScopes: row.allowedScopes,
    regionalEndpoint: row.regionalEndpoint,
    rateLimit: row.rateLimit,
    customActionPlaceholders: row.customActionPlaceholders,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function integrationDeveloperAppInsert(
  record: IntegrationDeveloperAppRecord,
): typeof schema.integrationDeveloperApps.$inferInsert {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function mapIntegrationApiCredentialRow(
  row: typeof schema.integrationApiCredentials.$inferSelect,
): IntegrationApiCredentialRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    appId: row.appId,
    label: row.label,
    scopes: row.scopes,
    secretReference: row.secretReference,
    status: row.status as IntegrationApiCredentialRecord["status"],
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: dateToIso(row.expiresAt),
    lastUsedAt: dateToIso(row.lastUsedAt),
    revokedAt: dateToIso(row.revokedAt),
  };
}

export function integrationApiCredentialInsert(
  record: IntegrationApiCredentialRecord,
): typeof schema.integrationApiCredentials.$inferInsert {
  return {
    ...record,
    expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
    lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
    revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
    createdAt: new Date(record.createdAt),
  };
}

export function mapIntegrationWebhookSubscriptionRow(
  row: typeof schema.integrationWebhookSubscriptions.$inferSelect,
): IntegrationWebhookSubscriptionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    appId: row.appId,
    connectorId: row.connectorId,
    status: row.status as IntegrationWebhookSubscriptionRecord["status"],
    eventTypes: row.eventTypes,
    destinationUrl: row.destinationUrl,
    destinationHost: row.destinationHost,
    signingSecretReference: row.signingSecretReference ?? undefined,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function integrationWebhookSubscriptionInsert(
  record: IntegrationWebhookSubscriptionRecord,
): typeof schema.integrationWebhookSubscriptions.$inferInsert {
  return {
    ...record,
    signingSecretReference: record.signingSecretReference ?? null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function mapEmailReceiptTokenRow(
  row: typeof schema.emailReceiptTokens.$inferSelect,
): EmailReceiptTokenRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    emailId: row.emailId,
    tokenHash: row.tokenHash,
    purpose: row.purpose as EmailReceiptTokenRecord["purpose"],
    expiresAt: row.expiresAt.toISOString(),
    recordedAt: dateToIso(row.recordedAt),
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata,
  };
}

export function emailReceiptTokenInsert(
  record: EmailReceiptTokenRecord,
): typeof schema.emailReceiptTokens.$inferInsert {
  return {
    ...record,
    expiresAt: new Date(record.expiresAt),
    recordedAt: record.recordedAt ? new Date(record.recordedAt) : null,
    createdAt: new Date(record.createdAt),
  };
}

export function sanitizeEmailFailureSummary(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return (
    message
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || undefined
  );
}

export function nextEmailAttemptCount(
  existing: EmailOutboxRecord,
  attemptNumber: number | undefined,
) {
  return Math.max(existing.attemptCount, attemptNumber ?? existing.attemptCount);
}

export function jobLifecycleInsert(
  record: JobLifecycleRecord,
): typeof schema.jobLifecycleRecords.$inferInsert {
  return {
    ...record,
    idempotencyKey: record.idempotencyKey ?? null,
    queuedAt: new Date(record.queuedAt),
    startedAt: record.startedAt ? new Date(record.startedAt) : null,
    finishedAt: record.finishedAt ? new Date(record.finishedAt) : null,
    failedAt: record.failedAt ? new Date(record.failedAt) : null,
  };
}

export function matterTrustBalance(
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

export function userHasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}

export function mapContactRow(row: typeof schema.contacts.$inferSelect): Contact {
  return {
    id: row.id,
    firmId: row.firmId,
    kind: row.kind,
    displayName: row.displayName,
    aliases: row.aliases,
    identifiers: row.identifiers as Contact["identifiers"],
    notes: row.notes ?? undefined,
  };
}

export function mapContactRelationshipRow(
  row: typeof schema.contactRelationships.$inferSelect,
): ContactRelationshipRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    contactId: row.contactId,
    relatedContactId: row.relatedContactId,
    relationshipKind: row.relationshipKind as ContactRelationshipRecord["relationshipKind"],
    label: row.label,
    matterId: row.matterId ?? undefined,
    source: row.source as ContactRelationshipRecord["source"],
    status: row.status as ContactRelationshipRecord["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapConflictCheckRow(
  row: typeof schema.conflictChecks.$inferSelect,
): ConflictCheckRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    requestedByUserId: row.requestedByUserId,
    prospectiveName: row.prospectiveName,
    querySnapshot: row.querySnapshot as ConflictCheckRecord["querySnapshot"],
    resultSnapshot: row.resultSnapshot as ConflictCheckRecord["resultSnapshot"],
    disposition: row.disposition,
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapDocumentRow(row: typeof schema.documents.$inferSelect): DocumentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    title: row.title,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    sizeBytes: row.sizeBytes ?? undefined,
    version: row.version,
    classification: row.classification,
    legalHold: row.legalHold,
    uploadStatus: row.uploadStatus as DocumentRecord["uploadStatus"],
    checksumStatus: row.checksumStatus as DocumentRecord["checksumStatus"],
    scanStatus: row.scanStatus as DocumentRecord["scanStatus"],
    reviewStatus: row.reviewStatus as DocumentRecord["reviewStatus"],
    reviewDecision: (row.reviewDecision as DocumentRecord["reviewDecision"] | null) ?? undefined,
    reviewReason: (row.reviewReason as DocumentRecord["reviewReason"] | null) ?? undefined,
    reviewMetadata: row.reviewMetadata as Record<string, unknown>,
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: dateToIso(row.reviewedAt),
    externalUploadLinkId: row.externalUploadLinkId ?? undefined,
    duplicateOfDocumentId: row.duplicateOfDocumentId ?? undefined,
    supersedesDocumentId: row.supersedesDocumentId ?? undefined,
    supersededAt: dateToIso(row.supersededAt),
    uploadedAt: dateToIso(row.uploadedAt),
    verifiedAt: dateToIso(row.verifiedAt),
  };
}

export function mapLegalClinicProgramRow(
  row: typeof schema.legalClinicPrograms.$inferSelect,
): LegalClinicProgram {
  return {
    id: row.id,
    firmId: row.firmId,
    name: row.name,
    status: row.status,
    serviceArea: row.serviceArea,
    eligibilitySummary: row.eligibilitySummary,
    defaultReferralSource: row.defaultReferralSource ?? undefined,
    defaultReferralStatus: row.defaultReferralStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata,
  };
}

export function mapLegalClinicMatterProfileRow(
  row: typeof schema.legalClinicMatterProfiles.$inferSelect,
): LegalClinicMatterProfile {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    programId: row.programId,
    eligibilityStatus: row.eligibilityStatus,
    referralSource: row.referralSource ?? undefined,
    referralStatus: row.referralStatus,
    referralDate: dateToIso(row.referralDate),
    nextReviewDate: dateToIso(row.nextReviewDate),
    clinicRelationshipRole: row.clinicRelationshipRole,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
    metadata: row.metadata,
  };
}

export function mapConversationThreadRow(
  row: typeof schema.conversationThreads.$inferSelect,
): ConversationThreadRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    topic: row.topic,
    status: row.status,
    retentionUntil: dateToIso(row.retentionUntil),
    exportState: row.exportState,
    accessRevokedAt: dateToIso(row.accessRevokedAt),
    notificationBoundary: row.notificationBoundary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    metadata: row.metadata,
  };
}

export function mapConversationMessageRow(
  row: typeof schema.conversationMessages.$inferSelect,
): ConversationMessageRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    threadId: row.threadId,
    kind: row.kind,
    bodyText: row.bodyText,
    authoredAt: row.authoredAt.toISOString(),
    authoredByUserId: row.authoredByUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    metadata: row.metadata,
  };
}

export function mapConversationMessageNotificationRow(
  row: typeof schema.conversationMessageNotifications.$inferSelect,
): ConversationMessageNotificationRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    threadId: row.threadId,
    messageId: row.messageId,
    recipientUserId: row.recipientUserId,
    readAt: dateToIso(row.readAt),
    mutedAt: dateToIso(row.mutedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    metadata: row.metadata,
  };
}

export function mapDocumentTextExtractionRow(
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

export function mapGeneratedDocumentRow(
  row: typeof schema.generatedDocuments.$inferSelect,
): GeneratedDocumentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    intakeSessionId: row.intakeSessionId ?? undefined,
    provider: row.provider as GeneratedDocumentRecord["provider"],
    externalId: row.externalId,
    title: row.title,
    documentId: row.documentId ?? undefined,
    packageId: row.packageId ?? undefined,
    packageDocumentId: row.packageDocumentId ?? undefined,
    storageKey: row.storageKey ?? undefined,
    checksumSha256: row.checksumSha256 ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapDocumentAssemblySetDefinitionRow(
  row: typeof schema.documentAssemblySetDefinitions.$inferSelect,
): DocumentAssemblySetDefinitionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    name: row.name,
    description: row.description ?? undefined,
    practiceArea: row.practiceArea ?? undefined,
    documentRefs: row.documentRefs,
    requiredMergeFields: row.requiredMergeFields,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata,
  };
}

export function mapDocumentAssemblyPackageRow(
  row: typeof schema.documentAssemblyPackages.$inferSelect,
): DocumentAssemblyPackageRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    definitionId: row.definitionId ?? undefined,
    title: row.title,
    status: row.status,
    populationStatus: row.populationStatus,
    sourceDraftId: row.sourceDraftId ?? undefined,
    intakeSessionId: row.intakeSessionId ?? undefined,
    packageId: row.packageId ?? undefined,
    documentIds: row.documentIds,
    generatedDocumentIds: row.generatedDocumentIds,
    signatureRequestIds: row.signatureRequestIds,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata,
  };
}

export function mapSignatureEnvelopeRow(
  row: typeof schema.signatureEnvelopes.$inferSelect,
): SignatureEnvelopeRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    assemblyPackageId: row.assemblyPackageId ?? undefined,
    signatureRequestId: row.signatureRequestId ?? undefined,
    title: row.title,
    status: row.status,
    signerOrder: row.signerOrder,
    fieldPlacements: row.fieldPlacements,
    validationStatus: row.validationStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata,
  };
}

export function mapExternalUploadLinkRow(
  row: typeof schema.externalUploadLinks.$inferSelect,
): ExternalUploadLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    tokenHash: row.tokenHash,
    idempotencyKey: row.idempotencyKey ?? undefined,
    requestedByUserId: row.requestedByUserId,
    expiresAt: row.expiresAt.toISOString(),
    maxUploads: row.maxUploads,
    usedUploads: row.usedUploads,
    createdAt: row.createdAt.toISOString(),
    revokedAt: dateToIso(row.revokedAt),
  };
}

export function mapSavedOperationalViewDefinitionRow(
  row: typeof schema.savedOperationalViewDefinitions.$inferSelect,
): SavedOperationalViewDefinition {
  return {
    id: row.id,
    firmId: row.firmId,
    ownerUserId: row.ownerUserId,
    surface: row.surface,
    name: row.name,
    filters: row.filters,
    columns: row.columns,
    sort: row.sort,
    rowLimit: row.rowLimit,
    dashboardBehavior: row.dashboardBehavior,
    permissionScope: row.permissionScope,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: dateToIso(row.archivedAt),
  };
}

export function mapIntakeFormLinkRow(
  row: typeof schema.intakeFormLinks.$inferSelect,
): IntakeFormLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    intakeSessionId: row.intakeSessionId,
    tokenHash: row.tokenHash,
    requestedByUserId: row.requestedByUserId,
    clientContactId: row.clientContactId ?? undefined,
    parentFormLinkId: row.parentFormLinkId ?? undefined,
    answerSnapshotId: row.answerSnapshotId ?? undefined,
    clientSubmissionId: row.clientSubmissionId ?? undefined,
    submissionFingerprint: row.submissionFingerprint ?? undefined,
    draftAnswers: row.draftAnswers ?? undefined,
    draftUpdatedAt: dateToIso(row.draftUpdatedAt),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: dateToIso(row.revokedAt),
    submittedAt: dateToIso(row.submittedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function intakeFormLinkInsert(
  link: IntakeFormLinkRecord,
): typeof schema.intakeFormLinks.$inferInsert {
  return {
    ...link,
    clientContactId: link.clientContactId ?? null,
    parentFormLinkId: link.parentFormLinkId ?? null,
    answerSnapshotId: link.answerSnapshotId ?? null,
    clientSubmissionId: link.clientSubmissionId ?? null,
    submissionFingerprint: link.submissionFingerprint ?? null,
    draftAnswers: link.draftAnswers ?? null,
    draftUpdatedAt: link.draftUpdatedAt ? new Date(link.draftUpdatedAt) : null,
    expiresAt: new Date(link.expiresAt),
    revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
    submittedAt: link.submittedAt ? new Date(link.submittedAt) : null,
    createdAt: new Date(link.createdAt),
  };
}

export function mapIntakeFormReviewRow(
  row: typeof schema.intakeFormReviews.$inferSelect,
): IntakeFormReviewRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    intakeSessionId: row.intakeSessionId,
    formLinkId: row.formLinkId,
    answerSnapshotId: row.answerSnapshotId,
    decision: row.decision,
    decidedByUserId: row.decidedByUserId,
    decidedAt: row.decidedAt.toISOString(),
    reason: row.reason ?? undefined,
    followUpFormLinkId: row.followUpFormLinkId ?? undefined,
  };
}

export function intakeFormReviewInsert(
  review: IntakeFormReviewRecord,
): typeof schema.intakeFormReviews.$inferInsert {
  return {
    ...review,
    reason: review.reason ?? null,
    followUpFormLinkId: review.followUpFormLinkId ?? null,
    decidedAt: new Date(review.decidedAt),
  };
}

export function mapIntakeFormItemActionRow(
  row: typeof schema.intakeFormItemActions.$inferSelect,
): IntakeFormItemActionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    intakeSessionId: row.intakeSessionId,
    formLinkId: row.formLinkId,
    itemId: row.itemId,
    kind: row.kind,
    status: row.status,
    documentId: row.documentId ?? undefined,
    signatureRequestId: row.signatureRequestId ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    completedAt: dateToIso(row.completedAt),
  };
}

export function intakeFormItemActionInsert(
  action: IntakeFormItemActionRecord,
): typeof schema.intakeFormItemActions.$inferInsert {
  return {
    ...action,
    documentId: action.documentId ?? null,
    signatureRequestId: action.signatureRequestId ?? null,
    createdAt: new Date(action.createdAt),
    completedAt: action.completedAt ? new Date(action.completedAt) : null,
  };
}

export function mapIntakeVariableProposalRow(
  row: typeof schema.intakeVariableProposals.$inferSelect,
): IntakeVariableProposal {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    intakeSessionId: row.intakeSessionId,
    answerSnapshotId: row.answerSnapshotId,
    sourceQuestionId: row.sourceQuestionId,
    targetScope: row.targetScope,
    targetField: row.targetField,
    targetRecordId: row.targetRecordId,
    proposedValue: row.proposedValue,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: dateToIso(row.reviewedAt),
    rejectionReason: row.rejectionReason ?? undefined,
    appliedAt: dateToIso(row.appliedAt),
  };
}

export function intakeVariableProposalInsert(
  proposal: IntakeVariableProposal,
): typeof schema.intakeVariableProposals.$inferInsert {
  return {
    ...proposal,
    createdAt: new Date(proposal.createdAt),
    reviewedByUserId: proposal.reviewedByUserId ?? null,
    reviewedAt: proposal.reviewedAt ? new Date(proposal.reviewedAt) : null,
    rejectionReason: proposal.rejectionReason ?? null,
    appliedAt: proposal.appliedAt ? new Date(proposal.appliedAt) : null,
  };
}

export async function applyVariableProposalWithTx(
  tx: OpenPracticeTransaction,
  proposal: typeof schema.intakeVariableProposals.$inferSelect,
): Promise<void> {
  if (proposal.targetScope === "client") {
    if (proposal.targetField === "displayName") {
      await tx
        .update(schema.contacts)
        .set({ displayName: proposal.proposedValue })
        .where(
          and(
            eq(schema.contacts.firmId, proposal.firmId),
            eq(schema.contacts.id, proposal.targetRecordId),
          ),
        );
      return;
    }
    if (proposal.targetField === "notes") {
      await tx
        .update(schema.contacts)
        .set({ notes: proposal.proposedValue })
        .where(
          and(
            eq(schema.contacts.firmId, proposal.firmId),
            eq(schema.contacts.id, proposal.targetRecordId),
          ),
        );
      return;
    }
    throw new Error(`Unsupported client variable field ${proposal.targetField}`);
  }
  if (proposal.targetField === "title") {
    await tx
      .update(schema.matters)
      .set({ title: proposal.proposedValue })
      .where(
        and(
          eq(schema.matters.firmId, proposal.firmId),
          eq(schema.matters.id, proposal.targetRecordId),
        ),
      );
    return;
  }
  if (proposal.targetField === "practiceArea") {
    await tx
      .update(schema.matters)
      .set({ practiceArea: proposal.proposedValue })
      .where(
        and(
          eq(schema.matters.firmId, proposal.firmId),
          eq(schema.matters.id, proposal.targetRecordId),
        ),
      );
    return;
  }
  if (proposal.targetField === "jurisdiction") {
    if (!["BC", "ON", "CANADA", "OTHER"].includes(proposal.proposedValue)) {
      throw new Error(`Unsupported intake proposal jurisdiction ${proposal.proposedValue}`);
    }
    await tx
      .update(schema.matters)
      .set({ jurisdiction: proposal.proposedValue as Matter["jurisdiction"] })
      .where(
        and(
          eq(schema.matters.firmId, proposal.firmId),
          eq(schema.matters.id, proposal.targetRecordId),
        ),
      );
    return;
  }
  throw new Error(`Unsupported matter variable field ${proposal.targetField}`);
}

export function externalUploadLinkInsert(
  link: ExternalUploadLinkRecord,
): typeof schema.externalUploadLinks.$inferInsert {
  return {
    ...link,
    idempotencyKey: link.idempotencyKey ?? null,
    expiresAt: new Date(link.expiresAt),
    revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
    createdAt: new Date(link.createdAt),
  };
}

export function savedOperationalViewDefinitionInsert(
  definition: SavedOperationalViewDefinition,
): typeof schema.savedOperationalViewDefinitions.$inferInsert {
  return {
    ...definition,
    createdAt: new Date(definition.createdAt),
    updatedAt: new Date(definition.updatedAt),
    archivedAt: definition.archivedAt ? new Date(definition.archivedAt) : null,
  };
}

export function mapAccessLogRow(row: typeof schema.accessLogs.$inferSelect): AccessLogRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    actorId: row.actorId ?? undefined,
    shareLinkId: row.shareLinkId ?? undefined,
    externalUploadLinkId: row.externalUploadLinkId ?? undefined,
    intakeFormLinkId: row.intakeFormLinkId ?? undefined,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    action: row.action as AccessLogRecord["action"],
    occurredAt: row.occurredAt.toISOString(),
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
    metadata: row.metadata as Record<string, unknown>,
  };
}

export function accessLogInsert(log: AccessLogRecord): typeof schema.accessLogs.$inferInsert {
  return {
    id: log.id,
    firmId: log.firmId,
    actorId: log.actorId ?? null,
    shareLinkId: log.shareLinkId ?? null,
    externalUploadLinkId: log.externalUploadLinkId ?? null,
    intakeFormLinkId: log.intakeFormLinkId ?? null,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    action: log.action,
    occurredAt: new Date(log.occurredAt),
    ipAddress: log.ipAddress ?? null,
    userAgent: log.userAgent ?? null,
    metadata: log.metadata,
  };
}

export function mapSignatureRequestRow(
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

export function mapSignatureRequestSignerRow(
  row: typeof schema.signatureRequestSigners.$inferSelect,
): SignatureRequestSignerRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    signatureRequestId: row.signatureRequestId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status as SignatureProviderStatus,
    signingUrl: row.signingUrl ?? undefined,
    completedAt: dateToIso(row.completedAt),
  };
}

export function mapIntakeSessionRow(
  row: typeof schema.intakeSessions.$inferSelect,
): IntakeSessionRecord {
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

export function mapAnswerSnapshotRow(
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

export function mapSignatureProviderEventRow(
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

export function mapSignatureWebhookAttemptRow(
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

export function mapLedgerApprovalRow(
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

export function mapLedgerReconciliationRow(
  row: typeof schema.trustReconciliations.$inferSelect,
): LedgerReconciliationRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    accountId: row.accountId,
    statementPeriodStart: row.statementPeriodStart.toISOString(),
    statementPeriodEnd: row.statementPeriodEnd.toISOString(),
    beginningBalanceCents: row.beginningBalanceCents,
    endingBalanceCents: row.endingBalanceCents,
    expectedBalanceCents: row.expectedBalanceCents,
    actualBalanceCents: row.actualBalanceCents,
    status: row.status as LedgerReconciliationRecord["status"],
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    statementRows: row.statementRows as LedgerReconciliationStatementRow[],
    varianceExplanation: row.varianceExplanation ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapLedgerStatementImportBatchRow(
  row: typeof schema.trustStatementImportBatches.$inferSelect,
): LedgerStatementImportBatchRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    accountId: row.accountId,
    sourceLabel: row.sourceLabel,
    checksumSha256: row.checksumSha256,
    importedStatementRowCount: row.importedStatementRowCount,
    duplicateStatementRowCount: row.duplicateStatementRowCount,
    status: row.status as LedgerStatementImportBatchRecord["status"],
    matchingProfileId: row.matchingProfileId ?? undefined,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapLedgerStatementMatchRuleProfileRow(
  row: typeof schema.trustStatementMatchRuleProfiles.$inferSelect,
): LedgerStatementMatchRuleProfileRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    accountId: row.accountId,
    name: row.name,
    referenceStrategy: row.referenceStrategy,
    descriptionStrategy: row.descriptionStrategy,
    dateWindowDays: row.dateWindowDays,
    amountToleranceCents: row.amountToleranceCents,
    varianceCategories: row.varianceCategories,
    reviewerExplanationRequired: row.reviewerExplanationRequired,
    reviewOnly: true,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapLedgerAccountingReviewProfileRow(
  row: typeof schema.ledgerAccountingReviewProfiles.$inferSelect,
): LedgerAccountingReviewProfileRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    accountId: row.accountId,
    accountType: row.accountType,
    boundaryPosture: row.boundaryPosture,
    protectedFunds: row.protectedFunds,
    bankFeedImport: row.bankFeedImport,
    dimensions: row.dimensions,
    reviewOnly: true,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapLedgerReconciliationExceptionResolutionRow(
  row: typeof schema.trustReconciliationExceptionResolutions.$inferSelect,
): LedgerReconciliationExceptionResolutionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    accountId: row.accountId,
    statementRow: row.statementRow as LedgerReconciliationExceptionResolutionStatementRow,
    varianceDecision:
      row.varianceDecision as LedgerReconciliationExceptionResolutionRecord["varianceDecision"],
    resolutionNote: row.resolutionNote,
    recordedByUserId: row.recordedByUserId,
    recordedAt: row.recordedAt.toISOString(),
  };
}

export const EPOCH_OCCURRED_AT = new Date(0).toISOString();

export function matterDateToOccurredAt(value?: string): string {
  if (!value) return EPOCH_OCCURRED_AT;
  return value.includes("T") ? value : `${value}T00:00:00.000Z`;
}

export function safeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const blockedKeyFragments = [
    "body",
    "evidence",
    "html",
    "interviewurl",
    "ipaddress",
    "narrative",
    "note",
    "password",
    "raw",
    "reason",
    "reference",
    "secret",
    "signingurl",
    "storagekey",
    "text",
    "token",
    "useragent",
  ];
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !blockedKeyFragments.some((fragment) => normalized.includes(fragment));
    }),
  );
}

export function buildActivityTimeline(input: {
  firmId: string;
  matter: Matter;
  contacts: Contact[];
  matterParties: MatterParty[];
  documents: DocumentRecord[];
  portalGrants: PortalGrant[];
  shareLinks: ShareLinkRecord[];
  externalUploadLinks: ExternalUploadLinkRecord[];
  accessLogs: AccessLogRecord[];
  auditEvents: AuditEvent[];
  emailOutbox: EmailOutboxRecord[];
  signatureRequests: SignatureRequestRecord[];
  intakeSessions: IntakeSessionRecord[];
  generatedDocuments: GeneratedDocumentRecord[];
  calendarEvents: CalendarEventRecord[];
  taskDeadlines: TaskDeadlineRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  invoices: InvoiceWithLines[];
  payments: PaymentWithAllocations[];
  trustTransferRequests: TrustTransferRequestRecord[];
  ledgerAccounts: LedgerAccount[];
  ledgerEntries: LedgerEntry[];
}): ActivityTimelineEntry[] {
  const matterId = input.matter.id;
  const matterOpenedAt = matterDateToOccurredAt(input.matter.openedOn);
  const contactsById = new Map(input.contacts.map((contact) => [contact.id, contact]));
  const shareMatterIds = new Map(input.shareLinks.map((link) => [link.id, link.matterId]));
  const uploadMatterIds = new Map(
    input.externalUploadLinks.map((link) => [link.id, link.matterId]),
  );
  const accountTypesById = new Map(
    input.ledgerAccounts.map((account) => [account.id, account.type]),
  );
  const ledgerGroups = new Map<string, LedgerEntry[]>();
  for (const entry of input.ledgerEntries.filter(
    (entry) => entry.firmId === input.firmId && entry.matterId === matterId,
  )) {
    const key = `${entry.transactionId}:${entry.matterId}:${entry.postedAt}`;
    ledgerGroups.set(key, [...(ledgerGroups.get(key) ?? []), entry]);
  }

  const entries: ActivityTimelineEntry[] = [
    ...input.auditEvents
      .filter((event) => event.firmId === input.firmId)
      .filter(
        (event) =>
          event.resourceId === matterId ||
          event.metadata.matterId === matterId ||
          (event.resourceType === "conflict_check" && event.metadata.matterId === matterId),
      )
      .map((event) => ({
        id: event.id,
        firmId: event.firmId,
        matterId: typeof event.metadata.matterId === "string" ? event.metadata.matterId : matterId,
        occurredAt: event.occurredAt,
        title: event.action.replaceAll("_", " ").replaceAll(".", " "),
        kind: event.resourceType === "conflict_check" ? ("conflict" as const) : ("audit" as const),
        actorId: event.actorId,
        metadata: safeAuditMetadata(event.metadata),
      })),
    ...input.matterParties
      .filter((party) => party.firmId === input.firmId && party.matterId === matterId)
      .map((party) => {
        const contact = contactsById.get(party.contactId);
        return {
          id: `party:${party.id}`,
          firmId: party.firmId,
          matterId: party.matterId,
          occurredAt: matterOpenedAt,
          title: `Matter party: ${contact?.displayName ?? party.contactId}`,
          kind: "contact" as const,
          metadata: {
            contactId: party.contactId,
            contactKind: contact?.kind,
            role: party.role,
            adverse: party.adverse,
            confidential: party.confidential,
          },
        };
      }),
    ...input.documents
      .filter((document) => document.firmId === input.firmId && document.matterId === matterId)
      .map((document) => ({
        id: `document:${document.id}`,
        firmId: document.firmId,
        matterId: document.matterId,
        occurredAt: document.verifiedAt ?? document.uploadedAt ?? EPOCH_OCCURRED_AT,
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
    ...input.documents
      .filter(
        (document) =>
          document.firmId === input.firmId &&
          document.matterId === matterId &&
          Boolean(document.externalUploadLinkId) &&
          Boolean(document.reviewedAt),
      )
      .map((document) => ({
        id: `upload-review:${document.id}`,
        firmId: document.firmId,
        matterId: document.matterId,
        occurredAt: document.reviewedAt ?? EPOCH_OCCURRED_AT,
        title: `External upload ${document.reviewStatus}`,
        kind: "upload" as const,
        actorId: document.reviewedByUserId,
        metadata: {
          documentId: document.id,
          externalUploadLinkId: document.externalUploadLinkId,
          reviewStatus: document.reviewStatus,
          reviewDecision: document.reviewDecision,
          reviewReason: document.reviewReason,
          reviewedByUserId: document.reviewedByUserId,
          duplicateOfDocumentId: document.duplicateOfDocumentId,
          supersedesDocumentId: document.supersedesDocumentId,
          supersededAt: document.supersededAt,
        },
      })),
    ...input.portalGrants
      .filter((grant) => grant.firmId === input.firmId && grant.matterId === matterId)
      .map((grant) => ({
        id: `portal:${grant.id}`,
        firmId: grant.firmId,
        matterId: grant.matterId,
        occurredAt: grant.revokedAt ?? grant.expiresAt ?? matterOpenedAt,
        title: grant.revokedAt ? "Portal grant revoked" : "Portal grant active",
        kind: "portal" as const,
        actorId: grant.grantedByUserId,
        metadata: { permissions: grant.permissions, contactId: grant.contactId },
      })),
    ...input.shareLinks
      .filter((link) => link.firmId === input.firmId && link.matterId === matterId)
      .map((link) => ({
        id: `share:${link.id}`,
        firmId: link.firmId,
        matterId: link.matterId,
        occurredAt: link.revokedAt ?? link.createdAt,
        title: link.revokedAt ? "Share link revoked" : "Share link created",
        kind: "share" as const,
        actorId: link.grantedByUserId,
        metadata: {
          expiresAt: link.expiresAt,
          permissions: link.permissions,
          requireEmailVerification: link.requireEmailVerification,
          revoked: Boolean(link.revokedAt),
        },
      })),
    ...input.externalUploadLinks
      .filter((link) => link.firmId === input.firmId && link.matterId === matterId)
      .map((link) => ({
        id: `upload-link:${link.id}`,
        firmId: link.firmId,
        matterId: link.matterId,
        occurredAt: link.revokedAt ?? link.createdAt,
        title: link.revokedAt ? "External upload link revoked" : "External upload link created",
        kind: "upload" as const,
        actorId: link.requestedByUserId,
        metadata: {
          expiresAt: link.expiresAt,
          maxUploads: link.maxUploads,
          usedUploads: link.usedUploads,
          revoked: Boolean(link.revokedAt),
        },
      })),
    ...input.accessLogs
      .filter((log) => log.firmId === input.firmId)
      .flatMap((log): ActivityTimelineEntry[] => {
        const accessMatterId = log.shareLinkId
          ? shareMatterIds.get(log.shareLinkId)
          : log.externalUploadLinkId
            ? uploadMatterIds.get(log.externalUploadLinkId)
            : undefined;
        if (accessMatterId !== matterId) return [];
        return [
          {
            id: `access:${log.id}`,
            firmId: log.firmId,
            matterId: accessMatterId,
            occurredAt: log.occurredAt,
            title: `${log.shareLinkId ? "Share" : "External upload"} ${log.action}`,
            kind: log.shareLinkId ? "share" : "upload",
            actorId: log.actorId,
            metadata: {
              action: log.action,
              resourceType: log.resourceType,
              resourceId: log.resourceId,
            },
          },
        ];
      }),
    ...input.emailOutbox
      .filter((email) => email.firmId === input.firmId && email.matterId === matterId)
      .map((email) => ({
        id: `email:${email.id}`,
        firmId: email.firmId,
        matterId: email.matterId,
        occurredAt: email.sentAt ?? email.failedAt ?? email.lastAttemptAt ?? email.queuedAt,
        title: `Outbound email ${email.status}: ${email.templateKey}`,
        kind: "email" as const,
        metadata: {
          templateKey: email.templateKey,
          status: email.status,
          recipientCount: email.to.length + email.cc.length + email.bcc.length,
          relatedResourceType: email.relatedResourceType,
          relatedResourceId: email.relatedResourceId,
          attemptCount: email.attemptCount,
          queuedAt: email.queuedAt,
          lastAttemptAt: email.lastAttemptAt,
          sentAt: email.sentAt,
          failedAt: email.failedAt,
          terminalFailureAt: email.terminalFailureAt,
          failureSummary: sanitizeEmailFailureSummary(
            email.terminalFailureReason ?? email.errorMessage,
          ),
        },
      })),
    ...input.signatureRequests
      .filter((request) => request.firmId === input.firmId && request.matterId === matterId)
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
      .filter((session) => session.firmId === input.firmId && session.matterId === matterId)
      .map((session) => ({
        id: `intake:${session.id}`,
        firmId: session.firmId,
        matterId: session.matterId,
        occurredAt: session.updatedAt,
        title: `Intake ${session.status}`,
        kind: "intake" as const,
        metadata: { templateId: session.templateId, provider: session.provider },
      })),
    ...input.generatedDocuments
      .filter((document) => document.firmId === input.firmId && document.matterId === matterId)
      .map((document) => ({
        id: `generated-document:${document.id}`,
        firmId: document.firmId,
        matterId: document.matterId,
        occurredAt: document.createdAt,
        title: `Generated document: ${document.title}`,
        kind: "document" as const,
        metadata: {
          documentId: document.documentId,
          intakeSessionId: document.intakeSessionId,
          packageDocumentId: document.packageDocumentId,
          packageId: document.packageId,
          provider: document.provider,
        },
      })),
    ...input.calendarEvents
      .filter((event) => event.firmId === input.firmId && event.matterId === matterId)
      .map((event) => ({
        id: `calendar:${event.id}`,
        firmId: event.firmId,
        matterId: event.matterId,
        occurredAt: event.startsAt,
        title: `Calendar ${event.status}: ${event.title}`,
        kind: "calendar" as const,
        actorId: event.createdByUserId,
        metadata: {
          attendeeCount: event.attendees?.length ?? 0,
          endsAt: event.endsAt,
          invitationStatuses: event.attendees?.map((attendee) => attendee.invitationStatus) ?? [],
          sequence: event.sequence,
          status: event.status,
        },
      })),
    ...input.taskDeadlines
      .filter((task) => task.firmId === input.firmId && task.matterId === matterId)
      .map((task) => ({
        id: `task:${task.id}`,
        firmId: task.firmId,
        matterId: task.matterId,
        occurredAt: task.completedAt ?? task.dueAt ?? matterOpenedAt,
        title: `${task.completedAt ? "Task completed" : "Task due"}: ${task.title}`,
        kind: "task" as const,
        actorId: task.assignedToUserId,
        metadata: {
          assignedToUserId: task.assignedToUserId,
          dueAt: task.dueAt,
          completed: Boolean(task.completedAt),
        },
      })),
    ...input.timeEntries
      .filter((entry) => entry.firmId === input.firmId && entry.matterId === matterId)
      .map((entry) => ({
        id: `time:${entry.id}`,
        firmId: entry.firmId,
        matterId: entry.matterId,
        occurredAt: entry.performedAt,
        title: `Task time ${entry.billingStatus}: ${entry.minutes} minutes`,
        kind: "task" as const,
        actorId: entry.userId,
        metadata: {
          billable: entry.billable,
          billingStatus: entry.billingStatus,
          minutes: entry.minutes,
        },
      })),
    ...input.expenses
      .filter((entry) => entry.firmId === input.firmId && entry.matterId === matterId)
      .map((entry) => ({
        id: `expense:${entry.id}`,
        firmId: entry.firmId,
        matterId: entry.matterId,
        occurredAt: entry.incurredAt,
        title: `Expense ${entry.billingStatus}: ${entry.category}`,
        kind: "billing" as const,
        metadata: {
          amountCents: entry.amountCents,
          billingStatus: entry.billingStatus,
          category: entry.category,
          reimbursable: entry.reimbursable,
        },
      })),
    ...input.invoices
      .filter((invoice) => invoice.firmId === input.firmId && invoice.matterId === matterId)
      .map((invoice) => ({
        id: `invoice:${invoice.id}`,
        firmId: invoice.firmId,
        matterId: invoice.matterId,
        occurredAt: invoice.issuedAt ?? invoice.approvedAt ?? invoice.createdAt,
        title: `Invoice ${invoice.status}: ${invoice.invoiceNumber}`,
        kind: "billing" as const,
        actorId: invoice.createdByUserId,
        metadata: {
          balanceDueCents: invoice.balanceDueCents,
          clientContactId: invoice.clientContactId,
          lineCount: invoice.lines.length,
          paidCents: invoice.paidCents,
          status: invoice.status,
          totalCents: invoice.totalCents,
        },
      })),
    ...input.payments
      .filter((payment) => payment.firmId === input.firmId && payment.matterId === matterId)
      .map((payment) => ({
        id: `payment:${payment.id}`,
        firmId: payment.firmId,
        matterId: payment.matterId,
        occurredAt: payment.receivedAt,
        title: `Payment ${payment.status}`,
        kind: "billing" as const,
        actorId: payment.receivedByUserId,
        metadata: {
          allocationCount: payment.allocations.length,
          amountCents: payment.amountCents,
          clientContactId: payment.clientContactId,
          invoiceId: payment.invoiceId,
          method: payment.method,
          status: payment.status,
        },
      })),
    ...input.trustTransferRequests
      .filter((request) => request.firmId === input.firmId && request.matterId === matterId)
      .map((request) => ({
        id: `trust-transfer:${request.id}`,
        firmId: request.firmId,
        matterId: request.matterId,
        occurredAt: request.reviewedAt ?? request.requestedAt,
        title: `Trust transfer ${request.status}`,
        kind: "billing" as const,
        actorId: request.reviewedByUserId ?? request.requestedByUserId,
        metadata: {
          amountCents: request.amountCents,
          clientContactId: request.clientContactId,
          invoiceId: request.invoiceId,
          ledgerTransactionId: request.ledgerTransactionId,
          status: request.status,
        },
      })),
    ...Array.from(ledgerGroups.entries()).map(([key, group]) => {
      const first = group[0]!;
      return {
        id: `ledger:${key}`,
        firmId: first.firmId,
        matterId: first.matterId,
        occurredAt: first.postedAt,
        title: "Ledger transaction posted",
        kind: "ledger" as const,
        metadata: {
          accountTypes: Array.from(
            new Set(group.map((entry) => accountTypesById.get(entry.accountId) ?? "unknown")),
          ),
          clientIds: Array.from(new Set(group.map((entry) => entry.clientId))),
          creditCents: group.reduce((sum, entry) => sum + entry.creditCents, 0),
          debitCents: group.reduce((sum, entry) => sum + entry.debitCents, 0),
          entryCount: group.length,
          transactionId: first.transactionId,
        },
      };
    }),
  ];

  return entries
    .filter((entry) => entry.occurredAt !== EPOCH_OCCURRED_AT)
    .sort(
      (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id),
    );
}

export function mapDraftRow(row: typeof schema.drafts.$inferSelect): DraftRecord {
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

export function mapDraftTemplateRow(
  row: typeof schema.draftTemplates.$inferSelect,
): DraftTemplateRecord {
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

export function mapDraftAssistRow(
  row: typeof schema.draftAssistRecords.$inferSelect,
): DraftAssistRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    sourceType: row.sourceType as DraftAssistRecord["sourceType"],
    draftId: row.draftId ?? undefined,
    documentId: row.documentId ?? undefined,
    task: row.task as DraftAssistRecord["task"],
    providerKey: row.providerKey,
    providerModel: row.providerModel,
    status: row.status as DraftAssistRecord["status"],
    suggestedText: row.suggestedText,
    summary: row.summary ?? undefined,
    reviewDecision: (row.reviewDecision as DraftAssistRecord["reviewDecision"]) ?? undefined,
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata as Record<string, unknown>,
  };
}

export function mapAiOperationalProposalRow(
  row: typeof schema.aiOperationalProposals.$inferSelect,
): AiOperationalProposalRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    kind: row.kind as AiOperationalProposalRecord["kind"],
    status: row.status as AiOperationalProposalRecord["status"],
    source: row.source as AiOperationalProposalRecord["source"],
    providerKey: row.providerKey,
    providerModel: row.providerModel,
    proposal: row.proposal as AiOperationalProposalRecord["proposal"],
    reviewDecision:
      (row.reviewDecision as AiOperationalProposalRecord["reviewDecision"]) ?? undefined,
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata as Record<string, unknown>,
  };
}

export function mapLegalResearchArtifactRow(
  row: typeof schema.legalResearchArtifacts.$inferSelect,
): LegalResearchArtifactRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    kind: row.kind as LegalResearchArtifactRecord["kind"],
    status: row.status as LegalResearchArtifactRecord["status"],
    title: row.title,
    note: row.note ?? undefined,
    sourceReferences: row.sourceReferences as LegalResearchArtifactRecord["sourceReferences"],
    contextLinks: row.contextLinks as LegalResearchArtifactRecord["contextLinks"],
    documentAnalysis:
      (row.documentAnalysis as LegalResearchArtifactRecord["documentAnalysis"]) ?? undefined,
    timeline: (row.timeline as LegalResearchArtifactRecord["timeline"]) ?? undefined,
    checkpoint: (row.checkpoint as LegalResearchArtifactRecord["checkpoint"]) ?? undefined,
    reviewDecision:
      (row.reviewDecision as LegalResearchArtifactRecord["reviewDecision"]) ?? undefined,
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewOnly: row.reviewOnly as true,
    metadata: row.metadata as Record<string, unknown>,
  };
}

export function mapIntakeTemplateRow(
  row: typeof schema.intakeTemplates.$inferSelect,
): IntakeTemplateRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    provider: row.provider as IntakeTemplateRecord["provider"],
    externalTemplateId: row.externalTemplateId,
    active: row.active,
    definitionVersion: row.definitionVersion,
    definition: row.definition,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata as Record<string, unknown>,
  };
}

export function mapInboundEmailAddressRow(
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

export function mapInboundEmailMessageRow(
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

export function mapInboundEmailAttachmentRow(
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

export function mapMatter(row: typeof schema.matters.$inferSelect): Matter {
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

export function mapTimeEntryRow(row: typeof schema.timeEntries.$inferSelect): TimeEntry {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    userId: row.userId,
    performedAt: row.performedAt.toISOString(),
    minutes: row.minutes,
    rateCents: row.rateCents,
    rateRuleId: row.rateRuleId ?? undefined,
    rateSnapshot: row.rateSnapshot ?? undefined,
    narrative: row.narrative,
    billable: row.billable,
    billingStatus: row.billingStatus as TimeEntry["billingStatus"],
  };
}

export function mapExpenseEntryRow(row: typeof schema.expenseEntries.$inferSelect): ExpenseEntry {
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

export function mapContactDataQualityResolutionRow(
  row: typeof schema.contactDataQualityResolutions.$inferSelect,
): ContactDataQualityResolutionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    contactId: row.contactId,
    signalKind: row.signalKind as ContactDataQualityResolutionRecord["signalKind"],
    decision: row.decision as ContactDataQualityResolutionRecord["decision"],
    resolutionNote: row.resolutionNote,
    matterId: row.matterId ?? undefined,
    relatedContactId: row.relatedContactId ?? undefined,
    sourceRecordId: row.sourceRecordId ?? undefined,
    recordedByUserId: row.recordedByUserId,
    recordedAt: row.recordedAt.toISOString(),
  };
}

export function mapBillingPeriodLockRow(
  row: typeof schema.billingPeriodLocks.$inferSelect,
): BillingPeriodLockRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    reason: row.reason ?? undefined,
    lockedByUserId: row.lockedByUserId,
    lockedAt: row.lockedAt.toISOString(),
  };
}

export function billingPeriodLockInsert(
  lock: BillingPeriodLockRecord,
): typeof schema.billingPeriodLocks.$inferInsert {
  return {
    ...lock,
    periodStart: new Date(lock.periodStart),
    periodEnd: new Date(lock.periodEnd),
    lockedAt: new Date(lock.lockedAt),
  };
}

export function mapBillingRateRuleRow(
  row: typeof schema.billingRateRules.$inferSelect,
): BillingRateRuleRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    label: row.label,
    matterId: row.matterId ?? undefined,
    userId: row.userId ?? undefined,
    role: row.role ?? undefined,
    scope: row.scope,
    rateCents: row.rateCents,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveUntil: dateToIso(row.effectiveUntil),
    active: row.active,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function billingRateRuleInsert(
  rule: BillingRateRuleRecord,
): typeof schema.billingRateRules.$inferInsert {
  return {
    ...rule,
    effectiveFrom: new Date(rule.effectiveFrom),
    effectiveUntil: rule.effectiveUntil ? new Date(rule.effectiveUntil) : null,
    createdAt: new Date(rule.createdAt),
    updatedAt: new Date(rule.updatedAt),
  };
}

export function mapInvoiceRow(row: typeof schema.invoices.$inferSelect): InvoiceRecord {
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

export function invoiceInsert(invoice: InvoiceRecord): typeof schema.invoices.$inferInsert {
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

export function mapInvoiceLineRow(row: typeof schema.invoiceLines.$inferSelect): InvoiceLineRecord {
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

export function invoiceLineInsert(
  line: InvoiceLineRecord,
): typeof schema.invoiceLines.$inferInsert {
  return {
    ...line,
    createdAt: new Date(line.createdAt),
  };
}

export function mapPaymentRow(row: typeof schema.manualPayments.$inferSelect): ManualPaymentRecord {
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

export function paymentInsert(
  payment: ManualPaymentRecord,
): typeof schema.manualPayments.$inferInsert {
  return {
    ...payment,
    receivedAt: new Date(payment.receivedAt),
  };
}

export function mapPaymentAllocationRow(
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

export function paymentAllocationInsert(
  allocation: PaymentAllocationRecord,
): typeof schema.paymentAllocations.$inferInsert {
  return {
    ...allocation,
    allocatedAt: new Date(allocation.allocatedAt),
  };
}

export function mapHostedPaymentRequestRow(
  row: typeof schema.hostedPaymentRequests.$inferSelect,
): HostedPaymentRequestRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    invoiceId: row.invoiceId,
    clientContactId: row.clientContactId ?? undefined,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    hostedPath: row.hostedPath,
    delivery: row.delivery,
    reminder: row.reminder,
    paymentPlan: row.paymentPlan,
    creditWriteOffPosture: row.creditWriteOffPosture,
    processor: row.processor,
    evidence: row.evidence,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: dateToIso(row.expiresAt),
  };
}

export function hostedPaymentRequestInsert(
  request: HostedPaymentRequestRecord,
): typeof schema.hostedPaymentRequests.$inferInsert {
  return {
    ...request,
    createdAt: new Date(request.createdAt),
    updatedAt: new Date(request.updatedAt),
    expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
  };
}

export function mapTrustTransferRequestRow(
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

export function trustTransferRequestInsert(
  request: TrustTransferRequestRecord,
): typeof schema.billingTrustTransferRequests.$inferInsert {
  return {
    ...request,
    requestedAt: new Date(request.requestedAt),
    reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
  };
}
