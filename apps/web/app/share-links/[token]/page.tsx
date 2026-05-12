import ShareLinkRunner from "../ShareLinkRunner";
import { browserApiBaseUrl } from "../../api-base-urls";

export const dynamic = "force-dynamic";

type ShareLinkParams = Promise<{ token: string }>;

export default async function ShareLinkPage({ params }: { params: ShareLinkParams }) {
  const { token } = await params;
  return <ShareLinkRunner apiBaseUrl={browserApiBaseUrl} token={token} />;
}
