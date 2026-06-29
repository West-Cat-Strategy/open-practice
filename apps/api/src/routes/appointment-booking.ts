import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  AppointmentBookingLinkUnavailableError,
  AppointmentBookingSlotUnavailableError,
} from "@open-practice/database";
import {
  appointmentBookingLinkStatus,
  appointmentBookingPublicRequestResponse,
  buildReviewAgingCue,
  buildAppointmentBookingSlots,
  publicAppointmentBookingProfile,
  reviewAgingDecisionValues,
  summarizeAppointmentBookingLink,
  summarizeAppointmentBookingProfile,
  summarizeAppointmentBookingRequest,
  type AppointmentBookingLinkRecord,
  type AppointmentBookingProfileRecord,
  type AppointmentBookingRequestRecord,
  type AppointmentBookingSlot,
  type CalendarEventAttendeeRecord,
  type CalendarEventRecord,
  type PublicConsultationIntakeRecord,
  type User,
} from "@open-practice/domain";
import { requireStaffAccess } from "../http/auth-guards.js";
import {
  createSessionToken,
  hashToken,
  publicTokenPathFromHeader,
  readPublicTokenHeader,
} from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { assertCalendarScopeAccess, calendarScopeTarget } from "./calendar/shared.js";
import { publicTokenPolicyOptions } from "./public-token-rate-limits.js";
import { loadNotificationSettings } from "./public-consultation-intakes/shared.js";
import type { ApiRouteDependencies } from "./types.js";

const WEBSITE_BOOKING_RATE_LIMIT = { max: 12, timeWindow: "1 minute" };
const DEFAULT_SLOT_WINDOW_DAYS = 14;
const DIRECT_LINK_TTL_DAYS = 14;

const idParamsSchema = z.object({
  profileId: z.string().trim().min(1),
});

const requestIdParamsSchema = z.object({
  requestId: z.string().trim().min(1),
});

const tokenParamsSchema = z.object({
  token: z.string().trim().min(32),
});

const slotQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(160).default(80),
});

const weeklyWindowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((window) => timeMinutes(window.endTime) > timeMinutes(window.startTime), {
    message: "Booking window end time must be after start time",
    path: ["endTime"],
  });

const profileBaseBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  publicLabel: z.string().trim().min(1).max(120),
  description: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(500).optional(),
    )
    .optional(),
  timezone: z.string().trim().min(1).max(80).refine(isValidTimezone, {
    message: "Timezone must be a valid IANA timezone",
  }),
  durationMinutes: z.number().int().min(15).max(240),
  slotIntervalMinutes: z.number().int().min(5).max(240),
  minLeadMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 30),
  maxLeadDays: z.number().int().min(1).max(180),
  status: z.enum(["active", "paused"]).default("active"),
  weeklyWindows: z.array(weeklyWindowSchema).min(1).max(28),
});

const profileBodySchema = profileBaseBodySchema.refine(
  (profile) => profile.slotIntervalMinutes <= profile.durationMinutes,
  {
    message: "Slot interval cannot be longer than duration",
    path: ["slotIntervalMinutes"],
  },
);

const profilePatchBodySchema = profileBaseBodySchema.partial();

const linkBodySchema = z.object({
  matterId: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).optional(),
    )
    .optional(),
  clientContactId: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).optional(),
    )
    .optional(),
  expiresAt: z.string().datetime().optional(),
});

const requestListQuerySchema = z.object({
  status: z.enum(["tentative_hold", "confirmed", "dismissed"]).optional(),
  matterId: z.string().trim().min(1).optional(),
});

const optionalPublicEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().max(254).optional(),
);

const optionalPublicTelephoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(80).optional(),
);

const bookingBodySchema = z
  .object({
    startsAt: z.string().datetime(),
    requesterName: z.string().trim().min(1).max(180),
    requesterEmail: optionalPublicEmailSchema,
    requesterTelephone: optionalPublicTelephoneSchema,
    note: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
        z.string().trim().max(2000).optional(),
      )
      .optional(),
  })
  .refine((body) => Boolean(body.requesterEmail || body.requesterTelephone), {
    message: "At least one requester contact method is required",
    path: ["requesterEmail"],
  });

const websiteBookingBodySchema = bookingBodySchema.extend({
  sourceUrl: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().url().max(2048).optional(),
    )
    .optional(),
  opposingPartyNames: z.array(z.string().trim().min(1).max(240)).max(25).default([]),
  disclosureAccepted: z.literal(true),
  website: z.string().max(500).optional(),
});

