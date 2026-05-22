import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { normalizeApiError } from "../http/response.js";
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

interface SavedOperationalViewDefinitionsResponse {
  definitions: Array<{
    id: string;
    ownerUserId: string;
    surface: string;
    name: string;
    filters: Record<string, unknown>;
    columns: unknown[];
    sort: Record<string, unknown>;
    rowLimit: number;
    dashboardBehavior: Record<string, unknown>;
    permissionScope: string[];
    status: string;
    archivedAt?: string;
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
  server.setErrorHandler((error, _request, reply) => {
    const normalized = normalizeApiError(error);
    reply.status(normalized.statusCode).send(normalized.body);
  });
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

  it("creates and returns private saved operational view definitions for the owner only", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const ownerServer = testServer({ repository, authUser: user("licensee", ["matter-001"]) });
    const created = await ownerServer.inject({
      method: "POST",
      url: "/api/operational-views/definitions",
      payload: {
        surface: "queues",
        name: "My queue focus",
        filters: { queue: "task-deadlines" },
        columns: ["title", "status"],
        sort: { dueAt: "asc" },
        rowLimit: 12,
        dashboardBehavior: { pinToFocus: true },
        permissionScope: ["matter:read", "task:read"],
      },
    });
    const createdPayload = created.json<{
      definition: SavedOperationalViewDefinitionsResponse["definitions"][number];
    }>();

    expect(created.statusCode).toBe(200);
    expect(createdPayload.definition).toMatchObject({
      ownerUserId: "user-licensee",
      surface: "queues",
      name: "My queue focus",
      filters: { queue: "task-deadlines" },
      columns: ["title", "status"],
      rowLimit: 12,
      permissionScope: ["matter:read", "task:read"],
      status: "active",
    });

    const listed = await ownerServer.inject({
      method: "GET",
      url: "/api/operational-views/definitions?surface=queues",
    });
    expect(listed.json<SavedOperationalViewDefinitionsResponse>().definitions).toEqual([
      expect.objectContaining({ id: createdPayload.definition.id, name: "My queue focus" }),
    ]);

    const createdMatterView = await ownerServer.inject({
      method: "POST",
      url: "/api/operational-views/definitions",
      payload: {
        surface: "matters",
        name: "Matter follow-up",
        filters: {
          presetFamily: "matter_follow_up",
          operationalViewKeys: ["stale_matters", "uncontacted_clients"],
        },
        columns: ["number", "practiceArea", "status"],
        sort: { priority: "desc" },
        rowLimit: 12,
        dashboardBehavior: { pinToMatterContext: true },
        permissionScope: ["matter:read"],
      },
    });
    expect(createdMatterView.statusCode).toBe(200);

    const listedMatterViews = await ownerServer.inject({
      method: "GET",
      url: "/api/operational-views/definitions?surface=matters",
    });
    expect(listedMatterViews.json<SavedOperationalViewDefinitionsResponse>().definitions).toEqual([
      expect.objectContaining({ name: "Matter follow-up", surface: "matters" }),
    ]);

    const otherUserServer = testServer({
      repository,
      authUser: {
        ...user("licensee", ["matter-001"]),
        id: "user-other-licensee",
        email: "other@example.test",
      },
    });
    const otherUserList = await otherUserServer.inject({
      method: "GET",
      url: "/api/operational-views/definitions?includeArchived=true",
    });
    expect(otherUserList.json<SavedOperationalViewDefinitionsResponse>().definitions).toEqual([]);
  });

