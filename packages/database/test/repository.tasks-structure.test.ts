import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

const firmId = "firm-west-legal";
const matterId = "matter-001";
const userId = "user-licensee";
const now = "2026-05-02T16:00:00.000Z";

describe("repository structured task records", () => {
  it("stores checklist items, comments, dependencies, and reusable task templates", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    const checklistItem = await repository.createTaskChecklistItem({
      id: "checklist-structure-test",
      firmId,
      matterId,
      taskId: "task-deadline-001",
      title: "Synthetic checklist item",
      createdAt: now,
      createdByUserId: userId,
      updatedAt: now,
      updatedByUserId: userId,
    });
    await repository.createTaskComment({
      id: "comment-structure-test",
      firmId,
      matterId,
      taskId: "task-deadline-001",
      body: "Synthetic staff-only comment.",
      createdAt: now,
      createdByUserId: userId,
    });
    await repository.createTaskDependency({
      id: "dependency-structure-test",
      firmId,
      matterId,
      taskId: "task-deadline-001",
      dependsOnTaskId: "task-deadline-002",
      dependencyType: "blocks",
      createdAt: now,
      createdByUserId: userId,
    });
    const template = await repository.createTaskTemplate({
      template: {
        id: "template-structure-test",
        firmId,
        name: "Synthetic reusable task",
        defaultPriority: "high",
        createdAt: now,
        createdByUserId: userId,
      },
      items: [
        {
          id: "template-item-structure-test",
          firmId,
          templateId: "template-structure-test",
          title: "Synthetic reusable checklist item",
          createdAt: now,
          createdByUserId: userId,
        },
      ],
    });

    await expect(
      repository.updateTaskChecklistItem({
        firmId,
        itemId: checklistItem.id,
        status: "completed",
        completedAt: now,
        completedByUserId: userId,
        updatedAt: now,
        updatedByUserId: userId,
      }),
    ).resolves.toMatchObject({ status: "completed", version: 2 });
    await expect(
      repository.listTaskChecklistItems(firmId, { taskId: "task-deadline-001" }),
    ).resolves.toHaveLength(1);
    await expect(
      repository.listTaskComments(firmId, { taskId: "task-deadline-001" }),
    ).resolves.toHaveLength(1);
    await expect(
      repository.listTaskDependencies(firmId, { taskId: "task-deadline-001" }),
    ).resolves.toEqual([expect.objectContaining({ dependencyType: "blocks" })]);
    expect(template).toMatchObject({
      template: { id: "template-structure-test", defaultPriority: "high", status: "active" },
      items: [{ id: "template-item-structure-test" }],
    });

    const updatedTemplate = await repository.updateTaskTemplate({
      firmId,
      templateId: "template-structure-test",
      defaultPriority: "medium",
      updatedAt: now,
      updatedByUserId: userId,
      items: [
        {
          id: "template-item-structure-replacement",
          firmId,
          templateId: "template-structure-test",
          title: "Replacement synthetic item",
          createdAt: now,
          createdByUserId: userId,
        },
      ],
    });
    expect(updatedTemplate).toMatchObject({
      template: { defaultPriority: "medium", version: 2 },
      items: [{ id: "template-item-structure-replacement" }],
    });

    await expect(
      repository.archiveTaskTemplate({
        firmId,
        templateId: "template-structure-test",
        archivedAt: now,
        archivedByUserId: userId,
      }),
    ).resolves.toMatchObject({ status: "archived" });
    await expect(repository.listTaskTemplates(firmId)).resolves.toEqual([]);
    await expect(
      repository.listTaskTemplates(firmId, { includeArchived: true }),
    ).resolves.toHaveLength(1);
  });

  it("rejects active duplicate dependencies and blocking cycles", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createTaskDependency({
      id: "dependency-forward",
      firmId,
      matterId,
      taskId: "task-deadline-001",
      dependsOnTaskId: "task-deadline-002",
      dependencyType: "blocks",
      createdAt: now,
      createdByUserId: userId,
    });

    await expect(
      repository.createTaskDependency({
        id: "dependency-duplicate",
        firmId,
        matterId,
        taskId: "task-deadline-001",
        dependsOnTaskId: "task-deadline-002",
        dependencyType: "blocks",
        createdAt: now,
        createdByUserId: userId,
      }),
    ).rejects.toThrow("Task dependency already exists");

    await expect(
      repository.createTaskDependency({
        id: "dependency-cycle",
        firmId,
        matterId,
        taskId: "task-deadline-002",
        dependsOnTaskId: "task-deadline-001",
        dependencyType: "blocks",
        createdAt: now,
        createdByUserId: userId,
      }),
    ).rejects.toThrow("Task dependency would create a blocking cycle");
  });
});
