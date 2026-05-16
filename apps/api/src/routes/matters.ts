import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  MatterSummary,
  OpenPracticeRepository,
  PracticeOverview,
} from "@open-practice/database";
import type { User } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";

const conflictBodySchema = z.object({
  prospectiveName: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
  prospectiveRole: z.enum(["client", "opposing_party", "third_party"]).optional(),
  includeClosedMatters: z.boolean().default(true),
});

function scopedOverview(input: {
  overview: PracticeOverview;
  matters: MatterSummary[];
  user: User;
}): PracticeOverview {
  return {
    firm: input.overview.firm,
    metrics: {
      openMatters: input.matters.filter((matter) => matter.status === "open").length,
      intakeMatters: input.matters.filter((matter) => matter.status === "intake").length,
      portalGrants: 0,
      trustBalanceCents: input.matters.reduce((sum, matter) => sum + matter.trustBalanceCents, 0),
      unbilledMinutes: input.matters
        .flatMap((matter) => matter.timeEntries)
        .filter(
          (entry) =>
            entry.billable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
        )
        .reduce((sum, entry) => sum + entry.minutes, 0),
    },
    users: [input.user],
  };
}

export function registerMatterRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/overview", async (request) => {
    const firmWideAccess = requireAccess(request.auth, { resource: "firm", action: "read" });
    const overview = await options.repository.getOverview(request.auth.firmId);
    if (firmWideAccess.ok) return overview;

    const matters = await options.repository.listMattersForUser(request.auth.user);
    return scopedOverview({ overview, matters, user: request.auth.user });
  });

  server.get("/api/matters", async (request) =>
    options.repository.listMattersForUser(request.auth.user),
  );

  server.post("/api/conflicts/check", async (request) => {
    const access = requireAccess(request.auth, { resource: "contact", action: "read" });
    if (!access.ok) throw access.error;
    const body = conflictBodySchema.parse(request.body);
    return options.repository.runConflictCheck({
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      ...body,
    });
  });
}
