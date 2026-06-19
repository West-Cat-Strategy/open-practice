import type { DashboardNavigationSectionKey } from "../routes/routeCatalog";
import { renderOpenPracticeHome } from "./open-practice-home";

type StaffDashboardSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function renderStaffDashboardPage(input: {
  sectionKey: DashboardNavigationSectionKey;
  searchParams?: StaffDashboardSearchParams;
}) {
  return renderOpenPracticeHome({
    canonicalSection: input.sectionKey,
    searchParams: input.searchParams,
  });
}
