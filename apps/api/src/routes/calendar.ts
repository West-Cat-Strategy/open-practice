import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  assertValidCalendarEventRange,
  buildReviewAgingCue,
  buildCalendarSchedulingRequestSummaries,
  reviewAgingDecisionValues,
} from "@open-practice/domain";
import type { CalendarEventRecord, CalendarSchedulingRequestRecord } from "@open-practice/domain";
import { requireAccess, requireStaffAccess } from "../http/auth-guards.js";
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
  calendarEventResponse,
  calendarEventParamsSchema,
  calendarEventScope,
  calendarMeetingInvitationBoundaryForRequest,
  calendarScopeSchema,
  calendarScopeTarget,
  calendarScopeTargetMatchesEvent,
  recordCalendarAuditEvent,
  trustedApiBaseUrl,
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

const calendarSchedulingRequestParamsSchema = z.object({
  requestId: z.string().min(1),
});

const calendarSchedulingRequestBodySchema = z
  .object({
    matterId: z.string().min(1),
    kind: z
      .enum(["deadline_review", "event_scheduling", "reminder_review"])
      .default("event_scheduling"),
    title: z.string().trim().min(1).max(160),
    taskId: z.string().min(1).optional(),
    calendarEventId: z.string().min(1).optional(),
    calendarReminderId: z.string().min(1).optional(),
    ownerUserId: z.string().min(1).optional(),
    sourceType: z
      .enum(["task_deadline", "calendar_event", "calendar_reminder", "manual"])
      .default("manual"),
    sourceId: z.string().trim().min(1).max(160).optional(),
    sourceLabel: z.string().trim().min(1).max(160).optional(),
    requestedDueAt: z.string().datetime().optional(),
    requestedStartsAt: z.string().datetime().optional(),
    requestedEndsAt: z.string().datetime().optional(),
    reminderPosture: z
      .enum(["none", "dashboard_pending", "delivery_opt_in_available"])
      .default("none"),
    privacy: z.enum(["staff_only", "matter_team"]).default("staff_only"),
    timeCaptureCue: z
      .object({
        posture: z.enum(["none", "draft_available", "captured"]).default("none"),
        suggestedMinutes: z.number().int().positive().max(1440).optional(),
        existingTimeEntryCount: z.number().int().min(0).default(0),
        billable: z.boolean().default(false),
      })
      .default({
        posture: "none",
        existingTimeEntryCount: 0,
        billable: false,
      }),
  })
  .refine((value) => Boolean(value.requestedStartsAt) === Boolean(value.requestedEndsAt), {
    message: "Scheduling requests require both requestedStartsAt and requestedEndsAt",
    path: ["requestedEndsAt"],
  })
  .refine((value) => !value.calendarReminderId || Boolean(value.calendarEventId), {
    message: "Scheduling requests with calendarReminderId require calendarEventId",
    path: ["calendarEventId"],
  });
type CalendarSchedulingRequestBody = z.infer<typeof calendarSchedulingRequestBodySchema>;

const calendarSchedulingReviewBodySchema = z
  .object({
    matterId: z.string().min(1),
    status: z.enum(["reviewed", "dismissed", "scheduled"]),
    calendarEventId: z.string().min(1).optional(),
  })
  .refine((value) => value.status !== "scheduled" || Boolean(value.calendarEventId), {
    message: "Scheduled requests require calendarEventId",
    path: ["calendarEventId"],
  })
  .refine((value) => value.status === "scheduled" || !value.calendarEventId, {
    message: "Only scheduled requests may link calendarEventId",
    path: ["calendarEventId"],
  });

