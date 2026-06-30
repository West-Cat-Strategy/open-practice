import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildLegalResearchArtifactAuditMetadata,
  buildLegalResearchProviderJobMetadata,
  buildLegalResearchWorkspace,
  legalResearchArtifactKinds,
  legalResearchArtifactStatuses,
  legalResearchProviderJobName,
  legalResearchProviderJobRequestTypes,
  legalResearchSourceTypes,
  reviewLegalResearchArtifactRecord,
  serializeLegalResearchProviderJob,
  type JobLifecycleRecord,
  type LegalResearchArtifactRecord,
  type LegalResearchProviderJobRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import { serializeJobRun } from "./job-status.js";
import { enqueueFailureError, markJobEnqueueFailed } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const researchQuerySchema = z.object({
  matterId: z.string().min(1),
  status: z.enum(legalResearchArtifactStatuses).optional(),
  kind: z.enum(legalResearchArtifactKinds).optional(),
});

const sourceReferenceSchema = z
  .object({
    sourceType: z.enum(legalResearchSourceTypes),
    label: z.string().trim().min(1).max(240),
    jurisdiction: z.string().trim().min(1).max(80).optional(),
    staffCitationLabel: z.string().trim().min(1).max(240).optional(),
    locator: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

const contextLinkSchema = z
  .object({
    resourceType: z.enum([
      "matter",
      "document",
      "legal_research_artifact",
      "draft",
      "contact",
      "task",
      "calendar_event",
      "intake_session",
    ]),
    resourceId: z.string().trim().min(1).max(160),
    label: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

const documentAnalysisSchema = z
  .object({
    documentId: z.string().trim().min(1).max(160),
    status: z.enum(["not_started", "in_review", "ready_for_review", "blocked"]),
    extractionStatus: z.enum(["not_requested", "pending", "completed", "failed"]).optional(),
    artifactStatus: z.enum(["metadata_only", "summary_available"]).optional(),
    sourceTextLength: z.number().int().min(0).optional(),
  })
  .strict();

const timelineSchema = z
  .object({
    noteType: z.enum(["strategy", "timeline", "issue", "next_step"]),
    eventDate: z.string().trim().min(1).max(80).optional(),
    dueAt: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

const checkpointSchema = z
  .object({
    checkpointType: z.enum([
      "source_review",
      "matter_context",
      "document_analysis",
      "strategy_review",
      "supervising_lawyer_review",
    ]),
    assignedUserId: z.string().trim().min(1).max(160).optional(),
    dueAt: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

const artifactShellSchema = z
  .object({
    kind: z.enum(legalResearchArtifactKinds),
    status: z.enum(["draft", "ready_for_review"]).default("draft"),
    title: z.string().trim().min(1).max(240),
    note: z.string().max(4000).optional(),
    sourceReferences: z.array(sourceReferenceSchema).max(20).default([]),
    contextLinks: z.array(contextLinkSchema).max(20).default([]),
    documentAnalysis: documentAnalysisSchema.optional(),
    timeline: timelineSchema.optional(),
    checkpoint: checkpointSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const createArtifactSchema = artifactShellSchema.extend({
  matterId: z.string().trim().min(1),
});

const updateArtifactSchema = artifactShellSchema.partial().strict();

const idParamsSchema = z.object({ id: z.string().min(1) });

const reviewBodySchema = z.object({
  decision: z.enum(["reviewed", "rejected"]),
});

const providerJobBodySchema = z
  .object({
    matterId: z.string().trim().min(1),
    requestType: z.enum(legalResearchProviderJobRequestTypes).default("citation_review"),
    artifactIds: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
    sourceTypes: z.array(z.enum(legalResearchSourceTypes)).max(20).default([]),
    jurisdiction: z.string().trim().min(1).max(80).optional(),
    citationReferenceCount: z.number().int().min(0).max(200).default(0),
    contextLinkCount: z.number().int().min(0).max(200).default(0),
    clientRequestId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

function assertLegalResearchAccess(input: {
  auth: Parameters<typeof requireAccess>[0];
  action: "create" | "read" | "update" | "approve";
  matterId: string;
}): void {
  const access = requireAccess(input.auth, {
    resource: "legal_research",
    action: input.action,
    matterId: input.matterId,
  });
  if (!access.ok) throw access.error;
}

function makeArtifact(input: {
  body: z.infer<typeof createArtifactSchema>;
  firmId: string;
  userId: string;
  now: string;
}): LegalResearchArtifactRecord {
  return {
    id: `legal-research-${crypto.randomUUID()}`,
    firmId: input.firmId,
    matterId: input.body.matterId,
    kind: input.body.kind,
    status: input.body.status,
    title: input.body.title,
    note: input.body.note,
    sourceReferences: input.body.sourceReferences,
    contextLinks: input.body.contextLinks,
    documentAnalysis: input.body.documentAnalysis,
    timeline: input.body.timeline,
    checkpoint: input.body.checkpoint,
    createdByUserId: input.userId,
    createdAt: input.now,
    updatedAt: input.now,
    reviewOnly: true,
    metadata: input.body.metadata,
  };
}

function isLegalResearchProviderJob(
  job: JobLifecycleRecord,
  matterId: string,
): job is JobLifecycleRecord & {
  queueName: "ai_triage";
  jobName: typeof legalResearchProviderJobName;
} {
  return (
    job.queueName === "ai_triage" &&
    job.jobName === legalResearchProviderJobName &&
    job.metadata.matterId === matterId
  );
}

function serializeProviderJob(job: JobLifecycleRecord): LegalResearchProviderJobRecord {
  return serializeLegalResearchProviderJob(job, serializeJobRun(job).metadata);
}

async function listMatterProviderJobs(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  matterId: string;
}): Promise<LegalResearchProviderJobRecord[]> {
  return (await input.repository.listJobLifecycleRecords(input.firmId, { queueName: "ai_triage" }))
    .filter((job) => isLegalResearchProviderJob(job, input.matterId))
    .map(serializeProviderJob);
}

async function assertProviderJobArtifacts(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  matterId: string;
  artifactIds: string[];
}): Promise<void> {
  for (const artifactId of input.artifactIds) {
    const artifact = await input.repository.getLegalResearchArtifact(input.firmId, artifactId);
    if (!artifact || artifact.matterId !== input.matterId) {
      throw Object.assign(new Error("Legal research artifact was not found"), { statusCode: 404 });
    }
  }
}

async function createLegalResearchProviderJob(input: {
  auth: ApiAuthContext;
  body: z.infer<typeof providerJobBodySchema>;
  repository: ApiRouteDependencies["repository"];
  aiAssistJobQueue: ApiRouteDependencies["aiAssistJobQueue"];
}): Promise<LegalResearchProviderJobRecord> {
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const queueConfigured = Boolean(input.aiAssistJobQueue);
  const enqueueStatus = queueConfigured
    ? "queued_for_reserved_legal_research_worker"
    : "reserved_worker_not_configured";
  const idempotencyKey = input.body.clientRequestId
    ? buildIdempotencyKey({
        scope: "job",
        firmId: input.auth.firmId,
        matterId: input.body.matterId,
        resourceType: "legal_research",
        resourceId: input.body.matterId,
        action: "legal_research.provider_review.queue",
        providerOrTemplate: `${legalResearchProviderJobName}:${input.body.requestType}`,
        clientKey: input.body.clientRequestId,
      })
    : undefined;
  const metadata = {
    ...(idempotencyKey
      ? idempotencyMetadata({
          matterId: input.body.matterId,
          requestType: input.body.requestType,
          sourceTypes: input.body.sourceTypes,
          citationReferenceCount: input.body.citationReferenceCount,
          contextLinkCount: input.body.contextLinkCount,
          artifactCount: input.body.artifactIds.length,
          jurisdiction: input.body.jurisdiction,
        })
      : {}),
    ...buildLegalResearchProviderJobMetadata({
      matterId: input.body.matterId,
      requestType: input.body.requestType,
      sourceTypes: input.body.sourceTypes,
      citationReferenceCount: input.body.citationReferenceCount,
      contextLinkCount: input.body.contextLinkCount,
      artifactCount: input.body.artifactIds.length,
      requestedByUserId: input.auth.user.id,
      jurisdiction: input.body.jurisdiction,
      enqueueStatus,
    }),
    idempotencyKeyPresent: Boolean(idempotencyKey),
  };

  let job: JobLifecycleRecord;
  try {
    job = await input.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: input.auth.firmId,
      queueName: "ai_triage",
      jobName: legalResearchProviderJobName,
      status: queueConfigured ? "queued" : "skipped",
      targetResourceType: "legal_research",
      targetResourceId: input.body.matterId,
      idempotencyKey,
      attemptsMade: 0,
      maxAttempts: 1,
      queuedAt: now,
      finishedAt: queueConfigured ? undefined : now,
      metadata,
    });
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }

  if (queueConfigured && job.id === jobId) {
    let bullJobId: string | undefined;
    try {
      const sourceTypes = [...new Set(input.body.sourceTypes)].join(",");
      const bullJob = await input.aiAssistJobQueue!.add(
        legalResearchProviderJobName,
        {
          firmId: input.auth.firmId,
          resourceType: "legal_research",
          resourceId: input.body.matterId,
          metadata: {
            jobId,
            matterId: input.body.matterId,
            requestType: input.body.requestType,
            sourceTypes,
            sourceTypeCount: sourceTypes ? sourceTypes.split(",").length : 0,
            citationReferenceCount: input.body.citationReferenceCount,
            contextLinkCount: input.body.contextLinkCount,
            artifactCount: input.body.artifactIds.length,
            requestedByUserId: input.auth.user.id,
            provider: "reserved_legal_research_provider",
            providerStatus: "reserved",
            providerConfigured: false,
            citationReviewRequired: true,
            sourceTextIncluded: false,
            promptIncluded: false,
            providerEvidenceStored: false,
            citationVerificationClaims: false,
            downstreamMutation: false,
            reviewOnly: true,
            idempotencyKeyPresent: Boolean(idempotencyKey),
          },
        },
        { jobId },
      );
      bullJobId = bullJob.id === undefined ? undefined : String(bullJob.id);
    } catch {
      await markJobEnqueueFailed(input.repository, input.auth.firmId, job, now);
      throw enqueueFailureError();
    }
    job = await input.repository.updateJobLifecycleRecord(input.auth.firmId, job.id, {
      bullJobId,
    });
  }

  await appendRouteAuditEvent(input.repository, input.auth, {
    action:
      queueConfigured && job.status === "queued"
        ? "legal_research.provider_job.queued"
        : "legal_research.provider_job.recorded",
    resourceType: "legal_research",
    resourceId: job.id,
    occurredAt: now,
    metadata: {
      ...metadata,
      jobId: job.id,
      bullJobId: job.bullJobId,
    },
  });

  return serializeProviderJob(job);
}

export function registerLegalResearchRoutes(
  server: FastifyInstance,
  { repository, aiAssistJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/legal-research/workspace", async (request) => {
    const query = parseRequestPart(researchQuerySchema, request.query, "query");
    assertLegalResearchAccess({ auth: request.auth, action: "read", matterId: query.matterId });
    const [artifacts, providerJobs] = await Promise.all([
      repository.listLegalResearchArtifacts(request.auth.firmId, query),
      listMatterProviderJobs({
        repository,
        firmId: request.auth.firmId,
        matterId: query.matterId,
      }),
    ]);
    return {
      status: "available" as const,
      ...buildLegalResearchWorkspace({ matterId: query.matterId, artifacts, providerJobs }),
    };
  });

  server.post("/api/legal-research/provider-jobs", async (request, reply) => {
    const body = parseRequestPart(providerJobBodySchema, request.body, "body");
    assertLegalResearchAccess({ auth: request.auth, action: "create", matterId: body.matterId });
    await assertProviderJobArtifacts({
      repository,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      artifactIds: body.artifactIds,
    });
    const providerJob = await createLegalResearchProviderJob({
      auth: request.auth,
      body,
      repository,
      aiAssistJobQueue,
    });
    const boundary = buildLegalResearchWorkspace({
      matterId: body.matterId,
      artifacts: [],
      providerJobs: [providerJob],
    });
    return reply.code(202).send({
      status: providerJob.status === "queued" ? ("queued" as const) : ("reserved" as const),
      job: providerJob,
      citationReview: boundary.citationReview,
      providerJobBoundary: boundary.providerJobBoundary,
    });
  });

  server.post("/api/legal-research/artifacts", async (request, reply) => {
    const body = parseRequestPart(createArtifactSchema, request.body, "body");
    assertLegalResearchAccess({ auth: request.auth, action: "create", matterId: body.matterId });
    const created = await repository.createLegalResearchArtifact(
      makeArtifact({
        body,
        firmId: request.auth.firmId,
        userId: request.auth.user.id,
        now: new Date().toISOString(),
      }),
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "legal_research.artifact.created",
      resourceType: "legal_research",
      resourceId: created.id,
      metadata: buildLegalResearchArtifactAuditMetadata(created),
    });
    return reply.code(201).send(created);
  });

  server.patch("/api/legal-research/artifacts/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(updateArtifactSchema, request.body, "body");
    const existing = await repository.getLegalResearchArtifact(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Legal research artifact was not found"), { statusCode: 404 });
    }
    assertLegalResearchAccess({
      auth: request.auth,
      action: "update",
      matterId: existing.matterId,
    });
    const updated = await repository.updateLegalResearchArtifact({
      ...existing,
      ...body,
      metadata: body.metadata ?? existing.metadata,
      updatedAt: new Date().toISOString(),
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "legal_research.artifact.updated",
      resourceType: "legal_research",
      resourceId: updated.id,
      metadata: buildLegalResearchArtifactAuditMetadata(updated),
    });
    return updated;
  });

  server.patch("/api/legal-research/artifacts/:id/review", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewBodySchema, request.body, "body");
    const existing = await repository.getLegalResearchArtifact(request.auth.firmId, params.id);
    if (!existing) {
      throw Object.assign(new Error("Legal research artifact was not found"), { statusCode: 404 });
    }
    assertLegalResearchAccess({
      auth: request.auth,
      action: "approve",
      matterId: existing.matterId,
    });
    const updated = await repository.updateLegalResearchArtifact(
      reviewLegalResearchArtifactRecord({
        record: existing,
        decision: body.decision,
        reviewedByUserId: request.auth.user.id,
        reviewedAt: new Date().toISOString(),
      }),
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "legal_research.artifact.reviewed",
      resourceType: "legal_research",
      resourceId: updated.id,
      metadata: buildLegalResearchArtifactAuditMetadata(updated),
    });
    return updated;
  });
}
