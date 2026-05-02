import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerOperationalViewRoutes } from "./operational-views.js";

const servers: FastifyInstance[] = [];

interface OperationalViewResponse {
  generatedAt: string;
  views: Array<{
    definition: { key: string };
    resultCount: number;
    results: Array<{
      id: string;
      matterId?: string;
      title: string;
      metadata: Record<string, unknown>;
    }>;
  }>;
}

function user(
  role: ProfessionalRole,
  assignedMatterIds: string[] = ["matter-001", "matter-002"],
): User {
  return {
    id: `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  input: {
    repository?: OpenPracticeRepository;
    authUser?: User;
  } = {},
): FastifyInstance {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.authUser ?? user("owner_admin");
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerOperationalViewRoutes(server, { repository });
  servers.push(server);
  return server;
}

function view(payload: OperationalViewResponse, key: string) {
  const found = payload.views.find((candidate) => candidate.definition.key === key);
  expect(found).toBeDefined();
  return found!;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("operational view routes", () => {
  it("returns built-in saved operational view results from visible matter data", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createExternalUploadLink({
      id: "external-upload-expiring",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      tokenHash: "hidden-token-hash",
      requestedByUserId: "user-licensee",
      expiresAt: "2026-06-21T12:00:00.000Z",
      maxUploads: 2,
      usedUploads: 0,
      createdAt: "2026-06-01T12:00:00.000Z",
    });

    const response = await testServer({ repository }).inject({
      method: "GET",
      url: "/api/operational-views?now=2026-06-20T12:00:00.000Z",
    });
    const payload = response.json<OperationalViewResponse>();

    expect(response.statusCode).toBe(200);
    expect(payload.generatedAt).toBe("2026-06-20T12:00:00.000Z");
    expect(payload.views.map((candidate) => candidate.definition.key)).toEqual([
      "stale_matters",
      "uncontacted_clients",
      "awaiting_signature",
      "external_uploads_expiring",
      "conflicts_pending_review",
      "overdue_tasks_deadlines",
    ]);
    expect(view(payload, "stale_matters").results).toEqual(
      expect.arrayContaining([expect.objectContaining({ matterId: "matter-001" })]),
    );
    expect(view(payload, "uncontacted_clients").results).toEqual(
      expect.arrayContaining([expect.objectContaining({ matterId: "matter-002" })]),
    );
    expect(view(payload, "awaiting_signature").results).toEqual([
      expect.objectContaining({ id: "signature:sig-001", matterId: "matter-001" }),
    ]);
    expect(view(payload, "external_uploads_expiring").results).toEqual([
      expect.objectContaining({
        id: "external-upload:external-upload-expiring",
        matterId: "matter-001",
        metadata: expect.objectContaining({ remainingUploads: 2 }),
      }),
    ]);
    expect(view(payload, "conflicts_pending_review").resultCount).toBeGreaterThan(0);
    expect(view(payload, "overdue_tasks_deadlines").results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "calendar:calendar-event-001", matterId: "matter-001" }),
      ]),
    );
    expect(JSON.stringify(payload)).not.toContain("hidden-token-hash");
  });

  it("keeps matter-scoped users limited to their assigned matter results", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createExternalUploadLink({
      id: "external-upload-hidden",
      firmId: "firm-west-legal",
      matterId: "matter-002",
      tokenHash: "matter-two-token-hash",
      requestedByUserId: "user-admin",
      expiresAt: "2026-06-21T12:00:00.000Z",
      maxUploads: 1,
      usedUploads: 0,
      createdAt: "2026-06-01T12:00:00.000Z",
    });

    const response = await testServer({
      repository,
      authUser: user("licensee", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/operational-views?now=2026-06-20T12:00:00.000Z",
    });
    const payload = response.json<OperationalViewResponse>();
    const allResults = payload.views.flatMap((candidate) => candidate.results);

    expect(response.statusCode).toBe(200);
    expect(allResults).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ matterId: "matter-002" })]),
    );
    expect(JSON.stringify(payload)).not.toContain("matter-two-token-hash");
  });
});
