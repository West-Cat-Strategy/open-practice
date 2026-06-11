import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventReminderRecord,
  CalendarMeetingInvitationBoundary,
  CalendarSchedulingRequestSummary,
} from "@open-practice/domain/calendar-models";

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

export interface CalendarMatterLinks {
  caldavUrl: string;
  subscriptionUrl: string;
}

export interface CalendarDashboardResponse {
  eventsByMatterId: Record<string, CalendarEventRecord[]>;
  standaloneEvents: CalendarEventRecord[];
  guestSessionsByEventId: Record<string, CalendarGuestSessionSummary[]>;
  schedulingRequestsByMatterId: Record<string, CalendarSchedulingRequestSummary[]>;
  linksByMatterId: Record<string, CalendarMatterLinks>;
  credentials: CalendarCredentialSummary[];
}
