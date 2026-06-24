import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventReminderRecord,
  CalendarMeetingInvitationBoundary,
  CalendarMeetingLinkMode,
  CalendarSchedulingRequestSummary,
} from "@open-practice/domain/calendar-models";
import type {
  CalendarCredentialSummary,
  CalendarDashboardResponse,
  CalendarEventsResponse,
  CalendarGuestSessionSummary,
  CalendarMatterLinks,
} from "./_features/calendar/models";
import type { DeliveryConfirmationPayload, MatterSummary } from "./types";
import { buildEmailDeliveryConfirmation } from "./types";

export interface CalendarRadarBuckets {
  overdue: CalendarEventRecord[];
  nextSevenDays: CalendarEventRecord[];
  nextThirtyDays: CalendarEventRecord[];
  tentative: CalendarEventRecord[];
  cancelled: CalendarEventRecord[];
}

export function sortCalendarEvents(events: CalendarEventRecord[]): CalendarEventRecord[] {
  return [...events].sort((left, right) => {
    const startsAtDifference = Date.parse(left.startsAt) - Date.parse(right.startsAt);
    return startsAtDifference === 0 ? left.id.localeCompare(right.id) : startsAtDifference;
  });
}

export function buildCalendarRadarBuckets(
  events: CalendarEventRecord[],
  now: Date = new Date(),
): CalendarRadarBuckets {
  const currentTime = now.getTime();
  const sevenDays = currentTime + 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = currentTime + 30 * 24 * 60 * 60 * 1000;
  const sortedEvents = sortCalendarEvents(events);
  const activeEvents = sortedEvents.filter((event) => event.status !== "cancelled");

  return {
    overdue: activeEvents.filter((event) => Date.parse(event.startsAt) < currentTime),
    nextSevenDays: activeEvents.filter((event) => {
      const startsAt = Date.parse(event.startsAt);
      return startsAt >= currentTime && startsAt <= sevenDays;
    }),
    nextThirtyDays: activeEvents.filter((event) => {
      const startsAt = Date.parse(event.startsAt);
      return startsAt > sevenDays && startsAt <= thirtyDays;
    }),
    tentative: activeEvents.filter((event) => event.status === "tentative"),
    cancelled: sortedEvents.filter((event) => event.status === "cancelled"),
  };
}

export function describeCalendarEventTiming(
  event: CalendarEventRecord,
  now: Date = new Date(),
): "overdue" | "next 7 days" | "next 30 days" | "later" {
  const currentTime = now.getTime();
  const startsAt = Date.parse(event.startsAt);
  if (startsAt < currentTime) return "overdue";
  if (startsAt <= currentTime + 7 * 24 * 60 * 60 * 1000) return "next 7 days";
  if (startsAt <= currentTime + 30 * 24 * 60 * 60 * 1000) return "next 30 days";
  return "later";
}

export function describeMeetingInvitationBoundary(
  boundary: CalendarMeetingInvitationBoundary | undefined,
): string {
  if (!boundary) return "Meeting links disabled.";
  const linkStatus =
    boundary.meetingLinks.status === "configured"
      ? `Meeting links configured${boundary.meetingLinks.provider ? ` (${boundary.meetingLinks.provider})` : ""}.`
      : "Meeting links disabled.";
  const guestAccessStatus =
    boundary.guestAccess.status === "configured"
      ? "Guest access tokens configured."
      : "Guest access tokens disabled.";
  return `${linkStatus} ${guestAccessStatus}`;
}

export interface MeetingLinkAvailability {
  label: string;
  detail: string;
  status: "configured" | "disabled";
  actionable: boolean;
}

export interface CalendarStaffHandoffSummary {
  label: string;
  detail: string;
  tone?: "risk";
  action: "send_confirmed_invites" | "review_request" | "linked_existing_event" | "no_action";
  publicBookingEnabled: false;
  providerSyncEnabled: false;
  nativeMediaEnabled: false;
}

const disabledCalendarAutomation = {
  publicBookingEnabled: false,
  providerSyncEnabled: false,
  nativeMediaEnabled: false,
} as const;