const reviewBodySchema = z
  .object({
    status: z.enum(["confirmed", "dismissed"]),
    dismissedReason: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
        z.string().trim().max(500).optional(),
      )
      .optional(),
  })
  .refine((body) => body.status === "confirmed" || Boolean(body.dismissedReason), {
    message: "Dismissed booking requests require a reason",
    path: ["dismissedReason"],
  });

const agingReviewBodySchema = z.object({
  decision: z.enum(reviewAgingDecisionValues),
});

export type AppointmentBookingRouteDependencies = Pick<
  ApiRouteDependencies,
  "repository" | "publicWebBaseUrl"
> & {
  jwtSecret?: string;
  publicFirmId: string;
  publicActorUserId: string;
};

function timeMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

function requestOrigin(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return typeof origin === "string" && origin.trim() ? origin.trim() : undefined;
}

function directBookingUrl(publicWebBaseUrl: string | undefined, token: string): string {
  return `${(publicWebBaseUrl ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  )}/appointment-booking#${encodeURIComponent(token)}`;
}

function systemAuth(firmId: string, user: User): ApiAuthContext {
  return { firmId, user };
}

async function publicActor(options: AppointmentBookingRouteDependencies): Promise<User> {
  const actor = await options.repository.getUser(options.publicFirmId, options.publicActorUserId);
  if (!actor) {
    throw new ApiHttpError(
      503,
      "APPOINTMENT_BOOKING_PUBLIC_ACTOR_MISSING",
      "Appointment booking public actor is not configured",
    );
  }
  return actor;
}

function assertWebsiteBookingToken(input: {
  request: FastifyRequest;
  tokenHash?: string;
  jwtSecret?: string;
}): void {
  if (!input.tokenHash) {
    throw new ApiHttpError(
      503,
      "APPOINTMENT_BOOKING_WEBSITE_TOKEN_NOT_CONFIGURED",
      "Appointment booking website token is not configured",
    );
  }
  if (!input.jwtSecret) {
    throw new ApiHttpError(
      503,
      "APPOINTMENT_BOOKING_WEBSITE_TOKEN_UNAVAILABLE",
      "Appointment booking token verification is not configured",
    );
  }
  const token = bearerToken(input.request);
  if (!token) {
    throw new ApiHttpError(
      403,
      "APPOINTMENT_BOOKING_WEBSITE_TOKEN_REQUIRED",
      "A bearer token is required for appointment booking",
    );
  }
  const suppliedHash = hashToken(token, input.jwtSecret);
  if (!constantTimeEqual(suppliedHash, input.tokenHash)) {
    throw new ApiHttpError(
      403,
      "APPOINTMENT_BOOKING_WEBSITE_TOKEN_INVALID",
      "The appointment booking token was not accepted",
    );
  }
}

async function assertWebsiteBookingEnabled(
  options: AppointmentBookingRouteDependencies,
  request: FastifyRequest,
): Promise<void> {
  const settings = await loadNotificationSettings(options.repository, options.publicFirmId);
  const origin = requestOrigin(request);
  if (!origin) {
    throw new ApiHttpError(
      403,
      "APPOINTMENT_BOOKING_ORIGIN_REQUIRED",
      "A website origin is required for appointment booking",
    );
  }
  if (!settings.allowedOrigins.includes(origin)) {
    throw new ApiHttpError(
      403,
      "APPOINTMENT_BOOKING_ORIGIN_NOT_ALLOWED",
      "This website origin is not allowed to use appointment booking",
    );
  }
  if (!settings.enabled) {
    throw new ApiHttpError(
      503,
      "APPOINTMENT_BOOKING_WEBSITE_DISABLED",
      "Website appointment booking is not enabled",
    );
  }
  assertWebsiteBookingToken({
    request,
    tokenHash: settings.submissionTokenHash,
    jwtSecret: options.jwtSecret,
  });
}

function defaultSlotRange(
  profile: AppointmentBookingProfileRecord,
  query: z.infer<typeof slotQuerySchema>,
) {
  const now = new Date();
  const rangeStart = query.from ?? now.toISOString();
  const defaultDays = Math.min(profile.maxLeadDays, DEFAULT_SLOT_WINDOW_DAYS);
  const rangeEnd =
    query.to ?? new Date(now.getTime() + defaultDays * 24 * 60 * 60 * 1000).toISOString();
  return { rangeStart, rangeEnd };
}

