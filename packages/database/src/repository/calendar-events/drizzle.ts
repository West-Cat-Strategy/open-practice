import {
  transitionCalendarGuestLinkStatus,
  transitionCalendarMeetingSessionStatus,
  type CalendarEventAttendeeRecord,
  type CalendarEventRecord,
  type CalendarEventReminderRecord,
  type CalendarGuestLinkRecord,
  type CalendarMeetingSessionRecord,
  type CalendarSchedulingRequestRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import {
  CalendarEventScopeConflictError,
  CalendarEventUidConflictError,
  type CalendarEventAttendeeDeleteInput,
  type CalendarEventAttendeeReplaceInput,
  type CalendarEventAttendeeUpsertInput,
  type CalendarEventDeleteInput,
  type CalendarEventListOptions,
  type CalendarEventReminderDeleteInput,
  type CalendarEventReminderUpsertInput,
  type CalendarEventUpsertInput,
  type CalendarGuestLinkCreateInput,
  type CalendarGuestLinkListOptions,
  type CalendarGuestLinkRevokeInput,
  type CalendarGuestLinkStatusUpdateInput,
  type CalendarMeetingSessionCreateInput,
  type CalendarMeetingSessionListOptions,
  type CalendarMeetingSessionStatusUpdateInput,
  type CalendarSchedulingRequestListOptions,
  type CalendarSchedulingRequestUpdateInput,
} from "../calendar-events-contracts.js";
import { isPostgresUniqueViolation } from "../contracts.js";
import {
  calendarGuestLinkInsert,
  calendarMeetingSessionInsert,
  mapCalendarEventAttendeeRow,
  mapCalendarEventReminderRow,
  mapCalendarEventRow,
  mapCalendarGuestLinkRow,
  mapCalendarMeetingSessionRow,
  mapCalendarSchedulingRequestRow,
} from "../drizzle-mappers.js";

async function attachDrizzleCalendarEventAttendees(
  db: OpenPracticeDatabase,
  events: CalendarEventRecord[],
): Promise<CalendarEventRecord[]> {
  if (events.length === 0) return events;
  const attendees = await db
    .select()
    .from(schema.calendarEventAttendees)
    .where(
      and(
        eq(schema.calendarEventAttendees.firmId, events[0]!.firmId),
        inArray(
          schema.calendarEventAttendees.eventId,
          events.map((event) => event.id),
        ),
        isNull(schema.calendarEventAttendees.deletedAt),
      ),
    )
    .orderBy(asc(schema.calendarEventAttendees.email));
  const attendeesByEventId = new Map<string, CalendarEventAttendeeRecord[]>();
  for (const attendee of attendees.map(mapCalendarEventAttendeeRow)) {
    const eventAttendees = attendeesByEventId.get(attendee.eventId) ?? [];
    eventAttendees.push(attendee);
    attendeesByEventId.set(attendee.eventId, eventAttendees);
  }
  return events.map((event) => ({
    ...event,
    attendees: attendeesByEventId.get(event.id) ?? [],
  }));
}

async function attachDrizzleCalendarEventReminders(
  db: OpenPracticeDatabase,
  events: CalendarEventRecord[],
): Promise<CalendarEventRecord[]> {
  if (events.length === 0) return events;
  const reminders = await db
    .select()
    .from(schema.calendarEventReminders)
    .where(
      and(
        eq(schema.calendarEventReminders.firmId, events[0]!.firmId),
        inArray(
          schema.calendarEventReminders.eventId,
          events.map((event) => event.id),
        ),
        isNull(schema.calendarEventReminders.deletedAt),
      ),
    )
    .orderBy(asc(schema.calendarEventReminders.remindAt), asc(schema.calendarEventReminders.id));
  const remindersByEventId = new Map<string, CalendarEventReminderRecord[]>();
  for (const reminder of reminders.map(mapCalendarEventReminderRow)) {
    const eventReminders = remindersByEventId.get(reminder.eventId) ?? [];
    eventReminders.push(reminder);
    remindersByEventId.set(reminder.eventId, eventReminders);
  }
  return events.map((event) => ({
    ...event,
    reminders: remindersByEventId.get(event.id) ?? [],
  }));
}

async function attachDrizzleCalendarEventChildren(
  db: OpenPracticeDatabase,
  events: CalendarEventRecord[],
): Promise<CalendarEventRecord[]> {
  return attachDrizzleCalendarEventReminders(
    db,
    await attachDrizzleCalendarEventAttendees(db, events),
  );
}

export async function listDrizzleCalendarEvents(
  db: OpenPracticeDatabase,
  firmId: string,
  options: CalendarEventListOptions,
): Promise<CalendarEventRecord[]> {
  const filters = [
    eq(schema.calendarEvents.firmId, firmId),
    isNull(schema.calendarEvents.deletedAt),
  ];
  if (!options.includeAllScopes) {
    if (options.matterId) {
      filters.push(eq(schema.calendarEvents.matterId, options.matterId));
    } else {
      filters.push(sql`${schema.calendarEvents.matterId} is null`);
    }
  }
  if (options.scopes?.length) {
    filters.push(inArray(schema.calendarEvents.scope, options.scopes));
  }
  if (options.clientContactIds?.length) {
    filters.push(inArray(schema.calendarEvents.clientContactId, options.clientContactIds));
  } else if (options.clientContactIds) {
    filters.push(sql`false`);
  } else if (options.scopes?.includes("client")) {
    filters.push(sql`${schema.calendarEvents.scope} <> 'client'`);
  }
  if (options.startsAfter) {
    filters.push(sql`${schema.calendarEvents.startsAt} >= ${new Date(options.startsAfter)}`);
  }
  if (options.startsBefore) {
    filters.push(sql`${schema.calendarEvents.startsAt} < ${new Date(options.startsBefore)}`);
  }
  const rows = await db
    .select()
    .from(schema.calendarEvents)
    .where(and(...filters))
    .orderBy(asc(schema.calendarEvents.startsAt), asc(schema.calendarEvents.id));
  return attachDrizzleCalendarEventChildren(db, rows.map(mapCalendarEventRow));
}

export async function getDrizzleCalendarEvent(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string | undefined,
  eventId: string,
): Promise<CalendarEventRecord | undefined> {
  const filters = [
    eq(schema.calendarEvents.firmId, firmId),
    eq(schema.calendarEvents.id, eventId),
    isNull(schema.calendarEvents.deletedAt),
  ];
  if (matterId !== undefined) {
    filters.push(eq(schema.calendarEvents.matterId, matterId));
  }
  const [row] = await db
    .select()
    .from(schema.calendarEvents)
    .where(and(...filters));
  if (!row) return undefined;
  return (await attachDrizzleCalendarEventChildren(db, [mapCalendarEventRow(row)]))[0];
}

export async function getDrizzleCalendarEventByUid(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
  uid: string,
): Promise<CalendarEventRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.firmId, firmId),
        eq(schema.calendarEvents.matterId, matterId),
        eq(schema.calendarEvents.uid, uid),
        isNull(schema.calendarEvents.deletedAt),
      ),
    );
  if (!row) return undefined;
  return (await attachDrizzleCalendarEventChildren(db, [mapCalendarEventRow(row)]))[0];
}

