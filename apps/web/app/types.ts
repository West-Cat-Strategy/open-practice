import type {
  AuditEventTaxonomySummary,
  BillingPeriodLockRecord,
  BillingRateRuleRecord,
  BillingRateSnapshot,
  BillDeliveryState,
  BillReminderState,
  Contact,
  CreditWriteOffPosture,
  HostedPaymentProcessorState,
  ConflictCandidate,
  DocumentAssemblyWorkspace,
  DocumentRecord,
  GeneratedDocumentRecord,
  DraftRecord,
  DraftAssistRecord,
  DraftTemplateRecord,
  ExpenseCategoryProfileCue,
  ExpenseEntry,
  Firm,
  ActivityTimelineEntry,
  CalendarEventRecord,
  CalendarEventAttendeeRecord,
  CalendarEventReminderRecord,
  CalendarMeetingInvitationBoundary,
  CalendarSchedulingRequestSummary,
  ContactDossier,
  ContactDataQualityResolutionRecord,
  DashboardSectionCapability,
  IntakeSessionRecord,
  IntakePipelineLeadRecord,
  IntakePipelineSummary,
  IntakeTemplateRecord,
  IntakeFormReviewRecord,
  IntakeVariableProposal,
  LedgerAccount,
  LedgerAccountingReviewProfileRecord,
  LedgerEntry,
  LedgerReconciliationRecord,
  LedgerAccountingReviewSummary,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormLinkRecord,
  IntakeFormItemActionRecord,
  IntakeTemplatePreviewResult,
  JurisdictionalTrustReport,
  Matter,
  MatterParty,
  MatterSetupProfile,
  PaymentPlanPlaceholder,
  PublicConsultationIntakeNotificationSettings,
  PublicConsultationIntakeRecord,
  StaffReportHistoryItem,
  StaffReportingWorkspace,
  SignatureRequestRecord,
  TaskDeadlineWorkbench,
  TimeEntry,
  User,
} from "@open-practice/domain";

export type {
  ContactDossier,
  ContactDataQualityResolutionRecord,
  IntakePipelineLeadRecord,
  IntakePipelineSummary,
};

