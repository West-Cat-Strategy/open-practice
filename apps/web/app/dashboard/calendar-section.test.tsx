import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalendarDashboardResponse } from "../_features/calendar/models";
import type { CalendarRadarBuckets } from "../calendar-dashboard";
import { CalendarSection } from "./calendar-section";

type DashboardCalendarEvent = CalendarDashboardResponse["eventsByMatterId"][string][number];
type DashboardSchedulingRequest =
  CalendarDashboardResponse["schedulingRequestsByMatterId"][string][number];
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

const syntheticSchedulingRequest: DashboardSchedulingRequest = {
  id: "schedule_request_synthetic",
  matterId: "matter_synthetic",
  kind: "event_scheduling",
  status: "needs_review",
  title: "Synthetic video check-in",
  source: {
    type: "manual",
    label: "Staff note",
  },
  requestedDueAt: "2035-06-06T18:00:00.000Z",
  requestedStartsAt: "2035-06-06T16:00:00.000Z",
  requestedEndsAt: "2035-06-06T17:00:00.000Z",
  reminderSummary: {
    posture: "none",
    pendingCount: 0,
    acknowledgedCount: 0,
  },
  privacy: {
    visibility: "staff_only",
    clientVisible: false,
  },
  timeCaptureCue: {
    posture: "none",
    existingTimeEntryCount: 0,
    billable: false,
  },
  reviewBoundary: {
    approvalCreatesTask: false,
    approvalReschedulesEvent: false,
    approvalCancelsReminder: false,
    approvalCreatesTimeEntry: false,
  },
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
      calendarSchedulingReviewEventIdsByRequestId: {},
      calendarSchedulingReviewStatus: "Scheduling requests have not changed.",
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
      reviewingCalendarSchedulingRequestKey: "",
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
      onReviewCalendarSchedulingRequest: noop,
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
      onSetCalendarSchedulingReviewEventId: noop,
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
    const eventWithStoredLink: DashboardCalendarEvent = {
      ...syntheticEvent,
      meetingLinkMode: "external_url",
      meetingLinkUrl: "https://video.example.test/raw-stored-room",
    };
    const html = renderToStaticMarkup(
      createElement(CalendarSection, {
        activeCalendarBuckets: calendarBuckets,
        activeCalendarEvents: [eventWithStoredLink],
        activeCalendarLinks: {
          caldavUrl: "https://calendar.example.test/caldav/matter_synthetic",
          subscriptionUrl: "https://calendar.example.test/feed/matter_synthetic.ics",
        },
        activeCalendarSchedulingRequests: [syntheticSchedulingRequest],
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
        calendarSchedulingReviewEventIdsByRequestId: {},
        calendarSchedulingReviewStatus: "Scheduling requests have not changed.",
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
        selectedCalendarMeetingEvent: eventWithStoredLink,
        selectedCalendarReminderEvent: eventWithStoredLink,
        sendingCalendarInvitationsEventId: "",
        matterCalendarControlsEnabled: true,
        reviewingCalendarSchedulingRequestKey: "",
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
        onReviewCalendarSchedulingRequest: noop,
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
        onSetCalendarSchedulingReviewEventId: noop,
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
    expect(html).toContain("Synthetic video check-in");
    expect(html).toContain("Existing event");
    expect(html).toContain("Reviewed");
    expect(html).toContain("Dismiss");
    expect(html).toContain("Link event");
    expect(html).toContain("Calendar events");
    expect(html).toContain("OP-2026-001");
    expect(html).toContain("Synthetic hearing");
    expect(html).toContain("Invitation handoff review");
    expect(html).toContain("Hosted lobby blocked");
    expect(html).toContain("Attendees ready");
    expect(html).toContain("Meeting link saved");
    expect(html).toContain("Stored meeting link saved; URL hidden.");
    expect(html).not.toContain("raw-stored-room");
    expect(html).toContain("Guest access disabled");
    expect(html).toContain("Invitation email disabled");
    expect(html).toContain("Meeting link");
    expect(html).toContain("Save link");
    expect(html).toContain("Add attendee");
    expect(html).toContain("Calendar sync");
    expect(html).toContain("No calendar app passwords have been created.");
  });

  it("orders scheduling reviews and renders explicit safe next steps", () => {
    const scheduledRequest: DashboardSchedulingRequest = {
      ...syntheticSchedulingRequest,
      id: "schedule_request_scheduled",
      status: "scheduled",
      title: "Scheduled synthetic review",
      linkedEvent: {
        id: syntheticEvent.id,
        title: syntheticEvent.title,
        startsAt: syntheticEvent.startsAt,
        endsAt: syntheticEvent.endsAt,
        status: syntheticEvent.status,
      },
    };
    const reviewedRequest: DashboardSchedulingRequest = {
      ...syntheticSchedulingRequest,
      id: "schedule_request_reviewed",
      status: "reviewed",
      title: "Reviewed synthetic request",
    };
    const dismissedRequest: DashboardSchedulingRequest = {
      ...syntheticSchedulingRequest,
      id: "schedule_request_dismissed",
      status: "dismissed",
      title: "Dismissed synthetic request",
    };
    const laterNeedsReview: DashboardSchedulingRequest = {
      ...syntheticSchedulingRequest,
      id: "schedule_request_later",
      title: "Later video check-in",
      requestedDueAt: "2035-06-07T18:00:00.000Z",
    };

    const html = matterlessCalendarMarkup(
      {
        activeCalendarScope: "matter",
        activeMatterNumber: "OP-2026-001",
        matterCalendarControlsEnabled: true,
        activeCalendarSchedulingRequests: [
          dismissedRequest,
          scheduledRequest,
          laterNeedsReview,
          reviewedRequest,
          syntheticSchedulingRequest,
        ],
        calendarSchedulingReviewEventIdsByRequestId: {
          [laterNeedsReview.id]: syntheticEvent.id,
        },
      },
      [syntheticEvent],
    );

    expect(html.indexOf("Synthetic video check-in")).toBeLessThan(
      html.indexOf("Later video check-in"),
    );
    expect(html.indexOf("Later video check-in")).toBeLessThan(
      html.indexOf("Scheduled synthetic review"),
    );
    expect(html.indexOf("Scheduled synthetic review")).toBeLessThan(
      html.indexOf("Reviewed synthetic request"),
    );
    expect(html.indexOf("Reviewed synthetic request")).toBeLessThan(
      html.indexOf("Dismissed synthetic request"),
    );
    expect(html).toContain("Event not selected");
    expect(html).toContain("Safe next step");
    expect(html).toContain("Already reviewed");
    expect(html).toContain("no public booking or provider sync runs");

    const noEligibleHtml = matterlessCalendarMarkup(
      {
        activeCalendarScope: "matter",
        activeMatterNumber: "OP-2026-001",
        matterCalendarControlsEnabled: true,
        activeCalendarSchedulingRequests: [syntheticSchedulingRequest],
      },
      [{ ...syntheticEvent, status: "cancelled" }],
    );

    expect(noEligibleHtml).toContain("No eligible event");
    expect(noEligibleHtml).toContain("without creating events");
  });

  it("keeps matterless scheduling review display-only", () => {
    const html = matterlessCalendarMarkup(
      {
        activeCalendarSchedulingRequests: [syntheticSchedulingRequest],
      },
      [syntheticEvent],
    );

    expect(html).toContain("Matter required");
    expect(html).toContain("matterless calendars stay display-only");
    expect(html).not.toContain("Link scheduling request to an existing event");
    expect(html).not.toContain("Mark scheduling request reviewed");
  });

  it("renders guest queue disabled reasons without guest or room identifiers", () => {
    const hostedEvent: DashboardCalendarEvent = {
      ...syntheticEvent,
      meetingLinkMode: "hosted_webrtc",
      meetingLinkUrl: "https://video.example.test/rooms/raw-room-url",
      meetingRoomId: "room_secret_identifier",
      meetingInvitationBoundary: {
        meetingLinks: { status: "configured", provider: "synthetic-meeting" },
        guestAccess: { status: "configured", provider: "synthetic-meeting" },
        invitationEmail: { status: "configured", provider: "mailpit" },
      },
    };
    const html = matterlessCalendarMarkup(
      {
        activeCalendarScope: "matter",
        activeMatterNumber: "OP-2026-001",
        matterCalendarControlsEnabled: true,
        activeCalendarEvents: [hostedEvent],
        calendarGuestSessionsByEventId: {
          [hostedEvent.id]: [
            {
              id: "guest_session_synthetic",
              eventId: hostedEvent.id,
              status: "locked",
              createdAt: "2035-06-06T15:00:00.000Z",
              updatedAt: "2035-06-06T15:30:00.000Z",
              issuedCount: 1,
              waitingCount: 1,
              admittedCount: 0,
              deniedCount: 1,
              revokedCount: 0,
              guests: [
                {
                  id: "guest_private_waiting_identifier",
                  sessionId: "guest_session_synthetic",
                  status: "waiting",
                  checkedInAt: "2035-06-06T15:15:00.000Z",
                  expiresAt: "2035-06-06T16:15:00.000Z",
                },
                {
                  id: "guest_private_denied_identifier",
                  sessionId: "guest_session_synthetic",
                  status: "denied",
                  deniedAt: "2035-06-06T15:25:00.000Z",
                  expiresAt: "2035-06-06T16:10:00.000Z",
                },
              ],
            },
          ],
        },
      },
      [hostedEvent],
    );

    expect(html).toContain("Hosted lobby ready");
    expect(html).toContain("0 blockers");
    expect(html).toContain("Actions disabled: Lobby locked");
    expect(html).not.toContain("guest_private_waiting_identifier");
    expect(html).not.toContain("guest_private_denied_identifier");
    expect(html).not.toContain("room_secret_identifier");
    expect(html).not.toContain("raw-room-url");
    expect(html).not.toContain("synthetic-meeting");
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
    expect(html).toContain("event lifecycle actions are disabled");
    expect(html).toContain("reminder actions are disabled");
    expect(html).toContain("Scheduling request review is available after selecting a matter.");
    expect(html).not.toContain('<span class="field-label">Meeting link</span>');
    expect(html).not.toContain("Reviewed");
    expect(html).not.toContain("Link event");
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
