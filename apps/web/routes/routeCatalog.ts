import type { DashboardSectionKey } from "@open-practice/domain";

export type OpenPracticeRouteId =
  | "matters"
  | "contacts"
  | "communications"
  | "billing"
  | "documents"
  | "research"
  | "shares"
  | "externalUploads"
  | "drafting"
  | "tasks"
  | "calendar"
  | "signatures"
  | "intake"
  | "funds"
  | "audit"
  | "reports"
  | "admin"
  | "queues";

export type OpenPracticeRouteArea = "workspace" | "operations" | "finance" | "review";
export type OpenPracticeRouteAvailability = "firm" | "mixed" | "matter";
export type OpenPracticeDashboardSectionKey =
  | DashboardSectionKey
  | "shares"
  | "externalUploads"
  | "communications"
  | "admin"
  | "queues";

export interface OpenPracticeRouteCatalogEntry {
  id: OpenPracticeRouteId;
  title: string;
  shortLabel: string;
  path: string;
  sectionKey?: OpenPracticeDashboardSectionKey;
  area: OpenPracticeRouteArea;
  availability: OpenPracticeRouteAvailability;
  requiresMatterContext: boolean;
  order: number;
  showInSidebar: boolean;
}

export interface RouteCatalogSectionCapability {
  key: OpenPracticeDashboardSectionKey;
  enabled: boolean;
}

export type OpenPracticeSidebarSectionKey = OpenPracticeDashboardSectionKey;

export interface OpenPracticeSidebarNavigationSection {
  key: OpenPracticeSidebarSectionKey;
  label: string;
  title: string;
  area: OpenPracticeRouteArea;
  availability: OpenPracticeRouteAvailability;
  enabled: boolean;
  requiresMatterContext: boolean;
  disabledReason?: string;
}

export type DashboardNavigationSectionKey = OpenPracticeSidebarNavigationSection["key"];

export type DashboardRouteSelectionStatus =
  | "default"
  | "matched"
  | "unknown"
  | "disabled"
  | "non_sidebar";

export interface DashboardRouteSelection {
  sectionKey: DashboardNavigationSectionKey;
  status: DashboardRouteSelectionStatus;
  requestedSection: string | null;
  entry: OpenPracticeRouteCatalogEntry | null;
}

export function isUnavailableDashboardRouteSelection(
  selection: Pick<DashboardRouteSelection, "status">,
): boolean {
  return (
    selection.status === "unknown" ||
    selection.status === "disabled" ||
    selection.status === "non_sidebar"
  );
}