async function slotsForProfile(input: {
  options: AppointmentBookingRouteDependencies;
  profile: AppointmentBookingProfileRecord;
  query: z.infer<typeof slotQuerySchema>;
}): Promise<AppointmentBookingSlot[]> {
  const { rangeStart, rangeEnd } = defaultSlotRange(input.profile, input.query);
  const events = await input.options.repository.listCalendarEvents(input.profile.firmId, {
    includeAllScopes: true,
    startsBefore: rangeEnd,
  });
  return buildAppointmentBookingSlots({
    profile: input.profile,
    events,
    rangeStart,
    rangeEnd,
    limit: input.query.limit,
  });
}

function assertSlotIsAvailable(
  slots: AppointmentBookingSlot[],
  startsAt: string,
): AppointmentBookingSlot {
  const slot = slots.find((candidate) => candidate.startsAt === startsAt);
  if (!slot) throw new AppointmentBookingSlotUnavailableError();
  return slot;
}

function createBookingEvent(input: {
  id?: string;
  firmId: string;
  actorUserId: string;
  startsAt: string;
  endsAt: string;
  now: string;
  source: "website" | "direct_link";
  matterId?: string;
  clientContactId?: string;
}): CalendarEventRecord {
  const id = input.id ?? `calendar-event-${createSessionToken().slice(0, 16)}`;
  const isMatter = Boolean(input.matterId);
  return {
    id,
    firmId: input.firmId,
    scope: isMatter ? "matter" : input.clientContactId ? "client" : "firm",
    matterId: input.matterId,
    clientContactId: input.clientContactId,
    uid: `${id}@open-practice.local`,
    title:
      input.source === "website" ? "Tentative consultation hold" : "Tentative appointment hold",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    description: "Submitted through appointment booking; staff review required.",
    status: "tentative",
    sequence: 0,
    meetingLinkMode: "blank",
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  };
}

function createMatterAttendee(input: {
  firmId: string;
  matterId: string;
  eventId: string;
  name: string;
  email: string;
  actorUserId: string;
  now: string;
}): CalendarEventAttendeeRecord {
  return {
    id: `calendar-attendee-${createSessionToken().slice(0, 16)}`,
    firmId: input.firmId,
    matterId: input.matterId,
    eventId: input.eventId,
    name: input.name,
    email: input.email,
    role: "required",
    responseStatus: "needs_action",
    invitationStatus: "not_sent",
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  };
}

function createPublicConsultationIntake(input: {
  firmId: string;
  body: z.infer<typeof websiteBookingBodySchema>;
  requestId: string;
  eventId: string;
  profileId: string;
  now: string;
}): PublicConsultationIntakeRecord {
  return {
    id: `public-intake-${createSessionToken().slice(0, 16)}`,
    firmId: input.firmId,
    status: "pending",
    clientName: input.body.requesterName,
    telephone: input.body.requesterTelephone ?? "",
    email: input.body.requesterEmail,
    opposingPartyNames: input.body.opposingPartyNames,
    matterDescription: input.body.note ?? "Appointment booking request.",
    sourceUrl: input.body.sourceUrl,
    disclosureAcceptedAt: input.now,
    submittedAt: input.now,
    metadata: {
      source: "appointment_booking_website",
      sourceUrlPresent: Boolean(input.body.sourceUrl),
      opposingPartyCount: input.body.opposingPartyNames.length,
      appointmentBookingRequestId: input.requestId,
      calendarEventId: input.eventId,
      appointmentBookingProfileId: input.profileId,
    },
  };
}

function createBookingRequest(input: {
  id?: string;
  firmId: string;
  profileId: string;
  linkId?: string;
  source: "website" | "direct_link";
  eventId: string;
  startsAt: string;
  endsAt: string;
  now: string;
  body: z.infer<typeof bookingBodySchema>;
  publicConsultationIntakeId?: string;
  matterId?: string;
  clientContactId?: string;
}): AppointmentBookingRequestRecord {
  return {
    id: input.id ?? `appointment-booking-request-${createSessionToken().slice(0, 16)}`,
    firmId: input.firmId,
    profileId: input.profileId,
    linkId: input.linkId,
    source: input.source,
    status: "tentative_hold",
    calendarEventId: input.eventId,
    publicConsultationIntakeId: input.publicConsultationIntakeId,
    matterId: input.matterId,
    clientContactId: input.clientContactId,
    requesterName: input.body.requesterName,
    requesterEmail: input.body.requesterEmail,
    requesterTelephone: input.body.requesterTelephone,
    requestedStartsAt: input.startsAt,
    requestedEndsAt: input.endsAt,
    submittedAt: input.now,
    metadata: {
      source: input.source,
      hasRequesterEmail: Boolean(input.body.requesterEmail),
      hasRequesterTelephone: Boolean(input.body.requesterTelephone),
      matterLinked: Boolean(input.matterId),
      clientContactLinked: Boolean(input.clientContactId),
    },
  };
}