  it("accepts dashboard matter preset family filters for saved matter views", async () => {
    const server = testServer({ repository: new InMemoryOpenPracticeRepository() });
    const presets = [
      {
        family: "matter_risk_review",
        name: "Matter risk review",
        operationalViewKeys: ["conflicts_pending_review", "external_uploads_expiring"],
      },
      {
        family: "matter_action_required",
        name: "Matter action required",
        operationalViewKeys: ["awaiting_signature", "overdue_tasks_deadlines"],
      },
    ];

    for (const preset of presets) {
      const response = await server.inject({
        method: "POST",
        url: "/api/operational-views/definitions",
        payload: {
          surface: "matters",
          name: preset.name,
          filters: {
            source: "dashboard-matters",
            presetFamily: preset.family,
            operationalViewKeys: preset.operationalViewKeys,
            statuses: ["intake", "open", "paused"],
          },
          columns: ["number", "practiceArea", "status"],
          sort: { priority: "desc", dueAt: "asc" },
          rowLimit: 12,
          dashboardBehavior: { pinToMatterContext: true },
          permissionScope: ["matter:read"],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(
        response.json<{
          definition: SavedOperationalViewDefinitionsResponse["definitions"][number];
        }>().definition,
      ).toMatchObject({
        surface: "matters",
        name: preset.name,
        filters: expect.objectContaining({
          presetFamily: preset.family,
          operationalViewKeys: preset.operationalViewKeys,
        }),
      });
    }

    const listed = await server.inject({
      method: "GET",
      url: "/api/operational-views/definitions?surface=matters",
    });

    expect(listed.json<SavedOperationalViewDefinitionsResponse>().definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Matter risk review",
          filters: expect.objectContaining({ presetFamily: "matter_risk_review" }),
        }),
        expect.objectContaining({
          name: "Matter action required",
          filters: expect.objectContaining({ presetFamily: "matter_action_required" }),
        }),
      ]),
    );
  });

  it("rejects invalid dashboard matter preset filters for saved matter view creation and patching", async () => {
    const server = testServer({ repository: new InMemoryOpenPracticeRepository() });
    const invalidFilters = [
      { label: "missing", filters: { source: "dashboard-matters" } },
      { label: "empty", filters: { source: "dashboard-matters", presetFamily: "" } },
      {
        label: "unsupported",
        filters: { source: "dashboard-matters", presetFamily: "matter_everything" },
      },
    ];
    const basePayload = {
      surface: "matters",
      name: "Matter preset",
      columns: ["number", "practiceArea", "status"],
      sort: { priority: "desc" },
      rowLimit: 12,
      dashboardBehavior: { pinToMatterContext: true },
      permissionScope: ["matter:read"],
    };

    for (const invalid of invalidFilters) {
      const response = await server.inject({
        method: "POST",
        url: "/api/operational-views/definitions",
        payload: {
          ...basePayload,
          name: `Matter preset ${invalid.label}`,
          filters: invalid.filters,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "INVALID_MATTER_PRESET_FILTER" },
      });
    }

    const created = await server.inject({
      method: "POST",
      url: "/api/operational-views/definitions",
      payload: {
        ...basePayload,
        name: "Matter follow-up",
        filters: {
          source: "dashboard-matters",
          presetFamily: "matter_follow_up",
          operationalViewKeys: ["stale_matters", "uncontacted_clients"],
        },
      },
    });
    expect(created.statusCode).toBe(200);
    const id = created.json<{ definition: { id: string } }>().definition.id;

    const patchWithoutFilters = await server.inject({
      method: "PATCH",
      url: `/api/operational-views/definitions/${id}`,
      payload: { name: "Matter follow-up renamed" },
    });
    expect(patchWithoutFilters.statusCode).toBe(200);

    const allowedPatch = await server.inject({
      method: "PATCH",
      url: `/api/operational-views/definitions/${id}`,
      payload: {
        filters: {
          source: "dashboard-matters",
          presetFamily: "matter_action_required",
          operationalViewKeys: ["awaiting_signature", "overdue_tasks_deadlines"],
        },
      },
    });
    expect(allowedPatch.statusCode).toBe(200);

    for (const invalid of invalidFilters) {
      const response = await server.inject({
        method: "PATCH",
        url: `/api/operational-views/definitions/${id}`,
        payload: { filters: invalid.filters },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "INVALID_MATTER_PRESET_FILTER" },
      });
    }
  });

  it("updates and archives saved operational view definitions without showing archived rows by default", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    const created = await server.inject({
      method: "POST",
      url: "/api/operational-views/definitions",
      payload: {
        surface: "queues",
        name: "Queue exceptions",
        permissionScope: ["audit_log:read"],
      },
    });
    const id = created.json<{ definition: { id: string } }>().definition.id;

    const updated = await server.inject({
      method: "PATCH",
      url: `/api/operational-views/definitions/${id}`,
      payload: {
        name: "Audit queue exceptions",
        filters: { queue: "audit" },
        rowLimit: 5,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(
      updated.json<{ definition: { name: string; rowLimit: number; filters: unknown } }>()
        .definition,
    ).toMatchObject({
      name: "Audit queue exceptions",
      rowLimit: 5,
      filters: { queue: "audit" },
    });

    const archived = await server.inject({
      method: "POST",
      url: `/api/operational-views/definitions/${id}/archive`,
    });
    expect(archived.statusCode).toBe(200);
    expect(
      archived.json<{ definition: { status: string; archivedAt?: string } }>().definition,
    ).toMatchObject({
      status: "archived",
      archivedAt: expect.any(String),
    });

    const activeOnly = await server.inject({
      method: "GET",
      url: "/api/operational-views/definitions",
    });
    expect(activeOnly.json<SavedOperationalViewDefinitionsResponse>().definitions).toEqual([]);

    const includingArchived = await server.inject({
      method: "GET",
      url: "/api/operational-views/definitions?includeArchived=true",
    });
    expect(includingArchived.json<SavedOperationalViewDefinitionsResponse>().definitions).toEqual([
      expect.objectContaining({ id, status: "archived" }),
    ]);
  });

  it("rejects saved operational view scopes that exceed the current user's capabilities", async () => {
    const response = await testServer({ authUser: user("firm_member", ["matter-001"]) }).inject({
      method: "POST",
      url: "/api/operational-views/definitions",
      payload: {
        surface: "queues",
        name: "Audit review",
        permissionScope: ["audit_log:read"],
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: { code: "OPERATIONAL_VIEW_SCOPE_FORBIDDEN" },
    });
  });
});
