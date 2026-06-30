import type {
  AuditEventTaxonomySummary,
  AiOperationalProposalRecord,
  AiOperationalProposalSummary,
  BillDeliveryState,
  BillingExpenseCategoryRecord,
  BillingPeriodLockRecord,
  BillingRateRuleRecord,
  BillingRateSnapshot,
  BillingTimerDraftPolicy,
  BillReminderState,
  Contact,
  CreditWriteOffPosture,
  ConflictCandidate,
  DocumentRecord,
  FinancialCommandJournal,
  FinancialCommandJournalEntry,
  FinancialCommandJournalFamily,
  GeneratedDocumentRecord,
  DraftRecord,
  DraftAssistRecord,
  DraftTemplateRecord,
  ExpenseEntry,
  Firm,
  ActivityTimelineEntry,
  DashboardSectionCapability,
  EmbeddedIntakeTemplateDefinition,
  ExpenseCategoryProfileCue,
  IntakeFormItemActionRecord,
  IntakeFormReviewRecord,
  IntakeSessionRecord,
  IntakePipelineLeadRecord,
  IntakePipelineSubmissionsOperations,
  IntakePipelineSummary,
  IntakeTemplateRecord,
  IntakeVariableProposal,
  IntakeFormLinkRecord,
  IntakeTemplatePreviewResult,
  HostedPaymentProcessorState,
  JurisdictionalTrustReport,
  LegalResearchWorkspace,
  LedgerAccount,
  LedgerAccountingReviewProfileRecord,
  LedgerAccountingReviewSummary,
  LedgerBalanceSnapshotComparison,
  LedgerBankFeedReconciliationReviewSummary,
  LedgerEntry,
  LedgerMakerCheckerReadiness,
  LedgerPostingRequestRecord,
  LedgerPostingRequestReviewSummary,
  LedgerReconciliationFreshnessReview,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
  Matter,
  MatterLifecycleTransitionRecord,
  MatterParty,
  PaymentImportRefundChargebackResolutionPacketPreview,
  PaymentImportReviewBoundary,
  MatterSetupProfile,
  PaymentPlanPlaceholder,
  PublicConsultationIntakeNotificationSettings,
  PublicConsultationIntakeRecord,
  RedactedImapProviderSettings,
  RedactedSmtpProviderSettings,
  StaffReportExportProfile,
  StaffReportHistoryItem,
  StaffReportProjection,
  StaffReportingWorkspace,
  SignatureRequestRecord,
  TaskDeadlineWorkbench,
  TaskStructuredDetail,
  TaskTemplateItemRecord,
  TaskTemplateRecord,
  TimeEntry,
  User,
} from "@open-practice/domain";
import type {
  DocumentProcessingEvidencePacket,
  DocumentProcessingProviderReadiness,
  DocumentProcessingProviderStatus,
  DocumentProcessingReservedTask,
} from "./_features/document-processing/models";
import type {
  CalendarGuestAccessStatus as CalendarGuestAccessStatusModel,
  CalendarGuestSessionStatus as CalendarGuestSessionStatusModel,
} from "./_features/calendar/models";

export type {
  BillDeliveryState,
  BillingExpenseCategoryRecord,
  BillingPeriodLockRecord,
  BillingRateRuleRecord,
  BillingRateSnapshot,
  BillingTimerDraftPolicy,
  BillReminderState,
  CreditWriteOffPosture,
  ExpenseCategoryProfileCue,
  FinancialCommandJournal,
  FinancialCommandJournalEntry,
  FinancialCommandJournalFamily,
  HostedPaymentProcessorState,
  JurisdictionalTrustReport,
  LedgerAccount,
  LedgerAccountingReviewProfileRecord,
  LedgerAccountingReviewSummary,
  LedgerBalanceSnapshotComparison,
  LedgerBankFeedReconciliationReviewSummary,
  LedgerEntry,
  LedgerMakerCheckerReadiness,
  LedgerPostingRequestRecord,
  LedgerPostingRequestReviewSummary,
  LedgerReconciliationFreshnessReview,
  LedgerReconciliationRecord,
  LedgerStatementImportBatchRecord,
  LedgerStatementMatchRuleProfileRecord,
  LedgerTransactionApprovalRecord,
  PaymentImportRefundChargebackResolutionPacketPreview,
  PaymentImportReviewBoundary,
  PaymentPlanPlaceholder,
  StaffReportProjection,
};

