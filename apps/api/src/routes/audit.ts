import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";

export function registerAuditRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/audit", async (request) => {
    const access = requireAccess(request.auth, { resource: "audit_log", action: "read" });
    if (!access.ok) throw access.error;
    return options.repository.listAuditEvents(request.auth.firmId);
  });
}
