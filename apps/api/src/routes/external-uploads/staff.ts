import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canAccess,
  type AccessRequest,
  type DocumentRecord,
  type ExternalUploadLinkRecord,
} from "@open-practice/domain";
import { createSessionToken, hashToken } from "../../http/auth-helpers.js";
import { requireAccess } from "../../http/auth-guards.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { appendWorkflowAuditEvent } from "../audit-events.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "../delivery-confirmation.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "../idempotency.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  type ExternalUploadRepository,
  externalUploadLinkIdForDocument,
  linkStatus,
  recordAccessLog,
  requireExternalUploadRepository,
  requireJwtSecret,
  revokeExternalUploadLink,
} from "./shared.js";

const externalUploadsQuerySchema = z.object({
  matterId: z.string().min(1),
});

const createExternalUploadBodySchema = z.object({
  matterId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  maxUploads: z.coerce.number().int().positive().default(1),
  notificationEmail: z.string().email().optional(),
  idempotencyKey: z.string().min(8).max(180).optional(),
  deliveryConfirmation: deliveryConfirmationSchema.optional(),
});

const externalUploadIdParamsSchema = z.object({ id: z.string().min(1) });

const externalUploadDocumentParamsSchema = z.object({ documentId: z.string().min(1) });

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

function canExternalUploadAction(
  context: ApiAuthContext,
  action: AccessRequest["action"],
): boolean {
  return canAccess({
    user: context.user,
    firmId: context.firmId,
    resource: "external_upload",
    action,
    matterId: context.user.assignedMatterIds[0],
  });
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
    idempotencyKeyPresent: Boolean(link.idempotencyKey),
    createdAt: link.createdAt,
    revokedAt: link.revokedAt,
    status: linkStatus(link),
  };
}

function defaultExpiry(now: Date): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
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

export function buildExternalUploadsStatus({
  s3,
  jwtSecret,
  auth,
}: Pick<ApiRouteDependencies, "s3"> & { jwtSecret?: string; auth?: ApiAuthContext }) {
  const configured = Boolean(s3 && jwtSecret);
  return {
    status: configured ? "available" : "not_configured",
    reason: !s3 ? "s3_not_configured" : jwtSecret ? undefined : "token_signing_not_configured",
    provider: s3 ? "s3" : undefined,
    tokenSigning: jwtSecret ? "configured" : "not_configured",
    s3: s3 ? "configured" : "not_configured",
    canCreate: configured && (auth ? canExternalUploadAction(auth, "create") : true),
    canManage: auth
      ? canExternalUploadAction(auth, "update") || canExternalUploadAction(auth, "delete")
      : configured,
  };
}

export function registerStaffExternalUploadRoutes(
  server: FastifyInstance,
  { repository, s3, jwtSecret, emailJobQueue }: ApiRouteDependencies & { jwtSecret?: string },
): void {
  server.get("/api/external-uploads/status", async (request) => {
    assertExternalUploadAccess(request.auth, { resource: "provider_setting", action: "read" });
    return buildExternalUploadsStatus({ s3, jwtSecret, auth: request.auth });
  });

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
      throw new ApiHttpError(
        503,
        "S3_UPLOAD_SIGNING_NOT_CONFIGURED",
        "S3 upload signing is not configured",
      );
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
    if (body.notificationEmail) {
      requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    }

    const linkId = crypto.randomUUID();
    const token = createSessionToken();
    const idempotencyKey = body.idempotencyKey?.trim();
    let link: ExternalUploadLinkRecord;
    try {
      link = await externalUploadRepository.createExternalUploadLink({
        id: linkId,
        firmId: request.auth.firmId,
        matterId: body.matterId,
        tokenHash: hashToken(token, signingSecret),
        idempotencyKey,
        requestedByUserId: request.auth.user.id,
        expiresAt,
        maxUploads: body.maxUploads,
        usedUploads: 0,
        createdAt: now.toISOString(),
      });
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    const created = link.id === linkId;
    if (created)
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
          idempotencyKeyPresent: true,
        },
      });
    const queuedEmail =
      created && body.notificationEmail
        ? await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
            matterId: link.matterId,
            templateKey: "external_upload.created",
            to: [body.notificationEmail],
            subject: "Document upload link",
            textBody: `A document upload link is available. Upload token: ${token}`,
            relatedResourceType: "external_upload",
            relatedResourceId: link.id,
            idempotencyKey: buildIdempotencyKey({
              scope: "email",
              firmId: request.auth.firmId,
              matterId: link.matterId,
              resourceType: "external_upload",
              resourceId: link.id,
              action: "external_upload.created",
              providerOrTemplate: "external_upload.created",
            }),
            metadata: {
              ...idempotencyMetadata({
                externalUploadLinkId: link.id,
                matterId: link.matterId,
                expiresAt: link.expiresAt,
                maxUploads: link.maxUploads,
                notificationEmailPresent: true,
              }),
              expiresAt: link.expiresAt,
              maxUploads: link.maxUploads,
            },
          })
        : undefined;

    return {
      upload: serializeLink(link),
      token: created ? token : undefined,
      created,
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
    await appendWorkflowAuditEvent(repository, request.auth, {
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
      workflow: {
        requestId: request.id,
        matterIds: [reviewed.matterId],
        status: "succeeded",
      },
    });

    return { reviewItem: await serializeReviewItem(externalUploadRepository, reviewed) };
  });
}
