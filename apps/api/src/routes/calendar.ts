import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildICalendarFeed } from "@open-practice/domain";
import type {
  CalendarCredentialRecord,
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  NewAuditEvent,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashPassword } from "../http/auth-helpers.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
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
});

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
): string {
  return [
    `You are invited to ${event.title}.`,
    `When: ${event.startsAt} to ${event.endsAt}.`,
    event.location ? `Location: ${event.location}.` : undefined,
    `Attendee: ${attendee.name} <${attendee.email}>.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function registerCalendarRoutes(
  server: FastifyInstance,
  { repository, emailJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/calendar/events", async (request) => {
    const query = parseRequestPart(calendarEventsQuerySchema, request.query, "query");
    assertCalendarAccess(request.auth, query.matterId, "read");

    return {
      events: await repository.listCalendarEvents(request.auth.firmId, query),
      caldavUrl: `${baseUrl(request)}/caldav`,
      subscriptionUrl: webcalSubscriptionUrl(request, query.matterId),
    };
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
    const attendeeIds = new Set(body.attendeeIds ?? []);
    const attendees = (
      await repository.listCalendarEventAttendees(request.auth.firmId, body.matterId, event.id)
    ).filter((attendee) => attendeeIds.size === 0 || attendeeIds.has(attendee.id));
    const results = [];
    for (const attendee of attendees) {
      const queuedEmail = await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
        matterId: event.matterId,
        templateKey: "calendar.invitation",
        to: [attendee.email],
        subject: `Calendar invitation: ${event.title}`,
        textBody: calendarInvitationText(event, attendee),
        relatedResourceType: "calendar_event",
        relatedResourceId: event.id,
        metadata: {
          attendeeId: attendee.id,
          eventId: event.id,
        },
      });
      const now = new Date().toISOString();
      const updated = await repository.upsertCalendarEventAttendee({
        ...attendee,
        invitationStatus: queuedEmail ? "queued" : "skipped",
        invitedAt: now,
        invitationEmailId: queuedEmail?.email.id,
        invitationJobId: queuedEmail?.job.id,
        updatedAt: now,
        updatedByUserId: request.auth.user.id,
      });
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: queuedEmail ? "calendar.invitation.queued" : "calendar.invitation.skipped",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          matterId: event.matterId,
          attendeeId: attendee.id,
          invitationStatus: updated.invitationStatus,
          emailId: queuedEmail?.email.id,
          jobId: queuedEmail?.job.id,
        },
      });
      results.push({
        attendee: updated,
        queuedEmail: summarizeQueuedRouteEmail(queuedEmail),
      });
    }
    return { results };
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
