"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  FilePenLine,
  FileSignature,
  Files,
  Gavel,
  LockKeyhole,
  Plus,
  Save,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ConflictCandidate } from "@open-practice/domain";
import {
  buildSidebarNavigationSections,
  type OpenPracticeSidebarNavigationSection,
} from "../routes/routeCatalog";
import {
  appendDraftToMatterDrafts,
  buildBlankDraftPayload,
  buildDraftFromTemplatePayload,
  buildDraftUpdatePayload,
  extractDraftPlainText,
  isSameDraftDocument,
} from "./drafting-dashboard";
import DraftEditor from "./drafting/DraftEditor";
import { filterMatters } from "./dashboard-utils";
import type {
  BillingDashboardResponse,
  CapabilitiesResponse,
  ConflictResponse,
  DraftingDashboardResponse,
  IntakeSessionsResponse,
  MatterSummary,
  PracticeOverview,
  QueuesResponse,
  SessionResponse,
  SignatureRequestsResponse,
} from "./types";

interface DashboardClientProps {
  apiBaseUrl: string;
  billing: BillingDashboardResponse;
  capabilities: CapabilitiesResponse;
  devHeaders: Record<string, string>;
  drafting: DraftingDashboardResponse;
  intake: IntakeSessionsResponse;
  overview: PracticeOverview;
  matters: MatterSummary[];
  session: SessionResponse;
  signatures: SignatureRequestsResponse;
  queues: QueuesResponse;
}

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];
type DashboardDraft = DraftingDashboardResponse["draftsByMatterId"][string][number];

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const navIcons: Record<LocalDashboardSectionKey, LucideIcon> = {
  matters: Gavel,
  funds: Banknote,
  billing: CreditCard,
  documents: Files,
  drafting: FilePenLine,
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

export default function DashboardClient({
  apiBaseUrl,
  billing,
  capabilities,
  devHeaders,
  drafting,
  intake,
  overview,
  matters,
  session,
  signatures,
  queues,
}: DashboardClientProps) {
  const [activeMatterId, setActiveMatterId] = useState(matters[0]?.id ?? "");
  const [activeSection, setActiveSection] = useState<LocalDashboardSectionKey>("matters");
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
  const activeDrafts = activeMatter ? (draftsByMatterId[activeMatter.id] ?? []) : [];
  const selectedDraft = activeDrafts.find((draft) => draft.id === selectedDraftId);
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
    });
  }, [billing.canView, capabilities.sections]);

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

  function selectMatter(matterId: string): void {
    setActiveMatterId(matterId);
    closeDraftEditor();
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
                onClick={() => setActiveSection(key)}
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

        <section className="main-grid">
          <article className="panel matter-list">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Matter command centre</p>
                <h2>Active files</h2>
              </div>
              <Search size={18} />
            </div>
            <label className="search-field compact">
              <span>Search matters</span>
              <input
                aria-label="Search matters"
                onChange={(event) => setMatterSearch(event.target.value)}
                placeholder="Number, title, area, status"
                value={matterSearch}
              />
            </label>
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
          </article>

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
        </section>
      </section>
    </main>
  );
}
