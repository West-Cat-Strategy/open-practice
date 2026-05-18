import type {
  AuditEvent,
  AuditEventTaxonomySummary,
  AuditMatterScopeHint,
} from "@open-practice/domain";
import type { AuditDashboardProjection, AuditResponse } from "./types";

const emptyTaxonomySummary: AuditEventTaxonomySummary = {
  total: 0,
  known: 0,
  unknown: 0,
  byCategory: {},
  byMatterScope: {},
  byActorHint: {},
  matterScopedWithoutMatterId: 0,
  resourceTypeMismatches: [],
  unknownActions: [],
};

export function emptyAuditDashboardProjection(
  status: AuditDashboardProjection["status"] = "available",
): AuditDashboardProjection {
  return {
    status,
    valid: true,
    eventCount: 0,
    taxonomySummary: emptyTaxonomySummary,
    recentEvents: [],
  };
}

export function auditProjectionFromResponse(
  response: AuditResponse,
  status: AuditDashboardProjection["status"] = "available",
): AuditDashboardProjection {
  return {
    status,
    valid: response.valid,
    eventCount: response.events.length,
    taxonomySummary: response.taxonomySummary,
    recentEvents: response.events
      .slice()
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 5)
      .map(({ id, action, resourceType, resourceId, occurredAt }: AuditEvent) => ({
        id,
        action,
        resourceType,
        resourceId,
        occurredAt,
      })),
  };
}

export function auditProjectionSummary(projection: AuditDashboardProjection): string {
  if (projection.status === "access_denied") return "Audit projection access denied.";
  if (projection.status === "unavailable") return "Audit projection unavailable.";
  const knownShare =
    projection.eventCount > 0
      ? Math.round((projection.taxonomySummary.known / projection.eventCount) * 100)
      : 100;
  return `${projection.eventCount} events. ${knownShare}% classified. ${projection.taxonomySummary.unknown} unknown actions.`;
}

export function leadingAuditCategories(
  summary: AuditEventTaxonomySummary,
): Array<{ label: string; count: number }> {
  return Object.entries(summary.byCategory)
    .map(([label, count]) => ({ label, count: count ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 4);
}

export function matterScopeCount(
  summary: AuditEventTaxonomySummary,
  scope: AuditMatterScopeHint,
): number {
  return summary.byMatterScope[scope] ?? 0;
}
