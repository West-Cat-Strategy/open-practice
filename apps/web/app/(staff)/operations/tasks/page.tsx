import {
  buildStaffPageMetadata,
  StaffPage,
  type StaffPageSearchParams,
} from "../../../_features/staff-pages/shared";
import { operationsStaffPages } from "../../../_features/staff-pages/operations-pages";

const staffPage = operationsStaffPages.tasks;

export const metadata = buildStaffPageMetadata(staffPage);

export default function TasksStaffPage({ searchParams }: { searchParams?: StaffPageSearchParams }) {
  return <StaffPage definition={staffPage} searchParams={searchParams} />;
}
