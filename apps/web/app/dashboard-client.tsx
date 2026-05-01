"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
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
import { useEffect, useMemo, useState } from "react";
import type { ConflictCandidate } from "@open-practice/domain";
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
  insertDraftAssistSuggestion,
  isSameDraftDocument,
} from "./drafting-dashboard";
import {
  buildExternalUploadCreatePayload,
  buildExternalUploadRevokePath,
  canCreateExternalUpload,
  getExternalUploadLinkState,
  upsertExternalUploadLink,
} from "./external-uploads-dashboard";
import DraftEditor from "./drafting/DraftEditor";
import { filterMatters } from "./dashboard-utils";
import {
  buildCalendarRadarBuckets,
  describeCalendarEventTiming,
  upsertCalendarCredential,
} from "./calendar-dashboard";
import type {
  BillingDashboardResponse,
  CalendarCredentialCreateResponse,
  CalendarCredentialRevokeResponse,
  CalendarDashboardResponse,
  CapabilitiesResponse,
  ConflictResponse,
  DraftingDashboardResponse,
  DraftAssistRecordsResponse,
  DraftAssistStatusResponse,
  ExternalUploadCreateResponse,
  ExternalUploadRevokeResponse,
  ExternalUploadsDashboardResponse,
  IntakeSessionsResponse,
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
} from "./types";

