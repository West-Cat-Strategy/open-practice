import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { calendarMeetingInvitationBoundaryMetadata } from "@open-practice/domain";
import type {
  CalendarEventAttendeeRecord,
  CalendarEventRecord,
  CalendarMeetingInvitationBoundary,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import {
  assertCalendarAccess,
  calendarEventParamsSchema,
  calendarMeetingInvitationBoundaryForRequest,
  recordCalendarAuditEvent,
} from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

const calendarInvitationBodySchema = z.object({
  matterId: z.string().min(1),
  attendeeIds: z.array(z.string().min(1)).optional(),
  includeMeetingLink: z.boolean().default(false),
  issueGuestAccessToken: z.boolean().default(false),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

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

function assertMeetingInvitationBoundaryAllowed(input: {
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

export function registerCalendarInvitationRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository, emailJobQueue } = dependencies;

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
    assertMeetingInvitationBoundaryAllowed({
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
}
