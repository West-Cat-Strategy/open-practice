import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { DocumentRecord, ExternalUploadLinkRecord } from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { publicTokenPolicyOptions } from "../public-token-rate-limits.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  normalizeChecksumSha256,
  normalizeUploadSizeBytes,
  sanitizeUploadFilenameSegment,
  sha256HexToBase64,
  uploadFilenameSchema,
  verifyUploadedObject,
} from "../upload-verification.js";
import {
  claimExternalUploadUse,
  externalUploadDenied,
  externalUploadLinkIdForDocument,
  linkStatus,
  readExternalUploadPublicToken,
  recordAccessLog,
  requireExternalUploadRepository,
  requireJwtSecret,
  resolvePublicLink,
} from "./shared.js";

type PublicExternalUploadRouteDependencies = Pick<ApiRouteDependencies, "repository" | "s3"> & {
  jwtSecret?: string;
};

const SIGNED_URL_EXPIRES_IN_SECONDS = 600;

const publicExternalUploadClassifications = [
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
] as const;

const publicCompleteParamsSchema = z.object({
  documentId: z.string().min(1),
});

const publicIntentBodySchema = z.object({
  filename: uploadFilenameSchema,
  checksumSha256: z.string().transform(normalizeChecksumSha256),
  fileSizeBytes: z.coerce.number().transform(normalizeUploadSizeBytes),
  classification: z.enum(publicExternalUploadClassifications).default("general"),
  legalHold: z.boolean().default(false),
});

const publicCompleteBodySchema = z.object({
  checksumSha256: z.string().transform(normalizeChecksumSha256),
});

function serializePublicLink(link: ExternalUploadLinkRecord): Record<string, unknown> {
  return {
    id: link.id,
    expiresAt: link.expiresAt,
    maxUploads: link.maxUploads,
    usedUploads: link.usedUploads,
    status: linkStatus(link),
  };
}

function serializePublicDocument(document: DocumentRecord): Record<string, unknown> {
  return {
    id: document.id,
    title: document.title,
    version: document.version,
    classification: document.classification,
    legalHold: document.legalHold,
    uploadStatus: document.uploadStatus,
    scanStatus: document.scanStatus === "failed" ? "failed" : "queued",
    reviewStatus: document.reviewStatus,
  };
}

function serializePublicCompletionDocument(document: DocumentRecord): Record<string, unknown> {
  return {
    id: document.id,
    title: document.title,
    version: document.version,
    classification: document.classification,
    legalHold: document.legalHold,
    uploadStatus: document.uploadStatus,
    scanStatus: document.scanStatus === "failed" ? "failed" : "queued",
    reviewStatus: document.reviewStatus,
  };
}

function serializePublicStatusDocument(document: DocumentRecord): Record<string, unknown> {
  return {
    id: document.id,
    title: document.title,
    version: document.version,
    classification: document.classification,
    legalHold: document.legalHold,
    uploadStatus: document.uploadStatus,
    scanStatus: document.scanStatus === "failed" ? "failed" : "queued",
    reviewStatus: document.reviewStatus,
  };
}

function activePendingExternalUploadCount(input: {
  documents: DocumentRecord[];
  linkId: string;
  now: Date;
}): number {
  const staleBefore = input.now.getTime() - SIGNED_URL_EXPIRES_IN_SECONDS * 1000;
  return input.documents.filter(
    (document) =>
      externalUploadLinkIdForDocument(document) === input.linkId &&
      document.uploadStatus === "intent_created" &&
      Date.parse(document.createdAt ?? "") > staleBefore,
  ).length;
}

