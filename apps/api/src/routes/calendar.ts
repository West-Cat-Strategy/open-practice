import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertValidCalendarEventRange,
  buildCalendarSchedulingRequestSummaries,
} from "@open-practice/domain";
import type { CalendarEventRecord } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken } from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { registerCalendarAttendeeRoutes } from "./calendar/attendees.js";
import { registerCalendarCredentialRoutes } from "./calendar/credentials.js";
import { registerCalendarFeedRoutes, webcalSubscriptionUrl } from "./calendar/feed.js";
import {
  calendarGuestSessionWithLinks,
  registerCalendarGuestSessionRoutes,
} from "./calendar/guest-sessions.js";
import { registerCalendarInvitationRoutes } from "./calendar/invitations.js";
import { registerCalendarMeetingLinkRoutes } from "./calendar/meeting-links.js";
import { registerCalendarReminderRoutes } from "./calendar/reminders.js";
import {
  assertCalendarScopeAccess,
  baseUrl,
  calendarEventResponse,
  calendarEventParamsSchema,
  calendarEventScope,
  calendarMeetingInvitationBoundaryForRequest,
  calendarScopeSchema,
  calendarScopeTarget,
  calendarScopeTargetMatchesEvent,
  recordCalendarAuditEvent,
  visibleCalendarClientContactIds,
} from "./calendar/shared.js";
import type { CalendarRouteDependencies } from "./calendar/shared.js";

const calendarEventsQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  scope: calendarScopeSchema.optional(),
  clientContactId: z.string().min(1).optional(),
  startsAfter: z.string().datetime().optional(),
  startsBefore: z.string().datetime().optional(),
});

const calendarEventWriteBodySchema = z.object({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  description: z.string().max(2000).optional(),
  location: z.string().max(160).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).default("confirmed"),
});

const calendarEventPatchBodySchema = calendarEventWriteBodySchema.partial().extend({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
});

const calendarEventCancelBodySchema = z.object({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
});

const calendarEventRescheduleBodySchema = z.object({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
});

function canReadTimeCapture(context: ApiAuthContext, matterId: string): boolean {
  return requireAccess(context, {
    resource: "time_entry",
    action: "read",
    matterId,
  }).ok;
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
    scope: calendarEventScope(event),
    matterId: event.matterId,
    clientContactId: event.clientContactId,
    eventId: event.id,
    uid: event.uid,
    status: event.status,
    sequence: event.sequence,
    attendeeCount: event.attendees?.length ?? 0,
    reminderCount: event.reminders?.length ?? 0,
  };
}

function sortCalendarEvents(events: CalendarEventRecord[]): CalendarEventRecord[] {
  return [...events].sort((left, right) => {
    const startsAtDifference = Date.parse(left.startsAt) - Date.parse(right.startsAt);
    return startsAtDifference === 0 ? left.id.localeCompare(right.id) : startsAtDifference;
  });
}

function matterlessCalendarLinks() {
  return {
    caldavUrl: "",
    subscriptionUrl: "",
  };
}

