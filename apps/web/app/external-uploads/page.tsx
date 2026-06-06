import { browserApiBaseUrl } from "../api-base-urls";
import PublicTokenHashEntry from "../PublicTokenHashEntry";

export const dynamic = "force-dynamic";

export default function ExternalUploadHashPage() {
  return <PublicTokenHashEntry apiBaseUrl={browserApiBaseUrl} kind="external-uploads" />;
}
