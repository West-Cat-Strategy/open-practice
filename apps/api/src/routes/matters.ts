import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";

const conflictBodySchema = z.object({
  prospectiveName: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  identifiers: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
  prospectiveRole: z.enum(["client", "opposing_party", "third_party"]).optional(),
  includeClosedMatters: z.boolean().default(true),
});

export function registerMatterRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/overview", async (request) =>
    options.repository.getOverview(request.auth.firmId),
  );

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
