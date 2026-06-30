import {
  billingDateFallsInsideLock,
  type BillingPeriodLockRecord,
  type InvoiceLineRecord,
  type InvoiceRecord,
} from "./billing.js";
import {
  financialExportFieldProfiles,
  type FinancialExportFieldProfileId,
} from "./financial-export-profiles.js";
import type { LegalClinicMatterProfile } from "./legal-clinics.js";
import type { LedgerAccount, LedgerEntry, LedgerReconciliationRecord } from "./ledger.js";
import type {
  ActivityTimelineEntry,
  Contact,
  ExpenseEntry,
  Matter,
  Province,
  TaskDeadlineRecord,
  TimeEntry,
  User,
} from "./models.js";

export type StaffReportDefinitionKey =
  | "invoice_aging"
  | "aged_receivables"
  | "billing_period_lock_impact"
  | "reconciliation_freshness"
  | "productivity"
  | "operational_follow_up";

export type StaffReportCategory = "billing" | "trust" | "operations";

export type StaffReportFilterType = "date" | "duration" | "enum" | "number" | "status";

export type StaffReportGroupingKey =
  | "aging_bucket"
  | "account"
  | "client"
  | "staff_member"
  | "priority"
  | "invoice"
  | "lock"
  | "matter"
  | "source_type"
  | "status"
  | "jurisdiction"
  | "practiceArea"
  | "clinicProgramId"
  | "restrictedFundReviewStatus";

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

export interface StaffReportExportProfileAlignmentStaffProfile {
  id: StaffReportExportProfileId;
  label: string;
  format: StaffReportExportProfile["format"];
  detailLevel: StaffReportExportProfile["detailLevel"];
  manualDownloadOnly: true;
  scheduledEmailDelivery: false;
  includesRawReportBody: false;
}

export interface StaffReportExportProfileAlignmentFinancialProfile {
  id: FinancialExportFieldProfileId;
  label: string;
  format: "json";
  source: "generated_local_projection";
  fieldKeyCount: number;
  sampleFieldKeys: readonly string[];
  manualDownloadOnly: true;
  scheduledDelivery: false;
  storesRawExportBody: false;
}

export interface StaffReportExportProfileAlignmentDifference {
  key:
    | "purpose"
    | "scope"
    | "field_key_behavior"
    | "format_coverage"
    | "queue_job_metadata"
    | "download_body_behavior";
  label: string;
  staffReporting: string;
  financialFieldProfiles: string;
}

export interface StaffReportExportProfileAlignmentSafeguards {
  customSql: false;
  biEmbeds: false;
  scheduledExecution: false;
  scheduledDelivery: false;
  rawBodyStorage: false;
  paymentProcessorExposure: false;
  paymentCreation: false;
  paymentAllocation: false;
  invoiceMutation: false;
  trustPosting: false;
  certificationClaims: false;
}

export interface StaffReportExportProfileAlignment {
  status: "read_only_metadata_alignment";
  staffReportProfiles: StaffReportExportProfileAlignmentStaffProfile[];
  financialFieldProfiles: StaffReportExportProfileAlignmentFinancialProfile[];
  differences: StaffReportExportProfileAlignmentDifference[];
  sharedSafeguards: StaffReportExportProfileAlignmentSafeguards;
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
  dimensions?: Partial<StaffReportDimensions>;
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
  safeIds?: string[];
  dimensions?: StaffReportDimensions;
  metadata: Record<string, string | number | boolean | undefined>;
}

