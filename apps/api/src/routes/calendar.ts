import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { appendAuditEvent, buildICalendarFeed } from "@open-practice/domain";
import type { AuditEvent, CalendarCredentialRecord, NewAuditEvent } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashPassword } from "../http/auth-helpers.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
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

interface AuditEventSink {
  recordAuditEvent(event: AuditEvent): Promise<void>;
}

function auditEventSink(
  repository: ApiRouteDependencies["repository"],
): AuditEventSink | undefined {
  const candidate = repository as ApiRouteDependencies["repository"] & Partial<AuditEventSink>;
  if (typeof candidate.recordAuditEvent !== "function") return undefined;
  return { recordAuditEvent: candidate.recordAuditEvent.bind(candidate) };
}

async function recordCalendarAuditEvent(
  repository: ApiRouteDependencies["repository"],
  event: Omit<NewAuditEvent, "id">,
): Promise<void> {
  const sink = auditEventSink(repository);
  if (!sink) return;
  const { events } = await repository.listAuditEvents(event.firmId);
  await sink.recordAuditEvent(
    appendAuditEvent(events.at(-1), {
      ...event,
      id: `audit-${createSessionToken().slice(0, 16)}`,
    }),
  );
}

function assertCalendarReadAccess(context: ApiAuthContext, matterId: string): void {
  const access = requireAccess(context, {
    resource: "calendar_event",
    action: "read",
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

export function registerCalendarRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/calendar/events", async (request) => {
    const query = parseRequestPart(calendarEventsQuerySchema, request.query, "query");
    assertCalendarReadAccess(request.auth, query.matterId);

    return {
      events: await repository.listCalendarEvents(request.auth.firmId, query),
      caldavUrl: `${baseUrl(request)}/caldav`,
      subscriptionUrl: webcalSubscriptionUrl(request, query.matterId),
    };
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
    assertCalendarReadAccess(request.auth, params.matterId);

    const events = await repository.listCalendarEvents(request.auth.firmId, {
      matterId: params.matterId,
    });
    return reply
      .type("text/calendar; charset=utf-8")
      .send(buildICalendarFeed({ events, calendarName: `Open Practice ${params.matterId}` }));
  });
}
