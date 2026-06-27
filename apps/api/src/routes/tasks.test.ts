import Fastify, { type FastifyInstance, type InjectOptions } from "fastify";
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
  it("rejects external client users from the staff task workbench", async () => {
    const response = await testServer({
      user: user("client_external", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks/workbench" });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ message: "Staff access required" });
  });

  it("returns matter-scoped workbench counters for visible task deadlines", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks/workbench" });
    const payload = response.json<{
      tasks: Array<{ id: string; matterId: string; bucket: string; completionStatus: string }>;
      taskReview: {
        summary: {
          total: number;
          highPriority: number;
          mediumPriority: number;
          lowPriority: number;
          schedulingReviewCount: number;
        };
        items: Array<{
          id: string;
          matterId: string;
          matterNumber: string;
          matterTitle: string;
          priority: string;
          tone: string;
          assignment: { scope: string; label: string; userId?: string };
          privacy: { matterScoped: boolean; clientVisible: boolean; visibility: string };
          scheduling: { requestCount: number; needsReviewCount: number };
          reviewBoundary: Record<string, boolean>;
        }>;
      };
      counters: {
        my: { overdue: number; today: number; upcoming: number };
        team: { overdue: number; today: number; upcoming: number };
        matterQueues: Array<{ matterId: string; overdue: number; today: number }>;
        contactQueues: Array<{ contactId: string; overdue: number; today: number }>;
      };
      focusQueues: {
        myOverdueTaskIds: string[];
        teamTodayTaskIds: string[];
      };
      suggestedFollowUps: Array<{
        id: string;
        matterId: string;
        title: string;
        source: { type: string; id: string; label: string };
      }>;
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
    expect(payload.focusQueues).toMatchObject({
      myOverdueTaskIds: ["task-deadline-001"],
      teamTodayTaskIds: ["task-deadline-002"],
    });
    expect(payload.suggestedFollowUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "legal-clinic-cadence:clinic-profile-matter-001:next_review_due",
          matterId: "matter-001",
          title: "Review legal clinic cadence",
          source: {
            type: "operational_view",
            id: "legal_clinic_cadence:clinic-profile-matter-001:next_review_due",
            label: "Legal clinic cadence",
          },
        }),
      ]),
    );
    expect(payload.taskReview.summary).toMatchObject({
      total: 3,
      highPriority: 1,
      mediumPriority: 1,
      lowPriority: 1,
      schedulingReviewCount: 2,
    });
    expect(payload.taskReview.items.map((item) => item.matterId)).toEqual([
      "matter-001",
      "matter-001",
      "matter-001",
    ]);
    expect(payload.taskReview.items[0]).toMatchObject({
      id: "task-deadline-001",
      matterNumber: "2026-0001",
      matterTitle: "Morgan tenancy dispute",
      priority: "high",
      tone: "risk",
      assignment: { scope: "current_user", label: "My task", userId: "user-licensee" },
      privacy: { matterScoped: true, clientVisible: false, visibility: "staff_only" },
      scheduling: { requestCount: 1, needsReviewCount: 1 },
      reviewBoundary: {
        courtRuleAutomation: false,
        providerSync: false,
        automaticDeadlineMutation: false,
        automaticReminderChanges: false,
        queueDelivery: false,
        automaticTimeEntryCreation: false,
      },
    });
    expect(payload.taskReview.items[1]).toMatchObject({
      id: "task-deadline-002",
      priority: "medium",
      assignment: { scope: "assigned_team", label: "Assigned team member" },
      scheduling: { requestCount: 1, needsReviewCount: 1 },
    });
    expect(JSON.stringify(payload.taskReview)).not.toContain("matter-002");
    expect(JSON.stringify(payload.taskReview)).not.toContain("contact-ada");
    expect(JSON.stringify(payload.taskReview)).not.toContain("trustBalanceCents");
    expect(JSON.stringify(payload.suggestedFollowUps)).not.toContain(
      "Synthetic operational note for clinic screening",
    );
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

  it("lists task records with lifecycle fields and filters by status and bucket", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks?status=open&bucket=overdue" });
    const payload = response.json<{
      tasks: Array<{
        id: string;
        matterId: string;
        status: string;
        priority: string;
        bucket: string;
        version: number;
      }>;
    }>();

    expect(response.statusCode).toBe(200);
    expect(payload.tasks).toEqual([
      expect.objectContaining({
        id: "task-deadline-001",
        matterId: "matter-001",
        status: "open",
        priority: "high",
        bucket: "overdue",
        version: 1,
      }),
    ]);
  });

  it("rejects cross-matter workbench reads for matter-scoped users", async () => {
    const response = await testServer({
      user: user("licensee", ["matter-001"]),
    }).inject({ method: "GET", url: "/api/tasks/workbench?matterId=matter-002" });

    expect(response.statusCode).toBe(403);
  });

  it("returns task detail only within the user's assigned matter scope", async () => {
    const server = testServer({
      user: user("licensee", ["matter-001"]),
    });

    const detailResponse = await server.inject({
      method: "GET",
      url: "/api/tasks/task-deadline-001",
    });
    const crossMatterResponse = await server.inject({
      method: "GET",
      url: "/api/tasks/task-deadline-003",
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      task: {
        id: "task-deadline-001",
        matterId: "matter-001",
        status: "open",
        priority: "high",
      },
    });
    expect(crossMatterResponse.statusCode).toBe(403);
  });

  it("rejects non-staff task lifecycle mutations", async () => {
    const server = testServer({
      user: user("client_external", ["matter-001"]),
    });
    const mutationRequests: InjectOptions[] = [
      { method: "POST", url: "/api/tasks", payload: { matterId: "matter-001", title: "Denied" } },
      { method: "PATCH", url: "/api/tasks/task-deadline-001", payload: { title: "Denied" } },
      { method: "PATCH", url: "/api/tasks/task-deadline-001/complete", payload: {} },
      { method: "PATCH", url: "/api/tasks/task-deadline-001/reopen", payload: {} },
      { method: "PATCH", url: "/api/tasks/task-deadline-001/archive", payload: {} },
    ];

    for (const request of mutationRequests) {
      const response = await server.inject(request);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ message: "Staff access required" });
    }
  });

  it("creates and updates staff task records with audit-safe metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    });
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        matterId: "matter-001",
        title: "Prepare synthetic hearing brief",
        description: "Synthetic staff-only task note.",
        assignedToUserId: "user-staff",
        priority: "high",
        sourceType: "manual",
        sourceId: "manual-brief",
        dueAt: "2026-05-03T18:00:00.000Z",
      },
    });
    const created = createResponse.json<{
      task: { id: string; status: string; priority: string; version: number };
    }>().task;

    expect(createResponse.statusCode).toBe(201);
    expect(created).toMatchObject({ status: "open", priority: "high", version: 1 });

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/api/tasks/${created.id}`,
      payload: {
        title: "Prepare updated synthetic hearing brief",
        assignedToUserId: null,
        priority: "medium",
        dueAt: "2026-05-04T18:00:00.000Z",
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      task: {
        id: created.id,
        title: "Prepare updated synthetic hearing brief",
        priority: "medium",
        sourceType: "manual",
        sourceId: "manual-brief",
        version: 2,
      },
    });

    const clearSourceResponse = await server.inject({
      method: "PATCH",
      url: `/api/tasks/${created.id}`,
      payload: {
        sourceType: null,
        sourceId: null,
      },
    });
    const clearSourcePayload = clearSourceResponse.json<{
      task: { sourceType?: string; sourceId?: string; version: number };
    }>();

    expect(clearSourceResponse.statusCode).toBe(200);
    expect(clearSourcePayload.task).toMatchObject({ version: 3 });
    expect(clearSourcePayload.task).not.toHaveProperty("sourceType");
    expect(clearSourcePayload.task).not.toHaveProperty("sourceId");
    await expect(repository.listAuditEvents("firm-west-legal")).resolves.toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({
          action: "task.created",
          resourceType: "task",
          resourceId: created.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            taskId: created.id,
            assignedToUserId: "user-staff",
            priority: "high",
            sourceType: "manual",
            sourceId: "manual-brief",
          }),
        }),
        expect.objectContaining({
          action: "task.updated",
          resourceType: "task",
          resourceId: created.id,
          metadata: expect.objectContaining({
            matterId: "matter-001",
            taskId: created.id,
            assignmentChanged: true,
            dueAtChanged: true,
            sourceChanged: false,
          }),
        }),
      ]),
      valid: true,
    });
  });

  it("rejects empty and invalid-source task updates", async () => {
    const server = testServer({
      user: user("licensee", ["matter-001"]),
    });

    const emptyPatchResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-001",
      payload: {},
    });
    const sourceTypeOnlyResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-001",
      payload: { sourceType: "manual" },
    });
    const clearSourceTypeOnlyResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-001",
      payload: { sourceType: null },
    });
    const clearSourceIdOnlyResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-001",
      payload: { sourceId: null },
    });
    const sourceIdOnlyResponse = await server.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        matterId: "matter-001",
        title: "Synthetic invalid source",
        sourceId: "manual-only",
      },
    });

    expect(emptyPatchResponse.statusCode).toBe(400);
    expect(emptyPatchResponse.json()).toMatchObject({
      message: "Task update requires a changed field",
    });
    expect(sourceTypeOnlyResponse.statusCode).toBe(400);
    expect(clearSourceTypeOnlyResponse.statusCode).toBe(400);
    expect(clearSourceIdOnlyResponse.statusCode).toBe(400);
    expect(sourceIdOnlyResponse.statusCode).toBe(400);
  });

  it("rejects task creation when the assignee cannot read the matter", async () => {
    const response = await testServer({
      user: user("owner_admin", ["matter-001", "matter-002"]),
    }).inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        matterId: "matter-002",
        title: "Synthetic cross-matter assignment",
        assignedToUserId: "user-staff",
        priority: "medium",
      },
    });

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
        status: "completed",
        completedAt: "2026-05-02T18:00:00.000Z",
        completedByUserId: "user-licensee",
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

  it("reopens and archives task records while hiding archived rows by default", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    });

    const completeResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-002/complete",
      payload: { completedAt: "2026-05-02T18:00:00.000Z" },
    });
    expect(completeResponse.statusCode).toBe(200);

    const reopenResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-002/reopen",
      payload: {},
    });
    expect(reopenResponse.statusCode).toBe(200);
    expect(reopenResponse.json()).toMatchObject({
      task: { id: "task-deadline-002", status: "open" },
      reopening: {
        taskId: "task-deadline-002",
        matterId: "matter-001",
        reopenedByUserId: "user-licensee",
        auditSafe: true,
      },
    });

    const archiveResponse = await server.inject({
      method: "PATCH",
      url: "/api/tasks/task-deadline-002/archive",
      payload: {},
    });
    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json()).toMatchObject({
      task: { id: "task-deadline-002", status: "archived" },
      archive: {
        taskId: "task-deadline-002",
        matterId: "matter-001",
        archivedByUserId: "user-licensee",
        auditSafe: true,
      },
    });

    const defaultList = await server.inject({
      method: "GET",
      url: "/api/tasks?matterId=matter-001",
    });
    expect(defaultList.statusCode).toBe(200);
    expect(JSON.stringify(defaultList.json())).not.toContain("task-deadline-002");

    const archivedList = await server.inject({
      method: "GET",
      url: "/api/tasks?matterId=matter-001&includeArchived=true",
    });
    expect(archivedList.statusCode).toBe(200);
    expect(archivedList.json()).toMatchObject({
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: "task-deadline-002", status: "archived" }),
      ]),
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

  it("manages structured task detail with staff-only comments and audit-safe metadata", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({
      repository,
      user: user("licensee", ["matter-001"]),
    });

    const templateResponse = await server.inject({
      method: "POST",
      url: "/api/task-templates",
      payload: {
        name: "Synthetic hearing prep",
        defaultTitle: "Synthetic hearing task",
        defaultPriority: "high",
        items: [{ title: "Synthetic template checklist private title", dueOffsetDays: 1 }],
      },
    });
    expect(templateResponse.statusCode).toBe(201);
    const template = templateResponse.json<{ template: { id: string } }>().template;

    const checklistResponse = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-001/checklist-items",
      payload: {
        title: "Synthetic checklist private title",
        assignedToUserId: "user-licensee",
        dueAt: "2026-05-03T18:00:00.000Z",
      },
    });
    expect(checklistResponse.statusCode).toBe(201);
    const checklistItem = checklistResponse.json<{ checklistItem: { id: string } }>().checklistItem;

    const completeChecklistResponse = await server.inject({
      method: "PATCH",
      url: `/api/tasks/task-deadline-001/checklist-items/${checklistItem.id}/complete`,
      payload: {},
    });
    expect(completeChecklistResponse.statusCode).toBe(200);

    const commentResponse = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-001/comments",
      payload: { body: "Synthetic staff-only comment body" },
    });
    expect(commentResponse.statusCode).toBe(201);
    expect(commentResponse.json()).toMatchObject({
      comment: {
        taskId: "task-deadline-001",
        body: "Synthetic staff-only comment body",
      },
    });

    const dependencyResponse = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-001/dependencies",
      payload: { dependsOnTaskId: "task-deadline-002", dependencyType: "blocks" },
    });
    expect(dependencyResponse.statusCode).toBe(201);

    const applyResponse = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-001/apply-template",
      payload: { templateId: template.id },
    });
    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.json()).toMatchObject({
      createdChecklistItemIds: expect.arrayContaining([expect.any(String)]),
    });

    const structureResponse = await server.inject({
      method: "GET",
      url: "/api/tasks/task-deadline-001/structure",
    });
    expect(structureResponse.statusCode).toBe(200);
    expect(structureResponse.json()).toMatchObject({
      structure: {
        task: { id: "task-deadline-001", matterId: "matter-001" },
        checklistProgress: { completed: 1, total: 2 },
        dependencySummary: {
          blocks: 1,
          blockingTaskIds: ["task-deadline-002"],
        },
        commentSummary: { count: 1 },
        structureBoundary: {
          staffOnlyComments: true,
          clientVisible: false,
          automaticDeadlineMutation: false,
          providerSync: false,
        },
      },
    });

    const audit = await repository.listAuditEvents("firm-west-legal");
    const serializedAudit = JSON.stringify(audit.events);
    expect(audit.valid).toBe(true);
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "task.checklist_item.created",
          metadata: expect.objectContaining({
            taskId: "task-deadline-001",
            matterId: "matter-001",
            checklistItemId: checklistItem.id,
            assignedToUserId: "user-licensee",
          }),
        }),
        expect.objectContaining({
          action: "task.comment.added",
          metadata: expect.objectContaining({
            taskId: "task-deadline-001",
            matterId: "matter-001",
            commentCount: 1,
            staffOnly: true,
          }),
        }),
        expect.objectContaining({
          action: "task.template.applied",
          metadata: expect.objectContaining({
            taskId: "task-deadline-001",
            templateId: template.id,
            checklistItemCount: 1,
            appliedToExistingTask: true,
          }),
        }),
      ]),
    );
    expect(serializedAudit).not.toContain("Synthetic staff-only comment body");
    expect(serializedAudit).not.toContain("Synthetic checklist private title");
    expect(serializedAudit).not.toContain("Synthetic template checklist private title");
    expect(serializedAudit).not.toContain("Synthetic hearing prep");
  });

  it("rejects client access, non-admin template administration, and invalid dependencies", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    const clientStructureResponse = await testServer({
      repository,
      user: user("client_external", ["matter-001"]),
    }).inject({
      method: "GET",
      url: "/api/tasks/task-deadline-001/structure",
    });
    expect(clientStructureResponse.statusCode).toBe(403);

    const firmMemberTemplateResponse = await testServer({
      repository,
      user: user("firm_member", ["matter-001"]),
    }).inject({
      method: "POST",
      url: "/api/task-templates",
      payload: { name: "Denied synthetic template" },
    });
    expect(firmMemberTemplateResponse.statusCode).toBe(403);
    expect(firmMemberTemplateResponse.json()).toMatchObject({
      message: "Task template administration requires owner administrator or licensee access",
    });

    const server = testServer({
      repository,
      user: user("licensee", ["matter-001", "matter-002"]),
    });
    const crossMatterDependency = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-001/dependencies",
      payload: { dependsOnTaskId: "task-deadline-003", dependencyType: "blocks" },
    });
    expect(crossMatterDependency.statusCode).toBe(400);
    expect(crossMatterDependency.json()).toMatchObject({
      message: "Task dependencies must stay within the same matter",
    });

    const forwardDependency = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-001/dependencies",
      payload: { dependsOnTaskId: "task-deadline-002", dependencyType: "blocks" },
    });
    expect(forwardDependency.statusCode).toBe(201);

    const cycleDependency = await server.inject({
      method: "POST",
      url: "/api/tasks/task-deadline-002/dependencies",
      payload: { dependsOnTaskId: "task-deadline-001", dependencyType: "blocks" },
    });
    expect(cycleDependency.statusCode).toBe(409);
    expect(cycleDependency.json()).toMatchObject({
      message: "Task dependency would create a blocking cycle",
    });
  });
});
