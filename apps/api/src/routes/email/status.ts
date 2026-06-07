import type { FastifyInstance } from "fastify";
import type { ApiRouteDependencies } from "../types.js";
import { assertEmailAccess } from "./shared.js";

export async function buildEmailStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
}) {
  const providers = await input.repository.listProviderSettings(input.firmId, { kind: "smtp" });
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
}

export function registerEmailStatusRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
): void {
  server.get("/api/email/status", async (request) => {
    assertEmailAccess(request.auth, { resource: "provider_setting", action: "read" });
    return buildEmailStatus({ repository, firmId: request.auth.firmId });
  });
}
