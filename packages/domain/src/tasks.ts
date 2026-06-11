import type {
  CalendarSchedulingRequestRecord,
  CalendarSchedulingRequestReminderPosture,
  CalendarSchedulingRequestSourceType,
  CalendarSchedulingRequestTimeCapturePosture,
  CalendarSchedulingRequestPrivacy,
  Matter,
  MatterParty,
  TaskDeadlineBucket,
  TaskDeadlineProjection,
  TaskDeadlineRecord,
} from "./models.js";

export interface TaskDeadlineCounterSet {
  overdue: number;
  today: number;
  upcoming: number;
}

export interface TaskDeadlineMatterQueue extends TaskDeadlineCounterSet {
  matterId: string;
  open: number;
  completed: number;
}

export interface TaskDeadlineContactQueue extends TaskDeadlineCounterSet {
  contactId: string;
  matterIds: string[];
  open: number;
  completed: number;
}

export interface TaskDeadlineWorkbench {
  tasks: TaskDeadlineProjection[];
  counters: {
    my: TaskDeadlineCounterSet;
    team: TaskDeadlineCounterSet;
    matterQueues: TaskDeadlineMatterQueue[];
    contactQueues: TaskDeadlineContactQueue[];
  };
  focusQueues: {
    myOverdueTaskIds: string[];
    teamTodayTaskIds: string[];
    upcomingTaskIds: string[];
    unassignedTaskIds: string[];
  };
  taskReview: TaskDeadlineReviewWorkspace;
  suggestedFollowUps: TaskFollowUpSuggestion[];
}

export type TaskDeadlineReviewPriority = "high" | "medium" | "low";
export type TaskDeadlineReviewTone = "risk" | "neutral" | "ready";
export type TaskDeadlineReviewAssignmentScope = "current_user" | "assigned_team" | "unassigned";

export interface TaskDeadlineReviewAssignment {
  status: TaskDeadlineProjection["assignmentStatus"];
  userId?: string;
  scope: TaskDeadlineReviewAssignmentScope;
  label: string;
}

export interface TaskDeadlineReviewSchedulingContext {
  requestCount: number;
  needsReviewCount: number;
  reviewedCount: number;
  nextReviewAt?: string;
  sourceTypes: CalendarSchedulingRequestSourceType[];
  reminderPostures: CalendarSchedulingRequestReminderPosture[];
  timeCapturePostures: CalendarSchedulingRequestTimeCapturePosture[];
}

export interface TaskDeadlineReviewItem {
  id: string;
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  title: string;
  dueAt?: string;
  completedAt?: string;
  bucket: TaskDeadlineBucket;
  completionStatus: TaskDeadlineProjection["completionStatus"];
  priority: TaskDeadlineReviewPriority;
  tone: TaskDeadlineReviewTone;
  assignment: TaskDeadlineReviewAssignment;
  privacy: {
    matterScoped: true;
    clientVisible: false;
    visibility: CalendarSchedulingRequestPrivacy;
  };
  source: {
    type: "task_deadline";
    label: string;
  };
  scheduling: TaskDeadlineReviewSchedulingContext;
  reviewBoundary: {
    courtRuleAutomation: false;
    providerSync: false;
    automaticDeadlineMutation: false;
    automaticReminderChanges: false;
    queueDelivery: false;
    automaticTimeEntryCreation: false;
  };
}

export interface TaskDeadlineReviewSummary {
  total: number;
  open: number;
  completed: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  myOpen: number;
  schedulingReviewCount: number;
}

export interface TaskDeadlineReviewWorkspace {
  summary: TaskDeadlineReviewSummary;
  items: TaskDeadlineReviewItem[];
}

export interface TaskFollowUpSuggestion {
  id: string;
  matterId: string;
  title: string;
  reason: string;
  priority: TaskDeadlineReviewPriority;
  dueAt?: string;
  source: {
    type: "calendar_scheduling";
    id: string;
    label: string;
  };
  reviewBoundary: {
    automaticTaskCreation: false;
    automaticDeadlineMutation: false;
    automaticReminderChanges: false;
    queueDelivery: false;
  };
}

type TaskReviewMatterLink = Pick<Matter, "id" | "number" | "title">;

const CLIENT_LIKE_ROLES = new Set<MatterParty["role"]>([
  "client",
  "prospective_client",
  "notary_client",
  "paralegal_client",
]);

function emptyCounters(): TaskDeadlineCounterSet {
  return { overdue: 0, today: 0, upcoming: 0 };
}

