import { describe, expect, it } from "vitest";
import {
  InvalidCalendarPayloadError,
  InvalidCalendarMeetingTransitionError,
  UnsupportedCalendarPayloadError,
  buildCalendarSchedulingRequestSummaries,
  buildCalendarMeetingInvitationBoundary,
  buildICalendarFeed,
  calendarMeetingInvitationBoundaryMetadata,
  calendarEventEtag,
  normalizeCalendarMeetingLinkState,
  parseICalendarEvent,
  transitionCalendarGuestLinkStatus,
  transitionCalendarMeetingSessionStatus,
} from "./calendar.js";
import type {
  CalendarEventRecord,
  CalendarGuestLinkRecord,
  CalendarMeetingSessionRecord,
  CalendarSchedulingRequestRecord,
} from "./models.js";

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
    attendees: [
      {
        id: "calendar-attendee-001",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-001",
        name: "Ada Morgan",
        email: "ada.morgan@example.test",
        role: "required",
        responseStatus: "accepted",
        invitationStatus: "queued",
        invitedAt: "2026-04-30T12:04:00.000Z",
        invitationEmailId: "email-001",
        invitationJobId: "job-001",
        createdAt: "2026-04-30T12:00:00.000Z",
        updatedAt: "2026-04-30T12:04:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
    ],
  },
];

