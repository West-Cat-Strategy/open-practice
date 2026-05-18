import type { AuditEventTaxonomySummary } from "@open-practice/domain";

export type AuditProjectionDashboardStatus = "available" | "access_denied" | "unavailable";

export interface AuditProjectionDashboardResponse {
  status: AuditProjectionDashboardStatus;
  valid: boolean | null;
  taxonomySummary: AuditEventTaxonomySummary;
}

export interface AuditProjectionIssueSummary {
  unknownActionCount: number;
  matterScopeGapCount: number;
  resourceTypeMismatchCount: number;
  unknownActions: string[];
  resourceTypeMismatches: AuditEventTaxonomySummary["resourceTypeMismatches"];
}

export function emptyAuditProjectionDashboard(
  status: AuditProjectionDashboardStatus = "unavailable",
): AuditProjectionDashboardResponse {
  return {
    status,
    valid: null,
    taxonomySummary: {
      total: 0,
      known: 0,
      unknown: 0,
      byCategory: {},
      byMatterScope: {},
      byActorHint: {},
      matterScopedWithoutMatterId: 0,
      resourceTypeMismatches: [],
      unknownActions: [],
    },
  };
}

export function summarizeAuditProjectionIssues(
  summary: AuditEventTaxonomySummary,
): AuditProjectionIssueSummary {
  return {
    unknownActionCount: summary.unknown,
    matterScopeGapCount: summary.matterScopedWithoutMatterId,
    resourceTypeMismatchCount: summary.resourceTypeMismatches.reduce(
      (total, mismatch) => total + mismatch.count,
      0,
    ),
    unknownActions: summary.unknownActions,
    resourceTypeMismatches: summary.resourceTypeMismatches,
  };
}

export function auditProjectionStatusLabel(status: AuditProjectionDashboardStatus): string {
  if (status === "available") return "Audit taxonomy loaded";
  if (status === "access_denied") return "Audit taxonomy access denied";
  return "Audit taxonomy unavailable";
}
