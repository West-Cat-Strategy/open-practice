import {
  WorkspaceResearchPage,
  workspaceStaffPageMetadata,
} from "../../../_features/staff-pages/workspace-pages";
import type { StaffPageSearchParams } from "../../../_features/staff-pages/shared";

export const metadata = workspaceStaffPageMetadata.research;

export default function ResearchWorkspacePage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <WorkspaceResearchPage searchParams={searchParams} />;
}
