import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarMeetingInvitationBoundary,
} from "@open-practice/domain";
import type {
  CalendarCredentialSummary,
  CalendarDashboardResponse,
  CalendarEventsResponse,
  CalendarMatterLinks,
  MatterSummary,
} from "./types";

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

export function upsertCalendarCredential(
  credentials: CalendarCredentialSummary[],
  credential: CalendarCredentialSummary,
): CalendarCredentialSummary[] {
  const exists = credentials.some((candidate) => candidate.id === credential.id);
  if (!exists) return [...credentials, credential];
  return credentials.map((candidate) => (candidate.id === credential.id ? credential : candidate));
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
  listEventsForMatter: (matterId: string) => Promise<CalendarEventsResponse>;
  listCredentials: () => Promise<CalendarCredentialSummary[]>;
}): Promise<CalendarDashboardResponse> {
  const [credentials, matterResponses] = await Promise.all([
    input.listCredentials(),
    Promise.all(
      input.matters.map(async (matter) => ({
        matterId: matter.id,
        response: await input.listEventsForMatter(matter.id),
      })),
    ),
  ]);
  const eventsByMatterId: Record<string, CalendarEventRecord[]> = {};
  const linksByMatterId: Record<string, CalendarMatterLinks> = {};

  for (const matterResponse of matterResponses) {
    eventsByMatterId[matterResponse.matterId] = matterResponse.response.events;
    linksByMatterId[matterResponse.matterId] = {
      caldavUrl: matterResponse.response.caldavUrl,
      subscriptionUrl: matterResponse.response.subscriptionUrl,
    };
  }

  return {
    eventsByMatterId,
    linksByMatterId,
    credentials,
  };
}
