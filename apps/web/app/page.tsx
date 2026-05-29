import { cookies } from "next/headers";
import {
  buildSidebarNavigationSections,
  resolveDashboardRouteSelection,
} from "../routes/routeCatalog";
import DashboardClient from "./dashboard-client";
import { applyMatterAvailabilityToNavigation } from "./dashboard-utils";
import { loadCalendarDashboardData } from "./calendar-dashboard";
import { loadDraftingDashboardData } from "./drafting-dashboard";
import {
  buildEmailDeliveryHistoryPath,
  loadEmailDeliveryDashboardData,
} from "./email-delivery-dashboard";
import {
  buildCommunicationsInboxPath,
  loadCommunicationsInboxDashboardData,
} from "./communications-inbox-dashboard";
import {
  buildDocumentProcessingWorkbenchPath,
  emptyDocumentProcessingWorkbench,
  loadDocumentProcessingDashboardData,
} from "./document-processing-dashboard";
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
import { buildIntakePipelinePath, emptyIntakePipelineDashboard } from "./intake-pipeline-dashboard";
import {
  buildPublicConsultationIntakeSettingsPath,
  buildPublicConsultationIntakesPath,
  emptyPublicConsultationDashboard,
} from "./public-consultation-intakes-dashboard";
import {
  buildLegalClinicMatterProfilePath,
  coerceLegalClinicProfilesResponse,
  legalClinicProgramsPath,
  loadLegalClinicDashboardData,
} from "./legal-clinic-dashboard";
import LoginClient from "./login-client";
import SetupWizard from "./setup-wizard";
import { selectStartupView } from "./setup-wizard-utils";
import { browserApiBaseUrl, serverApiBaseUrl } from "./api-base-urls";
import {
  buildJurisdictionalTrustReportPath,
  buildTrustControlsPath,
  emptyJurisdictionalTrustReport,
  emptyTrustControlsDashboard,
  loadTrustControlsDashboardData,
} from "./trust-controls-dashboard";
import {
  buildWorkerHealthPath,
  buildWorkerRunsPath,
  emptyWorkerHealthResponse,
  emptyWorkerRunsResponse,
} from "./worker-runs-dashboard";
import {
  buildProvidersStatusPath,
  emptyProvidersStatusResponse,
} from "./provider-status-dashboard";
import { emptyConnectorOperationsResponse } from "./connector-outbox-dashboard";
import {
  emptyAuditProjectionDashboard,
  type AuditProjectionDashboardResponse,
} from "./audit-dashboard";
import type {
  AuditResponse,
  BillingDashboardResponse,
  CalendarCredentialsResponse,
  CalendarDashboardResponse,
  CalendarEventsResponse,
  CapabilitiesResponse,
  CommunicationsInboxDashboardResponse,
  CommunicationsInboxMatterResponse,
  ConnectorOperationsResponse,
  ConnectorOutboxResponse,
  ConnectorsResponse,
  ContactDataQualityResolutionsResponse,
  ContactDossiersResponse,
  ContactReviewQueueResponse,
  DocumentProcessingDashboardResponse,
  DocumentProcessingWorkbenchResponse,
  DraftingDashboardResponse,
  EmailDeliveryDashboardResponse,
  EmailDeliveryHistoryResponse,
  ExternalUploadsDashboardResponse,
  ExternalUploadsListResponse,
  ExternalUploadsStatusResponse,
  IntakeSessionsResponse,
  IntakeFormsDashboardResponse,
  IntakeFormLinksResponse,
  IntakePipelineDashboardResponse,
  IntakePipelineResponse,
  IntakeVariableProposalsResponse,
  JurisdictionalTrustReportResponse,
  LegalClinicDashboardResponse,
  LegalClinicProfileResponse,
  LegalClinicProfilesResponse,
  LegalClinicProgramsResponse,
  OperationalViewDefinitionsResponse,
  MatterSummary,
  OperationalViewsResponse,
  PracticeOverview,
  PublicConsultationDashboardResponse,
  PublicConsultationIntakeSettings,
  PublicConsultationIntakesResponse,
  ProvidersStatusResponse,
  QueuesResponse,
  SessionResponse,
  ShareLinksStatusResponse,
  SetupStatusResponse,
  SignatureRequestsResponse,
  TaskDeadlineWorkbenchResponse,
  TrustControlsDashboardResponse,
  WorkerRunsDashboardResponse,
  WorkerHealthResponse,
  WorkerRunsResponse,
} from "./types";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const response = await fetch(`${serverApiBaseUrl}${path}`, {
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
  const response = await fetch(`${serverApiBaseUrl}${path}`, {
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

async function apiGetOptionalWithStatus<T>(
  path: string,
  fallback: T,
  headers: Record<string, string>,
): Promise<{ data: T; status: ConnectorOperationsResponse["status"] }> {
  try {
    return { data: await apiGet<T>(path, headers), status: "available" };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) {
      return { data: fallback, status: "access_denied" };
    }
    if (error instanceof ApiRequestError && error.status === 404) {
      return { data: fallback, status: "unavailable" };
    }
    throw error;
  }
}

async function loadConnectorOperations(
  headers: Record<string, string>,
): Promise<ConnectorOperationsResponse> {
  const [connectorsResult, outboxResult] = await Promise.all([
    apiGetOptionalWithStatus<ConnectorsResponse>("/api/connectors", { connectors: [] }, headers),
    apiGetOptionalWithStatus<ConnectorOutboxResponse>(
      "/api/connectors/outbox",
      { outbox: [] },
      headers,
    ),
  ]);
  const status =
    connectorsResult.status === "access_denied" || outboxResult.status === "access_denied"
      ? "access_denied"
      : connectorsResult.status === "unavailable" || outboxResult.status === "unavailable"
        ? "unavailable"
        : "available";

  return {
    ...emptyConnectorOperationsResponse(status),
    connectors: connectorsResult.data.connectors,
    outbox: outboxResult.data.outbox,
  };
}

async function loadAuditProjection(
  headers: Record<string, string>,
): Promise<AuditProjectionDashboardResponse> {
  try {
    const audit = await apiGet<AuditResponse>("/api/audit", headers);
    return {
      status: "available",
      valid: audit.valid,
      taxonomySummary: audit.taxonomySummary,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) {
      return emptyAuditProjectionDashboard("access_denied");
    }
    if (error instanceof ApiRequestError && error.status === 404) {
      return emptyAuditProjectionDashboard("unavailable");
    }
    throw error;
  }
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
        rateRuleId: entry.rateRuleId,
        rateSnapshot: entry.rateSnapshot,
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
      lockedPeriodCount: 0,
      activeLockedPeriodCount: 0,
      activeRateRuleCount: 0,
    },
    periodLocks: [],
    rateRules: [],
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
    return (
      <SetupWizard apiBaseUrl={browserApiBaseUrl} setupKeyRequired={setupStatus.setupKeyRequired} />
    );
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
      return <LoginClient apiBaseUrl={browserApiBaseUrl} />;
    }
    throw error;
  }
  const contactReviewQueue = await apiGetOptional<ContactReviewQueueResponse>(
    "/api/contacts/review-queue",
    {
      summary: {
        totalContacts: contactDossiers.length,
        reviewItemCount: 0,
        duplicateCandidateCount: 0,
        sensitivePartyCueCount: 0,
        revalidationPromptCount: 0,
      },
      items: [],
    },
    headers,
    {
      summary: {
        totalContacts: contactDossiers.length,
        reviewItemCount: 0,
        duplicateCandidateCount: 0,
        sensitivePartyCueCount: 0,
        revalidationPromptCount: 0,
      },
      items: [],
    },
  );
  const contactDataQualityResolutions = await apiGetOptional<ContactDataQualityResolutionsResponse>(
    "/api/contacts/data-quality-resolutions",
    [],
    headers,
    [],
  );
  const billingFallback = buildBillingFallback(matters, session);
  const taskWorkbench = await apiGetOptional<TaskDeadlineWorkbenchResponse>(
    "/api/tasks/workbench",
    {
      tasks: [],
      counters: {
        my: { overdue: 0, today: 0, upcoming: 0 },
        team: { overdue: 0, today: 0, upcoming: 0 },
        matterQueues: [],
        contactQueues: [],
      },
      focusQueues: {
        myOverdueTaskIds: [],
        teamTodayTaskIds: [],
        upcomingTaskIds: [],
        unassignedTaskIds: [],
      },
    },
    headers,
  );
  const workerRuns: WorkerRunsDashboardResponse = {
    all: await apiGetOptional<WorkerRunsResponse>(
      buildWorkerRunsPath("all"),
      emptyWorkerRunsResponse(),
      headers,
      emptyWorkerRunsResponse("access_denied"),
    ),
    email: await apiGetOptional<WorkerRunsResponse>(
      buildWorkerRunsPath("email"),
      emptyWorkerRunsResponse(),
      headers,
      emptyWorkerRunsResponse("access_denied"),
    ),
    ocr: await apiGetOptional<WorkerRunsResponse>(
      buildWorkerRunsPath("ocr"),
      emptyWorkerRunsResponse(),
      headers,
      emptyWorkerRunsResponse("access_denied"),
    ),
  };
  const workerHealth = await apiGetOptional<WorkerHealthResponse>(
    buildWorkerHealthPath(),
    emptyWorkerHealthResponse(),
    headers,
    emptyWorkerHealthResponse(),
  );
  const providerStatus = await apiGetOptional<ProvidersStatusResponse>(
    buildProvidersStatusPath(),
    emptyProvidersStatusResponse(),
    headers,
    emptyProvidersStatusResponse("access_denied"),
  );
  const connectorOperations = await loadConnectorOperations(headers);
  const operationalViews = await apiGetOptional<OperationalViewsResponse>(
    "/api/operational-views",
    { views: [] },
    headers,
    { views: [] },
  );
  const operationalViewDefinitions = await apiGetOptional<OperationalViewDefinitionsResponse>(
    "/api/operational-views/definitions",
    { definitions: [] },
    headers,
    { definitions: [] },
  );
  const auditProjection = await loadAuditProjection(headers);
  const billing = await apiGetOptional<BillingDashboardResponse>(
    "/api/billing/dashboard",
    billingFallback,
    headers,
    {
      ...billingFallback,
      canView: false,
    },
  );
  const trustControls = await loadTrustControlsDashboardData({
    matter: matters[0],
    getControls: (matterId) =>
      apiGetOptional<TrustControlsDashboardResponse>(
        buildTrustControlsPath(matterId),
        emptyTrustControlsDashboard(),
        headers,
        emptyTrustControlsDashboard(),
      ),
  });
  const jurisdictionalTrustReport = await apiGetOptional<JurisdictionalTrustReportResponse>(
    buildJurisdictionalTrustReportPath(),
    emptyJurisdictionalTrustReport(),
    headers,
    emptyJurisdictionalTrustReport(),
  );
  const canViewDrafting = capabilities.sections.some(
    (section) => section.key === "drafting" && section.enabled,
  );
  const canViewCalendar = capabilities.sections.some(
    (section) => section.key === "calendar" && section.enabled,
  );
  const canViewDocuments = capabilities.sections.some(
    (section) => section.key === "documents" && section.enabled,
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
    : { eventsByMatterId: {}, guestSessionsByEventId: {}, linksByMatterId: {}, credentials: [] };
  const emailDeliveryHistory: EmailDeliveryDashboardResponse = await loadEmailDeliveryDashboardData(
    {
      matters,
      listDeliveryHistoryForMatter: (matterId) =>
        apiGetOptional<EmailDeliveryHistoryResponse>(
          buildEmailDeliveryHistoryPath(matterId),
          { emails: [] },
          headers,
          { emails: [] },
        ),
    },
  );
  const communicationsInbox: CommunicationsInboxDashboardResponse =
    await loadCommunicationsInboxDashboardData({
      matters,
      getInboxForMatter: (matterId) =>
        apiGetOptional<CommunicationsInboxMatterResponse>(
          buildCommunicationsInboxPath(matterId),
          {
            status: "unavailable",
            matterId,
            channelState: {
              inboundEmailStatus: "disabled",
              outboundEmailStatus: "disabled",
              inboundEmailAddressCount: 0,
              enabledInboundEmailAddressCount: 0,
            },
            inboundEmail: [],
            outboundDeliveryHistory: [],
            conversations: [],
            contactCues: [],
          },
          headers,
          {
            status: "access_denied",
            matterId,
            channelState: {
              inboundEmailStatus: "disabled",
              outboundEmailStatus: "disabled",
              inboundEmailAddressCount: 0,
              enabledInboundEmailAddressCount: 0,
            },
            inboundEmail: [],
            outboundDeliveryHistory: [],
            conversations: [],
            contactCues: [],
          },
        ),
    });
  const documentProcessing: DocumentProcessingDashboardResponse = canViewDocuments
    ? await loadDocumentProcessingDashboardData({
        matters,
        getWorkbench: (matterId) =>
          apiGetOptional<DocumentProcessingWorkbenchResponse>(
            buildDocumentProcessingWorkbenchPath(matterId),
            emptyDocumentProcessingWorkbench(matterId),
            headers,
            emptyDocumentProcessingWorkbench(matterId, "access_denied"),
          ),
      })
    : { workbenchesByMatterId: {} };
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
  const intakePipelineResult = await apiGetOptionalWithStatus<IntakePipelineResponse>(
    buildIntakePipelinePath(),
    emptyIntakePipelineDashboard("unavailable"),
    headers,
  );
  const intakePipeline: IntakePipelineDashboardResponse = {
    ...intakePipelineResult.data,
    status: intakePipelineResult.status,
  };
  const publicConsultationSettingsResult =
    await apiGetOptionalWithStatus<PublicConsultationIntakeSettings>(
      buildPublicConsultationIntakeSettingsPath(),
      emptyPublicConsultationDashboard("unavailable").settings,
      headers,
    );
  const publicConsultationIntakesResult =
    await apiGetOptionalWithStatus<PublicConsultationIntakesResponse>(
      buildPublicConsultationIntakesPath("pending"),
      { intakes: [] },
      headers,
    );
  const publicConsultationStatus =
    publicConsultationSettingsResult.status === "access_denied" ||
    publicConsultationIntakesResult.status === "access_denied"
      ? "access_denied"
      : publicConsultationSettingsResult.status === "unavailable" ||
          publicConsultationIntakesResult.status === "unavailable"
        ? "unavailable"
        : "available";
  const publicConsultation: PublicConsultationDashboardResponse = {
    settings: publicConsultationSettingsResult.data,
    intakes: publicConsultationIntakesResult.data.intakes,
    status: publicConsultationStatus,
  };
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
  const canCreateMatter = capabilities.sections.some(
    (section) => section.key === "matters" && section.actions.includes("create"),
  );
  const navigationSections = applyMatterAvailabilityToNavigation(
    buildSidebarNavigationSections({
      billingCanView: billing.canView,
      capabilitySections: capabilities.sections,
      shareLinksEnabled: shareLinksStatus.createStatus === "enabled",
      externalUploadsEnabled: canCreateExternalUpload(externalUploads.status),
    }),
    matters.length > 0,
    canCreateMatter,
  );
  const initialSection = resolveDashboardRouteSelection({
    requestedSection,
    navigationSections,
  }).sectionKey;

  return (
    <DashboardClient
      apiBaseUrl={browserApiBaseUrl}
      auditProjection={auditProjection}
      billing={billing}
      calendar={calendar}
      capabilities={capabilities}
      communicationsInbox={communicationsInbox}
      connectorOperations={connectorOperations}
      contactDataQualityResolutions={contactDataQualityResolutions}
      contactDossiers={contactDossiers}
      contactReviewQueue={contactReviewQueue}
      devHeaders={process.env.NODE_ENV === "production" ? {} : devHeaders}
      documentProcessing={documentProcessing}
      drafting={drafting}
      emailDeliveryHistory={emailDeliveryHistory}
      externalUploads={externalUploads}
      initialSection={initialSection}
      intake={intake}
      intakeForms={intakeForms}
      intakePipeline={intakePipeline}
      publicConsultation={publicConsultation}
      legalClinic={legalClinic}
      matters={matters}
      overview={overview}
      operationalViewDefinitions={operationalViewDefinitions.definitions}
      operationalViews={operationalViews}
      providerStatus={providerStatus}
      queues={queues}
      session={session}
      shareLinksStatus={shareLinksStatus}
      signatures={signatures}
      taskWorkbench={taskWorkbench}
      jurisdictionalTrustReport={jurisdictionalTrustReport}
      trustControls={trustControls}
      workerHealth={workerHealth}
      workerRuns={workerRuns}
    />
  );
}
