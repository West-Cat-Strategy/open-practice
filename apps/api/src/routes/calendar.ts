import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  assertValidCalendarEventRange,
  buildCalendarMeetingInvitationBoundary,
  buildICalendarFeed,
  calendarMeetingInvitationBoundaryMetadata,
} from "@open-practice/domain";
import type {
  CalendarCredentialRecord,
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventReminderRecord,
  CalendarMeetingInvitationBoundary,
  CalendarMeetingLinkMode,
  NewAuditEvent,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashPassword } from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "./delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const calendarEventsQuerySchema = z.object({
  matterId: z.string().min(1),
  startsAfter: z.string().datetime().optional(),
  startsBefore: z.string().datetime().optional(),
});

const calendarFeedParamsSchema = z.object({
  matterId: z.string().min(1),
});

const calendarCredentialBodySchema = z.object({
  label: z.string().min(1).max(80).default("iOS Calendar"),
});

const calendarCredentialParamsSchema = z.object({
  id: z.string().min(1),
});

const calendarEventParamsSchema = z.object({
  eventId: z.string().min(1),
});

const calendarEventReminderParamsSchema = z.object({
  eventId: z.string().min(1),
  reminderId: z.string().min(1),
});

const calendarEventWriteBodySchema = z.object({
  matterId: z.string().min(1),
  title: z.string().min(1).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  description: z.string().max(2000).optional(),
  location: z.string().max(160).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).default("confirmed"),
});

const calendarEventPatchBodySchema = calendarEventWriteBodySchema.partial().extend({
  matterId: z.string().min(1),
});

const calendarEventCancelBodySchema = z.object({
  matterId: z.string().min(1),
});

const calendarEventRescheduleBodySchema = z.object({
  matterId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
});

const calendarEventReminderBodySchema = z.object({
  matterId: z.string().min(1),
  remindAt: z.string().datetime(),
  channel: z.literal("dashboard").default("dashboard"),
  status: z.enum(["pending", "acknowledged", "dismissed", "cancelled"]).default("pending"),
  note: z.string().max(240).optional(),
});

const calendarEventReminderPatchBodySchema = calendarEventReminderBodySchema.partial().extend({
  matterId: z.string().min(1),
});

const calendarEventReminderDeleteQuerySchema = z.object({
  matterId: z.string().min(1),
});

const calendarAttendeeParamsSchema = z.object({
  eventId: z.string().min(1),
  attendeeId: z.string().min(1),
});

const calendarAttendeeBodySchema = z.object({
  matterId: z.string().min(1),
  name: z.string().min(1).max(120),
  email: z.string().email().max(320),
  role: z.enum(["required", "optional"]).default("required"),
  responseStatus: z
    .enum(["needs_action", "accepted", "tentative", "declined"])
    .default("needs_action"),
});

const calendarAttendeePatchBodySchema = calendarAttendeeBodySchema.partial().extend({
  matterId: z.string().min(1),
});

