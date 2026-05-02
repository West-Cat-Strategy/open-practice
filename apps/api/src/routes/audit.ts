import type { FastifyInstance } from "fastify";
import type { OpenPracticeRepository } from "@open-practice/database";
import { summarizeAuditEventTaxonomy } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";

export function registerAuditRoutes(
  server: FastifyInstance,
  options: { repository: OpenPracticeRepository },
): void {
  server.get("/api/audit", async (request) => {
    const access = requireAccess(request.auth, { resource: "audit_log", action: "read" });
    if (!access.ok) throw access.error;
    const audit = await options.repository.listAuditEvents(request.auth.firmId);
    return {
      ...audit,
      taxonomySummary: summarizeAuditEventTaxonomy(audit.events),
    };
  });
}
