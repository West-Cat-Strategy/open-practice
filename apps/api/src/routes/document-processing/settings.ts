import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  documentDispositionReviewCadences,
  type DocumentDispositionReviewScheduleProfile,
} from "@open-practice/domain";
import { requireAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";

const dayOffsetSchema = z.number().int().positive().max(36500);

const dispositionReviewScheduleProfileBodySchema = z.object({
  profile: z
    .object({
      label: z.string().trim().min(1).max(120),
      reviewCadence: z.enum(documentDispositionReviewCadences),
      reviewAfterDays: dayOffsetSchema.optional(),
      minimumRetainDays: dayOffsetSchema.optional(),
    })
    .nullable(),
});

function profileResponse(profile: DocumentDispositionReviewScheduleProfile | undefined) {
  return { profile: profile ?? null };
}

export function registerDocumentProcessingSettingsRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/document-processing/disposition-review-schedule-profile", async (request) => {
    const staffAccess = requireStaffAccess(request.auth);
    if (!staffAccess.ok) throw staffAccess.error;

    const settings = await repository.getFirmSettings(request.auth.firmId);
    if (!settings) {
      throw new ApiHttpError(404, "FIRM_SETTINGS_NOT_FOUND", "Firm settings were not found.");
    }
    return profileResponse(settings.dispositionReviewScheduleProfile);
  });

  server.put("/api/document-processing/disposition-review-schedule-profile", async (request) => {
    const access = requireAccess(request.auth, { resource: "firm", action: "update" });
    if (!access.ok) throw access.error;
    const body = parseRequestPart(
      dispositionReviewScheduleProfileBodySchema,
      request.body ?? {},
      "body",
    );
    const profile = body.profile ? { profileKey: "default" as const, ...body.profile } : undefined;
    const settings = await repository.updateDispositionReviewScheduleProfile({
      firmId: request.auth.firmId,
      profile,
    });

    await appendRouteAuditEvent(repository, request.auth, {
      action: "firm.disposition_review_schedule_profile.updated",
      resourceType: "firm",
      resourceId: request.auth.firmId,
      metadata: {
        profileConfigured: Boolean(settings.dispositionReviewScheduleProfile),
        reviewCadence: settings.dispositionReviewScheduleProfile?.reviewCadence,
        reviewAfterDaysPresent: Boolean(settings.dispositionReviewScheduleProfile?.reviewAfterDays),
        minimumRetainDaysPresent: Boolean(
          settings.dispositionReviewScheduleProfile?.minimumRetainDays,
        ),
        destructiveAction: false,
        retentionDeadlineEnforced: false,
        legalHoldOverride: false,
        retainedExportBody: false,
        rawPayloadRetention: false,
        complianceClaim: false,
      },
    });

    return profileResponse(settings.dispositionReviewScheduleProfile);
  });
}
