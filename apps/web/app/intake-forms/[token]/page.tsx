import IntakeFormRunner from "../IntakeFormRunner";

export const dynamic = "force-dynamic";

type IntakeFormParams = Promise<{ token: string }>;

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

export default async function IntakeFormPage({ params }: { params: IntakeFormParams }) {
  const { token } = await params;
  return <IntakeFormRunner apiBaseUrl={apiBaseUrl} token={token} />;
}
