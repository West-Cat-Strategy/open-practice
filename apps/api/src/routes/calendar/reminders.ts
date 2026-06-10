import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CalendarEventRecord, CalendarEventReminderRecord } from "@open-practice/domain";
import { createSessionToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import type { DeliveryConfirmation } from "../delivery-confirmation.js";
import { queueRouteEmailOutbox } from "../outbound-email.js";
import {
  assertCalendarScopeAccess,
  calendarEventParamsSchema,
  calendarEventScope,
  calendarScopeSchema,
  calendarScopeTarget,
  calendarScopeTargetMatchesEvent,
  recordCalendarAuditEvent,
} from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

const calendarEventReminderParamsSchema = z.object({
  eventId: z.string().min(1),
  reminderId: z.string().min(1),
});

const calendarEventReminderBodySchema = z.object({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
  remindAt: z.string().datetime(),
  channel: z.literal("dashboard").default("dashboard"),
  status: z.enum(["pending", "acknowledged", "dismissed", "cancelled"]).default("pending"),
  note: z.string().max(240).optional(),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const calendarEventReminderPatchBodySchema = calendarEventReminderBodySchema.partial().extend({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
});

const calendarEventReminderDeleteQuerySchema = z.object({
  scope: calendarScopeSchema.optional(),
  matterId: z.string().min(1).optional(),
  clientContactId: z.string().min(1).optional(),
});

function calendarReminderText(
  event: CalendarEventRecord,
  reminder: CalendarEventReminderRecord,
): string {
  return [
    `Reminder for ${event.title}.`,
    `When: ${event.startsAt} to ${event.endsAt}.`,
    `Reminder due: ${reminder.remindAt}.`,
    reminder.note ? `Note: ${reminder.note}.` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function queueCalendarReminderNotification(input: {
  repository: CalendarRouteDependencies["repository"];
  emailJobQueue: CalendarRouteDependencies["emailJobQueue"];
  auth: Parameters<typeof assertCalendarScopeAccess>[1];
  event: CalendarEventRecord;
  reminder: CalendarEventReminderRecord;
}) {
  if (input.reminder.status !== "pending") {
    return { queuedEmail: undefined, reason: undefined };
  }

  const smtpProviders = await input.repository.listProviderSettings(input.auth.firmId, {
    kind: "smtp",
  });
  const enabledSmtp = smtpProviders.find((provider) => provider.enabled);
  if (!enabledSmtp) {
    return { queuedEmail: undefined, reason: "smtp_not_configured" };
  }
  if (!input.emailJobQueue) {
    return { queuedEmail: undefined, reason: "email_queue_not_configured" };
  }
  if (!input.event.matterId) {
    return { queuedEmail: undefined, reason: "matter_required" };
  }

  const delayMs = Math.max(0, Date.parse(input.reminder.remindAt) - Date.now());
  const queuedEmail = await queueRouteEmailOutbox(
    input.repository,
    input.emailJobQueue,
    input.auth,
    {
      matterId: input.event.matterId,
      templateKey: "calendar.reminder",
      to: [input.auth.user.email],
      subject: `Calendar reminder: ${input.event.title}`,
      textBody: calendarReminderText(input.event, input.reminder),
      relatedResourceType: "calendar_event",
      relatedResourceId: input.event.id,
      idempotencyKey: input.reminder.id,
      source: "calendar.reminder",
      delayMs,
      metadata: {
        eventId: input.event.id,
        reminderId: input.reminder.id,
        reminderStatus: input.reminder.status,
        remindAt: input.reminder.remindAt,
        deliveryDelayMs: delayMs,
      },
    },
  );

  return { queuedEmail, reason: undefined };
}

function isCalendarReminderNotificationRequested(input: {
  status: CalendarEventReminderRecord["status"];
  deliveryConfirmation?: DeliveryConfirmation;
}): input is { status: "pending"; deliveryConfirmation: DeliveryConfirmation } {
  return input.status === "pending" && input.deliveryConfirmation !== undefined;
}

function calendarReminderAuditMetadata(
  reminder: CalendarEventReminderRecord,
): Record<string, unknown> {
  return {
    scope: calendarEventScope(reminder),
    matterId: reminder.matterId,
    clientContactId: reminder.clientContactId,
    eventId: reminder.eventId,
    reminderId: reminder.id,
    channel: reminder.channel,
    status: reminder.status,
  };
}

export function registerCalendarReminderRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository, emailJobQueue } = dependencies;

  server.post("/api/calendar/events/:eventId/reminders", async (request, reply) => {
    const params = parseRequestPart(calendarEventParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventReminderBodySchema, request.body, "body");
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
    const notificationRequested = isCalendarReminderNotificationRequested({
      status: body.status,
      deliveryConfirmation: body.deliveryConfirmation,
    });
    if (notificationRequested) {
      if (!event.matterId) {
        throw new ApiHttpError(
          400,
          "CALENDAR_REMINDER_EMAIL_REQUIRES_MATTER",
          "Email calendar reminder delivery is available only for matter events",
        );
      }
      requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    }
    const now = new Date().toISOString();
    const reminder = await repository.upsertCalendarEventReminder({
      id: `calendar-reminder-${createSessionToken().slice(0, 16)}`,
      firmId: request.auth.firmId,
      scope: calendarEventScope(event),
      matterId: event.matterId,
      clientContactId: event.clientContactId,
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
    const queuedReminder = notificationRequested
      ? await queueCalendarReminderNotification({
          repository,
          emailJobQueue,
          auth: request.auth,
          event,
          reminder,
        })
      : { queuedEmail: undefined, reason: undefined };
    if (notificationRequested && queuedReminder.reason) {
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "calendar.reminder.skipped",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          ...calendarReminderAuditMetadata(reminder),
          notificationStatus: "skipped",
          notificationReason: queuedReminder.reason,
        },
      });
    }
    if (notificationRequested && queuedReminder.queuedEmail) {
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "calendar.reminder.queued",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          ...calendarReminderAuditMetadata(reminder),
          notificationStatus: "queued",
          emailId: queuedReminder.queuedEmail.email.id,
          jobId: queuedReminder.queuedEmail.job.id,
          deliveryDelayMs: Math.max(0, Date.parse(reminder.remindAt) - Date.now()),
        },
      });
    }
    return reply.code(201).send({ reminder });
  });

  server.patch("/api/calendar/events/:eventId/reminders/:reminderId", async (request, reply) => {
    const params = parseRequestPart(calendarEventReminderParamsSchema, request.params, "params");
    const body = parseRequestPart(calendarEventReminderPatchBodySchema, request.body, "body");
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
    const current = (
      await repository.listCalendarEventReminders(request.auth.firmId, event.matterId, event.id)
    ).find((reminder) => reminder.id === params.reminderId);
    if (!current) return reply.code(404).send({ error: "NotFound", message: "Reminder not found" });
    const nextStatus = body.status ?? current.status;
    const notificationRequested =
      current.status !== "pending" &&
      isCalendarReminderNotificationRequested({
        status: nextStatus,
        deliveryConfirmation: body.deliveryConfirmation,
      });
    if (notificationRequested) {
      if (!event.matterId) {
        throw new ApiHttpError(
          400,
          "CALENDAR_REMINDER_EMAIL_REQUIRES_MATTER",
          "Email calendar reminder delivery is available only for matter events",
        );
      }
      requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    }
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
    const queuedReminder = notificationRequested
      ? await queueCalendarReminderNotification({
          repository,
          emailJobQueue,
          auth: request.auth,
          event,
          reminder,
        })
      : { queuedEmail: undefined, reason: undefined };
    if (notificationRequested && queuedReminder.reason) {
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "calendar.reminder.skipped",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          ...calendarReminderAuditMetadata(reminder),
          notificationStatus: "skipped",
          notificationReason: queuedReminder.reason,
        },
      });
    }
    if (notificationRequested && queuedReminder.queuedEmail) {
      await recordCalendarAuditEvent(repository, {
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "calendar.reminder.queued",
        resourceType: "calendar_event",
        resourceId: event.id,
        occurredAt: now,
        metadata: {
          ...calendarReminderAuditMetadata(reminder),
          notificationStatus: "queued",
          emailId: queuedReminder.queuedEmail.email.id,
          jobId: queuedReminder.queuedEmail.job.id,
          deliveryDelayMs: Math.max(0, Date.parse(reminder.remindAt) - Date.now()),
        },
      });
    }
    return { reminder };
  });

  server.delete("/api/calendar/events/:eventId/reminders/:reminderId", async (request, reply) => {
    const params = parseRequestPart(calendarEventReminderParamsSchema, request.params, "params");
    const query = parseRequestPart(calendarEventReminderDeleteQuerySchema, request.query, "query");
    const target = calendarScopeTarget(query);
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
    const reminder = await repository.deleteCalendarEventReminder({
      firmId: request.auth.firmId,
      scope: calendarEventScope(event),
      matterId: event.matterId,
      clientContactId: event.clientContactId,
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
}
