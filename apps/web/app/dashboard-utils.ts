import type { OpenPracticeSidebarNavigationSection } from "../routes/routeCatalog";
import type { MatterSummary, QueuesResponse } from "./types";

export function filterMatters(matters: MatterSummary[], query: string): MatterSummary[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return matters;
  return matters.filter((matter) =>
    [matter.title, matter.number, matter.practiceArea, matter.status, matter.jurisdiction]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function describeDisabledNavigationReason(
  section: Pick<OpenPracticeSidebarNavigationSection, "key" | "label" | "enabled">,
): string | null {
  if (section.enabled) return null;
  if (section.key === "billing") return "Billing is unavailable for your current role.";
  if (section.key === "shares") return "Share links are unavailable in this environment.";
  if (section.key === "externalUploads") {
    return "External uploads are unavailable until the storage provider is configured.";
  }
  return `${section.label} is unavailable for your current permissions.`;
}

export function summarizeQueues(queues: QueuesResponse): string {
  const items = queues.sections.flatMap((section) => section.items);
  if (items.length === 0) return "No queue items need attention.";
  const highPriorityCount = items.filter((item) => item.priority === "high").length;
  const highPrioritySuffix =
    highPriorityCount > 0
      ? ` ${highPriorityCount} high priority ${highPriorityCount === 1 ? "item" : "items"}.`
      : "";
  return `${items.length} queue ${items.length === 1 ? "item needs" : "items need"} attention.${highPrioritySuffix}`;
}