export async function upsertDrizzleCalendarEvent(
  db: OpenPracticeDatabase,
  event: CalendarEventUpsertInput,
): Promise<CalendarEventRecord> {
  const values = {
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
  const [eventIdCollision] = await db
    .select()
    .from(schema.calendarEvents)
    .where(eq(schema.calendarEvents.id, event.id));
  if (
    eventIdCollision &&
    (eventIdCollision.firmId !== event.firmId ||
      eventIdCollision.scope !== (event.scope ?? "matter") ||
      eventIdCollision.matterId !== (event.matterId ?? null) ||
      eventIdCollision.clientContactId !== (event.clientContactId ?? null))
  ) {
    throw new CalendarEventScopeConflictError(event.id);
  }

  const [activeUidCollision] = await db
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.firmId, event.firmId),
        eq(schema.calendarEvents.scope, event.scope ?? "matter"),
        event.matterId
          ? eq(schema.calendarEvents.matterId, event.matterId)
          : sql`${schema.calendarEvents.matterId} is null`,
        event.clientContactId
          ? eq(schema.calendarEvents.clientContactId, event.clientContactId)
          : sql`${schema.calendarEvents.clientContactId} is null`,
        eq(schema.calendarEvents.uid, event.uid),
        isNull(schema.calendarEvents.deletedAt),
      ),
    );
  if (activeUidCollision && activeUidCollision.id !== event.id) {
    throw new CalendarEventUidConflictError(event.uid);
  }

  let row: typeof schema.calendarEvents.$inferSelect | undefined;
  try {
    [row] = await db
      .insert(schema.calendarEvents)
      .values(values)
      .onConflictDoUpdate({
        target: schema.calendarEvents.id,
        set: {
          uid: values.uid,
          scope: values.scope,
          matterId: values.matterId,
          clientContactId: values.clientContactId,
          title: values.title,
          startsAt: values.startsAt,
          endsAt: values.endsAt,
          description: values.description,
          location: values.location,
          status: values.status,
          sequence: values.sequence,
          meetingLinkMode: values.meetingLinkMode,
          meetingLinkUrl: values.meetingLinkUrl,
          meetingRoomId: values.meetingRoomId,
          meetingProviderKey: values.meetingProviderKey,
          updatedAt: values.updatedAt,
          deletedAt: values.deletedAt,
          updatedByUserId: values.updatedByUserId,
        },
        setWhere: sql`${schema.calendarEvents.firmId} = ${event.firmId}`,
      })
      .returning();
  } catch (error) {
    if (
      isPostgresUniqueViolation(error, "calendar_events_firm_matter_uid_idx") ||
      isPostgresUniqueViolation(error, "calendar_events_firm_scope_uid_idx") ||
      isPostgresUniqueViolation(error, "calendar_events_firm_client_uid_idx")
    ) {
      throw new CalendarEventUidConflictError(event.uid);
    }
    throw error;
  }
  if (!row) {
    throw new CalendarEventScopeConflictError(event.id);
  }
  return (await attachDrizzleCalendarEventChildren(db, [mapCalendarEventRow(row)]))[0]!;
}

