import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  MatterSummary,
  PracticeOverview,
  TaskDeadlineWorkbenchResponse,
  TaskStructuredDetailResponse,
  TaskTemplatesResponse,
} from "../types";
import { TasksSection } from "./tasks-section";

const syntheticMatter = {
  id: "matter_synthetic",
  firmId: "firm_synthetic",
  number: "OP-2026-001",
  title: "Synthetic tenancy matter",
  practiceArea: "Residential tenancy",
  status: "open",
  jurisdiction: "BC",
  responsibleUserId: "user_synthetic",
  parties: [],
  documents: [],
  timeEntries: [],
  expenses: [],
  activity: [],
  lifecycleTransitions: [],
  trustBalanceCents: 0,
  setupProfile: {
    stage: {
      key: "open",
      label: "Open",
      description: "Synthetic open matter.",
    },
    responsibleUser: {
      state: "assigned",
      responsibleUserId: "user_synthetic",
      responsibleUserDisplayName: "Synthetic Staff",
      assignedUserIds: ["user_synthetic"],
      assignedUserDisplayNames: ["Synthetic Staff"],
      label: "Assigned",
      description: "Synthetic responsible user posture.",
    },
    fieldDefinitions: [],
    checklist: [],
    financialSnapshot: {
      trustBalanceCents: 0,
      unbilledTimeEntryCount: 0,
      unbilledMinutes: 0,
      unbilledExpenseCount: 0,
      unbilledExpenseCents: 0,
      cues: [],
      caution: "Synthetic financial snapshot.",
    },
  },
} satisfies MatterSummary;

const syntheticUsers: PracticeOverview["users"] = [
  {
    id: "user_synthetic",
    firmId: "firm_synthetic",
    displayName: "Synthetic Staff",
    email: "staff@example.test",
    role: "owner_admin",
    assignedMatterIds: ["matter_synthetic"],
    mfaEnabled: true,
  },
  {
    id: "client_synthetic",
    firmId: "firm_synthetic",
    displayName: "Synthetic Client",
    email: "client@example.test",
    role: "client_external",
    assignedMatterIds: ["matter_synthetic"],
    mfaEnabled: false,
  },
];

const taskWorkbench: TaskDeadlineWorkbenchResponse = {
  tasks: [
    {
      id: "task_open",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      assignedToUserId: "user_synthetic",
      title: "Review synthetic evidence",
      description: "Review the synthetic evidence index.",
      status: "open",
      priority: "high",
      sourceType: "manual",
      sourceId: "manual_synthetic",
      dueAt: "2026-06-20T17:00:00.000Z",
      createdAt: "2026-06-10T10:00:00.000Z",
      createdByUserId: "user_synthetic",
      updatedAt: "2026-06-10T10:00:00.000Z",
      updatedByUserId: "user_synthetic",
      version: 1,
      assignmentStatus: "assigned",
      completionStatus: "open",
      bucket: "upcoming",
    },
    {
      id: "task_archived",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      title: "Archived synthetic task",
      status: "archived",
      priority: "medium",
      archivedAt: "2026-06-10T11:00:00.000Z",
      archivedByUserId: "user_synthetic",
      createdAt: "2026-06-09T10:00:00.000Z",
      updatedAt: "2026-06-10T11:00:00.000Z",
      version: 2,
      assignmentStatus: "unassigned",
      completionStatus: "open",
      bucket: "unscheduled",
    },
  ],
  counters: {
    my: { overdue: 1, today: 0, upcoming: 1 },
    team: { overdue: 1, today: 1, upcoming: 2 },
    matterQueues: [],
    contactQueues: [],
  },
  focusQueues: {
    myOverdueTaskIds: ["task_open"],
    teamTodayTaskIds: [],
    upcomingTaskIds: ["task_open"],
    unassignedTaskIds: [],
  },
  taskReview: {
    summary: {
      total: 1,
      open: 1,
      completed: 0,
      highPriority: 1,
      mediumPriority: 0,
      lowPriority: 0,
      overdue: 1,
      dueToday: 0,
      unassigned: 0,
      myOpen: 1,
      schedulingReviewCount: 1,
    },
    items: [],
  },
  suggestedFollowUps: [
    {
      id: "suggestion_synthetic",
      matterId: "matter_synthetic",
      title: "Follow up on synthetic scheduling request",
      reason: "Scheduling request needs staff review before any task is created.",
      priority: "medium",
      dueAt: "2026-06-21T17:00:00.000Z",
      source: {
        type: "calendar_scheduling",
        id: "calendar_request_synthetic",
        label: "Scheduling request",
      },
      reviewBoundary: {
        automaticTaskCreation: false,
        automaticDeadlineMutation: false,
        automaticReminderChanges: false,
        queueDelivery: false,
      },
    },
    {
      id: "legal-clinic-cadence:clinic-profile-synthetic:next_review_due",
      matterId: "matter_synthetic",
      title: "Review legal clinic cadence",
      reason: "OP-2026-001 Legal clinic next review date is due for staff review.",
      priority: "high",
      dueAt: "2026-06-18T17:00:00.000Z",
      source: {
        type: "operational_view",
        id: "legal_clinic_cadence:clinic-profile-synthetic:next_review_due",
        label: "Legal clinic cadence",
      },
      reviewBoundary: {
        automaticTaskCreation: false,
        automaticDeadlineMutation: false,
        automaticReminderChanges: false,
        queueDelivery: false,
      },
    },
  ],
};

