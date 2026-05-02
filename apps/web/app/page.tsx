import { cookies } from "next/headers";
import {
  buildSidebarNavigationSections,
  resolveDashboardRouteSelection,
} from "../routes/routeCatalog";
import DashboardClient from "./dashboard-client";
import { loadCalendarDashboardData } from "./calendar-dashboard";
import { loadDraftingDashboardData } from "./drafting-dashboard";
import {
  buildExternalUploadListPath,
  canCreateExternalUpload,
  externalUploadsStatusFallback,
  loadExternalUploadsDashboardData,
} from "./external-uploads-dashboard";
import {
  buildIntakeFormLinkListPath,
  buildIntakeVariableProposalListPath,
  loadIntakeFormsDashboardData,
} from "./intake-forms-dashboard";
import {
  buildLegalClinicMatterProfilePath,
  coerceLegalClinicProfilesResponse,
  legalClinicProgramsPath,
  loadLegalClinicDashboardData,
} from "./legal-clinic-dashboard";
import LoginClient from "./login-client";
import SetupWizard from "./setup-wizard";
import { selectStartupView } from "./setup-wizard-utils";
import type {
  BillingDashboardResponse,
  CalendarCredentialsResponse,
  CalendarDashboardResponse,
  CalendarEventsResponse,
  CapabilitiesResponse,
  ContactDossiersResponse,
  DraftingDashboardResponse,
  ExternalUploadsDashboardResponse,
  ExternalUploadsListResponse,
  ExternalUploadsStatusResponse,
  IntakeSessionsResponse,
  IntakeFormsDashboardResponse,
  IntakeFormLinksResponse,
  IntakeVariableProposalsResponse,
  LegalClinicDashboardResponse,
  LegalClinicProfileResponse,
  LegalClinicProfilesResponse,
  LegalClinicProgramsResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
  SessionResponse,
  ShareLinksStatusResponse,
  SetupStatusResponse,
  SignatureRequestsResponse,
} from "./types";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

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

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

export default async function Home({ searchParams }: { searchParams?: HomeSearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedSection = firstSearchParam(resolvedSearchParams.section);
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
  let contactDossiers: ContactDossiersResponse;
  try {
    [session, capabilities, overview, matters, signatures, intake, queues, contactDossiers] =
      await Promise.all([
        apiGet<SessionResponse>("/api/session", headers),
        apiGet<CapabilitiesResponse>("/api/capabilities", headers),
        apiGet<PracticeOverview>("/api/overview", headers),
        apiGet<MatterSummary[]>("/api/matters", headers),
        apiGet<SignatureRequestsResponse>("/api/signature-requests", headers),
        apiGet<IntakeSessionsResponse>("/api/intake-sessions", headers),
        apiGet<QueuesResponse>("/api/queues", headers),
        apiGet<ContactDossiersResponse>("/api/contacts/dossiers", headers),
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
  const canViewDrafting = capabilities.sections.some(
    (section) => section.key === "drafting" && section.enabled,
  );
  const canViewCalendar = capabilities.sections.some(
    (section) => section.key === "calendar" && section.enabled,
  );
  const drafting: DraftingDashboardResponse = canViewDrafting
    ? await loadDraftingDashboardData({
        matters,
        listTemplates: () =>
          apiGet<DraftingDashboardResponse["templates"]>(
            "/api/draft-templates?activeOnly=true",
            headers,
          ),
        listDraftsForMatter: (matterId) =>
          apiGet<DraftingDashboardResponse["draftsByMatterId"][string]>(
            `/api/drafts?matterId=${encodeURIComponent(matterId)}`,
            headers,
          ),
      })
    : { templates: [], draftsByMatterId: {} };
  const calendar: CalendarDashboardResponse = canViewCalendar
    ? await loadCalendarDashboardData({
        matters,
        listEventsForMatter: (matterId) =>
          apiGet<CalendarEventsResponse>(
            `/api/calendar/events?matterId=${encodeURIComponent(matterId)}`,
            headers,
          ),
        listCredentials: async () =>
          (await apiGet<CalendarCredentialsResponse>("/api/calendar/credentials", headers))
            .credentials,
      })
    : { eventsByMatterId: {}, linksByMatterId: {}, credentials: [] };
  const shareLinksStatus = await apiGetOptional<ShareLinksStatusResponse>(
    "/api/shares/status",
    { createStatus: "disabled", reason: "share_routes_unavailable" },
    headers,
  );
  const externalUploads: ExternalUploadsDashboardResponse = await loadExternalUploadsDashboardData({
    matters,
    getStatus: () =>
      apiGetOptional<ExternalUploadsStatusResponse>(
        "/api/external-uploads/status",
        externalUploadsStatusFallback,
        headers,
      ),
    listUploadsForMatter: async (matterId) => {
      const response = await apiGetOptional<ExternalUploadsListResponse>(
        buildExternalUploadListPath(matterId),
        { uploads: [], reviewItems: [] },
        headers,
        { uploads: [], reviewItems: [] },
      );
      return response;
    },
  });
  const intakeForms: IntakeFormsDashboardResponse = await loadIntakeFormsDashboardData({
    matters,
    listLinksForMatter: async (matterId) => {
      const response = await apiGetOptional<IntakeFormLinksResponse>(
        buildIntakeFormLinkListPath(matterId),
        { links: [], actionsByLinkId: {} },
        headers,
        { links: [], actionsByLinkId: {} },
      );
      return response;
    },
    listProposalsForMatter: async (matterId) => {
      const response = await apiGetOptional<IntakeVariableProposalsResponse>(
        buildIntakeVariableProposalListPath(matterId),
        { proposals: [] },
        headers,
        { proposals: [] },
      );
      return response.proposals;
    },
  });
  const legalClinic: LegalClinicDashboardResponse = await loadLegalClinicDashboardData({
    matters,
    listPrograms: async () => {
      const response = await apiGetOptional<LegalClinicProgramsResponse>(
        legalClinicProgramsPath,
        { programs: [] },
        headers,
        { programs: [] },
      );
      return response.programs;
    },
    listProfilesForMatter: async (matterId) => {
      const response = await apiGetOptional<
        LegalClinicProfilesResponse | LegalClinicProfileResponse
      >(buildLegalClinicMatterProfilePath(matterId), { profile: null }, headers, { profile: null });
      return coerceLegalClinicProfilesResponse(response);
    },
  });
  const navigationSections = buildSidebarNavigationSections({
    billingCanView: billing.canView,
    capabilitySections: capabilities.sections,
    shareLinksEnabled: shareLinksStatus.createStatus === "enabled",
    externalUploadsEnabled: canCreateExternalUpload(externalUploads.status),
  });
  const initialSection = resolveDashboardRouteSelection({
    requestedSection,
    navigationSections,
  }).sectionKey;

  return (
    <DashboardClient
      apiBaseUrl={apiBaseUrl}
      billing={billing}
      calendar={calendar}
      capabilities={capabilities}
      contactDossiers={contactDossiers}
      devHeaders={process.env.NODE_ENV === "production" ? {} : devHeaders}
      drafting={drafting}
      externalUploads={externalUploads}
      initialSection={initialSection}
      intake={intake}
      intakeForms={intakeForms}
      legalClinic={legalClinic}
      matters={matters}
      overview={overview}
      queues={queues}
      session={session}
      shareLinksStatus={shareLinksStatus}
      signatures={signatures}
    />
  );
}
