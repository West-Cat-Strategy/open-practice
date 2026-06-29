import type {
  CalendarAttendeeResponseStatus,
  CalendarAttendeeRole,
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventStatus,
  CalendarGuestLinkRecord,
  CalendarGuestLinkStatus,
  CalendarMeetingLinkMode,
  CalendarMeetingInvitationBoundary,
  CalendarMeetingSessionRecord,
  CalendarMeetingSessionStatus,
  CalendarSchedulingRequestRecord,
  CalendarSchedulingRequestSummary,
} from "./models.js";
import { buildReviewAgingCue } from "./review-aging.js";

const DEFAULT_PRODUCT_ID = "-//Open Practice//Matter Calendar//EN";
const DEFAULT_DTSTAMP = "1970-01-01T00:00:00.000Z";
const SUPPORTED_STATUS_VALUES = new Set(["CONFIRMED", "TENTATIVE", "CANCELLED"]);
const SUPPORTED_ATTENDEE_ROLES = new Set(["REQ-PARTICIPANT", "OPT-PARTICIPANT"]);
const SUPPORTED_ATTENDEE_PARTSTATS = new Set(["NEEDS-ACTION", "ACCEPTED", "TENTATIVE", "DECLINED"]);
const UNSUPPORTED_PROPERTIES = new Set([
  "ORGANIZER",
  "RRULE",
  "RDATE",
  "EXDATE",
  "RECURRENCE-ID",
  "FREEBUSY",
  "REQUEST-STATUS",
  "TRIGGER",
]);
const UNSUPPORTED_COMPONENTS = new Set(["VALARM", "VTODO", "VFREEBUSY", "VJOURNAL"]);
const SUPPORTED_METHOD_VALUES = new Set(["PUBLISH"]);
const SESSION_STATUS_TRANSITIONS: Record<
  CalendarMeetingSessionStatus,
  CalendarMeetingSessionStatus[]
> = {
  lobby_closed: ["lobby_closed", "lobby_open", "locked", "ended"],
  lobby_open: ["lobby_open", "lobby_closed", "locked", "ended"],
  locked: ["locked", "lobby_closed", "lobby_open", "ended"],
  ended: ["ended"],
};
const GUEST_LINK_STATUS_TRANSITIONS: Record<CalendarGuestLinkStatus, CalendarGuestLinkStatus[]> = {
  issued: ["issued", "waiting", "admitted", "denied", "revoked"],
  waiting: ["waiting", "admitted", "denied", "revoked"],
  admitted: ["admitted", "revoked"],
  denied: ["denied", "revoked"],
  revoked: ["revoked"],
};

export interface CalendarFeedInput {
  events: CalendarEventRecord[];
  calendarName: string;
  generatedAt?: string;
  productId?: string;
}

export interface ParsedCalendarEventInput {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  location?: string;
  status: CalendarEventStatus;
  sequence: number;
  attendees: ParsedCalendarAttendeeInput[];
}

export interface ParsedCalendarAttendeeInput {
  name: string;
  email: string;
  role: CalendarAttendeeRole;
  responseStatus: CalendarAttendeeResponseStatus;
}

export interface CalendarMeetingLinkStateInput {
  mode?: CalendarMeetingLinkMode;
  url?: string;
  roomId?: string;
  providerKey?: string;
}

export interface CalendarMeetingInvitationBoundaryInput {
  meetingProviderKey?: string;
  guestAccessTokenSigningConfigured?: boolean;
  invitationEmailProviderKey?: string;
  emailQueueConfigured?: boolean;
}

export interface CalendarMeetingSessionTransitionInput {
  status: CalendarMeetingSessionStatus;
  occurredAt: string;
  actorUserId: string;
}

export interface CalendarGuestLinkTransitionInput {
  status: CalendarGuestLinkStatus;
  occurredAt: string;
  actorUserId?: string;
}

const SCHEDULING_REVIEW_BOUNDARY = {
  approvalCreatesTask: false,
  approvalReschedulesEvent: false,
  approvalCancelsReminder: false,
  approvalCreatesTimeEntry: false,
} as const;

