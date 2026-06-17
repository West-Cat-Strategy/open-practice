import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import { hashToken, isPublicRoute } from "../http/auth-helpers.js";
import { registerAuthRoutes } from "./auth.js";

const servers: FastifyInstance[] = [];
const jwtSecret = "test-secret-at-least-32-chars-long";
const firmId = "firm-1";
const ownerUserId = "owner-1";
const targetUserId = "target-1";

async function testRepository(): Promise<OpenPracticeRepository> {
  const repository = new InMemoryOpenPracticeRepository({
    seedSampleData: false,
    firms: [{ id: firmId, name: "Test Firm", defaultProvince: "BC" }],
  });
  await repository.createUser({
    id: ownerUserId,
    firmId,
    displayName: "Test Owner",
    email: "owner@example.test",
    role: "owner_admin",
    assignedMatterIds: [],
    mfaEnabled: true,
  });
  await repository.createUser({
    id: targetUserId,
    firmId,
    displayName: "Test Target",
    email: "target@example.test",
    role: "firm_member",
    assignedMatterIds: [],
    mfaEnabled: false,
  });
  await repository.createAuthSession({
    id: "owner-session",
    firmId,
    userId: ownerUserId,
    tokenHash: hashToken("owner-session-token", jwtSecret),
    createdAt: new Date().toISOString(),
    freshAuthenticatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return repository;
}

function testServer(repository: OpenPracticeRepository): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
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
  registerAuthRoutes(server, {
    repository,
    jwtSecret,
    sessionTtlHours: 1,
    nodeEnv: "development",
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("auth credential routes", () => {
  it("audits password setup token creation and password completion without raw secrets", async () => {
    const repository = await testRepository();
    const server = testServer(repository);

    const setupToken = await server.inject({
      method: "POST",
      url: "/api/auth/password-setup-tokens",
      headers: { "x-open-practice-session": "owner-session-token" },
      payload: {
        userId: targetUserId,
        expiresInHours: 6,
      },
    });
    expect(setupToken.statusCode).toBe(200);
    const rawToken = setupToken.json<{ token: string }>().token;

    const complete = await server.inject({
      method: "POST",
      url: "/api/auth/password-setup",
      payload: {
        userId: targetUserId,
        token: rawToken,
        password: "new-password-123",
      },
    });
    expect(complete.statusCode).toBe(200);

    const audit = await repository.listAuditEvents(firmId);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "auth_credential.password_setup_token.created",
          resourceType: "auth_credential",
          actorId: ownerUserId,
          metadata: {
            userId: targetUserId,
            expiresInHours: 6,
          },
        }),
        expect.objectContaining({
          action: "auth_credential.password.updated",
          resourceType: "auth_credential",
          actorId: targetUserId,
          resourceId: targetUserId,
          metadata: {
            userId: targetUserId,
            method: "password_setup_token",
          },
        }),
      ]),
    );
    const serializedAudit = JSON.stringify(audit.events);
    expect(serializedAudit).not.toContain(rawToken);
    expect(serializedAudit).not.toContain("new-password-123");
    expect(serializedAudit).not.toContain("tokenHash");
  });
});