const calendarInvitationBodySchema = z.object({
  matterId: z.string().min(1),
  attendeeIds: z.array(z.string().min(1)).optional(),
  includeMeetingLink: z.boolean().default(false),
  issueGuestAccessToken: z.boolean().default(false),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const calendarMeetingLinkBodySchema = z.discriminatedUnion("mode", [
  z.object({
    matterId: z.string().min(1),
    mode: z.literal("blank"),
  }),
  z.object({
    matterId: z.string().min(1),
    mode: z.literal("external_url"),
    url: z
      .string()
      .url()
      .refine((value) => value.startsWith("https://"), "Meeting links must use HTTPS"),
  }),
  z.object({
    matterId: z.string().min(1),
    mode: z.literal("hosted_webrtc"),
  }),
]);

const calendarAttendeeDeleteQuerySchema = z.object({
  matterId: z.string().min(1),
});

async function recordCalendarAuditEvent(
  repository: ApiRouteDependencies["repository"],
  event: Omit<NewAuditEvent, "id">,
): Promise<void> {
  await repository.appendAuditEvent({
    ...event,
    id: `audit-${createSessionToken().slice(0, 16)}`,
  });
}

function assertCalendarAccess(
  context: ApiAuthContext,
  matterId: string,
  action: "create" | "read" | "update" | "delete",
): void {
  const access = requireAccess(context, {
    resource: "calendar_event",
    action,
    matterId,
  });
  if (!access.ok) throw access.error;
}

function baseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : request.protocol;
  const host = request.headers.host ?? request.hostname;
  return `${proto}://${host}`;
}

function webcalSubscriptionUrl(request: FastifyRequest, matterId: string): string {
  const host = request.headers.host ?? request.hostname;
  return `webcal://${host}/api/calendar/matters/${encodeURIComponent(matterId)}.ics`;
}

function credentialResponse(credential: CalendarCredentialRecord) {
  return {
    id: credential.id,
    username: credential.username,
    label: credential.label,
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt,
    revokedAt: credential.revokedAt,
  };
}

function calendarInvitationText(
  event: CalendarEventRecord,
  attendee: CalendarEventAttendeeRecord,
  options: { includeMeetingLink?: boolean } = {},
): string {
  return [
    `You are invited to ${event.title}.`,
    `When: ${event.startsAt} to ${event.endsAt}.`,
    event.location ? `Location: ${event.location}.` : undefined,
    options.includeMeetingLink && event.meetingLinkUrl
      ? `Meeting link: ${event.meetingLinkUrl}.`
      : undefined,
    `Attendee: ${attendee.name} <${attendee.email}>.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function calendarMeetingInvitationBoundaryForRequest(
  { repository, emailJobQueue, meetingLinks }: ApiRouteDependencies,
  firmId: string,
): Promise<CalendarMeetingInvitationBoundary> {
  const smtpProviders = await repository.listProviderSettings(firmId, { kind: "smtp" });
  const enabledSmtp = smtpProviders.find((provider) => provider.enabled);
  return buildCalendarMeetingInvitationBoundary({
    meetingProviderKey: meetingLinks?.providerKey,
    guestAccessTokenSigningConfigured: meetingLinks?.guestAccessTokenSigningConfigured,
    invitationEmailProviderKey: enabledSmtp?.key,
    emailQueueConfigured: Boolean(emailJobQueue),
  });
}

function calendarEventResponse(
  event: CalendarEventRecord,
  meetingInvitationBoundary: CalendarMeetingInvitationBoundary,
): CalendarEventRecord {
  return {
    ...event,
    meetingInvitationBoundary,
  };
}

function assertCalendarEventRangeForRequest(startsAt: string, endsAt: string): void {
  try {
    assertValidCalendarEventRange(startsAt, endsAt);
  } catch {
    throw new ApiHttpError(
      400,
      "INVALID_CALENDAR_EVENT_RANGE",
      "Calendar event start must be before end",
    );
  }
}

function calendarEventAuditMetadata(event: CalendarEventRecord): Record<string, unknown> {
  return {
    matterId: event.matterId,
    eventId: event.id,
    uid: event.uid,
    status: event.status,
    sequence: event.sequence,
    attendeeCount: event.attendees?.length ?? 0,
    reminderCount: event.reminders?.length ?? 0,
  };
}

function calendarReminderAuditMetadata(
  reminder: CalendarEventReminderRecord,
): Record<string, unknown> {
  return {
    matterId: reminder.matterId,
    eventId: reminder.eventId,
    reminderId: reminder.id,
    channel: reminder.channel,
    status: reminder.status,
  };
}

function assertMeetingIssuanceAllowed(input: {
  includeMeetingLink: boolean;
  issueGuestAccessToken: boolean;
  event: CalendarEventRecord;
  meetingInvitationBoundary: CalendarMeetingInvitationBoundary;
}): void {
  if (input.includeMeetingLink && !input.event.meetingLinkUrl) {
    throw new ApiHttpError(
      400,
      "MEETING_LINK_NOT_AVAILABLE",
      "A meeting link is not set for this event",
    );
  }
  if (
    input.issueGuestAccessToken &&
    input.meetingInvitationBoundary.guestAccess.status !== "configured"
  ) {
    throw new ApiHttpError(
      503,
      "MEETING_GUEST_ACCESS_NOT_CONFIGURED",
      "Meeting guest access tokens are not configured",
    );
  }
}

function hostedMeetingUrl(baseUrl: string, roomId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(roomId)}`;
}

function nextMeetingLinkFields(input: {
  event: CalendarEventRecord;
  mode: CalendarMeetingLinkMode;
  hostedMeetingBaseUrl?: string;
  providerKey?: string;
  externalUrl?: string;
}): Pick<
  CalendarEventRecord,
  "meetingLinkMode" | "meetingLinkUrl" | "meetingRoomId" | "meetingProviderKey"
> {
  if (input.mode === "blank") {
    return {
      meetingLinkMode: "blank",
      meetingLinkUrl: undefined,
      meetingRoomId: undefined,
      meetingProviderKey: undefined,
    };
  }
  if (input.mode === "external_url") {
    return {
      meetingLinkMode: "external_url",
      meetingLinkUrl: input.externalUrl,
      meetingRoomId: undefined,
      meetingProviderKey: undefined,
    };
  }
  if (!input.hostedMeetingBaseUrl || !input.providerKey) {
    throw new ApiHttpError(
      503,
      "HOSTED_MEETING_NOT_CONFIGURED",
      "Hosted WebRTC meetings are not configured",
    );
  }
  const roomId =
    input.event.meetingLinkMode === "hosted_webrtc" && input.event.meetingRoomId
      ? input.event.meetingRoomId
      : `calendar-room-${createSessionToken().slice(0, 16)}`;
  return {
    meetingLinkMode: "hosted_webrtc",
    meetingLinkUrl: hostedMeetingUrl(input.hostedMeetingBaseUrl, roomId),
    meetingRoomId: roomId,
    meetingProviderKey: input.providerKey,
  };
}

export function registerCalendarRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository, emailJobQueue } = dependencies;

  server.get("/api/calendar/events", async (request) => {
    const query = parseRequestPart(calendarEventsQuerySchema, request.query, "query");
    assertCalendarAccess(request.auth, query.matterId, "read");
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );

    return {
      events: (await repository.listCalendarEvents(request.auth.firmId, query)).map((event) =>
        calendarEventResponse(event, meetingInvitationBoundary),
      ),
      caldavUrl: `${baseUrl(request)}/caldav`,
      subscriptionUrl: webcalSubscriptionUrl(request, query.matterId),
    };
  });

  server.post("/api/calendar/events", async (request, reply) => {
    const body = parseRequestPart(calendarEventWriteBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "create");
    assertCalendarEventRangeForRequest(body.startsAt, body.endsAt);
    const now = new Date().toISOString();
    const eventId = `calendar-event-${createSessionToken().slice(0, 16)}`;
    const event = await repository.upsertCalendarEvent({
      id: eventId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      uid: `${eventId}@open-practice.local`,
      title: body.title,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      description: body.description,
      location: body.location,
      status: body.status,
      sequence: 0,
      meetingLinkMode: "blank",
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.event.created",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: calendarEventAuditMetadata(event),
    });
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    return reply.code(201).send({ event: calendarEventResponse(event, meetingInvitationBoundary) });
  });

  server.patch("/api/calendar/events/:eventId", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventPatchBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const startsAt = body.startsAt ?? event.startsAt;
    const endsAt = body.endsAt ?? event.endsAt;
    assertCalendarEventRangeForRequest(startsAt, endsAt);
    const now = new Date().toISOString();
    const updated = await repository.upsertCalendarEvent({
      ...event,
      title: body.title ?? event.title,
      startsAt,
      endsAt,
      description: body.description ?? event.description,
      location: body.location ?? event.location,
      status: body.status ?? event.status,
      sequence: event.sequence + 1,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
      attendees: undefined,
      reminders: undefined,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.event.updated",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        ...calendarEventAuditMetadata(updated),
        startsAtChanged: startsAt !== event.startsAt,
        endsAtChanged: endsAt !== event.endsAt,
      },
    });
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    return { event: calendarEventResponse(updated, meetingInvitationBoundary) };
  });

  server.post("/api/calendar/events/:eventId/cancel", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventCancelBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const now = new Date().toISOString();
    const updated = await repository.upsertCalendarEvent({
      ...event,
      status: "cancelled",
      sequence: event.sequence + 1,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
      attendees: undefined,
      reminders: undefined,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.event.cancelled",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        ...calendarEventAuditMetadata(updated),
        previousStatus: event.status,
      },
    });
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    return { event: calendarEventResponse(updated, meetingInvitationBoundary) };
  });

  server.post("/api/calendar/events/:eventId/reschedule", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventRescheduleBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    assertCalendarEventRangeForRequest(body.startsAt, body.endsAt);
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const now = new Date().toISOString();
    const updated = await repository.upsertCalendarEvent({
      ...event,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: body.status ?? (event.status === "cancelled" ? "confirmed" : event.status),
      sequence: event.sequence + 1,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
      attendees: undefined,
      reminders: undefined,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.event.rescheduled",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        ...calendarEventAuditMetadata(updated),
        previousStatus: event.status,
        startsAtChanged: body.startsAt !== event.startsAt,
        endsAtChanged: body.endsAt !== event.endsAt,
      },
    });
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    return { event: calendarEventResponse(updated, meetingInvitationBoundary) };
  });

  server.post("/api/calendar/events/:eventId/reminders", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventReminderBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const now = new Date().toISOString();
    const reminder = await repository.upsertCalendarEventReminder({
      id: `calendar-reminder-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      eventId: event.id,
      remindAt: body.remindAt,
      channel: body.channel,
      status: body.status,
      note: body.note,
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.reminder.created",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: calendarReminderAuditMetadata(reminder),
    });
    return reply.code(201).send({ reminder });
  });

  server.patch("/api/calendar/events/:eventId/reminders/:reminderId", async (request, reply) => {
    const params = parseRequestPart(calendarEventReminderParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventReminderPatchBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const current = (
      await repository.listCalendarEventReminders(request.auth.firmId, body.matterId, event.id)
    ).find((reminder) => reminder.id === params.reminderId);
    if (!current) return reply.code(404).send({ error: "NotFound", message: "Reminder not found" });
    const now = new Date().toISOString();
    const reminder = await repository.upsertCalendarEventReminder({
      ...current,
      remindAt: body.remindAt ?? current.remindAt,
      channel: body.channel ?? current.channel,
      status: body.status ?? current.status,
      note: body.note ?? current.note,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.reminder.updated",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: calendarReminderAuditMetadata(reminder),
    });
    return { reminder };
  });

  server.delete("/api/calendar/events/:eventId/reminders/:reminderId", async (request, reply) => {
    const params = parseRequestPart(calendarEventReminderParamsSchema, request.params, "params");
    const query = parseRequestPart(calendarEventReminderDeleteQuerySchema, request.query, "query");
    assertCalendarAccess(request.auth, query.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      query.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const now = new Date().toISOString();
    const reminder = await repository.deleteCalendarEventReminder({
      firmId: request.auth.firmId,
      matterId: query.matterId,
      eventId: event.id,
      reminderId: params.reminderId,
      deletedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    if (!reminder) {
      return reply.code(404).send({ error: "NotFound", message: "Reminder not found" });
    }
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.reminder.deleted",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: calendarReminderAuditMetadata(reminder),
    });
    return { reminder };
  });

  server.post("/api/calendar/events/:eventId/attendees", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarAttendeeBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const now = new Date().toISOString();
    const attendee = await repository.upsertCalendarEventAttendee({
      id: `calendar-attendee-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      eventId: event.id,
      name: body.name,
      email: body.email,
      role: body.role,
      responseStatus: body.responseStatus,
      invitationStatus: "not_sent",
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.attendee.created",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        matterId: event.matterId,
        attendeeId: attendee.id,
        attendeeRole: attendee.role,
        responseStatus: attendee.responseStatus,
      },
    });
    return reply.code(201).send({ attendee });
  });

  server.patch("/api/calendar/events/:eventId/attendees/:attendeeId", async (request, reply) => {
    const params = parseRequestPart(calendarAttendeeParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarAttendeePatchBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const current = (
      await repository.listCalendarEventAttendees(request.auth.firmId, body.matterId, event.id)
    ).find((attendee) => attendee.id === params.attendeeId);
    if (!current) return reply.code(404).send({ error: "NotFound", message: "Attendee not found" });
    const now = new Date().toISOString();
    const attendee = await repository.upsertCalendarEventAttendee({
      ...current,
      name: body.name ?? current.name,
      email: body.email ?? current.email,
      role: body.role ?? current.role,
      responseStatus: body.responseStatus ?? current.responseStatus,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.attendee.updated",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        matterId: event.matterId,
        attendeeId: attendee.id,
        attendeeRole: attendee.role,
        responseStatus: attendee.responseStatus,
      },
    });
    return { attendee };
  });

  server.delete("/api/calendar/events/:eventId/attendees/:attendeeId", async (request, reply) => {
    const params = parseRequestPart(calendarAttendeeParamsSchema, request.params, "params");
    const query = parseRequestPart(calendarAttendeeDeleteQuerySchema, request.query, "query");
    assertCalendarAccess(request.auth, query.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      query.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const now = new Date().toISOString();
    const attendee = await repository.deleteCalendarEventAttendee({
      firmId: request.auth.firmId,
      matterId: query.matterId,
      eventId: event.id,
      attendeeId: params.attendeeId,
      deletedAt: now,
      updatedByUserId: request.auth.user.id,
    });
    if (!attendee) {
      return reply.code(404).send({ error: "NotFound", message: "Attendee not found" });
    }
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.attendee.deleted",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        matterId: event.matterId,
        attendeeId: attendee.id,
      },
    });
    return { attendee };
  });

  server.patch("/api/calendar/events/:eventId/meeting-link", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarMeetingLinkBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });

    const meetingLinkFields = nextMeetingLinkFields({
      event,
      mode: body.mode,
      hostedMeetingBaseUrl: dependencies.meetingLinks?.hostedMeetingBaseUrl,
      providerKey: dependencies.meetingLinks?.providerKey,
      externalUrl: body.mode === "external_url" ? body.url : undefined,
    });
    const now = new Date().toISOString();
    const updated = await repository.upsertCalendarEvent({
      ...event,
      ...meetingLinkFields,
      sequence: event.sequence + 1,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
      attendees: undefined,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.event.updated",
      resourceType: "calendar_event",
      resourceId: event.id,
      occurredAt: now,
      metadata: {
        matterId: event.matterId,
        eventId: event.id,
        meetingLinkMode: updated.meetingLinkMode ?? "blank",
        meetingProviderKey: updated.meetingProviderKey,
        hasMeetingLink: Boolean(updated.meetingLinkUrl),
      },
    });
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    return { event: calendarEventResponse(updated, meetingInvitationBoundary) };
  });

  server.post("/api/calendar/events/:eventId/invitations", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarInvitationBodySchema, request.body, "body");
    assertCalendarAccess(request.auth, body.matterId, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      body.matterId,
      params.eventId,
    );
    if (!event) return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    assertMeetingIssuanceAllowed({
      includeMeetingLink: body.includeMeetingLink,
      issueGuestAccessToken: body.issueGuestAccessToken,
      event,
      meetingInvitationBoundary,
    });
    const attendeeIds = new Set(body.attendeeIds ?? []);
    const attendees = (
      await repository.listCalendarEventAttendees(request.auth.firmId, body.matterId, event.id)
    ).filter((attendee) => attendeeIds.size === 0 || attendeeIds.has(attendee.id));
    requireEmailDeliveryConfirmation(body.deliveryConfirmation, {
      recipientCount: attendees.length,
    });
    const results = [];
    const boundaryMetadata = calendarMeetingInvitationBoundaryMetadata(meetingInvitationBoundary);
    for (const attendee of attendees) {
      const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
        matterId: event.matterId,
        templateKey: "calendar.invitation",
        to: [attendee.email],
        subject: `Calendar invitation: ${event.title}`,
        textBody: calendarInvitationText(event, attendee, {
          includeMeetingLink: body.includeMeetingLink,
        }),
        relatedResourceType: "calendar_event",
        relatedResourceId: event.id,
        metadata: {
          attendeeId: attendee.id,
          eventId: event.id,
          requestedMeetingLink: body.includeMeetingLink,
          meetingLinkMode: event.meetingLinkMode ?? "blank",
          meetingLinkIncluded: body.includeMeetingLink && Boolean(event.meetingLinkUrl),
          meetingProviderKey: event.meetingProviderKey,
          requestedGuestAccessToken: body.issueGuestAccessToken,
          ...boundaryMetadata,
        },
      });
      const queuedEmailWithAttemptMetadata = queuedEmail
        ? {
            ...queuedEmail,
            job: await repository.updateJobLifecycleRecord(
              request.auth.firmId,
              queuedEmail.job.id,
              {
                metadata: {
                  ...queuedEmail.job.metadata,
                  attendeeId: attendee.id,
                  eventId: event.id,
                  requestedMeetingLink: body.includeMeetingLink,
                  meetingLinkMode: event.meetingLinkMode ?? "blank",
                  meetingLinkIncluded: body.includeMeetingLink && Boolean(event.meetingLinkUrl),
                  meetingProviderKey: event.meetingProviderKey,
                  requestedGuestAccessToken: body.issueGuestAccessToken,
                  ...boundaryMetadata,
                },
              },
            ),
          }
        : undefined;
      const now = new Date().toISOString();
      const updated = await repository.upsertCalendarEventAttendee({
        ...attendee,
        invitationStatus: queuedEmailWithAttemptMetadata ? "queued" : "skipped",
        invitedAt: now,
        invitationEmailId: queuedEmailWithAttemptMetadata?.email.id,
        invitationJobId: queuedEmailWithAttemptMetadata?.job.id,
        updatedAt: now,
        updatedByUserId: request.auth.user.id,
      });
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: queuedEmailWithAttemptMetadata
          ? "calendar.invitation.queued"
          : "calendar.invitation.skipped",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          matterId: event.matterId,
          attendeeId: attendee.id,
          invitationStatus: updated.invitationStatus,
          emailId: queuedEmailWithAttemptMetadata?.email.id,
          jobId: queuedEmailWithAttemptMetadata?.job.id,
          requestedMeetingLink: body.includeMeetingLink,
          meetingLinkMode: event.meetingLinkMode ?? "blank",
          meetingLinkIncluded: body.includeMeetingLink && Boolean(event.meetingLinkUrl),
          meetingProviderKey: event.meetingProviderKey,
          requestedGuestAccessToken: body.issueGuestAccessToken,
          ...boundaryMetadata,
        },
      });
      results.push({
        attendee: updated,
        queuedEmail: summarizeQueuedRouteEmail(queuedEmailWithAttemptMetadata),
      });
    }
    return { results, meetingInvitationBoundary };
  });

  server.post("/api/calendar/credentials", async (request, reply) => {
    const body = parseRequestPart(calendarCredentialBodySchema, request.body ?? {}, "body");
    const now = new Date().toISOString();
    const credentialId = `calendar-credential-${createSessionToken().slice(0, 16)}`;
    const password = createSessionToken();
    const username = `${request.auth.firmId}.${request.auth.user.id}.${credentialId}`;
    const credential = await repository.createCalendarCredential({
      id: credentialId,
      firmId: request.auth.firmId,
      userId: request.auth.user.id,
      username,
      label: body.label,
      passwordHash: hashPassword(password),
      createdAt: now,
      createdByUserId: request.auth.user.id,
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.credential.created",
      resourceType: "calendar_credential",
      resourceId: credential.id,
      occurredAt: now,
      metadata: {
        label: credential.label,
        userId: credential.userId,
      },
    });

    return reply.code(201).send({
      credential: credentialResponse(credential),
      username,
      password,
      caldavUrl: `${baseUrl(request)}/caldav`,
      principalUrl: `${baseUrl(request)}/caldav/principals/${encodeURIComponent(username)}/`,
      calendarHomeUrl: `${baseUrl(request)}/caldav/calendars/${encodeURIComponent(username)}/`,
    });
  });

  server.get("/api/calendar/credentials", async (request) => ({
    credentials: (
      await repository.listCalendarCredentials(request.auth.firmId, request.auth.user.id)
    ).map(credentialResponse),
  }));

  server.post("/api/calendar/credentials/:id/revoke", async (request, reply) => {
    const params = parseRequestPart(calendarCredentialParamsSchema, request.params, "params");
    const credential = await repository.revokeCalendarCredential({
      firmId: request.auth.firmId,
      userId: request.auth.user.id,
      credentialId: params.id,
      revokedAt: new Date().toISOString(),
    });
    if (!credential)
      return reply.code(404).send({ error: "NotFound", message: "Credential not found" });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.credential.revoked",
      resourceType: "calendar_credential",
      resourceId: credential.id,
      occurredAt: credential.revokedAt ?? new Date().toISOString(),
      metadata: {
        label: credential.label,
        userId: credential.userId,
      },
    });
    return { credential: credentialResponse(credential) };
  });

  server.get("/api/calendar/matters/:matterId.ics", async (request, reply) => {
    const params = parseRequestPart(calendarFeedParamsSchema, request.params, "params");
    assertCalendarAccess(request.auth, params.matterId, "read");

    const events = await repository.listCalendarEvents(request.auth.firmId, {
      matterId: params.matterId,
    });
    return reply.type("text/calendar; charset=utf-8").send(
      buildICalendarFeed({
        events,
        calendarName: `Open Practice ${params.matterId}`,
        generatedAt: new Date().toISOString(),
      }),
    );
  });
}
