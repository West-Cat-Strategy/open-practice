import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const externalUploadBodySchema = z.object({
  matterId: z.string().min(1),
  filename: z.string().min(1),
});

function assertExternalUploadAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerExternalUploadRoutes(
  server: FastifyInstance,
  { s3 }: ApiRouteDependencies,
): void {
  server.get("/api/external-uploads/status", async () => ({
    status: s3 ? "disabled" : "not_configured",
    reason: s3 ? "portal_upload_flow_not_enabled" : "s3_not_configured",
    provider: s3 ? "s3" : undefined,
  }));

  server.post("/api/external-uploads/intents", async (request) => {
    const body = parseRequestPart(externalUploadBodySchema, request.body, "body");
    assertExternalUploadAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: body.matterId,
    });

    return {
      status: "disabled",
      reason: s3 ? "portal_upload_flow_not_enabled" : "s3_not_configured",
      intent: null,
    };
  });
}