export type EmailSettings = RedactedSmtpProviderSettings;
export type ImapSettings = RedactedImapProviderSettings;

export type {
  BillingDashboardResponse,
  BillingEntryStatus,
  BillingExpenseItem,
  BillingInvoiceSummary,
  BillingPaymentRequestSummary,
  BillingPaymentSummary,
  BillingTimeItem,
  JurisdictionalTrustReportResponse,
  MatterBillingSummary,
  TrustControlsDashboardResponse,
} from "./_features/billing/models";

export type {
  DocumentAssemblyDashboardResponse,
  DocumentAssemblyWorkbenchResponse,
  DocumentAssemblyWorkbenchStatus,
} from "./_features/document-assembly/models";

export type {
  DocumentConversionReviewDecisionCue,
  DocumentConversionReviewSemanticReviewCheckpointCue,
  DocumentConversionReviewCounts,
  DocumentConversionReviewPolicy,
  DocumentConversionReviewSummary,
  DocumentMetadataOcrStatus,
  DocumentMetadataSearchFilters,
  DocumentMetadataSearchPosture,
  DocumentMetadataSearchResultSummary,
  DocumentMetadataTag,
  DocumentMetadataTagGroup,
  DocumentProcessingDashboardResponse,
  DocumentProcessingDocumentSummary,
  DocumentProcessingEvidencePacket,
  DocumentProcessingGroup,
  DocumentProcessingLatestExtraction,
  DocumentProcessingLatestJob,
  DocumentProcessingProviderEvidencePacket,
  DocumentProcessingProviderReadiness,
  DocumentProcessingProviderStatus,
  DocumentProcessingQueueSummary,
  DocumentProcessingReservedTask,
  DocumentProcessingSummary,
  DocumentProcessingWorkbenchItem,
  DocumentProcessingWorkbenchResponse,
  DocumentProcessingWorkerQueueStatus,
  DocumentReviewSuggestionCue,
  DocumentReviewSuggestionGroup,
  DocumentReviewSuggestions,
} from "./_features/document-processing/models";

export type {
  ContactDossier,
  ContactDataQualityResolutionRecord,
  ContactDataQualityResolutionsResponse,
  ContactDossiersResponse,
  ContactReviewQueueItem,
  ContactReviewQueueResponse,
  ContactReviewQueueSignal,
} from "./_features/contacts/models";

export { canRecordContactDataQualityResolutions } from "./_features/contacts/models";

export type {
  IntakePipelineLeadRecord,
  IntakePipelineSubmissionsOperations,
  IntakePipelineSummary,
};

