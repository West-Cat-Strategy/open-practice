import type {
  ProvidersStatusResponse,
  QueuesResponse,
  TaskDeadlineWorkbenchResponse,
  WorkerRunsDashboardResponse,
} from "./types";

export type OperationalFocusTone = "neutral" | "ready" | "risk";

export interface OperationalFocusItem {
  key: string;
  label: string;
  detail: string;
  value: string;
  tone: OperationalFocusTone;
  section: "Tasks" | "Workers" | "Queues" | "Providers" | "Active matter";
}

export interface OperationalFocusSummary {
  attentionCount: number;
  activeCount: number;
  providerRiskCount: number;
  items: OperationalFocusItem[];
}

type MatterCommandCenterRail = Array<{
  key: string;
  label: string;
  value: number;
  detail: string;
  tone: OperationalFocusTone;
}>;

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function compactStatus(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

function queueAttentionItems(queues: QueuesResponse): OperationalFocusItem[] {
  const sections = queues.sections
    .map((section) => {
      const highPriority = section.items.filter((item) => item.priority === "high").length;
      const mediumPriority = section.items.filter((item) => item.priority === "medium").length;
      return {
        section,
        total: section.items.length,
        highPriority,
        mediumPriority,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort(
      (left, right) =>
        right.highPriority - left.highPriority ||
        right.total - left.total ||
        left.section.label.localeCompare(right.section.label),
    )
    .slice(0, 3);

  return sections.map(({ section, total, highPriority, mediumPriority }) => ({
    key: `queue-${section.key}`,
    label: section.label,
    value: total.toString(),
    detail:
      highPriority > 0
        ? `${pluralize(highPriority, "high-priority item")} in this authorized queue.`
        : `${pluralize(mediumPriority, "medium-priority item")} and ${pluralize(
            total - mediumPriority,
            "lower-priority item",
          )}.`,
    tone: highPriority > 0 ? "risk" : "neutral",
    section: "Queues",
  }));
}

function providerRiskItems(status: ProvidersStatusResponse): OperationalFocusItem[] {
  const documentProcessingQueue = status.documentProcessing.workerQueues.find(
    (queue) => queue.queueName === "ocr",
  );
  const items: OperationalFocusItem[] = [];

  if (status.jobs.summary.failed > 0) {
    items.push({
      key: "provider-failed-jobs",
      label: "Failed provider jobs",
      value: status.jobs.summary.failed.toString(),
      detail: "Latest job lifecycle summaries are redacted before display.",
      tone: "risk",
      section: "Providers",
    });
  }

  if (
    status.documentProcessing.status !== "configured" ||
    documentProcessingQueue?.status !== "configured"
  ) {
    items.push({
      key: "provider-document-processing",
      label: "Document processing posture",
      value: compactStatus(status.documentProcessing.status),
      detail: `OCR queue ${compactStatus(documentProcessingQueue?.status)}. Reserved queues ${
        status.documentProcessing.reservedQueues?.length ?? 0
      }.`,
      tone: "risk",
      section: "Providers",
    });
  }

  if (status.email.status !== "configured" || status.email.queue?.status !== "configured") {
    items.push({
      key: "provider-email",
      label: "Outbound email posture",
      value: compactStatus(status.email.status),
      detail: `Queue ${compactStatus(status.email.queue?.status)}. Confirmation-gated delivery remains enforced.`,
      tone: status.email.status === "disabled" ? "neutral" : "risk",
      section: "Providers",
    });
  }

  return items;
}

function activeMatterItems(input: {
  rail?: MatterCommandCenterRail;
  attentionActivityCount: number;
}): OperationalFocusItem[] {
  const railItems =
    input.rail
      ?.filter((item) =>
        ["needsReview", "externalUploads", "communications", "blocked", "queuedOrActive"].includes(
          item.key,
        ),
      )
      .filter((item) => item.value > 0 || item.tone === "risk")
      .map((item) => ({
        key: `matter-${item.key}`,
        label: item.label,
        value: item.value.toString(),
        detail: item.detail,
        tone: item.tone,
        section: "Active matter" as const,
      })) ?? [];

  if (input.attentionActivityCount > 0) {
    railItems.unshift({
      key: "matter-activity-attention",
      label: "Matter activity attention",
      value: input.attentionActivityCount.toString(),
      detail: "Attention-coded active-matter activity from already visible timeline entries.",
      tone: "risk",
      section: "Active matter",
    });
  }

  return railItems.slice(0, 3);
}

export function buildOperationalFocusSummary(input: {
  taskWorkbench: TaskDeadlineWorkbenchResponse;
  queues: QueuesResponse;
  workerRuns: WorkerRunsDashboardResponse;
  providerStatus: ProvidersStatusResponse;
  activeMatterCommandCenter?: { rail: MatterCommandCenterRail };
  activeMatterActivitySummary?: { attention: number };
}): OperationalFocusSummary {
  const myTasks = input.taskWorkbench.counters.my;
  const workerSummary = input.workerRuns.all.summary;
  const activeWorkers = workerSummary.queued + workerSummary.active;
  const providerItems = providerRiskItems(input.providerStatus);

  const items: OperationalFocusItem[] = [
    ...(myTasks.overdue > 0
      ? [
          {
            key: "tasks-overdue",
            label: "My overdue tasks",
            value: myTasks.overdue.toString(),
            detail: "Assigned open task deadlines that are already past due.",
            tone: "risk" as const,
            section: "Tasks" as const,
          },
        ]
      : []),
    ...(myTasks.today > 0
      ? [
          {
            key: "tasks-today",
            label: "Due today",
            value: myTasks.today.toString(),
            detail: "Assigned task deadlines due before tomorrow.",
            tone: "neutral" as const,
            section: "Tasks" as const,
          },
        ]
      : []),
    ...(workerSummary.failed > 0
      ? [
          {
            key: "workers-failed",
            label: "Failed worker runs",
            value: workerSummary.failed.toString(),
            detail: "Job rows expose only redacted run summaries and safe target identifiers.",
            tone: "risk" as const,
            section: "Workers" as const,
          },
        ]
      : []),
    ...(activeWorkers > 0
      ? [
          {
            key: "workers-active",
            label: "Active worker runs",
            value: activeWorkers.toString(),
            detail: `${workerSummary.queued} queued and ${workerSummary.active} active across configured queues.`,
            tone: "ready" as const,
            section: "Workers" as const,
          },
        ]
      : []),
    ...queueAttentionItems(input.queues),
    ...providerItems,
    ...activeMatterItems({
      rail: input.activeMatterCommandCenter?.rail,
      attentionActivityCount: input.activeMatterActivitySummary?.attention ?? 0,
    }),
  ];

  return {
    attentionCount:
      myTasks.overdue +
      workerSummary.failed +
      input.queues.sections
        .flatMap((section) => section.items)
        .filter((item) => item.priority === "high").length +
      (input.activeMatterActivitySummary?.attention ?? 0),
    activeCount: myTasks.today + activeWorkers,
    providerRiskCount: providerItems.filter((item) => item.tone === "risk").length,
    items: items.slice(0, 8),
  };
}

export function operationalFocusEmptyMessage(summary: OperationalFocusSummary): string {
  if (summary.items.length > 0) return "";
  return "No overdue tasks, failed runs, high-priority queues, or provider risks need attention.";
}

export function focusItemToneClass(tone: OperationalFocusTone): string {
  if (tone === "risk") return "risk";
  if (tone === "ready") return "ready";
  return "neutral";
}
