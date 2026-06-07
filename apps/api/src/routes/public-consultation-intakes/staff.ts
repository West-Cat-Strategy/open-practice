import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { createSessionToken, hashToken } from "../../http/auth-helpers.js";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  loadNotificationSettings,
  prefixedId,
  publicSettingsResponse,
  SETTINGS_KEY,
  SETTINGS_KIND,
  settingsBodySchema,
  upsertPublicConsultationIntakeNotificationSettings,
} from "./shared.js";

const dismissBodySchema = z.object({
  reason: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(1000).optional(),
    )
    .optional(),
});

const convertBodySchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  practiceArea: z.string().trim().min(1).max(120).default("consultation"),
  jurisdiction: z.enum(["BC", "ON", "CANADA", "OTHER"]).default("BC"),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

const listQuerySchema = z.object({
  status: z.enum(["pending", "converted", "dismissed"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export function registerStaffPublicConsultationIntakeRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    jwtSecret?: string;
  },
): void {
  server.get("/api/public-consultation-intakes/settings", async (request) => {
    const access = requireAccess(request.auth, { resource: "provider_setting", action: "read" });
    if (!access.ok) throw access.error;
    return publicSettingsResponse(
      await loadNotificationSettings(options.repository, request.auth.firmId),
    );
  });

  server.put("/api/public-consultation-intakes/settings", async (request) => {
    const access = requireAccess(request.auth, { resource: "provider_setting", action: "update" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(settingsBodySchema, request.body, "body");
    const existing = await loadNotificationSettings(options.repository, request.auth.firmId);
    let submissionToken: string | undefined;
    let submissionTokenHash = existing.submissionTokenHash;
    let submissionTokenRotatedAt = existing.submissionTokenRotatedAt;
    if (body.rotateSubmissionToken) {
      if (!options.jwtSecret) {
        throw new ApiHttpError(
          503,
          "PUBLIC_CONSULTATION_SUBMISSION_TOKEN_UNAVAILABLE",
          "Public consultation intake token generation is not configured",
        );
      }
      submissionToken = createSessionToken();
      submissionTokenHash = hashToken(submissionToken, options.jwtSecret);
      submissionTokenRotatedAt = new Date().toISOString();
    }
    const saved = await upsertPublicConsultationIntakeNotificationSettings(
      options.repository,
      request.auth.firmId,
      {
        ...body,
        submissionTokenHash,
        submissionTokenRotatedAt,
      },
    );
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "public_consultation_intake.settings_updated",
      resourceType: "provider_setting",
      resourceId: SETTINGS_KEY,
      metadata: {
        kind: SETTINGS_KIND,
        enabled: saved.enabled,
        recipientCount: saved.recipientEmails.length,
        allowedOriginCount: saved.allowedOrigins.length,
        reviewOwnerUserId: saved.reviewOwnerUserId,
        submissionTokenConfigured: Boolean(saved.submissionTokenHash),
        submissionTokenRotated: body.rotateSubmissionToken,
      },
    });
    return publicSettingsResponse(saved, submissionToken);
  });

  server.get("/api/public-consultation-intakes", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "public_consultation_intake",
      action: "read",
    });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(listQuerySchema, request.query, "query");
    return {
      intakes: await options.repository.listPublicConsultationIntakes(request.auth.firmId, query),
    };
  });

  server.post("/api/public-consultation-intakes/:id/dismiss", async (request) => {
    const access = requireAccess(request.auth, {
      resource: "public_consultation_intake",
      action: "update",
    });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(dismissBodySchema, request.body, "body");
    const existing = await options.repository.getPublicConsultationIntake(
      request.auth.firmId,
      params.id,
    );
    if (!existing) {
      throw new ApiHttpError(404, "PUBLIC_CONSULTATION_INTAKE_NOT_FOUND", "Intake not found");
    }
    if (existing.status !== "pending") {
      throw new ApiHttpError(
        409,
        "PUBLIC_CONSULTATION_INTAKE_NOT_PENDING",
        "Only pending consultation intakes can be dismissed",
      );
    }
    const reviewedAt = new Date().toISOString();
    const intake = await options.repository.updatePublicConsultationIntake(
      request.auth.firmId,
      params.id,
      {
        status: "dismissed",
        reviewedByUserId: request.auth.user.id,
        reviewedAt,
        dismissedReason: body.reason,
        metadata: {
          ...existing.metadata,
          dismissed: true,
          dismissedReasonPresent: Boolean(body.reason),
        },
      },
    );
    await appendRouteAuditEvent(options.repository, request.auth, {
      action: "public_consultation_intake.dismissed",
      resourceType: "public_consultation_intake",
      resourceId: params.id,
      occurredAt: reviewedAt,
      metadata: {
        dismissedReasonPresent: Boolean(body.reason),
      },
    });
    return { intake };
  });

  server.post("/api/public-consultation-intakes/:id/convert", async (request, reply) => {
    const intakeAccess = requireAccess(request.auth, {
      resource: "public_consultation_intake",
      action: "approve",
    });
    if (!intakeAccess.ok) throw intakeAccess.error;
    const matterAccess = requireAccess(request.auth, { resource: "matter", action: "create" });
    if (!matterAccess.ok) throw matterAccess.error;
    const contactAccess = requireAccess(request.auth, { resource: "contact", action: "create" });
    if (!contactAccess.ok) throw contactAccess.error;

    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(convertBodySchema, request.body ?? {}, "body");
    const existing = await options.repository.getPublicConsultationIntake(
      request.auth.firmId,
      params.id,
    );
    if (!existing) {
      throw new ApiHttpError(404, "PUBLIC_CONSULTATION_INTAKE_NOT_FOUND", "Intake not found");
    }
    if (existing.status !== "pending") {
      throw new ApiHttpError(
        409,
        "PUBLIC_CONSULTATION_INTAKE_NOT_PENDING",
        "Only pending consultation intakes can be converted",
      );
    }

    const occurredAt = new Date();
    const result = await options.repository.convertPublicConsultationIntakeToMatter({
      firmId: request.auth.firmId,
      intakeId: params.id,
      actorUserId: request.auth.user.id,
      matterId: prefixedId("matter"),
      clientContactId: prefixedId("contact"),
      clientPartyId: prefixedId("party"),
      opposingParties: existing.opposingPartyNames.map((displayName) => ({
        contactId: prefixedId("contact"),
        partyId: prefixedId("party"),
        displayName,
      })),
      title: body.title ?? `Consultation request - ${existing.clientName}`,
      practiceArea: body.practiceArea,
      jurisdiction: body.jurisdiction,
      openedOn: occurredAt.toISOString().slice(0, 10),
      occurredAt: occurredAt.toISOString(),
      auditEventId: prefixedId("audit"),
    });

    reply.code(201);
    return result;
  });
}
