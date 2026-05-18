import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository saved operational view definitions", () => {
  it("keeps definitions private, firm-scoped, and hidden after archive", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const now = "2026-06-20T12:00:00.000Z";
    const created = await repository.createSavedOperationalViewDefinition({
      id: "saved-queue-view-1",
      firmId: "firm-west-legal",
      ownerUserId: "user-admin",
      surface: "queues",
      name: "Queue exceptions",
      filters: { queue: "exceptions" },
      columns: ["title", "status"],
      sort: { priority: "desc" },
      rowLimit: 10,
      dashboardBehavior: { pinToFocus: true },
      permissionScope: ["matter:read"],
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      repository.listSavedOperationalViewDefinitions("firm-west-legal", {
        ownerUserId: "user-admin",
      }),
    ).resolves.toEqual([created]);
    const matterFollowUp = await repository.createSavedOperationalViewDefinition({
      id: "saved-matter-view-1",
      firmId: "firm-west-legal",
      ownerUserId: "user-admin",
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
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      repository.listSavedOperationalViewDefinitions("firm-west-legal", {
        ownerUserId: "user-admin",
        surface: "matters",
      }),
    ).resolves.toEqual([matterFollowUp]);
    await expect(
      repository.listSavedOperationalViewDefinitions("firm-west-legal", {
        ownerUserId: "user-other",
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.listSavedOperationalViewDefinitions("firm-other", {
        ownerUserId: "user-admin",
      }),
    ).resolves.toEqual([]);

    const updated = await repository.updateSavedOperationalViewDefinition(
      "firm-west-legal",
      created.id,
      {
        name: "Queue exception review",
        rowLimit: 5,
        updatedAt: "2026-06-20T12:05:00.000Z",
      },
    );
    expect(updated).toMatchObject({ name: "Queue exception review", rowLimit: 5 });

    await repository.archiveSavedOperationalViewDefinition({
      firmId: "firm-west-legal",
      id: created.id,
      archivedAt: "2026-06-20T12:10:00.000Z",
    });
    await expect(
      repository.listSavedOperationalViewDefinitions("firm-west-legal", {
        ownerUserId: "user-admin",
        surface: "queues",
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.listSavedOperationalViewDefinitions("firm-west-legal", {
        ownerUserId: "user-admin",
        surface: "queues",
        includeArchived: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: created.id,
        status: "archived",
        archivedAt: "2026-06-20T12:10:00.000Z",
      }),
    ]);
  });
});
