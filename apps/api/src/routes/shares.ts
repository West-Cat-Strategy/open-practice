import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const sharesQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

function assertShareAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerShareRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/shares/status", async () => ({
    status: "default",
    provider: "portal_grants",
    createStatus: "disabled",
    reason: "repository_methods_absent",
  }));

  server.get("/api/shares", async (request) => {
    const query = parseRequestPart(sharesQuerySchema, request.query, "query");
    if (query.matterId) {
      assertShareAccess(request.auth, {
        resource: "document",
        action: "read",
        matterId: query.matterId,
      });
    } else {
      const access = requireAccess(request.auth, { resource: "document", action: "read" });
      if (!access.ok) throw access.error;
    }

    const grants = await repository.listPortalGrants(request.auth.firmId);
    return {
      shares: query.matterId ? grants.filter((grant) => grant.matterId === query.matterId) : grants,
    };
  });

  server.post("/api/shares", async (request) => {
    const access = requireAccess(request.auth, { resource: "firm", action: "update" });
    if (!access.ok) throw access.error;

    return {
      status: "disabled",
      reason: "repository_methods_absent",
      share: null,
    };
  });
}
