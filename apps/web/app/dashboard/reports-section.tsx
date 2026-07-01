import {
  BarChart3,
  CalendarClock,
  Download,
  History,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import type {
  StaffReportDefinitionKey,
  StaffReportExportProfileId,
  StaffReportGroupingKey,
  StaffReportHistoryItem,
  StaffReportProjectionRow,
} from "@open-practice/domain";
import type { StaffReportingWorkspaceResponse } from "../types";

function compactReportText(value: string): string {
  return value.replaceAll("_", " ");
}

function formatReportMetric(input: {
  cents: (value: number) => string;
  minutes: (value: number) => string;
  metricCents?: number;
  metricMinutes?: number;
  metricCount?: number;
}): string {
  if (input.metricCents !== undefined) return input.cents(input.metricCents);
  if (input.metricMinutes !== undefined) return input.minutes(input.metricMinutes);
  if (input.metricCount !== undefined) return String(input.metricCount);
  return "review";
}

function metricSummary(metrics: Record<string, string | number | boolean>): string {
  return Object.entries(metrics)
    .slice(0, 3)
    .map(([key, value]) => `${compactReportText(key)} ${String(value)}`)
    .join(" · ");
}

function profileSummary(profile: { label: string; format: string }): string {
  return `${profile.label} (${profile.format.toUpperCase()})`;
}

function metadataText(
  metadata: StaffReportProjectionRow["metadata"],
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function metadataNumber(
  metadata: StaffReportProjectionRow["metadata"],
  key: string,
): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function agedReceivablesDetail(row: StaffReportProjectionRow): string | undefined {
  const clientDisplayName = metadataText(row.metadata, "clientDisplayName");
  const invoiceNumber = metadataText(row.metadata, "invoiceNumber");
  const bucketLabel = metadataText(row.metadata, "bucketLabel");
  const daysPastDue = metadataNumber(row.metadata, "daysPastDue");
  const details = [
    clientDisplayName,
    invoiceNumber ? `invoice ${invoiceNumber}` : undefined,
    bucketLabel,
    daysPastDue !== undefined ? `${daysPastDue} days past due` : undefined,
  ].filter((detail): detail is string => Boolean(detail));
  return details.length > 0 ? details.join(" · ") : undefined;
}

function safeIdSummary(safeIds: string[] | undefined): string | undefined {
  if (!safeIds || safeIds.length === 0) return undefined;
  const sample = safeIds.slice(0, 4).join(", ");
  return safeIds.length > 4 ? `${sample}, +${safeIds.length - 4}` : sample;
}

function billingPeriodLockImpactDetail(row: StaffReportProjectionRow): string | undefined {
  const sourceType = metadataText(row.metadata, "sourceType");
  const lockId = metadataText(row.metadata, "lockId");
  const lockStart = metadataText(row.metadata, "lockPeriodStart");
  const lockEnd = metadataText(row.metadata, "lockPeriodEnd");
  const safeIds = safeIdSummary(row.safeIds);
  const details = [
    sourceType ? compactReportText(sourceType) : undefined,
    lockId,
    lockStart && lockEnd ? `${lockStart.slice(0, 10)} to ${lockEnd.slice(0, 10)}` : undefined,
    safeIds ? `safe IDs ${safeIds}` : undefined,
  ].filter((detail): detail is string => Boolean(detail));
  return details.length > 0 ? details.join(" · ") : undefined;
}

export function ReportsSection({
  compactDate,
  cents,
  exportingReportKey,
  exportStatus,
  minutes,
  onDownloadReportExport,
  onPollReportExport,
  onRequestReportExport,
  reportingWorkspace,
}: {
  compactDate: (value?: string) => string;
  cents: (value: number) => string;
  exportingReportKey?: string;
  exportStatus: string;
  minutes: (value: number) => string;
  onRequestReportExport: (
    definitionKey: StaffReportDefinitionKey,
    exportProfileId: StaffReportExportProfileId,
    groupingKey: StaffReportGroupingKey,
  ) => void;
  onPollReportExport: (item: StaffReportHistoryItem) => void;
  onDownloadReportExport: (item: StaffReportHistoryItem) => void;
  reportingWorkspace: StaffReportingWorkspaceResponse;
}) {
  const reportByDefinition = new Map(
    reportingWorkspace.reports.map((report) => [report.definitionKey, report] as const),
  );
  const profileById = new Map(
    reportingWorkspace.exportProfiles.map((profile) => [profile.id, profile] as const),
  );

  return (
    <>
      <div className="detail-grid billing-summary-grid">
        <div>
          <span className="field-label">Definitions</span>
          <strong>{reportingWorkspace.definitions.length}</strong>
        </div>
        <div>
          <span className="field-label">Generated</span>
          <strong>{compactDate(reportingWorkspace.generatedAt)}</strong>
        </div>
        <div>
          <span className="field-label">Export profiles</span>
          <strong>{reportingWorkspace.exportProfiles.length}</strong>
        </div>
        <div>
          <span className="field-label">History</span>
          <strong>{reportingWorkspace.history.length}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Saved report definitions</h3>
        <span>manual downloads · bounded job metadata</span>
      </div>
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {exportStatus}
      </p>
      <div className="party-list">
        {reportingWorkspace.definitions.map((definition) => {
          const report = reportByDefinition.get(definition.key);
          const defaultGrouping = definition.defaultGrouping;
          return (
            <div className="party-row reporting-definition-row" key={definition.key}>
              <span>
                <strong>{definition.name}</strong>
                <small>{definition.description}</small>
                <small>
                  {definition.filters.length} filters · {definition.groupings.length} groupings ·{" "}
                  {report?.rowCount ?? 0} rows
                </small>
              </span>
              <span className="row-actions">
                {definition.exportProfileIds.map((profileId) => {
                  const profile = profileById.get(profileId);
                  const busyKey = `${definition.key}:${profileId}`;
                  return (
                    <button
                      aria-label={`Export ${definition.name} using ${profile?.label ?? profileId}`}
                      className="secondary-button compact-button row-button"
                      disabled={exportingReportKey === busyKey}
                      key={profileId}
                      onClick={() =>
                        onRequestReportExport(definition.key, profileId, defaultGrouping)
                      }
                      title={profile?.label ?? profileId}
                      type="button"
                    >
                      <Download aria-hidden="true" size={16} />
                      {exportingReportKey === busyKey ? "Queuing" : profile?.format.toUpperCase()}
                    </button>
                  );
                })}
              </span>
            </div>
          );
        })}
        {reportingWorkspace.definitions.length === 0 ? (
          <p className="inline-empty">Reporting workspace is unavailable for this session.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Scheduling and builder posture</h3>
        <span>readiness metadata · no automatic delivery</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <CalendarClock size={18} />
          <strong>Schedule readiness</strong>
          <span>
            {reportingWorkspace.scheduleReadinessSummary.manualExportReadyDefinitions} manual export
            ready · {reportingWorkspace.scheduleReadinessSummary.scheduledDefinitionCount} scheduled
          </span>
          <span>Manual exports only · No scheduled email delivery</span>
        </div>
        <div className="activity-card">
          <SlidersHorizontal size={18} />
          <strong>Report builder posture</strong>
          <span>
            {reportingWorkspace.reportBuilderPosture.filterCount} filters ·{" "}
            {reportingWorkspace.reportBuilderPosture.groupingCount} groupings ·{" "}
            {reportingWorkspace.reportBuilderPosture.exportProfileCount} profiles
          </span>
          <span>No custom SQL · No BI embeds · No raw report bodies</span>
        </div>
      </div>

      <div className="section-title">
        <h3>Export profile alignment</h3>
        <span>read-only comparison · bounded field samples</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <Download size={18} />
          <strong>Manual report export profiles</strong>
          <span>
            {reportingWorkspace.exportProfileAlignment.staffReportProfiles
              .map(profileSummary)
              .join(" · ") || "No manual report profiles"}
          </span>
          <span>Manual downloads only · No raw report bodies</span>
        </div>
        <div className="activity-card">
          <SlidersHorizontal size={18} />
          <strong>Financial export field profiles</strong>
          <span>
            {reportingWorkspace.exportProfileAlignment.financialFieldProfiles
              .map((profile) => `${profile.label} (${profile.fieldKeyCount} keys)`)
              .join(" · ") || "No financial field profiles"}
          </span>
          <span>
            {reportingWorkspace.exportProfileAlignment.financialFieldProfiles
              .flatMap((profile) => profile.sampleFieldKeys.slice(0, 2))
              .map(compactReportText)
              .join(", ") || "No field-key samples"}
          </span>
        </div>
      </div>
      <p className="inline-empty">
        No custom SQL · No BI embeds · No scheduled delivery · No raw export bodies · No payment
        processor exposure · No invoice mutation · No trust posting · No certification claims
      </p>
      <div className="party-list">
        {reportingWorkspace.exportProfileAlignment.differences.map((difference) => (
          <div className="party-row" key={difference.key}>
            <span>
              <strong>{difference.label}</strong>
              <small>Reports: {difference.staffReporting}</small>
              <small>Financial fields: {difference.financialFieldProfiles}</small>
            </span>
            <em>read only</em>
          </div>
        ))}
        {reportingWorkspace.exportProfileAlignment.differences.length === 0 ? (
          <p className="inline-empty">No export profile alignment metadata is available.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Expense category accounting profile</h3>
        <span>read-only preview · local metadata only</span>
      </div>
      <div className="activity-grid two-column">
        <div className="activity-card">
          <SlidersHorizontal size={18} />
          <strong>{reportingWorkspace.expenseCategoryAccountingExportProfileSummary.label}</strong>
          <span>
            {reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts.total}{" "}
            categories ·{" "}
            {reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts.active}{" "}
            active ·{" "}
            {
              reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts
                .inactive
            }{" "}
            inactive
          </span>
          <span>
            {
              reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts
                .firmDefault
            }{" "}
            firm default ·{" "}
            {reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts.scoped}{" "}
            scoped · profile{" "}
            {compactReportText(
              reportingWorkspace.expenseCategoryAccountingExportProfileSummary
                .financialProfileReference,
            )}
          </span>
        </div>
        <div className="activity-card">
          <Download size={18} />
          <strong>Accounting export posture</strong>
          <span>
            {reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts.mapped}{" "}
            mapped ·{" "}
            {
              reportingWorkspace.expenseCategoryAccountingExportProfileSummary.categoryCounts
                .omitted
            }{" "}
            omitted after limit
          </span>
          <span>No provider · No serialization change · No certified accounting claim</span>
        </div>
      </div>
      <p className="inline-empty">
        No external accounting provider · No export serialization change · No invoice recalculation
        · No payment mutation · No trust posting · No certified-accounting claim
      </p>
      <div className="party-list">
        {reportingWorkspace.expenseCategoryAccountingExportProfileSummary.mappings.map(
          (mapping) => (
            <div className="party-row" key={mapping.code}>
              <span>
                <strong>
                  {mapping.code} · {mapping.label}
                </strong>
                <small>
                  {mapping.active ? "active" : "inactive"} ·{" "}
                  {mapping.defaultReimbursable
                    ? "default reimbursable"
                    : "not default reimbursable"}{" "}
                  · {mapping.reimbursableAllowed ? "reimbursable allowed" : "non-reimbursable only"}
                </small>
                <small>
                  {compactReportText(mapping.reviewBucket)} · {mapping.reviewCue}
                </small>
              </span>
              <em>{mapping.localPreviewOnly ? "preview" : "review"}</em>
            </div>
          ),
        )}
        {reportingWorkspace.expenseCategoryAccountingExportProfileSummary.mappings.length === 0 ? (
          <p className="inline-empty">
            No expense category accounting preview metadata is available.
          </p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Filter and grouping metadata</h3>
        <span>{reportingWorkspace.workspacePolicy.customSql ? "custom SQL" : "no custom SQL"}</span>
      </div>
      <div className="activity-grid two-column">
        {reportingWorkspace.definitions.map((definition) => (
          <div className="activity-card" key={`metadata-${definition.key}`}>
            <SlidersHorizontal size={18} />
            <strong>{definition.name}</strong>
            <span>
              {definition.filters.map((filter) => filter.label).join(", ") || "No filters"}
            </span>
            <span>
              {definition.groupings.map((grouping) => grouping.label).join(", ") || "No groupings"}
            </span>
          </div>
        ))}
      </div>

      <div className="section-title">
        <h3>First report projections</h3>
        <span>rebuilt from authorized dashboard records</span>
      </div>
      <div className="activity-grid two-column">
        {reportingWorkspace.reports.map((report) => {
          const definition = reportingWorkspace.definitions.find(
            (candidate) => candidate.key === report.definitionKey,
          );
          return (
            <div className="activity-card" key={report.definitionKey}>
              <BarChart3 size={18} />
              <strong>{definition?.name ?? compactReportText(report.definitionKey)}</strong>
              <span>{metricSummary(report.summary.metrics)}</span>
              <span>
                {report.summary.groups.length} groups · {report.rowCount} rows ·{" "}
                {compactReportText(report.groupingKey)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h3>Report rows</h3>
        <span>summary rows only</span>
      </div>
      <div className="party-list">
        {reportingWorkspace.reports.flatMap((report) =>
          report.rows.slice(0, 3).map((row) => {
            const receivablesDetail =
              report.definitionKey === "aged_receivables" ? agedReceivablesDetail(row) : undefined;
            const lockImpactDetail =
              report.definitionKey === "billing_period_lock_impact"
                ? billingPeriodLockImpactDetail(row)
                : undefined;
            return (
              <div className="party-row" key={`${report.definitionKey}:${row.id}`}>
                <span>
                  <strong>{row.label}</strong>
                  <small>
                    {compactReportText(report.definitionKey)} · {row.groupLabel} ·{" "}
                    {compactReportText(row.status)}
                  </small>
                  <small>
                    {row.matterNumber ? `${row.matterNumber} · ` : ""}
                    {row.dueAt
                      ? `due ${compactDate(row.dueAt)}`
                      : row.occurredAt
                        ? compactDate(row.occurredAt)
                        : "current projection"}
                  </small>
                  {receivablesDetail ? <small>{receivablesDetail}</small> : null}
                  {lockImpactDetail ? <small>{lockImpactDetail}</small> : null}
                  {row.dimensions ? (
                    <small>
                      {row.dimensions.jurisdiction} · {row.dimensions.practiceArea} ·{" "}
                      {compactReportText(row.dimensions.clinicProgramId)} ·{" "}
                      {compactReportText(row.dimensions.restrictedFundReviewStatus)}
                    </small>
                  ) : null}
                </span>
                <em className={row.tone === "risk" ? "risk" : undefined}>
                  {formatReportMetric({
                    cents,
                    minutes,
                    metricCents: row.metricCents,
                    metricMinutes: row.metricMinutes,
                    metricCount: row.metricCount,
                  })}
                </em>
              </div>
            );
          }),
        )}
        {reportingWorkspace.reports.every((report) => report.rows.length === 0) ? (
          <p className="inline-empty">No report rows are available in the current projection.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Export history</h3>
        <span>{reportingWorkspace.history.length} requests</span>
      </div>
      <div className="party-list">
        {reportingWorkspace.history.slice(0, 6).map((item) => (
          <div className="party-row" key={item.jobId}>
            <span>
              <strong>{compactReportText(item.reportDefinitionKey ?? "staff_report")}</strong>
              <small>
                {compactReportText(item.exportProfileId ?? "profile")} ·{" "}
                {compactReportText(item.status)}
                {item.rowCount !== undefined ? ` · ${item.rowCount} rows` : ""}
              </small>
              <small>{compactDate(item.finishedAt ?? item.queuedAt)}</small>
            </span>
            <em
              className={
                item.status === "failed" || item.status === "dead_letter" ? "risk" : undefined
              }
            >
              <History size={15} aria-hidden="true" /> {compactReportText(item.status)}
            </em>
            <span className="row-actions">
              <button
                aria-label={`Refresh ${compactReportText(
                  item.reportDefinitionKey ?? "staff report",
                )} export`}
                className="secondary-button compact-button row-button"
                disabled={exportingReportKey === `poll:${item.jobId}`}
                onClick={() => onPollReportExport(item)}
                type="button"
              >
                <RefreshCcw aria-hidden="true" size={14} />
                {exportingReportKey === `poll:${item.jobId}` ? "Refreshing" : "Refresh"}
              </button>
              <button
                aria-label={`Download ${compactReportText(
                  item.reportDefinitionKey ?? "staff report",
                )} export`}
                className="secondary-button compact-button row-button"
                disabled={
                  item.status !== "completed" || exportingReportKey === `download:${item.jobId}`
                }
                onClick={() => onDownloadReportExport(item)}
                type="button"
              >
                <Download aria-hidden="true" size={14} />
                {exportingReportKey === `download:${item.jobId}` ? "Preparing" : "Download"}
              </button>
            </span>
          </div>
        ))}
        {reportingWorkspace.history.length === 0 ? (
          <p className="inline-empty">No report exports have been requested yet.</p>
        ) : null}
      </div>
    </>
  );
}
