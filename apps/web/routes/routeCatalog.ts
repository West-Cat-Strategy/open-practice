import type { DashboardSectionKey } from "@open-practice/domain";

export type OpenPracticeRouteId =
  | "matters"
  | "billing"
  | "documents"
  | "shares"
  | "drafting"
  | "signatures"
  | "intake"
  | "funds"
  | "audit"
  | "queues";

export type OpenPracticeRouteArea = "workspace" | "operations" | "finance" | "review";

export interface OpenPracticeRouteCatalogEntry {
  id: OpenPracticeRouteId;
  title: string;
  shortLabel: string;
  path: string;
  sectionKey?: DashboardSectionKey | "billing";
  area: OpenPracticeRouteArea;
  requiresMatterContext: boolean;
  order: number;
  showInSidebar: boolean;
}

export interface RouteCatalogSectionCapability {
  key: DashboardSectionKey;
  enabled: boolean;
}

export type OpenPracticeSidebarSectionKey = DashboardSectionKey | "billing" | "shares";

export interface OpenPracticeSidebarNavigationSection {
  key: OpenPracticeSidebarSectionKey;
  label: string;
  enabled: boolean;
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
}): OpenPracticeSidebarNavigationSection[] {
  const sidebarEntryBySectionKey = new Map(
    getSidebarRouteCatalogEntries().flatMap((entry) =>
      entry.sectionKey ? [[entry.sectionKey, entry] as const] : [],
    ),
  );
  const hasBillingCapability = input.capabilitySections.some(
    (section) => section.key === "billing",
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

  return displayCandidates
    .sort((left, right) => left.order - right.order)
    .map(({ key, label, enabled }) => ({ key, label, enabled }));
}

export function matchRouteCatalogEntry(path: string): OpenPracticeRouteCatalogEntry | null {
  const [, query = ""] = path.split("?");
  const section = new URLSearchParams(query).get("section");
  if (!section) return getRouteCatalogEntry("matters");
  return routeCatalog.find((entry) => entry.id === section || entry.sectionKey === section) ?? null;
}
