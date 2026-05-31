import ExternalUploadRunner from "../ExternalUploadRunner";
import { browserApiBaseUrl } from "../../api-base-urls";

export const dynamic = "force-dynamic";

type ExternalUploadParams = Promise<{ token: string }>;

export default async function ExternalUploadPage({ params }: { params: ExternalUploadParams }) {
  const { token } = await params;
  return <ExternalUploadRunner apiBaseUrl={browserApiBaseUrl} token={token} />;
}
