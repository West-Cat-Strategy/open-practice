import type { FastifyInstance } from "fastify";
import { requireAccess } from "../http/auth-guards.js";

export function registerAuthExtensionRoutes(server: FastifyInstance): void {
  server.get("/api/auth/extensions", async (request) => {
    const access = requireAccess(request.auth, { resource: "firm", action: "read" });
    if (!access.ok) throw access.error;

    return {
      localPassword: { status: "default" },
      passwordSetup: { status: "default" },
      oidc: { status: "disabled", reason: "not_configured" },
      saml: { status: "disabled", reason: "not_configured" },
      mfaPolicy: { status: "disabled", reason: "not_configured" },
    };
  });
}
