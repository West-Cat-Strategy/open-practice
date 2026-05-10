import type {
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
}

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
    completionStatus: task.completedAt ? "completed" : "open",
    bucket: classifyTaskDeadline(task, now),
  };
}

function incrementBucket(counters: TaskDeadlineCounterSet, bucket: TaskDeadlineBucket): void {
  if (bucket === "overdue" || bucket === "today" || bucket === "upcoming") {
    counters[bucket] += 1;
  }
}

export function buildTaskDeadlineWorkbench(input: {
  tasks: TaskDeadlineRecord[];
  matterParties: MatterParty[];
  userId: string;
  now?: Date;
}): TaskDeadlineWorkbench {
  const now = input.now ?? new Date();
  const projections = input.tasks
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
  };
}
