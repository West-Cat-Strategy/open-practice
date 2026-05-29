import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildIntakePipelineSnapshot, type IntakeSessionRecord } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100),
});

function assertPipelineReadAccess(context: ApiAuthContext): void {
  const publicAccess = requireAccess(context, {
    resource: "public_consultation_intake",
    action: "read",
  });
  if (!publicAccess.ok) throw publicAccess.error;
}

async function listVisibleIntakeSessions(
  context: ApiAuthContext,
  repository: ApiRouteDependencies["repository"],
): Promise<IntakeSessionRecord[]> {
  if (context.user.role === "owner_admin" || context.user.role === "auditor") {
    const access = requireAccess(context, { resource: "intake_session", action: "read" });
    if (!access.ok) throw access.error;
    return repository.listIntakeSessions(context.firmId);
  }

  const sessions = await Promise.all(
    context.user.assignedMatterIds.map((matterId) => {
      const access = requireAccess(context, {
        resource: "intake_session",
        action: "read",
        matterId,
      });
      if (!access.ok) throw access.error;
      return repository.listIntakeSessions(context.firmId, { matterId });
    }),
  );
  return sessions.flat();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function registerIntakePipelineRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/intake-pipeline", async (request) => {
    assertPipelineReadAccess(request.auth);
    const query = listQuerySchema.parse(request.query);
    const publicConsultationIntakes = await repository.listPublicConsultationIntakes(
      request.auth.firmId,
      { limit: query.limit },
    );
    const intakeSessions = (await listVisibleIntakeSessions(request.auth, repository)).slice(
      0,
      query.limit,
    );
    const intakeSessionIds = new Set(intakeSessions.map((session) => session.id));
    const matterIds = unique(intakeSessions.map((session) => session.matterId));
    const [intakeFormLinks, intakeFormReviews, calendarEvents] = await Promise.all([
      Promise.all(
        matterIds.map((matterId) =>
          repository.listIntakeFormLinks(request.auth.firmId, { matterId }),
        ),
      ).then((groups) =>
        groups.flat().filter((link) => intakeSessionIds.has(link.intakeSessionId)),
      ),
      Promise.all(
        matterIds.map((matterId) =>
          repository.listIntakeFormReviews(request.auth.firmId, { matterId }),
        ),
      ).then((groups) =>
        groups.flat().filter((review) => intakeSessionIds.has(review.intakeSessionId)),
      ),
      Promise.all(
        matterIds.map((matterId) => {
          const access = requireAccess(request.auth, {
            resource: "calendar_event",
            action: "read",
            matterId,
          });
          if (!access.ok) return [];
          return repository.listCalendarEvents(request.auth.firmId, { matterId });
        }),
      ).then((groups) => groups.flat()),
    ]);

    return buildIntakePipelineSnapshot({
      publicConsultationIntakes,
      intakeSessions,
      intakeFormLinks,
      intakeFormReviews,
      calendarEvents,
    });
  });
}
