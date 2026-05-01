import type { DashboardSectionKey } from "@open-practice/domain";

export type OpenPracticeRouteId =
  | "matters"
  | "billing"
  | "documents"
  | "shares"
  | "externalUploads"
  | "drafting"
  | "calendar"
  | "signatures"
  | "intake"
  | "funds"
  | "audit"
  | "queues";

export type OpenPracticeRouteArea = "workspace" | "operations" | "finance" | "review";
export type OpenPracticeDashboardSectionKey = DashboardSectionKey | "externalUploads";

export interface OpenPracticeRouteCatalogEntry {
  id: OpenPracticeRouteId;
  title: string;
  shortLabel: string;
  path: string;
  sectionKey?: OpenPracticeDashboardSectionKey;
  area: OpenPracticeRouteArea;
  requiresMatterContext: boolean;
  order: number;
  showInSidebar: boolean;
}

export interface RouteCatalogSectionCapability {
  key: OpenPracticeDashboardSectionKey;
  enabled: boolean;
}

export type OpenPracticeSidebarSectionKey = OpenPracticeDashboardSectionKey | "shares";

export interface OpenPracticeSidebarNavigationSection {
  key: OpenPracticeSidebarSectionKey;
  label: string;
  enabled: boolean;
}

export type DashboardNavigationSectionKey = OpenPracticeSidebarNavigationSection["key"];

export type DashboardRouteSelectionStatus =
  | "default"
  | "matched"
  | "unknown"
  | "disabled"
  | "queue"
  | "non_sidebar";

export interface DashboardRouteSelection {
  sectionKey: DashboardNavigationSectionKey;
  status: DashboardRouteSelectionStatus;
  requestedSection: string | null;
  entry: OpenPracticeRouteCatalogEntry | null;
}

export const routeCatalog: readonly OpenPracticeRouteCatalogEntry[] = [
  {
    id: "matters",
    title: "Matters",
    shortLabel: "Matters",
    path: "/?section=matters",
    sectionKey: "matters",
    area: "workspace",
    requiresMatterContext: true,
    order: 10,
    showInSidebar: true,
  },
  {
    id: "funds",
    title: "Trust Funds",
    shortLabel: "Funds",
    path: "/?section=funds",
    sectionKey: "funds",
    area: "finance",
    requiresMatterContext: true,
    order: 20,
    showInSidebar: true,
  },
  {
    id: "billing",
    title: "Billing",
    shortLabel: "Billing",
    path: "/?section=billing",
    sectionKey: "billing",
    area: "finance",
    requiresMatterContext: true,
    order: 30,
    showInSidebar: true,
  },
  {
    id: "documents",
    title: "Documents",
    shortLabel: "Documents",
    path: "/?section=documents",
    sectionKey: "documents",
    area: "workspace",
    requiresMatterContext: true,
    order: 40,
    showInSidebar: true,
  },
  {
    id: "shares",
    title: "Share Links",
    shortLabel: "Shares",
    path: "/?section=shares",
    area: "operations",
    requiresMatterContext: true,
    order: 42,
    showInSidebar: true,
  },
  {
    id: "externalUploads",
    title: "External Uploads",
    shortLabel: "Uploads",
    path: "/?section=externalUploads",
    sectionKey: "externalUploads",
    area: "workspace",
    requiresMatterContext: true,
    order: 44,
    showInSidebar: true,
  },
  {
    id: "drafting",
    title: "Drafting",
    shortLabel: "Drafting",
    path: "/?section=drafting",
    sectionKey: "drafting",
    area: "workspace",
    requiresMatterContext: true,
    order: 45,
    showInSidebar: true,
  },
  {
    id: "calendar",
    title: "Calendar Radar",
    shortLabel: "Calendar",
    path: "/?section=calendar",
    sectionKey: "calendar",
    area: "workspace",
    requiresMatterContext: true,
    order: 47,
    showInSidebar: true,
  },
  {
    id: "signatures",
    title: "Signatures",
    shortLabel: "Signatures",
    path: "/?section=signatures",
    sectionKey: "signatures",
    area: "operations",
    requiresMatterContext: true,
    order: 50,
    showInSidebar: true,
  },
  {
    id: "intake",
    title: "Intake",
    shortLabel: "Intake",
    path: "/?section=intake",
    sectionKey: "intake",
    area: "operations",
    requiresMatterContext: true,
    order: 60,
    showInSidebar: true,
  },
  {
    id: "audit",
    title: "Audit Review",
    shortLabel: "Audit",
    path: "/?section=audit",
    sectionKey: "audit",
    area: "review",
    requiresMatterContext: false,
    order: 70,
    showInSidebar: true,
  },
  {
    id: "queues",
    title: "Operational Queues",
    shortLabel: "Queues",
    path: "/?section=queues",
    area: "operations",
    requiresMatterContext: false,
    order: 80,
    showInSidebar: false,
  },
];

const routeById = new Map(routeCatalog.map((entry) => [entry.id, entry] as const));
const defaultDashboardSectionKey = "matters" satisfies DashboardNavigationSectionKey;

export function getRouteCatalogEntry(id: OpenPracticeRouteId): OpenPracticeRouteCatalogEntry {
  const entry = routeById.get(id);
  if (!entry) {
    throw new Error(`Unknown Open Practice route id: ${id}`);
  }
  return entry;
}

export function getRoutesByArea(area: OpenPracticeRouteArea): OpenPracticeRouteCatalogEntry[] {
  return routeCatalog
    .filter((entry) => entry.area === area)
    .sort((left, right) => left.order - right.order);
}

