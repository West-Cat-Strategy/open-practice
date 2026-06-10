import {
  transitionCalendarGuestLinkStatus,
  transitionCalendarMeetingSessionStatus,
  type CalendarEventAttendeeRecord,
  type CalendarEventRecord,
  type CalendarEventReminderRecord,
  type CalendarGuestLinkRecord,
  type CalendarMeetingSessionRecord,
  type CalendarSchedulingRequestRecord,
} from "@open-practice/domain";
import {
  CalendarEventScopeConflictError,
  CalendarEventUidConflictError,
  type CalendarEventAttendeeDeleteInput,
  type CalendarEventAttendeeReplaceInput,
  type CalendarEventAttendeeUpsertInput,
  type CalendarEventDeleteInput,
  type CalendarEventListOptions,
  type CalendarEventReminderDeleteInput,
  type CalendarEventReminderUpsertInput,
  type CalendarEventUpsertInput,
  type CalendarGuestLinkCreateInput,
  type CalendarGuestLinkListOptions,
  type CalendarGuestLinkRevokeInput,
  type CalendarGuestLinkStatusUpdateInput,
  type CalendarMeetingSessionCreateInput,
  type CalendarMeetingSessionListOptions,
  type CalendarMeetingSessionStatusUpdateInput,
  type CalendarSchedulingRequestListOptions,
} from "../calendar-events-contracts.js";
import { clone } from "../contracts.js";
import { activeCalendarAttendees, activeCalendarReminders } from "../drizzle-mappers.js";

export interface MemoryCalendarEventStore {
  calendarEvents: CalendarEventRecord[];
  calendarSchedulingRequests: CalendarSchedulingRequestRecord[];
  calendarMeetingSessions: CalendarMeetingSessionRecord[];
  calendarGuestLinks: CalendarGuestLinkRecord[];
}

function calendarScope(
  event: Pick<CalendarEventRecord, "scope">,
): NonNullable<CalendarEventRecord["scope"]> {
  return event.scope ?? "matter";
}

function calendarScopeMatches(
  event: Pick<CalendarEventRecord, "scope" | "matterId" | "clientContactId">,
  options: CalendarEventListOptions,
): boolean {
  if (options.matterId) return event.matterId === options.matterId;
  if (options.scopes && !options.scopes.includes(calendarScope(event))) return false;
  if (calendarScope(event) === "client" && !options.clientContactIds) return false;
  if (
    options.clientContactIds &&
    (calendarScope(event) !== "client" ||
      !event.clientContactId ||
      !options.clientContactIds.includes(event.clientContactId))
  ) {
    return false;
  }
  return !event.matterId;
}

export function listMemoryCalendarEvents(
  store: MemoryCalendarEventStore,
  firmId: string,
  options: CalendarEventListOptions,
): CalendarEventRecord[] {
  return clone(
    store.calendarEvents
      .filter(
        (event) =>
          event.firmId === firmId &&
          calendarScopeMatches(event, options) &&
          !event.deletedAt &&
          (!options.startsAfter || Date.parse(event.startsAt) >= Date.parse(options.startsAfter)) &&
          (!options.startsBefore || Date.parse(event.startsAt) < Date.parse(options.startsBefore)),
      )
      .sort((left, right) => {
        const startDifference = Date.parse(left.startsAt) - Date.parse(right.startsAt);
        return startDifference === 0 ? left.id.localeCompare(right.id) : startDifference;
      })
      .map((event) => ({
        ...event,
        attendees: activeCalendarAttendees(event.attendees, event),
        reminders: activeCalendarReminders(event.reminders, event),
      })),
  );
}

export function getMemoryCalendarEvent(
  store: MemoryCalendarEventStore,
  firmId: string,
  matterId: string | undefined,
  eventId: string,
): CalendarEventRecord | undefined {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === firmId &&
      (matterId === undefined || candidate.matterId === matterId) &&
      candidate.id === eventId &&
      !candidate.deletedAt,
  );
  return event
    ? clone({
        ...event,
        attendees: activeCalendarAttendees(event.attendees, event),
        reminders: activeCalendarReminders(event.reminders, event),
      })
    : undefined;
}

