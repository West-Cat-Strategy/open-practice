import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CalendarCredentialRecord } from "@open-practice/domain";
import { createSessionToken, hashPassword } from "../../http/auth-helpers.js";
import { requireFreshAuth } from "../../http/fresh-auth.js";
import { parseRequestPart } from "../../http/validation.js";
import { recordCalendarAuditEvent, trustedApiBaseUrl } from "./shared.js";
import type { CalendarRouteDependencies } from "./shared.js";

const calendarCredentialBodySchema = z.object({
  label: z.string().min(1).max(80).default("iOS Calendar"),
});

const calendarCredentialParamsSchema = z.object({
  id: z.string().min(1),
});

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

export function registerCalendarCredentialRoutes(
  server: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void {
  const { repository, publicApiBaseUrl } = dependencies;

  server.post("/api/calendar/credentials", async (request, reply) => {
    requireFreshAuth(request.auth);
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

    const calendarBaseUrl = trustedApiBaseUrl(request, publicApiBaseUrl);
    return reply.code(201).send({
      credential: credentialResponse(credential),
      username,
      password,
      caldavUrl: `${calendarBaseUrl}/caldav`,
      principalUrl: `${calendarBaseUrl}/caldav/principals/${encodeURIComponent(username)}/`,
      calendarHomeUrl: `${calendarBaseUrl}/caldav/calendars/${encodeURIComponent(username)}/`,
    });
  });

  server.get("/api/calendar/credentials", async (request) => ({
    credentials: (
      await repository.listCalendarCredentials(request.auth.firmId, request.auth.user.id)
    ).map(credentialResponse),
  }));

  server.post("/api/calendar/credentials/:id/revoke", async (request, reply) => {
    requireFreshAuth(request.auth);
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
}