export interface StaffReportProjection {
  definitionKey: StaffReportDefinitionKey;
  generatedAt: string;
  groupingKey: StaffReportGroupingKey;
  filters: Record<string, string | number | boolean>;
  rowCount: number;
  dimensionFilters: StaffReportDimensionFilters;
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
  exportProfileAlignment: StaffReportExportProfileAlignment;
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

export interface StaffReportDimensions {
  jurisdiction: Province | "multiple";
  practiceArea: string;
  clinicProgramId: string;
  restrictedFundReviewStatus: string;
}

export interface StaffReportDimensionFilters {
  jurisdiction?: Province;
  practiceArea?: string;
  clinicProgramId?: string;
  restrictedFundReviewStatus?: string;
}

export interface StaffReportMatterInput extends Pick<
  Matter,
  | "id"
  | "firmId"
  | "number"
  | "title"
  | "practiceArea"
  | "status"
  | "jurisdiction"
  | "responsibleUserId"
  | "openedOn"
> {
  activity?: ActivityTimelineEntry[];
}

export interface StaffReportInvoiceInput extends InvoiceRecord {
  lines?: Array<Pick<InvoiceLineRecord, "timeEntryId" | "expenseEntryId">>;
}

export interface BuildStaffReportProjectionInput {
  firmId: string;
  generatedAt?: string;
  definitionKey: StaffReportDefinitionKey;
  groupingKey?: StaffReportGroupingKey;
  matters: StaffReportMatterInput[];
  users: User[];
  contacts?: Array<Pick<Contact, "id" | "displayName">>;
  invoices: StaffReportInvoiceInput[];
  ledgerAccounts: LedgerAccount[];
  ledgerEntries?: LedgerEntry[];
  reconciliations: LedgerReconciliationRecord[];
  legalClinicMatterProfiles?: Array<
    Pick<LegalClinicMatterProfile, "matterId" | "programId" | "metadata">
  >;
  dimensionFilters?: StaffReportDimensionFilters;
  billingPeriodLocks?: BillingPeriodLockRecord[];
  expenseEntries?: ExpenseEntry[];
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
const financialFieldProfileSampleSize = 6;
const staffReportDimensionGroupingKeys = [
  "jurisdiction",
  "practiceArea",
  "clinicProgramId",
  "restrictedFundReviewStatus",
] as const satisfies readonly StaffReportGroupingKey[];

const STAFF_REPORT_DIMENSION_FILTERS: StaffReportFilterDefinition[] = [
  {
    key: "jurisdiction",
    label: "Jurisdiction",
    type: "enum",
    options: ["BC", "ON", "CANADA", "OTHER"],
  },
  { key: "practiceArea", label: "Practice area", type: "enum" },
  { key: "clinicProgramId", label: "Clinic program", type: "enum" },
  {
    key: "restrictedFundReviewStatus",
    label: "Restricted fund review",
    type: "enum",
  },
];

const STAFF_REPORT_DIMENSION_GROUPINGS: StaffReportGroupingDefinition[] = [
  {
    key: "jurisdiction",
    label: "Jurisdiction",
    description: "Group rows by matter jurisdiction derived from existing matter records.",
  },
  {
    key: "practiceArea",
    label: "Practice area",
    description: "Group rows by matter practice area without adding ledger dimension tables.",
  },
  {
    key: "clinicProgramId",
    label: "Clinic program",
    description: "Group rows by the existing legal-clinic matter profile program ID.",
  },
  {
    key: "restrictedFundReviewStatus",
    label: "Restricted fund review",
    description: "Group rows by staff-reviewed restricted-fund metadata on clinic profiles.",
  },
];

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
      ...STAFF_REPORT_DIMENSION_FILTERS,
    ],
    groupings: [
      {
        key: "aging_bucket",
        label: "Aging bucket",
        description: "Current, 1-30, 31-60, and 61+ days past due.",
      },
      { key: "matter", label: "Matter", description: "Group balances by matter number." },
      ...STAFF_REPORT_DIMENSION_GROUPINGS,
    ],
    exportProfileIds: ["summary_json", "review_csv"],
    permissionScope: ["report:read", "report:export"],
    source: "open_practice_builtin",
    savedAt: savedDefinitionTimestamp,
    updatedAt: savedDefinitionTimestamp,
  },
  {
    key: "aged_receivables",
    name: "Aged receivables",
    description:
      "Read-only issued receivable balances grouped by client, matter, invoice, and aging bucket.",
    category: "billing",
    defaultGrouping: "client",
    filters: [
      { key: "asOf", label: "As of", type: "date", defaultValue: "generatedAt" },
      {
        key: "invoiceStatuses",
        label: "Invoice statuses",
        type: "status",
        options: ["issued", "partially_paid"],
      },
      ...STAFF_REPORT_DIMENSION_FILTERS,
    ],
    groupings: [
      {
        key: "client",
        label: "Client",
        description: "Group receivable balances by visible client display name.",
      },
      { key: "matter", label: "Matter", description: "Group receivable balances by matter." },
      { key: "invoice", label: "Invoice", description: "Group each receivable by invoice number." },
      {
        key: "aging_bucket",
        label: "Aging bucket",
        description: "Current, 1-30, 31-60, 61-90, and 91+ days past due.",
      },
      ...STAFF_REPORT_DIMENSION_GROUPINGS,
    ],
    exportProfileIds: ["summary_json", "review_csv"],
    permissionScope: ["report:read", "report:export"],
    source: "open_practice_builtin",
    savedAt: savedDefinitionTimestamp,
    updatedAt: savedDefinitionTimestamp,
  },
  {
    key: "billing_period_lock_impact",
    name: "Billing period lock impact",
    description:
      "Read-only affected counts and safe source IDs across visible locked billing records.",
    category: "billing",
    defaultGrouping: "lock",
    filters: [
      { key: "asOf", label: "As of", type: "date", defaultValue: "generatedAt" },
      {
        key: "sourceTypes",
        label: "Source types",
        type: "enum",
        options: ["time_entry", "expense_entry", "invoice"],
      },
      {
        key: "recordStatuses",
        label: "Record statuses",
        type: "status",
        options: [
          "draft",
          "submitted",
          "approved",
          "billed",
          "written_off",
          "issued",
          "partially_paid",
          "paid",
          "void",
        ],
      },
      ...STAFF_REPORT_DIMENSION_FILTERS,
    ],
    groupings: [
      { key: "lock", label: "Lock", description: "Group impacted rows by billing period lock." },
      { key: "status", label: "Status", description: "Group impacted rows by source status." },
      { key: "matter", label: "Matter", description: "Group impacted rows by visible matter." },
      {
        key: "source_type",
        label: "Source type",
        description: "Group impacted rows by time, expense, or invoice source type.",
      },
      ...STAFF_REPORT_DIMENSION_GROUPINGS,
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
      ...STAFF_REPORT_DIMENSION_FILTERS,
    ],
    groupings: [
      { key: "account", label: "Account", description: "Group by trust asset account." },
      { key: "priority", label: "Priority", description: "Group by freshness risk." },
      ...STAFF_REPORT_DIMENSION_GROUPINGS,
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
      ...STAFF_REPORT_DIMENSION_FILTERS,
    ],
    groupings: [
      { key: "staff_member", label: "Staff member", description: "Group by assigned user." },
      { key: "matter", label: "Matter", description: "Group by matter for time entries." },
      ...STAFF_REPORT_DIMENSION_GROUPINGS,
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
      ...STAFF_REPORT_DIMENSION_FILTERS,
    ],
    groupings: [
      { key: "priority", label: "Priority", description: "High, medium, and low urgency." },
      { key: "matter", label: "Matter", description: "Group follow-up by matter." },
      ...STAFF_REPORT_DIMENSION_GROUPINGS,
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
  return [
    "aging_bucket",
    "account",
    "client",
    "staff_member",
    "priority",
    "invoice",
    "lock",
    "matter",
    "source_type",
    "status",
    "jurisdiction",
    "practiceArea",
    "clinicProgramId",
    "restrictedFundReviewStatus",
  ].includes(value);
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

function contactById(
  contacts: BuildStaffReportProjectionInput["contacts"] = [],
): Map<string, Pick<Contact, "id" | "displayName">> {
  return new Map(contacts.map((contact) => [contact.id, contact]));
}

function matterLabel(matter: StaffReportMatterInput | undefined, matterId: string): string {
  if (!matter) return matterId;
  return `${matter.number} ${matter.title}`;
}

function clientDisplayLabel(
  contacts: Map<string, Pick<Contact, "id" | "displayName">>,
  clientContactId: string | undefined,
): string {
  if (!clientContactId) return "Client unavailable";
  return contacts.get(clientContactId)?.displayName ?? "Client unavailable";
}

function userLabel(user: User | undefined, userId: string | undefined): string {
  return user?.displayName ?? userId ?? "Unassigned";
}

function legalClinicProfileByMatterId(
  profiles: BuildStaffReportProjectionInput["legalClinicMatterProfiles"] = [],
): Map<string, Pick<LegalClinicMatterProfile, "matterId" | "programId" | "metadata">> {
  return new Map(profiles.map((profile) => [profile.matterId, profile]));
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function restrictedFundReviewStatus(
  profile: Pick<LegalClinicMatterProfile, "metadata"> | undefined,
): string {
  const metadata = profile?.metadata;
  const restrictedFund =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).restrictedFund
      : undefined;
  if (!restrictedFund || typeof restrictedFund !== "object" || Array.isArray(restrictedFund)) {
    return "not_reviewed";
  }
  return stringMetadata((restrictedFund as Record<string, unknown>).reviewStatus) ?? "not_reviewed";
}

function dimensionsForMatter(
  matter: StaffReportMatterInput | undefined,
  profile: Pick<LegalClinicMatterProfile, "programId" | "metadata"> | undefined,
): StaffReportDimensions {
  return {
    jurisdiction: matter?.jurisdiction ?? "OTHER",
    practiceArea: matter?.practiceArea?.trim() || "Unspecified",
    clinicProgramId: profile?.programId ?? "none",
    restrictedFundReviewStatus: restrictedFundReviewStatus(profile),
  };
}

function dimensionValue(
  dimensions: StaffReportDimensions,
  groupingKey: StaffReportGroupingKey,
): string | undefined {
  return staffReportDimensionGroupingKeys.includes(
    groupingKey as (typeof staffReportDimensionGroupingKeys)[number],
  )
    ? String(dimensions[groupingKey as keyof StaffReportDimensions])
    : undefined;
}

function dimensionLabel(groupingKey: StaffReportGroupingKey, value: string): string {
  if (groupingKey === "clinicProgramId" && value === "none") return "No clinic program";
  if (groupingKey === "restrictedFundReviewStatus" && value === "not_reviewed") {
    return "Not reviewed";
  }
  if (value === "multiple") return "Multiple";
  return value;
}

function dimensionGroup(
  groupingKey: StaffReportGroupingKey,
  dimensions: StaffReportDimensions,
): { key: string; label: string } | undefined {
  const value = dimensionValue(dimensions, groupingKey);
  return value ? { key: value, label: dimensionLabel(groupingKey, value) } : undefined;
}

function dimensionsMatchFilters(
  dimensions: StaffReportDimensions,
  filters: StaffReportDimensionFilters | undefined,
): boolean {
  return (
    (!filters?.jurisdiction || dimensions.jurisdiction === filters.jurisdiction) &&
    (!filters?.practiceArea || dimensions.practiceArea === filters.practiceArea) &&
    (!filters?.clinicProgramId || dimensions.clinicProgramId === filters.clinicProgramId) &&
    (!filters?.restrictedFundReviewStatus ||
      dimensions.restrictedFundReviewStatus === filters.restrictedFundReviewStatus)
  );
}

function compactDimensionFilters(
  filters: StaffReportDimensionFilters | undefined,
): StaffReportDimensionFilters {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => typeof value === "string" && value),
  ) as StaffReportDimensionFilters;
}

