import { routeCatalog, type OpenPracticeSidebarNavigationSection } from "../routes/routeCatalog";
import type {
  MatterSummary,
  OperationalViewsResponse,
  QueuesResponse,
  SavedOperationalViewDefinition,
} from "./types";

export type DashboardLaneFreshnessTone = "neutral" | "ready" | "risk";
type FirstMatterClientKind = "person" | "organization";
type FirstMatterJurisdiction = MatterSummary["jurisdiction"];

export interface FirstMatterFormState {
  title: string;
  practiceArea: string;
  jurisdiction: FirstMatterJurisdiction;
  clientKind: FirstMatterClientKind;
  clientDisplayName: string;
  clientEmail: string;
  clientPhone: string;
}

export interface InboundEmailMatterDraftFormState extends FirstMatterFormState {
  redactedBodySummary: string;
}

export interface CreateMatterPayload {
  title: string;
  practiceArea: string;
  jurisdiction: FirstMatterJurisdiction;
  client: {
    kind: FirstMatterClientKind;
    displayName: string;
    email?: string;
    phone?: string;
  };
}

export interface InboundEmailMatterDraftPayload {
  redactedBodySummary: string;
  proposedMatter: {
    title: string;
    practiceArea: string;
    jurisdiction: FirstMatterJurisdiction;
    client: {
      kind: FirstMatterClientKind;
      displayName: string;
    };
  };
}

export const initialFirstMatterFormState: FirstMatterFormState = {
  title: "",
  practiceArea: "Residential tenancy",
  jurisdiction: "BC",
  clientKind: "person",
  clientDisplayName: "",
  clientEmail: "",
  clientPhone: "",
};

export const initialInboundEmailMatterDraftFormState: InboundEmailMatterDraftFormState = {
  ...initialFirstMatterFormState,
  redactedBodySummary: "",
};