export function getMemoryCalendarEventByUid(
  store: MemoryCalendarEventStore,
  firmId: string,
  matterId: string,
  uid: string,
): CalendarEventRecord | undefined {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === firmId &&
      candidate.matterId === matterId &&
      candidate.uid === uid &&
      !candidate.deletedAt,
  );
  return event
    ? clone({
        ...event,
        attendees: activeCalendarAttendees(event.attendees, event),
        reminders: activeCalendarReminders(event.reminders, event),
      })
    : undefined;
}

export function upsertMemoryCalendarEvent(
  store: MemoryCalendarEventStore,
  event: CalendarEventUpsertInput,
): CalendarEventRecord {
  const eventIdCollision = store.calendarEvents.find((candidate) => candidate.id === event.id);
  if (
    eventIdCollision &&
    (eventIdCollision.firmId !== event.firmId ||
      eventIdCollision.matterId !== event.matterId ||
      eventIdCollision.clientContactId !== event.clientContactId ||
      calendarScope(eventIdCollision) !== calendarScope(event))
  ) {
    throw new CalendarEventScopeConflictError(event.id);
  }

  const activeUidCollision = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === event.firmId &&
      calendarScope(candidate) === calendarScope(event) &&
      candidate.matterId === event.matterId &&
      candidate.clientContactId === event.clientContactId &&
      candidate.uid === event.uid &&
      candidate.id !== event.id &&
      !candidate.deletedAt,
  );
  if (activeUidCollision) {
    throw new CalendarEventUidConflictError(event.uid);
  }

  const existingIndex = store.calendarEvents.findIndex(
    (candidate) =>
      candidate.firmId === event.firmId &&
      calendarScope(candidate) === calendarScope(event) &&
      candidate.matterId === event.matterId &&
      candidate.clientContactId === event.clientContactId &&
      candidate.id === event.id,
  );
  if (existingIndex >= 0) {
    store.calendarEvents[existingIndex] = clone({
      ...event,
      attendees: event.attendees ?? store.calendarEvents[existingIndex]!.attendees,
      reminders: event.reminders ?? store.calendarEvents[existingIndex]!.reminders,
    });
  } else {
    store.calendarEvents.push(clone(event));
  }
  const stored = store.calendarEvents.find((candidate) => candidate.id === event.id)!;
  return clone({
    ...stored,
    attendees: activeCalendarAttendees(stored.attendees, stored),
    reminders: activeCalendarReminders(stored.reminders, stored),
  });
}

export function listMemoryCalendarEventAttendees(
  store: MemoryCalendarEventStore,
  firmId: string,
  matterId: string,
  eventId: string,
): CalendarEventAttendeeRecord[] {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === firmId &&
      candidate.matterId === matterId &&
      candidate.id === eventId &&
      !candidate.deletedAt,
  );
  return clone(activeCalendarAttendees(event?.attendees, { firmId, matterId, id: eventId }));
}

export function upsertMemoryCalendarEventAttendee(
  store: MemoryCalendarEventStore,
  attendee: CalendarEventAttendeeUpsertInput,
): CalendarEventAttendeeRecord {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === attendee.firmId &&
      candidate.matterId === attendee.matterId &&
      candidate.id === attendee.eventId &&
      !candidate.deletedAt,
  );
  if (!event) {
    throw new Error(`Calendar event ${attendee.eventId} was not found`);
  }
  const attendees = event.attendees ?? [];
  const existingIndex = attendees.findIndex((candidate) => candidate.id === attendee.id);
  if (existingIndex >= 0) {
    attendees[existingIndex] = clone(attendee);
  } else {
    const activeEmailCollision = attendees.find(
      (candidate) =>
        candidate.email.toLowerCase() === attendee.email.toLowerCase() &&
        candidate.id !== attendee.id &&
        !candidate.deletedAt,
    );
    if (activeEmailCollision) {
      throw new Error(`Calendar attendee ${attendee.email} already exists on this event`);
    }
    attendees.push(clone(attendee));
  }
  event.attendees = attendees;
  return clone(attendee);
}

