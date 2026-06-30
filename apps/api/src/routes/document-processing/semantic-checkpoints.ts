import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildDocumentConversionSemanticReviewCheckpointMetadata,
  buildLegalResearchArtifactAuditMetadata,
  type LegalResearchArtifactRecord,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertDocumentProcessingAccess,
  buildDocumentConversionReviewSummary,
  conversionReviewArtifactForDocument,
  documentIdParamsSchema,
  latestDocumentConversionReviewJob,
  semanticReviewCheckpointsForConversionReview,
} from "./shared.js";

const emptyBodySchema = z.object({}).strict();

function conflict(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 409 });
}

function makeSemanticReviewCheckpoint(input: {
  firmId: string;
  documentId: string;
  matterId: string;
  artifact: LegalResearchArtifactRecord;
  jobId?: string;
  counts?: {
    sourceTextLength?: number;
    wordCount?: number;
    lineCount?: number;
    nonEmptyLineCount?: number;
    pageBreakCount?: number;
    estimatedPageCount?: number;
  };
  reviewerUserId: string;
  now: string;
  conversionReviewStatus: string;
  artifactStatus: string;
}): LegalResearchArtifactRecord {
  return {
    id: `legal-research-${crypto.randomUUID()}`,
    firmId: input.firmId,
    matterId: input.matterId,
    kind: "review_checkpoint",
    status: "ready_for_review",
    title: "Document semantic review checkpoint",
    sourceReferences: [],
    contextLinks: [
      { resourceType: "document", resourceId: input.documentId },
      { resourceType: "legal_research_artifact", resourceId: input.artifact.id },
    ],
    checkpoint: {
      checkpointType: "document_analysis",
      assignedUserId: input.reviewerUserId,
    },
    createdByUserId: input.reviewerUserId,
    createdAt: input.now,
    updatedAt: input.now,
    reviewOnly: true,
    metadata: buildDocumentConversionSemanticReviewCheckpointMetadata({
      matterId: input.matterId,
      documentId: input.documentId,
      conversionReviewArtifactId: input.artifact.id,
      jobId: input.jobId,
      sourceTextLength:
        input.counts?.sourceTextLength ?? input.artifact.documentAnalysis?.sourceTextLength,
      wordCount: input.counts?.wordCount,
      lineCount: input.counts?.lineCount,
      nonEmptyLineCount: input.counts?.nonEmptyLineCount,
      pageBreakCount: input.counts?.pageBreakCount,
      estimatedPageCount: input.counts?.estimatedPageCount,
      conversionReviewStatus: input.conversionReviewStatus,
      artifactStatus: input.artifactStatus,
      createdByUserId: input.reviewerUserId,
      assignedUserId: input.reviewerUserId,
      createdAt: input.now,
      conversionReviewReviewedAt: input.artifact.reviewedAt,
      conversionReviewReviewedByUserId: input.artifact.reviewedByUserId,
    }),
  };
}

export function registerDocumentProcessingSemanticCheckpointRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.post(
    "/api/document-processing/documents/:documentId/conversion-review/semantic-review/checkpoints",
    async (request, reply) => {
      const params = parseRequestPart(documentIdParamsSchema, request.params, "params");
      parseRequestPart(emptyBodySchema, request.body ?? {}, "body");
      const document = await repository.getDocument(request.auth.firmId, params.documentId);
      if (!document) {
        throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
      }

      assertDocumentProcessingAccess(request.auth, {
        resource: "document_processing",
        action: "read",
        matterId: document.matterId,
      });
      const legalResearchAccess = requireAccess(request.auth, {
        resource: "legal_research",
        action: "create",
        matterId: document.matterId,
      });
      if (!legalResearchAccess.ok) throw legalResearchAccess.error;

      const artifacts = await repository.listLegalResearchArtifacts(request.auth.firmId, {
        matterId: document.matterId,
      });
      const artifact = conversionReviewArtifactForDocument(document, artifacts);
      if (!artifact) {
        throw conflict("Document conversion review artifact is not ready for semantic review");
      }

      const jobs = await repository.listJobLifecycleRecords(request.auth.firmId, {
        queueName: "ocr",
      });
      const latestJob = latestDocumentConversionReviewJob(document, jobs);
      const currentSummary = buildDocumentConversionReviewSummary({
        document,
        latestJob,
        artifact,
        artifacts,
      });

      if (currentSummary.semanticReviewReadiness.posture !== "ready") {
        throw conflict("Document conversion review artifact is not ready for semantic review");
      }

      const existing = semanticReviewCheckpointsForConversionReview({
        document,
        artifact,
        artifacts,
      })[0];
      if (existing) {
        return {
          status: "existing",
          task: "document_conversion_semantic_review_checkpoint",
          documentId: document.id,
          checkpoint: existing,
          conversionReview: currentSummary,
        };
      }

      const now = new Date().toISOString();
      const checkpoint = await repository.createLegalResearchArtifact(
        makeSemanticReviewCheckpoint({
          firmId: request.auth.firmId,
          documentId: document.id,
          matterId: document.matterId,
          artifact,
          jobId: currentSummary.jobId,
          counts: currentSummary.counts,
          reviewerUserId: request.auth.user.id,
          now,
          conversionReviewStatus: currentSummary.semanticReviewReadiness.conversionReviewStatus,
          artifactStatus: currentSummary.semanticReviewReadiness.artifactStatus,
        }),
      );
      await appendRouteAuditEvent(repository, request.auth, {
        action: "legal_research.artifact.created",
        resourceType: "legal_research",
        resourceId: checkpoint.id,
        metadata: buildLegalResearchArtifactAuditMetadata(checkpoint),
      });

      const updatedArtifacts = [checkpoint, ...artifacts];
      return reply.code(201).send({
        status: "created",
        task: "document_conversion_semantic_review_checkpoint",
        documentId: document.id,
        checkpoint,
        conversionReview: buildDocumentConversionReviewSummary({
          document,
          latestJob,
          artifact,
          artifacts: updatedArtifacts,
        }),
      });
    },
  );
}
