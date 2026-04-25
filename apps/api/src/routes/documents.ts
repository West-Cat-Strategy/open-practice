import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireMatterAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import type { ApiRouteDependencies } from "./types.js";

const presignQuerySchema = z.object({
  matterId: z.string().min(1),
  filename: z.string().min(1),
  checksumSha256: z.string().min(16).default("pending-client-checksum"),
  supersedesDocumentId: z.string().min(1).optional(),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.coerce.boolean().default(false),
});

const uploadCompleteBodySchema = z.object({
  checksumSha256: z.string().min(16),
  scanStatus: z.enum(["pending", "queued", "passed", "failed", "not_required"]).default("queued"),
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
  const access = requireMatterAccess(context, request);
  if (!access.ok) throw access.error;
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
      throw Object.assign(new Error("S3 upload signing is not configured"), { statusCode: 503 });
    }

    const documentId = crypto.randomUUID();
    const storageKey = `matters/${query.matterId}/${documentId}-${sanitizeFilename(query.filename)}`;
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      ChecksumSHA256:
        query.checksumSha256 === "pending-client-checksum" ? undefined : query.checksumSha256,
      Metadata: {
        "open-practice-matter-id": query.matterId,
        "open-practice-scan": "required-before-share",
      },
    });
    const uploadUrl = await getSignedUrl(s3.client, command, { expiresIn: 600 });
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: request.auth.firmId,
      matterId: query.matterId,
      title: query.filename,
      storageKey,
      checksumSha256: query.checksumSha256,
      classification: query.classification,
      legalHold: query.legalHold,
      supersedesDocumentId: query.supersedesDocumentId,
    });

    return {
      method: "PUT",
      uploadUrl,
      expiresInSeconds: 600,
      storageKey,
      document,
      requiredHeaders: {
        "x-open-practice-malware-scan": "required-before-share",
      },
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
    const body = parseRequestPart(uploadCompleteBodySchema, request.body, "body");
    return repository.completeDocumentUpload({
      firmId: request.auth.firmId,
      documentId: params.id,
      checksumSha256: body.checksumSha256,
      scanStatus: body.scanStatus,
    });
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
    const body = parseRequestPart(documentScanStatusBodySchema, request.body, "body");
    return repository.updateDocumentScanStatus({
      firmId: request.auth.firmId,
      documentId: params.id,
      scanStatus: body.scanStatus,
    });
  });
}