export function normalizeCalendarMeetingLinkState(
  input: CalendarMeetingLinkStateInput = {},
): Required<Pick<CalendarMeetingLinkStateInput, "mode">> &
  Pick<CalendarMeetingLinkStateInput, "url" | "roomId" | "providerKey"> {
  const mode = input.mode ?? "blank";
  if (mode === "blank") {
    return { mode: "blank" };
  }
  return {
    mode,
    url: input.url,
    roomId: input.roomId,
    providerKey: input.providerKey,
  };
}

export class UnsupportedCalendarPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedCalendarPayloadError";
  }
}

export class InvalidCalendarPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCalendarPayloadError";
  }
}

export class InvalidCalendarMeetingTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCalendarMeetingTransitionError";
  }
}

export function formatUtcDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function assertValidTransitionDate(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new InvalidCalendarMeetingTransitionError(`${label} must be a valid date-time`);
  }
}

export function transitionCalendarMeetingSessionStatus(
  session: CalendarMeetingSessionRecord,
  input: CalendarMeetingSessionTransitionInput,
): CalendarMeetingSessionRecord {
  assertValidTransitionDate(input.occurredAt, "occurredAt");
  const allowed = SESSION_STATUS_TRANSITIONS[session.status];
  if (!allowed.includes(input.status)) {
    throw new InvalidCalendarMeetingTransitionError(
      `Calendar meeting session cannot transition from ${session.status} to ${input.status}`,
    );
  }

  return {
    ...session,
    status: input.status,
    updatedAt: input.occurredAt,
    updatedByUserId: input.actorUserId,
    endedAt: input.status === "ended" ? (session.endedAt ?? input.occurredAt) : session.endedAt,
  };
}

export function transitionCalendarGuestLinkStatus(
  link: CalendarGuestLinkRecord,
  input: CalendarGuestLinkTransitionInput,
): CalendarGuestLinkRecord {
  assertValidTransitionDate(input.occurredAt, "occurredAt");
  const allowed = GUEST_LINK_STATUS_TRANSITIONS[link.status];
  if (!allowed.includes(input.status)) {
    throw new InvalidCalendarMeetingTransitionError(
      `Calendar guest link cannot transition from ${link.status} to ${input.status}`,
    );
  }
  if (input.status !== "revoked" && Date.parse(link.expiresAt) <= Date.parse(input.occurredAt)) {
    throw new InvalidCalendarMeetingTransitionError("Calendar guest link has expired");
  }

  const updated: CalendarGuestLinkRecord = {
    ...link,
    status: input.status,
    updatedAt: input.occurredAt,
    checkedInAt:
      input.status === "waiting" ? (link.checkedInAt ?? input.occurredAt) : link.checkedInAt,
    revokedAt: input.status === "revoked" ? (link.revokedAt ?? input.occurredAt) : link.revokedAt,
    admittedAt:
      input.status === "admitted" ? (link.admittedAt ?? input.occurredAt) : link.admittedAt,
    deniedAt: input.status === "denied" ? (link.deniedAt ?? input.occurredAt) : link.deniedAt,
  };
  updated.updatedByUserId = input.actorUserId;
  return updated;
}

function compareCalendarSchedulingRequests(
  left: CalendarSchedulingRequestRecord,
  right: CalendarSchedulingRequestRecord,
): number {
  const leftTime = Date.parse(left.requestedDueAt ?? left.requestedStartsAt ?? left.createdAt) || 0;
  const rightTime =
    Date.parse(right.requestedDueAt ?? right.requestedStartsAt ?? right.createdAt) || 0;
  return leftTime === rightTime ? left.id.localeCompare(right.id) : leftTime - rightTime;
}

