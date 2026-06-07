import { apiGetOptional } from "../../_shared/server-api";
import {
  buildExternalUploadListPath,
  externalUploadsStatusFallback,
  loadExternalUploadsDashboardData,
} from "../../external-uploads-dashboard";
import type { MatterSummary } from "../../types";
import type {
  ExternalUploadsDashboardResponse,
  ExternalUploadsListResponse,
  ExternalUploadsStatusResponse,
} from "./models";

export async function loadExternalUploadsDashboardResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<ExternalUploadsDashboardResponse> {
  return loadExternalUploadsDashboardData({
    matters: input.matters,
    getStatus: () =>
      apiGetOptional<ExternalUploadsStatusResponse>(
        "/api/external-uploads/status",
        externalUploadsStatusFallback,
        input.headers,
      ),
    listUploadsForMatter: (matterId) =>
      apiGetOptional<ExternalUploadsListResponse>(
        buildExternalUploadListPath(matterId),
        { uploads: [], reviewItems: [] },
        input.headers,
        { uploads: [], reviewItems: [] },
      ),
  });
}
