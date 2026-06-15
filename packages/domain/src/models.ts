import type { BillingRateSnapshot, BillingStatus } from "./billing.js";

export type Province = "BC" | "ON" | "CANADA" | "OTHER";

export type ProfessionalRole =
  | "owner_admin"
  | "licensee"
  | "firm_member"
  | "billing_bookkeeper"
  | "client_external"
  | "auditor";

export type MatterStatus = "intake" | "open" | "paused" | "closed" | "archived";

export type ContactKind = "person" | "organization";

export type ContactStatus =
  | "prospective"
  | "active"
  | "inactive"
  | "archived"
  | "former"
  | "restricted";

export type ContactRoleCategory =
  | "prospective_client"
  | "client"
  | "former_client"
  | "opposing_party"
  | "related_party"
  | "witness"
  | "lawyer"
  | "paralegal"
  | "authorized_non_lawyer_provider"
  | "legal_representative"
  | "court_tribunal"
  | "insurer"
  | "expert"
  | "vendor"
  | "referral_source"
  | "internal_team_member"
  | "organization"
  | "other";

export type ContactIdentifierType =
  | "email"
  | "phone"
  | "tax_id"
  | "registry_id"
  | "business_number"
  | "court_file"
  | "custom";

export type ContactMethodType = "email" | "phone" | "address" | "website";

export type ContactMethodLabel =
  | "work"
  | "home"
  | "mobile"
  | "billing"
  | "service"
  | "registered_office"
  | "other";

export type ContactMethodVerificationStatus = "unverified" | "verified" | "review_needed";

export type DocumentClassification =
  | "general"
  | "privileged"
  | "work_product"
  | "financial"
  | "identity";

export type DocumentUploadStatus = "intent_created" | "uploaded" | "verified" | "rejected";

export type DocumentChecksumStatus = "pending" | "verified" | "mismatch" | "duplicate";

export type DocumentScanStatus = "pending" | "queued" | "passed" | "failed" | "not_required";

export type DocumentUploadReviewStatus =
  | "not_required"
  | "pending_review"
  | "needs_metadata"
  | "accepted"
  | "retry_requested"
  | "discarded";

export type DocumentUploadReviewDecision =
  | "accept"
  | "request_metadata"
  | "request_retry"
  | "discard";

export type DocumentUploadReviewReason =
  | "duplicate"
  | "missing_metadata"
  | "checksum_mismatch"
  | "scan_failed"
  | "wrong_matter"
  | "unreadable"
  | "other";

export type PartyRole =
  | "client"
  | "prospective_client"
  | "former_client"
  | "opposing_party"
  | "opposing_counsel"
  | "related_party"
  | "witness"
  | "court"
  | "court_tribunal"
  | "lawyer"
  | "paralegal"
  | "authorized_non_lawyer_provider"
  | "legal_representative"
  | "insurer"
  | "expert"
  | "vendor"
  | "referral_source"
  | "internal_team_member"
  | "third_party"
  | "notary_client"
  | "paralegal_client"
  | "other";

export interface Firm {
  id: string;
  name: string;
  defaultProvince: Province;
}

export interface FirmBusinessAddress {
  line1: string;
  line2?: string;
  city: string;
  province: Province;
  postalCode: string;
  country: string;
}

