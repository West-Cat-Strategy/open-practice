import { z } from "zod";
import type { FastifyRequest } from "fastify";
import { buildCalendarMeetingInvitationBoundary } from "@open-practice/domain";
import type {
  CalendarEventRecord,
  CalendarEventScope,
  CalendarMeetingInvitationBoundary,
  NewAuditEvent,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { createSessionToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export type CalendarRouteDependencies = ApiRouteDependencies & {
  jwtSecret?: string;
  publicWebBaseUrl?: string;
  publicApiBaseUrl?: string;
};

export const calendarEventParamsSchema = z.object({
  eventId: z.string().min(1),
});

export const calendarScopeSchema = z.enum(["matter", "firm", "client"]);

export interface CalendarScopeTarget {
  scope: CalendarEventScope;
  matterId?: string;
  clientContactId?: string;
}

export function baseUrl(request: FastifyRequest): string {
  return requestBaseUrl(request);
}

function normalizedBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function requestBaseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : request.protocol;
  const host = request.headers.host ?? request.hostname;
  return `${proto}://${host}`;
}

export function trustedApiBaseUrl(
  request: FastifyRequest,
  publicApiBaseUrl: string | undefined,
): string {
  return normalizedBaseUrl(publicApiBaseUrl) ?? requestBaseUrl(request);
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

export function calendarEventScope(event: Pick<CalendarEventRecord, "scope">): CalendarEventScope {
  return event.scope ?? "matter";
}

export function calendarScopeTarget(input: {
  scope?: CalendarEventScope;
  matterId?: string;
  clientContactId?: string;
}): CalendarScopeTarget {
  const scope =
    input.scope ?? (input.matterId ? "matter" : input.clientContactId ? "client" : "firm");
  if (scope === "matter" && (!input.matterId || input.clientContactId)) {
    throw new ApiHttpError(
      400,
      "CALENDAR_SCOPE_INVALID",
      "Matter calendar events require matterId only",
    );
  }
  if (scope === "client" && (!input.clientContactId || input.matterId)) {
    throw new ApiHttpError(
      400,
      "CALENDAR_SCOPE_INVALID",
      "Client calendar events require clientContactId only",
    );
  }
  if (scope === "firm" && (input.matterId || input.clientContactId)) {
    throw new ApiHttpError(
      400,
      "CALENDAR_SCOPE_INVALID",
      "Firm calendar events cannot include matterId or clientContactId",
    );
  }
  return {
    scope,
    ...(scope === "matter" ? { matterId: input.matterId } : {}),
    ...(scope === "client" ? { clientContactId: input.clientContactId } : {}),
  };
}

export function calendarScopeTargetMatchesEvent(
  target: CalendarScopeTarget,
  event: Pick<CalendarEventRecord, "scope" | "matterId" | "clientContactId">,
): boolean {
  return (
    target.scope === calendarEventScope(event) &&
    target.matterId === event.matterId &&
    target.clientContactId === event.clientContactId
  );
}

export async function visibleCalendarClientContactIds(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
): Promise<string[]> {
  const contactAccess = requireAccess(context, { resource: "contact", action: "read" });
  if (!contactAccess.ok) throw contactAccess.error;
  const dossiers = await repository.listContactDossiersForUser(context.user);
  return dossiers.map((dossier) => dossier.contact.id);
}

export async function assertCalendarScopeAccess(
  repository: ApiRouteDependencies["repository"],
  context: ApiAuthContext,
  target: CalendarScopeTarget,
  action: "create" | "read" | "update" | "delete",
): Promise<void> {
  if (target.scope === "matter") {
    assertCalendarAccess(context, target.matterId!, action);
    return;
  }

  if (target.scope === "firm" && action !== "read" && context.user.role !== "owner_admin") {
    throw new ApiHttpError(
      403,
      "FIRM_CALENDAR_ACTION_REQUIRES_ADMIN",
      "Firm calendar writes require owner/admin access",
    );
  }

  const access = requireAccess(context, {
    resource: "calendar_event",
    action,
    ...(target.scope === "client" ? { contactId: target.clientContactId } : {}),
  });
  if (!access.ok) throw access.error;

  if (target.scope === "client") {
    const visibleContactIds = await visibleCalendarClientContactIds(repository, context);
    if (!visibleContactIds.includes(target.clientContactId!)) {
      throw new ApiHttpError(
        403,
        "CALENDAR_CLIENT_CONTACT_NOT_VISIBLE",
        "Calendar client contact is not visible",
      );
    }
    return;
  }
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
