import type {
  Contact,
  ConflictCandidate,
  DocumentRecord,
  DraftRecord,
  DraftAssistRecord,
  DraftTemplateRecord,
  ExpenseEntry,
  Firm,
  ActivityTimelineEntry,
  CalendarEventRecord,
  CalendarEventAttendeeRecord,
  CalendarMeetingInvitationBoundary,
  ContactDossier,
  DashboardSectionCapability,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  IntakeVariableProposal,
  LedgerAccount,
  LedgerEntry,
  LedgerReconciliationRecord,
  LedgerTransactionApprovalRecord,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormLinkRecord,
  IntakeFormItemActionRecord,
  Matter,
  MatterParty,
  SignatureRequestRecord,
  TaskDeadlineWorkbench,
  TimeEntry,
  User,
} from "@open-practice/domain";

export type { ContactDossier };

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

export interface ConflictResponse {
  results: ConflictCandidate[];
  auditChainValid: boolean;
}

export interface SessionResponse {
  user: User;
}

export interface CapabilitiesResponse {
  sections: DashboardSectionCapability[];
}

export type ContactDossiersResponse = ContactDossier[];

export interface IntakeSessionsResponse {
  templates: IntakeTemplateRecord[];
  sessions: IntakeSessionRecord[];
}

export type IntakeSessionCreateResponse = IntakeSessionRecord & {
  queuedEmail?: unknown;
};

export function buildIntakeSessionCreatePayload(input: {
  matter: Pick<MatterSummary, "id">;
  template: Pick<IntakeTemplateRecord, "id">;
}): {
  matterId: string;
  templateId: string;
  evidence: { source: "dashboard" };
} {
  return {
    matterId: input.matter.id,
    templateId: input.template.id,
    evidence: { source: "dashboard" },
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

export interface IntakeTemplateSavePayload {
  id?: string;
  name: string;
  active: boolean;
  definitionVersion: number;
  definition: EmbeddedIntakeTemplateDefinition;
}

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

export interface CalendarMatterLinks {
  caldavUrl: string;
  subscriptionUrl: string;
}

export interface CalendarDashboardResponse {
  eventsByMatterId: Record<string, CalendarEventRecord[]>;
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
  status: "configured" | "not_configured" | string;
  reason?: string;
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

export interface DocumentProcessingWorkbenchItem {
  document: DocumentProcessingDocumentSummary;
  group: DocumentProcessingGroup;
  queueEligibility: {
    eligible: boolean;
    reason?: string;
  };
  latestJob?: DocumentProcessingLatestJob;
  latestExtraction?: DocumentProcessingLatestExtraction;
}

export interface DocumentProcessingWorkbenchResponse {
  matterId: string;
  status: "configured" | "disabled" | "available" | "unavailable" | string;
  reason?: string;
  providerStatus: DocumentProcessingProviderStatus[];
  workerQueues: DocumentProcessingWorkerQueueStatus[];
  summary: DocumentProcessingSummary;
  documents: DocumentProcessingWorkbenchItem[];
}

export interface DocumentProcessingDashboardResponse {
  workbenchesByMatterId: Record<string, DocumentProcessingWorkbenchResponse>;
}

export type BillingEntryStatus = "draft" | "submitted" | "approved" | "billed" | "written_off";

export interface BillingTimeItem {
  id: string;
  matterId: string;
  userId?: string;
  minutes: number;
  rateCents: number;
  amountCents: number;
  narrative: string;
  status: BillingEntryStatus;
}

export interface BillingExpenseItem {
  id: string;
  matterId: string;
  amountCents: number;
  category: string;
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
}

export interface MatterBillingSummary {
  matterId: string;
  unbilledTime: BillingTimeItem[];
  unbilledExpenses: BillingExpenseItem[];
  invoices: BillingInvoiceSummary[];
  payments: BillingPaymentSummary[];
}

export interface BillingDashboardResponse {
  canView: boolean;
  summary: {
    unbilledTimeCents: number;
    unbilledExpenseCents: number;
    draftInvoiceCents: number;
    issuedBalanceDueCents: number;
  };
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
  diagnostics: {
    pendingApprovalTransactionIds: string[];
    rejectedApprovalTransactionIds: string[];
    unreconciledAccountIds: string[];
    exceptionReconciliationIds: string[];
    overdrawnBalanceKeys: string[];
  };
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

export type WorkerRunQueueFilter = "all" | "email" | "ocr";

export interface WorkerQueueStatus {
  queueName: string;
  status: "configured" | "not_configured" | string;
  reason?: string;
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
  summary: WorkerRunSummary;
  jobs: WorkerRunSummaryItem[];
}

export interface WorkerRunsDashboardResponse {
  all: WorkerRunsResponse;
  email: WorkerRunsResponse;
  ocr: WorkerRunsResponse;
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
