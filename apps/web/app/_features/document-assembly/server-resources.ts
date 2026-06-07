import { apiGetOptional } from "../../_shared/server-api";
import {
  buildDocumentAssemblyWorkbenchPath,
  emptyDocumentAssemblyWorkbench,
  loadDocumentAssemblyDashboardData,
} from "../../document-assembly-dashboard";
import type { MatterSummary } from "../../types";
import type {
  DocumentAssemblyDashboardResponse,
  DocumentAssemblyWorkbenchResponse,
} from "./models";

export async function loadDocumentAssemblyDashboardResources(input: {
  enabled: boolean;
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<DocumentAssemblyDashboardResponse> {
  if (!input.enabled) return { workbenchesByMatterId: {} };

  return loadDocumentAssemblyDashboardData({
    matters: input.matters,
    getWorkbench: (matterId) =>
      apiGetOptional<DocumentAssemblyWorkbenchResponse>(
        buildDocumentAssemblyWorkbenchPath(matterId),
        emptyDocumentAssemblyWorkbench(matterId),
        input.headers,
        emptyDocumentAssemblyWorkbench(matterId, "access_denied"),
      ),
  });
}
