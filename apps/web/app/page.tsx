import {
  buildSidebarNavigationSections,
  resolveDashboardRouteSelection,
} from "../routes/routeCatalog";
import DashboardClient from "./dashboard-client";
import ClientPortalWorkspace from "./client-portal-workspace";
import { applyMatterAvailabilityToNavigation } from "./dashboard-utils";
import { loadDraftingDashboardData } from "./drafting-dashboard";
import {
  buildDocumentProcessingWorkbenchPath,
  emptyDocumentProcessingWorkbench,
  loadDocumentProcessingDashboardData,
} from "./document-processing-dashboard";
import { loadDocumentAssemblyDashboardResources } from "./_features/document-assembly/server-resources";
import { canCreateExternalUpload } from "./external-uploads-dashboard";
import LoginClient from "./login-client";
import SetupWizard from "./setup-wizard";
import { selectStartupView } from "./setup-wizard-utils";
import { browserApiBaseUrl } from "./api-base-urls";
import {
  ApiRequestError,
  apiGet,
  apiGetOptional,
  buildApiHeaders,
  devHeaders,
} from "./_shared/server-api";
import { loadAuditProjection } from "./_features/audit/server-resources";
import { loadCalendarDashboardResources } from "./_features/calendar/server-resources";
import type { CalendarDashboardResponse } from "./_features/calendar/models";
import { loadCommunicationsInboxResources } from "./_features/communications/server-resources";
import type { ContactDossiersResponse } from "./_features/contacts/models";
import { loadContactDashboardResources } from "./_features/contacts/server-resources";
import type {
  JurisdictionalTrustReportResponse,
  TrustControlsDashboardResponse,
} from "./_features/billing/models";
import type { DocumentAssemblyDashboardResponse } from "./_features/document-assembly/models";
import type { EmailDeliveryDashboardResponse } from "./_features/email-delivery/models";
import { loadEmailDeliveryDashboardResources } from "./_features/email-delivery/server-resources";
import type { ExternalUploadsDashboardResponse } from "./_features/external-uploads/models";
import { loadExternalUploadsDashboardResources } from "./_features/external-uploads/server-resources";
import { loadShareLinksStatus } from "./_features/share-links/server-resources";
import { loadBillingDashboardData } from "./_features/billing/server-resources";
import { loadConnectorOperations } from "./_features/connectors/server-resources";
import {
  loadIntakeFormsDashboardResources,
  loadIntakePipelineResources,
  loadPublicConsultationDashboardResources,
} from "./_features/intake/server-resources";
import { loadLegalClinicDashboardResources } from "./_features/legal-clinic/server-resources";
import { loadLegalResearchDashboardResources } from "./_features/legal-research/server-resources";
import { loadOperationsDashboardResources } from "./_features/operations/server-resources";
import {
  buildJurisdictionalTrustReportPath,
  buildTrustControlsPath,
  emptyJurisdictionalTrustReport,
  emptyTrustControlsDashboard,
  loadTrustControlsDashboardData,
} from "./trust-controls-dashboard";
import type {
  CapabilitiesResponse,
  ClientPortalWorkspaceResponse,
  DocumentProcessingDashboardResponse,
  DocumentProcessingWorkbenchResponse,
  DraftingDashboardResponse,
  IntakeSessionsResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
  SessionResponse,
  SetupStatusResponse,
  SignatureRequestsResponse,
} from "./types";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
  try {
    session = await apiGet<SessionResponse>("/api/session", headers);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      selectStartupView(setupStatus, error.status) === "login"
    ) {
      return <LoginClient apiBaseUrl={browserApiBaseUrl} />;
    }
    throw error;
  }

  if (session.user.role === "client_external") {
    const workspace = await apiGet<ClientPortalWorkspaceResponse>(
      "/api/client-portal/workspace",
      headers,
    );
    return <ClientPortalWorkspace workspace={workspace} />;
  }

  let capabilities: CapabilitiesResponse;
  let overview: PracticeOverview;
  let matters: MatterSummary[];
  let signatures: SignatureRequestsResponse;
  let intake: IntakeSessionsResponse;
  let queues: QueuesResponse;
  let contactDossiers: ContactDossiersResponse;
  try {
    [capabilities, overview, matters, signatures, intake, queues, contactDossiers] =
      await Promise.all([
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
  const { contactReviewQueue, contactDataQualityResolutions } = await loadContactDashboardResources(
    {
      contactCount: contactDossiers.length,
      headers,
    },
  );
  const operationsResources = await loadOperationsDashboardResources(headers);
  const connectorOperations = await loadConnectorOperations(headers);
  const auditProjection = await loadAuditProjection(headers);
  const billing = await loadBillingDashboardData({ headers, matters, session });
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
  const canViewResearch = capabilities.sections.some(
    (section) => section.key === "research" && section.enabled,
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
  const calendar: CalendarDashboardResponse = await loadCalendarDashboardResources({
    enabled: canViewCalendar,
    headers,
    matters,
  });
  const emailDeliveryHistory: EmailDeliveryDashboardResponse =
    await loadEmailDeliveryDashboardResources({ headers, matters });
  const communicationsInbox = await loadCommunicationsInboxResources({ headers, matters });
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
  const documentAssembly: DocumentAssemblyDashboardResponse =
    await loadDocumentAssemblyDashboardResources({
      enabled: canViewDocuments,
      headers,
      matters,
    });
  const legalResearch = await loadLegalResearchDashboardResources({
    enabled: canViewResearch,
    headers,
    matters,
  });
  const shareLinksStatus = await loadShareLinksStatus(headers);
  const externalUploads: ExternalUploadsDashboardResponse =
    await loadExternalUploadsDashboardResources({ headers, matters });
  const intakeForms = await loadIntakeFormsDashboardResources({ headers, matters });
  const intakePipeline = await loadIntakePipelineResources(headers);
  const publicConsultation = await loadPublicConsultationDashboardResources(headers);
  const legalClinic = await loadLegalClinicDashboardResources({
    headers,
    matters,
  });
  const canCreateMatter = capabilities.sections.some(
    (section) => section.key === "matters" && section.actions.includes("create"),
  );
  const navigationSections = applyMatterAvailabilityToNavigation(
    buildSidebarNavigationSections({
      billingCanView: billing.canView,
      capabilitySections: capabilities.sections,
      shareLinksEnabled:
        shareLinksStatus.createStatus === "enabled" && shareLinksStatus.canCreate !== false,
      externalUploadsEnabled: canCreateExternalUpload(externalUploads.status),
      adminReadinessEnabled: ["owner_admin", "auditor"].includes(session.user.role),
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
      aiOperationalProposals={operationsResources.aiOperationalProposals}
      billing={billing}
      calendar={calendar}
      capabilities={capabilities}
      communicationsInbox={communicationsInbox}
      connectorOperations={connectorOperations}
      contactDataQualityResolutions={contactDataQualityResolutions}
      contactDossiers={contactDossiers}
      contactReviewQueue={contactReviewQueue}
      devHeaders={process.env.NODE_ENV === "production" ? {} : devHeaders}
      documentAssembly={documentAssembly}
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
      legalResearch={legalResearch}
      matters={matters}
      overview={overview}
      operationalViewDefinitions={operationsResources.operationalViewDefinitions.definitions}
      operationalViews={operationsResources.operationalViews}
      providerStatus={operationsResources.providerStatus}
      queues={queues}
      reportingWorkspace={operationsResources.reportingWorkspace}
      session={session}
      shareLinksStatus={shareLinksStatus}
      signatures={signatures}
      setupStatus={setupStatus}
      taskWorkbench={operationsResources.taskWorkbench}
      jurisdictionalTrustReport={jurisdictionalTrustReport}
      trustControls={trustControls}
      workerHealth={operationsResources.workerHealth}
      workerRuns={operationsResources.workerRuns}
    />
  );
}