export async function listDrizzleCalendarEventAttendees(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
  eventId: string,
): Promise<CalendarEventAttendeeRecord[]> {
  const rows = await db
    .select()
    .from(schema.calendarEventAttendees)
    .where(
      and(
        eq(schema.calendarEventAttendees.firmId, firmId),
        eq(schema.calendarEventAttendees.matterId, matterId),
        eq(schema.calendarEventAttendees.eventId, eventId),
        isNull(schema.calendarEventAttendees.deletedAt),
      ),
    )
    .orderBy(asc(schema.calendarEventAttendees.email));
  return rows.map(mapCalendarEventAttendeeRow);
}

export async function upsertDrizzleCalendarEventAttendee(
  db: OpenPracticeDatabase,
  attendee: CalendarEventAttendeeUpsertInput,
): Promise<CalendarEventAttendeeRecord> {
  const values = {
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
  const [row] = await db
    .insert(schema.calendarEventAttendees)
    .values(values)
    .onConflictDoUpdate({
      target: schema.calendarEventAttendees.id,
      set: {
        name: values.name,
        email: values.email,
        role: values.role,
        responseStatus: values.responseStatus,
        invitationStatus: values.invitationStatus,
        invitedAt: values.invitedAt,
        invitationEmailId: values.invitationEmailId,
        invitationJobId: values.invitationJobId,
        updatedAt: values.updatedAt,
        deletedAt: values.deletedAt,
        updatedByUserId: values.updatedByUserId,
      },
      setWhere: sql`${schema.calendarEventAttendees.firmId} = ${attendee.firmId} and ${schema.calendarEventAttendees.matterId} = ${attendee.matterId} and ${schema.calendarEventAttendees.eventId} = ${attendee.eventId}`,
    })
    .returning();
  if (!row) {
    throw new Error(`Calendar attendee ${attendee.id} already exists in another scope`);
  }
  return mapCalendarEventAttendeeRow(row);
}

export async function deleteDrizzleCalendarEventAttendee(
  db: OpenPracticeDatabase,
  input: CalendarEventAttendeeDeleteInput,
): Promise<CalendarEventAttendeeRecord | undefined> {
  const [row] = await db
    .update(schema.calendarEventAttendees)
    .set({
      deletedAt: new Date(input.deletedAt),
      updatedAt: new Date(input.deletedAt),
      updatedByUserId: input.updatedByUserId,
    })
    .where(
      and(
        eq(schema.calendarEventAttendees.firmId, input.firmId),
        eq(schema.calendarEventAttendees.matterId, input.matterId),
        eq(schema.calendarEventAttendees.eventId, input.eventId),
        eq(schema.calendarEventAttendees.id, input.attendeeId),
        isNull(schema.calendarEventAttendees.deletedAt),
      ),
    )
    .returning();
  return row ? mapCalendarEventAttendeeRow(row) : undefined;
}

export async function replaceDrizzleCalendarEventAttendees(
  db: OpenPracticeDatabase,
  input: CalendarEventAttendeeReplaceInput,
): Promise<CalendarEventAttendeeRecord[]> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.calendarEventAttendees)
      .set({
        deletedAt: new Date(input.replacedAt),
        updatedAt: new Date(input.replacedAt),
        updatedByUserId: input.updatedByUserId,
      })
      .where(
        and(
          eq(schema.calendarEventAttendees.firmId, input.firmId),
          eq(schema.calendarEventAttendees.matterId, input.matterId),
          eq(schema.calendarEventAttendees.eventId, input.eventId),
          isNull(schema.calendarEventAttendees.deletedAt),
        ),
      );
    if (input.attendees.length > 0) {
      await tx.insert(schema.calendarEventAttendees).values(
        input.attendees.map((attendee) => ({
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
        })),
      );
    }
  });
  return listDrizzleCalendarEventAttendees(db, input.firmId, input.matterId, input.eventId);
}