function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function classifyTaskDeadline(
  task: Pick<TaskDeadlineRecord, "dueAt" | "completedAt">,
  now: Date = new Date(),
): TaskDeadlineBucket {
  if (task.completedAt) return "completed";
  if (!task.dueAt) return "unscheduled";

  const dueTime = Date.parse(task.dueAt);
  if (Number.isNaN(dueTime)) return "unscheduled";

  const todayStart = startOfUtcDay(now);
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  if (dueTime < todayStart) return "overdue";
  if (dueTime < tomorrowStart) return "today";
  return "upcoming";
}

export function projectTaskDeadline(
  task: TaskDeadlineRecord,
  now: Date = new Date(),
): TaskDeadlineProjection {
  return {
    ...task,
    assignmentStatus: task.assignedToUserId ? "assigned" : "unassigned",
    completionStatus: task.status === "completed" || task.completedAt ? "completed" : "open",
    bucket: classifyTaskDeadline(task, now),
  };
}

function incrementBucket(counters: TaskDeadlineCounterSet, bucket: TaskDeadlineBucket): void {
  if (bucket === "overdue" || bucket === "today" || bucket === "upcoming") {
    counters[bucket] += 1;
  }
}

const TASK_REVIEW_BOUNDARY = {
  courtRuleAutomation: false,
  providerSync: false,
  automaticDeadlineMutation: false,
  automaticReminderChanges: false,
  queueDelivery: false,
  automaticTimeEntryCreation: false,
} as const;

function schedulingRequestTime(request: CalendarSchedulingRequestRecord): string {
  return request.requestedDueAt ?? request.requestedStartsAt ?? request.createdAt;
}

function schedulingRequestsForTask(
  task: TaskDeadlineProjection,
  schedulingRequests: CalendarSchedulingRequestRecord[],
): CalendarSchedulingRequestRecord[] {
  return schedulingRequests
    .filter(
      (request) =>
        request.matterId === task.matterId &&
        (request.taskId === task.id ||
          (request.sourceType === "task_deadline" && request.sourceId === task.id)),
    )
    .sort((left, right) => {
      const leftTime = Date.parse(schedulingRequestTime(left));
      const rightTime = Date.parse(schedulingRequestTime(right));
      return leftTime === rightTime ? left.id.localeCompare(right.id) : leftTime - rightTime;
    });
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort();
}

function taskReviewAssignment(
  task: TaskDeadlineProjection,
  userId: string,
): TaskDeadlineReviewAssignment {
  if (!task.assignedToUserId) {
    return {
      status: "unassigned",
      scope: "unassigned",
      label: "Unassigned",
    };
  }
  if (task.assignedToUserId === userId) {
    return {
      status: "assigned",
      userId: task.assignedToUserId,
      scope: "current_user",
      label: "My task",
    };
  }
  return {
    status: "assigned",
    userId: task.assignedToUserId,
    scope: "assigned_team",
    label: "Assigned team member",
  };
}

function taskReviewPriority(input: {
  task: TaskDeadlineProjection;
  needsReviewCount: number;
}): TaskDeadlineReviewPriority {
  if (input.task.completionStatus === "completed") return "low";
  if (input.task.bucket === "overdue") return "high";
  if (
    input.task.bucket === "today" ||
    input.task.assignmentStatus === "unassigned" ||
    input.needsReviewCount > 0
  ) {
    return "medium";
  }
  return "low";
}

function taskReviewTone(
  task: TaskDeadlineProjection,
  priority: TaskDeadlineReviewPriority,
): TaskDeadlineReviewTone {
  if (task.completionStatus === "completed") return "ready";
  if (priority === "high") return "risk";
  if (priority === "medium") return "neutral";
  return "ready";
}

function taskReviewPrivacy(
  requests: CalendarSchedulingRequestRecord[],
): TaskDeadlineReviewItem["privacy"] {
  return {
    matterScoped: true,
    clientVisible: false,
    visibility: requests.some((request) => request.privacy === "staff_only")
      ? "staff_only"
      : "matter_team",
  };
}