function reminderSummary(
  request: CalendarSchedulingRequestRecord,
  event?: CalendarEventRecord,
): CalendarSchedulingRequestSummary["reminderSummary"] {
  const sameMatterReminders = (event?.reminders ?? []).filter(
    (reminder) => reminder.matterId === request.matterId && !reminder.deletedAt,
  );
  const pending = sameMatterReminders
    .filter((reminder) => reminder.status === "pending")
    .sort((left, right) => {
      const remindAtDifference = Date.parse(left.remindAt) - Date.parse(right.remindAt);
      return remindAtDifference === 0 ? left.id.localeCompare(right.id) : remindAtDifference;
    });
  return {
    posture: request.reminderPosture,
    pendingCount: pending.length,
    acknowledgedCount: sameMatterReminders.filter((reminder) => reminder.status === "acknowledged")
      .length,
    nextRemindAt: pending[0]?.remindAt,
  };
}

function timeCaptureCue(
  request: CalendarSchedulingRequestRecord,
  includeTimeCapture: boolean,
): CalendarSchedulingRequestSummary["timeCaptureCue"] {
  if (includeTimeCapture) return request.timeCaptureCue;
  return {
    posture: "none",
    existingTimeEntryCount: 0,
    billable: false,
    redacted: true,
  };
}

export function buildCalendarSchedulingRequestSummaries(input: {
  requests: CalendarSchedulingRequestRecord[];
  events?: CalendarEventRecord[];
  includeTimeCapture?: boolean;
  now?: string;
}): CalendarSchedulingRequestSummary[] {
  const eventsById = new Map(
    (input.events ?? []).map((event): [string, CalendarEventRecord] => [event.id, event]),
  );
  const includeTimeCapture = input.includeTimeCapture ?? false;

  return [...input.requests]
    .sort(compareCalendarSchedulingRequests)
    .map((request): CalendarSchedulingRequestSummary => {
      const event =
        request.calendarEventId &&
        eventsById.get(request.calendarEventId)?.matterId === request.matterId
          ? eventsById.get(request.calendarEventId)
          : undefined;

      return {
        id: request.id,
        matterId: request.matterId,
        kind: request.kind,
        status: request.status,
        title: request.title,
        ownerUserId: request.ownerUserId,
        source: {
          type: request.sourceType,
          label: request.sourceLabel,
        },
        linkedTaskId: request.taskId,
        linkedEvent: event
          ? {
              id: event.id,
              title: event.title,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              status: event.status,
            }
          : undefined,
        linkedReminderId: request.calendarReminderId,
        requestedDueAt: request.requestedDueAt,
        requestedStartsAt: request.requestedStartsAt,
        requestedEndsAt: request.requestedEndsAt,
        reminderSummary: reminderSummary(request, event),
        privacy: {
          visibility: request.privacy,
          clientVisible: false,
        },
        timeCaptureCue: timeCaptureCue(request, includeTimeCapture),
        reviewBoundary: SCHEDULING_REVIEW_BOUNDARY,
        ...(request.status === "needs_review"
          ? {
              reviewAging: buildReviewAgingCue({
                referenceAt: request.createdAt,
                now: input.now,
              }),
            }
          : {}),
        reviewedAt: request.reviewedAt,
        reviewedByUserId: request.reviewedByUserId,
      };
    });
}

export function escapeICalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function unescapeICalendarText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([\\;,])/g, "$1");
}

function escapeICalendarParam(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, " ");
}

function unescapeICalendarParam(value: string): string {
  return value.replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

export function foldICalendarLine(line: string): string {
  if (line.length <= 75) return line;

  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
  }
  chunks.push(remaining);
  return chunks.join("\r\n ");
}

function assertValidEventRange(startsAt: string, endsAt: string): void {
  if (Date.parse(startsAt) >= Date.parse(endsAt)) {
    throw new InvalidCalendarPayloadError("Calendar event start must be before end");
  }
}

export function assertValidCalendarEventRange(startsAt: string, endsAt: string): void {
  assertValidEventRange(startsAt, endsAt);
}

function eventUid(event: CalendarEventRecord): string {
  return event.uid || `${event.id}@open-practice.local`;
}

export function calendarEventEtag(event: CalendarEventRecord): string {
  return `"${event.id}-${event.sequence}-${Date.parse(event.updatedAt)}"`;
}

