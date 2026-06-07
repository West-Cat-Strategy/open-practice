import { ApiRequestError, apiGet } from "../../_shared/server-api";
import {
  emptyAuditProjectionDashboard,
  type AuditProjectionDashboardResponse,
} from "../../audit-dashboard";
import type { AuditResponse } from "../../types";

export async function loadAuditProjection(
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