function taskReviewSchedulingContext(
  requests: CalendarSchedulingRequestRecord[],
): TaskDeadlineReviewSchedulingContext {
  const needsReview = requests.filter((request) => request.status === "needs_review");
  const reviewed = requests.filter(
    (request) => request.reviewedAt || request.status === "reviewed",
  );
  return {
    requestCount: requests.length,
    needsReviewCount: needsReview.length,
    reviewedCount: reviewed.length,
    nextReviewAt: needsReview[0] ? schedulingRequestTime(needsReview[0]) : undefined,
    sourceTypes: uniqueSorted(requests.map((request) => request.sourceType)),
    reminderPostures: uniqueSorted(requests.map((request) => request.reminderPosture)),
    timeCapturePostures: uniqueSorted(requests.map((request) => request.timeCaptureCue.posture)),
  };
}

function buildTaskReview(input: {
  tasks: TaskDeadlineProjection[];
  matters?: TaskReviewMatterLink[];
  schedulingRequests?: CalendarSchedulingRequestRecord[];
  userId: string;
}): TaskDeadlineReviewWorkspace {
  const mattersById = new Map((input.matters ?? []).map((matter) => [matter.id, matter]));
  const items = input.tasks
    .map((task): TaskDeadlineReviewItem => {
      const matter = mattersById.get(task.matterId);
      const requests = schedulingRequestsForTask(task, input.schedulingRequests ?? []);
      const scheduling = taskReviewSchedulingContext(requests);
      const priority = taskReviewPriority({ task, needsReviewCount: scheduling.needsReviewCount });
      return {
        id: task.id,
        matterId: task.matterId,
        matterNumber: matter?.number ?? task.matterId,
        matterTitle: matter?.title ?? "Matter access",
        title: task.title,
        dueAt: task.dueAt,
        completedAt: task.completedAt,
        bucket: task.bucket,
        completionStatus: task.completionStatus,
        priority,
        tone: taskReviewTone(task, priority),
        assignment: taskReviewAssignment(task, input.userId),
        privacy: taskReviewPrivacy(requests),
        source: {
          type: "task_deadline",
          label: requests[0]?.sourceLabel ?? task.title,
        },
        scheduling,
        reviewBoundary: TASK_REVIEW_BOUNDARY,
      };
    })
    .sort((left, right) => {
      const priorityOrder: Record<TaskDeadlineReviewPriority, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      if (priorityOrder[left.priority] !== priorityOrder[right.priority]) {
        return priorityOrder[left.priority] - priorityOrder[right.priority];
      }
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return left.id.localeCompare(right.id);
    });

  return {
    summary: {
      total: items.length,
      open: items.filter((item) => item.completionStatus === "open").length,
      completed: items.filter((item) => item.completionStatus === "completed").length,
      highPriority: items.filter((item) => item.priority === "high").length,
      mediumPriority: items.filter((item) => item.priority === "medium").length,
      lowPriority: items.filter((item) => item.priority === "low").length,
      overdue: items.filter((item) => item.bucket === "overdue").length,
      dueToday: items.filter((item) => item.bucket === "today").length,
      unassigned: items.filter((item) => item.assignment.scope === "unassigned").length,
      myOpen: items.filter(
        (item) => item.assignment.scope === "current_user" && item.completionStatus === "open",
      ).length,
      schedulingReviewCount: items.reduce((sum, item) => sum + item.scheduling.needsReviewCount, 0),
    },
    items,
  };
}

const TASK_FOLLOW_UP_REVIEW_BOUNDARY = {
  automaticTaskCreation: false,
  automaticDeadlineMutation: false,
  automaticReminderChanges: false,
  queueDelivery: false,
} as const;

function buildSuggestedFollowUps(input: {
  tasks: TaskDeadlineProjection[];
  schedulingRequests?: CalendarSchedulingRequestRecord[];
  matters?: TaskReviewMatterLink[];
}): TaskFollowUpSuggestion[] {
  const existingTaskIds = new Set(input.tasks.map((task) => task.id));
  const mattersById = new Map((input.matters ?? []).map((matter) => [matter.id, matter]));
  return (input.schedulingRequests ?? [])
    .filter(
      (request) =>
        request.status === "needs_review" &&
        (!request.taskId || !existingTaskIds.has(request.taskId)) &&
        !(
          request.sourceType === "task_deadline" &&
          request.sourceId !== undefined &&
          existingTaskIds.has(request.sourceId)
        ),
    )
    .map((request): TaskFollowUpSuggestion => {
      const dueAt = request.requestedDueAt ?? request.requestedStartsAt;
      const matter = mattersById.get(request.matterId);
      return {
        id: `calendar-scheduling:${request.id}`,
        matterId: request.matterId,
        title: request.title,
        reason: `${matter?.number ?? request.matterId} scheduling cue is waiting for staff task review.`,
        priority: request.privacy === "staff_only" ? "high" : "medium",
        dueAt,
        source: {
          type: "calendar_scheduling",
          id: request.id,
          label: request.sourceLabel ?? request.kind,
        },
        reviewBoundary: TASK_FOLLOW_UP_REVIEW_BOUNDARY,
      };
    })
    .sort((left, right) => {
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return left.id.localeCompare(right.id);
    });
}