export function registerCalendarRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository } = dependencies;

  server.get("/api/calendar/events", async (request) => {
    const query = parseRequestPart(calendarEventsQuerySchema, request.query, "query");
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );

    if (query.matterId) {
      const target = calendarScopeTarget({
        scope: query.scope ?? "matter",
        matterId: query.matterId,
        clientContactId: query.clientContactId,
      });
      await assertCalendarScopeAccess(repository, request.auth, target, "read");
      const events = await repository.listCalendarEvents(request.auth.firmId, {
        matterId: query.matterId,
        startsAfter: query.startsAfter,
        startsBefore: query.startsBefore,
      });
      const schedulingRequests = await repository.listCalendarSchedulingRequests(
        request.auth.firmId,
        {
          matterId: query.matterId,
        },
      );
      const sessions = await repository.listCalendarMeetingSessions(request.auth.firmId, {
        matterId: query.matterId,
      });
      const eventsById = new Map(events.map((event) => [event.id, event]));

      return {
        events: events.map((event) => calendarEventResponse(event, meetingInvitationBoundary)),
        guestSessions: await Promise.all(
          sessions.map((session) =>
            calendarGuestSessionWithLinks(repository, session, eventsById.get(session.eventId)),
          ),
        ),
        schedulingRequests: buildCalendarSchedulingRequestSummaries({
          requests: schedulingRequests,
          events,
          includeTimeCapture: canReadTimeCapture(request.auth, query.matterId),
        }),
        caldavUrl: `${baseUrl(request)}/caldav`,
        subscriptionUrl: webcalSubscriptionUrl(request, query.matterId),
      };
    }

    if (query.scope === "matter") {
      throw new ApiHttpError(
        400,
        "CALENDAR_SCOPE_INVALID",
        "Matter calendar event queries require matterId",
      );
    }
    if (query.scope === "firm" && query.clientContactId) {
      throw new ApiHttpError(
        400,
        "CALENDAR_SCOPE_INVALID",
        "Firm calendar event queries cannot include clientContactId",
      );
    }

    if (query.scope === "client" || query.clientContactId) {
      const target = calendarScopeTarget({
        scope: "client",
        clientContactId: query.clientContactId,
      });
      await assertCalendarScopeAccess(repository, request.auth, target, "read");
      const events = await repository.listCalendarEvents(request.auth.firmId, {
        scopes: ["client"],
        clientContactIds: [target.clientContactId!],
        startsAfter: query.startsAfter,
        startsBefore: query.startsBefore,
      });
      return {
        events: events.map((event) => calendarEventResponse(event, meetingInvitationBoundary)),
        guestSessions: [],
        schedulingRequests: [],
        ...matterlessCalendarLinks(),
      };
    }

    await assertCalendarScopeAccess(
      repository,
      request.auth,
      calendarScopeTarget({ scope: "firm" }),
      "read",
    );
    const firmEvents = await repository.listCalendarEvents(request.auth.firmId, {
      scopes: ["firm"],
      startsAfter: query.startsAfter,
      startsBefore: query.startsBefore,
    });
    const visibleClientContactIds = await visibleCalendarClientContactIds(repository, request.auth);
    const clientEvents =
      query.scope === "firm" || visibleClientContactIds.length === 0
        ? []
        : await repository.listCalendarEvents(request.auth.firmId, {
            scopes: ["client"],
            clientContactIds: visibleClientContactIds,
            startsAfter: query.startsAfter,
            startsBefore: query.startsBefore,
          });
    const events = sortCalendarEvents([...firmEvents, ...clientEvents]);
    return {
      events: events.map((event) => calendarEventResponse(event, meetingInvitationBoundary)),
      guestSessions: [],
      schedulingRequests: [],
      ...matterlessCalendarLinks(),
    };
  });

  server.post("/api/calendar/events", async (request, reply) => {
    const body = parseRequestPart(calendarEventWriteBodySchema, request.body, "body");
    const target = calendarScopeTarget(body);
    await assertCalendarScopeAccess(repository, request.auth, target, "create");
    assertCalendarEventRangeForRequest(body.startsAt, body.endsAt);
    const now = new Date().toISOString();
    const eventId = `calendar-event-${createSessionToken().slice(0, 16)}`;
    const event = await repository.upsertCalendarEvent({
      id: eventId,
      firmId: request.auth.firmId,
      scope: target.scope,
      matterId: target.matterId,
      clientContactId: target.clientContactId,
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
    const target = calendarScopeTarget(body);
    await assertCalendarScopeAccess(repository, request.auth, target, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      target.matterId,
      params.eventId,
    );
    if (!event || !calendarScopeTargetMatchesEvent(target, event)) {
      return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    }
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
    const target = calendarScopeTarget(body);
    await assertCalendarScopeAccess(repository, request.auth, target, "update");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      target.matterId,
      params.eventId,
    );
    if (!event || !calendarScopeTargetMatchesEvent(target, event)) {
      return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    }
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
    const target = calendarScopeTarget(body);
    await assertCalendarScopeAccess(repository, request.auth, target, "update");
    assertCalendarEventRangeForRequest(body.startsAt, body.endsAt);
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      target.matterId,
      params.eventId,
    );
    if (!event || !calendarScopeTargetMatchesEvent(target, event)) {
      return reply.code(404).send({ error: "NotFound", message: "Event not found" });
    }
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

  registerCalendarReminderRoutes(server, dependencies);
  registerCalendarAttendeeRoutes(server, dependencies);
  registerCalendarMeetingLinkRoutes(server, dependencies);
  registerCalendarGuestSessionRoutes(server, dependencies);

  registerCalendarInvitationRoutes(server, dependencies);

  registerCalendarCredentialRoutes(server, dependencies);
  registerCalendarFeedRoutes(server, dependencies);
}
