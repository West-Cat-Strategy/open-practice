import IntakeFormRunner from "../IntakeFormRunner";
import { browserApiBaseUrl } from "../../api-base-urls";

export const dynamic = "force-dynamic";

type IntakeFormParams = Promise<{ token: string }>;

export default async function IntakeFormPage({ params }: { params: IntakeFormParams }) {
  const { token } = await params;
  return <IntakeFormRunner apiBaseUrl={browserApiBaseUrl} token={token} />;
}