export function deleteMemoryCalendarEventAttendee(
  store: MemoryCalendarEventStore,
  input: CalendarEventAttendeeDeleteInput,
): CalendarEventAttendeeRecord | undefined {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.matterId === input.matterId &&
      candidate.id === input.eventId &&
      !candidate.deletedAt,
  );
  const attendee = event?.attendees?.find(
    (candidate) => candidate.id === input.attendeeId && !candidate.deletedAt,
  );
  if (!attendee) return undefined;
  attendee.deletedAt = input.deletedAt;
  attendee.updatedAt = input.deletedAt;
  attendee.updatedByUserId = input.updatedByUserId;
  return clone(attendee);
}

export function replaceMemoryCalendarEventAttendees(
  store: MemoryCalendarEventStore,
  input: CalendarEventAttendeeReplaceInput,
): CalendarEventAttendeeRecord[] {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.matterId === input.matterId &&
      candidate.id === input.eventId &&
      !candidate.deletedAt,
  );
  if (!event) return [];
  const retainedDeleted = (event.attendees ?? [])
    .filter((attendee) => attendee.deletedAt)
    .map(clone);
  const replaced = input.attendees.map(clone);
  event.attendees = [...retainedDeleted, ...replaced];
  return clone(activeCalendarAttendees(event.attendees, event));
}

export function listMemoryCalendarEventReminders(
  store: MemoryCalendarEventStore,
  firmId: string,
  matterId: string | undefined,
  eventId: string,
): CalendarEventReminderRecord[] {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === firmId &&
      (matterId === undefined || candidate.matterId === matterId) &&
      candidate.id === eventId &&
      !candidate.deletedAt,
  );
  if (!event) return [];
  return clone(activeCalendarReminders(event.reminders, event));
}

export function upsertMemoryCalendarEventReminder(
  store: MemoryCalendarEventStore,
  reminder: CalendarEventReminderUpsertInput,
): CalendarEventReminderRecord {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === reminder.firmId &&
      calendarScope(candidate) === (reminder.scope ?? "matter") &&
      candidate.matterId === reminder.matterId &&
      candidate.clientContactId === reminder.clientContactId &&
      candidate.id === reminder.eventId &&
      !candidate.deletedAt,
  );
  if (!event) {
    throw new Error(`Calendar event ${reminder.eventId} was not found`);
  }
  const reminders = event.reminders ?? [];
  const existingIndex = reminders.findIndex((candidate) => candidate.id === reminder.id);
  if (existingIndex >= 0) {
    reminders[existingIndex] = clone(reminder);
  } else {
    reminders.push(clone(reminder));
  }
  event.reminders = reminders;
  return clone(reminder);
}

export function createMemoryCalendarSchedulingRequest(
  store: MemoryCalendarEventStore,
  request: CalendarSchedulingRequestRecord,
): CalendarSchedulingRequestRecord {
  const existingIndex = store.calendarSchedulingRequests.findIndex(
    (candidate) => candidate.firmId === request.firmId && candidate.id === request.id,
  );
  if (existingIndex >= 0) {
    store.calendarSchedulingRequests[existingIndex] = clone(request);
  } else {
    store.calendarSchedulingRequests = [...store.calendarSchedulingRequests, clone(request)];
  }
  return clone(request);
}

export function listMemoryCalendarSchedulingRequests(
  store: MemoryCalendarEventStore,
  firmId: string,
  options: CalendarSchedulingRequestListOptions = {},
): CalendarSchedulingRequestRecord[] {
  return clone(
    store.calendarSchedulingRequests
      .filter(
        (request) =>
          request.firmId === firmId &&
          (!options.matterId || request.matterId === options.matterId) &&
          (!options.status || request.status === options.status) &&
          (!options.ownerUserId || request.ownerUserId === options.ownerUserId),
      )
      .sort((left, right) => {
        const leftTime = Date.parse(
          left.requestedDueAt ?? left.requestedStartsAt ?? left.createdAt,
        );
        const rightTime = Date.parse(
          right.requestedDueAt ?? right.requestedStartsAt ?? right.createdAt,
        );
        return leftTime === rightTime ? left.id.localeCompare(right.id) : leftTime - rightTime;
      }),
  );
}