export function describeMeetingLinkAvailability(
  event: Pick<
    CalendarEventRecord,
    "meetingLinkMode" | "meetingLinkUrl" | "meetingProviderKey" | "meetingInvitationBoundary"
  >,
): MeetingLinkAvailability {
  if (event.meetingLinkUrl) {
    const providerDetail =
      event.meetingLinkMode === "hosted_webrtc"
        ? `${event.meetingProviderKey ?? "Hosted WebRTC"} link ready`
        : "External meeting link ready";
    return {
      label: "Send link invite",
      detail: `${providerDetail}; the invitation action can include the stored meeting link.`,
      status: "configured",
      actionable: true,
    };
  }

  const hostedConfigured = event.meetingInvitationBoundary?.meetingLinks.status === "configured";
  return {
    label: "No meeting link",
    detail: hostedConfigured
      ? "Choose Hosted WebRTC or add another meeting link before sending link invites."
      : "Add another meeting link, leave it blank, or configure Hosted WebRTC before using hosted links.",
    status: "disabled",
    actionable: false,
  };
}

export function describeCalendarEventHandoff(
  event: Pick<
    CalendarEventRecord,
    "status" | "meetingLinkMode" | "meetingLinkUrl" | "meetingInvitationBoundary"
  > & { attendees?: CalendarEventAttendeeRecord[] },
): CalendarStaffHandoffSummary {
  const meetingLink = describeMeetingLinkAvailability(event);
  if (event.status === "cancelled") {
    return {
      label: "cancelled",
      detail: "Cancelled events stay closed to invitation and lobby handoff.",
      action: "no_action",
      ...disabledCalendarAutomation,
    };
  }
  if ((event.attendees ?? []).length === 0) {
    return {
      label: "add attendees",
      detail: "Add staff-reviewed attendees before sending invitation handoff.",
      action: "no_action",
      ...disabledCalendarAutomation,
    };
  }
  if (meetingLink.actionable) {
    return {
      label: "handoff ready",
      detail:
        "Staff can send confirmed invitation email handoff with the stored meeting link; public booking and native media stay disabled.",
      action: "send_confirmed_invites",
      ...disabledCalendarAutomation,
    };
  }
  return {
    label: "link review",
    detail: `${meetingLink.detail} Public booking, provider sync, and native media stay disabled.`,
    action: "review_request",
    tone: "risk",
    ...disabledCalendarAutomation,
  };
}

export function describeCalendarSchedulingRequestHandoff(
  request: CalendarSchedulingRequestSummary,
): CalendarStaffHandoffSummary {
  if (request.status === "needs_review") {
    return {
      label: "review needed",
      detail: request.linkedEvent
        ? "Staff review can keep the existing linked event; no automatic reschedule or provider sync runs."
        : "Staff review can link an existing same-matter event; no public booking page or event creation runs.",
      action: "review_request",
      tone: "risk",
      ...disabledCalendarAutomation,
    };
  }
  if (request.status === "scheduled") {
    return {
      label: "existing event linked",
      detail: "The request is linked to an existing event only; no automatic event creation ran.",
      action: "linked_existing_event",
      ...disabledCalendarAutomation,
    };
  }
  if (request.status === "reviewed") {
    return {
      label: "reviewed",
      detail: "Staff review completed without enabling public booking or provider sync.",
      action: "no_action",
      ...disabledCalendarAutomation,
    };
  }
  return {
    label: "dismissed",
    detail:
      "Dismissed scheduling requests stay closed to booking, provider sync, and native media.",
    action: "no_action",
    ...disabledCalendarAutomation,
  };
}

export function describeCalendarGuestSessionStatus(
  session: Pick<
    CalendarGuestSessionSummary,
    "status" | "issuedCount" | "waitingCount" | "admittedCount" | "deniedCount" | "revokedCount"
  >,
): string {
  const lobby =
    session.status === "open"
      ? "Lobby open"
      : session.status === "locked"
        ? "Lobby locked"
        : session.status === "ended"
          ? "Session ended"
          : session.status === "expired"
            ? "Guest access expired"
            : "Lobby closed";
  return `${lobby}; ${session.waitingCount} waiting, ${session.admittedCount} admitted, ${session.deniedCount} denied, ${session.revokedCount} revoked.`;
}

export function sortCalendarGuestSessions(
  sessions: CalendarGuestSessionSummary[],
): CalendarGuestSessionSummary[] {
  return [...sessions].sort((left, right) => {
    const endedWeight = Number(left.status === "ended") - Number(right.status === "ended");
    if (endedWeight !== 0) return endedWeight;
    const updatedDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    return updatedDifference === 0 ? left.id.localeCompare(right.id) : updatedDifference;
  });
}

export function upsertCalendarGuestSession(
  sessionsByEventId: Record<string, CalendarGuestSessionSummary[]>,
  session: CalendarGuestSessionSummary,
): Record<string, CalendarGuestSessionSummary[]> {
  const existingSessions = sessionsByEventId[session.eventId] ?? [];
  const exists = existingSessions.some((candidate) => candidate.id === session.id);
  const nextSessions = exists
    ? existingSessions.map((candidate) => (candidate.id === session.id ? session : candidate))
    : [session, ...existingSessions];
  return {
    ...sessionsByEventId,
    [session.eventId]: sortCalendarGuestSessions(nextSessions),
  };
}

