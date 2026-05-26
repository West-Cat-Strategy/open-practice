"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  Clock3,
  ContactRound,
  CreditCard,
  Download,
  FileText,
  FilePenLine,
  FileSignature,
  Files,
  Gavel,
  Link2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConflictCandidate,
  DraftExportFormat,
  EmbeddedIntakeTemplateDefinitionV2,
  CalendarMeetingLinkMode,
} from "@open-practice/domain";
import {
  buildDashboardSectionUrl,
  buildSidebarNavigationSections,
  resolveDashboardRouteSelection,
  type DashboardNavigationSectionKey,
  type OpenPracticeSidebarNavigationSection,
} from "../routes/routeCatalog";
import {
  buildCreateShareLinkPayload,
  describeCreateShareLinkResult,
  describeShareLinkState,
  formatSharePermission,
  replaceShareLink,
  shareLinkPermissions,
} from "./share-links-dashboard";
import {
  appendDraftToMatterDrafts,
  appendDraftExportRecord,
  appendMergeFieldToDraftDocument,
  buildBlankDraftPayload,
  buildDraftExportPayload,
  buildDraftFromTemplatePayload,
  buildDraftUpdatePayload,
  describeDraftAssistStatus,
  draftMergeFields,
  extractDraftPlainText,
  formatDraftExportSize,
  formatDraftApiFailure,
  insertDraftAssistSuggestion,
  isSameDraftDocument,
} from "./drafting-dashboard";
import {
  buildExternalUploadReviewPayload,
  buildExternalUploadReviewPath,
  buildExternalUploadCreatePayload,
  buildExternalUploadRevokePath,
  canCreateExternalUpload,
  describeExternalUploadReviewState,
  externalUploadReviewReasons,
  getExternalUploadLinkState,
  upsertExternalUploadDocument,
  upsertExternalUploadLink,
  type ExternalUploadReviewDecision,
  type ExternalUploadReviewReason,
} from "./external-uploads-dashboard";
import {
  buildIntakeTemplatePreviewPayload,
  buildIntakeFormReviewDecisionPath,
  buildIntakeFormReviewPath,
  buildIntakeFormLinkCreatePayload,
  coerceIntakeDefinitionV2,
  currentProposalValue,
  describeRequestMoreInfoResult,
  describeIntakeTemplatePreview,
  getIntakeFormLinkState,
  pendingSubmittedIntakeReviewLinks,
  previewStatusClass,
  summarizeAnswerValue,
  summarizeIntakeItemAction,
  summarizeIntakeReview,
  upsertIntakeFormLink,
  upsertIntakeVariableProposal,
  type IntakeFormReviewLoadResponse,
  type IntakePreviewAnswers,
} from "./intake-forms-dashboard";
import DraftEditor from "./drafting/DraftEditor";
import {
  applyMatterAvailabilityToNavigation,
  applySavedQueueFocus,
  applySavedMatterFocus,
  buildCreateMatterPayload,
  canSubmitFirstMatter,
  dashboardLaneFreshnessCue,
  describeSavedMatterFocus,
  describeSavedQueueFocus,
  enableMatterScopedCapabilitiesForLocalMatter,
  filterMatters,
  firstMatterJurisdictionOptions,
  getSavedMatterPresetDefinition,
  initialFirstMatterFormState,
  savedMatterPresetOptions,
  summarizeQueues,
  type DashboardLaneRefreshState,
  type FirstMatterFormState,
  type SavedMatterPresetFamily,
} from "./dashboard-utils";
import {
  buildConflictCheckPayload,
  describeConflictCheckStatus,
  summarizeConflictCheckPayload,
  type ConflictProspectiveRole,
} from "./conflict-check-dashboard";
import StructuredIntakeBuilder from "./intake-forms/StructuredIntakeBuilder";
import {
  buildCalendarEventPayload,
  buildCalendarRadarBuckets,
  buildCalendarInvitationPayload,
  buildCalendarMeetingLinkPayload,
  buildCalendarReminderPayload,
  buildCalendarReschedulePayload,
  describeCalendarGuestSessionStatus,
  describeMeetingInvitationBoundary,
  describeMeetingLinkAvailability,
  describeCalendarEventTiming,
  removeCalendarEventReminder,
  removeCalendarEventAttendee,
  upsertCalendarEvent,
  upsertCalendarEventAttendee,
  upsertCalendarCredential,
  upsertCalendarEventReminder,
  upsertCalendarGuestSession,
} from "./calendar-dashboard";
import {
  buildDocumentProcessingOcrProviderPath,
  buildDocumentProcessingQueuePath,
  buildDocumentProcessingWorkbenchPath,
  compactDocumentMetadataTag,
  compactDocumentProcessingReason,
  describeDocumentReviewSuggestion,
  describeDocumentQueueAction,
  describeLatestDocumentJob,
  describeLatestExtraction,
  documentMetadataSearchFilterCount,
  documentProcessingGroupLabel,
  documentProcessingGroupOrder,
  documentReviewSuggestionGroupLabel,
  documentReviewSuggestionGroupOrder,
  documentProcessingRowsForMatter,
  emptyDocumentReviewSuggestions,
  emptyDocumentProcessingWorkbench,
  replaceDocumentProcessingWorkbench,
  summarizeDocumentMetadataSearch,
  summarizeDocumentReviewSuggestions,
  summarizeDocumentProcessingWorkbench,
} from "./document-processing-dashboard";
import {
  buildContactDataQualityResolutionPayload,
  buildContactDossierConflictCheckPrefill,
  contactDataQualitySignalKey,
  filterContactDossiers,
  formatContactDataQualityResolutionDecision,
  formatContactReviewSignalKind,
} from "./contact-dossiers-dashboard";
import {
  formatCalendarAttendeeRoleLabel,
  formatProfessionalRoleLabel,
} from "./participant-role-labels";
import {
  describeFiscalHostProgramMetadata,
  describeLegalClinicProgram,
  describeRestrictedFundMetadata,
  findLegalClinicProgram,
  fiscalHostWorkflowMetadata,
} from "./legal-clinic-dashboard";
import {
  accountLabel,
  activeJurisdictionTrustReportSummary,
  buildTrustControlsPath,
  emptyTrustControlsDashboard,
  matterTrustBalanceCents,
  recentTrustPostings,
  summarizeTrustControls,
  trustControlsForMatter,
} from "./trust-controls-dashboard";
import {
  buildDraftInvoicePayload,
  describeDraftInvoiceCreated,
  formatDraftInvoiceApiFailure,
  updateBillingDashboardWithCreatedInvoice,
  type CreatedDraftInvoiceResponse,
} from "./billing-dashboard";
import {
  describeWorkerRunStatus,
  formatWorkerRunAttempts,
  formatWorkerRunTiming,
  summarizeWorkerRuns,
  summarizeWorkerHealth,
  workerHealthTone,
  workerRunFilters,
  workerRunsForFilter,
  workerRunSafeContext,
} from "./worker-runs-dashboard";
import {
  buildProvidersStatusPath,
  compactProviderStatus,
  providerPostureRows,
  summarizeProvidersStatus,
} from "./provider-status-dashboard";
import {
  buildConnectorOutboxDeadLetterPath,
  buildConnectorOutboxDeadLetterPayload,
  buildConnectorOutboxRetryPath,
  buildConnectorOutboxRetryPayload,
  emptyConnectorOperationsResponse,
  summarizeConnectorOperations,
  type ConnectorRecoveryAction,
  type PendingConnectorRecovery,
} from "./connector-outbox-dashboard";
import {
  buildOperationalFocusSummary,
  operationalFocusEmptyMessage,
} from "./operational-focus-panel";
import {
  auditProjectionStatusLabel,
  emptyAuditProjectionDashboard,
  summarizeAuditProjectionIssues,
  type AuditProjectionDashboardResponse,
} from "./audit-dashboard";
import {
  buildMatterFileCommandCenter,
  filterMatterActivity,
  summarizeMatterActivity,
  type MatterActivityKindFilter,
  type MatterActivityStatusFilter,
} from "./matter-command-center";
import { dashboardApiStatus, requestDashboardJson } from "./api-client";
import {
  ContextRail,
  DashboardMetrics,
  DashboardSidebar,
  DashboardTopbar,
  MatterContextPanel,
  MatterDetailShell,
  OperationalFocusPanel,
  type DashboardMetric,
} from "./dashboard/dashboard-shell";
import { ContactsSection } from "./dashboard/contacts-section";
import { MatterOverviewSection } from "./dashboard/matter-overview-section";
import { QueuesSection } from "./dashboard/queues-section";
import {
  DeliveryConfirmationPanel,
  OneTimeSecretPanel,
  type PendingDeliveryConfirmation,
} from "./dashboard/shared-panels";
import {
  buildEmailDeliveryConfirmation,
  buildIntakeSessionCreatePayload,
  canRecordContactDataQualityResolutions,
  upsertIntakeSession,
} from "./types";
import type {
  AuditResponse,
  CalendarAttendeeMutationResponse,
  BillingDashboardResponse,
  CalendarCredentialCreateResponse,
  CalendarCredentialRevokeResponse,
  CalendarDashboardResponse,
  CalendarEventMutationResponse,
  CalendarGuestSessionGuestMutationResponse,
  CalendarGuestSessionIssueResponse,
  CalendarGuestSessionMutationResponse,
  CalendarGuestSessionSummary,
  CalendarInvitationResponse,
  CalendarMeetingLinkMutationResponse,
  CalendarReminderMutationResponse,
  CapabilitiesResponse,
  CommunicationsInboxDashboardResponse,
  ConnectorOutboxRecoveryResponse,
  ConnectorOutboxResponse,
  ConnectorOperationsResponse,
  ConnectorsResponse,
  ConflictResponse,
  ContactDossiersResponse,
  ContactDataQualityResolutionRecord,
  ContactDataQualityResolutionsResponse,
  ContactReviewQueueResponse,
  DocumentProcessingDashboardResponse,
  DocumentMetadataSearchFilters,
  DocumentProcessingStatusResponse,
  DocumentProcessingWorkbenchResponse,
  DraftingDashboardResponse,
  DraftExportResponse,
  DraftAssistRecordsResponse,
  DraftAssistStatusResponse,
  EmailDeliveryDashboardResponse,
  ExternalUploadReviewItem,
  ExternalUploadCreateResponse,
  ExternalUploadRevokeResponse,
  ExternalUploadsDashboardResponse,
  IntakeSessionsResponse,
  IntakeSessionCreateResponse,
  IntakeFormsDashboardResponse,
  IntakeFormLinkCreateResponse,
  IntakeFormLinkRevokeResponse,
  IntakeFormReviewResponse,
  IntakeTemplatePreviewResponse,
  IntakeTemplateSavePayload,
  LegalClinicDashboardResponse,
  MatterSummary,
  SavedOperationalViewDefinition,
  OperationalViewsResponse,
  PracticeOverview,
  ProvidersStatusResponse,
  QueuesResponse,
  CreateShareLinkResponse,
  RevokeShareLinkResponse,
  SessionResponse,
  ShareLinkPermission,
  ShareLinkRecord,
  ShareLinksResponse,
  ShareLinksStatusResponse,
  SignatureRequestsResponse,
  TaskDeadlineWorkbenchResponse,
  TrustControlsDashboardResponse,
  IntakeVariableProposalsResponse,
  JurisdictionalTrustReportResponse,
  WorkerHealthResponse,
  WorkerRunQueueFilter,
  WorkerRunsDashboardResponse,
} from "./types";

interface DashboardClientProps {
  apiBaseUrl: string;
  auditProjection: AuditProjectionDashboardResponse;
  billing: BillingDashboardResponse;
  calendar: CalendarDashboardResponse;
  capabilities: CapabilitiesResponse;
  communicationsInbox: CommunicationsInboxDashboardResponse;
  connectorOperations: ConnectorOperationsResponse;
  contactDataQualityResolutions: ContactDataQualityResolutionsResponse;
  contactDossiers: ContactDossiersResponse;
  contactReviewQueue: ContactReviewQueueResponse;
  devHeaders: Record<string, string>;
  documentProcessing: DocumentProcessingDashboardResponse;
  drafting: DraftingDashboardResponse;
  emailDeliveryHistory: EmailDeliveryDashboardResponse;
  externalUploads: ExternalUploadsDashboardResponse;
  intake: IntakeSessionsResponse;
  intakeForms: IntakeFormsDashboardResponse;
  jurisdictionalTrustReport: JurisdictionalTrustReportResponse;
  legalClinic: LegalClinicDashboardResponse;
  initialSection: DashboardNavigationSectionKey;
  overview: PracticeOverview;
  operationalViewDefinitions?: SavedOperationalViewDefinition[];
  operationalViews: OperationalViewsResponse;
  providerStatus: ProvidersStatusResponse;
  matters: MatterSummary[];
  session: SessionResponse;
  shareLinksStatus: ShareLinksStatusResponse;
  signatures: SignatureRequestsResponse;
  taskWorkbench: TaskDeadlineWorkbenchResponse;
  trustControls: TrustControlsDashboardResponse;
  queues: QueuesResponse;
  workerHealth: WorkerHealthResponse;
  workerRuns: WorkerRunsDashboardResponse;
}

async function requestConnectorOperationsForDashboard(
  apiBaseUrl: string,
  headers: Record<string, string>,
): Promise<ConnectorOperationsResponse> {
  try {
    const [connectors, outbox] = await Promise.all([
      requestDashboardJson<ConnectorsResponse>(apiBaseUrl, "/api/connectors", { headers }),
      requestDashboardJson<ConnectorOutboxResponse>(apiBaseUrl, "/api/connectors/outbox", {
        headers,
      }),
    ]);
    return {
      status: "available",
      connectors: connectors.connectors,
      outbox: outbox.outbox,
    };
  } catch (error) {
    const status = dashboardApiStatus(error);
    if (status === 403) return emptyConnectorOperationsResponse("access_denied");
    if (status === 404) return emptyConnectorOperationsResponse("unavailable");
    throw error;
  }
}

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];
type DashboardDraft = DraftingDashboardResponse["draftsByMatterId"][string][number];
type DashboardDraftAssistRecord = DraftAssistRecordsResponse["records"][number];
type DashboardIntakeVariableProposal = IntakeVariableProposalsResponse["proposals"][number];
type DashboardCalendarEvent = CalendarDashboardResponse["eventsByMatterId"][string][number];

const documentMetadataClassificationOptions = [
  "general",
  "privileged",
  "work_product",
  "financial",
  "identity",
] as const;
const documentMetadataReviewStatusOptions = [
  "not_required",
  "pending_review",
  "needs_metadata",
  "accepted",
  "retry_requested",
  "discarded",
] as const;
const documentMetadataScanStatusOptions = [
  "pending",
  "queued",
  "passed",
  "failed",
  "not_required",
] as const;
const documentMetadataOcrStatusOptions = [
  "not_available",
  "queued",
  "completed",
  "failed",
] as const;
const documentMetadataCueGroupOptions = [
  "classification",
  "duplicate_or_supersession",
  "matter_contact",
  "missing_metadata",
  "retention_review",
] as const;

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});
const compactDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const dashboardLaneStaleAfterMs = 5 * 60 * 1000;

const navIcons: Record<LocalDashboardSectionKey, LucideIcon> = {
  matters: Gavel,
  contacts: ContactRound,
  funds: Banknote,
  billing: CreditCard,
  documents: Files,
  shares: Link2,
  externalUploads: Upload,
  drafting: FilePenLine,
  calendar: CalendarDays,
  signatures: FileSignature,
  intake: FileText,
  audit: ShieldCheck,
  queues: Clock3,
};

function cents(value: number): string {
  return currency.format(value / 100);
}

function minutes(value: number): string {
  const hours = Math.floor(value / 60);
  const remaining = value % 60;
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
}