export async function listDrizzleCalendarEventReminders(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string | undefined,
  eventId: string,
): Promise<CalendarEventReminderRecord[]> {
  const filters = [
    eq(schema.calendarEventReminders.firmId, firmId),
    eq(schema.calendarEventReminders.eventId, eventId),
    isNull(schema.calendarEventReminders.deletedAt),
  ];
  if (matterId !== undefined) {
    filters.push(eq(schema.calendarEventReminders.matterId, matterId));
  }
  const rows = await db
    .select()
    .from(schema.calendarEventReminders)
    .where(and(...filters))
    .orderBy(asc(schema.calendarEventReminders.remindAt), asc(schema.calendarEventReminders.id));
  return rows.map(mapCalendarEventReminderRow);
}

export async function upsertDrizzleCalendarEventReminder(
  db: OpenPracticeDatabase,
  reminder: CalendarEventReminderUpsertInput,
): Promise<CalendarEventReminderRecord> {
  const values = {
    id: reminder.id,
    firmId: reminder.firmId,
    scope: reminder.scope ?? "matter",
    matterId: reminder.matterId ?? null,
    clientContactId: reminder.clientContactId ?? null,
    eventId: reminder.eventId,
    remindAt: new Date(reminder.remindAt),
    channel: reminder.channel,
    status: reminder.status,
    note: reminder.note ?? null,
    createdAt: new Date(reminder.createdAt),
    updatedAt: new Date(reminder.updatedAt),
    deletedAt: reminder.deletedAt ? new Date(reminder.deletedAt) : null,
    createdByUserId: reminder.createdByUserId,
    updatedByUserId: reminder.updatedByUserId,
  };
  const [row] = await db
    .insert(schema.calendarEventReminders)
    .values(values)
    .onConflictDoUpdate({
      target: schema.calendarEventReminders.id,
      set: {
        remindAt: values.remindAt,
        scope: values.scope,
        matterId: values.matterId,
        clientContactId: values.clientContactId,
        channel: values.channel,
        status: values.status,
        note: values.note,
        updatedAt: values.updatedAt,
        deletedAt: values.deletedAt,
        updatedByUserId: values.updatedByUserId,
      },
      setWhere: sql`${schema.calendarEventReminders.firmId} = ${reminder.firmId} and ${schema.calendarEventReminders.eventId} = ${reminder.eventId}`,
    })
    .returning();
  if (!row) {
    throw new Error(`Calendar reminder ${reminder.id} already exists in another scope`);
  }
  return mapCalendarEventReminderRow(row);
}

