import { describe, expect, it } from "vitest";
import type {
  AppointmentBookingRequestRecord,
  CalendarSchedulingRequestRecord,
} from "@open-practice/domain";
import {
  recordMemoryAppointmentBookingAgingReviewDecision,
  type MemoryAppointmentBookingStore,
} from "./appointment-booking/memory.js";
import {
  recordMemoryCalendarSchedulingRequestAgingReviewDecision,
  type MemoryCalendarEventStore,
} from "./calendar-events/memory.js";

const appointmentRequest: AppointmentBookingRequestRecord = {
  id: "appointment-booking-request-001",
  firmId: "firm-west-legal",
  profileId: "appointment-booking-profile-001",
  source: "website",
  status: "tentative_hold",
  calendarEventId: "calendar-event-001",
  requesterName: "Synthetic Public Client",
  requesterEmail: "client@example.test",
  requestedStartsAt: "2026-06-01T16:00:00.000Z",
  requestedEndsAt: "2026-06-01T16:30:00.000Z",
  submittedAt: "2026-06-01T15:00:00.000Z",
  metadata: {},
};

const schedulingRequest: CalendarSchedulingRequestRecord = {
  id: "calendar-scheduling-request-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  kind: "event_scheduling",
  status: "needs_review",
  title: "Synthetic scheduling request",
  sourceType: "manual",
  sourceLabel: "Synthetic source",
  requestedStartsAt: "2026-06-01T16:00:00.000Z",
  requestedEndsAt: "2026-06-01T16:30:00.000Z",
  reminderPosture: "none",
  privacy: "staff_only",
  timeCaptureCue: {
    posture: "none",
    existingTimeEntryCount: 0,
    billable: false,
  },
  createdAt: "2026-06-01T15:00:00.000Z",
  updatedAt: "2026-06-01T15:00:00.000Z",
  createdByUserId: "user-licensee",
  updatedByUserId: "user-licensee",
};

describe("calendar aging review repository decisions", () => {
  it("records appointment hold aging decisions without changing hold or event lifecycle", () => {
    const store: MemoryAppointmentBookingStore = {
      appointmentBookingProfiles: [],
      appointmentBookingLinks: [],
      appointmentBookingRequests: [appointmentRequest],
    };

    const updated = recordMemoryAppointmentBookingAgingReviewDecision(store, {
      firmId: "firm-west-legal",
      requestId: appointmentRequest.id,
      decision: "acknowledged",
      decidedAt: "2026-06-04T15:00:00.000Z",
      decidedByUserId: "user-licensee",
      cueStatus: "stale",
      ageHours: 72,
    });

    expect(updated).toMatchObject({
      id: appointmentRequest.id,
      status: "tentative_hold",
      calendarEventId: "calendar-event-001",
      reviewAgingDecision: "acknowledged",
      reviewAgingCueStatus: "stale",
      reviewAgingAgeHours: 72,
    });
    expect(updated).not.toHaveProperty("reviewedAt");
    expect(updated).not.toHaveProperty("reviewedByUserId");
    expect(store.appointmentBookingRequests[0]).toMatchObject({
      status: "tentative_hold",
      calendarEventId: "calendar-event-001",
    });
  });

  it("records scheduling aging decisions without changing review status or linked event state", () => {
    const store: MemoryCalendarEventStore = {
      calendarEvents: [],
      calendarSchedulingRequests: [schedulingRequest],
      calendarMeetingSessions: [],
      calendarGuestLinks: [],
    };

    const updated = recordMemoryCalendarSchedulingRequestAgingReviewDecision(store, {
      firmId: "firm-west-legal",
      matterId: "matter-001",
      requestId: schedulingRequest.id,
      decision: "follow_up_required",
      decidedAt: "2026-06-04T15:00:00.000Z",
      decidedByUserId: "user-licensee",
      cueStatus: "stale",
      ageHours: 72,
    });

    expect(updated).toMatchObject({
      id: schedulingRequest.id,
      status: "needs_review",
      reviewAgingDecision: "follow_up_required",
      reviewAgingCueStatus: "stale",
      reviewAgingAgeHours: 72,
    });
    expect(updated).not.toHaveProperty("calendarEventId");
    expect(updated).not.toHaveProperty("reviewedAt");
    expect(updated).not.toHaveProperty("reviewedByUserId");
    expect(store.calendarSchedulingRequests[0]).toMatchObject({
      status: "needs_review",
    });
    expect(store.calendarSchedulingRequests[0]).not.toHaveProperty("calendarEventId");
  });
});
