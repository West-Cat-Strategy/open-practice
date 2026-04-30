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
import type { ApiRouteDependencies } from "./types.js";

const sharePermissionSchema = z.literal("view_documents");

const sharesQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const createShareBodySchema = z.object({
  matterId: z.string().min(1),
  permissions: z.array(sharePermissionSchema).nonempty().default(["view_documents"]),
  expiresAt: z.string().datetime().optional(),
  requireEmailVerification: z.boolean().default(false),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const tokenParamsSchema = z.object({ token: z.string().min(32) });

type RegisterShareRouteOptions = ApiRouteDependencies & {
  jwtSecret?: string;
};

type PublicDocument = Pick<
  DocumentRecord,
  "id" | "matterId" | "title" | "classification" | "version" | "uploadedAt" | "verifiedAt"
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
  throw Object.assign(new Error("Share link token signing is not configured"), { statusCode: 503 });
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

export function registerShareRoutes(
  server: FastifyInstance,
  { repository, jwtSecret }: RegisterShareRouteOptions,
): void {
  server.get("/api/shares/status", async () => ({
    status: "available",
    provider: "share_links",
    createStatus: jwtSecret ? "enabled" : "disabled",
    reason: jwtSecret ? undefined : "token_signing_not_configured",
  }));

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

    const token = createSessionToken();
    const share: ShareLinkRecord = {
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      matterId: body.matterId,
      tokenHash: hashToken(token, secret),
      grantedByUserId: request.auth.user.id,
      permissions: [...body.permissions],
      requireEmailVerification: body.requireEmailVerification,
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
    reply.code(201);
    return {
      share: sanitizeShare(created),
      token,
    };
  });

  server.post("/api/shares/:id/revoke", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const existing = (await repository.listShareLinks(request.auth.firmId)).find(
      (link) => link.id === params.id,
    );
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
    return { share: revoked ? sanitizeShare(revoked) : undefined };
  });

  server.get("/api/portal/shares/:token", async (request) => {
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
      throw new ApiHttpError(410, "SHARE_LINK_EXPIRED", "Share link has expired");
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
      );
    }

    const documents = await repository.listMatterDocuments(link.firmId, link.matterId);
    const eligibleDocuments = eligibleDocumentsForShare(link, documents, now).map(publicDocument);
    await repository.createAccessLog(
      accessLogForShare({
        link,
        action: "view",
        resourceType: "share_link",
        resourceId: link.id,
        request,
        metadata: { outcome: "granted", documentCount: eligibleDocuments.length },
      }),
    );

    return {
      share: sanitizeShare(link),
      documents: eligibleDocuments,
    };
  });
}
