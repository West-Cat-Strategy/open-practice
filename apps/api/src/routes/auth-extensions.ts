import type { FastifyInstance } from "fastify";
import { canAccess } from "@open-practice/domain";

export function registerAuthExtensionRoutes(server: FastifyInstance): void {
  server.get("/api/auth/extensions", async (request) => {
    const canReadFirm = canAccess({
      user: request.auth.user,
      firmId: request.auth.firmId,
      resource: "firm",
      action: "read",
    });
    if (!canReadFirm) {
      throw Object.assign(new Error("Firm access required"), { statusCode: 403 });
    }

    return {
      localPassword: { status: "default" },
      passwordSetup: { status: "default" },
      oidc: { status: "disabled", reason: "not_configured" },
      saml: { status: "disabled", reason: "not_configured" },
      mfaPolicy: { status: "disabled", reason: "not_configured" },
    };
  });
}