function dimensionMetadata(
  dimensions: StaffReportDimensions,
): Record<string, string | number | boolean | undefined> {
  return {
    jurisdiction: dimensions.jurisdiction,
    practiceArea: dimensions.practiceArea,
    clinicProgramId: dimensions.clinicProgramId,
    restrictedFundReviewStatus: dimensions.restrictedFundReviewStatus,
  };
}

function singleOrMultiple<T extends string>(values: T[], fallback: T): T | "multiple" {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return fallback;
  if (unique.length === 1) return unique[0]!;
  return "multiple";
}

function aggregateDimensions(dimensions: StaffReportDimensions[]): StaffReportDimensions {
  return {
    jurisdiction: singleOrMultiple(
      dimensions
        .map((dimension) => dimension.jurisdiction)
        .filter((jurisdiction): jurisdiction is Province => jurisdiction !== "multiple"),
      "OTHER",
    ),
    practiceArea: singleOrMultiple(
      dimensions.map((dimension) => dimension.practiceArea),
      "Unspecified",
    ),
    clinicProgramId: singleOrMultiple(
      dimensions.map((dimension) => dimension.clinicProgramId),
      "none",
    ),
    restrictedFundReviewStatus: singleOrMultiple(
      dimensions.map((dimension) => dimension.restrictedFundReviewStatus),
      "not_reviewed",
    ),
  };
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
        dimensions: row.dimensions,
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
  if (dueMs === undefined) return { key: "current", label: "Current", tone: "ready" };
  const daysPastDue = Math.max(daysBetween(generatedAtMs, dueMs) ?? 0, 0);
  if (daysPastDue <= 0) return { key: "current", label: "Current", daysPastDue, tone: "ready" };
  if (daysPastDue <= 30) return { key: "1_30", label: "1-30 days", daysPastDue, tone: "neutral" };
  if (daysPastDue <= 60) return { key: "31_60", label: "31-60 days", daysPastDue, tone: "risk" };
  return { key: "61_plus", label: "61+ days", daysPastDue, tone: "risk" };
}

function receivablesAgingBucket(
  invoice: Pick<InvoiceRecord, "dueAt">,
  generatedAtMs: number,
): { key: string; label: string; daysPastDue?: number; tone: StaffReportProjectionRow["tone"] } {
  const dueMs = parseTime(invoice.dueAt);
  if (dueMs === undefined) return { key: "current", label: "Current", tone: "ready" };
  const daysPastDue = Math.max(daysBetween(generatedAtMs, dueMs) ?? 0, 0);
  if (daysPastDue <= 0) return { key: "current", label: "Current", daysPastDue, tone: "ready" };
  if (daysPastDue <= 30) return { key: "1_30", label: "1-30 days", daysPastDue, tone: "neutral" };
  if (daysPastDue <= 60) return { key: "31_60", label: "31-60 days", daysPastDue, tone: "risk" };
  if (daysPastDue <= 90) return { key: "61_90", label: "61-90 days", daysPastDue, tone: "risk" };
  return { key: "91_plus", label: "91+ days", daysPastDue, tone: "risk" };
}