function compactStatus(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

function compactDate(value?: string): string {
  if (!value) return "none";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : compactDateFormatter.format(date);
}

function formatSavedOperationalViewDefinition(definition: SavedOperationalViewDefinition): string {
  const scope =
    definition.permissionScope.length > 0 ? definition.permissionScope.join(", ") : "no scope";
  return `${definition.rowLimit} rows · ${definition.columns.length} columns · ${scope}`;
}

function formatSavedMatterViewDefinition(definition: SavedOperationalViewDefinition): string {
  const preset = getSavedMatterPresetDefinition(definition.filters.presetFamily);
  const presetLabel = preset?.summaryLabel ?? "no preset focus";
  return `${presetLabel} · ${definition.rowLimit} matters · ${definition.permissionScope.join(", ")}`;
}

function FirstMatterWorkspace({
  canCreateMatter,
  creating,
  form,
  onChange,
  onCreate,
  status,
}: {
  canCreateMatter: boolean;
  creating: boolean;
  form: FirstMatterFormState;
  onChange: <Field extends keyof FirstMatterFormState>(
    field: Field,
    value: FirstMatterFormState[Field],
  ) => void;
  onCreate: () => void;
  status: string;
}) {
  const canSubmit = canCreateMatter && canSubmitFirstMatter(form) && !creating;

  function handleTextChange<Field extends keyof FirstMatterFormState>(field: Field) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange(field, event.currentTarget.value as FirstMatterFormState[Field]);
    };
  }

  return (
    <article
      aria-labelledby="first-matter-title"
      className="panel first-matter-panel"
      id="matter-workspace"
      tabIndex={-1}
    >
      <div className="panel-header first-matter-header">
        <div>
          <p className="eyebrow">Matter command centre</p>
          <h2 id="first-matter-title">Create the first matter</h2>
        </div>
        <span className="status-chip">Starter intake</span>
      </div>

      <div className="first-matter-layout">
        <div className="first-matter-form-grid">
          <label>
            <span className="field-label">Matter title</span>
            <input
              className="compact-input first-matter-input"
              onChange={handleTextChange("title")}
              placeholder="Synthetic starter intake"
              value={form.title}
            />
          </label>
          <label>
            <span className="field-label">Practice area</span>
            <input
              className="compact-input first-matter-input"
              onChange={handleTextChange("practiceArea")}
              placeholder="Residential tenancy"
              value={form.practiceArea}
            />
          </label>
          <label>
            <span className="field-label">Jurisdiction</span>
            <select
              className="compact-select first-matter-input"
              onChange={handleTextChange("jurisdiction")}
              value={form.jurisdiction}
            >
              {firstMatterJurisdictionOptions.map((jurisdiction) => (
                <option key={jurisdiction} value={jurisdiction}>
                  {jurisdiction}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="first-matter-kind-field">
            <legend className="field-label">Client kind</legend>
            <div className="segmented-control" role="group" aria-label="Client kind">
              {(["person", "organization"] as const).map((kind) => (
                <button
                  aria-pressed={form.clientKind === kind}
                  className={form.clientKind === kind ? "active" : ""}
                  key={kind}
                  onClick={() => onChange("clientKind", kind)}
                  type="button"
                >
                  {kind === "person" ? "Person" : "Organization"}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            <span className="field-label">Client display name</span>
            <input
              className="compact-input first-matter-input"
              onChange={handleTextChange("clientDisplayName")}
              placeholder="Synthetic Client"
              value={form.clientDisplayName}
            />
          </label>
          <label>
            <span className="field-label">Client email</span>
            <input
              className="compact-input first-matter-input"
              inputMode="email"
              onChange={handleTextChange("clientEmail")}
              placeholder="client@example.test"
              type="email"
              value={form.clientEmail}
            />
          </label>
          <label>
            <span className="field-label">Client phone</span>
            <input
              className="compact-input first-matter-input"
              inputMode="tel"
              onChange={handleTextChange("clientPhone")}
              placeholder="+1-555-0100"
              type="tel"
              value={form.clientPhone}
            />
          </label>
        </div>

        <aside className="first-matter-controls" aria-label="Created records">
          <div className="detail-grid compact-detail-grid">
            <div>
              <span className="field-label">Matter</span>
              <strong>Intake</strong>
            </div>
            <div>
              <span className="field-label">Party</span>
              <strong>Prospective</strong>
            </div>
            <div>
              <span className="field-label">Assignment</span>
              <strong>Current user</strong>
            </div>
            <div>
              <span className="field-label">Audit</span>
              <strong>Safe metadata</strong>
            </div>
          </div>
          <button
            className="primary-button first-matter-submit"
            disabled={!canSubmit}
            onClick={onCreate}
            type="button"
          >
            <Plus size={18} aria-hidden="true" />
            {creating ? "Creating matter" : "Create matter"}
          </button>
          <p className="inline-empty" role="status" aria-live="polite">
            {canCreateMatter
              ? status
              : "Your current role can use operational surfaces, but matter creation is not available."}
          </p>
        </aside>
      </div>
    </article>
  );
}

export default function DashboardClient({
  apiBaseUrl,
  auditProjection: initialAuditProjection,
  billing,
  calendar,
  capabilities,
  communicationsInbox,
  connectorOperations: initialConnectorOperations,
  contactDataQualityResolutions: initialContactDataQualityResolutions,
  contactDossiers,
  contactReviewQueue,
  devHeaders,
  documentProcessing,
  drafting,
  emailDeliveryHistory,
  externalUploads,
  intake,
  intakeForms,
  jurisdictionalTrustReport,
  legalClinic,
  initialSection,
  overview,
  operationalViewDefinitions = [],
  operationalViews: initialOperationalViews,
  providerStatus: initialProviderStatus,
  matters: initialMatters,
  session,
  signatures,
  taskWorkbench,
  trustControls,
  queues: initialQueues,
  workerHealth,
  workerRuns,
  shareLinksStatus,
}: DashboardClientProps) {
  const detailPanelRef = useRef<HTMLElement>(null);
  const shouldFocusDetailRef = useRef(false);
  const hasAppliedUrlSectionRef = useRef(false);
  const [matters, setMatters] = useState(initialMatters);
  const [queues, setQueues] = useState(initialQueues);
  const [auditProjection, setAuditProjection] = useState(initialAuditProjection);
  const [providerStatus, setProviderStatus] = useState(initialProviderStatus);
  const [connectorOperations, setConnectorOperations] = useState(initialConnectorOperations);
  const [operationalViews, setOperationalViews] = useState(initialOperationalViews);
  const [freshnessNow, setFreshnessNow] = useState(() => new Date());
  const [dashboardLoadedAt, setDashboardLoadedAt] = useState("");
  const [queueRefreshState, setQueueRefreshState] = useState<DashboardLaneRefreshState>({
    refreshing: false,
  });
  const [providerRefreshState, setProviderRefreshState] = useState<DashboardLaneRefreshState>({
    refreshing: false,
  });
  const [ocrProviderUpdating, setOcrProviderUpdating] = useState(false);
  const [ocrProviderUpdateStatus, setOcrProviderUpdateStatus] = useState(
    "OCR provider posture has not changed.",
  );
  const [pendingConnectorRecovery, setPendingConnectorRecovery] =
    useState<PendingConnectorRecovery | null>(null);
  const [connectorRecoveryBusyKey, setConnectorRecoveryBusyKey] = useState("");
  const [connectorRecoveryStatus, setConnectorRecoveryStatus] = useState(
    "No connector recovery action has been requested.",
  );
  const [auditRefreshState, setAuditRefreshState] = useState<DashboardLaneRefreshState>({
    refreshing: false,
  });
  const [activeMatterId, setActiveMatterId] = useState(initialMatters[0]?.id ?? "");
  const [activeSection, setActiveSection] = useState<LocalDashboardSectionKey>(initialSection);
  const [workerRunFilter, setWorkerRunFilter] = useState<WorkerRunQueueFilter>("all");
  const [savedOperationalViewDefinitions, setSavedOperationalViewDefinitions] = useState(
    operationalViewDefinitions,
  );
  const queueOperationalViewDefinitions = savedOperationalViewDefinitions.filter(
    (definition) => definition.surface === "queues",
  );
  const matterOperationalViewDefinitions = savedOperationalViewDefinitions.filter(
    (definition) => definition.surface === "matters",
  );
  const [savedOperationalViewStatus, setSavedOperationalViewStatus] = useState(
    queueOperationalViewDefinitions.length > 0
      ? `${queueOperationalViewDefinitions.length} saved queue view${queueOperationalViewDefinitions.length === 1 ? "" : "s"} loaded.`
      : "No saved queue views yet.",
  );
  const [savedMatterViewStatus, setSavedMatterViewStatus] = useState(
    matterOperationalViewDefinitions.length > 0
      ? `${matterOperationalViewDefinitions.length} saved matter view${matterOperationalViewDefinitions.length === 1 ? "" : "s"} loaded.`
      : "No saved matter views yet.",
  );
  const [savingOperationalView, setSavingOperationalView] = useState(false);
  const [savingMatterView, setSavingMatterView] = useState(false);
  const [archivingOperationalViewId, setArchivingOperationalViewId] = useState("");
  const [archivingMatterViewId, setArchivingMatterViewId] = useState("");
  const [activeSavedOperationalViewId, setActiveSavedOperationalViewId] = useState("");
  const [activeSavedMatterViewId, setActiveSavedMatterViewId] = useState("");
  const [selectedMatterViewPresetFamily, setSelectedMatterViewPresetFamily] =
    useState<SavedMatterPresetFamily>("matter_follow_up");
  const [matterSearch, setMatterSearch] = useState("");
  const [firstMatterForm, setFirstMatterForm] = useState<FirstMatterFormState>(
    initialFirstMatterFormState,
  );
  const [firstMatterStatus, setFirstMatterStatus] = useState(
    "No matter has been created in this session.",
  );
  const [creatingFirstMatter, setCreatingFirstMatter] = useState(false);
  const [activityKindFilter, setActivityKindFilter] = useState<MatterActivityKindFilter>("all");
  const [activityStatusFilter, setActivityStatusFilter] =
    useState<MatterActivityStatusFilter>("all");
  const [contactSearch, setContactSearch] = useState("");
  const [activeContactId, setActiveContactId] = useState(contactDossiers[0]?.contact.id ?? "");
  const [contactDataQualityResolutions, setContactDataQualityResolutions] = useState(
    initialContactDataQualityResolutions,
  );
  const [contactDataQualityStatus, setContactDataQualityStatus] = useState(
    "No contact resolution recorded in this session.",
  );
  const [recordingContactResolutionKey, setRecordingContactResolutionKey] = useState("");
  const [conflictName, setConflictName] = useState("");
  const [conflictAliases, setConflictAliases] = useState("");
  const [conflictIdentifiers, setConflictIdentifiers] = useState("");
  const [conflictProspectiveRole, setConflictProspectiveRole] = useState<
    ConflictProspectiveRole | ""
  >("client");
  const [conflictResults, setConflictResults] = useState<ConflictCandidate[]>([]);
  const [conflictStatus, setConflictStatus] = useState("No check run yet.");
  const [billingDashboard, setBillingDashboard] = useState(billing);
  const [draftInvoiceDueAt, setDraftInvoiceDueAt] = useState("");
  const [draftInvoiceTaxName, setDraftInvoiceTaxName] = useState("");
  const [draftInvoiceTaxRate, setDraftInvoiceTaxRate] = useState("0");
  const [draftInvoiceStatus, setDraftInvoiceStatus] = useState("No draft invoice created.");
  const [creatingDraftInvoice, setCreatingDraftInvoice] = useState(false);
  const [draftsByMatterId, setDraftsByMatterId] = useState(drafting.draftsByMatterId);
  const [creatingTemplateId, setCreatingTemplateId] = useState("");
  const [draftStatus, setDraftStatus] = useState("No draft created in this session.");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [draftEditorJson, setDraftEditorJson] = useState<DashboardDraft["editorJson"] | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftExportTitle, setDraftExportTitle] = useState("");
  const [draftExportFormat, setDraftExportFormat] = useState<DraftExportFormat>("pdf");
  const [draftMergeField, setDraftMergeField] =
    useState<(typeof draftMergeFields)[number]>("matter.number");
  const [exportingDraftFormat, setExportingDraftFormat] = useState<DraftExportFormat | "">("");
  const [draftExportsByDraftId, setDraftExportsByDraftId] = useState<
    Record<string, DraftExportResponse[]>
  >({});
  const [draftAssistStatus, setDraftAssistStatus] = useState<DraftAssistStatusResponse>({
    status: "disabled",
    reason: "not_configured",
    supportedTasks: ["summarize", "suggest_revision", "continue_draft"],
  });
  const [draftAssistTask, setDraftAssistTask] =
    useState<DashboardDraftAssistRecord["task"]>("summarize");
  const [draftAssistInstruction, setDraftAssistInstruction] = useState("");
  const [draftAssistRecordsByDraftId, setDraftAssistRecordsByDraftId] = useState<
    Record<string, DashboardDraftAssistRecord[]>
  >({});
  const [draftAssistMessage, setDraftAssistMessage] = useState("Draft assist has not loaded yet.");
  const [runningDraftAssist, setRunningDraftAssist] = useState(false);
  const [sharesByMatterId, setSharesByMatterId] = useState<Record<string, ShareLinkRecord[]>>({});
  const [shareStatus, setShareStatus] = useState("Share links have not loaded yet.");
  const [sharePermissions, setSharePermissions] = useState<ShareLinkPermission[]>([
    "view_documents",
  ]);
  const [shareExpiresAt, setShareExpiresAt] = useState("");
  const [shareNotificationEmail, setShareNotificationEmail] = useState("");
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState("");
  const [shareOneTimeToken, setShareOneTimeToken] = useState("");
  const [externalUploadsByMatterId, setExternalUploadsByMatterId] = useState(
    externalUploads.uploadsByMatterId,
  );
  const [externalUploadDocumentsByMatterId, setExternalUploadDocumentsByMatterId] = useState(
    externalUploads.reviewItemsByMatterId,
  );
  const [documentProcessingByMatterId, setDocumentProcessingByMatterId] = useState(
    documentProcessing.workbenchesByMatterId,
  );
  const [documentProcessingStatus, setDocumentProcessingStatus] = useState(
    "Document processing workbench loaded.",
  );
  const [documentMetadataQuery, setDocumentMetadataQuery] = useState("");
  const [documentMetadataClassificationFilter, setDocumentMetadataClassificationFilter] =
    useState("");
  const [documentMetadataReviewStatusFilter, setDocumentMetadataReviewStatusFilter] = useState("");
  const [documentMetadataScanStatusFilter, setDocumentMetadataScanStatusFilter] = useState("");
  const [documentMetadataOcrStatusFilter, setDocumentMetadataOcrStatusFilter] = useState("");
  const [documentMetadataCueGroupFilter, setDocumentMetadataCueGroupFilter] = useState("");
  const [documentMetadataTagFilter, setDocumentMetadataTagFilter] = useState("");
  const [queueingDocumentId, setQueueingDocumentId] = useState("");
  const [trustControlsByMatterId, setTrustControlsByMatterId] = useState<
    Record<string, TrustControlsDashboardResponse>
  >(() => (matters[0] ? { [matters[0].id]: trustControls } : {}));
  const [trustControlsStatus, setTrustControlsStatus] = useState(
    matters[0] ? "Trust controls loaded." : "No matter selected.",
  );
  const [externalUploadMaxUploads, setExternalUploadMaxUploads] = useState("1");
  const [externalUploadExpiresAt, setExternalUploadExpiresAt] = useState("");
  const [externalUploadToken, setExternalUploadToken] = useState("");
  const [externalUploadStatus, setExternalUploadStatus] = useState("No link created.");
  const [creatingExternalUpload, setCreatingExternalUpload] = useState(false);
  const [revokingExternalUploadId, setRevokingExternalUploadId] = useState("");
  const [reviewingExternalUploadDocumentId, setReviewingExternalUploadDocumentId] = useState("");
  const [externalUploadReviewReasonsByDocumentId, setExternalUploadReviewReasonsByDocumentId] =
    useState<Record<string, ExternalUploadReviewReason | "">>({});
  const [externalUploadReviewNotesByDocumentId, setExternalUploadReviewNotesByDocumentId] =
    useState<Record<string, string>>({});
  const [calendarEventsByMatterId, setCalendarEventsByMatterId] = useState(
    calendar.eventsByMatterId,
  );
  const [calendarCredentials, setCalendarCredentials] = useState(calendar.credentials);
  const [calendarCredentialLabel, setCalendarCredentialLabel] = useState("iOS Calendar");
  const [calendarCredentialStatus, setCalendarCredentialStatus] = useState(
    calendar.credentials.length === 0
      ? "No calendar app passwords are active."
      : `${calendar.credentials.length} calendar app password${
          calendar.credentials.length === 1 ? "" : "s"
        } loaded.`,
  );
  const [calendarOneTimeSecret, setCalendarOneTimeSecret] =
    useState<CalendarCredentialCreateResponse | null>(null);
  const [creatingCalendarCredential, setCreatingCalendarCredential] = useState(false);
  const [revokingCalendarCredentialId, setRevokingCalendarCredentialId] = useState("");
  const [calendarEventTitle, setCalendarEventTitle] = useState("");
  const [calendarEventStartsAt, setCalendarEventStartsAt] = useState("");
  const [calendarEventEndsAt, setCalendarEventEndsAt] = useState("");
  const [calendarEventLocation, setCalendarEventLocation] = useState("");
  const [calendarEventDescription, setCalendarEventDescription] = useState("");
  const [calendarEventStatusValue, setCalendarEventStatusValue] =
    useState<DashboardCalendarEvent["status"]>("confirmed");
  const [calendarEventLifecycleStatus, setCalendarEventLifecycleStatus] = useState(
    "Calendar events have not changed.",
  );
  const [creatingCalendarEvent, setCreatingCalendarEvent] = useState(false);
  const [updatingCalendarEventId, setUpdatingCalendarEventId] = useState("");
  const [cancelingCalendarEventId, setCancelingCalendarEventId] = useState("");
  const [calendarReminderEventId, setCalendarReminderEventId] = useState("");
  const [calendarReminderAt, setCalendarReminderAt] = useState("");
  const [calendarReminderNote, setCalendarReminderNote] = useState("");
  const [calendarReminderStatusValue, setCalendarReminderStatusValue] = useState<
    "pending" | "acknowledged" | "dismissed" | "cancelled"
  >("pending");
  const [calendarReminderStatus, setCalendarReminderStatus] = useState(
    "Reminder state has not changed.",
  );
  const [addingCalendarReminder, setAddingCalendarReminder] = useState(false);
  const [updatingCalendarReminderId, setUpdatingCalendarReminderId] = useState("");
  const [removingCalendarReminderId, setRemovingCalendarReminderId] = useState("");
  const [calendarMeetingEventId, setCalendarMeetingEventId] = useState("");
  const [calendarAttendeeName, setCalendarAttendeeName] = useState("");
  const [calendarAttendeeEmail, setCalendarAttendeeEmail] = useState("");
  const [calendarAttendeeRole, setCalendarAttendeeRole] = useState<"required" | "optional">(
    "required",
  );
  const [calendarMeetingStatus, setCalendarMeetingStatus] = useState(
    "Meeting attendees have not changed.",
  );
  const [calendarGuestSessionsByEventId, setCalendarGuestSessionsByEventId] = useState(
    calendar.guestSessionsByEventId,
  );
  const [calendarGuestSessionStatus, setCalendarGuestSessionStatus] = useState(
    "Guest sessions have not changed.",
  );
  const [calendarGuestSessionSecret, setCalendarGuestSessionSecret] =
    useState<CalendarGuestSessionIssueResponse | null>(null);
  const [creatingCalendarGuestSessionEventId, setCreatingCalendarGuestSessionEventId] =
    useState("");
  const [updatingCalendarGuestSessionKey, setUpdatingCalendarGuestSessionKey] = useState("");
  const [calendarMeetingLinkModesByEventId, setCalendarMeetingLinkModesByEventId] = useState<
    Record<string, CalendarMeetingLinkMode>
  >({});
  const [calendarMeetingLinkUrlsByEventId, setCalendarMeetingLinkUrlsByEventId] = useState<
    Record<string, string>
  >({});
  const [updatingCalendarMeetingLinkEventId, setUpdatingCalendarMeetingLinkEventId] = useState("");
  const [addingCalendarAttendee, setAddingCalendarAttendee] = useState(false);
  const [removingCalendarAttendeeId, setRemovingCalendarAttendeeId] = useState("");
  const [sendingCalendarInvitationsEventId, setSendingCalendarInvitationsEventId] = useState("");
  const [pendingDeliveryConfirmation, setPendingDeliveryConfirmation] =
    useState<PendingDeliveryConfirmation | null>(null);
  const [intakeFormLinksByMatterId, setIntakeFormLinksByMatterId] = useState(
    intakeForms.linksByMatterId,
  );
  const [intakeFormActionsByLinkId] = useState(intakeForms.actionsByLinkId);
  const [intakeVariableProposalsByMatterId, setIntakeVariableProposalsByMatterId] = useState(
    intakeForms.proposalsByMatterId,
  );
  const [intakeFormExpiresAt, setIntakeFormExpiresAt] = useState("");
  const [intakeFormToken, setIntakeFormToken] = useState("");
  const [intakeFormPortalUrl, setIntakeFormPortalUrl] = useState("");
  const [intakeFormStatus, setIntakeFormStatus] = useState("No form link created.");
  const [creatingIntakeFormLink, setCreatingIntakeFormLink] = useState(false);
  const [revokingIntakeFormLinkId, setRevokingIntakeFormLinkId] = useState("");
  const [intakeReviewDetailsByLinkId, setIntakeReviewDetailsByLinkId] = useState<
    Record<string, IntakeFormReviewLoadResponse | undefined>
  >({});
  const [loadingIntakeReviewLinkId, setLoadingIntakeReviewLinkId] = useState("");
  const [reviewingIntakeFormLinkId, setReviewingIntakeFormLinkId] = useState("");
  const [intakeReviewReasons, setIntakeReviewReasons] = useState<Record<string, string>>({});
  const [reviewingIntakeProposalId, setReviewingIntakeProposalId] = useState("");
  const [proposalRejectionReasons, setProposalRejectionReasons] = useState<Record<string, string>>(
    {},
  );
  const [intakeTemplates, setIntakeTemplates] = useState(intake.templates);
  const [intakeSessions, setIntakeSessions] = useState(intake.sessions);
  const [selectedIntakeTemplateId, setSelectedIntakeTemplateId] = useState(
    intake.templates[0]?.id ?? "",
  );
  const selectedIntakeTemplate =
    intakeTemplates.find((template) => template.id === selectedIntakeTemplateId) ??
    intakeTemplates[0];
  const [intakeTemplateName, setIntakeTemplateName] = useState(
    selectedIntakeTemplate?.name ?? "New intake form",
  );
  const [intakeTemplateDefinition, setIntakeTemplateDefinition] =
    useState<EmbeddedIntakeTemplateDefinitionV2>(coerceIntakeDefinitionV2(selectedIntakeTemplate));
  const [intakeTemplateStatus, setIntakeTemplateStatus] = useState("Template editor ready.");
  const [intakePreviewAnswers, setIntakePreviewAnswers] = useState<IntakePreviewAnswers>({});
  const [intakePreviewResult, setIntakePreviewResult] =
    useState<IntakeTemplatePreviewResponse | null>(null);
  const [intakePreviewStatus, setIntakePreviewStatus] = useState("Preview checks have not run.");
  const [previewingIntakeTemplate, setPreviewingIntakeTemplate] = useState(false);
  const [savingIntakeTemplate, setSavingIntakeTemplate] = useState(false);
  const [startingIntakeSession, setStartingIntakeSession] = useState(false);

  const activeSavedMatterViewDefinition = useMemo(
    () =>
      matterOperationalViewDefinitions.find(
        (definition) => definition.id === activeSavedMatterViewId,
      ) ?? null,
    [activeSavedMatterViewId, matterOperationalViewDefinitions],
  );
  const savedMatterFocusedMatters = useMemo(
    () => applySavedMatterFocus(matters, activeSavedMatterViewDefinition, operationalViews),
    [activeSavedMatterViewDefinition, matters, operationalViews],
  );
  const filteredMatters = useMemo(
    () => filterMatters(savedMatterFocusedMatters, matterSearch),
    [savedMatterFocusedMatters, matterSearch],
  );
  const filteredContactDossiers = useMemo(
    () => filterContactDossiers(contactDossiers, contactSearch),
    [contactDossiers, contactSearch],
  );
  const activeContactDossier =
    filteredContactDossiers.find((dossier) => dossier.contact.id === activeContactId) ??
    filteredContactDossiers[0] ??
    contactDossiers[0];
  const activeContactDataQualityResolutions = activeContactDossier
    ? contactDataQualityResolutions.filter(
        (resolution) => resolution.contactId === activeContactDossier.contact.id,
      )
    : [];
  const canRecordContactDataQualityResolution = Boolean(
    canRecordContactDataQualityResolutions(capabilities.sections),
  );
  const activeMatter = matters.find((matter) => matter.id === activeMatterId) ?? matters[0];
  const activeSignatures = signatures.filter(
    (signature) => signature.matterId === activeMatter?.id,
  );
  const activeIntakeSessions = intakeSessions.filter(
    (sessionRecord) => sessionRecord.matterId === activeMatter?.id,
  );
  const activeDocuments = activeMatter?.documents ?? [];
  const activeDocumentProcessing = activeMatter
    ? (documentProcessingByMatterId[activeMatter.id] ??
      emptyDocumentProcessingWorkbench(activeMatter.id))
    : emptyDocumentProcessingWorkbench("");
  const activeDocumentProcessingRows = useMemo(
    () => documentProcessingRowsForMatter(activeDocuments, activeDocumentProcessing),
    [activeDocuments, activeDocumentProcessing],
  );
  const activeDocumentMetadataSearchFilters = useMemo<DocumentMetadataSearchFilters>(
    () => ({
      q: documentMetadataQuery.trim() || undefined,
      classification:
        (documentMetadataClassificationFilter as DocumentMetadataSearchFilters["classification"]) ||
        undefined,
      reviewStatus:
        (documentMetadataReviewStatusFilter as DocumentMetadataSearchFilters["reviewStatus"]) ||
        undefined,
      scanStatus:
        (documentMetadataScanStatusFilter as DocumentMetadataSearchFilters["scanStatus"]) ||
        undefined,
      ocrStatus:
        (documentMetadataOcrStatusFilter as DocumentMetadataSearchFilters["ocrStatus"]) ||
        undefined,
      cueGroup:
        (documentMetadataCueGroupFilter as DocumentMetadataSearchFilters["cueGroup"]) || undefined,
      tag: documentMetadataTagFilter.trim() || undefined,
    }),
    [
      documentMetadataClassificationFilter,
      documentMetadataCueGroupFilter,
      documentMetadataOcrStatusFilter,
      documentMetadataQuery,
      documentMetadataReviewStatusFilter,
      documentMetadataScanStatusFilter,
      documentMetadataTagFilter,
    ],
  );
  const activeDocumentMetadataFilterCount = useMemo(
    () => documentMetadataSearchFilterCount(activeDocumentMetadataSearchFilters),
    [activeDocumentMetadataSearchFilters],
  );
  const activeMatterCommandCenter = useMemo(
    () =>
      activeMatter
        ? buildMatterFileCommandCenter({
            matter: activeMatter,
            documentRows: activeDocumentProcessingRows,
            shares: sharesByMatterId[activeMatter.id] ?? [],
            externalUploadDocuments: externalUploadDocumentsByMatterId[activeMatter.id] ?? [],
            communicationsInbox: communicationsInbox.inboxByMatterId[activeMatter.id],
          })
        : undefined,
    [
      activeDocumentProcessingRows,
      activeMatter,
      communicationsInbox.inboxByMatterId,
      externalUploadDocumentsByMatterId,
      sharesByMatterId,
    ],
  );
  const activeActivitySummary = useMemo(
    () => summarizeMatterActivity(activeMatter?.activity ?? []),
    [activeMatter?.activity],
  );
  const filteredMatterActivity = useMemo(
    () =>
      filterMatterActivity({
        entries: activeMatter?.activity ?? [],
        kind: activityKindFilter,
        status: activityStatusFilter,
      }),
    [activeMatter?.activity, activityKindFilter, activityStatusFilter],
  );
  const documentProcessingSummary = useMemo(
    () => summarizeDocumentProcessingWorkbench(activeDocumentProcessing),
    [activeDocumentProcessing],
  );
  const documentReviewSuggestionsSummary = useMemo(
    () => summarizeDocumentReviewSuggestions(activeDocumentProcessingRows),
    [activeDocumentProcessingRows],
  );
  const documentMetadataSearchSummary = useMemo(
    () => summarizeDocumentMetadataSearch(activeDocumentProcessing.metadataSearch),
    [activeDocumentProcessing.metadataSearch],
  );
  const activeDocumentMetadataTags =
    activeDocumentProcessing.metadataSearch?.tags.slice(0, 10) ?? [];
  const activeShares = activeMatter ? (sharesByMatterId[activeMatter.id] ?? []) : [];
  const activeDrafts = activeMatter ? (draftsByMatterId[activeMatter.id] ?? []) : [];
  const activeExternalUploads = activeMatter
    ? (externalUploadsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeExternalUploadDocuments = activeMatter
    ? (externalUploadDocumentsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeCalendarEvents = activeMatter
    ? (calendarEventsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeCalendarLinks = activeMatter ? calendar.linksByMatterId[activeMatter.id] : undefined;
  const activeCalendarBuckets = useMemo(
    () => buildCalendarRadarBuckets(activeCalendarEvents),
    [activeCalendarEvents],
  );
  const selectedCalendarMeetingEvent =
    activeCalendarEvents.find((event) => event.id === calendarMeetingEventId) ??
    activeCalendarEvents[0];
  const selectedCalendarReminderEvent =
    activeCalendarEvents.find((event) => event.id === calendarReminderEventId) ??
    activeCalendarEvents[0];

  useEffect(() => {
    if (!activeCalendarEvents.length) {
      if (calendarMeetingEventId) setCalendarMeetingEventId("");
      if (calendarReminderEventId) setCalendarReminderEventId("");
      return;
    }
    if (!activeCalendarEvents.some((event) => event.id === calendarMeetingEventId)) {
      setCalendarMeetingEventId(activeCalendarEvents[0]!.id);
    }
    if (!activeCalendarEvents.some((event) => event.id === calendarReminderEventId)) {
      setCalendarReminderEventId(activeCalendarEvents[0]!.id);
    }
  }, [activeCalendarEvents, calendarMeetingEventId, calendarReminderEventId]);
  const activeIntakeFormLinks = activeMatter
    ? (intakeFormLinksByMatterId[activeMatter.id] ?? [])
    : [];
  const activePendingIntakeReviewLinks = pendingSubmittedIntakeReviewLinks(
    activeIntakeFormLinks,
    intakeReviewDetailsByLinkId,
  );
  const activeIntakeVariableProposals = activeMatter
    ? (intakeVariableProposalsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeLegalClinicProfile = activeMatter
    ? legalClinic.profilesByMatterId[activeMatter.id]?.[0]
    : undefined;
  const activeLegalClinicProgram = findLegalClinicProgram(
    legalClinic.programs,
    activeLegalClinicProfile,
  );
  const activeFiscalHostMetadata = fiscalHostWorkflowMetadata(
    activeLegalClinicProgram,
    activeLegalClinicProfile,
  );
  const activeEmailDeliveries = activeMatter
    ? (emailDeliveryHistory.emailsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeCommunicationsInbox = activeMatter
    ? communicationsInbox.inboxByMatterId[activeMatter.id]
    : undefined;
  const activePendingIntakeVariableProposals = activeIntakeVariableProposals.filter(
    (proposal) => proposal.status === "pending",
  );
  const externalUploadCreateAvailable = canCreateExternalUpload(externalUploads.status);
  const selectedDraft = activeDrafts.find((draft) => draft.id === selectedDraftId);
  const activeDraftAssistRecords = selectedDraft
    ? (draftAssistRecordsByDraftId[selectedDraft.id] ?? [])
    : [];
  const activeDraftExports = selectedDraft ? (draftExportsByDraftId[selectedDraft.id] ?? []) : [];
  const draftHasChanges =
    selectedDraft !== undefined &&
    draftEditorJson !== null &&
    !isSameDraftDocument(selectedDraft.editorJson, draftEditorJson);
  const activeBilling = billingDashboard.matters.find(
    (matter) => matter.matterId === activeMatter?.id,
  );
  const activeTrustControls = activeMatter
    ? (trustControlsByMatterId[activeMatter.id] ?? emptyTrustControlsDashboard())
    : emptyTrustControlsDashboard();
  const activeTrustBalanceCents = activeMatter
    ? matterTrustBalanceCents(activeTrustControls, activeMatter.id, activeMatter.trustBalanceCents)
    : 0;
  const trustReviewSummary = summarizeTrustControls(activeTrustControls);
  const activeJurisdictionTrustSummary = activeJurisdictionTrustReportSummary({
    matter: activeMatter,
    report: jurisdictionalTrustReport,
  });
  const activeTrustPostings = activeMatter
    ? recentTrustPostings(activeTrustControls, activeMatter.id)
    : [];
  const exceptionReconciliations = activeTrustControls.reconciliations.filter(
    (reconciliation) =>
      reconciliation.status === "exception" ||
      activeTrustControls.diagnostics.exceptionReconciliationIds.includes(reconciliation.id),
  );
  const unreconciledAccounts = activeTrustControls.diagnostics.unreconciledAccountIds.map(
    (accountId) => ({
      id: accountId,
      label: accountLabel(activeTrustControls, accountId),
    }),
  );
  const activeUnbilledTime = activeBilling?.unbilledTime ?? [];
  const activeUnbilledExpenses = activeBilling?.unbilledExpenses ?? [];
  const activeInvoices = activeBilling?.invoices ?? [];
  const activeManualPayments = activeBilling?.payments ?? [];
  const activeBalanceDueCents = activeInvoices.reduce(
    (sum, invoice) => sum + invoice.balanceDueCents,
    0,
  );
  const activeUnbilledTimeCents = activeUnbilledTime.reduce(
    (sum, entry) => sum + entry.amountCents,
    0,
  );
  const activeUnbilledExpenseCents = activeUnbilledExpenses.reduce(
    (sum, entry) => sum + entry.amountCents,
    0,
  );
  const canCreateDraftInvoice = activeUnbilledTime.length + activeUnbilledExpenses.length > 0;
  const hasAccessibleMatter = matters.length > 0;
  const canCreateMatter = capabilities.sections.some(
    (section) => section.key === "matters" && section.actions.includes("create"),
  );
  const navigationCapabilitySections = useMemo(
    () => enableMatterScopedCapabilitiesForLocalMatter(capabilities.sections, hasAccessibleMatter),
    [capabilities.sections, hasAccessibleMatter],
  );
  const navigationSections = useMemo<OpenPracticeSidebarNavigationSection[]>(() => {
    return applyMatterAvailabilityToNavigation(
      buildSidebarNavigationSections({
        billingCanView: billingDashboard.canView,
        capabilitySections: navigationCapabilitySections,
        shareLinksEnabled: shareLinksStatus.createStatus === "enabled",
        externalUploadsEnabled: externalUploadCreateAvailable,
      }),
      hasAccessibleMatter,
      canCreateMatter,
    );
  }, [
    billingDashboard.canView,
    canCreateMatter,
    externalUploadCreateAvailable,
    hasAccessibleMatter,
    navigationCapabilitySections,
    shareLinksStatus.createStatus,
  ]);
  const activeSectionLabel =
    activeSection === "matters"
      ? activeMatter?.title
      : (navigationSections.find((section) => section.key === activeSection)?.title ?? "Dashboard");
  const matterActionSections = useMemo(
    () =>
      navigationSections.filter(
        (section) =>
          section.key !== "matters" && (section.requiresMatterContext || section.key === "queues"),
      ),
    [navigationSections],
  );
  const activeSavedOperationalViewDefinition = useMemo(
    () =>
      queueOperationalViewDefinitions.find(
        (definition) => definition.id === activeSavedOperationalViewId,
      ) ?? null,
    [activeSavedOperationalViewId, queueOperationalViewDefinitions],
  );
  const displayedQueues = useMemo(
    () => applySavedQueueFocus(queues, activeSavedOperationalViewDefinition),
    [activeSavedOperationalViewDefinition, queues],
  );
  const queueSummary = useMemo(() => summarizeQueues(displayedQueues), [displayedQueues]);
  const connectorOperationsSummary = useMemo(
    () => summarizeConnectorOperations(connectorOperations),
    [connectorOperations],
  );
  const providerStatusSummary = useMemo(
    () => summarizeProvidersStatus(providerStatus),
    [providerStatus],
  );
  const providerRows = useMemo(() => providerPostureRows(providerStatus), [providerStatus]);
  const canManageDocumentProcessingProvider = session.user.role === "owner_admin";
  const canManageConnectorRecovery = session.user.role === "owner_admin";
  const activeWorkerRuns = useMemo(
    () => workerRunsForFilter(workerRuns, workerRunFilter),
    [workerRuns, workerRunFilter],
  );
  const workerRunSummary = useMemo(() => summarizeWorkerRuns(activeWorkerRuns), [activeWorkerRuns]);
  const workerHealthSummary = useMemo(() => summarizeWorkerHealth(workerHealth), [workerHealth]);
  const workerHealthStateTone = workerHealthTone(workerHealth.status);
  const taskDeadlineSummary = useMemo(() => {
    const my = taskWorkbench.counters.my;
    return `${my.overdue} overdue, ${my.today} due today, ${my.upcoming} upcoming`;
  }, [taskWorkbench.counters.my]);
  const operationalFocus = useMemo(
    () =>
      buildOperationalFocusSummary({
        taskWorkbench,
        queues,
        operationalViews,
        workerRuns,
        providerStatus,
        activeMatterCommandCenter,
        activeMatterActivitySummary: activeActivitySummary,
      }),
    [
      activeActivitySummary,
      activeMatterCommandCenter,
      operationalViews,
      providerStatus,
      queues,
      taskWorkbench,
      workerRuns,
    ],
  );
  const operationalFocusEmpty = operationalFocusEmptyMessage(operationalFocus);
  const queueFreshnessCue = dashboardLaneFreshnessCue(
    {
      loadedAt: queueRefreshState.loadedAt ?? dashboardLoadedAt,
      refreshing: queueRefreshState.refreshing,
      error: queueRefreshState.error,
    },
    {
      now: freshnessNow,
      staleAfterMs: dashboardLaneStaleAfterMs,
      loadedAtLabel:
        queueRefreshState.loadedAt || dashboardLoadedAt
          ? compactDate(queueRefreshState.loadedAt ?? dashboardLoadedAt)
          : undefined,
    },
  );
  const providerFreshnessCue = dashboardLaneFreshnessCue(
    {
      loadedAt: providerRefreshState.loadedAt ?? dashboardLoadedAt,
      refreshing: providerRefreshState.refreshing,
      error: providerRefreshState.error,
    },
    {
      now: freshnessNow,
      staleAfterMs: dashboardLaneStaleAfterMs,
      loadedAtLabel:
        providerRefreshState.loadedAt || dashboardLoadedAt
          ? compactDate(providerRefreshState.loadedAt ?? dashboardLoadedAt)
          : undefined,
    },
  );
  const auditFreshnessCue = dashboardLaneFreshnessCue(
    {
      loadedAt: auditRefreshState.loadedAt ?? dashboardLoadedAt,
      refreshing: auditRefreshState.refreshing,
      error: auditRefreshState.error,
    },
    {
      now: freshnessNow,
      staleAfterMs: dashboardLaneStaleAfterMs,
      loadedAtLabel:
        auditRefreshState.loadedAt || dashboardLoadedAt
          ? compactDate(auditRefreshState.loadedAt ?? dashboardLoadedAt)
          : undefined,
    },
  );
  const auditProjectionIssues = useMemo(
    () => summarizeAuditProjectionIssues(auditProjection.taxonomySummary),
    [auditProjection.taxonomySummary],
  );

  useEffect(() => {
    const loadedAt = new Date().toISOString();
    setDashboardLoadedAt(loadedAt);
    setFreshnessNow(new Date(loadedAt));
    const timer = window.setInterval(() => setFreshnessNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeMatter) return;
    let cancelled = false;

    if (trustControlsByMatterId[activeMatter.id]) {
      setTrustControlsStatus("Trust controls loaded.");
      return;
    }

    async function loadMatterTrustControls(): Promise<void> {
      setTrustControlsStatus("Loading trust controls...");
      const response = await fetch(`${apiBaseUrl}${buildTrustControlsPath(activeMatter.id)}`, {
        credentials: "include",
        headers: devHeaders,
      });
      if (cancelled) return;
      if (!response.ok) {
        setTrustControlsStatus(
          response.status === 404
            ? "Trust controls route is not available yet."
            : `Trust controls failed to load: ${response.status}`,
        );
        return;
      }
      const payload = (await response.json()) as TrustControlsDashboardResponse;
      setTrustControlsByMatterId((current) =>
        trustControlsForMatter(current, activeMatter.id, payload),
      );
      setTrustControlsStatus("Trust controls loaded.");
    }

    void loadMatterTrustControls();
    return () => {
      cancelled = true;
    };
  }, [activeMatter, apiBaseUrl, devHeaders, trustControlsByMatterId]);

  useEffect(() => {
    if (!activeMatter) return;
    let cancelled = false;

    async function loadMatterShares(): Promise<void> {
      setShareStatus("Loading share links...");
      const response = await fetch(
        `${apiBaseUrl}/api/shares?matterId=${encodeURIComponent(activeMatter.id)}`,
        {
          credentials: "include",
          headers: devHeaders,
        },
      );
      if (cancelled) return;
      if (!response.ok) {
        setShareStatus(`Share links failed to load: ${response.status}`);
        return;
      }
      const payload = (await response.json()) as ShareLinksResponse;
      setSharesByMatterId((current) => ({
        ...current,
        [activeMatter.id]: payload.shares,
      }));
      setShareStatus(
        payload.shares.length === 0
          ? "No share links are active for this matter."
          : `${payload.shares.length} share link${payload.shares.length === 1 ? "" : "s"} loaded.`,
      );
    }

    void loadMatterShares();
    return () => {
      cancelled = true;
    };
  }, [activeMatter, apiBaseUrl, devHeaders]);

  useEffect(() => {
    let cancelled = false;

    async function loadDraftAssistStatus(): Promise<void> {
      const response = await fetch(`${apiBaseUrl}/api/draft-assist/status`, {
        credentials: "include",
        headers: devHeaders,
      });
      if (cancelled) return;
      if (!response.ok) {
        setDraftAssistMessage(`Draft assist status failed: ${response.status}`);
        return;
      }
      const payload = (await response.json()) as DraftAssistStatusResponse;
      setDraftAssistStatus(payload);
      setDraftAssistMessage(describeDraftAssistStatus(payload));
    }

    void loadDraftAssistStatus();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, devHeaders]);

  useEffect(() => {
    if (!selectedDraft) return;
    const selectedDraftId = selectedDraft.id;
    let cancelled = false;

    async function loadDraftAssistRecords(): Promise<void> {
      const response = await fetch(
        `${apiBaseUrl}/api/draft-assist/records?draftId=${encodeURIComponent(selectedDraftId)}`,
        {
          credentials: "include",
          headers: devHeaders,
        },
      );
      if (cancelled) return;
      if (!response.ok) {
        setDraftAssistMessage(`Draft assist records failed: ${response.status}`);
        return;
      }
      const payload = (await response.json()) as DraftAssistRecordsResponse;
      setDraftAssistRecordsByDraftId((current) => ({
        ...current,
        [selectedDraftId]: payload.records,
      }));
    }

    void loadDraftAssistRecords();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, devHeaders, selectedDraft]);

  useEffect(() => {
    function applySectionFromUrl() {
      const selection = resolveDashboardRouteSelection({
        requestedSection: new URLSearchParams(window.location.search).get("section"),
        navigationSections,
      });
      if (hasAppliedUrlSectionRef.current) shouldFocusDetailRef.current = true;
      hasAppliedUrlSectionRef.current = true;
      setActiveSection(selection.sectionKey);
    }

    applySectionFromUrl();
    window.addEventListener("popstate", applySectionFromUrl);
    return () => window.removeEventListener("popstate", applySectionFromUrl);
  }, [navigationSections]);

  useEffect(() => {
    if (!shouldFocusDetailRef.current) return;
    detailPanelRef.current?.focus();
    shouldFocusDetailRef.current = false;
  }, [activeSection]);

  const metrics = useMemo<DashboardMetric[]>(
    () => [
      {
        label: "Open matters",
        value: overview.metrics.openMatters.toString(),
        icon: Gavel,
      },
      {
        label: "My overdue tasks",
        value: taskWorkbench.counters.my.overdue.toString(),
        icon: AlertTriangle,
      },
      {
        label: "Portal grants",
        value: overview.metrics.portalGrants.toString(),
        icon: LockKeyhole,
      },
      {
        label: "Trust funds tracked",
        value: cents(overview.metrics.trustBalanceCents),
        icon: Banknote,
      },
      {
        label: "Unbilled time",
        value: minutes(overview.metrics.unbilledMinutes),
        icon: Clock3,
      },
      {
        label: "Balances due",
        value: cents(billingDashboard.summary.issuedBalanceDueCents),
        icon: CreditCard,
      },
    ],
    [
      billingDashboard.summary.issuedBalanceDueCents,
      overview.metrics,
      taskWorkbench.counters.my.overdue,
    ],
  );

  async function refreshQueueLane(): Promise<void> {
    setQueueRefreshState((current) => ({ ...current, refreshing: true, error: undefined }));
    try {
      const [payload, connectorPayload] = await Promise.all([
        requestDashboardJson<QueuesResponse>(apiBaseUrl, "/api/queues", {
          headers: devHeaders,
        }),
        requestConnectorOperationsForDashboard(apiBaseUrl, devHeaders),
      ]);
      setQueues(payload);
      setConnectorOperations(connectorPayload);
      setQueueRefreshState({ loadedAt: new Date().toISOString(), refreshing: false });
      setFreshnessNow(new Date());
    } catch (error) {
      setQueueRefreshState((current) => ({
        ...current,
        refreshing: false,
        error: String(dashboardApiStatus(error)),
      }));
      setFreshnessNow(new Date());
    }
  }

  async function refreshConnectorOperations(): Promise<void> {
    const payload = await requestConnectorOperationsForDashboard(apiBaseUrl, devHeaders);
    setConnectorOperations(payload);
    setFreshnessNow(new Date());
  }

  async function refreshProviderLane(): Promise<void> {
    setProviderRefreshState((current) => ({ ...current, refreshing: true, error: undefined }));
    try {
      const payload = await requestDashboardJson<ProvidersStatusResponse>(
        apiBaseUrl,
        buildProvidersStatusPath(),
        { headers: devHeaders },
      );
      setProviderStatus(payload);
      setProviderRefreshState({ loadedAt: new Date().toISOString(), refreshing: false });
      setFreshnessNow(new Date());
    } catch (error) {
      setProviderRefreshState((current) => ({
        ...current,
        refreshing: false,
        error: String(dashboardApiStatus(error)),
      }));
      setFreshnessNow(new Date());
    }
  }

  async function setOcrProviderEnabled(enabled: boolean): Promise<void> {
    if (!canManageDocumentProcessingProvider) return;
    setOcrProviderUpdating(true);
    setOcrProviderUpdateStatus(
      enabled ? "Enabling local OCR provider..." : "Disabling local OCR provider...",
    );
    try {
      const documentProcessingStatus = await requestDashboardJson<DocumentProcessingStatusResponse>(
        apiBaseUrl,
        buildDocumentProcessingOcrProviderPath(),
        {
          method: "PUT",
          headers: devHeaders,
          payload: { enabled },
        },
      );
      setProviderStatus((current) => ({
        ...current,
        documentProcessing: documentProcessingStatus,
      }));
      await refreshProviderLane();
      if (activeMatter) {
        await refreshDocumentProcessingWorkbench(activeMatter.id);
      }
      setOcrProviderUpdateStatus(
        enabled
          ? "Local OCR provider enabled; queue readiness still depends on Redis and worker configuration."
          : "Local OCR provider disabled; existing OCR job history remains visible.",
      );
    } catch (error) {
      setOcrProviderUpdateStatus(`OCR provider update failed: ${dashboardApiStatus(error)}.`);
    } finally {
      setOcrProviderUpdating(false);
    }
  }

  function requestConnectorRecovery(
    item: ConnectorOperationsResponse["outbox"][number],
    action: ConnectorRecoveryAction,
  ): void {
    if (!canManageConnectorRecovery) return;
    setPendingConnectorRecovery({ action, outboxId: item.id, expectedStatus: item.status });
    setConnectorRecoveryStatus(
      action === "retry" ? `Review retry for ${item.id}.` : `Review dead-letter for ${item.id}.`,
    );
  }

  function cancelConnectorRecovery(): void {
    setPendingConnectorRecovery(null);
    setConnectorRecoveryStatus("Connector recovery action cancelled.");
  }

  async function confirmConnectorRecovery(): Promise<void> {
    if (!pendingConnectorRecovery) return;
    const item = connectorOperations.outbox.find(
      (candidate) => candidate.id === pendingConnectorRecovery.outboxId,
    );
    if (!item) {
      setPendingConnectorRecovery(null);
      setConnectorRecoveryStatus("Connector outbox row is no longer visible.");
      return;
    }
    const busyKey = `${pendingConnectorRecovery.action}:${pendingConnectorRecovery.outboxId}`;
    setConnectorRecoveryBusyKey(busyKey);
    setConnectorRecoveryStatus(
      pendingConnectorRecovery.action === "retry"
        ? `Retrying ${pendingConnectorRecovery.outboxId}...`
        : `Moving ${pendingConnectorRecovery.outboxId} to dead letter...`,
    );
    try {
      const path =
        pendingConnectorRecovery.action === "retry"
          ? buildConnectorOutboxRetryPath(item.id)
          : buildConnectorOutboxDeadLetterPath(item.id);
      const confirmedItem = { ...item, status: pendingConnectorRecovery.expectedStatus };
      const payload =
        pendingConnectorRecovery.action === "retry"
          ? buildConnectorOutboxRetryPayload(confirmedItem)
          : buildConnectorOutboxDeadLetterPayload(confirmedItem);
      const response = await requestDashboardJson<ConnectorOutboxRecoveryResponse>(
        apiBaseUrl,
        path,
        {
          method: "POST",
          headers: devHeaders,
          payload,
        },
      );
      setConnectorOperations((current) => ({
        ...current,
        outbox: current.outbox.map((candidate) =>
          candidate.id === response.outbox.id ? response.outbox : candidate,
        ),
      }));
      await refreshConnectorOperations();
      setPendingConnectorRecovery(null);
      setConnectorRecoveryStatus(
        pendingConnectorRecovery.action === "retry"
          ? `${item.id} queued for manual retry.`
          : `${item.id} moved to dead letter.`,
      );
    } catch (error) {
      setConnectorRecoveryStatus(`Connector recovery failed: ${dashboardApiStatus(error)}.`);
    } finally {
      setConnectorRecoveryBusyKey("");
    }
  }

  async function refreshAuditLane(): Promise<void> {
    setAuditRefreshState((current) => ({ ...current, refreshing: true, error: undefined }));
    try {
      const [refreshedMatters, refreshedOperationalViews, refreshedAudit] = await Promise.all([
        requestDashboardJson<MatterSummary[]>(apiBaseUrl, "/api/matters", { headers: devHeaders }),
        requestDashboardJson<OperationalViewsResponse>(apiBaseUrl, "/api/operational-views", {
          headers: devHeaders,
        }),
        requestDashboardJson<AuditResponse>(apiBaseUrl, "/api/audit", { headers: devHeaders }),
      ]);
      setMatters(refreshedMatters);
      setOperationalViews(refreshedOperationalViews);
      setAuditProjection({
        status: "available",
        valid: refreshedAudit.valid,
        taxonomySummary: refreshedAudit.taxonomySummary,
      });
      setAuditRefreshState({ loadedAt: new Date().toISOString(), refreshing: false });
      setFreshnessNow(new Date());
    } catch (error) {
      setAuditProjection(emptyAuditProjectionDashboard());
      setAuditRefreshState((current) => ({
        ...current,
        refreshing: false,
        error: String(dashboardApiStatus(error)),
      }));
      setFreshnessNow(new Date());
    }
  }

  async function createDraftInvoice(): Promise<void> {
    if (!activeMatter) return;
    const payloadResult = buildDraftInvoicePayload({
      matter: activeMatter,
      unbilledTime: activeUnbilledTime,
      unbilledExpenses: activeUnbilledExpenses,
      dueAtDate: draftInvoiceDueAt,
      taxName: draftInvoiceTaxName,
      taxRatePercent: draftInvoiceTaxRate,
    });

    if (!payloadResult.payload) {
      setDraftInvoiceStatus(payloadResult.error ?? "Draft invoice payload is incomplete.");
      return;
    }

    setCreatingDraftInvoice(true);
    setDraftInvoiceStatus("Creating draft invoice...");
    try {
      const draftInvoicePayload = payloadResult.payload;
      const invoice = await requestDashboardJson<CreatedDraftInvoiceResponse>(
        apiBaseUrl,
        "/api/invoices",
        {
          method: "POST",
          headers: devHeaders,
          payload: draftInvoicePayload,
        },
      );
      const sourceCount =
        draftInvoicePayload.timeEntryIds.length + draftInvoicePayload.expenseEntryIds.length;
      setBillingDashboard((current) =>
        updateBillingDashboardWithCreatedInvoice(current, {
          invoice,
          timeEntryIds: draftInvoicePayload.timeEntryIds,
          expenseEntryIds: draftInvoicePayload.expenseEntryIds,
        }),
      );
      setDraftInvoiceDueAt("");
      setDraftInvoiceTaxName("");
      setDraftInvoiceTaxRate("0");
      setDraftInvoiceStatus(describeDraftInvoiceCreated(invoice, sourceCount));
    } catch (error) {
      setDraftInvoiceStatus(formatDraftInvoiceApiFailure(dashboardApiStatus(error)));
    } finally {
      setCreatingDraftInvoice(false);
    }
  }

  async function runConflictCheck() {
    const payloadResult = buildConflictCheckPayload({
      prospectiveName: conflictName,
      aliasesText: conflictAliases,
      identifiersText: conflictIdentifiers,
      prospectiveRole: conflictProspectiveRole,
    });
    if (!payloadResult.payload) {
      setConflictStatus(payloadResult.error ?? "Conflict check payload is incomplete.");
      setConflictResults([]);
      return;
    }

    const conflictScope = summarizeConflictCheckPayload(payloadResult.payload);
    setConflictStatus(`Running conflict check for ${conflictScope}...`);
    const response = await fetch(`${apiBaseUrl}/api/conflicts/check`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadResult.payload),
    });
    if (!response.ok) {
      setConflictStatus(`Conflict check failed: ${response.status}`);
      setConflictResults([]);
      return;
    }
    const payload = (await response.json()) as ConflictResponse;
    setConflictResults(payload.results);
    setConflictStatus(describeConflictCheckStatus(payloadResult.payload, payload.results.length));
  }

  function prepareConflictCheckFromContact(): void {
    if (!activeContactDossier) return;
    const prefill = buildContactDossierConflictCheckPrefill(activeContactDossier, activeMatter?.id);
    setConflictName(prefill.prospectiveName);
    setConflictAliases(prefill.aliasesText);
    setConflictIdentifiers(prefill.identifiersText);
    setConflictProspectiveRole(prefill.prospectiveRole);
    setConflictResults([]);
    setConflictStatus(
      `Prepared conflict check from ${activeContactDossier.contact.displayName}${
        prefill.matterId ? ` on matter ${prefill.matterId}` : ""
      }.`,
    );
  }

  async function recordContactDataQualityResolution(
    signal: ContactDossiersResponse[number]["qualityReview"]["signals"][number],
    decision: ContactDataQualityResolutionRecord["decision"],
  ): Promise<void> {
    if (!activeContactDossier) return;
    const payload = buildContactDataQualityResolutionPayload(
      activeContactDossier,
      signal,
      decision,
    );
    const signalKey = contactDataQualitySignalKey(activeContactDossier.contact.id, signal);
    setRecordingContactResolutionKey(signalKey);
    setContactDataQualityStatus("Recording contact resolution...");
    try {
      const created = await requestDashboardJson<ContactDataQualityResolutionRecord>(
        apiBaseUrl,
        "/api/contacts/data-quality-resolutions",
        {
          method: "POST",
          headers: devHeaders,
          payload,
        },
      );
      setContactDataQualityResolutions((current) =>
        [created, ...current].sort(
          (left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt),
        ),
      );
      setContactDataQualityStatus(
        `Recorded ${formatContactDataQualityResolutionDecision(
          created.decision,
        )} for ${formatContactReviewSignalKind(created.signalKind)}.`,
      );
    } catch (error) {
      setContactDataQualityStatus(`Resolution failed: ${dashboardApiStatus(error)}`);
    } finally {
      setRecordingContactResolutionKey("");
    }
  }

  async function createDraftFromTemplate(
    template: DraftingDashboardResponse["templates"][number],
  ): Promise<void> {
    if (!activeMatter) return;

    setCreatingTemplateId(template.id);
    setDraftStatus("Creating draft...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildDraftFromTemplatePayload({ matter: activeMatter, template })),
      });

      if (!response.ok) {
        setDraftStatus(
          formatDraftApiFailure(
            "creation",
            response.status,
            await response.json().catch(() => undefined),
          ),
        );
        return;
      }

      const draft = (await response.json()) as DashboardDraft;
      setDraftsByMatterId((current) => appendDraftToMatterDrafts(current, draft));
      setSelectedDraftId(draft.id);
      setDraftEditorJson(draft.editorJson);
      setDraftStatus(`Created ${draft.title}.`);
    } catch {
      setDraftStatus("Draft creation failed: network error");
    } finally {
      setCreatingTemplateId("");
    }
  }

  async function createBlankDraft(): Promise<void> {
    if (!activeMatter) return;

    setCreatingTemplateId("blank");
    setDraftStatus("Creating draft...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildBlankDraftPayload({ matter: activeMatter })),
      });

      if (!response.ok) {
        setDraftStatus(
          formatDraftApiFailure(
            "creation",
            response.status,
            await response.json().catch(() => undefined),
          ),
        );
        return;
      }

      const draft = (await response.json()) as DashboardDraft;
      setDraftsByMatterId((current) => appendDraftToMatterDrafts(current, draft));
      setSelectedDraftId(draft.id);
      setDraftEditorJson(draft.editorJson);
      setDraftStatus(`Created ${draft.title}.`);
    } catch {
      setDraftStatus("Draft creation failed: network error");
    } finally {
      setCreatingTemplateId("");
    }
  }

  async function saveDraft(): Promise<void> {
    if (!selectedDraft || !draftEditorJson) return;

    setSavingDraft(true);
    setDraftStatus("Saving draft...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts/${selectedDraft.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildDraftUpdatePayload({ editorJson: draftEditorJson })),
      });

      if (!response.ok) {
        setDraftStatus(
          formatDraftApiFailure(
            "save",
            response.status,
            await response.json().catch(() => undefined),
          ),
        );
        return;
      }

      const draft = (await response.json()) as DashboardDraft;
      setDraftsByMatterId((current) => ({
        ...current,
        [draft.matterId ?? activeMatter.id]: (current[draft.matterId ?? activeMatter.id] ?? []).map(
          (candidate) => (candidate.id === draft.id ? draft : candidate),
        ),
      }));
      setDraftEditorJson(draft.editorJson);
      setDraftStatus(`Saved ${draft.title}.`);
    } catch {
      setDraftStatus("Draft save failed: network error");
    } finally {
      setSavingDraft(false);
    }
  }

  async function exportDraft(): Promise<void> {
    if (!selectedDraft) return;
    if (draftHasChanges) {
      setDraftStatus("Save draft changes before exporting.");
      return;
    }

    setExportingDraftFormat(draftExportFormat);
    setDraftStatus(`Exporting ${draftExportFormat.toUpperCase()}...`);
    try {
      const response = await fetch(`${apiBaseUrl}/api/drafts/${selectedDraft.id}/exports`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildDraftExportPayload({
            format: draftExportFormat,
            title: draftExportTitle || selectedDraft.title,
          }),
        ),
      });

      if (!response.ok) {
        setDraftStatus(
          formatDraftApiFailure(
            "save",
            response.status,
            await response.json().catch(() => undefined),
          ).replace("Draft save", "Draft export"),
        );
        return;
      }

      const exported = (await response.json()) as DraftExportResponse;
      setDraftExportsByDraftId((current) =>
        appendDraftExportRecord(current, selectedDraft.id, exported),
      );
      setDraftStatus(
        `Exported ${exported.title} as ${exported.format.toUpperCase()} (${formatDraftExportSize(
          exported.byteLength,
        )}).`,
      );
    } catch {
      setDraftStatus("Draft export failed: network error");
    } finally {
      setExportingDraftFormat("");
    }
  }

  function insertMergeField(): void {
    if (!draftEditorJson) return;
    setDraftEditorJson(
      appendMergeFieldToDraftDocument({
        editorJson: draftEditorJson,
        field: draftMergeField,
      }),
    );
    setDraftStatus(`Inserted {{ ${draftMergeField} }} locally. Save before exporting.`);
  }

  function openDraft(draft: DashboardDraft): void {
    setSelectedDraftId(draft.id);
    setDraftEditorJson(draft.editorJson);
    setDraftExportTitle(draft.title);
    setDraftStatus(`Editing ${draft.title}.`);
  }

  function closeDraftEditor(): void {
    setSelectedDraftId("");
    setDraftEditorJson(null);
    setDraftExportTitle("");
  }

  async function runDraftAssist(): Promise<void> {
    if (!selectedDraft || draftAssistStatus.status !== "configured") return;

    setRunningDraftAssist(true);
    setDraftAssistMessage("Requesting draft assist...");
    const response = await fetch(`${apiBaseUrl}/api/drafts/${selectedDraft.id}/assist`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: draftAssistTask,
        instruction: draftAssistInstruction.trim() || undefined,
      }),
    });

    setRunningDraftAssist(false);
    if (!response.ok) {
      setDraftAssistMessage(`Draft assist failed: ${response.status}`);
      return;
    }
    const record = (await response.json()) as DashboardDraftAssistRecord;
    setDraftAssistRecordsByDraftId((current) => ({
      ...current,
      [selectedDraft.id]: [record, ...(current[selectedDraft.id] ?? [])],
    }));
    setDraftAssistMessage("Suggestion ready for review.");
  }

  async function reviewDraftAssistRecord(
    record: DashboardDraftAssistRecord,
    decision: "reviewed" | "rejected",
  ): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/draft-assist/records/${record.id}/review`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) {
      setDraftAssistMessage(`Review update failed: ${response.status}`);
      return;
    }
    const updated = (await response.json()) as DashboardDraftAssistRecord;
    setDraftAssistRecordsByDraftId((current) => ({
      ...current,
      [updated.draftId ?? ""]: (current[updated.draftId ?? ""] ?? []).map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    }));
    setDraftAssistMessage(`Suggestion ${decision}.`);
  }

  function insertDraftAssistRecord(record: DashboardDraftAssistRecord): void {
    if (!draftEditorJson) return;
    setDraftEditorJson(insertDraftAssistSuggestion({ editorJson: draftEditorJson, record }));
    setDraftStatus("Inserted assist suggestion locally. Save the draft to persist it.");
  }

  async function createExternalUploadLink(): Promise<void> {
    if (!activeMatter) return;
    if (!externalUploadCreateAvailable) {
      setExternalUploadStatus(
        `Create unavailable: ${compactStatus(externalUploads.status.reason)}`,
      );
      return;
    }

    setCreatingExternalUpload(true);
    setExternalUploadToken("");
    setExternalUploadStatus("Creating link...");
    let payload: ExternalUploadCreateResponse;
    try {
      payload = await requestDashboardJson<ExternalUploadCreateResponse>(
        apiBaseUrl,
        "/api/external-uploads",
        {
          method: "POST",
          headers: devHeaders,
          payload: buildExternalUploadCreatePayload({
            matterId: activeMatter.id,
            maxUploads: externalUploadMaxUploads,
            expiresAtLocal: externalUploadExpiresAt,
          }),
        },
      );
    } catch (error) {
      setExternalUploadStatus(`Create failed: ${dashboardApiStatus(error)}`);
      setCreatingExternalUpload(false);
      return;
    }

    if (!payload.upload) {
      setExternalUploadStatus(`Not created: ${compactStatus(payload.reason)}`);
      setCreatingExternalUpload(false);
      return;
    }

    setExternalUploadsByMatterId((current) => upsertExternalUploadLink(current, payload.upload!));
    setExternalUploadToken(payload.token ?? "");
    setExternalUploadStatus(payload.token ? "Link created." : "Link created; token unavailable.");
    setCreatingExternalUpload(false);
  }

  async function revokeExternalUploadLink(uploadId: string): Promise<void> {
    setRevokingExternalUploadId(uploadId);
    setExternalUploadStatus("Revoking link...");
    const response = await fetch(`${apiBaseUrl}${buildExternalUploadRevokePath(uploadId)}`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      setExternalUploadStatus(`Revoke failed: ${response.status}`);
      setRevokingExternalUploadId("");
      return;
    }

    const payload = (await response.json()) as ExternalUploadRevokeResponse;
    setExternalUploadsByMatterId((current) => upsertExternalUploadLink(current, payload.upload));
    setExternalUploadStatus("Link revoked.");
    setRevokingExternalUploadId("");
  }

  async function reviewExternalUploadDocument(
    document: ExternalUploadReviewItem,
    decision: ExternalUploadReviewDecision,
  ): Promise<void> {
    const reason = externalUploadReviewReasonsByDocumentId[document.id];
    const note = externalUploadReviewNotesByDocumentId[document.id];
    setReviewingExternalUploadDocumentId(`${document.id}:${decision}`);
    setExternalUploadStatus("Updating upload review...");
    const response = await fetch(`${apiBaseUrl}${buildExternalUploadReviewPath(document.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildExternalUploadReviewPayload({
          decision,
          reason,
          duplicateOfDocumentId: document.duplicateOfDocumentId,
          note,
        }),
      ),
    });

    if (!response.ok) {
      setExternalUploadStatus(`Review update failed: ${response.status}`);
      setReviewingExternalUploadDocumentId("");
      return;
    }

    const payload = (await response.json()) as { reviewItem: ExternalUploadReviewItem };
    setExternalUploadDocumentsByMatterId((current) =>
      upsertExternalUploadDocument(current, payload.reviewItem),
    );
    setExternalUploadStatus("Upload review updated.");
    setExternalUploadReviewNotesByDocumentId((current) => ({ ...current, [document.id]: "" }));
    setReviewingExternalUploadDocumentId("");
  }

  async function refreshDocumentProcessingWorkbench(
    matterId: string,
    filters: DocumentMetadataSearchFilters = activeDocumentMetadataSearchFilters,
  ): Promise<DocumentProcessingWorkbenchResponse | null> {
    const response = await fetch(
      `${apiBaseUrl}${buildDocumentProcessingWorkbenchPath(matterId, filters)}`,
      {
        credentials: "include",
        headers: devHeaders,
      },
    );

    if (!response.ok) {
      const fallback = emptyDocumentProcessingWorkbench(
        matterId,
        response.status === 403 ? "access_denied" : "workbench_unavailable",
      );
      setDocumentProcessingByMatterId((current) =>
        replaceDocumentProcessingWorkbench(current, fallback),
      );
      return null;
    }

    const payload = (await response.json()) as DocumentProcessingWorkbenchResponse;
    setDocumentProcessingByMatterId((current) =>
      replaceDocumentProcessingWorkbench(current, payload),
    );
    return payload;
  }

  async function refreshDocumentMetadataSearch(
    filters: DocumentMetadataSearchFilters = activeDocumentMetadataSearchFilters,
  ): Promise<void> {
    if (!activeMatter) return;
    setDocumentProcessingStatus("Refreshing metadata search...");
    const refreshed = await refreshDocumentProcessingWorkbench(activeMatter.id, filters);
    setDocumentProcessingStatus(
      refreshed ? "Metadata search refreshed." : "Metadata search unavailable.",
    );
  }

  async function selectDocumentMetadataTag(tag: string): Promise<void> {
    const filters = { ...activeDocumentMetadataSearchFilters, tag };
    setDocumentMetadataTagFilter(tag);
    await refreshDocumentMetadataSearch(filters);
  }

  async function clearDocumentMetadataSearch(): Promise<void> {
    const filters: DocumentMetadataSearchFilters = {};
    setDocumentMetadataQuery("");
    setDocumentMetadataClassificationFilter("");
    setDocumentMetadataReviewStatusFilter("");
    setDocumentMetadataScanStatusFilter("");
    setDocumentMetadataOcrStatusFilter("");
    setDocumentMetadataCueGroupFilter("");
    setDocumentMetadataTagFilter("");
    await refreshDocumentMetadataSearch(filters);
  }

  async function queueDocumentOcr(documentId: string): Promise<void> {
    if (!activeMatter) return;
    setQueueingDocumentId(documentId);
    setDocumentProcessingStatus("Queueing OCR...");
    const response = await fetch(`${apiBaseUrl}${buildDocumentProcessingQueuePath(documentId)}`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task: "ocr", language: "eng" }),
    });

    if (!response.ok) {
      setDocumentProcessingStatus(`OCR queue failed: ${response.status}`);
      setQueueingDocumentId("");
      return;
    }

    const refreshed = await refreshDocumentProcessingWorkbench(activeMatter.id);
    setDocumentProcessingStatus(
      refreshed ? "OCR queued; workbench refreshed." : "OCR queued; workbench unavailable.",
    );
    setQueueingDocumentId("");
  }

  async function createCalendarCredential(): Promise<void> {
    setCreatingCalendarCredential(true);
    setCalendarOneTimeSecret(null);
    setCalendarCredentialStatus("Creating calendar app password...");
    let payload: CalendarCredentialCreateResponse;
    try {
      payload = await requestDashboardJson<CalendarCredentialCreateResponse>(
        apiBaseUrl,
        "/api/calendar/credentials",
        {
          method: "POST",
          headers: devHeaders,
          payload: { label: calendarCredentialLabel.trim() || "iOS Calendar" },
        },
      );
    } catch (error) {
      setCalendarCredentialStatus(
        `Calendar credential create failed: ${dashboardApiStatus(error)}`,
      );
      setCreatingCalendarCredential(false);
      return;
    }

    setCalendarCredentials((current) => upsertCalendarCredential(current, payload.credential));
    setCalendarOneTimeSecret(payload);
    setCalendarCredentialStatus("Calendar app password created.");
    setCreatingCalendarCredential(false);
  }

  async function revokeCalendarCredential(credentialId: string): Promise<void> {
    setRevokingCalendarCredentialId(credentialId);
    setCalendarCredentialStatus("Revoking calendar app password...");
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/credentials/${encodeURIComponent(credentialId)}/revoke`,
      {
        method: "POST",
        credentials: "include",
        headers: devHeaders,
      },
    );

    if (!response.ok) {
      setCalendarCredentialStatus(`Calendar credential revoke failed: ${response.status}`);
      setRevokingCalendarCredentialId("");
      return;
    }

    const payload = (await response.json()) as CalendarCredentialRevokeResponse;
    setCalendarCredentials((current) => upsertCalendarCredential(current, payload.credential));
    setCalendarCredentialStatus("Calendar app password revoked.");
    setRevokingCalendarCredentialId("");
  }

  function calendarDateTimePayload(value: string): string {
    return value ? new Date(value).toISOString() : "";
  }

  async function createCalendarEvent(): Promise<void> {
    if (!activeMatter) return;
    setCreatingCalendarEvent(true);
    setCalendarEventLifecycleStatus("Creating calendar event...");
    let payload: CalendarEventMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarEventMutationResponse>(
        apiBaseUrl,
        "/api/calendar/events",
        {
          method: "POST",
          headers: devHeaders,
          payload: buildCalendarEventPayload({
            matterId: activeMatter.id,
            title: calendarEventTitle,
            startsAt: calendarDateTimePayload(calendarEventStartsAt),
            endsAt: calendarDateTimePayload(calendarEventEndsAt),
            description: calendarEventDescription,
            location: calendarEventLocation,
            status: calendarEventStatusValue,
          }),
        },
      );
    } catch (error) {
      setCalendarEventLifecycleStatus(`Event create failed: ${dashboardApiStatus(error)}`);
      setCreatingCalendarEvent(false);
      return;
    }
    setCalendarEventsByMatterId((current) =>
      upsertCalendarEvent(current, activeMatter.id, payload.event),
    );
    setCalendarEventTitle("");
    setCalendarEventStartsAt("");
    setCalendarEventEndsAt("");
    setCalendarEventDescription("");
    setCalendarEventLocation("");
    setCalendarEventLifecycleStatus("Calendar event created.");
    setCreatingCalendarEvent(false);
  }

  async function rescheduleCalendarEvent(event: DashboardCalendarEvent): Promise<void> {
    if (!activeMatter || !calendarEventStartsAt || !calendarEventEndsAt) return;
    setUpdatingCalendarEventId(event.id);
    setCalendarEventLifecycleStatus("Rescheduling calendar event...");
    let payload: CalendarEventMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarEventMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(event.id)}/reschedule`,
        {
          method: "POST",
          headers: devHeaders,
          payload: buildCalendarReschedulePayload({
            matterId: activeMatter.id,
            startsAt: calendarDateTimePayload(calendarEventStartsAt),
            endsAt: calendarDateTimePayload(calendarEventEndsAt),
            status: event.status === "cancelled" ? "confirmed" : undefined,
          }),
        },
      );
    } catch (error) {
      setCalendarEventLifecycleStatus(`Event reschedule failed: ${dashboardApiStatus(error)}`);
      setUpdatingCalendarEventId("");
      return;
    }
    setCalendarEventsByMatterId((current) =>
      upsertCalendarEvent(current, activeMatter.id, payload.event),
    );
    setCalendarEventLifecycleStatus("Calendar event rescheduled.");
    setUpdatingCalendarEventId("");
  }

  async function cancelCalendarEvent(event: DashboardCalendarEvent): Promise<void> {
    if (!activeMatter) return;
    setCancelingCalendarEventId(event.id);
    setCalendarEventLifecycleStatus("Cancelling calendar event...");
    let payload: CalendarEventMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarEventMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(event.id)}/cancel`,
        {
          method: "POST",
          headers: devHeaders,
          payload: { matterId: activeMatter.id },
        },
      );
    } catch (error) {
      setCalendarEventLifecycleStatus(`Event cancel failed: ${dashboardApiStatus(error)}`);
      setCancelingCalendarEventId("");
      return;
    }
    setCalendarEventsByMatterId((current) =>
      upsertCalendarEvent(current, activeMatter.id, payload.event),
    );
    setCalendarEventLifecycleStatus("Calendar event cancelled.");
    setCancelingCalendarEventId("");
  }

  async function addCalendarReminder(): Promise<void> {
    if (!activeMatter || !selectedCalendarReminderEvent) return;
    setAddingCalendarReminder(true);
    setCalendarReminderStatus("Adding reminder...");
    let payload: CalendarReminderMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarReminderMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(selectedCalendarReminderEvent.id)}/reminders`,
        {
          method: "POST",
          headers: devHeaders,
          payload: buildCalendarReminderPayload({
            matterId: activeMatter.id,
            remindAt: calendarDateTimePayload(calendarReminderAt),
            status: calendarReminderStatusValue,
            note: calendarReminderNote,
          }),
        },
      );
    } catch (error) {
      setCalendarReminderStatus(`Reminder add failed: ${dashboardApiStatus(error)}`);
      setAddingCalendarReminder(false);
      return;
    }
    setCalendarEventsByMatterId((current) =>
      upsertCalendarEventReminder(
        current,
        activeMatter.id,
        selectedCalendarReminderEvent.id,
        payload.reminder,
      ),
    );
    setCalendarReminderAt("");
    setCalendarReminderNote("");
    setCalendarReminderStatus("Reminder added.");
    setAddingCalendarReminder(false);
  }

  async function updateCalendarReminder(
    eventId: string,
    reminderId: string,
    status: "pending" | "acknowledged" | "dismissed" | "cancelled",
  ): Promise<void> {
    if (!activeMatter) return;
    setUpdatingCalendarReminderId(reminderId);
    setCalendarReminderStatus("Updating reminder...");
    let payload: CalendarReminderMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarReminderMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(eventId)}/reminders/${encodeURIComponent(
          reminderId,
        )}`,
        {
          method: "PATCH",
          headers: devHeaders,
          payload: { matterId: activeMatter.id, status },
        },
      );
    } catch (error) {
      setCalendarReminderStatus(`Reminder update failed: ${dashboardApiStatus(error)}`);
      setUpdatingCalendarReminderId("");
      return;
    }
    setCalendarEventsByMatterId((current) =>
      upsertCalendarEventReminder(current, activeMatter.id, eventId, payload.reminder),
    );
    setCalendarReminderStatus("Reminder updated.");
    setUpdatingCalendarReminderId("");
  }

  async function removeCalendarReminder(eventId: string, reminderId: string): Promise<void> {
    if (!activeMatter) return;
    setRemovingCalendarReminderId(reminderId);
    setCalendarReminderStatus("Removing reminder...");
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(
        eventId,
      )}/reminders/${encodeURIComponent(reminderId)}?matterId=${encodeURIComponent(
        activeMatter.id,
      )}`,
      { method: "DELETE", credentials: "include", headers: devHeaders },
    );
    if (!response.ok) {
      setCalendarReminderStatus(`Reminder remove failed: ${response.status}`);
      setRemovingCalendarReminderId("");
      return;
    }
    setCalendarEventsByMatterId((current) =>
      removeCalendarEventReminder(current, activeMatter.id, eventId, reminderId),
    );
    setCalendarReminderStatus("Reminder removed.");
    setRemovingCalendarReminderId("");
  }

  async function addCalendarAttendee(): Promise<void> {
    if (!activeMatter || !selectedCalendarMeetingEvent) return;
    setAddingCalendarAttendee(true);
    setCalendarMeetingStatus("Adding attendee...");
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(
        selectedCalendarMeetingEvent.id,
      )}/attendees`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matterId: activeMatter.id,
          name: calendarAttendeeName.trim(),
          email: calendarAttendeeEmail.trim(),
          role: calendarAttendeeRole,
        }),
      },
    );

    if (!response.ok) {
      setCalendarMeetingStatus(`Attendee add failed: ${response.status}`);
      setAddingCalendarAttendee(false);
      return;
    }

    const payload = (await response.json()) as CalendarAttendeeMutationResponse;
    setCalendarEventsByMatterId((current) =>
      upsertCalendarEventAttendee(
        current,
        activeMatter.id,
        selectedCalendarMeetingEvent.id,
        payload.attendee,
      ),
    );
    setCalendarAttendeeName("");
    setCalendarAttendeeEmail("");
    setCalendarMeetingStatus("Attendee added.");
    setAddingCalendarAttendee(false);
  }

  async function removeCalendarAttendee(eventId: string, attendeeId: string): Promise<void> {
    if (!activeMatter) return;
    setRemovingCalendarAttendeeId(attendeeId);
    setCalendarMeetingStatus("Removing attendee...");
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(
        eventId,
      )}/attendees/${encodeURIComponent(attendeeId)}?matterId=${encodeURIComponent(
        activeMatter.id,
      )}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: devHeaders,
      },
    );

    if (!response.ok) {
      setCalendarMeetingStatus(`Attendee remove failed: ${response.status}`);
      setRemovingCalendarAttendeeId("");
      return;
    }

    setCalendarEventsByMatterId((current) =>
      removeCalendarEventAttendee(current, activeMatter.id, eventId, attendeeId),
    );
    setCalendarMeetingStatus("Attendee removed.");
    setRemovingCalendarAttendeeId("");
  }

  function calendarMeetingLinkModeValue(event: DashboardCalendarEvent): CalendarMeetingLinkMode {
    return calendarMeetingLinkModesByEventId[event.id] ?? event.meetingLinkMode ?? "blank";
  }

  function calendarMeetingLinkUrlValue(event: DashboardCalendarEvent): string {
    return calendarMeetingLinkUrlsByEventId[event.id] ?? event.meetingLinkUrl ?? "";
  }

  async function updateCalendarMeetingLink(event: DashboardCalendarEvent): Promise<void> {
    if (!activeMatter) return;
    const mode = calendarMeetingLinkModeValue(event);
    const externalUrl = calendarMeetingLinkUrlValue(event);
    setUpdatingCalendarMeetingLinkEventId(event.id);
    setCalendarMeetingStatus("Updating meeting link...");
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(event.id)}/meeting-link`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildCalendarMeetingLinkPayload({
            matterId: activeMatter.id,
            mode,
            externalUrl,
          }),
        ),
      },
    );

    if (!response.ok) {
      setCalendarMeetingStatus(`Meeting link update failed: ${response.status}`);
      setUpdatingCalendarMeetingLinkEventId("");
      return;
    }

    const payload = (await response.json()) as CalendarMeetingLinkMutationResponse;
    setCalendarEventsByMatterId((current) => ({
      ...current,
      [activeMatter.id]: (current[activeMatter.id] ?? []).map((candidate) =>
        candidate.id === payload.event.id ? payload.event : candidate,
      ),
    }));
    setCalendarMeetingLinkModesByEventId((current) => {
      const next = { ...current };
      delete next[event.id];
      return next;
    });
    setCalendarMeetingLinkUrlsByEventId((current) => {
      const next = { ...current };
      delete next[event.id];
      return next;
    });
    setCalendarMeetingStatus(
      payload.event.meetingLinkUrl ? "Meeting link saved." : "Meeting link cleared.",
    );
    setUpdatingCalendarMeetingLinkEventId("");
  }

  function syncCalendarGuestSession(session: CalendarGuestSessionSummary): void {
    setCalendarGuestSessionsByEventId((current) => upsertCalendarGuestSession(current, session));
  }

  async function createCalendarGuestSession(event: DashboardCalendarEvent): Promise<void> {
    if (!activeMatter) return;
    setCreatingCalendarGuestSessionEventId(event.id);
    setCalendarGuestSessionSecret(null);
    setCalendarGuestSessionStatus("Creating guest lobby...");
    let payload: CalendarGuestSessionMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarGuestSessionMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(event.id)}/guest-sessions`,
        {
          method: "POST",
          headers: devHeaders,
          payload: { matterId: activeMatter.id },
        },
      );
    } catch (error) {
      setCalendarGuestSessionStatus(`Guest lobby create failed: ${dashboardApiStatus(error)}`);
      setCreatingCalendarGuestSessionEventId("");
      return;
    }
    syncCalendarGuestSession(payload.session);
    setCalendarGuestSessionStatus("Guest lobby ready.");
    setCreatingCalendarGuestSessionEventId("");
  }

  async function controlCalendarGuestSession(
    event: DashboardCalendarEvent,
    session: CalendarGuestSessionSummary,
    action: "open" | "lock" | "end",
  ): Promise<void> {
    if (!activeMatter) return;
    const actionKey = `${session.id}:${action}`;
    setUpdatingCalendarGuestSessionKey(actionKey);
    setCalendarGuestSessionSecret(null);
    setCalendarGuestSessionStatus(
      action === "open"
        ? "Opening guest lobby..."
        : action === "lock"
          ? "Locking guest lobby..."
          : "Ending guest lobby...",
    );
    let payload: CalendarGuestSessionMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarGuestSessionMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(event.id)}/guest-sessions/${encodeURIComponent(
          session.id,
        )}/${action}`,
        {
          method: "POST",
          headers: devHeaders,
          payload: { matterId: activeMatter.id },
        },
      );
    } catch (error) {
      setCalendarGuestSessionStatus(`Guest lobby action failed: ${dashboardApiStatus(error)}`);
      setUpdatingCalendarGuestSessionKey("");
      return;
    }
    syncCalendarGuestSession(payload.session);
    setCalendarGuestSessionStatus(
      action === "open"
        ? "Guest lobby opened."
        : action === "lock"
          ? "Guest lobby locked."
          : "Guest lobby ended.",
    );
    setUpdatingCalendarGuestSessionKey("");
  }

  async function issueCalendarGuestLink(
    event: DashboardCalendarEvent,
    session: CalendarGuestSessionSummary,
  ): Promise<void> {
    if (!activeMatter) return;
    const actionKey = `${session.id}:issue`;
    setUpdatingCalendarGuestSessionKey(actionKey);
    setCalendarGuestSessionSecret(null);
    setCalendarGuestSessionStatus("Issuing guest access...");
    let payload: CalendarGuestSessionIssueResponse;
    try {
      payload = await requestDashboardJson<CalendarGuestSessionIssueResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(event.id)}/guest-sessions/${encodeURIComponent(
          session.id,
        )}/guest-links`,
        {
          method: "POST",
          headers: devHeaders,
          payload: { matterId: activeMatter.id },
        },
      );
    } catch (error) {
      setCalendarGuestSessionStatus(`Guest access issue failed: ${dashboardApiStatus(error)}`);
      setUpdatingCalendarGuestSessionKey("");
      return;
    }
    syncCalendarGuestSession(payload.session);
    setCalendarGuestSessionSecret(payload);
    setCalendarGuestSessionStatus("Guest access issued. Copy it now; it will not be shown again.");
    setUpdatingCalendarGuestSessionKey("");
  }

  async function updateCalendarGuestLink(
    event: DashboardCalendarEvent,
    session: CalendarGuestSessionSummary,
    guestId: string,
    action: "admit" | "deny" | "revoke",
  ): Promise<void> {
    if (!activeMatter) return;
    const actionKey = `${guestId}:${action}`;
    setUpdatingCalendarGuestSessionKey(actionKey);
    setCalendarGuestSessionStatus(
      action === "admit"
        ? "Admitting guest..."
        : action === "deny"
          ? "Denying guest..."
          : "Revoking guest access...",
    );
    let payload: CalendarGuestSessionGuestMutationResponse;
    try {
      payload = await requestDashboardJson<CalendarGuestSessionGuestMutationResponse>(
        apiBaseUrl,
        `/api/calendar/events/${encodeURIComponent(event.id)}/guest-sessions/${encodeURIComponent(
          session.id,
        )}/guests/${encodeURIComponent(guestId)}/${action}`,
        {
          method: "POST",
          headers: devHeaders,
          payload: { matterId: activeMatter.id },
        },
      );
    } catch (error) {
      setCalendarGuestSessionStatus(`Guest access update failed: ${dashboardApiStatus(error)}`);
      setUpdatingCalendarGuestSessionKey("");
      return;
    }
    if (payload.session) syncCalendarGuestSession(payload.session);
    setCalendarGuestSessionStatus(
      action === "admit"
        ? "Guest admitted."
        : action === "deny"
          ? "Guest denied."
          : "Guest access revoked.",
    );
    setUpdatingCalendarGuestSessionKey("");
  }

  function calendarInvitationProviderState(
    event: DashboardCalendarEvent,
    includeMeetingLink = false,
  ): string {
    const emailBoundary = event.meetingInvitationBoundary?.invitationEmail;
    const meetingDetail = includeMeetingLink
      ? event.meetingLinkUrl
        ? " The stored meeting link will be included."
        : " No meeting link is set; the link request will stay unavailable."
      : "";
    if (emailBoundary?.status === "configured") {
      return `SMTP provider ${emailBoundary.provider ?? "configured"} will queue eligible invitations.${meetingDetail}`;
    }
    return `SMTP is not configured; the API will mark invitation email skipped.${meetingDetail}`;
  }

  function openCalendarInvitationConfirmation(
    event: DashboardCalendarEvent,
    options: { includeMeetingLink?: boolean } = {},
  ): void {
    if (!activeMatter) return;
    const includeMeetingLink = options.includeMeetingLink === true && Boolean(event.meetingLinkUrl);
    const recipients = (event.attendees ?? []).map((attendee) => attendee.email);
    setPendingDeliveryConfirmation({
      kind: "calendar-invitations",
      key: `${event.id}:${includeMeetingLink ? "meeting-link" : "plain"}`,
      eventId: event.id,
      includeMeetingLink,
      actionLabel: includeMeetingLink
        ? "Send meeting-link invitations"
        : "Send calendar invitations",
      matterLabel: activeMatter.number,
      summary: `${includeMeetingLink ? "Meeting-link invitation" : "Calendar invitation"}: ${
        event.title
      }`,
      providerState: calendarInvitationProviderState(event, includeMeetingLink),
      recipients,
    });
  }

  async function sendCalendarInvitations(
    eventId: string,
    recipientCount: number,
    includeMeetingLink = false,
  ): Promise<void> {
    if (!activeMatter) return;
    setSendingCalendarInvitationsEventId(eventId);
    setPendingDeliveryConfirmation(null);
    setCalendarMeetingStatus(
      includeMeetingLink ? "Sending meeting-link invitations..." : "Sending invitations...",
    );
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(eventId)}/invitations`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildCalendarInvitationPayload({
            matterId: activeMatter.id,
            recipientCount,
            includeMeetingLink,
          }),
        ),
      },
    );

    if (!response.ok) {
      setCalendarMeetingStatus(`Invitation send failed: ${response.status}`);
      setSendingCalendarInvitationsEventId("");
      return;
    }

    const payload = (await response.json()) as CalendarInvitationResponse;
    const meetingInvitationBoundary = payload.meetingInvitationBoundary;
    setCalendarEventsByMatterId((current) => {
      const next = payload.results.reduce(
        (next, result) =>
          upsertCalendarEventAttendee(next, activeMatter.id, eventId, result.attendee),
        current,
      );
      if (!meetingInvitationBoundary) return next;
      return {
        ...next,
        [activeMatter.id]: (next[activeMatter.id] ?? []).map((event) =>
          event.id === eventId ? { ...event, meetingInvitationBoundary } : event,
        ),
      };
    });
    const queued = payload.results.filter(
      (result) => result.attendee.invitationStatus === "queued",
    ).length;
    const skipped = payload.results.filter(
      (result) => result.attendee.invitationStatus === "skipped",
    ).length;
    setCalendarMeetingStatus(
      includeMeetingLink
        ? `${queued} meeting-link invitation queued; ${skipped} skipped.`
        : `${queued} invitation queued; ${skipped} skipped.`,
    );
    setSendingCalendarInvitationsEventId("");
  }

  function openIntakeSessionConfirmation(): void {
    if (!activeMatter || !selectedIntakeTemplate) return;
    setPendingDeliveryConfirmation({
      kind: "intake-session-start",
      key: `${activeMatter.id}:${selectedIntakeTemplate.id}`,
      actionLabel: "Start intake session",
      matterLabel: activeMatter.number,
      summary: `Staff notice for ${selectedIntakeTemplate.name}`,
      providerState: "SMTP availability is checked by the API before queueing the staff notice.",
      recipients: [session.user.email],
    });
  }

  function confirmPendingDelivery(): void {
    if (!pendingDeliveryConfirmation) return;
    if (pendingDeliveryConfirmation.kind === "calendar-invitations") {
      void sendCalendarInvitations(
        pendingDeliveryConfirmation.eventId,
        pendingDeliveryConfirmation.recipients.length,
        pendingDeliveryConfirmation.includeMeetingLink === true,
      );
      return;
    }
    void startIntakeSession(pendingDeliveryConfirmation.recipients.length);
  }

  function selectIntakeTemplate(templateId: string): void {
    const template = intakeTemplates.find((candidate) => candidate.id === templateId);
    setSelectedIntakeTemplateId(templateId);
    setIntakeTemplateName(template?.name ?? "New intake form");
    setIntakeTemplateDefinition(coerceIntakeDefinitionV2(template));
    setIntakeTemplateStatus(template ? `Editing ${template.name}.` : "Template editor ready.");
    setIntakePreviewAnswers({});
    setIntakePreviewResult(null);
    setIntakePreviewStatus("Preview checks have not run.");
  }

  function startNewIntakeTemplate(): void {
    setSelectedIntakeTemplateId("");
    setIntakeTemplateName("New intake form");
    setIntakeTemplateDefinition(coerceIntakeDefinitionV2());
    setIntakeTemplateStatus("New template ready.");
    setIntakePreviewAnswers({});
    setIntakePreviewResult(null);
    setIntakePreviewStatus("Preview checks have not run.");
  }

  function updateIntakePreviewAnswer(questionId: string, value: string | boolean): void {
    setIntakePreviewAnswers((current) => ({ ...current, [questionId]: value }));
    setIntakePreviewResult(null);
    setIntakePreviewStatus("Preview answers changed; run checks again.");
  }

  async function previewIntakeTemplate(): Promise<void> {
    if (!activeMatter) return;
    setPreviewingIntakeTemplate(true);
    setIntakePreviewStatus("Running preview checks...");
    const response = await fetch(`${apiBaseUrl}/api/intake-templates/preview`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildIntakeTemplatePreviewPayload({
          definition: intakeTemplateDefinition,
          matterId: activeMatter.id,
          answers: intakePreviewAnswers,
        }),
      ),
    });

    if (!response.ok) {
      setIntakePreviewStatus(`Preview failed: ${response.status}`);
      setPreviewingIntakeTemplate(false);
      return;
    }

    const result = (await response.json()) as IntakeTemplatePreviewResponse;
    setIntakePreviewResult(result);
    setIntakePreviewStatus(describeIntakeTemplatePreview(result));
    setPreviewingIntakeTemplate(false);
  }

  async function saveIntakeTemplate(): Promise<void> {
    setSavingIntakeTemplate(true);
    setIntakeTemplateStatus("Saving template...");

    const payload: IntakeTemplateSavePayload = {
      name: intakeTemplateName.trim() || "Untitled intake form",
      active: true,
      definitionVersion: intakeTemplateDefinition.schemaVersion,
      definition: intakeTemplateDefinition,
    };
    const url = selectedIntakeTemplateId
      ? `${apiBaseUrl}/api/intake-templates/${encodeURIComponent(selectedIntakeTemplateId)}`
      : `${apiBaseUrl}/api/intake-templates`;
    const response = await fetch(url, {
      method: selectedIntakeTemplateId ? "PATCH" : "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setIntakeTemplateStatus(`Template save failed: ${response.status}`);
      setSavingIntakeTemplate(false);
      return;
    }

    const savedTemplate = (await response.json()) as IntakeSessionsResponse["templates"][number];
    setIntakeTemplates((current) =>
      current.some((template) => template.id === savedTemplate.id)
        ? current.map((template) => (template.id === savedTemplate.id ? savedTemplate : template))
        : [savedTemplate, ...current],
    );
    setSelectedIntakeTemplateId(savedTemplate.id);
    setIntakeTemplateName(savedTemplate.name);
    setIntakeTemplateDefinition(coerceIntakeDefinitionV2(savedTemplate));
    setIntakeTemplateStatus(`Saved ${savedTemplate.name}.`);
    setSavingIntakeTemplate(false);
  }

  async function createIntakeFormLink(): Promise<void> {
    if (!activeMatter) return;
    const sessionRecord = activeIntakeSessions[0];
    if (!sessionRecord) {
      setIntakeFormStatus("Create failed: no intake session for this matter.");
      return;
    }

    setCreatingIntakeFormLink(true);
    setIntakeFormToken("");
    setIntakeFormPortalUrl("");
    setIntakeFormStatus("Creating form link...");
    const response = await fetch(`${apiBaseUrl}/api/intake-form-links`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildIntakeFormLinkCreatePayload({
          intakeSessionId: sessionRecord.id,
          expiresAtLocal: intakeFormExpiresAt,
        }),
      ),
    });

    if (!response.ok) {
      setIntakeFormStatus(`Create failed: ${response.status}`);
      setCreatingIntakeFormLink(false);
      return;
    }

    const payload = (await response.json()) as IntakeFormLinkCreateResponse;
    setIntakeFormLinksByMatterId((current) => upsertIntakeFormLink(current, payload.link));
    setIntakeFormToken(payload.token ?? "");
    setIntakeFormPortalUrl(payload.portalUrl ?? "");
    setIntakeFormStatus(
      payload.portalUrl ? "Form link created." : "Form link created; URL unavailable.",
    );
    setCreatingIntakeFormLink(false);
  }

  async function startIntakeSession(recipientCount: number): Promise<void> {
    if (!activeMatter || !selectedIntakeTemplate) return;

    setStartingIntakeSession(true);
    setPendingDeliveryConfirmation(null);
    setIntakeFormToken("");
    setIntakeFormPortalUrl("");
    setIntakeFormStatus("Starting intake session...");

    try {
      const response = await fetch(`${apiBaseUrl}/api/intake-sessions`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildIntakeSessionCreatePayload({
            matter: activeMatter,
            template: selectedIntakeTemplate,
            deliveryConfirmation: buildEmailDeliveryConfirmation(recipientCount),
          }),
        ),
      });

      if (!response.ok) {
        setIntakeFormStatus(`Start failed: ${response.status}`);
        return;
      }

      const payload = (await response.json()) as IntakeSessionCreateResponse;
      setIntakeSessions((current) => upsertIntakeSession(current, payload));
      setIntakeFormStatus(
        `Intake session started with ${selectedIntakeTemplate.name}. Create a form link when ready.`,
      );
    } catch {
      setIntakeFormStatus("Start failed: network");
    } finally {
      setStartingIntakeSession(false);
    }
  }

  async function revokeIntakeFormLink(linkId: string): Promise<void> {
    setRevokingIntakeFormLinkId(linkId);
    setIntakeFormStatus("Revoking form link...");
    const response = await fetch(
      `${apiBaseUrl}/api/intake-form-links/${encodeURIComponent(linkId)}/revoke`,
      {
        method: "POST",
        credentials: "include",
        headers: devHeaders,
      },
    );

    if (!response.ok) {
      setIntakeFormStatus(`Revoke failed: ${response.status}`);
      setRevokingIntakeFormLinkId("");
      return;
    }

    const payload = (await response.json()) as IntakeFormLinkRevokeResponse;
    if (payload.link) {
      setIntakeFormLinksByMatterId((current) => upsertIntakeFormLink(current, payload.link!));
    }
    setIntakeFormStatus("Form link revoked.");
    setRevokingIntakeFormLinkId("");
  }

  async function loadSubmittedIntakeReview(linkId: string): Promise<void> {
    setLoadingIntakeReviewLinkId(linkId);
    setIntakeFormStatus("Loading submitted intake review...");
    try {
      const payload = await requestDashboardJson<IntakeFormReviewLoadResponse>(
        apiBaseUrl,
        buildIntakeFormReviewPath(linkId),
        {
          headers: devHeaders,
        },
      );
      setIntakeReviewDetailsByLinkId((current) => ({ ...current, [linkId]: payload }));
      setIntakeFormLinksByMatterId((current) => upsertIntakeFormLink(current, payload.link));
      setIntakeFormStatus(
        payload.reviews.length > 0
          ? "Submitted intake review already has a decision."
          : "Submitted intake review loaded.",
      );
    } catch (error) {
      setIntakeFormStatus(`Review load failed: ${dashboardApiStatus(error)}`);
    } finally {
      setLoadingIntakeReviewLinkId("");
    }
  }

  async function decideSubmittedIntakeReview(
    linkId: string,
    decision: "accept" | "reject" | "request-more-info",
  ): Promise<void> {
    const reason = intakeReviewReasons[linkId]?.trim() ?? "";
    if ((decision === "reject" || decision === "request-more-info") && reason.length === 0) {
      setIntakeFormStatus("Review decision failed: add a reason.");
      return;
    }

    setReviewingIntakeFormLinkId(`${linkId}:${decision}`);
    setIntakeFormStatus("Recording submitted intake review...");
    setIntakeFormToken("");
    setIntakeFormPortalUrl("");
    try {
      const payload = await requestDashboardJson<IntakeFormReviewResponse>(
        apiBaseUrl,
        buildIntakeFormReviewDecisionPath(linkId, decision),
        {
          method: "POST",
          headers: devHeaders,
          payload: reason ? { reason } : {},
        },
      );
      setIntakeReviewDetailsByLinkId((current) => {
        const existing = current[linkId];
        if (!existing) return current;
        return {
          ...current,
          [linkId]: {
            ...existing,
            reviews: [payload.review, ...existing.reviews],
          },
        };
      });
      if (payload.followUp?.link) {
        setIntakeFormLinksByMatterId((current) =>
          upsertIntakeFormLink(current, payload.followUp!.link),
        );
      }
      setIntakeReviewReasons((current) => ({ ...current, [linkId]: "" }));
      setIntakeFormToken(payload.followUp?.token ?? "");
      setIntakeFormPortalUrl(payload.followUp?.portalUrl ?? "");
      setIntakeFormStatus(
        decision === "request-more-info"
          ? describeRequestMoreInfoResult(payload)
          : `Submitted intake review ${payload.review.decision.replaceAll("_", " ")}.`,
      );
    } catch (error) {
      setIntakeFormStatus(`Review decision failed: ${dashboardApiStatus(error)}`);
    } finally {
      setReviewingIntakeFormLinkId("");
    }
  }

  async function reviewIntakeVariableProposal(
    proposal: DashboardIntakeVariableProposal,
    status: "approved" | "rejected",
  ): Promise<void> {
    const rejectionReason = proposalRejectionReasons[proposal.id]?.trim() ?? "";
    if (status === "rejected" && rejectionReason.length === 0) {
      setIntakeFormStatus("Reject failed: add a rejection reason.");
      return;
    }
    setReviewingIntakeProposalId(proposal.id);
    setIntakeFormStatus(status === "approved" ? "Approving proposal..." : "Rejecting proposal...");
    const response = await fetch(
      `${apiBaseUrl}/api/intake-variable-proposals/${encodeURIComponent(proposal.id)}/${status === "approved" ? "approve" : "reject"}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: status === "rejected" ? JSON.stringify({ reason: rejectionReason }) : "{}",
      },
    );

    if (!response.ok) {
      setIntakeFormStatus(`Proposal review failed: ${response.status}`);
      setReviewingIntakeProposalId("");
      return;
    }

    const reviewed = (await response.json()) as DashboardIntakeVariableProposal;
    setIntakeVariableProposalsByMatterId((current) =>
      upsertIntakeVariableProposal(current, reviewed),
    );
    setProposalRejectionReasons((current) => ({ ...current, [proposal.id]: "" }));
    setIntakeFormStatus(status === "approved" ? "Proposal approved." : "Proposal rejected.");
    setReviewingIntakeProposalId("");
  }

  function selectMatter(matterId: string): void {
    setActiveMatterId(matterId);
    setShareOneTimeToken("");
    setExternalUploadToken("");
    setExternalUploadStatus("No link created.");
    setCalendarOneTimeSecret(null);
    setIntakeFormToken("");
    setIntakeFormPortalUrl("");
    setIntakeFormStatus("No form link created.");
    setIntakePreviewResult(null);
    setIntakePreviewStatus("Preview checks have not run.");
    setIntakeReviewReasons({});
    setPendingDeliveryConfirmation(null);
    closeDraftEditor();
  }

  function updateFirstMatterForm<Field extends keyof FirstMatterFormState>(
    field: Field,
    value: FirstMatterFormState[Field],
  ): void {
    setFirstMatterForm((current) => ({ ...current, [field]: value }));
  }

  async function createFirstMatter(): Promise<void> {
    if (!canCreateMatter || !canSubmitFirstMatter(firstMatterForm)) return;

    setCreatingFirstMatter(true);
    setFirstMatterStatus("Creating matter...");
    try {
      const created = await requestDashboardJson<MatterSummary>(apiBaseUrl, "/api/matters", {
        method: "POST",
        headers: devHeaders,
        payload: buildCreateMatterPayload(firstMatterForm),
      });

      setMatters((current) => [created, ...current.filter((matter) => matter.id !== created.id)]);
      setActiveMatterId(created.id);
      setDraftsByMatterId((current) => ({ ...current, [created.id]: current[created.id] ?? [] }));
      setExternalUploadsByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? [],
      }));
      setExternalUploadDocumentsByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? [],
      }));
      setDocumentProcessingByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? emptyDocumentProcessingWorkbench(created.id),
      }));
      setCalendarEventsByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? [],
      }));
      setIntakeFormLinksByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? [],
      }));
      setIntakeVariableProposalsByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? [],
      }));
      setTrustControlsByMatterId((current) => ({
        ...current,
        [created.id]: current[created.id] ?? emptyTrustControlsDashboard(),
      }));
      setBillingDashboard((current) => ({
        ...current,
        matters: current.matters.some((matter) => matter.matterId === created.id)
          ? current.matters
          : [
              {
                matterId: created.id,
                unbilledTime: [],
                unbilledExpenses: [],
                invoices: [],
                payments: [],
              },
              ...current.matters,
            ],
      }));
      setFirstMatterForm(initialFirstMatterFormState);
      setFirstMatterStatus(`${created.number} created.`);
      shouldFocusDetailRef.current = true;
      setActiveSection("matters");
      if (typeof window !== "undefined") {
        window.history.pushState(
          { section: "matters" },
          "",
          buildDashboardSectionUrl(window.location.href, "matters"),
        );
      }
    } catch (error) {
      setFirstMatterStatus(`Matter creation failed: ${dashboardApiStatus(error)}`);
    } finally {
      setCreatingFirstMatter(false);
    }
  }

  function toggleSharePermission(permission: ShareLinkPermission): void {
    setSharePermissions((current) => {
      if (current.includes(permission)) {
        return current.length === 1
          ? current
          : current.filter((candidate) => candidate !== permission);
      }
      return [...current, permission];
    });
  }

  async function createShareLink(): Promise<void> {
    if (!activeMatter || shareLinksStatus.createStatus !== "enabled") return;

    setCreatingShare(true);
    setShareStatus("Creating share link...");
    let payload: CreateShareLinkResponse;
    try {
      payload = await requestDashboardJson<CreateShareLinkResponse>(apiBaseUrl, "/api/shares", {
        method: "POST",
        headers: devHeaders,
        payload: buildCreateShareLinkPayload({
          matterId: activeMatter.id,
          permissions: sharePermissions,
          expiresAt: shareExpiresAt,
          notificationEmail: shareNotificationEmail,
          requireEmailVerification,
        }),
      });
    } catch (error) {
      setShareStatus(`Share link creation failed: ${dashboardApiStatus(error)}`);
      setCreatingShare(false);
      return;
    }

    if (!payload.share) {
      setShareStatus(
        payload.reason
          ? `Share link creation unavailable: ${payload.reason}`
          : "Share link creation unavailable.",
      );
      setCreatingShare(false);
      return;
    }

    const createdShare = payload.share;
    setSharesByMatterId((current) => ({
      ...current,
      [activeMatter.id]: [createdShare, ...(current[activeMatter.id] ?? [])],
    }));
    setShareOneTimeToken(payload.token ?? "");
    setShareStatus(describeCreateShareLinkResult(payload));
    setCreatingShare(false);
  }

  async function revokeShareLink(share: ShareLinkRecord): Promise<void> {
    setRevokingShareId(share.id);
    setShareStatus("Revoking share link...");
    const response = await fetch(
      `${apiBaseUrl}/api/shares/${encodeURIComponent(share.id)}/revoke`,
      {
        method: "POST",
        credentials: "include",
        headers: devHeaders,
      },
    );

    if (!response.ok) {
      setShareStatus(`Share link revoke failed: ${response.status}`);
      setRevokingShareId("");
      return;
    }

    const payload = (await response.json()) as RevokeShareLinkResponse;
    setSharesByMatterId((current) => ({
      ...current,
      [payload.share.matterId]: replaceShareLink(
        current[payload.share.matterId] ?? [],
        payload.share,
      ),
    }));
    setShareStatus("Share link revoked.");
    setRevokingShareId("");
  }

  async function saveQueueOperationalViewDefinition(): Promise<void> {
    setSavingOperationalView(true);
    setSavedOperationalViewStatus("Saving queue view...");
    try {
      const payload = await requestDashboardJson<{ definition: SavedOperationalViewDefinition }>(
        apiBaseUrl,
        "/api/operational-views/definitions",
        {
          method: "POST",
          headers: devHeaders,
          payload: {
            surface: "queues",
            name: `Queue focus ${queueOperationalViewDefinitions.length + 1}`,
            filters: {
              source: "dashboard-queues",
              queueSections: displayedQueues.sections.map((section) => section.key),
            },
            columns: ["title", "status", "priority"],
            sort: { priority: "desc" },
            rowLimit: 25,
            dashboardBehavior: { pinToFocus: true },
            permissionScope: ["matter:read"],
          },
        },
      );
      setSavedOperationalViewDefinitions((current) => [payload.definition, ...current]);
      setActiveSavedOperationalViewId(payload.definition.id);
      setSavedOperationalViewStatus("Queue view saved.");
    } catch (error) {
      setSavedOperationalViewStatus(`Queue view save failed: ${dashboardApiStatus(error)}`);
    } finally {
      setSavingOperationalView(false);
    }
  }

  async function saveMatterPresetViewDefinition(): Promise<void> {
    const preset =
      getSavedMatterPresetDefinition(selectedMatterViewPresetFamily) ??
      savedMatterPresetOptions[0]!;
    setSavingMatterView(true);
    setSavedMatterViewStatus(`Saving matter ${preset.summaryLabel} view...`);
    try {
      const payload = await requestDashboardJson<{ definition: SavedOperationalViewDefinition }>(
        apiBaseUrl,
        "/api/operational-views/definitions",
        {
          method: "POST",
          headers: devHeaders,
          payload: {
            surface: "matters",
            name: `${preset.namePrefix} ${matterOperationalViewDefinitions.length + 1}`,
            filters: {
              source: "dashboard-matters",
              presetFamily: preset.family,
              operationalViewKeys: [...preset.operationalViewKeys],
              statuses: [...preset.statuses],
            },
            columns: ["number", "practiceArea", "status"],
            sort: preset.sort,
            rowLimit: 12,
            dashboardBehavior: { pinToMatterContext: true },
            permissionScope: ["matter:read"],
          },
        },
      );
      setSavedOperationalViewDefinitions((current) => [payload.definition, ...current]);
      setActiveSavedMatterViewId(payload.definition.id);
      const focusedMatters = applySavedMatterFocus(matters, payload.definition, operationalViews);
      if (focusedMatters[0]) setActiveMatterId(focusedMatters[0].id);
      setSavedMatterViewStatus(
        describeSavedMatterFocus(payload.definition, matters, operationalViews),
      );
    } catch (error) {
      setSavedMatterViewStatus(`Matter view save failed: ${dashboardApiStatus(error)}`);
    } finally {
      setSavingMatterView(false);
    }
  }

  async function archiveQueueOperationalViewDefinition(
    definition: SavedOperationalViewDefinition,
  ): Promise<void> {
    setArchivingOperationalViewId(definition.id);
    setSavedOperationalViewStatus(`Archiving ${definition.name}...`);
    try {
      const payload = await requestDashboardJson<{ definition: SavedOperationalViewDefinition }>(
        apiBaseUrl,
        `/api/operational-views/definitions/${encodeURIComponent(definition.id)}/archive`,
        {
          method: "POST",
          headers: devHeaders,
        },
      );
      setSavedOperationalViewDefinitions((current) =>
        current.filter((candidate) => candidate.id !== payload.definition.id),
      );
      if (activeSavedOperationalViewId === payload.definition.id) {
        setActiveSavedOperationalViewId("");
      }
      setSavedOperationalViewStatus("Queue view archived.");
    } catch (error) {
      setSavedOperationalViewStatus(`Queue view archive failed: ${dashboardApiStatus(error)}`);
    } finally {
      setArchivingOperationalViewId("");
    }
  }

  function applyQueueOperationalViewDefinition(definition: SavedOperationalViewDefinition): void {
    setActiveSavedOperationalViewId(definition.id);
    setSavedOperationalViewStatus(describeSavedQueueFocus(definition, queues));
  }

  function clearQueueOperationalViewDefinition(): void {
    setActiveSavedOperationalViewId("");
    setSavedOperationalViewStatus("Showing all authorized queue sections.");
  }

  async function archiveMatterOperationalViewDefinition(
    definition: SavedOperationalViewDefinition,
  ): Promise<void> {
    setArchivingMatterViewId(definition.id);
    setSavedMatterViewStatus(`Archiving ${definition.name}...`);
    try {
      const payload = await requestDashboardJson<{ definition: SavedOperationalViewDefinition }>(
        apiBaseUrl,
        `/api/operational-views/definitions/${encodeURIComponent(definition.id)}/archive`,
        {
          method: "POST",
          headers: devHeaders,
        },
      );
      setSavedOperationalViewDefinitions((current) =>
        current.filter((candidate) => candidate.id !== payload.definition.id),
      );
      if (activeSavedMatterViewId === payload.definition.id) {
        setActiveSavedMatterViewId("");
      }
      setSavedMatterViewStatus("Matter view archived.");
    } catch (error) {
      setSavedMatterViewStatus(`Matter view archive failed: ${dashboardApiStatus(error)}`);
    } finally {
      setArchivingMatterViewId("");
    }
  }

  function applyMatterOperationalViewDefinition(definition: SavedOperationalViewDefinition): void {
    setActiveSavedMatterViewId(definition.id);
    const focusedMatters = applySavedMatterFocus(matters, definition, operationalViews);
    if (focusedMatters[0]) setActiveMatterId(focusedMatters[0].id);
    setSavedMatterViewStatus(describeSavedMatterFocus(definition, matters, operationalViews));
  }

  function selectDashboardSection(sectionKey: LocalDashboardSectionKey): void {
    shouldFocusDetailRef.current = true;
    setActiveSection(sectionKey);
    window.history.pushState(
      { section: sectionKey },
      "",
      buildDashboardSectionUrl(window.location.href, sectionKey),
    );
  }

  if (!activeMatter) {
    return (
      <main className="app-shell dashboard-shell legal-ops-shell" aria-labelledby="dashboard-title">
        <a className="skip-link" href="#matter-workspace">
          Skip to workspace
        </a>
        <DashboardSidebar
          activeSection={activeSection}
          navigationSections={navigationSections}
          navIcons={navIcons}
          onSelectSection={selectDashboardSection}
        />

        <section className="workspace dashboard-workspace zero-matter-workspace">
          <DashboardTopbar
            firmName={overview.firm.name}
            session={session}
            formatProfessionalRole={formatProfessionalRoleLabel}
          />

          <DashboardMetrics metrics={metrics} />

          <OperationalFocusPanel
            operationalFocus={operationalFocus}
            operationalFocusEmpty={operationalFocusEmpty}
            onOpenQueues={() => selectDashboardSection("queues")}
          />

          <section className="main-grid matter-workspace-grid zero-matter-workspace-grid">
            {activeSection === "contacts" ? (
              <article
                aria-labelledby="zero-contacts-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Contact operations</p>
                    <h2 id="zero-contacts-title">Contacts</h2>
                  </div>
                  <span className="status-chip">Firm surface</span>
                </div>
                <ContactsSection
                  activeContactDossier={activeContactDossier}
                  canRecordContactDataQualityResolution={canRecordContactDataQualityResolution}
                  compactStatus={compactStatus}
                  contactDossiers={contactDossiers}
                  contactDataQualityResolutions={activeContactDataQualityResolutions}
                  contactDataQualityStatus={contactDataQualityStatus}
                  contactReviewQueue={contactReviewQueue}
                  contactSearch={contactSearch}
                  filteredContactDossiers={filteredContactDossiers}
                  onRecordContactDataQualityResolution={recordContactDataQualityResolution}
                  onContactSearchChange={setContactSearch}
                  onPrepareConflictCheckFromContact={prepareConflictCheckFromContact}
                  onSelectContact={setActiveContactId}
                  onSelectMatter={selectMatter}
                  recordingContactResolutionKey={recordingContactResolutionKey}
                />
              </article>
            ) : null}

            {activeSection === "audit" ? (
              <article
                aria-labelledby="zero-audit-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Audit review</p>
                    <h2 id="zero-audit-title">Audit activity</h2>
                  </div>
                  <span className="status-chip">
                    {auditProjection.valid === false ? "Chain invalid" : "Read-only"}
                  </span>
                </div>
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
                    onClick={() => void refreshAuditLane()}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    {auditRefreshState.refreshing ? "Refreshing" : auditFreshnessCue.label}
                  </button>
                </div>
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
                      <strong>{auditProjectionIssues.unknownActionCount}</strong>
                      <small>Unknown actions</small>
                    </span>
                    <span>
                      <strong>{auditProjectionIssues.matterScopeGapCount}</strong>
                      <small>Matter-scope gaps</small>
                    </span>
                    <span>
                      <strong>{auditProjectionIssues.resourceTypeMismatchCount}</strong>
                      <small>Resource-type mismatches</small>
                    </span>
                  </div>
                </div>
              </article>
            ) : null}

            {activeSection === "queues" ? (
              <article
                aria-labelledby="zero-queues-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Operational queues</p>
                    <h2 id="zero-queues-title">Queues</h2>
                  </div>
                  <span className="status-chip">Firm surface</span>
                </div>
                <QueuesSection
                  activeSavedOperationalViewDefinition={activeSavedOperationalViewDefinition}
                  activeSavedOperationalViewId={activeSavedOperationalViewId}
                  activeWorkerRuns={activeWorkerRuns}
                  archivingOperationalViewId={archivingOperationalViewId}
                  compactDate={compactDate}
                  compactProviderStatus={compactProviderStatus}
                  compactStatus={compactStatus}
                  connectorOperations={connectorOperations}
                  connectorRecoveryBusyKey={connectorRecoveryBusyKey}
                  connectorRecoveryNow={freshnessNow}
                  connectorRecoveryStatus={connectorRecoveryStatus}
                  connectorOperationsSummary={connectorOperationsSummary}
                  displayedQueues={displayedQueues}
                  formatSavedOperationalViewDefinition={formatSavedOperationalViewDefinition}
                  formatWorkerRunAttempts={formatWorkerRunAttempts}
                  formatWorkerRunTiming={formatWorkerRunTiming}
                  canManageDocumentProcessingProvider={canManageDocumentProcessingProvider}
                  ocrProviderUpdateStatus={ocrProviderUpdateStatus}
                  ocrProviderUpdating={ocrProviderUpdating}
                  onApplyQueueOperationalViewDefinition={applyQueueOperationalViewDefinition}
                  onArchiveQueueOperationalViewDefinition={archiveQueueOperationalViewDefinition}
                  onCancelConnectorRecovery={cancelConnectorRecovery}
                  onClearQueueOperationalViewDefinition={clearQueueOperationalViewDefinition}
                  onConfirmConnectorRecovery={() => void confirmConnectorRecovery()}
                  onRefreshProviders={() => void refreshProviderLane()}
                  onRefreshQueues={() => void refreshQueueLane()}
                  onRequestConnectorRecovery={requestConnectorRecovery}
                  onSaveQueueOperationalViewDefinition={saveQueueOperationalViewDefinition}
                  onSelectMatter={selectMatter}
                  onSetOcrProviderEnabled={(enabled) => void setOcrProviderEnabled(enabled)}
                  onWorkerRunFilterChange={setWorkerRunFilter}
                  providerFreshnessCue={providerFreshnessCue}
                  providerRows={providerRows}
                  providerStatus={providerStatus}
                  providerStatusSummary={providerStatusSummary}
                  providerRefreshing={providerRefreshState.refreshing}
                  canManageConnectorRecovery={canManageConnectorRecovery}
                  pendingConnectorRecovery={pendingConnectorRecovery}
                  queueFreshnessCue={queueFreshnessCue}
                  queueSummary={queueSummary}
                  queueRefreshing={queueRefreshState.refreshing}
                  savedOperationalViewDefinitions={queueOperationalViewDefinitions}
                  savedOperationalViewStatus={savedOperationalViewStatus}
                  savingOperationalView={savingOperationalView}
                  taskDeadlineSummary={taskDeadlineSummary}
                  taskWorkbench={taskWorkbench}
                  workerHealth={workerHealth}
                  workerHealthStateTone={workerHealthStateTone}
                  workerHealthSummary={workerHealthSummary}
                  workerRunFilter={workerRunFilter}
                  workerRunFilterOptions={workerRunFilters}
                  workerRunSafeContext={workerRunSafeContext}
                  workerRunStatus={describeWorkerRunStatus}
                  workerRunSummary={workerRunSummary}
                />
              </article>
            ) : null}

            {activeSection !== "contacts" &&
            activeSection !== "audit" &&
            activeSection !== "queues" ? (
              <FirstMatterWorkspace
                canCreateMatter={canCreateMatter}
                creating={creatingFirstMatter}
                form={firstMatterForm}
                onChange={updateFirstMatterForm}
                onCreate={() => void createFirstMatter()}
                status={firstMatterStatus}
              />
            ) : null}

            <ContextRail
              conflictAliases={conflictAliases}
              conflictIdentifiers={conflictIdentifiers}
              conflictName={conflictName}
              conflictProspectiveRole={conflictProspectiveRole}
              conflictResults={conflictResults}
              conflictStatus={conflictStatus}
              queueSummary={queueSummary}
              queues={queues}
              taskDeadlineSummary={taskDeadlineSummary}
              onConflictAliasesChange={setConflictAliases}
              onConflictIdentifiersChange={setConflictIdentifiers}
              onConflictNameChange={setConflictName}
              onConflictProspectiveRoleChange={setConflictProspectiveRole}
              onRunConflictCheck={runConflictCheck}
            />
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell dashboard-shell legal-ops-shell" aria-labelledby="dashboard-title">
      <a className="skip-link" href="#matter-workspace">
        Skip to matter workspace
      </a>
      <DashboardSidebar
        activeSection={activeSection}
        navigationSections={navigationSections}
        navIcons={navIcons}
        onSelectSection={selectDashboardSection}
      />

      <section className="workspace dashboard-workspace">
        <DashboardTopbar
          firmName={overview.firm.name}
          session={session}
          formatProfessionalRole={formatProfessionalRoleLabel}
        />

        <DashboardMetrics metrics={metrics} />

        <OperationalFocusPanel
          operationalFocus={operationalFocus}
          operationalFocusEmpty={operationalFocusEmpty}
          onOpenQueues={() => selectDashboardSection("queues")}
        />

        <MatterContextPanel
          activeMatter={activeMatter}
          activeSavedMatterViewId={activeSavedMatterViewId}
          archivingSavedMatterViewId={archivingMatterViewId}
          filteredMatters={filteredMatters}
          formatSavedMatterViewDefinition={formatSavedMatterViewDefinition}
          matterSearch={matterSearch}
          matterPresetOptions={savedMatterPresetOptions}
          onArchiveSavedMatterView={archiveMatterOperationalViewDefinition}
          onApplySavedMatterView={applyMatterOperationalViewDefinition}
          onMatterSearchChange={setMatterSearch}
          onMatterPresetFamilyChange={setSelectedMatterViewPresetFamily}
          onSelectMatter={selectMatter}
          onSaveMatterView={saveMatterPresetViewDefinition}
          savedMatterViewDefinitions={matterOperationalViewDefinitions}
          savedMatterViewStatus={savedMatterViewStatus}
          savingMatterView={savingMatterView}
          selectedMatterPresetFamily={selectedMatterViewPresetFamily}
        />

        <section className="main-grid matter-workspace-grid">
          <MatterDetailShell
            activeMatter={activeMatter}
            activeSection={activeSection}
            activeSectionLabel={activeSectionLabel}
            detailPanelRef={detailPanelRef}
            matterActionSections={matterActionSections}
            onSelectSection={selectDashboardSection}
          >
            {activeSection === "matters" ? (
              <MatterOverviewSection
                activeActivitySummary={activeActivitySummary}
                activeCommunicationsInbox={activeCommunicationsInbox}
                activeEmailDeliveries={activeEmailDeliveries}
                activeLegalClinicProfile={activeLegalClinicProfile}
                activeLegalClinicProgram={activeLegalClinicProgram}
                activeMatter={activeMatter}
                activeMatterCommandCenter={activeMatterCommandCenter}
                activityKindFilter={activityKindFilter}
                activityStatusFilter={activityStatusFilter}
                filteredMatterActivity={filteredMatterActivity}
                navigationSections={navigationSections}
                overview={overview}
                compactDate={compactDate}
                compactStatus={compactStatus}
                formatCurrency={cents}
                formatMinutes={minutes}
                onActivityKindFilterChange={setActivityKindFilter}
                onActivityStatusFilterChange={setActivityStatusFilter}
                onSelectSection={selectDashboardSection}
              />
            ) : null}

            {activeSection === "contacts" ? (
              <ContactsSection
                activeContactDossier={activeContactDossier}
                canRecordContactDataQualityResolution={canRecordContactDataQualityResolution}
                compactStatus={compactStatus}
                contactDossiers={contactDossiers}
                contactDataQualityResolutions={activeContactDataQualityResolutions}
                contactDataQualityStatus={contactDataQualityStatus}
                contactReviewQueue={contactReviewQueue}
                contactSearch={contactSearch}
                filteredContactDossiers={filteredContactDossiers}
                onRecordContactDataQualityResolution={recordContactDataQualityResolution}
                onContactSearchChange={setContactSearch}
                onPrepareConflictCheckFromContact={prepareConflictCheckFromContact}
                onSelectContact={setActiveContactId}
                onSelectMatter={selectMatter}
                recordingContactResolutionKey={recordingContactResolutionKey}
              />
            ) : null}

            {activeSection === "funds" ? (
              <>
                <div className="detail-grid billing-summary-grid">
                  <div>
                    <span className="field-label">Matter trust balance</span>
                    <strong>{cents(activeTrustBalanceCents)}</strong>
                  </div>
                  <div>
                    <span className="field-label">Pending maker-checker</span>
                    <strong>{trustReviewSummary.pendingApprovalCount}</strong>
                  </div>
                  <div>
                    <span className="field-label">Rejected decisions</span>
                    <strong>{trustReviewSummary.rejectedApprovalCount}</strong>
                  </div>
                  <div>
                    <span className="field-label">Exceptions</span>
                    <strong>{trustReviewSummary.exceptionReconciliationCount}</strong>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Trust controls workbench</h3>
                  <span>{trustControlsStatus}</span>
                </div>
                <div className="activity-grid two-column">
                  <div className="activity-card">
                    <Banknote size={18} />
                    <strong>{activeTrustControls.ledger.accounts.length} accounts</strong>
                    <span>{activeTrustControls.ledger.entries.length} matter-scoped entries</span>
                  </div>
                  <div className="activity-card">
                    <ShieldCheck size={18} />
                    <strong>{trustReviewSummary.totalApprovalCount} decisions</strong>
                    <span>{trustReviewSummary.approvedApprovalCount} approved review records</span>
                  </div>
                  <div className="activity-card">
                    <AlertTriangle size={18} />
                    <strong>{trustReviewSummary.unreconciledAccountCount} unreconciled</strong>
                    <span>{trustReviewSummary.overdrawnBalanceCount} overdrawn diagnostics</span>
                  </div>
                  <div className="activity-card">
                    <FileText size={18} />
                    <strong>{trustReviewSummary.importedStatementRowCount} statement rows</strong>
                    <span>
                      {trustReviewSummary.matchedStatementRowCount} matched ·{" "}
                      {trustReviewSummary.unmatchedStatementRowCount} unmatched
                    </span>
                  </div>
                  <div className="activity-card">
                    <Clock3 size={18} />
                    <strong>{activeTrustPostings.length} recent postings</strong>
                    <span>{cents(trustReviewSummary.totalVarianceCents)} total variance</span>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Jurisdiction trust report</h3>
                  <span>operator review only · not jurisdiction-certified</span>
                </div>
                <div className="activity-grid two-column">
                  <div className="activity-card">
                    <ShieldCheck size={18} />
                    <strong>{activeJurisdictionTrustSummary.jurisdiction}</strong>
                    <span>{activeJurisdictionTrustSummary.matterCount} matters in report</span>
                  </div>
                  <div className="activity-card">
                    <Banknote size={18} />
                    <strong>{cents(activeJurisdictionTrustSummary.trustBalanceCents)}</strong>
                    <span>aggregate recorded trust balance</span>
                  </div>
                  <div className="activity-card">
                    <AlertTriangle size={18} />
                    <strong>
                      {activeJurisdictionTrustSummary.exceptionReconciliationCount} exceptions
                    </strong>
                    <span>
                      {activeJurisdictionTrustSummary.unreconciledAccountCount} unreconciled ·{" "}
                      {activeJurisdictionTrustSummary.overdrawnBalanceCount} overdrawn
                    </span>
                  </div>
                  <div className="activity-card">
                    <FileText size={18} />
                    <strong>
                      {activeJurisdictionTrustSummary.importedStatementRowCount} statement rows
                    </strong>
                    <span>
                      {activeJurisdictionTrustSummary.matchedStatementRowCount} matched ·{" "}
                      {activeJurisdictionTrustSummary.unmatchedStatementRowCount} unmatched ·{" "}
                      {cents(activeJurisdictionTrustSummary.totalVarianceCents)} variance
                    </span>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Recent postings</h3>
                  <span>{activeTrustPostings.length} shown</span>
                </div>
                <div className="party-list">
                  {activeTrustPostings.map((posting) => (
                    <div className="party-row" key={posting.transactionId}>
                      <span>
                        <strong>{posting.memo}</strong>
                        <small>
                          {posting.transactionId} · {posting.entryCount} entries ·{" "}
                          {compactDate(posting.postedAt)}
                        </small>
                      </span>
                      <em className={posting.matterDeltaCents < 0 ? "risk" : undefined}>
                        {cents(posting.matterDeltaCents)}
                      </em>
                    </div>
                  ))}
                  {activeTrustPostings.length === 0 ? (
                    <p className="inline-empty">
                      No trust ledger postings are linked to this matter yet.
                    </p>
                  ) : null}
                </div>

                <div className="section-title">
                  <h3>Reconciliation exceptions</h3>
                  <span>
                    {exceptionReconciliations.length} exceptions · {unreconciledAccounts.length}{" "}
                    unreconciled accounts
                  </span>
                </div>
                <div className="party-list">
                  {exceptionReconciliations.slice(0, 4).map((reconciliation) => (
                    <div className="party-row" key={reconciliation.id}>
                      <span>
                        <strong>
                          {accountLabel(activeTrustControls, reconciliation.accountId)}
                        </strong>
                        <small>
                          {compactStatus(reconciliation.status)} ·{" "}
                          {compactDate(reconciliation.statementPeriodEnd)} ·{" "}
                          {reconciliation.statementRows.length} statement rows
                        </small>
                        <small>
                          opening {cents(reconciliation.beginningBalanceCents)} · closing{" "}
                          {cents(reconciliation.endingBalanceCents)}
                        </small>
                        {reconciliation.varianceExplanation ? (
                          <small>{reconciliation.varianceExplanation}</small>
                        ) : null}
                      </span>
                      <em className="risk">
                        {cents(
                          reconciliation.actualBalanceCents - reconciliation.expectedBalanceCents,
                        )}
                      </em>
                    </div>
                  ))}
                  {unreconciledAccounts.slice(0, 4).map((account) => (
                    <div className="party-row" key={account.id}>
                      <span>
                        <strong>{account.label}</strong>
                        <small>{account.id}</small>
                      </span>
                      <em className="risk">unreconciled</em>
                    </div>
                  ))}
                  {exceptionReconciliations.length === 0 && unreconciledAccounts.length === 0 ? (
                    <p className="inline-empty">
                      No reconciliation exceptions or unreconciled trust accounts are present in the
                      current controls payload.
                    </p>
                  ) : null}
                </div>

                <div className="section-title">
                  <h3>Diagnostics</h3>
                  <span>operator review only</span>
                </div>
                <div className="party-list">
                  <div className="party-row">
                    <span>
                      <strong>Pending approval transaction IDs</strong>
                      <small>
                        {activeTrustControls.diagnostics.pendingApprovalTransactionIds.join(", ") ||
                          "none"}
                      </small>
                    </span>
                    <em>{trustReviewSummary.pendingApprovalCount}</em>
                  </div>
                  <div className="party-row">
                    <span>
                      <strong>Rejected approval transaction IDs</strong>
                      <small>
                        {activeTrustControls.diagnostics.rejectedApprovalTransactionIds.join(
                          ", ",
                        ) || "none"}
                      </small>
                    </span>
                    <em
                      className={trustReviewSummary.rejectedApprovalCount > 0 ? "risk" : undefined}
                    >
                      {trustReviewSummary.rejectedApprovalCount}
                    </em>
                  </div>
                  <div className="party-row">
                    <span>
                      <strong>Overdrawn balance keys</strong>
                      <small>
                        {activeTrustControls.diagnostics.overdrawnBalanceKeys.join(", ") || "none"}
                      </small>
                    </span>
                    <em
                      className={trustReviewSummary.overdrawnBalanceCount > 0 ? "risk" : undefined}
                    >
                      {trustReviewSummary.overdrawnBalanceCount}
                    </em>
                  </div>
                </div>
              </>
            ) : null}

            {activeSection === "billing" ? (
              billingDashboard.canView ? (
                <>
                  <div className="detail-grid billing-summary-grid">
                    <div>
                      <span className="field-label">Approved time</span>
                      <strong>{cents(activeUnbilledTimeCents)}</strong>
                    </div>
                    <div>
                      <span className="field-label">Approved expenses</span>
                      <strong>{cents(activeUnbilledExpenseCents)}</strong>
                    </div>
                    <div>
                      <span className="field-label">Draft / issued invoices</span>
                      <strong>
                        {
                          activeInvoices.filter((invoice) =>
                            ["draft", "issued"].includes(invoice.status),
                          ).length
                        }
                      </strong>
                    </div>
                    <div>
                      <span className="field-label">Balance due</span>
                      <strong>{cents(activeBalanceDueCents)}</strong>
                    </div>
                    <div>
                      <span className="field-label">Locked periods</span>
                      <strong>
                        {billingDashboard.summary.activeLockedPeriodCount}/
                        {billingDashboard.summary.lockedPeriodCount}
                      </strong>
                    </div>
                    <div>
                      <span className="field-label">Active rate rules</span>
                      <strong>{billingDashboard.summary.activeRateRuleCount}</strong>
                    </div>
                  </div>

                  <div className="section-title">
                    <h3>Billing controls</h3>
                    <span>
                      {billingDashboard.periodLocks.length + billingDashboard.rateRules.length}{" "}
                      records
                    </span>
                  </div>
                  <div className="party-list">
                    {billingDashboard.periodLocks.map((lock) => (
                      <div className="party-row" key={lock.id}>
                        <span>
                          <strong>{lock.reason ?? "Locked billing period"}</strong>
                          <small>
                            {new Date(lock.periodStart).toLocaleDateString("en-CA")} -{" "}
                            {new Date(lock.periodEnd).toLocaleDateString("en-CA")}
                          </small>
                        </span>
                        <em>locked</em>
                      </div>
                    ))}
                    {billingDashboard.rateRules.map((rule) => (
                      <div className="party-row" key={rule.id}>
                        <span>
                          <strong>{rule.label}</strong>
                          <small>
                            {rule.scope}
                            {rule.matterId ? ` · ${rule.matterId}` : ""}
                            {rule.userId ? ` · ${rule.userId}` : ""}
                          </small>
                        </span>
                        <em>{cents(rule.rateCents)}/hr</em>
                      </div>
                    ))}
                    {billingDashboard.periodLocks.length === 0 &&
                    billingDashboard.rateRules.length === 0 ? (
                      <p className="inline-empty">No billing locks or rate rules are active.</p>
                    ) : null}
                  </div>

                  <div className="section-title">
                    <h3>Create draft invoice</h3>
                    <span>{activeMatter.number}</span>
                  </div>
                  <div className="billing-action-row">
                    <label className="search-field compact">
                      <span>Due date</span>
                      <input
                        disabled={creatingDraftInvoice}
                        onChange={(event) => setDraftInvoiceDueAt(event.target.value)}
                        type="date"
                        value={draftInvoiceDueAt}
                      />
                    </label>
                    <label className="search-field compact">
                      <span>Tax label</span>
                      <input
                        disabled={creatingDraftInvoice}
                        onChange={(event) => setDraftInvoiceTaxName(event.target.value)}
                        placeholder="GST"
                        value={draftInvoiceTaxName}
                      />
                    </label>
                    <label className="search-field compact">
                      <span>Tax rate %</span>
                      <input
                        disabled={creatingDraftInvoice}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) => setDraftInvoiceTaxRate(event.target.value)}
                        step={0.01}
                        type="number"
                        value={draftInvoiceTaxRate}
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={creatingDraftInvoice || !canCreateDraftInvoice}
                      onClick={() => void createDraftInvoice()}
                      type="button"
                    >
                      <FileText size={16} />
                      {creatingDraftInvoice ? "Creating..." : "Create draft"}
                    </button>
                  </div>
                  <p aria-atomic="true" aria-live="polite" className="inline-empty" role="status">
                    {draftInvoiceStatus}
                  </p>

                  <div className="section-title">
                    <h3>Unbilled approved time and expenses</h3>
                    <span>{cents(activeUnbilledTimeCents + activeUnbilledExpenseCents)}</span>
                  </div>
                  <div className="party-list">
                    {activeUnbilledTime.map((entry) => (
                      <div className="party-row" key={entry.id}>
                        <span>
                          <strong>{entry.narrative}</strong>
                          <small>
                            {minutes(entry.minutes)} · {cents(entry.rateCents)}/hr
                            {entry.rateSnapshot?.source === "rate_rule"
                              ? ` · ${entry.rateSnapshot.label ?? "rate rule"}`
                              : " · manual rate"}
                          </small>
                        </span>
                        <em>{cents(entry.amountCents)}</em>
                      </div>
                    ))}
                    {activeUnbilledExpenses.map((entry) => (
                      <div className="party-row" key={entry.id}>
                        <span>
                          <strong>{entry.description}</strong>
                          <small>{entry.category}</small>
                        </span>
                        <em>{cents(entry.amountCents)}</em>
                      </div>
                    ))}
                    {activeUnbilledTime.length === 0 && activeUnbilledExpenses.length === 0 ? (
                      <p className="inline-empty">
                        No approved unbilled time or reimbursable expenses are linked to this
                        matter.
                      </p>
                    ) : null}
                  </div>

                  <div className="section-title">
                    <h3>Invoices and balances</h3>
                    <span>{activeInvoices.length} records</span>
                  </div>
                  <div className="party-list">
                    {activeInvoices.map((invoice) => (
                      <div className="party-row" key={invoice.id}>
                        <span>
                          <strong>{invoice.number}</strong>
                          <small>
                            {invoice.status}
                            {invoice.dueAt
                              ? ` · due ${new Date(invoice.dueAt).toLocaleDateString("en-CA")}`
                              : ""}
                          </small>
                        </span>
                        <em className={invoice.balanceDueCents > 0 ? "risk" : undefined}>
                          {cents(invoice.balanceDueCents)}
                        </em>
                      </div>
                    ))}
                    {activeInvoices.length === 0 ? (
                      <p className="inline-empty">
                        No draft or issued invoices are linked to this matter.
                      </p>
                    ) : null}
                  </div>

                  <div className="section-title">
                    <h3>Manual payment history</h3>
                    <span>{activeManualPayments.length} payments</span>
                  </div>
                  <div className="party-list">
                    {activeManualPayments.map((payment) => (
                      <div className="party-row" key={payment.id}>
                        <span>
                          <strong>{payment.reference ?? "Manual payment"}</strong>
                          <small>{new Date(payment.receivedAt).toLocaleDateString("en-CA")}</small>
                        </span>
                        <em>{cents(payment.amountCents)}</em>
                      </div>
                    ))}
                    {activeManualPayments.length === 0 ? (
                      <p className="inline-empty">
                        No manual payments have been recorded for this matter.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="inline-empty">
                  Billing details are hidden for {formatProfessionalRoleLabel(session.user.role)}{" "}
                  users.
                </p>
              )
            ) : null}

            {activeSection === "documents" ? (
              <>
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Workbench</span>
                    <strong>
                      {compactDocumentProcessingReason(activeDocumentProcessing.status)}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Provider state</span>
                    <strong>
                      {
                        activeDocumentProcessing.providerStatus.filter(
                          (provider) => provider.status === "configured",
                        ).length
                      }
                      /{activeDocumentProcessing.providerStatus.length}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Worker queues</span>
                    <strong>
                      {
                        activeDocumentProcessing.workerQueues.filter(
                          (queue) => queue.status === "configured",
                        ).length
                      }
                      /
                      {
                        activeDocumentProcessing.workerQueues.filter(
                          (queue) => queue.status !== "reserved",
                        ).length
                      }
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Jobs</span>
                    <strong>
                      {activeDocumentProcessing.summary.queued +
                        activeDocumentProcessing.summary.active}{" "}
                      active · {activeDocumentProcessing.summary.failed} failed
                    </strong>
                  </div>
                </div>
                <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
                  {documentProcessingStatus} {documentProcessingSummary}{" "}
                  {documentReviewSuggestionsSummary}
                </p>
                <div className="document-metadata-search-panel">
                  <label className="search-field compact">
                    <span>Metadata search</span>
                    <input
                      onChange={(event) => setDocumentMetadataQuery(event.target.value)}
                      placeholder="title, cue, status"
                      value={documentMetadataQuery}
                    />
                  </label>
                  <label className="search-field compact">
                    <span>Classification</span>
                    <select
                      onChange={(event) =>
                        setDocumentMetadataClassificationFilter(event.target.value)
                      }
                      value={documentMetadataClassificationFilter}
                    >
                      <option value="">Any</option>
                      {documentMetadataClassificationOptions.map((option) => (
                        <option key={option} value={option}>
                          {compactDocumentProcessingReason(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="search-field compact">
                    <span>Review</span>
                    <select
                      onChange={(event) =>
                        setDocumentMetadataReviewStatusFilter(event.target.value)
                      }
                      value={documentMetadataReviewStatusFilter}
                    >
                      <option value="">Any</option>
                      {documentMetadataReviewStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {compactDocumentProcessingReason(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="search-field compact">
                    <span>Scan</span>
                    <select
                      onChange={(event) => setDocumentMetadataScanStatusFilter(event.target.value)}
                      value={documentMetadataScanStatusFilter}
                    >
                      <option value="">Any</option>
                      {documentMetadataScanStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {compactDocumentProcessingReason(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="search-field compact">
                    <span>OCR</span>
                    <select
                      onChange={(event) => setDocumentMetadataOcrStatusFilter(event.target.value)}
                      value={documentMetadataOcrStatusFilter}
                    >
                      <option value="">Any</option>
                      {documentMetadataOcrStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {compactDocumentProcessingReason(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="search-field compact">
                    <span>Cue</span>
                    <select
                      onChange={(event) => setDocumentMetadataCueGroupFilter(event.target.value)}
                      value={documentMetadataCueGroupFilter}
                    >
                      <option value="">Any</option>
                      {documentMetadataCueGroupOptions.map((option) => (
                        <option key={option} value={option}>
                          {compactDocumentProcessingReason(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="document-metadata-search-actions">
                    <span>{activeDocumentMetadataFilterCount} active filters</span>
                    <button
                      className="secondary-button compact-button"
                      onClick={() => void refreshDocumentMetadataSearch()}
                      type="button"
                    >
                      <Search aria-hidden="true" size={16} />
                      Search
                    </button>
                    <button
                      className="secondary-button compact-button"
                      disabled={activeDocumentMetadataFilterCount === 0}
                      onClick={() => void clearDocumentMetadataSearch()}
                      type="button"
                    >
                      <X aria-hidden="true" size={16} />
                      Clear
                    </button>
                  </div>
                </div>
                <p className="inline-empty">{documentMetadataSearchSummary}</p>
                {activeDocumentMetadataTags.length > 0 ? (
                  <div className="document-metadata-tags" aria-label="Document metadata tags">
                    {activeDocumentMetadataTags.map((tag) => (
                      <button
                        className={`metadata-tag ${tag.tone}`}
                        key={tag.key}
                        onClick={() => void selectDocumentMetadataTag(tag.key)}
                        type="button"
                      >
                        {compactDocumentMetadataTag(tag)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeDocumentMetadataFilterCount > 0 ? (
                  <div className="party-list document-metadata-results">
                    {(activeDocumentProcessing.metadataSearch?.results ?? []).map((result) => (
                      <div className="party-row" key={result.documentId}>
                        <span>
                          <strong>{result.title}</strong>
                          <small>
                            {compactDocumentProcessingReason(result.classification)} · review{" "}
                            {compactDocumentProcessingReason(result.reviewStatus)} · scan{" "}
                            {compactDocumentProcessingReason(result.scanStatus)} · OCR{" "}
                            {compactDocumentProcessingReason(result.ocrStatus)}
                          </small>
                          <small>
                            {result.matchedFields.length > 0
                              ? `Matched ${result.matchedFields.join(", ")}`
                              : "Metadata posture match"}{" "}
                            · {result.tagKeys.length} tag cues · {result.cueCounts.total} reviewer
                            cues
                          </small>
                        </span>
                        <em>{result.legalHold ? "legal hold" : "review only"}</em>
                      </div>
                    ))}
                    {activeDocumentProcessing.metadataSearch?.results.length === 0 ? (
                      <p className="inline-empty">No document metadata matches.</p>
                    ) : null}
                  </div>
                ) : null}

                {activeDocumentProcessing.providerStatus.length > 0 ? (
                  <>
                    <div className="section-title">
                      <h3>Providers and workers</h3>
                      <span>{activeMatter.number}</span>
                    </div>
                    <div className="party-list">
                      {activeDocumentProcessing.providerStatus.map((provider) => (
                        <div className="party-row" key={`provider:${provider.kind}`}>
                          <span>
                            <strong>{compactDocumentProcessingReason(provider.kind)}</strong>
                            <small>
                              {compactDocumentProcessingReason(provider.reason)} ·{" "}
                              {provider.providers?.filter((candidate) => candidate.enabled)
                                .length ?? 0}{" "}
                              enabled providers
                            </small>
                          </span>
                          <em className={provider.status === "disabled" ? "risk" : undefined}>
                            {compactDocumentProcessingReason(provider.status)}
                          </em>
                        </div>
                      ))}
                      {activeDocumentProcessing.workerQueues.map((queue) => (
                        <div className="party-row" key={`queue:${queue.queueName}`}>
                          <span>
                            <strong>{compactDocumentProcessingReason(queue.queueName)}</strong>
                            <small>
                              {queue.status === "reserved"
                                ? `reserved ${compactDocumentProcessingReason(queue.task)}`
                                : "actionable"}
                              {queue.reason
                                ? ` · ${compactDocumentProcessingReason(queue.reason)}`
                                : ""}
                            </small>
                          </span>
                          <em className={queue.status === "not_configured" ? "risk" : undefined}>
                            {compactDocumentProcessingReason(queue.status)}
                          </em>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="section-title">
                  <h3>Document processing workbench</h3>
                  <span>{activeDocumentProcessingRows.length} documents</span>
                </div>
                <div className="party-list queue-section-list">
                  {documentProcessingGroupOrder.map((group) => {
                    const groupRows = activeDocumentProcessingRows.filter(
                      (item) => item.group === group,
                    );
                    if (groupRows.length === 0) return null;
                    return (
                      <section className="queue-section" key={group}>
                        <div className="section-title">
                          <h3>{documentProcessingGroupLabel(group)}</h3>
                          <span>{groupRows.length}</span>
                        </div>
                        {groupRows.map((item) => {
                          const action = describeDocumentQueueAction(
                            item,
                            activeDocumentProcessing,
                          );
                          const job = describeLatestDocumentJob(item.latestJob);
                          const reviewSuggestions =
                            item.reviewSuggestions ?? emptyDocumentReviewSuggestions();
                          return (
                            <div className="party-row upload-review-row" key={item.document.id}>
                              <span>
                                <strong>{item.document.title}</strong>
                                <small>
                                  v{item.document.version} ·{" "}
                                  {compactDocumentProcessingReason(item.document.classification)} ·{" "}
                                  upload{" "}
                                  {compactDocumentProcessingReason(item.document.uploadStatus)} ·
                                  checksum{" "}
                                  {compactDocumentProcessingReason(item.document.checksumStatus)} ·
                                  scan {compactDocumentProcessingReason(item.document.scanStatus)} ·
                                  review{" "}
                                  {compactDocumentProcessingReason(item.document.reviewStatus)}
                                  {item.document.legalHold ? " · legal hold" : ""}
                                </small>
                                <small>
                                  Job {job.label} ·{" "}
                                  {describeLatestExtraction(item.latestExtraction)}
                                  {item.latestJob?.errorSummary
                                    ? ` · ${item.latestJob.errorSummary}`
                                    : ""}
                                </small>
                                {item.metadataTags?.length ? (
                                  <small>
                                    Tags{" "}
                                    {item.metadataTags
                                      .slice(0, 5)
                                      .map((tag) => tag.label)
                                      .join(" · ")}
                                  </small>
                                ) : null}
                                {action.disabledReason ? (
                                  <small>Disabled: {action.disabledReason}</small>
                                ) : null}
                                {reviewSuggestions.summaryCounts.total > 0 ? (
                                  <div className="document-suggestions">
                                    <small>
                                      Reviewer suggestions · {reviewSuggestions.summaryCounts.total}{" "}
                                      cues · read only
                                    </small>
                                    {documentReviewSuggestionGroupOrder.map((suggestionGroup) => {
                                      const cues = reviewSuggestions.groups[suggestionGroup] ?? [];
                                      if (cues.length === 0) return null;
                                      return (
                                        <div
                                          className="document-suggestion-group"
                                          key={suggestionGroup}
                                        >
                                          <small>
                                            {documentReviewSuggestionGroupLabel(suggestionGroup)}
                                          </small>
                                          {cues.map((cue) => (
                                            <small
                                              className={cue.tone === "risk" ? "risk" : undefined}
                                              key={cue.id}
                                            >
                                              {cue.label}
                                              {describeDocumentReviewSuggestion(cue)
                                                ? ` · ${describeDocumentReviewSuggestion(cue)}`
                                                : ""}
                                            </small>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </span>
                              <div className="row-actions upload-review-actions">
                                <em className={action.tone === "risk" ? "risk" : undefined}>
                                  {documentProcessingGroupLabel(item.group)}
                                </em>
                                <button
                                  className="secondary-button compact-button row-button"
                                  disabled={!action.canQueue || queueingDocumentId.length > 0}
                                  onClick={() => void queueDocumentOcr(item.document.id)}
                                  type="button"
                                >
                                  {queueingDocumentId === item.document.id
                                    ? "Queueing..."
                                    : action.label}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    );
                  })}
                  {activeDocumentProcessingRows.length === 0 ? (
                    <p className="inline-empty">No documents are linked to this matter.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "shares" ? (
              <>
                <div className="detail-grid share-control-grid">
                  <div>
                    <span className="field-label">Create status</span>
                    <strong>{shareLinksStatus.createStatus}</strong>
                  </div>
                  <div>
                    <span className="field-label">Provider</span>
                    <strong>
                      {shareLinksStatus.provider ?? shareLinksStatus.status ?? "shares"}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Matter links</span>
                    <strong>{activeShares.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Active links</span>
                    <strong>{activeShares.filter((share) => !share.revokedAt).length}</strong>
                  </div>
                </div>

                <div className="share-controls">
                  <div className="section-title">
                    <h3>Create share link</h3>
                    <span>{shareLinksStatus.reason ?? "matter-scoped"}</span>
                  </div>
                  <div className="permission-toggle-grid">
                    {shareLinkPermissions.map((permission) => (
                      <label className="check-row share-check-row" key={permission}>
                        <input
                          checked={sharePermissions.includes(permission)}
                          disabled={shareLinksStatus.createStatus !== "enabled"}
                          onChange={() => toggleSharePermission(permission)}
                          type="checkbox"
                        />
                        <span>{formatSharePermission(permission)}</span>
                      </label>
                    ))}
                    <label className="check-row share-check-row">
                      <input
                        checked={requireEmailVerification}
                        disabled={shareLinksStatus.createStatus !== "enabled"}
                        onChange={(event) => setRequireEmailVerification(event.target.checked)}
                        type="checkbox"
                      />
                      <span>Require email verification</span>
                    </label>
                  </div>
                  <div className="share-form-row">
                    <label className="search-field">
                      <span>Expiry date</span>
                      <input
                        disabled={shareLinksStatus.createStatus !== "enabled"}
                        onChange={(event) => setShareExpiresAt(event.target.value)}
                        type="date"
                        value={shareExpiresAt}
                      />
                    </label>
                    <label className="search-field">
                      <span>Notification email</span>
                      <input
                        disabled={shareLinksStatus.createStatus !== "enabled"}
                        onChange={(event) => setShareNotificationEmail(event.target.value)}
                        placeholder="client@example.test"
                        type="email"
                        value={shareNotificationEmail}
                      />
                    </label>
                    <button
                      className="secondary-button compact-button"
                      disabled={shareLinksStatus.createStatus !== "enabled" || creatingShare}
                      onClick={() => void createShareLink()}
                      type="button"
                    >
                      <Link2 size={16} />
                      {creatingShare ? "Creating..." : "Create link"}
                    </button>
                  </div>
                  {shareOneTimeToken ? (
                    <OneTimeSecretPanel
                      items={[{ label: "One-time token", value: shareOneTimeToken }]}
                    />
                  ) : null}
                  <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
                    {shareStatus}
                  </p>
                </div>

                <div className="section-title">
                  <h3>Matter share links</h3>
                  <span>{activeShares.length} records</span>
                </div>
                <div className="party-list">
                  {activeShares.map((share) => {
                    const state = describeShareLinkState(share);
                    return (
                      <div className="party-row" key={share.id}>
                        <span>
                          <strong>{share.id}</strong>
                          <small>
                            {share.permissions.map(formatSharePermission).join(", ")}
                            {share.expiresAt
                              ? ` · expires ${new Date(share.expiresAt).toLocaleDateString(
                                  "en-CA",
                                )}`
                              : " · no expiry"}
                            {share.requireEmailVerification
                              ? " · email verification required"
                              : " · token access"}
                          </small>
                        </span>
                        <span className="share-row-actions">
                          <em className={state.tone === "risk" ? "risk" : undefined}>
                            {state.label}
                          </em>
                          <button
                            className="secondary-button compact-button"
                            disabled={Boolean(share.revokedAt) || revokingShareId.length > 0}
                            onClick={() => void revokeShareLink(share)}
                            type="button"
                          >
                            {revokingShareId === share.id ? "Revoking..." : "Revoke"}
                          </button>
                        </span>
                      </div>
                    );
                  })}
                  {activeShares.length === 0 ? (
                    <p className="inline-empty">No share links are linked to this matter.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "externalUploads" ? (
              <>
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Create status</span>
                    <strong>{compactStatus(externalUploads.status.status)}</strong>
                  </div>
                  <div>
                    <span className="field-label">Provider</span>
                    <strong>{compactStatus(externalUploads.status.provider)}</strong>
                  </div>
                  <div>
                    <span className="field-label">Reason</span>
                    <strong>{compactStatus(externalUploads.status.reason)}</strong>
                  </div>
                  <div>
                    <span className="field-label">Active links</span>
                    <strong>
                      {
                        activeExternalUploads.filter(
                          (upload) => getExternalUploadLinkState(upload) === "active",
                        ).length
                      }
                    </strong>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Create link</h3>
                  <span>{activeMatter.number}</span>
                </div>
                <div className="upload-create-grid">
                  <label className="search-field compact">
                    <span>Max uploads</span>
                    <input
                      min={1}
                      onChange={(event) => setExternalUploadMaxUploads(event.target.value)}
                      type="number"
                      value={externalUploadMaxUploads}
                    />
                  </label>
                  <label className="search-field compact">
                    <span>Expiry</span>
                    <input
                      onChange={(event) => setExternalUploadExpiresAt(event.target.value)}
                      type="datetime-local"
                      value={externalUploadExpiresAt}
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={creatingExternalUpload || !externalUploadCreateAvailable}
                    onClick={() => void createExternalUploadLink()}
                    type="button"
                  >
                    {creatingExternalUpload ? "Creating..." : "Create link"}
                  </button>
                </div>
                {externalUploadToken ? (
                  <OneTimeSecretPanel
                    items={[{ label: "One-time token", value: externalUploadToken }]}
                  />
                ) : null}
                <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
                  {externalUploadStatus}
                </p>

                <div className="section-title">
                  <h3>External upload links</h3>
                  <span>{activeExternalUploads.length} records</span>
                </div>
                <div className="party-list">
                  {activeExternalUploads.map((upload) => {
                    const linkState = getExternalUploadLinkState(upload);
                    return (
                      <div className="party-row upload-link-row" key={upload.id}>
                        <span>
                          <strong>{upload.id}</strong>
                          <small>
                            {upload.usedUploads}/{upload.maxUploads} used · expires{" "}
                            {compactDate(upload.expiresAt)} · created{" "}
                            {compactDate(upload.createdAt)}
                          </small>
                        </span>
                        <div className="row-actions">
                          <em className={linkState === "active" ? undefined : "risk"}>
                            {linkState}
                          </em>
                          {!upload.revokedAt ? (
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={revokingExternalUploadId === upload.id}
                              onClick={() => void revokeExternalUploadLink(upload.id)}
                              type="button"
                            >
                              {revokingExternalUploadId === upload.id ? "Revoking..." : "Revoke"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {activeExternalUploads.length === 0 ? (
                    <p className="inline-empty">No external upload links for this matter.</p>
                  ) : null}
                </div>

                <div className="section-title">
                  <h3>Uploaded document review</h3>
                  <span>{activeExternalUploadDocuments.length} records</span>
                </div>
                <div className="party-list">
                  {activeExternalUploadDocuments.map((document) => {
                    const reviewState = describeExternalUploadReviewState(document);
                    const reviewKey = `${document.id}:`;
                    return (
                      <div className="party-row upload-review-row" key={document.id}>
                        <span>
                          <strong>{document.title}</strong>
                          <small>
                            {compactStatus(document.uploadStatus)} ·{" "}
                            {compactStatus(document.checksumStatus)} checksum ·{" "}
                            {compactStatus(document.scanStatus)} scan
                            {document.duplicateOfDocumentId
                              ? ` · duplicate of ${document.duplicateOfDocumentId}`
                              : ""}
                          </small>
                          {document.accessLogProof ? (
                            <small>
                              Access proof: {document.accessLogProof.total} log
                              {document.accessLogProof.total === 1 ? "" : "s"}
                              {document.accessLogProof.outcomes.length
                                ? ` · ${document.accessLogProof.outcomes.join(", ")}`
                                : ""}
                            </small>
                          ) : null}
                        </span>
                        <div className="row-actions upload-review-actions">
                          <em className={reviewState.tone === "risk" ? "risk" : undefined}>
                            {reviewState.label}
                          </em>
                          <select
                            aria-label={`Review reason for ${document.title}`}
                            className="compact-select"
                            disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                            onChange={(event) =>
                              setExternalUploadReviewReasonsByDocumentId((current) => ({
                                ...current,
                                [document.id]: event.target.value as
                                  | ExternalUploadReviewReason
                                  | "",
                              }))
                            }
                            value={externalUploadReviewReasonsByDocumentId[document.id] ?? ""}
                          >
                            <option value="">Reason</option>
                            {externalUploadReviewReasons.map((reason) => (
                              <option key={reason} value={reason}>
                                {compactStatus(reason)}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={`Private review note for ${document.title}`}
                            className="compact-input"
                            disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                            maxLength={500}
                            onChange={(event) =>
                              setExternalUploadReviewNotesByDocumentId((current) => ({
                                ...current,
                                [document.id]: event.target.value,
                              }))
                            }
                            placeholder="Private note"
                            value={externalUploadReviewNotesByDocumentId[document.id] ?? ""}
                          />
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                            onClick={() => void reviewExternalUploadDocument(document, "accept")}
                            type="button"
                          >
                            Accept
                          </button>
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                            onClick={() =>
                              void reviewExternalUploadDocument(document, "request_metadata")
                            }
                            type="button"
                          >
                            Metadata
                          </button>
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                            onClick={() =>
                              void reviewExternalUploadDocument(document, "request_retry")
                            }
                            type="button"
                          >
                            Retry
                          </button>
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={reviewingExternalUploadDocumentId.startsWith(reviewKey)}
                            onClick={() => void reviewExternalUploadDocument(document, "discard")}
                            type="button"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {activeExternalUploadDocuments.length === 0 ? (
                    <p className="inline-empty">No uploaded external documents need review.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "calendar" ? (
              <>
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Upcoming</span>
                    <strong>
                      {activeCalendarBuckets.nextSevenDays.length +
                        activeCalendarBuckets.nextThirtyDays.length}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Overdue</span>
                    <strong>{activeCalendarBuckets.overdue.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Tentative</span>
                    <strong>{activeCalendarBuckets.tentative.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Cancelled</span>
                    <strong>{activeCalendarBuckets.cancelled.length}</strong>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Deadline radar</h3>
                  <span>{activeCalendarEvents.length} matter events</span>
                </div>
                <div className="activity-grid calendar-radar-grid">
                  <div className="activity-card calendar-radar-card">
                    <AlertTriangle size={18} />
                    <strong>{activeCalendarBuckets.overdue.length} overdue</strong>
                    <span>operator-entered event dates before now</span>
                  </div>
                  <div className="activity-card calendar-radar-card">
                    <Clock3 size={18} />
                    <strong>{activeCalendarBuckets.nextSevenDays.length} next 7 days</strong>
                    <span>active events starting soon</span>
                  </div>
                  <div className="activity-card calendar-radar-card">
                    <CalendarDays size={18} />
                    <strong>{activeCalendarBuckets.nextThirtyDays.length} next 30 days</strong>
                    <span>remaining active near-term events</span>
                  </div>
                </div>

                <div className="share-controls calendar-event-controls">
                  <div className="section-title">
                    <h3>Event lifecycle</h3>
                    <span>Create or reschedule one matter event</span>
                  </div>
                  <div className="calendar-attendee-form">
                    <label className="search-field">
                      <span>Title</span>
                      <input
                        onChange={(event) => setCalendarEventTitle(event.target.value)}
                        value={calendarEventTitle}
                      />
                    </label>
                    <label className="search-field">
                      <span>Starts</span>
                      <input
                        onChange={(event) => setCalendarEventStartsAt(event.target.value)}
                        type="datetime-local"
                        value={calendarEventStartsAt}
                      />
                    </label>
                    <label className="search-field">
                      <span>Ends</span>
                      <input
                        onChange={(event) => setCalendarEventEndsAt(event.target.value)}
                        type="datetime-local"
                        value={calendarEventEndsAt}
                      />
                    </label>
                    <label className="search-field">
                      <span>Status</span>
                      <select
                        onChange={(event) =>
                          setCalendarEventStatusValue(
                            event.target.value as DashboardCalendarEvent["status"],
                          )
                        }
                        value={calendarEventStatusValue}
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="tentative">Tentative</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <label className="search-field">
                      <span>Location</span>
                      <input
                        onChange={(event) => setCalendarEventLocation(event.target.value)}
                        value={calendarEventLocation}
                      />
                    </label>
                    <label className="search-field">
                      <span>Description</span>
                      <input
                        onChange={(event) => setCalendarEventDescription(event.target.value)}
                        value={calendarEventDescription}
                      />
                    </label>
                    <button
                      className="secondary-button compact-button"
                      disabled={
                        creatingCalendarEvent ||
                        !calendarEventTitle.trim() ||
                        !calendarEventStartsAt ||
                        !calendarEventEndsAt
                      }
                      onClick={() => void createCalendarEvent()}
                      type="button"
                    >
                      <Plus size={16} />
                      {creatingCalendarEvent ? "Creating..." : "Create event"}
                    </button>
                  </div>
                  <p className="inline-empty">{calendarEventLifecycleStatus}</p>
                </div>

                <div className="section-title">
                  <h3>Matter calendar events</h3>
                  <span>{activeMatter.number}</span>
                </div>
                <div className="party-list">
                  {activeCalendarEvents.map((event) => {
                    const timing = describeCalendarEventTiming(event);
                    const attendees = event.attendees ?? [];
                    const meetingLinkAvailability = describeMeetingLinkAvailability(event);
                    const meetingLinkMode = calendarMeetingLinkModeValue(event);
                    const meetingLinkUrl = calendarMeetingLinkUrlValue(event);
                    const hostedMeetingConfigured =
                      event.meetingInvitationBoundary?.meetingLinks.status === "configured";
                    const canSaveMeetingLink =
                      meetingLinkMode === "blank" ||
                      (meetingLinkMode === "external_url" && Boolean(meetingLinkUrl.trim())) ||
                      (meetingLinkMode === "hosted_webrtc" && hostedMeetingConfigured);
                    const guestSessions = calendarGuestSessionsByEventId[event.id] ?? [];
                    const guestAccessConfigured =
                      event.meetingInvitationBoundary?.guestAccess.status === "configured";
                    const hostedGuestSessionReady =
                      event.status !== "cancelled" &&
                      event.meetingLinkMode === "hosted_webrtc" &&
                      Boolean(event.meetingRoomId) &&
                      guestAccessConfigured;
                    return (
                      <div className="party-row calendar-event-row" key={event.id}>
                        <div className="calendar-event-summary">
                          <span>
                            <strong>{event.title}</strong>
                            <small>
                              {compactDate(event.startsAt)} to {compactDate(event.endsAt)}
                              {event.location ? ` · ${event.location}` : ""}
                            </small>
                            <small>
                              {describeMeetingInvitationBoundary(event.meetingInvitationBoundary)}
                            </small>
                          </span>
                          <div className="row-actions">
                            <em
                              className={
                                event.status === "cancelled" || timing === "overdue"
                                  ? "risk"
                                  : undefined
                              }
                            >
                              {event.status === "cancelled" ? "cancelled" : timing}
                            </em>
                            <button
                              aria-label={meetingLinkAvailability.detail}
                              className={`secondary-button compact-button row-button calendar-meeting-link-status ${meetingLinkAvailability.status}`}
                              disabled={
                                !meetingLinkAvailability.actionable ||
                                attendees.length === 0 ||
                                sendingCalendarInvitationsEventId === event.id
                              }
                              onClick={() =>
                                openCalendarInvitationConfirmation(event, {
                                  includeMeetingLink: true,
                                })
                              }
                              title={meetingLinkAvailability.detail}
                              type="button"
                            >
                              <Link2 size={14} />
                              {sendingCalendarInvitationsEventId === event.id
                                ? "Sending..."
                                : meetingLinkAvailability.label}
                            </button>
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={
                                updatingCalendarEventId === event.id ||
                                !calendarEventStartsAt ||
                                !calendarEventEndsAt
                              }
                              onClick={() => void rescheduleCalendarEvent(event)}
                              type="button"
                            >
                              {updatingCalendarEventId === event.id
                                ? "Rescheduling..."
                                : "Reschedule"}
                            </button>
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={
                                event.status === "cancelled" ||
                                cancelingCalendarEventId === event.id
                              }
                              onClick={() => void cancelCalendarEvent(event)}
                              type="button"
                            >
                              {cancelingCalendarEventId === event.id ? "Cancelling..." : "Cancel"}
                            </button>
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={
                                attendees.length === 0 ||
                                sendingCalendarInvitationsEventId === event.id
                              }
                              onClick={() => openCalendarInvitationConfirmation(event)}
                              type="button"
                            >
                              {sendingCalendarInvitationsEventId === event.id
                                ? "Sending..."
                                : "Send invites"}
                            </button>
                          </div>
                        </div>
                        <div className="calendar-meeting-link-form">
                          <label>
                            <span className="field-label">Meeting link</span>
                            <select
                              value={meetingLinkMode}
                              onChange={(changeEvent) =>
                                setCalendarMeetingLinkModesByEventId((current) => ({
                                  ...current,
                                  [event.id]: changeEvent.currentTarget
                                    .value as CalendarMeetingLinkMode,
                                }))
                              }
                            >
                              <option value="blank">Blank</option>
                              <option value="external_url">Other link</option>
                              <option disabled={!hostedMeetingConfigured} value="hosted_webrtc">
                                Hosted WebRTC
                              </option>
                            </select>
                          </label>
                          {meetingLinkMode === "external_url" ? (
                            <label>
                              <span className="field-label">URL</span>
                              <input
                                type="url"
                                value={meetingLinkUrl}
                                onChange={(inputEvent) =>
                                  setCalendarMeetingLinkUrlsByEventId((current) => ({
                                    ...current,
                                    [event.id]: inputEvent.currentTarget.value,
                                  }))
                                }
                                placeholder="https://meet.example.test/room"
                              />
                            </label>
                          ) : null}
                          {meetingLinkMode === "hosted_webrtc" && !hostedMeetingConfigured ? (
                            <p className="inline-empty">
                              Hosted WebRTC meetings are not configured.
                            </p>
                          ) : null}
                          {event.meetingLinkUrl ? (
                            <code className="calendar-meeting-link-url">
                              {event.meetingLinkUrl}
                            </code>
                          ) : null}
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={
                              updatingCalendarMeetingLinkEventId === event.id || !canSaveMeetingLink
                            }
                            onClick={() => updateCalendarMeetingLink(event)}
                            type="button"
                          >
                            {updatingCalendarMeetingLinkEventId === event.id
                              ? "Saving..."
                              : "Save link"}
                          </button>
                        </div>
                        {event.meetingLinkMode === "hosted_webrtc" ? (
                          <div className="calendar-guest-session-panel">
                            <div className="section-title compact-section-title">
                              <h4>Guest lobby</h4>
                              <span>{guestSessions.length} session records</span>
                            </div>
                            {!guestAccessConfigured ? (
                              <p className="inline-empty">Guest access tokens are disabled.</p>
                            ) : null}
                            {guestAccessConfigured && event.status === "cancelled" ? (
                              <p className="inline-empty">Cancelled events cannot host a lobby.</p>
                            ) : null}
                            {guestAccessConfigured && !event.meetingRoomId ? (
                              <p className="inline-empty">Save a hosted meeting link first.</p>
                            ) : null}
                            {guestSessions.map((session) => (
                              <div className="calendar-guest-session-row" key={session.id}>
                                <span>
                                  <strong>{describeCalendarGuestSessionStatus(session)}</strong>
                                  <small>
                                    {session.issuedCount} issued · {session.waitingCount} waiting ·{" "}
                                    {session.admittedCount} admitted
                                  </small>
                                </span>
                                <div className="row-actions">
                                  <button
                                    className="secondary-button compact-button row-button"
                                    disabled={
                                      !hostedGuestSessionReady ||
                                      session.status === "open" ||
                                      session.status === "ended" ||
                                      updatingCalendarGuestSessionKey === `${session.id}:open`
                                    }
                                    onClick={() =>
                                      void controlCalendarGuestSession(event, session, "open")
                                    }
                                    type="button"
                                  >
                                    Open
                                  </button>
                                  <button
                                    className="secondary-button compact-button row-button"
                                    disabled={
                                      !hostedGuestSessionReady ||
                                      session.status === "locked" ||
                                      session.status === "ended" ||
                                      updatingCalendarGuestSessionKey === `${session.id}:lock`
                                    }
                                    onClick={() =>
                                      void controlCalendarGuestSession(event, session, "lock")
                                    }
                                    type="button"
                                  >
                                    Lock
                                  </button>
                                  <button
                                    className="secondary-button compact-button row-button"
                                    disabled={
                                      !hostedGuestSessionReady ||
                                      session.status === "ended" ||
                                      updatingCalendarGuestSessionKey === `${session.id}:end`
                                    }
                                    onClick={() =>
                                      void controlCalendarGuestSession(event, session, "end")
                                    }
                                    type="button"
                                  >
                                    End
                                  </button>
                                  <button
                                    className="secondary-button compact-button row-button"
                                    disabled={
                                      !hostedGuestSessionReady ||
                                      session.status === "ended" ||
                                      updatingCalendarGuestSessionKey === `${session.id}:issue`
                                    }
                                    onClick={() => void issueCalendarGuestLink(event, session)}
                                    type="button"
                                  >
                                    Issue
                                  </button>
                                </div>
                                {session.guests.length ? (
                                  <div className="calendar-guest-link-list">
                                    {session.guests.map((guest) => (
                                      <div className="calendar-attendee-row" key={guest.id}>
                                        <span>
                                          <strong>Guest access</strong>
                                          <small>
                                            {guest.status.replace("_", " ")} · expires{" "}
                                            {compactDate(guest.expiresAt)}
                                          </small>
                                        </span>
                                        <div className="row-actions">
                                          <button
                                            className="secondary-button compact-button row-button"
                                            disabled={
                                              session.status !== "open" ||
                                              guest.status === "admitted" ||
                                              guest.status === "revoked" ||
                                              updatingCalendarGuestSessionKey ===
                                                `${guest.id}:admit`
                                            }
                                            onClick={() =>
                                              void updateCalendarGuestLink(
                                                event,
                                                session,
                                                guest.id,
                                                "admit",
                                              )
                                            }
                                            type="button"
                                          >
                                            Admit
                                          </button>
                                          <button
                                            className="secondary-button compact-button row-button"
                                            disabled={
                                              guest.status === "denied" ||
                                              guest.status === "revoked" ||
                                              updatingCalendarGuestSessionKey === `${guest.id}:deny`
                                            }
                                            onClick={() =>
                                              void updateCalendarGuestLink(
                                                event,
                                                session,
                                                guest.id,
                                                "deny",
                                              )
                                            }
                                            type="button"
                                          >
                                            Deny
                                          </button>
                                          <button
                                            aria-label={`Revoke guest access ${guest.id}`}
                                            className="icon-button"
                                            disabled={
                                              guest.status === "revoked" ||
                                              updatingCalendarGuestSessionKey ===
                                                `${guest.id}:revoke`
                                            }
                                            onClick={() =>
                                              void updateCalendarGuestLink(
                                                event,
                                                session,
                                                guest.id,
                                                "revoke",
                                              )
                                            }
                                            title="Revoke guest access"
                                            type="button"
                                          >
                                            <X size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            {hostedGuestSessionReady && guestSessions.length === 0 ? (
                              <button
                                className="secondary-button compact-button row-button"
                                disabled={creatingCalendarGuestSessionEventId === event.id}
                                onClick={() => void createCalendarGuestSession(event)}
                                type="button"
                              >
                                <Plus size={16} />
                                {creatingCalendarGuestSessionEventId === event.id
                                  ? "Creating..."
                                  : "Create lobby"}
                              </button>
                            ) : null}
                            {calendarGuestSessionSecret?.session.eventId === event.id ? (
                              <OneTimeSecretPanel
                                className="calendar-secret"
                                items={[
                                  {
                                    label: "Guest status page",
                                    value: calendarGuestSessionSecret.portalUrl,
                                  },
                                  {
                                    label: "One-time token",
                                    value: calendarGuestSessionSecret.token,
                                  },
                                ]}
                              />
                            ) : null}
                          </div>
                        ) : null}
                        {pendingDeliveryConfirmation?.kind === "calendar-invitations" &&
                        pendingDeliveryConfirmation.eventId === event.id ? (
                          <DeliveryConfirmationPanel
                            busy={sendingCalendarInvitationsEventId === event.id}
                            confirmation={pendingDeliveryConfirmation}
                            onCancel={() => setPendingDeliveryConfirmation(null)}
                            onConfirm={confirmPendingDelivery}
                          />
                        ) : null}
                        <div className="calendar-attendee-list">
                          {(event.reminders ?? []).map((reminder) => (
                            <div className="calendar-attendee-row" key={reminder.id}>
                              <span>
                                <strong>{compactDate(reminder.remindAt)}</strong>
                                <small>
                                  {reminder.channel} · {reminder.status.replace("_", " ")}
                                  {reminder.note ? ` · ${reminder.note}` : ""}
                                </small>
                              </span>
                              <div className="row-actions">
                                <button
                                  className="secondary-button compact-button row-button"
                                  disabled={updatingCalendarReminderId === reminder.id}
                                  onClick={() =>
                                    void updateCalendarReminder(
                                      event.id,
                                      reminder.id,
                                      "acknowledged",
                                    )
                                  }
                                  type="button"
                                >
                                  Acknowledge
                                </button>
                                <button
                                  aria-label={`Remove reminder ${reminder.id}`}
                                  className="icon-button"
                                  disabled={removingCalendarReminderId === reminder.id}
                                  onClick={() => void removeCalendarReminder(event.id, reminder.id)}
                                  title="Remove reminder"
                                  type="button"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {(event.reminders ?? []).length === 0 ? (
                            <p className="inline-empty">No reminders are linked to this event.</p>
                          ) : null}
                        </div>
                        <div className="calendar-attendee-list">
                          {attendees.map((attendee) => (
                            <div className="calendar-attendee-row" key={attendee.id}>
                              <span>
                                <strong>{attendee.name}</strong>
                                <small>
                                  {attendee.email} ·{" "}
                                  {formatCalendarAttendeeRoleLabel(attendee.role)} ·{" "}
                                  {attendee.responseStatus.replace("_", " ")}
                                </small>
                              </span>
                              <div className="row-actions">
                                <em
                                  className={
                                    attendee.invitationStatus === "skipped" ? "risk" : undefined
                                  }
                                >
                                  {attendee.invitationStatus.replace("_", " ")}
                                </em>
                                <button
                                  aria-label={`Remove ${attendee.name}`}
                                  className="icon-button"
                                  disabled={removingCalendarAttendeeId === attendee.id}
                                  onClick={() => void removeCalendarAttendee(event.id, attendee.id)}
                                  title="Remove attendee"
                                  type="button"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {attendees.length === 0 ? (
                            <p className="inline-empty">No attendees are linked to this event.</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {activeCalendarEvents.length === 0 ? (
                    <p className="inline-empty">No calendar events are linked to this matter.</p>
                  ) : null}
                </div>

                <div className="share-controls calendar-reminder-controls">
                  <div className="section-title">
                    <h3>Reminder state</h3>
                    <span>{selectedCalendarReminderEvent?.title ?? "No event selected"}</span>
                  </div>
                  <div className="calendar-attendee-form">
                    <label className="search-field">
                      <span>Event</span>
                      <select
                        onChange={(event) => setCalendarReminderEventId(event.target.value)}
                        value={selectedCalendarReminderEvent?.id ?? ""}
                      >
                        {activeCalendarEvents.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="search-field">
                      <span>Remind at</span>
                      <input
                        onChange={(event) => setCalendarReminderAt(event.target.value)}
                        type="datetime-local"
                        value={calendarReminderAt}
                      />
                    </label>
                    <label className="search-field">
                      <span>Status</span>
                      <select
                        onChange={(event) =>
                          setCalendarReminderStatusValue(
                            event.target.value as
                              | "pending"
                              | "acknowledged"
                              | "dismissed"
                              | "cancelled",
                          )
                        }
                        value={calendarReminderStatusValue}
                      >
                        <option value="pending">Pending</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <label className="search-field">
                      <span>Note</span>
                      <input
                        onChange={(event) => setCalendarReminderNote(event.target.value)}
                        value={calendarReminderNote}
                      />
                    </label>
                    <button
                      className="secondary-button compact-button"
                      disabled={
                        !selectedCalendarReminderEvent ||
                        !calendarReminderAt ||
                        addingCalendarReminder
                      }
                      onClick={() => void addCalendarReminder()}
                      type="button"
                    >
                      <Plus size={16} />
                      {addingCalendarReminder ? "Adding..." : "Add reminder"}
                    </button>
                  </div>
                  <p className="inline-empty">{calendarReminderStatus}</p>
                </div>

                <div className="share-controls calendar-meeting-controls">
                  <div className="section-title">
                    <h3>Meeting attendees</h3>
                    <span>{selectedCalendarMeetingEvent?.title ?? "No event selected"}</span>
                  </div>
                  <div className="calendar-attendee-form">
                    <label className="search-field">
                      <span>Event</span>
                      <select
                        onChange={(event) => setCalendarMeetingEventId(event.target.value)}
                        value={selectedCalendarMeetingEvent?.id ?? ""}
                      >
                        {activeCalendarEvents.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="search-field">
                      <span>Name</span>
                      <input
                        onChange={(event) => setCalendarAttendeeName(event.target.value)}
                        value={calendarAttendeeName}
                      />
                    </label>
                    <label className="search-field">
                      <span>Email</span>
                      <input
                        onChange={(event) => setCalendarAttendeeEmail(event.target.value)}
                        type="email"
                        value={calendarAttendeeEmail}
                      />
                    </label>
                    <label className="search-field">
                      <span>Role</span>
                      <select
                        onChange={(event) =>
                          setCalendarAttendeeRole(event.target.value as "required" | "optional")
                        }
                        value={calendarAttendeeRole}
                      >
                        <option value="required">Required</option>
                        <option value="optional">Optional</option>
                      </select>
                    </label>
                    <button
                      className="secondary-button compact-button"
                      disabled={
                        !selectedCalendarMeetingEvent ||
                        !calendarAttendeeName.trim() ||
                        !calendarAttendeeEmail.trim() ||
                        addingCalendarAttendee
                      }
                      onClick={() => void addCalendarAttendee()}
                      type="button"
                    >
                      <Plus size={16} />
                      {addingCalendarAttendee ? "Adding..." : "Add attendee"}
                    </button>
                  </div>
                  <p className="inline-empty">{calendarMeetingStatus}</p>
                  <p className="inline-empty">{calendarGuestSessionStatus}</p>
                </div>

                <div className="section-title">
                  <h3>Calendar sync</h3>
                  <span>CalDAV / iCalendar</span>
                </div>
                <div className="upload-token calendar-sync-links">
                  <span>Subscription URL</span>
                  <code>{activeCalendarLinks?.subscriptionUrl ?? "Unavailable"}</code>
                  <span>CalDAV URL</span>
                  <code>{activeCalendarLinks?.caldavUrl ?? "Unavailable"}</code>
                </div>

                <div className="share-controls">
                  <div className="section-title">
                    <h3>App passwords</h3>
                    <span>
                      {calendarCredentials.filter((credential) => !credential.revokedAt).length}{" "}
                      active
                    </span>
                  </div>
                  <div className="share-form-row calendar-credential-form">
                    <label className="search-field">
                      <span>Label</span>
                      <input
                        onChange={(event) => setCalendarCredentialLabel(event.target.value)}
                        value={calendarCredentialLabel}
                      />
                    </label>
                    <button
                      className="secondary-button compact-button"
                      disabled={creatingCalendarCredential}
                      onClick={() => void createCalendarCredential()}
                      type="button"
                    >
                      <Plus size={16} />
                      {creatingCalendarCredential ? "Creating..." : "Create password"}
                    </button>
                  </div>
                  {calendarOneTimeSecret ? (
                    <OneTimeSecretPanel
                      className="calendar-secret"
                      items={[
                        { label: "Username", value: calendarOneTimeSecret.username },
                        { label: "One-time password", value: calendarOneTimeSecret.password },
                        { label: "Principal URL", value: calendarOneTimeSecret.principalUrl },
                      ]}
                    />
                  ) : null}
                  <p className="inline-empty">{calendarCredentialStatus}</p>
                </div>

                <div className="party-list">
                  {calendarCredentials.map((credential) => (
                    <div className="party-row" key={credential.id}>
                      <span>
                        <strong>{credential.label}</strong>
                        <small>
                          {credential.username} · created {compactDate(credential.createdAt)}
                          {credential.lastUsedAt
                            ? ` · last used ${compactDate(credential.lastUsedAt)}`
                            : ""}
                        </small>
                      </span>
                      <div className="row-actions">
                        <em className={credential.revokedAt ? "risk" : undefined}>
                          {credential.revokedAt ? "revoked" : "active"}
                        </em>
                        {!credential.revokedAt ? (
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={revokingCalendarCredentialId === credential.id}
                            onClick={() => void revokeCalendarCredential(credential.id)}
                            type="button"
                          >
                            {revokingCalendarCredentialId === credential.id
                              ? "Revoking..."
                              : "Revoke"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {calendarCredentials.length === 0 ? (
                    <p className="inline-empty">No calendar app passwords have been created.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "drafting" ? (
              <>
                {selectedDraft && draftEditorJson ? (
                  <div className="draft-editor-panel">
                    <div className="draft-editor-header">
                      <button
                        aria-label="Back to matter drafts"
                        className="icon-button"
                        onClick={closeDraftEditor}
                        title="Back to matter drafts"
                        type="button"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <div>
                        <h3>{selectedDraft.title}</h3>
                        <span>
                          v{selectedDraft.version} · updated{" "}
                          {new Date(selectedDraft.updatedAt).toLocaleDateString("en-CA")}
                        </span>
                      </div>
                      <button
                        className="secondary-button compact-button save-draft-button"
                        disabled={!draftHasChanges || savingDraft}
                        onClick={() => void saveDraft()}
                        type="button"
                      >
                        <Save size={16} />
                        {savingDraft ? "Saving..." : "Save"}
                      </button>
                    </div>
                    <DraftEditor
                      key={selectedDraft.id}
                      content={draftEditorJson}
                      onChange={setDraftEditorJson}
                    />
                    <div className="draft-office-panel">
                      <div className="section-title">
                        <h3>Office output</h3>
                        <span>{activeDraftExports.length} exports</span>
                      </div>
                      <div className="draft-office-controls">
                        <label>
                          <span>Merge field</span>
                          <select
                            value={draftMergeField}
                            onChange={(event) =>
                              setDraftMergeField(
                                event.target.value as (typeof draftMergeFields)[number],
                              )
                            }
                          >
                            {draftMergeFields.map((field) => (
                              <option key={field} value={field}>
                                {field}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="secondary-button compact-button"
                          onClick={insertMergeField}
                          type="button"
                        >
                          <Plus size={16} />
                          Insert
                        </button>
                        <label>
                          <span>Export title</span>
                          <input
                            value={draftExportTitle}
                            onChange={(event) => setDraftExportTitle(event.target.value)}
                            placeholder={selectedDraft.title}
                          />
                        </label>
                        <label>
                          <span>Format</span>
                          <select
                            value={draftExportFormat}
                            onChange={(event) =>
                              setDraftExportFormat(event.target.value as DraftExportFormat)
                            }
                          >
                            <option value="pdf">PDF</option>
                            <option value="docx">DOCX</option>
                          </select>
                        </label>
                        <button
                          className="secondary-button compact-button"
                          disabled={draftHasChanges || exportingDraftFormat.length > 0}
                          onClick={() => void exportDraft()}
                          type="button"
                        >
                          <Download size={16} />
                          {exportingDraftFormat ? "Exporting..." : "Export"}
                        </button>
                      </div>
                      {draftHasChanges ? (
                        <p className="inline-empty">Save draft changes before exporting.</p>
                      ) : null}
                      <div className="party-list">
                        {activeDraftExports.map((record) => (
                          <div
                            className="party-row draft-export-row"
                            key={record.generatedDocument.id}
                          >
                            <span>
                              <strong>{record.title}</strong>
                              <small>
                                {record.format.toUpperCase()} ·{" "}
                                {formatDraftExportSize(record.byteLength)} · {record.document.title}
                              </small>
                              <small>checksum {record.checksumSha256.slice(0, 12)}...</small>
                            </span>
                            <em>{record.document.scanStatus}</em>
                          </div>
                        ))}
                        {activeDraftExports.length === 0 ? (
                          <p className="inline-empty">No exports created for this draft.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="draft-assist-panel">
                      <div className="section-title">
                        <h3>Draft assist</h3>
                        <span>{draftAssistStatus.status}</span>
                      </div>
                      <div className="draft-assist-controls">
                        <label>
                          <span>Task</span>
                          <select
                            value={draftAssistTask}
                            onChange={(event) =>
                              setDraftAssistTask(
                                event.target.value as DashboardDraftAssistRecord["task"],
                              )
                            }
                          >
                            <option value="summarize">Summarize</option>
                            <option value="suggest_revision">Suggest revision</option>
                            <option value="continue_draft">Continue draft</option>
                          </select>
                        </label>
                        <label>
                          <span>Instruction</span>
                          <input
                            value={draftAssistInstruction}
                            onChange={(event) => setDraftAssistInstruction(event.target.value)}
                            placeholder="Optional review instruction"
                          />
                        </label>
                        <button
                          className="secondary-button compact-button"
                          disabled={draftAssistStatus.status !== "configured" || runningDraftAssist}
                          onClick={() => void runDraftAssist()}
                          type="button"
                        >
                          <Sparkles size={16} />
                          {runningDraftAssist ? "Drafting..." : "Assist"}
                        </button>
                      </div>
                      <p className="inline-empty">{draftAssistMessage}</p>
                      <div className="party-list">
                        {activeDraftAssistRecords.map((record) => (
                          <div className="party-row draft-assist-row" key={record.id}>
                            <span>
                              <strong>{record.task.replaceAll("_", " ")}</strong>
                              <small>{record.summary ?? record.suggestedText}</small>
                              <small>
                                {record.providerKey} · {record.providerModel} · {record.status}
                              </small>
                            </span>
                            <div className="draft-assist-actions">
                              <button
                                className="secondary-button compact-button"
                                onClick={() => void reviewDraftAssistRecord(record, "reviewed")}
                                type="button"
                              >
                                Review
                              </button>
                              <button
                                className="secondary-button compact-button"
                                onClick={() => insertDraftAssistRecord(record)}
                                type="button"
                              >
                                Insert
                              </button>
                              <button
                                aria-label="Reject assist suggestion"
                                className="icon-button"
                                onClick={() => void reviewDraftAssistRecord(record, "rejected")}
                                title="Reject assist suggestion"
                                type="button"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {activeDraftAssistRecords.length === 0 ? (
                          <p className="inline-empty">No assist suggestions for this draft.</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
                      {draftStatus}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="section-title">
                      <h3>Templates</h3>
                      <span>{drafting.templates.length} active</span>
                    </div>
                    <div className="activity-grid drafting-template-grid">
                      <div className="activity-card draft-template-card">
                        <Plus size={18} />
                        <strong>Blank Draft</strong>
                        <span>general</span>
                        <button
                          className="secondary-button compact-button"
                          disabled={creatingTemplateId.length > 0}
                          onClick={() => void createBlankDraft()}
                          type="button"
                        >
                          {creatingTemplateId === "blank" ? "Starting..." : "Start draft"}
                        </button>
                      </div>
                      {drafting.templates.map((template) => (
                        <div className="activity-card draft-template-card" key={template.id}>
                          <FilePenLine size={18} />
                          <strong>{template.name}</strong>
                          <span>{template.category}</span>
                          <button
                            className="secondary-button compact-button"
                            disabled={creatingTemplateId.length > 0}
                            onClick={() => void createDraftFromTemplate(template)}
                            type="button"
                          >
                            {creatingTemplateId === template.id ? "Starting..." : "Start draft"}
                          </button>
                        </div>
                      ))}
                    </div>
                    {drafting.templates.length === 0 ? (
                      <p className="inline-empty">No active drafting templates are available.</p>
                    ) : null}
                    <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
                      {draftStatus}
                    </p>

                    <div className="section-title">
                      <h3>Matter drafts</h3>
                      <span>{activeDrafts.length} records</span>
                    </div>
                    <div className="party-list">
                      {activeDrafts.map((draft) => (
                        <button
                          className="party-row draft-row"
                          key={draft.id}
                          onClick={() => openDraft(draft)}
                          type="button"
                        >
                          <span>
                            <strong>{draft.title}</strong>
                            <small>
                              updated {new Date(draft.updatedAt).toLocaleDateString("en-CA")} ·{" "}
                              {extractDraftPlainText(draft.editorJson)}
                            </small>
                          </span>
                          <em>v{draft.version}</em>
                        </button>
                      ))}
                      {activeDrafts.length === 0 ? (
                        <p className="inline-empty">No drafts are linked to this matter.</p>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            ) : null}

            {activeSection === "signatures" ? (
              <div className="party-list">
                {activeSignatures.map((signature) => (
                  <div className="party-row" key={signature.id}>
                    <span>
                      <strong>{signature.title}</strong>
                      <small>
                        {signature.provider} · {signature.externalId}
                      </small>
                    </span>
                    <em>{signature.status.replace("_", " ")}</em>
                  </div>
                ))}
                {activeSignatures.length === 0 ? (
                  <p className="inline-empty">No signature requests are linked to this matter.</p>
                ) : null}
              </div>
            ) : null}

            {activeSection === "intake" ? (
              <>
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Templates</span>
                    <strong>{intakeTemplates.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Sessions</span>
                    <strong>{activeIntakeSessions.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Form links</span>
                    <strong>{activeIntakeFormLinks.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Pending reviews</span>
                    <strong>{activePendingIntakeReviewLinks.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Pending proposals</span>
                    <strong>{activePendingIntakeVariableProposals.length}</strong>
                  </div>
                </div>

                {activeLegalClinicProfile ? (
                  <>
                    <div className="section-title">
                      <h3>Eligibility and referral</h3>
                      <span>
                        {describeLegalClinicProgram(
                          activeLegalClinicProgram,
                          activeLegalClinicProfile,
                        )}
                      </span>
                    </div>
                    <div className="detail-grid">
                      <div>
                        <span className="field-label">Eligibility</span>
                        <strong>{compactStatus(activeLegalClinicProfile.eligibilityStatus)}</strong>
                      </div>
                      <div>
                        <span className="field-label">Referral</span>
                        <strong>{compactStatus(activeLegalClinicProfile.referralStatus)}</strong>
                      </div>
                      <div>
                        <span className="field-label">Relationship</span>
                        <strong>{activeLegalClinicProfile.clinicRelationshipRole}</strong>
                      </div>
                      <div>
                        <span className="field-label">Next review</span>
                        <strong>{compactDate(activeLegalClinicProfile.nextReviewDate)}</strong>
                      </div>
                      <div>
                        <span className="field-label">Fiscal host</span>
                        <strong>
                          {describeFiscalHostProgramMetadata(
                            activeFiscalHostMetadata.programMetadata,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span className="field-label">Restricted fund</span>
                        <strong>
                          {describeRestrictedFundMetadata(
                            activeFiscalHostMetadata.restrictedFundMetadata,
                          )}
                        </strong>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="section-title">
                  <h3>Form builder</h3>
                  <span>{selectedIntakeTemplate?.id ?? "new"}</span>
                </div>
                <div className="intake-builder-grid">
                  <div className="party-list intake-template-list">
                    {intakeTemplates.map((template) => (
                      <button
                        className={
                          template.id === selectedIntakeTemplateId
                            ? "party-row draft-row selected-template"
                            : "party-row draft-row"
                        }
                        key={template.id}
                        onClick={() => selectIntakeTemplate(template.id)}
                        type="button"
                      >
                        <span>
                          <strong>{template.name}</strong>
                          <small>
                            v{template.definitionVersion} ·{" "}
                            {template.definition.schemaVersion === 2
                              ? `${template.definition.sections.length} sections`
                              : "legacy"}
                          </small>
                        </span>
                        <em>{template.active ? "active" : "paused"}</em>
                      </button>
                    ))}
                    <button
                      className="secondary-button compact-button"
                      onClick={startNewIntakeTemplate}
                      type="button"
                    >
                      <Plus size={16} />
                      New form
                    </button>
                  </div>
                  <StructuredIntakeBuilder
                    definition={intakeTemplateDefinition}
                    name={intakeTemplateName}
                    onDefinitionChange={setIntakeTemplateDefinition}
                    onNameChange={setIntakeTemplateName}
                    onSave={() => void saveIntakeTemplate()}
                    saving={savingIntakeTemplate}
                    status={intakeTemplateStatus}
                  />
                </div>

                <div className="section-title">
                  <h3>Preview checks</h3>
                  <span className={previewStatusClass(intakePreviewResult)}>
                    {intakePreviewResult?.status ?? "not run"}
                  </span>
                </div>
                <div className="intake-preview-grid">
                  <div className="intake-preview-inputs">
                    {intakeTemplateDefinition.questions.map((question) => (
                      <label className="form-field" key={question.id}>
                        <span>{question.label}</span>
                        {question.type === "boolean" ? (
                          <input
                            checked={Boolean(intakePreviewAnswers[question.id])}
                            onChange={(event) =>
                              updateIntakePreviewAnswer(question.id, event.target.checked)
                            }
                            type="checkbox"
                          />
                        ) : question.type === "select" ? (
                          <select
                            onChange={(event) =>
                              updateIntakePreviewAnswer(question.id, event.target.value)
                            }
                            value={String(intakePreviewAnswers[question.id] ?? "")}
                          >
                            <option value="">No preview answer</option>
                            {(question.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : question.type === "textarea" ? (
                          <textarea
                            onChange={(event) =>
                              updateIntakePreviewAnswer(question.id, event.target.value)
                            }
                            value={String(intakePreviewAnswers[question.id] ?? "")}
                          />
                        ) : (
                          <input
                            onChange={(event) =>
                              updateIntakePreviewAnswer(question.id, event.target.value)
                            }
                            type={question.type === "date" ? "date" : "text"}
                            value={String(intakePreviewAnswers[question.id] ?? "")}
                          />
                        )}
                      </label>
                    ))}
                    {intakeTemplateDefinition.questions.length === 0 ? (
                      <p className="inline-empty">No preview answers are needed.</p>
                    ) : null}
                  </div>
                  <div className="intake-preview-results">
                    <div className="row-actions">
                      <button
                        className="secondary-button compact-button"
                        disabled={previewingIntakeTemplate}
                        onClick={() => void previewIntakeTemplate()}
                        type="button"
                      >
                        {previewingIntakeTemplate ? "Checking..." : "Preview checks"}
                      </button>
                    </div>
                    <p className="inline-empty">{intakePreviewStatus}</p>
                    {intakePreviewResult?.checks.length ? (
                      <div className="party-list">
                        {intakePreviewResult.checks.map((check, index) => (
                          <div className="party-row" key={`${check.code}-${index}`}>
                            <span>
                              <strong>{check.code.replaceAll("_", " ")}</strong>
                              <small>{check.message}</small>
                              <small>
                                {[check.sectionId, check.itemId, check.questionId, check.packageId]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            </span>
                            <em className={check.severity === "blocking" ? "risk" : undefined}>
                              {check.severity}
                            </em>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {intakePreviewResult?.preview ? (
                      <div className="detail-grid intake-preview-summary">
                        <div>
                          <span className="field-label">Visible items</span>
                          <strong>
                            {intakePreviewResult.preview.visibleFormItemIds?.length ?? 0}
                          </strong>
                        </div>
                        <div>
                          <span className="field-label">Required incomplete</span>
                          <strong>
                            {intakePreviewResult.preview.requiredIncompleteItemIds?.length ?? 0}
                          </strong>
                        </div>
                        <div>
                          <span className="field-label">Packages</span>
                          <strong>{intakePreviewResult.preview.packageSummaries.length}</strong>
                        </div>
                        <div>
                          <span className="field-label">Documents</span>
                          <strong>{intakePreviewResult.preview.packageDocuments.length}</strong>
                        </div>
                      </div>
                    ) : null}
                    {intakePreviewResult?.preview?.requiredIncompleteItemIds?.length ? (
                      <p className="field-hint">
                        Required before submit:{" "}
                        {intakePreviewResult.preview.requiredIncompleteItemIds.join(", ")}
                      </p>
                    ) : null}
                    {intakePreviewResult?.preview?.packageSummaries.length ? (
                      <p className="field-hint">
                        Package preview:{" "}
                        {intakePreviewResult.preview.packageSummaries
                          .map((summary) => summary.title)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="section-title">
                  <h3>Client form links</h3>
                  <span>{activeMatter.number}</span>
                </div>
                <div className="upload-create-grid">
                  <label className="search-field compact">
                    <span>Expiry</span>
                    <input
                      onChange={(event) => setIntakeFormExpiresAt(event.target.value)}
                      type="datetime-local"
                      value={intakeFormExpiresAt}
                    />
                  </label>
                  <button
                    className="secondary-button compact-button"
                    disabled={startingIntakeSession || !selectedIntakeTemplate}
                    onClick={() => openIntakeSessionConfirmation()}
                    type="button"
                  >
                    <Plus size={16} />
                    {startingIntakeSession ? "Starting..." : "Start session"}
                  </button>
                  <button
                    className="primary-button"
                    disabled={creatingIntakeFormLink || activeIntakeSessions.length === 0}
                    onClick={() => void createIntakeFormLink()}
                    type="button"
                  >
                    {creatingIntakeFormLink ? "Creating..." : "Create link"}
                  </button>
                </div>
                {pendingDeliveryConfirmation?.kind === "intake-session-start" ? (
                  <DeliveryConfirmationPanel
                    busy={startingIntakeSession}
                    confirmation={pendingDeliveryConfirmation}
                    onCancel={() => setPendingDeliveryConfirmation(null)}
                    onConfirm={confirmPendingDelivery}
                  />
                ) : null}
                {intakeFormToken ? (
                  <OneTimeSecretPanel
                    items={[{ label: "One-time token", value: intakeFormToken }]}
                  />
                ) : null}
                {intakeFormPortalUrl ? (
                  <OneTimeSecretPanel
                    items={[{ label: "Client form URL", value: intakeFormPortalUrl }]}
                  />
                ) : null}
                <p className="inline-empty">{intakeFormStatus}</p>
                <div className="party-list">
                  {activeIntakeFormLinks.map((link) => {
                    const linkState = getIntakeFormLinkState(link);
                    const itemActions = intakeFormActionsByLinkId[link.id] ?? [];
                    return (
                      <div className="party-row upload-link-row" key={link.id}>
                        <span>
                          <strong>{link.id}</strong>
                          <small>
                            {link.intakeSessionId} · expires {compactDate(link.expiresAt)} · created{" "}
                            {compactDate(link.createdAt)}
                          </small>
                          {itemActions.length > 0 ? (
                            <small>{itemActions.map(summarizeIntakeItemAction).join(" · ")}</small>
                          ) : null}
                        </span>
                        <div className="row-actions">
                          <em className={linkState === "active" ? undefined : "risk"}>
                            {linkState}
                          </em>
                          {!link.revokedAt && !link.submittedAt ? (
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={revokingIntakeFormLinkId === link.id}
                              onClick={() => void revokeIntakeFormLink(link.id)}
                              type="button"
                            >
                              {revokingIntakeFormLinkId === link.id ? "Revoking..." : "Revoke"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {activeIntakeFormLinks.length === 0 ? (
                    <p className="inline-empty">No form links are linked to this matter.</p>
                  ) : null}
                </div>

                <div className="section-title">
                  <h3>Submitted review</h3>
                  <span>{activePendingIntakeReviewLinks.length} pending</span>
                </div>
                <div className="party-list">
                  {activePendingIntakeReviewLinks.map((link) => {
                    const reviewPayload = intakeReviewDetailsByLinkId[link.id];
                    const reason = intakeReviewReasons[link.id] ?? "";
                    const decisionBusy = reviewingIntakeFormLinkId.startsWith(`${link.id}:`);
                    const answers = reviewPayload
                      ? Object.entries(reviewPayload.snapshot.answers)
                      : [];
                    return (
                      <div className="party-row upload-link-row" key={`review-${link.id}`}>
                        <span>
                          <strong>{link.id}</strong>
                          <small>
                            submitted {compactDate(link.submittedAt)} · session{" "}
                            {link.intakeSessionId}
                          </small>
                          {reviewPayload ? (
                            <>
                              <small>
                                snapshot {reviewPayload.snapshot.id} · captured{" "}
                                {compactDate(reviewPayload.snapshot.capturedAt)}
                              </small>
                              <small>
                                answers:{" "}
                                {answers.length === 0
                                  ? "none"
                                  : answers
                                      .map(
                                        ([questionId, value]) =>
                                          `${questionId}: ${summarizeAnswerValue(value)}`,
                                      )
                                      .join(" · ")}
                              </small>
                              {reviewPayload.actions.length > 0 ? (
                                <small>
                                  item actions:{" "}
                                  {reviewPayload.actions.map(summarizeIntakeItemAction).join(" · ")}
                                </small>
                              ) : null}
                              {reviewPayload.reviews.length > 0 ? (
                                <small>
                                  decisions:{" "}
                                  {reviewPayload.reviews.map(summarizeIntakeReview).join(" · ")}
                                </small>
                              ) : null}
                            </>
                          ) : (
                            <small>
                              Load the staff review payload before recording a decision.
                            </small>
                          )}
                        </span>
                        <div className="row-actions">
                          <button
                            className="secondary-button compact-button row-button"
                            disabled={loadingIntakeReviewLinkId === link.id}
                            onClick={() => void loadSubmittedIntakeReview(link.id)}
                            type="button"
                          >
                            {loadingIntakeReviewLinkId === link.id ? "Loading..." : "Load review"}
                          </button>
                          {reviewPayload && reviewPayload.reviews.length === 0 ? (
                            <>
                              <label className="search-field compact rejection-field">
                                <span>Decision reason</span>
                                <input
                                  onChange={(event) =>
                                    setIntakeReviewReasons((current) => ({
                                      ...current,
                                      [link.id]: event.target.value,
                                    }))
                                  }
                                  value={reason}
                                />
                              </label>
                              <button
                                className="secondary-button compact-button row-button"
                                disabled={decisionBusy}
                                onClick={() => void decideSubmittedIntakeReview(link.id, "accept")}
                                type="button"
                              >
                                Accept
                              </button>
                              <button
                                className="secondary-button compact-button row-button"
                                disabled={decisionBusy}
                                onClick={() => void decideSubmittedIntakeReview(link.id, "reject")}
                                type="button"
                              >
                                Reject
                              </button>
                              <button
                                className="secondary-button compact-button row-button"
                                disabled={decisionBusy}
                                onClick={() =>
                                  void decideSubmittedIntakeReview(link.id, "request-more-info")
                                }
                                type="button"
                              >
                                More info
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {activePendingIntakeReviewLinks.length === 0 ? (
                    <p className="inline-empty">No submitted intake forms are pending review.</p>
                  ) : null}
                </div>

                <div className="section-title">
                  <h3>Variable proposals</h3>
                  <span>{activeIntakeVariableProposals.length} records</span>
                </div>
                <div className="party-list">
                  {activeIntakeVariableProposals.map((proposal) => (
                    <div className="party-row upload-link-row" key={proposal.id}>
                      <span>
                        <strong>
                          {proposal.targetScope}.{proposal.targetField}
                        </strong>
                        <small>
                          proposed {proposal.proposedValue} · current{" "}
                          {currentProposalValue(proposal, activeMatter)} · from{" "}
                          {proposal.sourceQuestionId}
                        </small>
                        {proposal.rejectionReason ? (
                          <small>reason: {proposal.rejectionReason}</small>
                        ) : null}
                      </span>
                      <div className="row-actions">
                        <em className={proposal.status === "pending" ? undefined : "risk"}>
                          {proposal.status}
                        </em>
                        {proposal.status === "pending" ? (
                          <>
                            <label className="search-field compact rejection-field">
                              <span>Reject reason</span>
                              <input
                                onChange={(event) =>
                                  setProposalRejectionReasons((current) => ({
                                    ...current,
                                    [proposal.id]: event.target.value,
                                  }))
                                }
                                value={proposalRejectionReasons[proposal.id] ?? ""}
                              />
                            </label>
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={reviewingIntakeProposalId === proposal.id}
                              onClick={() =>
                                void reviewIntakeVariableProposal(proposal, "approved")
                              }
                              type="button"
                            >
                              Approve
                            </button>
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={reviewingIntakeProposalId === proposal.id}
                              onClick={() =>
                                void reviewIntakeVariableProposal(proposal, "rejected")
                              }
                              type="button"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {activeIntakeVariableProposals.length === 0 ? (
                    <p className="inline-empty">No variable proposals are waiting for review.</p>
                  ) : null}
                </div>

                <div className="section-title">
                  <h3>Intake sessions</h3>
                  <span>{activeIntakeSessions.length} records</span>
                </div>
                <div className="party-list">
                  {activeIntakeSessions.map((sessionRecord) => (
                    <div className="party-row" key={sessionRecord.id}>
                      <span>
                        <strong>
                          {intakeTemplates.find(
                            (template) => template.id === sessionRecord.templateId,
                          )?.name ?? sessionRecord.templateId}
                        </strong>
                        <small>
                          {sessionRecord.provider} · updated{" "}
                          {new Date(sessionRecord.updatedAt).toLocaleDateString("en-CA")}
                        </small>
                      </span>
                      <em>{sessionRecord.status.replace("_", " ")}</em>
                    </div>
                  ))}
                  {activeIntakeSessions.length === 0 ? (
                    <p className="inline-empty">No intake sessions are linked to this matter.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "audit" ? (
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
                    onClick={() => void refreshAuditLane()}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    {auditRefreshState.refreshing ? "Refreshing" : auditFreshnessCue.label}
                  </button>
                </div>
                <div className="party-list">
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
                        <strong>{auditProjectionIssues.unknownActionCount}</strong>
                        <small>Unknown actions</small>
                      </span>
                      <span>
                        <strong>{auditProjectionIssues.matterScopeGapCount}</strong>
                        <small>Matter-scope gaps</small>
                      </span>
                      <span>
                        <strong>{auditProjectionIssues.resourceTypeMismatchCount}</strong>
                        <small>Resource-type mismatches</small>
                      </span>
                    </div>
                    <div className="audit-projection-details">
                      <span>
                        <strong>Unknown</strong>
                        <small>
                          {auditProjectionIssues.unknownActions.length > 0
                            ? auditProjectionIssues.unknownActions.slice(0, 4).join(", ")
                            : "No unknown actions in the loaded audit window."}
                        </small>
                      </span>
                      <span>
                        <strong>Mismatches</strong>
                        <small>
                          {auditProjectionIssues.resourceTypeMismatches.length > 0
                            ? auditProjectionIssues.resourceTypeMismatches
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
                  </div>
                  {activeMatter.activity.map((entry) => (
                    <div className="party-row" key={entry.id}>
                      <span>
                        <strong>{entry.title}</strong>
                        <small>{new Date(entry.occurredAt).toLocaleString("en-CA")}</small>
                      </span>
                      <em>{entry.kind}</em>
                    </div>
                  ))}
                  {activeMatter.activity.length === 0 ? (
                    <p className="inline-empty">No activity has been recorded for this matter.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "queues" ? (
              <QueuesSection
                activeSavedOperationalViewDefinition={activeSavedOperationalViewDefinition}
                activeSavedOperationalViewId={activeSavedOperationalViewId}
                activeWorkerRuns={activeWorkerRuns}
                archivingOperationalViewId={archivingOperationalViewId}
                compactDate={compactDate}
                compactProviderStatus={compactProviderStatus}
                compactStatus={compactStatus}
                connectorOperations={connectorOperations}
                connectorRecoveryBusyKey={connectorRecoveryBusyKey}
                connectorRecoveryNow={freshnessNow}
                connectorRecoveryStatus={connectorRecoveryStatus}
                connectorOperationsSummary={connectorOperationsSummary}
                displayedQueues={displayedQueues}
                formatSavedOperationalViewDefinition={formatSavedOperationalViewDefinition}
                formatWorkerRunAttempts={formatWorkerRunAttempts}
                formatWorkerRunTiming={formatWorkerRunTiming}
                onApplyQueueOperationalViewDefinition={applyQueueOperationalViewDefinition}
                onArchiveQueueOperationalViewDefinition={archiveQueueOperationalViewDefinition}
                onCancelConnectorRecovery={cancelConnectorRecovery}
                onClearQueueOperationalViewDefinition={clearQueueOperationalViewDefinition}
                onConfirmConnectorRecovery={() => void confirmConnectorRecovery()}
                onRefreshProviders={() => void refreshProviderLane()}
                onRefreshQueues={() => void refreshQueueLane()}
                onRequestConnectorRecovery={requestConnectorRecovery}
                onSaveQueueOperationalViewDefinition={saveQueueOperationalViewDefinition}
                onSelectMatter={selectMatter}
                onSetOcrProviderEnabled={(enabled) => void setOcrProviderEnabled(enabled)}
                onWorkerRunFilterChange={setWorkerRunFilter}
                canManageDocumentProcessingProvider={canManageDocumentProcessingProvider}
                canManageConnectorRecovery={canManageConnectorRecovery}
                ocrProviderUpdateStatus={ocrProviderUpdateStatus}
                ocrProviderUpdating={ocrProviderUpdating}
                pendingConnectorRecovery={pendingConnectorRecovery}
                providerFreshnessCue={providerFreshnessCue}
                providerRows={providerRows}
                providerStatus={providerStatus}
                providerStatusSummary={providerStatusSummary}
                providerRefreshing={providerRefreshState.refreshing}
                queueFreshnessCue={queueFreshnessCue}
                queueSummary={queueSummary}
                queueRefreshing={queueRefreshState.refreshing}
                savedOperationalViewDefinitions={queueOperationalViewDefinitions}
                savedOperationalViewStatus={savedOperationalViewStatus}
                savingOperationalView={savingOperationalView}
                taskDeadlineSummary={taskDeadlineSummary}
                taskWorkbench={taskWorkbench}
                workerHealth={workerHealth}
                workerHealthStateTone={workerHealthStateTone}
                workerHealthSummary={workerHealthSummary}
                workerRunFilter={workerRunFilter}
                workerRunFilterOptions={workerRunFilters}
                workerRunSafeContext={workerRunSafeContext}
                workerRunStatus={describeWorkerRunStatus}
                workerRunSummary={workerRunSummary}
              />
            ) : null}
          </MatterDetailShell>

          <ContextRail
            conflictAliases={conflictAliases}
            conflictIdentifiers={conflictIdentifiers}
            conflictName={conflictName}
            conflictProspectiveRole={conflictProspectiveRole}
            conflictResults={conflictResults}
            conflictStatus={conflictStatus}
            queueSummary={queueSummary}
            queues={queues}
            taskDeadlineSummary={taskDeadlineSummary}
            onConflictAliasesChange={setConflictAliases}
            onConflictIdentifiersChange={setConflictIdentifiers}
            onConflictNameChange={setConflictName}
            onConflictProspectiveRoleChange={setConflictProspectiveRole}
            onRunConflictCheck={runConflictCheck}
          />
        </section>
      </section>
    </main>
  );
}
