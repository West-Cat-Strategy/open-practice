import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  AccessLogRecord,
  CalendarEventRecord,
  CalendarGuestLinkRecord,
  CalendarMeetingInvitationBoundary,
  CalendarMeetingSessionRecord,
} from "@open-practice/domain";
import {
  createSessionToken,
  hashToken,
  publicTokenPathFromHeader,
  readPublicTokenHeader,
} from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { publicTokenPolicyOptions } from "../public-token-rate-limits.js";
import {
  assertCalendarAccess,
  calendarEventParamsSchema,
  calendarMeetingInvitationBoundaryForRequest,
  recordCalendarAuditEvent,
} from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

const calendarMeetingSessionParamsSchema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
});

const calendarMeetingGuestParamsSchema = calendarMeetingSessionParamsSchema.extend({
  guestId: z.string().min(1),
});

const calendarMeetingSessionBodySchema = z.object({
  matterId: z.string().min(1),
});

const calendarMeetingSessionQuerySchema = z.object({
  matterId: z.string().min(1),
});

const publicGuestSessionParamsSchema = z.object({
  token: z.string().min(32),
});

const publicGuestCheckInBodySchema = z
  .object({
    attendanceConfirmation: z
      .object({
        source: z.literal("guest_status_page"),
      })
      .optional(),
  })
  .optional();

const TERMINAL_GUEST_LINK_STATUSES = new Set<CalendarGuestLinkRecord["status"]>([
  "admitted",
  "denied",
  "revoked",
]);

function guestSessionNotFoundError(): ApiHttpError {
  return new ApiHttpError(404, "GUEST_SESSION_NOT_FOUND", "Guest session was not found");
}

function guestSessionTransitionUnavailableError(): ApiHttpError {
  return new ApiHttpError(
    409,
    "GUEST_SESSION_TRANSITION_UNAVAILABLE",
    "Guest session transition is unavailable",
  );
}

function requireGuestAccessSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "MEETING_GUEST_ACCESS_NOT_CONFIGURED",
    "Meeting guest access tokens are not configured",
  );
}

function readGuestSessionPublicToken(request: FastifyRequest): string {
  const params = request.params as { token?: string } | undefined;
  const pathToken = params?.token;
  const headerToken = readPublicTokenHeader(request.headers);
  if (pathToken && headerToken && pathToken !== headerToken) {
    throw guestSessionNotFoundError();
  }
  return parseRequestPart(
    publicGuestSessionParamsSchema,
    pathToken ? { token: pathToken } : publicTokenPathFromHeader(headerToken),
    "params",
  ).token;
}

function assertHostedGuestSessionAllowed(input: {
  event: CalendarEventRecord;
  meetingInvitationBoundary: CalendarMeetingInvitationBoundary;
  jwtSecret?: string;
}): void {
  if (input.event.status === "cancelled") {
    throw new ApiHttpError(
      409,
      "MEETING_SESSION_EVENT_CANCELLED",
      "Guest sessions are unavailable for cancelled events",
    );
  }
  if (input.event.meetingLinkMode !== "hosted_webrtc" || !input.event.meetingRoomId) {
    throw new ApiHttpError(
      409,
      "HOSTED_MEETING_LINK_REQUIRED",
      "A hosted meeting link is required before guest sessions can be managed",
    );
  }
  if (input.meetingInvitationBoundary.guestAccess.status !== "configured" || !input.jwtSecret) {
    throw new ApiHttpError(
      503,
      "MEETING_GUEST_ACCESS_NOT_CONFIGURED",
      "Meeting guest access tokens are not configured",
    );
  }
}

function sessionStatusForResponse(
  session: CalendarMeetingSessionRecord,
): "created" | "open" | "locked" | "ended" {
  if (session.status === "lobby_open") return "open";
  if (session.status === "locked") return "locked";
  if (session.status === "ended") return "ended";
  return "created";
}

function assertGuestSessionTransitionAvailable(session: CalendarMeetingSessionRecord): void {
  if (session.status === "ended") {
    throw guestSessionTransitionUnavailableError();
  }
}