export interface MatterSummary extends Matter {
  parties: Array<MatterParty & { contact: Contact }>;
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  activity: ActivityTimelineEntry[];
  trustBalanceCents: number;
  setupProfile: MatterSetupProfile;
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

export interface ConflictResponse {
  results: ConflictCandidate[];
  auditChainValid: boolean;
}

export interface AuditResponse {
  valid: boolean;
  taxonomySummary: AuditEventTaxonomySummary;
}

export interface SessionResponse {
  user: User;
}

export interface CapabilitiesResponse {
  sections: DashboardSectionCapability[];
}

export function canRecordContactDataQualityResolutions(
  sections: DashboardSectionCapability[],
): boolean {
  return sections.some(
    (section) =>
      section.key === "contacts" && section.enabled && section.actions.includes("update"),
  );
}

export type ContactDossiersResponse = ContactDossier[];

export type ContactReviewQueueSignal = Omit<
  ContactDossier["qualityReview"]["signals"][number],
  "matchedValue"
> & {
  matchedValueRedacted: boolean;
};

export interface ContactReviewQueueItem {
  contact: {
    id: string;
    kind: Contact["kind"];
    displayName: string;
    aliasCount: number;
    identifierCount: number;
  };
  matters: ContactDossier["matters"];
  summary: ContactDossier["qualityReview"]["summary"];
  signals: ContactReviewQueueSignal[];
  auditSafe: true;
}

export interface ContactReviewQueueResponse {
  summary: {
    totalContacts: number;
    reviewItemCount: number;
    duplicateCandidateCount: number;
    sensitivePartyCueCount: number;
    revalidationPromptCount: number;
  };
  items: ContactReviewQueueItem[];
}

export type ContactDataQualityResolutionsResponse = ContactDataQualityResolutionRecord[];

export type DocumentAssemblyWorkbenchStatus = "available" | "access_denied" | "unavailable";

export type DocumentAssemblyWorkbenchResponse = DocumentAssemblyWorkspace & {
  status: DocumentAssemblyWorkbenchStatus;
};

export interface DocumentAssemblyDashboardResponse {
  workbenchesByMatterId: Record<string, DocumentAssemblyWorkbenchResponse>;
}

export interface IntakeSessionsResponse {
  templates: IntakeTemplateRecord[];
  sessions: IntakeSessionRecord[];
}

export type IntakeSessionCreateResponse = IntakeSessionRecord & {
  queuedEmail?: unknown;
};

export interface DeliveryConfirmationPayload {
  confirmed: true;
  channel: "email";
  recipientCount: number;
}

export function buildEmailDeliveryConfirmation(
  recipientCount: number,
): DeliveryConfirmationPayload {
  return {
    confirmed: true,
    channel: "email",
    recipientCount,
  };
}

export function buildIntakeSessionCreatePayload(input: {
  matter: Pick<MatterSummary, "id">;
  template: Pick<IntakeTemplateRecord, "id">;
  deliveryConfirmation?: DeliveryConfirmationPayload;
}): {
  matterId: string;
  templateId: string;
  evidence: { source: "dashboard" };
  deliveryConfirmation?: DeliveryConfirmationPayload;
} {
  return {
    matterId: input.matter.id,
    templateId: input.template.id,
    evidence: { source: "dashboard" },
    ...(input.deliveryConfirmation ? { deliveryConfirmation: input.deliveryConfirmation } : {}),
  };
}

export function upsertIntakeSession(
  sessions: IntakeSessionsResponse["sessions"],
  session: IntakeSessionCreateResponse,
): IntakeSessionsResponse["sessions"] {
  return sessions.some((candidate) => candidate.id === session.id)
    ? sessions.map((candidate) => (candidate.id === session.id ? session : candidate))
    : [session, ...sessions];
}

export type IntakeFormLinkSummary = Omit<IntakeFormLinkRecord, "tokenHash"> & {
  status: string;
};

export interface IntakeFormLinksResponse {
  links: IntakeFormLinkSummary[];
  actionsByLinkId?: Record<string, IntakeFormItemActionRecord[]>;
}

export interface IntakeFormLinkCreateResponse {
  link: IntakeFormLinkSummary;
  token?: string;
  portalUrl?: string;
}

export interface IntakeFormReviewResponse {
  review: IntakeFormReviewRecord;
  followUp?: {
    link: IntakeFormLinkSummary;
    token?: string;
    portalUrl?: string;
  };
}

export interface IntakeFormLinkRevokeResponse {
  link: IntakeFormLinkSummary | null;
}

export interface IntakeVariableProposalsResponse {
  proposals: IntakeVariableProposal[];
}

export interface IntakeFormsDashboardResponse {
  linksByMatterId: Record<string, IntakeFormLinkSummary[]>;
  actionsByLinkId: Record<string, IntakeFormItemActionRecord[]>;
  proposalsByMatterId: Record<string, IntakeVariableProposal[]>;
}

export interface IntakePipelineResponse {
  leads: IntakePipelineLeadRecord[];
  summary: IntakePipelineSummary;
}

export interface IntakePipelineDashboardResponse extends IntakePipelineResponse {
  status: "available" | "access_denied" | "unavailable";
}

export type PublicConsultationIntake = PublicConsultationIntakeRecord;
export type PublicConsultationIntakeSettings = PublicConsultationIntakeNotificationSettings;

export interface PublicConsultationIntakesResponse {
  intakes: PublicConsultationIntake[];
}

export interface PublicConsultationIntakeConvertResponse {
  intake: PublicConsultationIntake;
  matter: MatterSummary;
}

export interface PublicConsultationDashboardResponse {
  settings: PublicConsultationIntakeSettings;
  intakes: PublicConsultationIntake[];
  status: "available" | "access_denied" | "unavailable";
}

export interface IntakeTemplateSavePayload {
  id?: string;
  name: string;
  active: boolean;
  definitionVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
}

export type IntakeTemplatePreviewResponse = IntakeTemplatePreviewResult;

export type SignatureRequestsResponse = SignatureRequestRecord[];

export interface DraftingDashboardResponse {
  templates: DraftTemplateRecord[];
  draftsByMatterId: Record<string, DraftRecord[]>;
}

export interface DraftAssistStatusResponse {
  status: "disabled" | "configured";
  reason?: string;
  provider?: string;
  model?: string;
  supportedTasks: Array<"summarize" | "suggest_revision" | "continue_draft">;
}

export interface DraftAssistRecordsResponse {
  records: DraftAssistRecord[];
}

export interface DraftExportResponse {
  format: "pdf" | "docx";
  title: string;
  contentType: string;
  byteLength: number;
  checksumSha256: string;
  storageKey: string;
  document: DocumentRecord;
  generatedDocument: GeneratedDocumentRecord;
}

export interface ExternalUploadLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  requestedByUserId: string;
  expiresAt: string;
  maxUploads: number;
  usedUploads: number;
  createdAt: string;
  revokedAt?: string;
}

export interface ExternalUploadReviewItem {
  id: string;
  matterId: string;
  externalUploadLinkId?: string;
  title: string;
  version: number;
  classification: string;
  legalHold: boolean;
  uploadStatus: string;
  checksumStatus: string;
  scanStatus: string;
  reviewStatus: string;
  reviewDecision?: string;
  reviewReason?: string;
  reviewMetadata: Record<string, unknown>;
  reviewedByUserId?: string;
  reviewedAt?: string;
  duplicateOfDocumentId?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  accessLogProof?: {
    total: number;
    latestAt?: string;
    outcomes: string[];
  };
}

export interface ExternalUploadsStatusResponse {
  status: string;
  provider?: string;
  reason?: string;
}

export interface ExternalUploadsListResponse {
  uploads: ExternalUploadLinkRecord[];
  reviewItems?: ExternalUploadReviewItem[];
}

export interface ExternalUploadCreateResponse {
  upload: ExternalUploadLinkRecord | null;
  token?: string;
  reason?: string;
}

export interface ExternalUploadRevokeResponse {
  upload: ExternalUploadLinkRecord;
}

