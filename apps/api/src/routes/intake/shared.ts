import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";
import type { ApiRouteDependencies } from "../types.js";

export const idParamsSchema = z.object({ id: z.string().min(1) });

export function assertIntakeAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function requireAutomationProvider(provider: ApiRouteDependencies["automationProvider"]) {
  if (provider) return provider;
  throw Object.assign(new Error("Document automation provider is not configured"), {
    statusCode: 503,
  });
}