async function assertExternalUploadIntentCapacity(input: {
  repository: ApiRouteDependencies["repository"];
  link: ExternalUploadLinkRecord;
  request: FastifyRequest;
}): Promise<void> {
  const documents = await input.repository.listMatterDocuments(
    input.link.firmId,
    input.link.matterId,
  );
  const pendingUploadCount = activePendingExternalUploadCount({
    documents,
    linkId: input.link.id,
    now: new Date(),
  });
  if (input.link.usedUploads + pendingUploadCount < input.link.maxUploads) return;
  await recordAccessLog(requireExternalUploadRepository(input.repository), {
    link: input.link,
    request: input.request,
    resourceType: "external_upload_link",
    resourceId: input.link.id,
    metadata: { outcome: "denied", reason: "upload_limit", pendingUploadCount },
  });
  throw externalUploadDenied();
}

export function registerPublicExternalUploadRoutes(
  server: FastifyInstance,
  { repository, s3, jwtSecret }: PublicExternalUploadRouteDependencies,
): void {
  const viewPublicExternalUpload = async (request: FastifyRequest) => {
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const signingSecret = requireJwtSecret(jwtSecret);
    const link = await resolvePublicLink(externalUploadRepository, {
      token: readExternalUploadPublicToken(request),
      jwtSecret: signingSecret,
      request,
      enforceUploadLimit: false,
    });
    const status = linkStatus(link);
    await recordAccessLog(externalUploadRepository, {
      link,
      request,
      resourceType: "external_upload_link",
      resourceId: link.id,
      metadata: { outcome: status === "active" ? "granted" : "unavailable", status },
    });
    const documents = (await repository.listMatterDocuments(link.firmId, link.matterId))
      .filter((document) => externalUploadLinkIdForDocument(document) === link.id)
      .map(serializePublicStatusDocument);

    return {
      upload: serializePublicLink(link),
      acceptedClassifications: publicExternalUploadClassifications,
      documents,
    };
  };

  const createPublicExternalUploadIntent = async (request: FastifyRequest) => {
    const body = parseRequestPart(publicIntentBodySchema, request.body, "body");
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const signingSecret = requireJwtSecret(jwtSecret);
    if (!s3) {
      throw new ApiHttpError(
        503,
        "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
        "S3 upload signing is not configured",
      );
    }

    const link = await resolvePublicLink(externalUploadRepository, {
      token: readExternalUploadPublicToken(request),
      jwtSecret: signingSecret,
      request,
      enforceUploadLimit: false,
    });
    await assertExternalUploadIntentCapacity({ repository, link, request });
    const documentId = crypto.randomUUID();
    const storageKey = `external-uploads/${link.id}/${documentId}-${sanitizeUploadFilenameSegment(
      body.filename,
    )}`;
    const checksumSha256Base64 = sha256HexToBase64(body.checksumSha256);
    const requiredHeaders = {
      "x-amz-meta-open-practice-upload-scope": "external-upload",
      "x-amz-meta-open-practice-scan": "required-before-share",
      "x-amz-meta-open-practice-size-bytes": String(body.fileSizeBytes),
      "x-amz-checksum-sha256": checksumSha256Base64,
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
        "open-practice-upload-scope": "external-upload",
        "open-practice-scan": "required-before-share",
        "open-practice-size-bytes": String(body.fileSizeBytes),
      },
    });
    const uploadUrl = await getSignedUrl(s3.client, command, {
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
      unhoistableHeaders: new Set(Object.keys(requiredHeaders)),
    });
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: link.firmId,
      matterId: link.matterId,
      title: body.filename,
      storageKey,
      checksumSha256: body.checksumSha256,
      sizeBytes: body.fileSizeBytes,
      classification: body.classification,
      legalHold: body.legalHold,
      reviewStatus: "pending_review",
      externalUploadLinkId: link.id,
    });
    await recordAccessLog(externalUploadRepository, {
      link,
      request,
      resourceType: "document",
      resourceId: document.id,
      metadata: { outcome: "intent_created" },
    });

    return {
      method: "PUT",
      uploadUrl,
      expiresInSeconds: SIGNED_URL_EXPIRES_IN_SECONDS,
      document: serializePublicDocument(document),
      requiredHeaders,
      maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
    };
  };

  const completePublicExternalUpload = async (request: FastifyRequest) => {
    const params = parseRequestPart(publicCompleteParamsSchema, request.params, "params");
    const body = parseRequestPart(publicCompleteBodySchema, request.body, "body");
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const signingSecret = requireJwtSecret(jwtSecret);
    const link = await resolvePublicLink(externalUploadRepository, {
      token: readExternalUploadPublicToken(request),
      jwtSecret: signingSecret,
      request,
      enforceUploadLimit: false,
    });
    const document = await repository.getDocument(link.firmId, params.documentId);
    if (
      !document ||
      document.matterId !== link.matterId ||
      !document.storageKey.startsWith(`external-uploads/${link.id}/`)
    ) {
      await recordAccessLog(externalUploadRepository, {
        link,
        request,
        resourceType: "document",
        resourceId: params.documentId,
        metadata: { outcome: "denied", reason: "document_scope" },
      });
      throw externalUploadDenied();
    }
    if (document.uploadStatus !== "intent_created") {
      await recordAccessLog(externalUploadRepository, {
        link,
        request,
        resourceType: "document",
        resourceId: params.documentId,
        metadata: { outcome: "denied", reason: "upload_already_completed" },
      });
      throw externalUploadDenied();
    }
    if (!s3) {
      throw new ApiHttpError(
        503,
        "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
        "S3 upload signing is not configured",
      );
    }
    await verifyUploadedObject(s3, {
      storageKey: document.storageKey,
      checksumSha256: body.checksumSha256,
      expectedSizeBytes: document.sizeBytes ?? 0,
    });

    if (body.checksumSha256 !== document.checksumSha256) {
      const rejected = await repository.completeDocumentUpload({
        firmId: link.firmId,
        documentId: params.documentId,
        checksumSha256: body.checksumSha256,
        scanStatus: "failed",
      });
      await recordAccessLog(externalUploadRepository, {
        link,
        request,
        resourceType: "document",
        resourceId: rejected.id,
        metadata: { outcome: rejected.uploadStatus, reason: "checksum_mismatch" },
      });
      return {
        document: serializePublicCompletionDocument(rejected),
      };
    }

    const claimed = await claimExternalUploadUse(externalUploadRepository, {
      firmId: link.firmId,
      id: link.id,
      usedAt: new Date().toISOString(),
    });
    if (!claimed) {
      await recordAccessLog(externalUploadRepository, {
        link,
        request,
        resourceType: "external_upload_link",
        resourceId: link.id,
        metadata: { outcome: "denied", reason: "upload_limit" },
      });
      throw externalUploadDenied();
    }

    const completed = await repository.completeDocumentUpload({
      firmId: link.firmId,
      documentId: params.documentId,
      checksumSha256: body.checksumSha256,
      scanStatus: "queued",
    });
    await recordAccessLog(externalUploadRepository, {
      link,
      request,
      resourceType: "document",
      resourceId: completed.id,
      metadata: { outcome: completed.uploadStatus },
    });

    return {
      document: serializePublicCompletionDocument(completed),
    };
  };

  server.get(
    "/api/portal/external-uploads",
    publicTokenPolicyOptions("external-upload", "view"),
    viewPublicExternalUpload,
  );
  server.get(
    "/api/portal/external-uploads/:token",
    publicTokenPolicyOptions("external-upload", "view"),
    viewPublicExternalUpload,
  );
  server.post(
    "/api/portal/external-uploads/intents",
    publicTokenPolicyOptions("external-upload", "upload-intent"),
    createPublicExternalUploadIntent,
  );
  server.post(
    "/api/portal/external-uploads/:token/intents",
    publicTokenPolicyOptions("external-upload", "upload-intent"),
    createPublicExternalUploadIntent,
  );
  server.post(
    "/api/portal/external-uploads/documents/:documentId/complete",
    publicTokenPolicyOptions("external-upload", "mutation"),
    completePublicExternalUpload,
  );
  server.post(
    "/api/portal/external-uploads/:token/documents/:documentId/complete",
    publicTokenPolicyOptions("external-upload", "mutation"),
    completePublicExternalUpload,
  );
}
