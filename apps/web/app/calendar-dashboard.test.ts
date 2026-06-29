import { describe, expect, it } from "vitest";
import type {
  CalendarEventRecord,
  CalendarSchedulingRequestSummary,
} from "@open-practice/domain/calendar-models";
import {
  buildCalendarSchedulingRequestPayload,
  describeCalendarEventHandoff,
  describeReviewAgingCue,
  describeCalendarSchedulingRequestHandoff,
} from "./calendar-dashboard";

function calendarEvent(overrides: Partial<CalendarEventRecord> = {}): CalendarEventRecord {
  return {
    id: "calendar-event-synthetic-001",
    firmId: "firm-synthetic",
    matterId: "matter-synthetic-001",
    uid: "calendar-event-synthetic-001@example.test",
    title: "Synthetic client conference",
    startsAt: "2026-06-24T15:00:00.000Z",
    endsAt: "2026-06-24T15:30:00.000Z",
    status: "confirmed",
    sequence: 0,
    meetingLinkMode: "external_url",
    meetingLinkUrl: "https://meet.example.test/synthetic-room",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    createdByUserId: "user-synthetic",
    updatedByUserId: "user-synthetic",
    attendees: [
      {
        id: "calendar-attendee-synthetic-001",
        firmId: "firm-synthetic",
        matterId: "matter-synthetic-001",
        eventId: "calendar-event-synthetic-001",
        name: "Synthetic Client",
        email: "client@example.test",
        role: "required",
        responseStatus: "needs_action",
        invitationStatus: "not_sent",
        createdAt: "2026-06-20T10:00:00.000Z",
        updatedAt: "2026-06-20T10:00:00.000Z",
        createdByUserId: "user-synthetic",
        updatedByUserId: "user-synthetic",
      },
    ],
    ...overrides,
  };
}

function schedulingRequest(
  overrides: Partial<CalendarSchedulingRequestSummary> = {},
): CalendarSchedulingRequestSummary {
  return {
    id: "calendar-scheduling-request-synthetic-001",
    matterId: "matter-synthetic-001",
    kind: "event_scheduling",
    status: "needs_review",
    title: "Review client meeting window",
    source: { type: "calendar_event", label: "Client conference" },
    requestedStartsAt: "2026-06-24T15:00:00.000Z",
    requestedEndsAt: "2026-06-24T15:30:00.000Z",
    reminderSummary: {
      posture: "dashboard_pending",
      pendingCount: 0,
      acknowledgedCount: 0,
    },
    privacy: { visibility: "staff_only", clientVisible: false },
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
    ...overrides,
  };
}

describe("calendar staff handoff helpers", () => {
  it("describes confirmed invite handoff without enabling public booking or native media", () => {
    expect(describeCalendarEventHandoff(calendarEvent())).toMatchObject({
      label: "handoff ready",
      action: "send_confirmed_invites",
      publicBookingEnabled: false,
      providerSyncEnabled: false,
      nativeMediaEnabled: false,
    });
  });

  it("keeps scheduling requests review-only until staff links existing records", () => {
    expect(describeCalendarSchedulingRequestHandoff(schedulingRequest())).toMatchObject({
      label: "review needed",
      action: "review_request",
      tone: "risk",
      publicBookingEnabled: false,
      providerSyncEnabled: false,
      nativeMediaEnabled: false,
    });
    expect(
      describeCalendarSchedulingRequestHandoff(
        schedulingRequest({
          status: "scheduled",
          linkedEvent: {
            id: "calendar-event-synthetic-001",
            title: "Synthetic client conference",
            startsAt: "2026-06-24T15:00:00.000Z",
            endsAt: "2026-06-24T15:30:00.000Z",
            status: "confirmed",
          },
        }),
      ),
    ).toMatchObject({
      label: "existing event linked",
      action: "linked_existing_event",
    });
  });

  it("describes review-aging cues without enabling automatic scheduling actions", () => {
    expect(
      describeReviewAgingCue({
        status: "aging",
        ageHours: 24,
        referenceAt: "2026-06-01T12:00:00.000Z",
        agingAfterHours: 24,
        staleAfterHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      }),
    ).toEqual({
      label: "aging review",
      detail:
        "24h waiting since 2026-06-01T12:00:00.000Z; manual review only, no auto-confirm, auto-expiry, or provider sync.",
    });
    expect(
      describeReviewAgingCue({
        status: "stale",
        ageHours: 72,
        referenceAt: "2026-06-01T12:00:00.000Z",
        agingAfterHours: 24,
        staleAfterHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      }),
    ).toMatchObject({ label: "stale review", tone: "risk" });
  });

  it("builds tickler scheduling-request payloads from existing tasks and reminders", () => {
    expect(
      buildCalendarSchedulingRequestPayload({
        type: "task_deadline",
        matterId: "matter-synthetic-001",
        taskId: "task-synthetic-001",
        title: "Review synthetic filing deadline",
        dueAt: "2026-06-24T17:00:00.000Z",
      }),
    ).toEqual({
      matterId: "matter-synthetic-001",
      kind: "deadline_review",
      title: "Review synthetic filing deadline",
      taskId: "task-synthetic-001",
      sourceType: "task_deadline",
      sourceId: "task-synthetic-001",
      sourceLabel: "Review synthetic filing deadline",
      requestedDueAt: "2026-06-24T17:00:00.000Z",
      reminderPosture: "none",
      privacy: "staff_only",
    });
    expect(
      buildCalendarSchedulingRequestPayload({
        type: "calendar_reminder",
        matterId: "matter-synthetic-001",
        calendarEventId: "calendar-event-synthetic-001",
        calendarReminderId: "calendar-reminder-synthetic-001",
        title: "Review synthetic reminder",
        remindAt: "2026-06-24T14:45:00.000Z",
      }),
    ).toEqual({
      matterId: "matter-synthetic-001",
      kind: "reminder_review",
      title: "Review synthetic reminder",
      calendarEventId: "calendar-event-synthetic-001",
      calendarReminderId: "calendar-reminder-synthetic-001",
      sourceType: "calendar_reminder",
      sourceId: "calendar-reminder-synthetic-001",
      sourceLabel: "Review synthetic reminder",
      requestedDueAt: "2026-06-24T14:45:00.000Z",
      reminderPosture: "dashboard_pending",
      privacy: "staff_only",
    });
  });
});
