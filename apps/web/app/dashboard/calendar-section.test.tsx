import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarDashboardResponse } from "../_features/calendar/models";
import type { CalendarRadarBuckets } from "../calendar-dashboard";
import { CalendarSection } from "./calendar-section";

type DashboardCalendarEvent = CalendarDashboardResponse["eventsByMatterId"][string][number];
type CalendarSectionProps = ComponentProps<typeof CalendarSection>;

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

function matterlessCalendarMarkup(
  overrides: Partial<CalendarSectionProps> = {},
  events: DashboardCalendarEvent[] = [],
): string {
  const emptyBuckets: CalendarRadarBuckets = {
    overdue: [],
    nextSevenDays: events,
    nextThirtyDays: [],
    tentative: [],
    cancelled: [],
  };

  return renderToStaticMarkup(
    createElement(CalendarSection, {
      activeCalendarBuckets: emptyBuckets,
      activeCalendarEvents: events,
      activeCalendarSchedulingRequests: [],
      activeCalendarScope: "firm",
      activeMatterNumber: "Firm calendar",
      addingCalendarAttendee: false,
      addingCalendarReminder: false,
      calendarAttendeeEmail: "",
      calendarAttendeeName: "",
      calendarAttendeeRole: "required",
      calendarCredentialLabel: "Desktop Calendar",
      calendarCredentialStatus: "No calendar app passwords are active.",
      calendarCredentials: [],
      calendarEventDescription: "",
      calendarEventEndsAt: "2035-06-06T10:00",
      calendarEventLifecycleStatus: "Calendar events have not changed.",
      calendarEventLocation: "",
      calendarEventStartsAt: "2035-06-06T09:00",
      calendarEventStatusValue: "confirmed",
      calendarEventTitle: "Synthetic planning block",
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
      matterCalendarControlsEnabled: false,
      pendingDeliveryConfirmation: null,
      removingCalendarAttendeeId: "",
      removingCalendarReminderId: "",
      revokingCalendarCredentialId: "",
      sendingCalendarInvitationsEventId: "",
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
      ...overrides,
    }),
  );
}

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

  it("renders firm-scoped zero-matter calendar controls without matter-only affordances", () => {
    const firmEvent = { ...syntheticEvent, matterId: undefined, scope: "firm" as const };
    const html = matterlessCalendarMarkup(
      {
        activeMatterNumber: "Firm calendar",
        activeCalendarScope: "firm",
      },
      [firmEvent],
    );

    expect(html).toContain("Calendar scope");
    expect(html).toContain("Firm calendar");
    expect(html).toContain('<option disabled="" value="matter">Matter</option>');
    expect(html).toContain("Synthetic hearing");
    expect(html).toContain("available after selecting a matter");
    expect(html).toContain("Scheduling request review is available after selecting a matter.");
    expect(html).not.toContain('<span class="field-label">Meeting link</span>');
    expect(html).not.toContain("Send invites");
    expect(html).not.toContain("Add attendee");
    expect(html).not.toContain("Meeting attendees");
    expect(html).not.toContain("Calendar sync");
  });

  it("renders client-scoped zero-matter selection with visible client options", () => {
    const clientEvent = {
      ...syntheticEvent,
      matterId: undefined,
      scope: "client" as const,
      clientContactId: "contact_synthetic_client",
    };
    const html = matterlessCalendarMarkup(
      {
        activeCalendarScope: "client",
        activeMatterNumber: "Client calendar",
        calendarClientContactId: "contact_synthetic_client",
        calendarClientOptions: [
          { id: "contact_synthetic_client", label: "Synthetic Client" },
          { id: "contact_second_client", label: "Second Synthetic Client" },
        ],
      },
      [clientEvent],
    );

    expect(html).toContain("Client calendar");
    expect(html).toContain("<span>Client</span>");
    expect(html).toContain('value="contact_synthetic_client"');
    expect(html).toContain("Synthetic Client");
    expect(html).toContain("Second Synthetic Client");
    expect(html).not.toContain("Meeting attendees");
    expect(html).not.toContain("Calendar sync");
  });

  it("disables the client selector when no matterless client contacts are visible", () => {
    const html = matterlessCalendarMarkup({
      activeCalendarScope: "client",
      activeMatterNumber: "Client calendar",
      calendarClientOptions: [],
    });

    expect(html).toContain("<span>Client</span>");
    expect(html).toContain('<select disabled=""');
    expect(html).toContain("No calendar events are linked to this scope.");
    expect(html).not.toContain("Meeting attendees");
  });
});
