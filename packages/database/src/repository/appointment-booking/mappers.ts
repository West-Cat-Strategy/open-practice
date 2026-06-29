import type {
  AppointmentBookingLinkRecord,
  AppointmentBookingProfileRecord,
  AppointmentBookingRequestRecord,
} from "@open-practice/domain";
import * as schema from "../../schema.js";
import { dateToIso } from "../contracts.js";

export function mapAppointmentBookingProfileRow(
  row: typeof schema.appointmentBookingProfiles.$inferSelect,
): AppointmentBookingProfileRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    label: row.label,
    publicLabel: row.publicLabel,
    description: row.description ?? undefined,
    timezone: row.timezone,
    durationMinutes: row.durationMinutes,
    slotIntervalMinutes: row.slotIntervalMinutes,
    minLeadMinutes: row.minLeadMinutes,
    maxLeadDays: row.maxLeadDays,
    status: row.status as AppointmentBookingProfileRecord["status"],
    weeklyWindows: row.weeklyWindows,
    createdAt: dateToIso(row.createdAt)!,
    updatedAt: dateToIso(row.updatedAt)!,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
  };
}

export function appointmentBookingProfileInsert(
  profile: AppointmentBookingProfileRecord,
): typeof schema.appointmentBookingProfiles.$inferInsert {
  return {
    id: profile.id,
    firmId: profile.firmId,
    label: profile.label,
    publicLabel: profile.publicLabel,
    description: profile.description ?? null,
    timezone: profile.timezone,
    durationMinutes: profile.durationMinutes,
    slotIntervalMinutes: profile.slotIntervalMinutes,
    minLeadMinutes: profile.minLeadMinutes,
    maxLeadDays: profile.maxLeadDays,
    status: profile.status,
    weeklyWindows: profile.weeklyWindows,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
    createdByUserId: profile.createdByUserId,
    updatedByUserId: profile.updatedByUserId,
  };
}

export function mapAppointmentBookingLinkRow(
  row: typeof schema.appointmentBookingLinks.$inferSelect,
): AppointmentBookingLinkRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    profileId: row.profileId,
    tokenHash: row.tokenHash,
    matterId: row.matterId ?? undefined,
    clientContactId: row.clientContactId ?? undefined,
    expiresAt: dateToIso(row.expiresAt)!,
    usedAt: dateToIso(row.usedAt),
    revokedAt: dateToIso(row.revokedAt),
    createdAt: dateToIso(row.createdAt)!,
    updatedAt: dateToIso(row.updatedAt)!,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId ?? undefined,
    metadata: row.metadata,
  };
}

export function appointmentBookingLinkInsert(
  link: AppointmentBookingLinkRecord,
): typeof schema.appointmentBookingLinks.$inferInsert {
  return {
    id: link.id,
    firmId: link.firmId,
    profileId: link.profileId,
    tokenHash: link.tokenHash,
    matterId: link.matterId ?? null,
    clientContactId: link.clientContactId ?? null,
    expiresAt: new Date(link.expiresAt),
    usedAt: link.usedAt ? new Date(link.usedAt) : null,
    revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
    createdAt: new Date(link.createdAt),
    updatedAt: new Date(link.updatedAt),
    createdByUserId: link.createdByUserId,
    updatedByUserId: link.updatedByUserId ?? null,
    metadata: link.metadata,
  };
}

export function mapAppointmentBookingRequestRow(
  row: typeof schema.appointmentBookingRequests.$inferSelect,
): AppointmentBookingRequestRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    profileId: row.profileId,
    linkId: row.linkId ?? undefined,
    source: row.source as AppointmentBookingRequestRecord["source"],
    status: row.status as AppointmentBookingRequestRecord["status"],
    calendarEventId: row.calendarEventId,
    publicConsultationIntakeId: row.publicConsultationIntakeId ?? undefined,
    matterId: row.matterId ?? undefined,
    clientContactId: row.clientContactId ?? undefined,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail ?? undefined,
    requesterTelephone: row.requesterTelephone ?? undefined,
    requestedStartsAt: dateToIso(row.requestedStartsAt)!,
    requestedEndsAt: dateToIso(row.requestedEndsAt)!,
    submittedAt: dateToIso(row.submittedAt)!,
    reviewedAt: dateToIso(row.reviewedAt),
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    dismissedReason: row.dismissedReason ?? undefined,
    reviewAgingDecision: row.reviewAgingDecision ?? undefined,
    reviewAgingDecidedAt: dateToIso(row.reviewAgingDecidedAt),
    reviewAgingDecidedByUserId: row.reviewAgingDecidedByUserId ?? undefined,
    reviewAgingCueStatus: row.reviewAgingCueStatus ?? undefined,
    reviewAgingAgeHours: row.reviewAgingAgeHours ?? undefined,
    metadata: row.metadata,
  };
}

export function appointmentBookingRequestInsert(
  request: AppointmentBookingRequestRecord,
): typeof schema.appointmentBookingRequests.$inferInsert {
  return {
    id: request.id,
    firmId: request.firmId,
    profileId: request.profileId,
    linkId: request.linkId ?? null,
    source: request.source,
    status: request.status,
    calendarEventId: request.calendarEventId,
    publicConsultationIntakeId: request.publicConsultationIntakeId ?? null,
    matterId: request.matterId ?? null,
    clientContactId: request.clientContactId ?? null,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail ?? null,
    requesterTelephone: request.requesterTelephone ?? null,
    requestedStartsAt: new Date(request.requestedStartsAt),
    requestedEndsAt: new Date(request.requestedEndsAt),
    submittedAt: new Date(request.submittedAt),
    reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
    reviewedByUserId: request.reviewedByUserId ?? null,
    dismissedReason: request.dismissedReason ?? null,
    reviewAgingDecision: request.reviewAgingDecision ?? null,
    reviewAgingDecidedAt: request.reviewAgingDecidedAt
      ? new Date(request.reviewAgingDecidedAt)
      : null,
    reviewAgingDecidedByUserId: request.reviewAgingDecidedByUserId ?? null,
    reviewAgingCueStatus: request.reviewAgingCueStatus ?? null,
    reviewAgingAgeHours: request.reviewAgingAgeHours ?? null,
    metadata: request.metadata,
  };
}
