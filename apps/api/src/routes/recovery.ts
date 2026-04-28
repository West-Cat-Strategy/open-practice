import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashToken,
  sessionCookie,
} from "../http/auth-helpers.js";
import { randomBytes } from "node:crypto";

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

  server.post(
    "/api/auth/recovery-codes/generate",
    {
      preHandler: server.rateLimit(RECOVERY_RATE_LIMIT),
      config: { rateLimit: { ...RECOVERY_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(RECOVERY_RATE_LIMIT) above.
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
      if (!access.ok) throw access.error;

      const codes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));
      const records = codes.map((code) => ({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        userId: request.auth.user.id,
        codeHash: hashPassword(code),
        createdAt: new Date().toISOString(),
      }));

      await options.repository.createRecoveryCodes(
        request.auth.firmId,
        request.auth.user.id,
        records,
      );

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
      const body = z
        .object({
          firmId: z.string().min(1),
          email: z.string().email(),
          code: z.string().min(1),
        })
        .parse(request.body);

      const user = await options.repository.getUserByEmail(body.firmId, body.email);
      if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });

      const recoveryCodes = await options.repository.listRecoveryCodes(user.firmId, user.id);
      const validCode = recoveryCodes.find(
        (c) => !c.usedAt && verifyPassword(body.code, c.codeHash),
      );

      if (validCode) {
        await options.repository.useRecoveryCode(
          user.firmId,
          user.id,
          validCode.codeHash,
          new Date().toISOString(),
        );

        const token = createSessionToken();
        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + (options.sessionTtlHours ?? 12) * 60 * 60 * 1000,
        ).toISOString();
        const session = await options.repository.createAuthSession({
          id: crypto.randomUUID(),
          firmId: user.firmId,
          userId: user.id,
          tokenHash: hashToken(token, options.jwtSecret),
          createdAt: now.toISOString(),
          expiresAt,
        });

        reply.header(
          "set-cookie",
          sessionCookie(token, expiresAt, options.nodeEnv === "production"),
        );
        return { user, session: { id: session.id, expiresAt }, token };
      }

      throw Object.assign(new Error("Invalid recovery code"), { statusCode: 401 });
    },
  );
}
