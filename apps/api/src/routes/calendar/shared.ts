import { z } from "zod";
import type { FastifyRequest } from "fastify";
import { buildCalendarMeetingInvitationBoundary } from "@open-practice/domain";
import type {
  CalendarEventRecord,
  CalendarMeetingInvitationBoundary,
  NewAuditEvent,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { createSessionToken } from "../../http/auth-helpers.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export type CalendarRouteDependencies = ApiRouteDependencies & {
  jwtSecret?: string;
  publicWebBaseUrl?: string;
};

export const calendarEventParamsSchema = z.object({
  eventId: z.string().min(1),
});

export function baseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : request.protocol;
  const host = request.headers.host ?? request.hostname;
  return `${proto}://${host}`;
}

export async function recordCalendarAuditEvent(
  repository: ApiRouteDependencies["repository"],
  event: Omit<NewAuditEvent, "id">,
): Promise<void> {
  await repository.appendAuditEvent({
    ...event,
    id: `audit-${createSessionToken().slice(0, 16)}`,
  });
}

export function assertCalendarAccess(
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

export async function calendarMeetingInvitationBoundaryForRequest(
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

export function calendarEventResponse(
  event: CalendarEventRecord,
  meetingInvitationBoundary: CalendarMeetingInvitationBoundary,
): CalendarEventRecord {
  return {
    ...event,
    meetingInvitationBoundary,
  };
}
