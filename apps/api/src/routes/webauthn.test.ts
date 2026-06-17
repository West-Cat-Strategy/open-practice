import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import { registerWebAuthnRoutes } from "./webauthn.js";
import { hashPassword, hashToken, isPublicRoute } from "../http/auth-helpers.js";

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
const testFirm = { id: "firm-1", name: "Test Firm", defaultProvince: "BC" as const };

function testRepository() {
  return new InMemoryOpenPracticeRepository({
    seedSampleData: false,
    firms: [testFirm],
  });
}

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
    freshAuthenticatedAt: new Date().toISOString(),
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
            request.auth = { user, firmId: session.firmId, session };
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
  it("refreshes the current session through password step-up", async () => {
    const repository = testRepository();
    await seedUser(repository);
    await repository.setAuthPassword({
      firmId: "firm-1",
      userId: "user-1",
      passwordHash: hashPassword("correct password"),
      passwordUpdatedAt: new Date().toISOString(),
    });
    const server = testServer(repository);

    const invalid = await server.inject({
      method: "POST",
      url: "/api/auth/step-up/password",
      headers: { "x-open-practice-session": "session-token" },
      payload: { password: "wrong password" },
    });
    const valid = await server.inject({
      method: "POST",
      url: "/api/auth/step-up/password",
      headers: { "x-open-practice-session": "session-token" },
      payload: { password: "correct password" },
    });

    expect(invalid.statusCode).toBe(401);
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toMatchObject({
      ok: true,
      freshAuthenticatedAt: expect.any(String),
      expiresInSeconds: 900,
    });
    await expect(
      repository.getAuthSessionByTokenHash(hashToken("session-token", jwtSecret)),
    ).resolves.toMatchObject({
      freshAuthenticatedAt: valid.json<{ freshAuthenticatedAt: string }>().freshAuthenticatedAt,
    });
  });

  it("refreshes the current session through passkey step-up", async () => {
    const repository = testRepository();
    await seedUser(repository);
    await repository.registerWebAuthnCredential({
      id: "cred-step-up",
      firmId: "firm-1",
      userId: "user-1",
      credentialId: "credential-id",
      publicKey: Buffer.from([1, 2, 3]).toString("base64url"),
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date().toISOString(),
    });
    const server = testServer(repository);

    const options = await server.inject({
      method: "POST",
      url: "/api/auth/step-up/passkey/options",
      headers: { "x-open-practice-session": "session-token" },
    });
    const verified = await server.inject({
      method: "POST",
      url: "/api/auth/step-up/passkey/verify",
      headers: { "x-open-practice-session": "session-token" },
      payload: {
        challengeHash: options.json<{ challenge: string }>().challenge,
        response: { id: "credential-id" },
      },
    });

    expect(options.statusCode).toBe(200);
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toMatchObject({
      ok: true,
      freshAuthenticatedAt: expect.any(String),
    });
    await expect(
      repository.getWebAuthnChallenge("authentication-challenge"),
    ).resolves.toMatchObject({
      consumedAt: expect.any(String),
    });
    await expect(repository.listWebAuthnCredentials("firm-1", "user-1")).resolves.toEqual([
      expect.objectContaining({ id: "cred-step-up", counter: 1 }),
    ]);
  });

  it("verifies registration with the stored challenge hash and consumes it", async () => {
    const repository = testRepository();
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
        challengeHash: "registration-challenge",
        response: { id: "credential-id", response: { transports: ["internal"] } },
      },
    });
    expect(verified.statusCode).toBe(200);
    await expect(repository.getWebAuthnChallenge("registration-challenge")).resolves.toMatchObject({
      consumedAt: expect.any(String),
    });
    const audit = await repository.listAuditEvents("firm-1");
    const credentialAudit = audit.events.find(
      (event) => event.action === "auth_credential.passkey.created",
    );
    expect(credentialAudit).toMatchObject({
      resourceType: "auth_credential",
      metadata: {
        userId: "user-1",
        credentialId: expect.any(String),
        deviceType: "singleDevice",
        backedUp: false,
      },
    });
    const serializedAudit = JSON.stringify(credentialAudit);
    expect(serializedAudit).not.toContain("credential-id");
    expect(serializedAudit).not.toContain(Buffer.from([1, 2, 3]).toString("base64url"));

    const replay = await server.inject({
      method: "POST",
      url: "/api/auth/register/verify",
      headers: { "x-open-practice-session": "session-token" },
      payload: {
        challengeHash: "registration-challenge",
        response: { id: "credential-id", response: { transports: ["internal"] } },
      },
    });
    expect(replay.statusCode).toBe(400);
  });

  it("does not reveal whether an email exists when generating login options", async () => {
    const repository = testRepository();
    await seedUser(repository);
    const server = testServer(repository);

    const known = await server.inject({
      method: "POST",
      url: "/api/auth/login/options",
      payload: { email: "test@example.test" },
    });
    const unknown = await server.inject({
      method: "POST",
      url: "/api/auth/login/options",
      payload: { email: "unknown@example.test" },
    });

    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(known.json()).not.toHaveProperty("allowCredentials");
    expect(unknown.json()).not.toHaveProperty("allowCredentials");
    expect(known.json()).toEqual(unknown.json());
  });

  it("reports setup-not-ready before public passkey login options", async () => {
    const server = testServer(new InMemoryOpenPracticeRepository({ seedSampleData: false }));

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login/options",
      payload: { email: "test@example.test" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "First-run setup is required before sign in.",
    });
  });

  it("allows credential-bound verification without binding the login challenge to an email", async () => {
    const repository = testRepository();
    await seedUser(repository, true);
    await repository.registerWebAuthnCredential({
      id: "cred-1",
      firmId: "firm-1",
      userId: "user-1",
      credentialId: "credential-id",
      publicKey: Buffer.from([1, 2, 3]).toString("base64url"),
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date().toISOString(),
    });
    const server = testServer(repository);

    const options = await server.inject({
      method: "POST",
      url: "/api/auth/login/options",
      payload: { email: "unknown@example.test" },
    });
    expect(options.statusCode).toBe(200);

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login/verify",
      payload: {
        email: "test@example.test",
        challengeHash: "authentication-challenge",
        response: { id: "credential-id" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toEqual(
      expect.stringContaining("open_practice_session"),
    );
  });

  it("rejects disabled or cross-firm credentials during login verification", async () => {
    const repository = testRepository();
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
        email: "test@example.test",
        challengeHash: "authentication-challenge",
        response: { id: "credential-id" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Invalid passkey login" });
  });

  it("deletes only the current user's credential records", async () => {
    const repository = testRepository();
    await seedUser(repository, true);
    await repository.createUser({
      id: "user-2",
      firmId: "firm-1",
      displayName: "Other User",
      email: "other@example.test",
      role: "firm_member",
      assignedMatterIds: [],
      mfaEnabled: true,
    });
    await repository.registerWebAuthnCredential({
      id: "cred-self",
      firmId: "firm-1",
      userId: "user-1",
      credentialId: "credential-self",
      publicKey: Buffer.from([1, 2, 3]).toString("base64url"),
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date().toISOString(),
    });
    await repository.registerWebAuthnCredential({
      id: "cred-other",
      firmId: "firm-1",
      userId: "user-2",
      credentialId: "credential-other",
      publicKey: Buffer.from([4, 5, 6]).toString("base64url"),
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date().toISOString(),
    });
    const server = testServer(repository);

    const crossUserDelete = await server.inject({
      method: "DELETE",
      url: "/api/auth/credentials/cred-other",
      headers: { "x-open-practice-session": "session-token" },
    });
    const ownDelete = await server.inject({
      method: "DELETE",
      url: "/api/auth/credentials/cred-self",
      headers: { "x-open-practice-session": "session-token" },
    });

    expect(crossUserDelete.statusCode).toBe(200);
    await expect(repository.listWebAuthnCredentials("firm-1", "user-2")).resolves.toEqual([
      expect.objectContaining({ id: "cred-other" }),
    ]);
    expect(ownDelete.statusCode).toBe(200);
    await expect(repository.listWebAuthnCredentials("firm-1", "user-1")).resolves.toEqual([]);
  });
});
