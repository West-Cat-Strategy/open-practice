import type { CalendarEventRecord } from "./models.js";
import { buildReviewAgingCue, type ReviewAgingCue } from "./review-aging.js";

export type AppointmentBookingProfileStatus = "active" | "paused";
export type AppointmentBookingRequestStatus = "tentative_hold" | "confirmed" | "dismissed";
export type AppointmentBookingRequestSource = "website" | "direct_link";
export type AppointmentBookingLinkStatus = "active" | "used" | "revoked" | "expired";

export interface AppointmentBookingWeeklyWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface AppointmentBookingProfileRecord {
  id: string;
  firmId: string;
  label: string;
  publicLabel: string;
  description?: string;
  timezone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxLeadDays: number;
  status: AppointmentBookingProfileStatus;
  weeklyWindows: AppointmentBookingWeeklyWindow[];
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface AppointmentBookingLinkRecord {
  id: string;
  firmId: string;
  profileId: string;
  tokenHash: string;
  matterId?: string;
  clientContactId?: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId?: string;
  metadata: Record<string, unknown>;
}

export interface AppointmentBookingRequestRecord {
  id: string;
  firmId: string;
  profileId: string;
  linkId?: string;
  source: AppointmentBookingRequestSource;
  status: AppointmentBookingRequestStatus;
  calendarEventId: string;
  publicConsultationIntakeId?: string;
  matterId?: string;
  clientContactId?: string;
  requesterName: string;
  requesterEmail?: string;
  requesterTelephone?: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  dismissedReason?: string;
  metadata: Record<string, unknown>;
}

export interface AppointmentBookingSlot {
  startsAt: string;
  endsAt: string;
}

export interface AppointmentBookingProfileSummary {
  id: string;
  label: string;
  publicLabel: string;
  description?: string;
  timezone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxLeadDays: number;
  status: AppointmentBookingProfileStatus;
  weeklyWindows: AppointmentBookingWeeklyWindow[];
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentBookingLinkSummary {
  id: string;
  profileId: string;
  status: AppointmentBookingLinkStatus;
  matterId?: string;
  clientContactId?: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface AppointmentBookingRequestSummary {
  id: string;
  profileId: string;
  profileLabel?: string;
  linkId?: string;
  source: AppointmentBookingRequestSource;
  status: AppointmentBookingRequestStatus;
  calendarEventId: string;
  matterId?: string;
  clientContactId?: string;
  publicConsultationIntakeId?: string;
  requesterName: string;
  requesterEmailPresent: boolean;
  requesterTelephonePresent: boolean;
  requestedStartsAt: string;
  requestedEndsAt: string;
  submittedAt: string;
  reviewAging?: ReviewAgingCue;
  reviewedAt?: string;
  reviewedByUserId?: string;
  dismissedReason?: string;
  reviewBoundary: {
    confirmationCreatesMatter: false;
    confirmationSyncsProvider: false;
    confirmationCreatesMeetingRoom: false;
    dismissalDeletesEvidence: false;
  };
}

export interface PublicAppointmentBookingProfile {
  id: string;
  publicLabel: string;
  description?: string;
  timezone: string;
  durationMinutes: number;
}

const REVIEW_BOUNDARY = {
  confirmationCreatesMatter: false,
  confirmationSyncsProvider: false,
  confirmationCreatesMeetingRoom: false,
  dismissalDeletesEvidence: false,
} as const;

const WEEKDAY_BY_SHORT = new Map([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

function parseTimeMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

function localParts(date: Date, timezone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekdayText = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return {
    weekday: WEEKDAY_BY_SHORT.get(weekdayText) ?? 0,
    minutes: hour * 60 + minute,
  };
}

function roundUpToInterval(date: Date, intervalMinutes: number): Date {
  const intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / intervalMs) * intervalMs);
}

function overlaps(
  left: Pick<AppointmentBookingSlot, "startsAt" | "endsAt">,
  right: Pick<CalendarEventRecord, "startsAt" | "endsAt">,
): boolean {
  return (
    Date.parse(left.startsAt) < Date.parse(right.endsAt) &&
    Date.parse(left.endsAt) > Date.parse(right.startsAt)
  );
}

function slotFitsWindow(
  startsAt: Date,
  profile: Pick<AppointmentBookingProfileRecord, "durationMinutes" | "timezone" | "weeklyWindows">,
): boolean {
  const startParts = localParts(startsAt, profile.timezone);
  const slotEndMinutes = startParts.minutes + profile.durationMinutes;
  return profile.weeklyWindows.some((window) => {
    const windowStart = parseTimeMinutes(window.startTime);
    const windowEnd = parseTimeMinutes(window.endTime);
    return (
      window.weekday === startParts.weekday &&
      Number.isFinite(windowStart) &&
      Number.isFinite(windowEnd) &&
      startParts.minutes >= windowStart &&
      slotEndMinutes <= windowEnd
    );
  });
}

export function buildAppointmentBookingSlots(input: {
  profile: AppointmentBookingProfileRecord;
  events: CalendarEventRecord[];
  rangeStart: string;
  rangeEnd: string;
  now?: string;
  limit?: number;
}): AppointmentBookingSlot[] {
  if (input.profile.status !== "active") return [];
  const now = Date.parse(input.now ?? new Date().toISOString());
  const minStart = now + input.profile.minLeadMinutes * 60 * 1000;
  const maxStart = now + input.profile.maxLeadDays * 24 * 60 * 60 * 1000;
  const rangeStart = Math.max(Date.parse(input.rangeStart), minStart);
  const rangeEnd = Math.min(Date.parse(input.rangeEnd), maxStart);
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart >= rangeEnd) {
    return [];
  }

  const busyEvents = input.events.filter((event) => event.status !== "cancelled");
  const durationMs = input.profile.durationMinutes * 60 * 1000;
  const intervalMinutes = Math.max(1, input.profile.slotIntervalMinutes);
  const slots: AppointmentBookingSlot[] = [];
  let cursor = roundUpToInterval(new Date(rangeStart), intervalMinutes);
  const limit = input.limit ?? 80;

  while (cursor.getTime() + durationMs <= rangeEnd && slots.length < limit) {
    const slot = {
      startsAt: cursor.toISOString(),
      endsAt: new Date(cursor.getTime() + durationMs).toISOString(),
    };
    if (
      slotFitsWindow(cursor, input.profile) &&
      !busyEvents.some((event) => overlaps(slot, event))
    ) {
      slots.push(slot);
    }
    cursor = new Date(cursor.getTime() + intervalMinutes * 60 * 1000);
  }

  return slots;
}

export function summarizeAppointmentBookingProfile(
  profile: AppointmentBookingProfileRecord,
): AppointmentBookingProfileSummary {
  return {
    id: profile.id,
    label: profile.label,
    publicLabel: profile.publicLabel,
    description: profile.description,
    timezone: profile.timezone,
    durationMinutes: profile.durationMinutes,
    slotIntervalMinutes: profile.slotIntervalMinutes,
    minLeadMinutes: profile.minLeadMinutes,
    maxLeadDays: profile.maxLeadDays,
    status: profile.status,
    weeklyWindows: profile.weeklyWindows,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function publicAppointmentBookingProfile(
  profile: AppointmentBookingProfileRecord,
): PublicAppointmentBookingProfile {
  return {
    id: profile.id,
    publicLabel: profile.publicLabel,
    description: profile.description,
    timezone: profile.timezone,
    durationMinutes: profile.durationMinutes,
  };
}

export function appointmentBookingLinkStatus(
  link: AppointmentBookingLinkRecord,
  now = new Date().toISOString(),
): AppointmentBookingLinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.usedAt) return "used";
  if (Date.parse(link.expiresAt) <= Date.parse(now)) return "expired";
  return "active";
}

export function summarizeAppointmentBookingLink(
  link: AppointmentBookingLinkRecord,
  now?: string,
): AppointmentBookingLinkSummary {
  return {
    id: link.id,
    profileId: link.profileId,
    status: appointmentBookingLinkStatus(link, now),
    matterId: link.matterId,
    clientContactId: link.clientContactId,
    expiresAt: link.expiresAt,
    usedAt: link.usedAt,
    revokedAt: link.revokedAt,
    createdAt: link.createdAt,
  };
}

export function summarizeAppointmentBookingRequest(input: {
  request: AppointmentBookingRequestRecord;
  profile?: AppointmentBookingProfileRecord;
  now?: string;
}): AppointmentBookingRequestSummary {
  return {
    id: input.request.id,
    profileId: input.request.profileId,
    profileLabel: input.profile?.label,
    linkId: input.request.linkId,
    source: input.request.source,
    status: input.request.status,
    calendarEventId: input.request.calendarEventId,
    matterId: input.request.matterId,
    clientContactId: input.request.clientContactId,
    publicConsultationIntakeId: input.request.publicConsultationIntakeId,
    requesterName: input.request.requesterName,
    requesterEmailPresent: Boolean(input.request.requesterEmail),
    requesterTelephonePresent: Boolean(input.request.requesterTelephone),
    requestedStartsAt: input.request.requestedStartsAt,
    requestedEndsAt: input.request.requestedEndsAt,
    submittedAt: input.request.submittedAt,
    ...(input.request.status === "tentative_hold"
      ? {
          reviewAging: buildReviewAgingCue({
            referenceAt: input.request.submittedAt,
            now: input.now,
          }),
        }
      : {}),
    reviewedAt: input.request.reviewedAt,
    reviewedByUserId: input.request.reviewedByUserId,
    dismissedReason: input.request.dismissedReason,
    reviewBoundary: REVIEW_BOUNDARY,
  };
}

export function appointmentBookingPublicRequestResponse(input: {
  request: AppointmentBookingRequestRecord;
  profile: AppointmentBookingProfileRecord;
}): {
  status: AppointmentBookingRequestStatus;
  submittedAt: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
  profile: PublicAppointmentBookingProfile;
} {
  return {
    status: input.request.status,
    submittedAt: input.request.submittedAt,
    requestedStartsAt: input.request.requestedStartsAt,
    requestedEndsAt: input.request.requestedEndsAt,
    profile: publicAppointmentBookingProfile(input.profile),
  };
}