export function deleteMemoryCalendarEventReminder(
  store: MemoryCalendarEventStore,
  input: CalendarEventReminderDeleteInput,
): CalendarEventReminderRecord | undefined {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === input.firmId &&
      calendarScope(candidate) === (input.scope ?? "matter") &&
      candidate.matterId === input.matterId &&
      candidate.clientContactId === input.clientContactId &&
      candidate.id === input.eventId &&
      !candidate.deletedAt,
  );
  const reminder = event?.reminders?.find(
    (candidate) => candidate.id === input.reminderId && !candidate.deletedAt,
  );
  if (!reminder) return undefined;
  reminder.deletedAt = input.deletedAt;
  reminder.updatedAt = input.deletedAt;
  reminder.updatedByUserId = input.updatedByUserId;
  return clone(reminder);
}

export function deleteMemoryCalendarEvent(
  store: MemoryCalendarEventStore,
  input: CalendarEventDeleteInput,
): CalendarEventRecord | undefined {
  const existing = store.calendarEvents.find(
    (event) =>
      event.firmId === input.firmId &&
      (input.matterId === undefined ? !event.matterId : event.matterId === input.matterId) &&
      event.id === input.eventId &&
      !event.deletedAt,
  );
  if (!existing) return undefined;
  existing.deletedAt = input.deletedAt;
  existing.updatedAt = input.deletedAt;
  existing.updatedByUserId = input.updatedByUserId;
  existing.sequence += 1;
  return clone(existing);
}

export function createMemoryCalendarMeetingSession(
  store: MemoryCalendarEventStore,
  session: CalendarMeetingSessionCreateInput,
): CalendarMeetingSessionRecord {
  const event = store.calendarEvents.find(
    (candidate) =>
      candidate.firmId === session.firmId &&
      candidate.matterId === session.matterId &&
      candidate.id === session.eventId &&
      !candidate.deletedAt,
  );
  if (!event) {
    throw new Error(`Calendar event ${session.eventId} was not found`);
  }
  if (store.calendarMeetingSessions.some((candidate) => candidate.id === session.id)) {
    throw new Error("Calendar meeting session already exists");
  }
  store.calendarMeetingSessions = [...store.calendarMeetingSessions, clone(session)];
  return clone(session);
}

export function listMemoryCalendarMeetingSessions(
  store: MemoryCalendarEventStore,
  firmId: string,
  options: CalendarMeetingSessionListOptions = {},
): CalendarMeetingSessionRecord[] {
  return clone(
    store.calendarMeetingSessions
      .filter(
        (session) =>
          session.firmId === firmId &&
          (!options.matterId || session.matterId === options.matterId) &&
          (!options.eventId || session.eventId === options.eventId) &&
          (!options.status || session.status === options.status),
      )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
      ),
  );
}

export function getMemoryCalendarMeetingSession(
  store: MemoryCalendarEventStore,
  firmId: string,
  matterId: string,
  eventId: string,
  sessionId: string,
): CalendarMeetingSessionRecord | undefined {
  return clone(
    store.calendarMeetingSessions.find(
      (session) =>
        session.firmId === firmId &&
        session.matterId === matterId &&
        session.eventId === eventId &&
        session.id === sessionId,
    ),
  );
}

