import type { BillingPeriodLockRecord, InvoiceRecord } from "./billing.js";
import type { LedgerAccount, LedgerReconciliationRecord } from "./ledger.js";
import type {
  ActivityTimelineEntry,
  Matter,
  TaskDeadlineRecord,
  TimeEntry,
  User,
} from "./models.js";

export type StaffReportDefinitionKey =
  | "invoice_aging"
  | "reconciliation_freshness"
  | "productivity"
  | "operational_follow_up";

export type StaffReportCategory = "billing" | "trust" | "operations";

export type StaffReportFilterType = "date" | "duration" | "enum" | "number" | "status";

export type StaffReportGroupingKey =
  | "aging_bucket"
  | "account"
  | "staff_member"
  | "priority"
  | "matter";

export type StaffReportExportProfileId = "summary_json" | "review_csv";

export interface StaffReportFilterDefinition {
  key: string;
  label: string;
  type: StaffReportFilterType;
  defaultValue?: string | number | boolean;
  options?: string[];
}

export interface StaffReportGroupingDefinition {
  key: StaffReportGroupingKey;
  label: string;
  description: string;
}

export interface StaffReportExportProfile {
  id: StaffReportExportProfileId;
  label: string;
  format: "json" | "csv";
  detailLevel: "summary" | "row_summary";
  manualDownloadOnly: true;
  scheduledEmailDelivery: false;
  includesRawReportBody: false;
}

export type StaffReportScheduleReadinessStatus = "manual_export_ready";

export interface StaffReportScheduleReadiness {
  status: StaffReportScheduleReadinessStatus;
  cadence: "not_scheduled";
  manualExportReady: true;
  scheduledRunReady: false;
  scheduledEmailDelivery: false;
  readinessReasons: string[];
  nextRunAt?: string;
}

export interface StaffReportBuilderPosture {
  status: "saved_definition_metadata";
  supportedFilterCount: number;
  supportedGroupingCount: number;
  exportProfileCount: number;
  customSql: false;
  biEmbed: false;
  broadReportExecution: false;
  mutableDefinitionBuilder: false;
  storesRawReportBodies: false;
}

export interface StaffSavedReportDefinition {
  key: StaffReportDefinitionKey;
  name: string;
  description: string;
  category: StaffReportCategory;
  defaultGrouping: StaffReportGroupingKey;
  filters: StaffReportFilterDefinition[];
  groupings: StaffReportGroupingDefinition[];
  exportProfileIds: StaffReportExportProfileId[];
  permissionScope: Array<"report:read" | "report:export">;
  source: "open_practice_builtin";
  savedAt: string;
  updatedAt: string;
  scheduleReadiness: StaffReportScheduleReadiness;
  builderPosture: StaffReportBuilderPosture;
}

export interface StaffReportProjectionGroup {
  key: string;
  label: string;
  rowCount: number;
  totalCents?: number;
  totalMinutes?: number;
  riskCount?: number;
}

export interface StaffReportProjectionSummary {
  totalRows: number;
  metrics: Record<string, string | number | boolean>;
  groups: StaffReportProjectionGroup[];
}

export interface StaffReportProjectionRow {
  id: string;
  label: string;
  groupKey: string;
  groupLabel: string;
  status: string;
  tone: "neutral" | "ready" | "risk";
  matterId?: string;
  matterNumber?: string;
  userId?: string;
  dueAt?: string;
  occurredAt?: string;
  metricCents?: number;
  metricMinutes?: number;
  metricCount?: number;
  metadata: Record<string, string | number | boolean | undefined>;
}

export interface StaffReportProjection {
  definitionKey: StaffReportDefinitionKey;
  generatedAt: string;
  groupingKey: StaffReportGroupingKey;
  filters: Record<string, string | number | boolean>;
  rowCount: number;
  summary: StaffReportProjectionSummary;
  rows: StaffReportProjectionRow[];
  projectionPolicy: {
    customSql: false;
    biEmbed: false;
    rawBodiesStoredInJobMetadata: false;
    scheduledEmailDelivery: false;
  };
}

