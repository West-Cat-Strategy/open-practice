import type { FastifyInstance } from "fastify";
import { requireAccess } from "../http/auth-guards.js";
import {
  openPracticeQueueNames,
  queueStatus,
  serializeJobRun,
  summarizeJobRuns,
} from "./job-status.js";
import type { ApiRouteDependencies } from "./types.js";

export function registerJobsRoutes(
  server: FastifyInstance,
  { repository, emailJobQueue, ocrJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/jobs", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;

    const jobs = await repository.listJobLifecycleRecords(request.auth.firmId);
    const workerQueues = openPracticeQueueNames.map((queueName) =>
      queueStatus(
        queueName,
        queueName === "email" ? emailJobQueue : queueName === "ocr" ? ocrJobQueue : undefined,
      ),
    );
    return {
      status: jobs.length > 0 ? "available" : "default",
      queues: openPracticeQueueNames,
      workers: workerQueues.filter((queue) => queue.status === "configured"),
      workerQueues,
      summary: summarizeJobRuns(jobs),
      jobs: jobs.map(serializeJobRun),
    };
  });
}
