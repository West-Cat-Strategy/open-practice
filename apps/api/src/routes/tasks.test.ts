import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryOpenPracticeRepository,
  type OpenPracticeRepository,
} from "@open-practice/database";
import type { ProfessionalRole, User } from "@open-practice/domain";
import { registerTaskRoutes } from "./tasks.js";

const servers: FastifyInstance[] = [];
const fixedNow = new Date("2026-05-02T16:00:00.000Z");

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
    user?: User;
  } = {},
): FastifyInstance {
  const repository = input.repository ?? new InMemoryOpenPracticeRepository();
  const authUser = input.user ?? user("owner_admin");
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerTaskRoutes(server, { repository });
  servers.push(server);
  return server;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(fixedNow);
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("task routes", () => {
  it("returns matter-scoped workbench counters for visible task deadlines", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks/workbench" });
    const payload = response.json<{
      tasks: Array<{ id: string; matterId: string; bucket: string; completionStatus: string }>;
      counters: {
        my: { overdue: number; today: number; upcoming: number };
        team: { overdue: number; today: number; upcoming: number };
        matterQueues: Array<{ matterId: string; overdue: number; today: number }>;
        contactQueues: Array<{ contactId: string; overdue: number; today: number }>;
      };
    }>();

    expect(response.statusCode).toBe(200);
    expect(payload.tasks.map((task) => task.matterId)).toEqual([
      "matter-001",
      "matter-001",
      "matter-001",
    ]);
    expect(payload.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-deadline-001",
          bucket: "overdue",
          completionStatus: "open",
        }),
      ]),
    );
    expect(payload.counters.my).toEqual({ overdue: 1, today: 0, upcoming: 0 });
    expect(payload.counters.team).toEqual({ overdue: 1, today: 1, upcoming: 0 });
    expect(payload.counters.matterQueues).toEqual([
      expect.objectContaining({ matterId: "matter-001", overdue: 1, today: 1 }),
    ]);
    expect(payload.counters.contactQueues).toEqual([
      expect.objectContaining({ contactId: "contact-ada", overdue: 1, today: 1 }),
    ]);
  });

  it("honors includeCompleted=false query parsing", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks/workbench?includeCompleted=false" });
    const payload = response.json<{
      tasks: Array<{ id: string; completionStatus: string }>;
    }>();

    expect(response.statusCode).toBe(200);
    expect(payload.tasks).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-deadline-004", completionStatus: "completed" }),
      ]),
    );
  });

  it("rejects cross-matter workbench reads for matter-scoped users", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks/workbench?matterId=matter-002" });

    expect(response.statusCode).toBe(403);
  });

  it("completes task deadlines with audit-safe metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const response = await testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    }).inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-002/complete",
      payload: { completedAt: "2026-05-02T18:00:00.000Z" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      task: {
        id: "task-deadline-002",
        completedAt: "2026-05-02T18:00:00.000Z",
      },
      completion: {
        taskId: "task-deadline-002",
        matterId: "matter-001",
        completedByUserId: "user-licensee",
        auditSafe: true,
      },
    });
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "task.completed",
          resourceType: "task",
          resourceId: "task-deadline-002",
          metadata: {
            matterId: "matter-001",
            taskId: "task-deadline-002",
            assignedToUserId: "user-staff",
            completedByUserId: "user-licensee",
          },
        }),
      ]),
      valid: true,
    });
  });

  it("rejects task completion outside the user's assigned matter scope", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-003/complete",
      payload: { completedAt: "2026-05-02T18:00:00.000Z" },
    });

    expect(response.statusCode).toBe(403);
  });
});