const calendarSchedulingAgingReviewBodySchema = z.object({
  matterId: z.string().min(1),
  decision: z.enum(reviewAgingDecisionValues),
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
  const metadata: Record<string, unknown> = {
    scope: calendarEventScope(event),
    matterId: event.matterId,
    clientContactId: event.clientContactId,
    eventId: event.id,
    uid: event.uid,
    status: event.status,
    sequence: event.sequence,
    attendeeCount: event.attendees?.length ?? 0,
    reminderCount: event.reminders?.length ?? 0,
    hasMeetingLink: Boolean(event.meetingLinkUrl),
  };
  if (event.meetingLinkMode) metadata.meetingLinkMode = event.meetingLinkMode;
  if (event.meetingProviderKey) metadata.meetingProviderKey = event.meetingProviderKey;
  return metadata;
}

function schedulingRequestAuditMetadata(
  request: CalendarSchedulingRequestRecord,
): Record<string, unknown> {
  return {
    matterId: request.matterId,
    requestId: request.id,
    status: request.status,
    kind: request.kind,
    sourceType: request.sourceType,
    ownerUserId: request.ownerUserId,
    privacy: request.privacy,
    hasRequestedDueAt: Boolean(request.requestedDueAt),
    hasRequestedStartsAt: Boolean(request.requestedStartsAt),
    hasRequestedEndsAt: Boolean(request.requestedEndsAt),
    taskId: request.taskId,
    calendarEventId: request.calendarEventId,
    calendarReminderId: request.calendarReminderId,
  };
}

function openSchedulingRequestDuplicate(
  existing: CalendarSchedulingRequestRecord,
  body: CalendarSchedulingRequestBody,
): boolean {
  if (existing.status !== "needs_review") return false;
  if (body.taskId && existing.taskId === body.taskId) return true;
  if (
    body.calendarReminderId &&
    existing.calendarReminderId === body.calendarReminderId &&
    existing.calendarEventId === body.calendarEventId
  ) {
    return true;
  }
  if (
    !body.calendarReminderId &&
    body.calendarEventId &&
    existing.calendarEventId === body.calendarEventId
  ) {
    return true;
  }
  return Boolean(
    body.sourceId && existing.sourceType === body.sourceType && existing.sourceId === body.sourceId,
  );
}

async function assertNoOpenSchedulingRequestDuplicate(input: {
  repository: CalendarRouteDependencies["repository"];
  firmId: string;
  body: CalendarSchedulingRequestBody;
}): Promise<void> {
  const existingRequests = await input.repository.listCalendarSchedulingRequests(input.firmId, {
    matterId: input.body.matterId,
    status: "needs_review",
  });
  const duplicate = existingRequests.find((request) =>
    openSchedulingRequestDuplicate(request, input.body),
  );
  if (!duplicate) return;
  throw new ApiHttpError(
    409,
    "CALENDAR_SCHEDULING_REQUEST_DUPLICATE",
    "Open scheduling request already exists for this source",
    {
      matterId: input.body.matterId,
      requestId: duplicate.id,
    },
  );
}

async function schedulingRequestSummaryForResponse(input: {
  request: CalendarSchedulingRequestRecord;
  events: CalendarEventRecord[];
  includeTimeCapture: boolean;
  now?: string;
}): Promise<unknown> {
  return buildCalendarSchedulingRequestSummaries({
    requests: [input.request],
    events: input.events,
    includeTimeCapture: input.includeTimeCapture,
    now: input.now,
  })[0];
}

async function calendarReminderOwnerEvent(input: {
  repository: CalendarRouteDependencies["repository"];
  firmId: string;
  matterId: string;
  reminderId: string;
}): Promise<CalendarEventRecord | undefined> {
  const events = await input.repository.listCalendarEvents(input.firmId, {
    matterId: input.matterId,
  });
  return events.find((event) =>
    (event.reminders ?? []).some((reminder) => reminder.id === input.reminderId),
  );
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
  const { repository, publicApiBaseUrl } = dependencies;

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
      const now = new Date().toISOString();

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
          now,
        }),
        caldavUrl: `${trustedApiBaseUrl(request, publicApiBaseUrl)}/caldav`,
        subscriptionUrl: webcalSubscriptionUrl(request, query.matterId, publicApiBaseUrl),
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

  server.post("/api/calendar/scheduling-requests", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const body = parseRequestPart(calendarSchedulingRequestBodySchema, request.body, "body");
    await assertCalendarScopeAccess(
      repository,
      request.auth,
      calendarScopeTarget({ scope: "matter", matterId: body.matterId }),
      "create",
    );
    if (body.requestedStartsAt && body.requestedEndsAt) {
      assertCalendarEventRangeForRequest(body.requestedStartsAt, body.requestedEndsAt);
    }
    if (body.calendarEventId) {
      const event = await repository.getCalendarEvent(
        request.auth.firmId,
        body.matterId,
        body.calendarEventId,
      );
      if (!event) {
        throw new ApiHttpError(404, "CALENDAR_EVENT_NOT_FOUND", "Calendar event not found", {
          eventId: body.calendarEventId,
        });
      }
    }
    if (body.taskId) {
      const task = await repository.getTaskDeadline(request.auth.firmId, body.taskId, {
        includeArchived: true,
      });
      if (!task || task.matterId !== body.matterId) {
        throw new ApiHttpError(404, "CALENDAR_TASK_NOT_FOUND", "Calendar task link not found", {
          taskId: body.taskId,
        });
      }
    }
    if (body.calendarReminderId) {
      const reminders = await repository.listCalendarEventReminders(
        request.auth.firmId,
        body.matterId,
        body.calendarEventId!,
      );
      if (!reminders.some((reminder) => reminder.id === body.calendarReminderId)) {
        throw new ApiHttpError(
          404,
          "CALENDAR_REMINDER_NOT_FOUND",
          "Calendar reminder link not found",
          { reminderId: body.calendarReminderId },
        );
      }
    }
    if (body.ownerUserId) {
      const owner = await repository.getUser(request.auth.firmId, body.ownerUserId);
      if (!owner) {
        throw new ApiHttpError(
          404,
          "CALENDAR_SCHEDULING_OWNER_NOT_FOUND",
          "Scheduling request owner not found",
          { ownerUserId: body.ownerUserId },
        );
      }
      const ownerAccess = requireAccess(
        { firmId: request.auth.firmId, user: owner },
        { resource: "calendar_event", action: "read", matterId: body.matterId },
      );
      if (!ownerAccess.ok) throw ownerAccess.error;
    }
    await assertNoOpenSchedulingRequestDuplicate({
      repository,
      firmId: request.auth.firmId,
      body,
    });
    const now = new Date().toISOString();
    const schedulingRequest: CalendarSchedulingRequestRecord = {
      id: `calendar-request-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      kind: body.kind,
      status: "needs_review",
      title: body.title,
      taskId: body.taskId,
      calendarEventId: body.calendarEventId,
      calendarReminderId: body.calendarReminderId,
      ownerUserId: body.ownerUserId ?? request.auth.user.id,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      sourceLabel: body.sourceLabel ?? body.sourceType,
      requestedDueAt: body.requestedDueAt,
      requestedStartsAt: body.requestedStartsAt,
      requestedEndsAt: body.requestedEndsAt,
      reminderPosture: body.reminderPosture,
      privacy: body.privacy,
      timeCaptureCue: body.timeCaptureCue,
      createdAt: now,
      updatedAt: now,
      createdByUserId: request.auth.user.id,
      updatedByUserId: request.auth.user.id,
    };
    const created = await repository.createCalendarSchedulingRequest(schedulingRequest);
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.scheduling_request.created",
      resourceType: "calendar_scheduling_request",
      resourceId: created.id,
      occurredAt: now,
      metadata: schedulingRequestAuditMetadata(created),
    });
    const events = await repository.listCalendarEvents(request.auth.firmId, {
      matterId: body.matterId,
    });
    return reply.code(201).send({
      schedulingRequest: await schedulingRequestSummaryForResponse({
        request: created,
        events,
        includeTimeCapture: canReadTimeCapture(request.auth, body.matterId),
        now,
      }),
    });
  });

  server.patch("/api/calendar/scheduling-requests/:requestId/review", async (request, reply) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;
    const params = parseRequestPart(
      calendarSchedulingRequestParamsSchema,
      request.params,
      "params",
    );
    const body = parseRequestPart(calendarSchedulingReviewBodySchema, request.body, "body");
    await assertCalendarScopeAccess(
      repository,
      request.auth,
      calendarScopeTarget({ scope: "matter", matterId: body.matterId }),
      "update",
    );
    const existing = await repository.getCalendarSchedulingRequest(
      request.auth.firmId,
      body.matterId,
      params.requestId,
    );
    if (!existing) {
      return reply.code(404).send({ error: "NotFound", message: "Scheduling request not found" });
    }
    let linkedEvent: CalendarEventRecord | undefined;
    const linkedEventId = body.status === "scheduled" ? body.calendarEventId : undefined;
    if (linkedEventId) {
      linkedEvent = await repository.getCalendarEvent(
        request.auth.firmId,
        body.matterId,
        linkedEventId,
      );
      if (!linkedEvent || linkedEvent.status === "cancelled") {
        throw new ApiHttpError(404, "CALENDAR_EVENT_NOT_FOUND", "Calendar event not found", {
          eventId: linkedEventId,
        });
      }
      if (existing.calendarReminderId) {
        const reminderOwner = await calendarReminderOwnerEvent({
          repository,
          firmId: request.auth.firmId,
          matterId: body.matterId,
          reminderId: existing.calendarReminderId,
        });
        if (!reminderOwner) {
          throw new ApiHttpError(
            404,
            "CALENDAR_REMINDER_NOT_FOUND",
            "Calendar reminder link not found",
            { reminderId: existing.calendarReminderId },
          );
        }
        if (reminderOwner.status === "cancelled") {
          throw new ApiHttpError(404, "CALENDAR_EVENT_NOT_FOUND", "Calendar event not found", {
            eventId: reminderOwner.id,
          });
        }
        if (linkedEvent.id !== reminderOwner.id) {
          throw new ApiHttpError(
            409,
            "CALENDAR_REMINDER_EVENT_MISMATCH",
            "Scheduling request reminder must be scheduled against its owning calendar event",
          );
        }
      }
    }
    const now = new Date().toISOString();
    const updated = await repository.updateCalendarSchedulingRequestReview({
      firmId: request.auth.firmId,
      matterId: body.matterId,
      requestId: existing.id,
      status: body.status,
      reviewedAt: now,
      reviewedByUserId: request.auth.user.id,
      calendarEventId: body.status === "scheduled" ? (linkedEvent?.id ?? null) : null,
    });
    if (!updated) {
      return reply.code(404).send({ error: "NotFound", message: "Scheduling request not found" });
    }
    await recordCalendarAuditEvent(repository, {
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "calendar.scheduling_request.reviewed",
      resourceType: "calendar_scheduling_request",
      resourceId: updated.id,
      occurredAt: now,
      metadata: schedulingRequestAuditMetadata(updated),
    });
    const events = await repository.listCalendarEvents(request.auth.firmId, {
      matterId: body.matterId,
    });
    return {
      schedulingRequest: await schedulingRequestSummaryForResponse({
        request: updated,
        events,
        includeTimeCapture: canReadTimeCapture(request.auth, body.matterId),
        now,
      }),
    };
  });

  server.patch(
    "/api/calendar/scheduling-requests/:requestId/aging-review",
    async (request, reply) => {
      const staffAccess = requireStaffAccess(request.auth);
      if (!staffAccess.ok) throw staffAccess.error;
      const params = parseRequestPart(
        calendarSchedulingRequestParamsSchema,
        request.params,
        "params",
      );
      const body = parseRequestPart(calendarSchedulingAgingReviewBodySchema, request.body, "body");
      await assertCalendarScopeAccess(
        repository,
        request.auth,
        calendarScopeTarget({ scope: "matter", matterId: body.matterId }),
        "update",
      );
      const existing = await repository.getCalendarSchedulingRequest(
        request.auth.firmId,
        body.matterId,
        params.requestId,
      );
      if (!existing) {
        return reply.code(404).send({ error: "NotFound", message: "Scheduling request not found" });
      }
      if (existing.status !== "needs_review") {
        throw new ApiHttpError(
          409,
          "CALENDAR_SCHEDULING_REQUEST_AGING_REVIEW_CLOSED",
          "Scheduling request is no longer open for review",
        );
      }
      const now = new Date().toISOString();
      const cue = buildReviewAgingCue({ referenceAt: existing.createdAt, now });
      if (cue.status === "fresh") {
        throw new ApiHttpError(
          409,
          "CALENDAR_SCHEDULING_REQUEST_AGING_REVIEW_NOT_AGING",
          "Scheduling request is not aging or stale yet",
        );
      }
      const updated = await repository.recordCalendarSchedulingRequestAgingReviewDecision({
        firmId: request.auth.firmId,
        matterId: body.matterId,
        requestId: existing.id,
        decision: body.decision,
        decidedAt: now,
        decidedByUserId: request.auth.user.id,
        cueStatus: cue.status,
        ageHours: cue.ageHours,
      });
      if (!updated) {
        return reply.code(404).send({ error: "NotFound", message: "Scheduling request not found" });
      }
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "calendar.scheduling_request.aging_review_recorded",
        resourceType: "calendar_scheduling_request",
        resourceId: updated.id,
        occurredAt: now,
        metadata: {
          matterId: updated.matterId,
          requestId: updated.id,
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
          taskCreated: false,
          eventCreated: false,
          eventRescheduled: false,
          reminderCancelled: false,
        },
      });
      const events = await repository.listCalendarEvents(request.auth.firmId, {
        matterId: body.matterId,
      });
      return {
        schedulingRequest: await schedulingRequestSummaryForResponse({
          request: updated,
          events,
          includeTimeCapture: canReadTimeCapture(request.auth, body.matterId),
          now,
        }),
      };
    },
  );

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
