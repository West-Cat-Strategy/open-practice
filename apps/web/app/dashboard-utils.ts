import type { OpenPracticeSidebarNavigationSection } from "../routes/routeCatalog";
import type {
  MatterSummary,
  OperationalViewsResponse,
  QueuesResponse,
  SavedOperationalViewDefinition,
} from "./types";

export type DashboardRefreshLane = "queues" | "providers" | "audit";
export type DashboardLaneFreshnessTone = "neutral" | "ready" | "risk";

export interface DashboardLaneRefreshState {
  loadedAt?: string;
  refreshing: boolean;
  error?: string;
}

export interface DashboardLaneFreshnessCue {
  label: string;
  detail: string;
  tone: DashboardLaneFreshnessTone;
  stale: boolean;
}

export function dashboardLaneFreshnessCue(
  state: DashboardLaneRefreshState,
  input: {
    now: Date;
    staleAfterMs: number;
    loadedAtLabel?: string;
  },
): DashboardLaneFreshnessCue {
  const loadedAt = state.loadedAt ? new Date(state.loadedAt) : null;
  const validLoadedAt = loadedAt && !Number.isNaN(loadedAt.getTime()) ? loadedAt : null;
  const ageMs = validLoadedAt ? input.now.getTime() - validLoadedAt.getTime() : 0;
  const stale = Boolean(validLoadedAt && ageMs > input.staleAfterMs);
  const loadedDetail = input.loadedAtLabel
    ? `Last refreshed ${input.loadedAtLabel}.`
    : "Loaded with the dashboard response.";

  if (state.refreshing) {
    return {
      label: "Refreshing",
      detail: "Refreshing authorized dashboard data.",
      tone: "ready",
      stale: false,
    };
  }

  if (state.error) {
    return {
      label: "Refresh failed",
      detail: `${loadedDetail} Latest refresh failed: ${state.error}.`,
      tone: "risk",
      stale: true,
    };
  }

  if (stale) {
    return {
      label: "Stale",
      detail: `${loadedDetail} Refresh before acting on this lane.`,
      tone: "risk",
      stale: true,
    };
  }

  return {
    label: "Fresh",
    detail: loadedDetail,
    tone: "ready",
    stale: false,
  };
}

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

function queueSectionKeys(definition: SavedOperationalViewDefinition): Set<string> {
  const rawKeys = definition.filters.queueSections;
  if (!Array.isArray(rawKeys)) return new Set();
  return new Set(rawKeys.filter((key): key is string => typeof key === "string" && key.length > 0));
}

function applyRowLimit(queues: QueuesResponse, rowLimit: number): QueuesResponse {
  let remaining = Math.max(0, rowLimit);
  return {
    sections: queues.sections.map((section) => {
      const items = section.items.slice(0, remaining);
      remaining -= items.length;
      return { ...section, items };
    }),
  };
}

export function applySavedQueueFocus(
  queues: QueuesResponse,
  definition?: SavedOperationalViewDefinition | null,
): QueuesResponse {
  if (!definition) return queues;

  const visibleSectionKeys = queueSectionKeys(definition);
  const scopedQueues =
    visibleSectionKeys.size > 0
      ? {
          sections: queues.sections.filter((section) => visibleSectionKeys.has(section.key)),
        }
      : queues;

  return applyRowLimit(scopedQueues, definition.rowLimit);
}

export function describeSavedQueueFocus(
  definition: SavedOperationalViewDefinition,
  queues: QueuesResponse,
): string {
  const scopedQueues = applySavedQueueFocus(queues, definition);
  const itemCount = scopedQueues.sections.flatMap((section) => section.items).length;
  const sectionCount = scopedQueues.sections.length;
  return `${definition.name} applies ${itemCount} ${itemCount === 1 ? "item" : "items"} across ${sectionCount} ${sectionCount === 1 ? "section" : "sections"}.`;
}

const matterFollowUpViewKeys = new Set(["stale_matters", "uncontacted_clients"]);

function savedMatterViewKeys(definition: SavedOperationalViewDefinition): Set<string> {
  const rawKeys = definition.filters.operationalViewKeys;
  if (Array.isArray(rawKeys)) {
    return new Set(
      rawKeys.filter((key): key is string => typeof key === "string" && key.length > 0),
    );
  }
  return definition.filters.presetFamily === "matter_follow_up"
    ? new Set(matterFollowUpViewKeys)
    : new Set();
}

function savedMatterStatuses(definition: SavedOperationalViewDefinition): Set<string> {
  const rawStatuses = definition.filters.statuses;
  if (!Array.isArray(rawStatuses)) return new Set();
  return new Set(
    rawStatuses.filter(
      (status): status is string => typeof status === "string" && status.length > 0,
    ),
  );
}

function matterIdsForSavedFocus(
  definition: SavedOperationalViewDefinition,
  operationalViews: OperationalViewsResponse,
): Set<string> {
  const viewKeys = savedMatterViewKeys(definition);
  if (viewKeys.size === 0) return new Set();
  const matterIds = operationalViews.views
    .filter((view) => viewKeys.has(view.definition.key))
    .flatMap((view) => view.results ?? [])
    .flatMap((result) => {
      const matterId =
        result && typeof result === "object" && "matterId" in result ? result.matterId : undefined;
      return typeof matterId === "string" && matterId.length > 0 ? [matterId] : [];
    });
  return new Set(matterIds);
}

export function applySavedMatterFocus(
  matters: MatterSummary[],
  definition: SavedOperationalViewDefinition | null | undefined,
  operationalViews: OperationalViewsResponse,
): MatterSummary[] {
  if (!definition || definition.surface !== "matters") return matters;
  const viewKeys = savedMatterViewKeys(definition);
  const scopedMatterIds = matterIdsForSavedFocus(definition, operationalViews);
  const statuses = savedMatterStatuses(definition);
  const rowLimit = Math.max(0, definition.rowLimit);

  return matters
    .filter((matter) => {
      if (viewKeys.size > 0 && !scopedMatterIds.has(matter.id)) return false;
      if (statuses.size > 0 && !statuses.has(matter.status)) return false;
      return true;
    })
    .slice(0, rowLimit);
}

export function describeSavedMatterFocus(
  definition: SavedOperationalViewDefinition,
  matters: MatterSummary[],
  operationalViews: OperationalViewsResponse,
): string {
  const scopedMatters = applySavedMatterFocus(matters, definition, operationalViews);
  return `${definition.name} applies ${scopedMatters.length} ${scopedMatters.length === 1 ? "matter" : "matters"} to the matter command centre.`;
}
