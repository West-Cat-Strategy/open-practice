import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  AppointmentBookingRequestRecord,
  PublicConsultationIntakeRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  AppointmentBookingLinkUnavailableError,
  AppointmentBookingSlotUnavailableError,
  type AppointmentBookingAgingReviewInput,
  type AppointmentBookingProfileListOptions,
  type AppointmentBookingRequestListOptions,
  type AppointmentBookingReviewInput,
  type AppointmentBookingReviewResult,
  type AppointmentBookingTentativeHoldInput,
  type AppointmentBookingTentativeHoldResult,
} from "../appointment-booking-contracts.js";
import { isPostgresUniqueViolation } from "../contracts.js";
import { mapCalendarEventAttendeeRow, mapCalendarEventRow } from "../drizzle-mappers.js";
import {
  mapPublicConsultationIntakeRow,
  publicConsultationIntakeInsert,
} from "../public-consultation-intakes/mappers.js";
import {
  appointmentBookingLinkInsert,
  appointmentBookingProfileInsert,
  appointmentBookingRequestInsert,
  mapAppointmentBookingLinkRow,
  mapAppointmentBookingProfileRow,
  mapAppointmentBookingRequestRow,
} from "./mappers.js";

function calendarEventInsert(
  event: CalendarEventRecord,
): typeof schema.calendarEvents.$inferInsert {
  return {
    id: event.id,
    firmId: event.firmId,
    scope: event.scope ?? "matter",
    matterId: event.matterId ?? null,
    clientContactId: event.clientContactId ?? null,
    uid: event.uid,
    title: event.title,
    startsAt: new Date(event.startsAt),
    endsAt: new Date(event.endsAt),
    description: event.description ?? null,
    location: event.location ?? null,
    status: event.status,
    sequence: event.sequence,
    meetingLinkMode: event.meetingLinkMode ?? "blank",
    meetingLinkUrl: event.meetingLinkUrl ?? null,
    meetingRoomId: event.meetingRoomId ?? null,
    meetingProviderKey: event.meetingProviderKey ?? null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
    deletedAt: event.deletedAt ? new Date(event.deletedAt) : null,
    createdByUserId: event.createdByUserId,
    updatedByUserId: event.updatedByUserId,
  };
}

function calendarEventAttendeeInsert(
  attendee: CalendarEventAttendeeRecord,
): typeof schema.calendarEventAttendees.$inferInsert {
  return {
    id: attendee.id,
    firmId: attendee.firmId,
    matterId: attendee.matterId,
    eventId: attendee.eventId,
    name: attendee.name,
    email: attendee.email,
    role: attendee.role,
    responseStatus: attendee.responseStatus,
    invitationStatus: attendee.invitationStatus,
    invitedAt: attendee.invitedAt ? new Date(attendee.invitedAt) : null,
    invitationEmailId: attendee.invitationEmailId ?? null,
    invitationJobId: attendee.invitationJobId ?? null,
    createdAt: new Date(attendee.createdAt),
    updatedAt: new Date(attendee.updatedAt),
    deletedAt: attendee.deletedAt ? new Date(attendee.deletedAt) : null,
    createdByUserId: attendee.createdByUserId,
    updatedByUserId: attendee.updatedByUserId,
  };
}

export async function listDrizzleAppointmentBookingProfiles(
  db: OpenPracticeDatabase,
  firmId: string,
  options: AppointmentBookingProfileListOptions = {},
) {
  const filters = [eq(schema.appointmentBookingProfiles.firmId, firmId)];
  if (options.status) filters.push(eq(schema.appointmentBookingProfiles.status, options.status));
  const rows = await db
    .select()
    .from(schema.appointmentBookingProfiles)
    .where(and(...filters))
    .orderBy(
      asc(schema.appointmentBookingProfiles.label),
      asc(schema.appointmentBookingProfiles.id),
    );
  return rows.map(mapAppointmentBookingProfileRow);
}

export async function getDrizzleAppointmentBookingProfile(
  db: OpenPracticeDatabase,
  firmId: string,
  profileId: string,
) {
  const [row] = await db
    .select()
    .from(schema.appointmentBookingProfiles)
    .where(
      and(
        eq(schema.appointmentBookingProfiles.firmId, firmId),
        eq(schema.appointmentBookingProfiles.id, profileId),
      ),
    );
  return row ? mapAppointmentBookingProfileRow(row) : undefined;
}