describe("calendar scheduling request summaries", () => {
  it("keeps review requests matter-scoped and redacts time-capture cues when access is absent", () => {
    const request: CalendarSchedulingRequestRecord = {
      id: "calendar-scheduling-request-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "deadline_review",
      status: "needs_review",
      title: "Review filing deadline posture",
      taskId: "task-deadline-001",
      calendarEventId: "calendar-event-001",
      ownerUserId: "user-licensee",
      sourceType: "task_deadline",
      sourceId: "task-deadline-001",
      sourceLabel: "Review tenant evidence package",
      requestedDueAt: "2026-05-01T19:00:00.000Z",
      reminderPosture: "dashboard_pending",
      privacy: "staff_only",
      timeCaptureCue: {
        posture: "draft_available",
        suggestedMinutes: 30,
        existingTimeEntryCount: 1,
        billable: true,
      },
      createdAt: "2026-04-30T12:00:00.000Z",
      updatedAt: "2026-04-30T12:00:00.000Z",
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
    };
    const event: CalendarEventRecord = {
      ...events[1]!,
      reminders: [
        {
          id: "calendar-reminder-001",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          eventId: "calendar-event-001",
          remindAt: "2026-05-01T15:30:00.000Z",
          channel: "dashboard",
          status: "pending",
          note: "Private reminder note stays outside scheduling summaries.",
          createdAt: "2026-04-30T12:00:00.000Z",
          updatedAt: "2026-04-30T12:00:00.000Z",
          createdByUserId: "user-licensee",
          updatedByUserId: "user-licensee",
        },
      ],
    };

    expect(
      buildCalendarSchedulingRequestSummaries({
        requests: [request],
        events: [event],
        includeTimeCapture: false,
      }),
    ).toEqual([
      expect.objectContaining({
        id: "calendar-scheduling-request-001",
        source: { type: "task_deadline", label: "Review tenant evidence package" },
        linkedEvent: expect.objectContaining({ id: "calendar-event-001" }),
        reminderSummary: expect.objectContaining({
          pendingCount: 1,
          nextRemindAt: "2026-05-01T15:30:00.000Z",
        }),
        timeCaptureCue: {
          posture: "none",
          existingTimeEntryCount: 0,
          billable: false,
          redacted: true,
        },
        reviewBoundary: {
          approvalCreatesTask: false,
          approvalReschedulesEvent: false,
          approvalCancelsReminder: false,
          approvalCreatesTimeEntry: false,
        },
      }),
    ]);
    expect(
      JSON.stringify(
        buildCalendarSchedulingRequestSummaries({
          requests: [request],
          events: [event],
          includeTimeCapture: false,
        }),
      ),
    ).not.toContain("Private reminder note");
  });
});

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
    expect(feed.replace(/\r\n /g, "")).toContain(
      'ATTENDEE;CN="Ada Morgan";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:ada.morgan@example.test',
    );
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
ATTENDEE;CN="Ada Morgan";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:ada.morgan@example.test\r
ATTENDEE;CN="Optional Reviewer";ROLE=OPT-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:reviewer@example.test\r
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
      attendees: [
        {
          name: "Ada Morgan",
          email: "ada.morgan@example.test",
          role: "required",
          responseStatus: "accepted",
        },
        {
          name: "Optional Reviewer",
          email: "reviewer@example.test",
          role: "optional",
          responseStatus: "needs_action",
        },
      ],
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

  it("rejects unsupported recurrence, alarm, task, free-busy, and scheduling payloads", () => {
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

  it("keeps meeting invitation boundaries disabled unless providers are configured", () => {
    const disabled = buildCalendarMeetingInvitationBoundary();
    expect(disabled).toEqual({
      meetingLinks: { status: "disabled", reason: "not_configured" },
      guestAccess: { status: "disabled", reason: "not_configured", provider: undefined },
      invitationEmail: { status: "disabled", reason: "smtp_not_configured", provider: undefined },
    });

    const configured = buildCalendarMeetingInvitationBoundary({
      meetingProviderKey: "synthetic-meeting",
      guestAccessTokenSigningConfigured: true,
      invitationEmailProviderKey: "mailpit",
      emailQueueConfigured: true,
    });
    expect(configured).toEqual({
      meetingLinks: { status: "configured", provider: "synthetic-meeting" },
      guestAccess: { status: "configured", provider: "synthetic-meeting" },
      invitationEmail: { status: "configured", provider: "mailpit" },
    });
    expect(calendarMeetingInvitationBoundaryMetadata(configured)).toMatchObject({
      meetingLinksStatus: "configured",
      guestAccessStatus: "configured",
      invitationEmailStatus: "configured",
    });
  });

  it("normalizes provider-neutral meeting link state", () => {
    expect(normalizeCalendarMeetingLinkState()).toEqual({ mode: "blank" });
    expect(
      normalizeCalendarMeetingLinkState({
        mode: "external_url",
        url: "https://meet.example.test/rooms/external-001",
      }),
    ).toEqual({
      mode: "external_url",
      url: "https://meet.example.test/rooms/external-001",
      roomId: undefined,
      providerKey: undefined,
    });
    expect(
      normalizeCalendarMeetingLinkState({
        mode: "hosted_webrtc",
        url: "https://meet.example.test/rooms/calendar-room-001",
        roomId: "calendar-room-001",
        providerKey: "synthetic-meeting",
      }),
    ).toEqual({
      mode: "hosted_webrtc",
      url: "https://meet.example.test/rooms/calendar-room-001",
      roomId: "calendar-room-001",
      providerKey: "synthetic-meeting",
    });
  });

  it("transitions hosted meeting sessions through lobby and terminal states", () => {
    const session: CalendarMeetingSessionRecord = {
      id: "meeting-session-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: "calendar-event-001",
      status: "lobby_closed",
      retentionUntil: "2026-08-03T16:00:00.000Z",
      createdAt: "2026-05-03T16:00:00.000Z",
      updatedAt: "2026-05-03T16:00:00.000Z",
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: { synthetic: true },
    };

    const opened = transitionCalendarMeetingSessionStatus(session, {
      status: "lobby_open",
      occurredAt: "2026-05-03T16:05:00.000Z",
      actorUserId: "user-licensee",
    });
    expect(opened).toMatchObject({
      status: "lobby_open",
      updatedAt: "2026-05-03T16:05:00.000Z",
      updatedByUserId: "user-licensee",
    });

    const ended = transitionCalendarMeetingSessionStatus(opened, {
      status: "ended",
      occurredAt: "2026-05-03T17:00:00.000Z",
      actorUserId: "user-licensee",
    });
    expect(ended).toMatchObject({
      status: "ended",
      endedAt: "2026-05-03T17:00:00.000Z",
    });
    expect(() =>
      transitionCalendarMeetingSessionStatus(ended, {
        status: "lobby_open",
        occurredAt: "2026-05-03T17:05:00.000Z",
        actorUserId: "user-licensee",
      }),
    ).toThrow(InvalidCalendarMeetingTransitionError);
  });

  it("transitions hashed guest links without recovering raw tokens", () => {
    const link: CalendarGuestLinkRecord = {
      id: "guest-link-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      eventId: "calendar-event-001",
      sessionId: "meeting-session-001",
      tokenHash: "hmac-sha256:synthetic-token-hash",
      status: "issued",
      expiresAt: "2026-05-03T18:00:00.000Z",
      retentionUntil: "2026-08-03T16:00:00.000Z",
      createdAt: "2026-05-03T16:00:00.000Z",
      updatedAt: "2026-05-03T16:00:00.000Z",
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: {},
    };

    const waiting = transitionCalendarGuestLinkStatus(link, {
      status: "waiting",
      occurredAt: "2026-05-03T16:10:00.000Z",
      actorUserId: "user-licensee",
    });
    expect(waiting).toMatchObject({
      status: "waiting",
      tokenHash: "hmac-sha256:synthetic-token-hash",
      checkedInAt: "2026-05-03T16:10:00.000Z",
    });
    expect(waiting).not.toHaveProperty("token");

    const admitted = transitionCalendarGuestLinkStatus(waiting, {
      status: "admitted",
      occurredAt: "2026-05-03T16:12:00.000Z",
      actorUserId: "user-licensee",
    });
    expect(admitted).toMatchObject({
      status: "admitted",
      admittedAt: "2026-05-03T16:12:00.000Z",
    });

    expect(() =>
      transitionCalendarGuestLinkStatus(admitted, {
        status: "waiting",
        occurredAt: "2026-05-03T16:13:00.000Z",
        actorUserId: "user-licensee",
      }),
    ).toThrow(InvalidCalendarMeetingTransitionError);
    expect(() =>
      transitionCalendarGuestLinkStatus(link, {
        status: "waiting",
        occurredAt: "2026-05-03T18:00:00.000Z",
        actorUserId: "user-licensee",
      }),
    ).toThrow(InvalidCalendarMeetingTransitionError);

    const revoked = transitionCalendarGuestLinkStatus(admitted, {
      status: "revoked",
      occurredAt: "2026-05-03T16:20:00.000Z",
      actorUserId: "user-licensee",
    });
    expect(revoked).toMatchObject({
      status: "revoked",
      revokedAt: "2026-05-03T16:20:00.000Z",
    });
  });
});
