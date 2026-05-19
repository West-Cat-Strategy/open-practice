import { browserApiBaseUrl } from "../../api-base-urls";
import GuestSessionRunner from "../GuestSessionRunner";

export const dynamic = "force-dynamic";

type GuestSessionParams = Promise<{ token: string }>;

export default async function GuestSessionPage({ params }: { params: GuestSessionParams }) {
  const { token } = await params;
  return <GuestSessionRunner apiBaseUrl={browserApiBaseUrl} token={token} />;
}
