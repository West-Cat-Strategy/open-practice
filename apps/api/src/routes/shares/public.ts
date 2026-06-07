import type { FastifyInstance, FastifyRequest } from "fastify";
import { hashToken } from "../../http/auth-helpers.js";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { publicTokenPolicyOptions } from "../public-token-rate-limits.js";
import {
  accessLogForShare,
  assertPublicShareAvailable,
  assertShareEmailVerification,
  publicShareDocumentResponse,
  readSharePublicToken,
  requireShareSecret,
  shareEmailVerificationBodySchema,
  type ShareRouteDependencies,
} from "./shared.js";

export function registerPublicShareRoutes(
  server: FastifyInstance,
  { repository, jwtSecret }: ShareRouteDependencies,
): void {
  const viewPublicShare = async (request: FastifyRequest) => {
    const secret = requireShareSecret(jwtSecret);
    const token = readSharePublicToken(request);
    const link = await repository.getShareLinkByTokenHash(hashToken(token, secret));
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
  };

  const verifyPublicShareEmail = async (request: FastifyRequest) => {
    const secret = requireShareSecret(jwtSecret);
    const token = readSharePublicToken(request);
    const body = parseRequestPart(shareEmailVerificationBodySchema, request.body, "body");
    const link = await repository.getShareLinkByTokenHash(hashToken(token, secret));
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
  };

  server.get("/api/portal/shares", publicTokenPolicyOptions("share", "view"), viewPublicShare);
  server.get(
    "/api/portal/shares/:token",
    publicTokenPolicyOptions("share", "view"),
    viewPublicShare,
  );
  server.post(
    "/api/portal/shares/email-verification",
    publicTokenPolicyOptions("share", "mutation"),
    verifyPublicShareEmail,
  );
  server.post(
    "/api/portal/shares/:token/email-verification",
    publicTokenPolicyOptions("share", "mutation"),
    verifyPublicShareEmail,
  );
}