export interface StaffReportHistoryItem {
  id: string;
  jobId: string;
  status: string;
  reportDefinitionKey?: StaffReportDefinitionKey;
  exportProfileId?: StaffReportExportProfileId;
  groupingKey?: StaffReportGroupingKey;
  queuedAt?: string;
  finishedAt?: string;
  failedAt?: string;
  rowCount?: number;
  pollUrl: string;
  downloadUrl: string;
}

export interface StaffReportScheduleReadinessSummary {
  totalDefinitions: number;
  manualExportReadyDefinitions: number;
  manualOnlyDefinitionKeys: StaffReportDefinitionKey[];
  recentExportRequestCount: number;
  scheduledDefinitionCount: number;
  automaticExecution: false;
  scheduledEmailDeliveryEnabled: false;
  rawReportBodyStorage: false;
  nextScheduledRunAt?: string;
}

export interface StaffReportBuilderWorkspacePosture {
  status: "metadata_only";
  savedDefinitionsOnly: true;
  filterCount: number;
  groupingCount: number;
  exportProfileCount: number;
  customSql: false;
  biEmbeds: false;
  broadReportExecution: false;
  mutableDefinitionBuilder: false;
  rawReportBodyStorage: false;
}

export interface StaffReportExportJobPosture {
  queueName: "reports";
  jobName: "staff_report_export";
  historyCount: number;
  boundedMetadataOnly: true;
  storesReportBodiesInJobMetadata: false;
  downloadsRegenerateProjection: true;
  scheduledDeliveryJobs: false;
}

export interface StaffReportingWorkspace {
  generatedAt: string;
  definitions: StaffSavedReportDefinition[];
  exportProfiles: StaffReportExportProfile[];
  reports: StaffReportProjection[];
  history: StaffReportHistoryItem[];
  scheduleReadinessSummary: StaffReportScheduleReadinessSummary;
  reportBuilderPosture: StaffReportBuilderWorkspacePosture;
  exportJobPosture: StaffReportExportJobPosture;
  workspacePolicy: {
    customSql: false;
    biEmbeds: false;
    scheduledEmailDelivery: false;
    rawReportBodiesInJobMetadata: false;
  };
}

export interface StaffReportMatterInput extends Pick<
  Matter,
  "id" | "firmId" | "number" | "title" | "status" | "responsibleUserId" | "openedOn"
> {
  activity?: ActivityTimelineEntry[];
}

export interface BuildStaffReportProjectionInput {
  firmId: string;
  generatedAt?: string;
  definitionKey: StaffReportDefinitionKey;
  groupingKey?: StaffReportGroupingKey;
  matters: StaffReportMatterInput[];
  users: User[];
  invoices: InvoiceRecord[];
  ledgerAccounts: LedgerAccount[];
  reconciliations: LedgerReconciliationRecord[];
  billingPeriodLocks?: BillingPeriodLockRecord[];
  timeEntries: TimeEntry[];
  taskDeadlines: TaskDeadlineRecord[];
}

export interface BuildStaffReportingWorkspaceInput extends Omit<
  BuildStaffReportProjectionInput,
  "definitionKey" | "groupingKey"
> {
  history?: StaffReportHistoryItem[];
}

const savedDefinitionTimestamp = "2026-05-28T00:00:00.000Z";
const dayMs = 86_400_000;

type StaffSavedReportDefinitionInput = Omit<
  StaffSavedReportDefinition,
  "builderPosture" | "scheduleReadiness"
>;

export const STAFF_REPORT_EXPORT_PROFILES: StaffReportExportProfile[] = [
  {
    id: "summary_json",
    label: "Summary JSON",
    format: "json",
    detailLevel: "summary",
    manualDownloadOnly: true,
    scheduledEmailDelivery: false,
    includesRawReportBody: false,
  },
  {
    id: "review_csv",
    label: "Review CSV profile",
    format: "csv",
    detailLevel: "row_summary",
    manualDownloadOnly: true,
    scheduledEmailDelivery: false,
    includesRawReportBody: false,
  },
];

function staffReportScheduleReadiness(): StaffReportScheduleReadiness {
  return {
    status: "manual_export_ready",
    cadence: "not_scheduled",
    manualExportReady: true,
    scheduledRunReady: false,
    scheduledEmailDelivery: false,
    readinessReasons: [
      "saved_definition_available",
      "manual_export_profile_available",
      "scheduled_delivery_not_enabled",
    ],
  };
}

