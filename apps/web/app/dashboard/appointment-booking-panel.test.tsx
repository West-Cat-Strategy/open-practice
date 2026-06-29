import { describe, expect, it } from "vitest";
import {
  describeAppointmentBookingAgingDecision,
  describeAppointmentBookingHoldAging,
} from "./appointment-booking-panel";

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

  it("describes latest aging decisions as review-only staff triage", () => {
    expect(
      describeAppointmentBookingAgingDecision({
        decision: "follow_up_required",
        decidedAt: "2026-06-04T12:00:00.000Z",
        decidedByUserId: "user-staff",
        cueStatus: "stale",
        ageHours: 72,
        automaticFinalConfirmation: false,
        autoExpires: false,
        providerSync: false,
        publicRoomCreated: false,
        nativeMediaCreated: false,
        chatCreated: false,
        recordingCreated: false,
        matterCreated: false,
      }),
    ).toEqual({
      label: "follow-up required",
      detail:
        "stale at 72h by user-staff; review-only decision, no auto-confirm, auto-expiry, provider sync, public room, media, chat, recording, or matter.",
    });
  });
});
