import { describe, expect, it } from "vitest";
import type { PublicGuestSessionResponse } from "../types";
import {
  buildGuestSessionPath,
  canCheckInToGuestSession,
  describePublicGuestSessionStatus,
  guestSessionAttentionItems,
} from "./runner-utils";

function guestSessionPayload(
  overrides: {
    session?: Partial<PublicGuestSessionResponse["session"]>;
    guest?: Partial<NonNullable<PublicGuestSessionResponse["guest"]>>;
    meetingAccess?: PublicGuestSessionResponse["meetingAccess"];
    lobby?: Partial<NonNullable<PublicGuestSessionResponse["lobby"]>>;
  } = {},
): PublicGuestSessionResponse {
  return {
    session: {
      status: "open",
      lobbyStatus: "open",
      startsAt: "2026-05-03T16:00:00.000Z",
      endsAt: "2026-05-03T17:00:00.000Z",
      waitingCount: 0,
      admittedCount: 0,
      deniedCount: 0,
      revokedCount: 0,
      ...overrides.session,
    },
    meetingAccess: overrides.meetingAccess,
    guest: { status: "issued", ...overrides.guest },
    lobby: {
      status: "open",
      waitingCount: 0,
      admittedCount: 0,
      deniedCount: 0,
      revokedCount: 0,
      ...overrides.lobby,
    },
  };
}

describe("guest session runner utilities", () => {
  it("builds header-token paths without exposing unsafe query construction", () => {
    expect(buildGuestSessionPath("check-in")).toBe("/api/portal/guest-sessions/check-in");
  });

  it("describes status-only guest lobby states", () => {
    expect(describePublicGuestSessionStatus(guestSessionPayload())).toBe("The lobby is open.");
    expect(
      describePublicGuestSessionStatus(
        guestSessionPayload({ guest: { status: "waiting" }, session: { status: "open" } }),
      ),
    ).toBe("You are waiting in the lobby.");
    expect(
      describePublicGuestSessionStatus(
        guestSessionPayload({
          guest: { status: "admitted" },
          meetingAccess: {
            status: "staff_controlled",
            deliveryBoundary: "calendar_invitation_or_staff_handoff",
            meetingUrlAvailable: false,
          },
          session: { status: "open" },
        }),
      ),
    ).toBe(
      "You have been admitted. Staff will provide meeting access through the calendar invitation or staff handoff.",
    );
    expect(
      describePublicGuestSessionStatus(
        guestSessionPayload({ session: { status: "expired" }, guest: { status: "revoked" } }),
      ),
    ).toBe("Guest access has expired.");
  });

  it("only allows check-in when the lobby is open and access is newly issued", () => {
    expect(canCheckInToGuestSession(guestSessionPayload())).toBe(true);
    expect(
      canCheckInToGuestSession(
        guestSessionPayload({ guest: { status: "waiting" }, session: { status: "open" } }),
      ),
    ).toBe(false);
    expect(
      canCheckInToGuestSession(
        guestSessionPayload({ guest: { status: "issued" }, session: { status: "locked" } }),
      ),
    ).toBe(false);
  });

  it("summarizes public attention items without matter or attendee details", () => {
    expect(guestSessionAttentionItems(guestSessionPayload())).toEqual([
      expect.objectContaining({ id: "check-in", status: "ready" }),
    ]);
    expect(
      guestSessionAttentionItems(
        guestSessionPayload({ session: { status: "locked" }, guest: { status: "issued" } }),
      ),
    ).toEqual([expect.objectContaining({ id: "locked", status: "locked" })]);
  });
});
