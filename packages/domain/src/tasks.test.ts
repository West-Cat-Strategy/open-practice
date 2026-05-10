import { describe, expect, it } from "vitest";
import type { MatterParty, TaskDeadlineRecord } from "./models.js";
import { buildTaskDeadlineWorkbench, classifyTaskDeadline } from "./tasks.js";

const now = new Date("2026-05-02T16:00:00.000Z");

function task(
  input: Partial<TaskDeadlineRecord> & Pick<TaskDeadlineRecord, "id">,
): TaskDeadlineRecord {
  return {
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: input.id,
    ...input,
  };
}

describe("task deadline workbench", () => {
  it("classifies open deadlines into overdue, today, upcoming, unscheduled, and completed buckets", () => {
    expect(
      classifyTaskDeadline(task({ id: "overdue", dueAt: "2026-05-01T23:59:00.000Z" }), now),
    ).toBe("overdue");
    expect(
      classifyTaskDeadline(task({ id: "today", dueAt: "2026-05-02T23:59:00.000Z" }), now),
    ).toBe("today");
    expect(
      classifyTaskDeadline(task({ id: "upcoming", dueAt: "2026-05-03T00:00:00.000Z" }), now),
    ).toBe("upcoming");
    expect(classifyTaskDeadline(task({ id: "unscheduled" }), now)).toBe("unscheduled");
    expect(
      classifyTaskDeadline(
        task({
          id: "completed",
          dueAt: "2026-05-01T23:59:00.000Z",
          completedAt: "2026-05-02T15:00:00.000Z",
        }),
        now,
      ),
    ).toBe("completed");
  });

  it("builds my, team, matter, and client-contact counters without counting adverse parties", () => {
    const tasks = [
      task({
        id: "task-overdue-mine",
        assignedToUserId: "user-licensee",
        dueAt: "2026-05-01T19:00:00.000Z",
      }),
      task({
        id: "task-today-team",
        assignedToUserId: "user-staff",
        dueAt: "2026-05-02T21:00:00.000Z",
      }),
      task({
        id: "task-upcoming-other-matter",
        matterId: "matter-002",
        assignedToUserId: "user-admin",
        dueAt: "2026-05-05T17:00:00.000Z",
      }),
      task({
        id: "task-complete",
        assignedToUserId: "user-licensee",
        dueAt: "2026-05-01T19:00:00.000Z",
        completedAt: "2026-05-02T14:00:00.000Z",
      }),
    ];
    const matterParties: MatterParty[] = [
      {
        id: "party-client",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        contactId: "contact-client",
        role: "client",
        adverse: false,
        confidential: true,
      },
      {
        id: "party-adverse",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        contactId: "contact-adverse",
        role: "opposing_party",
        adverse: true,
        confidential: false,
      },
      {
        id: "party-notary",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        contactId: "contact-notary",
        role: "notary_client",
        adverse: false,
        confidential: true,
      },
    ];

    const workbench = buildTaskDeadlineWorkbench({
      tasks,
      matterParties,
      userId: "user-licensee",
      now,
    });

    expect(workbench.counters.my).toEqual({ overdue: 1, today: 0, upcoming: 0 });
    expect(workbench.counters.team).toEqual({ overdue: 1, today: 1, upcoming: 1 });
    expect(workbench.counters.matterQueues).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        overdue: 1,
        today: 1,
        open: 2,
        completed: 1,
      }),
      expect.objectContaining({ matterId: "matter-002", upcoming: 1, open: 1, completed: 0 }),
    ]);
    expect(workbench.counters.contactQueues).toEqual([
      expect.objectContaining({
        contactId: "contact-client",
        overdue: 1,
        today: 1,
        open: 2,
        completed: 1,
      }),
      expect.objectContaining({ contactId: "contact-notary", upcoming: 1, open: 1, completed: 0 }),
    ]);
    expect(workbench.counters.contactQueues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ contactId: "contact-adverse" })]),
    );
    expect(workbench.focusQueues).toEqual({
      myOverdueTaskIds: ["task-overdue-mine"],
      teamTodayTaskIds: ["task-today-team"],
      upcomingTaskIds: ["task-upcoming-other-matter"],
      unassignedTaskIds: [],
    });
  });
});
