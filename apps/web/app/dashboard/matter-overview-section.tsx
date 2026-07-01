import {
  Banknote,
  CalendarDays,
  Clock3,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FilePenLine,
  Files,
  FileText,
  Link2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  compactMatterLifecycleReviewActionReason,
  describeMatterLifecycleReviewAction,
} from "@open-practice/domain/operational-actions";
import type { OpenPracticeSidebarNavigationSection } from "../../routes/routeCatalog";
import {
  buildMatterFileCommandCenter,
  type MatterLifecycleTransitionFormState,
  filterMatterActivity,
  formatMatterActivityKind,
  formatMatterActivityStatus,
  matterActivityKindFilters,
  matterActivityStatus,
  summarizeMatterActivity,
  type MatterActivityKindFilter,
  type MatterActivityStatusFilter,
} from "../matter-command-center";
import {
  describeCommunicationsDeliveryState,
  describeCommunicationsHistoryState,
} from "../communications-inbox-dashboard";
import { describeEmailDeliveryState } from "../email-delivery-dashboard";
import {
  describeFiscalHostProgramMetadata,
  describeLegalClinicProfileStatus,
  describeLegalClinicProgram,
  describeRestrictedFundMetadata,
  findLegalClinicProgram,
  fiscalHostWorkflowMetadata,
} from "../legal-clinic-dashboard";
import { formatMatterPartyRoleLabel } from "../participant-role-labels";
import type { EmailDeliveryDashboardResponse } from "../_features/email-delivery/models";
import type {
  CommunicationsInboxDashboardResponse,
  LegalClinicDashboardResponse,
  MatterSummary,
  PracticeOverview,
} from "../types";
import { DashboardSectionHeader, DashboardSummaryGrid } from "./shared-panels";

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];

const commandJumpIcons: Partial<Record<LocalDashboardSectionKey, LucideIcon>> = {
  funds: Banknote,
  billing: CreditCard,
  documents: Files,
  shares: Link2,
  externalUploads: Upload,
  drafting: FilePenLine,
  calendar: CalendarDays,
  signatures: FileSignature,
  intake: FileText,
  queues: Clock3,
};

type MatterSetupTone = "neutral" | "ready" | "risk";

type MatterSetupProfileView = MatterSummary["setupProfile"];

interface MatterSetupCueLike {
  key?: string;
  label?: string;
  description?: string;
  state?: string;
  count?: number;
}

