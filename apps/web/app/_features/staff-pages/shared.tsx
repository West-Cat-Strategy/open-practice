import type { Metadata } from "next";
import type {
  DashboardNavigationSectionKey,
  OpenPracticeRouteArea,
  OpenPracticeRouteAvailability,
  OpenPracticeRouteId,
} from "../../../routes/routeCatalog";
import { renderStaffDashboardPage } from "../../staff-dashboard-page";

export type StaffPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface StaffPageDefinition {
  id: string;
  routeId: OpenPracticeRouteId;
  sectionKey: DashboardNavigationSectionKey;
  area: OpenPracticeRouteArea;
  slug: string;
  title: string;
  shortLabel?: string;
  shortTitle?: string;
  canonicalPath: string;
  currentDashboardHref?: string;
  legacyDashboardPath?: string;
  availability: OpenPracticeRouteAvailability;
  requiresMatterContext: boolean;
  sourceModule: string;
  resourceModule?: string;
  summary: string;
  guardrails: readonly string[];
}

export function buildStaffPageMetadata(definition: Pick<StaffPageDefinition, "title">): Metadata {
  return {
    title: `${definition.title} | Open Practice`,
  };
}

export function StaffPage({
  definition,
  searchParams,
}: {
  definition: Pick<StaffPageDefinition, "sectionKey" | "title">;
  searchParams?: StaffPageSearchParams;
}) {
  return renderStaffDashboardPage({
    sectionKey: definition.sectionKey,
    searchParams,
  });
}