export function getSidebarRouteCatalogEntries(): OpenPracticeRouteCatalogEntry[] {
  return routeCatalog
    .filter((entry) => entry.showInSidebar)
    .sort((left, right) => left.order - right.order);
}

export function buildSidebarNavigationSections(input: {
  billingCanView: boolean;
  capabilitySections: RouteCatalogSectionCapability[];
  shareLinksEnabled?: boolean;
  externalUploadsEnabled?: boolean;
}): OpenPracticeSidebarNavigationSection[] {
  const sidebarEntryBySectionKey = new Map(
    getSidebarRouteCatalogEntries().flatMap((entry) =>
      entry.sectionKey ? [[entry.sectionKey, entry] as const] : [],
    ),
  );
  const hasBillingCapability = input.capabilitySections.some(
    (section) => section.key === "billing",
  );
  const hasExternalUploadsCapability = input.capabilitySections.some(
    (section) => section.key === "externalUploads",
  );
  const displayCandidates: Array<{
    key: OpenPracticeSidebarSectionKey;
    label: string;
    enabled: boolean;
    order: number;
  }> = input.capabilitySections.map((section) => {
    const entry = sidebarEntryBySectionKey.get(section.key);
    if (!entry) {
      throw new Error(`Displayed dashboard section "${section.key}" is missing a catalog entry.`);
    }
    return {
      key: section.key,
      label: entry.shortLabel,
      enabled: section.key === "billing" ? input.billingCanView : section.enabled,
      order: entry.order,
    };
  });

  if (!hasBillingCapability) {
    const billingEntry = sidebarEntryBySectionKey.get("billing");
    if (billingEntry) {
      displayCandidates.push({
        key: "billing",
        label: billingEntry.shortLabel,
        enabled: input.billingCanView,
        order: billingEntry.order,
      });
    }
  }
  const shareLinksEntry = getRouteCatalogEntry("shares");
  displayCandidates.push({
    key: "shares",
    label: shareLinksEntry.shortLabel,
    enabled: input.shareLinksEnabled ?? false,
    order: shareLinksEntry.order,
  });

  if (!hasExternalUploadsCapability) {
    const externalUploadsEntry = sidebarEntryBySectionKey.get("externalUploads");
    if (externalUploadsEntry) {
      displayCandidates.push({
        key: "externalUploads",
        label: externalUploadsEntry.shortLabel,
        enabled: input.externalUploadsEnabled ?? false,
        order: externalUploadsEntry.order,
      });
    }
  }

  return displayCandidates
    .sort((left, right) => left.order - right.order)
    .map(({ key, label, enabled }) => ({ key, label, enabled }));
}

function findRouteCatalogEntryBySection(section: string): OpenPracticeRouteCatalogEntry | null {
  return routeCatalog.find((entry) => entry.id === section || entry.sectionKey === section) ?? null;
}

function resolveFallbackSection(
  navigationSections: OpenPracticeSidebarNavigationSection[],
): DashboardNavigationSectionKey {
  const enabledDefault = navigationSections.find(
    (section) => section.key === defaultDashboardSectionKey && section.enabled,
  );
  if (enabledDefault) return enabledDefault.key;
  return navigationSections.find((section) => section.enabled)?.key ?? defaultDashboardSectionKey;
}

export function resolveDashboardRouteSelection(input: {
  requestedSection?: string | null;
  navigationSections: OpenPracticeSidebarNavigationSection[];
}): DashboardRouteSelection {
  const requestedSection = input.requestedSection?.trim() || null;
  const fallbackSection = resolveFallbackSection(input.navigationSections);

  if (!requestedSection) {
    return {
      sectionKey: fallbackSection,
      status: "default",
      requestedSection,
      entry: getRouteCatalogEntry("matters"),
    };
  }

  const entry = findRouteCatalogEntryBySection(requestedSection);
  if (!entry) {
    return {
      sectionKey: fallbackSection,
      status: "unknown",
      requestedSection,
      entry: null,
    };
  }

  if (entry.id === "queues") {
    return {
      sectionKey: fallbackSection,
      status: "queue",
      requestedSection,
      entry,
    };
  }

  if (!entry.showInSidebar || !entry.sectionKey) {
    return {
      sectionKey: fallbackSection,
      status: "non_sidebar",
      requestedSection,
      entry,
    };
  }

  const navigationSection = input.navigationSections.find(
    (section) => section.key === entry.sectionKey,
  );
  if (!navigationSection?.enabled) {
    return {
      sectionKey: fallbackSection,
      status: "disabled",
      requestedSection,
      entry,
    };
  }

  return {
    sectionKey: navigationSection.key,
    status: "matched",
    requestedSection,
    entry,
  };
}

export function getDashboardSectionPath(sectionKey: DashboardNavigationSectionKey): string {
  return `/?section=${sectionKey}`;
}

export function buildDashboardSectionUrl(
  currentHref: string,
  sectionKey: DashboardNavigationSectionKey,
): string {
  const url = new URL(currentHref, "http://open-practice.local");
  url.searchParams.set("section", sectionKey);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function matchRouteCatalogEntry(path: string): OpenPracticeRouteCatalogEntry | null {
  const [, query = ""] = path.split("?");
  const section = new URLSearchParams(query).get("section");
  if (!section) return getRouteCatalogEntry("matters");
  return findRouteCatalogEntryBySection(section);
}
