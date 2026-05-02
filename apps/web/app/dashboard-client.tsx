"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
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
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConflictCandidate, EmbeddedIntakeTemplateDefinitionV2 } from "@open-practice/domain";
import {
  buildDashboardSectionUrl,
  buildSidebarNavigationSections,
  resolveDashboardRouteSelection,
  type DashboardNavigationSectionKey,
  type OpenPracticeSidebarNavigationSection,
} from "../routes/routeCatalog";
import {
  buildCreateShareLinkPayload,
  describeShareLinkState,
  formatSharePermission,
  replaceShareLink,
  shareLinkPermissions,
} from "./share-links-dashboard";
import {
  appendDraftToMatterDrafts,
  buildBlankDraftPayload,
  buildDraftFromTemplatePayload,
  buildDraftUpdatePayload,
  describeDraftAssistStatus,
  extractDraftPlainText,
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
  getExternalUploadLinkState,
  upsertExternalUploadDocument,
  upsertExternalUploadLink,
} from "./external-uploads-dashboard";
import {
  buildIntakeFormLinkCreatePayload,
  coerceIntakeDefinitionV2,
  currentProposalValue,
  getIntakeFormLinkState,
  summarizeIntakeItemAction,
  upsertIntakeFormLink,
  upsertIntakeVariableProposal,
} from "./intake-forms-dashboard";
import DraftEditor from "./drafting/DraftEditor";
import {
  describeDisabledNavigationReason,
  filterMatters,
  summarizeQueues,
} from "./dashboard-utils";
import StructuredIntakeBuilder from "./intake-forms/StructuredIntakeBuilder";
import {
  buildCalendarRadarBuckets,
  describeMeetingInvitationBoundary,
  describeCalendarEventTiming,
  removeCalendarEventAttendee,
  upsertCalendarEventAttendee,
  upsertCalendarCredential,
} from "./calendar-dashboard";
import {
  contactDossierRiskClass,
  filterContactDossiers,
  summarizeContactDossier,
} from "./contact-dossiers-dashboard";
import {
  formatCalendarAttendeeRoleLabel,
  formatMatterPartyRoleLabel,
  formatProfessionalRoleLabel,
} from "./participant-role-labels";
import {
  describeLegalClinicProfileStatus,
  describeLegalClinicProgram,
  findLegalClinicProgram,
} from "./legal-clinic-dashboard";
import {
  accountLabel,
  buildTrustControlsPath,
  emptyTrustControlsDashboard,
  matterTrustBalanceCents,
  recentTrustPostings,
  summarizeTrustControls,
  trustControlsForMatter,
} from "./trust-controls-dashboard";
import { describeEmailDeliveryState } from "./email-delivery-dashboard";
import type {
  CalendarAttendeeMutationResponse,
  BillingDashboardResponse,
  CalendarCredentialCreateResponse,
  CalendarCredentialRevokeResponse,
  CalendarDashboardResponse,
  CalendarInvitationResponse,
  CapabilitiesResponse,
  ConflictResponse,
  ContactDossiersResponse,
  DraftingDashboardResponse,
  DraftAssistRecordsResponse,
  DraftAssistStatusResponse,
  EmailDeliveryDashboardResponse,
  ExternalUploadReviewItem,
  ExternalUploadCreateResponse,
  ExternalUploadRevokeResponse,
  ExternalUploadsDashboardResponse,
  IntakeSessionsResponse,
  IntakeFormsDashboardResponse,
  IntakeFormLinkCreateResponse,
  IntakeFormLinkRevokeResponse,
  IntakeTemplateSavePayload,
  LegalClinicDashboardResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
  CreateShareLinkResponse,
  RevokeShareLinkResponse,
  SessionResponse,
  ShareLinkPermission,
  ShareLinkRecord,
  ShareLinksResponse,
  ShareLinksStatusResponse,
  SignatureRequestsResponse,
  TrustControlsDashboardResponse,
  IntakeVariableProposalsResponse,
} from "./types";

interface DashboardClientProps {
  apiBaseUrl: string;
  billing: BillingDashboardResponse;
  calendar: CalendarDashboardResponse;
  capabilities: CapabilitiesResponse;
  contactDossiers: ContactDossiersResponse;
  devHeaders: Record<string, string>;
  drafting: DraftingDashboardResponse;
  emailDeliveryHistory: EmailDeliveryDashboardResponse;
  externalUploads: ExternalUploadsDashboardResponse;
  intake: IntakeSessionsResponse;
  intakeForms: IntakeFormsDashboardResponse;
  legalClinic: LegalClinicDashboardResponse;
  initialSection: DashboardNavigationSectionKey;
  overview: PracticeOverview;
  matters: MatterSummary[];
  session: SessionResponse;
  shareLinksStatus: ShareLinksStatusResponse;
  signatures: SignatureRequestsResponse;
  trustControls: TrustControlsDashboardResponse;
  queues: QueuesResponse;
}

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];
type DashboardDraft = DraftingDashboardResponse["draftsByMatterId"][string][number];
type DashboardDraftAssistRecord = DraftAssistRecordsResponse["records"][number];
type DashboardIntakeVariableProposal = IntakeVariableProposalsResponse["proposals"][number];

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-CA");
}

