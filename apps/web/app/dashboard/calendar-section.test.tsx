import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarDashboardResponse } from "../_features/calendar/models";
import type { CalendarRadarBuckets } from "../calendar-dashboard";
import { CalendarSection } from "./calendar-section";

type DashboardCalendarEvent = CalendarDashboardResponse["eventsByMatterId"][string][number];

const syntheticEvent: DashboardCalendarEvent = {
  id: "event_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  uid: "event_synthetic@example.test",
  title: "Synthetic hearing",
  startsAt: "2035-06-06T16:00:00.000Z",
  endsAt: "2035-06-06T17:00:00.000Z",
  location: "Virtual room",
  status: "confirmed",
  sequence: 0,
  meetingLinkMode: "blank",
  createdAt: "2026-06-06T00:00:00.000Z",
  updatedAt: "2026-06-06T00:00:00.000Z",
  createdByUserId: "user_synthetic",
  updatedByUserId: "user_synthetic",
  attendees: [
    {
      id: "attendee_synthetic",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      eventId: "event_synthetic",
      name: "Synthetic Attendee",
      email: "attendee@example.test",
      role: "required",
      responseStatus: "needs_action",
      invitationStatus: "not_sent",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
      createdByUserId: "user_synthetic",
      updatedByUserId: "user_synthetic",
    },
  ],
  reminders: [],
  meetingInvitationBoundary: {
    meetingLinks: { status: "disabled", reason: "not_configured" },
    guestAccess: { status: "disabled", reason: "token_signing_not_configured" },
    invitationEmail: { status: "disabled", reason: "smtp_not_configured" },
  },
};

const calendarBuckets: CalendarRadarBuckets = {
  overdue: [],
  nextSevenDays: [syntheticEvent],
  nextThirtyDays: [],
  tentative: [],
  cancelled: [],
};

function noop(): void {}

describe("CalendarSection", () => {
  it("renders calendar operations without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(CalendarSection, {
        activeCalendarBuckets: calendarBuckets,
        activeCalendarEvents: [syntheticEvent],
        activeCalendarLinks: {
          caldavUrl: "https://calendar.example.test/caldav/matter_synthetic",
          subscriptionUrl: "https://calendar.example.test/feed/matter_synthetic.ics",
        },
        activeCalendarSchedulingRequests: [],
        activeCalendarScope: "matter",
        activeMatterNumber: "OP-2026-001",
        addingCalendarAttendee: false,
        addingCalendarReminder: false,
        calendarAttendeeEmail: "attendee@example.test",
        calendarAttendeeName: "Synthetic Attendee",
        calendarAttendeeRole: "required",
        calendarCredentialLabel: "iOS Calendar",
        calendarCredentialStatus: "No calendar app passwords are active.",
        calendarCredentials: [],
        calendarEventDescription: "",
        calendarEventEndsAt: "2035-06-06T10:00",
        calendarEventLifecycleStatus: "Calendar events have not changed.",
        calendarEventLocation: "",
        calendarEventStartsAt: "2035-06-06T09:00",
        calendarEventStatusValue: "confirmed",
        calendarEventTitle: "Synthetic hearing",
        calendarGuestSessionSecret: null,
        calendarGuestSessionStatus: "Guest sessions have not changed.",
        calendarGuestSessionsByEventId: {},
        calendarMeetingLinkModesByEventId: {},
        calendarMeetingLinkUrlsByEventId: {},
        calendarMeetingStatus: "Meeting attendees have not changed.",
        calendarOneTimeSecret: null,
        calendarReminderAt: "2035-06-05T09:00",
        calendarReminderNote: "",
        calendarReminderStatus: "Reminder state has not changed.",
        calendarReminderStatusValue: "pending",
        calendarClientContactId: "",
        calendarClientOptions: [],
        cancelingCalendarEventId: "",
        creatingCalendarCredential: false,
        creatingCalendarEvent: false,
        creatingCalendarGuestSessionEventId: "",
        pendingDeliveryConfirmation: null,
        removingCalendarAttendeeId: "",
        removingCalendarReminderId: "",
        revokingCalendarCredentialId: "",
        selectedCalendarMeetingEvent: syntheticEvent,
        selectedCalendarReminderEvent: syntheticEvent,
        sendingCalendarInvitationsEventId: "",
        matterCalendarControlsEnabled: true,
        updatingCalendarEventId: "",
        updatingCalendarGuestSessionKey: "",
        updatingCalendarMeetingLinkEventId: "",
        updatingCalendarReminderId: "",
        onAddCalendarAttendee: noop,
        onAddCalendarReminder: noop,
        onCancelCalendarEvent: noop,
        onCancelPendingDeliveryConfirmation: noop,
        onConfirmPendingDelivery: noop,
        onControlCalendarGuestSession: noop,
        onCreateCalendarCredential: noop,
        onCreateCalendarEvent: noop,
        onCreateCalendarGuestSession: noop,
        onIssueCalendarGuestLink: noop,
        onOpenCalendarInvitationConfirmation: noop,
        onRemoveCalendarAttendee: noop,
        onRemoveCalendarReminder: noop,
        onRescheduleCalendarEvent: noop,
        onRevokeCalendarCredential: noop,
        onSetCalendarAttendeeEmail: noop,
        onSetCalendarAttendeeName: noop,
        onSetCalendarAttendeeRole: noop,
        onSetCalendarScope: noop,
        onSetCalendarClientContactId: noop,
        onSetCalendarCredentialLabel: noop,
        onSetCalendarEventDescription: noop,
        onSetCalendarEventEndsAt: noop,
        onSetCalendarEventLocation: noop,
        onSetCalendarEventStartsAt: noop,
        onSetCalendarEventStatusValue: noop,
        onSetCalendarEventTitle: noop,
        onSetCalendarMeetingEventId: noop,
        onSetCalendarMeetingLinkMode: noop,
        onSetCalendarMeetingLinkUrl: noop,
        onSetCalendarReminderAt: noop,
        onSetCalendarReminderEventId: noop,
        onSetCalendarReminderNote: noop,
        onSetCalendarReminderStatusValue: noop,
        onUpdateCalendarGuestLink: noop,
        onUpdateCalendarMeetingLink: noop,
        onUpdateCalendarReminder: noop,
      }),
    );

    expect(html).toContain('class="activity-grid calendar-radar-grid"');
    expect(html).toContain("Deadline radar");
    expect(html).toContain("No scheduling request records for this matter.");
    expect(html).toContain("Calendar events");
    expect(html).toContain("OP-2026-001");
    expect(html).toContain("Synthetic hearing");
    expect(html).toContain("Meeting link");
    expect(html).toContain("Save link");
    expect(html).toContain("Add attendee");
    expect(html).toContain("Calendar sync");
    expect(html).toContain("No calendar app passwords have been created.");
  });
});
