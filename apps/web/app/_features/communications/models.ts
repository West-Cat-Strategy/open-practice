export interface CommunicationsInboxInboundEmail {
  id: string;
  matterId?: string;
  status: string;
  labels: string[];
  receivedAt: string;
  attachmentCount: number;
  matterDraft?: InboundEmailMatterDraft;
  triage?: {
    status?: string;
    assignedToUserId?: string;
    contactIds?: string[];
    updatedAt?: string;
    updatedByUserId?: string;
  };
}

export interface InboundEmailMatterDraft {
  status: "drafted";
  createdAt: string;
  createdByUserId: string;
  source: {
    inboundMessageId: string;
    providerMessageIdPresent: boolean;
    receivedAt: string;
    recipientCount: number;
    subjectPresent: boolean;
    senderSummary: string;
    attachmentCount: number;
  };
  redactedBodySummary: string;
  proposedMatter: {
    title: string;
    practiceArea: string;
    jurisdiction: "BC" | "ON" | "CANADA" | "OTHER";
    client: {
      kind: "person" | "organization";
      displayName: string;
    };
  };
  automaticMatterCreation: false;
  bodyRedacted: true;
  metadataRedacted: true;
  reviewCues?: InboundEmailMatterDraftReviewCues;
}

export interface InboundEmailMatterDraftReviewCues {
  duplicateCandidates: Array<{
    contactId: string;
    displayName: string;
    kind: "person" | "organization";
    status: "prospective" | "active" | "inactive" | "archived" | "former" | "restricted";
    matchedFields: Array<
      "name" | "alias" | "former_name" | "identifier" | "email" | "phone" | "website" | "address"
    >;
    matchCount: number;
    visibleSharedMatterCount: number;
    severity: "blocker" | "review" | "info";
  }>;
  existingMatterCandidates: Array<{
    matterId: string;
    number: string;
    title: string;
    status: string;
    practiceArea: string;
    jurisdiction: "BC" | "ON" | "CANADA" | "OTHER";
    matchReasons: string[];
  }>;
  checklist: Array<{
    key: string;
    label: string;
    description: string;
    state: "complete" | "needs_attention" | "review";
    count?: number;
    source: "draft" | "existing_matter";
    matterId?: string;
  }>;
  boundary: {
    automaticMatterCreation: false;
    bodyRedacted: true;
    metadataRedacted: true;
    matterPermissionsExpanded: false;
  };
}

export interface UnscopedInboundEmailReviewMessage {
  id: string;
  status: string;
  labels: string[];
  receivedAt: string;
  recipientCount: number;
  senderSummary: string;
  providerMessageIdPresent: boolean;
  subjectPresent: boolean;
  bodyRedacted: true;
  metadataRedacted: true;
  matterDraft?: InboundEmailMatterDraft;
}

export interface UnscopedInboundEmailReviewResponse {
  status: "available" | "access_denied" | "unavailable";
  messages: UnscopedInboundEmailReviewMessage[];
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
  unscopedInboundEmail: UnscopedInboundEmailReviewResponse;
}