function assertGuestLinkTransitionAvailable(link: CalendarGuestLinkRecord, now: string): void {
  if (
    Date.parse(link.expiresAt) <= Date.parse(now) ||
    TERMINAL_GUEST_LINK_STATUSES.has(link.status)
  ) {
    throw guestSessionTransitionUnavailableError();
  }
}

function sanitizeGuestLink(link: CalendarGuestLinkRecord) {
  return {
    id: link.id,
    sessionId: link.sessionId,
    status: link.status,
    expiresAt: link.expiresAt,
    checkedInAt: link.checkedInAt,
    revokedAt: link.revokedAt,
    admittedAt: link.admittedAt,
    deniedAt: link.deniedAt,
  };
}

function guestCounts(links: CalendarGuestLinkRecord[]): {
  issuedCount: number;
  waitingCount: number;
  admittedCount: number;
  deniedCount: number;
  revokedCount: number;
} {
  return {
    issuedCount: links.filter((link) => link.status === "issued").length,
    waitingCount: links.filter((link) => link.status === "waiting").length,
    admittedCount: links.filter((link) => link.status === "admitted").length,
    deniedCount: links.filter((link) => link.status === "denied").length,
    revokedCount: links.filter((link) => link.status === "revoked").length,
  };
}

function calendarGuestSessionResponse(input: {
  session: CalendarMeetingSessionRecord;
  links: CalendarGuestLinkRecord[];
  event?: CalendarEventRecord;
}) {
  return {
    id: input.session.id,
    eventId: input.session.eventId,
    status: sessionStatusForResponse(input.session),
    lobbyStatus: sessionStatusForResponse(input.session),
    provider: input.event?.meetingProviderKey,
    createdAt: input.session.createdAt,
    updatedAt: input.session.updatedAt,
    endedAt: input.session.endedAt,
    retentionUntil: input.session.retentionUntil,
    ...guestCounts(input.links),
    guests: input.links.map(sanitizeGuestLink),
  };
}

function publicGuestSessionResponse(input: {
  session: CalendarMeetingSessionRecord;
  link: CalendarGuestLinkRecord;
  links: CalendarGuestLinkRecord[];
  event: CalendarEventRecord;
  now: string;
}) {
  const expired =
    input.link.status !== "revoked" && Date.parse(input.link.expiresAt) <= Date.parse(input.now);
  const counts = guestCounts(input.links);
  const sessionStatus = expired ? "expired" : sessionStatusForResponse(input.session);
  const guestStatus = expired ? "revoked" : input.link.status;
  const meetingAccessStatus =
    sessionStatus === "expired" ||
    sessionStatus === "ended" ||
    guestStatus === "denied" ||
    guestStatus === "revoked"
      ? "unavailable"
      : guestStatus === "admitted"
        ? "staff_controlled"
        : "pending_lobby_review";
  return {
    session: {
      status: sessionStatus,
      lobbyStatus: sessionStatus,
      startsAt: input.event.startsAt,
      endsAt: input.event.endsAt,
      ...counts,
    },
    guest: {
      status: guestStatus,
      checkedInAt: input.link.checkedInAt,
      admittedAt: input.link.admittedAt,
      deniedAt: input.link.deniedAt,
      revokedAt: input.link.revokedAt,
    },
    lobby: {
      status: sessionStatus,
      waitingCount: counts.waitingCount,
      admittedCount: counts.admittedCount,
      deniedCount: counts.deniedCount,
      revokedCount: counts.revokedCount,
    },
    meetingAccess: {
      status: meetingAccessStatus,
      deliveryBoundary: "calendar_invitation_or_staff_handoff",
      meetingUrlAvailable: false,
    },
  };
}

function defaultGuestLinkExpiry(event: CalendarEventRecord, now: Date): string {
  const twoHours = 2 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const eventBound = Date.parse(event.endsAt) + twoHours;
  const capped = Math.min(eventBound, now.getTime() + sevenDays);
  return new Date(capped > now.getTime() ? capped : now.getTime() + twoHours).toISOString();
}