export const routeCatalog: readonly OpenPracticeRouteCatalogEntry[] = [
  {
    id: "matters",
    title: "Matters",
    shortLabel: "Matters",
    path: "/workspace/matters",
    sectionKey: "matters",
    area: "workspace",
    availability: "firm",
    requiresMatterContext: true,
    order: 10,
    showInSidebar: true,
  },
  {
    id: "contacts",
    title: "Contacts",
    shortLabel: "Contacts",
    path: "/workspace/contacts",
    sectionKey: "contacts",
    area: "workspace",
    availability: "firm",
    requiresMatterContext: false,
    order: 15,
    showInSidebar: true,
  },
  {
    id: "communications",
    title: "Communications",
    shortLabel: "Comms",
    path: "/workspace/communications",
    sectionKey: "communications",
    area: "workspace",
    availability: "mixed",
    requiresMatterContext: false,
    order: 16,
    showInSidebar: true,
  },
  {
    id: "funds",
    title: "Trust Funds",
    shortLabel: "Funds",
    path: "/finance/trust-funds",
    sectionKey: "funds",
    area: "finance",
    availability: "mixed",
    requiresMatterContext: true,
    order: 20,
    showInSidebar: true,
  },
  {
    id: "billing",
    title: "Billing",
    shortLabel: "Billing",
    path: "/finance/billing",
    sectionKey: "billing",
    area: "finance",
    availability: "mixed",
    requiresMatterContext: true,
    order: 30,
    showInSidebar: true,
  },
  {
    id: "documents",
    title: "Documents",
    shortLabel: "Documents",
    path: "/workspace/documents",
    sectionKey: "documents",
    area: "workspace",
    availability: "mixed",
    requiresMatterContext: true,
    order: 40,
    showInSidebar: true,
  },
  {
    id: "research",
    title: "Research",
    shortLabel: "Research",
    path: "/workspace/research",
    sectionKey: "research",
    area: "workspace",
    availability: "mixed",
    requiresMatterContext: true,
    order: 41,
    showInSidebar: true,
  },
  {
    id: "shares",
    title: "Share Links",
    shortLabel: "Shares",
    path: "/operations/share-links",
    sectionKey: "shares",
    area: "operations",
    availability: "mixed",
    requiresMatterContext: true,
    order: 42,
    showInSidebar: true,
  },
  {
    id: "externalUploads",
    title: "External Uploads",
    shortLabel: "Uploads",
    path: "/operations/external-uploads",
    sectionKey: "externalUploads",
    area: "operations",
    availability: "mixed",
    requiresMatterContext: true,
    order: 44,
    showInSidebar: true,
  },
  {
    id: "drafting",
    title: "Drafting",
    shortLabel: "Drafting",
    path: "/workspace/drafting",
    sectionKey: "drafting",
    area: "workspace",
    availability: "mixed",
    requiresMatterContext: true,
    order: 45,
    showInSidebar: true,
  },
  {
    id: "tasks",
    title: "Tasks",
    shortLabel: "Tasks",
    path: "/operations/tasks",
    sectionKey: "tasks",
    area: "operations",
    availability: "firm",
    requiresMatterContext: false,
    order: 46,
    showInSidebar: true,
  },
  {
    id: "calendar",
    title: "Calendar Radar",
    shortLabel: "Calendar",
    path: "/workspace/calendar",
    sectionKey: "calendar",
    area: "workspace",
    availability: "mixed",
    requiresMatterContext: true,
    order: 47,
    showInSidebar: true,
  },
  {
    id: "signatures",
    title: "Signatures",
    shortLabel: "Signatures",
    path: "/operations/signatures",
    sectionKey: "signatures",
    area: "operations",
    availability: "mixed",
    requiresMatterContext: true,
    order: 50,
    showInSidebar: true,
  },
  {
    id: "intake",
    title: "Intake",
    shortLabel: "Intake",
    path: "/operations/intake",
    sectionKey: "intake",
    area: "operations",
    availability: "mixed",
    requiresMatterContext: true,
    order: 60,
    showInSidebar: true,
  },
  {
    id: "audit",
    title: "Audit Review",
    shortLabel: "Audit",
    path: "/review/audit",
    sectionKey: "audit",
    area: "review",
    availability: "firm",
    requiresMatterContext: false,
    order: 70,
    showInSidebar: true,
  },
  {
    id: "reports",
    title: "Reports",
    shortLabel: "Reports",
    path: "/review/reports",
    sectionKey: "reports",
    area: "review",
    availability: "firm",
    requiresMatterContext: false,
    order: 75,
    showInSidebar: true,
  },
  {
    id: "admin",
    title: "Admin Readiness",
    shortLabel: "Admin",
    path: "/review/admin-readiness",
    sectionKey: "admin",
    area: "review",
    availability: "firm",
    requiresMatterContext: false,
    order: 78,
    showInSidebar: true,
  },
  {
    id: "queues",
    title: "Operational Queues",
    shortLabel: "Queues",
    path: "/operations/queues",
    sectionKey: "queues",
    area: "operations",
    availability: "firm",
    requiresMatterContext: false,
    order: 80,
    showInSidebar: true,
  },
];