export async function createDrizzleCalendarSchedulingRequest(
  db: OpenPracticeDatabase,
  request: CalendarSchedulingRequestRecord,
): Promise<CalendarSchedulingRequestRecord> {
  const [row] = await db
    .insert(schema.calendarSchedulingRequests)
    .values({
      id: request.id,
      firmId: request.firmId,
      matterId: request.matterId,
      kind: request.kind,
      status: request.status,
      title: request.title,
      taskId: request.taskId ?? null,
      calendarEventId: request.calendarEventId ?? null,
      calendarReminderId: request.calendarReminderId ?? null,
      ownerUserId: request.ownerUserId ?? null,
      sourceType: request.sourceType,
      sourceId: request.sourceId ?? null,
      sourceLabel: request.sourceLabel,
      requestedDueAt: request.requestedDueAt ? new Date(request.requestedDueAt) : null,
      requestedStartsAt: request.requestedStartsAt ? new Date(request.requestedStartsAt) : null,
      requestedEndsAt: request.requestedEndsAt ? new Date(request.requestedEndsAt) : null,
      reminderPosture: request.reminderPosture,
      privacy: request.privacy,
      timeCaptureCue: request.timeCaptureCue,
      createdAt: new Date(request.createdAt),
      updatedAt: new Date(request.updatedAt),
      createdByUserId: request.createdByUserId,
      updatedByUserId: request.updatedByUserId,
      reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
      reviewedByUserId: request.reviewedByUserId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    const [existing] = await db
      .select()
      .from(schema.calendarSchedulingRequests)
      .where(
        and(
          eq(schema.calendarSchedulingRequests.firmId, request.firmId),
          eq(schema.calendarSchedulingRequests.id, request.id),
        ),
      );
    if (!existing) {
      throw new Error(`Calendar scheduling request ${request.id} already exists in another firm`);
    }
    return mapCalendarSchedulingRequestRow(existing);
  }
  return mapCalendarSchedulingRequestRow(row);
}

export async function listDrizzleCalendarSchedulingRequests(
  db: OpenPracticeDatabase,
  firmId: string,
  options: CalendarSchedulingRequestListOptions = {},
): Promise<CalendarSchedulingRequestRecord[]> {
  const filters = [eq(schema.calendarSchedulingRequests.firmId, firmId)];
  if (options.matterId) {
    filters.push(eq(schema.calendarSchedulingRequests.matterId, options.matterId));
  }
  if (options.status) {
    filters.push(eq(schema.calendarSchedulingRequests.status, options.status));
  }
  if (options.ownerUserId) {
    filters.push(eq(schema.calendarSchedulingRequests.ownerUserId, options.ownerUserId));
  }
  const rows = await db
    .select()
    .from(schema.calendarSchedulingRequests)
    .where(and(...filters))
    .orderBy(
      asc(schema.calendarSchedulingRequests.requestedDueAt),
      asc(schema.calendarSchedulingRequests.requestedStartsAt),
      asc(schema.calendarSchedulingRequests.createdAt),
      asc(schema.calendarSchedulingRequests.id),
    );
  return rows.map(mapCalendarSchedulingRequestRow);
}

export async function getDrizzleCalendarSchedulingRequest(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
  requestId: string,
): Promise<CalendarSchedulingRequestRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.calendarSchedulingRequests)
    .where(
      and(
        eq(schema.calendarSchedulingRequests.firmId, firmId),
        eq(schema.calendarSchedulingRequests.matterId, matterId),
        eq(schema.calendarSchedulingRequests.id, requestId),
      ),
    );
  return row ? mapCalendarSchedulingRequestRow(row) : undefined;
}

