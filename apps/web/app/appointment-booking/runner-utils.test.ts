import { describe, expect, it } from "vitest";
import { buildAppointmentBookingPath, describeAppointmentBookingLoad } from "./runner-utils";

describe("appointment booking runner utils", () => {
  it("uses the public-token header route shape", () => {
    expect(buildAppointmentBookingPath()).toBe("/api/portal/appointment-bookings");
    expect(buildAppointmentBookingPath("book")).toBe("/api/portal/appointment-bookings/book");
  });

  it("describes public appointment booking state without private details", () => {
    expect(
      describeAppointmentBookingLoad({
        profile: {
          id: "booking-profile",
          publicLabel: "Initial consultation",
          timezone: "America/Vancouver",
          durationMinutes: 30,
        },
        slots: [
          {
            startsAt: "2026-06-29T16:00:00.000Z",
            endsAt: "2026-06-29T16:30:00.000Z",
          },
        ],
        link: { status: "active", expiresAt: "2026-07-01T00:00:00.000Z" },
      }),
    ).toBe("1 slot available.");
  });
});
