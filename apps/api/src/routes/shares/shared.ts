import type { FastifyRequest } from "fastify";
import { z } from "zod";
import {
  canAccess,
  canShareDocumentThroughPortal,
  type AccessLogRecord,
  type AccessRequest,
  type DocumentRecord,
  type PortalGrant,
  type ShareLinkRecord,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import {
  hashToken,
  publicTokenPathFromHeader,
  readPublicTokenHeader,
} from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { deliveryConfirmationSchema } from "../delivery-confirmation.js";
import type { ApiRouteDependencies } from "../types.js";

const sharePermissionSchema = z.literal("view_documents");
const tokenParamsSchema = z.object({ token: z.string().min(32) });
const SHARE_EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const sharesQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

export const createShareBodySchema = z
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

export const shareEmailVerificationBodySchema = z.object({
  verificationCode: z.string().min(6).max(128),
});

export const idParamsSchema = z.object({ id: z.string().min(1) });

export type ShareRouteDependencies = Pick<ApiRouteDependencies, "repository" | "emailJobQueue"> & {
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

export function assertShareAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function canShareLinkAction(
  context: ApiAuthContext,
  action: AccessRequest["action"],
): boolean {
  return canAccess({
    user: context.user,
    firmId: context.firmId,
    resource: "share_link",
    action,
    matterId: context.user.assignedMatterIds[0],
  });
}

export function sanitizeShare(link: ShareLinkRecord): Omit<ShareLinkRecord, "tokenHash"> {
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

export function createShareVerificationCode(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export function normalizeShareVerificationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function shareVerificationExpiresAt(createdAt: Date, shareExpiresAt: string): string {
  const verificationExpiry = createdAt.getTime() + SHARE_EMAIL_VERIFICATION_TTL_MS;
  return new Date(Math.min(verificationExpiry, Date.parse(shareExpiresAt))).toISOString();
}

export function assertShareEmailVerification(
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

export function eligibleDocumentsForShare(
  link: ShareLinkRecord,
  documents: DocumentRecord[],
  now: string,
): DocumentRecord[] {
  if (!link.permissions.includes("view_documents")) return [];
  const grant = shareLinkAsPortalGrant(link);
  return documents.filter((document) => canShareDocumentThroughPortal({ document, grant, now }));
}

export function requireShareSecret(jwtSecret: string | undefined): string {
  if (jwtSecret) return jwtSecret;
  throw new ApiHttpError(
    503,
    "SHARE_TOKEN_SIGNING_NOT_CONFIGURED",
    "Share link token signing is not configured",
  );
}

export function readSharePublicToken(request: FastifyRequest): string {
  const params = request.params as { token?: string } | undefined;
  return parseRequestPart(
    tokenParamsSchema,
    params?.token ? params : publicTokenPathFromHeader(readPublicTokenHeader(request.headers)),
    "params",
  ).token;
}

export async function assertEmailVerificationDeliveryConfigured(
  repository: ShareRouteDependencies["repository"],
  emailJobQueue: ShareRouteDependencies["emailJobQueue"],
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

export function defaultExpiry(now: Date): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function accessLogForShare(input: {
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

export function assertPublicShareAvailable(link: ShareLinkRecord, now: string): void {
  if (link.revokedAt) {
    throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
  }
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.parse(now)) {
    throw new ApiHttpError(404, "SHARE_LINK_NOT_FOUND", "Share link was not found");
  }
}

export async function publicShareDocumentResponse(
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
