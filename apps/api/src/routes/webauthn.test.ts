import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import { registerWebAuthnRoutes } from "./webauthn.js";
import { hashToken } from "../http/auth-helpers.js";
import { isPublicRoute } from "../http/auth-helpers.js";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: "registration-challenge",
    rp: { id: "localhost", name: "Test" },
    user: { id: "user-1", name: "test@example.test", displayName: "" },
    pubKeyCredParams: [],
  })),
  verifyRegistrationResponse: vi.fn(async () => ({
    verified: true,
    registrationInfo: {
      credential: {
        id: "credential-id",
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
      },
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
    },
  })),
  generateAuthenticationOptions: vi.fn(async (options: { allowCredentials?: unknown[] }) => ({
    challenge: "authentication-challenge",
    rpId: "localhost",
    allowCredentials: options.allowCredentials ?? [],
    userVerification: "preferred",
  })),
  verifyAuthenticationResponse: vi.fn(async () => ({
    verified: true,
    authenticationInfo: {
      newCounter: 1,
    },
  })),
}));

const servers: FastifyInstance[] = [];
const jwtSecret = "test-secret-at-least-32-chars-long";

async function seedUser(repository: OpenPracticeRepository, mfaEnabled = false) {
  await repository.createUser({
    id: "user-1",
    firmId: "firm-1",
    displayName: "Test User",
    email: "test@example.test",
    role: "owner_admin",
    assignedMatterIds: [],
    mfaEnabled,
  });
  const session = await repository.createAuthSession({
    id: "session-1",
    firmId: "firm-1",
    userId: "user-1",
    tokenHash: hashToken("session-token", jwtSecret),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return session;
}

function testServer(repository: OpenPracticeRepository): FastifyInstance {
  const server = Fastify({ logger: false });
  server.register(async (app) => {
    await app.register(rateLimit, { global: true, max: 1_000, timeWindow: "1 minute" });

    app.addHook("preHandler", async (request) => {
      if (isPublicRoute(request.method, request.url)) return;

      const sessionToken = request.headers["x-open-practice-session"];
      if (sessionToken && typeof sessionToken === "string") {
        const session = await repository.getAuthSessionByTokenHash(
          hashToken(sessionToken, jwtSecret),
        );
        if (session) {
          const user = await repository.getUser(session.firmId, session.userId);
          if (user) {
            request.auth = { user, firmId: session.firmId };
            return;
          }
        }
      }
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    registerWebAuthnRoutes(app, {
      repository,
      jwtSecret,
      sessionTtlHours: 1,
      nodeEnv: "development",
      rpName: "Test",
      rpID: "localhost",
      origin: "http://localhost:3000",
    });
  });

  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("WebAuthn routes", () => {
  it("verifies registration with the stored challenge hash and consumes it", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    await seedUser(repository);
    const server = testServer(repository);

    const options = await server.inject({
      method: "POST",
      url: "/api/auth/register/options",
      headers: { "x-open-practice-session": "session-token" },
    });
    expect(options.statusCode).toBe(200);

    const verified = await server.inject({
      method: "POST",
      url: "/api/auth/register/verify",
      headers: { "x-open-practice-session": "session-token" },
      payload: {
        firmId: "firm-1",
        email: "test@example.test",
        challengeHash: "registration-challenge",
        response: { id: "credential-id", response: { transports: ["internal"] } },
      },
    });
    expect(verified.statusCode).toBe(200);
    await expect(repository.getWebAuthnChallenge("registration-challenge")).resolves.toMatchObject({
      consumedAt: expect.any(String),
    });

    const replay = await server.inject({
      method: "POST",
      url: "/api/auth/register/verify",
      headers: { "x-open-practice-session": "session-token" },
      payload: {
        firmId: "firm-1",
        email: "test@example.test",
        challengeHash: "registration-challenge",
        response: { id: "credential-id", response: { transports: ["internal"] } },
      },
    });
    expect(replay.statusCode).toBe(400);
  });

  it("does not reveal whether an email exists when generating login options", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    await seedUser(repository);
    const server = testServer(repository);

    const known = await server.inject({
      method: "POST",
      url: "/api/auth/login/options",
      payload: { firmId: "firm-1", email: "test@example.test" },
    });
    const unknown = await server.inject({
      method: "POST",
      url: "/api/auth/login/options",
      payload: { firmId: "firm-1", email: "unknown@example.test" },
    });

    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
  });

  it("rejects disabled or cross-firm credentials during login verification", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    await seedUser(repository, true);
    await repository.registerWebAuthnCredential({
      id: "cred-1",
      firmId: "firm-2",
      userId: "user-1",
      credentialId: "credential-id",
      publicKey: Buffer.from([1, 2, 3]).toString("base64url"),
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date().toISOString(),
      disabledAt: new Date().toISOString(),
    });
    await repository.createWebAuthnChallenge({
      id: "challenge-1",
      firmId: "firm-1",
      userId: "user-1",
      challengeHash: "authentication-challenge",
      purpose: "passkey_authentication",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    const server = testServer(repository);

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login/verify",
      payload: {
        firmId: "firm-1",
        email: "test@example.test",
        challengeHash: "authentication-challenge",
        response: { id: "credential-id" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Invalid passkey login" });
  });
});
