import type { FastifyInstance } from "fastify";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransport,
} from "@simplewebauthn/server";
import { z } from "zod";
import type { OpenPracticeRepository } from "@open-practice/database";
import { requireAccess } from "../http/auth-guards.js";
import { sessionCookie } from "../http/auth-helpers.js";
import { createEmbeddedAuthService } from "../services/auth-service.js";

const registrationVerifySchema = z.object({
  challengeHash: z.string().min(1),
  response: z.any(),
});

const loginOptionsSchema = z.object({
  email: z.string().email(),
});

const loginVerifySchema = z.object({
  email: z.string().email(),
  challengeHash: z.string().min(1),
  response: z.any(),
});

const WEBAUTHN_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function invalidWebAuthnRequest(message = "Invalid passkey request"): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function challengeIsExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function registerWebAuthnRoutes(
  server: FastifyInstance,
  options: {
    repository: OpenPracticeRepository;
    jwtSecret?: string;
    sessionTtlHours?: number;
    nodeEnv?: string;
    rpName: string;
    rpID: string;
    origin: string;
  },
): void {
  const authService = createEmbeddedAuthService(options);

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this WebAuthn route has a tighter per-route cap.
  server.post(
    "/api/auth/register/options",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
      if (!access.ok) throw access.error;

      const userCredentials = await options.repository.listWebAuthnCredentials(
        request.auth.firmId,
        request.auth.user.id,
      );

      const registrationOptions = await generateRegistrationOptions({
        rpName: options.rpName,
        rpID: options.rpID,
        userID: Buffer.from(request.auth.user.id),
        userName: request.auth.user.email,
        attestationType: "none",
        excludeCredentials: userCredentials.map((cred) => ({
          id: cred.credentialId,
          type: "public-key",
          transports: cred.transports as AuthenticatorTransport[],
        })),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "preferred",
        },
      });

      await options.repository.createWebAuthnChallenge({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        userId: request.auth.user.id,
        challengeHash: registrationOptions.challenge,
        purpose: "passkey_registration",
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
        createdAt: new Date().toISOString(),
      });

      return registrationOptions;
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this WebAuthn route has a tighter per-route cap.
  server.post(
    "/api/auth/register/verify",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "create" });
      if (!access.ok) throw access.error;

      const body = registrationVerifySchema.parse(request.body);
      const now = new Date();
      const challenge = await options.repository.getWebAuthnChallenge(body.challengeHash);

      if (
        !challenge ||
        challenge.purpose !== "passkey_registration" ||
        challenge.consumedAt ||
        challengeIsExpired(challenge.expiresAt, now) ||
        challenge.firmId !== request.auth.firmId ||
        challenge.userId !== request.auth.user.id
      ) {
        throw invalidWebAuthnRequest("Invalid or expired challenge");
      }

      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: challenge.challengeHash,
        expectedOrigin: options.origin,
        expectedRPID: options.rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential, credentialDeviceType, credentialBackedUp } =
          verification.registrationInfo;
        const { id: credentialID, publicKey, counter } = credential;

        await options.repository.registerWebAuthnCredential({
          id: crypto.randomUUID(),
          firmId: request.auth.firmId,
          userId: request.auth.user.id,
          credentialId: Buffer.from(credentialID).toString("base64url"),
          publicKey: Buffer.from(publicKey).toString("base64url"),
          counter,
          transports: body.response.response.transports || [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          createdAt: now.toISOString(),
        });
        await options.repository.consumeWebAuthnChallenge(
          challenge.challengeHash,
          now.toISOString(),
        );

        return { verified: true };
      }

      throw Object.assign(new Error("Verification failed"), { statusCode: 400 });
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this WebAuthn route has a tighter per-route cap.
  server.post(
    "/api/auth/login/options",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      loginOptionsSchema.parse(request.body);
      const firm = await authService.resolveConfiguredFirm();

      const authOptions = await generateAuthenticationOptions({
        rpID: options.rpID,
        userVerification: "preferred",
      });
      const { allowCredentials: _allowCredentials, ...publicAuthOptions } =
        authOptions as typeof authOptions & {
          allowCredentials?: unknown;
        };

      await options.repository.createWebAuthnChallenge({
        id: crypto.randomUUID(),
        firmId: firm.id,
        challengeHash: publicAuthOptions.challenge,
        purpose: "passkey_authentication",
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
        createdAt: new Date().toISOString(),
      });

      return publicAuthOptions;
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and this WebAuthn route has a tighter per-route cap.
  server.post(
    "/api/auth/login/verify",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request, reply) => {
      if (!options.jwtSecret) {
        throw Object.assign(new Error("Session authentication is not configured"), {
          statusCode: 503,
        });
      }
      const body = loginVerifySchema.parse(request.body);
      const now = new Date();
      const firm = await authService.resolveConfiguredFirm();
      const challenge = await options.repository.getWebAuthnChallenge(body.challengeHash);
      if (
        !challenge ||
        challenge.purpose !== "passkey_authentication" ||
        challenge.consumedAt ||
        challengeIsExpired(challenge.expiresAt, now) ||
        challenge.firmId !== firm.id
      ) {
        throw invalidWebAuthnRequest("Invalid or expired challenge");
      }

      const credentialId = body.response.id;
      const credential = await options.repository.getWebAuthnCredentialForFirm(
        firm.id,
        credentialId,
      );

      if (
        !credential ||
        credential.firmId !== firm.id ||
        (challenge.userId && challenge.userId !== credential.userId) ||
        credential.disabledAt
      ) {
        throw invalidWebAuthnRequest("Invalid passkey login");
      }
      const user = await options.repository.getUser(firm.id, credential.userId);
      if (!user) throw invalidWebAuthnRequest("Invalid passkey login");

      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: challenge.challengeHash,
        expectedOrigin: options.origin,
        expectedRPID: options.rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, "base64url"),
          counter: credential.counter,
          transports: credential.transports as AuthenticatorTransport[],
        },
      });

      if (verification.verified) {
        await options.repository.updateWebAuthnCredentialCounter(
          credential.id,
          verification.authenticationInfo.newCounter,
        );

        const result = await authService.createSession(user, now);
        await options.repository.consumeWebAuthnChallenge(
          challenge.challengeHash,
          now.toISOString(),
        );

        reply.header(
          "set-cookie",
          sessionCookie(result.token, result.session.expiresAt, options.nodeEnv === "production"),
        );
        return result;
      }

      throw Object.assign(new Error("Verification failed"), { statusCode: 400 });
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and credential management has a tighter per-route cap.
  server.get(
    "/api/auth/credentials",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "read" });
      if (!access.ok) throw access.error;

      return options.repository.listWebAuthnCredentials(request.auth.firmId, request.auth.user.id);
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and credential management has a tighter per-route cap.
  server.delete(
    "/api/auth/credentials/:id",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "delete" });
      if (!access.ok) throw access.error;

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      await options.repository.deleteWebAuthnCredential(request.auth.firmId, params.id);
      return { ok: true };
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and MFA mutations have a tighter per-route cap.
  server.post(
    "/api/auth/mfa/enable",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      // Note: in a real app, you might want a fresh 'sudo' mode here.
      // For now, we assume the current session is sufficient.
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "update" });
      if (!access.ok) throw access.error;

      const credentials = await options.repository.listWebAuthnCredentials(
        request.auth.firmId,
        request.auth.user.id,
      );
      if (credentials.length === 0) {
        throw Object.assign(new Error("Cannot enable MFA without a registered passkey"), {
          statusCode: 400,
        });
      }

      await options.repository.updateUserMfaStatus(request.auth.firmId, request.auth.user.id, true);
      return { ok: true };
    },
  );

  // codeql[js/missing-rate-limiting] The Fastify rate-limit plugin is registered before API routes, and MFA mutations have a tighter per-route cap.
  server.post(
    "/api/auth/mfa/disable",
    {
      preHandler: server.rateLimit(WEBAUTHN_RATE_LIMIT),
      config: { rateLimit: { ...WEBAUTHN_RATE_LIMIT } },
    },
    // codeql[js/missing-rate-limiting] The route is protected by server.rateLimit(WEBAUTHN_RATE_LIMIT) above.
    async (request) => {
      const access = requireAccess(request.auth, { resource: "auth_credential", action: "update" });
      if (!access.ok) throw access.error;

      await options.repository.updateUserMfaStatus(
        request.auth.firmId,
        request.auth.user.id,
        false,
      );
      return { ok: true };
    },
  );
}