function accessLog(input: {
  firmId: string;
  action: "view" | "submit";
  resourceType: string;
  resourceId: string;
  request: FastifyRequest;
  metadata?: Record<string, unknown>;
}) {
  const userAgent = input.request.headers["user-agent"];
  return {
    id: `access-log-${createSessionToken().slice(0, 16)}`,
    firmId: input.firmId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    occurredAt: new Date().toISOString(),
    ipAddress: input.request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent,
    metadata: input.metadata ?? {},
  };
}

async function profileForPublicRequest(
  options: AppointmentBookingRouteDependencies,
  profileId: string,
): Promise<AppointmentBookingProfileRecord> {
  const profile = await options.repository.getAppointmentBookingProfile(
    options.publicFirmId,
    profileId,
  );
  if (!profile || profile.status !== "active") {
    throw new ApiHttpError(
      404,
      "APPOINTMENT_BOOKING_PROFILE_NOT_FOUND",
      "Booking profile not found",
    );
  }
  return profile;
}

function requireAppointmentBookingSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "APPOINTMENT_BOOKING_TOKEN_SIGNING_NOT_CONFIGURED",
    "Appointment booking token signing is not configured",
  );
}

function readDirectLinkPublicToken(request: FastifyRequest): string {
  const params = request.params as { token?: string } | undefined;
  return parseRequestPart(
    tokenParamsSchema,
    params?.token ? params : publicTokenPathFromHeader(readPublicTokenHeader(request.headers)),
    "params",
  ).token;
}

async function directLinkForRequest(
  options: AppointmentBookingRouteDependencies,
  request: FastifyRequest,
): Promise<AppointmentBookingLinkRecord> {
  const token = readDirectLinkPublicToken(request);
  const tokenHash = hashToken(token, requireAppointmentBookingSecret(options.jwtSecret));
  const link = await options.repository.getAppointmentBookingLinkByTokenHash(tokenHash);
  if (!link) {
    throw new ApiHttpError(404, "APPOINTMENT_BOOKING_LINK_NOT_FOUND", "Booking link not found");
  }
  const status = appointmentBookingLinkStatus(link);
  if (status === "revoked") {
    throw new ApiHttpError(404, "APPOINTMENT_BOOKING_LINK_NOT_FOUND", "Booking link not found");
  }
  if (status === "expired") {
    throw new ApiHttpError(410, "APPOINTMENT_BOOKING_LINK_EXPIRED", "Booking link has expired");
  }
  if (status === "used") {
    throw new ApiHttpError(
      409,
      "APPOINTMENT_BOOKING_LINK_USED",
      "Booking link has already been used",
    );
  }
  return link;
}

async function profileForLink(
  options: AppointmentBookingRouteDependencies,
  link: AppointmentBookingLinkRecord,
): Promise<AppointmentBookingProfileRecord> {
  const profile = await options.repository.getAppointmentBookingProfile(
    link.firmId,
    link.profileId,
  );
  if (!profile || profile.status !== "active") {
    throw new ApiHttpError(
      404,
      "APPOINTMENT_BOOKING_PROFILE_NOT_FOUND",
      "Booking profile not found",
    );
  }
  return profile;
}

