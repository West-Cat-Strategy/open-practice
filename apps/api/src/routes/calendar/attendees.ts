import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSessionToken } from "../../http/auth-helpers.js";
import { parseRequestPart } from "../../http/validation.js";
import {
  assertCalendarAccess,
  calendarEventParamsSchema,
  recordCalendarAuditEvent,
} from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

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

const calendarAttendeeDeleteQuerySchema = z.object({
  matterId: z.string().min(1),
});

export function registerCalendarAttendeeRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository } = dependencies;

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
}
