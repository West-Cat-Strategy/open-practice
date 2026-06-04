import type { ApiAuthContext } from "../server.js";
import { ApiHttpError } from "./response.js";

export const FRESH_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

export function requireFreshAuth(
  auth: ApiAuthContext,
  now = new Date(),
): { freshAuthenticatedAt: string } {
  const freshAuthenticatedAt = auth.session?.freshAuthenticatedAt;
  if (!freshAuthenticatedAt) {
    throw new ApiHttpError(
      403,
      "FRESH_AUTH_REQUIRED",
      "Fresh session authentication is required for this credential operation",
    );
  }
  const freshAuthenticatedTime = Date.parse(freshAuthenticatedAt);
  if (
    Number.isNaN(freshAuthenticatedTime) ||
    now.getTime() - freshAuthenticatedTime > FRESH_AUTH_MAX_AGE_MS
  ) {
    throw new ApiHttpError(
      403,
      "FRESH_AUTH_REQUIRED",
      "Fresh session authentication is required for this credential operation",
    );
  }
  return { freshAuthenticatedAt };
}
