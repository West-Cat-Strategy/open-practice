import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import LoginClient from "./login-client";
import SetupWizard from "./setup-wizard";
import { selectStartupView } from "./setup-wizard-utils";
import type {
  BillingDashboardResponse,
  CapabilitiesResponse,
  IntakeSessionsResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
  SessionResponse,
  SetupStatusResponse,
  SignatureRequestsResponse,
} from "./types";

export const dynamic = "force-dynamic";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
const devHeaders = {
  "x-open-practice-user-id": process.env.DEV_AUTH_USER_ID ?? "user-admin",
  "x-open-practice-firm-id": process.env.DEV_AUTH_FIRM_ID ?? "firm-west-legal",
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function buildApiHeaders(): Promise<Record<string, string>> {
  const cookieHeader = (await cookies()).toString();
  return {
    ...(process.env.NODE_ENV === "production" ? {} : devHeaders),
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
  };
}

async function apiGet<T>(path: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new ApiRequestError(
      `Open Practice API request failed: ${response.status} ${path}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

async function apiGetOptional<T>(
  path: string,
  fallback: T,
  headers: Record<string, string>,
  forbiddenFallback = fallback,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers,
  });
  if (response.status === 404) return fallback;
  if (response.status === 403) return forbiddenFallback;
  if (!response.ok) {
    throw new ApiRequestError(
      `Open Practice API request failed: ${response.status} ${path}`,
      response.status,
    );
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
  const setupStatus = await apiGet<SetupStatusResponse>("/api/setup/status", {});
  if (selectStartupView(setupStatus, null) === "blocked") {
    return (
      <main className="empty-state">
        <h1>Setup Blocked</h1>
        <p>{setupStatus.reason ?? "Partial setup state needs operator review."}</p>
      </main>
    );
  }
  if (selectStartupView(setupStatus, null) === "setup") {
    return <SetupWizard apiBaseUrl={apiBaseUrl} setupKeyRequired={setupStatus.setupKeyRequired} />;
  }

  const headers = await buildApiHeaders();
  let session: SessionResponse;
  let capabilities: CapabilitiesResponse;
  let overview: PracticeOverview;
  let matters: MatterSummary[];
  let signatures: SignatureRequestsResponse;
  let intake: IntakeSessionsResponse;
  let queues: QueuesResponse;
  try {
    [session, capabilities, overview, matters, signatures, intake, queues] = await Promise.all([
      apiGet<SessionResponse>("/api/session", headers),
      apiGet<CapabilitiesResponse>("/api/capabilities", headers),
      apiGet<PracticeOverview>("/api/overview", headers),
      apiGet<MatterSummary[]>("/api/matters", headers),
      apiGet<SignatureRequestsResponse>("/api/signature-requests", headers),
      apiGet<IntakeSessionsResponse>("/api/intake-sessions", headers),
      apiGet<QueuesResponse>("/api/queues", headers),
    ]);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      selectStartupView(setupStatus, error.status) === "login"
    ) {
      return <LoginClient apiBaseUrl={apiBaseUrl} />;
    }
    throw error;
  }
  const billingFallback = buildBillingFallback(matters, session);
  const billing = await apiGetOptional<BillingDashboardResponse>(
    "/api/billing/dashboard",
    billingFallback,
    headers,
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
      devHeaders={process.env.NODE_ENV === "production" ? {} : devHeaders}
      intake={intake}
      matters={matters}
      overview={overview}
      queues={queues}
      session={session}
      signatures={signatures}
    />
  );
}
