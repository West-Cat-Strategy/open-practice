import type { FastifyInstance } from "fastify";
import { canAccess } from "@open-practice/domain";
import type { ApiAuthContext } from "../../server.js";
import { assertInboundEmailAccess } from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

function assertInboundEmailStatusAccess(context: ApiAuthContext): void {
  if (context.user.role === "owner_admin" || context.user.role === "auditor") return;
  const canReadAnyAssignedMatter = context.user.assignedMatterIds.some((matterId) =>
    canAccess({
      user: context.user,
      firmId: context.firmId,
      resource: "inbound_email",
      action: "read",
      matterId,
    }),
  );
  if (canReadAnyAssignedMatter) return;
  assertInboundEmailAccess(context, {
    resource: "inbound_email",
    action: "read",
  });
}

export async function buildInboundEmailStatus(input: {
  repository: InboundEmailRouteDependencies["repository"];
  firmId: string;
  auth?: ApiAuthContext;
}) {
  const [providers, addresses] = await Promise.all([
    input.repository.listProviderSettings(input.firmId, {
      kind: "inbound_email",
    }),
    input.repository.listInboundEmailAddresses(input.firmId),
  ]);
  const enabled = providers.find((provider) => provider.enabled);
  const auth = input.auth;
  const addressesForUser = auth
    ? addresses.filter((address) => {
        if (auth.user.role === "owner_admin" || auth.user.role === "auditor") {
          return true;
        }
        return Boolean(
          address.matterId &&
          canAccess({
            user: auth.user,
            firmId: auth.firmId,
            resource: "inbound_email",
            action: "read",
            matterId: address.matterId,
          }),
        );
      })
    : addresses;

  return {
    status: enabled ? "configured" : "disabled",
    reason: enabled ? undefined : "not_configured",
    provider:
      !input.auth || input.auth.user.role === "owner_admin" || input.auth.user.role === "auditor"
        ? enabled?.key
        : undefined,
    addresses: addressesForUser.map(({ id, address, matterId, enabled, createdAt }) => ({
      id,
      address,
      matterId,
      enabled,
      createdAt,
    })),
  };
}

export function registerInboundEmailStatusRoutes(
  server: FastifyInstance,
  { repository }: InboundEmailRouteDependencies,
): void {
  server.get("/api/inbound-email/status", async (request) => {
    assertInboundEmailStatusAccess(request.auth);
    return buildInboundEmailStatus({ repository, firmId: request.auth.firmId, auth: request.auth });
  });
}
