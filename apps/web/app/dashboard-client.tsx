"use client";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarDays,
  Clock3,
  ContactRound,
  CreditCard,
  FileText,
  FilePenLine,
  FileSignature,
  Files,
  Gavel,
  Link2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AiOperationalProposalRecord,
  ConflictCandidate,
  DraftExportFormat,
  EmbeddedIntakeTemplateDefinitionV2,
  LegalResearchArtifactRecord,
  StaffReportDefinitionKey,
  StaffReportExportProfileId,
  StaffReportGroupingKey,
} from "@open-practice/domain";
import type { CalendarMeetingLinkMode } from "@open-practice/domain/calendar-models";
import { type DashboardNavigationSectionKey } from "../routes/routeCatalog";
import {
  buildCreateShareLinkPayload,
  describeCreateShareLinkResult,
  replaceShareLink,
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
  externalUploadCreateControlDisabled,
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
  describeIntakeTemplatePreview,
  describeRequestMoreInfoResult,
  pendingSubmittedIntakeReviewLinks,
  upsertIntakeFormLink,
  upsertIntakeVariableProposal,
  type IntakeFormReviewLoadResponse,
  type IntakePreviewAnswers,
} from "./intake-forms-dashboard";
import { BillingSection } from "./dashboard/billing-section";
import { DocumentsSection } from "./dashboard/documents-section";
import { DraftingSection } from "./dashboard/drafting-section";
import { ExternalUploadsSection } from "./dashboard/external-uploads-section";
import { ShareLinksSection } from "./dashboard/share-links-section";
import { TrustControlsSection } from "./dashboard/trust-controls-section";
import {
  applySavedQueueFocus,
  applySavedMatterFocus,
  buildCreateMatterPayload,
  canSubmitFirstMatter,
  dashboardLaneFreshnessCue,
  describeSavedMatterFocus,
  describeSavedQueueFocus,
  filterMatters,
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
import {
  buildCalendarEventPayload,
  buildCalendarRadarBuckets,
  buildCalendarInvitationPayload,
  buildCalendarMeetingLinkPayload,
  buildCalendarReminderPayload,
  buildCalendarReschedulePayload,
  removeCalendarEventReminder,
  removeStandaloneCalendarEventReminder,
  removeCalendarEventAttendee,
  upsertCalendarEvent,
  upsertCalendarEventAttendee,
  upsertCalendarCredential,
  upsertCalendarEventReminder,
  upsertCalendarGuestSession,
  upsertStandaloneCalendarEvent,
  upsertStandaloneCalendarEventReminder,
} from "./calendar-dashboard";
import {
  buildDocumentProcessingOcrProviderPath,
  buildDocumentProcessingQueuePath,
  buildDocumentProcessingWorkbenchPath,
  documentMetadataSearchFilterCount,
  documentProcessingRowsForMatter,
  emptyDocumentProcessingWorkbench,
  replaceDocumentProcessingWorkbench,
  summarizeDocumentMetadataSearch,
  summarizeDocumentReviewSuggestions,
  summarizeDocumentProcessingWorkbench,
} from "./document-processing-dashboard";
import { emptyDocumentAssemblyWorkbench } from "./document-assembly-dashboard";
import {
  buildContactDataQualityResolutionPayload,
  buildContactDossierConflictCheckPrefill,
  contactDataQualitySignalKey,
  filterContactDossiers,
  formatContactDataQualityResolutionDecision,
  formatContactReviewSignalKind,
} from "./contact-dossiers-dashboard";
import { formatProfessionalRoleLabel } from "./participant-role-labels";
import { findLegalClinicProgram, fiscalHostWorkflowMetadata } from "./legal-clinic-dashboard";
import {
  activeJurisdictionTrustReportSummary,
  buildTrustControlsPath,
  emptyTrustControlsDashboard,
  matterTrustBalanceCents,
  recentTrustPostings,
  summarizeTrustControls,
  trustControlsForMatter,
} from "./trust-controls-dashboard";
import {
  buildExpenseReviewDraftPayload,
  buildDraftInvoicePayload,
  buildTimerDraftTimeEntryPayload,
  describeDraftInvoiceCreated,
  formatExpenseDraftApiFailure,
  formatDraftInvoiceApiFailure,
  formatTimerDraftApiFailure,
  summarizePaymentSettlementReview,
  updateBillingDashboardWithExpenseDraft,
  updateBillingDashboardWithCreatedInvoice,
  updateBillingDashboardWithTimerDraft,
  type CreatedDraftInvoiceResponse,
  type CreatedExpenseReviewDraftResponse,
  type CreatedTimerDraftTimeEntryResponse,
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
  buildAiOperationalProposalReviewPath,
  buildAiOperationalProposalsPath,
  buildAllDraftOperationalProposalKindsPayload,
  buildDraftOperationalProposalJobPath,
  canReviewAiOperationalProposals,
  describeAiOperationalProposalGeneration,
  replaceAiOperationalProposal,
} from "./ai-operational-proposals-dashboard";
import {
  buildLegalResearchReviewPath,
  canReviewLegalResearch,
  emptyLegalResearchWorkspace,
  replaceLegalResearchArtifact,
} from "./legal-research-dashboard";
import {
  buildConnectorOutboxDeadLetterPath,
  buildConnectorOutboxDeadLetterPayload,
  buildConnectorOutboxRetryPath,
  buildConnectorOutboxRetryPayload,
  summarizeConnectorOperations,
  type ConnectorRecoveryAction,
  type PendingConnectorRecovery,
} from "./connector-outbox-dashboard";
import {
  buildPublicConsultationIntakeConvertPath,
  buildPublicConsultationIntakeDismissPath,
  buildPublicConsultationIntakeSettingsPath,
  buildPublicConsultationIntakesPath,
  buildPublicConsultationSettingsPayload,
  compactPublicConsultationReviewActionReason,
  describePublicConsultationReviewAction,
  publicConsultationSettingsControlDisabled,
  publicConsultationReviewBusyAction,
  publicConsultationReviewBusyKey,
  publicConsultationSettingsSummary,
  upsertPublicConsultationIntake,
} from "./public-consultation-intakes-dashboard";
import {
  buildOperationalFocusSummary,
  operationalFocusEmptyMessage,
} from "./operational-focus-panel";
import {
  emptyAuditProjectionDashboard,
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
import { requestConnectorOperationsForDashboard } from "./_features/connectors/client-resources";
import {
  cents,
  compactDate,
  compactStatus,
  formatSavedMatterViewDefinition,
  formatSavedOperationalViewDefinition,
  minutes,
} from "./_features/dashboard/formatters";
import {
  buildDashboardShellNavigationModel,
  dashboardActiveSectionLabel,
} from "./_features/dashboard/dashboard-shell-model";
import { useDashboardShellState } from "./_features/dashboard/dashboard-shell-state";
import {
  ContextRail,
  DashboardMetrics,
  DashboardReviewRailCollapsedTarget,
  DashboardReviewRailExpandHandle,
  DashboardSidebar,
  DashboardTopbar,
  MatterContextPanel,
  MatterDetailShell,
  OperationalFocusPanel,
  type DashboardMetric,
} from "./dashboard/dashboard-shell";
import { ContactsSection } from "./dashboard/contacts-section";
import { CalendarSection } from "./dashboard/calendar-section";
import { FirstMatterWorkspace } from "./dashboard/first-matter-workspace";
import { MatterOverviewSection } from "./dashboard/matter-overview-section";
import { QueuesSection } from "./dashboard/queues-section";
import { ReportsSection } from "./dashboard/reports-section";
import { AdminReadinessSection } from "./dashboard/admin-readiness-section";
import { AuditSection } from "./dashboard/audit-section";
import { ResearchSection } from "./dashboard/research-section";
import { SignaturesSection } from "./dashboard/signatures-section";
import { IntakeSection } from "./dashboard/intake-section";
import { type PendingDeliveryConfirmation } from "./dashboard/shared-panels";
import {
  buildEmailDeliveryConfirmation,
  buildIntakeSessionCreatePayload,
  upsertIntakeSession,
} from "./types";
import {
  canRecordContactDataQualityResolutions,
  type ContactDataQualityResolutionRecord,
  type ContactDataQualityResolutionsResponse,
  type ContactDossiersResponse,
  type ContactReviewQueueResponse,
} from "./_features/contacts/models";
import type {
  BillingDashboardResponse,
  JurisdictionalTrustReportResponse,
  TrustControlsDashboardResponse,
} from "./_features/billing/models";
import type { DocumentAssemblyDashboardResponse } from "./_features/document-assembly/models";
import type {
  ExternalUploadCreateResponse,
  ExternalUploadReviewItem,
  ExternalUploadRevokeResponse,
  ExternalUploadsDashboardResponse,
} from "./_features/external-uploads/models";
import type { EmailDeliveryDashboardResponse } from "./_features/email-delivery/models";
import type {
  CreateShareLinkResponse,
  RevokeShareLinkResponse,
  ShareLinkPermission,
  ShareLinkRecord,
  ShareLinksResponse,
  ShareLinksStatusResponse,
} from "./_features/share-links/models";
import type {
  CalendarAttendeeMutationResponse,
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
} from "./_features/calendar/models";
import type {
  ConnectorOperationsResponse,
  ConnectorOutboxRecoveryResponse,
} from "./_features/connectors/models";
import type {
  AuditResponse,
  AiOperationalProposalsResponse,
  CapabilitiesResponse,
  ClientPortalAccountSetupResponse,
  CommunicationsInboxDashboardResponse,
  ConflictResponse,
  DocumentProcessingDashboardResponse,
  DocumentMetadataSearchFilters,
  DocumentProcessingStatusResponse,
  DocumentProcessingWorkbenchResponse,
  DraftingDashboardResponse,
  DraftExportResponse,
  DraftAssistRecordsResponse,
  DraftAssistStatusResponse,
  IntakeSessionsResponse,
  IntakeSessionCreateResponse,
  IntakeFormsDashboardResponse,
  IntakePipelineDashboardResponse,
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
  PublicConsultationDashboardResponse,
  PublicConsultationIntake,
  PublicConsultationIntakeConvertResponse,
  PublicConsultationIntakeSettings,
  PublicConsultationIntakesResponse,
  QueuesResponse,
  SessionResponse,
  SetupStatusResponse,
  SignatureRequestsResponse,
  StaffReportExportRequestResponse,
  StaffReportingWorkspaceResponse,
  TaskDeadlineWorkbenchResponse,
  IntakeVariableProposalsResponse,
  LegalResearchDashboardResponse,
  WorkerHealthResponse,
  WorkerRunQueueFilter,
  WorkerRunsDashboardResponse,
} from "./types";

interface DashboardClientProps {
  apiBaseUrl: string;
  auditProjection: AuditProjectionDashboardResponse;
  aiOperationalProposals: AiOperationalProposalsResponse;
  billing: BillingDashboardResponse;
  calendar: CalendarDashboardResponse;
  capabilities: CapabilitiesResponse;
  communicationsInbox: CommunicationsInboxDashboardResponse;
  connectorOperations: ConnectorOperationsResponse;
  contactDataQualityResolutions: ContactDataQualityResolutionsResponse;
  contactDossiers: ContactDossiersResponse;
  contactReviewQueue: ContactReviewQueueResponse;
  devHeaders: Record<string, string>;
  documentAssembly: DocumentAssemblyDashboardResponse;
  documentProcessing: DocumentProcessingDashboardResponse;
  drafting: DraftingDashboardResponse;
  emailDeliveryHistory: EmailDeliveryDashboardResponse;
  externalUploads: ExternalUploadsDashboardResponse;
  intake: IntakeSessionsResponse;
  intakeForms: IntakeFormsDashboardResponse;
  intakePipeline: IntakePipelineDashboardResponse;
  jurisdictionalTrustReport: JurisdictionalTrustReportResponse;
  legalClinic: LegalClinicDashboardResponse;
  legalResearch: LegalResearchDashboardResponse;
  initialSection: DashboardNavigationSectionKey;
  overview: PracticeOverview;
  operationalViewDefinitions?: SavedOperationalViewDefinition[];
  operationalViews: OperationalViewsResponse;
  providerStatus: ProvidersStatusResponse;
  publicConsultation: PublicConsultationDashboardResponse;
  reportingWorkspace: StaffReportingWorkspaceResponse;
  matters: MatterSummary[];
  session: SessionResponse;
  shareLinksStatus: ShareLinksStatusResponse;
  signatures: SignatureRequestsResponse;
  setupStatus: SetupStatusResponse;
  taskWorkbench: TaskDeadlineWorkbenchResponse;
  trustControls: TrustControlsDashboardResponse;
  queues: QueuesResponse;
  workerHealth: WorkerHealthResponse;
  workerRuns: WorkerRunsDashboardResponse;
}

type LocalDashboardSectionKey = DashboardNavigationSectionKey;
type DashboardDraft = DraftingDashboardResponse["draftsByMatterId"][string][number];
type DashboardDraftAssistRecord = DraftAssistRecordsResponse["records"][number];
type DashboardIntakeVariableProposal = IntakeVariableProposalsResponse["proposals"][number];
type DashboardCalendarEvent = CalendarDashboardResponse["eventsByMatterId"][string][number];
type DashboardCalendarScope = NonNullable<DashboardCalendarEvent["scope"]>;

const dashboardLaneStaleAfterMs = 5 * 60 * 1000;

const navIcons: Record<LocalDashboardSectionKey, LucideIcon> = {
  matters: Gavel,
  contacts: ContactRound,
  funds: Banknote,
  billing: CreditCard,
  reports: BarChart3,
  documents: Files,
  research: Search,
  shares: Link2,
  externalUploads: Upload,
  drafting: FilePenLine,
  calendar: CalendarDays,
  signatures: FileSignature,
  intake: FileText,
  audit: ShieldCheck,
  admin: LockKeyhole,
  queues: Clock3,
};

export default function DashboardClient({
  apiBaseUrl,
  auditProjection: initialAuditProjection,
  aiOperationalProposals: initialAiOperationalProposals,
  billing,
  calendar,
  capabilities,
  communicationsInbox,
  connectorOperations: initialConnectorOperations,
  contactDataQualityResolutions: initialContactDataQualityResolutions,
  contactDossiers,
  contactReviewQueue,
  devHeaders,
  documentAssembly,
  documentProcessing,
  drafting,
  emailDeliveryHistory,
  externalUploads,
  intake,
  intakeForms,
  intakePipeline,
  jurisdictionalTrustReport,
  legalClinic,
  legalResearch,
  initialSection,
  overview,
  operationalViewDefinitions = [],
  operationalViews: initialOperationalViews,
  providerStatus: initialProviderStatus,
  publicConsultation,
  reportingWorkspace: initialReportingWorkspace,
  matters: initialMatters,
  session,
  signatures,
  setupStatus,
  taskWorkbench,
  trustControls,
  queues: initialQueues,
  workerHealth,
  workerRuns,
  shareLinksStatus,
}: DashboardClientProps) {
  const [matters, setMatters] = useState(initialMatters);
  const [queues, setQueues] = useState(initialQueues);
  const [aiOperationalProposals, setAiOperationalProposals] = useState(
    initialAiOperationalProposals,
  );
  const [auditProjection, setAuditProjection] = useState(initialAuditProjection);
  const [providerStatus, setProviderStatus] = useState(initialProviderStatus);
  const [connectorOperations, setConnectorOperations] = useState(initialConnectorOperations);
  const [operationalViews, setOperationalViews] = useState(initialOperationalViews);
  const [reportingWorkspace, setReportingWorkspace] = useState(initialReportingWorkspace);
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
  const [exportingReportKey, setExportingReportKey] = useState("");
  const [reportExportStatus, setReportExportStatus] = useState(
    reportingWorkspace.history.length > 0
      ? `${reportingWorkspace.history.length} report export request${reportingWorkspace.history.length === 1 ? "" : "s"} loaded.`
      : "No report export requested in this session.",
  );
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
  const [contactDossierRecords, setContactDossierRecords] = useState(contactDossiers);
  const [contactSearch, setContactSearch] = useState("");
  const [activeContactId, setActiveContactId] = useState(contactDossiers[0]?.contact.id ?? "");
  const [contactCreateKind, setContactCreateKind] = useState<"person" | "organization">("person");
  const [contactCreateDisplayName, setContactCreateDisplayName] = useState("");
  const [contactCreateEmail, setContactCreateEmail] = useState("");
  const [contactCreatePhone, setContactCreatePhone] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);
  const [creatingMatterFromContactId, setCreatingMatterFromContactId] = useState("");
  const [contactCreateStatus, setContactCreateStatus] = useState(
    "No standalone contact created in this session.",
  );
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
  const [timerDraftStartedAt, setTimerDraftStartedAt] = useState("");
  const [timerDraftStoppedAt, setTimerDraftStoppedAt] = useState("");
  const [timerDraftNarrative, setTimerDraftNarrative] = useState("");
  const [timerDraftRate, setTimerDraftRate] = useState("");
  const [timerDraftBillable, setTimerDraftBillable] = useState(true);
  const [timerDraftStatus, setTimerDraftStatus] = useState("No timer draft created.");
  const [creatingTimerDraft, setCreatingTimerDraft] = useState(false);
  const firstExpenseProfileKey = billing.expenseCategoryProfiles[0]?.key ?? "";
  const [expenseDraftProfileKey, setExpenseDraftProfileKey] =
    useState<string>(firstExpenseProfileKey);
  const [expenseDraftCategory, setExpenseDraftCategory] = useState("");
  const [expenseDraftAmount, setExpenseDraftAmount] = useState("");
  const [expenseDraftDate, setExpenseDraftDate] = useState("");
  const [expenseDraftDescription, setExpenseDraftDescription] = useState("");
  const [expenseDraftReimbursable, setExpenseDraftReimbursable] = useState(
    billing.expenseCategoryProfiles[0]?.defaultReimbursable ?? true,
  );
  const [expenseDraftStatus, setExpenseDraftStatus] = useState("No expense draft created.");
  const [creatingExpenseDraft, setCreatingExpenseDraft] = useState(false);
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
  const [queueingAiOperationalProposals, setQueueingAiOperationalProposals] = useState(false);
  const [aiOperationalProposalStatus, setAiOperationalProposalStatus] = useState(
    describeAiOperationalProposalGeneration(initialAiOperationalProposals),
  );
  const [reviewingAiOperationalProposalId, setReviewingAiOperationalProposalId] = useState("");
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
  const [clientPortalContactId, setClientPortalContactId] = useState("");
  const [clientPortalSetupToken, setClientPortalSetupToken] = useState("");
  const [clientPortalStatus, setClientPortalStatus] = useState(
    "No client portal account setup run in this session.",
  );
  const [creatingClientPortalAccount, setCreatingClientPortalAccount] = useState(false);
  const [externalUploadsByMatterId, setExternalUploadsByMatterId] = useState(
    externalUploads.uploadsByMatterId,
  );
  const [externalUploadDocumentsByMatterId, setExternalUploadDocumentsByMatterId] = useState(
    externalUploads.reviewItemsByMatterId,
  );
  const [documentAssemblyByMatterId] = useState(documentAssembly.workbenchesByMatterId);
  const [legalResearchByMatterId, setLegalResearchByMatterId] = useState(
    legalResearch.workbenchesByMatterId,
  );
  const [legalResearchReviewBusyId, setLegalResearchReviewBusyId] = useState("");
  const [legalResearchStatus, setLegalResearchStatus] = useState(
    "Research workspace artifacts loaded.",
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
  const [standaloneCalendarEvents, setStandaloneCalendarEvents] = useState(
    calendar.standaloneEvents,
  );
  const [calendarScope, setCalendarScope] = useState<DashboardCalendarScope>(
    initialMatters[0] ? "matter" : "firm",
  );
  const [calendarClientContactId, setCalendarClientContactId] = useState(
    contactDossiers[0]?.contact.id ?? "",
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
  const [publicConsultationIntakes, setPublicConsultationIntakes] = useState(
    publicConsultation.intakes,
  );
  const [publicConsultationSettings, setPublicConsultationSettings] = useState(
    publicConsultation.settings,
  );
  const [publicConsultationEnabled, setPublicConsultationEnabled] = useState(
    publicConsultation.settings.enabled,
  );
  const [publicConsultationSender, setPublicConsultationSender] = useState(
    publicConsultation.settings.senderAddress,
  );
  const [publicConsultationRecipients, setPublicConsultationRecipients] = useState(
    publicConsultation.settings.recipientEmails.join(", "),
  );
  const [publicConsultationOrigins, setPublicConsultationOrigins] = useState(
    publicConsultation.settings.allowedOrigins.join("\n"),
  );
  const [publicConsultationReviewOwner, setPublicConsultationReviewOwner] = useState(
    publicConsultation.settings.reviewOwnerUserId ?? "",
  );
  const [publicConsultationStatus, setPublicConsultationStatus] = useState(
    publicConsultation.status === "available"
      ? `Public consultation intake ${publicConsultationSettingsSummary(publicConsultation.settings)}.`
      : "Public consultation intake settings are not available for this role.",
  );
  const [savingPublicConsultationSettings, setSavingPublicConsultationSettings] = useState(false);
  const [refreshingPublicConsultationIntakes, setRefreshingPublicConsultationIntakes] =
    useState(false);
  const [publicConsultationBusyIntakeId, setPublicConsultationBusyIntakeId] = useState("");
  const [publicConsultationDismissReasons, setPublicConsultationDismissReasons] = useState<
    Record<string, string>
  >({});

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
    () => filterContactDossiers(contactDossierRecords, contactSearch),
    [contactDossierRecords, contactSearch],
  );
  const activeContactDossier =
    filteredContactDossiers.find((dossier) => dossier.contact.id === activeContactId) ??
    filteredContactDossiers[0] ??
    contactDossierRecords[0];
  const activeContactDataQualityResolutions = activeContactDossier
    ? contactDataQualityResolutions.filter(
        (resolution) => resolution.contactId === activeContactDossier.contact.id,
      )
    : [];
  const canRecordContactDataQualityResolution = Boolean(
    canRecordContactDataQualityResolutions(capabilities.sections),
  );
  const canCreateContact = capabilities.sections.some(
    (section) =>
      section.key === "contacts" && section.enabled && section.actions.includes("create"),
  );
  const activeMatter = matters.find((matter) => matter.id === activeMatterId) ?? matters[0];
  const activeSignatures = signatures.filter(
    (signature) => signature.matterId === activeMatter?.id,
  );
  const activeIntakeSessions = intakeSessions.filter(
    (sessionRecord) => sessionRecord.matterId === activeMatter?.id,
  );
  const activeDocuments = activeMatter?.documents ?? [];
  const activeDocumentAssembly = activeMatter
    ? (documentAssemblyByMatterId[activeMatter.id] ??
      emptyDocumentAssemblyWorkbench(activeMatter.id))
    : emptyDocumentAssemblyWorkbench("");
  const activeLegalResearch = activeMatter
    ? (legalResearchByMatterId[activeMatter.id] ?? emptyLegalResearchWorkspace(activeMatter.id))
    : emptyLegalResearchWorkspace("");
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
  const activeClientPortalContacts =
    activeMatter?.parties.filter(
      (party) =>
        !party.adverse &&
        ["client", "prospective_client", "notary_client", "paralegal_client"].includes(
          party.role,
        ) &&
        party.contact.identifiers.some((identifier) => identifier.type === "email"),
    ) ?? [];
  const selectedClientPortalContactId = activeClientPortalContacts.some(
    (party) => party.contactId === clientPortalContactId,
  )
    ? clientPortalContactId
    : activeClientPortalContacts[0]?.contactId || "";
  const activeDrafts = activeMatter ? (draftsByMatterId[activeMatter.id] ?? []) : [];
  const activeExternalUploads = activeMatter
    ? (externalUploadsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeExternalUploadDocuments = activeMatter
    ? (externalUploadDocumentsByMatterId[activeMatter.id] ?? [])
    : [];
  const calendarClientOptions = contactDossierRecords.map((dossier) => ({
    id: dossier.contact.id,
    label: dossier.contact.displayName,
  }));
  const selectedCalendarClientContactId = calendarClientOptions.some(
    (option) => option.id === calendarClientContactId,
  )
    ? calendarClientContactId
    : (calendarClientOptions[0]?.id ?? "");
  const activeCalendarScope =
    calendarScope === "matter" && !activeMatter ? ("firm" as const) : calendarScope;
  const activeStandaloneCalendarEvents = standaloneCalendarEvents.filter((event) => {
    const scope =
      event.scope ?? (event.matterId ? "matter" : event.clientContactId ? "client" : "firm");
    if (activeCalendarScope === "firm") return scope === "firm";
    if (activeCalendarScope === "client") {
      return scope === "client" && event.clientContactId === selectedCalendarClientContactId;
    }
    return false;
  });
  const activeCalendarEvents =
    activeCalendarScope === "matter" && activeMatter
      ? (calendarEventsByMatterId[activeMatter.id] ?? [])
      : activeStandaloneCalendarEvents;
  const activeCalendarSchedulingRequests =
    activeCalendarScope === "matter" && activeMatter
      ? (calendar.schedulingRequestsByMatterId?.[activeMatter.id] ?? [])
      : [];
  const activeCalendarLinks =
    activeCalendarScope === "matter" && activeMatter
      ? calendar.linksByMatterId[activeMatter.id]
      : undefined;
  const activeCalendarLabel =
    activeCalendarScope === "matter" && activeMatter
      ? activeMatter.number
      : activeCalendarScope === "client"
        ? (calendarClientOptions.find((option) => option.id === selectedCalendarClientContactId)
            ?.label ?? "Client calendar")
        : "Firm calendar";
  const matterCalendarControlsEnabled = activeCalendarScope === "matter" && Boolean(activeMatter);
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
  const pendingPublicConsultationIntakes = publicConsultationIntakes.filter(
    (intakeRecord) => intakeRecord.status === "pending",
  );
  const activeMatterPipelineLeads = activeMatter
    ? intakePipeline.leads.filter((lead) => lead.matterId === activeMatter.id)
    : [];
  const recentIntakePipelineLeads = intakePipeline.leads.slice(0, 5);
  const shareLinksCreateAvailable =
    shareLinksStatus.createStatus === "enabled" && shareLinksStatus.canCreate !== false;
  const externalUploadCreateAvailable = canCreateExternalUpload(externalUploads.status);
  const externalUploadCreateDisabled = externalUploadCreateControlDisabled({
    creating: creatingExternalUpload,
    status: externalUploads.status,
  });
  const publicConsultationSettingsDisabled = publicConsultationSettingsControlDisabled(
    publicConsultation.status,
  );
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
  const activeUnbilledTime = activeBilling?.unbilledTime ?? [];
  const activeUnbilledExpenses = activeBilling?.unbilledExpenses ?? [];
  const activeCaptureReviewTime = activeBilling?.captureReviewTime ?? [];
  const activeCaptureReviewExpenses = activeBilling?.captureReviewExpenses ?? [];
  const activeCaptureReviewCount =
    activeCaptureReviewTime.length + activeCaptureReviewExpenses.length;
  const activeInvoices = activeBilling?.invoices ?? [];
  const activeManualPayments = activeBilling?.payments ?? [];
  const activePaymentRequests = activeBilling?.paymentRequests ?? [];
  const activeSettlementReviewSummary = summarizePaymentSettlementReview(activePaymentRequests);
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
  const { navigationSections, matterActionSections } = useMemo(
    () =>
      buildDashboardShellNavigationModel({
        billingCanView: billingDashboard.canView,
        capabilitySections: capabilities.sections,
        hasAccessibleMatter,
        canCreateMatter,
        shareLinksEnabled: shareLinksCreateAvailable,
        externalUploadsEnabled: externalUploadCreateAvailable,
        sessionRole: session.user.role,
      }),
    [
      billingDashboard.canView,
      canCreateMatter,
      capabilities.sections,
      externalUploadCreateAvailable,
      hasAccessibleMatter,
      session.user.role,
      shareLinksCreateAvailable,
    ],
  );
  const {
    activeSection,
    detailPanelRef,
    expandContextRail,
    isContextRailCollapsed,
    reviewRailExpandHandleRef,
    reviewRailToggleRef,
    selectDashboardSection,
    toggleContextRail,
  } = useDashboardShellState({
    initialSection,
    navigationSections,
  });
  const activeSectionLabel = dashboardActiveSectionLabel({
    activeMatterTitle: activeMatter?.title,
    activeSection,
    navigationSections,
  });
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
  const canReviewAiProposalRecords = canReviewAiOperationalProposals(session.user.role);
  const canReviewLegalResearchArtifacts = canReviewLegalResearch(session.user.role);
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
        publicConsultationStatus: publicConsultation.status,
        pendingPublicConsultationCount: pendingPublicConsultationIntakes.length,
      }),
    [
      activeActivitySummary,
      activeMatterCommandCenter,
      operationalViews,
      pendingPublicConsultationIntakes.length,
      providerStatus,
      publicConsultation.status,
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
      const [payload, connectorPayload, aiProposalPayload] = await Promise.all([
        requestDashboardJson<QueuesResponse>(apiBaseUrl, "/api/queues", {
          headers: devHeaders,
        }),
        requestConnectorOperationsForDashboard(apiBaseUrl, devHeaders),
        requestDashboardJson<AiOperationalProposalsResponse>(
          apiBaseUrl,
          buildAiOperationalProposalsPath(),
          { headers: devHeaders },
        ),
      ]);
      setQueues(payload);
      setConnectorOperations(connectorPayload);
      setAiOperationalProposals(aiProposalPayload);
      setAiOperationalProposalStatus(describeAiOperationalProposalGeneration(aiProposalPayload));
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

  function startTimerDraft(): void {
    const now = new Date().toISOString();
    setTimerDraftStartedAt(now);
    setTimerDraftStoppedAt("");
    setTimerDraftStatus(`Timer started ${new Date(now).toLocaleTimeString("en-CA")}.`);
  }

  function stopTimerDraft(): void {
    if (!timerDraftStartedAt) {
      setTimerDraftStatus("Start the timer before stopping it.");
      return;
    }
    const now = new Date().toISOString();
    setTimerDraftStoppedAt(now);
    setTimerDraftStatus(`Timer stopped ${new Date(now).toLocaleTimeString("en-CA")}.`);
  }

  async function createTimerDraft(): Promise<void> {
    if (!activeMatter) return;
    const payloadResult = buildTimerDraftTimeEntryPayload({
      matter: activeMatter,
      startedAt: timerDraftStartedAt,
      stoppedAt: timerDraftStoppedAt,
      rateHourly: timerDraftRate,
      narrative: timerDraftNarrative,
      billable: timerDraftBillable,
      locks: billingDashboard.periodLocks,
    });

    if (!payloadResult.payload) {
      setTimerDraftStatus(payloadResult.error ?? "Timer draft payload is incomplete.");
      return;
    }

    setCreatingTimerDraft(true);
    setTimerDraftStatus("Creating timer draft...");
    try {
      const entry = await requestDashboardJson<CreatedTimerDraftTimeEntryResponse>(
        apiBaseUrl,
        "/api/time-entries/timer-drafts",
        {
          method: "POST",
          headers: devHeaders,
          payload: payloadResult.payload,
        },
      );
      setBillingDashboard((current) => updateBillingDashboardWithTimerDraft(current, entry));
      setTimerDraftStartedAt("");
      setTimerDraftStoppedAt("");
      setTimerDraftNarrative("");
      setTimerDraftRate("");
      setTimerDraftStatus(`Created draft time entry for ${minutes(entry.minutes)}.`);
    } catch (error) {
      setTimerDraftStatus(formatTimerDraftApiFailure(dashboardApiStatus(error)));
    } finally {
      setCreatingTimerDraft(false);
    }
  }

  async function createExpenseDraft(): Promise<void> {
    if (!activeMatter) return;
    const payloadResult = buildExpenseReviewDraftPayload({
      matter: activeMatter,
      incurredAtDate: expenseDraftDate,
      amount: expenseDraftAmount,
      categoryProfileKey: expenseDraftProfileKey,
      customCategory: expenseDraftCategory,
      description: expenseDraftDescription,
      reimbursable: expenseDraftReimbursable,
      locks: billingDashboard.periodLocks,
    });

    if (!payloadResult.payload) {
      setExpenseDraftStatus(payloadResult.error ?? "Expense draft payload is incomplete.");
      return;
    }

    setCreatingExpenseDraft(true);
    setExpenseDraftStatus("Creating expense draft...");
    try {
      const entry = await requestDashboardJson<CreatedExpenseReviewDraftResponse>(
        apiBaseUrl,
        "/api/expense-entries/review-drafts",
        {
          method: "POST",
          headers: devHeaders,
          payload: payloadResult.payload,
        },
      );
      setBillingDashboard((current) => updateBillingDashboardWithExpenseDraft(current, entry));
      setExpenseDraftAmount("");
      setExpenseDraftDate("");
      setExpenseDraftCategory("");
      setExpenseDraftDescription("");
      setExpenseDraftStatus(`Created draft expense for ${cents(entry.amountCents)}.`);
    } catch (error) {
      setExpenseDraftStatus(formatExpenseDraftApiFailure(dashboardApiStatus(error)));
    } finally {
      setCreatingExpenseDraft(false);
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

  async function runPublicConsultationConflictCheck(
    intakeRecord: PublicConsultationIntake,
  ): Promise<void> {
    const action = describePublicConsultationReviewAction({
      action: "conflict_check",
      intake: intakeRecord,
      dashboardStatus: publicConsultation.status,
      busyAction: publicConsultationReviewBusyAction(
        publicConsultationBusyIntakeId,
        intakeRecord.id,
      ),
    });
    if (!action.available) {
      setPublicConsultationStatus(
        `${action.label} unavailable: ${compactPublicConsultationReviewActionReason(action.disabledReason)}.`,
      );
      return;
    }
    const identifiers: Array<{ type: "email" | "phone"; value: string }> = [];
    if (intakeRecord.email) identifiers.push({ type: "email", value: intakeRecord.email });
    if (intakeRecord.telephone) {
      identifiers.push({ type: "phone", value: intakeRecord.telephone });
    }
    const payload = {
      prospectiveName: intakeRecord.clientName,
      identifiers,
      prospectiveRole: "client" as const,
      includeClosedMatters: true,
    };
    setPublicConsultationBusyIntakeId(
      publicConsultationReviewBusyKey("conflict_check", intakeRecord.id),
    );
    setConflictName(intakeRecord.clientName);
    setConflictAliases("");
    setConflictIdentifiers("");
    setConflictProspectiveRole("client");
    setConflictResults([]);
    setConflictStatus("Running conflict check for public consultation request...");
    try {
      const response = await requestDashboardJson<ConflictResponse>(
        apiBaseUrl,
        "/api/conflicts/check",
        {
          method: "POST",
          headers: devHeaders,
          payload,
        },
      );
      setConflictResults(response.results);
      setConflictStatus(
        `${describeConflictCheckStatus(payload, response.results.length)} Review request details in Intake before any separate opposing-party checks.`,
      );
    } catch (error) {
      setConflictResults([]);
      setConflictStatus(`Conflict check failed: ${dashboardApiStatus(error)}`);
    } finally {
      setPublicConsultationBusyIntakeId("");
    }
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

  async function refreshContactDossiers(selectedContactId?: string): Promise<void> {
    const dossiers = await requestDashboardJson<ContactDossiersResponse>(
      apiBaseUrl,
      "/api/contacts/dossiers",
      { headers: devHeaders },
    );
    setContactDossierRecords(dossiers);
    if (selectedContactId) {
      setActiveContactId(selectedContactId);
      setCalendarClientContactId(selectedContactId);
    } else if (!dossiers.some((dossier) => dossier.contact.id === activeContactId)) {
      setActiveContactId(dossiers[0]?.contact.id ?? "");
      setCalendarClientContactId(dossiers[0]?.contact.id ?? "");
    }
  }

  async function createContact(): Promise<void> {
    const displayName = contactCreateDisplayName.trim();
    if (!canCreateContact || !displayName) return;
    setCreatingContact(true);
    setContactCreateStatus("Creating standalone contact...");
    const identifiers: Array<{ type: "email" | "phone"; value: string }> = [];
    if (contactCreateEmail.trim()) {
      identifiers.push({ type: "email", value: contactCreateEmail.trim() });
    }
    if (contactCreatePhone.trim()) {
      identifiers.push({ type: "phone", value: contactCreatePhone.trim() });
    }
    try {
      const payload = await requestDashboardJson<{
        contact: ContactDossiersResponse[number]["contact"];
      }>(apiBaseUrl, "/api/contacts", {
        method: "POST",
        headers: devHeaders,
        payload: {
          kind: contactCreateKind,
          displayName,
          identifiers,
        },
      });
      await refreshContactDossiers(payload.contact.id);
      setContactCreateDisplayName("");
      setContactCreateEmail("");
      setContactCreatePhone("");
      setContactCreateStatus("Standalone contact created.");
    } catch (error) {
      setContactCreateStatus(`Contact create failed: ${dashboardApiStatus(error)}`);
    } finally {
      setCreatingContact(false);
    }
  }

  async function createMatterFromContact(dossier: ContactDossiersResponse[number]): Promise<void> {
    if (!canCreateMatter) return;
    setCreatingMatterFromContactId(dossier.contact.id);
    setFirstMatterStatus(`Creating matter for ${dossier.contact.displayName}...`);
    try {
      const created = await requestDashboardJson<MatterSummary>(apiBaseUrl, "/api/matters", {
        method: "POST",
        headers: devHeaders,
        payload: {
          title: firstMatterForm.title.trim() || `${dossier.contact.displayName} matter`,
          practiceArea: firstMatterForm.practiceArea.trim() || "General practice",
          jurisdiction: firstMatterForm.jurisdiction,
          clientContactId: dossier.contact.id,
        },
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
      await refreshContactDossiers(dossier.contact.id);
      setFirstMatterStatus(`Created matter ${created.number} for ${dossier.contact.displayName}.`);
      selectDashboardSection("matters");
    } catch (error) {
      setFirstMatterStatus(`Matter create failed: ${dashboardApiStatus(error)}`);
    } finally {
      setCreatingMatterFromContactId("");
    }
  }

  function prepareAppointmentForContact(dossier: ContactDossiersResponse[number]): void {
    setActiveContactId(dossier.contact.id);
    setCalendarClientContactId(dossier.contact.id);
    setCalendarScope("client");
    if (!calendarEventTitle.trim()) {
      setCalendarEventTitle(`${dossier.contact.displayName} appointment`);
    }
    setCalendarEventLifecycleStatus(
      `Prepared client appointment for ${dossier.contact.displayName}.`,
    );
    selectDashboardSection("calendar");
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
    try {
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
    } catch (error) {
      setDraftAssistMessage(`Draft assist failed: ${dashboardApiStatus(error)}`);
    } finally {
      setRunningDraftAssist(false);
    }
  }

  async function queueDraftOperationalProposals(): Promise<void> {
    if (!selectedDraft || aiOperationalProposals.generation.status !== "configured") return;

    setQueueingAiOperationalProposals(true);
    setAiOperationalProposalStatus("Queueing operational proposals...");
    try {
      const response = await fetch(
        `${apiBaseUrl}${buildDraftOperationalProposalJobPath(selectedDraft.id)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            ...devHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildAllDraftOperationalProposalKindsPayload()),
        },
      );

      if (!response.ok) {
        setAiOperationalProposalStatus(`Operational proposal queue failed: ${response.status}`);
        return;
      }
      const payload = (await response.json()) as {
        proposalKinds: AiOperationalProposalRecord["kind"][];
        job: { id: string; status: string };
      };
      setAiOperationalProposalStatus(
        `${payload.proposalKinds.length} operational proposal families queued for review.`,
      );
    } catch (error) {
      setAiOperationalProposalStatus(
        `Operational proposal queue failed: ${dashboardApiStatus(error)}`,
      );
    } finally {
      setQueueingAiOperationalProposals(false);
    }
  }

  async function reviewAiOperationalProposal(
    record: AiOperationalProposalRecord,
    decision: "approved" | "rejected",
  ): Promise<void> {
    setReviewingAiOperationalProposalId(record.id);
    setAiOperationalProposalStatus(`Recording ${decision} proposal review...`);
    try {
      const response = await fetch(
        `${apiBaseUrl}${buildAiOperationalProposalReviewPath(record.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            ...devHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision }),
        },
      );

      if (!response.ok) {
        setAiOperationalProposalStatus(`Operational proposal review failed: ${response.status}`);
        return;
      }
      const updated = (await response.json()) as AiOperationalProposalRecord;
      setAiOperationalProposals((current) => replaceAiOperationalProposal(current, updated));
      setAiOperationalProposalStatus(`Proposal ${decision}; no downstream record was created.`);
    } catch (error) {
      setAiOperationalProposalStatus(
        `Operational proposal review failed: ${dashboardApiStatus(error)}`,
      );
    } finally {
      setReviewingAiOperationalProposalId("");
    }
  }

  async function reviewLegalResearchArtifact(
    record: LegalResearchArtifactRecord,
    decision: "reviewed" | "rejected",
  ): Promise<void> {
    setLegalResearchReviewBusyId(record.id);
    setLegalResearchStatus(`Recording ${decision} research review...`);
    try {
      const response = await fetch(`${apiBaseUrl}${buildLegalResearchReviewPath(record.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision }),
      });

      if (!response.ok) {
        setLegalResearchStatus(`Research review failed: ${response.status}`);
        return;
      }
      const updated = (await response.json()) as LegalResearchArtifactRecord;
      setLegalResearchByMatterId((current) => {
        const workspace =
          current[updated.matterId] ?? emptyLegalResearchWorkspace(updated.matterId);
        return {
          ...current,
          [updated.matterId]: replaceLegalResearchArtifact(workspace, updated),
        };
      });
      setLegalResearchStatus(`Research artifact ${decision}; no downstream record was created.`);
    } catch (error) {
      setLegalResearchStatus(`Research review failed: ${dashboardApiStatus(error)}`);
    } finally {
      setLegalResearchReviewBusyId("");
    }
  }

  async function reviewDraftAssistRecord(
    record: DashboardDraftAssistRecord,
    decision: "reviewed" | "rejected",
  ): Promise<void> {
    try {
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
    } catch (error) {
      setDraftAssistMessage(`Review update failed: ${dashboardApiStatus(error)}`);
    }
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

  function calendarTargetPayload(
    event?: Pick<DashboardCalendarEvent, "scope" | "matterId" | "clientContactId">,
  ): { scope: DashboardCalendarScope; matterId?: string; clientContactId?: string } | null {
    if (event) {
      const scope =
        event.scope ?? (event.matterId ? "matter" : event.clientContactId ? "client" : "firm");
      return {
        scope,
        ...(scope === "matter" && event.matterId ? { matterId: event.matterId } : {}),
        ...(scope === "client" && event.clientContactId
          ? { clientContactId: event.clientContactId }
          : {}),
      };
    }

    if (activeCalendarScope === "matter") {
      return activeMatter ? { scope: "matter", matterId: activeMatter.id } : null;
    }
    if (activeCalendarScope === "client") {
      return selectedCalendarClientContactId
        ? { scope: "client", clientContactId: selectedCalendarClientContactId }
        : null;
    }
    return { scope: "firm" };
  }

  function upsertCalendarEventForScope(
    current: Record<string, DashboardCalendarEvent[]>,
    event: DashboardCalendarEvent,
  ): Record<string, DashboardCalendarEvent[]> {
    if (!event.matterId) return current;
    return upsertCalendarEvent(current, event.matterId, event);
  }

  async function createCalendarEvent(): Promise<void> {
    const target = calendarTargetPayload();
    if (!target) {
      setCalendarEventLifecycleStatus(
        "Select a visible client contact before creating a client event.",
      );
      return;
    }
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
            ...target,
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
    if (payload.event.matterId) {
      setCalendarEventsByMatterId((current) => upsertCalendarEventForScope(current, payload.event));
    } else {
      setStandaloneCalendarEvents((current) =>
        upsertStandaloneCalendarEvent(current, payload.event),
      );
    }
    setCalendarEventTitle("");
    setCalendarEventStartsAt("");
    setCalendarEventEndsAt("");
    setCalendarEventDescription("");
    setCalendarEventLocation("");
    setCalendarEventLifecycleStatus("Calendar event created.");
    setCreatingCalendarEvent(false);
  }

  async function rescheduleCalendarEvent(event: DashboardCalendarEvent): Promise<void> {
    const target = calendarTargetPayload(event);
    if (!target || !calendarEventStartsAt || !calendarEventEndsAt) return;
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
            ...target,
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
    if (payload.event.matterId) {
      setCalendarEventsByMatterId((current) => upsertCalendarEventForScope(current, payload.event));
    } else {
      setStandaloneCalendarEvents((current) =>
        upsertStandaloneCalendarEvent(current, payload.event),
      );
    }
    setCalendarEventLifecycleStatus("Calendar event rescheduled.");
    setUpdatingCalendarEventId("");
  }

  async function cancelCalendarEvent(event: DashboardCalendarEvent): Promise<void> {
    const target = calendarTargetPayload(event);
    if (!target) return;
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
          payload: target,
        },
      );
    } catch (error) {
      setCalendarEventLifecycleStatus(`Event cancel failed: ${dashboardApiStatus(error)}`);
      setCancelingCalendarEventId("");
      return;
    }
    if (payload.event.matterId) {
      setCalendarEventsByMatterId((current) => upsertCalendarEventForScope(current, payload.event));
    } else {
      setStandaloneCalendarEvents((current) =>
        upsertStandaloneCalendarEvent(current, payload.event),
      );
    }
    setCalendarEventLifecycleStatus("Calendar event cancelled.");
    setCancelingCalendarEventId("");
  }

  async function addCalendarReminder(): Promise<void> {
    if (!selectedCalendarReminderEvent) return;
    const target = calendarTargetPayload(selectedCalendarReminderEvent);
    if (!target) return;
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
            ...target,
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
    if (selectedCalendarReminderEvent.matterId) {
      setCalendarEventsByMatterId((current) =>
        upsertCalendarEventReminder(
          current,
          selectedCalendarReminderEvent.matterId!,
          selectedCalendarReminderEvent.id,
          payload.reminder,
        ),
      );
    } else {
      setStandaloneCalendarEvents((current) =>
        upsertStandaloneCalendarEventReminder(
          current,
          selectedCalendarReminderEvent.id,
          payload.reminder,
        ),
      );
    }
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
    const event = activeCalendarEvents.find((candidate) => candidate.id === eventId);
    const target = event ? calendarTargetPayload(event) : null;
    if (!event || !target) return;
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
          payload: { ...target, status },
        },
      );
    } catch (error) {
      setCalendarReminderStatus(`Reminder update failed: ${dashboardApiStatus(error)}`);
      setUpdatingCalendarReminderId("");
      return;
    }
    if (event.matterId) {
      setCalendarEventsByMatterId((current) =>
        upsertCalendarEventReminder(current, event.matterId!, eventId, payload.reminder),
      );
    } else {
      setStandaloneCalendarEvents((current) =>
        upsertStandaloneCalendarEventReminder(current, eventId, payload.reminder),
      );
    }
    setCalendarReminderStatus("Reminder updated.");
    setUpdatingCalendarReminderId("");
  }

  async function removeCalendarReminder(eventId: string, reminderId: string): Promise<void> {
    const event = activeCalendarEvents.find((candidate) => candidate.id === eventId);
    const target = event ? calendarTargetPayload(event) : null;
    if (!event || !target) return;
    setRemovingCalendarReminderId(reminderId);
    setCalendarReminderStatus("Removing reminder...");
    const query = new URLSearchParams();
    query.set("scope", target.scope);
    if (target.matterId) query.set("matterId", target.matterId);
    if (target.clientContactId) query.set("clientContactId", target.clientContactId);
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(
        eventId,
      )}/reminders/${encodeURIComponent(reminderId)}?${query.toString()}`,
      { method: "DELETE", credentials: "include", headers: devHeaders },
    );
    if (!response.ok) {
      setCalendarReminderStatus(`Reminder remove failed: ${response.status}`);
      setRemovingCalendarReminderId("");
      return;
    }
    if (event.matterId) {
      setCalendarEventsByMatterId((current) =>
        removeCalendarEventReminder(current, event.matterId!, eventId, reminderId),
      );
    } else {
      setStandaloneCalendarEvents((current) =>
        removeStandaloneCalendarEventReminder(current, eventId, reminderId),
      );
    }
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

  async function updateCalendarMeetingLink(
    event: DashboardCalendarEvent,
    mode: CalendarMeetingLinkMode,
    externalUrl: string,
  ): Promise<void> {
    if (!activeMatter) return;
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

  async function refreshPublicConsultationIntakes(): Promise<void> {
    setRefreshingPublicConsultationIntakes(true);
    setPublicConsultationStatus("Refreshing public consultation requests...");
    try {
      const payload = await requestDashboardJson<PublicConsultationIntakesResponse>(
        apiBaseUrl,
        buildPublicConsultationIntakesPath("pending"),
        { headers: devHeaders },
      );
      setPublicConsultationIntakes(payload.intakes);
      setPublicConsultationStatus(
        payload.intakes.length === 0
          ? "No public consultation requests are pending review."
          : `${payload.intakes.length} public consultation request${payload.intakes.length === 1 ? "" : "s"} pending review.`,
      );
    } catch (error) {
      setPublicConsultationStatus(`Refresh failed: ${dashboardApiStatus(error)}`);
    } finally {
      setRefreshingPublicConsultationIntakes(false);
    }
  }

  async function savePublicConsultationSettings(rotateSubmissionToken = false): Promise<void> {
    const settingsPayload = buildPublicConsultationSettingsPayload({
      enabled: publicConsultationEnabled,
      senderAddress: publicConsultationSender,
      recipientEmailsText: publicConsultationRecipients,
      allowedOriginsText: publicConsultationOrigins,
      reviewOwnerUserId: publicConsultationReviewOwner,
      submissionTokenConfigured: publicConsultationSettings.submissionTokenConfigured,
      rotateSubmissionToken,
    });
    if ("error" in settingsPayload) {
      setPublicConsultationStatus(settingsPayload.error);
      return;
    }
    setSavingPublicConsultationSettings(true);
    setPublicConsultationStatus("Saving public consultation intake settings...");
    try {
      const saved = await requestDashboardJson<PublicConsultationIntakeSettings>(
        apiBaseUrl,
        buildPublicConsultationIntakeSettingsPath(),
        {
          method: "PUT",
          headers: devHeaders,
          payload: settingsPayload.payload,
        },
      );
      setPublicConsultationSettings(saved);
      setPublicConsultationEnabled(saved.enabled);
      setPublicConsultationSender(saved.senderAddress);
      setPublicConsultationRecipients(saved.recipientEmails.join(", "));
      setPublicConsultationOrigins(saved.allowedOrigins.join("\n"));
      setPublicConsultationReviewOwner(saved.reviewOwnerUserId ?? "");
      setPublicConsultationStatus(
        saved.submissionToken
          ? `Saved: ${publicConsultationSettingsSummary(saved)}. New submission token: ${saved.submissionToken}`
          : `Saved: ${publicConsultationSettingsSummary(saved)}.`,
      );
    } catch (error) {
      setPublicConsultationStatus(`Settings save failed: ${dashboardApiStatus(error)}`);
    } finally {
      setSavingPublicConsultationSettings(false);
    }
  }

  async function dismissPublicConsultationIntake(
    intakeRecord: PublicConsultationIntake,
  ): Promise<void> {
    const action = describePublicConsultationReviewAction({
      action: "dismiss",
      intake: intakeRecord,
      dashboardStatus: publicConsultation.status,
      busyAction: publicConsultationReviewBusyAction(
        publicConsultationBusyIntakeId,
        intakeRecord.id,
      ),
    });
    if (!action.available) {
      setPublicConsultationStatus(
        `${action.label} unavailable: ${compactPublicConsultationReviewActionReason(action.disabledReason)}.`,
      );
      return;
    }
    setPublicConsultationBusyIntakeId(publicConsultationReviewBusyKey("dismiss", intakeRecord.id));
    setPublicConsultationStatus("Dismissing public consultation request...");
    try {
      const payload = await requestDashboardJson<{ intake: PublicConsultationIntake | null }>(
        apiBaseUrl,
        buildPublicConsultationIntakeDismissPath(intakeRecord.id),
        {
          method: "POST",
          headers: devHeaders,
          payload: { reason: publicConsultationDismissReasons[intakeRecord.id] ?? "" },
        },
      );
      if (payload.intake) {
        setPublicConsultationIntakes((current) =>
          upsertPublicConsultationIntake(current, payload.intake!),
        );
      }
      setPublicConsultationStatus("Dismissed public consultation request.");
    } catch (error) {
      setPublicConsultationStatus(`Dismiss failed: ${dashboardApiStatus(error)}`);
    } finally {
      setPublicConsultationBusyIntakeId("");
    }
  }

  async function convertPublicConsultationIntake(
    intakeRecord: PublicConsultationIntake,
  ): Promise<void> {
    const action = describePublicConsultationReviewAction({
      action: "convert",
      intake: intakeRecord,
      dashboardStatus: publicConsultation.status,
      busyAction: publicConsultationReviewBusyAction(
        publicConsultationBusyIntakeId,
        intakeRecord.id,
      ),
    });
    if (!action.available) {
      setPublicConsultationStatus(
        `${action.label} unavailable: ${compactPublicConsultationReviewActionReason(action.disabledReason)}.`,
      );
      return;
    }
    setPublicConsultationBusyIntakeId(publicConsultationReviewBusyKey("convert", intakeRecord.id));
    setPublicConsultationStatus("Converting public consultation request...");
    try {
      const payload = await requestDashboardJson<PublicConsultationIntakeConvertResponse>(
        apiBaseUrl,
        buildPublicConsultationIntakeConvertPath(intakeRecord.id),
        {
          method: "POST",
          headers: devHeaders,
          payload: {
            practiceArea: "consultation",
            jurisdiction: "BC",
          },
        },
      );
      setPublicConsultationIntakes((current) =>
        upsertPublicConsultationIntake(current, payload.intake),
      );
      setMatters((current) =>
        current.some((matter) => matter.id === payload.matter.id)
          ? current.map((matter) => (matter.id === payload.matter.id ? payload.matter : matter))
          : [payload.matter, ...current],
      );
      setActiveMatterId(payload.matter.id);
      setPublicConsultationStatus(
        `Converted public consultation request into matter ${payload.matter.number}.`,
      );
    } catch (error) {
      setPublicConsultationStatus(`Convert failed: ${dashboardApiStatus(error)}`);
    } finally {
      setPublicConsultationBusyIntakeId("");
    }
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
                captureReviewTime: [],
                captureReviewExpenses: [],
                unbilledTime: [],
                unbilledExpenses: [],
                invoices: [],
                payments: [],
                paymentRequests: [],
              },
              ...current.matters,
            ],
      }));
      await refreshContactDossiers();
      setFirstMatterForm(initialFirstMatterFormState);
      setFirstMatterStatus(`${created.number} created.`);
      selectDashboardSection("matters");
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
    if (!activeMatter || !shareLinksCreateAvailable) return;
    if (requireEmailVerification && !shareNotificationEmail.trim()) {
      setShareStatus(
        "Share link creation failed: notification email is required for verification.",
      );
      return;
    }

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

  async function createClientPortalAccount(): Promise<void> {
    if (!activeMatter || !selectedClientPortalContactId) {
      setClientPortalStatus("Select a client contact before account setup.");
      return;
    }
    setCreatingClientPortalAccount(true);
    setClientPortalSetupToken("");
    setClientPortalStatus("Creating client portal account...");
    try {
      const payload = await requestDashboardJson<ClientPortalAccountSetupResponse>(
        apiBaseUrl,
        "/api/client-portal/accounts",
        {
          method: "POST",
          headers: devHeaders,
          payload: {
            matterId: activeMatter.id,
            contactId: selectedClientPortalContactId,
          },
        },
      );
      setClientPortalSetupToken(
        payload.setup.status === "token_created" ? payload.setup.token : "",
      );
      setClientPortalStatus(
        payload.setup.status === "token_created"
          ? `Client account ready for ${payload.account.email}.`
          : `Client account ready for ${payload.account.email}; setup token unavailable.`,
      );
    } catch (error) {
      setClientPortalStatus(`Client account setup failed: ${dashboardApiStatus(error)}`);
    } finally {
      setCreatingClientPortalAccount(false);
    }
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

  async function requestReportExport(
    reportDefinitionKey: StaffReportDefinitionKey,
    exportProfileId: StaffReportExportProfileId,
    groupingKey: StaffReportGroupingKey,
  ): Promise<void> {
    const busyKey = `${reportDefinitionKey}:${exportProfileId}`;
    setExportingReportKey(busyKey);
    setReportExportStatus(`Queuing ${reportDefinitionKey.replaceAll("_", " ")} export...`);
    try {
      const payload = await requestDashboardJson<StaffReportExportRequestResponse>(
        apiBaseUrl,
        "/api/reports/export-requests",
        {
          method: "POST",
          headers: devHeaders,
          payload: {
            reportDefinitionKey,
            exportProfileId,
            groupingKey,
          },
        },
      );
      setReportingWorkspace((current) => ({
        ...current,
        history: [
          payload.exportRequest,
          ...current.history.filter((item) => item.jobId !== payload.exportRequest.jobId),
        ],
      }));
      setReportExportStatus(`Report export ${payload.exportRequest.status}.`);
    } catch (error) {
      setReportExportStatus(`Report export failed: ${dashboardApiStatus(error)}`);
    } finally {
      setExportingReportKey("");
    }
  }

  if (!activeMatter) {
    return (
      <main className="app-shell dashboard-shell legal-ops-shell" aria-labelledby="dashboard-title">
        <a className="skip-link" href="#matter-workspace">
          Skip to workspace
        </a>
        <DashboardSidebar
          activeSection={activeSection}
          matterState="empty"
          navigationSections={navigationSections}
          navIcons={navIcons}
          onSelectSection={selectDashboardSection}
        />

        <section className="workspace dashboard-workspace zero-matter-workspace">
          <DashboardTopbar
            firmName={overview.firm.name}
            session={session}
            formatProfessionalRole={formatProfessionalRoleLabel}
            isContextRailCollapsed={isContextRailCollapsed}
            onToggleContextRail={toggleContextRail}
            reviewRailToggleRef={reviewRailToggleRef}
          />

          <DashboardMetrics metrics={metrics} />

          <OperationalFocusPanel
            operationalFocus={operationalFocus}
            operationalFocusEmpty={operationalFocusEmpty}
            navigationSections={navigationSections}
            onOpenQueues={() => selectDashboardSection("queues")}
            onSelectSection={selectDashboardSection}
          />

          <section
            className={`main-grid matter-workspace-grid zero-matter-workspace-grid ${isContextRailCollapsed ? "context-rail-collapsed" : ""}`}
          >
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
                  canCreateContact={canCreateContact}
                  canCreateMatter={canCreateMatter}
                  compactStatus={compactStatus}
                  contactCreateDisplayName={contactCreateDisplayName}
                  contactCreateEmail={contactCreateEmail}
                  contactCreateKind={contactCreateKind}
                  contactCreatePhone={contactCreatePhone}
                  contactCreateStatus={contactCreateStatus}
                  contactDossiers={contactDossierRecords}
                  contactDataQualityResolutions={activeContactDataQualityResolutions}
                  contactDataQualityStatus={contactDataQualityStatus}
                  contactReviewQueue={contactReviewQueue}
                  contactSearch={contactSearch}
                  creatingContact={creatingContact}
                  creatingMatterFromContactId={creatingMatterFromContactId}
                  filteredContactDossiers={filteredContactDossiers}
                  onContactCreateDisplayNameChange={setContactCreateDisplayName}
                  onContactCreateEmailChange={setContactCreateEmail}
                  onContactCreateKindChange={setContactCreateKind}
                  onContactCreatePhoneChange={setContactCreatePhone}
                  onCreateContact={() => void createContact()}
                  onCreateMatterFromContact={(dossier) => void createMatterFromContact(dossier)}
                  onNewAppointmentForContact={prepareAppointmentForContact}
                  onRecordContactDataQualityResolution={recordContactDataQualityResolution}
                  onContactSearchChange={setContactSearch}
                  onPrepareConflictCheckFromContact={prepareConflictCheckFromContact}
                  onSelectContact={setActiveContactId}
                  onSelectMatter={selectMatter}
                  recordingContactResolutionKey={recordingContactResolutionKey}
                />
              </article>
            ) : null}

            {activeSection === "calendar" ? (
              <article
                aria-labelledby="zero-calendar-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Calendar radar</p>
                    <h2 id="zero-calendar-title">Calendar</h2>
                  </div>
                  <span className="status-chip">Firm/client surface</span>
                </div>
                <CalendarSection
                  activeCalendarBuckets={activeCalendarBuckets}
                  activeCalendarEvents={activeCalendarEvents}
                  activeCalendarLinks={activeCalendarLinks}
                  activeCalendarSchedulingRequests={activeCalendarSchedulingRequests}
                  activeCalendarScope={activeCalendarScope}
                  activeMatterNumber={activeCalendarLabel}
                  addingCalendarAttendee={addingCalendarAttendee}
                  addingCalendarReminder={addingCalendarReminder}
                  calendarAttendeeEmail={calendarAttendeeEmail}
                  calendarAttendeeName={calendarAttendeeName}
                  calendarAttendeeRole={calendarAttendeeRole}
                  calendarCredentialLabel={calendarCredentialLabel}
                  calendarCredentialStatus={calendarCredentialStatus}
                  calendarCredentials={calendarCredentials}
                  calendarEventDescription={calendarEventDescription}
                  calendarEventEndsAt={calendarEventEndsAt}
                  calendarEventLifecycleStatus={calendarEventLifecycleStatus}
                  calendarEventLocation={calendarEventLocation}
                  calendarEventStartsAt={calendarEventStartsAt}
                  calendarEventStatusValue={calendarEventStatusValue}
                  calendarEventTitle={calendarEventTitle}
                  calendarGuestSessionSecret={calendarGuestSessionSecret}
                  calendarGuestSessionStatus={calendarGuestSessionStatus}
                  calendarGuestSessionsByEventId={calendarGuestSessionsByEventId}
                  calendarMeetingLinkModesByEventId={calendarMeetingLinkModesByEventId}
                  calendarMeetingLinkUrlsByEventId={calendarMeetingLinkUrlsByEventId}
                  calendarMeetingStatus={calendarMeetingStatus}
                  calendarOneTimeSecret={calendarOneTimeSecret}
                  calendarReminderAt={calendarReminderAt}
                  calendarReminderNote={calendarReminderNote}
                  calendarReminderStatus={calendarReminderStatus}
                  calendarReminderStatusValue={calendarReminderStatusValue}
                  calendarClientContactId={selectedCalendarClientContactId}
                  calendarClientOptions={calendarClientOptions}
                  cancelingCalendarEventId={cancelingCalendarEventId}
                  creatingCalendarCredential={creatingCalendarCredential}
                  creatingCalendarEvent={creatingCalendarEvent}
                  creatingCalendarGuestSessionEventId={creatingCalendarGuestSessionEventId}
                  pendingDeliveryConfirmation={pendingDeliveryConfirmation}
                  removingCalendarAttendeeId={removingCalendarAttendeeId}
                  removingCalendarReminderId={removingCalendarReminderId}
                  revokingCalendarCredentialId={revokingCalendarCredentialId}
                  selectedCalendarMeetingEvent={selectedCalendarMeetingEvent}
                  selectedCalendarReminderEvent={selectedCalendarReminderEvent}
                  sendingCalendarInvitationsEventId={sendingCalendarInvitationsEventId}
                  matterCalendarControlsEnabled={matterCalendarControlsEnabled}
                  updatingCalendarEventId={updatingCalendarEventId}
                  updatingCalendarGuestSessionKey={updatingCalendarGuestSessionKey}
                  updatingCalendarMeetingLinkEventId={updatingCalendarMeetingLinkEventId}
                  updatingCalendarReminderId={updatingCalendarReminderId}
                  onAddCalendarAttendee={() => void addCalendarAttendee()}
                  onAddCalendarReminder={() => void addCalendarReminder()}
                  onCancelCalendarEvent={(event) => void cancelCalendarEvent(event)}
                  onCancelPendingDeliveryConfirmation={() => setPendingDeliveryConfirmation(null)}
                  onConfirmPendingDelivery={confirmPendingDelivery}
                  onControlCalendarGuestSession={(event, session, action) =>
                    void controlCalendarGuestSession(event, session, action)
                  }
                  onCreateCalendarCredential={() => void createCalendarCredential()}
                  onCreateCalendarEvent={() => void createCalendarEvent()}
                  onCreateCalendarGuestSession={(event) => void createCalendarGuestSession(event)}
                  onIssueCalendarGuestLink={(event, session) =>
                    void issueCalendarGuestLink(event, session)
                  }
                  onOpenCalendarInvitationConfirmation={openCalendarInvitationConfirmation}
                  onRemoveCalendarAttendee={(eventId, attendeeId) =>
                    void removeCalendarAttendee(eventId, attendeeId)
                  }
                  onRemoveCalendarReminder={(eventId, reminderId) =>
                    void removeCalendarReminder(eventId, reminderId)
                  }
                  onRescheduleCalendarEvent={(event) => void rescheduleCalendarEvent(event)}
                  onRevokeCalendarCredential={(credentialId) =>
                    void revokeCalendarCredential(credentialId)
                  }
                  onSetCalendarAttendeeEmail={setCalendarAttendeeEmail}
                  onSetCalendarAttendeeName={setCalendarAttendeeName}
                  onSetCalendarAttendeeRole={setCalendarAttendeeRole}
                  onSetCalendarScope={(scope) => setCalendarScope(scope)}
                  onSetCalendarClientContactId={setCalendarClientContactId}
                  onSetCalendarCredentialLabel={setCalendarCredentialLabel}
                  onSetCalendarEventDescription={setCalendarEventDescription}
                  onSetCalendarEventEndsAt={setCalendarEventEndsAt}
                  onSetCalendarEventLocation={setCalendarEventLocation}
                  onSetCalendarEventStartsAt={setCalendarEventStartsAt}
                  onSetCalendarEventStatusValue={setCalendarEventStatusValue}
                  onSetCalendarEventTitle={setCalendarEventTitle}
                  onSetCalendarMeetingEventId={setCalendarMeetingEventId}
                  onSetCalendarMeetingLinkMode={(eventId, mode) =>
                    setCalendarMeetingLinkModesByEventId((current) => ({
                      ...current,
                      [eventId]: mode,
                    }))
                  }
                  onSetCalendarMeetingLinkUrl={(eventId, url) =>
                    setCalendarMeetingLinkUrlsByEventId((current) => ({
                      ...current,
                      [eventId]: url,
                    }))
                  }
                  onSetCalendarReminderAt={setCalendarReminderAt}
                  onSetCalendarReminderEventId={setCalendarReminderEventId}
                  onSetCalendarReminderNote={setCalendarReminderNote}
                  onSetCalendarReminderStatusValue={setCalendarReminderStatusValue}
                  onUpdateCalendarGuestLink={(event, session, guestId, action) =>
                    void updateCalendarGuestLink(event, session, guestId, action)
                  }
                  onUpdateCalendarMeetingLink={(event, mode, externalUrl) =>
                    void updateCalendarMeetingLink(event, mode, externalUrl)
                  }
                  onUpdateCalendarReminder={(eventId, reminderId, status) =>
                    void updateCalendarReminder(eventId, reminderId, status)
                  }
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
                <AuditSection
                  auditFreshnessCue={auditFreshnessCue}
                  auditProjection={auditProjection}
                  auditRefreshState={auditRefreshState}
                  compactDate={compactDate}
                  onRefreshAudit={() => void refreshAuditLane()}
                />
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
                  aiOperationalProposals={aiOperationalProposals}
                  aiOperationalProposalStatus={aiOperationalProposalStatus}
                  aiOperationalProposalReviewBusyId={reviewingAiOperationalProposalId}
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
                  canReviewAiOperationalProposals={canReviewAiProposalRecords}
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
                  onReviewAiOperationalProposal={(record, decision) =>
                    void reviewAiOperationalProposal(record, decision)
                  }
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

            {activeSection === "reports" ? (
              <article
                aria-labelledby="zero-reports-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Staff reporting</p>
                    <h2 id="zero-reports-title">Reports</h2>
                  </div>
                  <span className="status-chip">Firm surface</span>
                </div>
                <ReportsSection
                  compactDate={compactDate}
                  cents={cents}
                  exportingReportKey={exportingReportKey}
                  exportStatus={reportExportStatus}
                  minutes={minutes}
                  onRequestReportExport={(definitionKey, exportProfileId, groupingKey) =>
                    void requestReportExport(definitionKey, exportProfileId, groupingKey)
                  }
                  reportingWorkspace={reportingWorkspace}
                />
              </article>
            ) : null}

            {activeSection === "admin" ? (
              <article
                aria-labelledby="zero-admin-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Admin readiness</p>
                    <h2 id="zero-admin-title">Admin Readiness</h2>
                  </div>
                  <span className="status-chip">Firm surface</span>
                </div>
                <AdminReadinessSection
                  capabilities={capabilities}
                  matters={matters}
                  overview={overview}
                  reportingWorkspace={reportingWorkspace}
                  session={session}
                  setupStatus={setupStatus}
                  workerHealth={workerHealth}
                />
              </article>
            ) : null}

            {activeSection === "matters" ? (
              <FirstMatterWorkspace
                canCreateMatter={canCreateMatter}
                creating={creatingFirstMatter}
                form={firstMatterForm}
                onChange={updateFirstMatterForm}
                onCreate={() => void createFirstMatter()}
                status={firstMatterStatus}
              />
            ) : null}

            {activeSection !== "matters" &&
            activeSection !== "contacts" &&
            activeSection !== "calendar" &&
            activeSection !== "audit" &&
            activeSection !== "queues" &&
            activeSection !== "reports" &&
            activeSection !== "admin" ? (
              <article
                aria-labelledby="zero-mixed-section-title"
                className="panel matter-detail matter-detail-panel"
                id="matter-workspace"
                ref={detailPanelRef}
                tabIndex={-1}
              >
                <div className="panel-header matter-detail-header">
                  <div>
                    <p className="eyebrow">Matter-bound workspace</p>
                    <h2 id="zero-mixed-section-title">{activeSectionLabel}</h2>
                  </div>
                  <span className="status-chip">Ready after matter link</span>
                </div>
                <div className="detail-grid compact-detail-grid">
                  <div>
                    <span className="field-label">Section</span>
                    <strong>{activeSectionLabel}</strong>
                  </div>
                  <div>
                    <span className="field-label">Firm</span>
                    <strong>{overview.firm.name}</strong>
                  </div>
                  <div>
                    <span className="field-label">Visible contacts</span>
                    <strong>{contactDossierRecords.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Matters</span>
                    <strong>{matters.length}</strong>
                  </div>
                </div>
                <p className="detail-note">
                  This section can open before a matter exists. Create a matter or start from a
                  visible contact to unlock matter-scoped records here.
                </p>
                <div className="row-actions">
                  <button
                    className="secondary-button compact-button"
                    onClick={() => selectDashboardSection("contacts")}
                    type="button"
                  >
                    <ContactRound size={16} />
                    Contacts
                  </button>
                  <button
                    className="secondary-button compact-button"
                    onClick={() => selectDashboardSection("matters")}
                    type="button"
                  >
                    <Gavel size={16} />
                    Create matter
                  </button>
                </div>
              </article>
            ) : null}

            {!isContextRailCollapsed ? (
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
            ) : (
              <DashboardReviewRailCollapsedTarget />
            )}
          </section>
        </section>
        {isContextRailCollapsed ? (
          <DashboardReviewRailExpandHandle
            expandHandleRef={reviewRailExpandHandleRef}
            onExpand={expandContextRail}
          />
        ) : null}
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
          isContextRailCollapsed={isContextRailCollapsed}
          onToggleContextRail={toggleContextRail}
          reviewRailToggleRef={reviewRailToggleRef}
        />

        <DashboardMetrics metrics={metrics} />

        <OperationalFocusPanel
          operationalFocus={operationalFocus}
          operationalFocusEmpty={operationalFocusEmpty}
          navigationSections={navigationSections}
          onOpenQueues={() => selectDashboardSection("queues")}
          onSelectSection={selectDashboardSection}
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

        <section
          className={`main-grid matter-workspace-grid ${isContextRailCollapsed ? "context-rail-collapsed" : ""}`}
        >
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
                canCreateContact={canCreateContact}
                canCreateMatter={canCreateMatter}
                compactStatus={compactStatus}
                contactCreateDisplayName={contactCreateDisplayName}
                contactCreateEmail={contactCreateEmail}
                contactCreateKind={contactCreateKind}
                contactCreatePhone={contactCreatePhone}
                contactCreateStatus={contactCreateStatus}
                contactDossiers={contactDossierRecords}
                contactDataQualityResolutions={activeContactDataQualityResolutions}
                contactDataQualityStatus={contactDataQualityStatus}
                contactReviewQueue={contactReviewQueue}
                contactSearch={contactSearch}
                creatingContact={creatingContact}
                creatingMatterFromContactId={creatingMatterFromContactId}
                filteredContactDossiers={filteredContactDossiers}
                onContactCreateDisplayNameChange={setContactCreateDisplayName}
                onContactCreateEmailChange={setContactCreateEmail}
                onContactCreateKindChange={setContactCreateKind}
                onContactCreatePhoneChange={setContactCreatePhone}
                onCreateContact={() => void createContact()}
                onCreateMatterFromContact={(dossier) => void createMatterFromContact(dossier)}
                onNewAppointmentForContact={prepareAppointmentForContact}
                onRecordContactDataQualityResolution={recordContactDataQualityResolution}
                onContactSearchChange={setContactSearch}
                onPrepareConflictCheckFromContact={prepareConflictCheckFromContact}
                onSelectContact={setActiveContactId}
                onSelectMatter={selectMatter}
                recordingContactResolutionKey={recordingContactResolutionKey}
              />
            ) : null}

            {activeSection === "funds" ? (
              <TrustControlsSection
                activeJurisdictionTrustSummary={activeJurisdictionTrustSummary}
                activeTrustBalanceCents={activeTrustBalanceCents}
                activeTrustControls={activeTrustControls}
                activeTrustPostings={activeTrustPostings}
                compactDate={compactDate}
                compactStatus={compactStatus}
                formatCurrency={cents}
                trustControlsStatus={trustControlsStatus}
                trustReviewSummary={trustReviewSummary}
              />
            ) : null}

            {activeSection === "billing" ? (
              billingDashboard.canView ? (
                <BillingSection
                  activeBalanceDueCents={activeBalanceDueCents}
                  activeCaptureReviewCount={activeCaptureReviewCount}
                  activeCaptureReviewExpenses={activeCaptureReviewExpenses}
                  activeCaptureReviewTime={activeCaptureReviewTime}
                  activeInvoices={activeInvoices}
                  activeManualPayments={activeManualPayments}
                  activeMatter={activeMatter}
                  activePaymentRequests={activePaymentRequests}
                  activeSettlementReviewSummary={activeSettlementReviewSummary}
                  activeUnbilledExpenseCents={activeUnbilledExpenseCents}
                  activeUnbilledExpenses={activeUnbilledExpenses}
                  activeUnbilledTime={activeUnbilledTime}
                  activeUnbilledTimeCents={activeUnbilledTimeCents}
                  billingDashboard={billingDashboard}
                  canCreateDraftInvoice={canCreateDraftInvoice}
                  cents={cents}
                  createDraftInvoice={createDraftInvoice}
                  createExpenseDraft={createExpenseDraft}
                  createTimerDraft={createTimerDraft}
                  creatingDraftInvoice={creatingDraftInvoice}
                  creatingExpenseDraft={creatingExpenseDraft}
                  creatingTimerDraft={creatingTimerDraft}
                  draftInvoiceDueAt={draftInvoiceDueAt}
                  draftInvoiceStatus={draftInvoiceStatus}
                  draftInvoiceTaxName={draftInvoiceTaxName}
                  draftInvoiceTaxRate={draftInvoiceTaxRate}
                  expenseDraftAmount={expenseDraftAmount}
                  expenseDraftCategory={expenseDraftCategory}
                  expenseDraftDate={expenseDraftDate}
                  expenseDraftDescription={expenseDraftDescription}
                  expenseDraftProfileKey={expenseDraftProfileKey}
                  expenseDraftReimbursable={expenseDraftReimbursable}
                  expenseDraftStatus={expenseDraftStatus}
                  minutes={minutes}
                  setDraftInvoiceDueAt={setDraftInvoiceDueAt}
                  setDraftInvoiceTaxName={setDraftInvoiceTaxName}
                  setDraftInvoiceTaxRate={setDraftInvoiceTaxRate}
                  setExpenseDraftAmount={setExpenseDraftAmount}
                  setExpenseDraftCategory={setExpenseDraftCategory}
                  setExpenseDraftDate={setExpenseDraftDate}
                  setExpenseDraftDescription={setExpenseDraftDescription}
                  setExpenseDraftProfileKey={setExpenseDraftProfileKey}
                  setExpenseDraftReimbursable={setExpenseDraftReimbursable}
                  setTimerDraftBillable={setTimerDraftBillable}
                  setTimerDraftNarrative={setTimerDraftNarrative}
                  setTimerDraftRate={setTimerDraftRate}
                  setTimerDraftStartedAt={setTimerDraftStartedAt}
                  setTimerDraftStoppedAt={setTimerDraftStoppedAt}
                  startTimerDraft={startTimerDraft}
                  stopTimerDraft={stopTimerDraft}
                  timerDraftBillable={timerDraftBillable}
                  timerDraftNarrative={timerDraftNarrative}
                  timerDraftRate={timerDraftRate}
                  timerDraftStartedAt={timerDraftStartedAt}
                  timerDraftStatus={timerDraftStatus}
                  timerDraftStoppedAt={timerDraftStoppedAt}
                />
              ) : (
                <p className="inline-empty">
                  Billing details are hidden for {formatProfessionalRoleLabel(session.user.role)}{" "}
                  users.
                </p>
              )
            ) : null}

            {activeSection === "documents" ? (
              <DocumentsSection
                activeDocumentAssembly={activeDocumentAssembly}
                activeDocumentMetadataFilterCount={activeDocumentMetadataFilterCount}
                activeDocumentMetadataTags={activeDocumentMetadataTags}
                activeDocumentProcessing={activeDocumentProcessing}
                activeDocumentProcessingRows={activeDocumentProcessingRows}
                activeMatterNumber={activeMatter.number}
                documentMetadataClassificationFilter={documentMetadataClassificationFilter}
                documentMetadataCueGroupFilter={documentMetadataCueGroupFilter}
                documentMetadataOcrStatusFilter={documentMetadataOcrStatusFilter}
                documentMetadataQuery={documentMetadataQuery}
                documentMetadataReviewStatusFilter={documentMetadataReviewStatusFilter}
                documentMetadataScanStatusFilter={documentMetadataScanStatusFilter}
                documentMetadataSearchSummary={documentMetadataSearchSummary}
                documentProcessingStatus={documentProcessingStatus}
                documentProcessingSummary={documentProcessingSummary}
                documentReviewSuggestionsSummary={documentReviewSuggestionsSummary}
                queueingDocumentId={queueingDocumentId}
                onClearDocumentMetadataSearch={() => void clearDocumentMetadataSearch()}
                onDocumentMetadataClassificationFilterChange={
                  setDocumentMetadataClassificationFilter
                }
                onDocumentMetadataCueGroupFilterChange={setDocumentMetadataCueGroupFilter}
                onDocumentMetadataOcrStatusFilterChange={setDocumentMetadataOcrStatusFilter}
                onDocumentMetadataQueryChange={setDocumentMetadataQuery}
                onDocumentMetadataReviewStatusFilterChange={setDocumentMetadataReviewStatusFilter}
                onDocumentMetadataScanStatusFilterChange={setDocumentMetadataScanStatusFilter}
                onQueueDocumentOcr={(documentId) => void queueDocumentOcr(documentId)}
                onRefreshDocumentMetadataSearch={() => void refreshDocumentMetadataSearch()}
                onSelectDocumentMetadataTag={(tag) => void selectDocumentMetadataTag(tag)}
              />
            ) : null}

            {activeSection === "research" ? (
              <ResearchSection
                canReview={canReviewLegalResearchArtifacts}
                compactDate={compactDate}
                onReviewArtifact={(artifact, decision) =>
                  void reviewLegalResearchArtifact(artifact, decision)
                }
                reviewBusyId={legalResearchReviewBusyId}
                reviewStatus={legalResearchStatus}
                workspace={activeLegalResearch}
              />
            ) : null}

            {activeSection === "shares" ? (
              <ShareLinksSection
                activeClientPortalContacts={activeClientPortalContacts}
                activeShares={activeShares}
                clientPortalSetupToken={clientPortalSetupToken}
                clientPortalStatus={clientPortalStatus}
                creatingClientPortalAccount={creatingClientPortalAccount}
                creatingShare={creatingShare}
                requireEmailVerification={requireEmailVerification}
                revokingShareId={revokingShareId}
                selectedClientPortalContactId={selectedClientPortalContactId}
                shareExpiresAt={shareExpiresAt}
                shareLinksCreateAvailable={shareLinksCreateAvailable}
                shareLinksStatus={shareLinksStatus}
                shareNotificationEmail={shareNotificationEmail}
                shareOneTimeToken={shareOneTimeToken}
                sharePermissions={sharePermissions}
                shareStatus={shareStatus}
                onCreateClientPortalAccount={() => void createClientPortalAccount()}
                onCreateShareLink={() => void createShareLink()}
                onRevokeShareLink={(share) => void revokeShareLink(share)}
                onSetClientPortalContactId={setClientPortalContactId}
                onSetRequireEmailVerification={setRequireEmailVerification}
                onSetShareExpiresAt={setShareExpiresAt}
                onSetShareNotificationEmail={setShareNotificationEmail}
                onToggleSharePermission={toggleSharePermission}
              />
            ) : null}

            {activeSection === "externalUploads" ? (
              <ExternalUploadsSection
                activeExternalUploadDocuments={activeExternalUploadDocuments}
                activeExternalUploads={activeExternalUploads}
                activeMatterNumber={activeMatter.number}
                creatingExternalUpload={creatingExternalUpload}
                externalUploadCreateDisabled={externalUploadCreateDisabled}
                externalUploadExpiresAt={externalUploadExpiresAt}
                externalUploadMaxUploads={externalUploadMaxUploads}
                externalUploadReviewNotesByDocumentId={externalUploadReviewNotesByDocumentId}
                externalUploadReviewReasonsByDocumentId={externalUploadReviewReasonsByDocumentId}
                externalUploadStatus={externalUploadStatus}
                externalUploadStatusResponse={externalUploads.status}
                externalUploadToken={externalUploadToken}
                reviewingExternalUploadDocumentId={reviewingExternalUploadDocumentId}
                revokingExternalUploadId={revokingExternalUploadId}
                onCreateExternalUploadLink={() => void createExternalUploadLink()}
                onReviewExternalUploadDocument={(document, decision) =>
                  void reviewExternalUploadDocument(document, decision)
                }
                onRevokeExternalUploadLink={(uploadId) => void revokeExternalUploadLink(uploadId)}
                onSetExternalUploadExpiresAt={setExternalUploadExpiresAt}
                onSetExternalUploadMaxUploads={setExternalUploadMaxUploads}
                onSetExternalUploadReviewNote={(documentId, value) =>
                  setExternalUploadReviewNotesByDocumentId((current) => ({
                    ...current,
                    [documentId]: value,
                  }))
                }
                onSetExternalUploadReviewReason={(documentId, value) =>
                  setExternalUploadReviewReasonsByDocumentId((current) => ({
                    ...current,
                    [documentId]: value,
                  }))
                }
              />
            ) : null}

            {activeSection === "calendar" ? (
              <CalendarSection
                activeCalendarBuckets={activeCalendarBuckets}
                activeCalendarEvents={activeCalendarEvents}
                activeCalendarLinks={activeCalendarLinks}
                activeCalendarSchedulingRequests={activeCalendarSchedulingRequests}
                activeCalendarScope={activeCalendarScope}
                activeMatterNumber={activeCalendarLabel}
                addingCalendarAttendee={addingCalendarAttendee}
                addingCalendarReminder={addingCalendarReminder}
                calendarAttendeeEmail={calendarAttendeeEmail}
                calendarAttendeeName={calendarAttendeeName}
                calendarAttendeeRole={calendarAttendeeRole}
                calendarCredentialLabel={calendarCredentialLabel}
                calendarCredentialStatus={calendarCredentialStatus}
                calendarCredentials={calendarCredentials}
                calendarEventDescription={calendarEventDescription}
                calendarEventEndsAt={calendarEventEndsAt}
                calendarEventLifecycleStatus={calendarEventLifecycleStatus}
                calendarEventLocation={calendarEventLocation}
                calendarEventStartsAt={calendarEventStartsAt}
                calendarEventStatusValue={calendarEventStatusValue}
                calendarEventTitle={calendarEventTitle}
                calendarGuestSessionSecret={calendarGuestSessionSecret}
                calendarGuestSessionStatus={calendarGuestSessionStatus}
                calendarGuestSessionsByEventId={calendarGuestSessionsByEventId}
                calendarMeetingLinkModesByEventId={calendarMeetingLinkModesByEventId}
                calendarMeetingLinkUrlsByEventId={calendarMeetingLinkUrlsByEventId}
                calendarMeetingStatus={calendarMeetingStatus}
                calendarOneTimeSecret={calendarOneTimeSecret}
                calendarReminderAt={calendarReminderAt}
                calendarReminderNote={calendarReminderNote}
                calendarReminderStatus={calendarReminderStatus}
                calendarReminderStatusValue={calendarReminderStatusValue}
                calendarClientContactId={selectedCalendarClientContactId}
                calendarClientOptions={calendarClientOptions}
                cancelingCalendarEventId={cancelingCalendarEventId}
                creatingCalendarCredential={creatingCalendarCredential}
                creatingCalendarEvent={creatingCalendarEvent}
                creatingCalendarGuestSessionEventId={creatingCalendarGuestSessionEventId}
                pendingDeliveryConfirmation={pendingDeliveryConfirmation}
                removingCalendarAttendeeId={removingCalendarAttendeeId}
                removingCalendarReminderId={removingCalendarReminderId}
                revokingCalendarCredentialId={revokingCalendarCredentialId}
                selectedCalendarMeetingEvent={selectedCalendarMeetingEvent}
                selectedCalendarReminderEvent={selectedCalendarReminderEvent}
                sendingCalendarInvitationsEventId={sendingCalendarInvitationsEventId}
                matterCalendarControlsEnabled={matterCalendarControlsEnabled}
                updatingCalendarEventId={updatingCalendarEventId}
                updatingCalendarGuestSessionKey={updatingCalendarGuestSessionKey}
                updatingCalendarMeetingLinkEventId={updatingCalendarMeetingLinkEventId}
                updatingCalendarReminderId={updatingCalendarReminderId}
                onAddCalendarAttendee={() => void addCalendarAttendee()}
                onAddCalendarReminder={() => void addCalendarReminder()}
                onCancelCalendarEvent={(event) => void cancelCalendarEvent(event)}
                onCancelPendingDeliveryConfirmation={() => setPendingDeliveryConfirmation(null)}
                onConfirmPendingDelivery={confirmPendingDelivery}
                onControlCalendarGuestSession={(event, session, action) =>
                  void controlCalendarGuestSession(event, session, action)
                }
                onCreateCalendarCredential={() => void createCalendarCredential()}
                onCreateCalendarEvent={() => void createCalendarEvent()}
                onCreateCalendarGuestSession={(event) => void createCalendarGuestSession(event)}
                onIssueCalendarGuestLink={(event, session) =>
                  void issueCalendarGuestLink(event, session)
                }
                onOpenCalendarInvitationConfirmation={openCalendarInvitationConfirmation}
                onRemoveCalendarAttendee={(eventId, attendeeId) =>
                  void removeCalendarAttendee(eventId, attendeeId)
                }
                onRemoveCalendarReminder={(eventId, reminderId) =>
                  void removeCalendarReminder(eventId, reminderId)
                }
                onRescheduleCalendarEvent={(event) => void rescheduleCalendarEvent(event)}
                onRevokeCalendarCredential={(credentialId) =>
                  void revokeCalendarCredential(credentialId)
                }
                onSetCalendarAttendeeEmail={setCalendarAttendeeEmail}
                onSetCalendarAttendeeName={setCalendarAttendeeName}
                onSetCalendarAttendeeRole={setCalendarAttendeeRole}
                onSetCalendarScope={(scope) => setCalendarScope(scope)}
                onSetCalendarClientContactId={setCalendarClientContactId}
                onSetCalendarCredentialLabel={setCalendarCredentialLabel}
                onSetCalendarEventDescription={setCalendarEventDescription}
                onSetCalendarEventEndsAt={setCalendarEventEndsAt}
                onSetCalendarEventLocation={setCalendarEventLocation}
                onSetCalendarEventStartsAt={setCalendarEventStartsAt}
                onSetCalendarEventStatusValue={setCalendarEventStatusValue}
                onSetCalendarEventTitle={setCalendarEventTitle}
                onSetCalendarMeetingEventId={setCalendarMeetingEventId}
                onSetCalendarMeetingLinkMode={(eventId, mode) =>
                  setCalendarMeetingLinkModesByEventId((current) => ({
                    ...current,
                    [eventId]: mode,
                  }))
                }
                onSetCalendarMeetingLinkUrl={(eventId, url) =>
                  setCalendarMeetingLinkUrlsByEventId((current) => ({
                    ...current,
                    [eventId]: url,
                  }))
                }
                onSetCalendarReminderAt={setCalendarReminderAt}
                onSetCalendarReminderEventId={setCalendarReminderEventId}
                onSetCalendarReminderNote={setCalendarReminderNote}
                onSetCalendarReminderStatusValue={setCalendarReminderStatusValue}
                onUpdateCalendarGuestLink={(event, session, guestId, action) =>
                  void updateCalendarGuestLink(event, session, guestId, action)
                }
                onUpdateCalendarMeetingLink={(event, mode, externalUrl) =>
                  void updateCalendarMeetingLink(event, mode, externalUrl)
                }
                onUpdateCalendarReminder={(eventId, reminderId, status) =>
                  void updateCalendarReminder(eventId, reminderId, status)
                }
              />
            ) : null}

            {activeSection === "drafting" ? (
              <DraftingSection
                activeDraftAssistRecords={activeDraftAssistRecords}
                activeDraftExports={activeDraftExports}
                activeDrafts={activeDrafts}
                aiOperationalProposals={aiOperationalProposals}
                aiOperationalProposalStatus={aiOperationalProposalStatus}
                creatingTemplateId={creatingTemplateId}
                drafting={drafting}
                draftAssistInstruction={draftAssistInstruction}
                draftAssistMessage={draftAssistMessage}
                draftAssistStatus={draftAssistStatus}
                draftAssistTask={draftAssistTask}
                draftEditorJson={draftEditorJson}
                draftExportFormat={draftExportFormat}
                draftExportTitle={draftExportTitle}
                draftHasChanges={draftHasChanges}
                draftMergeField={draftMergeField}
                draftStatus={draftStatus}
                exportingDraftFormat={exportingDraftFormat}
                queueingAiOperationalProposals={queueingAiOperationalProposals}
                runningDraftAssist={runningDraftAssist}
                savingDraft={savingDraft}
                selectedDraft={selectedDraft}
                onCloseDraftEditor={closeDraftEditor}
                onCreateBlankDraft={() => void createBlankDraft()}
                onCreateDraftFromTemplate={(template) => void createDraftFromTemplate(template)}
                onDraftAssistInstructionChange={setDraftAssistInstruction}
                onDraftAssistTaskChange={setDraftAssistTask}
                onDraftEditorJsonChange={setDraftEditorJson}
                onDraftExportFormatChange={setDraftExportFormat}
                onDraftExportTitleChange={setDraftExportTitle}
                onDraftMergeFieldChange={setDraftMergeField}
                onExportDraft={() => void exportDraft()}
                onInsertDraftAssistRecord={insertDraftAssistRecord}
                onInsertMergeField={insertMergeField}
                onOpenDraft={openDraft}
                onQueueDraftOperationalProposals={() => void queueDraftOperationalProposals()}
                onReviewDraftAssistRecord={(record, decision) =>
                  void reviewDraftAssistRecord(record, decision)
                }
                onRunDraftAssist={() => void runDraftAssist()}
                onSaveDraft={() => void saveDraft()}
              />
            ) : null}

            {activeSection === "signatures" ? (
              <SignaturesSection activeSignatures={activeSignatures} />
            ) : null}

            {activeSection === "intake" ? (
              <IntakeSection
                activeFiscalHostMetadata={activeFiscalHostMetadata}
                activeIntakeFormLinks={activeIntakeFormLinks}
                activeIntakeSessions={activeIntakeSessions}
                activeIntakeVariableProposals={activeIntakeVariableProposals}
                activeLegalClinicProfile={activeLegalClinicProfile}
                activeLegalClinicProgram={activeLegalClinicProgram}
                activeMatter={activeMatter}
                activeMatterPipelineLeads={activeMatterPipelineLeads}
                activePendingIntakeReviewLinks={activePendingIntakeReviewLinks}
                activePendingIntakeVariableProposals={activePendingIntakeVariableProposals}
                confirmPendingDelivery={confirmPendingDelivery}
                convertPublicConsultationIntake={convertPublicConsultationIntake}
                createIntakeFormLink={createIntakeFormLink}
                creatingIntakeFormLink={creatingIntakeFormLink}
                decideSubmittedIntakeReview={decideSubmittedIntakeReview}
                dismissPublicConsultationIntake={dismissPublicConsultationIntake}
                intakeFormActionsByLinkId={intakeFormActionsByLinkId}
                intakeFormExpiresAt={intakeFormExpiresAt}
                intakeFormPortalUrl={intakeFormPortalUrl}
                intakeFormStatus={intakeFormStatus}
                intakeFormToken={intakeFormToken}
                intakePipeline={intakePipeline}
                intakePreviewAnswers={intakePreviewAnswers}
                intakePreviewResult={intakePreviewResult}
                intakePreviewStatus={intakePreviewStatus}
                intakeReviewDetailsByLinkId={intakeReviewDetailsByLinkId}
                intakeReviewReasons={intakeReviewReasons}
                intakeTemplateDefinition={intakeTemplateDefinition}
                intakeTemplateName={intakeTemplateName}
                intakeTemplateStatus={intakeTemplateStatus}
                intakeTemplates={intakeTemplates}
                loadSubmittedIntakeReview={loadSubmittedIntakeReview}
                loadingIntakeReviewLinkId={loadingIntakeReviewLinkId}
                openIntakeSessionConfirmation={openIntakeSessionConfirmation}
                pendingDeliveryConfirmation={pendingDeliveryConfirmation}
                pendingPublicConsultationIntakes={pendingPublicConsultationIntakes}
                previewingIntakeTemplate={previewingIntakeTemplate}
                previewIntakeTemplate={previewIntakeTemplate}
                proposalRejectionReasons={proposalRejectionReasons}
                publicConsultation={publicConsultation}
                publicConsultationBusyIntakeId={publicConsultationBusyIntakeId}
                publicConsultationDismissReasons={publicConsultationDismissReasons}
                publicConsultationEnabled={publicConsultationEnabled}
                publicConsultationOrigins={publicConsultationOrigins}
                publicConsultationRecipients={publicConsultationRecipients}
                publicConsultationReviewOwner={publicConsultationReviewOwner}
                publicConsultationSender={publicConsultationSender}
                publicConsultationSettings={publicConsultationSettings}
                publicConsultationSettingsDisabled={publicConsultationSettingsDisabled}
                publicConsultationStatus={publicConsultationStatus}
                recentIntakePipelineLeads={recentIntakePipelineLeads}
                refreshPublicConsultationIntakes={refreshPublicConsultationIntakes}
                refreshingPublicConsultationIntakes={refreshingPublicConsultationIntakes}
                reviewIntakeVariableProposal={reviewIntakeVariableProposal}
                reviewingIntakeFormLinkId={reviewingIntakeFormLinkId}
                reviewingIntakeProposalId={reviewingIntakeProposalId}
                revokeIntakeFormLink={revokeIntakeFormLink}
                revokingIntakeFormLinkId={revokingIntakeFormLinkId}
                runPublicConsultationConflictCheck={runPublicConsultationConflictCheck}
                saveIntakeTemplate={saveIntakeTemplate}
                savePublicConsultationSettings={savePublicConsultationSettings}
                savingIntakeTemplate={savingIntakeTemplate}
                savingPublicConsultationSettings={savingPublicConsultationSettings}
                selectIntakeTemplate={selectIntakeTemplate}
                selectedIntakeTemplate={selectedIntakeTemplate}
                selectedIntakeTemplateId={selectedIntakeTemplateId}
                session={session}
                setIntakeFormExpiresAt={setIntakeFormExpiresAt}
                setIntakeReviewReasons={setIntakeReviewReasons}
                setIntakeTemplateDefinition={setIntakeTemplateDefinition}
                setIntakeTemplateName={setIntakeTemplateName}
                setPendingDeliveryConfirmation={setPendingDeliveryConfirmation}
                setProposalRejectionReasons={setProposalRejectionReasons}
                setPublicConsultationDismissReasons={setPublicConsultationDismissReasons}
                setPublicConsultationEnabled={setPublicConsultationEnabled}
                setPublicConsultationOrigins={setPublicConsultationOrigins}
                setPublicConsultationRecipients={setPublicConsultationRecipients}
                setPublicConsultationReviewOwner={setPublicConsultationReviewOwner}
                setPublicConsultationSender={setPublicConsultationSender}
                startNewIntakeTemplate={startNewIntakeTemplate}
                startingIntakeSession={startingIntakeSession}
                updateIntakePreviewAnswer={updateIntakePreviewAnswer}
              />
            ) : null}

            {activeSection === "reports" ? (
              <ReportsSection
                compactDate={compactDate}
                cents={cents}
                exportingReportKey={exportingReportKey}
                exportStatus={reportExportStatus}
                minutes={minutes}
                onRequestReportExport={(definitionKey, exportProfileId, groupingKey) =>
                  void requestReportExport(definitionKey, exportProfileId, groupingKey)
                }
                reportingWorkspace={reportingWorkspace}
              />
            ) : null}

            {activeSection === "admin" ? (
              <AdminReadinessSection
                capabilities={capabilities}
                matters={matters}
                overview={overview}
                reportingWorkspace={reportingWorkspace}
                session={session}
                setupStatus={setupStatus}
                workerHealth={workerHealth}
              />
            ) : null}

            {activeSection === "audit" ? (
              <AuditSection
                activity={activeMatter.activity}
                auditFreshnessCue={auditFreshnessCue}
                auditProjection={auditProjection}
                auditRefreshState={auditRefreshState}
                compactDate={compactDate}
                onRefreshAudit={() => void refreshAuditLane()}
              />
            ) : null}

            {activeSection === "queues" ? (
              <QueuesSection
                activeSavedOperationalViewDefinition={activeSavedOperationalViewDefinition}
                activeSavedOperationalViewId={activeSavedOperationalViewId}
                aiOperationalProposals={aiOperationalProposals}
                aiOperationalProposalStatus={aiOperationalProposalStatus}
                aiOperationalProposalReviewBusyId={reviewingAiOperationalProposalId}
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
                canReviewAiOperationalProposals={canReviewAiProposalRecords}
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
                onReviewAiOperationalProposal={(record, decision) =>
                  void reviewAiOperationalProposal(record, decision)
                }
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

          {!isContextRailCollapsed ? (
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
          ) : (
            <DashboardReviewRailCollapsedTarget />
          )}
        </section>
      </section>
      {isContextRailCollapsed ? (
        <DashboardReviewRailExpandHandle
          expandHandleRef={reviewRailExpandHandleRef}
          onExpand={expandContextRail}
        />
      ) : null}
    </main>
  );
}
