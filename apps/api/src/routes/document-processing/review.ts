import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildLegalResearchArtifactAuditMetadata,
  reviewLegalResearchArtifactRecord,
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
  latestCompletedTextExtraction,
  latestDocumentConversionReviewJob,
} from "./shared.js";

const conversionReviewDecisionBodySchema = z
  .object({
    decision: z.enum(["reviewed", "rejected"]),
  })
  .strict();

const safeCountKeys = [
  "sourceTextLength",
  "wordCount",
  "lineCount",
  "nonEmptyLineCount",
  "paragraphCount",
  "pageBreakCount",
  "estimatedPageCount",
] as const;

const safePolicyKeys = [
  "metadataOnly",
  "reviewOnly",
  "internalExtractedTextStored",
  "rawOcrTextStored",
  "rawOcrTextStoredInMetadata",
  "rawOcrTextReturned",
  "rawMarkdownStored",
  "annotationBodiesStored",
  "chunksStored",
  "embeddingsStored",
  "providerPayloadsStored",
] as const;

function conflict(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 409 });
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function metadataBoolean(metadata: Record<string, unknown>, key: string): boolean | undefined {
  const value = metadata[key];
  return typeof value === "boolean" ? value : undefined;
}

function metadataRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function safeConversionReviewCounts(
  metadata: Record<string, unknown>,
): Record<string, number> | undefined {
  const counts = metadataRecord(metadata.counts);
  const source = counts ?? metadata;
  const safeCounts: Record<string, number> = {};
  for (const key of safeCountKeys) {
    const value = metadataNumber(source, key);
    if (value !== undefined) safeCounts[key] = value;
  }
  return Object.keys(safeCounts).length > 0 ? safeCounts : undefined;
}

function safeConversionReviewPolicy(
  metadata: Record<string, unknown>,
): Record<string, boolean> | undefined {
  const policy = metadataRecord(metadata.policy);
  if (!policy) return undefined;
  const safePolicy: Record<string, boolean> = {};
  for (const key of safePolicyKeys) {
    const value = metadataBoolean(policy, key);
    if (value !== undefined) safePolicy[key] = value;
  }
  return Object.keys(safePolicy).length > 0 ? safePolicy : undefined;
}

function reviewedConversionReviewMetadata(input: {
  metadata: Record<string, unknown>;
  decision: "reviewed" | "rejected";
  artifactStatus: string;
}): Record<string, unknown> {
  return compactMetadata({
    source: metadataString(input.metadata, "source"),
    jobId: metadataString(input.metadata, "jobId"),
    extractionId: metadataString(input.metadata, "extractionId"),
    extractionEngine: metadataString(input.metadata, "extractionEngine"),
    extractionStatus: metadataString(input.metadata, "extractionStatus"),
    provider: metadataString(input.metadata, "provider"),
    providerStatus: metadataString(input.metadata, "providerStatus"),
    counts: safeConversionReviewCounts(input.metadata),
    policy: safeConversionReviewPolicy(input.metadata),
    metadataOnly: true,
    reviewOnly: true,
    reviewState: input.decision,
    artifactStatus: input.artifactStatus,
    staffReviewRequired: true,
    terminalReview: true,
    downstreamMutation: false,
    providerEvidenceStored: false,
    rawOcrTextReturned: false,
    conversionReviewPosture: metadataString(input.metadata, "conversionReviewPosture"),
    summaryPosture: metadataString(input.metadata, "summaryPosture") ?? "op_authored_metadata_only",
  });
}

export function registerDocumentProcessingReviewRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.patch(
    "/api/document-processing/documents/:documentId/conversion-review/review",
    async (request) => {
      const params = parseRequestPart(documentIdParamsSchema, request.params, "params");
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
        action: "approve",
        matterId: document.matterId,
      });
      if (!legalResearchAccess.ok) throw legalResearchAccess.error;

      const body = parseRequestPart(conversionReviewDecisionBodySchema, request.body ?? {}, "body");
      const artifacts = await repository.listLegalResearchArtifacts(request.auth.firmId, {
        matterId: document.matterId,
      });
      const artifact = conversionReviewArtifactForDocument(document, artifacts);
      if (!artifact) {
        throw conflict("Document conversion review artifact is not ready for review");
      }

      const jobs = await repository.listJobLifecycleRecords(request.auth.firmId, {
        queueName: "ocr",
      });
      const latestJob = latestDocumentConversionReviewJob(document, jobs);
      const latestExtraction = latestCompletedTextExtraction(
        await repository.getDocumentTextExtractions(request.auth.firmId, document.id),
      );
      const currentSummary = buildDocumentConversionReviewSummary({
        document,
        latestExtraction,
        latestJob,
        artifact,
        artifacts,
      });
      if (
        latestJob?.status === "queued" ||
        latestJob?.status === "active" ||
        latestJob?.status === "failed" ||
        latestJob?.status === "dead_letter"
      ) {
        throw conflict("Document conversion review is not ready for a review decision");
      }

      if (artifact.status === "reviewed" || artifact.status === "rejected") {
        if (artifact.status !== body.decision) {
          throw conflict("Document conversion review has already been decided");
        }
        return {
          status: "completed",
          task: "document_conversion_review",
          documentId: document.id,
          conversionReview: currentSummary,
        };
      }

      if (artifact.status !== "ready_for_review" || currentSummary.posture !== "ready_for_review") {
        throw conflict("Document conversion review artifact is not ready for review");
      }

      const updated = await repository.updateLegalResearchArtifact({
        ...reviewLegalResearchArtifactRecord({
          record: artifact,
          decision: body.decision,
          reviewedByUserId: request.auth.user.id,
          reviewedAt: new Date().toISOString(),
        }),
        metadata: reviewedConversionReviewMetadata({
          metadata: artifact.metadata,
          decision: body.decision,
          artifactStatus: artifact.documentAnalysis?.artifactStatus ?? "metadata_only",
        }),
      });
      await appendRouteAuditEvent(repository, request.auth, {
        action: "legal_research.artifact.reviewed",
        resourceType: "legal_research",
        resourceId: updated.id,
        metadata: buildLegalResearchArtifactAuditMetadata(updated),
      });
      const updatedArtifacts = artifacts.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      );

      return {
        status: "completed",
        task: "document_conversion_review",
        documentId: document.id,
        conversionReview: buildDocumentConversionReviewSummary({
          document,
          latestExtraction,
          latestJob,
          artifact: updated,
          artifacts: updatedArtifacts,
        }),
      };
    },
  );
}
