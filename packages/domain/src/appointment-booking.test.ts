import { describe, expect, it } from "vitest";
import {
  appointmentBookingLinkStatus,
  appointmentBookingPublicRequestResponse,
  buildAppointmentBookingSlots,
  summarizeAppointmentBookingRequest,
  type AppointmentBookingProfileRecord,
  type AppointmentBookingRequestRecord,
} from "./appointment-booking.js";
import { buildIntakePipelineSnapshot } from "./intake-pipeline.js";

const profile: AppointmentBookingProfileRecord = {
  id: "booking-profile-001",
  firmId: "firm-west-legal",
  label: "Consultation",
  publicLabel: "Initial consultation",
  timezone: "America/Vancouver",
  durationMinutes: 30,
  slotIntervalMinutes: 30,
  minLeadMinutes: 0,
  maxLeadDays: 30,
  status: "active",
  weeklyWindows: [{ weekday: 1, startTime: "09:00", endTime: "11:00" }],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  createdByUserId: "user-admin",
  updatedByUserId: "user-admin",
};

const bookingRequest: AppointmentBookingRequestRecord = {
  id: "booking-request-001",
  firmId: "firm-west-legal",
  profileId: profile.id,
  source: "website",
  status: "tentative_hold",
  calendarEventId: "calendar-event-hold",
  publicConsultationIntakeId: "public-intake-001",
  requesterName: "Synthetic Public Client",
  requesterEmail: "client@example.test",
  requestedStartsAt: "2026-06-01T16:00:00.000Z",
  requestedEndsAt: "2026-06-01T16:30:00.000Z",
  submittedAt: "2026-06-01T15:00:00.000Z",
  metadata: { source: "website", sourceUrlPresent: true },
};

describe("appointment booking domain", () => {
  it("computes profile slots while excluding tentative holds and confirmed events", () => {
    const slots = buildAppointmentBookingSlots({
      profile,
      rangeStart: "2026-06-01T16:00:00.000Z",
      rangeEnd: "2026-06-01T18:00:00.000Z",
      now: "2026-06-01T12:00:00.000Z",
      events: [
        {
          id: "calendar-event-busy",
          firmId: "firm-west-legal",
          uid: "calendar-event-busy@example.test",
          title: "Private title",
          startsAt: "2026-06-01T16:30:00.000Z",
          endsAt: "2026-06-01T17:00:00.000Z",
          status: "tentative",
          sequence: 0,
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          createdByUserId: "user-admin",
          updatedByUserId: "user-admin",
        },
        {
          id: "calendar-event-cancelled",
          firmId: "firm-west-legal",
          uid: "calendar-event-cancelled@example.test",
          title: "Cancelled private title",
          startsAt: "2026-06-01T17:00:00.000Z",
          endsAt: "2026-06-01T17:30:00.000Z",
          status: "cancelled",
          sequence: 0,
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          createdByUserId: "user-admin",
          updatedByUserId: "user-admin",
        },
      ],
    });

    expect(slots).toEqual([
      { startsAt: "2026-06-01T16:00:00.000Z", endsAt: "2026-06-01T16:30:00.000Z" },
      { startsAt: "2026-06-01T17:00:00.000Z", endsAt: "2026-06-01T17:30:00.000Z" },
      { startsAt: "2026-06-01T17:30:00.000Z", endsAt: "2026-06-01T18:00:00.000Z" },
    ]);
  });

  it("summarizes public booking responses without event, token, or contact details", () => {
    const response = appointmentBookingPublicRequestResponse({
      request: bookingRequest,
      profile,
    });

    expect(response).toEqual({
      status: "tentative_hold",
      submittedAt: "2026-06-01T15:00:00.000Z",
      requestedStartsAt: "2026-06-01T16:00:00.000Z",
      requestedEndsAt: "2026-06-01T16:30:00.000Z",
      profile: {
        id: "booking-profile-001",
        publicLabel: "Initial consultation",
        timezone: "America/Vancouver",
        durationMinutes: 30,
      },
    });
    expect(JSON.stringify(response)).not.toContain("calendar-event-hold");
    expect(JSON.stringify(response)).not.toContain("client@example.test");
    expect(response).not.toHaveProperty("reviewAging");
  });

  it("adds review-only aging cues only to open tentative-hold staff summaries", () => {
    expect(
      summarizeAppointmentBookingRequest({
        request: bookingRequest,
        profile,
        now: "2026-06-04T15:00:00.000Z",
      }),
    ).toMatchObject({
      status: "tentative_hold",
      reviewAging: {
        status: "stale",
        ageHours: 72,
        referenceAt: "2026-06-01T15:00:00.000Z",
        agingAfterHours: 24,
        staleAfterHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      },
    });
    expect(
      summarizeAppointmentBookingRequest({
        request: {
          ...bookingRequest,
          status: "confirmed",
          reviewedAt: "2026-06-01T16:00:00.000Z",
        },
        profile,
        now: "2026-06-04T15:00:00.000Z",
      }),
    ).not.toHaveProperty("reviewAging");
  });

  it("tracks direct link lifecycle from token-hash only fields", () => {
    expect(
      appointmentBookingLinkStatus(
        {
          id: "booking-link-001",
          firmId: "firm-west-legal",
          profileId: profile.id,
          tokenHash: "hashed-token",
          expiresAt: "2026-06-02T00:00:00.000Z",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
          createdByUserId: "user-admin",
          metadata: {},
        },
        "2026-06-01T12:00:00.000Z",
      ),
    ).toBe("active");
  });

  it("adds website booking holds to public consultation lead appointment counts", () => {
    const snapshot = buildIntakePipelineSnapshot({
      publicConsultationIntakes: [
        {
          id: "public-intake-001",
          firmId: "firm-west-legal",
          status: "pending",
          clientName: "Synthetic Public Client",
          telephone: "",
          email: "client@example.test",
          opposingPartyNames: [],
          matterDescription: "Synthetic private details.",
          disclosureAcceptedAt: "2026-06-01T15:00:00.000Z",
          submittedAt: "2026-06-01T15:00:00.000Z",
          metadata: { source: "appointment_booking_website" },
        },
      ],
      appointmentBookingRequests: [bookingRequest],
      intakeSessions: [],
      intakeFormLinks: [],
      intakeFormReviews: [],
      calendarEvents: [],
    });

    expect(snapshot.leads[0]?.appointmentLinks).toEqual([
      {
        eventId: "calendar-event-hold",
        startsAt: "2026-06-01T16:00:00.000Z",
        status: "tentative",
      },
    ]);
    expect(snapshot.submissionsOperations.rows[0]).toMatchObject({
      appointmentCount: 1,
      appointmentStatuses: { tentative: 1 },
    });
  });
});
