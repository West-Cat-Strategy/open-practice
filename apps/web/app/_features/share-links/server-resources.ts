import { apiGetOptional } from "../../_shared/server-api";
import type { ShareLinksStatusResponse } from "./models";

const shareLinksStatusFallback: ShareLinksStatusResponse = {
  createStatus: "disabled",
  reason: "share_routes_unavailable",
};

export async function loadShareLinksStatus(
  headers: Record<string, string>,
): Promise<ShareLinksStatusResponse> {
  return apiGetOptional<ShareLinksStatusResponse>(
    "/api/shares/status",
    shareLinksStatusFallback,
    headers,
  );
}
