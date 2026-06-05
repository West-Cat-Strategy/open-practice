import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canShareDocumentThroughPortal,
  type AccessLogRecord,
  type AccessRequest,
  type DocumentRecord,
  type PortalGrant,
  type ShareLinkRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { createSessionToken, hashToken } from "../http/auth-helpers.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import {
  deliveryConfirmationSchema,
  requireEmailDeliveryConfirmation,
} from "./delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "./outbound-email.js";
import { publicTokenPolicyOptions } from "./public-token-rate-limits.js";
import type { ApiRouteDependencies } from "./types.js";

const sharePermissionSchema = z.literal("view_documents");

const sharesQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const createShareBodySchema = z
  .object({
    matterId: z.string().min(1),
    permissions: z.array(sharePermissionSchema).nonempty().default(["view_documents"]),
    expiresAt: z.string().datetime().optional(),
    requireEmailVerification: z.boolean().default(false),
    notificationEmail: z.string().email().optional(),
    deliveryConfirmation: deliveryConfirmationSchema.optional(),
  })
  .superRefine((body, context) => {
    if (body.requireEmailVerification && !body.notificationEmail) {
      context.addIssue({
        code: "custom",
        path: ["notificationEmail"],
        message: "notificationEmail is required when email verification is required",
      });
    }
  });

const shareEmailVerificationBodySchema = z.object({
  verificationCode: z.string().min(6).max(128),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const tokenParamsSchema = z.object({ token: z.string().min(32) });
const SHARE_EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

type RegisterShareRouteOptions = ApiRouteDependencies & {
  jwtSecret?: string;
};

type PublicDocument = Pick<
  DocumentRecord,
  "id" | "matterId" | "title" | "classification" | "version" | "uploadedAt" | "verifiedAt"
>;

type PublicShare = Pick<
  ShareLinkRecord,
  "id" | "permissions" | "expiresAt" | "requireEmailVerification" | "createdAt"
>;

function assertShareAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function sanitizeShare(link: ShareLinkRecord): Omit<ShareLinkRecord, "tokenHash"> {
  return {
    id: link.id,
    firmId: link.firmId,
    matterId: link.matterId,
    grantedByUserId: link.grantedByUserId,
    permissions: link.permissions,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    requireEmailVerification: link.requireEmailVerification,
    createdAt: link.createdAt,
  };
}

function publicShare(link: ShareLinkRecord): PublicShare {
  return {
    id: link.id,
    permissions: link.permissions,
    expiresAt: link.expiresAt,
    requireEmailVerification: link.requireEmailVerification,
    createdAt: link.createdAt,
  };
}

function publicDocument(document: DocumentRecord): PublicDocument {
  return {
    id: document.id,
    matterId: document.matterId,
    title: document.title,
    classification: document.classification,
    version: document.version,
    uploadedAt: document.uploadedAt,
    verifiedAt: document.verifiedAt,
  };
}

function createShareVerificationCode(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function normalizeShareVerificationCode(code: string): string {
  return code.trim().toUpperCase();
}

function shareVerificationExpiresAt(createdAt: Date, shareExpiresAt: string): string {
  const verificationExpiry = createdAt.getTime() + SHARE_EMAIL_VERIFICATION_TTL_MS;
  return new Date(Math.min(verificationExpiry, Date.parse(shareExpiresAt))).toISOString();
}

function assertShareEmailVerification(
  link: ShareLinkRecord,
  verificationCode: string,
  secret: string,
  now: string,
): void {
  if (!link.requireEmailVerification) return;
  if (
    !link.emailVerificationCodeHash ||
    !link.emailVerificationExpiresAt ||
    Date.parse(link.emailVerificationExpiresAt) <= Date.parse(now)
  ) {
    throw new ApiHttpError(
      403,
      "EMAIL_VERIFICATION_FAILED",
      "Email verification could not be completed for this share link",
    );
  }
  const candidateHash = hashToken(normalizeShareVerificationCode(verificationCode), secret);
  if (candidateHash !== link.emailVerificationCodeHash) {
    throw new ApiHttpError(
      403,
      "EMAIL_VERIFICATION_FAILED",
      "Email verification could not be completed for this share link",
    );
  }
}

function shareLinkAsPortalGrant(link: ShareLinkRecord): PortalGrant {
  return {
    id: link.id,
    firmId: link.firmId,
    matterId: link.matterId,
    contactId: `share-link:${link.id}`,
    grantedByUserId: link.grantedByUserId,
    permissions: link.permissions,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
  };
}

function eligibleDocumentsForShare(
  link: ShareLinkRecord,
  documents: DocumentRecord[],
  now: string,
): DocumentRecord[] {
  if (!link.permissions.includes("view_documents")) return [];
  const grant = shareLinkAsPortalGrant(link);
  return documents.filter((document) => canShareDocumentThroughPortal({ document, grant, now }));
}

function requireShareSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "SHARE_TOKEN_SIGNING_NOT_CONFIGURED",
    "Share link token signing is not configured",
  );
}

async function assertEmailVerificationDeliveryConfigured(
  repository: RegisterShareRouteOptions["repository"],
  emailJobQueue: RegisterShareRouteOptions["emailJobQueue"],
  firmId: string,
): Promise<void> {
  if (!emailJobQueue) {
    throw new ApiHttpError(503, "EMAIL_QUEUE_NOT_CONFIGURED", "Email queue is not configured");
  }
  const providers = await repository.listProviderSettings(firmId, { kind: "smtp" });
  if (!providers.some((provider) => provider.enabled)) {
    throw new ApiHttpError(503, "SMTP_NOT_CONFIGURED", "SMTP email delivery is not configured");
  }
}

function defaultExpiry(now: Date): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function accessLogForShare(input: {
  link: ShareLinkRecord;
  action: AccessLogRecord["action"];
  resourceType: string;
  resourceId: string;
  request: { ip?: string; headers: { ["user-agent"]?: string | string[] } };
  metadata?: Record<string, unknown>;
}): AccessLogRecord {
  const userAgent = input.request.headers["user-agent"];
  return {
    id: crypto.randomUUID(),
    firmId: input.link.firmId,
    shareLinkId: input.link.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    occurredAt: new Date().toISOString(),
    ipAddress: input.request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent,
    metadata: input.metadata ?? {},
  };
}

function assertPublicShareAvailable(link: ShareLinkRecord, now: string): void {
  if (link.revokedAt) {
    throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
  }
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.parse(now)) {
    throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
  }
}

