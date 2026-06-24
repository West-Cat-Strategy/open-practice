import type { PublicTokenActionItem } from "../publicTokenActions";
import {
  buildPublicTokenHeaderPath,
  publicTokenErrorMessage,
  type PublicTokenErrorBody,
} from "../publicTokenClient";
import type { PublicGuestSessionResponse } from "../types";

export type PublicGuestSessionErrorBody = PublicTokenErrorBody;

export function buildGuestSessionPath(...segments: string[]): string {
  return buildPublicTokenHeaderPath("/api/portal/guest-sessions", ...segments);
}

export function describePublicGuestSessionStatus(
  payload: PublicGuestSessionResponse | null,
): string {
  if (!payload) return "Loading guest session...";
  if (payload.session.status === "expired") return "Guest access has expired.";
  if (payload.session.status === "ended") return "The session has ended.";
  if (payload.session.status === "locked") return "The lobby is locked.";
  if (payload.meetingAccess?.status === "staff_controlled") {
    return "You have been admitted. Staff will provide meeting access through the calendar invitation or staff handoff.";
  }
  if (payload.guest?.status === "admitted") return "You have been admitted.";
  if (payload.guest?.status === "denied") return "Guest access was denied.";
  if (payload.guest?.status === "revoked") return "Guest access was revoked.";
  if (payload.guest?.status === "waiting") return "You are waiting in the lobby.";
  if (payload.session.status === "open") return "The lobby is open.";
  return "The lobby is not open yet.";
}

export function canCheckInToGuestSession(payload: PublicGuestSessionResponse | null): boolean {
  return payload?.session.status === "open" && payload.guest?.status === "issued";
}

export function shouldPollPublicGuestSession(payload: PublicGuestSessionResponse | null): boolean {
  if (!payload) return false;
  if (payload.session.status === "expired" || payload.session.status === "ended") return false;
  return payload.guest?.status === "waiting";
}

export function guestSessionAttentionItems(
  payload: PublicGuestSessionResponse | null,
): PublicTokenActionItem[] {
  if (!payload) return [];
  if (canCheckInToGuestSession(payload)) {
    return [
      {
        id: "check-in",
        title: "Check in",
        detail: "Join the waiting lobby for staff review.",
        status: "ready",
        tone: "ready",
      },
    ];
  }
  if (payload.guest?.status === "waiting") {
    return [
      {
        id: "waiting",
        title: "Waiting",
        detail: "Staff can admit or deny this guest access.",
        status: "pending",
      },
    ];
  }
  if (payload.session.status === "locked") {
    return [
      {
        id: "locked",
        title: "Lobby locked",
        detail: "Staff has locked new lobby movement for now.",
        status: "locked",
      },
    ];
  }
  if (payload.session.status === "expired" || payload.session.status === "ended") {
    return [
      {
        id: payload.session.status,
        title: payload.session.status === "expired" ? "Expired" : "Ended",
        detail: "This guest status link is no longer active.",
        status: payload.session.status,
        tone: "risk",
      },
    ];
  }
  return [];
}

export function publicGuestSessionErrorMessage(
  body: PublicGuestSessionErrorBody,
  fallback: string,
): string {
  return publicTokenErrorMessage(body, fallback);
}
