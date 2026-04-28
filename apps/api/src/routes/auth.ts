import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import {
  hashToken,
  hashPassword,
  verifyPassword,
  createSessionToken,
  sessionCookie,
  clearSessionCookie,
  readSessionToken,
} from "../http/auth-helpers.js";

const loginBodySchema = z.object({
  firmId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const passwordSetupTokenBodySchema = z.object({
  userId: z.string().min(1),
  expiresInHours: z.number().int().positive().max(168).default(24),
});

const passwordSetupBodySchema = z.object({
  firmId: z.string().min(1),
  userId: z.string().min(1),
  token: z.string().min(32),
  password: z.string().min(8),
});

const AUTH_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const AUTH_MUTATION_RATE_LIMIT = { max: 30, timeWindow: "1 minute" };

export function registerAuthRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    jwtSecret?: string;
    sessionTtlHours?: number;
    nodeEnv?: string;
  },
): void {
  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this login route has a tighter route cap.
  server.post(
    "/api/auth/login",
    { config: { rateLimit: { ...AUTH_RATE_LIMIT } } },
    async (request, reply) => {
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Session authentication is not configured"), {
          statusCode: 503,
        });
      }
      const body = loginBodySchema.parse(request.body);
      const user = await options.repository.getUserByEmail(body.firmId, body.email);
      const account = user
        ? await options.repository.getAuthAccount(user.firmId, user.id)
        : undefined;
      if (!user || !account || !verifyPassword(body.password, account.passwordHash)) {
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
      }

      if (user.mfaEnabled) {
        return {
          status: "mfa_required",
          mfaOptions: { webauthn: true },
        };
      }

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
      reply.header("set-cookie", sessionCookie(token, expiresAt, options.nodeEnv === "production"));
      return { user, session: { id: session.id, expiresAt }, token };
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and logout has a tighter mutation cap.
  server.post(
    "/api/auth/logout",
    { config: { rateLimit: { ...AUTH_MUTATION_RATE_LIMIT } } },
    async (request, reply) => {
      const token = readSessionToken(request.headers);
      if (token && options.jwtSecret) {
        await options.repository.revokeAuthSession(
          hashToken(token, options.jwtSecret),
          new Date().toISOString(),
        );
      }
      reply.header("set-cookie", clearSessionCookie());
      return { ok: true };
    },
  );

  server.get("/api/auth/session", async (request) => ({ user: request.auth.user }));

  server.post(
    "/api/auth/password-setup-tokens",
    { config: { rateLimit: { ...AUTH_MUTATION_RATE_LIMIT } } },
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
      if (!access.ok) throw access.error;
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Password setup tokens are not configured"), {
          statusCode: 503,
        });
      }
      const body = passwordSetupTokenBodySchema.parse(request.body);
      const user = await options.repository.getUser(request.auth.firmId, body.userId);
      if (!user) {
        throw Object.assign(new Error("User was not found"), { statusCode: 404 });
      }
      const token = createSessionToken();
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + body.expiresInHours * 60 * 60 * 1000,
      ).toISOString();
      const record = await options.repository.createPasswordSetupToken({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        userId: user.id,
        tokenHash: hashToken(token, options.jwtSecret),
        createdByUserId: request.auth.user.id,
        createdAt: now.toISOString(),
        expiresAt,
      });
      return { token, expiresAt: record.expiresAt, userId: user.id };
    },
  );

  server.post(
    "/api/auth/password-setup",
    { config: { rateLimit: { ...AUTH_RATE_LIMIT } } },
    async (request) => {
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Password setup is not configured"), { statusCode: 503 });
      }
      const body = passwordSetupBodySchema.parse(request.body);
      const now = new Date().toISOString();
      const token = await options.repository.consumePasswordSetupToken(
        hashToken(body.token, options.jwtSecret),
        now,
      );
      if (!token || token.firmId !== body.firmId || token.userId !== body.userId) {
        throw Object.assign(new Error("Password setup token is invalid or expired"), {
          statusCode: 401,
        });
      }
      const user = await options.repository.getUser(body.firmId, body.userId);
      if (!user) throw Object.assign(new Error("User was not found"), { statusCode: 404 });
      await options.repository.setAuthPassword({
        firmId: body.firmId,
        userId: body.userId,
        passwordHash: hashPassword(body.password),
        passwordUpdatedAt: now,
      });
      return { user };
    },
  );
}
