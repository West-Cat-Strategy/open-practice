import { browserApiBaseUrl } from "../api-base-urls";
import PublicTokenHashEntry from "../PublicTokenHashEntry";

export const dynamic = "force-dynamic";

export default function ShareLinkHashPage() {
  return <PublicTokenHashEntry apiBaseUrl={browserApiBaseUrl} kind="share-links" />;
}
