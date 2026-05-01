import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  InvalidCalendarPayloadError,
  UnsupportedCalendarPayloadError,
  appendAuditEvent,
  buildICalendarEvent,
  calendarEventEtag,
  parseICalendarEvent,
} from "@open-practice/domain";
import type { AuditEvent, CalendarEventRecord, NewAuditEvent } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, verifyPassword } from "../http/auth-helpers.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

interface CalDavContext {
  username: string;
  credentialId: string;
  context: ApiAuthContext;
}

interface CalDavParams {
  username: string;
  matterId?: string;
  eventId?: string;
}

const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
const UNSUPPORTED_CALENDAR_PROPERTIES = new Set([
  "ATTENDEE",
  "ORGANIZER",
  "RRULE",
  "RDATE",
  "EXDATE",
  "RECURRENCE-ID",
  "FREEBUSY",
  "REQUEST-STATUS",
  "TRIGGER",
]);
const UNSUPPORTED_CALENDAR_COMPONENTS = new Set(["VALARM", "VTODO", "VFREEBUSY", "VJOURNAL"]);
const SUPPORTED_CALENDAR_METHODS = new Set(["PUBLISH"]);

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

async function recordCalDavAuditEvent(
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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function href(value: string): string {
  return `<D:href>${xmlEscape(value)}</D:href>`;
}

function principalHref(username: string): string {
  return `/caldav/principals/${encodeURIComponent(username)}/`;
}

function calendarHomeHref(username: string): string {
  return `/caldav/calendars/${encodeURIComponent(username)}/`;
}

function calendarCollectionHref(username: string, matterId: string): string {
  return `/caldav/calendars/${encodeURIComponent(username)}/${encodeURIComponent(matterId)}/`;
}

function calendarObjectHref(username: string, matterId: string, eventId: string): string {
  return `${calendarCollectionHref(username, matterId)}${encodeURIComponent(eventId)}.ics`;
}

function multistatus(responses: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
${responses.join("\n")}
</D:multistatus>`;
}

function propstat(status: number, props: string): string {
  const label = status === 200 ? "OK" : "Not Found";
  return `<D:propstat><D:prop>${props}</D:prop><D:status>HTTP/1.1 ${status} ${label}</D:status></D:propstat>`;
}

function responseXml(resourceHref: string, props: string, status = 200): string {
  return `<D:response>${href(resourceHref)}${propstat(status, props)}</D:response>`;
}

function calendarData(event: CalendarEventRecord): string {
  return `<C:calendar-data>${xmlEscape(
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Open Practice//Matter Calendar//EN\r\nCALSCALE:GREGORIAN\r\n${buildICalendarEvent(
      event,
    )}\r\nEND:VCALENDAR\r\n`,
  )}</C:calendar-data>`;
}

function eventProps(event: CalendarEventRecord, includeCalendarData: boolean): string {
  return [
    `<D:getetag>${xmlEscape(calendarEventEtag(event))}</D:getetag>`,
    `<D:getcontenttype>text/calendar; charset=utf-8</D:getcontenttype>`,
    `<D:getlastmodified>${new Date(event.updatedAt).toUTCString()}</D:getlastmodified>`,
    includeCalendarData ? calendarData(event) : "",
  ].join("");
}

function unauthorized(reply: FastifyReply): FastifyReply {
  return reply
    .code(401)
    .header("WWW-Authenticate", 'Basic realm="Open Practice Calendar"')
    .send("Calendar account credentials required");
}

function basicCredentials(
  request: FastifyRequest,
): { username: string; password: string } | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Basic ")) return undefined;
  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) return undefined;
  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

async function authenticateCalendarRequest(
  request: FastifyRequest,
  repository: ApiRouteDependencies["repository"],
): Promise<CalDavContext | undefined> {
  const credentials = basicCredentials(request);
  if (!credentials) return undefined;

  const credential = await repository.getCalendarCredentialByUsername(credentials.username);
  if (!credential || !verifyPassword(credentials.password, credential.passwordHash)) {
    return undefined;
  }
  const user = await repository.getUser(credential.firmId, credential.userId);
  if (!user) return undefined;
  await repository.touchCalendarCredential(credential.id, new Date().toISOString());
  return {
    username: credentials.username,
    credentialId: credential.id,
    context: {
      firmId: credential.firmId,
      user,
    },
  };
}