export async function updateDrizzleCalendarSchedulingRequestReview(
  db: OpenPracticeDatabase,
  input: CalendarSchedulingRequestUpdateInput,
): Promise<CalendarSchedulingRequestRecord | undefined> {
  const [row] = await db
    .update(schema.calendarSchedulingRequests)
    .set({
      status: input.status,
      calendarEventId: input.calendarEventId === undefined ? undefined : input.calendarEventId,
      reviewedAt: new Date(input.reviewedAt),
      reviewedByUserId: input.reviewedByUserId,
      updatedAt: new Date(input.reviewedAt),
      updatedByUserId: input.reviewedByUserId,
    })
    .where(
      and(
        eq(schema.calendarSchedulingRequests.firmId, input.firmId),
        eq(schema.calendarSchedulingRequests.matterId, input.matterId),
        eq(schema.calendarSchedulingRequests.id, input.requestId),
      ),
    )
    .returning();
  return row ? mapCalendarSchedulingRequestRow(row) : undefined;
}

export async function deleteDrizzleCalendarEventReminder(
  db: OpenPracticeDatabase,
  input: CalendarEventReminderDeleteInput,
): Promise<CalendarEventReminderRecord | undefined> {
  const [row] = await db
    .update(schema.calendarEventReminders)
    .set({
      deletedAt: new Date(input.deletedAt),
      updatedAt: new Date(input.deletedAt),
      updatedByUserId: input.updatedByUserId,
    })
    .where(
      and(
        eq(schema.calendarEventReminders.firmId, input.firmId),
        eq(schema.calendarEventReminders.scope, input.scope ?? "matter"),
        input.matterId
          ? eq(schema.calendarEventReminders.matterId, input.matterId)
          : sql`${schema.calendarEventReminders.matterId} is null`,
        input.clientContactId
          ? eq(schema.calendarEventReminders.clientContactId, input.clientContactId)
          : sql`${schema.calendarEventReminders.clientContactId} is null`,
        eq(schema.calendarEventReminders.eventId, input.eventId),
        eq(schema.calendarEventReminders.id, input.reminderId),
        isNull(schema.calendarEventReminders.deletedAt),
      ),
    )
    .returning();
  return row ? mapCalendarEventReminderRow(row) : undefined;
}

export async function deleteDrizzleCalendarEvent(
  db: OpenPracticeDatabase,
  input: CalendarEventDeleteInput,
): Promise<CalendarEventRecord | undefined> {
  const matterId = input.matterId;
  const [existing] = await db
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.firmId, input.firmId),
        matterId
          ? eq(schema.calendarEvents.matterId, matterId)
          : sql`${schema.calendarEvents.matterId} is null`,
        eq(schema.calendarEvents.id, input.eventId),
        isNull(schema.calendarEvents.deletedAt),
      ),
    );
  if (!existing) return undefined;
  const [row] = await db
    .update(schema.calendarEvents)
    .set({
      deletedAt: new Date(input.deletedAt),
      updatedAt: new Date(input.deletedAt),
      updatedByUserId: input.updatedByUserId,
      sequence: existing.sequence + 1,
    })
    .where(
      and(
        eq(schema.calendarEvents.firmId, input.firmId),
        matterId
          ? eq(schema.calendarEvents.matterId, matterId)
          : sql`${schema.calendarEvents.matterId} is null`,
        eq(schema.calendarEvents.id, input.eventId),
        isNull(schema.calendarEvents.deletedAt),
      ),
    )
    .returning();
  return row ? mapCalendarEventRow(row) : undefined;
}

export async function createDrizzleCalendarMeetingSession(
  db: OpenPracticeDatabase,
  session: CalendarMeetingSessionCreateInput,
): Promise<CalendarMeetingSessionRecord> {
  const [eventRow] = await db
    .select({ id: schema.calendarEvents.id })
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.firmId, session.firmId),
        eq(schema.calendarEvents.matterId, session.matterId),
        eq(schema.calendarEvents.id, session.eventId),
        isNull(schema.calendarEvents.deletedAt),
      ),
    );
  if (!eventRow) {
    throw new Error(`Calendar event ${session.eventId} was not found`);
  }
  const [row] = await db
    .insert(schema.calendarMeetingSessions)
    .values(calendarMeetingSessionInsert(session))
    .returning();
  return mapCalendarMeetingSessionRow(row);
}