export function updateMemoryCalendarMeetingSessionStatus(
  store: MemoryCalendarEventStore,
  input: CalendarMeetingSessionStatusUpdateInput,
): CalendarMeetingSessionRecord | undefined {
  const index = store.calendarMeetingSessions.findIndex(
    (session) =>
      session.firmId === input.firmId &&
      session.matterId === input.matterId &&
      session.eventId === input.eventId &&
      session.id === input.sessionId,
  );
  if (index < 0) return undefined;
  const updated = transitionCalendarMeetingSessionStatus(store.calendarMeetingSessions[index]!, {
    status: input.status,
    occurredAt: input.occurredAt,
    actorUserId: input.actorUserId,
  });
  store.calendarMeetingSessions[index] = clone(updated);
  return clone(updated);
}

export function createMemoryCalendarGuestLink(
  store: MemoryCalendarEventStore,
  link: CalendarGuestLinkCreateInput,
): CalendarGuestLinkRecord {
  const session = store.calendarMeetingSessions.find(
    (candidate) =>
      candidate.firmId === link.firmId &&
      candidate.matterId === link.matterId &&
      candidate.eventId === link.eventId &&
      candidate.id === link.sessionId,
  );
  if (!session) {
    throw new Error(`Calendar meeting session ${link.sessionId} was not found`);
  }
  if (store.calendarGuestLinks.some((candidate) => candidate.tokenHash === link.tokenHash)) {
    throw new Error("Calendar guest link token hash already exists");
  }
  store.calendarGuestLinks = [...store.calendarGuestLinks, clone(link)];
  return clone(link);
}

export function listMemoryCalendarGuestLinks(
  store: MemoryCalendarEventStore,
  firmId: string,
  options: CalendarGuestLinkListOptions = {},
): CalendarGuestLinkRecord[] {
  return clone(
    store.calendarGuestLinks
      .filter(
        (link) =>
          link.firmId === firmId &&
          (!options.matterId || link.matterId === options.matterId) &&
          (!options.eventId || link.eventId === options.eventId) &&
          (!options.sessionId || link.sessionId === options.sessionId) &&
          (!options.status || link.status === options.status),
      )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
      ),
  );
}

export function getMemoryCalendarGuestLink(
  store: MemoryCalendarEventStore,
  firmId: string,
  matterId: string,
  eventId: string,
  sessionId: string,
  linkId: string,
): CalendarGuestLinkRecord | undefined {
  return clone(
    store.calendarGuestLinks.find(
      (link) =>
        link.firmId === firmId &&
        link.matterId === matterId &&
        link.eventId === eventId &&
        link.sessionId === sessionId &&
        link.id === linkId,
    ),
  );
}

export function getMemoryCalendarGuestLinkByTokenHash(
  store: MemoryCalendarEventStore,
  tokenHash: string,
): CalendarGuestLinkRecord | undefined {
  return clone(store.calendarGuestLinks.find((link) => link.tokenHash === tokenHash));
}

export function updateMemoryCalendarGuestLinkStatus(
  store: MemoryCalendarEventStore,
  input: CalendarGuestLinkStatusUpdateInput,
): CalendarGuestLinkRecord | undefined {
  const index = store.calendarGuestLinks.findIndex(
    (link) =>
      link.firmId === input.firmId &&
      link.matterId === input.matterId &&
      link.eventId === input.eventId &&
      link.sessionId === input.sessionId &&
      link.id === input.linkId,
  );
  if (index < 0) return undefined;
  const updated = transitionCalendarGuestLinkStatus(store.calendarGuestLinks[index]!, {
    status: input.status,
    occurredAt: input.occurredAt,
    actorUserId: input.actorUserId,
  });
  store.calendarGuestLinks[index] = clone(updated);
  return clone(updated);
}

export function revokeMemoryCalendarGuestLink(
  store: MemoryCalendarEventStore,
  input: CalendarGuestLinkRevokeInput,
): CalendarGuestLinkRecord | undefined {
  return updateMemoryCalendarGuestLinkStatus(store, {
    firmId: input.firmId,
    matterId: input.matterId,
    eventId: input.eventId,
    sessionId: input.sessionId,
    linkId: input.linkId,
    status: "revoked",
    occurredAt: input.revokedAt,
    actorUserId: input.actorUserId,
  });
}