interface DashboardClientProps {
  apiBaseUrl: string;
  billing: BillingDashboardResponse;
  calendar: CalendarDashboardResponse;
  capabilities: CapabilitiesResponse;
  devHeaders: Record<string, string>;
  drafting: DraftingDashboardResponse;
  externalUploads: ExternalUploadsDashboardResponse;
  intake: IntakeSessionsResponse;
  initialSection: DashboardNavigationSectionKey;
  overview: PracticeOverview;
  matters: MatterSummary[];
  session: SessionResponse;
  shareLinksStatus: ShareLinksStatusResponse;
  signatures: SignatureRequestsResponse;
  queues: QueuesResponse;
}

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];
type DashboardDraft = DraftingDashboardResponse["draftsByMatterId"][string][number];
type DashboardDraftAssistRecord = DraftAssistRecordsResponse["records"][number];

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const navIcons: Record<LocalDashboardSectionKey, LucideIcon> = {
  matters: Gavel,
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
  devHeaders,
  drafting,
  externalUploads,
  intake,
  initialSection,
  overview,
  matters,
  session,
  signatures,
  queues,
  shareLinksStatus,
}: DashboardClientProps) {
  const [activeMatterId, setActiveMatterId] = useState(matters[0]?.id ?? "");
  const [activeSection, setActiveSection] = useState<LocalDashboardSectionKey>(initialSection);
  const [matterSearch, setMatterSearch] = useState("");
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
  const [externalUploadMaxUploads, setExternalUploadMaxUploads] = useState("1");
  const [externalUploadExpiresAt, setExternalUploadExpiresAt] = useState("");
  const [externalUploadToken, setExternalUploadToken] = useState("");
  const [externalUploadStatus, setExternalUploadStatus] = useState("No link created.");
  const [creatingExternalUpload, setCreatingExternalUpload] = useState(false);
  const [revokingExternalUploadId, setRevokingExternalUploadId] = useState("");
  const [calendarEventsByMatterId] = useState(calendar.eventsByMatterId);
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

  const filteredMatters = useMemo(
    () => filterMatters(matters, matterSearch),
    [matters, matterSearch],
  );
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
  const activeCalendarEvents = activeMatter
    ? (calendarEventsByMatterId[activeMatter.id] ?? [])
    : [];
  const activeCalendarLinks = activeMatter ? calendar.linksByMatterId[activeMatter.id] : undefined;
  const activeCalendarBuckets = useMemo(
    () => buildCalendarRadarBuckets(activeCalendarEvents),
    [activeCalendarEvents],
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
      setActiveSection(selection.sectionKey);
    }

    applySectionFromUrl();
    window.addEventListener("popstate", applySectionFromUrl);
    return () => window.removeEventListener("popstate", applySectionFromUrl);
  }, [navigationSections]);

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
      setDraftStatus(`Draft creation failed: ${response.status}`);
      setCreatingTemplateId("");
      return;
    }

    const draft = (await response.json()) as DashboardDraft;
    setDraftsByMatterId((current) => appendDraftToMatterDrafts(current, draft));
    setSelectedDraftId(draft.id);
    setDraftEditorJson(draft.editorJson);
    setDraftStatus(`Created ${draft.title}.`);
    setCreatingTemplateId("");
  }

  async function createBlankDraft(): Promise<void> {
    if (!activeMatter) return;

    setCreatingTemplateId("blank");
    setDraftStatus("Creating draft...");
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
      setDraftStatus(`Draft creation failed: ${response.status}`);
      setCreatingTemplateId("");
      return;
    }

    const draft = (await response.json()) as DashboardDraft;
    setDraftsByMatterId((current) => appendDraftToMatterDrafts(current, draft));
    setSelectedDraftId(draft.id);
    setDraftEditorJson(draft.editorJson);
    setDraftStatus(`Created ${draft.title}.`);
    setCreatingTemplateId("");
  }

  async function saveDraft(): Promise<void> {
    if (!selectedDraft || !draftEditorJson) return;

    setSavingDraft(true);
    setDraftStatus("Saving draft...");
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
      setDraftStatus(`Draft save failed: ${response.status}`);
      setSavingDraft(false);
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
    setSavingDraft(false);
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

  function selectMatter(matterId: string): void {
    setActiveMatterId(matterId);
    setExternalUploadToken("");
    setExternalUploadStatus("No link created.");
    setCalendarOneTimeSecret(null);
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
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <span className="brand-mark">OP</span>
          <div>
            <strong>Open Practice</strong>
            <span>Apache-2.0 core</span>
          </div>
        </div>

        <nav className="nav-list">
          {navigationSections.map(({ key, label, enabled }) => {
            const Icon = navIcons[key];
            return (
              <button
                aria-disabled={!enabled}
                className={key === activeSection ? "nav-item active" : "nav-item"}
                disabled={!enabled}
                key={label}
                onClick={() => selectDashboardSection(key)}
                type="button"
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        <section className="security-card">
          <ShieldCheck size={20} />
          <strong>Server-enforced controls</strong>
          <p>Data is loaded through authenticated API requests and matter-scoped permissions.</p>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">BC / Ontario / Canada small-practice workspace</p>
            <h1>{overview.firm.name}</h1>
          </div>
          <div className="user-pill">
            <span>{session.user.displayName}</span>
            <strong>{session.user.role.replace("_", " ")}</strong>
          </div>
        </header>

        <section className="metric-grid" aria-label="Practice metrics">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <metric.icon size={19} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="panel matter-context-panel" aria-label="Matter context">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Matter command centre</p>
              <h2>Active files</h2>
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

        <section className="main-grid">
          <article className="panel matter-detail">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{activeMatter.number}</p>
                <h2>
                  {activeSection === "matters"
                    ? activeMatter.title
                    : navigationSections.find((section) => section.key === activeSection)?.label}
                </h2>
              </div>
              <span className="status-chip">{activeMatter.jurisdiction}</span>
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
                        <small>{party.role.replace("_", " ")}</small>
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
              </>
            ) : null}

            {activeSection === "funds" ? (
              <div className="activity-grid two-column">
                <div className="activity-card">
                  <Banknote size={18} />
                  <strong>{cents(activeMatter.trustBalanceCents)}</strong>
                  <span>matter trust balance</span>
                </div>
                <div className="activity-card">
                  <Clock3 size={18} />
                  <strong>
                    {minutes(
                      activeMatter.timeEntries.reduce((sum, entry) => sum + entry.minutes, 0),
                    )}
                  </strong>
                  <span>unbilled time on file</span>
                </div>
              </div>
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
                  Billing details are hidden for {session.user.role.replace("_", " ")} users.
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
                        {document.scanStatus}
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
                  <p className="inline-empty">{shareStatus}</p>
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
                <p className="inline-empty">{externalUploadStatus}</p>

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
                    return (
                      <div className="party-row" key={event.id}>
                        <span>
                          <strong>{event.title}</strong>
                          <small>
                            {compactDate(event.startsAt)} to {compactDate(event.endsAt)}
                            {event.location ? ` · ${event.location}` : ""}
                          </small>
                        </span>
                        <em
                          className={
                            event.status === "cancelled" || timing === "overdue"
                              ? "risk"
                              : undefined
                          }
                        >
                          {event.status === "cancelled" ? "cancelled" : timing}
                        </em>
                      </div>
                    );
                  })}
                  {activeCalendarEvents.length === 0 ? (
                    <p className="inline-empty">No calendar events are linked to this matter.</p>
                  ) : null}
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
                    <p className="inline-empty">{draftStatus}</p>
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
                    <p className="inline-empty">{draftStatus}</p>

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
              <div className="party-list">
                {activeIntakeSessions.map((sessionRecord) => (
                  <div className="party-row" key={sessionRecord.id}>
                    <span>
                      <strong>
                        {intake.templates.find(
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
          </article>

          <aside className="context-rail" aria-label="Matter review tools">
            <article className="panel conflict-panel">
              <div className="panel-header">
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

            <article className="panel queue-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Operational queues</p>
                  <h2>Review work</h2>
                </div>
                <Clock3 size={20} />
              </div>
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
