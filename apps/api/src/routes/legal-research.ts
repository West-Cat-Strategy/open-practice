import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildLegalResearchArtifactAuditMetadata,
  buildLegalResearchWorkspace,
  legalResearchArtifactKinds,
  legalResearchArtifactStatuses,
  legalResearchSourceTypes,
  reviewLegalResearchArtifactRecord,
  type LegalResearchArtifactRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
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

export function registerLegalResearchRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/legal-research/workspace", async (request) => {
    const query = parseRequestPart(researchQuerySchema, request.query, "query");
    assertLegalResearchAccess({ auth: request.auth, action: "read", matterId: query.matterId });
    const artifacts = await repository.listLegalResearchArtifacts(request.auth.firmId, query);
    return {
      status: "available" as const,
      ...buildLegalResearchWorkspace({ matterId: query.matterId, artifacts }),
    };
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
