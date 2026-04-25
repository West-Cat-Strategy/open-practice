import DashboardClient from "./dashboard-client";
import type {
  CapabilitiesResponse,
  IntakeSessionsResponse,
  MatterSummary,
  PracticeOverview,
  SessionResponse,
  SignatureRequestsResponse,
} from "./types";

export const dynamic = "force-dynamic";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
const devHeaders = {
  "x-open-practice-user-id": process.env.DEV_AUTH_USER_ID ?? "user-admin",
  "x-open-practice-firm-id": process.env.DEV_AUTH_FIRM_ID ?? "firm-west-legal",
};

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: devHeaders,
  });
  if (!response.ok) {
    throw new Error(`Open Practice API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

export default async function Home() {
  const [session, capabilities, overview, matters, signatures, intake] = await Promise.all([
    apiGet<SessionResponse>("/api/session"),
    apiGet<CapabilitiesResponse>("/api/capabilities"),
    apiGet<PracticeOverview>("/api/overview"),
    apiGet<MatterSummary[]>("/api/matters"),
    apiGet<SignatureRequestsResponse>("/api/signature-requests"),
    apiGet<IntakeSessionsResponse>("/api/intake-sessions"),
  ]);

  return (
    <DashboardClient
      apiBaseUrl={apiBaseUrl}
      capabilities={capabilities}
      devHeaders={devHeaders}
      intake={intake}
      matters={matters}
      overview={overview}
      session={session}
      signatures={signatures}
    />
  );
}