const taskStructure: TaskStructuredDetailResponse = {
  task: taskWorkbench.tasks[0]!,
  checklistItems: [
    {
      id: "checklist_synthetic",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      taskId: "task_open",
      title: "Confirm synthetic exhibit list",
      status: "open",
      assignedToUserId: "user_synthetic",
      dueAt: "2026-06-19T17:00:00.000Z",
      sortOrder: 0,
      createdAt: "2026-06-10T10:00:00.000Z",
      createdByUserId: "user_synthetic",
      updatedAt: "2026-06-10T10:00:00.000Z",
      updatedByUserId: "user_synthetic",
      version: 1,
    },
  ],
  comments: [
    {
      id: "comment_synthetic",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      taskId: "task_open",
      body: "Synthetic staff-only note.",
      createdAt: "2026-06-10T12:00:00.000Z",
      createdByUserId: "user_synthetic",
    },
  ],
  dependencies: [
    {
      id: "dependency_synthetic",
      firmId: "firm_synthetic",
      matterId: "matter_synthetic",
      taskId: "task_open",
      dependsOnTaskId: "task_dependency",
      dependencyType: "blocks",
      createdAt: "2026-06-10T12:30:00.000Z",
      createdByUserId: "user_synthetic",
    },
  ],
  templates: [
    {
      id: "template_synthetic",
      firmId: "firm_synthetic",
      name: "Synthetic evidence review",
      defaultPriority: "medium",
      status: "active",
      createdAt: "2026-06-10T09:00:00.000Z",
      createdByUserId: "user_synthetic",
      updatedAt: "2026-06-10T09:00:00.000Z",
      updatedByUserId: "user_synthetic",
      version: 1,
    },
  ],
  templateItems: [
    {
      id: "template_item_synthetic",
      firmId: "firm_synthetic",
      templateId: "template_synthetic",
      title: "Review synthetic source bundle",
      sortOrder: 0,
      createdAt: "2026-06-10T09:00:00.000Z",
      createdByUserId: "user_synthetic",
      updatedAt: "2026-06-10T09:00:00.000Z",
      updatedByUserId: "user_synthetic",
    },
  ],
  checklistProgress: {
    total: 1,
    open: 1,
    completed: 0,
    blocked: 0,
    percentComplete: 0,
  },
  dependencySummary: {
    blocks: 1,
    relatesTo: 0,
    blockingTaskIds: ["task_dependency"],
    blockedByOpenTaskIds: ["task_dependency"],
  },
  commentSummary: {
    count: 1,
    latestCreatedAt: "2026-06-10T12:00:00.000Z",
  },
  structureBoundary: {
    staffOnlyComments: true,
    clientVisible: false,
    automaticDeadlineMutation: false,
    automaticTaskCreation: false,
    providerSync: false,
    emailDelivery: false,
  },
};

const taskTemplates: TaskTemplatesResponse["templates"] = taskStructure.templates;
const taskTemplateItems: TaskTemplatesResponse["templateItems"] = taskStructure.templateItems;