async function createTentativeHold(input: {
  options: AppointmentBookingRouteDependencies;
  profile: AppointmentBookingProfileRecord;
  body: z.infer<typeof bookingBodySchema>;
  source: "website" | "direct_link";
  actorUserId: string;
  eventId?: string;
  requestId?: string;
  link?: AppointmentBookingLinkRecord;
  publicConsultationIntake?: PublicConsultationIntakeRecord;
  request: FastifyRequest;
}) {
  const startsAt = input.body.startsAt;
  const endsAt = new Date(
    Date.parse(startsAt) + input.profile.durationMinutes * 60 * 1000,
  ).toISOString();
  const slots = await slotsForProfile({
    options: input.options,
    profile: input.profile,
    query: { from: startsAt, to: endsAt, limit: 1 },
  });
  const slot = assertSlotIsAvailable(slots, startsAt);
  const now = new Date().toISOString();
  const matterId = input.link?.matterId;
  const clientContactId = input.link?.clientContactId;
  const event = createBookingEvent({
    id: input.eventId,
    firmId: input.profile.firmId,
    actorUserId: input.actorUserId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    now,
    source: input.source,
    matterId,
    clientContactId,
  });
  const bookingRequest = createBookingRequest({
    id: input.requestId,
    firmId: input.profile.firmId,
    profileId: input.profile.id,
    linkId: input.link?.id,
    source: input.source,
    eventId: event.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    now,
    body: input.body,
    publicConsultationIntakeId: input.publicConsultationIntake?.id,
    matterId,
    clientContactId,
  });
  const attendee =
    matterId && input.body.requesterEmail
      ? createMatterAttendee({
          firmId: input.profile.firmId,
          matterId,
          eventId: event.id,
          name: input.body.requesterName,
          email: input.body.requesterEmail,
          actorUserId: input.actorUserId,
          now,
        })
      : undefined;

  try {
    return await input.options.repository.createAppointmentBookingTentativeHold({
      firmId: input.profile.firmId,
      profileId: input.profile.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      event,
      request: bookingRequest,
      attendee,
      publicConsultationIntake: input.publicConsultationIntake,
      linkId: input.link?.id,
      usedAt: input.link ? now : undefined,
    });
  } catch (error) {
    if (error instanceof AppointmentBookingSlotUnavailableError) {
      throw new ApiHttpError(
        409,
        "APPOINTMENT_BOOKING_SLOT_UNAVAILABLE",
        "Appointment booking slot is no longer available",
      );
    }
    if (error instanceof AppointmentBookingLinkUnavailableError) {
      if (error.reason === "used") {
        throw new ApiHttpError(
          409,
          "APPOINTMENT_BOOKING_LINK_USED",
          "Booking link has already been used",
        );
      }
      if (error.reason === "revoked") {
        throw new ApiHttpError(
          410,
          "APPOINTMENT_BOOKING_LINK_REVOKED",
          "Booking link has been revoked",
        );
      }
      if (error.reason === "expired") {
        throw new ApiHttpError(410, "APPOINTMENT_BOOKING_LINK_EXPIRED", "Booking link has expired");
      }
      throw new ApiHttpError(404, "APPOINTMENT_BOOKING_LINK_NOT_FOUND", "Booking link not found");
    }
    throw error;
  }
}