export function buildTaskDeadlineWorkbench(input: {
  tasks: TaskDeadlineRecord[];
  matterParties: MatterParty[];
  matters?: TaskReviewMatterLink[];
  schedulingRequests?: CalendarSchedulingRequestRecord[];
  userId: string;
  now?: Date;
}): TaskDeadlineWorkbench {
  const now = input.now ?? new Date();
  const projections = input.tasks
    .filter((task) => task.status !== "archived")
    .map((task) => projectTaskDeadline(task, now))
    .sort((left, right) => {
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return left.id.localeCompare(right.id);
    });

  const my = emptyCounters();
  const team = emptyCounters();
  const matterQueues = new Map<string, TaskDeadlineMatterQueue>();
  const contactQueues = new Map<string, TaskDeadlineContactQueue>();
  const clientPartiesByMatterId = new Map<string, MatterParty[]>();

  for (const party of input.matterParties) {
    if (party.adverse || !CLIENT_LIKE_ROLES.has(party.role)) continue;
    const parties = clientPartiesByMatterId.get(party.matterId) ?? [];
    parties.push(party);
    clientPartiesByMatterId.set(party.matterId, parties);
  }

  for (const task of projections) {
    if (task.completionStatus === "open") {
      incrementBucket(team, task.bucket);
      if (task.assignedToUserId === input.userId) incrementBucket(my, task.bucket);
    }

    const matterQueue =
      matterQueues.get(task.matterId) ??
      ({
        matterId: task.matterId,
        open: 0,
        completed: 0,
        ...emptyCounters(),
      } satisfies TaskDeadlineMatterQueue);
    if (task.completionStatus === "completed") {
      matterQueue.completed += 1;
    } else {
      matterQueue.open += 1;
      incrementBucket(matterQueue, task.bucket);
    }
    matterQueues.set(task.matterId, matterQueue);

    for (const party of clientPartiesByMatterId.get(task.matterId) ?? []) {
      const contactQueue =
        contactQueues.get(party.contactId) ??
        ({
          contactId: party.contactId,
          matterIds: [],
          open: 0,
          completed: 0,
          ...emptyCounters(),
        } satisfies TaskDeadlineContactQueue);
      if (!contactQueue.matterIds.includes(task.matterId)) {
        contactQueue.matterIds.push(task.matterId);
      }
      if (task.completionStatus === "completed") {
        contactQueue.completed += 1;
      } else {
        contactQueue.open += 1;
        incrementBucket(contactQueue, task.bucket);
      }
      contactQueues.set(party.contactId, contactQueue);
    }
  }

  return {
    tasks: projections,
    counters: {
      my,
      team,
      matterQueues: [...matterQueues.values()].sort((left, right) =>
        left.matterId.localeCompare(right.matterId),
      ),
      contactQueues: [...contactQueues.values()]
        .map((queue) => ({
          ...queue,
          matterIds: [...queue.matterIds].sort(),
        }))
        .sort((left, right) => left.contactId.localeCompare(right.contactId)),
    },
    focusQueues: {
      myOverdueTaskIds: projections
        .filter(
          (task) =>
            task.completionStatus === "open" &&
            task.assignedToUserId === input.userId &&
            task.bucket === "overdue",
        )
        .map((task) => task.id),
      teamTodayTaskIds: projections
        .filter((task) => task.completionStatus === "open" && task.bucket === "today")
        .map((task) => task.id),
      upcomingTaskIds: projections
        .filter((task) => task.completionStatus === "open" && task.bucket === "upcoming")
        .map((task) => task.id),
      unassignedTaskIds: projections
        .filter(
          (task) => task.completionStatus === "open" && task.assignmentStatus === "unassigned",
        )
        .map((task) => task.id),
    },
    taskReview: buildTaskReview({
      tasks: projections,
      matters: input.matters,
      schedulingRequests: input.schedulingRequests,
      userId: input.userId,
    }),
    suggestedFollowUps: buildSuggestedFollowUps({
      tasks: projections,
      matters: input.matters,
      schedulingRequests: input.schedulingRequests,
    }),
  };
}