const receivablesBucketMetricKeys = {
  current: "currentCents",
  "1_30": "days1To30Cents",
  "31_60": "days31To60Cents",
  "61_90": "days61To90Cents",
  "91_plus": "days91PlusCents",
} as const;

function receivablesBucketAmounts(bucketKey: string, amountCents: number): Record<string, number> {
  return Object.fromEntries(
    Object.values(receivablesBucketMetricKeys).map((key) => [
      key,
      receivablesBucketMetricKeys[bucketKey as keyof typeof receivablesBucketMetricKeys] === key
        ? amountCents
        : 0,
    ]),
  );
}

type BillingPeriodLockImpactSourceType = "time_entry" | "expense_entry" | "invoice";

interface BillingPeriodLockImpactCandidate {
  lock: BillingPeriodLockRecord;
  sourceType: BillingPeriodLockImpactSourceType;
  status: string;
  matterId: string;
  occurredAt: string;
  safeId: string;
}

function billingPeriodLockLabel(lock: BillingPeriodLockRecord): string {
  return `${lock.periodStart.slice(0, 10)} to ${lock.periodEnd.slice(0, 10)}`;
}

function billingPeriodLockImpactSourceLabel(sourceType: BillingPeriodLockImpactSourceType): string {
  if (sourceType === "time_entry") return "Time entries";
  if (sourceType === "expense_entry") return "Expense entries";
  return "Invoices";
}

function billingPeriodLockImpactStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function lockCandidatesForTimestamp(input: {
  locks: BillingPeriodLockRecord[];
  timestamp: string | undefined;
}): BillingPeriodLockRecord[] {
  if (!input.timestamp) return [];
  return input.locks.filter((lock) => billingDateFallsInsideLock(input.timestamp!, lock));
}

function addBillingPeriodLockImpactCandidate(
  candidates: BillingPeriodLockImpactCandidate[],
  input: {
    locks: BillingPeriodLockRecord[];
    timestamp: string | undefined;
    sourceType: BillingPeriodLockImpactSourceType;
    status: string;
    matterId: string;
    safeId: string;
  },
): void {
  for (const lock of lockCandidatesForTimestamp({
    locks: input.locks,
    timestamp: input.timestamp,
  })) {
    candidates.push({
      lock,
      sourceType: input.sourceType,
      status: input.status,
      matterId: input.matterId,
      occurredAt: input.timestamp!,
      safeId: input.safeId,
    });
  }
}

