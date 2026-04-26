import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireMatterAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const emailPreviewBodySchema = z.object({
  matterId: z.string().min(1),
  template: z.string().min(1),
  to: z.array(z.string().email()).default([]),
});

function assertEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireMatterAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerEmailRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/email/status", async (request) => {
    const providers = await repository.listProviderSettings(request.auth.firmId, { kind: "smtp" });
    const enabled = providers.find((provider) => provider.enabled);
    return {
      status: enabled ? "configured" : "disabled",
      reason: enabled ? undefined : "not_configured",
      provider: enabled?.key,
      providers: providers.map((provider) => ({
        key: provider.key,
        enabled: provider.enabled,
        updatedAt: provider.updatedAt,
      })),
    };
  });

  server.post("/api/email/previews", async (request) => {
    const body = parseRequestPart(emailPreviewBodySchema, request.body, "body");
    assertEmailAccess(request.auth, {
      resource: "portal_message",
      action: "create",
      matterId: body.matterId,
    });

    return {
      status: "disabled",
      reason: "not_configured",
      preview: null,
    };
  });
}
