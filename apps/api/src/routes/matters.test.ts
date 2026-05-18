import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerMatterRoutes } from "./matters.js";

const firmId = "firm-west-legal";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  return {
    id: `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(authUser: User): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: authUser };
  });
  registerMatterRoutes(server, { repository: new InMemoryOpenPracticeRepository() });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("matter routes", () => {
  it("returns full firm overview only to firm-wide readers", async () => {
    const response = await testServer(user("owner_admin", ["matter-001", "matter-002"])).inject({
      method: "GET",
      url: "/api/overview",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      metrics: {
        openMatters: 1,
        intakeMatters: 1,
        portalGrants: expect.any(Number),
      },
    });
    expect(response.json().users.length).toBeGreaterThan(1);
  });

  it("scopes overview metrics and users for matter-scoped readers", async () => {
    const response = await testServer(user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/overview",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      metrics: {
        openMatters: 1,
        intakeMatters: 0,
        portalGrants: 0,
      },
      users: [
        {
          id: "user-licensee",
          role: "licensee",
          assignedMatterIds: ["matter-001"],
        },
      ],
    });
  });
});
