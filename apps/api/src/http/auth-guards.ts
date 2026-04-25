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

export function requireMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): GuardResult<{ context: ApiAuthContext }> {
  if (canAccess({ ...request, user: context.user, firmId: context.firmId })) {
    return { ok: true, data: { context } };
  }

  return {
    ok: false,
    error: new ApiHttpError(403, "MATTER_ACCESS_REQUIRED", "Matter access required", {
      resource: request.resource,
      action: request.action,
      matterId: request.matterId,
    }),
  };
}

export function hasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}
