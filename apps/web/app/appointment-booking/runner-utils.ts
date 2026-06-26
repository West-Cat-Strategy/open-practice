import {
  buildPublicTokenHeaderPath,
  publicTokenErrorMessage,
  type PublicTokenErrorBody,
} from "../publicTokenClient";

export interface PublicAppointmentBookingSlot {
  startsAt: string;
  endsAt: string;
}

export interface PublicAppointmentBookingProfile {
  id: string;
  publicLabel: string;
  description?: string;
  timezone: string;
  durationMinutes: number;
}

export interface PublicAppointmentBookingLoadResponse {
  profile: PublicAppointmentBookingProfile;
  slots: PublicAppointmentBookingSlot[];
  link: {
    status: "active" | "used" | "revoked" | "expired";
    expiresAt: string;
  };
}

export interface PublicAppointmentBookingSubmitResponse {
  booking: {
    status: "tentative_hold" | "confirmed" | "dismissed";
    submittedAt: string;
    requestedStartsAt: string;
    requestedEndsAt: string;
    profile: PublicAppointmentBookingProfile;
  };
}

export type PublicAppointmentBookingErrorBody = PublicTokenErrorBody;

export function buildAppointmentBookingPath(...segments: string[]): string {
  return buildPublicTokenHeaderPath("/api/portal/appointment-bookings", ...segments);
}

export function describeAppointmentBookingLoad(
  payload: PublicAppointmentBookingLoadResponse | null,
): string {
  if (!payload) return "Loading appointment booking...";
  if (payload.link.status !== "active") return "This booking link is no longer active.";
  if (payload.slots.length === 0) return "No appointment slots are currently available.";
  return `${payload.slots.length} slot${payload.slots.length === 1 ? "" : "s"} available.`;
}

export function publicAppointmentBookingErrorMessage(
  body: PublicAppointmentBookingErrorBody,
  fallback: string,
): string {
  return publicTokenErrorMessage(body, fallback);
}