export async function listDrizzleCalendarMeetingSessions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: CalendarMeetingSessionListOptions = {},
): Promise<CalendarMeetingSessionRecord[]> {
  const conditions = [eq(schema.calendarMeetingSessions.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.calendarMeetingSessions.matterId, options.matterId));
  }
  if (options.eventId) {
    conditions.push(eq(schema.calendarMeetingSessions.eventId, options.eventId));
  }
  if (options.status) {
    conditions.push(eq(schema.calendarMeetingSessions.status, options.status));
  }
  const rows = await db
    .select()
    .from(schema.calendarMeetingSessions)
    .where(and(...conditions))
    .orderBy(
      desc(schema.calendarMeetingSessions.createdAt),
      asc(schema.calendarMeetingSessions.id),
    );
  return rows.map(mapCalendarMeetingSessionRow);
}

export async function getDrizzleCalendarMeetingSession(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
  eventId: string,
  sessionId: string,
): Promise<CalendarMeetingSessionRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.calendarMeetingSessions)
    .where(
      and(
        eq(schema.calendarMeetingSessions.firmId, firmId),
        eq(schema.calendarMeetingSessions.matterId, matterId),
        eq(schema.calendarMeetingSessions.eventId, eventId),
        eq(schema.calendarMeetingSessions.id, sessionId),
      ),
    );
  return row ? mapCalendarMeetingSessionRow(row) : undefined;
}

export async function updateDrizzleCalendarMeetingSessionStatus(
  db: OpenPracticeDatabase,
  input: CalendarMeetingSessionStatusUpdateInput,
): Promise<CalendarMeetingSessionRecord | undefined> {
  const existing = await getDrizzleCalendarMeetingSession(
    db,
    input.firmId,
    input.matterId,
    input.eventId,
    input.sessionId,
  );
  if (!existing) return undefined;
  const updated = transitionCalendarMeetingSessionStatus(existing, {
    status: input.status,
    occurredAt: input.occurredAt,
    actorUserId: input.actorUserId,
  });
  const [row] = await db
    .update(schema.calendarMeetingSessions)
    .set({
      status: updated.status,
      updatedAt: new Date(updated.updatedAt),
      updatedByUserId: updated.updatedByUserId,
      endedAt: updated.endedAt ? new Date(updated.endedAt) : null,
    })
    .where(
      and(
        eq(schema.calendarMeetingSessions.firmId, input.firmId),
        eq(schema.calendarMeetingSessions.matterId, input.matterId),
        eq(schema.calendarMeetingSessions.eventId, input.eventId),
        eq(schema.calendarMeetingSessions.id, input.sessionId),
      ),
    )
    .returning();
  return row ? mapCalendarMeetingSessionRow(row) : undefined;
}

export async function createDrizzleCalendarGuestLink(
  db: OpenPracticeDatabase,
  link: CalendarGuestLinkCreateInput,
): Promise<CalendarGuestLinkRecord> {
  const session = await getDrizzleCalendarMeetingSession(
    db,
    link.firmId,
    link.matterId,
    link.eventId,
    link.sessionId,
  );
  if (!session) {
    throw new Error(`Calendar meeting session ${link.sessionId} was not found`);
  }
  try {
    const [row] = await db
      .insert(schema.calendarGuestLinks)
      .values(calendarGuestLinkInsert(link))
      .returning();
    return mapCalendarGuestLinkRow(row);
  } catch (error) {
    if (isPostgresUniqueViolation(error, "calendar_guest_links_token_hash_idx")) {
      throw new Error("Calendar guest link token hash already exists", { cause: error });
    }
    throw error;
  }
}