export function buildCalendarMeetingLinkPayload(input: {
  matterId: string;
  mode: CalendarMeetingLinkMode;
  externalUrl?: string;
}): { matterId: string; mode: CalendarMeetingLinkMode; url?: string } {
  return {
    matterId: input.matterId,
    mode: input.mode,
    ...(input.mode === "external_url" ? { url: (input.externalUrl ?? "").trim() } : {}),
  };
}

export function buildCalendarEventPayload(input: {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
  description?: string;
  location?: string;
}): {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
  description?: string;
  location?: string;
} {
  return {
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(input.clientContactId ? { clientContactId: input.clientContactId } : {}),
    title: input.title.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ...(input.status ? { status: input.status } : {}),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
  };
}

export function buildCalendarReschedulePayload(input: {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
}): {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  startsAt: string;
  endsAt: string;
  status?: CalendarEventRecord["status"];
} {
  return {
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(input.clientContactId ? { clientContactId: input.clientContactId } : {}),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    ...(input.status ? { status: input.status } : {}),
  };
}

export function buildCalendarReminderPayload(input: {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  remindAt: string;
  status?: CalendarEventReminderRecord["status"];
  note?: string;
}): {
  scope?: CalendarEventRecord["scope"];
  matterId?: string;
  clientContactId?: string;
  remindAt: string;
  channel: "dashboard";
  status?: CalendarEventReminderRecord["status"];
  note?: string;
} {
  return {
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(input.clientContactId ? { clientContactId: input.clientContactId } : {}),
    remindAt: input.remindAt,
    channel: "dashboard",
    ...(input.status ? { status: input.status } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

export function buildCalendarInvitationPayload(input: {
  matterId: string;
  recipientCount: number;
  includeMeetingLink?: boolean;
}): {
  matterId: string;
  includeMeetingLink?: true;
  deliveryConfirmation: DeliveryConfirmationPayload;
} {
  return {
    matterId: input.matterId,
    ...(input.includeMeetingLink ? { includeMeetingLink: true as const } : {}),
    deliveryConfirmation: buildEmailDeliveryConfirmation(input.recipientCount),
  };
}

export function upsertCalendarEvent(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  event: CalendarEventRecord,
): Record<string, CalendarEventRecord[]> {
  const existingEvents = eventsByMatterId[matterId] ?? [];
  const exists = existingEvents.some((candidate) => candidate.id === event.id);
  const nextEvents = exists
    ? existingEvents.map((candidate) => (candidate.id === event.id ? event : candidate))
    : [...existingEvents, event];
  return {
    ...eventsByMatterId,
    [matterId]: sortCalendarEvents(nextEvents),
  };
}

export function upsertStandaloneCalendarEvent(
  events: CalendarEventRecord[],
  event: CalendarEventRecord,
): CalendarEventRecord[] {
  const exists = events.some((candidate) => candidate.id === event.id);
  const nextEvents = exists
    ? events.map((candidate) => (candidate.id === event.id ? event : candidate))
    : [...events, event];
  return sortCalendarEvents(nextEvents);
}

export function upsertCalendarCredential(
  credentials: CalendarCredentialSummary[],
  credential: CalendarCredentialSummary,
): CalendarCredentialSummary[] {
  const exists = credentials.some((candidate) => candidate.id === credential.id);
  if (!exists) return [...credentials, credential];
  return credentials.map((candidate) => (candidate.id === credential.id ? credential : candidate));
}

export function upsertCalendarEventReminder(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  reminder: CalendarEventReminderRecord,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) => {
      if (event.id !== eventId) return event;
      const reminders = event.reminders ?? [];
      const exists = reminders.some((candidate) => candidate.id === reminder.id);
      const nextReminders = exists
        ? reminders.map((candidate) => (candidate.id === reminder.id ? reminder : candidate))
        : [...reminders, reminder];
      return {
        ...event,
        reminders: nextReminders
          .filter((candidate) => !candidate.deletedAt)
          .sort((left, right) => {
            const remindAtDifference = Date.parse(left.remindAt) - Date.parse(right.remindAt);
            return remindAtDifference === 0 ? left.id.localeCompare(right.id) : remindAtDifference;
          }),
      };
    }),
  };
}

