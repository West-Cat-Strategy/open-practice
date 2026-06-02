import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  aiOperationalProposalKinds,
  aiOperationalProposalStatuses,
  assertAiOperationalProposalKinds,
  buildAiOperationalProposalAuditMetadata,
  canAccess,
  extractTipTapPlainText,
  reviewAiOperationalProposalRecord,
  summarizeAiOperationalProposals,
  type AiOperationalProposalKind,
  type AiOperationalProposalRecord,
  type DocumentTextExtractionRecord,
  type JobLifecycleRecord,
  type AccessRequest,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import { enqueueFailureError, markJobEnqueueFailed } from "./outbound-email.js";
import { queueStatus, serializeJobRun } from "./job-status.js";
import type { ApiRouteDependencies } from "./types.js";

const proposalsQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
  status: z.enum(aiOperationalProposalStatuses).optional(),
  kind: z.enum(aiOperationalProposalKinds).optional(),
});

const queueBodySchema = z.object({
  proposalKinds: z.array(z.enum(aiOperationalProposalKinds)).min(1).max(5).optional(),
  clientRequestId: z.string().trim().min(1).max(128).optional(),
});

const reviewBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertAiProposalAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

async function getEnabledAiProvider(
  repository: ApiRouteDependencies["repository"],
  firmId: string,
): Promise<string | undefined> {
  return (await repository.listProviderSettings(firmId, { kind: "ai" })).find(
    (setting) => setting.enabled,
  )?.key;
}

function latestCompletedExtraction(
  extractions: DocumentTextExtractionRecord[],
): DocumentTextExtractionRecord | undefined {
  return extractions
    .filter((candidate) => candidate.status === "completed" && candidate.extractedText)
    .sort((left, right) =>
      (right.completedAt ?? right.createdAt).localeCompare(left.completedAt ?? left.createdAt),
    )[0];
}

async function operationalProposalGenerationStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  aiOperationalProposalProvider?: ApiRouteDependencies["aiOperationalProposalProvider"];
  aiAssistJobQueue?: ApiRouteDependencies["aiAssistJobQueue"];
}) {
  const providerKey = await getEnabledAiProvider(input.repository, input.firmId);
  const queue = queueStatus("ai_triage", input.aiAssistJobQueue);
  const configured =
    Boolean(providerKey) &&
    Boolean(input.aiOperationalProposalProvider) &&
    queue.status === "configured";
  return {
    status: configured ? ("configured" as const) : ("disabled" as const),
    reason: configured
      ? undefined
      : !providerKey
        ? "not_configured"
        : !input.aiOperationalProposalProvider
          ? "provider_not_injected"
          : "queue_not_configured",
    provider: providerKey,
    queue,
    jobName: "operational_action_proposals" as const,
  };
}

function proposalsNotConfigured(): ApiHttpError {
  return new ApiHttpError(
    503,
    "ai_operational_proposals_not_configured",
    "AI operational proposal provider is not configured",
  );
}

async function configuredAsyncOperationalProposals(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  aiOperationalProposalProvider: ApiRouteDependencies["aiOperationalProposalProvider"];
  aiAssistJobQueue: ApiRouteDependencies["aiAssistJobQueue"];
}): Promise<string> {
  const providerKey = await getEnabledAiProvider(input.repository, input.firmId);
  if (!providerKey || !input.aiOperationalProposalProvider) throw proposalsNotConfigured();
  if (!input.aiAssistJobQueue) {
    throw new ApiHttpError(
      503,
      "ai_operational_proposals_queue_not_configured",
      "AI operational proposal queue is not configured",
    );
  }
  return providerKey;
}

