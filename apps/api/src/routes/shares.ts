import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { canAccess, type AccessRequest } from "@open-practice/domain";
import { requireMatterAccess } from "../http/auth-guards.js";
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
  const access = requireMatterAccess(context, request);
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
    } else if (request.auth.user.role !== "owner_admin" && request.auth.user.role !== "auditor") {
      throw Object.assign(new Error("Matter scope required"), { statusCode: 403 });
    }

    const grants = await repository.listPortalGrants(request.auth.firmId);
    return {
      shares: query.matterId ? grants.filter((grant) => grant.matterId === query.matterId) : grants,
    };
  });

  server.post("/api/shares", async (request) => {
    const canUpdateFirm = canAccess({
      user: request.auth.user,
      firmId: request.auth.firmId,
      resource: "firm",
      action: "update",
    });
    if (!canUpdateFirm) {
      throw Object.assign(new Error("Firm access required"), { statusCode: 403 });
    }

    return {
      status: "disabled",
      reason: "repository_methods_absent",
      share: null,
    };
  });
}
