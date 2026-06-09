import {
  buildSidebarNavigationSections,
  type DashboardNavigationSectionKey,
  type OpenPracticeSidebarNavigationSection,
} from "../../../routes/routeCatalog";
import {
  applyMatterAvailabilityToNavigation,
  enableMatterScopedCapabilitiesForLocalMatter,
} from "../../dashboard-utils";
import type { CapabilitiesResponse, SessionResponse } from "../../types";

export interface DashboardShellNavigationModelInput {
  billingCanView: boolean;
  capabilitySections: CapabilitiesResponse["sections"];
  hasAccessibleMatter: boolean;
  canCreateMatter: boolean;
  shareLinksEnabled: boolean;
  externalUploadsEnabled: boolean;
  sessionRole: SessionResponse["user"]["role"];
}

export interface DashboardShellNavigationModel {
  navigationSections: OpenPracticeSidebarNavigationSection[];
  matterActionSections: OpenPracticeSidebarNavigationSection[];
}

export function buildDashboardShellNavigationModel(
  input: DashboardShellNavigationModelInput,
): DashboardShellNavigationModel {
  const navigationCapabilitySections = enableMatterScopedCapabilitiesForLocalMatter(
    input.capabilitySections,
    input.hasAccessibleMatter,
  );
  const navigationSections = applyMatterAvailabilityToNavigation(
    buildSidebarNavigationSections({
      billingCanView: input.billingCanView,
      capabilitySections: navigationCapabilitySections,
      shareLinksEnabled: input.shareLinksEnabled,
      externalUploadsEnabled: input.externalUploadsEnabled,
      adminReadinessEnabled: ["owner_admin", "auditor"].includes(input.sessionRole),
    }),
    input.hasAccessibleMatter,
    input.canCreateMatter,
  );
  const matterActionSections = navigationSections.filter(
    (section) =>
      section.key !== "matters" && (section.requiresMatterContext || section.key === "queues"),
  );

  return { navigationSections, matterActionSections };
}

export function dashboardActiveSectionLabel({
  activeMatterTitle,
  activeSection,
  navigationSections,
}: {
  activeMatterTitle?: string;
  activeSection: DashboardNavigationSectionKey;
  navigationSections: OpenPracticeSidebarNavigationSection[];
}): string {
  if (activeSection === "matters") return activeMatterTitle ?? "Dashboard";
  return navigationSections.find((section) => section.key === activeSection)?.title ?? "Dashboard";
}