export interface ExternalUploadsDashboardResponse {
  status: ExternalUploadsStatusResponse;
  uploadsByMatterId: Record<string, ExternalUploadLinkRecord[]>;
  reviewItemsByMatterId: Record<string, ExternalUploadReviewItem[]>;
}

export interface CalendarCredentialSummary {
  id: string;
  username: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface CalendarEventsResponse {
  events: CalendarEventRecord[];
  guestSessions?: CalendarGuestSessionSummary[];
  schedulingRequests?: CalendarSchedulingRequestSummary[];
  caldavUrl: string;
  subscriptionUrl: string;
}

export interface CalendarCredentialsResponse {
  credentials: CalendarCredentialSummary[];
}

export interface CalendarCredentialCreateResponse {
  credential: CalendarCredentialSummary;
  username: string;
  password: string;
  caldavUrl: string;
  principalUrl: string;
  calendarHomeUrl: string;
}

export interface CalendarCredentialRevokeResponse {
  credential: CalendarCredentialSummary;
}

export interface CalendarAttendeeMutationResponse {
  attendee: CalendarEventAttendeeRecord;
}

export interface CalendarEventMutationResponse {
  event: CalendarEventRecord;
}

export interface CalendarReminderMutationResponse {
  reminder: CalendarEventReminderRecord;
}

export interface CalendarMeetingLinkMutationResponse {
  event: CalendarEventRecord;
}

export interface CalendarInvitationResult {
  attendee: CalendarEventAttendeeRecord;
  queuedEmail?: {
    id: string;
    templateKey: string;
    status: string;
    queuedAt: string;
    jobId: string;
  };
}

export interface CalendarInvitationResponse {
  results: CalendarInvitationResult[];
  meetingInvitationBoundary?: CalendarMeetingInvitationBoundary;
}

export type CalendarGuestAccessStatus = "issued" | "waiting" | "admitted" | "denied" | "revoked";

export type CalendarGuestSessionStatus = "created" | "open" | "locked" | "ended" | "expired";

export interface CalendarGuestSessionGuestSummary {
  id: string;
  sessionId: string;
  status: CalendarGuestAccessStatus;
  expiresAt: string;
  checkedInAt?: string;
  admittedAt?: string;
  deniedAt?: string;
  revokedAt?: string;
}

export interface CalendarGuestSessionSummary {
  id: string;
  eventId: string;
  status: CalendarGuestSessionStatus;
  lobbyStatus?: CalendarGuestSessionStatus;
  provider?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  retentionUntil?: string;
  issuedCount: number;
  waitingCount: number;
  admittedCount: number;
  deniedCount: number;
  revokedCount: number;
  guests: CalendarGuestSessionGuestSummary[];
}

export interface CalendarGuestSessionMutationResponse {
  session: CalendarGuestSessionSummary;
}

export interface CalendarGuestSessionIssueResponse {
  session: CalendarGuestSessionSummary;
  guest: CalendarGuestSessionGuestSummary;
  token: string;
  portalUrl: string;
}

export interface CalendarGuestSessionGuestMutationResponse {
  session?: CalendarGuestSessionSummary | null;
  guest: CalendarGuestSessionGuestSummary;
}

export interface PublicGuestSessionResponse {
  session: {
    status: CalendarGuestSessionStatus;
    lobbyStatus?: CalendarGuestSessionStatus;
    startsAt?: string;
    endsAt?: string;
    issuedCount?: number;
    waitingCount?: number;
    admittedCount?: number;
    deniedCount?: number;
    revokedCount?: number;
  };
  meetingAccess?: {
    status: "pending_lobby_review" | "staff_controlled" | "unavailable";
    deliveryBoundary: "calendar_invitation_or_staff_handoff";
    meetingUrlAvailable: false;
  };
  guest?: {
    status: CalendarGuestAccessStatus;
    checkedInAt?: string;
    admittedAt?: string;
    deniedAt?: string;
    revokedAt?: string;
  };
  lobby?: {
    status?: CalendarGuestSessionStatus;
    waitingCount?: number;
    admittedCount?: number;
    deniedCount?: number;
    revokedCount?: number;
  };
}

export interface CalendarMatterLinks {
  caldavUrl: string;
  subscriptionUrl: string;
}

export interface CalendarDashboardResponse {
  eventsByMatterId: Record<string, CalendarEventRecord[]>;
  guestSessionsByEventId: Record<string, CalendarGuestSessionSummary[]>;
  schedulingRequestsByMatterId: Record<string, CalendarSchedulingRequestSummary[]>;
  linksByMatterId: Record<string, CalendarMatterLinks>;
  credentials: CalendarCredentialSummary[];
}

export interface LegalClinicProgramSummary {
  id: string;
  firmId: string;
  name: string;
  status: "active" | "paused" | "archived";
  serviceArea: string;
  eligibilitySummary: string;
  defaultReferralSource?: string;
  defaultReferralStatus: "not_referred" | "referral_needed" | "referred" | "accepted" | "declined";
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface MatterLegalClinicProfileSummary {
  id: string;
  firmId: string;
  matterId: string;
  programId: string;
  eligibilityStatus: "unknown" | "likely_eligible" | "ineligible" | "needs_review";
  referralSource?: string;
  referralStatus: "not_referred" | "referral_needed" | "referred" | "accepted" | "declined";
  referralDate?: string;
  nextReviewDate?: string;
  clinicRelationshipRole: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId: string;
  metadata: Record<string, unknown>;
}

export interface LegalClinicProgramsResponse {
  programs: LegalClinicProgramSummary[];
}

export interface LegalClinicProfilesResponse {
  profiles: MatterLegalClinicProfileSummary[];
}

export interface LegalClinicProfileResponse {
  profile: MatterLegalClinicProfileSummary | null;
}

export interface LegalClinicDashboardResponse {
  programs: LegalClinicProgramSummary[];
  profilesByMatterId: Record<string, MatterLegalClinicProfileSummary[]>;
}

export interface FiscalHostProgramMetadataSummary {
  hostName?: string;
  programCode?: string;
  reportingCadence?: string;
}

export interface FiscalHostRestrictedFundMetadataSummary {
  fundCode?: string;
  purpose?: string;
  reviewStatus?: string;
  nextReviewDate?: string;
}

export interface FiscalHostWorkflowSelectorSummary {
  programMetadata: FiscalHostProgramMetadataSummary;
  restrictedFundMetadata: FiscalHostRestrictedFundMetadataSummary;
}

export interface EmailDeliveryEventSummary {
  id: string;
  eventType: string;
  occurredAt: string;
  providerMessageId?: string;
  attemptNumber?: number;
  jobId?: string;
  source: string;
  errorSummary?: string;
}

export interface EmailDeliveryHistoryItem {
  id: string;
  matterId: string;
  templateKey: string;
  status: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  recipientCount: number;
  attemptCount: number;
  queuedAt: string;
  lastAttemptAt?: string;
  sentAt?: string;
  failedAt?: string;
  terminalFailureAt?: string;
  failureSummary?: string;
  events: EmailDeliveryEventSummary[];
}

export interface EmailDeliveryHistoryResponse {
  emails: EmailDeliveryHistoryItem[];
}

export interface EmailDeliveryDashboardResponse {
  emailsByMatterId: Record<string, EmailDeliveryHistoryItem[]>;
}

export interface CommunicationsInboxInboundEmail {
  id: string;
  matterId?: string;
  status: string;
  labels: string[];
  receivedAt: string;
  attachmentCount: number;
  triage?: {
    status?: string;
    assignedToUserId?: string;
    contactIds?: string[];
    updatedAt?: string;
    updatedByUserId?: string;
  };
}

export interface CommunicationsInboxOutboundDelivery {
  id: string;
  matterId: string;
  templateKey: string;
  status: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  recipientCount: number;
  attemptCount: number;
  queuedAt: string;
  lastAttemptAt?: string;
  sentAt?: string;
  failedAt?: string;
  terminalFailureAt?: string;
  failureSummary?: string;
  events: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    attemptNumber?: number;
    source: string;
    errorSummary?: string;
  }>;
}

export interface CommunicationsInboxConversation {
  id: string;
  matterId: string;
  topic: string;
  status: string;
  exportState: string;
  notificationBoundary: string;
  retentionUntil?: string;
  accessRevokedAt?: string;
  updatedAt: string;
  messageCount?: number;
  latestMessageAt?: string;
  notificationSummary?: {
    notificationCount: number;
    unreadNotificationCount: number;
    mutedNotificationCount: number;
    latestNotificationAt?: string;
    latestReadAt?: string;
    latestMutedAt?: string;
  };
}

export type CommunicationsChannelHistoryKind =
  | "inbound_email"
  | "outbound_email"
  | "conversation"
  | "phone_note_placeholder"
  | "text_note_placeholder"
  | "client_update_draft";

export interface CommunicationsChannelHistoryItem {
  id: string;
  matterId: string;
  kind: CommunicationsChannelHistoryKind;
  channel: "email" | "conversation" | "phone" | "text" | "client_update";
  direction: "inbound" | "outbound" | "internal" | "planned_outbound";
  occurredAt: string;
  status: string;
  title: string;
  detail: string;
  sourceResourceType:
    | "inbound_email"
    | "email_outbox"
    | "conversation_thread"
    | "conversation_message";
  sourceResourceId: string;
  metadataRedacted: true;
  bodyRedacted?: true;
  consentStatus?: string;
  recipientCount?: number;
  attachmentCount?: number;
  messageCount?: number;
  eventCount?: number;
  bodyLength?: number;
}

export interface ClientUpdateDraftRequestSummary {
  id: string;
  matterId: string;
  threadId: string;
  messageId: string;
  status: "draft_requested" | "thread_closed" | "thread_revoked";
  requestedAt: string;
  requestedByUserIdPresent: boolean;
  bodyLength: number;
  bodyRedacted: true;
  metadataRedacted: true;
  automaticSendEnabled: false;
  portalComposerEnabled: false;
}

export interface CommunicationsInboxContactCue {
  contact: {
    id: string;
    kind: string;
    displayName: string;
  };
  matterLinks: Array<{
    matterId: string;
    role: string;
    adverse: boolean;
    confidential: boolean;
    portalActive: boolean;
    portalPermissionCount: number;
  }>;
  cueSummary: {
    conflictCueCount: number;
    qualitySignalCount: number;
    portalActiveGrantCount: number;
  };
}

export interface CommunicationsInboxMatterResponse {
  status: string;
  matterId: string;
  channelState: {
    inboundEmailStatus: "configured" | "disabled";
    outboundEmailStatus: "configured" | "disabled";
    inboundEmailAddressCount: number;
    enabledInboundEmailAddressCount: number;
  };
  inboundEmail: CommunicationsInboxInboundEmail[];
  outboundDeliveryHistory: CommunicationsInboxOutboundDelivery[];
  conversations: CommunicationsInboxConversation[];
  channelHistory: CommunicationsChannelHistoryItem[];
  clientUpdateDraftRequests: ClientUpdateDraftRequestSummary[];
  contactCues: CommunicationsInboxContactCue[];
}

export interface CommunicationsInboxDashboardResponse {
  inboxByMatterId: Record<string, CommunicationsInboxMatterResponse>;
}

export type DocumentProcessingGroup =
  | "ready_to_process"
  | "queued_or_active"
  | "needs_review"
  | "blocked";

export type DocumentProcessingDocumentSummary = Pick<
  DocumentRecord,
  | "id"
  | "matterId"
  | "title"
  | "version"
  | "classification"
  | "legalHold"
  | "uploadStatus"
  | "checksumStatus"
  | "scanStatus"
  | "reviewStatus"
  | "reviewDecision"
  | "reviewReason"
  | "reviewedAt"
  | "duplicateOfDocumentId"
  | "uploadedAt"
  | "verifiedAt"
>;

export interface DocumentProcessingProviderStatus {
  kind: string;
  status: "configured" | "disabled" | string;
  reason?: string;
  providers?: Array<{
    key: string;
    enabled: boolean;
    updatedAt?: string;
  }>;
}

export interface DocumentProcessingWorkerQueueStatus {
  queueName: string;
  status: "configured" | "not_configured" | "reserved" | string;
  reason?: string;
  task?: string;
  actionable?: boolean;
}

export interface DocumentProcessingReservedTask {
  task: string;
  queueName: string;
  status: "reserved" | string;
  reason?: string;
  actionable?: boolean;
}

export interface DocumentProcessingQueueSummary {
  queueName: string;
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  latestQueuedAt?: string;
}

export interface DocumentProcessingSummary {
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  byQueue?: DocumentProcessingQueueSummary[];
}

export interface DocumentProcessingLatestJob {
  id: string;
  queueName: string;
  jobName?: string;
  status: string;
  terminal?: boolean;
  failed?: boolean;
  retryable?: boolean;
  attemptsMade?: number;
  maxAttempts?: number;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  failedAt?: string;
  errorSummary?: string;
}

export interface DocumentProcessingLatestExtraction {
  id?: string;
  status?: string;
  provider?: string;
  createdAt?: string;
  completedAt?: string;
  confidence?: number;
  pageCount?: number;
  language?: string;
  summary?: string;
  errorSummary?: string;
}

export type DocumentReviewSuggestionGroup =
  | "classification"
  | "duplicate_or_supersession"
  | "matter_contact"
  | "missing_metadata"
  | "retention_review";

export interface DocumentReviewSuggestionCue {
  id: string;
  group: DocumentReviewSuggestionGroup;
  label: string;
  detail?: string;
  tone: "neutral" | "ready" | "risk";
  documentId?: string;
  relatedDocumentId?: string;
  classification?: string;
  confidence?: number;
  status?: string;
  role?: string;
  contactId?: string;
  contactName?: string;
  metadataKeys?: string[];
}

export interface DocumentReviewSuggestions {
  reviewerOnly: true;
  mutating: false;
  summaryCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
  groups: Record<DocumentReviewSuggestionGroup, DocumentReviewSuggestionCue[]>;
}

export type DocumentMetadataTagGroup =
  | "classification"
  | "review_status"
  | "scan_status"
  | "legal_hold"
  | "ocr"
  | "reviewer_cue";

export type DocumentMetadataOcrStatus = "not_available" | "queued" | "completed" | "failed";

export interface DocumentMetadataTag {
  key: string;
  label: string;
  value: string;
  group: DocumentMetadataTagGroup;
  tone: "neutral" | "ready" | "risk";
  count?: number;
}

export interface DocumentMetadataSearchFilters {
  q?: string;
  classification?: DocumentRecord["classification"];
  reviewStatus?: DocumentRecord["reviewStatus"];
  scanStatus?: DocumentRecord["scanStatus"];
  ocrStatus?: DocumentMetadataOcrStatus;
  cueGroup?: DocumentReviewSuggestionGroup;
  tag?: string;
}

export interface DocumentMetadataSearchResultSummary {
  documentId: string;
  title: string;
  matterId: string;
  classification: DocumentRecord["classification"];
  reviewStatus: DocumentRecord["reviewStatus"];
  scanStatus: DocumentRecord["scanStatus"];
  legalHold: boolean;
  ocrStatus: DocumentMetadataOcrStatus;
  tagKeys: string[];
  matchedFields: string[];
  cueCounts: Record<DocumentReviewSuggestionGroup | "total", number>;
}

export interface DocumentMetadataSearchPosture {
  reviewOnly: true;
  mutating: false;
  filters: DocumentMetadataSearchFilters;
  totalCount: number;
  matchedCount: number;
  tags: DocumentMetadataTag[];
  ocrPosture: {
    rawTextSearch: false;
    rawTextReturned: false;
    searchableFields: string[];
    statusCounts: Record<DocumentMetadataOcrStatus, number>;
  };
  results: DocumentMetadataSearchResultSummary[];
}

export interface DocumentProcessingWorkbenchItem {
  document: DocumentProcessingDocumentSummary;
  group: DocumentProcessingGroup;
  queueEligibility: {
    eligible: boolean;
    reason?: string;
  };
  latestJob?: DocumentProcessingLatestJob;
  latestExtraction?: DocumentProcessingLatestExtraction;
  reviewSuggestions?: DocumentReviewSuggestions;
  metadataTags?: DocumentMetadataTag[];
}

export interface DocumentProcessingWorkbenchResponse {
  matterId: string;
  status: "configured" | "disabled" | "available" | "unavailable" | string;
  reason?: string;
  providerStatus: DocumentProcessingProviderStatus[];
  workerQueues: DocumentProcessingWorkerQueueStatus[];
  reservedQueues?: DocumentProcessingWorkerQueueStatus[];
  actionableTasks?: string[];
  reservedTasks?: DocumentProcessingReservedTask[];
  reviewQueue?: {
    needsReviewCount: number;
    duplicateCandidateCount: number;
    supersessionCount: number;
    failedScanCount: number;
  };
  metadataSearch?: DocumentMetadataSearchPosture;
  summary: DocumentProcessingSummary;
  documents: DocumentProcessingWorkbenchItem[];
}

export interface DocumentProcessingDashboardResponse {
  workbenchesByMatterId: Record<string, DocumentProcessingWorkbenchResponse>;
}

export interface DocumentProcessingStatusResponse {
  status: string;
  reason?: string;
  workers: WorkerQueueStatus[];
  workerQueues: WorkerQueueStatus[];
  reservedQueues?: WorkerQueueStatus[];
  supportedTasks: string[];
  actionableTasks?: string[];
  reservedTasks?: DocumentProcessingReservedTask[];
  providers: Array<{ kind: string; key: string }>;
  providerStatus: DocumentProcessingProviderStatus[];
  summary: WorkerRunSummary;
  jobs: WorkerRunSummaryItem[];
}

export type BillingEntryStatus = "draft" | "submitted" | "approved" | "billed" | "written_off";

export interface BillingTimeItem {
  id: string;
  matterId: string;
  userId?: string;
  performedAt?: string;
  minutes: number;
  rateCents: number;
  rateRuleId?: string;
  rateSnapshot?: BillingRateSnapshot;
  amountCents: number;
  narrative: string;
  status: BillingEntryStatus;
}

export interface BillingExpenseItem {
  id: string;
  matterId: string;
  incurredAt?: string;
  amountCents: number;
  category: string;
  categoryProfileKey?: string;
  description: string;
  status: BillingEntryStatus;
}

export interface BillingInvoiceSummary {
  id: string;
  matterId: string;
  number: string;
  status: "draft" | "approved" | "issued" | "partially_paid" | "paid" | "void";
  totalCents: number;
  balanceDueCents: number;
  issuedAt?: string;
  dueAt?: string;
}

export interface BillingPaymentSummary {
  id: string;
  matterId: string;
  invoiceId?: string;
  amountCents: number;
  method: "cash" | "card" | "eft" | "cheque" | "other";
  receivedAt: string;
  reference?: string;
  evidencePresent?: boolean;
}

export interface BillingPaymentRequestSummary {
  id: string;
  matterId: string;
  invoiceId: string;
  clientContactId?: string;
  status: "ready_to_send" | "sent" | "viewed" | "cancelled" | "expired";
  amountCents: number;
  hostedPath: string;
  delivery: BillDeliveryState;
  reminder: BillReminderState;
  paymentPlan: PaymentPlanPlaceholder;
  creditWriteOffPosture: CreditWriteOffPosture;
  processor: HostedPaymentProcessorState;
  evidencePresent: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface MatterBillingSummary {
  matterId: string;
  captureReviewTime: BillingTimeItem[];
  captureReviewExpenses: BillingExpenseItem[];
  unbilledTime: BillingTimeItem[];
  unbilledExpenses: BillingExpenseItem[];
  invoices: BillingInvoiceSummary[];
  payments: BillingPaymentSummary[];
  paymentRequests: BillingPaymentRequestSummary[];
}

export interface BillingDashboardResponse {
  canView: boolean;
  summary: {
    unbilledTimeCents: number;
    unbilledExpenseCents: number;
    draftInvoiceCents: number;
    issuedBalanceDueCents: number;
    hostedPaymentRequestCents: number;
    lockedPeriodCount: number;
    activeLockedPeriodCount: number;
    activeRateRuleCount: number;
  };
  periodLocks: BillingPeriodLockRecord[];
  rateRules: BillingRateRuleRecord[];
  expenseCategoryProfiles: readonly ExpenseCategoryProfileCue[];
  matters: MatterBillingSummary[];
}

export interface TrustControlsDashboardResponse {
  ledger: {
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  };
  approvals: LedgerTransactionApprovalRecord[];
  reconciliations: LedgerReconciliationRecord[];
  accountingReview: {
    matchRuleProfiles: LedgerStatementMatchRuleProfileRecord[];
    accountingProfiles: LedgerAccountingReviewProfileRecord[];
    summary: LedgerAccountingReviewSummary;
  };
  diagnostics: {
    pendingApprovalTransactionIds: string[];
    rejectedApprovalTransactionIds: string[];
    unreconciledAccountIds: string[];
    exceptionReconciliationIds: string[];
    overdrawnBalanceKeys: string[];
  };
  trustControlPolicy?: {
    automaticTrustPosting: false;
    transferRequestPosting: string;
    makerChecker: {
      ledgerTransactionApproval: string;
      trustTransferRequest: string;
      reconciliation: string;
    };
    compliancePosture: string;
  };
}

export type JurisdictionalTrustReportResponse = JurisdictionalTrustReport;

export interface QueueItem {
  id: string;
  matterId?: string;
  title: string;
  status: string;
  priority: "low" | "medium" | "high";
}

export interface QueueSection {
  key: string;
  label: string;
  items: QueueItem[];
}

export interface QueuesResponse {
  sections: QueueSection[];
}

export interface ConnectorSummary {
  id: string;
  type: "calendar" | "document_processing" | "email" | "generic" | "inbound_email" | string;
  key: string;
  displayName: string;
  status: "disabled" | "enabled" | "paused" | "error" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectorsResponse {
  connectors: ConnectorSummary[];
}

export interface ConnectorOutboxItem {
  id: string;
  connectorId: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  idempotencyKeyPresent: boolean;
  status: "pending" | "leased" | "delivered" | "failed" | "dead_letter" | "cancelled" | string;
  payloadSummary: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  leasePresent: boolean;
  leasedUntil?: string;
  deliveredAt?: string;
  deadLetteredAt?: string;
  lastErrorSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectorOutboxResponse {
  outbox: ConnectorOutboxItem[];
}

export interface ConnectorOutboxRecoveryResponse {
  outbox: ConnectorOutboxItem;
  deliveryJob?: {
    id: string;
    queueName: string;
    jobName: string;
    status: string;
    bullJobId?: string;
    targetResourceType?: string;
    targetResourceId?: string;
    queuedAt?: string;
    idempotencyKeyPresent: boolean;
  };
}

export interface ConnectorOperationsResponse {
  connectors: ConnectorSummary[];
  outbox: ConnectorOutboxItem[];
  status: "available" | "access_denied" | "unavailable";
}

export interface OperationalViewResult {
  [key: string]: unknown;
  id?: string;
  viewKey?: string;
  matterId?: string;
  title?: string;
  status?: string;
  priority?: "high" | "medium" | "low" | string;
  reason?: string;
  lastActivityAt?: string;
  dueAt?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface OperationalViewsResponse {
  generatedAt?: string;
  views: Array<{
    definition: {
      key: string;
      label: string;
      defaultPriority?: "high" | "medium" | "low" | string;
    };
    resultCount: number;
    results?: OperationalViewResult[];
  }>;
}

export interface SavedOperationalViewDefinition {
  id: string;
  firmId: string;
  ownerUserId: string;
  surface: "queues" | "matters";
  name: string;
  filters: Record<string, unknown>;
  columns: unknown[];
  sort: Record<string, unknown>;
  rowLimit: number;
  dashboardBehavior: Record<string, unknown>;
  permissionScope: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface OperationalViewDefinitionsResponse {
  definitions: SavedOperationalViewDefinition[];
}

export type StaffReportingWorkspaceResponse = StaffReportingWorkspace;

export interface StaffReportExportRequestResponse {
  exportRequest: StaffReportHistoryItem;
}

export type WorkerRunQueueFilter = "all" | "email" | "ocr";

export interface WorkerQueueStatus {
  queueName: string;
  status: "configured" | "not_configured" | "reserved" | string;
  reason?: string;
  task?: string;
  actionable?: boolean;
}

export interface WorkerRunQueueSummary {
  queueName: string;
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  latestQueuedAt?: string;
}

export interface WorkerRunSummary {
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  byQueue?: WorkerRunQueueSummary[];
}

export interface WorkerRunSummaryItem {
  id: string;
  queueName: string;
  jobName?: string;
  bullJobId?: string;
  status: string;
  terminal?: boolean;
  failed?: boolean;
  retryable?: boolean;
  nextAttemptAt?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  idempotencyKeyPresent?: boolean;
  attemptsMade?: number;
  maxAttempts?: number;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  failedAt?: string;
  errorSummary?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface WorkerRunsResponse {
  status: string;
  queues: string[];
  workers: WorkerQueueStatus[];
  workerQueues: WorkerQueueStatus[];
  reservedQueues?: WorkerQueueStatus[];
  summary: WorkerRunSummary;
  jobs: WorkerRunSummaryItem[];
}

export interface WorkerRunsDashboardResponse {
  all: WorkerRunsResponse;
  email: WorkerRunsResponse;
  ocr: WorkerRunsResponse;
}

export type WorkerHealthState = "healthy" | "degraded" | "unknown";

export interface WorkerQueueHealthSummary {
  queueName: string;
  status: string;
  health: WorkerHealthState;
  total: number;
  queued: number;
  active: number;
  failed: number;
  terminal: number;
  stalled: number;
  lastObservedAt?: string;
  lastFailureAt?: string;
  degradedReasons: string[];
}

export interface WorkerHealthResponse {
  status: WorkerHealthState;
  generatedAt: string;
  configuredQueues: number;
  reservedQueues: number;
  notConfiguredQueues: number;
  totalRuns: number;
  activeOrQueued: number;
  failed: number;
  stalled: number;
  lastObservedAt?: string;
  queues: WorkerQueueHealthSummary[];
}

export interface ProviderStatusSetting {
  kind: string;
  status: string;
  reason?: string;
  providers: Array<{
    key: string;
    enabled: boolean;
    updatedAt?: string;
  }>;
}

export interface ProviderStatusService {
  status: string;
  reason?: string;
  provider?: string;
  model?: string;
  providers?: Array<{
    key: string;
    enabled: boolean;
    updatedAt?: string;
  }>;
  queue?: WorkerQueueStatus;
  workerQueue?: WorkerQueueStatus;
  addresses?: Array<{
    id: string;
    address: string;
    matterId?: string;
    enabled: boolean;
    createdAt: string;
  }>;
  supportedTasks?: string[];
  tokenSigning?: string;
  s3?: string;
}

export interface ProvidersStatusResponse {
  status: string;
  mode: string;
  liveHealth: {
    status: string;
    reason?: string;
  };
  providerSettings: ProviderStatusSetting[];
  objectStorage: {
    status: string;
    provider?: string;
    reason?: string;
  };
  bullmq: {
    producerQueues: WorkerQueueStatus[];
    workerQueues: WorkerQueueStatus[];
    reservedWorkerQueues?: WorkerQueueStatus[];
  };
  jobs: {
    summary: WorkerRunSummary;
    latestRuns: WorkerRunSummaryItem[];
  };
  documentProcessing: DocumentProcessingStatusResponse;
  email: ProviderStatusService;
  inboundEmail: ProviderStatusService;
  externalUploads: ProviderStatusService;
  draftAssist: DraftAssistStatusResponse;
  authExtensions: Record<string, unknown>;
}

export type TaskDeadlineWorkbenchResponse = TaskDeadlineWorkbench;

export type ShareLinkPermission = "view_documents";

export interface ShareLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  grantedByUserId: string;
  permissions: ShareLinkPermission[];
  expiresAt?: string;
  revokedAt?: string;
  createdAt?: string;
  tokenHash?: string;
  requireEmailVerification?: boolean;
  contactId?: string;
}

export interface ShareLinksResponse {
  shares: ShareLinkRecord[];
}

export interface ShareLinksStatusResponse {
  createStatus: "enabled" | "disabled";
  status?: string;
  provider?: string;
  reason?: string;
}

export type ClientPortalPermission = "view_documents" | "upload_documents" | "message" | "sign";

export type ClientPortalActionFamily =
  | "secure_share"
  | "external_upload"
  | "intake"
  | "guest_session"
  | "receipt"
  | "client_update"
  | "client_action";

export interface ClientPortalActionSummary {
  id: string;
  family: ClientPortalActionFamily;
  matterId: string;
  title: string;
  detail: string;
  status: string;
  tone: "neutral" | "ready" | "risk";
  updatedAt?: string;
}

export interface ClientPortalWorkspaceResponse {
  account: Pick<User, "id" | "displayName" | "email" | "role">;
  access: {
    posture: "active" | "no_active_grants";
    activeGrantCount: number;
    matterCount: number;
    permissions: ClientPortalPermission[];
  };
  matters: Array<{
    id: string;
    number: string;
    title: string;
    status: Matter["status"];
    permissions: ClientPortalPermission[];
    actionCount: number;
  }>;
  actions: ClientPortalActionSummary[];
}

export interface ClientPortalAccountSetupResponse {
  account: Pick<User, "id" | "displayName" | "email" | "role">;
  grant: {
    id: string;
    matterId: string;
    permissions: ClientPortalPermission[];
    expiresAt?: string;
    status: "active" | "inactive";
  };
  setup:
    | {
        status: "token_created";
        token: string;
        expiresAt: string;
        userId: string;
      }
    | {
        status: "token_unavailable";
        reason: "token_signing_not_configured";
        userId: string;
      };
}

export interface CreateShareLinkResponse {
  share: ShareLinkRecord | null;
  token?: string;
  queuedEmail?: {
    id: string;
    templateKey: string;
    status: string;
    queuedAt: string;
    jobId: string;
    idempotencyKeyPresent?: boolean;
  };
  status?: string;
  reason?: string;
}

export interface RevokeShareLinkResponse {
  share: ShareLinkRecord;
}

export interface SetupStatusResponse {
  required: boolean;
  blocked: boolean;
  reason?: string;
  setupKeyRequired: boolean;
}
