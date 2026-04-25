import DashboardClient from "./dashboard-client";
import type {
  BillingDashboardResponse,
  CapabilitiesResponse,
  IntakeSessionsResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
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

async function apiGetOptional<T>(
  path: string,
  fallback: T,
  forbiddenFallback = fallback,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: devHeaders,
  });
  if (response.status === 404) return fallback;
  if (response.status === 403) return forbiddenFallback;
  if (!response.ok) {
    throw new Error(`Open Practice API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

function canViewBilling(role: string): boolean {
  return ["owner_admin", "billing_bookkeeper", "auditor"].includes(role);
}

function buildBillingFallback(
  matters: MatterSummary[],
  session: SessionResponse,
): BillingDashboardResponse {
  const billingMatters = matters.map((matter) => {
    const unbilledTime = matter.timeEntries
      .filter((entry) => entry.billable && entry.billingStatus === "approved")
      .map((entry) => ({
        id: entry.id,
        matterId: entry.matterId,
        userId: entry.userId,
        minutes: entry.minutes,
        rateCents: entry.rateCents,
        amountCents: Math.round((entry.minutes * entry.rateCents) / 60),
        narrative: entry.narrative,
        status: "approved" as const,
      }));
    const unbilledExpenses = matter.expenses
      .filter((entry) => entry.reimbursable && entry.billingStatus === "approved")
      .map((entry) => ({
        id: entry.id,
        matterId: entry.matterId,
        amountCents: entry.amountCents,
        category: entry.category,
        description: entry.description,
        status: "approved" as const,
      }));

    return {
      matterId: matter.id,
      unbilledTime,
      unbilledExpenses,
      invoices: [],
      payments: [],
    };
  });

  return {
    canView: canViewBilling(session.user.role),
    summary: {
      unbilledTimeCents: billingMatters.reduce(
        (sum, matter) =>
          sum + matter.unbilledTime.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
        0,
      ),
      unbilledExpenseCents: billingMatters.reduce(
        (sum, matter) =>
          sum +
          matter.unbilledExpenses.reduce((matterSum, entry) => matterSum + entry.amountCents, 0),
        0,
      ),
      draftInvoiceCents: 0,
      issuedBalanceDueCents: 0,
    },
    matters: billingMatters,
  };
}

export default async function Home() {
  const [session, capabilities, overview, matters, signatures, intake, queues] = await Promise.all([
    apiGet<SessionResponse>("/api/session"),
    apiGet<CapabilitiesResponse>("/api/capabilities"),
    apiGet<PracticeOverview>("/api/overview"),
    apiGet<MatterSummary[]>("/api/matters"),
    apiGet<SignatureRequestsResponse>("/api/signature-requests"),
    apiGet<IntakeSessionsResponse>("/api/intake-sessions"),
    apiGet<QueuesResponse>("/api/queues"),
  ]);
  const billingFallback = buildBillingFallback(matters, session);
  const billing = await apiGetOptional<BillingDashboardResponse>(
    "/api/billing/dashboard",
    billingFallback,
    {
      ...billingFallback,
      canView: false,
    },
  );

  return (
    <DashboardClient
      apiBaseUrl={apiBaseUrl}
      billing={billing}
      capabilities={capabilities}
      devHeaders={devHeaders}
      intake={intake}
      matters={matters}
      overview={overview}
      queues={queues}
      session={session}
      signatures={signatures}
    />
  );
}
