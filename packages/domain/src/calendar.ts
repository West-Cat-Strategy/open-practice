import type { CalendarEventRecord, CalendarEventStatus } from "./models.js";

const DEFAULT_PRODUCT_ID = "-//Open Practice//Matter Calendar//EN";
const DEFAULT_DTSTAMP = "1970-01-01T00:00:00.000Z";
const SUPPORTED_STATUS_VALUES = new Set(["CONFIRMED", "TENTATIVE", "CANCELLED"]);
const UNSUPPORTED_PROPERTIES = new Set([
  "ATTENDEE",
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

function eventUid(event: CalendarEventRecord): string {
  return event.uid || `${event.id}@open-practice.local`;
}

export function calendarEventEtag(event: CalendarEventRecord): string {
  return `"${event.id}-${event.sequence}-${Date.parse(event.updatedAt)}"`;
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
    `X-OPEN-PRACTICE-MATTER-ID:${escapeICalendarText(event.matterId)}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalendarText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICalendarText(event.location)}`);
  }
  lines.push("END:VEVENT");
  return lines.map(foldICalendarLine).join("\r\n");
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

function parseContentLine(line: string): { name: string; value: string } {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) {
    throw new InvalidCalendarPayloadError("Invalid iCalendar content line");
  }
  const rawName = line.slice(0, separatorIndex).split(";")[0] ?? "";
  return {
    name: rawName.toUpperCase(),
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
    if (!values.has(parsed.name)) values.set(parsed.name, parsed.value);
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
  };
}
