import { browserApiBaseUrl } from "../api-base-urls";
import ClientPortalWorkspace from "../client-portal-workspace";

export const dynamic = "force-dynamic";

export default function PortalPage() {
  return <ClientPortalWorkspace apiBaseUrl={browserApiBaseUrl} />;
}