function readableSetupText(value?: string | number | boolean): string {
  if (value === undefined || value === null || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Complete" : "Open";
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cueLabel(cue: MatterSetupCueLike): string {
  return readableSetupText(cue.label ?? cue.key);
}

function cueStatus(cue: MatterSetupCueLike): string {
  if (cue.state) return readableSetupText(cue.state);
  return "Tracked";
}

function cueDetail(cue: MatterSetupCueLike): string {
  if (cue.description) return cue.description;
  if (cue.count !== undefined) return `${cue.count} linked`;
  return "Read-only setup cue.";
}

function cueTone(cue: MatterSetupCueLike): MatterSetupTone {
  const status = cue.state?.toLowerCase() ?? "";
  if (
    status.includes("blocked") ||
    status.includes("missing") ||
    status.includes("attention") ||
    status.includes("incomplete") ||
    status.includes("overdue") ||
    status.includes("risk")
  ) {
    return "risk";
  }
  if (status.includes("complete") || status.includes("ready")) return "ready";
  return "neutral";
}

export function MatterOverviewSection({
  activeActivitySummary,
  activeCommunicationsInbox,
  activeEmailDeliveries,
  emailTemplateDraftsPanel,
  activeLegalClinicProfile,
  activeLegalClinicProgram,
  activeMatter,
  activeMatterCommandCenter,
  activityKindFilter,
  activityStatusFilter,
  filteredMatterActivity,
  navigationSections,
  overview,
  compactDate,
  compactStatus,
  formatCurrency,
  formatMinutes,
  onActivityKindFilterChange,
  onActivityStatusFilterChange,
  onSelectSection,
  canRecordLifecycleTransition,
  lifecycleTransitionForm,
  lifecycleTransitionStatus,
  recordingLifecycleTransition,
  onLifecycleTransitionFormChange,
  onRecordLifecycleTransition,
}: {
  activeActivitySummary: ReturnType<typeof summarizeMatterActivity>;
  activeCommunicationsInbox?: CommunicationsInboxDashboardResponse["inboxByMatterId"][string];
  activeEmailDeliveries: EmailDeliveryDashboardResponse["emailsByMatterId"][string];
  emailTemplateDraftsPanel?: ReactNode;
  activeLegalClinicProfile?: LegalClinicDashboardResponse["profilesByMatterId"][string][number];
  activeLegalClinicProgram?: ReturnType<typeof findLegalClinicProgram>;
  activeMatter: MatterSummary;
  activeMatterCommandCenter?: ReturnType<typeof buildMatterFileCommandCenter>;
  activityKindFilter: MatterActivityKindFilter;
  activityStatusFilter: MatterActivityStatusFilter;
  filteredMatterActivity: ReturnType<typeof filterMatterActivity>;
  navigationSections: OpenPracticeSidebarNavigationSection[];
  overview: PracticeOverview;
  compactDate: (value?: string) => string;
  compactStatus: (value?: string) => string;
  formatCurrency: (value: number) => string;
  formatMinutes: (value: number) => string;
  onActivityKindFilterChange: (value: MatterActivityKindFilter) => void;
  onActivityStatusFilterChange: (value: MatterActivityStatusFilter) => void;
  onSelectSection: (section: LocalDashboardSectionKey) => void;
  canRecordLifecycleTransition: boolean;
  lifecycleTransitionForm: MatterLifecycleTransitionFormState;
  lifecycleTransitionStatus: string;
  recordingLifecycleTransition: boolean;
  onLifecycleTransitionFormChange: (value: MatterLifecycleTransitionFormState) => void;
  onRecordLifecycleTransition: () => void;
}) {
  const fiscalHostMetadata = fiscalHostWorkflowMetadata(
    activeLegalClinicProgram,
    activeLegalClinicProfile,
  );
  const setupProfile: MatterSetupProfileView = activeMatter.setupProfile;
  const setupStage = setupProfile.stage;
  const responsiblePosture = setupProfile.responsibleUser;
  const responsiblePostureUser = overview.users.find(
    (user) => user.id === responsiblePosture.responsibleUserId,
  );
  const setupChecklist = setupProfile.checklist;
  const customFieldDefinitions = setupProfile.fieldDefinitions;
  const financialSnapshotCues = setupProfile.financialSnapshot.cues;
  const setupSummaryLabel = setupStage.label;
  const latestLifecycleRecords = activeMatter.lifecycleTransitions.slice(0, 4);
  const lifecycleReviewAction = describeMatterLifecycleReviewAction({
    action: "record_review",
    canRecord: canRecordLifecycleTransition,
    recording: recordingLifecycleTransition,
  });
  const lifecycleReviewDisabled = !lifecycleReviewAction.available;
  const lifecycleReviewAriaLabel = lifecycleReviewAction.disabledReason
    ? `${lifecycleReviewAction.label}: ${compactMatterLifecycleReviewActionReason(
        lifecycleReviewAction.disabledReason,
      )}`
    : lifecycleReviewAction.label;
  const customFieldAttentionCount = customFieldDefinitions.filter(
    (cue) => cueTone(cue) === "risk",
  ).length;
  const financialSnapshotDetail = setupProfile.financialSnapshot.caution;

  return (
    <>
      <DashboardSummaryGrid
        items={[
          {
            label: "Responsible licensee",
            value:
              overview.users.find((user) => user.id === activeMatter.responsibleUserId)
                ?.displayName ?? "Unassigned",
          },
          {
            label: "Matter status",
            value: activeMatter.status,
          },
          {
            label: "Trust balance view",
            value: formatCurrency(activeMatter.trustBalanceCents),
          },
          {
            label: "Data source",
            value: "API",
            detail: "Matter-scoped dashboard payload.",
          },
        ]}
      />

      {emailTemplateDraftsPanel}

      <DashboardSectionHeader meta={readableSetupText(setupSummaryLabel)} title="Matter setup" />
      <div className="detail-grid compact-detail-grid matter-setup-summary">
        <div>
          <span className="field-label">Stage</span>
          <strong>{readableSetupText(setupStage.label)}</strong>
          <small>{cueDetail(setupStage)}</small>
        </div>
        <div>
          <span className="field-label">Responsible posture</span>
          <strong>
            {responsiblePostureUser?.displayName ??
              responsiblePosture.responsibleUserDisplayName ??
              cueLabel(responsiblePosture)}
          </strong>
          <small>{cueDetail(responsiblePosture)}</small>
        </div>
        <div>
          <span className="field-label">Custom fields</span>
          <strong>{customFieldDefinitions.length} definitions</strong>
          <small>
            {customFieldDefinitions.length > 0
              ? `${customFieldAttentionCount} need attention`
              : "No setup field definitions returned."}
          </small>
        </div>
        <div>
          <span className="field-label">Financial snapshot</span>
          <strong>{financialSnapshotCues.length} cues</strong>
          <small>{financialSnapshotDetail}</small>
        </div>
      </div>
      <div className="activity-grid matter-setup-cue-grid">
        <div className="activity-card">
          <strong>Setup checklist</strong>
          <span>{setupChecklist.length} rows</span>
          <div className="party-list">
            {setupChecklist.map((cue, index) => (
              <div className="party-row" key={`${cue.key}-setup-checklist-${index}`}>
                <span>
                  <strong>{cueLabel(cue)}</strong>
                  <small>{cueDetail(cue)}</small>
                </span>
                <em className={cueTone(cue) === "risk" ? "risk" : undefined}>{cueStatus(cue)}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="activity-card">
          <strong>Custom field definitions</strong>
          <span>{customFieldDefinitions.length} definitions</span>
          <div className="party-list">
            {customFieldDefinitions.map((cue, index) => (
              <div className="party-row" key={`${cue.key}-custom-field-${index}`}>
                <span>
                  <strong>{cueLabel(cue)}</strong>
                  <small>{cueDetail(cue)}</small>
                </span>
                <em className={cueTone(cue) === "risk" ? "risk" : undefined}>{cueStatus(cue)}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="activity-card">
          <strong>Financial cues</strong>
          <span>{financialSnapshotCues.length} rows</span>
          <div className="party-list">
            {financialSnapshotCues.map((cue, index) => (
              <div className="party-row" key={`${cue.key}-financial-cue-${index}`}>
                <span>
                  <strong>{cueLabel(cue)}</strong>
                  <small>{cueDetail(cue)}</small>
                </span>
                <em className={cueTone(cue) === "risk" ? "risk" : undefined}>{cueStatus(cue)}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">
        <h3>Lifecycle readiness</h3>
        <span>review-only records · no status automation</span>
      </div>
      <div className="activity-grid lifecycle-readiness-grid">
        <div className="activity-card lifecycle-readiness-review-card">
          <ClipboardCheck size={18} />
          <strong>{latestLifecycleRecords.length} recent reviews</strong>
          <span aria-live="polite" role="status">
            {lifecycleTransitionStatus}
          </span>
          <div className="party-list">
            {latestLifecycleRecords.map((record) => (
              <div className="party-row" key={record.id}>
                <span>
                  <strong>
                    {readableSetupText(record.transition)} readiness:{" "}
                    {readableSetupText(record.readiness)}
                  </strong>
                  <small>
                    {readableSetupText(record.currentStatus)} to{" "}
                    {readableSetupText(record.targetStatus)} · {compactDate(record.reviewedAt)}
                  </small>
                  <small>{record.reason}</small>
                  {record.blockers.length > 0 ? (
                    <small>{record.blockers.length} blocker evidence rows recorded.</small>
                  ) : null}
                </span>
                <em className={record.readiness === "blocked" ? "risk" : undefined}>
                  {record.readiness === "blocked" ? "Blocked" : "Ready"}
                </em>
              </div>
            ))}
            {latestLifecycleRecords.length === 0 ? (
              <p className="inline-empty">No lifecycle readiness review records yet.</p>
            ) : null}
          </div>
        </div>
        <div className="activity-card lifecycle-readiness-form-card">
          <strong>Record review evidence</strong>
          <span>Snapshots current status and target readiness only.</span>
          <label className="search-field compact">
            <span>Transition</span>
            <select
              disabled={lifecycleReviewDisabled}
              onChange={(event) =>
                onLifecycleTransitionFormChange({
                  ...lifecycleTransitionForm,
                  transition: event.target
                    .value as MatterLifecycleTransitionFormState["transition"],
                })
              }
              value={lifecycleTransitionForm.transition}
            >
              {(["pause", "close", "archive", "reopen"] as const).map((transition) => (
                <option key={transition} value={transition}>
                  {readableSetupText(transition)}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field compact">
            <span>Readiness</span>
            <select
              disabled={lifecycleReviewDisabled}
              onChange={(event) =>
                onLifecycleTransitionFormChange({
                  ...lifecycleTransitionForm,
                  readiness: event.target.value as MatterLifecycleTransitionFormState["readiness"],
                })
              }
              value={lifecycleTransitionForm.readiness}
            >
              {(["ready", "blocked"] as const).map((readiness) => (
                <option key={readiness} value={readiness}>
                  {readableSetupText(readiness)}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field compact">
            <span>Reason</span>
            <input
              disabled={lifecycleReviewDisabled}
              maxLength={240}
              onChange={(event) =>
                onLifecycleTransitionFormChange({
                  ...lifecycleTransitionForm,
                  reason: event.target.value,
                })
              }
              value={lifecycleTransitionForm.reason}
            />
          </label>
          <label className="search-field compact">
            <span>Blockers</span>
            <textarea
              disabled={lifecycleReviewDisabled}
              maxLength={640}
              onChange={(event) =>
                onLifecycleTransitionFormChange({
                  ...lifecycleTransitionForm,
                  blockers: event.target.value,
                })
              }
              rows={3}
              value={lifecycleTransitionForm.blockers}
            />
          </label>
          <button
            aria-label={lifecycleReviewAriaLabel}
            className="secondary-button compact-button"
            data-action-key={lifecycleReviewAction.actionKey}
            disabled={lifecycleReviewDisabled}
            onClick={onRecordLifecycleTransition}
            type="button"
          >
            <ClipboardCheck size={15} />
            {lifecycleReviewAction.label}
          </button>
        </div>
      </div>

      <div className="section-title command-center-title">
        <h3>Activity and files</h3>
        <span>{activeActivitySummary.total} timeline events</span>
      </div>
      <div className="command-center-grid">
        <section className="command-center-main" aria-label="Matter activity timeline">
          <div className="activity-filter-row">
            <label className="search-field compact">
              <span>Kind</span>
              <select
                onChange={(event) =>
                  onActivityKindFilterChange(event.target.value as MatterActivityKindFilter)
                }
                value={activityKindFilter}
              >
                {matterActivityKindFilters.map((kind) => (
                  <option key={kind} value={kind}>
                    {formatMatterActivityKind(kind)}
                  </option>
                ))}
              </select>
            </label>
            <label className="search-field compact">
              <span>Status</span>
              <select
                onChange={(event) =>
                  onActivityStatusFilterChange(event.target.value as MatterActivityStatusFilter)
                }
                value={activityStatusFilter}
              >
                {(["all", "attention", "open", "complete"] as const).map((status) => (
                  <option key={status} value={status}>
                    {formatMatterActivityStatus(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="activity-grid command-center-summary-grid">
            <div className="activity-card">
              <Clock3 size={18} />
              <strong>{activeActivitySummary.total} events</strong>
              <span>{activeActivitySummary.attention} need attention</span>
            </div>
            <div className="activity-card">
              <Files size={18} />
              <strong>{activeMatterCommandCenter?.summary.documents ?? 0} files</strong>
              <span>
                {activeMatterCommandCenter?.summary.readyForOcr ?? 0} OCR-ready ·{" "}
                {activeMatterCommandCenter?.summary.blocked ?? 0} blocked
              </span>
            </div>
            <div className="activity-card">
              <Link2 size={18} />
              <strong>{activeMatterCommandCenter?.summary.activeShares ?? 0} active shares</strong>
              <span>
                {activeMatterCommandCenter?.summary.externalReviewAttention ?? 0} upload reviews
              </span>
            </div>
          </div>
          <div
            aria-label="Matter activity timeline"
            className="party-list command-center-timeline"
            tabIndex={0}
          >
            {filteredMatterActivity.slice(0, 8).map((entry) => (
              <div className="party-row" key={entry.id}>
                <span>
                  <strong>{entry.title}</strong>
                  <small>
                    {formatMatterActivityKind(entry.kind)} · {compactDate(entry.occurredAt)}
                  </small>
                </span>
                <em className={matterActivityStatus(entry) === "attention" ? "risk" : undefined}>
                  {formatMatterActivityStatus(matterActivityStatus(entry))}
                </em>
              </div>
            ))}
            {filteredMatterActivity.length === 0 ? (
              <p className="inline-empty">No matter activity matches these filters.</p>
            ) : null}
          </div>
        </section>

        <aside className="command-center-rail" aria-label="File status">
          <div className="file-status-rail">
            {activeMatterCommandCenter?.rail.map((item) => (
              <div className="file-status-item" key={item.key}>
                <span>
                  <strong>{item.value}</strong>
                  <small>{item.label}</small>
                </span>
                <em className={item.tone === "risk" ? "risk" : undefined}>{item.detail}</em>
              </div>
            ))}
          </div>
          <div className="command-jump-actions" aria-label="Command center shortcuts">
            {navigationSections
              .filter(
                (section) =>
                  section.key !== "matters" &&
                  section.key !== "contacts" &&
                  section.key !== "audit" &&
                  (section.requiresMatterContext || section.key === "queues"),
              )
              .map((section) => {
                const Icon = commandJumpIcons[section.key] ?? Clock3;
                return (
                  <button
                    className="secondary-button compact-button command-jump-button"
                    disabled={!section.enabled}
                    key={section.key}
                    onClick={() => onSelectSection(section.key)}
                    title={section.title}
                    type="button"
                  >
                    <Icon size={15} />
                    {section.label}
                  </button>
                );
              })}
          </div>
        </aside>
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
              <small>
                {[
                  formatMatterPartyRoleLabel(party.role),
                  party.contact.kind,
                  party.status ?? "active",
                  party.side,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              <small>
                {[
                  party.startedOn ? `from ${party.startedOn}` : null,
                  party.endedOn ? `ended ${party.endedOn}` : null,
                  party.confidential ? "confidential" : null,
                  party.conflictCheckIncluded === false ? "conflict excluded" : "conflict included",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
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
            {formatMinutes(activeMatter.timeEntries.reduce((sum, entry) => sum + entry.minutes, 0))}
          </strong>
          <span>billable time captured</span>
        </div>
        <div className="activity-card">
          <Banknote size={18} />
          <strong>
            {formatCurrency(
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
                  {describeLegalClinicProgram(activeLegalClinicProgram, activeLegalClinicProfile)}
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
                <strong>{compactStatus(activeLegalClinicProfile.eligibilityStatus)}</strong>
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
              <em>{activeLegalClinicProfile.nextReviewDate ? "review set" : "no review"}</em>
            </div>
            <div className="party-row">
              <span>
                <strong>
                  {describeFiscalHostProgramMetadata(fiscalHostMetadata.programMetadata)}
                </strong>
                <small>
                  {fiscalHostMetadata.programMetadata.reportingCadence
                    ? `Reporting cadence ${fiscalHostMetadata.programMetadata.reportingCadence}.`
                    : "Program host metadata is read-only until staff review confirms it."}
                </small>
              </span>
              <em>fiscal host</em>
            </div>
            <div className="party-row">
              <span>
                <strong>
                  {describeRestrictedFundMetadata(fiscalHostMetadata.restrictedFundMetadata)}
                </strong>
                <small>
                  {fiscalHostMetadata.restrictedFundMetadata.purpose ??
                    "Restricted-fund purpose is deferred until staff review."}
                </small>
              </span>
              <em>{fiscalHostMetadata.restrictedFundMetadata.nextReviewDate ?? "review needed"}</em>
            </div>
          </div>
        </>
      ) : null}

      <div className="section-title">
        <h3>Client communications</h3>
        <span>{activeCommunicationsInbox?.status.replaceAll("_", " ") ?? "unavailable"}</span>
      </div>
      <div className="detail-grid compact-detail-grid">
        <div>
          <span className="field-label">Inbound messages</span>
          <strong>{activeCommunicationsInbox?.inboundEmail.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Outbound records</span>
          <strong>{activeCommunicationsInbox?.outboundDeliveryHistory.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Conversation topics</span>
          <strong>{activeCommunicationsInbox?.conversations.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">History entries</span>
          <strong>{activeCommunicationsInbox?.channelHistory.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Update drafts</span>
          <strong>{activeCommunicationsInbox?.clientUpdateDraftRequests.length ?? 0}</strong>
        </div>
        <div>
          <span className="field-label">Channel status</span>
          <strong>
            {activeCommunicationsInbox
              ? `${compactStatus(activeCommunicationsInbox.channelState.inboundEmailStatus)} / ${compactStatus(activeCommunicationsInbox.channelState.outboundEmailStatus)}`
              : "unavailable"}
          </strong>
        </div>
      </div>

      <div className="party-list">
        {activeCommunicationsInbox?.channelHistory.slice(0, 4).map((item) => {
          const state = describeCommunicationsHistoryState(item);
          return (
            <div className="party-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.detail} · {compactStatus(item.direction)} · {compactDate(item.occurredAt)}
                </small>
                {item.consentStatus ? (
                  <small>Consent {compactStatus(item.consentStatus)}</small>
                ) : null}
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeCommunicationsInbox?.inboundEmail.slice(0, 3).map((message) => (
          <div className="party-row" key={message.id}>
            <span>
              <strong>{compactStatus(message.triage?.status ?? message.status)}</strong>
              <small>
                received {compactDate(message.receivedAt)} · {message.attachmentCount} attachment
                {message.attachmentCount === 1 ? "" : "s"}
              </small>
              {message.labels.length > 0 ? (
                <small>{message.labels.map(compactStatus).join(", ")}</small>
              ) : null}
            </span>
            <em>{message.status.replaceAll("_", " ")}</em>
          </div>
        ))}
        {activeCommunicationsInbox?.outboundDeliveryHistory.slice(0, 3).map((email) => {
          const state = describeCommunicationsDeliveryState(email);
          return (
            <div className="party-row" key={email.id}>
              <span>
                <strong>{email.templateKey}</strong>
                <small>
                  {email.recipientCount} recipients · {email.attemptCount} attempts ·{" "}
                  {compactDate(email.lastAttemptAt ?? email.queuedAt)}
                </small>
                {email.failureSummary ? <small>{email.failureSummary}</small> : null}
                <small>{state.detail}</small>
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeCommunicationsInbox?.conversations.slice(0, 3).map((thread) => (
          <div className="party-row" key={thread.id}>
            <span>
              <strong>{thread.topic}</strong>
              <small>
                {compactStatus(thread.notificationBoundary)} · {compactDate(thread.updatedAt)}
              </small>
            </span>
            <em>{compactStatus(thread.status)}</em>
          </div>
        ))}
        {activeCommunicationsInbox?.contactCues.slice(0, 3).map((cue) => {
          const linkedRole = cue.matterLinks[0]?.role;
          const reviewCount = cue.cueSummary.conflictCueCount + cue.cueSummary.qualitySignalCount;
          return (
            <div className="party-row" key={cue.contact.id}>
              <span>
                <strong>{cue.contact.displayName}</strong>
                <small>
                  {cue.contact.kind} · {linkedRole ? compactStatus(linkedRole) : "matter link"}
                </small>
              </span>
              <em className={reviewCount > 0 ? "risk" : undefined}>
                {reviewCount > 0 ? `${reviewCount} cues` : "clear"}
              </em>
            </div>
          );
        })}
        {activeCommunicationsInbox &&
        activeCommunicationsInbox.inboundEmail.length === 0 &&
        activeCommunicationsInbox.outboundDeliveryHistory.length === 0 &&
        activeCommunicationsInbox.conversations.length === 0 &&
        activeCommunicationsInbox.channelHistory.length === 0 &&
        activeCommunicationsInbox.clientUpdateDraftRequests.length === 0 &&
        activeCommunicationsInbox.contactCues.length === 0 ? (
          <p className="inline-empty">No client communications are linked to this matter.</p>
        ) : null}
      </div>

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
                <small>{state.detail}</small>
              </span>
              <em className={state.tone === "risk" ? "risk" : undefined}>{state.label}</em>
            </div>
          );
        })}
        {activeEmailDeliveries.length === 0 ? (
          <p className="inline-empty">No outbound email history is linked to this matter.</p>
        ) : null}
      </div>
    </>
  );
}
