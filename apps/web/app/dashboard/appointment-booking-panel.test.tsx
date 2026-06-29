import { describe, expect, it } from "vitest";
import { describeAppointmentBookingHoldAging } from "./appointment-booking-panel";

describe("appointment booking panel helpers", () => {
  it("describes stale tentative holds without exposing contact details or automatic actions", () => {
    expect(
      describeAppointmentBookingHoldAging({
        status: "stale",
        ageHours: 72,
        referenceAt: "2026-06-01T12:00:00.000Z",
        agingAfterHours: 24,
        staleAfterHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
      }),
    ).toEqual({
      label: "stale hold",
      detail:
        "72h waiting since 2026-06-01T12:00:00.000Z; manual review only, no auto-confirm, auto-expiry, or provider sync.",
      tone: "risk",
    });
  });
});