export function registerAiOperationalProposalRoutes(
  server: FastifyInstance,
  { repository, aiOperationalProposalProvider, aiAssistJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/ai-operational-proposals", async (request) => {
    const query = parseRequestPart(proposalsQuerySchema, request.query, "query");
    if (query.matterId) {
      assertAiProposalAccess(request.auth, {
        resource: "ai_proposal",
        action: "read",
        matterId: query.matterId,
      });
    }
    const records = await repository.listAiOperationalProposals(request.auth.firmId, query);
    const visible = records.filter((record) =>
      canAccess({
        user: request.auth.user,
        firmId: request.auth.firmId,
        resource: "ai_proposal",
        action: "read",
        matterId: record.matterId,
      }),
    );
    return {
      proposals: visible,
      summary: summarizeAiOperationalProposals(visible),
      generation: await operationalProposalGenerationStatus({
        repository,
        firmId: request.auth.firmId,
        aiOperationalProposalProvider,
        aiAssistJobQueue,
      }),
    };
  });

  server.post("/api/drafts/:id/operational-proposals/jobs", async (request, reply) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(queueBodySchema, request.body ?? {}, "body");
    const proposalKinds = [...new Set(body.proposalKinds ?? aiOperationalProposalKinds)];
    assertAiOperationalProposalKinds(proposalKinds);
    const draft = await repository.getDraft(request.auth.firmId, params.id);
    if (!draft) throw Object.assign(new Error("Draft was not found"), { statusCode: 404 });
    if (!draft.matterId) {
      throw new ApiHttpError(
        409,
        "matter_scoped_draft_required",
        "AI operational proposals require a matter-scoped draft",
      );
    }
    assertAiProposalAccess(request.auth, {
      resource: "draft",
      action: "read",
      matterId: draft.matterId,
    });
    assertAiProposalAccess(request.auth, {
      resource: "ai_proposal",
      action: "create",
      matterId: draft.matterId,
    });
    const sourceText = extractTipTapPlainText(draft.editorJson);
    const result = await queueOperationalProposalJob({
      auth: request.auth,
      proposalKinds,
      clientRequestId: body.clientRequestId,
      source: {
        sourceType: "draft",
        matterId: draft.matterId,
        draftId: draft.id,
        sourceTextLength: sourceText.length,
      },
      repository,
      aiOperationalProposalProvider,
      aiAssistJobQueue,
    });
    return reply.code(202).send(result);
  });

  server.post("/api/documents/:id/operational-proposals/jobs", async (request, reply) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(queueBodySchema, request.body ?? {}, "body");
    const proposalKinds = [...new Set(body.proposalKinds ?? aiOperationalProposalKinds)];
    assertAiOperationalProposalKinds(proposalKinds);
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    assertAiProposalAccess(request.auth, {
      resource: "document",
      action: "read",
      matterId: document.matterId,
    });
    assertAiProposalAccess(request.auth, {
      resource: "ai_proposal",
      action: "create",
      matterId: document.matterId,
    });
    const extraction = latestCompletedExtraction(
      await repository.getDocumentTextExtractions(request.auth.firmId, document.id),
    );
    if (!extraction?.extractedText) {
      throw new ApiHttpError(
        409,
        "text_extraction_required",
        "Document text extraction is required before AI operational proposals",
      );
    }
    const result = await queueOperationalProposalJob({
      auth: request.auth,
      proposalKinds,
      clientRequestId: body.clientRequestId,
      source: {
        sourceType: "document",
        matterId: document.matterId,
        documentId: document.id,
        sourceTextLength: extraction.extractedText.length,
      },
      repository,
      aiOperationalProposalProvider,
      aiAssistJobQueue,
    });
    return reply.code(202).send(result);
  });

  server.patch("/api/ai-operational-proposals/:id/review", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewBodySchema, request.body, "body");
    const record = await repository.getAiOperationalProposal(request.auth.firmId, params.id);
    if (!record) {
      throw Object.assign(new Error("AI operational proposal was not found"), { statusCode: 404 });
    }
    assertAiProposalAccess(request.auth, {
      resource: "ai_proposal",
      action: "approve",
      matterId: record.matterId,
    });
    const updated = await repository.updateAiOperationalProposal(
      reviewAiOperationalProposalRecord({
        record,
        decision: body.decision,
        reviewedByUserId: request.auth.user.id,
        reviewedAt: new Date().toISOString(),
      }),
    );
    await appendRouteAuditEvent(repository, request.auth, {
      action: "ai_operational_proposal.reviewed",
      resourceType: "ai_proposal",
      resourceId: updated.id,
      metadata: buildAiOperationalProposalAuditMetadata(updated),
    });
    return updated;
  });
}