export const firstMatterJurisdictionOptions: FirstMatterJurisdiction[] = [
  "BC",
  "ON",
  "CANADA",
  "OTHER",
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

export function canSubmitFirstMatter(form: FirstMatterFormState): boolean {
  return Boolean(form.title.trim() && form.practiceArea.trim() && form.clientDisplayName.trim());
}

export function canSubmitInboundEmailMatterDraft(form: InboundEmailMatterDraftFormState): boolean {
  return Boolean(form.redactedBodySummary.trim() && canSubmitFirstMatter(form));
}

export function buildCreateMatterPayload(form: FirstMatterFormState): CreateMatterPayload {
  const payload: CreateMatterPayload = {
    title: form.title.trim(),
    practiceArea: form.practiceArea.trim(),
    jurisdiction: form.jurisdiction,
    client: {
      kind: form.clientKind,
      displayName: form.clientDisplayName.trim(),
    },
  };
  const email = form.clientEmail.trim();
  const phone = form.clientPhone.trim();
  if (email) payload.client.email = email;
  if (phone) payload.client.phone = phone;
  return payload;
}

export function buildInboundEmailMatterDraftPayload(
  form: InboundEmailMatterDraftFormState,
): InboundEmailMatterDraftPayload {
  return {
    redactedBodySummary: form.redactedBodySummary.trim(),
    proposedMatter: {
      title: form.title.trim(),
      practiceArea: form.practiceArea.trim(),
      jurisdiction: form.jurisdiction,
      client: {
        kind: form.clientKind,
        displayName: form.clientDisplayName.trim(),
      },
    },
  };
}

export function describeDisabledNavigationReason(
  section: Pick<
    OpenPracticeSidebarNavigationSection,
    "key" | "label" | "enabled" | "disabledReason"
  >,
): string | null {
  if (section.enabled) return null;
  if (section.disabledReason) return section.disabledReason;
  if (section.key === "matters") return "Matters require assigned matter read access.";
  if (section.key === "contacts") return "Contacts require contact read access.";
  if (section.key === "funds") return "Funds require trust ledger read access.";
  if (section.key === "billing") return "Billing requires trust ledger and billing read access.";
  if (section.key === "documents") return "Documents require matter-scoped document read access.";
  if (section.key === "drafting") return "Drafting requires matter-scoped draft read access.";
  if (section.key === "calendar") return "Calendar requires matter-scoped calendar read access.";
  if (section.key === "signatures") {
    return "Signatures require matter-scoped signature request read access.";
  }
  if (section.key === "intake") return "Intake requires matter-scoped intake read access.";
  if (section.key === "audit") return "Audit review requires audit log read access.";
  if (section.key === "reports") return "Reports require firm reporting access.";
  if (section.key === "admin") return "Admin readiness requires owner/admin or auditor access.";
  if (section.key === "queues") return "Operational queues require job or audit read access.";
  if (section.key === "shares") {
    return "Share links require token signing and share-link access.";
  }
  if (section.key === "externalUploads") {
    return "External uploads require S3 storage, token signing, and upload access.";
  }
  return `${section.label} requires access that is not enabled for this role.`;
}

const zeroMatterDisabledNavigationKeys = new Set<OpenPracticeSidebarNavigationSection["key"]>(
  routeCatalog
    .filter((entry) => entry.showInSidebar && entry.availability === "matter")
    .map((entry) => (entry.sectionKey ?? entry.id) as OpenPracticeSidebarNavigationSection["key"]),
);

const matterScopedNavigationKeys = new Set<OpenPracticeSidebarNavigationSection["key"]>(
  routeCatalog
    .filter((entry) => entry.showInSidebar && entry.requiresMatterContext)
    .map((entry) => (entry.sectionKey ?? entry.id) as OpenPracticeSidebarNavigationSection["key"]),
);

export function applyMatterAvailabilityToNavigation(
  sections: OpenPracticeSidebarNavigationSection[],
  hasAccessibleMatter: boolean,
  canCreateMatter = false,
): OpenPracticeSidebarNavigationSection[] {
  if (hasAccessibleMatter) return sections;

  return sections.map((section) => {
    if (section.key === "matters" && canCreateMatter) {
      return { ...section, enabled: true, disabledReason: undefined };
    }
    if (!zeroMatterDisabledNavigationKeys.has(section.key)) return section;
    return {
      ...section,
      enabled: false,
      disabledReason: "Create or assign a matter to enable this matter-scoped section.",
    };
  });
}

export function enableMatterScopedCapabilitiesForLocalMatter<
  Section extends {
    key: string;
    enabled: boolean;
    actions?: string[];
  },
>(sections: Section[], hasAccessibleMatter: boolean): Section[] {
  if (!hasAccessibleMatter) return sections;

  return sections.map((section) => {
    if (
      !matterScopedNavigationKeys.has(section.key as OpenPracticeSidebarNavigationSection["key"]) ||
      !section.actions?.includes("read")
    ) {
      return section;
    }
    return { ...section, enabled: true };
  });
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

export type SavedMatterPresetFamily =
  | "matter_follow_up"
  | "matter_risk_review"
  | "matter_action_required";

export interface SavedMatterPresetDefinition {
  family: SavedMatterPresetFamily;
  label: string;
  namePrefix: string;
  summaryLabel: string;
  operationalViewKeys: string[];
  statuses: string[];
  sort: Record<string, string>;
}

const savedMatterPresetDefinitionsByFamily: Record<
  SavedMatterPresetFamily,
  SavedMatterPresetDefinition
> = {
  matter_follow_up: {
    family: "matter_follow_up",
    label: "Follow-up",
    namePrefix: "Matter follow-up",
    summaryLabel: "follow-up",
    operationalViewKeys: ["stale_matters", "uncontacted_clients"],
    statuses: ["intake", "open", "paused"],
    sort: { priority: "desc", lastActivityAt: "asc" },
  },
  matter_risk_review: {
    family: "matter_risk_review",
    label: "Risk review",
    namePrefix: "Matter risk review",
    summaryLabel: "risk review",
    operationalViewKeys: ["conflicts_pending_review", "external_uploads_expiring"],
    statuses: ["intake", "open", "paused"],
    sort: { priority: "desc", dueAt: "asc" },
  },
  matter_action_required: {
    family: "matter_action_required",
    label: "Action required",
    namePrefix: "Matter action required",
    summaryLabel: "action required",
    operationalViewKeys: ["awaiting_signature", "overdue_tasks_deadlines"],
    statuses: ["intake", "open", "paused"],
    sort: { priority: "desc", dueAt: "asc" },
  },
};

export const savedMatterPresetOptions = Object.values(savedMatterPresetDefinitionsByFamily);

export function getSavedMatterPresetDefinition(value: unknown): SavedMatterPresetDefinition | null {
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(savedMatterPresetDefinitionsByFamily, value)
  ) {
    return null;
  }
  return savedMatterPresetDefinitionsByFamily[value as SavedMatterPresetFamily];
}

function savedMatterViewKeys(definition: SavedOperationalViewDefinition): Set<string> {
  const rawKeys = definition.filters.operationalViewKeys;
  const rawFamily = definition.filters.presetFamily;
  if (typeof rawFamily === "string") {
    const presetDefinition = getSavedMatterPresetDefinition(rawFamily);
    if (!presetDefinition) return new Set();
    if (Array.isArray(rawKeys)) {
      const keys = rawKeys.filter(
        (key): key is string => typeof key === "string" && key.length > 0,
      );
      if (keys.length > 0) return new Set(keys);
    }
    return new Set(presetDefinition.operationalViewKeys);
  }
  if (Array.isArray(rawKeys)) {
    return new Set(
      rawKeys.filter((key): key is string => typeof key === "string" && key.length > 0),
    );
  }
  return new Set();
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
  if (viewKeys.size === 0) return [];
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