export function buildCalendarMeetingInvitationBoundary(
  input: CalendarMeetingInvitationBoundaryInput = {},
): CalendarMeetingInvitationBoundary {
  const meetingLinks: CalendarMeetingInvitationBoundary["meetingLinks"] = input.meetingProviderKey
    ? { status: "configured", provider: input.meetingProviderKey }
    : { status: "disabled", reason: "not_configured" };
  const guestAccess: CalendarMeetingInvitationBoundary["guestAccess"] =
    input.meetingProviderKey && input.guestAccessTokenSigningConfigured
      ? { status: "configured", provider: input.meetingProviderKey }
      : {
          status: "disabled",
          reason: input.meetingProviderKey ? "token_signing_not_configured" : "not_configured",
          provider: input.meetingProviderKey,
        };
  const invitationEmail: CalendarMeetingInvitationBoundary["invitationEmail"] =
    input.invitationEmailProviderKey && input.emailQueueConfigured
      ? { status: "configured", provider: input.invitationEmailProviderKey }
      : {
          status: "disabled",
          reason: input.invitationEmailProviderKey
            ? "email_queue_not_configured"
            : "smtp_not_configured",
          provider: input.invitationEmailProviderKey,
        };

  return {
    meetingLinks,
    guestAccess,
    invitationEmail,
  };
}