function defaultRetentionBoundary(event: CalendarEventRecord): string {
  return new Date(Date.parse(event.endsAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
}

function buildGuestSessionPortalUrl(publicWebBaseUrl: string | undefined, token: string): string {
  return `${(publicWebBaseUrl ?? "http://localhost:3000").replace(/\/+$/, "")}/guest-sessions#${encodeURIComponent(
    token,
  )}`;
}

function publicGuestSessionAccessLog(input: {
  link: CalendarGuestLinkRecord;
  action: AccessLogRecord["action"];
  request: FastifyRequest;
  metadata?: Record<string, unknown>;
}): AccessLogRecord {
  const userAgent = input.request.headers["user-agent"];
  return {
    id: `access-log-${createSessionToken().slice(0, 16)}`,
    firmId: input.link.firmId,
    resourceType: "calendar_guest_link",
    resourceId: input.link.id,
    action: input.action,
    occurredAt: new Date().toISOString(),
    ipAddress: input.request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent,
    metadata: input.metadata ?? {},
  };
}

async function authorizedCalendarEventForGuestSession(
  dependencies: CalendarRouteDependencies,
  context: ApiAuthContext,
  eventId: string,
  matterId: string,
): Promise<{
  event: CalendarEventRecord;
  meetingInvitationBoundary: CalendarMeetingInvitationBoundary;
}> {
  assertCalendarAccess(context, matterId, "update");
  const event = await dependencies.repository.getCalendarEvent(context.firmId, matterId, eventId);
  if (!event) {
    throw new ApiHttpError(404, "CALENDAR_EVENT_NOT_FOUND", "Event not found");
  }
  const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
    dependencies,
    context.firmId,
  );
  assertHostedGuestSessionAllowed({
    event,
    meetingInvitationBoundary,
    jwtSecret: dependencies.jwtSecret,
  });
  return { event, meetingInvitationBoundary };
}

export async function calendarGuestSessionWithLinks(
  repository: CalendarRouteDependencies["repository"],
  session: CalendarMeetingSessionRecord,
  event?: CalendarEventRecord,
) {
  const links = await repository.listCalendarGuestLinks(session.firmId, {
    matterId: session.matterId,
    eventId: session.eventId,
    sessionId: session.id,
  });
  return calendarGuestSessionResponse({ session, links, event });
}

function sessionAuditMetadata(
  session: CalendarMeetingSessionRecord,
  links: CalendarGuestLinkRecord[] = [],
): Record<string, unknown> {
  return {
    matterId: session.matterId,
    eventId: session.eventId,
    sessionId: session.id,
    status: session.status,
    endedAt: session.endedAt,
    retentionUntil: session.retentionUntil,
    ...guestCounts(links),
  };
}

function guestLinkAuditMetadata(link: CalendarGuestLinkRecord): Record<string, unknown> {
  return {
    matterId: link.matterId,
    eventId: link.eventId,
    sessionId: link.sessionId,
    linkId: link.id,
    status: link.status,
    expiresAt: link.expiresAt,
    checkedInAt: link.checkedInAt,
    admittedAt: link.admittedAt,
    deniedAt: link.deniedAt,
    revokedAt: link.revokedAt,
    retentionUntil: link.retentionUntil,
  };
}

function publicGuestSessionOutcome(input: {
  session: CalendarMeetingSessionRecord;
  link: CalendarGuestLinkRecord;
  now: string;
}): string {
  if (Date.parse(input.link.expiresAt) <= Date.parse(input.now)) return "expired";
  if (input.link.status === "revoked") return "revoked";
  return sessionStatusForResponse(input.session);
}

async function resolvePublicGuestSession(input: {
  repository: CalendarRouteDependencies["repository"];
  jwtSecret?: string;
  token: string;
  transitionUnavailableOnExpiredOrRevoked?: boolean;
  expiredLinkAccessLog?: {
    action: AccessLogRecord["action"];
    request: FastifyRequest;
  };
}): Promise<{
  event: CalendarEventRecord;
  session: CalendarMeetingSessionRecord;
  link: CalendarGuestLinkRecord;
  links: CalendarGuestLinkRecord[];
}> {
  const secret = requireGuestAccessSecret(input.jwtSecret);
  const link = await input.repository.getCalendarGuestLinkByTokenHash(
    hashToken(input.token, secret),
  );
  if (!link) {
    throw guestSessionNotFoundError();
  }
  if (link.status === "revoked" || Date.parse(link.expiresAt) <= Date.now()) {
    if (input.expiredLinkAccessLog) {
      await input.repository.createAccessLog(
        publicGuestSessionAccessLog({
          link,
          action: input.expiredLinkAccessLog.action,
          request: input.expiredLinkAccessLog.request,
          metadata: {
            outcome: link.status === "revoked" ? "revoked" : "expired",
            status: link.status,
            publicTokenExpiredOrRevoked: true,
          },
        }),
      );
    }
    if (input.transitionUnavailableOnExpiredOrRevoked) {
      throw guestSessionTransitionUnavailableError();
    }
    throw new ApiHttpError(410, "GUEST_SESSION_EXPIRED", "Guest session is no longer available");
  }
  const [event, session] = await Promise.all([
    input.repository.getCalendarEvent(link.firmId, link.matterId, link.eventId),
    input.repository.getCalendarMeetingSession(
      link.firmId,
      link.matterId,
      link.eventId,
      link.sessionId,
    ),
  ]);
  if (!event || !session) {
    throw guestSessionNotFoundError();
  }
  const links = await input.repository.listCalendarGuestLinks(link.firmId, {
    matterId: link.matterId,
    eventId: link.eventId,
    sessionId: link.sessionId,
  });
  return { event, session, link, links };
}

export function registerCalendarGuestSessionRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository, jwtSecret, publicWebBaseUrl } = dependencies;

  server.get("/api/calendar/events/:eventId/guest-sessions", async (request) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const query = parseRequestPart(calendarMeetingSessionQuerySchema, request.query, "query");
    assertCalendarAccess(request.auth, query.matterId, "read");
    const event = await repository.getCalendarEvent(
      request.auth.firmId,
      query.matterId,
      params.eventId,
    );
    if (!event) {
      throw new ApiHttpError(404, "CALENDAR_EVENT_NOT_FOUND", "Event not found");
    }
    const sessions = await repository.listCalendarMeetingSessions(request.auth.firmId, {
      matterId: query.matterId,
      eventId: event.id,
    });
    return {
      sessions: await Promise.all(
        sessions.map((session) => calendarGuestSessionWithLinks(repository, session, event)),
      ),
    };
  });

  server.post("/api/calendar/events/:eventId/guest-sessions", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarMeetingSessionBodySchema, request.body, "body");
    const { event } = await authorizedCalendarEventForGuestSession(
      dependencies,
      request.auth,
      params.eventId,
      body.matterId,
    );
    const existingSessions = await repository.listCalendarMeetingSessions(request.auth.firmId, {
      matterId: body.matterId,
      eventId: event.id,
    });
    const reusableSession = existingSessions.find((session) => session.status !== "ended");
    if (reusableSession) {
      return { session: await calendarGuestSessionWithLinks(repository, reusableSession, event) };
    }

    const now = new Date().toISOString();
    const session = await repository.createCalendarMeetingSession({
      id: `calendar-meeting-session-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      eventId: event.id,
      status: "lobby_closed",
      retentionUntil: defaultRetentionBoundary(event),
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
      metadata: {
        providerKey: event.meetingProviderKey,
      },
    });
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.meeting_session.created",
      resourceType: "calendar_meeting_session",
      resourceId: session.id,
      occurredAt: now,
      metadata: sessionAuditMetadata(session),
    });
    return reply.code(201).send({
      session: calendarGuestSessionResponse({ session, links: [], event }),
    });
  });

  async function updateCalendarGuestSessionControl(
    request: FastifyRequest,
    control: {
      status: "lobby_open" | "locked" | "ended";
      action: "calendar.meeting_session.updated" | "calendar.meeting_session.ended";
    },
  ) {
    const params = parseRequestPart(calendarMeetingSessionParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarMeetingSessionBodySchema, request.body, "body");
    const { event } = await authorizedCalendarEventForGuestSession(
      dependencies,
      request.auth,
      params.eventId,
      body.matterId,
    );
    const existing = await repository.getCalendarMeetingSession(
      request.auth.firmId,
      body.matterId,
      event.id,
      params.sessionId,
    );
    if (!existing) {
      throw new ApiHttpError(404, "MEETING_SESSION_NOT_FOUND", "Meeting session not found");
    }
    assertGuestSessionTransitionAvailable(existing);
    const occurredAt = new Date().toISOString();
    const updated = await repository.updateCalendarMeetingSessionStatus({
      firmId: request.auth.firmId,
      matterId: body.matterId,
      eventId: event.id,
      sessionId: existing.id,
      status: control.status,
      occurredAt,
      actorUserId: request.auth.user.id,
    });
    if (!updated) {
      throw new ApiHttpError(404, "MEETING_SESSION_NOT_FOUND", "Meeting session not found");
    }

    let links = await repository.listCalendarGuestLinks(request.auth.firmId, {
      matterId: body.matterId,
      eventId: event.id,
      sessionId: updated.id,
    });
    if (control.status === "ended") {
      for (const link of links.filter((candidate) => candidate.status !== "revoked")) {
        const revoked = await repository.revokeCalendarGuestLink({
          firmId: request.auth.firmId,
          matterId: body.matterId,
          eventId: event.id,
          sessionId: updated.id,
          linkId: link.id,
          revokedAt: occurredAt,
          actorUserId: request.auth.user.id,
        });
        if (revoked) {
          await recordCalendarAuditEvent(repository, {
            firmId: request.auth.firmId,
            actorId: request.auth.user.id,
            action: "calendar.guest_link.revoked",
            resourceType: "calendar_guest_link",
            resourceId: revoked.id,
            occurredAt,
            metadata: guestLinkAuditMetadata(revoked),
          });
        }
      }
      links = await repository.listCalendarGuestLinks(request.auth.firmId, {
        matterId: body.matterId,
        eventId: event.id,
        sessionId: updated.id,
      });
    }
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: control.action,
      resourceType: "calendar_meeting_session",
      resourceId: updated.id,
      occurredAt,
      metadata: sessionAuditMetadata(updated, links),
    });
    return {
      session: calendarGuestSessionResponse({ session: updated, links, event }),
    };
  }

  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/open", async (request) =>
    updateCalendarGuestSessionControl(request, {
      status: "lobby_open",
      action: "calendar.meeting_session.updated",
    }),
  );

  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/lock", async (request) =>
    updateCalendarGuestSessionControl(request, {
      status: "locked",
      action: "calendar.meeting_session.updated",
    }),
  );

  server.post("/api/calendar/events/:eventId/guest-sessions/:sessionId/end", async (request) =>
    updateCalendarGuestSessionControl(request, {
      status: "ended",
      action: "calendar.meeting_session.ended",
    }),
  );

  server.post(
    "/api/calendar/events/:eventId/guest-sessions/:sessionId/guest-links",
    async (request, reply) => {
      const params = parseRequestPart(calendarMeetingSessionParamsSchema, request.params, "params");
      const body = parseRequestPart(calendarMeetingSessionBodySchema, request.body, "body");
      const secret = requireGuestAccessSecret(jwtSecret);
      const { event } = await authorizedCalendarEventForGuestSession(
        dependencies,
        request.auth,
        params.eventId,
        body.matterId,
      );
      const session = await repository.getCalendarMeetingSession(
        request.auth.firmId,
        body.matterId,
        event.id,
        params.sessionId,
      );
      if (!session) {
        throw new ApiHttpError(404, "MEETING_SESSION_NOT_FOUND", "Meeting session not found");
      }
      assertGuestSessionTransitionAvailable(session);
      const now = new Date();
      const token = createSessionToken();
      const link = await repository.createCalendarGuestLink({
        id: `calendar-guest-link-${createSessionToken().slice(0, 16)}`,
        firmId: request.auth.firmId,
        matterId: body.matterId,
        eventId: event.id,
        sessionId: session.id,
        tokenHash: hashToken(token, secret),
        status: "issued",
        expiresAt: defaultGuestLinkExpiry(event, now),
        retentionUntil: defaultRetentionBoundary(event),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdByUserId: request.auth.user.id,
        updatedByUserId: request.auth.user.id,
        metadata: {
          providerKey: event.meetingProviderKey,
        },
      });
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "calendar.guest_link.created",
        resourceType: "calendar_guest_link",
        resourceId: link.id,
        occurredAt: now.toISOString(),
        metadata: guestLinkAuditMetadata(link),
      });
      const links = await repository.listCalendarGuestLinks(request.auth.firmId, {
        matterId: event.matterId,
        eventId: event.id,
        sessionId: session.id,
      });
      return reply.code(201).send({
        session: calendarGuestSessionResponse({ session, links, event }),
        guest: sanitizeGuestLink(link),
        token,
        portalUrl: buildGuestSessionPortalUrl(publicWebBaseUrl, token),
      });
    },
  );

  async function updateCalendarGuestLinkForStaff(
    request: FastifyRequest,
    guestAction: {
      status: "admitted" | "denied" | "revoked";
      action: "calendar.guest_link.updated" | "calendar.guest_link.revoked";
    },
  ) {
    const params = parseRequestPart(calendarMeetingGuestParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarMeetingSessionBodySchema, request.body, "body");
    const { event } = await authorizedCalendarEventForGuestSession(
      dependencies,
      request.auth,
      params.eventId,
      body.matterId,
    );
    const session = await repository.getCalendarMeetingSession(
      request.auth.firmId,
      body.matterId,
      event.id,
      params.sessionId,
    );
    if (!session) {
      throw new ApiHttpError(404, "MEETING_SESSION_NOT_FOUND", "Meeting session not found");
    }
    assertGuestSessionTransitionAvailable(session);
    const existing = await repository.getCalendarGuestLink(
      request.auth.firmId,
      body.matterId,
      event.id,
      params.sessionId,
      params.guestId,
    );
    if (!existing) {
      throw new ApiHttpError(404, "GUEST_LINK_NOT_FOUND", "Guest link not found");
    }
    const occurredAt = new Date().toISOString();
    assertGuestLinkTransitionAvailable(existing, occurredAt);
    const guest =
      guestAction.status === "revoked"
        ? await repository.revokeCalendarGuestLink({
            firmId: request.auth.firmId,
            matterId: body.matterId,
            eventId: event.id,
            sessionId: params.sessionId,
            linkId: params.guestId,
            revokedAt: occurredAt,
            actorUserId: request.auth.user.id,
          })
        : await repository.updateCalendarGuestLinkStatus({
            firmId: request.auth.firmId,
            matterId: body.matterId,
            eventId: event.id,
            sessionId: params.sessionId,
            linkId: params.guestId,
            status: guestAction.status,
            occurredAt,
            actorUserId: request.auth.user.id,
          });
    if (!guest) {
      throw new ApiHttpError(404, "GUEST_LINK_NOT_FOUND", "Guest link not found");
    }
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: guestAction.action,
      resourceType: "calendar_guest_link",
      resourceId: guest.id,
      occurredAt,
      metadata: guestLinkAuditMetadata(guest),
    });
    return {
      session: session ? await calendarGuestSessionWithLinks(repository, session, event) : null,
      guest: sanitizeGuestLink(guest),
    };
  }

  server.post(
    "/api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/admit",
    async (request) =>
      updateCalendarGuestLinkForStaff(request, {
        status: "admitted",
        action: "calendar.guest_link.updated",
      }),
  );

  server.post(
    "/api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/deny",
    async (request) =>
      updateCalendarGuestLinkForStaff(request, {
        status: "denied",
        action: "calendar.guest_link.updated",
      }),
  );

  server.post(
    "/api/calendar/events/:eventId/guest-sessions/:sessionId/guests/:guestId/revoke",
    async (request) =>
      updateCalendarGuestLinkForStaff(request, {
        status: "revoked",
        action: "calendar.guest_link.revoked",
      }),
  );

  const viewPublicGuestSession = async (request: FastifyRequest) => {
    const resolved = await resolvePublicGuestSession({
      repository,
      jwtSecret,
      token: readGuestSessionPublicToken(request),
      expiredLinkAccessLog: { action: "view", request },
    });
    const now = new Date().toISOString();
    await repository.createAccessLog(
      publicGuestSessionAccessLog({
        link: resolved.link,
        action: "view",
        request,
        metadata: {
          outcome: publicGuestSessionOutcome({
            session: resolved.session,
            link: resolved.link,
            now,
          }),
          status: resolved.link.status,
          lobbyStatus: resolved.session.status,
        },
      }),
    );
    return publicGuestSessionResponse({ ...resolved, now });
  };

  const checkInPublicGuestSession = async (request: FastifyRequest) => {
    parseRequestPart(publicGuestCheckInBodySchema, request.body ?? {}, "body");
    let resolved = await resolvePublicGuestSession({
      repository,
      jwtSecret,
      token: readGuestSessionPublicToken(request),
      transitionUnavailableOnExpiredOrRevoked: true,
      expiredLinkAccessLog: { action: "submit", request },
    });
    const now = new Date().toISOString();
    if (
      resolved.session.status === "ended" ||
      TERMINAL_GUEST_LINK_STATUSES.has(resolved.link.status)
    ) {
      await repository.createAccessLog(
        publicGuestSessionAccessLog({
          link: resolved.link,
          action: "submit",
          request,
          metadata: {
            outcome: "transition_unavailable",
            status: resolved.link.status,
            lobbyStatus: resolved.session.status,
            publicTokenTransitionUnavailable: true,
          },
        }),
      );
      throw guestSessionTransitionUnavailableError();
    }
    const expired = Date.parse(resolved.link.expiresAt) <= Date.parse(now);
    if (!expired && resolved.session.status === "lobby_open" && resolved.link.status === "issued") {
      const waiting = await repository.updateCalendarGuestLinkStatus({
        firmId: resolved.link.firmId,
        matterId: resolved.link.matterId,
        eventId: resolved.link.eventId,
        sessionId: resolved.link.sessionId,
        linkId: resolved.link.id,
        status: "waiting",
        occurredAt: now,
      });
      if (waiting) {
        resolved = {
          ...resolved,
          link: waiting,
          links: await repository.listCalendarGuestLinks(waiting.firmId, {
            matterId: waiting.matterId,
            eventId: waiting.eventId,
            sessionId: waiting.sessionId,
          }),
        };
      }
    }
    await repository.createAccessLog(
      publicGuestSessionAccessLog({
        link: resolved.link,
        action: "submit",
        request,
        metadata: {
          outcome: publicGuestSessionOutcome({
            session: resolved.session,
            link: resolved.link,
            now,
          }),
          status: resolved.link.status,
          lobbyStatus: resolved.session.status,
          publicTokenTransition: true,
          updatedByUserId: resolved.link.updatedByUserId ?? null,
        },
      }),
    );
    return publicGuestSessionResponse({ ...resolved, now });
  };

  server.get(
    "/api/portal/guest-sessions",
    publicTokenPolicyOptions("guest-session", "view"),
    viewPublicGuestSession,
  );
  server.get(
    "/api/portal/guest-sessions/:token",
    publicTokenPolicyOptions("guest-session", "view"),
    viewPublicGuestSession,
  );

  server.post(
    "/api/portal/guest-sessions/check-in",
    publicTokenPolicyOptions("guest-session", "mutation"),
    checkInPublicGuestSession,
  );
  server.post(
    "/api/portal/guest-sessions/:token/check-in",
    publicTokenPolicyOptions("guest-session", "mutation"),
    checkInPublicGuestSession,
  );
}
