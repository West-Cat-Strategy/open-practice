import ExternalUploadRunner from "../ExternalUploadRunner";

export const dynamic = "force-dynamic";

type ExternalUploadParams = Promise<{ token: string }>;

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

export default async function ExternalUploadPage({ params }: { params: ExternalUploadParams }) {
  const { token } = await params;
  return <ExternalUploadRunner apiBaseUrl={apiBaseUrl} token={token} />;
}
