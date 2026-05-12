import {
  Banknote,
  CalendarDays,
  Clock3,
  CreditCard,
  FileSignature,
  Files,
  FileText,
  Link2,
  Upload,
} from "lucide-react";
import type { OpenPracticeSidebarNavigationSection } from "../../routes/routeCatalog";
import {
  buildMatterFileCommandCenter,
  filterMatterActivity,
  formatMatterActivityKind,
  formatMatterActivityStatus,
  matterActivityKindFilters,
  matterActivityStatus,
  summarizeMatterActivity,
  type MatterActivityKindFilter,
  type MatterActivityStatusFilter,
} from "../matter-command-center";
import { describeCommunicationsDeliveryState } from "../communications-inbox-dashboard";
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
import type {
  CommunicationsInboxDashboardResponse,
  EmailDeliveryDashboardResponse,
  LegalClinicDashboardResponse,
  MatterSummary,
  PracticeOverview,
} from "../types";

type LocalDashboardSectionKey = OpenPracticeSidebarNavigationSection["key"];

export function MatterOverviewSection({
  activeActivitySummary,
  activeCommunicationsInbox,
  activeEmailDeliveries,
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
}: {
  activeActivitySummary: ReturnType<typeof summarizeMatterActivity>;
  activeCommunicationsInbox?: CommunicationsInboxDashboardResponse["inboxByMatterId"][string];
  activeEmailDeliveries: EmailDeliveryDashboardResponse["emailsByMatterId"][string];
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
}) {
  const fiscalHostMetadata = fiscalHostWorkflowMetadata(
    activeLegalClinicProgram,
    activeLegalClinicProfile,
  );

  return (
    <>
      <div className="detail-grid">
        <div>
          <span className="field-label">Responsible licensee</span>
          <strong>
            {overview.users.find((user) => user.id === activeMatter.responsibleUserId)?.displayName}
          </strong>
        </div>
        <div>
          <span className="field-label">Matter status</span>
          <strong>{activeMatter.status}</strong>
        </div>
        <div>
          <span className="field-label">Trust balance view</span>
          <strong>{formatCurrency(activeMatter.trustBalanceCents)}</strong>
        </div>
        <div>
          <span className="field-label">Data source</span>
          <strong>API</strong>
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
          <div className="party-list command-center-timeline">
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
            {[
              { key: "documents", label: "Documents/OCR", icon: Files },
              { key: "shares", label: "Share Links", icon: Link2 },
              { key: "externalUploads", label: "Uploads", icon: Upload },
              { key: "calendar", label: "Calendar", icon: CalendarDays },
              { key: "billing", label: "Billing", icon: CreditCard },
              { key: "intake", label: "Intake", icon: FileText },
              { key: "signatures", label: "Signatures", icon: FileSignature },
              { key: "queues", label: "Tasks", icon: Clock3 },
            ].map((action) => {
              const enabled = navigationSections.some(
                (section) => section.key === action.key && section.enabled,
              );
              const Icon = action.icon;
              return (
                <button
                  className="secondary-button compact-button command-jump-button"
                  disabled={!enabled}
                  key={action.key}
                  onClick={() => onSelectSection(action.key as LocalDashboardSectionKey)}
                  type="button"
                >
                  <Icon size={15} />
                  {action.label}
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
          <span className="field-label">Channel status</span>
          <strong>
            {activeCommunicationsInbox
              ? `${compactStatus(activeCommunicationsInbox.channelState.inboundEmailStatus)} / ${compactStatus(activeCommunicationsInbox.channelState.outboundEmailStatus)}`
              : "unavailable"}
          </strong>
        </div>
      </div>

      <div className="party-list">
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
