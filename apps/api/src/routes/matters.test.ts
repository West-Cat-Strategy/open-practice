import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type MatterSummary,
  type OpenPracticeRepository,
} from "@open-practice/database";
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

function testServer(
  authUser: User,
  repository: OpenPracticeRepository = new InMemoryOpenPracticeRepository(),
): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId, user: authUser };
  });
  registerMatterRoutes(server, { repository });
  server.setErrorHandler((error, _request, reply) => {
    const normalizedError = error as Error & { statusCode?: number };
    reply.status(normalizedError.statusCode ?? 400).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });
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

  it("lists firm matters for firm-wide readers without assignments", async () => {
    const response = await testServer(user("owner_admin", [])).inject({
      method: "GET",
      url: "/api/matters",
    });

    expect(response.statusCode).toBe(200);
    const matters = response.json<MatterSummary[]>();
    expect(matters.map((matter) => matter.id)).toEqual(
      expect.arrayContaining(["matter-001", "matter-002"]),
    );
  });

  it("keeps matter-scoped readers assignment-limited when no matters are assigned", async () => {
    const response = await testServer(user("licensee", [])).inject({
      method: "GET",
      url: "/api/matters",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("creates a first matter with a client, assignment, scoped listing, and safe audit metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer(user("licensee", []), repository).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "Synthetic starter intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
          email: "synthetic.client@example.test",
          phone: "+1-555-0100",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const created = response.json<MatterSummary>();
    expect(created).toMatchObject({
      title: "Synthetic starter intake",
      practiceArea: "Residential tenancy",
      jurisdiction: "BC",
      status: "intake",
      responsibleUserId: "user-licensee",
    });
    expect(created.number).toMatch(new RegExp(`^${new Date().getUTCFullYear()}-\\d{4}$`));
    expect(created.parties).toHaveLength(1);
    expect(created.parties[0]).toMatchObject({
      role: "prospective_client",
      adverse: false,
      confidential: true,
      contact: {
        kind: "person",
        displayName: "Synthetic Client",
        identifiers: [
          { type: "email", value: "synthetic.client@example.test" },
          { type: "phone", value: "+1-555-0100" },
        ],
      },
    });

    const refreshedUser = await repository.getUser(firmId, "user-licensee");
    expect(refreshedUser?.assignedMatterIds).toContain(created.id);
    expect(
      (await repository.listMattersForUser(refreshedUser!)).some(
        (matter) => matter.id === created.id,
      ),
    ).toBe(true);

    const audit = await repository.listAuditEvents(firmId);
    const createdEvent = audit.events.find(
      (event) => event.action === "matter.opened" && event.resourceId === created.id,
    );
    expect(createdEvent).toMatchObject({
      actorId: "user-licensee",
      resourceType: "matter",
      metadata: {
        matterId: created.id,
        source: "dashboard_zero_matter",
        clientContactCreated: true,
        partyRole: "prospective_client",
      },
    });
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("Synthetic Client");
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("synthetic.client@example.test");
    expect(JSON.stringify(createdEvent?.metadata)).not.toContain("+1-555-0100");
  });

  it("validates first matter creation requests", async () => {
    const response = await testServer(user("licensee", [])).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
          email: "not-an-email",
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("denies matter creation to roles without matter:create", async () => {
    const response = await testServer(user("firm_member", [])).inject({
      method: "POST",
      url: "/api/matters",
      payload: {
        title: "Synthetic starter intake",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        client: {
          kind: "person",
          displayName: "Synthetic Client",
        },
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
