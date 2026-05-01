import { describe, expect, it } from "vitest";
import {
  InvalidCalendarPayloadError,
  UnsupportedCalendarPayloadError,
  buildICalendarFeed,
  calendarEventEtag,
  parseICalendarEvent,
} from "./calendar.js";
import type { CalendarEventRecord } from "./models.js";

const events: CalendarEventRecord[] = [
  {
    id: "calendar-event-002",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    uid: "calendar-event-002@open-practice.local",
    title: "Follow-up, filing; and review\\prep",
    startsAt: "2026-05-02T17:00:00.000Z",
    endsAt: "2026-05-02T18:00:00.000Z",
    status: "confirmed",
    sequence: 2,
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:10:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
  },
  {
    id: "calendar-event-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    uid: "calendar-event-001@open-practice.local",
    title: "Client conference\nSynthetic notes only",
    startsAt: "2026-05-01T16:00:00.000Z",
    endsAt: "2026-05-01T16:30:00.000Z",
    description: "Prepare documents, questions; and next steps.",
    location: "Room 2",
    status: "tentative",
    sequence: 1,
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: "2026-04-30T12:05:00.000Z",
    createdByUserId: "user-licensee",
    updatedByUserId: "user-licensee",
  },
];

describe("iCalendar feed serialization", () => {
  it("builds deterministic UTC VEVENT output with escaped text", () => {
    const feed = buildICalendarFeed({
      events,
      calendarName: "Morgan tenancy dispute",
      generatedAt: "2026-04-30T12:00:00.000Z",
    });

    expect(feed).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(feed).toContain("DTSTAMP:20260430T120000Z");
    expect(feed).toContain("DTSTART:20260501T160000Z");
    expect(feed).toContain("SUMMARY:Client conference\\nSynthetic notes only");
    expect(feed).toContain("DESCRIPTION:Prepare documents\\, questions\\; and next steps.");
    expect(feed).toContain("LOCATION:Room 2");
    expect(feed).toContain("STATUS:TENTATIVE");
    expect(feed).toContain("SEQUENCE:1");
    expect(feed).toContain("SUMMARY:Follow-up\\, filing\\; and review\\\\prep");
    expect(feed.indexOf("calendar-event-001")).toBeLessThan(feed.indexOf("calendar-event-002"));
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("parses supported single UTC VEVENT payloads", () => {
    const parsed = parseICalendarEvent(`BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:ios-event-001@example.test\r
DTSTAMP:20260430T120000Z\r
DTSTART:20260510T160000Z\r
DTEND:20260510T170000Z\r
SUMMARY:Client call\\, filing review\r
DESCRIPTION:Line one\\nLine two\r
LOCATION:Office\\; Room 3\r
STATUS:CONFIRMED\r
SEQUENCE:4\r
LAST-MODIFIED:20260430T121000Z\r
END:VEVENT\r
END:VCALENDAR\r
`);

    expect(parsed).toEqual({
      uid: "ios-event-001@example.test",
      title: "Client call, filing review",
      startsAt: "2026-05-10T16:00:00.000Z",
      endsAt: "2026-05-10T17:00:00.000Z",
      description: "Line one\nLine two",
      location: "Office; Room 3",
      status: "confirmed",
      sequence: 4,
    });
  });

  it("rejects invalid ranges", () => {
    expect(() =>
      parseICalendarEvent(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:bad-range
DTSTART:20260510T170000Z
DTEND:20260510T160000Z
SUMMARY:Bad range
END:VEVENT
END:VCALENDAR`),
    ).toThrow(InvalidCalendarPayloadError);
  });

  it("rejects unsupported recurrence, attendee, alarm, task, free-busy, and scheduling payloads", () => {
    const supportedEvent = `BEGIN:VEVENT
UID:unsupported
DTSTART:20260510T160000Z
DTEND:20260510T170000Z
SUMMARY:Unsupported payload
END:VEVENT`;
    const unsupportedPayloads = [
      `BEGIN:VCALENDAR
${supportedEvent.replace("END:VEVENT", "RRULE:FREQ=DAILY\nEND:VEVENT")}
END:VCALENDAR`,
      `BEGIN:VCALENDAR
${supportedEvent.replace("END:VEVENT", "ATTENDEE:mailto:person@example.test\nEND:VEVENT")}
END:VCALENDAR`,
      `BEGIN:VCALENDAR
${supportedEvent.replace(
  "END:VEVENT",
  "BEGIN:VALARM\nTRIGGER:-PT15M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT",
)}
END:VCALENDAR`,
      `BEGIN:VCALENDAR
BEGIN:VTODO
UID:task
SUMMARY:Task
END:VTODO
END:VCALENDAR`,
      `BEGIN:VCALENDAR
BEGIN:VFREEBUSY
UID:busy
FREEBUSY:20260510T160000Z/20260510T170000Z
END:VFREEBUSY
END:VCALENDAR`,
      `BEGIN:VCALENDAR
METHOD:REQUEST
${supportedEvent}
END:VCALENDAR`,
    ];

    for (const payload of unsupportedPayloads) {
      expect(() => parseICalendarEvent(payload)).toThrow(UnsupportedCalendarPayloadError);
    }
  });

  it("builds stable etags from event version data", () => {
    expect(calendarEventEtag(events[0]!)).toBe('"calendar-event-002-2-1777551000000"');
  });
});
