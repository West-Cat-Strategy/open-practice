import { apiGetOptional, apiGetOptionalWithStatus } from "../../_shared/server-api";
import {
  buildIntakeFormLinkListPath,
  buildIntakeVariableProposalListPath,
  loadIntakeFormsDashboardData,
} from "../../intake-forms-dashboard";
import {
  buildIntakePipelinePath,
  emptyIntakePipelineDashboard,
} from "../../intake-pipeline-dashboard";
import {
  buildPublicConsultationIntakeSettingsPath,
  buildPublicConsultationIntakesPath,
  emptyPublicConsultationDashboard,
} from "../../public-consultation-intakes-dashboard";
import type {
  IntakeFormsDashboardResponse,
  IntakeFormLinksResponse,
  IntakePipelineDashboardResponse,
  IntakePipelineResponse,
  IntakeVariableProposalsResponse,
  MatterSummary,
  PublicConsultationDashboardResponse,
  PublicConsultationIntakeSettings,
  PublicConsultationIntakesResponse,
} from "../../types";

export async function loadIntakeFormsDashboardResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<IntakeFormsDashboardResponse> {
  return loadIntakeFormsDashboardData({
    matters: input.matters,
    listLinksForMatter: async (matterId) =>
      apiGetOptional<IntakeFormLinksResponse>(
        buildIntakeFormLinkListPath(matterId),
        { links: [], actionsByLinkId: {} },
        input.headers,
        { links: [], actionsByLinkId: {} },
      ),
    listProposalsForMatter: async (matterId) => {
      const response = await apiGetOptional<IntakeVariableProposalsResponse>(
        buildIntakeVariableProposalListPath(matterId),
        { proposals: [] },
        input.headers,
        { proposals: [] },
      );
      return response.proposals;
    },
  });
}

export async function loadIntakePipelineResources(
  headers: Record<string, string>,
): Promise<IntakePipelineDashboardResponse> {
  const result = await apiGetOptionalWithStatus<IntakePipelineResponse>(
    buildIntakePipelinePath(),
    emptyIntakePipelineDashboard("unavailable"),
    headers,
  );
  return {
    ...result.data,
    status: result.status,
  };
}

export async function loadPublicConsultationDashboardResources(
  headers: Record<string, string>,
): Promise<PublicConsultationDashboardResponse> {
  const [settingsResult, intakesResult] = await Promise.all([
    apiGetOptionalWithStatus<PublicConsultationIntakeSettings>(
      buildPublicConsultationIntakeSettingsPath(),
      emptyPublicConsultationDashboard("unavailable").settings,
      headers,
    ),
    apiGetOptionalWithStatus<PublicConsultationIntakesResponse>(
      buildPublicConsultationIntakesPath("pending"),
      { intakes: [] },
      headers,
    ),
  ]);
  const status =
    settingsResult.status === "access_denied" || intakesResult.status === "access_denied"
      ? "access_denied"
      : settingsResult.status === "unavailable" || intakesResult.status === "unavailable"
        ? "unavailable"
        : "available";
  return {
    settings: settingsResult.data,
    intakes: intakesResult.data.intakes,
    status,
  };
}
