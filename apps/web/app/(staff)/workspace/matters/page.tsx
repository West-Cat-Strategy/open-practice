import {
  WorkspaceMattersPage,
  workspaceStaffPageMetadata,
} from "../../../_features/staff-pages/workspace-pages";
import type { StaffPageSearchParams } from "../../../_features/staff-pages/shared";

export const metadata = workspaceStaffPageMetadata.matters;

export default function MattersWorkspacePage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <WorkspaceMattersPage searchParams={searchParams} />;
}
