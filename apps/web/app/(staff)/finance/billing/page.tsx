import {
  buildStaffPageMetadata,
  StaffPage,
  type StaffPageSearchParams,
} from "../../../_features/staff-pages/shared";
import { financeStaffPages } from "../../../_features/staff-pages/finance-pages";

const staffPage = financeStaffPages.billing;

export const metadata = buildStaffPageMetadata(staffPage);

export default function BillingStaffPage({
  searchParams,
}: {
  searchParams?: StaffPageSearchParams;
}) {
  return <StaffPage definition={staffPage} searchParams={searchParams} />;
}
