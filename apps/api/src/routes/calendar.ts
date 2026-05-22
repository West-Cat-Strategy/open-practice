import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  assertValidCalendarEventRange,
  buildCalendarMeetingInvitationBoundary,
  buildICalendarFeed,
  calendarMeetingInvitationBoundaryMetadata,
} from "@open-practice/domain";
import type {
  AccessLogRecord,
  CalendarCredentialRecord,
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarEventReminderRecord,
  CalendarGuestLinkRecord,
  CalendarMeetingInvitationBoundary,
  CalendarMeetingLinkMode,
  CalendarMeetingSessionRecord,
  NewAuditEvent,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashPassword, hashToken } from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "./delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import { publicTokenPolicyOptions } from "./public-token-rate-limits.js";
import type { ApiRouteDependencies } from "./types.js";

type CalendarRouteDependencies = ApiRouteDependencies & {
  jwtSecret?: string;
  publicWebBaseUrl?: string;
};

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

function requireGuestAccessSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "MEETING_GUEST_ACCESS_NOT_CONFIGURED",
    "Meeting guest access tokens are not configured",
  );
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
  return `${(publicWebBaseUrl ?? "http://localhost:3000").replace(/\/+$/, "")}/guest-sessions/${encodeURIComponent(
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

async function calendarGuestSessionWithLinks(
  repository: ApiRouteDependencies["repository"],
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
  repository: ApiRouteDependencies["repository"];
  jwtSecret?: string;
  token: string;
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
    throw new ApiHttpError(404, "GUEST_SESSION_NOT_FOUND", "Guest session was not found");
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
    throw new ApiHttpError(404, "GUEST_SESSION_NOT_FOUND", "Guest session was not found");
  }
  const links = await input.repository.listCalendarGuestLinks(link.firmId, {
    matterId: link.matterId,
    eventId: link.eventId,
    sessionId: link.sessionId,
  });
  return { event, session, link, links };
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
  dependencies: CalendarRouteDependencies,
): void {
  const { repository, emailJobQueue, jwtSecret, publicWebBaseUrl } = dependencies;

  server.get("/api/calendar/events", async (request) => {
    const query = parseRequestPart(calendarEventsQuerySchema, request.query, "query");
    assertCalendarAccess(request.auth, query.matterId, "read");
    const meetingInvitationBoundary = await calendarMeetingInvitationBoundaryForRequest(
      dependencies,
      request.auth.firmId,
    );
    const events = await repository.listCalendarEvents(request.auth.firmId, query);
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
      matterId: event.matterId,
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
      if (session.status === "ended") {
        throw new ApiHttpError(
          409,
          "MEETING_SESSION_ENDED",
          "Guest links cannot be issued for ended sessions",
        );
      }
      const now = new Date();
      const token = createSessionToken();
      const link = await repository.createCalendarGuestLink({
        id: `calendar-guest-link-${createSessionToken().slice(0, 16)}`,
        firmId: request.auth.firmId,
        matterId: event.matterId,
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
    const session = await repository.getCalendarMeetingSession(
      request.auth.firmId,
      body.matterId,
      event.id,
      params.sessionId,
    );
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

  server.get(
    "/api/portal/guest-sessions/:token",
    publicTokenPolicyOptions("guest-session", "view"),
    async (request) => {
      const params = parseRequestPart(publicGuestSessionParamsSchema, request.params, "params");
      const resolved = await resolvePublicGuestSession({
        repository,
        jwtSecret,
        token: params.token,
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
    },
  );

  server.post(
    "/api/portal/guest-sessions/:token/check-in",
    publicTokenPolicyOptions("guest-session", "mutation"),
    async (request) => {
      const params = parseRequestPart(publicGuestSessionParamsSchema, request.params, "params");
      parseRequestPart(publicGuestCheckInBodySchema, request.body ?? {}, "body");
      let resolved = await resolvePublicGuestSession({
        repository,
        jwtSecret,
        token: params.token,
      });
      const now = new Date().toISOString();
      const expired = Date.parse(resolved.link.expiresAt) <= Date.parse(now);
      if (
        !expired &&
        resolved.session.status === "lobby_open" &&
        resolved.link.status === "issued"
      ) {
        const waiting = await repository.updateCalendarGuestLinkStatus({
          firmId: resolved.link.firmId,
          matterId: resolved.link.matterId,
          eventId: resolved.link.eventId,
          sessionId: resolved.link.sessionId,
          linkId: resolved.link.id,
          status: "waiting",
          occurredAt: now,
          actorUserId: resolved.link.createdByUserId,
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
          },
        }),
      );
      return publicGuestSessionResponse({ ...resolved, now });
    },
  );

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