export async function upsertDrizzleAppointmentBookingProfile(
  db: OpenPracticeDatabase,
  profile: Parameters<typeof appointmentBookingProfileInsert>[0],
) {
  const values = appointmentBookingProfileInsert(profile);
  const [row] = await db
    .insert(schema.appointmentBookingProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: schema.appointmentBookingProfiles.id,
      set: {
        label: values.label,
        publicLabel: values.publicLabel,
        description: values.description,
        timezone: values.timezone,
        durationMinutes: values.durationMinutes,
        slotIntervalMinutes: values.slotIntervalMinutes,
        minLeadMinutes: values.minLeadMinutes,
        maxLeadDays: values.maxLeadDays,
        status: values.status,
        weeklyWindows: values.weeklyWindows,
        updatedAt: values.updatedAt,
        updatedByUserId: values.updatedByUserId,
      },
      setWhere: sql`${schema.appointmentBookingProfiles.firmId} = ${profile.firmId}`,
    })
    .returning();
  return mapAppointmentBookingProfileRow(row);
}

export async function createDrizzleAppointmentBookingLink(
  db: OpenPracticeDatabase,
  link: Parameters<typeof appointmentBookingLinkInsert>[0],
) {
  try {
    const [row] = await db
      .insert(schema.appointmentBookingLinks)
      .values(appointmentBookingLinkInsert(link))
      .returning();
    return mapAppointmentBookingLinkRow(row);
  } catch (error) {
    if (isPostgresUniqueViolation(error, "appointment_booking_links_token_hash_idx")) {
      throw new Error("Appointment booking link token hash already exists", { cause: error });
    }
    throw error;
  }
}

export async function getDrizzleAppointmentBookingLinkByTokenHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
) {
  const [row] = await db
    .select()
    .from(schema.appointmentBookingLinks)
    .where(eq(schema.appointmentBookingLinks.tokenHash, tokenHash));
  return row ? mapAppointmentBookingLinkRow(row) : undefined;
}

export async function listDrizzleAppointmentBookingRequests(
  db: OpenPracticeDatabase,
  firmId: string,
  options: AppointmentBookingRequestListOptions = {},
) {
  const filters = [eq(schema.appointmentBookingRequests.firmId, firmId)];
  if (options.status) filters.push(eq(schema.appointmentBookingRequests.status, options.status));
  if (options.matterId)
    filters.push(eq(schema.appointmentBookingRequests.matterId, options.matterId));
  const rows = await db
    .select()
    .from(schema.appointmentBookingRequests)
    .where(and(...filters))
    .orderBy(
      desc(schema.appointmentBookingRequests.submittedAt),
      asc(schema.appointmentBookingRequests.id),
    );
  return rows.map(mapAppointmentBookingRequestRow);
}

export async function getDrizzleAppointmentBookingRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  requestId: string,
) {
  const [row] = await db
    .select()
    .from(schema.appointmentBookingRequests)
    .where(
      and(
        eq(schema.appointmentBookingRequests.firmId, firmId),
        eq(schema.appointmentBookingRequests.id, requestId),
      ),
    );
  return row ? mapAppointmentBookingRequestRow(row) : undefined;
}

async function assertSlotAvailable(
  db: OpenPracticeDatabase,
  firmId: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  const [overlap] = await db
    .select({ id: schema.calendarEvents.id })
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.firmId, firmId),
        isNull(schema.calendarEvents.deletedAt),
        sql`${schema.calendarEvents.status} <> 'cancelled'`,
        sql`${schema.calendarEvents.startsAt} < ${new Date(endsAt)}`,
        sql`${schema.calendarEvents.endsAt} > ${new Date(startsAt)}`,
      ),
    )
    .limit(1);
  if (overlap) throw new AppointmentBookingSlotUnavailableError();
}

async function assertLinkAvailableForUse(
  db: OpenPracticeDatabase,
  firmId: string,
  linkId: string,
  usedAt: string,
): Promise<void> {
  const [link] = await db
    .select({
      id: schema.appointmentBookingLinks.id,
      usedAt: schema.appointmentBookingLinks.usedAt,
      revokedAt: schema.appointmentBookingLinks.revokedAt,
      expiresAt: schema.appointmentBookingLinks.expiresAt,
    })
    .from(schema.appointmentBookingLinks)
    .where(
      and(
        eq(schema.appointmentBookingLinks.firmId, firmId),
        eq(schema.appointmentBookingLinks.id, linkId),
      ),
    );
  if (!link) throw new AppointmentBookingLinkUnavailableError("not_found");
  if (link.revokedAt) throw new AppointmentBookingLinkUnavailableError("revoked");
  if (link.usedAt) throw new AppointmentBookingLinkUnavailableError("used");
  if (link.expiresAt.getTime() <= Date.parse(usedAt)) {
    throw new AppointmentBookingLinkUnavailableError("expired");
  }
}