async function queueOperationalProposalJob(input: {
  auth: ApiAuthContext;
  proposalKinds: AiOperationalProposalKind[];
  clientRequestId?: string;
  source: {
    sourceType: AiOperationalProposalRecord["source"]["sourceType"];
    matterId: string;
    draftId?: string;
    documentId?: string;
    sourceTextLength: number;
  };
  repository: ApiRouteDependencies["repository"];
  aiOperationalProposalProvider: ApiRouteDependencies["aiOperationalProposalProvider"];
  aiAssistJobQueue: ApiRouteDependencies["aiAssistJobQueue"];
}) {
  const providerKey = await configuredAsyncOperationalProposals({
    repository: input.repository,
    firmId: input.auth.firmId,
    aiOperationalProposalProvider: input.aiOperationalProposalProvider,
    aiAssistJobQueue: input.aiAssistJobQueue,
  });
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const sourceId = input.source.draftId ?? input.source.documentId;
  const proposalKinds = input.proposalKinds.join(",");
  const idempotencyKey = input.clientRequestId
    ? buildIdempotencyKey({
        scope: "job",
        firmId: input.auth.firmId,
        matterId: input.source.matterId,
        resourceType: "ai_proposal",
        resourceId: sourceId,
        action: "ai_proposal.async.queue",
        providerOrTemplate: `${providerKey}:${proposalKinds}`,
        clientKey: input.clientRequestId,
      })
    : undefined;
  const metadata = {
    ...(idempotencyKey
      ? idempotencyMetadata({
          matterId: input.source.matterId,
          sourceType: input.source.sourceType,
          sourceId,
          provider: providerKey,
          proposalKinds,
          proposalKindCount: input.proposalKinds.length,
          sourceTextLength: input.source.sourceTextLength,
        })
      : {}),
    matterId: input.source.matterId,
    sourceType: input.source.sourceType,
    draftId: input.source.draftId,
    documentId: input.source.documentId,
    provider: providerKey,
    proposalKinds,
    proposalKindCount: input.proposalKinds.length,
    requestedByUserId: input.auth.user.id,
    sourceTextLength: input.source.sourceTextLength,
    idempotencyKeyPresent: Boolean(idempotencyKey),
  };
  let job: JobLifecycleRecord;
  try {
    job = await input.repository.createJobLifecycleRecord({
      id: jobId,
      firmId: input.auth.firmId,
      queueName: "ai_triage",
      jobName: "operational_action_proposals",
      status: "queued",
      targetResourceType: input.source.sourceType,
      targetResourceId: sourceId,
      idempotencyKey,
      attemptsMade: 0,
      maxAttempts: 2,
      queuedAt: now,
      metadata,
    });
  } catch (error) {
    rethrowIdempotencyConflict(error);
  }

  if (job.id === jobId) {
    let bullJobId: string | undefined;
    try {
      const bullJob = await input.aiAssistJobQueue!.add(
        "operational_action_proposals",
        {
          firmId: input.auth.firmId,
          resourceType: input.source.sourceType,
          resourceId: sourceId,
          metadata: {
            jobId,
            matterId: input.source.matterId,
            sourceType: input.source.sourceType,
            draftId: input.source.draftId,
            documentId: input.source.documentId,
            provider: providerKey,
            proposalKinds,
            proposalKindCount: input.proposalKinds.length,
            requestedByUserId: input.auth.user.id,
            sourceTextLength: input.source.sourceTextLength,
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

    await appendRouteAuditEvent(input.repository, input.auth, {
      action: "ai_operational_proposal.async_queued",
      resourceType: "ai_proposal",
      resourceId: job.id,
      occurredAt: now,
      metadata: {
        matterId: input.source.matterId,
        sourceType: input.source.sourceType,
        draftId: input.source.draftId,
        documentId: input.source.documentId,
        provider: providerKey,
        proposalKinds,
        proposalKindCount: input.proposalKinds.length,
        jobId: job.id,
        bullJobId: job.bullJobId,
        idempotencyKeyPresent: Boolean(job.idempotencyKey),
        sourceTextLength: input.source.sourceTextLength,
      },
    });
  }

  return {
    status: "queued" as const,
    sourceType: input.source.sourceType,
    draftId: input.source.draftId,
    documentId: input.source.documentId,
    proposalKinds: input.proposalKinds,
    job: serializeJobRun(job),
  };
}
