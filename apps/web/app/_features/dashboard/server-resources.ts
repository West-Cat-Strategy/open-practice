import { apiGet, apiGetOptional } from "../../_shared/server-api";
import type {
  JurisdictionalTrustReportResponse,
  TrustControlsDashboardResponse,
} from "../billing/models";
import type { ContactDossiersResponse } from "../contacts/models";
import {
  buildJurisdictionalTrustReportPath,
  buildTrustControlsPath,
  emptyJurisdictionalTrustReport,
  emptyTrustControlsDashboard,
  loadTrustControlsDashboardData,
} from "../../trust-controls-dashboard";
import type {
  CapabilitiesResponse,
  IntakeSessionsResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
  SignatureRequestsResponse,
} from "../../types";

export interface DashboardCoreResources {
  capabilities: CapabilitiesResponse;
  overview: PracticeOverview;
  matters: MatterSummary[];
  signatures: SignatureRequestsResponse;
  intake: IntakeSessionsResponse;
  queues: QueuesResponse;
  contactDossiers: ContactDossiersResponse;
}

export interface DashboardTrustResources {
  trustControls: TrustControlsDashboardResponse;
  jurisdictionalTrustReport: JurisdictionalTrustReportResponse;
}

export async function loadDashboardCoreResources(
  headers: Record<string, string>,
): Promise<DashboardCoreResources> {
  const [capabilities, overview, matters, signatures, intake, queues, contactDossiers] =
    await Promise.all([
      apiGet<CapabilitiesResponse>("/api/capabilities", headers),
      apiGet<PracticeOverview>("/api/overview", headers),
      apiGet<MatterSummary[]>("/api/matters", headers),
      apiGet<SignatureRequestsResponse>("/api/signature-requests", headers),
      apiGet<IntakeSessionsResponse>("/api/intake-sessions", headers),
      apiGet<QueuesResponse>("/api/queues", headers),
      apiGet<ContactDossiersResponse>("/api/contacts/dossiers", headers),
    ]);

  return { capabilities, overview, matters, signatures, intake, queues, contactDossiers };
}

export async function loadDashboardTrustResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<DashboardTrustResources> {
  const trustControls = await loadTrustControlsDashboardData({
    matter: input.matters[0],
    getControls: (matterId) =>
      apiGetOptional<TrustControlsDashboardResponse>(
        buildTrustControlsPath(matterId),
        emptyTrustControlsDashboard(),
        input.headers,
        emptyTrustControlsDashboard(),
      ),
  });
  const jurisdictionalTrustReport = await apiGetOptional<JurisdictionalTrustReportResponse>(
    buildJurisdictionalTrustReportPath(),
    emptyJurisdictionalTrustReport(),
    input.headers,
    emptyJurisdictionalTrustReport(),
  );

  return { trustControls, jurisdictionalTrustReport };
}
