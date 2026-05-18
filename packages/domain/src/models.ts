import type { BillingStatus } from "./billing.js";

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
  | "opposing_party"
  | "opposing_counsel"
  | "witness"
  | "court"
  | "third_party"
  | "notary_client"
  | "paralegal_client";

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
  type: "email" | "phone" | "tax_id" | "registry_id";
  value: string;
}

export interface Contact {
  id: string;
  firmId: string;
  kind: ContactKind;
  displayName: string;
  aliases: string[];
  identifiers: ContactIdentifier[];
  notes?: string;
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
}

export interface DocumentRecord {
  id: string;
  firmId: string;
  matterId: string;
  title: string;
  storageKey: string;
  checksumSha256: string;
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
}

export interface PortalGrant {
  id: string;
  firmId: string;
  matterId: string;
  contactId: string;
  grantedByUserId: string;
  expiresAt?: string;
  revokedAt?: string;
  permissions: Array<"view_documents" | "upload_documents" | "message" | "sign">;
}

export interface TimeEntry {
  id: string;
  firmId: string;
  matterId: string;
  userId: string;
  performedAt: string;
  minutes: number;
  rateCents: number;
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

export interface TaskDeadlineRecord {
  id: string;
  firmId: string;
  matterId: string;
  assignedToUserId?: string;
  title: string;
  dueAt?: string;
  completedAt?: string;
}

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

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";
export type CalendarAttendeeRole = "required" | "optional";
export type CalendarAttendeeResponseStatus = "needs_action" | "accepted" | "tentative" | "declined";
export type CalendarInvitationStatus = "not_sent" | "queued" | "skipped";
export type CalendarMeetingLinkMode = "blank" | "external_url" | "hosted_webrtc";
export type CalendarEventReminderChannel = "dashboard";
export type CalendarEventReminderStatus = "pending" | "acknowledged" | "dismissed" | "cancelled";
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
  matterId: string;
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
  matterId: string;
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
