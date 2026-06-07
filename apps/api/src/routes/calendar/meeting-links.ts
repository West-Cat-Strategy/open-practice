import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CalendarEventRecord, CalendarMeetingLinkMode } from "@open-practice/domain";
import { createSessionToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import {
  assertCalendarAccess,
  calendarEventParamsSchema,
  calendarEventResponse,
  calendarMeetingInvitationBoundaryForRequest,
  recordCalendarAuditEvent,
} from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

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

export function registerCalendarMeetingLinkRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository } = dependencies;

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
}