export async function listDrizzleCalendarGuestLinks(
  db: OpenPracticeDatabase,
  firmId: string,
  options: CalendarGuestLinkListOptions = {},
): Promise<CalendarGuestLinkRecord[]> {
  const conditions = [eq(schema.calendarGuestLinks.firmId, firmId)];
  if (options.matterId) {
    conditions.push(eq(schema.calendarGuestLinks.matterId, options.matterId));
  }
  if (options.eventId) {
    conditions.push(eq(schema.calendarGuestLinks.eventId, options.eventId));
  }
  if (options.sessionId) {
    conditions.push(eq(schema.calendarGuestLinks.sessionId, options.sessionId));
  }
  if (options.status) {
    conditions.push(eq(schema.calendarGuestLinks.status, options.status));
  }
  const rows = await db
    .select()
    .from(schema.calendarGuestLinks)
    .where(and(...conditions))
    .orderBy(desc(schema.calendarGuestLinks.createdAt), asc(schema.calendarGuestLinks.id));
  return rows.map(mapCalendarGuestLinkRow);
}

export async function getDrizzleCalendarGuestLink(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
  eventId: string,
  sessionId: string,
  linkId: string,
): Promise<CalendarGuestLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.calendarGuestLinks)
    .where(
      and(
        eq(schema.calendarGuestLinks.firmId, firmId),
        eq(schema.calendarGuestLinks.matterId, matterId),
        eq(schema.calendarGuestLinks.eventId, eventId),
        eq(schema.calendarGuestLinks.sessionId, sessionId),
        eq(schema.calendarGuestLinks.id, linkId),
      ),
    );
  return row ? mapCalendarGuestLinkRow(row) : undefined;
}

export async function getDrizzleCalendarGuestLinkByTokenHash(
  db: OpenPracticeDatabase,
  tokenHash: string,
): Promise<CalendarGuestLinkRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.calendarGuestLinks)
    .where(eq(schema.calendarGuestLinks.tokenHash, tokenHash));
  return row ? mapCalendarGuestLinkRow(row) : undefined;
}

export async function updateDrizzleCalendarGuestLinkStatus(
  db: OpenPracticeDatabase,
  input: CalendarGuestLinkStatusUpdateInput,
): Promise<CalendarGuestLinkRecord | undefined> {
  const existing = await getDrizzleCalendarGuestLink(
    db,
    input.firmId,
    input.matterId,
    input.eventId,
    input.sessionId,
    input.linkId,
  );
  if (!existing) return undefined;
  const updated = transitionCalendarGuestLinkStatus(existing, {
    status: input.status,
    occurredAt: input.occurredAt,
    actorUserId: input.actorUserId,
  });
  const [row] = await db
    .update(schema.calendarGuestLinks)
    .set({
      status: updated.status,
      updatedAt: new Date(updated.updatedAt),
      updatedByUserId: updated.updatedByUserId ?? null,
      checkedInAt: updated.checkedInAt ? new Date(updated.checkedInAt) : null,
      revokedAt: updated.revokedAt ? new Date(updated.revokedAt) : null,
      admittedAt: updated.admittedAt ? new Date(updated.admittedAt) : null,
      deniedAt: updated.deniedAt ? new Date(updated.deniedAt) : null,
    })
    .where(
      and(
        eq(schema.calendarGuestLinks.firmId, input.firmId),
        eq(schema.calendarGuestLinks.matterId, input.matterId),
        eq(schema.calendarGuestLinks.eventId, input.eventId),
        eq(schema.calendarGuestLinks.sessionId, input.sessionId),
        eq(schema.calendarGuestLinks.id, input.linkId),
      ),
    )
    .returning();
  return row ? mapCalendarGuestLinkRow(row) : undefined;
}

export function revokeDrizzleCalendarGuestLink(
  db: OpenPracticeDatabase,
  input: CalendarGuestLinkRevokeInput,
): Promise<CalendarGuestLinkRecord | undefined> {
  return updateDrizzleCalendarGuestLinkStatus(db, {
    firmId: input.firmId,
    matterId: input.matterId,
    eventId: input.eventId,
    sessionId: input.sessionId,
    linkId: input.linkId,
    status: "revoked",
    occurredAt: input.revokedAt,
    actorUserId: input.actorUserId,
  });
}
