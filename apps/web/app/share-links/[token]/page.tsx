import ShareLinkRunner from "../ShareLinkRunner";

export const dynamic = "force-dynamic";

type ShareLinkParams = Promise<{ token: string }>;

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

export default async function ShareLinkPage({ params }: { params: ShareLinkParams }) {
  const { token } = await params;
  return <ShareLinkRunner apiBaseUrl={apiBaseUrl} token={token} />;
}
