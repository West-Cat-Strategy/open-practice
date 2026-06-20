import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildDocumentRetentionHoldReview,
  buildDocumentReviewSuggestions,
  documentRetentionHoldReviewDecisions,
  documentRetentionHoldReviewReasons,
  type AccessRequest,
  type DocumentRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  normalizeChecksumSha256,
  normalizeUploadSizeBytes,
  sanitizeUploadFilenameSegment,
  sha256HexToBase64,
  uploadFilenameSchema,
  verifyUploadedObject,
} from "./upload-verification.js";

const uploadIntentBodySchema = z.object({
  matterId: z.string().min(1),
  filename: uploadFilenameSchema,
  checksumSha256: z.string().transform(normalizeChecksumSha256),
  fileSizeBytes: z.coerce.number().transform(normalizeUploadSizeBytes),
  supersedesDocumentId: z.string().min(1).optional(),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.boolean().default(false),
});

const uploadCompleteBodySchema = z.object({
  checksumSha256: z.string().transform(normalizeChecksumSha256),
});

const documentScanStatusBodySchema = z.object({
  scanStatus: z.enum(["pending", "queued", "passed", "failed", "not_required"]),
});

const retentionHoldDecisionBodySchema = z.object({
  decision: z.enum(documentRetentionHoldReviewDecisions),
  reason: z.enum(documentRetentionHoldReviewReasons),
  reviewAfter: z.string().datetime().optional(),
  minimumRetainThrough: z.string().datetime().optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function assertMatterAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function assertManualScanOverrideAccess(context: ApiAuthContext): void {
  if (context.user.role !== "owner_admin") {
    throw new ApiHttpError(
      403,
      "SCAN_STATUS_OVERRIDE_FORBIDDEN",
      "Only owner administrators can manually override document scan status.",
    );
  }
}

function assertStaffDocumentReviewAccess(context: ApiAuthContext): void {
  if (context.user.role === "client_external") {
    throw new ApiHttpError(
      403,
      "DOCUMENT_RETENTION_REVIEW_STAFF_REQUIRED",
      "Only staff can record document retention and hold review decisions.",
    );
  }
}

function sanitizeDocumentForReview(document: DocumentRecord) {
  return {
    id: document.id,
    matterId: document.matterId,
    title: document.title,
    version: document.version,
    classification: document.classification,
    legalHold: document.legalHold,
    uploadStatus: document.uploadStatus,
    checksumStatus: document.checksumStatus,
    scanStatus: document.scanStatus,
    reviewStatus: document.reviewStatus,
    reviewDecision: document.reviewDecision,
    reviewReason: document.reviewReason,
    reviewedAt: document.reviewedAt,
    duplicateOfDocumentId: document.duplicateOfDocumentId,
    uploadedAt: document.uploadedAt,
    verifiedAt: document.verifiedAt,
  };
}

export function registerDocumentRoutes(
  server: FastifyInstance,
  { repository, s3 }: ApiRouteDependencies,
): void {
  server.get("/api/documents/presign-upload", async (_request, reply) =>
    reply.code(405).send({
      error: "MethodNotAllowed",
      message: "Use POST /api/documents/upload-intents",
    }),
  );

  server.post("/api/documents/upload-intents", async (request) => {
    const body = parseRequestPart(uploadIntentBodySchema, request.body ?? {}, "body");
    assertMatterAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: body.matterId,
    });
    if (!s3) {
      throw new ApiHttpError(
        503,
        "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
        "S3 upload signing is not configured",
      );
    }

    const documentId = crypto.randomUUID();
    const storageKey = `matters/${body.matterId}/${documentId}-${sanitizeUploadFilenameSegment(
      body.filename,
    )}`;
    const checksumSha256Base64 = sha256HexToBase64(body.checksumSha256);
    const requiredHeaders = {
      "x-amz-checksum-sha256": checksumSha256Base64,
      "x-amz-meta-open-practice-size-bytes": String(body.fileSizeBytes),
      "x-open-practice-malware-scan": "required-before-share",
      ...(s3.serverSideEncryption
        ? { "x-amz-server-side-encryption": s3.serverSideEncryption }
        : {}),
    };
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      ChecksumSHA256: checksumSha256Base64,
      ContentLength: body.fileSizeBytes,
      ...(s3.serverSideEncryption ? { ServerSideEncryption: s3.serverSideEncryption } : {}),
      Metadata: {
        "open-practice-matter-id": body.matterId,
        "open-practice-scan": "required-before-share",
        "open-practice-size-bytes": String(body.fileSizeBytes),
      },
    });
    const uploadUrl = await getSignedUrl(s3.client, command, {
      expiresIn: 600,
      unhoistableHeaders: new Set(Object.keys(requiredHeaders)),
    });
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      title: body.filename,
      storageKey,
      checksumSha256: body.checksumSha256,
      sizeBytes: body.fileSizeBytes,
      classification: body.classification,
      legalHold: body.legalHold,
      supersedesDocumentId: body.supersedesDocumentId,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.upload_intent.created",
      resourceType: "document",
      resourceId: document.id,
      metadata: {
        matterId: document.matterId,
        documentId: document.id,
        version: document.version,
        status: document.uploadStatus,
        checksumStatus: document.checksumStatus,
        scanStatus: document.scanStatus,
        sizeBytes: document.sizeBytes,
      },
    });

    return {
      method: "PUT",
      uploadUrl,
      expiresInSeconds: 600,
      storageKey,
      document,
      requiredHeaders,
      maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
    };
  });

  server.post("/api/documents/:id/upload-complete", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    if (!s3) {
      throw new ApiHttpError(
        503,
        "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
        "S3 upload signing is not configured",
      );
    }
    const body = parseRequestPart(uploadCompleteBodySchema, request.body, "body");
    await verifyUploadedObject(s3, {
      storageKey: document.storageKey,
      checksumSha256: body.checksumSha256,
      expectedSizeBytes: document.sizeBytes ?? 0,
    });
    const completed = await repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: params.id,
      checksumSha256: body.checksumSha256,
      scanStatus: "queued",
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.upload.completed",
      resourceType: "document",
      resourceId: completed.id,
      metadata: {
        matterId: completed.matterId,
        documentId: completed.id,
        version: completed.version,
        status: completed.uploadStatus,
        checksumStatus: completed.checksumStatus,
        scanStatus: completed.scanStatus,
      },
    });

    return completed;
  });

  server.post("/api/documents/:id/scan-status", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    assertManualScanOverrideAccess(request.auth);
    const body = parseRequestPart(documentScanStatusBodySchema, request.body, "body");
    const updated = await repository.updateDocumentScanStatus({
      firmId: request.auth.firmId,
      documentId: params.id,
      scanStatus: body.scanStatus,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.scan_status.updated",
      resourceType: "document",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        documentId: updated.id,
        version: updated.version,
        status: updated.uploadStatus,
        checksumStatus: updated.checksumStatus,
        scanStatus: updated.scanStatus,
      },
    });

    return updated;
  });

  server.post("/api/documents/:id/retention-hold-decisions", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(retentionHoldDecisionBodySchema, request.body ?? {}, "body");
    const document = await repository.getDocument(request.auth.firmId, params.id);
    if (!document) {
      throw Object.assign(new Error("Document was not found"), { statusCode: 404 });
    }
    assertMatterAccess(request.auth, {
      resource: "document",
      action: "update",
      matterId: document.matterId,
    });
    assertStaffDocumentReviewAccess(request.auth);

    const sameMatterDocuments = await repository.listMatterDocuments(
      request.auth.firmId,
      document.matterId,
    );
    const reviewSuggestions = buildDocumentReviewSuggestions({
      document,
      sameMatterDocuments,
    });
    const currentRetentionHoldReview = buildDocumentRetentionHoldReview({
      document,
      reviewSuggestions,
    });
    if (
      body.decision === "ready_for_reviewer_packet" &&
      currentRetentionHoldReview.blockers.length > 0
    ) {
      throw new ApiHttpError(
        409,
        "DOCUMENT_RETENTION_REVIEW_BLOCKED",
        "Document retention review is blocked by hold or integrity cues.",
      );
    }

    const recordedAt = new Date().toISOString();
    const updated = await repository.recordDocumentRetentionHoldReviewDecision({
      firmId: request.auth.firmId,
      documentId: document.id,
      decision: body.decision,
      reason: body.reason,
      reviewAfter: body.reviewAfter,
      minimumRetainThrough: body.minimumRetainThrough,
      recordedByUserId: request.auth.user.id,
      recordedAt,
      sourceCueCounts: currentRetentionHoldReview.sourceCueCounts,
    });
    const retentionHoldReview = buildDocumentRetentionHoldReview({
      document: updated,
      reviewSuggestions,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "document.retention_hold_review.recorded",
      resourceType: "document",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        documentId: updated.id,
        decision: body.decision,
        reason: body.reason,
        reviewAfterPresent: Boolean(body.reviewAfter),
        minimumRetainThroughPresent: Boolean(body.minimumRetainThrough),
        retentionHoldCueCount: retentionHoldReview.sourceCueCounts.retention_review,
        retentionPosture: retentionHoldReview.status,
        destructiveAction: false,
        retentionDeadlineEnforced: false,
        legalHoldOverride: false,
        retainedExportBody: false,
      },
    });

    return {
      document: sanitizeDocumentForReview(updated),
      retentionHoldReview,
    };
  });
}
