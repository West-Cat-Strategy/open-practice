import type { FastifyInstance } from "fastify";
import { canReadJobLifecycleRecord } from "@open-practice/domain";
import { z } from "zod";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import {
  openPracticeQueueNames,
  queueStatus,
  serializeJobRun,
  summarizeJobRuns,
} from "./job-status.js";
import type { ApiRouteDependencies } from "./types.js";

const jobParamsSchema = z.object({ jobId: z.string().min(1) });
const jobQuerySchema = z.object({
  queueName: z.enum(openPracticeQueueNames).optional(),
});

export function registerJobsRoutes(
  server: FastifyInstance,
  { repository, emailJobQueue, ocrJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/jobs", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;
    const query = parseRequestPart(jobQuerySchema, request.query, "query");

    const jobs = await repository.listJobLifecycleRecords(request.auth.firmId, {
      queueName: query.queueName,
    });
    const visibleJobs = jobs.filter((record) =>
      canReadJobLifecycleRecord({
        user: request.auth.user,
        firmId: request.auth.firmId,
        record,
      }),
    );
    const workerQueues = openPracticeQueueNames.map((queueName) =>
      queueStatus(
        queueName,
        queueName === "email" ? emailJobQueue : queueName === "ocr" ? ocrJobQueue : undefined,
      ),
    );
    return {
      status: visibleJobs.length > 0 ? "available" : "default",
      queues: openPracticeQueueNames,
      workers: workerQueues.filter((queue) => queue.status === "configured"),
      workerQueues,
      reservedQueues: workerQueues.filter((queue) => queue.status === "reserved"),
      summary: summarizeJobRuns(visibleJobs),
      jobs: visibleJobs.map(serializeJobRun),
    };
  });

  server.get("/api/jobs/:jobId", async (request) => {
    const access = requireAccess(request.auth, { resource: "job", action: "read" });
    if (!access.ok) throw access.error;
    const params = parseRequestPart(jobParamsSchema, request.params, "params");

    const job = (await repository.listJobLifecycleRecords(request.auth.firmId)).find(
      (record) => record.id === params.jobId,
    );
    if (
      !job ||
      !canReadJobLifecycleRecord({
        user: request.auth.user,
        firmId: request.auth.firmId,
        record: job,
      })
    ) {
      throw Object.assign(new Error("Job was not found"), { statusCode: 404 });
    }

    return { job: serializeJobRun(job) };
  });
}
