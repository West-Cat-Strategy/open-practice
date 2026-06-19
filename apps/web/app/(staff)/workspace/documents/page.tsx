import {
  WorkspaceDocumentsPage,
  workspaceStaffPageMetadata,
} from "../../../_features/staff-pages/workspace-pages";
import type { StaffPageSearchParams } from "../../../_features/staff-pages/shared";

export const metadata = workspaceStaffPageMetadata.documents;

export default function DocumentsWorkspacePage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <WorkspaceDocumentsPage searchParams={searchParams} />;
}
