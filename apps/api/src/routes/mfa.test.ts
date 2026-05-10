import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import { registerAuthRoutes } from "./auth.js";
import { registerWebAuthnRoutes } from "./webauthn.js";
import { registerRecoveryRoutes } from "./recovery.js";
import { hashPassword, hashToken, isPublicRoute } from "../http/auth-helpers.js";

const servers: FastifyInstance[] = [];

function testServer(repository: OpenPracticeRepository): FastifyInstance {
  const server = Fastify({ logger: false });
  const options = {
    repository,
    jwtSecret: "test-secret-at-least-32-chars-long",
    sessionTtlHours: 1,
    nodeEnv: "development",
    rpName: "Test",
    rpID: "localhost",
    origin: "http://localhost:3000",
  };

  server.register(async (app) => {
    await app.register(rateLimit, { global: true, max: 1_000, timeWindow: "1 minute" });

    app.addHook("preHandler", async (request) => {
      if (isPublicRoute(request.method, request.url)) return;

      const sessionToken = request.headers["x-open-practice-session"];
      if (sessionToken && typeof sessionToken === "string") {
        const hash = hashToken(sessionToken, options.jwtSecret);
        const session = await repository.getAuthSessionByTokenHash(hash);
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

    registerAuthRoutes(app, options);
    registerWebAuthnRoutes(app, options);
    registerRecoveryRoutes(app, options);
  });

  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("MFA and Recovery Flows", () => {
  it("enforces MFA if enabled and allows bypass with recovery code", async () => {
    const repository = new InMemoryOpenPracticeRepository({ seedSampleData: false });
    const firmId = "firm-1";
    const userId = "user-1";
    const email = "test@example.com";

    // Setup user
    await repository.createUser({
      id: userId,
      firmId,
      displayName: "Test User",
      email,
      role: "owner_admin",
      assignedMatterIds: [],
      mfaEnabled: false,
    });
    await repository.setAuthPassword({
      firmId,
      userId,
      passwordHash: hashPassword("password123"),
      passwordUpdatedAt: new Date().toISOString(),
    });

    const server = testServer(repository);

    // 1. Initial login (MFA disabled)
    const login1 = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { firmId, email, password: "password123" },
    });
    expect(login1.statusCode).toBe(200);
    expect(login1.json()).not.toHaveProperty("status", "mfa_required");

    const sessionToken = login1.json().token;

    // 2. Register a credential (needed to enable MFA)
    await repository.registerWebAuthnCredential({
      id: "cred-1",
      firmId,
      userId,
      credentialId: "cid-1",
      publicKey: "pk-1",
      counter: 0,
      transports: [],
      deviceType: "singleDevice",
      backedUp: false,
      createdAt: new Date().toISOString(),
    });

    // 3. Enable MFA
    const enableMfa = await server.inject({
      method: "POST",
      url: "/api/auth/mfa/enable",
      headers: { "x-open-practice-session": sessionToken },
    });
    expect(enableMfa.statusCode).toBe(200);

    // 4. Generate recovery codes
    const genCodes = await server.inject({
      method: "POST",
      url: "/api/auth/recovery-codes/generate",
      headers: { "x-open-practice-session": sessionToken },
    });
    expect(genCodes.statusCode).toBe(200);
    const codes = genCodes.json().codes;
    expect(codes).toHaveLength(10);
    const storedCodes = await repository.listRecoveryCodes(firmId, userId);
    expect(storedCodes).toHaveLength(10);
    expect(storedCodes.every((code) => !code.codeHash.startsWith("pbkdf2:"))).toBe(true);

    // 5. Login again (MFA now enabled)
    const login2 = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { firmId, email, password: "password123" },
    });
    expect(login2.statusCode).toBe(200);
    expect(login2.json()).toMatchObject({
      status: "mfa_required",
      mfaOptions: { webauthn: true },
    });

    // 6. Use recovery code to login
    const recoveryLogin = await server.inject({
      method: "POST",
      url: "/api/auth/recovery-codes/verify",
      payload: { firmId, email, code: codes[0] },
    });
    expect(recoveryLogin.statusCode).toBe(200);
    expect(recoveryLogin.json()).toHaveProperty("token");

    // 7. Verify recovery code is consumed
    const recoveryLogin2 = await server.inject({
      method: "POST",
      url: "/api/auth/recovery-codes/verify",
      payload: { firmId, email, code: codes[0] },
    });
    expect(recoveryLogin2.statusCode).toBe(401);
    // 8. List credentials
    const listCreds = await server.inject({
      method: "GET",
      url: "/api/auth/credentials",
      headers: { "x-open-practice-session": recoveryLogin.json().token },
    });
    expect(listCreds.statusCode).toBe(200);
    expect(listCreds.json()).toHaveLength(1);

    // 9. Delete credential
    const deleteCred = await server.inject({
      method: "DELETE",
      url: `/api/auth/credentials/${listCreds.json()[0].id}`,
      headers: { "x-open-practice-session": recoveryLogin.json().token },
    });
    expect(deleteCred.statusCode).toBe(200);

    // 10. Verify list is empty
    const listCreds2 = await server.inject({
      method: "GET",
      url: "/api/auth/credentials",
      headers: { "x-open-practice-session": recoveryLogin.json().token },
    });
    expect(listCreds2.json()).toHaveLength(0);
  });
});
