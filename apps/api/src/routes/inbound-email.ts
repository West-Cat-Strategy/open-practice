import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const inboundEmailQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

function assertInboundEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerInboundEmailRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/inbound-email/status", async (request) => {
    const providers = await repository.listProviderSettings(request.auth.firmId, {
      kind: "inbound_email",
    });
    const enabled = providers.find((provider) => provider.enabled);
    return {
      status: enabled ? "configured" : "disabled",
      reason: enabled ? undefined : "not_configured",
      provider: enabled?.key,
      addresses: [],
    };
  });

  server.get("/api/inbound-email/messages", async (request) => {
    const query = parseRequestPart(inboundEmailQuerySchema, request.query, "query");
    if (query.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "portal_message",
        action: "read",
        matterId: query.matterId,
      });
    } else if (request.auth.user.role !== "owner_admin" && request.auth.user.role !== "auditor") {
      throw Object.assign(new Error("Matter scope required"), { statusCode: 403 });
    }

    return {
      status: "disabled",
      reason: "not_configured",
      messages: [],
    };
  });
}