export function upsertStandaloneCalendarEventReminder(
  events: CalendarEventRecord[],
  eventId: string,
  reminder: CalendarEventReminderRecord,
): CalendarEventRecord[] {
  return events.map((event) => {
    if (event.id !== eventId) return event;
    const reminders = event.reminders ?? [];
    const exists = reminders.some((candidate) => candidate.id === reminder.id);
    const nextReminders = exists
      ? reminders.map((candidate) => (candidate.id === reminder.id ? reminder : candidate))
      : [...reminders, reminder];
    return {
      ...event,
      reminders: nextReminders
        .filter((candidate) => !candidate.deletedAt)
        .sort((left, right) => {
          const remindAtDifference = Date.parse(left.remindAt) - Date.parse(right.remindAt);
          return remindAtDifference === 0 ? left.id.localeCompare(right.id) : remindAtDifference;
        }),
    };
  });
}

export function removeCalendarEventReminder(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  reminderId: string,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) =>
      event.id === eventId
        ? {
            ...event,
            reminders: (event.reminders ?? []).filter((reminder) => reminder.id !== reminderId),
          }
        : event,
    ),
  };
}

export function removeStandaloneCalendarEventReminder(
  events: CalendarEventRecord[],
  eventId: string,
  reminderId: string,
): CalendarEventRecord[] {
  return events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          reminders: (event.reminders ?? []).filter((reminder) => reminder.id !== reminderId),
        }
      : event,
  );
}

export function upsertCalendarEventAttendee(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  attendee: CalendarEventAttendeeRecord,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) => {
      if (event.id !== eventId) return event;
      const attendees = event.attendees ?? [];
      const exists = attendees.some((candidate) => candidate.id === attendee.id);
      const nextAttendees = exists
        ? attendees.map((candidate) => (candidate.id === attendee.id ? attendee : candidate))
        : [...attendees, attendee];
      return {
        ...event,
        attendees: nextAttendees
          .filter((candidate) => !candidate.deletedAt)
          .sort((left, right) => left.email.localeCompare(right.email)),
      };
    }),
  };
}

export function removeCalendarEventAttendee(
  eventsByMatterId: Record<string, CalendarEventRecord[]>,
  matterId: string,
  eventId: string,
  attendeeId: string,
): Record<string, CalendarEventRecord[]> {
  return {
    ...eventsByMatterId,
    [matterId]: (eventsByMatterId[matterId] ?? []).map((event) =>
      event.id === eventId
        ? {
            ...event,
            attendees: (event.attendees ?? []).filter((attendee) => attendee.id !== attendeeId),
          }
        : event,
    ),
  };
}

export async function loadCalendarDashboardData(input: {
  matters: MatterSummary[];
  listStandaloneEvents: () => Promise<CalendarEventsResponse>;
  listEventsForMatter: (matterId: string) => Promise<CalendarEventsResponse>;
  listCredentials: () => Promise<CalendarCredentialSummary[]>;
}): Promise<CalendarDashboardResponse> {
  const [credentials, standaloneResponse, matterResponses] = await Promise.all([
    input.listCredentials(),
    input.listStandaloneEvents(),
    Promise.all(
      input.matters.map(async (matter) => ({
        matterId: matter.id,
        response: await input.listEventsForMatter(matter.id),
      })),
    ),
  ]);
  const eventsByMatterId: Record<string, CalendarEventRecord[]> = {};
  const guestSessionsByEventId: Record<string, CalendarGuestSessionSummary[]> = {};
  const schedulingRequestsByMatterId: CalendarDashboardResponse["schedulingRequestsByMatterId"] =
    {};
  const linksByMatterId: Record<string, CalendarMatterLinks> = {};

  for (const matterResponse of matterResponses) {
    eventsByMatterId[matterResponse.matterId] = matterResponse.response.events;
    schedulingRequestsByMatterId[matterResponse.matterId] =
      matterResponse.response.schedulingRequests ?? [];
    for (const session of matterResponse.response.guestSessions ?? []) {
      guestSessionsByEventId[session.eventId] = sortCalendarGuestSessions([
        ...(guestSessionsByEventId[session.eventId] ?? []),
        session,
      ]);
    }
    linksByMatterId[matterResponse.matterId] = {
      caldavUrl: matterResponse.response.caldavUrl,
      subscriptionUrl: matterResponse.response.subscriptionUrl,
    };
  }

  return {
    eventsByMatterId,
    standaloneEvents: standaloneResponse.events,
    guestSessionsByEventId,
    schedulingRequestsByMatterId,
    linksByMatterId,
    credentials,
  };
}