export interface MatterSummary extends Matter {
  parties: Array<MatterParty & { contact: Contact }>;
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  activity: ActivityTimelineEntry[];
  lifecycleTransitions: MatterLifecycleTransitionRecord[];
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

export type LegalResearchWorkspaceStatus = "available" | "access_denied" | "unavailable";

export type LegalResearchWorkspaceResponse = LegalResearchWorkspace & {
  status: LegalResearchWorkspaceStatus;
};

export interface LegalResearchDashboardResponse {
  workbenchesByMatterId: Record<string, LegalResearchWorkspaceResponse>;
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
  queuedEmail?: {
    id: string;
    templateKey: string;
    status: string;
    queuedAt: string;
    jobId: string;
    idempotencyKeyPresent: boolean;
  };
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

export interface IntakeEngagementLetterResponse {
  engagementLetter: {
    formLinkId: string;
    intakeSessionId: string;
    answerSnapshotId: string;
    packageId: string;
    packageDocumentId: string;
    documentId: string;
    generatedDocumentId: string;
    portalDocumentAccessId: string;
    signatureRequestId?: string;
    status: "sent";
    documentStatus: string;
    scanStatus: string;
    signatureStatus?: string;
    emailQueued: boolean;
    queuedEmail?: {
      id: string;
      templateKey: string;
      status: string;
      queuedAt: string;
      jobId: string;
      idempotencyKeyPresent: boolean;
    };
  };
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
  submissionsOperations: IntakePipelineSubmissionsOperations;
}

export interface IntakePipelineDashboardResponse extends IntakePipelineResponse {
  status: "available" | "access_denied" | "unavailable";
}

export type PublicConsultationIntake = PublicConsultationIntakeRecord;
export type PublicConsultationIntakeSettings = Omit<
  PublicConsultationIntakeNotificationSettings,
  "submissionTokenHash"
> & {
  submissionTokenConfigured: boolean;
  submissionToken?: string;
};

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

export type EmailSettingsResponse = { settings: RedactedSmtpProviderSettings };
export type ImapSettingsResponse = { settings: RedactedImapProviderSettings };

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

export type {
  ExternalUploadCreateResponse,
  ExternalUploadLinkRecord,
  ExternalUploadReviewItem,
  ExternalUploadRevokeResponse,
  ExternalUploadsDashboardResponse,
  ExternalUploadsListResponse,
  ExternalUploadsStatusResponse,
} from "./_features/external-uploads/models";

export type {
  CalendarAttendeeMutationResponse,
  CalendarCredentialCreateResponse,
  CalendarCredentialRevokeResponse,
  CalendarCredentialSummary,
  CalendarCredentialsResponse,
  CalendarDashboardResponse,
  CalendarEventMutationResponse,
  CalendarEventsResponse,
  CalendarGuestAccessStatus,
  CalendarGuestSessionGuestMutationResponse,
  CalendarGuestSessionGuestSummary,
  CalendarGuestSessionIssueResponse,
  CalendarGuestSessionMutationResponse,
  CalendarGuestSessionStatus,
  CalendarGuestSessionSummary,
  CalendarInvitationResponse,
  CalendarInvitationResult,
  CalendarMatterLinks,
  CalendarMeetingLinkMutationResponse,
  CalendarReminderMutationResponse,
} from "./_features/calendar/models";

export interface PublicGuestSessionResponse {
  session: {
    status: CalendarGuestSessionStatusModel;
    lobbyStatus?: CalendarGuestSessionStatusModel;
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
    status: CalendarGuestAccessStatusModel;
    checkedInAt?: string;
    admittedAt?: string;
    deniedAt?: string;
    revokedAt?: string;
  };
  lobby?: {
    status?: CalendarGuestSessionStatusModel;
    waitingCount?: number;
    admittedCount?: number;
    deniedCount?: number;
    revokedCount?: number;
  };
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

export type {
  ClientUpdateDraftRequestSummary,
  CommunicationsChannelHistoryItem,
  CommunicationsChannelHistoryKind,
  CommunicationsInboxContactCue,
  CommunicationsInboxConversation,
  CommunicationsInboxDashboardResponse,
  CommunicationsInboxInboundEmail,
  CommunicationsInboxMatterResponse,
  CommunicationsInboxOutboundDelivery,
  InboundEmailMatterDraft,
  UnscopedInboundEmailReviewMessage,
  UnscopedInboundEmailReviewResponse,
} from "./_features/communications/models";

export type {
  EmailDeliveryDashboardResponse,
  EmailDeliveryEventSummary,
  EmailDeliveryHistoryItem,
  EmailDeliveryHistoryResponse,
} from "./_features/email-delivery/models";

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
  providerReadiness?: DocumentProcessingProviderReadiness[];
  evidencePacket?: DocumentProcessingEvidencePacket;
  summary: WorkerRunSummary;
  jobs: WorkerRunSummaryItem[];
}

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

export interface AiOperationalProposalsResponse {
  proposals: AiOperationalProposalRecord[];
  summary: AiOperationalProposalSummary;
  generation: {
    status: "configured" | "disabled";
    reason?: string;
    provider?: string;
    queue: WorkerQueueStatus;
    jobName: "operational_action_proposals";
  };
}

export type {
  ConnectorOperationsResponse,
  ConnectorOutboxItem,
  ConnectorOutboxRecoveryResponse,
  ConnectorOutboxResponse,
  ConnectorSummary,
  ConnectorsResponse,
} from "./_features/connectors/models";

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

export interface StaffReportExportDownloadResponse {
  exportRequest: StaffReportHistoryItem;
  export: {
    reportType: "staff_reporting";
    exportProfile?: StaffReportExportProfile;
    report: StaffReportProjection;
  };
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

export type WorkflowHistoryStatus = "queued" | "active" | "succeeded" | "failed" | "skipped";

export interface WorkflowReviewPacketCue {
  kind: "matter" | "task" | "template" | "document" | "resource";
  label: string;
  value: string;
}

export interface WorkflowReviewPacket {
  reviewOnly: boolean;
  automationDisabled: boolean;
  externalConnectorDisabled: boolean;
  backgroundMutationDisabled: boolean;
  cues: WorkflowReviewPacketCue[];
}

export interface WorkflowHistoryStep {
  id: string;
  source: "audit" | "job";
  label: string;
  status: WorkflowHistoryStatus;
  occurredAt: string;
  matterIds: string[];
  resourceType?: string;
  resourceId?: string;
  action?: string;
  queueName?: string;
  jobName?: string;
  jobId?: string;
  retryOfJobId?: string;
  idempotencyKeyPresent?: boolean;
  attemptsMade?: number;
  maxAttempts?: number;
  metadata: Record<string, string | number | boolean | undefined>;
}

export interface WorkflowHistoryItem {
  id: string;
  groupKey: string;
  title: string;
  status: WorkflowHistoryStatus;
  startedAt: string;
  lastObservedAt: string;
  finishedAt?: string;
  matterIds: string[];
  resourceType?: string;
  resourceId?: string;
  queueNames: string[];
  jobIds: string[];
  stepCount: number;
  reviewPacket?: WorkflowReviewPacket;
  steps: WorkflowHistoryStep[];
}

export interface WorkflowHistoryResponse {
  status: string;
  generatedAt: string;
  summary: {
    total: number;
    active: number;
    failed: number;
    terminal: number;
  };
  workflows: WorkflowHistoryItem[];
}

export interface ProviderStatusSetting {
  kind: string;
  status: string;
  reason?: string;
  providers: Array<{
    key: string;
    enabled: boolean;
    disabledReason?: string;
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
    disabledReason?: string;
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
export type TaskStructuredDetailResponse = TaskStructuredDetail;
export type TaskTemplatesResponse = {
  templates: TaskTemplateRecord[];
  templateItems: TaskTemplateItemRecord[];
};

export type {
  CreateShareLinkResponse,
  RevokeShareLinkResponse,
  ShareLinkPermission,
  ShareLinkRecord,
  ShareLinksResponse,
  ShareLinksStatusResponse,
} from "./_features/share-links/models";

export type ClientPortalPermission = "view_documents" | "upload_documents" | "message" | "sign";
export type ClientPortalReadState = "current" | "unread" | "attention_required";
export type ClientPortalNotificationPosture = "none" | "unread" | "attention_required";

export type ClientPortalActionFamily =
  | "secure_share"
  | "external_upload"
  | "intake"
  | "guest_session"
  | "receipt"
  | "client_update"
  | "client_action"
  | "payment_request"
  | "signature";

export interface ClientPortalActionDetail {
  label: string;
  value: string;
  tone?: "neutral" | "ready" | "risk";
}

export interface ClientPortalActionSummary {
  id: string;
  family: ClientPortalActionFamily;
  matterId: string;
  title: string;
  detail: string;
  status: string;
  tone: "neutral" | "ready" | "risk";
  updatedAt?: string;
  details?: ClientPortalActionDetail[];
}

export interface ClientPortalMatterActionGroup {
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  actionCount: number;
  attentionCount: number;
  actions: ClientPortalActionSummary[];
}

export interface ClientPortalMatterActivitySummary {
  matterId: string;
  latestActivityAt?: string;
  readState: ClientPortalReadState;
  notificationPosture: ClientPortalNotificationPosture;
  actionCount: number;
  attentionCount: number;
  unreadNotificationCount: number;
  mutedNotificationCount: number;
  messageThreadCount: number;
  documentCount: number;
  signatureCount: number;
}

export interface ClientPortalWorkspaceActivity {
  latestActivityAt?: string;
  readState: ClientPortalReadState;
  notificationPosture: ClientPortalNotificationPosture;
  actionCount: number;
  attentionCount: number;
  unreadNotificationCount: number;
  mutedNotificationCount: number;
  matters: ClientPortalMatterActivitySummary[];
}

export interface ClientPortalPaymentRequestSummary {
  id: string;
  status: string;
  amountCents: number;
  currency: "CAD";
  deliveryStatus: string;
  reminderStatus: string;
  paymentPlanStatus: string;
  expiresAt?: string;
  updatedAt: string;
}

export interface ClientPortalBillSummary {
  id: string;
  matterId: string;
  invoiceNumber: string;
  status: string;
  issuedAt?: string;
  dueAt?: string;
  totalCents: number;
  paidCents: number;
  balanceDueCents: number;
  currency: "CAD";
  tone: "neutral" | "ready" | "risk";
  paymentRequestCount: number;
  paymentRequests: ClientPortalPaymentRequestSummary[];
}

export interface ClientPortalMatterBillingGroup {
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  billCount: number;
  balanceDueCents: number;
  attentionCount: number;
  bills: ClientPortalBillSummary[];
}

export interface ClientPortalBillingWorkspace {
  currency: "CAD";
  billCount: number;
  totalBalanceDueCents: number;
  openPaymentRequestCount: number;
  attentionBillCount: number;
  matterBills: ClientPortalMatterBillingGroup[];
}

export interface ClientPortalMatterDetail {
  id: string;
  number: string;
  title: string;
  status: Matter["status"];
  practiceArea: string;
  jurisdiction: Matter["jurisdiction"];
  openedOn?: string;
  closedOn?: string;
  permissions: ClientPortalPermission[];
  documentCount: number;
  signatureCount: number;
  actionCount: number;
  attentionCount?: number;
  latestActivityAt?: string;
  readState?: ClientPortalReadState;
  notificationPosture?: ClientPortalNotificationPosture;
  unreadNotificationCount?: number;
}

export interface ClientPortalDocumentSummary {
  id: string;
  matterId: string;
  title: string;
  classification: DocumentRecord["classification"];
  version: number;
  uploadedAt?: string;
  verifiedAt?: string;
  accessId: string;
  accessStatus: "active";
  expiresAt?: string;
  downloadUrl?: string;
}

export type ClientPortalSignatureActionState =
  | "ready_to_sign"
  | "viewed"
  | "completed"
  | "declined";

export interface ClientPortalSignatureSummary {
  id: string;
  matterId: string;
  documentId: string;
  documentTitle?: string;
  title: string;
  status: string;
  signerStatus: string;
  createdAt: string;
  completedAt?: string;
  declinedAt?: string;
  actionState: ClientPortalSignatureActionState;
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
    latestActivityAt?: string;
    readState?: ClientPortalReadState;
    notificationPosture?: ClientPortalNotificationPosture;
    unreadNotificationCount?: number;
  }>;
  portalActivity?: ClientPortalWorkspaceActivity;
  billing?: ClientPortalBillingWorkspace;
  matterDetails?: ClientPortalMatterDetail[];
  documents?: ClientPortalDocumentSummary[];
  signatures?: ClientPortalSignatureSummary[];
  matterActions?: ClientPortalMatterActionGroup[];
  actions: ClientPortalActionSummary[];
}

export interface PortalDocumentAccessSummary {
  id: string;
  firmId: string;
  matterId: string;
  documentId: string;
  portalGrantId: string;
  permission: "view_document";
  grantedByUserId: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface PortalDocumentAccessListResponse {
  access: PortalDocumentAccessSummary[];
}

export interface PortalDocumentAccessMutationResponse {
  access?: PortalDocumentAccessSummary;
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

export interface SetupStatusResponse {
  required: boolean;
  blocked: boolean;
  reason?: string;
}
