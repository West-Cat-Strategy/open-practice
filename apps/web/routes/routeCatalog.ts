import type { DashboardSectionKey } from "@open-practice/domain";

export type OpenPracticeRouteId =
  | "matters"
  | "billing"
  | "documents"
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
  },
  {
    id: "billing",
    title: "Billing",
    shortLabel: "Billing",
    path: "/?section=billing",
    sectionKey: "billing",
    area: "finance",
    requiresMatterContext: true,
    order: 20,
  },
  {
    id: "documents",
    title: "Documents",
    shortLabel: "Docs",
    path: "/?section=documents",
    sectionKey: "documents",
    area: "workspace",
    requiresMatterContext: true,
    order: 30,
  },
  {
    id: "signatures",
    title: "Signatures",
    shortLabel: "Signatures",
    path: "/?section=signatures",
    sectionKey: "signatures",
    area: "operations",
    requiresMatterContext: true,
    order: 40,
  },
  {
    id: "intake",
    title: "Intake",
    shortLabel: "Intake",
    path: "/?section=intake",
    sectionKey: "intake",
    area: "operations",
    requiresMatterContext: true,
    order: 50,
  },
  {
    id: "funds",
    title: "Trust Funds",
    shortLabel: "Funds",
    path: "/?section=funds",
    sectionKey: "funds",
    area: "finance",
    requiresMatterContext: true,
    order: 60,
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
  },
  {
    id: "queues",
    title: "Operational Queues",
    shortLabel: "Queues",
    path: "/?section=queues",
    area: "operations",
    requiresMatterContext: false,
    order: 80,
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

export function matchRouteCatalogEntry(path: string): OpenPracticeRouteCatalogEntry | null {
  const [, query = ""] = path.split("?");
  const section = new URLSearchParams(query).get("section");
  if (!section) return getRouteCatalogEntry("matters");
  return routeCatalog.find((entry) => entry.id === section || entry.sectionKey === section) ?? null;
}