function staffReportBuilderPosture(
  definition: StaffSavedReportDefinitionInput,
): StaffReportBuilderPosture {
  return {
    status: "saved_definition_metadata",
    supportedFilterCount: definition.filters.length,
    supportedGroupingCount: definition.groupings.length,
    exportProfileCount: definition.exportProfileIds.length,
    customSql: false,
    biEmbed: false,
    broadReportExecution: false,
    mutableDefinitionBuilder: false,
    storesRawReportBodies: false,
  };
}

function withStaffReportPosture(
  definition: StaffSavedReportDefinitionInput,
): StaffSavedReportDefinition {
  return {
    ...definition,
    scheduleReadiness: staffReportScheduleReadiness(),
    builderPosture: staffReportBuilderPosture(definition),
  };
}

const STAFF_SAVED_REPORT_DEFINITION_INPUTS: StaffSavedReportDefinitionInput[] = [
  {
    key: "invoice_aging",
    name: "Invoice aging",
    description: "Issued and partially paid invoice balances grouped by due-date age.",
    category: "billing",
    defaultGrouping: "aging_bucket",
    filters: [
      { key: "asOf", label: "As of", type: "date", defaultValue: "generatedAt" },
      {
        key: "invoiceStatuses",
        label: "Invoice statuses",
        type: "status",
        options: ["issued", "partially_paid"],
      },
    ],
    groupings: [
      {
        key: "aging_bucket",
        label: "Aging bucket",
        description: "Current, 1-30, 31-60, and 61+ days past due.",
      },
      { key: "matter", label: "Matter", description: "Group balances by matter number." },
    ],
    exportProfileIds: ["summary_json", "review_csv"],
    permissionScope: ["report:read", "report:export"],
    source: "open_practice_builtin",
    savedAt: savedDefinitionTimestamp,
    updatedAt: savedDefinitionTimestamp,
  },
  {
    key: "reconciliation_freshness",
    name: "Reconciliation freshness",
    description: "Trust asset account reconciliation recency and exception posture.",
    category: "trust",
    defaultGrouping: "account",
    filters: [
      { key: "freshWithinDays", label: "Fresh within days", type: "number", defaultValue: 30 },
      {
        key: "accountTypes",
        label: "Account types",
        type: "enum",
        options: ["trust_asset"],
      },
    ],
    groupings: [
      { key: "account", label: "Account", description: "Group by trust asset account." },
      { key: "priority", label: "Priority", description: "Group by freshness risk." },
    ],
    exportProfileIds: ["summary_json", "review_csv"],
    permissionScope: ["report:read", "report:export"],
    source: "open_practice_builtin",
    savedAt: savedDefinitionTimestamp,
    updatedAt: savedDefinitionTimestamp,
  },
  {
    key: "productivity",
    name: "Productivity",
    description: "Staff billable time and task throughput from existing records.",
    category: "operations",
    defaultGrouping: "staff_member",
    filters: [
      { key: "period", label: "Period", type: "duration", defaultValue: "all_loaded_records" },
      {
        key: "timeEntryStatuses",
        label: "Time entry statuses",
        type: "status",
        options: ["draft", "submitted", "approved", "billed", "written_off"],
      },
    ],
    groupings: [
      { key: "staff_member", label: "Staff member", description: "Group by assigned user." },
      { key: "matter", label: "Matter", description: "Group by matter for time entries." },
    ],
    exportProfileIds: ["summary_json", "review_csv"],
    permissionScope: ["report:read", "report:export"],
    source: "open_practice_builtin",
    savedAt: savedDefinitionTimestamp,
    updatedAt: savedDefinitionTimestamp,
  },
  {
    key: "operational_follow_up",
    name: "Operational follow-up",
    description: "Open task deadlines and stale matter follow-up cues.",
    category: "operations",
    defaultGrouping: "priority",
    filters: [
      { key: "overdueAsOf", label: "Overdue as of", type: "date", defaultValue: "generatedAt" },
      { key: "staleAfterDays", label: "Stale after days", type: "number", defaultValue: 30 },
    ],
    groupings: [
      { key: "priority", label: "Priority", description: "High, medium, and low urgency." },
      { key: "matter", label: "Matter", description: "Group follow-up by matter." },
    ],
    exportProfileIds: ["summary_json", "review_csv"],
    permissionScope: ["report:read", "report:export"],
    source: "open_practice_builtin",
    savedAt: savedDefinitionTimestamp,
    updatedAt: savedDefinitionTimestamp,
  },
];

