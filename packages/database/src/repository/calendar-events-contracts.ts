import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventScope,
  CalendarEventReminderRecord,
  CalendarGuestLinkRecord,
  CalendarGuestLinkStatus,
  CalendarMeetingSessionRecord,
  CalendarMeetingSessionStatus,
  CalendarSchedulingRequestRecord,
} from "@open-practice/domain";

export type CalendarEventUpsertInput = CalendarEventRecord;
export type CalendarEventAttendeeUpsertInput = CalendarEventAttendeeRecord;
export type CalendarEventReminderUpsertInput = CalendarEventReminderRecord;
export type CalendarMeetingSessionCreateInput = CalendarMeetingSessionRecord;
export type CalendarGuestLinkCreateInput = CalendarGuestLinkRecord;

export class CalendarEventScopeConflictError extends Error {
  constructor(eventId: string) {
    super(`Calendar event ${eventId} already exists in another firm or matter`);
    this.name = "CalendarEventScopeConflictError";
  }
}

export class CalendarEventUidConflictError extends Error {
  constructor(uid: string) {
    super(`Active calendar event UID ${uid} already exists in this matter`);
    this.name = "CalendarEventUidConflictError";
  }
}

export interface CalendarEventListOptions {
  matterId?: string;
  scopes?: CalendarEventScope[];
  clientContactIds?: string[];
  startsAfter?: string;
  startsBefore?: string;
}

export interface CalendarEventAttendeeDeleteInput {
  firmId: string;
  matterId: string;
  eventId: string;
  attendeeId: string;
  deletedAt: string;
  updatedByUserId: string;
}

export interface CalendarEventAttendeeReplaceInput {
  firmId: string;
  matterId: string;
  eventId: string;
  attendees: CalendarEventAttendeeUpsertInput[];
  replacedAt: string;
  updatedByUserId: string;
}

export interface CalendarSchedulingRequestListOptions {
  matterId?: string;
  status?: CalendarSchedulingRequestRecord["status"];
  ownerUserId?: string;
}

export interface CalendarEventReminderDeleteInput {
  firmId: string;
  scope?: CalendarEventScope;
  matterId?: string;
  clientContactId?: string;
  eventId: string;
  reminderId: string;
  deletedAt: string;
  updatedByUserId: string;
}

export interface CalendarEventDeleteInput {
  firmId: string;
  matterId: string;
  eventId: string;
  deletedAt: string;
  updatedByUserId: string;
}

export interface CalendarMeetingSessionListOptions {
  matterId?: string;
  eventId?: string;
  status?: CalendarMeetingSessionStatus;
}

export interface CalendarMeetingSessionStatusUpdateInput {
  firmId: string;
  matterId: string;
  eventId: string;
  sessionId: string;
  status: CalendarMeetingSessionStatus;
  occurredAt: string;
  actorUserId: string;
}

export interface CalendarGuestLinkListOptions {
  matterId?: string;
  eventId?: string;
  sessionId?: string;
  status?: CalendarGuestLinkStatus;
}

export interface CalendarGuestLinkStatusUpdateInput {
  firmId: string;
  matterId: string;
  eventId: string;
  sessionId: string;
  linkId: string;
  status: CalendarGuestLinkStatus;
  occurredAt: string;
  actorUserId?: string;
}

export interface CalendarGuestLinkRevokeInput {
  firmId: string;
  matterId: string;
  eventId: string;
  sessionId: string;
  linkId: string;
  revokedAt: string;
  actorUserId: string;
}

export interface CalendarEventsRepository {
  listCalendarEvents(
    firmId: string,
    options: CalendarEventListOptions,
  ): Promise<CalendarEventRecord[]>;
  getCalendarEvent(
    firmId: string,
    matterId: string | undefined,
    eventId: string,
  ): Promise<CalendarEventRecord | undefined>;
  getCalendarEventByUid(
    firmId: string,
    matterId: string,
    uid: string,
  ): Promise<CalendarEventRecord | undefined>;
  upsertCalendarEvent(event: CalendarEventUpsertInput): Promise<CalendarEventRecord>;
  listCalendarEventAttendees(
    firmId: string,
    matterId: string,
    eventId: string,
  ): Promise<CalendarEventAttendeeRecord[]>;
  upsertCalendarEventAttendee(
    attendee: CalendarEventAttendeeUpsertInput,
  ): Promise<CalendarEventAttendeeRecord>;
  deleteCalendarEventAttendee(
    input: CalendarEventAttendeeDeleteInput,
  ): Promise<CalendarEventAttendeeRecord | undefined>;
  replaceCalendarEventAttendees(
    input: CalendarEventAttendeeReplaceInput,
  ): Promise<CalendarEventAttendeeRecord[]>;
  listCalendarEventReminders(
    firmId: string,
    matterId: string | undefined,
    eventId: string,
  ): Promise<CalendarEventReminderRecord[]>;
  upsertCalendarEventReminder(
    reminder: CalendarEventReminderUpsertInput,
  ): Promise<CalendarEventReminderRecord>;
  createCalendarSchedulingRequest(
    request: CalendarSchedulingRequestRecord,
  ): Promise<CalendarSchedulingRequestRecord>;
  listCalendarSchedulingRequests(
    firmId: string,
    options?: CalendarSchedulingRequestListOptions,
  ): Promise<CalendarSchedulingRequestRecord[]>;
  deleteCalendarEventReminder(
    input: CalendarEventReminderDeleteInput,
  ): Promise<CalendarEventReminderRecord | undefined>;
  deleteCalendarEvent(input: CalendarEventDeleteInput): Promise<CalendarEventRecord | undefined>;
  createCalendarMeetingSession(
    session: CalendarMeetingSessionCreateInput,
  ): Promise<CalendarMeetingSessionRecord>;
  listCalendarMeetingSessions(
    firmId: string,
    options?: CalendarMeetingSessionListOptions,
  ): Promise<CalendarMeetingSessionRecord[]>;
  getCalendarMeetingSession(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
  ): Promise<CalendarMeetingSessionRecord | undefined>;
  updateCalendarMeetingSessionStatus(
    input: CalendarMeetingSessionStatusUpdateInput,
  ): Promise<CalendarMeetingSessionRecord | undefined>;
  createCalendarGuestLink(link: CalendarGuestLinkCreateInput): Promise<CalendarGuestLinkRecord>;
  listCalendarGuestLinks(
    firmId: string,
    options?: CalendarGuestLinkListOptions,
  ): Promise<CalendarGuestLinkRecord[]>;
  getCalendarGuestLink(
    firmId: string,
    matterId: string,
    eventId: string,
    sessionId: string,
    linkId: string,
  ): Promise<CalendarGuestLinkRecord | undefined>;
  getCalendarGuestLinkByTokenHash(tokenHash: string): Promise<CalendarGuestLinkRecord | undefined>;
  updateCalendarGuestLinkStatus(
    input: CalendarGuestLinkStatusUpdateInput,
  ): Promise<CalendarGuestLinkRecord | undefined>;
  revokeCalendarGuestLink(
    input: CalendarGuestLinkRevokeInput,
  ): Promise<CalendarGuestLinkRecord | undefined>;
}
