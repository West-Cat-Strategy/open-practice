import { canAccess, type AccessRequest } from "@open-practice/domain";
import type { User } from "@open-practice/domain";
import type { ApiAuthContext } from "../server.js";
import { ApiHttpError } from "./response.js";

export type GuardResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: ApiHttpError;
    };

export function requireAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): GuardResult<{ context: ApiAuthContext }> {
  if (canAccess({ ...request, user: context.user, firmId: context.firmId })) {
    return { ok: true, data: { context } };
  }

  const resourceLabel = request.resource.replace(/_/g, " ");
  const capitalizedLabel = resourceLabel.charAt(0).toUpperCase() + resourceLabel.slice(1);

  return {
    ok: false,
    error: new ApiHttpError(
      403,
      `${request.resource.toUpperCase()}_ACCESS_REQUIRED`,
      `${capitalizedLabel} access required`,
      {
        resource: request.resource,
        action: request.action,
        matterId: request.matterId,
      },
    ),
  };
}

export function hasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}

export function requireStaffAccess(
  context: ApiAuthContext,
): GuardResult<{ context: ApiAuthContext }> {
  if (context.user.role !== "client_external") return { ok: true, data: { context } };

  return {
    ok: false,
    error: new ApiHttpError(403, "STAFF_ACCESS_REQUIRED", "Staff access required", {
      resource: "staff_dashboard",
      action: "read",
    }),
  };
}
