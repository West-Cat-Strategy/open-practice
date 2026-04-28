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
import { createSessionToken, hashToken, sessionCookie } from "../http/auth-helpers.js";

const registrationVerifySchema = z.object({
  firmId: z.string().min(1),
  email: z.string().email(),
  response: z.any(),
});

const loginOptionsSchema = z.object({
  firmId: z.string().min(1),
  email: z.string().email(),
});

const loginVerifySchema = z.object({
  firmId: z.string().min(1),
  email: z.string().email(),
  response: z.any(),
});

const WEBAUTHN_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };

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
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
      const challenge = await options.repository.getWebAuthnChallenge(body.response.challenge);

      if (!challenge || challenge.purpose !== "passkey_registration" || challenge.consumedAt) {
        throw Object.assign(new Error("Invalid or expired challenge"), { statusCode: 400 });
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
          createdAt: new Date().toISOString(),
        });

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
      const body = loginOptionsSchema.parse(request.body);
      const user = await options.repository.getUserByEmail(body.firmId, body.email);
      if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
      }

      const userCredentials = await options.repository.listWebAuthnCredentials(
        user.firmId,
        user.id,
      );

      const authOptions = await generateAuthenticationOptions({
        rpID: options.rpID,
        allowCredentials: userCredentials.map((cred) => ({
          id: cred.credentialId,
          type: "public-key",
          transports: cred.transports as AuthenticatorTransport[],
        })),
        userVerification: "preferred",
      });

      await options.repository.createWebAuthnChallenge({
        id: crypto.randomUUID(),
        firmId: user.firmId,
        userId: user.id,
        challengeHash: authOptions.challenge,
        purpose: "passkey_authentication",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      return authOptions;
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
      const user = await options.repository.getUserByEmail(body.firmId, body.email);
      if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });

      const challenge = await options.repository.getWebAuthnChallenge(body.response.challenge);
      if (!challenge || challenge.purpose !== "passkey_authentication" || challenge.consumedAt) {
        throw Object.assign(new Error("Invalid or expired challenge"), { statusCode: 400 });
      }

      const credentialId = body.response.id;
      const credential = await options.repository.getWebAuthnCredential(credentialId);

      if (!credential || credential.userId !== user.id) {
        throw Object.assign(new Error("Credential not found"), { statusCode: 400 });
      }

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
