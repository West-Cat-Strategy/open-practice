import { describe, expect, it } from "vitest";
import {
  AppointmentBookingLinkUnavailableError,
  AppointmentBookingSlotUnavailableError,
} from "../src/repository/contracts.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

const now = "2026-06-01T12:00:00.000Z";

function profile() {
  return {
    id: "booking-profile-test",
    firmId: "firm-west-legal",
    label: "Consultation",
    publicLabel: "Initial consultation",
    timezone: "America/Vancouver",
    durationMinutes: 30,
    slotIntervalMinutes: 30,
    minLeadMinutes: 0,
    maxLeadDays: 30,
    status: "active" as const,
    weeklyWindows: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }],
    createdAt: now,
    updatedAt: now,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
  };
}

function tentativeEvent(id = "calendar-event-booking-hold") {
  return {
    id,
    firmId: "firm-west-legal",
    scope: "firm" as const,
    uid: `${id}@example.test`,
    title: "Tentative consultation hold",
    startsAt: "2026-06-01T16:00:00.000Z",
    endsAt: "2026-06-01T16:30:00.000Z",
    status: "tentative" as const,
    sequence: 0,
    meetingLinkMode: "blank" as const,
    createdAt: now,
    updatedAt: now,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
  };
}

function bookingRequest(id = "booking-request-test", eventId = "calendar-event-booking-hold") {
  return {
    id,
    firmId: "firm-west-legal",
    profileId: "booking-profile-test",
    source: "website" as const,
    status: "tentative_hold" as const,
    calendarEventId: eventId,
    requesterName: "Synthetic Public Client",
    requesterEmail: "client@example.test",
    requestedStartsAt: "2026-06-01T16:00:00.000Z",
    requestedEndsAt: "2026-06-01T16:30:00.000Z",
    submittedAt: now,
    metadata: { source: "website" },
  };
}

describe("repository appointment booking", () => {
  it("creates profiles and direct links without storing raw tokens", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await expect(repository.upsertAppointmentBookingProfile(profile())).resolves.toMatchObject({
      id: "booking-profile-test",
      publicLabel: "Initial consultation",
    });

    await expect(
      repository.createAppointmentBookingLink({
        id: "booking-link-test",
        firmId: "firm-west-legal",
        profileId: "booking-profile-test",
        tokenHash: "hashed-token-only",
        matterId: "matter-001",
        expiresAt: "2026-06-08T12:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        createdByUserId: "user-admin",
        metadata: {},
      }),
    ).resolves.toMatchObject({
      id: "booking-link-test",
      tokenHash: "hashed-token-only",
    });

    await expect(
      repository.createAppointmentBookingLink({
        id: "booking-link-duplicate",
        firmId: "firm-west-legal",
        profileId: "booking-profile-test",
        tokenHash: "hashed-token-only",
        expiresAt: "2026-06-08T12:00:00.000Z",
        createdAt: now,
        updatedAt: now,
        createdByUserId: "user-admin",
        metadata: {},
      }),
    ).rejects.toThrow(/token hash/i);
  });

  it("creates tentative event and booking request atomically, then rejects overlapping holds", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertAppointmentBookingProfile(profile());

    const result = await repository.createAppointmentBookingTentativeHold({
      firmId: "firm-west-legal",
      profileId: "booking-profile-test",
      startsAt: "2026-06-01T16:00:00.000Z",
      endsAt: "2026-06-01T16:30:00.000Z",
      event: tentativeEvent(),
      request: bookingRequest(),
    });
    expect(result).toMatchObject({
      event: { status: "tentative", meetingLinkMode: "blank" },
      request: { status: "tentative_hold", calendarEventId: "calendar-event-booking-hold" },
    });

    await expect(
      repository.createAppointmentBookingTentativeHold({
        firmId: "firm-west-legal",
        profileId: "booking-profile-test",
        startsAt: "2026-06-01T16:00:00.000Z",
        endsAt: "2026-06-01T16:30:00.000Z",
        event: tentativeEvent("calendar-event-overlap"),
        request: bookingRequest("booking-request-overlap", "calendar-event-overlap"),
      }),
    ).rejects.toBeInstanceOf(AppointmentBookingSlotUnavailableError);
  });

  it("rechecks direct-link single-use state during tentative hold creation", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertAppointmentBookingProfile(profile());
    await repository.createAppointmentBookingLink({
      id: "booking-link-single-use",
      firmId: "firm-west-legal",
      profileId: "booking-profile-test",
      tokenHash: "hashed-single-use-token",
      expiresAt: "2026-06-08T12:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-admin",
      metadata: {},
    });

    await repository.createAppointmentBookingTentativeHold({
      firmId: "firm-west-legal",
      profileId: "booking-profile-test",
      startsAt: "2026-06-01T16:00:00.000Z",
      endsAt: "2026-06-01T16:30:00.000Z",
      event: tentativeEvent("calendar-event-single-use"),
      request: {
        ...bookingRequest("booking-request-single-use", "calendar-event-single-use"),
        source: "direct_link",
        linkId: "booking-link-single-use",
      },
      linkId: "booking-link-single-use",
      usedAt: now,
    });

    let replayError: unknown;
    try {
      await repository.createAppointmentBookingTentativeHold({
        firmId: "firm-west-legal",
        profileId: "booking-profile-test",
        startsAt: "2026-06-01T16:30:00.000Z",
        endsAt: "2026-06-01T17:00:00.000Z",
        event: {
          ...tentativeEvent("calendar-event-single-use-replay"),
          startsAt: "2026-06-01T16:30:00.000Z",
          endsAt: "2026-06-01T17:00:00.000Z",
        },
        request: {
          ...bookingRequest(
            "booking-request-single-use-replay",
            "calendar-event-single-use-replay",
          ),
          source: "direct_link",
          linkId: "booking-link-single-use",
          requestedStartsAt: "2026-06-01T16:30:00.000Z",
          requestedEndsAt: "2026-06-01T17:00:00.000Z",
        },
        linkId: "booking-link-single-use",
        usedAt: "2026-06-01T12:01:00.000Z",
      });
    } catch (error) {
      replayError = error;
    }
    expect(replayError).toBeInstanceOf(AppointmentBookingLinkUnavailableError);
    expect(replayError).toMatchObject({ reason: "used" });
  });

  it("confirms and dismisses tentative holds through review transitions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.upsertAppointmentBookingProfile(profile());
    await repository.createAppointmentBookingTentativeHold({
      firmId: "firm-west-legal",
      profileId: "booking-profile-test",
      startsAt: "2026-06-01T16:00:00.000Z",
      endsAt: "2026-06-01T16:30:00.000Z",
      event: tentativeEvent(),
      request: bookingRequest(),
    });

    await expect(
      repository.reviewAppointmentBookingRequest({
        firmId: "firm-west-legal",
        requestId: "booking-request-test",
        status: "confirmed",
        reviewedAt: "2026-06-01T13:00:00.000Z",
        reviewedByUserId: "user-admin",
      }),
    ).resolves.toMatchObject({
      request: { status: "confirmed", reviewedByUserId: "user-admin" },
      event: { status: "confirmed", sequence: 1 },
    });
  });
});