export function buildBillingPeriodLockImpactProjection(
  input: Omit<BuildStaffReportProjectionInput, "definitionKey"> & {
    definitionKey?: "billing_period_lock_impact";
  },
): StaffReportProjection {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const definition = getStaffSavedReportDefinition("billing_period_lock_impact");
  const groupingKey = input.groupingKey ?? definition.defaultGrouping;
  if (!definition.groupings.some((grouping) => grouping.key === groupingKey)) {
    throw new Error(`Unsupported grouping ${groupingKey} for report ${definition.key}`);
  }

  const locks = input.billingPeriodLocks ?? [];
  const matters = matterById(input.matters);
  const profiles = legalClinicProfileByMatterId(input.legalClinicMatterProfiles);
  const visibleMatterIds = new Set(input.matters.map((matter) => matter.id));
  const visibleTimeEntries = input.timeEntries.filter((entry) =>
    visibleMatterIds.has(entry.matterId),
  );
  const visibleExpenseEntries = (input.expenseEntries ?? []).filter((entry) =>
    visibleMatterIds.has(entry.matterId),
  );
  const visibleInvoices = input.invoices.filter((invoice) =>
    visibleMatterIds.has(invoice.matterId),
  );
  const timeEntryById = new Map(visibleTimeEntries.map((entry) => [entry.id, entry]));
  const expenseEntryById = new Map(visibleExpenseEntries.map((entry) => [entry.id, entry]));
  const candidates: BillingPeriodLockImpactCandidate[] = [];

  for (const entry of visibleTimeEntries) {
    addBillingPeriodLockImpactCandidate(candidates, {
      locks,
      timestamp: entry.performedAt,
      sourceType: "time_entry",
      status: entry.billingStatus,
      matterId: entry.matterId,
      safeId: entry.id,
    });
  }
  for (const entry of visibleExpenseEntries) {
    addBillingPeriodLockImpactCandidate(candidates, {
      locks,
      timestamp: entry.incurredAt,
      sourceType: "expense_entry",
      status: entry.billingStatus,
      matterId: entry.matterId,
      safeId: entry.id,
    });
  }
  for (const invoice of visibleInvoices) {
    for (const timestamp of [
      invoice.createdAt,
      invoice.approvedAt,
      invoice.issuedAt,
      invoice.dueAt,
    ]) {
      addBillingPeriodLockImpactCandidate(candidates, {
        locks,
        timestamp,
        sourceType: "invoice",
        status: invoice.status,
        matterId: invoice.matterId,
        safeId: invoice.id,
      });
    }
    for (const line of invoice.lines ?? []) {
      if (line.timeEntryId) {
        const entry = timeEntryById.get(line.timeEntryId);
        addBillingPeriodLockImpactCandidate(candidates, {
          locks,
          timestamp: entry?.performedAt,
          sourceType: "invoice",
          status: invoice.status,
          matterId: invoice.matterId,
          safeId: invoice.id,
        });
      }
      if (line.expenseEntryId) {
        const entry = expenseEntryById.get(line.expenseEntryId);
        addBillingPeriodLockImpactCandidate(candidates, {
          locks,
          timestamp: entry?.incurredAt,
          sourceType: "invoice",
          status: invoice.status,
          matterId: invoice.matterId,
          safeId: invoice.id,
        });
      }
    }
  }

  const aggregates = new Map<string, BillingPeriodLockImpactCandidate & { safeIds: Set<string> }>();
  for (const candidate of candidates) {
    const matter = matters.get(candidate.matterId);
    const dimensions = dimensionsForMatter(matter, profiles.get(candidate.matterId));
    if (!dimensionsMatchFilters(dimensions, input.dimensionFilters)) continue;
    const key = [
      candidate.lock.id,
      candidate.sourceType,
      candidate.status,
      candidate.matterId,
    ].join(":");
    const existing = aggregates.get(key);
    if (existing) {
      existing.safeIds.add(candidate.safeId);
      if (Date.parse(candidate.occurredAt) < Date.parse(existing.occurredAt)) {
        existing.occurredAt = candidate.occurredAt;
      }
      continue;
    }
    aggregates.set(key, { ...candidate, safeIds: new Set([candidate.safeId]) });
  }

  const rows = [...aggregates.values()]
    .map((aggregate): StaffReportProjectionRow => {
      const matter = matters.get(aggregate.matterId);
      const dimensions = dimensionsForMatter(matter, profiles.get(aggregate.matterId));
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const lockLabel = billingPeriodLockLabel(aggregate.lock);
      const group =
        dimensionGrouping ??
        (groupingKey === "lock"
          ? { key: aggregate.lock.id, label: lockLabel }
          : groupingKey === "status"
            ? {
                key: aggregate.status,
                label: billingPeriodLockImpactStatusLabel(aggregate.status),
              }
            : groupingKey === "matter"
              ? {
                  key: aggregate.matterId,
                  label: matterLabel(matter, aggregate.matterId),
                }
              : {
                  key: aggregate.sourceType,
                  label: billingPeriodLockImpactSourceLabel(aggregate.sourceType),
                });
      const safeIds = [...aggregate.safeIds].sort((left, right) => left.localeCompare(right));
      return {
        id: `${aggregate.lock.id}:${aggregate.sourceType}:${aggregate.status}:${aggregate.matterId}`,
        label: `${lockLabel} ${billingPeriodLockImpactSourceLabel(aggregate.sourceType)}`,
        groupKey: group.key,
        groupLabel: group.label,
        status: aggregate.status,
        tone: "neutral",
        matterId: aggregate.matterId,
        matterNumber: matter?.number,
        occurredAt: aggregate.occurredAt,
        metricCount: safeIds.length,
        safeIds,
        dimensions,
        metadata: {
          lockId: aggregate.lock.id,
          lockPeriodStart: aggregate.lock.periodStart,
          lockPeriodEnd: aggregate.lock.periodEnd,
          sourceType: aggregate.sourceType,
          status: aggregate.status,
          matterId: aggregate.matterId,
          matterNumber: matter?.number,
          safeIdCount: safeIds.length,
          firstSafeId: safeIds[0],
          ...dimensionMetadata(dimensions),
        },
      };
    })
    .sort(sortRows);

  const impactedLockIds = new Set(rows.map((row) => row.metadata.lockId).filter(Boolean));
  const sourceCounts = rows.reduce(
    (counts, row) => {
      const sourceType = row.metadata.sourceType;
      if (sourceType === "time_entry") counts.timeEntryImpactCount += row.metricCount ?? 0;
      if (sourceType === "expense_entry") counts.expenseEntryImpactCount += row.metricCount ?? 0;
      if (sourceType === "invoice") counts.invoiceImpactCount += row.metricCount ?? 0;
      return counts;
    },
    {
      timeEntryImpactCount: 0,
      expenseEntryImpactCount: 0,
      invoiceImpactCount: 0,
    },
  );

  return projection({
    definitionKey: "billing_period_lock_impact",
    generatedAt,
    groupingKey,
    filters: {
      asOf: generatedAt,
      sourceTypes: "time_entry,expense_entry,invoice",
      ...compactDimensionFilters(input.dimensionFilters),
    },
    dimensionFilters: compactDimensionFilters(input.dimensionFilters),
    rows,
    metrics: {
      impactRowCount: rows.length,
      impactedLockCount: impactedLockIds.size,
      impactedMatterCount: new Set(rows.map((row) => row.matterId).filter(Boolean)).size,
      totalSafeIdCount: rows.reduce((sum, row) => sum + (row.metricCount ?? 0), 0),
      ...sourceCounts,
    },
  });
}

function buildInvoiceAgingProjection(
  input: BuildStaffReportProjectionInput,
  generatedAt: string,
  generatedAtMs: number,
  groupingKey: StaffReportGroupingKey,
): StaffReportProjection {
  const matters = matterById(input.matters);
  const profiles = legalClinicProfileByMatterId(input.legalClinicMatterProfiles);
  const rows = input.invoices
    .filter(
      (invoice) =>
        invoice.balanceDueCents > 0 && ["issued", "partially_paid"].includes(invoice.status),
    )
    .map((invoice): StaffReportProjectionRow | undefined => {
      const aging = invoiceAgingBucket(invoice, generatedAtMs);
      const matter = matters.get(invoice.matterId);
      const dimensions = dimensionsForMatter(matter, profiles.get(invoice.matterId));
      if (!dimensionsMatchFilters(dimensions, input.dimensionFilters)) return undefined;
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const groupKey =
        dimensionGrouping?.key ?? (groupingKey === "matter" ? invoice.matterId : aging.key);
      return {
        id: invoice.id,
        label: invoice.invoiceNumber,
        groupKey,
        groupLabel:
          dimensionGrouping?.label ??
          (groupingKey === "matter" ? matterLabel(matter, invoice.matterId) : aging.label),
        status: invoice.status,
        tone: aging.tone,
        matterId: invoice.matterId,
        matterNumber: matter?.number,
        dueAt: invoice.dueAt,
        metricCents: invoice.balanceDueCents,
        dimensions,
        metadata: {
          balanceDueCents: invoice.balanceDueCents,
          totalCents: invoice.totalCents,
          paidCents: invoice.paidCents,
          daysPastDue: aging.daysPastDue,
          ...dimensionMetadata(dimensions),
        },
      };
    })
    .filter((row): row is StaffReportProjectionRow => Boolean(row))
    .sort(sortRows);

  const totalBalanceDueCents = rows.reduce((sum, row) => sum + (row.metricCents ?? 0), 0);
  return projection({
    definitionKey: "invoice_aging",
    generatedAt,
    groupingKey,
    filters: {
      asOf: generatedAt,
      invoiceStatuses: "issued,partially_paid",
      ...compactDimensionFilters(input.dimensionFilters),
    },
    dimensionFilters: compactDimensionFilters(input.dimensionFilters),
    rows,
    metrics: {
      totalBalanceDueCents,
      invoiceCount: rows.length,
      pastDueCount: rows.filter((row) => row.groupKey !== "current").length,
    },
  });
}

