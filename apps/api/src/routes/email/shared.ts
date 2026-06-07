import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import type { ApiAuthContext } from "../../server.js";

export function assertEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function requireReceiptSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "EMAIL_RECEIPT_TOKEN_SIGNING_NOT_CONFIGURED",
    "Email receipt token signing is not configured",
  );
}