async function publicShareDocumentResponse(
  repository: ApiRouteDependencies["repository"],
  link: ShareLinkRecord,
  now: string,
) {
  const documents = await repository.listMatterDocuments(link.firmId, link.matterId);
  const eligibleDocuments = eligibleDocumentsForShare(link, documents, now).map(publicDocument);
  return {
    share: publicShare(link),
    documents: eligibleDocuments,
  };
}

export function registerShareRoutes(
  server: FastifyInstance,
  { repository, jwtSecret, emailJobQueue }: RegisterShareRouteOptions,
): void {
  server.get("/api/shares/status", async (request) => {
    assertShareAccess(request.auth, { resource: "provider_setting", action: "read" });
    return {
      status: "available",
      provider: "share_links",
      createStatus: jwtSecret ? "enabled" : "disabled",
      reason: jwtSecret ? undefined : "token_signing_not_configured",
    };
  });

  server.get("/api/shares", async (request) => {
    const query = parseRequestPart(sharesQuerySchema, request.query, "query");
    assertShareAccess(request.auth, {
      resource: "share_link",
      action: "read",
      matterId: query.matterId,
    });

    const shares = await repository.listShareLinks(request.auth.firmId, query);
    return { shares: shares.map(sanitizeShare) };
  });

  server.post("/api/shares", async (request, reply) => {
    const secret = requireShareSecret(jwtSecret);
    const body = parseRequestPart(createShareBodySchema, request.body, "body");
    assertShareAccess(request.auth, {
      resource: "share_link",
      action: "create",
      matterId: body.matterId,
    });

    const now = new Date();
    const expiresAt = body.expiresAt ?? defaultExpiry(now);
    if (Date.parse(expiresAt) <= now.getTime()) {
      throw new ApiHttpError(400, "SHARE_LINK_EXPIRED", "Share link expiry must be in the future");
    }
    if (body.notificationEmail) {
      requireEmailDeliveryConfirmation(body.deliveryConfirmation, { recipientCount: 1 });
    }
    if (body.requireEmailVerification) {
      await assertEmailVerificationDeliveryConfigured(
        repository,
        emailJobQueue,
        request.auth.firmId,
      );
    }

    const token = createSessionToken();
    const verificationCode = body.requireEmailVerification
      ? createShareVerificationCode()
      : undefined;
    const emailVerificationExpiresAt = verificationCode
      ? shareVerificationExpiresAt(now, expiresAt)
      : undefined;
    const share: ShareLinkRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      tokenHash: hashToken(token, secret),
      grantedByUserId: request.auth.user.id,
      permissions: [...body.permissions],
      requireEmailVerification: body.requireEmailVerification,
      emailVerificationCodeHash:
        verificationCode && emailVerificationExpiresAt
          ? hashToken(normalizeShareVerificationCode(verificationCode), secret)
          : undefined,
      emailVerificationExpiresAt,
      expiresAt,
      createdAt: now.toISOString(),
    };

    if (share.permissions.includes("view_documents")) {
      const documents = await repository.listMatterDocuments(share.firmId, share.matterId);
      if (eligibleDocumentsForShare(share, documents, now.toISOString()).length === 0) {
        throw new ApiHttpError(
          422,
          "NO_SHAREABLE_DOCUMENTS",
          "No documents on this matter are eligible for portal sharing",
          { matterId: share.matterId },
        );
      }
    }

    const created = await repository.createShareLink(share);
    await repository.appendAuditEvent({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      actorId: request.auth.user.id,
      action: "share_link.created",
      resourceType: "share_link",
      resourceId: created.id,
      occurredAt: now.toISOString(),
      metadata: {
        matterId: created.matterId,
        permissions: created.permissions,
        expiresAt: created.expiresAt,
        requireEmailVerification: created.requireEmailVerification,
      },
    });
    const queuedEmail = body.notificationEmail
      ? await queueRouteEmailOutbox(repository, emailJobQueue, request.auth, {
          matterId: created.matterId,
          templateKey: "share_link.created",
          to: [body.notificationEmail],
          subject: "Secure document share",
          textBody: [
            "A secure document share is available.",
            `Share token: ${token}`,
            verificationCode ? `Email verification code: ${verificationCode}` : undefined,
            emailVerificationExpiresAt
              ? `Email verification code expires: ${emailVerificationExpiresAt}`
              : undefined,
          ]
            .filter((line): line is string => Boolean(line))
            .join("\n"),
          relatedResourceType: "share_link",
          relatedResourceId: created.id,
          metadata: {
            permissions: created.permissions,
            expiresAt: created.expiresAt,
            requireEmailVerification: created.requireEmailVerification,
            emailVerificationRequired: body.requireEmailVerification,
          },
          required: body.requireEmailVerification,
        })
      : undefined;
    reply.code(201);
    return {
      share: sanitizeShare(created),
      token,
      queuedEmail: summarizeQueuedRouteEmail(queuedEmail),
    };
  });

  server.post("/api/shares/:id/revoke", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = await repository.getShareLink(request.auth.firmId, params.id);
    if (!existing) {
      throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
    }
    assertShareAccess(request.auth, {
      resource: "share_link",
      action: "delete",
      matterId: existing.matterId,
    });

    const revoked = await repository.revokeShareLink({
      firmId: request.auth.firmId,
      id: params.id,
      revokedAt: new Date().toISOString(),
    });
    if (revoked) {
      await repository.appendAuditEvent({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        actorId: request.auth.user.id,
        action: "share_link.revoked",
        resourceType: "share_link",
        resourceId: revoked.id,
        occurredAt: revoked.revokedAt ?? new Date().toISOString(),
        metadata: { matterId: revoked.matterId },
      });
    }
    if (!revoked) {
      throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
    }
    return { share: sanitizeShare(revoked) };
  });

  server.get(
    "/api/portal/shares/:token",
    publicTokenPolicyOptions("share", "view"),
    async (request) => {
      const secret = requireShareSecret(jwtSecret);
      const params = parseRequestPart(tokenParamsSchema, request.params, "params");
      const link = await repository.getShareLinkByTokenHash(hashToken(params.token, secret));
      if (!link) {
        throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
      }

      const now = new Date().toISOString();
      if (link.revokedAt) {
        await repository.createAccessLog(
          accessLogForShare({
            link,
            action: "view",
            resourceType: "share_link",
            resourceId: link.id,
            request,
            metadata: { outcome: "revoked" },
          }),
        );
        throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
      }
      if (link.expiresAt && Date.parse(link.expiresAt) <= Date.parse(now)) {
        await repository.createAccessLog(
          accessLogForShare({
            link,
            action: "view",
            resourceType: "share_link",
            resourceId: link.id,
            request,
            metadata: { outcome: "expired" },
          }),
        );
        throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
      }
      if (link.requireEmailVerification) {
        await repository.createAccessLog(
          accessLogForShare({
            link,
            action: "view",
            resourceType: "share_link",
            resourceId: link.id,
            request,
            metadata: { outcome: "email_verification_required" },
          }),
        );
        throw new ApiHttpError(
          403,
          "EMAIL_VERIFICATION_REQUIRED",
          "Email verification is required for this share link",
          { verificationRequired: true },
        );
      }

      const response = await publicShareDocumentResponse(repository, link, now);
      await repository.createAccessLog(
        accessLogForShare({
          link,
          action: "view",
          resourceType: "share_link",
          resourceId: link.id,
          request,
          metadata: { outcome: "granted", documentCount: response.documents.length },
        }),
      );

      return response;
    },
  );

  server.post(
    "/api/portal/shares/:token/email-verification",
    publicTokenPolicyOptions("share", "mutation"),
    async (request) => {
      const secret = requireShareSecret(jwtSecret);
      const params = parseRequestPart(tokenParamsSchema, request.params, "params");
      const body = parseRequestPart(shareEmailVerificationBodySchema, request.body, "body");
      const link = await repository.getShareLinkByTokenHash(hashToken(params.token, secret));
      if (!link) {
        throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
      }

      const now = new Date().toISOString();
      try {
        assertPublicShareAvailable(link, now);
      } catch (error) {
        await repository.createAccessLog(
          accessLogForShare({
            link,
            action: "view",
            resourceType: "share_link",
            resourceId: link.id,
            request,
            metadata: {
              outcome:
                link.revokedAt || (link.expiresAt && Date.parse(link.expiresAt) <= Date.parse(now))
                  ? link.revokedAt
                    ? "revoked"
                    : "expired"
                  : "unavailable",
              emailVerification: "completion_attempted",
            },
          }),
        );
        throw error;
      }
      try {
        assertShareEmailVerification(link, body.verificationCode, secret, now);
      } catch (error) {
        await repository.createAccessLog(
          accessLogForShare({
            link,
            action: "view",
            resourceType: "share_link",
            resourceId: link.id,
            request,
            metadata: {
              outcome: "email_verification_failed",
              emailVerification: "failed",
            },
          }),
        );
        throw error;
      }

      const response = await publicShareDocumentResponse(repository, link, now);
      await repository.createAccessLog(
        accessLogForShare({
          link,
          action: "view",
          resourceType: "share_link",
          resourceId: link.id,
          request,
          metadata: {
            outcome: "granted",
            emailVerification: link.requireEmailVerification ? "completed" : "not_required",
            documentCount: response.documents.length,
          },
        }),
      );

      return response;
    },
  );
}