export function calendarMeetingInvitationBoundaryMetadata(
  boundary: CalendarMeetingInvitationBoundary,
): Record<string, string> {
  const metadata = {
    meetingLinksStatus: boundary.meetingLinks.status,
    meetingLinksReason: boundary.meetingLinks.reason,
    meetingLinksProvider: boundary.meetingLinks.provider,
    guestAccessStatus: boundary.guestAccess.status,
    guestAccessReason: boundary.guestAccess.reason,
    guestAccessProvider: boundary.guestAccess.provider,
    invitationEmailStatus: boundary.invitationEmail.status,
    invitationEmailReason: boundary.invitationEmail.reason,
    invitationEmailProvider: boundary.invitationEmail.provider,
  };
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

export function buildICalendarEvent(event: CalendarEventRecord, generatedAt?: string): string {
  assertValidEventRange(event.startsAt, event.endsAt);
  const stamp = formatUtcDateTime(generatedAt ?? event.updatedAt ?? DEFAULT_DTSTAMP);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeICalendarText(eventUid(event))}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatUtcDateTime(event.startsAt)}`,
    `DTEND:${formatUtcDateTime(event.endsAt)}`,
    `SUMMARY:${escapeICalendarText(event.title)}`,
    `STATUS:${event.status.toUpperCase()}`,
    `SEQUENCE:${event.sequence}`,
    `CREATED:${formatUtcDateTime(event.createdAt)}`,
    `LAST-MODIFIED:${formatUtcDateTime(event.updatedAt)}`,
    `X-OPEN-PRACTICE-FIRM-ID:${escapeICalendarText(event.firmId)}`,
  ];
  if (event.matterId) {
    lines.push(`X-OPEN-PRACTICE-MATTER-ID:${escapeICalendarText(event.matterId)}`);
  }
  if (event.clientContactId) {
    lines.push(`X-OPEN-PRACTICE-CLIENT-CONTACT-ID:${escapeICalendarText(event.clientContactId)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalendarText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICalendarText(event.location)}`);
  }
  for (const attendee of (event.attendees ?? [])
    .filter((candidate) => !candidate.deletedAt)
    .sort((left, right) => left.email.localeCompare(right.email))) {
    lines.push(buildAttendeeLine(attendee));
  }
  lines.push("END:VEVENT");
  return lines.map(foldICalendarLine).join("\r\n");
}

function buildAttendeeLine(attendee: CalendarEventAttendeeRecord): string {
  const role = attendee.role === "optional" ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT";
  const partstat =
    attendee.responseStatus === "needs_action"
      ? "NEEDS-ACTION"
      : attendee.responseStatus.toUpperCase();
  const params = [
    attendee.name ? `CN="${escapeICalendarParam(attendee.name)}"` : undefined,
    `ROLE=${role}`,
    `PARTSTAT=${partstat}`,
  ].filter((param): param is string => Boolean(param));
  return `ATTENDEE;${params.join(";")}:mailto:${escapeICalendarText(attendee.email)}`;
}

export function buildICalendarFeed(input: CalendarFeedInput): string {
  const generatedAt = input.generatedAt ?? DEFAULT_DTSTAMP;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${escapeICalendarText(input.productId ?? DEFAULT_PRODUCT_ID)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalendarText(input.calendarName)}`,
  ];

  for (const event of [...input.events]
    .filter((candidate) => !candidate.deletedAt)
    .sort((left, right) => {
      const startDifference = Date.parse(left.startsAt) - Date.parse(right.startsAt);
      return startDifference === 0 ? left.id.localeCompare(right.id) : startDifference;
    })) {
    lines.push(...buildICalendarEvent(event, generatedAt).split("\r\n"));
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldICalendarLine).join("\r\n")}\r\n`;
}

function unfoldICalendarLines(payload: string): string[] {
  return payload
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else if (line.length > 0) {
        lines.push(line);
      }
      return lines;
    }, []);
}

function parseContentLine(line: string): {
  name: string;
  params: Map<string, string>;
  value: string;
} {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) {
    throw new InvalidCalendarPayloadError("Invalid iCalendar content line");
  }
  const [rawName = "", ...rawParams] = line.slice(0, separatorIndex).split(";");
  const params = new Map<string, string>();
  for (const rawParam of rawParams) {
    const equalsIndex = rawParam.indexOf("=");
    if (equalsIndex <= 0) continue;
    params.set(rawParam.slice(0, equalsIndex).toUpperCase(), rawParam.slice(equalsIndex + 1));
  }
  return {
    name: rawName.toUpperCase(),
    params,
    value: line.slice(separatorIndex + 1),
  };
}

export function isUnsupportedCalendarPropertyName(name: string): boolean {
  return UNSUPPORTED_PROPERTIES.has(name.toUpperCase());
}

export function isUnsupportedCalendarComponentName(name: string): boolean {
  return UNSUPPORTED_COMPONENTS.has(name.toUpperCase());
}

export function assertSupportedICalendarPayload(payload: string): void {
  const lines = unfoldICalendarLines(payload);
  for (const line of lines) {
    const parsed = parseContentLine(line);
    const value = parsed.value.toUpperCase();
    if (parsed.name === "BEGIN" && isUnsupportedCalendarComponentName(value)) {
      throw new UnsupportedCalendarPayloadError(`${value} is not supported`);
    }
    if (
      isUnsupportedCalendarComponentName(parsed.name) ||
      isUnsupportedCalendarPropertyName(parsed.name)
    ) {
      throw new UnsupportedCalendarPayloadError(`${parsed.name} is not supported`);
    }
    if (parsed.name === "METHOD" && !SUPPORTED_METHOD_VALUES.has(value)) {
      throw new UnsupportedCalendarPayloadError(`METHOD:${value} scheduling is not supported`);
    }
  }
}

function parseUtcICalendarDateTime(value: string, property: string): string {
  if (!/^\d{8}T\d{6}Z$/.test(value)) {
    throw new InvalidCalendarPayloadError(`${property} must be a UTC DATE-TIME value`);
  }
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(
    9,
    11,
  )}:${value.slice(11, 13)}:${value.slice(13, 15)}.000Z`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new InvalidCalendarPayloadError(`${property} is not a valid date-time`);
  }
  return iso;
}

