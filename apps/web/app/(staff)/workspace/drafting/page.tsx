import {
  WorkspaceDraftingPage,
  workspaceStaffPageMetadata,
} from "../../../_features/staff-pages/workspace-pages";
import type { StaffPageSearchParams } from "../../../_features/staff-pages/shared";

export const metadata = workspaceStaffPageMetadata.drafting;

export default function DraftingWorkspacePage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <WorkspaceDraftingPage searchParams={searchParams} />;
}