const routeById = new Map(routeCatalog.map((entry) => [entry.id, entry] as const));
const routeByCanonicalPath = new Map(
  routeCatalog.map((entry) => [normalizeRouteCatalogPath(entry.path), entry] as const),
);
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
  communicationsEnabled?: boolean;
  shareLinksEnabled?: boolean;
  externalUploadsEnabled?: boolean;
  adminReadinessEnabled?: boolean;
}): OpenPracticeSidebarNavigationSection[] {
  const sidebarEntryBySectionKey = new Map(
    getSidebarRouteCatalogEntries().flatMap((entry) =>
      entry.sectionKey ? [[entry.sectionKey, entry] as const] : [],
    ),
  );
  const hasBillingCapability = input.capabilitySections.some(
    (section) => section.key === "billing",
  );
  const hasCommunicationsCapability = input.capabilitySections.some(
    (section) => section.key === "communications",
  );
  const hasShareLinksCapability = input.capabilitySections.some(
    (section) => section.key === "shares",
  );
  const hasExternalUploadsCapability = input.capabilitySections.some(
    (section) => section.key === "externalUploads",
  );
  const displayCandidates: Array<{
    key: OpenPracticeSidebarSectionKey;
    label: string;
    title: string;
    area: OpenPracticeRouteArea;
    availability: OpenPracticeRouteAvailability;
    enabled: boolean;
    order: number;
    requiresMatterContext: boolean;
  }> = input.capabilitySections.map((section) => {
    const entry = sidebarEntryBySectionKey.get(section.key);
    if (!entry) {
      throw new Error(`Displayed dashboard section "${section.key}" is missing a catalog entry.`);
    }
    return {
      key: section.key,
      label: entry.shortLabel,
      title: entry.title,
      area: entry.area,
      availability: entry.availability,
      enabled:
        section.key === "billing"
          ? input.billingCanView
          : section.key === "shares"
            ? section.enabled && (input.shareLinksEnabled ?? false)
            : section.key === "externalUploads"
              ? section.enabled && (input.externalUploadsEnabled ?? false)
              : section.enabled,
      order: entry.order,
      requiresMatterContext: entry.requiresMatterContext,
    };
  });

  if (!hasBillingCapability) {
    const billingEntry = sidebarEntryBySectionKey.get("billing");
    if (billingEntry) {
      displayCandidates.push({
        key: "billing",
        label: billingEntry.shortLabel,
        title: billingEntry.title,
        area: billingEntry.area,
        availability: billingEntry.availability,
        enabled: input.billingCanView,
        order: billingEntry.order,
        requiresMatterContext: billingEntry.requiresMatterContext,
      });
    }
  }
  if (!hasCommunicationsCapability) {
    const communicationsEntry = getRouteCatalogEntry("communications");
    displayCandidates.push({
      key: "communications",
      label: communicationsEntry.shortLabel,
      title: communicationsEntry.title,
      area: communicationsEntry.area,
      availability: communicationsEntry.availability,
      enabled: input.communicationsEnabled ?? true,
      order: communicationsEntry.order,
      requiresMatterContext: communicationsEntry.requiresMatterContext,
    });
  }
  if (!hasShareLinksCapability) {
    const shareLinksEntry = getRouteCatalogEntry("shares");
    displayCandidates.push({
      key: "shares",
      label: shareLinksEntry.shortLabel,
      title: shareLinksEntry.title,
      area: shareLinksEntry.area,
      availability: shareLinksEntry.availability,
      enabled: input.shareLinksEnabled ?? false,
      order: shareLinksEntry.order,
      requiresMatterContext: shareLinksEntry.requiresMatterContext,
    });
  }

  if (!hasExternalUploadsCapability) {
    const externalUploadsEntry = sidebarEntryBySectionKey.get("externalUploads");
    if (externalUploadsEntry) {
      displayCandidates.push({
        key: "externalUploads",
        label: externalUploadsEntry.shortLabel,
        title: externalUploadsEntry.title,
        area: externalUploadsEntry.area,
        availability: externalUploadsEntry.availability,
        enabled: input.externalUploadsEnabled ?? false,
        order: externalUploadsEntry.order,
        requiresMatterContext: externalUploadsEntry.requiresMatterContext,
      });
    }
  }
  const queuesEntry = sidebarEntryBySectionKey.get("queues");
  const hasQueuesCandidate = displayCandidates.some((candidate) => candidate.key === "queues");
  if (queuesEntry && !hasQueuesCandidate) {
    displayCandidates.push({
      key: "queues",
      label: queuesEntry.shortLabel,
      title: queuesEntry.title,
      area: queuesEntry.area,
      availability: queuesEntry.availability,
      enabled: true,
      order: queuesEntry.order,
      requiresMatterContext: queuesEntry.requiresMatterContext,
    });
  }
  const adminEntry = sidebarEntryBySectionKey.get("admin");
  const hasAdminCandidate = displayCandidates.some((candidate) => candidate.key === "admin");
  if (adminEntry && !hasAdminCandidate) {
    displayCandidates.push({
      key: "admin",
      label: adminEntry.shortLabel,
      title: adminEntry.title,
      area: adminEntry.area,
      availability: adminEntry.availability,
      enabled: input.adminReadinessEnabled ?? false,
      order: adminEntry.order,
      requiresMatterContext: adminEntry.requiresMatterContext,
    });
  }

  return displayCandidates
    .sort((left, right) => left.order - right.order)
    .map(({ key, label, title, area, availability, enabled, requiresMatterContext }) => ({
      key,
      label,
      title,
      area,
      availability,
      enabled,
      requiresMatterContext,
    }));
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
      entry: getRouteCatalogEntry(fallbackSection),
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
  const entry = findRouteCatalogEntryBySection(sectionKey);
  if (!entry) {
    throw new Error(`Unknown Open Practice dashboard section: ${sectionKey}`);
  }
  return entry.path;
}

export function buildDashboardSectionUrl(
  currentHref: string,
  sectionKey: DashboardNavigationSectionKey,
): string {
  const url = new URL(currentHref, "http://open-practice.local");
  url.pathname = getDashboardSectionPath(sectionKey);
  url.searchParams.delete("section");
  return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeRouteCatalogPath(pathname: string): string {
  const normalized = pathname.trim() || "/";
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

export function matchRouteCatalogEntry(path: string): OpenPracticeRouteCatalogEntry | null {
  const url = new URL(path, "http://open-practice.local");
  const section = url.searchParams.get("section")?.trim();
  if (section) return findRouteCatalogEntryBySection(section);

  const normalizedPath = normalizeRouteCatalogPath(url.pathname);
  if (normalizedPath === "/") return getRouteCatalogEntry("matters");
  return routeByCanonicalPath.get(normalizedPath) ?? null;
}