export interface FirmSettings {
  firmId: string;
  businessAddress: FirmBusinessAddress;
  officeEmail: string;
  officePhone: string;
  practiceAreas: string[];
  invoicePrefix: string;
  defaultPaymentTermsDays: number;
  trustAccountLabel: string;
  trustFundsCaveatAcceptedAt: string;
  trustFundsCaveatAcceptedByUserId: string;
  website?: string;
  description?: string;
  businessNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PractitionerProfile {
  regulator: string;
  licenseStatus: string;
  jurisdictions: string[];
}

export interface User {
  id: string;
  firmId: string;
  displayName: string;
  email: string;
  role: ProfessionalRole;
  assignedMatterIds: string[];
  mfaEnabled: boolean;
  practitionerProfile?: PractitionerProfile;
}

export interface ContactIdentifier {
  type: ContactIdentifierType;
  value: string;
  label?: string;
  conflictCheckIncluded?: boolean;
  verified?: boolean;
}

export interface ContactMethodAddress {
  line1?: string;
  line2?: string;
  city?: string;
  province?: Province;
  postalCode?: string;
  country?: string;
}

export interface ContactMethod {
  id: string;
  type: ContactMethodType;
  label: ContactMethodLabel;
  value?: string;
  address?: ContactMethodAddress;
  preferred?: boolean;
  doNotContact?: boolean;
  verificationStatus?: ContactMethodVerificationStatus;
  conflictCheckIncluded?: boolean;
  notes?: string;
}

export interface Contact {
  id: string;
  firmId: string;
  kind: ContactKind;
  status?: ContactStatus;
  roleCategories?: ContactRoleCategory[];
  canonicalName?: string;
  displayName: string;
  givenName?: string;
  middleName?: string;
  familyName?: string;
  title?: string;
  pronouns?: string;
  organizationLegalName?: string;
  organizationOperatingName?: string;
  organizationRegisteredName?: string;
  organizationType?: string;
  website?: string;
  aliases: string[];
  formerNames?: string[];
  identifiers: ContactIdentifier[];
  contactMethods?: ContactMethod[];
  preferredContactMethodId?: string;
  preferredLanguage?: string;
  timezone?: string;
  communicationNotes?: string;
  accessibilityNotes?: string;
  privateNotes?: string;
  notes?: string;
  riskFlags?: string[];
  conflictSensitive?: boolean;
  adverse?: boolean;
  confidentialityMarker?: "standard" | "confidential" | "restricted";
  doNotContact?: boolean;
  createdByUserId?: string;
  updatedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Matter {
  id: string;
  firmId: string;
  number: string;
  title: string;
  practiceArea: string;
  status: MatterStatus;
  jurisdiction: Province;
  responsibleUserId: string;
  openedOn?: string;
  closedOn?: string;
}

export interface MatterParty {
  id: string;
  firmId: string;
  matterId: string;
  contactId: string;
  role: PartyRole;
  adverse: boolean;
  confidential: boolean;
  status?: "active" | "inactive";
  side?: "client" | "opposing" | "neutral" | "internal" | "court" | "other";
  startedOn?: string;
  endedOn?: string;
  notes?: string;
  privateNotes?: string;
  conflictCheckIncluded?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
}

export interface DocumentRecord {
  id: string;
  firmId: string;
  matterId: string;
  title: string;
  storageKey: string;
  checksumSha256: string;
  sizeBytes?: number;
  version: number;
  classification: DocumentClassification;
  legalHold: boolean;
  uploadStatus: DocumentUploadStatus;
  checksumStatus: DocumentChecksumStatus;
  scanStatus: DocumentScanStatus;
  reviewStatus: DocumentUploadReviewStatus;
  reviewDecision?: DocumentUploadReviewDecision;
  reviewReason?: DocumentUploadReviewReason;
  reviewMetadata: Record<string, unknown>;
  reviewedByUserId?: string;
  reviewedAt?: string;
  externalUploadLinkId?: string;
  duplicateOfDocumentId?: string;
  supersedesDocumentId?: string;
  supersededAt?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  createdAt?: string;
}

export interface PortalGrant {
  id: string;
  firmId: string;
  matterId: string;
  contactId: string;
  accountUserId?: string;
  grantedByUserId: string;
  status?: "not_invited" | "invited" | "active" | "suspended" | "revoked" | "expired";
  expiresAt?: string;
  revokedAt?: string;
  suspendedAt?: string;
  invitedAt?: string;
  activatedAt?: string;
  revokedByUserId?: string;
  updatedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  permissions: Array<
    | "view_matter_summary"
    | "view_documents"
    | "upload_documents"
    | "message"
    | "view_messages"
    | "send_messages"
    | "view_invoices"
    | "view_appointments_tasks"
    | "view_signature_requests"
    | "complete_intake"
    | "manage_organization_users"
    | "sign"
  >;
}

export interface PortalDocumentAccess {
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

export interface TimeEntry {
  id: string;
  firmId: string;
  matterId: string;
  userId: string;
  performedAt: string;
  minutes: number;
  rateCents: number;
  rateRuleId?: string;
  rateSnapshot?: BillingRateSnapshot;
  narrative: string;
  billable: boolean;
  billingStatus: BillingStatus;
}

export interface ExpenseEntry {
  id: string;
  firmId: string;
  matterId: string;
  incurredAt: string;
  amountCents: number;
  category: string;
  description: string;
  reimbursable: boolean;
  billingStatus: BillingStatus;
}

export type TaskDeadlineCompletionStatus = "open" | "completed";
export type TaskDeadlineAssignmentStatus = "assigned" | "unassigned";
export type TaskDeadlineBucket = "overdue" | "today" | "upcoming" | "unscheduled" | "completed";
export type TaskStatus = "open" | "completed" | "archived";
export type TaskPriority = "high" | "medium" | "low";
export type TaskSourceType =
  | "manual"
  | "intake_review"
  | "inbound_email_follow_up"
  | "signature_follow_up"
  | "calendar_scheduling"
  | "operational_view"
  | "system_import";

export interface TaskRecord {
  id: string;
  firmId: string;
  matterId: string;
  assignedToUserId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  sourceType?: TaskSourceType;
  sourceId?: string;
  dueAt?: string;
  completedAt?: string;
  completedByUserId?: string;
  archivedAt?: string;
  archivedByUserId?: string;
  createdAt: string;
  createdByUserId?: string;
  updatedAt: string;
  updatedByUserId?: string;
  version: number;
}

export type TaskDeadlineRecord = TaskRecord;

export interface TaskDeadlineProjection extends TaskDeadlineRecord {
  assignmentStatus: TaskDeadlineAssignmentStatus;
  completionStatus: TaskDeadlineCompletionStatus;
  bucket: TaskDeadlineBucket;
}

export type ConversationThreadStatus = "open" | "closed" | "revoked";
export type ConversationThreadExportState = "not_requested" | "requested" | "exported";
export type ConversationThreadNotificationBoundary = "disabled" | "internal_only";

export interface ConversationThreadRecord {
  id: string;
  firmId: string;
  matterId: string;
  topic: string;
  status: ConversationThreadStatus;
  retentionUntil?: string;
  exportState: ConversationThreadExportState;
  accessRevokedAt?: string;
  notificationBoundary: ConversationThreadNotificationBoundary;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
  metadata: Record<string, unknown>;
}

export type ConversationMessageRecordKind = "internal_note" | "client_message" | "imported_email";

export interface ConversationMessageRecord {
  id: string;
  firmId: string;
  matterId: string;
  threadId: string;
  kind: ConversationMessageRecordKind;
  bodyText: string;
  authoredAt: string;
  authoredByUserId?: string;
  createdAt: string;
  createdByUserId: string;
  metadata: Record<string, unknown>;
}

export type ConversationMessageNotificationPosture = "unread" | "read" | "muted";

export interface ConversationMessageNotificationRecord {
  id: string;
  firmId: string;
  matterId: string;
  threadId: string;
  messageId: string;
  recipientUserId: string;
  readAt?: string;
  mutedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
  metadata: Record<string, unknown>;
}

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type CalendarAttendeeRole = "required" | "optional";
export type CalendarAttendeeResponseStatus = "needs_action" | "accepted" | "tentative" | "declined";
export type CalendarInvitationStatus = "not_sent" | "queued" | "skipped";
export type CalendarMeetingLinkMode = "blank" | "external_url" | "hosted_webrtc";
export type CalendarMeetingSessionStatus = "lobby_closed" | "lobby_open" | "locked" | "ended";
export type CalendarGuestLinkStatus = "issued" | "waiting" | "admitted" | "denied" | "revoked";
export type CalendarEventReminderChannel = "dashboard";
export type CalendarEventReminderStatus = "pending" | "acknowledged" | "dismissed" | "cancelled";
export type CalendarSchedulingRequestKind =
  | "deadline_review"
  | "event_scheduling"
  | "reminder_review";
export type CalendarSchedulingRequestStatus =
  | "needs_review"
  | "reviewed"
  | "scheduled"
  | "dismissed";
export type CalendarSchedulingRequestSourceType =
  | "task_deadline"
  | "calendar_event"
  | "calendar_reminder"
  | "manual";
export type CalendarSchedulingRequestReminderPosture =
  | "none"
  | "dashboard_pending"
  | "delivery_opt_in_available";
export type CalendarSchedulingRequestPrivacy = "staff_only" | "matter_team";
export type CalendarSchedulingRequestTimeCapturePosture = "none" | "draft_available" | "captured";
export type CalendarMeetingBoundaryStatus = "disabled" | "configured";
export type CalendarMeetingBoundaryReason =
  | "not_configured"
  | "smtp_not_configured"
  | "email_queue_not_configured"
  | "token_signing_not_configured";

export interface CalendarMeetingBoundaryCapability {
  status: CalendarMeetingBoundaryStatus;
  reason?: CalendarMeetingBoundaryReason;
  provider?: string;
}

export interface CalendarMeetingInvitationBoundary {
  meetingLinks: CalendarMeetingBoundaryCapability;
  guestAccess: CalendarMeetingBoundaryCapability;
  invitationEmail: CalendarMeetingBoundaryCapability;
}

export type CalendarEventScope = "matter" | "firm" | "client";

export interface CalendarEventAttendeeRecord {
  id: string;
  firmId: string;
  matterId: string;
  eventId: string;
  name: string;
  email: string;
  role: CalendarAttendeeRole;
  responseStatus: CalendarAttendeeResponseStatus;
  invitationStatus: CalendarInvitationStatus;
  invitedAt?: string;
  invitationEmailId?: string;
  invitationJobId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface CalendarEventReminderRecord {
  id: string;
  firmId: string;
  scope?: CalendarEventScope;
  matterId?: string;
  clientContactId?: string;
  eventId: string;
  remindAt: string;
  channel: CalendarEventReminderChannel;
  status: CalendarEventReminderStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface CalendarEventRecord {
  id: string;
  firmId: string;
  scope?: CalendarEventScope;
  matterId?: string;
  clientContactId?: string;
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  location?: string;
  status: CalendarEventStatus;
  sequence: number;
  meetingLinkMode?: CalendarMeetingLinkMode;
  meetingLinkUrl?: string;
  meetingRoomId?: string;
  meetingProviderKey?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdByUserId: string;
  updatedByUserId: string;
  attendees?: CalendarEventAttendeeRecord[];
  reminders?: CalendarEventReminderRecord[];
  meetingInvitationBoundary?: CalendarMeetingInvitationBoundary;
}

export interface CalendarSchedulingRequestTimeCaptureCue {
  posture: CalendarSchedulingRequestTimeCapturePosture;
  suggestedMinutes?: number;
  existingTimeEntryCount: number;
  billable: boolean;
}

export interface CalendarSchedulingRequestRecord {
  id: string;
  firmId: string;
  matterId: string;
  kind: CalendarSchedulingRequestKind;
  status: CalendarSchedulingRequestStatus;
  title: string;
  taskId?: string;
  calendarEventId?: string;
  calendarReminderId?: string;
  ownerUserId?: string;
  sourceType: CalendarSchedulingRequestSourceType;
  sourceId?: string;
  sourceLabel: string;
  requestedDueAt?: string;
  requestedStartsAt?: string;
  requestedEndsAt?: string;
  reminderPosture: CalendarSchedulingRequestReminderPosture;
  privacy: CalendarSchedulingRequestPrivacy;
  timeCaptureCue: CalendarSchedulingRequestTimeCaptureCue;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
}

export interface CalendarSchedulingRequestSummary {
  id: string;
  matterId: string;
  kind: CalendarSchedulingRequestKind;
  status: CalendarSchedulingRequestStatus;
  title: string;
  ownerUserId?: string;
  source: {
    type: CalendarSchedulingRequestSourceType;
    label: string;
  };
  linkedTaskId?: string;
  linkedEvent?: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: CalendarEventStatus;
  };
  linkedReminderId?: string;
  requestedDueAt?: string;
  requestedStartsAt?: string;
  requestedEndsAt?: string;
  reminderSummary: {
    posture: CalendarSchedulingRequestReminderPosture;
    pendingCount: number;
    acknowledgedCount: number;
    nextRemindAt?: string;
  };
  privacy: {
    visibility: CalendarSchedulingRequestPrivacy;
    clientVisible: false;
  };
  timeCaptureCue: CalendarSchedulingRequestTimeCaptureCue & {
    redacted?: boolean;
  };
  reviewBoundary: {
    approvalCreatesTask: false;
    approvalReschedulesEvent: false;
    approvalCancelsReminder: false;
    approvalCreatesTimeEntry: false;
  };
  reviewedAt?: string;
  reviewedByUserId?: string;
}

export interface CalendarMeetingSessionRecord {
  id: string;
  firmId: string;
  matterId: string;
  eventId: string;
  status: CalendarMeetingSessionStatus;
  retentionUntil?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  createdByUserId: string;
  updatedByUserId: string;
  metadata: Record<string, unknown>;
}

export interface CalendarGuestLinkRecord {
  id: string;
  firmId: string;
  matterId: string;
  eventId: string;
  sessionId: string;
  tokenHash: string;
  status: CalendarGuestLinkStatus;
  expiresAt: string;
  retentionUntil?: string;
  checkedInAt?: string;
  revokedAt?: string;
  admittedAt?: string;
  deniedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId?: string;
  metadata: Record<string, unknown>;
}

export interface CalendarCredentialRecord {
  id: string;
  firmId: string;
  userId: string;
  username: string;
  label: string;
  passwordHash: string;
  createdAt: string;
  createdByUserId: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ActivityTimelineEntry {
  id: string;
  firmId: string;
  matterId?: string;
  occurredAt: string;
  title: string;
  kind:
    | "audit"
    | "billing"
    | "calendar"
    | "conflict"
    | "contact"
    | "document"
    | "email"
    | "intake"
    | "ledger"
    | "portal"
    | "share"
    | "signature"
    | "task"
    | "upload";
  actorId?: string;
  metadata: Record<string, unknown>;
}
