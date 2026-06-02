import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
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
  sha256HexToBase64,
  verifyUploadedObject,
} from "./upload-verification.js";

const presignQuerySchema = z.object({
  matterId: z.string().min(1),
  filename: z.string().min(1),
  checksumSha256: z.string().transform(normalizeChecksumSha256),
  fileSizeBytes: z.coerce.number().transform(normalizeUploadSizeBytes),
  supersedesDocumentId: z.string().min(1).optional(),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.coerce.boolean().default(false),
});

const uploadCompleteBodySchema = z.object({
  checksumSha256: z.string().transform(normalizeChecksumSha256),
});

const documentScanStatusBodySchema = z.object({
  scanStatus: z.enum(["pending", "queued", "passed", "failed", "not_required"]),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

export function registerDocumentRoutes(
  server: FastifyInstance,
  { repository, s3 }: ApiRouteDependencies,
): void {
  server.get("/api/documents/presign-upload", async (request) => {
    const query = parseRequestPart(presignQuerySchema, request.query, "query");
    assertMatterAccess(request.auth, {
      resource: "document",
      action: "create",
      matterId: query.matterId,
    });
    if (!s3) {
      throw new ApiHttpError(
        503,
        "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
        "S3 upload signing is not configured",
      );
    }

    const documentId = crypto.randomUUID();
    const storageKey = `matters/${query.matterId}/${documentId}-${sanitizeFilename(query.filename)}`;
    const checksumSha256Base64 = sha256HexToBase64(query.checksumSha256);
    const requiredHeaders = {
      "x-amz-checksum-sha256": checksumSha256Base64,
      "x-amz-meta-open-practice-size-bytes": String(query.fileSizeBytes),
      "x-open-practice-malware-scan": "required-before-share",
    };
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      ChecksumSHA256: checksumSha256Base64,
      ContentLength: query.fileSizeBytes,
      Metadata: {
        "open-practice-matter-id": query.matterId,
        "open-practice-scan": "required-before-share",
        "open-practice-size-bytes": String(query.fileSizeBytes),
      },
    });
    const uploadUrl = await getSignedUrl(s3.client, command, {
      expiresIn: 600,
      unhoistableHeaders: new Set(Object.keys(requiredHeaders)),
    });
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: query.matterId,
      title: query.filename,
      storageKey,
      checksumSha256: query.checksumSha256,
      sizeBytes: query.fileSizeBytes,
      classification: query.classification,
      legalHold: query.legalHold,
      supersedesDocumentId: query.supersedesDocumentId,
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
}