export function registerAppointmentBookingRoutes(
  server: FastifyInstance,
  options: AppointmentBookingRouteDependencies,
): void {
  const { repository } = options;

  server.get("/api/appointment-booking/profiles", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const profiles = await repository.listAppointmentBookingProfiles(request.auth.firmId);
    return { profiles: profiles.map(summarizeAppointmentBookingProfile) };
  });

  server.post("/api/appointment-booking/profiles", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const body = parseRequestPart(profileBodySchema, request.body, "body");
    const now = new Date().toISOString();
    const profile: AppointmentBookingProfileRecord = {
      id: `appointment-booking-profile-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      ...body,
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    };
    const created = await repository.upsertAppointmentBookingProfile(profile);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "appointment_booking.profile.upserted",
      resourceType: "appointment_booking_profile",
      resourceId: created.id,
      occurredAt: now,
      metadata: {
        profileId: created.id,
        status: created.status,
        windowCount: created.weeklyWindows.length,
        durationMinutes: created.durationMinutes,
      },
    });
    return reply.code(201).send({ profile: summarizeAppointmentBookingProfile(created) });
  });

  server.patch("/api/appointment-booking/profiles/:profileId", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(profilePatchBodySchema, request.body, "body");
    const existing = await repository.getAppointmentBookingProfile(
      request.auth.firmId,
      params.profileId,
    );
    if (!existing) {
      throw new ApiHttpError(
        404,
        "APPOINTMENT_BOOKING_PROFILE_NOT_FOUND",
        "Booking profile not found",
      );
    }
    const now = new Date().toISOString();
    const profileUpdate: AppointmentBookingProfileRecord = {
      ...existing,
      ...body,
      updatedAt: now,
      updatedByUserId: request.auth.user.id,
    };
    parseRequestPart(
      profileBodySchema,
      {
        label: profileUpdate.label,
        publicLabel: profileUpdate.publicLabel,
        description: profileUpdate.description,
        timezone: profileUpdate.timezone,
        durationMinutes: profileUpdate.durationMinutes,
        slotIntervalMinutes: profileUpdate.slotIntervalMinutes,
        minLeadMinutes: profileUpdate.minLeadMinutes,
        maxLeadDays: profileUpdate.maxLeadDays,
        status: profileUpdate.status,
        weeklyWindows: profileUpdate.weeklyWindows,
      },
      "body",
    );
    const updated = await repository.upsertAppointmentBookingProfile(profileUpdate);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "appointment_booking.profile.upserted",
      resourceType: "appointment_booking_profile",
      resourceId: updated.id,
      occurredAt: now,
      metadata: {
        profileId: updated.id,
        status: updated.status,
        windowCount: updated.weeklyWindows.length,
        durationMinutes: updated.durationMinutes,
      },
    });
    return { profile: summarizeAppointmentBookingProfile(updated) };
  });

  server.post("/api/appointment-booking/profiles/:profileId/links", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(linkBodySchema, request.body, "body");
    const profile = await repository.getAppointmentBookingProfile(
      request.auth.firmId,
      params.profileId,
    );
    if (!profile) {
      throw new ApiHttpError(
        404,
        "APPOINTMENT_BOOKING_PROFILE_NOT_FOUND",
        "Booking profile not found",
      );
    }
    if (body.matterId) {
      await assertCalendarScopeAccess(
        repository,
        request.auth,
        calendarScopeTarget({ scope: "matter", matterId: body.matterId }),
        "create",
      );
    }
    const token = createSessionToken();
    const now = new Date().toISOString();
    const link: AppointmentBookingLinkRecord = {
      id: `appointment-booking-link-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      profileId: profile.id,
      tokenHash: hashToken(token, requireAppointmentBookingSecret(options.jwtSecret)),
      matterId: body.matterId,
      clientContactId: body.clientContactId,
      expiresAt:
        body.expiresAt ??
        new Date(Date.parse(now) + DIRECT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      metadata: {
        matterLinked: Boolean(body.matterId),
        clientContactLinked: Boolean(body.clientContactId),
      },
    };
    const created = await repository.createAppointmentBookingLink(link);
    await appendRouteAuditEvent(repository, request.auth, {
      action: "appointment_booking.link.created",
      resourceType: "appointment_booking_link",
      resourceId: created.id,
      occurredAt: now,
      metadata: {
        profileId: created.profileId,
        linkId: created.id,
        expiresAt: created.expiresAt,
        matterLinked: Boolean(created.matterId),
        clientContactLinked: Boolean(created.clientContactId),
      },
    });
    return reply.code(201).send({
      link: summarizeAppointmentBookingLink(created, now),
      token,
      url: directBookingUrl(options.publicWebBaseUrl, token),
    });
  });

  server.get("/api/appointment-booking/requests", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const query = parseRequestPart(requestListQuerySchema, request.query, "query");
    const [profiles, requests] = await Promise.all([
      repository.listAppointmentBookingProfiles(request.auth.firmId),
      repository.listAppointmentBookingRequests(request.auth.firmId, query),
    ]);
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const now = new Date().toISOString();
    return {
      requests: requests.map((bookingRequest) =>
        summarizeAppointmentBookingRequest({
          request: bookingRequest,
          profile: profileById.get(bookingRequest.profileId),
          now,
        }),
      ),
    };
  });

  server.patch("/api/appointment-booking/requests/:requestId/review", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(requestIdParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewBodySchema, request.body, "body");
    const existing = await repository.getAppointmentBookingRequest(
      request.auth.firmId,
      params.requestId,
    );
    if (!existing) {
      throw new ApiHttpError(
        404,
        "APPOINTMENT_BOOKING_REQUEST_NOT_FOUND",
        "Booking request not found",
      );
    }
    if (existing.status !== "tentative_hold") {
      throw new ApiHttpError(
        409,
        "APPOINTMENT_BOOKING_REQUEST_ALREADY_REVIEWED",
        "Booking request has already been reviewed",
      );
    }
    const now = new Date().toISOString();
    const reviewed = await repository.reviewAppointmentBookingRequest({
      firmId: request.auth.firmId,
      requestId: existing.id,
      status: body.status,
      dismissedReason: body.dismissedReason,
      reviewedAt: now,
      reviewedByUserId: request.auth.user.id,
    });
    if (!reviewed) {
      throw new ApiHttpError(
        404,
        "APPOINTMENT_BOOKING_REQUEST_NOT_FOUND",
        "Booking request not found",
      );
    }
    const profile = await repository.getAppointmentBookingProfile(
      request.auth.firmId,
      reviewed.request.profileId,
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "appointment_booking.hold.reviewed",
      resourceType: "appointment_booking_request",
      resourceId: reviewed.request.id,
      occurredAt: now,
      metadata: {
        requestId: reviewed.request.id,
        profileId: reviewed.request.profileId,
        eventId: reviewed.event.id,
        reviewStatus: reviewed.request.status,
        eventStatus: reviewed.event.status,
        source: reviewed.request.source,
        matterLinked: Boolean(reviewed.request.matterId),
      },
    });
    return {
      request: summarizeAppointmentBookingRequest({
        request: reviewed.request,
        profile,
        now,
      }),
    };
  });

  server.patch("/api/appointment-booking/requests/:requestId/aging-review", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(requestIdParamsSchema, request.params, "params");
    const body = parseRequestPart(agingReviewBodySchema, request.body, "body");
    const existing = await repository.getAppointmentBookingRequest(
      request.auth.firmId,
      params.requestId,
    );
    if (!existing) {
      throw new ApiHttpError(
        404,
        "APPOINTMENT_BOOKING_REQUEST_NOT_FOUND",
        "Booking request not found",
      );
    }
    if (existing.status !== "tentative_hold") {
      throw new ApiHttpError(
        409,
        "APPOINTMENT_BOOKING_AGING_REVIEW_CLOSED",
        "Booking request is no longer an open tentative hold",
      );
    }
    const now = new Date().toISOString();
    const cue = buildReviewAgingCue({ referenceAt: existing.submittedAt, now });
    if (cue.status === "fresh") {
      throw new ApiHttpError(
        409,
        "APPOINTMENT_BOOKING_AGING_REVIEW_NOT_AGING",
        "Booking request is not aging or stale yet",
      );
    }
    const updated = await repository.recordAppointmentBookingAgingReviewDecision({
      firmId: request.auth.firmId,
      requestId: existing.id,
      decision: body.decision,
      decidedAt: now,
      decidedByUserId: request.auth.user.id,
      cueStatus: cue.status,
      ageHours: cue.ageHours,
    });
    if (!updated) {
      throw new ApiHttpError(
        404,
        "APPOINTMENT_BOOKING_REQUEST_NOT_FOUND",
        "Booking request not found",
      );
    }
    const profile = await repository.getAppointmentBookingProfile(
      request.auth.firmId,
      updated.profileId,
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "appointment_booking.hold.aging_review_recorded",
      resourceType: "appointment_booking_request",
      resourceId: updated.id,
      occurredAt: now,
      metadata: {
        requestId: updated.id,
        profileId: updated.profileId,
        eventId: updated.calendarEventId,
        decision: body.decision,
        cueStatus: cue.status,
        ageHours: cue.ageHours,
        automaticFinalConfirmation: false,
        autoExpires: false,
        providerSync: false,
        publicRoomCreated: false,
        nativeMediaCreated: false,
        chatCreated: false,
        recordingCreated: false,
        matterCreated: false,
      },
    });
    return {
      request: summarizeAppointmentBookingRequest({
        request: updated,
        profile,
        now,
      }),
    };
  });

  server.get(
    "/api/public/appointment-booking/:profileId/slots",
    {
      config: {
        rateLimit: {
          ...WEBSITE_BOOKING_RATE_LIMIT,
          keyGenerator: (request: FastifyRequest) =>
            `${request.ip}:appointment-booking-slots:${requestOrigin(request) ?? "no-origin"}`,
        },
      },
    },
    async (request) => {
      await assertWebsiteBookingEnabled(options, request);
      const params = parseRequestPart(idParamsSchema, request.params, "params");
      const query = parseRequestPart(slotQuerySchema, request.query, "query");
      const profile = await profileForPublicRequest(options, params.profileId);
      const slots = await slotsForProfile({ options, profile, query });
      await repository.createAccessLog(
        accessLog({
          firmId: profile.firmId,
          action: "view",
          resourceType: "appointment_booking_profile",
          resourceId: profile.id,
          request,
          metadata: {
            source: "website",
            slotCount: slots.length,
            originPresent: Boolean(requestOrigin(request)),
          },
        }),
      );
      return {
        profile: publicAppointmentBookingProfile(profile),
        slots,
      };
    },
  );

  server.post(
    "/api/public/appointment-booking/:profileId/bookings",
    {
      config: {
        rateLimit: {
          ...WEBSITE_BOOKING_RATE_LIMIT,
          keyGenerator: (request: FastifyRequest) =>
            `${request.ip}:appointment-booking-book:${requestOrigin(request) ?? "no-origin"}`,
        },
      },
    },
    async (request, reply) => {
      await assertWebsiteBookingEnabled(options, request);
      const params = parseRequestPart(idParamsSchema, request.params, "params");
      const body = parseRequestPart(websiteBookingBodySchema, request.body, "body");
      if (body.website?.trim()) {
        reply.code(202);
        return { status: "received" };
      }
      const profile = await profileForPublicRequest(options, params.profileId);
      const actor = await publicActor(options);
      const eventId = `calendar-event-${createSessionToken().slice(0, 16)}`;
      const requestId = `appointment-booking-request-${createSessionToken().slice(0, 16)}`;
      const now = new Date().toISOString();
      const intake = createPublicConsultationIntake({
        firmId: profile.firmId,
        body,
        requestId,
        eventId,
        profileId: profile.id,
        now,
      });
      const result = await createTentativeHold({
        options,
        profile,
        body,
        source: "website",
        actorUserId: actor.id,
        eventId,
        requestId,
        publicConsultationIntake: intake,
        request,
      });
      const auth = systemAuth(profile.firmId, actor);
      await appendRouteAuditEvent(repository, auth, {
        action: "appointment_booking.hold.created",
        resourceType: "appointment_booking_request",
        resourceId: result.request.id,
        metadata: {
          requestId: result.request.id,
          profileId: profile.id,
          eventId: result.event.id,
          source: "website",
          status: result.request.status,
          sourceUrlPresent: Boolean(body.sourceUrl),
          opposingPartyCount: body.opposingPartyNames.length,
          hasRequesterEmail: Boolean(body.requesterEmail),
          hasRequesterTelephone: Boolean(body.requesterTelephone),
        },
      });
      await repository.createAccessLog(
        accessLog({
          firmId: profile.firmId,
          action: "submit",
          resourceType: "appointment_booking_request",
          resourceId: result.request.id,
          request,
          metadata: {
            source: "website",
            profileId: profile.id,
            status: result.request.status,
            sourceUrlPresent: Boolean(body.sourceUrl),
          },
        }),
      );
      reply.code(201);
      return {
        booking: appointmentBookingPublicRequestResponse({
          request: result.request,
          profile,
        }),
      };
    },
  );

  async function directBookingView(request: FastifyRequest) {
    const link = await directLinkForRequest(options, request);
    const profile = await profileForLink(options, link);
    const query = parseRequestPart(slotQuerySchema, request.query, "query");
    const slots = await slotsForProfile({ options, profile, query });
    await repository.createAccessLog(
      accessLog({
        firmId: profile.firmId,
        action: "view",
        resourceType: "appointment_booking_link",
        resourceId: link.id,
        request,
        metadata: {
          source: "direct_link",
          profileId: profile.id,
          slotCount: slots.length,
        },
      }),
    );
    return {
      profile: publicAppointmentBookingProfile(profile),
      slots,
      link: {
        status: appointmentBookingLinkStatus(link),
        expiresAt: link.expiresAt,
      },
    };
  }

  async function directBookingSubmit(request: FastifyRequest, reply: FastifyReply) {
    const link = await directLinkForRequest(options, request);
    const profile = await profileForLink(options, link);
    const body = parseRequestPart(bookingBodySchema, request.body, "body");
    const actor = await repository.getUser(link.firmId, link.createdByUserId);
    if (!actor) {
      throw new ApiHttpError(
        503,
        "APPOINTMENT_BOOKING_LINK_OWNER_MISSING",
        "Appointment booking link owner is not configured",
      );
    }
    const result = await createTentativeHold({
      options,
      profile,
      body,
      source: "direct_link",
      actorUserId: actor.id,
      link,
      request,
    });
    await appendRouteAuditEvent(repository, systemAuth(link.firmId, actor), {
      action: "appointment_booking.hold.created",
      resourceType: "appointment_booking_request",
      resourceId: result.request.id,
      metadata: {
        requestId: result.request.id,
        profileId: profile.id,
        linkId: link.id,
        eventId: result.event.id,
        source: "direct_link",
        status: result.request.status,
        matterLinked: Boolean(link.matterId),
        clientContactLinked: Boolean(link.clientContactId),
        attendeeAdded: Boolean(link.matterId && body.requesterEmail),
      },
    });
    await repository.createAccessLog(
      accessLog({
        firmId: profile.firmId,
        action: "submit",
        resourceType: "appointment_booking_request",
        resourceId: result.request.id,
        request,
        metadata: {
          source: "direct_link",
          profileId: profile.id,
          linkId: link.id,
          status: result.request.status,
        },
      }),
    );
    reply.code(201);
    return {
      booking: appointmentBookingPublicRequestResponse({
        request: result.request,
        profile,
      }),
    };
  }

  server.get(
    "/api/portal/appointment-bookings/:token",
    publicTokenPolicyOptions("appointment-booking", "view"),
    directBookingView,
  );
  server.get(
    "/api/portal/appointment-bookings",
    publicTokenPolicyOptions("appointment-booking", "view"),
    directBookingView,
  );
  server.post(
    "/api/portal/appointment-bookings/:token/book",
    publicTokenPolicyOptions("appointment-booking", "mutation"),
    directBookingSubmit,
  );
  server.post(
    "/api/portal/appointment-bookings/book",
    publicTokenPolicyOptions("appointment-booking", "mutation"),
    directBookingSubmit,
  );
}
