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
import { loadCommunicationsInboxResources } from "./_features/communications/server-resources";
import { loadContactDashboardResources } from "./_features/contacts/server-resources";
import { loadEmailDeliveryDashboardResources } from "./_features/email-delivery/server-resources";
import { loadEmailTemplateDashboardResources } from "./_features/email-templates/server-resources";
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
  loadDashboardCoreResources,
  loadDashboardTrustResources,
} from "./_features/dashboard/server-resources";
import type {
  ClientPortalWorkspaceResponse,
  DocumentProcessingDashboardResponse,
  DocumentProcessingWorkbenchResponse,
  DraftingDashboardResponse,
  EmailSettingsResponse,
  ImapSettingsResponse,
  SessionResponse,
  SetupStatusResponse,
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
    return <SetupWizard apiBaseUrl={browserApiBaseUrl} />;
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
    return <ClientPortalWorkspace apiBaseUrl={browserApiBaseUrl} workspace={workspace} />;
  }

  let coreResources: Awaited<ReturnType<typeof loadDashboardCoreResources>>;
  try {
    coreResources = await loadDashboardCoreResources(headers);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      selectStartupView(setupStatus, error.status) === "login"
    ) {
      return <LoginClient apiBaseUrl={browserApiBaseUrl} />;
    }
    throw error;
  }
  const { capabilities, overview, matters, signatures, intake, queues, contactDossiers } =
    coreResources;
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
  const canCreateMatter = capabilities.sections.some(
    (section) => section.key === "matters" && section.actions.includes("create"),
  );
  const emptyEmailSettings: EmailSettingsResponse = {
    settings: {
      key: "default",
      enabled: false,
      secure: false,
      passwordConfigured: false,
      configValid: false,
      missingFields: ["config"],
    },
  };
  const emptyImapSettings: ImapSettingsResponse = {
    settings: {
      key: "imap",
      enabled: false,
      secure: true,
      mailbox: "INBOX",
      pollIntervalSeconds: 300,
      markSeen: false,
      passwordConfigured: false,
      configValid: false,
      missingFields: ["config"],
    },
  };
  const [
    { contactReviewQueue, contactDataQualityResolutions },
    operationsResources,
    connectorOperations,
    auditProjection,
    billing,
    { trustControls, jurisdictionalTrustReport },
    drafting,
    calendar,
    emailDeliveryHistory,
    emailTemplates,
    communicationsInbox,
    documentProcessing,
    documentAssembly,
    legalResearch,
    shareLinksStatus,
    externalUploads,
    intakeForms,
    intakePipeline,
    publicConsultation,
    emailSettings,
    imapSettings,
    legalClinic,
  ] = await Promise.all([
    loadContactDashboardResources({
      contactCount: contactDossiers.length,
      headers,
    }),
    loadOperationsDashboardResources(headers),
    loadConnectorOperations(headers),
    loadAuditProjection(headers),
    loadBillingDashboardData({ headers, matters, session }),
    loadDashboardTrustResources({
      headers,
      matters,
    }),
    canViewDrafting
      ? loadDraftingDashboardData({
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
      : ({ templates: [], draftsByMatterId: {} } satisfies DraftingDashboardResponse),
    loadCalendarDashboardResources({
      enabled: canViewCalendar,
      headers,
      matters,
    }),
    loadEmailDeliveryDashboardResources({ headers, matters }),
    loadEmailTemplateDashboardResources({ headers, matters }),
    loadCommunicationsInboxResources({ headers, matters }),
    canViewDocuments
      ? loadDocumentProcessingDashboardData({
          matters,
          getWorkbench: (matterId) =>
            apiGetOptional<DocumentProcessingWorkbenchResponse>(
              buildDocumentProcessingWorkbenchPath(matterId),
              emptyDocumentProcessingWorkbench(matterId),
              headers,
              emptyDocumentProcessingWorkbench(matterId, "access_denied"),
            ),
        })
      : ({ workbenchesByMatterId: {} } satisfies DocumentProcessingDashboardResponse),
    loadDocumentAssemblyDashboardResources({
      enabled: canViewDocuments,
      headers,
      matters,
    }),
    loadLegalResearchDashboardResources({
      enabled: canViewResearch,
      headers,
      matters,
    }),
    loadShareLinksStatus(headers),
    loadExternalUploadsDashboardResources({ headers, matters }),
    loadIntakeFormsDashboardResources({ headers, matters }),
    loadIntakePipelineResources(headers),
    loadPublicConsultationDashboardResources(headers),
    apiGetOptional<EmailSettingsResponse>(
      "/api/email/settings",
      emptyEmailSettings,
      headers,
      emptyEmailSettings,
    ),
    apiGetOptional<ImapSettingsResponse>(
      "/api/inbound-email/settings/imap",
      emptyImapSettings,
      headers,
      emptyImapSettings,
    ),
    loadLegalClinicDashboardResources({
      headers,
      matters,
    }),
  ]);
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
  const initialRouteSelection = resolveDashboardRouteSelection({
    requestedSection,
    navigationSections,
  });

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
      emailTemplates={emailTemplates}
      emailSettings={emailSettings.settings}
      externalUploads={externalUploads}
      initialRouteSelection={initialRouteSelection}
      intake={intake}
      intakeForms={intakeForms}
      intakePipeline={intakePipeline}
      imapSettings={imapSettings.settings}
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
      workflowHistory={operationsResources.workflowHistory}
      workerRuns={operationsResources.workerRuns}
    />
  );
}