export default function DashboardClient({
  apiBaseUrl,
  billing,
  calendar,
  capabilities,
  contactDossiers,
  devHeaders,
  drafting,
  emailDeliveryHistory,
  externalUploads,
  intake,
  intakeForms,
  legalClinic,
  initialSection,
  overview,
  matters,
  session,
  signatures,
  trustControls,
  queues,
  shareLinksStatus,
}: DashboardClientProps) {
  const detailPanelRef = useRef<HTMLElement>(null);
  const shouldFocusDetailRef = useRef(false);
  const hasAppliedUrlSectionRef = useRef(false);
  const [activeMatterId, setActiveMatterId] = useState(matters[0]?.id ?? "");
  const [activeSection, setActiveSection] = useState<LocalDashboardSectionKey>(initialSection);
  const [matterSearch, setMatterSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [activeContactId, setActiveContactId] = useState(contactDossiers[0]?.contact.id ?? "");
  const [conflictName, setConflictName] = useState("");
  const [conflictResults, setConflictResults] = useState<ConflictCandidate[]>([]);
  const [conflictStatus, setConflictStatus] = useState("No check run yet.");
  const [draftsByMatterId, setDraftsByMatterId] = useState(drafting.draftsByMatterId);
  const [creatingTemplateId, setCreatingTemplateId] = useState("");
  const [draftStatus, setDraftStatus] = useState("No draft created in this session.");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [draftEditorJson, setDraftEditorJson] = useState<DashboardDraft["editorJson"] | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
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
  const requireEmailVerification = false;
  const [creatingShare, setCreatingShare] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState("");
  const [externalUploadsByMatterId, setExternalUploadsByMatterId] = useState(
    externalUploads.uploadsByMatterId,
  );
  const [externalUploadDocumentsByMatterId, setExternalUploadDocumentsByMatterId] = useState(
    externalUploads.reviewItemsByMatterId,
  );
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
  const [calendarMeetingEventId, setCalendarMeetingEventId] = useState("");
  const [calendarAttendeeName, setCalendarAttendeeName] = useState("");
  const [calendarAttendeeEmail, setCalendarAttendeeEmail] = useState("");
  const [calendarAttendeeRole, setCalendarAttendeeRole] = useState<"required" | "optional">(
    "required",
  );
  const [calendarMeetingStatus, setCalendarMeetingStatus] = useState(
    "Meeting attendees have not changed.",
  );
  const [addingCalendarAttendee, setAddingCalendarAttendee] = useState(false);
  const [removingCalendarAttendeeId, setRemovingCalendarAttendeeId] = useState("");
  const [sendingCalendarInvitationsEventId, setSendingCalendarInvitationsEventId] = useState("");
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
  const [reviewingIntakeProposalId, setReviewingIntakeProposalId] = useState("");
  const [proposalRejectionReasons, setProposalRejectionReasons] = useState<Record<string, string>>(
    {},
  );
  const [intakeTemplates, setIntakeTemplates] = useState(intake.templates);
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
  const [savingIntakeTemplate, setSavingIntakeTemplate] = useState(false);

  const filteredMatters = useMemo(
    () => filterMatters(matters, matterSearch),
    [matters, matterSearch],
  );
  const filteredContactDossiers = useMemo(
    () => filterContactDossiers(contactDossiers, contactSearch),
    [contactDossiers, contactSearch],
  );
  const activeContactDossier =
    filteredContactDossiers.find((dossier) => dossier.contact.id === activeContactId) ??
    filteredContactDossiers[0] ??
    contactDossiers[0];
  const activeMatter = matters.find((matter) => matter.id === activeMatterId) ?? matters[0];
  const activeSignatures = signatures.filter(
    (signature) => signature.matterId === activeMatter?.id,
  );
  const activeIntakeSessions = intake.sessions.filter(
    (sessionRecord) => sessionRecord.matterId === activeMatter?.id,
  );
  const activeDocuments = activeMatter?.documents ?? [];
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

  useEffect(() => {
    if (!activeCalendarEvents.length) {
      if (calendarMeetingEventId) setCalendarMeetingEventId("");
      return;
    }
    if (!activeCalendarEvents.some((event) => event.id === calendarMeetingEventId)) {
      setCalendarMeetingEventId(activeCalendarEvents[0]!.id);
    }
  }, [activeCalendarEvents, calendarMeetingEventId]);
  const activeIntakeFormLinks = activeMatter
    ? (intakeFormLinksByMatterId[activeMatter.id] ?? [])
    : [];
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
  const activeEmailDeliveries = activeMatter
    ? (emailDeliveryHistory.emailsByMatterId[activeMatter.id] ?? [])
    : [];
  const activePendingIntakeVariableProposals = activeIntakeVariableProposals.filter(
    (proposal) => proposal.status === "pending",
  );
  const externalUploadCreateAvailable = canCreateExternalUpload(externalUploads.status);
  const selectedDraft = activeDrafts.find((draft) => draft.id === selectedDraftId);
  const activeDraftAssistRecords = selectedDraft
    ? (draftAssistRecordsByDraftId[selectedDraft.id] ?? [])
    : [];
  const draftHasChanges =
    selectedDraft !== undefined &&
    draftEditorJson !== null &&
    !isSameDraftDocument(selectedDraft.editorJson, draftEditorJson);
  const activeBilling = billing.matters.find((matter) => matter.matterId === activeMatter?.id);
  const activeTrustControls = activeMatter
    ? (trustControlsByMatterId[activeMatter.id] ?? emptyTrustControlsDashboard())
    : emptyTrustControlsDashboard();
  const activeTrustBalanceCents = activeMatter
    ? matterTrustBalanceCents(activeTrustControls, activeMatter.id, activeMatter.trustBalanceCents)
    : 0;
  const trustReviewSummary = summarizeTrustControls(activeTrustControls);
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
  const navigationSections = useMemo<OpenPracticeSidebarNavigationSection[]>(() => {
    return buildSidebarNavigationSections({
      billingCanView: billing.canView,
      capabilitySections: capabilities.sections,
      shareLinksEnabled: shareLinksStatus.createStatus === "enabled",
      externalUploadsEnabled: externalUploadCreateAvailable,
    });
  }, [
    billing.canView,
    capabilities.sections,
    externalUploadCreateAvailable,
    shareLinksStatus.createStatus,
  ]);
  const activeSectionLabel =
    activeSection === "matters"
      ? activeMatter?.title
      : (navigationSections.find((section) => section.key === activeSection)?.label ?? "Dashboard");
  const matterActionSections = useMemo(
    () =>
      navigationSections.filter((section) =>
        ["drafting", "shares", "externalUploads", "queues"].includes(section.key),
      ),
    [navigationSections],
  );
  const queueSummary = useMemo(() => summarizeQueues(queues), [queues]);

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

  const metrics = useMemo(
    () => [
      {
        label: "Open matters",
        value: overview.metrics.openMatters.toString(),
        icon: Gavel,
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
        value: cents(billing.summary.issuedBalanceDueCents),
        icon: CreditCard,
      },
    ],
    [billing.summary.issuedBalanceDueCents, overview.metrics],
  );

  async function runConflictCheck() {
    setConflictStatus("Running conflict check...");
    const response = await fetch(`${apiBaseUrl}/api/conflicts/check`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prospectiveName: conflictName,
        includeClosedMatters: true,
      }),
    });
    if (!response.ok) {
      setConflictStatus(`Conflict check failed: ${response.status}`);
      setConflictResults([]);
      return;
    }
    const payload = (await response.json()) as ConflictResponse;
    setConflictResults(payload.results);
    setConflictStatus(
      payload.results.length === 0
        ? "No conflicts found."
        : `${payload.results.length} potential conflict${payload.results.length === 1 ? "" : "s"} found.`,
    );
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

  function openDraft(draft: DashboardDraft): void {
    setSelectedDraftId(draft.id);
    setDraftEditorJson(draft.editorJson);
    setDraftStatus(`Editing ${draft.title}.`);
  }

  function closeDraftEditor(): void {
    setSelectedDraftId("");
    setDraftEditorJson(null);
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
    const response = await fetch(`${apiBaseUrl}/api/external-uploads`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildExternalUploadCreatePayload({
          matterId: activeMatter.id,
          maxUploads: externalUploadMaxUploads,
          expiresAtLocal: externalUploadExpiresAt,
        }),
      ),
    });

    if (!response.ok) {
      setExternalUploadStatus(`Create failed: ${response.status}`);
      setCreatingExternalUpload(false);
      return;
    }

    const payload = (await response.json()) as ExternalUploadCreateResponse;
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
    decision: "accept" | "request_metadata" | "request_retry" | "discard",
  ): Promise<void> {
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
          duplicateOfDocumentId: document.duplicateOfDocumentId,
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
    setReviewingExternalUploadDocumentId("");
  }

  async function createCalendarCredential(): Promise<void> {
    setCreatingCalendarCredential(true);
    setCalendarOneTimeSecret(null);
    setCalendarCredentialStatus("Creating calendar app password...");
    const response = await fetch(`${apiBaseUrl}/api/calendar/credentials`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ label: calendarCredentialLabel.trim() || "iOS Calendar" }),
    });

    if (!response.ok) {
      setCalendarCredentialStatus(`Calendar credential create failed: ${response.status}`);
      setCreatingCalendarCredential(false);
      return;
    }

    const payload = (await response.json()) as CalendarCredentialCreateResponse;
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

  async function sendCalendarInvitations(eventId: string): Promise<void> {
    if (!activeMatter) return;
    setSendingCalendarInvitationsEventId(eventId);
    setCalendarMeetingStatus("Sending invitations...");
    const response = await fetch(
      `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(eventId)}/invitations`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          ...devHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matterId: activeMatter.id }),
      },
    );

    if (!response.ok) {
      setCalendarMeetingStatus(`Invitation send failed: ${response.status}`);
      setSendingCalendarInvitationsEventId("");
      return;
    }

    const payload = (await response.json()) as CalendarInvitationResponse;
    setCalendarEventsByMatterId((current) =>
      payload.results.reduce(
        (next, result) =>
          upsertCalendarEventAttendee(next, activeMatter.id, eventId, result.attendee),
        current,
      ),
    );
    const queued = payload.results.filter(
      (result) => result.attendee.invitationStatus === "queued",
    ).length;
    const skipped = payload.results.filter(
      (result) => result.attendee.invitationStatus === "skipped",
    ).length;
    setCalendarMeetingStatus(`${queued} invitation queued; ${skipped} skipped.`);
    setSendingCalendarInvitationsEventId("");
  }

  function selectIntakeTemplate(templateId: string): void {
    const template = intakeTemplates.find((candidate) => candidate.id === templateId);
    setSelectedIntakeTemplateId(templateId);
    setIntakeTemplateName(template?.name ?? "New intake form");
    setIntakeTemplateDefinition(coerceIntakeDefinitionV2(template));
    setIntakeTemplateStatus(template ? `Editing ${template.name}.` : "Template editor ready.");
  }

  function startNewIntakeTemplate(): void {
    setSelectedIntakeTemplateId("");
    setIntakeTemplateName("New intake form");
    setIntakeTemplateDefinition(coerceIntakeDefinitionV2());
    setIntakeTemplateStatus("New template ready.");
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
    setExternalUploadToken("");
    setExternalUploadStatus("No link created.");
    setCalendarOneTimeSecret(null);
    setIntakeFormToken("");
    setIntakeFormPortalUrl("");
    setIntakeFormStatus("No form link created.");
    closeDraftEditor();
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
    const response = await fetch(`${apiBaseUrl}/api/shares`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...devHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildCreateShareLinkPayload({
          matterId: activeMatter.id,
          permissions: sharePermissions,
          expiresAt: shareExpiresAt,
          requireEmailVerification,
        }),
      ),
    });

    if (!response.ok) {
      setShareStatus(`Share link creation failed: ${response.status}`);
      setCreatingShare(false);
      return;
    }

    const payload = (await response.json()) as CreateShareLinkResponse;
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
    setShareStatus(
      payload.token
        ? `Created share link. One-time token: ${payload.token}`
        : "Created share link.",
    );
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
      <main className="empty-state">
        <h1>{overview.firm.name}</h1>
        <p>No accessible matters were returned for {session.user.displayName}.</p>
      </main>
    );
  }

  return (
    <main className="app-shell dashboard-shell legal-ops-shell" aria-labelledby="dashboard-title">
      <a className="skip-link" href="#matter-workspace">
        Skip to matter workspace
      </a>
      <aside className="sidebar dashboard-sidebar" aria-label="Primary">
        <div className="brand dashboard-brand">
          <span className="brand-mark">OP</span>
          <div>
            <strong>Open Practice</strong>
            <span>Apache-2.0 core</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Dashboard sections">
          {navigationSections.map(({ key, label, enabled }) => {
            const Icon = navIcons[key];
            const disabledReason = describeDisabledNavigationReason({ key, label, enabled });
            const disabledReasonId = `nav-disabled-${key}`;
            return (
              <button
                aria-current={key === activeSection ? "page" : undefined}
                aria-describedby={disabledReason ? disabledReasonId : undefined}
                aria-disabled={!enabled}
                className={key === activeSection ? "nav-item active" : "nav-item"}
                disabled={!enabled}
                key={label}
                onClick={() => selectDashboardSection(key)}
                type="button"
              >
                <Icon size={18} />
                <span>
                  <strong>{label}</strong>
                  {disabledReason ? (
                    <small className="nav-disabled-reason" id={disabledReasonId}>
                      {disabledReason}
                    </small>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>

        <section className="security-card dashboard-security-card">
          <ShieldCheck size={20} />
          <strong>Server-enforced controls</strong>
          <p>Data is loaded through authenticated API requests and matter-scoped permissions.</p>
        </section>
      </aside>

      <section className="workspace dashboard-workspace">
        <header className="topbar dashboard-topbar">
          <div className="topbar-heading">
            <p className="eyebrow">BC / Ontario / Canada small-practice workspace</p>
            <h1 id="dashboard-title">{overview.firm.name}</h1>
          </div>
          <div className="user-pill topbar-user-pill">
            <span>{session.user.displayName}</span>
            <strong>{formatProfessionalRoleLabel(session.user.role)}</strong>
          </div>
        </header>

        <section className="metric-grid dashboard-metrics" aria-label="Practice metrics">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <metric.icon size={19} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section
          className="panel matter-context-panel dashboard-matter-context"
          aria-labelledby="matter-context-title"
        >
          <div className="panel-header matter-context-header">
            <div>
              <p className="eyebrow">Matter command centre</p>
              <h2 id="matter-context-title">Active files</h2>
            </div>
            <label className="search-field matter-search-field">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search matters"
                onChange={(event) => setMatterSearch(event.target.value)}
                placeholder="Search matters"
                value={matterSearch}
              />
            </label>
          </div>
          <div className="matter-strip">
            {filteredMatters.map((matter) => (
              <button
                className={matter.id === activeMatter.id ? "matter-row selected" : "matter-row"}
                key={matter.id}
                onClick={() => selectMatter(matter.id)}
                type="button"
              >
                <span>
                  <strong>{matter.title}</strong>
                  <small>
                    {matter.number} · {matter.practiceArea}
                  </small>
                </span>
                <em>{matter.status}</em>
              </button>
            ))}
            {filteredMatters.length === 0 ? (
              <p className="inline-empty">No matters match.</p>
            ) : null}
          </div>
        </section>

        <section className="main-grid matter-workspace-grid">
          <article
            className="panel matter-detail matter-detail-panel"
            aria-labelledby="matter-detail-title"
            id="matter-workspace"
            ref={detailPanelRef}
            tabIndex={-1}
          >
            <div className="panel-header matter-detail-header">
              <div>
                <p className="eyebrow">{activeMatter.number}</p>
                <h2 id="matter-detail-title">{activeSectionLabel}</h2>
              </div>
              <span className="status-chip">{activeMatter.jurisdiction}</span>
            </div>
            <div
              className="matter-action-strip matter-detail-action-strip"
              aria-label="Matter actions"
            >
              {matterActionSections.map((section) => {
                const disabledReason = describeDisabledNavigationReason(section);
                return (
                  <button
                    aria-current={section.key === activeSection ? "page" : undefined}
                    aria-label={
                      disabledReason ? `${section.label}: ${disabledReason}` : section.label
                    }
                    className={
                      section.key === activeSection
                        ? "action-strip-button active"
                        : "action-strip-button"
                    }
                    disabled={!section.enabled}
                    key={section.key}
                    onClick={() => selectDashboardSection(section.key)}
                    title={disabledReason ?? section.label}
                    type="button"
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>

            {activeSection === "matters" ? (
              <>
                <div className="detail-grid">
                  <div>
                    <span className="field-label">Responsible licensee</span>
                    <strong>
                      {
                        overview.users.find((user) => user.id === activeMatter.responsibleUserId)
                          ?.displayName
                      }
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Matter status</span>
                    <strong>{activeMatter.status}</strong>
                  </div>
                  <div>
                    <span className="field-label">Trust balance view</span>
                    <strong>{cents(activeMatter.trustBalanceCents)}</strong>
                  </div>
                  <div>
                    <span className="field-label">Data source</span>
                    <strong>API</strong>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Parties and access</h3>
                  <span>{activeMatter.parties.length} linked contacts</span>
                </div>
                <div className="party-list">
                  {activeMatter.parties.map((party) => (
                    <div className="party-row" key={party.id}>
                      <span>
                        <strong>{party.contact.displayName}</strong>
                        <small>{formatMatterPartyRoleLabel(party.role)}</small>
                      </span>
                      {party.adverse ? <em className="risk">Adverse</em> : <em>Client-side</em>}
                    </div>
                  ))}
                </div>

                <div className="section-title">
                  <h3>Documents, time, and expenses</h3>
                  <span>matter-scoped</span>
                </div>
                <div className="activity-grid">
                  <div className="activity-card">
                    <Files size={18} />
                    <strong>{activeMatter.documents.length} documents</strong>
                    <span>scan-gated upload metadata</span>
                  </div>
                  <div className="activity-card">
                    <Clock3 size={18} />
                    <strong>
                      {minutes(
                        activeMatter.timeEntries.reduce((sum, entry) => sum + entry.minutes, 0),
                      )}
                    </strong>
                    <span>billable time captured</span>
                  </div>
                  <div className="activity-card">
                    <Banknote size={18} />
                    <strong>
                      {cents(
                        activeMatter.expenses.reduce((sum, entry) => sum + entry.amountCents, 0),
                      )}
                    </strong>
                    <span>tracked expenses</span>
                  </div>
                </div>

                {activeLegalClinicProfile ? (
                  <>
                    <div className="section-title">
                      <h3>Clinic workflow</h3>
                      <span>{describeLegalClinicProfileStatus(activeLegalClinicProfile)}</span>
                    </div>
                    <div className="party-list">
                      <div className="party-row">
                        <span>
                          <strong>
                            {describeLegalClinicProgram(
                              activeLegalClinicProgram,
                              activeLegalClinicProfile,
                            )}
                          </strong>
                          <small>
                            {activeLegalClinicProgram?.eligibilitySummary ??
                              "Clinic program profile is linked to this matter."}
                          </small>
                        </span>
                        <em>{activeLegalClinicProgram?.serviceArea ?? "program"}</em>
                      </div>
                      <div className="party-row">
                        <span>
                          <strong>
                            {compactStatus(activeLegalClinicProfile.eligibilityStatus)}
                          </strong>
                          <small>Eligibility status recorded on the matter profile.</small>
                        </span>
                        <em>{activeLegalClinicProfile.clinicRelationshipRole}</em>
                      </div>
                      <div className="party-row">
                        <span>
                          <strong>{compactStatus(activeLegalClinicProfile.referralStatus)}</strong>
                          <small>
                            {activeLegalClinicProfile.referralSource ??
                              activeLegalClinicProgram?.defaultReferralSource ??
                              "Referral source is not recorded."}
                          </small>
                        </span>
                        <em>
                          {activeLegalClinicProfile.nextReviewDate ? "review set" : "no review"}
                        </em>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="section-title">
                  <h3>Email delivery history</h3>
                  <span>{activeEmailDeliveries.length} recent records</span>
                </div>
                <div className="party-list">
                  {activeEmailDeliveries.map((email) => {
                    const state = describeEmailDeliveryState(email);
                    const latestEvent = email.events.at(-1);
                    return (
                      <div className="party-row" key={email.id}>
                        <span>
                          <strong>{email.templateKey}</strong>
                          <small>
                            {email.recipientCount} recipients · {email.attemptCount} attempts ·{" "}
                            {compactDate(email.lastAttemptAt ?? email.queuedAt)}
                            {latestEvent ? ` · ${latestEvent.eventType}` : ""}
                          </small>
                          {email.failureSummary ? <small>{email.failureSummary}</small> : null}
                        </span>
                        <em className={state.tone === "risk" ? "risk" : undefined}>
                          {state.label}
                        </em>
                      </div>
                    );
                  })}
                  {activeEmailDeliveries.length === 0 ? (
                    <p className="inline-empty">
                      No outbound email history is linked to this matter.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeSection === "contacts" ? (
              <>
                <div className="detail-grid contact-summary-grid">
                  <div>
                    <span className="field-label">Visible contacts</span>
                    <strong>{contactDossiers.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Linked matters</span>
                    <strong>
                      {contactDossiers.reduce((sum, dossier) => sum + dossier.matters.length, 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Portal grants</span>
                    <strong>
                      {contactDossiers.reduce(
                        (sum, dossier) => sum + dossier.portal.activeGrantCount,
                        0,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Risk cues</span>
                    <strong>
                      {
                        contactDossiers.filter(
                          (dossier) =>
                            dossier.conflictCues.some((cue) => cue.severity !== "info") ||
                            dossier.qualityReview.signals.some(
                              (signal) => signal.severity !== "info",
                            ),
                        ).length
                      }
                    </strong>
                  </div>
                </div>

                <div className="section-title">
                  <h3>Contact dossiers</h3>
                  <span>{filteredContactDossiers.length} visible</span>
                </div>
                <label className="search-field contact-search-field">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Search contacts"
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Search contacts, aliases, identifiers, or matters"
                    value={contactSearch}
                  />
                </label>

                <div className="contact-dossier-grid">
                  <div className="party-list contact-dossier-list">
                    {filteredContactDossiers.map((dossier) => (
                      <button
                        className={
                          dossier.contact.id === activeContactDossier?.contact.id
                            ? "party-row draft-row selected-template"
                            : "party-row draft-row"
                        }
                        key={dossier.contact.id}
                        onClick={() => setActiveContactId(dossier.contact.id)}
                        type="button"
                      >
                        <span>
                          <strong>{dossier.contact.displayName}</strong>
                          <small>
                            {dossier.contact.kind} · {dossier.matters.length} matter
                            {dossier.matters.length === 1 ? "" : "s"}
                          </small>
                        </span>
                        <em className={contactDossierRiskClass(dossier)}>
                          {summarizeContactDossier(dossier)}
                        </em>
                      </button>
                    ))}
                    {filteredContactDossiers.length === 0 ? (
                      <p className="inline-empty">No visible contacts match.</p>
                    ) : null}
                  </div>

                  <section className="contact-dossier-detail" aria-label="Selected contact dossier">
                    {activeContactDossier ? (
                      <>
                        <div className="section-title">
                          <h3>{activeContactDossier.contact.displayName}</h3>
                          <span>{activeContactDossier.contact.kind}</span>
                        </div>
                        <div className="detail-grid compact-detail-grid">
                          <div>
                            <span className="field-label">Aliases</span>
                            <strong>
                              {activeContactDossier.contact.aliases.length > 0
                                ? activeContactDossier.contact.aliases.join(", ")
                                : "none"}
                            </strong>
                          </div>
                          <div>
                            <span className="field-label">Identifiers</span>
                            <strong>
                              {activeContactDossier.contact.identifiers.length > 0
                                ? activeContactDossier.contact.identifiers
                                    .map((identifier) => identifier.type)
                                    .join(", ")
                                : "none"}
                            </strong>
                          </div>
                          <div>
                            <span className="field-label">Portal grants</span>
                            <strong>{activeContactDossier.portal.activeGrantCount}</strong>
                          </div>
                          <div>
                            <span className="field-label">Permissions</span>
                            <strong>
                              {activeContactDossier.portal.permissionLabels.length > 0
                                ? activeContactDossier.portal.permissionLabels
                                    .map(compactStatus)
                                    .join(", ")
                                : "none"}
                            </strong>
                          </div>
                        </div>

                        <div className="section-title">
                          <h3>Accessible matter links</h3>
                          <span>{activeContactDossier.matters.length}</span>
                        </div>
                        <div className="party-list">
                          {activeContactDossier.matters.map((link) => (
                            <button
                              className="party-row draft-row"
                              key={`${activeContactDossier.contact.id}-${link.matterId}`}
                              onClick={() => selectMatter(link.matterId)}
                              type="button"
                            >
                              <span>
                                <strong>{link.matterTitle}</strong>
                                <small>
                                  {link.matterNumber} · {link.practiceArea} ·{" "}
                                  {formatMatterPartyRoleLabel(link.role)}
                                </small>
                              </span>
                              <em className={link.adverse ? "risk" : undefined}>
                                {[
                                  link.matterStatus,
                                  link.adverse ? "adverse" : null,
                                  link.confidential ? "confidential" : null,
                                  link.portalActive ? "portal" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </em>
                            </button>
                          ))}
                        </div>

                        <div className="section-title">
                          <h3>Conflict cues</h3>
                          <span>{activeContactDossier.conflictCues.length}</span>
                        </div>
                        <div className="party-list">
                          {activeContactDossier.conflictCues.map((cue, index) => (
                            <div
                              className="party-row"
                              key={`${activeContactDossier.contact.id}-cue-${index}`}
                            >
                              <span>
                                <strong>{cue.reason}</strong>
                                <small>{cue.matterId ?? "contact-level"}</small>
                              </span>
                              <em className={cue.severity === "blocker" ? "risk" : undefined}>
                                {cue.severity}
                              </em>
                            </div>
                          ))}
                        </div>

                        <div className="section-title">
                          <h3>Quality review</h3>
                          <span>{activeContactDossier.qualityReview.signals.length}</span>
                        </div>
                        <div className="party-list">
                          {activeContactDossier.qualityReview.signals.map((signal, index) => (
                            <div
                              className="party-row"
                              key={`${activeContactDossier.contact.id}-quality-${index}`}
                            >
                              <span>
                                <strong>{signal.reason}</strong>
                                <small>
                                  {[signal.matchedValue, signal.matterId, signal.changedAt]
                                    .filter(Boolean)
                                    .join(" · ") || "contact-level"}
                                </small>
                              </span>
                              <em className={signal.severity === "blocker" ? "risk" : undefined}>
                                {signal.kind.replaceAll("_", " ")}
                              </em>
                            </div>
                          ))}
                          {activeContactDossier.qualityReview.signals.length === 0 ? (
                            <p className="inline-empty">No quality review signals.</p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="inline-empty">No visible contact dossier is selected.</p>
                    )}
                  </section>
                </div>
              </>
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
                    <Clock3 size={18} />
                    <strong>{activeTrustPostings.length} recent postings</strong>
                    <span>read-only ledger review</span>
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
                          {compactDate(reconciliation.statementPeriodEnd)}
                        </small>
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
              billing.canView ? (
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
                  </div>

                  <div className="section-title">
                    <h3>Unbilled approved time and expenses</h3>
                    <span>{cents(activeUnbilledTimeCents + activeUnbilledExpenseCents)}</span>
                  </div>
                  <div className="party-list">
                    {activeUnbilledTime.slice(0, 4).map((entry) => (
                      <div className="party-row" key={entry.id}>
                        <span>
                          <strong>{entry.narrative}</strong>
                          <small>
                            {minutes(entry.minutes)} · {cents(entry.rateCents)}/hr
                          </small>
                        </span>
                        <em>{cents(entry.amountCents)}</em>
                      </div>
                    ))}
                    {activeUnbilledExpenses.slice(0, 4).map((entry) => (
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
              <div className="party-list">
                {activeDocuments.map((document) => (
                  <div className="party-row" key={document.id}>
                    <span>
                      <strong>{document.title}</strong>
                      <small>
                        {document.uploadStatus} · checksum {document.checksumStatus} · scan{" "}
                        {document.scanStatus} · review {document.reviewStatus}
                      </small>
                    </span>
                    <em>{document.classification.replace("_", " ")}</em>
                  </div>
                ))}
                {activeDocuments.length === 0 ? (
                  <p className="inline-empty">No documents are linked to this matter.</p>
                ) : null}
              </div>
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
                  <div className="upload-token">
                    <span>One-time token</span>
                    <code>{externalUploadToken}</code>
                  </div>
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
                        </span>
                        <div className="row-actions upload-review-actions">
                          <em className={reviewState.tone === "risk" ? "risk" : undefined}>
                            {reviewState.label}
                          </em>
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

                <div className="section-title">
                  <h3>Matter calendar events</h3>
                  <span>{activeMatter.number}</span>
                </div>
                <div className="party-list">
                  {activeCalendarEvents.map((event) => {
                    const timing = describeCalendarEventTiming(event);
                    const attendees = event.attendees ?? [];
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
                              className="secondary-button compact-button row-button"
                              disabled={
                                event.meetingInvitationBoundary?.meetingLinks.status !==
                                "configured"
                              }
                              onClick={() =>
                                setCalendarMeetingStatus("Meeting link issuance is not wired yet.")
                              }
                              title={
                                event.meetingInvitationBoundary?.meetingLinks.status ===
                                "configured"
                                  ? "Meeting link boundary is configured"
                                  : "Meeting links are disabled until a provider is configured"
                              }
                              type="button"
                            >
                              <Link2 size={14} />
                              Meeting link
                            </button>
                            <button
                              className="secondary-button compact-button row-button"
                              disabled={
                                attendees.length === 0 ||
                                sendingCalendarInvitationsEventId === event.id
                              }
                              onClick={() => void sendCalendarInvitations(event.id)}
                              type="button"
                            >
                              {sendingCalendarInvitationsEventId === event.id
                                ? "Sending..."
                                : "Send invites"}
                            </button>
                          </div>
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
                    <div className="upload-token calendar-secret">
                      <span>Username</span>
                      <code>{calendarOneTimeSecret.username}</code>
                      <span>One-time password</span>
                      <code>{calendarOneTimeSecret.password}</code>
                      <span>Principal URL</span>
                      <code>{calendarOneTimeSecret.principalUrl}</code>
                    </div>
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
                    className="primary-button"
                    disabled={creatingIntakeFormLink || activeIntakeSessions.length === 0}
                    onClick={() => void createIntakeFormLink()}
                    type="button"
                  >
                    {creatingIntakeFormLink ? "Creating..." : "Create link"}
                  </button>
                </div>
                {intakeFormToken ? (
                  <div className="upload-token">
                    <span>One-time token</span>
                    <code>{intakeFormToken}</code>
                  </div>
                ) : null}
                {intakeFormPortalUrl ? (
                  <div className="upload-token">
                    <span>Client form URL</span>
                    <code>{intakeFormPortalUrl}</code>
                  </div>
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
              <div className="party-list">
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
            ) : null}

            {activeSection === "queues" ? (
              <>
                <div className="detail-grid queue-summary-grid">
                  <div>
                    <span className="field-label">Queue sections</span>
                    <strong>{queues.sections.length}</strong>
                  </div>
                  <div>
                    <span className="field-label">Open items</span>
                    <strong>
                      {queues.sections.reduce((sum, section) => sum + section.items.length, 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">High priority</span>
                    <strong>
                      {
                        queues.sections
                          .flatMap((section) => section.items)
                          .filter((item) => item.priority === "high").length
                      }
                    </strong>
                  </div>
                  <div>
                    <span className="field-label">Hydration</span>
                    <strong>Route-backed</strong>
                  </div>
                </div>
                <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
                  {queueSummary}
                </p>
                <div className="party-list queue-section-list">
                  {queues.sections.map((section) => (
                    <section className="queue-section" key={section.key}>
                      <div className="section-title">
                        <h3>{section.label}</h3>
                        <span>{section.items.length} items</span>
                      </div>
                      {section.items.map((item) => (
                        <button
                          className="party-row queue-item-row"
                          key={item.id}
                          onClick={() => item.matterId && selectMatter(item.matterId)}
                          type="button"
                        >
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.status}</small>
                          </span>
                          <em className={item.priority === "high" ? "risk" : undefined}>
                            {item.priority}
                          </em>
                        </button>
                      ))}
                      {section.items.length === 0 ? (
                        <p className="inline-empty">No items in this queue.</p>
                      ) : null}
                    </section>
                  ))}
                  {queues.sections.length === 0 ? (
                    <p className="inline-empty">No operational queues were returned.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </article>

          <aside className="context-rail matter-context-rail" aria-label="Matter review tools">
            <article className="panel conflict-panel context-rail-panel">
              <div className="panel-header context-rail-header">
                <div>
                  <p className="eyebrow">Conflict review</p>
                  <h2>Prospective client check</h2>
                </div>
                <AlertTriangle size={20} />
              </div>
              <label className="search-field">
                <span>Prospective name</span>
                <input
                  value={conflictName}
                  onChange={(event) => setConflictName(event.target.value)}
                  placeholder="Client, organization, alias, or adverse party"
                />
              </label>
              <button
                className="primary-button"
                disabled={conflictName.trim().length === 0}
                onClick={runConflictCheck}
                type="button"
              >
                <Search size={16} />
                Run conflict check
              </button>
              <div className="conflict-results">
                {conflictResults.length === 0 ? (
                  <p>{conflictStatus}</p>
                ) : (
                  conflictResults.map((result, index) => (
                    <div className="conflict-row" key={`${result.contactId}-${index}`}>
                      {result.severity === "blocker" ? (
                        <AlertTriangle size={17} />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                      <span>
                        <strong>{result.severity}</strong>
                        <small>{result.reason}</small>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="panel queue-panel context-rail-panel">
              <div className="panel-header context-rail-header">
                <div>
                  <p className="eyebrow">Operational queues</p>
                  <h2>Review work</h2>
                </div>
                <Clock3 size={20} />
              </div>
              <p className="inline-empty">{queueSummary}</p>
              <div className="party-list">
                {queues.sections.flatMap((section) =>
                  section.items.slice(0, 3).map((item) => (
                    <div className="party-row" key={`${section.key}-${item.id}`}>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {section.label} · {item.status}
                        </small>
                      </span>
                      <em className={item.priority === "high" ? "risk" : undefined}>
                        {item.priority}
                      </em>
                    </div>
                  )),
                )}
                {queues.sections.every((section) => section.items.length === 0) ? (
                  <p className="inline-empty">No queue items need attention.</p>
                ) : null}
              </div>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}
