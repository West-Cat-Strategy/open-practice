import type { OpenPracticeSidebarNavigationSection } from "../routes/routeCatalog";
import type {
  MatterSummary,
  OperationalViewsResponse,
  QueuesResponse,
  SavedOperationalViewDefinition,
} from "./types";

export type DashboardRefreshLane = "queues" | "providers" | "audit";
export type DashboardLaneFreshnessTone = "neutral" | "ready" | "risk";
export type SavedMatterOperationalViewPresetId =
  | "matter_follow_up"
  | "overdue_filings"
  | "uncontacted_intake_clients"
  | "expiring_upload_links";

export interface SavedMatterOperationalViewPreset {
  id: SavedMatterOperationalViewPresetId;
  name: string;
  saveLabel: string;
  statusLabel: string;
  filters: {
    source: "dashboard-matters";
    presetFamily: SavedMatterOperationalViewPresetId;
    operationalViewKeys: string[];
    statuses?: string[];
  };
  columns: string[];
  sort: Record<string, string>;
  rowLimit: number;
  dashboardBehavior: Record<string, boolean>;
  permissionScope: string[];
}

export interface SavedMatterOperationalViewDefinitionPayload {
  surface: "matters";
  name: string;
  filters: SavedMatterOperationalViewPreset["filters"];
  columns: string[];
  sort: Record<string, string>;
  rowLimit: number;
  dashboardBehavior: Record<string, boolean>;
  permissionScope: string[];
}

export const SAVED_MATTER_OPERATIONAL_VIEW_PRESETS: SavedMatterOperationalViewPreset[] = [
  {
    id: "matter_follow_up",
    name: "Matter follow-up",
    saveLabel: "Save follow-up",
    statusLabel: "matter follow-up",
    filters: {
      source: "dashboard-matters",
      presetFamily: "matter_follow_up",
      operationalViewKeys: ["stale_matters", "uncontacted_clients"],
      statuses: ["intake", "open", "paused"],
    },
    columns: ["number", "practiceArea", "status"],
    sort: { priority: "desc", lastActivityAt: "asc" },
    rowLimit: 12,
    dashboardBehavior: { pinToMatterContext: true },
    permissionScope: ["matter:read"],
  },
  {
    id: "overdue_filings",
    name: "Overdue filings",
    saveLabel: "Save filings",
    statusLabel: "overdue filings",
    filters: {
      source: "dashboard-matters",
      presetFamily: "overdue_filings",
      operationalViewKeys: ["overdue_tasks_deadlines"],
      statuses: ["intake", "open", "paused"],
    },
    columns: ["number", "practiceArea", "status"],
    sort: { dueAt: "asc", priority: "desc" },
    rowLimit: 12,
    dashboardBehavior: { pinToMatterContext: true },
    permissionScope: ["matter:read", "calendar_event:read"],
  },
  {
    id: "uncontacted_intake_clients",
    name: "Uncontacted intake clients",
    saveLabel: "Save intake clients",
    statusLabel: "uncontacted intake clients",
    filters: {
      source: "dashboard-matters",
      presetFamily: "uncontacted_intake_clients",
      operationalViewKeys: ["uncontacted_clients"],
      statuses: ["intake"],
    },
    columns: ["number", "practiceArea", "status"],
    sort: { priority: "desc", lastActivityAt: "asc" },
    rowLimit: 12,
    dashboardBehavior: { pinToMatterContext: true },
    permissionScope: ["matter:read", "intake_session:read"],
  },
  {
    id: "expiring_upload_links",
    name: "Expiring upload links",
    saveLabel: "Save upload links",
    statusLabel: "expiring upload links",
    filters: {
      source: "dashboard-matters",
      presetFamily: "expiring_upload_links",
      operationalViewKeys: ["external_uploads_expiring"],
      statuses: ["intake", "open", "paused"],
    },
    columns: ["number", "practiceArea", "status"],
    sort: { dueAt: "asc", priority: "desc" },
    rowLimit: 12,
    dashboardBehavior: { pinToMatterContext: true },
    permissionScope: ["matter:read", "external_upload:read"],
  },
];

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

function cloneMatterPresetFilters(
  filters: SavedMatterOperationalViewPreset["filters"],
): SavedMatterOperationalViewPreset["filters"] {
  return {
    ...filters,
    operationalViewKeys: [...filters.operationalViewKeys],
    ...(filters.statuses ? { statuses: [...filters.statuses] } : {}),
  };
}

export function buildSavedMatterOperationalViewDefinitionPayload(
  preset: SavedMatterOperationalViewPreset,
  sequence: number,
): SavedMatterOperationalViewDefinitionPayload {
  return {
    surface: "matters",
    name: `${preset.name} ${sequence}`,
    filters: cloneMatterPresetFilters(preset.filters),
    columns: [...preset.columns],
    sort: { ...preset.sort },
    rowLimit: preset.rowLimit,
    dashboardBehavior: { ...preset.dashboardBehavior },
    permissionScope: [...preset.permissionScope],
  };
}

export function savedMatterOperationalViewPresetForDefinition(
  definition: SavedOperationalViewDefinition,
): SavedMatterOperationalViewPreset | undefined {
  const presetFamily = definition.filters.presetFamily;
  if (typeof presetFamily !== "string") return undefined;
  return SAVED_MATTER_OPERATIONAL_VIEW_PRESETS.find((preset) => preset.id === presetFamily);
}

export function savedMatterOperationalViewPresetLabel(
  definition: SavedOperationalViewDefinition,
): string {
  return savedMatterOperationalViewPresetForDefinition(definition)?.name ?? "Matter command centre";
}

function savedMatterViewKeys(definition: SavedOperationalViewDefinition): Set<string> {
  const rawKeys = definition.filters.operationalViewKeys;
  if (Array.isArray(rawKeys)) {
    return new Set(
      rawKeys.filter((key): key is string => typeof key === "string" && key.length > 0),
    );
  }
  const preset = savedMatterOperationalViewPresetForDefinition(definition);
  return new Set(preset?.filters.operationalViewKeys ?? []);
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