export async function createDrizzleAppointmentBookingTentativeHold(
  db: OpenPracticeDatabase,
  input: AppointmentBookingTentativeHoldInput,
): Promise<AppointmentBookingTentativeHoldResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.profileId}, 0))`);
    const [profile] = await tx
      .select({ id: schema.appointmentBookingProfiles.id })
      .from(schema.appointmentBookingProfiles)
      .where(
        and(
          eq(schema.appointmentBookingProfiles.firmId, input.firmId),
          eq(schema.appointmentBookingProfiles.id, input.profileId),
        ),
      );
    if (!profile) throw new Error(`Appointment booking profile ${input.profileId} was not found`);
    if (input.linkId && input.usedAt) {
      await assertLinkAvailableForUse(
        tx as OpenPracticeDatabase,
        input.firmId,
        input.linkId,
        input.usedAt,
      );
    }
    await assertSlotAvailable(
      tx as OpenPracticeDatabase,
      input.firmId,
      input.startsAt,
      input.endsAt,
    );

    let publicConsultationIntake: PublicConsultationIntakeRecord | undefined;
    if (input.publicConsultationIntake) {
      const [intakeRow] = await tx
        .insert(schema.publicConsultationIntakes)
        .values(publicConsultationIntakeInsert(input.publicConsultationIntake))
        .returning();
      publicConsultationIntake = mapPublicConsultationIntakeRow(intakeRow);
    }

    const [eventRow] = await tx
      .insert(schema.calendarEvents)
      .values(calendarEventInsert(input.event))
      .returning();
    let attendee: CalendarEventAttendeeRecord | undefined;
    if (input.attendee) {
      const [attendeeRow] = await tx
        .insert(schema.calendarEventAttendees)
        .values(calendarEventAttendeeInsert(input.attendee))
        .returning();
      attendee = mapCalendarEventAttendeeRow(attendeeRow);
    }
    const [requestRow] = await tx
      .insert(schema.appointmentBookingRequests)
      .values(appointmentBookingRequestInsert(input.request))
      .returning();
    if (input.linkId && input.usedAt) {
      await tx
        .update(schema.appointmentBookingLinks)
        .set({
          usedAt: new Date(input.usedAt),
          updatedAt: new Date(input.usedAt),
        })
        .where(
          and(
            eq(schema.appointmentBookingLinks.firmId, input.firmId),
            eq(schema.appointmentBookingLinks.id, input.linkId),
          ),
        );
    }
    const event = {
      ...mapCalendarEventRow(eventRow),
      attendees: attendee ? [attendee] : [],
      reminders: [],
    };
    return {
      event,
      request: mapAppointmentBookingRequestRow(requestRow),
      publicConsultationIntake,
    };
  });
}

export async function reviewDrizzleAppointmentBookingRequest(
  db: OpenPracticeDatabase,
  input: AppointmentBookingReviewInput,
): Promise<AppointmentBookingReviewResult | undefined> {
  return db.transaction(async (tx) => {
    const [requestRow] = await tx
      .select()
      .from(schema.appointmentBookingRequests)
      .where(
        and(
          eq(schema.appointmentBookingRequests.firmId, input.firmId),
          eq(schema.appointmentBookingRequests.id, input.requestId),
        ),
      );
    if (!requestRow) return undefined;
    const [updatedRequestRow] = await tx
      .update(schema.appointmentBookingRequests)
      .set({
        status: input.status,
        reviewedAt: new Date(input.reviewedAt),
        reviewedByUserId: input.reviewedByUserId,
        dismissedReason: input.status === "dismissed" ? (input.dismissedReason ?? null) : null,
      })
      .where(
        and(
          eq(schema.appointmentBookingRequests.firmId, input.firmId),
          eq(schema.appointmentBookingRequests.id, input.requestId),
        ),
      )
      .returning();
    const [eventRow] = await tx
      .update(schema.calendarEvents)
      .set({
        status: input.status === "confirmed" ? "confirmed" : "cancelled",
        sequence: sql`${schema.calendarEvents.sequence} + 1`,
        updatedAt: new Date(input.reviewedAt),
        updatedByUserId: input.reviewedByUserId,
      })
      .where(
        and(
          eq(schema.calendarEvents.firmId, input.firmId),
          eq(schema.calendarEvents.id, requestRow.calendarEventId),
        ),
      )
      .returning();
    if (!updatedRequestRow || !eventRow) return undefined;
    return {
      request: mapAppointmentBookingRequestRow(updatedRequestRow),
      event: mapCalendarEventRow(eventRow),
    };
  });
}

export async function recordDrizzleAppointmentBookingAgingReviewDecision(
  db: OpenPracticeDatabase,
  input: AppointmentBookingAgingReviewInput,
): Promise<AppointmentBookingRequestRecord | undefined> {
  const [row] = await db
    .update(schema.appointmentBookingRequests)
    .set({
      reviewAgingDecision: input.decision,
      reviewAgingDecidedAt: new Date(input.decidedAt),
      reviewAgingDecidedByUserId: input.decidedByUserId,
      reviewAgingCueStatus: input.cueStatus,
      reviewAgingAgeHours: input.ageHours,
    })
    .where(
      and(
        eq(schema.appointmentBookingRequests.firmId, input.firmId),
        eq(schema.appointmentBookingRequests.id, input.requestId),
      ),
    )
    .returning();
  return row ? mapAppointmentBookingRequestRow(row) : undefined;
}
