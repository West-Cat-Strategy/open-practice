import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import { requireFreshAuth } from "../http/fresh-auth.js";
import { sessionCookie } from "../http/auth-helpers.js";
import { parseRequestPart } from "../http/validation.js";
import { createEmbeddedAuthService, recoveryCodeHash } from "../services/auth-service.js";
import { randomBytes } from "node:crypto";
import { appendRepositoryAuditEvent, appendRouteAuditEvent } from "./audit-events.js";

export function registerRecoveryRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    jwtSecret?: string;
    sessionTtlHours?: number;
    nodeEnv?: string;
  },
): void {
  const RECOVERY_RATE_LIMIT = { max: 5, timeWindow: "1 minute" };
  const authService = createEmbeddedAuthService(options);

  server.post(
    "/api/auth/recovery-codes/generate",
    {
      preHandler: server.rateLimit(RECOVERY_RATE_LIMIT),
      config: { rateLimit: { ...RECOVERY_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(RECOVERY_RATE_LIMIT) above.
    async (request) => {
      requireFreshAuth(request.auth);
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Session authentication is not configured"), {
          statusCode: 503,
        });
      }
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
      if (!access.ok) throw access.error;

      const codes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));
      const records = codes.map((code) => ({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        userId: request.auth.user.id,
        codeHash: recoveryCodeHash(code, options.jwtSecret!),
        createdAt: new Date().toISOString(),
      }));

      await options.repository.createRecoveryCodes(
        request.auth.firmId,
        request.auth.user.id,
        records,
      );
      await appendRouteAuditEvent(options.repository, request.auth, {
        action: "auth_credential.recovery_codes.generated",
        resourceType: "auth_credential",
        resourceId: request.auth.user.id,
        metadata: {
          userId: request.auth.user.id,
          codeCount: records.length,
        },
      });

      return { codes };
    },
  );

  server.post(
    "/api/auth/recovery-codes/verify",
    {
      preHandler: server.rateLimit(RECOVERY_RATE_LIMIT),
      config: { rateLimit: { ...RECOVERY_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(RECOVERY_RATE_LIMIT) above.
    async (request, reply) => {
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Session authentication is not configured"), {
          statusCode: 503,
        });
      }
      const body = parseRequestPart(
        z.object({
          email: z.string().email(),
          code: z.string().min(1),
        }),
        request.body,
        "body",
      );

      const result = await authService.verifyRecoveryCode(body);
      await appendRepositoryAuditEvent(options.repository, {
        firmId: result.user.firmId,
        actorId: result.user.id,
        action: "auth_credential.recovery_code.used",
        resourceType: "auth_credential",
        resourceId: result.user.id,
        metadata: {
          userId: result.user.id,
          method: "recovery_code",
        },
      });
      reply.header(
        "set-cookie",
        sessionCookie(result.token, result.session.expiresAt, options.nodeEnv === "production"),
      );
      return result;
    },
  );
}