function buildAgedReceivablesProjection(
  input: BuildStaffReportProjectionInput,
  generatedAt: string,
  generatedAtMs: number,
  groupingKey: StaffReportGroupingKey,
): StaffReportProjection {
  const matters = matterById(input.matters);
  const contacts = contactById(input.contacts);
  const profiles = legalClinicProfileByMatterId(input.legalClinicMatterProfiles);
  const rows = input.invoices
    .filter(
      (invoice) =>
        invoice.balanceDueCents > 0 && ["issued", "partially_paid"].includes(invoice.status),
    )
    .map((invoice): StaffReportProjectionRow | undefined => {
      const matter = matters.get(invoice.matterId);
      const dimensions = dimensionsForMatter(matter, profiles.get(invoice.matterId));
      if (!dimensionsMatchFilters(dimensions, input.dimensionFilters)) return undefined;
      const aging = receivablesAgingBucket(invoice, generatedAtMs);
      const clientLabel = clientDisplayLabel(contacts, invoice.clientContactId);
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const group =
        dimensionGrouping ??
        (groupingKey === "client"
          ? { key: invoice.clientContactId ?? "client_unavailable", label: clientLabel }
          : groupingKey === "matter"
            ? { key: invoice.matterId, label: matterLabel(matter, invoice.matterId) }
            : groupingKey === "invoice"
              ? { key: invoice.id, label: invoice.invoiceNumber }
              : { key: aging.key, label: aging.label });
      const bucketAmounts = receivablesBucketAmounts(aging.key, invoice.balanceDueCents);
      return {
        id: invoice.id,
        label: `${invoice.invoiceNumber} ${clientLabel}`,
        groupKey: group.key,
        groupLabel: group.label,
        status: invoice.status,
        tone: aging.tone,
        matterId: invoice.matterId,
        matterNumber: matter?.number,
        dueAt: invoice.dueAt,
        metricCents: invoice.balanceDueCents,
        dimensions,
        metadata: {
          clientContactId: invoice.clientContactId,
          clientDisplayName: clientLabel,
          matterId: invoice.matterId,
          matterNumber: matter?.number,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          issuedAt: invoice.issuedAt,
          dueAt: invoice.dueAt,
          status: invoice.status,
          totalCents: invoice.totalCents,
          paidCents: invoice.paidCents,
          balanceDueCents: invoice.balanceDueCents,
          daysPastDue: aging.daysPastDue,
          bucketKey: aging.key,
          bucketLabel: aging.label,
          ...bucketAmounts,
          ...dimensionMetadata(dimensions),
        },
      };
    })
    .filter((row): row is StaffReportProjectionRow => Boolean(row))
    .sort(sortRows);

  const totalReceivableCents = rows.reduce((sum, row) => sum + (row.metricCents ?? 0), 0);
  const bucketTotals = rows.reduce<Record<string, number>>(
    (totals, row) => {
      for (const key of Object.values(receivablesBucketMetricKeys)) {
        const value = row.metadata[key];
        totals[key] += typeof value === "number" ? value : 0;
      }
      return totals;
    },
    {
      currentCents: 0,
      days1To30Cents: 0,
      days31To60Cents: 0,
      days61To90Cents: 0,
      days91PlusCents: 0,
    },
  );
  return projection({
    definitionKey: "aged_receivables",
    generatedAt,
    groupingKey,
    filters: {
      asOf: generatedAt,
      invoiceStatuses: "issued,partially_paid",
      ...compactDimensionFilters(input.dimensionFilters),
    },
    dimensionFilters: compactDimensionFilters(input.dimensionFilters),
    rows,
    metrics: {
      totalReceivableCents,
      invoiceCount: rows.length,
      clientCount: new Set(
        rows.map((row) =>
          typeof row.metadata.clientContactId === "string"
            ? row.metadata.clientContactId
            : row.metadata.clientDisplayName,
        ),
      ).size,
      pastDueCount: rows.filter((row) => row.metadata.bucketKey !== "current").length,
      ...bucketTotals,
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
  const matters = matterById(input.matters);
  const profiles = legalClinicProfileByMatterId(input.legalClinicMatterProfiles);
  const reconciliationsByAccount = new Map<string, LedgerReconciliationRecord[]>();
  for (const reconciliation of input.reconciliations) {
    const list = reconciliationsByAccount.get(reconciliation.accountId) ?? [];
    list.push(reconciliation);
    reconciliationsByAccount.set(reconciliation.accountId, list);
  }
  const matterIdsByAccount = new Map<string, Set<string>>();
  for (const entry of input.ledgerEntries ?? []) {
    const matterIds = matterIdsByAccount.get(entry.accountId) ?? new Set<string>();
    matterIds.add(entry.matterId);
    matterIdsByAccount.set(entry.accountId, matterIds);
  }
  const rows = input.ledgerAccounts
    .filter((account) => account.type === "trust_asset")
    .map((account): StaffReportProjectionRow | undefined => {
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
      const accountMatterDimensions = [...(matterIdsByAccount.get(account.id) ?? [])].map(
        (matterId) => dimensionsForMatter(matters.get(matterId), profiles.get(matterId)),
      );
      const dimensions =
        accountMatterDimensions.length > 0
          ? aggregateDimensions(accountMatterDimensions)
          : dimensionsForMatter(undefined, undefined);
      const matchesFilters =
        accountMatterDimensions.length > 0
          ? accountMatterDimensions.some((candidate) =>
              dimensionsMatchFilters(candidate, input.dimensionFilters),
            )
          : dimensionsMatchFilters(dimensions, input.dimensionFilters);
      if (!matchesFilters) return undefined;
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const groupKey =
        dimensionGrouping?.key ?? (groupingKey === "priority" ? freshness.key : account.id);
      return {
        id: account.id,
        label: account.name,
        groupKey,
        groupLabel:
          dimensionGrouping?.label ?? (groupingKey === "priority" ? freshness.label : account.name),
        status: latest?.status ?? "not_reconciled",
        tone: exceptionCount > 0 ? "risk" : freshness.tone,
        occurredAt: latest?.statementPeriodEnd,
        metricCount: exceptionCount,
        dimensions,
        metadata: {
          latestReconciliationId: latest?.id,
          daysSinceStatementEnd: freshness.daysSince,
          exceptionCount,
          statementRowCount: latest?.statementRows.length ?? 0,
          ...dimensionMetadata(dimensions),
        },
      };
    })
    .filter((row): row is StaffReportProjectionRow => Boolean(row))
    .sort(sortRows);

  return projection({
    definitionKey: "reconciliation_freshness",
    generatedAt,
    groupingKey,
    filters: {
      freshWithinDays: 30,
      accountTypes: "trust_asset",
      ...compactDimensionFilters(input.dimensionFilters),
    },
    dimensionFilters: compactDimensionFilters(input.dimensionFilters),
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
  const profiles = legalClinicProfileByMatterId(input.legalClinicMatterProfiles);
  const staffKeys = new Set<string>([
    ...input.users.map((user) => user.id),
    ...input.timeEntries.map((entry) => entry.userId),
    ...input.taskDeadlines.map((task) => task.assignedToUserId ?? "unassigned"),
  ]);
  const rows = [...staffKeys]
    .map((userId): StaffReportProjectionRow | undefined => {
      const staffTime = input.timeEntries.filter((entry) => {
        if (entry.userId !== userId) return false;
        const dimensions = dimensionsForMatter(
          matterMap.get(entry.matterId),
          profiles.get(entry.matterId),
        );
        return dimensionsMatchFilters(dimensions, input.dimensionFilters);
      });
      const staffTasks = input.taskDeadlines.filter((task) => {
        const dimensions = dimensionsForMatter(
          matterMap.get(task.matterId),
          profiles.get(task.matterId),
        );
        return (
          (task.assignedToUserId ?? "unassigned") === userId &&
          dimensionsMatchFilters(dimensions, input.dimensionFilters)
        );
      });
      const allMatterDimensions = [
        ...staffTime.map((entry) =>
          dimensionsForMatter(matterMap.get(entry.matterId), profiles.get(entry.matterId)),
        ),
        ...staffTasks.map((task) =>
          dimensionsForMatter(matterMap.get(task.matterId), profiles.get(task.matterId)),
        ),
      ];
      const dimensions =
        allMatterDimensions.length > 0
          ? aggregateDimensions(allMatterDimensions)
          : dimensionsForMatter(undefined, undefined);
      if (!dimensionsMatchFilters(dimensions, input.dimensionFilters)) return undefined;
      const staffTasksForUser = staffTasks.filter(
        (task) => (task.assignedToUserId ?? "unassigned") === userId,
      );
      const billableMinutes = staffTime
        .filter((entry) => entry.billable)
        .reduce((sum, entry) => sum + entry.minutes, 0);
      const approvedMinutes = staffTime
        .filter((entry) => entry.billingStatus === "approved" || entry.billingStatus === "billed")
        .reduce((sum, entry) => sum + entry.minutes, 0);
      const openTaskCount = staffTasksForUser.filter((task) => !task.completedAt).length;
      const completedTaskCount = staffTasksForUser.filter((task) => task.completedAt).length;
      const representativeMatter = staffTime[0]?.matterId
        ? matterMap.get(staffTime[0].matterId)
        : undefined;
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const groupKey =
        dimensionGrouping?.key ??
        (groupingKey === "matter"
          ? (representativeMatter?.id ?? "unassigned_matter")
          : userId || "unassigned");
      return {
        id: `productivity-${userId}`,
        label: userLabel(users.get(userId), userId),
        groupKey,
        groupLabel:
          dimensionGrouping?.label ??
          (groupingKey === "matter"
            ? representativeMatter
              ? matterLabel(representativeMatter, representativeMatter.id)
              : "Unassigned matter"
            : userLabel(users.get(userId), userId)),
        status: openTaskCount > 0 ? "active" : "clear",
        tone: openTaskCount > completedTaskCount ? "neutral" : "ready",
        userId: userId === "unassigned" ? undefined : userId,
        matterId: representativeMatter?.id,
        matterNumber: representativeMatter?.number,
        metricMinutes: billableMinutes,
        metricCount: completedTaskCount,
        dimensions,
        metadata: {
          billableMinutes,
          approvedMinutes,
          timeEntryCount: staffTime.length,
          openTaskCount,
          completedTaskCount,
          ...dimensionMetadata(dimensions),
        },
      };
    })
    .filter((row): row is StaffReportProjectionRow => Boolean(row))
    .filter((row) => row.metricMinutes || row.metricCount || row.metadata.openTaskCount)
    .sort(sortRows);

  return projection({
    definitionKey: "productivity",
    generatedAt,
    groupingKey,
    filters: {
      period: "all_loaded_records",
      timeEntryStatuses: "draft,submitted,approved,billed,written_off",
      ...compactDimensionFilters(input.dimensionFilters),
    },
    dimensionFilters: compactDimensionFilters(input.dimensionFilters),
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
  const profiles = legalClinicProfileByMatterId(input.legalClinicMatterProfiles);
  const taskRows = input.taskDeadlines
    .filter((task) => !task.completedAt)
    .map((task): StaffReportProjectionRow | undefined => {
      const dueMs = parseTime(task.dueAt);
      const overdue = dueMs !== undefined && dueMs < generatedAtMs;
      const matter = matters.get(task.matterId);
      const dimensions = dimensionsForMatter(matter, profiles.get(task.matterId));
      if (!dimensionsMatchFilters(dimensions, input.dimensionFilters)) return undefined;
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const priorityKey = overdue ? "high" : dueMs ? "medium" : "low";
      const groupKey =
        dimensionGrouping?.key ?? (groupingKey === "matter" ? task.matterId : priorityKey);
      return {
        id: task.id,
        label: task.title,
        groupKey,
        groupLabel:
          dimensionGrouping?.label ??
          (groupingKey === "matter" ? matterLabel(matter, task.matterId) : priorityKey),
        status: overdue ? "overdue" : dueMs ? "upcoming" : "unscheduled",
        tone: overdue ? "risk" : "neutral",
        matterId: task.matterId,
        matterNumber: matter?.number,
        userId: task.assignedToUserId,
        dueAt: task.dueAt,
        metricCount: 1,
        dimensions,
        metadata: {
          assignedToUserId: task.assignedToUserId,
          daysPastDue: overdue ? daysBetween(generatedAtMs, dueMs) : undefined,
          ...dimensionMetadata(dimensions),
        },
      };
    })
    .filter((row): row is StaffReportProjectionRow => Boolean(row));
  const staleMatterRows = input.matters
    .filter((matter) => matter.status === "open" || matter.status === "intake")
    .map((matter): StaffReportProjectionRow | undefined => {
      const latest = latestMatterActivityAt(matter);
      const inactiveDays = daysBetween(generatedAtMs, parseTime(latest));
      if (inactiveDays !== undefined && inactiveDays < 30) return undefined;
      const dimensions = dimensionsForMatter(matter, profiles.get(matter.id));
      if (!dimensionsMatchFilters(dimensions, input.dimensionFilters)) return undefined;
      const dimensionGrouping = dimensionGroup(groupingKey, dimensions);
      const priorityKey = matter.status === "intake" ? "medium" : "low";
      return {
        id: `stale-${matter.id}`,
        label: matter.title,
        groupKey: dimensionGrouping?.key ?? (groupingKey === "matter" ? matter.id : priorityKey),
        groupLabel:
          dimensionGrouping?.label ??
          (groupingKey === "matter" ? matterLabel(matter, matter.id) : priorityKey),
        status: "stale_matter",
        tone: matter.status === "intake" ? "neutral" : "ready",
        matterId: matter.id,
        matterNumber: matter.number,
        userId: matter.responsibleUserId,
        occurredAt: latest,
        metricCount: 1,
        dimensions,
        metadata: {
          inactiveDays,
          matterStatus: matter.status,
          responsibleUserId: matter.responsibleUserId,
          ...dimensionMetadata(dimensions),
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
      ...compactDimensionFilters(input.dimensionFilters),
    },
    dimensionFilters: compactDimensionFilters(input.dimensionFilters),
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
  dimensionFilters: StaffReportDimensionFilters;
  rows: StaffReportProjectionRow[];
  metrics: Record<string, string | number | boolean>;
}): StaffReportProjection {
  return {
    definitionKey: input.definitionKey,
    generatedAt: input.generatedAt,
    groupingKey: input.groupingKey,
    filters: input.filters,
    rowCount: input.rows.length,
    dimensionFilters: input.dimensionFilters,
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
  if (input.definitionKey === "aged_receivables") {
    return buildAgedReceivablesProjection(input, generatedAt, generatedAtMs, groupingKey);
  }
  if (input.definitionKey === "billing_period_lock_impact") {
    const { definitionKey: _definitionKey, ...projectionInput } = input;
    return buildBillingPeriodLockImpactProjection({
      ...projectionInput,
      definitionKey: "billing_period_lock_impact",
      generatedAt,
      groupingKey,
    });
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

export function buildStaffReportExportProfileAlignment(): StaffReportExportProfileAlignment {
  return {
    status: "read_only_metadata_alignment",
    staffReportProfiles: STAFF_REPORT_EXPORT_PROFILES.map((profile) => ({
      id: profile.id,
      label: profile.label,
      format: profile.format,
      detailLevel: profile.detailLevel,
      manualDownloadOnly: profile.manualDownloadOnly,
      scheduledEmailDelivery: profile.scheduledEmailDelivery,
      includesRawReportBody: profile.includesRawReportBody,
    })),
    financialFieldProfiles: Object.values(financialExportFieldProfiles).map((profile) => ({
      id: profile.id,
      label: profile.label,
      format: profile.format,
      source: profile.source,
      fieldKeyCount: profile.fieldKeys.length,
      sampleFieldKeys: profile.fieldKeys.slice(0, financialFieldProfileSampleSize),
      manualDownloadOnly: profile.manualDownloadOnly,
      scheduledDelivery: profile.scheduledDelivery,
      storesRawExportBody: profile.storesRawExportBody,
    })),
    differences: [
      {
        key: "purpose",
        label: "Purpose",
        staffReporting: "Manual saved-report downloads for staff review.",
        financialFieldProfiles:
          "Allowlisted field metadata for generated local financial downloads.",
      },
      {
        key: "scope",
        label: "Scope",
        staffReporting:
          "Report definitions, groupings, filters, projection rows, and export history.",
        financialFieldProfiles:
          "Billing operational records and jurisdictional trust summary fields.",
      },
      {
        key: "field_key_behavior",
        label: "Field-key behavior",
        staffReporting: "No field-key allowlist is attached to manual report export profiles.",
        financialFieldProfiles: "Each financial field profile lists generated-projection keys.",
      },
      {
        key: "format_coverage",
        label: "Format coverage",
        staffReporting: "JSON summary and CSV review profiles are available.",
        financialFieldProfiles: "JSON field-profile metadata is available for financial downloads.",
      },
      {
        key: "queue_job_metadata",
        label: "Queue metadata",
        staffReporting:
          "Jobs store definition, profile, grouping, requester, and count metadata only.",
        financialFieldProfiles:
          "Financial jobs store field profile IDs and bounded status metadata only.",
      },
      {
        key: "download_body_behavior",
        label: "Download body",
        staffReporting: "Downloads regenerate authorized report projections at request time.",
        financialFieldProfiles:
          "Downloads include field metadata while preserving existing serialization.",
      },
    ],
    sharedSafeguards: {
      customSql: false,
      biEmbeds: false,
      scheduledExecution: false,
      scheduledDelivery: false,
      rawBodyStorage: false,
      paymentProcessorExposure: false,
      paymentCreation: false,
      paymentAllocation: false,
      invoiceMutation: false,
      trustPosting: false,
      certificationClaims: false,
    },
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
    exportProfileAlignment: buildStaffReportExportProfileAlignment(),
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