export function parseICalendarEvent(payload: string): ParsedCalendarEventInput {
  assertSupportedICalendarPayload(payload);
  const lines = unfoldICalendarLines(payload);
  const beginEventIndexes = lines.reduce<number[]>((indexes, line, index) => {
    const parsed = parseContentLine(line);
    return parsed.name === "BEGIN" && parsed.value.toUpperCase() === "VEVENT"
      ? [...indexes, index]
      : indexes;
  }, []);

  if (beginEventIndexes.length !== 1) {
    throw new InvalidCalendarPayloadError("Exactly one VEVENT is required");
  }
  const beginIndex = beginEventIndexes[0]!;
  const endIndex = lines.findIndex((line, index) => {
    if (index <= beginIndex) return false;
    const parsed = parseContentLine(line);
    return parsed.name === "END" && parsed.value.toUpperCase() === "VEVENT";
  });
  if (endIndex < 0) {
    throw new InvalidCalendarPayloadError("VEVENT is missing END:VEVENT");
  }

  const values = new Map<string, string>();
  const attendees: ParsedCalendarAttendeeInput[] = [];
  for (const line of lines.slice(beginIndex + 1, endIndex)) {
    const parsed = parseContentLine(line);
    if (parsed.name === "BEGIN" && isUnsupportedCalendarComponentName(parsed.value)) {
      throw new UnsupportedCalendarPayloadError(`${parsed.value.toUpperCase()} is not supported`);
    }
    if (
      isUnsupportedCalendarComponentName(parsed.name) ||
      isUnsupportedCalendarPropertyName(parsed.name)
    ) {
      throw new UnsupportedCalendarPayloadError(`${parsed.name} is not supported`);
    }
    if (parsed.name === "ATTENDEE") {
      attendees.push(parseAttendeeLine(parsed));
    } else if (!values.has(parsed.name)) values.set(parsed.name, parsed.value);
  }

  const uid = values.get("UID");
  const summary = values.get("SUMMARY");
  const dtstart = values.get("DTSTART");
  const dtend = values.get("DTEND");
  if (!uid || !summary || !dtstart || !dtend) {
    throw new InvalidCalendarPayloadError("VEVENT requires UID, SUMMARY, DTSTART, and DTEND");
  }

  const rawStatus = values.get("STATUS")?.toUpperCase() ?? "CONFIRMED";
  if (!SUPPORTED_STATUS_VALUES.has(rawStatus)) {
    throw new InvalidCalendarPayloadError("VEVENT STATUS is not supported");
  }

  const sequence = Number(values.get("SEQUENCE") ?? 0);
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new InvalidCalendarPayloadError("VEVENT SEQUENCE must be a non-negative integer");
  }

  const startsAt = parseUtcICalendarDateTime(dtstart, "DTSTART");
  const endsAt = parseUtcICalendarDateTime(dtend, "DTEND");
  assertValidEventRange(startsAt, endsAt);

  return {
    uid: unescapeICalendarText(uid),
    title: unescapeICalendarText(summary),
    startsAt,
    endsAt,
    description: values.has("DESCRIPTION")
      ? unescapeICalendarText(values.get("DESCRIPTION")!)
      : undefined,
    location: values.has("LOCATION") ? unescapeICalendarText(values.get("LOCATION")!) : undefined,
    status: rawStatus.toLowerCase() as CalendarEventStatus,
    sequence,
    attendees,
  };
}

function parseAttendeeLine(parsed: {
  params: Map<string, string>;
  value: string;
}): ParsedCalendarAttendeeInput {
  if (!parsed.value.toLowerCase().startsWith("mailto:")) {
    throw new InvalidCalendarPayloadError("ATTENDEE must use a mailto value");
  }
  const email = unescapeICalendarText(parsed.value.slice("mailto:".length)).trim();
  if (!email || !email.includes("@")) {
    throw new InvalidCalendarPayloadError("ATTENDEE requires an email address");
  }

  const rawRole = parsed.params.get("ROLE")?.toUpperCase() ?? "REQ-PARTICIPANT";
  if (!SUPPORTED_ATTENDEE_ROLES.has(rawRole)) {
    throw new InvalidCalendarPayloadError("ATTENDEE ROLE is not supported");
  }
  const rawPartstat = parsed.params.get("PARTSTAT")?.toUpperCase() ?? "NEEDS-ACTION";
  if (!SUPPORTED_ATTENDEE_PARTSTATS.has(rawPartstat)) {
    throw new InvalidCalendarPayloadError("ATTENDEE PARTSTAT is not supported");
  }

  return {
    name: unescapeICalendarParam(parsed.params.get("CN") ?? email),
    email,
    role: rawRole === "OPT-PARTICIPANT" ? "optional" : "required",
    responseStatus:
      rawPartstat === "NEEDS-ACTION"
        ? "needs_action"
        : (rawPartstat.toLowerCase() as CalendarAttendeeResponseStatus),
  };
}
