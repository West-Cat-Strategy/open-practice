import { z } from "zod";
import { requireAccess } from "../../http/auth-guards.js";
import type { ApiAuthContext } from "../../server.js";

export const draftIdParamsSchema = z.object({ id: z.string().min(1) });

export function assertDraftRouteAccess(
  context: ApiAuthContext,
  resource: "draft" | "draft_template",
  action: "create" | "read" | "update" | "delete",
  matterId?: string,
): void {
  const access = requireAccess(context, { resource, action, matterId });
  if (!access.ok) throw access.error;
}
