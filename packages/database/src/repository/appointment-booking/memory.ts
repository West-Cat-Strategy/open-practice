import type {
  AppointmentBookingLinkRecord,
  AppointmentBookingProfileRecord,
  AppointmentBookingRequestRecord,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  AppointmentBookingProfileListOptions,
  AppointmentBookingRequestListOptions,
  AppointmentBookingReviewInput,
  AppointmentBookingReviewResult,
  AppointmentBookingTentativeHoldInput,
  AppointmentBookingTentativeHoldResult,
} from "../appointment-booking-contracts.js";
import {
  AppointmentBookingLinkUnavailableError,
  AppointmentBookingSlotUnavailableError,
} from "../appointment-booking-contracts.js";
import type { MemoryCalendarEventStore } from "../calendar-events/memory.js";
import {
  upsertMemoryCalendarEvent,
  upsertMemoryCalendarEventAttendee,
} from "../calendar-events/memory.js";
import type { MemoryPublicConsultationIntakeStore } from "../public-consultation-intakes/memory.js";
import { createMemoryPublicConsultationIntake } from "../public-consultation-intakes/memory.js";

export interface MemoryAppointmentBookingStore {
  appointmentBookingProfiles: AppointmentBookingProfileRecord[];
  appointmentBookingLinks: AppointmentBookingLinkRecord[];
  appointmentBookingRequests: AppointmentBookingRequestRecord[];
}

function overlaps(
  startsAt: string,
  endsAt: string,
  event: { startsAt: string; endsAt: string; status: string; deletedAt?: string },
): boolean {
  return (
    event.status !== "cancelled" &&
    !event.deletedAt &&
    Date.parse(startsAt) < Date.parse(event.endsAt) &&
    Date.parse(endsAt) > Date.parse(event.startsAt)
  );
}

export function listMemoryAppointmentBookingProfiles(
  store: MemoryAppointmentBookingStore,
  firmId: string,
  options: AppointmentBookingProfileListOptions = {},
): AppointmentBookingProfileRecord[] {
  return clone(
    store.appointmentBookingProfiles
      .filter((profile) => profile.firmId === firmId)
      .filter((profile) => !options.status || profile.status === options.status)
      .sort((left, right) => left.label.localeCompare(right.label)),
  );
}

export function getMemoryAppointmentBookingProfile(
  store: MemoryAppointmentBookingStore,
  firmId: string,
  profileId: string,
): AppointmentBookingProfileRecord | undefined {
  return clone(
    store.appointmentBookingProfiles.find(
      (profile) => profile.firmId === firmId && profile.id === profileId,
    ),
  );
}

export function upsertMemoryAppointmentBookingProfile(
  store: MemoryAppointmentBookingStore,
  profile: AppointmentBookingProfileRecord,
): AppointmentBookingProfileRecord {
  const index = store.appointmentBookingProfiles.findIndex(
    (candidate) => candidate.firmId === profile.firmId && candidate.id === profile.id,
  );
  if (index >= 0) {
    store.appointmentBookingProfiles[index] = clone(profile);
  } else {
    store.appointmentBookingProfiles = [...store.appointmentBookingProfiles, clone(profile)];
  }
  return clone(profile);
}

export function createMemoryAppointmentBookingLink(
  store: MemoryAppointmentBookingStore,
  link: AppointmentBookingLinkRecord,
): AppointmentBookingLinkRecord {
  if (store.appointmentBookingLinks.some((candidate) => candidate.tokenHash === link.tokenHash)) {
    throw new Error("Appointment booking link token hash already exists");
  }
  store.appointmentBookingLinks = [clone(link), ...store.appointmentBookingLinks];
  return clone(link);
}

export function getMemoryAppointmentBookingLinkByTokenHash(
  store: MemoryAppointmentBookingStore,
  tokenHash: string,
): AppointmentBookingLinkRecord | undefined {
  return clone(store.appointmentBookingLinks.find((link) => link.tokenHash === tokenHash));
}

