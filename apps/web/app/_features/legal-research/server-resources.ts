import { apiGetOptional } from "../../_shared/server-api";
import {
  buildLegalResearchWorkspacePath,
  emptyLegalResearchWorkspace,
  loadLegalResearchDashboardData,
} from "../../legal-research-dashboard";
import type {
  LegalResearchDashboardResponse,
  LegalResearchWorkspaceResponse,
  MatterSummary,
} from "../../types";

export async function loadLegalResearchDashboardResources(input: {
  enabled: boolean;
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<LegalResearchDashboardResponse> {
  if (!input.enabled) return { workbenchesByMatterId: {} };

  return loadLegalResearchDashboardData({
    matters: input.matters,
    getWorkspace: (matterId) =>
      apiGetOptional<LegalResearchWorkspaceResponse>(
        buildLegalResearchWorkspacePath(matterId),
        emptyLegalResearchWorkspace(matterId),
        input.headers,
        emptyLegalResearchWorkspace(matterId, "access_denied"),
      ),
  });
}
