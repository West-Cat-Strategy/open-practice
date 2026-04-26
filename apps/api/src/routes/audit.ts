import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import { canAccess, type AccessRequest, type User } from "@open-practice/domain";

function requireAccess(
  auth: { user: User; firmId: string },
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  if (!canAccess({ ...request, user: auth.user, firmId: auth.firmId })) {
    throw Object.assign(new Error("Matter access required"), { statusCode: 403 });
  }
}

export function registerAuditRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/audit", async (request) => {
    requireAccess(request.auth, { resource: "audit_log", action: "read" });
    return options.repository.listAuditEvents(request.auth.firmId);
  });
}
