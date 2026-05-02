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
  ContactDossier,
  DashboardSectionCapability,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  IntakeVariableProposal,
  EmbeddedIntakeTemplateDefinition,
  IntakeFormLinkRecord,
  IntakeFormItemActionRecord,
  Matter,
  MatterParty,
  SignatureRequestRecord,
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

export interface ExternalUploadsStatusResponse {
  status: string;
  provider?: string;
  reason?: string;
}

export interface ExternalUploadsListResponse {
  uploads: ExternalUploadLinkRecord[];
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