function requireUsername(auth: CalDavContext, params: CalDavParams): void {
  if (params.username !== auth.username) {
    throw Object.assign(new Error("Calendar principal mismatch"), { statusCode: 403 });
  }
}

function assertCalendarAccess(
  context: ApiAuthContext,
  action: "create" | "read" | "update" | "delete",
  matterId: string,
): void {
  const access = requireAccess(context, {
    resource: "calendar_event",
    action,
    matterId,
  });
  if (!access.ok) throw access.error;
}

function requestBody(request: FastifyRequest): string {
  return typeof request.body === "string" ? request.body : "";
}

function unfoldCalendarLines(payload: string): string[] {
  return payload
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else if (line.length > 0) {
        lines.push(line);
      }
      return lines;
    }, []);
}

function calendarContentLine(line: string): { name: string; value: string } | undefined {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) return undefined;
  return {
    name: (line.slice(0, separatorIndex).split(";")[0] ?? "").toUpperCase(),
    value: line.slice(separatorIndex + 1).toUpperCase(),
  };
}

function isUnsupportedCalendarPropertyName(name: string): boolean {
  return UNSUPPORTED_CALENDAR_PROPERTIES.has(name.toUpperCase());
}

function isUnsupportedCalendarComponentName(name: string): boolean {
  return UNSUPPORTED_CALENDAR_COMPONENTS.has(name.toUpperCase());
}

function assertSupportedCalendarWritePayload(body: string): void {
  for (const line of unfoldCalendarLines(body)) {
    const parsed = calendarContentLine(line);
    if (!parsed) continue;
    if (parsed.name === "BEGIN" && isUnsupportedCalendarComponentName(parsed.value)) {
      throw new UnsupportedCalendarPayloadError(`${parsed.value} is not supported`);
    }
    if (
      isUnsupportedCalendarComponentName(parsed.name) ||
      isUnsupportedCalendarPropertyName(parsed.name)
    ) {
      throw new UnsupportedCalendarPayloadError(`${parsed.name} is not supported`);
    }
    if (parsed.name === "METHOD" && !SUPPORTED_CALENDAR_METHODS.has(parsed.value)) {
      throw new UnsupportedCalendarPayloadError(
        `METHOD:${parsed.value} scheduling is not supported`,
      );
    }
  }
}

function parseCalendarTimeRange(body: string): { startsAfter?: string; startsBefore?: string } {
  const match = body.match(/<[^>]*time-range\b[^>]*>/i)?.[0];
  if (!match) return {};
  const start = match.match(/\bstart="([^"]+)"/i)?.[1];
  const end = match.match(/\bend="([^"]+)"/i)?.[1];
  return {
    startsAfter: start ? calDavDateTimeToIso(start) : undefined,
    startsBefore: end ? calDavDateTimeToIso(end) : undefined,
  };
}

function assertSupportedCalDavReportPayload(body: string): void {
  const unsupportedReport = body.match(
    /<[^>]*(free-busy-query|schedule-query|schedule-multiget|schedule-inbox-url|schedule-outbox-url|schedule-default-calendar-url|calendar-user-address-set|schedule-calendar-transp|schedule-tag|schedule-changes)\b/i,
  )?.[1];
  if (unsupportedReport) {
    throw new UnsupportedCalendarPayloadError(
      `${unsupportedReport.toUpperCase()} is not supported`,
    );
  }

  for (const match of body.matchAll(/\bname\s*=\s*["']([^"']+)["']/gi)) {
    const name = match[1]!.toUpperCase();
    if (isUnsupportedCalendarComponentName(name) || isUnsupportedCalendarPropertyName(name)) {
      throw new UnsupportedCalendarPayloadError(`${name} is not supported`);
    }
  }
}

