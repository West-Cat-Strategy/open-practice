import {
  WorkspaceCalendarPage,
  workspaceStaffPageMetadata,
} from "../../../_features/staff-pages/workspace-pages";
import type { StaffPageSearchParams } from "../../../_features/staff-pages/shared";

export const metadata = workspaceStaffPageMetadata.calendar;

export default function CalendarWorkspacePage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <WorkspaceCalendarPage searchParams={searchParams} />;
}