export const STAFF_SAVED_REPORT_DEFINITIONS: StaffSavedReportDefinition[] =
  STAFF_SAVED_REPORT_DEFINITION_INPUTS.map(withStaffReportPosture);

export function getStaffSavedReportDefinition(
  key: StaffReportDefinitionKey,
): StaffSavedReportDefinition {
  const definition = STAFF_SAVED_REPORT_DEFINITIONS.find((candidate) => candidate.key === key);
  if (!definition) throw new Error(`Unknown staff report definition: ${key}`);
  return definition;
}

export function isStaffReportDefinitionKey(value: string): value is StaffReportDefinitionKey {
  return STAFF_SAVED_REPORT_DEFINITIONS.some((definition) => definition.key === value);
}

export function isStaffReportExportProfileId(value: string): value is StaffReportExportProfileId {
  return STAFF_REPORT_EXPORT_PROFILES.some((profile) => profile.id === value);
}

export function isStaffReportGroupingKey(value: string): value is StaffReportGroupingKey {
  return ["aging_bucket", "account", "staff_member", "priority", "matter"].includes(value);
}

function parseTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.includes("T") ? value : `${value}T00:00:00.000Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function daysBetween(laterMs: number, earlierMs: number | undefined): number | undefined {
  if (earlierMs === undefined) return undefined;
  return Math.floor((laterMs - earlierMs) / dayMs);
}

function matterById(matters: StaffReportMatterInput[]): Map<string, StaffReportMatterInput> {
  return new Map(matters.map((matter) => [matter.id, matter]));
}

function userById(users: User[]): Map<string, User> {
  return new Map(users.map((user) => [user.id, user]));
}

function matterLabel(matter: StaffReportMatterInput | undefined, matterId: string): string {
  if (!matter) return matterId;
  return `${matter.number} ${matter.title}`;
}

function userLabel(user: User | undefined, userId: string | undefined): string {
  return user?.displayName ?? userId ?? "Unassigned";
}

function groupRows(rows: StaffReportProjectionRow[]): StaffReportProjectionGroup[] {
  const groups = new Map<string, StaffReportProjectionGroup>();
  for (const row of rows) {
    const existing =
      groups.get(row.groupKey) ??
      ({
        key: row.groupKey,
        label: row.groupLabel,
        rowCount: 0,
        totalCents: 0,
        totalMinutes: 0,
        riskCount: 0,
      } satisfies StaffReportProjectionGroup);
    existing.rowCount += 1;
    existing.totalCents = (existing.totalCents ?? 0) + (row.metricCents ?? 0);
    existing.totalMinutes = (existing.totalMinutes ?? 0) + (row.metricMinutes ?? 0);
    existing.riskCount = (existing.riskCount ?? 0) + (row.tone === "risk" ? 1 : 0);
    groups.set(row.groupKey, existing);
  }
  return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function sortRows(left: StaffReportProjectionRow, right: StaffReportProjectionRow): number {
  const toneRank = { risk: 0, neutral: 1, ready: 2 };
  if (toneRank[left.tone] !== toneRank[right.tone])
    return toneRank[left.tone] - toneRank[right.tone];
  const leftDue = parseTime(left.dueAt ?? left.occurredAt) ?? 0;
  const rightDue = parseTime(right.dueAt ?? right.occurredAt) ?? 0;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.label.localeCompare(right.label);
}

function invoiceAgingBucket(
  invoice: Pick<InvoiceRecord, "dueAt">,
  generatedAtMs: number,
): { key: string; label: string; daysPastDue?: number; tone: StaffReportProjectionRow["tone"] } {
  const dueMs = parseTime(invoice.dueAt);
  if (dueMs === undefined) return { key: "undated", label: "Undated", tone: "neutral" };
  const daysPastDue = Math.max(daysBetween(generatedAtMs, dueMs) ?? 0, 0);
  if (daysPastDue <= 0) return { key: "current", label: "Current", daysPastDue, tone: "ready" };
  if (daysPastDue <= 30) return { key: "1_30", label: "1-30 days", daysPastDue, tone: "neutral" };
  if (daysPastDue <= 60) return { key: "31_60", label: "31-60 days", daysPastDue, tone: "risk" };
  return { key: "61_plus", label: "61+ days", daysPastDue, tone: "risk" };
}

function buildInvoiceAgingProjection(
  input: BuildStaffReportProjectionInput,
  generatedAt: string,
  generatedAtMs: number,
  groupingKey: StaffReportGroupingKey,
): StaffReportProjection {
  const matters = matterById(input.matters);
  const rows = input.invoices
    .filter(
      (invoice) =>
        invoice.balanceDueCents > 0 && ["issued", "partially_paid"].includes(invoice.status),
    )
    .map((invoice): StaffReportProjectionRow => {
      const aging = invoiceAgingBucket(invoice, generatedAtMs);
      const matter = matters.get(invoice.matterId);
      const groupKey = groupingKey === "matter" ? invoice.matterId : aging.key;
      return {
        id: invoice.id,
        label: invoice.invoiceNumber,
        groupKey,
        groupLabel: groupingKey === "matter" ? matterLabel(matter, invoice.matterId) : aging.label,
        status: invoice.status,
        tone: aging.tone,
        matterId: invoice.matterId,
        matterNumber: matter?.number,
        dueAt: invoice.dueAt,
        metricCents: invoice.balanceDueCents,
        metadata: {
          balanceDueCents: invoice.balanceDueCents,
          totalCents: invoice.totalCents,
          paidCents: invoice.paidCents,
          daysPastDue: aging.daysPastDue,
        },
      };
    })
    .sort(sortRows);

  const totalBalanceDueCents = rows.reduce((sum, row) => sum + (row.metricCents ?? 0), 0);
  return projection({
    definitionKey: "invoice_aging",
    generatedAt,
    groupingKey,
    filters: {
      asOf: generatedAt,
      invoiceStatuses: "issued,partially_paid",
    },
    rows,
    metrics: {
      totalBalanceDueCents,
      invoiceCount: rows.length,
      pastDueCount: rows.filter((row) => row.groupKey !== "current").length,
    },
  });
}

function reconciliationFreshnessGroup(input: {
  accountId: string;
  latest?: LedgerReconciliationRecord;
  generatedAtMs: number;
}): { key: string; label: string; daysSince?: number; tone: StaffReportProjectionRow["tone"] } {
  const daysSince = daysBetween(input.generatedAtMs, parseTime(input.latest?.statementPeriodEnd));
  if (daysSince === undefined) {
    return { key: "never_reconciled", label: "Never reconciled", tone: "risk" };
  }
  if (daysSince <= 30) return { key: "fresh", label: "Fresh", daysSince, tone: "ready" };
  if (daysSince <= 60) return { key: "watch", label: "Watch", daysSince, tone: "neutral" };
  return { key: "stale", label: "Stale", daysSince, tone: "risk" };
}

function buildReconciliationFreshnessProjection(
  input: BuildStaffReportProjectionInput,
  generatedAt: string,
  generatedAtMs: number,
  groupingKey: StaffReportGroupingKey,
): StaffReportProjection {
  const reconciliationsByAccount = new Map<string, LedgerReconciliationRecord[]>();
  for (const reconciliation of input.reconciliations) {
    const list = reconciliationsByAccount.get(reconciliation.accountId) ?? [];
    list.push(reconciliation);
    reconciliationsByAccount.set(reconciliation.accountId, list);
  }
  const rows = input.ledgerAccounts
    .filter((account) => account.type === "trust_asset")
    .map((account): StaffReportProjectionRow => {
      const latest = (reconciliationsByAccount.get(account.id) ?? []).sort(
        (left, right) =>
          (parseTime(right.statementPeriodEnd) ?? 0) - (parseTime(left.statementPeriodEnd) ?? 0),
      )[0];
      const freshness = reconciliationFreshnessGroup({
        accountId: account.id,
        latest,
        generatedAtMs,
      });
      const exceptionCount = (reconciliationsByAccount.get(account.id) ?? []).filter(
        (reconciliation) => reconciliation.status === "exception",
      ).length;
      const groupKey = groupingKey === "priority" ? freshness.key : account.id;
      return {
        id: account.id,
        label: account.name,
        groupKey,
        groupLabel: groupingKey === "priority" ? freshness.label : account.name,
        status: latest?.status ?? "not_reconciled",
        tone: exceptionCount > 0 ? "risk" : freshness.tone,
        occurredAt: latest?.statementPeriodEnd,
        metricCount: exceptionCount,
        metadata: {
          latestReconciliationId: latest?.id,
          daysSinceStatementEnd: freshness.daysSince,
          exceptionCount,
          statementRowCount: latest?.statementRows.length ?? 0,
        },
      };
    })
    .sort(sortRows);

  return projection({
    definitionKey: "reconciliation_freshness",
    generatedAt,
    groupingKey,
    filters: { freshWithinDays: 30, accountTypes: "trust_asset" },
    rows,
    metrics: {
      trustAssetAccountCount: rows.length,
      staleOrExceptionCount: rows.filter((row) => row.tone === "risk").length,
      unreconciledCount: rows.filter((row) => row.status === "not_reconciled").length,
    },
  });
}

function buildProductivityProjection(
  input: BuildStaffReportProjectionInput,
  generatedAt: string,
  groupingKey: StaffReportGroupingKey,
): StaffReportProjection {
  const users = userById(input.users);
  const matterMap = matterById(input.matters);
  const staffKeys = new Set<string>([
    ...input.users.map((user) => user.id),
    ...input.timeEntries.map((entry) => entry.userId),
    ...input.taskDeadlines.map((task) => task.assignedToUserId ?? "unassigned"),
  ]);
  const rows = [...staffKeys]
    .map((userId): StaffReportProjectionRow => {
      const staffTime = input.timeEntries.filter((entry) => entry.userId === userId);
      const staffTasks = input.taskDeadlines.filter(
        (task) => (task.assignedToUserId ?? "unassigned") === userId,
      );
      const billableMinutes = staffTime
        .filter((entry) => entry.billable)
        .reduce((sum, entry) => sum + entry.minutes, 0);
      const approvedMinutes = staffTime
        .filter((entry) => entry.billingStatus === "approved" || entry.billingStatus === "billed")
        .reduce((sum, entry) => sum + entry.minutes, 0);
      const openTaskCount = staffTasks.filter((task) => !task.completedAt).length;
      const completedTaskCount = staffTasks.filter((task) => task.completedAt).length;
      const representativeMatter = staffTime[0]?.matterId
        ? matterMap.get(staffTime[0].matterId)
        : undefined;
      const groupKey =
        groupingKey === "matter"
          ? (representativeMatter?.id ?? "unassigned_matter")
          : userId || "unassigned";
      return {
        id: `productivity-${userId}`,
        label: userLabel(users.get(userId), userId),
        groupKey,
        groupLabel:
          groupingKey === "matter"
            ? representativeMatter
              ? matterLabel(representativeMatter, representativeMatter.id)
              : "Unassigned matter"
            : userLabel(users.get(userId), userId),
        status: openTaskCount > 0 ? "active" : "clear",
        tone: openTaskCount > completedTaskCount ? "neutral" : "ready",
        userId: userId === "unassigned" ? undefined : userId,
        matterId: representativeMatter?.id,
        matterNumber: representativeMatter?.number,
        metricMinutes: billableMinutes,
        metricCount: completedTaskCount,
        metadata: {
          billableMinutes,
          approvedMinutes,
          timeEntryCount: staffTime.length,
          openTaskCount,
          completedTaskCount,
        },
      };
    })
    .filter((row) => row.metricMinutes || row.metricCount || row.metadata.openTaskCount)
    .sort(sortRows);

  return projection({
    definitionKey: "productivity",
    generatedAt,
    groupingKey,
    filters: {
      period: "all_loaded_records",
      timeEntryStatuses: "draft,submitted,approved,billed,written_off",
    },
    rows,
    metrics: {
      staffCount: rows.length,
      billableMinutes: rows.reduce((sum, row) => sum + (row.metricMinutes ?? 0), 0),
      completedTaskCount: rows.reduce((sum, row) => sum + (row.metricCount ?? 0), 0),
    },
  });
}

function latestMatterActivityAt(matter: StaffReportMatterInput): string | undefined {
  const activityTimes = (matter.activity ?? []).map((entry) => parseTime(entry.occurredAt) ?? 0);
  const latest = Math.max(...activityTimes, parseTime(matter.openedOn) ?? 0);
  return latest > 0 ? new Date(latest).toISOString() : undefined;
}

function buildOperationalFollowUpProjection(
  input: BuildStaffReportProjectionInput,
  generatedAt: string,
  generatedAtMs: number,
  groupingKey: StaffReportGroupingKey,
): StaffReportProjection {
  const matters = matterById(input.matters);
  const taskRows = input.taskDeadlines
    .filter((task) => !task.completedAt)
    .map((task): StaffReportProjectionRow => {
      const dueMs = parseTime(task.dueAt);
      const overdue = dueMs !== undefined && dueMs < generatedAtMs;
      const matter = matters.get(task.matterId);
      const priorityKey = overdue ? "high" : dueMs ? "medium" : "low";
      const groupKey = groupingKey === "matter" ? task.matterId : priorityKey;
      return {
        id: task.id,
        label: task.title,
        groupKey,
        groupLabel: groupingKey === "matter" ? matterLabel(matter, task.matterId) : priorityKey,
        status: overdue ? "overdue" : dueMs ? "upcoming" : "unscheduled",
        tone: overdue ? "risk" : "neutral",
        matterId: task.matterId,
        matterNumber: matter?.number,
        userId: task.assignedToUserId,
        dueAt: task.dueAt,
        metricCount: 1,
        metadata: {
          assignedToUserId: task.assignedToUserId,
          daysPastDue: overdue ? daysBetween(generatedAtMs, dueMs) : undefined,
        },
      };
    });
  const staleMatterRows = input.matters
    .filter((matter) => matter.status === "open" || matter.status === "intake")
    .map((matter): StaffReportProjectionRow | undefined => {
      const latest = latestMatterActivityAt(matter);
      const inactiveDays = daysBetween(generatedAtMs, parseTime(latest));
      if (inactiveDays !== undefined && inactiveDays < 30) return undefined;
      const priorityKey = matter.status === "intake" ? "medium" : "low";
      return {
        id: `stale-${matter.id}`,
        label: matter.title,
        groupKey: groupingKey === "matter" ? matter.id : priorityKey,
        groupLabel: groupingKey === "matter" ? matterLabel(matter, matter.id) : priorityKey,
        status: "stale_matter",
        tone: matter.status === "intake" ? "neutral" : "ready",
        matterId: matter.id,
        matterNumber: matter.number,
        userId: matter.responsibleUserId,
        occurredAt: latest,
        metricCount: 1,
        metadata: {
          inactiveDays,
          matterStatus: matter.status,
          responsibleUserId: matter.responsibleUserId,
        },
      };
    })
    .filter((row): row is StaffReportProjectionRow => Boolean(row));
  const rows = [...taskRows, ...staleMatterRows].sort(sortRows);

  return projection({
    definitionKey: "operational_follow_up",
    generatedAt,
    groupingKey,
    filters: {
      overdueAsOf: generatedAt,
      staleAfterDays: 30,
    },
    rows,
    metrics: {
      openFollowUpCount: rows.length,
      overdueTaskCount: rows.filter((row) => row.status === "overdue").length,
      staleMatterCount: rows.filter((row) => row.status === "stale_matter").length,
    },
  });
}

function projection(input: {
  definitionKey: StaffReportDefinitionKey;
  generatedAt: string;
  groupingKey: StaffReportGroupingKey;
  filters: Record<string, string | number | boolean>;
  rows: StaffReportProjectionRow[];
  metrics: Record<string, string | number | boolean>;
}): StaffReportProjection {
  return {
    definitionKey: input.definitionKey,
    generatedAt: input.generatedAt,
    groupingKey: input.groupingKey,
    filters: input.filters,
    rowCount: input.rows.length,
    summary: {
      totalRows: input.rows.length,
      metrics: input.metrics,
      groups: groupRows(input.rows),
    },
    rows: input.rows,
    projectionPolicy: {
      customSql: false,
      biEmbed: false,
      rawBodiesStoredInJobMetadata: false,
      scheduledEmailDelivery: false,
    },
  };
}

export function buildStaffReportProjection(
  input: BuildStaffReportProjectionInput,
): StaffReportProjection {
  const definition = getStaffSavedReportDefinition(input.definitionKey);
  const groupingKey = input.groupingKey ?? definition.defaultGrouping;
  if (!definition.groupings.some((grouping) => grouping.key === groupingKey)) {
    throw new Error(`Unsupported grouping ${groupingKey} for report ${definition.key}`);
  }
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatedAtMs = parseTime(generatedAt) ?? Date.now();

  if (input.definitionKey === "invoice_aging") {
    return buildInvoiceAgingProjection(input, generatedAt, generatedAtMs, groupingKey);
  }
  if (input.definitionKey === "reconciliation_freshness") {
    return buildReconciliationFreshnessProjection(input, generatedAt, generatedAtMs, groupingKey);
  }
  if (input.definitionKey === "productivity") {
    return buildProductivityProjection(input, generatedAt, groupingKey);
  }
  return buildOperationalFollowUpProjection(input, generatedAt, generatedAtMs, groupingKey);
}

function scheduleReadinessSummary(
  definitions: StaffSavedReportDefinition[],
  history: StaffReportHistoryItem[],
): StaffReportScheduleReadinessSummary {
  return {
    totalDefinitions: definitions.length,
    manualExportReadyDefinitions: definitions.filter(
      (definition) => definition.scheduleReadiness.manualExportReady,
    ).length,
    manualOnlyDefinitionKeys: definitions
      .filter((definition) => !definition.scheduleReadiness.scheduledRunReady)
      .map((definition) => definition.key),
    recentExportRequestCount: history.length,
    scheduledDefinitionCount: definitions.filter(
      (definition) => definition.scheduleReadiness.scheduledRunReady,
    ).length,
    automaticExecution: false,
    scheduledEmailDeliveryEnabled: false,
    rawReportBodyStorage: false,
  };
}

function reportBuilderWorkspacePosture(
  definitions: StaffSavedReportDefinition[],
): StaffReportBuilderWorkspacePosture {
  return {
    status: "metadata_only",
    savedDefinitionsOnly: true,
    filterCount: definitions.reduce(
      (sum, definition) => sum + definition.builderPosture.supportedFilterCount,
      0,
    ),
    groupingCount: definitions.reduce(
      (sum, definition) => sum + definition.builderPosture.supportedGroupingCount,
      0,
    ),
    exportProfileCount: STAFF_REPORT_EXPORT_PROFILES.length,
    customSql: false,
    biEmbeds: false,
    broadReportExecution: false,
    mutableDefinitionBuilder: false,
    rawReportBodyStorage: false,
  };
}

function exportJobPosture(history: StaffReportHistoryItem[]): StaffReportExportJobPosture {
  return {
    queueName: "reports",
    jobName: "staff_report_export",
    historyCount: history.length,
    boundedMetadataOnly: true,
    storesReportBodiesInJobMetadata: false,
    downloadsRegenerateProjection: true,
    scheduledDeliveryJobs: false,
  };
}

export function buildStaffReportingWorkspace(
  input: BuildStaffReportingWorkspaceInput,
): StaffReportingWorkspace {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const definitions = STAFF_SAVED_REPORT_DEFINITIONS;
  const history = input.history ?? [];
  return {
    generatedAt,
    definitions,
    exportProfiles: STAFF_REPORT_EXPORT_PROFILES,
    reports: definitions.map((definition) =>
      buildStaffReportProjection({
        ...input,
        generatedAt,
        definitionKey: definition.key,
        groupingKey: definition.defaultGrouping,
      }),
    ),
    history,
    scheduleReadinessSummary: scheduleReadinessSummary(definitions, history),
    reportBuilderPosture: reportBuilderWorkspacePosture(definitions),
    exportJobPosture: exportJobPosture(history),
    workspacePolicy: {
      customSql: false,
      biEmbeds: false,
      scheduledEmailDelivery: false,
      rawReportBodiesInJobMetadata: false,
    },
  };
}
