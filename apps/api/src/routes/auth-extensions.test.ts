import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { User } from "@open-practice/domain";
import { registerAuthExtensionRoutes } from "./auth-extensions.js";

const servers: FastifyInstance[] = [];

const authUser: User = {
  id: "user-admin",
  firmId: "firm-west-legal",
  displayName: "Owner Admin",
  email: "owner@example.test",
  role: "owner_admin",
  assignedMatterIds: ["matter-001"],
  mfaEnabled: true,
};

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  user?: User;
  jwtSecret?: string;
  webAuthn?: { rpID: string; origin: string };
}): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: (input.user ?? authUser).firmId, user: input.user ?? authUser };
  });
  registerAuthExtensionRoutes(server, {
    repository: input.repository,
    jwtSecret: input.jwtSecret,
    webAuthn: input.webAuthn,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("auth extension status", () => {
  it("reports configured passkey support as available before registration", async () => {
    const response = await testServer({
      repository: new InMemoryOpenPracticeRepository(),
      jwtSecret: "test-secret-at-least-32-chars",
      webAuthn: { rpID: "localhost", origin: "http://localhost:3000" },
    }).inject({ method: "GET", url: "/api/auth/extensions" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      passkeys: { status: "available", reason: "no_registered_passkeys" },
      oidc: { status: "deprecated", reason: "embedded_auth_is_current_runtime" },
      saml: { status: "deprecated", reason: "embedded_auth_is_current_runtime" },
    });
  });

  it("returns redacted embedded-auth, passkey, MFA, and recovery-code posture", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    await repository.createUser(authUser);
    await repository.setAuthPassword({
      firmId: authUser.firmId,
      userId: authUser.id,
      passwordHash: "pbkdf2:sha256:1:salt:hash",
      passwordUpdatedAt: "2026-05-01T12:00:00.000Z",
    });
    await repository.registerWebAuthnCredential({
      id: "passkey-001",
      firmId: authUser.firmId,
      userId: authUser.id,
      credentialId: "credential-secretish-id",
      publicKey: "public-key-material",
      counter: 0,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: "2026-05-01T12:05:00.000Z",
    });
    await repository.createRecoveryCodes(authUser.firmId, authUser.id, [
      {
        id: "recovery-code-001",
        firmId: authUser.firmId,
        userId: authUser.id,
        codeHash: "pbkdf2:sha256:1:salt:code-hash",
        createdAt: "2026-05-01T12:10:00.000Z",
      },
      {
        id: "recovery-code-002",
        firmId: authUser.firmId,
        userId: authUser.id,
        codeHash: "pbkdf2:sha256:1:salt:used-code-hash",
        usedAt: "2026-05-01T12:20:00.000Z",
        createdAt: "2026-05-01T12:10:00.000Z",
      },
    ]);

    const response = await testServer({
      repository,
      jwtSecret: "test-secret-at-least-32-chars",
      webAuthn: { rpID: "localhost", origin: "http://localhost:3000" },
    }).inject({ method: "GET", url: "/api/auth/extensions" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      embeddedAuth: { status: "enabled", session: "configured" },
      localPassword: {
        status: "configured",
        updatedAt: "2026-05-01T12:00:00.000Z",
      },
      passwordSetup: { status: "available" },
      passkeys: {
        status: "configured",
        registeredCount: 1,
        activeCount: 1,
        disabledCount: 0,
      },
      recoveryCodes: {
        status: "configured",
        totalCount: 2,
        unusedCount: 1,
        usedCount: 1,
      },
      mfaPolicy: { status: "enabled", requiredForCurrentUser: true },
      oidc: { status: "deprecated", reason: "embedded_auth_is_current_runtime" },
      saml: { status: "deprecated", reason: "embedded_auth_is_current_runtime" },
    });
    expect(response.body).not.toContain("credential-secretish-id");
    expect(response.body).not.toContain("public-key-material");
    expect(response.body).not.toContain("code-hash");
    expect(response.body).not.toContain("passwordHash");
  });

  it("flags missing setup and depleted recovery codes without exposing hashes", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const userWithoutMfa = { ...authUser, mfaEnabled: false };
    await repository.createUser(userWithoutMfa);
    await repository.createRecoveryCodes(authUser.firmId, authUser.id, [
      {
        id: "recovery-code-used",
        firmId: authUser.firmId,
        userId: authUser.id,
        codeHash: "pbkdf2:sha256:1:salt:used-code-hash",
        usedAt: "2026-05-01T12:20:00.000Z",
        createdAt: "2026-05-01T12:10:00.000Z",
      },
    ]);

    const response = await testServer({ repository, user: userWithoutMfa }).inject({
      method: "GET",
      url: "/api/auth/extensions",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      embeddedAuth: {
        status: "disabled",
        reason: "session_auth_not_configured",
        session: "not_configured",
      },
      localPassword: { status: "not_configured" },
      passwordSetup: { status: "disabled", reason: "session_auth_not_configured" },
      passkeys: { status: "disabled", reason: "webauthn_not_configured" },
      recoveryCodes: {
        status: "depleted",
        reason: "no_unused_recovery_codes",
        totalCount: 1,
        unusedCount: 0,
        usedCount: 1,
      },
      mfaPolicy: {
        status: "not_configured",
        reason: "no_registered_passkeys",
        requiredForCurrentUser: false,
      },
    });
    expect(response.body).not.toContain("used-code-hash");
  });
});
