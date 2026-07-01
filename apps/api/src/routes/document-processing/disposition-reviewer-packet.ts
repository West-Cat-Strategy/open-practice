import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildDocumentRetentionHoldReview,
  buildDocumentReviewSuggestions,
  documentDispositionReviewerPacketDecisions,
  documentRetentionHoldReviewReasons,
} from "@open-practice/domain";
import { requireAccess, requireStaffAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertDocumentProcessingAccess,
  documentIdParamsSchema,
  sanitizeDocument,
} from "./shared.js";

const dispositionReviewerPacketBodySchema = z
  .object({
    decision: z.enum(documentDispositionReviewerPacketDecisions),
    reason: z.enum(documentRetentionHoldReviewReasons),
  })
  .strict();

export function registerDocumentProcessingDispositionReviewerPacketRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.post(
    "/api/document-processing/documents/:documentId/disposition-reviewer-packet",
    async (request) => {
      const staffAccess = requireStaffAccess(request.auth);
      if (!staffAccess.ok) throw staffAccess.error;

      const params = parseRequestPart(documentIdParamsSchema, request.params, "params");
      const body = parseRequestPart(
        dispositionReviewerPacketBodySchema,
        request.body ?? {},
        "body",
      );
      const document = await repository.getDocument(request.auth.firmId, params.documentId);
      if (!document) {
        throw new ApiHttpError(404, "DOCUMENT_NOT_FOUND", "Document was not found.");
      }

      assertDocumentProcessingAccess(request.auth, {
        resource: "document_processing",
        action: "read",
        matterId: document.matterId,
      });
      const documentAccess = requireAccess(request.auth, {
        resource: "document",
        action: "update",
        matterId: document.matterId,
      });
      if (!documentAccess.ok) throw documentAccess.error;

      const sameMatterDocuments = await repository.listMatterDocuments(
        request.auth.firmId,
        document.matterId,
      );
      const firmSettings = await repository.getFirmSettings(request.auth.firmId);
      const reviewSuggestions = buildDocumentReviewSuggestions({
        document,
        sameMatterDocuments,
      });
      const currentRetentionHoldReview = buildDocumentRetentionHoldReview({
        document,
        reviewSuggestions,
        dispositionReviewScheduleProfile: firmSettings?.dispositionReviewScheduleProfile,
      });
      const blockerCounts = currentRetentionHoldReview.dispositionMetadata.blockerCounts;
      if (blockerCounts.total > 0) {
        throw new ApiHttpError(
          409,
          "DOCUMENT_DISPOSITION_REVIEWER_PACKET_BLOCKED",
          "Document disposition reviewer packet is blocked by hold or integrity cues.",
          {
            documentId: document.id,
            blockerCount: blockerCounts.total,
          },
        );
      }

      const recordedAt = new Date().toISOString();
      const updated = await repository.recordDocumentRetentionHoldReviewDecision({
        firmId: request.auth.firmId,
        documentId: document.id,
        decision: body.decision,
        reason: body.reason,
        recordedByUserId: request.auth.user.id,
        recordedAt,
        sourceCueCounts: currentRetentionHoldReview.sourceCueCounts,
      });
      const retentionHoldReview = buildDocumentRetentionHoldReview({
        document: updated,
        reviewSuggestions,
        dispositionReviewScheduleProfile: firmSettings?.dispositionReviewScheduleProfile,
      });
      const dispositionMetadata = retentionHoldReview.dispositionMetadata;

      await appendRouteAuditEvent(repository, request.auth, {
        action: "document.disposition_reviewer_packet.recorded",
        resourceType: "document",
        resourceId: updated.id,
        metadata: {
          matterId: updated.matterId,
          documentId: updated.id,
          decision: body.decision,
          reason: body.reason,
          dispositionCandidateState: dispositionMetadata.candidateState,
          readyForReviewerPacket: dispositionMetadata.readyForReviewerPacket,
          blockerCount: dispositionMetadata.blockerCounts.total,
          legalHoldBlockerCount: dispositionMetadata.blockerCounts.legalHold,
          uploadIntegrityBlockerCount: dispositionMetadata.blockerCounts.uploadIntegrity,
          reviewStateBlockerCount: dispositionMetadata.blockerCounts.reviewState,
          retentionHoldCueCount: retentionHoldReview.sourceCueCounts.retention_review,
          sourceCueTotal: retentionHoldReview.sourceCueCounts.total,
          scheduleProfilePresent: Boolean(dispositionMetadata.scheduleProfile),
          objectDeletion: false,
          destructiveAction: false,
          retentionDeadlineEnforced: false,
          legalHoldOverride: false,
          legalHoldReleaseCommand: false,
          retainedExportBody: false,
          rawPayloadRetention: false,
          complianceClaim: false,
        },
      });

      return {
        document: sanitizeDocument(updated),
        retentionHoldReview,
      };
    },
  );
}