function calDavDateTimeToIso(value: string): string {
  if (!/^\d{8}T\d{6}Z$/.test(value)) {
    throw Object.assign(new Error("CalDAV time ranges must use UTC DATE-TIME values"), {
      statusCode: 400,
    });
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(
    9,
    11,
  )}:${value.slice(11, 13)}:${value.slice(13, 15)}.000Z`;
}

function multigetEventIds(body: string): string[] {
  return Array.from(body.matchAll(/<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/gi))
    .map((match) => decodeURIComponent(match[1]!.trim()).split("/").pop() ?? "")
    .filter((name) => name.endsWith(".ics"))
    .map((name) => name.slice(0, -".ics".length));
}

function isCalendarMultiget(body: string): boolean {
  return /calendar-multiget/i.test(body);
}

function ifMatchHeader(request: FastifyRequest): string | undefined {
  const value = request.headers["if-match"];
  return Array.isArray(value) ? value[0] : value;
}

function ifNoneMatchHeader(request: FastifyRequest): string | undefined {
  const value = request.headers["if-none-match"];
  return Array.isArray(value) ? value[0] : value;
}

function assertMatchingEtag(request: FastifyRequest, event: CalendarEventRecord): void {
  const current = calendarEventEtag(event);
  const requested = ifMatchHeader(request);
  if (!requested) {
    throw Object.assign(new Error("If-Match is required"), { statusCode: 428 });
  }
  if (requested !== current) {
    throw Object.assign(new Error("Calendar event ETag does not match"), { statusCode: 412 });
  }
}

function assertCreatePrecondition(request: FastifyRequest): void {
  const requested = ifNoneMatchHeader(request);
  if (!requested) {
    throw Object.assign(new Error("If-None-Match is required"), { statusCode: 428 });
  }
  if (requested !== "*") {
    throw Object.assign(new Error("Calendar event already exists"), { statusCode: 412 });
  }
}

function calendarEventIdFromUid(uid: string): string {
  return uid
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function routeParams(request: FastifyRequest): CalDavParams {
  return request.params as CalDavParams;
}

function sendXml(reply: FastifyReply, statusCode: number, body: string): FastifyReply {
  return reply.code(statusCode).type(XML_CONTENT_TYPE).send(body);
}

function options(reply: FastifyReply): FastifyReply {
  return reply
    .header("DAV", "1, 3, calendar-access")
    .header("Allow", "OPTIONS, PROPFIND, REPORT, GET, PUT, DELETE")
    .send();
}

async function rootDiscovery(
  request: FastifyRequest,
  reply: FastifyReply,
  repository: ApiRouteDependencies["repository"],
): Promise<FastifyReply> {
  const auth = await authenticateCalendarRequest(request, repository);
  if (!auth) return unauthorized(reply);
  return sendXml(
    reply,
    207,
    multistatus([
      responseXml(
        "/caldav/",
        `<D:current-user-principal>${href(
          principalHref(auth.username),
        )}</D:current-user-principal><C:calendar-home-set>${href(
          calendarHomeHref(auth.username),
        )}</C:calendar-home-set>`,
      ),
    ]),
  );
}

export function registerCalDavRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.addHttpMethod("PROPFIND");
  server.addHttpMethod("REPORT", { hasBody: true });

  server.addContentTypeParser(
    ["application/xml", "text/xml", "text/calendar"],
    { parseAs: "string" },
    (_request, payload, done) => done(null, payload),
  );

  server.route({
    method: "OPTIONS",
    url: "/caldav/*",
    handler: async (_request, reply) => options(reply),
  });

  server.route({
    method: "OPTIONS",
    url: "/caldav",
    handler: async (_request, reply) => options(reply),
  });

  server.route({
    method: "PROPFIND" as never,
    url: "/caldav",
    handler: async (request, reply) => rootDiscovery(request, reply, repository),
  });

  server.route({
    method: "PROPFIND" as never,
    url: "/caldav/",
    handler: async (request, reply) => rootDiscovery(request, reply, repository),
  });

  server.route({
    method: ["GET", "PROPFIND"] as never,
    url: "/.well-known/caldav",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      return reply.redirect(principalHref(auth.username), 301);
    },
  });

  server.route({
    method: "PROPFIND" as never,
    url: "/caldav/principals/:username/",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      return sendXml(
        reply,
        207,
        multistatus([
          responseXml(
            principalHref(auth.username),
            `<D:displayname>${xmlEscape(auth.context.user.displayName)}</D:displayname><D:current-user-principal>${href(
              principalHref(auth.username),
            )}</D:current-user-principal><C:calendar-home-set>${href(
              calendarHomeHref(auth.username),
            )}</C:calendar-home-set>`,
          ),
        ]),
      );
    },
  });

  server.route({
    method: "PROPFIND" as never,
    url: "/caldav/calendars/:username/",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      const matters = await repository.listMattersForUser(auth.context.user);
      const responses = [
        responseXml(
          calendarHomeHref(auth.username),
          "<D:resourcetype><D:collection/></D:resourcetype><D:displayname>Open Practice Calendars</D:displayname>",
        ),
        ...matters.map((matter) =>
          responseXml(
            calendarCollectionHref(auth.username, matter.id),
            `<D:resourcetype><D:collection/><C:calendar/></D:resourcetype><D:displayname>${xmlEscape(
              matter.title,
            )}</D:displayname><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>`,
          ),
        ),
      ];
      return sendXml(reply, 207, multistatus(responses));
    },
  });

  server.route({
    method: "PROPFIND" as never,
    url: "/caldav/calendars/:username/:matterId/",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      assertCalendarAccess(auth.context, "read", params.matterId!);
      const events = await repository.listCalendarEvents(auth.context.firmId, {
        matterId: params.matterId!,
      });
      const responses = [
        responseXml(
          calendarCollectionHref(auth.username, params.matterId!),
          `<D:resourcetype><D:collection/><C:calendar/></D:resourcetype><D:displayname>${xmlEscape(
            params.matterId!,
          )}</D:displayname><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>`,
        ),
        ...events.map((event) =>
          responseXml(
            calendarObjectHref(auth.username, params.matterId!, event.id),
            eventProps(event, false),
          ),
        ),
      ];
      return sendXml(reply, 207, multistatus(responses));
    },
  });

  server.route({
    method: "REPORT" as never,
    url: "/caldav/calendars/:username/:matterId/",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      assertCalendarAccess(auth.context, "read", params.matterId!);
      const body = requestBody(request);
      try {
        assertSupportedCalDavReportPayload(body);
      } catch (error) {
        if (error instanceof UnsupportedCalendarPayloadError) {
          return reply.code(422).send(error.message);
        }
        throw error;
      }
      const events = isCalendarMultiget(body)
        ? (
            await Promise.all(
              multigetEventIds(body).map((eventId) =>
                repository.getCalendarEvent(auth.context.firmId, params.matterId!, eventId),
              ),
            )
          ).filter((event): event is CalendarEventRecord => Boolean(event))
        : await repository.listCalendarEvents(auth.context.firmId, {
            matterId: params.matterId!,
            ...parseCalendarTimeRange(body),
          });
      return sendXml(
        reply,
        207,
        multistatus(
          events.map((event) =>
            responseXml(
              calendarObjectHref(auth.username, params.matterId!, event.id),
              eventProps(event, true),
            ),
          ),
        ),
      );
    },
  });

  server.route({
    method: "GET",
    url: "/caldav/calendars/:username/:matterId/:eventId.ics",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      assertCalendarAccess(auth.context, "read", params.matterId!);
      const event = await repository.getCalendarEvent(
        auth.context.firmId,
        params.matterId!,
        params.eventId!,
      );
      if (!event) return reply.code(404).send("Calendar event not found");
      return reply
        .header("ETag", calendarEventEtag(event))
        .type("text/calendar; charset=utf-8")
        .send(
          `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Open Practice//Matter Calendar//EN\r\nCALSCALE:GREGORIAN\r\n${buildICalendarEvent(
            event,
          )}\r\nEND:VCALENDAR\r\n`,
        );
    },
  });

  server.route({
    method: "PUT",
    url: "/caldav/calendars/:username/:matterId/:eventId.ics",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      const existing = await repository.getCalendarEvent(
        auth.context.firmId,
        params.matterId!,
        params.eventId!,
      );
      assertCalendarAccess(auth.context, existing ? "update" : "create", params.matterId!);
      if (existing) {
        assertMatchingEtag(request, existing);
      } else {
        assertCreatePrecondition(request);
      }

      let parsed: ReturnType<typeof parseICalendarEvent>;
      const body = requestBody(request);
      try {
        assertSupportedCalendarWritePayload(body);
        parsed = parseICalendarEvent(body);
      } catch (error) {
        if (error instanceof UnsupportedCalendarPayloadError) {
          return reply.code(422).send(error.message);
        }
        if (error instanceof InvalidCalendarPayloadError) {
          return reply.code(400).send(error.message);
        }
        throw error;
      }
      const conflicting = await repository.getCalendarEventByUid(
        auth.context.firmId,
        params.matterId!,
        parsed.uid,
      );
      if (conflicting && conflicting.id !== params.eventId) {
        return reply.code(409).send("Calendar event UID already exists in this matter");
      }

      const now = new Date().toISOString();
      const event = await repository.upsertCalendarEvent({
        id: params.eventId || calendarEventIdFromUid(parsed.uid),
        firmId: auth.context.firmId,
        matterId: params.matterId!,
        uid: parsed.uid,
        title: parsed.title,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        description: parsed.description,
        location: parsed.location,
        status: parsed.status,
        sequence: existing ? Math.max(parsed.sequence, existing.sequence + 1) : parsed.sequence,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        createdByUserId: existing?.createdByUserId ?? auth.context.user.id,
        updatedByUserId: auth.context.user.id,
      });
      await recordCalDavAuditEvent(repository, {
        firmId: auth.context.firmId,
        actorId: auth.context.user.id,
        action: existing ? "calendar.event.updated" : "calendar.event.created",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          matterId: event.matterId,
          uid: event.uid,
          credentialId: auth.credentialId,
          source: "caldav",
        },
      });
      return reply
        .code(existing ? 204 : 201)
        .header("ETag", calendarEventEtag(event))
        .send();
    },
  });

  server.route({
    method: "DELETE",
    url: "/caldav/calendars/:username/:matterId/:eventId.ics",
    handler: async (request, reply) => {
      const auth = await authenticateCalendarRequest(request, repository);
      if (!auth) return unauthorized(reply);
      const params = routeParams(request);
      requireUsername(auth, params);
      assertCalendarAccess(auth.context, "delete", params.matterId!);
      const existing = await repository.getCalendarEvent(
        auth.context.firmId,
        params.matterId!,
        params.eventId!,
      );
      if (!existing) return reply.code(404).send("Calendar event not found");
      assertMatchingEtag(request, existing);
      const deleted = await repository.deleteCalendarEvent({
        firmId: auth.context.firmId,
        matterId: params.matterId!,
        eventId: params.eventId!,
        deletedAt: new Date().toISOString(),
        updatedByUserId: auth.context.user.id,
      });
      if (deleted) {
        await recordCalDavAuditEvent(repository, {
          firmId: auth.context.firmId,
          actorId: auth.context.user.id,
          action: "calendar.event.deleted",
          resourceType: "calendar_event",
          resourceId: deleted.id,
          occurredAt: deleted.deletedAt ?? deleted.updatedAt,
          metadata: {
            matterId: deleted.matterId,
            uid: deleted.uid,
            credentialId: auth.credentialId,
            source: "caldav",
          },
        });
      }
      return reply.code(204).send();
    },
  });
}
