import type { FastifyInstance } from "fastify";
import type { ShareLinkRecord } from "@open-practice/domain";
import { createSessionToken, hashToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { requireEmailDeliveryConfirmation } from "../delivery-confirmation.js";
import { queueRouteEmailOutbox, summarizeQueuedRouteEmail } from "../outbound-email.js";
import {
  assertEmailVerificationDeliveryConfigured,
  assertShareAccess,
  canShareLinkAction,
  createShareBodySchema,
  createShareVerificationCode,
  defaultExpiry,
  eligibleDocumentsForShare,
  idParamsSchema,
  normalizeShareVerificationCode,
  requireShareSecret,
  sanitizeShare,
  sharesQuerySchema,
  shareVerificationExpiresAt,
  type ShareRouteDependencies,
} from "./shared.js";

export function registerStaffShareRoutes(
  server: FastifyInstance,
  { repository, jwtSecret, emailJobQueue }: ShareRouteDependencies,
): void {
  server.get("/api/shares/status", async (request) => {
    assertShareAccess(request.auth, { resource: "provider_setting", action: "read" });
    return {
      status: "available",
      provider: "share_links",
      createStatus: jwtSecret ? "enabled" : "disabled",
      canCreate: Boolean(jwtSecret) && canShareLinkAction(request.auth, "create"),
      canManage:
        canShareLinkAction(request.auth, "update") || canShareLinkAction(request.auth, "delete"),
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
}