describe("TasksSection", () => {
  it("renders task lifecycle controls and review-first suggestions", () => {
    const html = renderToStaticMarkup(
      createElement(TasksSection, {
        activeMatterId: "matter_synthetic",
        busyKey: "",
        compactDate: (value?: string) => value?.slice(0, 10) ?? "No date",
        currentUserId: "user_synthetic",
        includeArchived: false,
        matters: [syntheticMatter],
        onArchiveTask: () => {},
        onArchiveTaskChecklistItem: () => {},
        onArchiveTaskComment: () => {},
        onArchiveTaskDependency: () => {},
        onApplyTaskTemplate: () => {},
        onCompleteTask: () => {},
        onCompleteTaskChecklistItem: () => {},
        onCreateTaskChecklistItem: () => {},
        onCreateTaskComment: () => {},
        onCreateTaskDependency: () => {},
        onCreateTask: () => {},
        onIncludeArchivedChange: () => {},
        onReopenTask: () => {},
        onReopenTaskChecklistItem: () => {},
        onRequestTaskDeadlineReview: () => {},
        onSelectMatter: () => {},
        onSelectTaskStructure: () => {},
        onUpdateTask: () => {},
        schedulingReviewBusyKey: "",
        status: "Task workspace ready.",
        taskStructure,
        taskTemplateItems,
        taskTemplates,
        taskWorkbench,
        tasks: taskWorkbench.tasks,
        users: syntheticUsers,
      }),
    );

    expect(html).toContain("My open tasks");
    expect(html).toContain("Review synthetic evidence");
    expect(html).toContain("Synthetic Staff");
    expect(html).toContain("Hide archived");
    expect(html).toContain("Complete");
    expect(html).toContain("Archive");
    expect(html).toContain("Structured detail");
    expect(html).toContain("Confirm synthetic exhibit list");
    expect(html).toContain("Synthetic staff-only note.");
    expect(html).toContain("Synthetic evidence review");
    expect(html).toContain("Request review");
    expect(html).toContain("Suggested follow-ups");
    expect(html).toContain("Follow up on synthetic scheduling request");
    expect(html).toContain("Review legal clinic cadence");
    expect(html).toContain("Legal clinic cadence");
    expect(html).toContain("Create task");
    expect(html).not.toContain("Archived synthetic task");
    expect(html).not.toContain("Synthetic Client");
    expect(html).not.toContain("raw-client-private");
  });

  it("disables deadline review requests when an open scheduling cue already exists", () => {
    const taskReviewItem: TaskDeadlineWorkbenchResponse["taskReview"]["items"][number] = {
      id: "task_open",
      matterId: "matter_synthetic",
      matterNumber: "OP-2026-001",
      matterTitle: "Synthetic tenancy matter",
      title: "Review synthetic evidence",
      dueAt: "2026-06-20T17:00:00.000Z",
      bucket: "upcoming",
      completionStatus: "open",
      priority: "high",
      tone: "risk",
      assignment: {
        status: "assigned",
        userId: "user_synthetic",
        scope: "current_user",
        label: "My task",
      },
      privacy: {
        matterScoped: true,
        clientVisible: false,
        visibility: "staff_only",
      },
      source: {
        type: "task_deadline",
        label: "Review synthetic evidence",
      },
      scheduling: {
        requestCount: 1,
        needsReviewCount: 1,
        reviewedCount: 0,
        nextReviewAt: "2026-06-20T17:00:00.000Z",
        sourceTypes: ["task_deadline"],
        reminderPostures: ["none"],
        timeCapturePostures: ["none"],
      },
      reviewBoundary: {
        courtRuleAutomation: false,
        providerSync: false,
        automaticDeadlineMutation: false,
        automaticReminderChanges: false,
        queueDelivery: false,
        automaticTimeEntryCreation: false,
      },
    };
    const html = renderToStaticMarkup(
      createElement(TasksSection, {
        activeMatterId: "matter_synthetic",
        busyKey: "",
        compactDate: (value?: string) => value?.slice(0, 10) ?? "No date",
        currentUserId: "user_synthetic",
        includeArchived: false,
        matters: [syntheticMatter],
        onArchiveTask: () => {},
        onCompleteTask: () => {},
        onCreateTask: () => {},
        onIncludeArchivedChange: () => {},
        onReopenTask: () => {},
        onRequestTaskDeadlineReview: () => {},
        onSelectMatter: () => {},
        onUpdateTask: () => {},
        schedulingReviewBusyKey: "",
        status: "Task workspace ready.",
        taskWorkbench: {
          ...taskWorkbench,
          taskReview: {
            ...taskWorkbench.taskReview,
            items: [taskReviewItem],
          },
        },
        tasks: taskWorkbench.tasks,
        users: syntheticUsers,
      }),
    );

    expect(html).toContain("Review requested");
    expect(html).toContain("An open deadline review request already exists for this task.");
    expect(html).toContain("Complete");
  });
});
