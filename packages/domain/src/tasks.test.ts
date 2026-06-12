import { describe, expect, it } from "vitest";
import type { CalendarSchedulingRequestRecord, MatterParty, TaskDeadlineRecord } from "./models.js";
import { buildTaskDeadlineWorkbench, classifyTaskDeadline } from "./tasks.js";

const now = new Date("2026-05-02T16:00:00.000Z");

function task(
  input: Partial<TaskDeadlineRecord> & Pick<TaskDeadlineRecord, "id">,
): TaskDeadlineRecord {
  return {
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: input.id,
    status: input.completedAt ? "completed" : "open",
    priority: "medium",
    createdAt: "2026-04-30T12:00:00.000Z",
    updatedAt: input.completedAt ?? "2026-04-30T12:00:00.000Z",
    version: input.completedAt ? 2 : 1,
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

  it("builds review-list items with derived priority, assignment, privacy, and scheduling context", () => {
    const tasks = [
      task({
        id: "task-overdue-mine",
        assignedToUserId: "user-licensee",
        title: "Review tenant evidence package",
        dueAt: "2026-05-01T19:00:00.000Z",
      }),
      task({
        id: "task-today-unassigned",
        title: "Confirm filing checklist",
        dueAt: "2026-05-02T21:00:00.000Z",
      }),
      task({
        id: "task-upcoming-team",
        matterId: "matter-002",
        assignedToUserId: "user-staff",
        title: "Prepare corporate records request",
        dueAt: "2026-05-05T17:00:00.000Z",
      }),
    ];
    const schedulingRequests: CalendarSchedulingRequestRecord[] = [
      {
        id: "calendar-scheduling-request-review",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        kind: "deadline_review",
        status: "needs_review",
        title: "Review filing deadline posture",
        taskId: "task-overdue-mine",
        ownerUserId: "user-licensee",
        sourceType: "task_deadline",
        sourceId: "task-overdue-mine",
        sourceLabel: "Review tenant evidence package",
        requestedDueAt: "2026-05-01T19:00:00.000Z",
        reminderPosture: "dashboard_pending",
        privacy: "staff_only",
        timeCaptureCue: {
          posture: "draft_available",
          suggestedMinutes: 30,
          existingTimeEntryCount: 1,
          billable: true,
        },
        createdAt: "2026-04-30T12:00:00.000Z",
        updatedAt: "2026-04-30T12:00:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
      {
        id: "calendar-scheduling-request-reviewed",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        kind: "event_scheduling",
        status: "reviewed",
        title: "Reviewed filing checklist time",
        taskId: "task-today-unassigned",
        ownerUserId: "user-staff",
        sourceType: "task_deadline",
        sourceId: "task-today-unassigned",
        sourceLabel: "Confirm filing checklist",
        requestedDueAt: "2026-05-02T21:00:00.000Z",
        reminderPosture: "none",
        privacy: "matter_team",
        timeCaptureCue: {
          posture: "none",
          existingTimeEntryCount: 0,
          billable: false,
        },
        createdAt: "2026-04-30T12:05:00.000Z",
        updatedAt: "2026-04-30T12:05:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
        reviewedAt: "2026-04-30T13:00:00.000Z",
        reviewedByUserId: "user-staff",
      },
      {
        id: "calendar-scheduling-request-cross-matter",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        kind: "deadline_review",
        status: "needs_review",
        title: "Cross matter request must not attach",
        taskId: "task-overdue-mine",
        sourceType: "task_deadline",
        sourceId: "task-overdue-mine",
        sourceLabel: "Cross matter private source",
        requestedDueAt: "2026-05-01T19:00:00.000Z",
        reminderPosture: "dashboard_pending",
        privacy: "staff_only",
        timeCaptureCue: {
          posture: "draft_available",
          existingTimeEntryCount: 2,
          billable: true,
        },
        createdAt: "2026-04-30T12:10:00.000Z",
        updatedAt: "2026-04-30T12:10:00.000Z",
        createdByUserId: "user-licensee",
        updatedByUserId: "user-licensee",
      },
    ];

    const workbench = buildTaskDeadlineWorkbench({
      tasks,
      matterParties: [],
      matters: [
        { id: "matter-001", number: "2026-0001", title: "Residential tenancy review" },
        { id: "matter-002", number: "2026-0002", title: "Corporate records request" },
      ],
      schedulingRequests,
      userId: "user-licensee",
      now,
    });

    expect(workbench.taskReview.summary).toMatchObject({
      total: 3,
      open: 3,
      highPriority: 1,
      mediumPriority: 1,
      lowPriority: 1,
      overdue: 1,
      dueToday: 1,
      unassigned: 1,
      myOpen: 1,
      schedulingReviewCount: 1,
    });
    expect(workbench.taskReview.items[0]).toMatchObject({
      id: "task-overdue-mine",
      matterNumber: "2026-0001",
      matterTitle: "Residential tenancy review",
      priority: "high",
      tone: "risk",
      assignment: {
        status: "assigned",
        userId: "user-licensee",
        scope: "current_user",
        label: "My task",
      },
      privacy: {
        matterScoped: true,
        clientVisible: false,
        visibility: "staff_only",
      },
      scheduling: {
        requestCount: 1,
        needsReviewCount: 1,
        reviewedCount: 0,
        nextReviewAt: "2026-05-01T19:00:00.000Z",
        sourceTypes: ["task_deadline"],
        reminderPostures: ["dashboard_pending"],
        timeCapturePostures: ["draft_available"],
      },
      reviewBoundary: {
        courtRuleAutomation: false,
        providerSync: false,
        automaticDeadlineMutation: false,
        automaticReminderChanges: false,
        queueDelivery: false,
        automaticTimeEntryCreation: false,
      },
    });
    expect(workbench.taskReview.items[1]).toMatchObject({
      id: "task-today-unassigned",
      priority: "medium",
      assignment: {
        status: "unassigned",
        scope: "unassigned",
        label: "Unassigned",
      },
      scheduling: {
        requestCount: 1,
        needsReviewCount: 0,
        reviewedCount: 1,
      },
    });
    expect(JSON.stringify(workbench.taskReview)).not.toContain("Cross matter private source");
  });

  it("surfaces review-first suggested follow-ups without auto-created task mutations", () => {
    const workbench = buildTaskDeadlineWorkbench({
      tasks: [],
      matterParties: [],
      matters: [{ id: "matter-001", number: "2026-0001", title: "Residential tenancy review" }],
      schedulingRequests: [
        {
          id: "calendar-scheduling-request-follow-up",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          kind: "event_scheduling",
          status: "needs_review",
          title: "Schedule synthetic inspection call",
          sourceType: "calendar_event",
          sourceId: "calendar-event-follow-up",
          sourceLabel: "Inspection scheduling request",
          requestedDueAt: "2026-05-03T17:00:00.000Z",
          reminderPosture: "dashboard_pending",
          privacy: "staff_only",
          timeCaptureCue: {
            posture: "none",
            existingTimeEntryCount: 0,
            billable: false,
          },
          createdAt: "2026-05-02T12:00:00.000Z",
          updatedAt: "2026-05-02T12:00:00.000Z",
          createdByUserId: "user-licensee",
          updatedByUserId: "user-licensee",
        },
      ],
      userId: "user-licensee",
      now,
    });

    expect(workbench.tasks).toEqual([]);
    expect(workbench.suggestedFollowUps).toEqual([
      expect.objectContaining({
        id: "calendar-scheduling:calendar-scheduling-request-follow-up",
        matterId: "matter-001",
        title: "Schedule synthetic inspection call",
        reason: "2026-0001 scheduling cue is waiting for staff task review.",
        priority: "high",
        dueAt: "2026-05-03T17:00:00.000Z",
        source: {
          type: "calendar_scheduling",
          id: "calendar-scheduling-request-follow-up",
          label: "Inspection scheduling request",
        },
        reviewBoundary: {
          automaticTaskCreation: false,
          automaticDeadlineMutation: false,
          automaticReminderChanges: false,
          queueDelivery: false,
        },
      }),
    ]);
  });
});
