import {
  buildStaffPageMetadata,
  StaffPage,
  type StaffPageSearchParams,
} from "../../../_features/staff-pages/shared";
import { reviewStaffPages } from "../../../_features/staff-pages/review-pages";

const staffPage = reviewStaffPages.reports;

export const metadata = buildStaffPageMetadata(staffPage);

export default function ReportsStaffPage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <StaffPage definition={staffPage} searchParams={searchParams} />;
}
