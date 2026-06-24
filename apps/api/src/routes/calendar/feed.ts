import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildICalendarFeed } from "@open-practice/domain";
import type { CalendarEventRecord } from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import { assertCalendarAccess, trustedApiBaseUrl } from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

const calendarFeedParamsSchema = z.object({
  matterId: z.string().min(1),
});

export function webcalSubscriptionUrl(
  request: FastifyRequest,
  matterId: string,
  publicApiBaseUrl?: string,
): string {
  const host = new URL(trustedApiBaseUrl(request, publicApiBaseUrl)).host;
  return `webcal://${host}/api/calendar/matters/${encodeURIComponent(matterId)}.ics`;
}

function calendarEventWithoutMeetingDisclosure(event: CalendarEventRecord): CalendarEventRecord {
  const safeEvent: CalendarEventRecord = { ...event };
  delete safeEvent.meetingLinkMode;
  delete safeEvent.meetingLinkUrl;
  delete safeEvent.meetingRoomId;
  delete safeEvent.meetingProviderKey;
  return safeEvent;
}

export function registerCalendarFeedRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository } = dependencies;

  server.get("/api/calendar/matters/:matterId.ics", async (request, reply) => {
    const params = parseRequestPart(calendarFeedParamsSchema, request.params, "params");
    assertCalendarAccess(request.auth, params.matterId, "read");

    const events = await repository.listCalendarEvents(request.auth.firmId, {
      matterId: params.matterId,
    });
    return reply.type("text/calendar; charset=utf-8").send(
      buildICalendarFeed({
        events: events.map(calendarEventWithoutMeetingDisclosure),
        calendarName: `Open Practice ${params.matterId}`,
        generatedAt: new Date().toISOString(),
      }),
    );
  });
}
