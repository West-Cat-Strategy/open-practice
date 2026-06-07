import { RotateCcw } from "lucide-react";

import {
  auditProjectionStatusLabel,
  summarizeAuditProjectionIssues,
  type AuditProjectionDashboardResponse,
} from "../audit-dashboard";
import type { DashboardLaneFreshnessCue, DashboardLaneRefreshState } from "../dashboard-utils";
import type { MatterSummary } from "../types";

type MatterActivityEntry = MatterSummary["activity"][number];

interface AuditSectionProps {
  activity?: MatterActivityEntry[];
  auditFreshnessCue: DashboardLaneFreshnessCue;
  auditProjection: AuditProjectionDashboardResponse;
  auditRefreshState: DashboardLaneRefreshState;
  compactDate: (value: string) => string;
  onRefreshAudit: () => void;
}

export function AuditSection({
  activity,
  auditFreshnessCue,
  auditProjection,
  auditRefreshState,
  compactDate,
  onRefreshAudit,
}: AuditSectionProps) {
  const auditProjectionIssues = summarizeAuditProjectionIssues(auditProjection.taxonomySummary);
  const hasActivityContext = activity !== undefined;

  return (
    <>
      <div
        className={`lane-refresh-panel ${auditFreshnessCue.tone}`}
        data-stale={auditFreshnessCue.stale ? "true" : "false"}
      >
        <span>
          <strong>Audit activity</strong>
          <small>{auditFreshnessCue.detail}</small>
        </span>
        <button
          aria-label="Refresh audit activity"
          className="secondary-button compact-button lane-refresh-button"
          disabled={auditRefreshState.refreshing}
          onClick={onRefreshAudit}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} />
          {auditRefreshState.refreshing ? "Refreshing" : auditFreshnessCue.label}
        </button>
      </div>
      {hasActivityContext ? (
        <div className="party-list">
          <AuditProjectionSummary
            auditProjection={auditProjection}
            includeDetails={true}
            issues={auditProjectionIssues}
          />
          {activity.map((entry) => (
            <div className="party-row" key={entry.id}>
              <span>
                <strong>{entry.title}</strong>
                <small>{compactDate(entry.occurredAt)}</small>
              </span>
              <em>{entry.kind}</em>
            </div>
          ))}
          {activity.length === 0 ? (
            <p className="inline-empty">No activity has been recorded for this matter.</p>
          ) : null}
        </div>
      ) : (
        <AuditProjectionSummary
          auditProjection={auditProjection}
          includeDetails={false}
          issues={auditProjectionIssues}
        />
      )}
    </>
  );
}

function AuditProjectionSummary({
  auditProjection,
  includeDetails,
  issues,
}: {
  auditProjection: AuditProjectionDashboardResponse;
  includeDetails: boolean;
  issues: ReturnType<typeof summarizeAuditProjectionIssues>;
}) {
  return (
    <div className="audit-projection-summary">
      <div className="audit-projection-header">
        <span>
          <strong>Audit taxonomy projection</strong>
          <small>{auditProjectionStatusLabel(auditProjection.status)}</small>
        </span>
        <em>{auditProjection.valid === false ? "chain invalid" : "read-only"}</em>
      </div>
      <div className="audit-projection-grid">
        <span>
          <strong>{issues.unknownActionCount}</strong>
          <small>Unknown actions</small>
        </span>
        <span>
          <strong>{issues.matterScopeGapCount}</strong>
          <small>Matter-scope gaps</small>
        </span>
        <span>
          <strong>{issues.resourceTypeMismatchCount}</strong>
          <small>Resource-type mismatches</small>
        </span>
      </div>
      {includeDetails ? (
        <div className="audit-projection-details">
          <span>
            <strong>Unknown</strong>
            <small>
              {issues.unknownActions.length > 0
                ? issues.unknownActions.slice(0, 4).join(", ")
                : "No unknown actions in the loaded audit window."}
            </small>
          </span>
          <span>
            <strong>Mismatches</strong>
            <small>
              {issues.resourceTypeMismatches.length > 0
                ? issues.resourceTypeMismatches
                    .slice(0, 3)
                    .map(
                      (mismatch) =>
                        `${mismatch.action}: ${mismatch.observedResourceType} expected ${mismatch.expectedResourceType} (${mismatch.count})`,
                    )
                    .join("; ")
                : "No resource-type mismatches in the loaded audit window."}
            </small>
          </span>
        </div>
      ) : null}
    </div>
  );
}
