import type {
  AppointmentBookingLinkRecord,
  AppointmentBookingProfileRecord,
  AppointmentBookingRequestRecord,
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  PublicConsultationIntakeRecord,
} from "@open-practice/domain";

export class AppointmentBookingSlotUnavailableError extends Error {
  constructor() {
    super("Appointment booking slot is no longer available");
    this.name = "AppointmentBookingSlotUnavailableError";
  }
}

export type AppointmentBookingLinkUnavailableReason = "not_found" | "used" | "revoked" | "expired";

export class AppointmentBookingLinkUnavailableError extends Error {
  constructor(readonly reason: AppointmentBookingLinkUnavailableReason) {
    super(`Appointment booking link is unavailable: ${reason}`);
    this.name = "AppointmentBookingLinkUnavailableError";
  }
}

export interface AppointmentBookingProfileListOptions {
  status?: AppointmentBookingProfileRecord["status"];
}

export interface AppointmentBookingRequestListOptions {
  status?: AppointmentBookingRequestRecord["status"];
  matterId?: string;
}

export interface AppointmentBookingTentativeHoldInput {
  firmId: string;
  profileId: string;
  startsAt: string;
  endsAt: string;
  event: CalendarEventRecord;
  request: AppointmentBookingRequestRecord;
  attendee?: CalendarEventAttendeeRecord;
  publicConsultationIntake?: PublicConsultationIntakeRecord;
  linkId?: string;
  usedAt?: string;
}

export interface AppointmentBookingTentativeHoldResult {
  event: CalendarEventRecord;
  request: AppointmentBookingRequestRecord;
  publicConsultationIntake?: PublicConsultationIntakeRecord;
}

export interface AppointmentBookingReviewInput {
  firmId: string;
  requestId: string;
  status: "confirmed" | "dismissed";
  reviewedAt: string;
  reviewedByUserId: string;
  dismissedReason?: string;
}

export interface AppointmentBookingReviewResult {
  request: AppointmentBookingRequestRecord;
  event: CalendarEventRecord;
}

export interface AppointmentBookingAgingReviewInput {
  firmId: string;
  requestId: string;
  decision: NonNullable<AppointmentBookingRequestRecord["reviewAgingDecision"]>;
  decidedAt: string;
  decidedByUserId: string;
  cueStatus: NonNullable<AppointmentBookingRequestRecord["reviewAgingCueStatus"]>;
  ageHours: number;
}

export interface AppointmentBookingRepository {
  listAppointmentBookingProfiles(
    firmId: string,
    options?: AppointmentBookingProfileListOptions,
  ): Promise<AppointmentBookingProfileRecord[]>;
  getAppointmentBookingProfile(
    firmId: string,
    profileId: string,
  ): Promise<AppointmentBookingProfileRecord | undefined>;
  upsertAppointmentBookingProfile(
    profile: AppointmentBookingProfileRecord,
  ): Promise<AppointmentBookingProfileRecord>;
  createAppointmentBookingLink(
    link: AppointmentBookingLinkRecord,
  ): Promise<AppointmentBookingLinkRecord>;
  getAppointmentBookingLinkByTokenHash(
    tokenHash: string,
  ): Promise<AppointmentBookingLinkRecord | undefined>;
  listAppointmentBookingRequests(
    firmId: string,
    options?: AppointmentBookingRequestListOptions,
  ): Promise<AppointmentBookingRequestRecord[]>;
  getAppointmentBookingRequest(
    firmId: string,
    requestId: string,
  ): Promise<AppointmentBookingRequestRecord | undefined>;
  createAppointmentBookingTentativeHold(
    input: AppointmentBookingTentativeHoldInput,
  ): Promise<AppointmentBookingTentativeHoldResult>;
  reviewAppointmentBookingRequest(
    input: AppointmentBookingReviewInput,
  ): Promise<AppointmentBookingReviewResult | undefined>;
  recordAppointmentBookingAgingReviewDecision(
    input: AppointmentBookingAgingReviewInput,
  ): Promise<AppointmentBookingRequestRecord | undefined>;
}
