import type { FastifyInstance } from "fastify";
import { canAccess } from "@open-practice/domain";
import type { ApiRouteDependencies } from "./types.js";

export function registerJobsRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/jobs", async (request) => {
    const canReadJobs = canAccess({
      user: request.auth.user,
      firmId: request.auth.firmId,
      resource: "job",
      action: "read",
    });
    if (!canReadJobs) {
      throw Object.assign(new Error("Job access required"), { statusCode: 403 });
    }

    const jobs = await repository.listJobLifecycleRecords(request.auth.firmId);
    return {
      status: "default",
      queues: ["email", "inbound_email", "ai_triage", "ocr", "transcription", "media"],
      workers: [],
      jobs,
    };
  });
}
