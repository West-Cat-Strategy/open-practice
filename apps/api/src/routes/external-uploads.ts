import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type {
  AccessLogRecord,
  AccessRequest,
  DocumentRecord,
  ExternalUploadLinkRecord,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const SIGNED_URL_EXPIRES_IN_SECONDS = 600;

type ExternalUploadRepository = ApiRouteDependencies["repository"] & {
  listExternalUploadLinks: (
    firmId: string,
    options?: { matterId?: string },
  ) => Promise<ExternalUploadLinkRecord[]>;
  createExternalUploadLink: (input: ExternalUploadLinkRecord) => Promise<ExternalUploadLinkRecord>;
  getExternalUploadLinkByTokenHash: (
    tokenHash: string,
  ) => Promise<ExternalUploadLinkRecord | undefined>;
  revokeExternalUploadLink: (...args: unknown[]) => Promise<ExternalUploadLinkRecord | undefined>;
  claimExternalUploadUse: (...args: unknown[]) => Promise<ExternalUploadLinkRecord | undefined>;
  createAccessLog?: (input: AccessLogRecord) => Promise<AccessLogRecord>;
};

const externalUploadsQuerySchema = z.object({
  matterId: z.string().min(1),
});

const createExternalUploadBodySchema = z.object({
  matterId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  maxUploads: z.coerce.number().int().positive().default(1),
  notificationEmail: z.string().email().optional(),
});

const externalUploadIdParamsSchema = z.object({ id: z.string().min(1) });

const externalUploadDocumentParamsSchema = z.object({ documentId: z.string().min(1) });

const publicTokenParamsSchema = z.object({ token: z.string().min(1) });

const publicCompleteParamsSchema = z.object({
  token: z.string().min(1),
  documentId: z.string().min(1),
});

const publicIntentBodySchema = z.object({
  filename: z.string().min(1),
  checksumSha256: z.string().min(16),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.coerce.boolean().default(false),
});

const publicCompleteBodySchema = z.object({
  checksumSha256: z.string().min(16),
});

const reviewDecisionSchema = z.enum(["accept", "request_metadata", "request_retry", "discard"]);

const reviewReasonSchema = z.enum([
  "duplicate",
  "missing_metadata",
  "checksum_mismatch",
  "scan_failed",
  "wrong_matter",
  "unreadable",
  "other",
]);

const reviewBodySchema = z.object({
  decision: reviewDecisionSchema,
  reason: reviewReasonSchema.optional(),
  duplicateOfDocumentId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
});

function assertExternalUploadAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function isExternalUploadRepository(
  repository: ApiRouteDependencies["repository"],
): repository is ExternalUploadRepository {
  const candidate = repository as Partial<ExternalUploadRepository>;
  return (
    typeof candidate.listExternalUploadLinks === "function" &&
    typeof candidate.createExternalUploadLink === "function" &&
    typeof candidate.getExternalUploadLinkByTokenHash === "function" &&
    typeof candidate.revokeExternalUploadLink === "function" &&
    typeof candidate.claimExternalUploadUse === "function"
  );
}

function requireExternalUploadRepository(
  repository: ApiRouteDependencies["repository"],
): ExternalUploadRepository {
  if (!isExternalUploadRepository(repository)) {
    throw Object.assign(new Error("External upload repository is not configured"), {
      statusCode: 503,
    });
  }
  return repository;
}

function requireJwtSecret(jwtSecret?: string): string {
  if (!jwtSecret) {
    throw Object.assign(new Error("External upload token signing is not configured"), {
      statusCode: 503,
    });
  }
  return jwtSecret;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function linkStatus(link: ExternalUploadLinkRecord, now = new Date()): string {
  if (link.revokedAt) return "revoked";
  if (Date.parse(link.expiresAt) <= now.getTime()) return "expired";
  if (link.usedUploads >= link.maxUploads) return "exhausted";
  return "active";
}

function serializeLink(link: ExternalUploadLinkRecord): Record<string, unknown> {
  return {
    id: link.id,
    firmId: link.firmId,
    matterId: link.matterId,
    requestedByUserId: link.requestedByUserId,
    expiresAt: link.expiresAt,
    maxUploads: link.maxUploads,
    usedUploads: link.usedUploads,
    createdAt: link.createdAt,
    revokedAt: link.revokedAt,
    status: linkStatus(link),
  };
}

function defaultExpiry(now: Date): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function serializePublicDocument(document: DocumentRecord): Record<string, unknown> {
  return {
    id: document.id,
    title: document.title,
    version: document.version,
    classification: document.classification,
    legalHold: document.legalHold,
    uploadStatus: document.uploadStatus,
    checksumStatus: document.checksumStatus,
    scanStatus: document.scanStatus,
    reviewStatus: document.reviewStatus,
    reviewReason: document.reviewReason,
  };
}

function externalUploadLinkIdForDocument(document: DocumentRecord): string | undefined {
  if (document.externalUploadLinkId) return document.externalUploadLinkId;
  const [, linkId] = document.storageKey.match(/^external-uploads\/([^/]+)\//) ?? [];
  return linkId;
}

async function serializeReviewItem(
  repository: ExternalUploadRepository,
  document: DocumentRecord,
): Promise<Record<string, unknown>> {
  const accessLogs = await repository.listAccessLogs(document.firmId, {
    resourceType: "document",
    resourceId: document.id,
  });
  const outcomes = [
    ...new Set(
      accessLogs
        .map((log) => log.metadata.outcome)
        .filter((outcome): outcome is string => typeof outcome === "string"),
    ),
  ];
  return {
    id: document.id,
    matterId: document.matterId,
    externalUploadLinkId: externalUploadLinkIdForDocument(document),
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
    reviewMetadata: document.reviewMetadata,
    reviewedByUserId: document.reviewedByUserId,
    reviewedAt: document.reviewedAt,
    duplicateOfDocumentId: document.duplicateOfDocumentId,
    uploadedAt: document.uploadedAt,
    verifiedAt: document.verifiedAt,
    accessLogProof: {
      total: accessLogs.length,
      latestAt: accessLogs[0]?.occurredAt,
      outcomes,
    },
  };
}

function sanitizeReviewNote(note?: string): string | undefined {
  const sanitized = note
    ?.replaceAll(/./gs, (character) =>
      character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127 ? " " : character,
    )
    .replace(/\s+/g, " ")
    .trim();
  return sanitized ? sanitized.slice(0, 240) : undefined;
}

function reviewStatusForDecision(
  decision: z.infer<typeof reviewDecisionSchema>,
): DocumentRecord["reviewStatus"] {
  if (decision === "accept") return "accepted";
  if (decision === "request_metadata") return "needs_metadata";
  if (decision === "request_retry") return "retry_requested";
  return "discarded";
}

function reviewReasonForDecision(input: {
  decision: z.infer<typeof reviewDecisionSchema>;
  reason?: z.infer<typeof reviewReasonSchema>;
}): DocumentRecord["reviewReason"] | undefined {
  if (input.reason) return input.reason;
  if (input.decision === "request_metadata") return "missing_metadata";
  if (input.decision === "request_retry") return "other";
  if (input.decision === "discard") return "other";
  return undefined;
}

function unavailableLinkReason(
  link: ExternalUploadLinkRecord,
  options: { enforceUploadLimit: boolean },
): string | undefined {
  if (link.revokedAt) return "revoked";
  if (Date.parse(link.expiresAt) <= Date.now()) return "expired";
  if (options.enforceUploadLimit && link.usedUploads >= link.maxUploads) return "upload_limit";
  return undefined;
}

function externalUploadDenied(): ApiHttpError {
  return new ApiHttpError(
    403,
    "EXTERNAL_UPLOAD_LINK_UNAVAILABLE",
    "External upload link is not available",
  );
}

function requestUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value.join(", ") : value;
}

async function recordAccessLog(
  repository: ExternalUploadRepository,
  input: {
    link: ExternalUploadLinkRecord;
    request: FastifyRequest;
    resourceType: string;
    resourceId: string;
    metadata: Record<string, unknown>;
    actorId?: string;
  },
): Promise<void> {
  if (!repository.createAccessLog) return;
  await repository.createAccessLog({
    id: crypto.randomUUID(),
    firmId: input.link.firmId,
    actorId: input.actorId,
    externalUploadLinkId: input.link.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: "upload",
    occurredAt: new Date().toISOString(),
    ipAddress: input.request.ip,
    userAgent: requestUserAgent(input.request),
    metadata: input.metadata,
  });
}

async function revokeExternalUploadLink(
  repository: ExternalUploadRepository,
  input: { firmId: string; id: string; revokedAt: string },
): Promise<ExternalUploadLinkRecord | undefined> {
  if (repository.revokeExternalUploadLink.length >= 3) {
    return repository.revokeExternalUploadLink(input.firmId, input.id, input.revokedAt);
  }
  return repository.revokeExternalUploadLink(input);
}

async function claimExternalUploadUse(
  repository: ExternalUploadRepository,
  input: { firmId: string; id: string; usedAt: string },
): Promise<ExternalUploadLinkRecord | undefined> {
  if (repository.claimExternalUploadUse.length >= 3) {
    return repository.claimExternalUploadUse(input.firmId, input.id, input.usedAt);
  }
  return repository.claimExternalUploadUse(input);
}

async function resolvePublicLink(
  repository: ExternalUploadRepository,
  input: {
    token: string;
    jwtSecret: string;
    request: FastifyRequest;
    enforceUploadLimit: boolean;
  },
): Promise<ExternalUploadLinkRecord> {
  const link = await repository.getExternalUploadLinkByTokenHash(
    hashToken(input.token, input.jwtSecret),
  );

  if (!link) {
    throw externalUploadDenied();
  }

  const reason = unavailableLinkReason(link, { enforceUploadLimit: input.enforceUploadLimit });
  if (reason) {
    await recordAccessLog(repository, {
      link,
      request: input.request,
      resourceType: "external_upload_link",
      resourceId: link.id,
      metadata: { outcome: "denied", reason },
    });
    throw externalUploadDenied();
  }

  return link;
}

export function registerExternalUploadRoutes(
  server: FastifyInstance,
  { repository, s3, jwtSecret, emailJobQueue }: ApiRouteDependencies & { jwtSecret?: string },
): void {
  server.get("/api/external-uploads/status", async () => ({
    status: s3 && jwtSecret ? "available" : "not_configured",
    reason: !s3 ? "s3_not_configured" : jwtSecret ? undefined : "token_signing_not_configured",
    provider: s3 ? "s3" : undefined,
    tokenSigning: jwtSecret ? "configured" : "not_configured",
    s3: s3 ? "configured" : "not_configured",
  }));

  server.get("/api/external-uploads", async (request) => {
    const query = parseRequestPart(externalUploadsQuerySchema, request.query, "query");
    assertExternalUploadAccess(request.auth, {
      resource: "external_upload",
      action: "read",
      matterId: query.matterId,
    });

    const externalUploadRepository = requireExternalUploadRepository(repository);
    const links = await externalUploadRepository.listExternalUploadLinks(request.auth.firmId, {
      matterId: query.matterId,
    });
    const linkIds = new Set(links.map((link) => link.id));
    const reviewItems = await Promise.all(
      (await repository.listMatterDocuments(request.auth.firmId, query.matterId))
        .filter((document) => {
          const linkId = externalUploadLinkIdForDocument(document);
          return linkId ? linkIds.has(linkId) : false;
        })
        .map((document) => serializeReviewItem(externalUploadRepository, document)),
    );
    return { uploads: links.map(serializeLink), reviewItems };
  });

  server.post("/api/external-uploads", async (request) => {
    const body = parseRequestPart(createExternalUploadBodySchema, request.body, "body");
    assertExternalUploadAccess(request.auth, {
      resource: "external_upload",
      action: "create",
      matterId: body.matterId,
    });
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const signingSecret = requireJwtSecret(jwtSecret);
    if (!s3) {
      throw Object.assign(new Error("S3 upload signing is not configured"), { statusCode: 503 });
    }
    const now = new Date();
    const expiresAt = body.expiresAt ?? defaultExpiry(now);
    if (Date.parse(expiresAt) <= now.getTime()) {
      throw new ApiHttpError(
        400,
        "INVALID_EXTERNAL_UPLOAD_EXPIRY",
        "expiresAt must be in the future",
      );
    }

    const linkId = crypto.randomUUID();
    const token = createSessionToken();
    const link = await externalUploadRepository.createExternalUploadLink({
      id: linkId,
      firmId: request.auth.firmId,
      matterId: body.matterId,
      tokenHash: hashToken(token, signingSecret),
      requestedByUserId: request.auth.user.id,
      expiresAt,
      maxUploads: body.maxUploads,
      usedUploads: 0,
      createdAt: now.toISOString(),
    });
    await repository.appendAuditEvent({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "external_upload.created",
      resourceType: "external_upload",
      resourceId: link.id,
      occurredAt: now.toISOString(),
      metadata: {
        matterId: link.matterId,
        expiresAt: link.expiresAt,
        maxUploads: link.maxUploads,
      },
    });
    const queuedEmail = body.notificationEmail
      ? await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
          matterId: link.matterId,
          templateKey: "external_upload.created",
          to: [body.notificationEmail],
          subject: "Document upload link",
          textBody: `A document upload link is available. Upload token: ${token}`,
          relatedResourceType: "external_upload",
          relatedResourceId: link.id,
          metadata: {
            expiresAt: link.expiresAt,
            maxUploads: link.maxUploads,
          },
        })
      : undefined;

    return {
      upload: serializeLink(link),
      token,
      queuedEmail: summarizeQueuedRouteEmail(queuedEmail),
    };
  });

  server.post("/api/external-uploads/:id/revoke", async (request) => {
    const params = parseRequestPart(externalUploadIdParamsSchema, request.params, "params");
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const links = await externalUploadRepository.listExternalUploadLinks(request.auth.firmId);
    const existing = links.find((link) => link.id === params.id);
    if (!existing) {
      throw Object.assign(new Error("External upload link was not found"), { statusCode: 404 });
    }
    assertExternalUploadAccess(request.auth, {
      resource: "external_upload",
      action: "delete",
      matterId: existing.matterId,
    });

    const revoked = await revokeExternalUploadLink(externalUploadRepository, {
      firmId: request.auth.firmId,
      id: params.id,
      revokedAt: new Date().toISOString(),
    });
    if (!revoked) {
      throw Object.assign(new Error("External upload link was not found"), { statusCode: 404 });
    }
    await repository.appendAuditEvent({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "external_upload.revoked",
      resourceType: "external_upload",
      resourceId: revoked.id,
      occurredAt: revoked.revokedAt ?? new Date().toISOString(),
      metadata: { matterId: revoked.matterId },
    });
    return { upload: serializeLink(revoked) };
  });

  server.patch("/api/external-uploads/documents/:documentId/review", async (request) => {
    const params = parseRequestPart(externalUploadDocumentParamsSchema, request.params, "params");
    const body = parseRequestPart(reviewBodySchema, request.body, "body");
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const document = await repository.getDocument(request.auth.firmId, params.documentId);
    const externalUploadLinkId = document ? externalUploadLinkIdForDocument(document) : undefined;
    if (!document || !externalUploadLinkId) {
      throw Object.assign(new Error("External upload document was not found"), {
        statusCode: 404,
      });
    }

    const links = await externalUploadRepository.listExternalUploadLinks(request.auth.firmId, {
      matterId: document.matterId,
    });
    const link = links.find((candidate) => candidate.id === externalUploadLinkId);
    if (!link) {
      throw Object.assign(new Error("External upload document was not found"), {
        statusCode: 404,
      });
    }

    assertExternalUploadAccess(request.auth, {
      resource: "external_upload",
      action: "update",
      matterId: document.matterId,
    });

    const duplicateOfDocumentId = body.duplicateOfDocumentId ?? document.duplicateOfDocumentId;
    if (duplicateOfDocumentId) {
      const duplicate = await repository.getDocument(request.auth.firmId, duplicateOfDocumentId);
      if (!duplicate || duplicate.matterId !== document.matterId || duplicate.id === document.id) {
        throw new ApiHttpError(
          400,
          "INVALID_EXTERNAL_UPLOAD_REVIEW_DUPLICATE",
          "Duplicate document must belong to the same matter",
        );
      }
    }

    const reviewedAt = new Date().toISOString();
    const status = reviewStatusForDecision(body.decision);
    const reason =
      reviewReasonForDecision({ decision: body.decision, reason: body.reason }) ??
      document.reviewReason;
    const sanitizedNote = sanitizeReviewNote(body.note);
    const metadata = {
      decision: body.decision,
      status,
      ...(reason ? { reason } : {}),
      ...(duplicateOfDocumentId ? { duplicateOfDocumentId } : {}),
      ...(sanitizedNote ? { note: sanitizedNote } : {}),
    };
    const reviewed = await repository.reviewUploadedDocument({
      firmId: request.auth.firmId,
      documentId: document.id,
      status,
      decision: body.decision,
      reason,
      metadata,
      reviewedByUserId: request.auth.user.id,
      reviewedAt,
    });

    await recordAccessLog(externalUploadRepository, {
      link,
      request,
      actorId: request.auth.user.id,
      resourceType: "document",
      resourceId: reviewed.id,
      metadata: {
        outcome: "document_reviewed",
        decision: body.decision,
        status,
        ...(reason ? { reason } : {}),
      },
    });
    await repository.appendAuditEvent({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "external_upload.document_reviewed",
      resourceType: "document",
      resourceId: reviewed.id,
      occurredAt: reviewedAt,
      metadata: {
        matterId: reviewed.matterId,
        externalUploadLinkId: link.id,
        decision: body.decision,
        status,
        ...(reason ? { reason } : {}),
        ...(duplicateOfDocumentId ? { duplicateOfDocumentId } : {}),
        ...(sanitizedNote ? { noteLength: sanitizedNote.length } : {}),
      },
    });

    return { reviewItem: await serializeReviewItem(externalUploadRepository, reviewed) };
  });

  server.post("/api/portal/external-uploads/:token/intents", async (request) => {
    const params = parseRequestPart(publicTokenParamsSchema, request.params, "params");
    const body = parseRequestPart(publicIntentBodySchema, request.body, "body");
    const externalUploadRepository = requireExternalUploadRepository(repository);
    const signingSecret = requireJwtSecret(jwtSecret);
    if (!s3) {
      throw Object.assign(new Error("S3 upload signing is not configured"), { statusCode: 503 });
    }

    const link = await resolvePublicLink(externalUploadRepository, {
      token: params.token,
      jwtSecret: signingSecret,
      request,
      enforceUploadLimit: true,
    });
    const documentId = crypto.randomUUID();
    const storageKey = `external-uploads/${link.id}/${documentId}-${sanitizeFilename(body.filename)}`;
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      ChecksumSHA256: body.checksumSha256,
      Metadata: {
        "open-practice-upload-scope": "external-upload",
        "open-practice-scan": "required-before-share",
      },
    });
    const uploadUrl = await getSignedUrl(s3.client, command, {
      expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS,
    });
    const document = await repository.createDocumentUploadIntent({
      id: documentId,
      firmId: link.firmId,
      matterId: link.matterId,
      title: body.filename,
      storageKey,
      checksumSha256: body.checksumSha256,
      classification: body.classification,
      legalHold: body.legalHold,
      reviewStatus: "pending_review",
      externalUploadLinkId: link.id,
    });
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
      requiredHeaders: {
        "x-open-practice-malware-scan": "required-before-share",
      },
    };
  });

  server.post(
    "/api/portal/external-uploads/:token/documents/:documentId/complete",
    async (request) => {
      const params = parseRequestPart(publicCompleteParamsSchema, request.params, "params");
      const body = parseRequestPart(publicCompleteBodySchema, request.body, "body");
      const externalUploadRepository = requireExternalUploadRepository(repository);
      const signingSecret = requireJwtSecret(jwtSecret);
      const link = await resolvePublicLink(externalUploadRepository, {
        token: params.token,
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
        document: serializePublicDocument(completed),
      };
    },
  );
}