export function listMemoryAppointmentBookingRequests(
  store: MemoryAppointmentBookingStore,
  firmId: string,
  options: AppointmentBookingRequestListOptions = {},
): AppointmentBookingRequestRecord[] {
  return clone(
    store.appointmentBookingRequests
      .filter((request) => request.firmId === firmId)
      .filter((request) => !options.status || request.status === options.status)
      .filter((request) => !options.matterId || request.matterId === options.matterId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
  );
}

export function getMemoryAppointmentBookingRequest(
  store: MemoryAppointmentBookingStore,
  firmId: string,
  requestId: string,
): AppointmentBookingRequestRecord | undefined {
  return clone(
    store.appointmentBookingRequests.find(
      (request) => request.firmId === firmId && request.id === requestId,
    ),
  );
}

export function createMemoryAppointmentBookingTentativeHold(
  store: MemoryAppointmentBookingStore,
  calendarStore: MemoryCalendarEventStore,
  publicConsultationStore: MemoryPublicConsultationIntakeStore,
  input: AppointmentBookingTentativeHoldInput,
): AppointmentBookingTentativeHoldResult {
  const profile = getMemoryAppointmentBookingProfile(store, input.firmId, input.profileId);
  if (!profile) throw new Error(`Appointment booking profile ${input.profileId} was not found`);
  if (input.linkId && input.usedAt) {
    const link = store.appointmentBookingLinks.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.linkId,
    );
    if (!link) throw new AppointmentBookingLinkUnavailableError("not_found");
    if (link.revokedAt) throw new AppointmentBookingLinkUnavailableError("revoked");
    if (link.usedAt) throw new AppointmentBookingLinkUnavailableError("used");
    if (Date.parse(link.expiresAt) <= Date.parse(input.usedAt)) {
      throw new AppointmentBookingLinkUnavailableError("expired");
    }
  }
  if (
    calendarStore.calendarEvents.some((event) =>
      event.firmId === input.firmId ? overlaps(input.startsAt, input.endsAt, event) : false,
    )
  ) {
    throw new AppointmentBookingSlotUnavailableError();
  }

  const publicConsultationIntake = input.publicConsultationIntake
    ? createMemoryPublicConsultationIntake(publicConsultationStore, input.publicConsultationIntake)
    : undefined;
  const event = upsertMemoryCalendarEvent(calendarStore, input.event);
  if (input.attendee) upsertMemoryCalendarEventAttendee(calendarStore, input.attendee);
  store.appointmentBookingRequests = [clone(input.request), ...store.appointmentBookingRequests];
  if (input.linkId && input.usedAt) {
    const usedAt = input.usedAt;
    store.appointmentBookingLinks = store.appointmentBookingLinks.map((link) =>
      link.firmId === input.firmId && link.id === input.linkId
        ? { ...link, usedAt, updatedAt: usedAt }
        : link,
    );
  }
  return {
    event,
    request: clone(input.request),
    publicConsultationIntake,
  };
}

export function reviewMemoryAppointmentBookingRequest(
  store: MemoryAppointmentBookingStore,
  calendarStore: MemoryCalendarEventStore,
  input: AppointmentBookingReviewInput,
): AppointmentBookingReviewResult | undefined {
  const requestIndex = store.appointmentBookingRequests.findIndex(
    (request) => request.firmId === input.firmId && request.id === input.requestId,
  );
  if (requestIndex < 0) return undefined;
  const request = store.appointmentBookingRequests[requestIndex]!;
  const eventIndex = calendarStore.calendarEvents.findIndex(
    (event) => event.firmId === input.firmId && event.id === request.calendarEventId,
  );
  if (eventIndex < 0) return undefined;
  const nextRequest: AppointmentBookingRequestRecord = {
    ...request,
    status: input.status,
    reviewedAt: input.reviewedAt,
    reviewedByUserId: input.reviewedByUserId,
    dismissedReason: input.status === "dismissed" ? input.dismissedReason : undefined,
  };
  const nextEvent = {
    ...calendarStore.calendarEvents[eventIndex]!,
    status: input.status === "confirmed" ? ("confirmed" as const) : ("cancelled" as const),
    sequence: calendarStore.calendarEvents[eventIndex]!.sequence + 1,
    updatedAt: input.reviewedAt,
    updatedByUserId: input.reviewedByUserId,
  };
  store.appointmentBookingRequests[requestIndex] = clone(nextRequest);
  calendarStore.calendarEvents[eventIndex] = clone(nextEvent);
  return {
    request: clone(nextRequest),
    event: clone(nextEvent),
  };
}
