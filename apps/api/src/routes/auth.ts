import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import { requireFreshAuth } from "../http/fresh-auth.js";
import {
  hashToken,
  createSessionToken,
  sessionCookie,
  clearSessionCookie,
  readSessionToken,
} from "../http/auth-helpers.js";
import { parseRequestPart } from "../http/validation.js";
import { createEmbeddedAuthService } from "../services/auth-service.js";
import { appendRepositoryAuditEvent, appendRouteAuditEvent } from "./audit-events.js";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const passwordSetupTokenBodySchema = z.object({
  userId: z.string().min(1),
  expiresInHours: z.number().int().positive().max(168).default(24),
});

const passwordSetupBodySchema = z.object({
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
  const authService = createEmbeddedAuthService(options);

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
      const body = parseRequestPart(loginBodySchema, request.body, "body");
      const result = await authService.loginWithPassword(body);
      if ("status" in result) return result;
      reply.header(
        "set-cookie",
        sessionCookie(result.token, result.session.expiresAt, options.nodeEnv === "production"),
      );
      return result;
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
      requireFreshAuth(request.auth);
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
      if (!access.ok) throw access.error;
      if (request.auth.user.role !== "owner_admin") {
        throw Object.assign(
          new Error("Owner-admin access is required to create password setup tokens"),
          {
            statusCode: 403,
          },
        );
      }
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Password setup tokens are not configured"), {
          statusCode: 503,
        });
      }
      const body = parseRequestPart(passwordSetupTokenBodySchema, request.body, "body");
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
      await appendRouteAuditEvent(options.repository, request.auth, {
        action: "auth_credential.password_setup_token.created",
        resourceType: "auth_credential",
        resourceId: record.id,
        metadata: {
          userId: user.id,
          expiresInHours: body.expiresInHours,
        },
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
      const body = parseRequestPart(passwordSetupBodySchema, request.body, "body");
      const result = await authService.completePasswordSetup(body);
      await appendRepositoryAuditEvent(options.repository, {
        firmId: result.user.firmId,
        actorId: result.user.id,
        action: "auth_credential.password.updated",
        resourceType: "auth_credential",
        resourceId: result.user.id,
        metadata: {
          userId: result.user.id,
          method: "password_setup_token",
        },
      });
      return result;
    },
  );
}
