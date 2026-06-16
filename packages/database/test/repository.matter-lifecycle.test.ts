import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository matter lifecycle transitions", () => {
  it("stores append-only transition evidence without mutating matter status", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const before = (
      await repository.listMattersForUser({
        id: "user-licensee",
        firmId: "firm-west-legal",
        displayName: "Synthetic Licensee",
        email: "licensee@example.test",
        role: "licensee",
        assignedMatterIds: ["matter-001"],
        mfaEnabled: true,
      })
    )[0]!;

    const record = await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-close",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "close",
      readiness: "blocked",
      reason: "Synthetic close review is blocked.",
      blockers: ["Synthetic trust review remains open."],
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T12:00:00.000Z",
      createdAt: "2026-06-16T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-close",
    });

    expect(record).toMatchObject({
      matterId: "matter-001",
      transition: "close",
      currentStatus: before.status,
      targetStatus: "closed",
      readiness: "blocked",
      blockers: ["Synthetic trust review remains open."],
    });
    await expect(
      repository.listMatterLifecycleTransitions("firm-west-legal", "matter-001"),
    ).resolves.toEqual([record]);
    const [after] = await repository.listMattersForUser({
      id: "user-licensee",
      firmId: "firm-west-legal",
      displayName: "Synthetic Licensee",
      email: "licensee@example.test",
      role: "licensee",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    });
    expect(after).toMatchObject({
      id: "matter-001",
      status: before.status,
      lifecycleTransitions: [record],
    });
    expect(after.closedOn).toBe(before.closedOn);
    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "matter.lifecycle_transition_reviewed",
          resourceId: "matter-001",
          metadata: expect.objectContaining({
            transition: "close",
            targetStatus: "closed",
            blockerCount: 1,
            reviewOnly: true,
          }),
        }),
      ]),
    );
    expect(JSON.stringify(audit.events)).not.toContain("Synthetic trust review remains open");
  });

  it("orders transition records by review time and scopes them by matter", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-pause",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "pause",
      readiness: "ready",
      reason: "Synthetic pause packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T11:00:00.000Z",
      createdAt: "2026-06-16T11:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-pause",
    });
    await repository.createMatterLifecycleTransition({
      id: "matter-lifecycle-reopen",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      transition: "reopen",
      readiness: "ready",
      reason: "Synthetic reopen packet is ready.",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-16T12:00:00.000Z",
      createdAt: "2026-06-16T12:00:00.000Z",
      auditEventId: "audit-matter-lifecycle-reopen",
    });

    await expect(
      repository.listMatterLifecycleTransitions("firm-west-legal", "matter-001"),
    ).resolves.toMatchObject([{ id: "matter-lifecycle-reopen" }, { id: "matter-lifecycle-pause" }]);
    await expect(
      repository.listMatterLifecycleTransitions("firm-west-legal", "matter-002"),
    ).resolves.toEqual([]);
  });
});
