import type { FastifyInstance } from "fastify";
import { requireAccess } from "../http/auth-guards.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerJobsRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/jobs", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;

    const jobs = await repository.listJobLifecycleRecords(request.auth.firmId);
    return {
      status: "default",
      queues: ["email", "inbound_email", "ai_triage", "ocr", "transcription", "media"],
      workers: [],
      jobs,
    };
  });
}
