import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import {
  contactDataQualityResolutionActions,
  contactDataQualitySignalKey,
  contactDossierRiskClass,
  formatContactDataQualityResolutionDecision,
  contactReviewQueueRiskClass,
  formatContactReviewSignalKind,
  latestContactDataQualityResolutionForSignal,
  summarizeContactDossier,
  summarizeContactDuplicateReviewCue,
  summarizeContactReviewQueueItem,
} from "../contact-dossiers-dashboard";
import { formatMatterPartyRoleLabel } from "../participant-role-labels";
import type {
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactDossiersResponse,
  ContactTimelineActivityFilter,
  ContactTimelineResponse,
  ContactReviewQueueResponse,
} from "../_features/contacts/models";
import { contactTimelineActivityFilters } from "../_features/contacts/models";

function contactTimelineCueValue(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function contactTimelineCueLabel(cueType?: string): string {
  return cueType === "follow_up_review" ? "Follow-up review cue" : "Task deadline cue";
}

const contactTimelineActivityFilterLabels: Record<ContactTimelineActivityFilter, string> = {
  all: "All safe activity",
  crm_activity: "CRM activity",
  task_cues: "Task and follow-up cues",
  open_tasks: "Open tasks",
  follow_ups: "Follow-up reviews",
};

const contactTimelineMetadataLabelKeys = [
  "role",
  "status",
  "relationshipKind",
  "signalKind",
  "decision",
  "severity",
] as const;

function contactTimelineMetadataLabels(
  entry: ContactTimelineResponse["timeline"][number],
  compactStatus: (value?: string) => string,
): string[] {
  return contactTimelineMetadataLabelKeys
    .map((key) => contactTimelineCueValue(entry.metadata, key))
    .filter((value): value is string => Boolean(value))
    .map((value) => compactStatus(value));
}

export function ContactsSection({
  activeContactDossier,
  canRecordContactDataQualityResolution,
  canExportContactHistory,
  canCreateContact,
  canCreateMatter,
  compactStatus,
  contactCreateDisplayName,
  contactCreateEmail,
  contactCreateKind,
  contactCreateLifecycleStatus = "prospective",
  contactCreatePhone,
  contactCreateRoleCategory = "prospective_client",
  contactCreateStatus,
  contactDataQualityResolutions,
  contactDataQualityStatus,
  contactDossiers,
  contactHistoryExportReason,
  contactHistoryExportStatus,
  contactHistoryExportSummary,
  contactTimeline,
  contactTimelineActivityFilter,
  contactTimelineStatus,
  contactReviewQueue,
  contactSearch,
  creatingContact,
  creatingMatterFromContactId,
  filteredContactDossiers,
  onContactCreateDisplayNameChange,
  onContactCreateEmailChange,
  onContactCreateKindChange,
  onContactCreateLifecycleStatusChange = () => undefined,
  onContactCreatePhoneChange,
  onContactCreateRoleCategoryChange = () => undefined,
  onContactHistoryExportReasonChange,
  onContactTimelineActivityFilterChange,
  onExportContactHistory,
  onCreateContact,
  onCreateMatterFromContact,
  onNewAppointmentForContact,
  onRecordContactDataQualityResolution,
  onContactSearchChange,
  onPrepareConflictCheckFromContact,
  onSelectContact,
  onSelectMatter,
  recordingContactResolutionKey,
  exportingContactHistory,
}: {
  activeContactDossier?: ContactDossier;
  canRecordContactDataQualityResolution: boolean;
  canExportContactHistory: boolean;
  canCreateContact: boolean;
  canCreateMatter: boolean;
  compactStatus: (value?: string) => string;
  contactCreateDisplayName: string;
  contactCreateEmail: string;
  contactCreateKind: "person" | "organization";
  contactCreateLifecycleStatus?: string;
  contactCreatePhone: string;
  contactCreateRoleCategory?: string;
  contactCreateStatus: string;
  contactDataQualityResolutions: ContactDataQualityResolutionRecord[];
  contactDataQualityStatus: string;
  contactDossiers: ContactDossiersResponse;
  contactHistoryExportReason: string;
  contactHistoryExportStatus: string;
  contactHistoryExportSummary: string;
  contactTimeline: ContactTimelineResponse["timeline"];
  contactTimelineActivityFilter: ContactTimelineActivityFilter;
  contactTimelineStatus: string;
  contactReviewQueue?: ContactReviewQueueResponse;
  contactSearch: string;
  creatingContact: boolean;
  creatingMatterFromContactId: string;
  filteredContactDossiers: ContactDossiersResponse;
  onContactCreateDisplayNameChange: (value: string) => void;
  onContactCreateEmailChange: (value: string) => void;
  onContactCreateKindChange: (value: "person" | "organization") => void;
  onContactCreateLifecycleStatusChange?: (value: string) => void;
  onContactCreatePhoneChange: (value: string) => void;
  onContactCreateRoleCategoryChange?: (value: string) => void;
  onContactHistoryExportReasonChange: (value: string) => void;
  onContactTimelineActivityFilterChange: (value: ContactTimelineActivityFilter) => void;
  onExportContactHistory: () => void;
  onCreateContact: () => void;
  onCreateMatterFromContact: (dossier: ContactDossier) => void;
  onNewAppointmentForContact: (dossier: ContactDossier) => void;
  onRecordContactDataQualityResolution: (
    signal: ContactDossier["qualityReview"]["signals"][number],
    decision: ContactDataQualityResolutionRecord["decision"],
  ) => void;
  onContactSearchChange: (value: string) => void;
  onPrepareConflictCheckFromContact: () => void;
  onSelectContact: (contactId: string) => void;
  onSelectMatter: (matterId: string) => void;
  recordingContactResolutionKey: string;
  exportingContactHistory: boolean;
}) {
  const timelineEntries = contactTimeline.slice(0, 6);
  const matterNumberById = new Map(
    (activeContactDossier?.matters ?? []).map((matter) => [matter.matterId, matter.matterNumber]),
  );

  return (
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
            {contactDossiers.reduce((sum, dossier) => sum + dossier.portal.activeGrantCount, 0)}
          </strong>
        </div>
        <div>
          <span className="field-label">Risk cues</span>
          <strong>
            {
              contactDossiers.filter(
                (dossier) =>
                  dossier.conflictCues.some((cue) => cue.severity !== "info") ||
                  dossier.qualityReview.signals.some((signal) => signal.severity !== "info"),
              ).length
            }
          </strong>
        </div>
        <div>
          <span className="field-label">Relationships</span>
          <strong>
            {contactDossiers.reduce((sum, dossier) => sum + dossier.relationships.length, 0)}
          </strong>
        </div>
      </div>

      <div className="share-controls contact-create-controls">
        <div className="section-title">
          <h3>Create standalone contact</h3>
          <span>{contactCreateStatus}</span>
        </div>
        <div className="calendar-attendee-form">
          <label className="search-field">
            <span>Kind</span>
            <select
              onChange={(event) =>
                onContactCreateKindChange(event.currentTarget.value as "person" | "organization")
              }
              value={contactCreateKind}
            >
              <option value="person">Person</option>
              <option value="organization">Organization</option>
            </select>
          </label>
          <label className="search-field">
            <span>Display name</span>
            <input
              onChange={(event) => onContactCreateDisplayNameChange(event.currentTarget.value)}
              value={contactCreateDisplayName}
            />
          </label>
          <label className="search-field">
            <span>Status</span>
            <select
              onChange={(event) => onContactCreateLifecycleStatusChange(event.currentTarget.value)}
              value={contactCreateLifecycleStatus}
            >
              <option value="prospective">Prospective</option>
              <option value="active">Active</option>
              <option value="former">Former</option>
              <option value="inactive">Inactive</option>
              <option value="restricted">Restricted</option>
            </select>
          </label>
          <label className="search-field">
            <span>Legal role</span>
            <select
              onChange={(event) => onContactCreateRoleCategoryChange(event.currentTarget.value)}
              value={contactCreateRoleCategory}
            >
              <option value="prospective_client">Prospective client</option>
              <option value="client">Client</option>
              <option value="former_client">Former client</option>
              <option value="opposing_party">Opposing party</option>
              <option value="witness">Witness</option>
              <option value="lawyer">Lawyer</option>
              <option value="paralegal">Paralegal</option>
              <option value="authorized_non_lawyer_provider">Authorized provider</option>
              <option value="legal_representative">Legal representative</option>
              <option value="court_tribunal">Court or tribunal</option>
              <option value="insurer">Insurer</option>
              <option value="expert">Expert</option>
              <option value="vendor">Vendor</option>
              <option value="referral_source">Referral source</option>
              <option value="internal_team_member">Internal team</option>
              <option value="organization">Organization</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="search-field">
            <span>Email</span>
            <input
              inputMode="email"
              onChange={(event) => onContactCreateEmailChange(event.currentTarget.value)}
              type="email"
              value={contactCreateEmail}
            />
          </label>
          <label className="search-field">
            <span>Phone</span>
            <input
              inputMode="tel"
              onChange={(event) => onContactCreatePhoneChange(event.currentTarget.value)}
              type="tel"
              value={contactCreatePhone}
            />
          </label>
          <button
            className="secondary-button compact-button"
            disabled={creatingContact || !canCreateContact || !contactCreateDisplayName.trim()}
            onClick={() => void onCreateContact()}
            type="button"
          >
            <UserPlus size={16} />
            {creatingContact ? "Creating..." : "Create contact"}
          </button>
        </div>
      </div>

      <div className="section-title">
        <h3>Review queue</h3>
        <span>{contactReviewQueue?.summary.reviewItemCount ?? 0} pending</span>
      </div>
      {contactReviewQueue ? (
        <>
          <div className="detail-grid compact-detail-grid contact-summary-grid">
            <div>
              <span className="field-label">Review items</span>
              <strong>{contactReviewQueue.summary.reviewItemCount}</strong>
            </div>
            <div>
              <span className="field-label">Duplicate cues</span>
              <strong>{contactReviewQueue.summary.duplicateCandidateCount}</strong>
            </div>
            <div>
              <span className="field-label">Protected-party cues</span>
              <strong>{contactReviewQueue.summary.sensitivePartyCueCount}</strong>
            </div>
            <div>
              <span className="field-label">Conflict rechecks</span>
              <strong>{contactReviewQueue.summary.revalidationPromptCount}</strong>
            </div>
          </div>
          <div className="party-list contact-dossier-list">
            {contactReviewQueue.items.map((item) => (
              <div className="party-row" key={item.contact.id}>
                <span>
                  <strong>{item.contact.displayName}</strong>
                  <small>
                    {item.contact.kind} · {item.matters.length} matter
                    {item.matters.length === 1 ? "" : "s"} · {item.signals.length} redacted cue
                    {item.signals.length === 1 ? "" : "s"}
                  </small>
                  <small>
                    {item.contact.aliasCount} alias ref
                    {item.contact.aliasCount === 1 ? "" : "s"} · {item.contact.identifierCount}{" "}
                    identifier ref
                    {item.contact.identifierCount === 1 ? "" : "s"}
                  </small>
                  {item.signals.slice(0, 2).map((signal, index) => (
                    <small key={`${item.contact.id}-review-signal-${index}`}>
                      {formatContactReviewSignalKind(signal.kind)}: {signal.reason}
                      {signal.matchedValueRedacted ? " · value redacted" : ""}
                    </small>
                  ))}
                  {item.signals
                    .slice(0, 2)
                    .map((signal) => summarizeContactDuplicateReviewCue(signal))
                    .filter(Boolean)
                    .map((summary, index) => (
                      <small key={`${item.contact.id}-duplicate-review-${index}`}>{summary}</small>
                    ))}
                  {item.signals.length > 2 ? (
                    <small>
                      +{item.signals.length - 2} more redacted cue
                      {item.signals.length - 2 === 1 ? "" : "s"}
                    </small>
                  ) : null}
                </span>
                <em className={contactReviewQueueRiskClass(item)}>
                  {summarizeContactReviewQueueItem(item)}
                </em>
              </div>
            ))}
            {contactReviewQueue.items.length === 0 ? (
              <p className="inline-empty">No contacts need review.</p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="inline-empty">Contact review queue is not loaded.</p>
      )}

      <div className="section-title">
        <h3>Contact dossiers</h3>
        <span>{filteredContactDossiers.length} visible</span>
      </div>
      <label className="search-field contact-search-field">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Search contacts"
          onChange={(event) => onContactSearchChange(event.target.value)}
          placeholder="Search contacts, aliases, identifiers, or matters"
          value={contactSearch}
        />
      </label>

      <div className="contact-dossier-grid">
        <div className="party-list contact-dossier-list">
          {filteredContactDossiers.map((dossier) => (
            <button
              aria-current={
                dossier.contact.id === activeContactDossier?.contact.id ? "true" : undefined
              }
              className={
                dossier.contact.id === activeContactDossier?.contact.id
                  ? "party-row draft-row selected-template"
                  : "party-row draft-row"
              }
              key={dossier.contact.id}
              onClick={() => onSelectContact(dossier.contact.id)}
              type="button"
            >
              <span>
                <strong>{dossier.contact.displayName}</strong>
                <small>
                  {dossier.contact.kind} · {dossier.matters.length} matter
                  {dossier.matters.length === 1 ? "" : "s"}
                  {dossier.relationships.length > 0
                    ? ` · ${dossier.relationships.length} relationship${
                        dossier.relationships.length === 1 ? "" : "s"
                      }`
                    : ""}
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
                <span className="row-actions">
                  <button
                    className="secondary-button compact-action-button"
                    onClick={onPrepareConflictCheckFromContact}
                    type="button"
                  >
                    <Search size={16} />
                    Check
                  </button>
                  <button
                    className="secondary-button compact-action-button"
                    onClick={() => onNewAppointmentForContact(activeContactDossier)}
                    type="button"
                  >
                    <CalendarDays size={16} />
                    Appointment
                  </button>
                  <button
                    className="secondary-button compact-action-button"
                    disabled={
                      !canCreateMatter ||
                      creatingMatterFromContactId === activeContactDossier.contact.id
                    }
                    onClick={() => void onCreateMatterFromContact(activeContactDossier)}
                    type="button"
                  >
                    <Plus size={16} />
                    {creatingMatterFromContactId === activeContactDossier.contact.id
                      ? "Creating..."
                      : "Matter"}
                  </button>
                </span>
              </div>
              <p className="detail-note">
                {activeContactDossier.contact.kind} ·{" "}
                {compactStatus(activeContactDossier.contact.status ?? "active")} ·{" "}
                {(activeContactDossier.contact.roleCategories ?? [])
                  .map(compactStatus)
                  .join(", ") || "no role category"}{" "}
                · {activeContactDossier.conflictHistory.length} conflict history{" "}
                {activeContactDossier.conflictHistory.length === 1 ? "entry" : "entries"}
              </p>
              <div className="detail-grid compact-detail-grid">
                <div>
                  <span className="field-label">Structured name</span>
                  <strong>
                    {activeContactDossier.contact.kind === "organization"
                      ? [
                          activeContactDossier.contact.organizationLegalName,
                          activeContactDossier.contact.organizationOperatingName,
                          activeContactDossier.contact.organizationRegisteredName,
                        ]
                          .filter(Boolean)
                          .join(" / ") || activeContactDossier.contact.displayName
                      : [
                          activeContactDossier.contact.givenName,
                          activeContactDossier.contact.middleName,
                          activeContactDossier.contact.familyName,
                        ]
                          .filter(Boolean)
                          .join(" ") || activeContactDossier.contact.displayName}
                  </strong>
                </div>
                <div>
                  <span className="field-label">Aliases</span>
                  <strong>
                    {activeContactDossier.contact.aliases.length > 0
                      ? activeContactDossier.contact.aliases.join(", ")
                      : "none"}
                  </strong>
                </div>
                <div>
                  <span className="field-label">Former names</span>
                  <strong>
                    {(activeContactDossier.contact.formerNames ?? []).length > 0
                      ? activeContactDossier.contact.formerNames?.join(", ")
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
                  <span className="field-label">Preferred language</span>
                  <strong>{activeContactDossier.contact.preferredLanguage ?? "not set"}</strong>
                </div>
                <div>
                  <span className="field-label">Confidentiality</span>
                  <strong>
                    {compactStatus(
                      activeContactDossier.contact.confidentialityMarker ?? "standard",
                    )}
                  </strong>
                </div>
                <div>
                  <span className="field-label">Risk flags</span>
                  <strong>
                    {(activeContactDossier.contact.riskFlags ?? []).length > 0
                      ? activeContactDossier.contact.riskFlags?.join(", ")
                      : activeContactDossier.contact.conflictSensitive
                        ? "conflict-sensitive"
                        : activeContactDossier.contact.doNotContact
                          ? "do not contact"
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
                      ? activeContactDossier.portal.permissionLabels.map(compactStatus).join(", ")
                      : "none"}
                  </strong>
                </div>
                <div>
                  <span className="field-label">CRM labels</span>
                  <strong>
                    {activeContactDossier.crmTaxonomy.labels
                      .map((label) => compactStatus(label.label))
                      .join(", ")}
                  </strong>
                </div>
                <div>
                  <span className="field-label">Related matters</span>
                  <strong>{activeContactDossier.crmTaxonomy.relatedMatterSummary.total}</strong>
                </div>
                <div>
                  <span className="field-label">Graph review</span>
                  <strong>
                    {activeContactDossier.crmTaxonomy.relationshipSummary.reviewNeededCount}
                  </strong>
                </div>
              </div>

              <div className="section-title">
                <h3>Contact methods</h3>
                <span>{activeContactDossier.contact.contactMethods?.length ?? 0}</span>
              </div>
              <div className="party-list">
                {(activeContactDossier.contact.contactMethods ?? []).map((method) => (
                  <div className="party-row" key={method.id}>
                    <span>
                      <strong>
                        {method.type === "address"
                          ? [
                              method.address?.line1,
                              method.address?.city,
                              method.address?.postalCode,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : method.value}
                      </strong>
                      <small>
                        {[method.type, method.label, method.verificationStatus ?? "unverified"]
                          .filter(Boolean)
                          .map(compactStatus)
                          .join(" · ")}
                      </small>
                    </span>
                    <em className={method.doNotContact ? "risk" : undefined}>
                      {method.preferred ? "preferred" : method.doNotContact ? "do not contact" : ""}
                    </em>
                  </div>
                ))}
                {(activeContactDossier.contact.contactMethods ?? []).length === 0 ? (
                  <p className="inline-empty">No structured contact methods recorded.</p>
                ) : null}
              </div>

              <div className="section-title">
                <h3>Relationship graph</h3>
                <span>{activeContactDossier.relationships.length}</span>
              </div>
              <div className="party-list">
                {activeContactDossier.relationships.map((relationship) => (
                  <div className="party-row" key={relationship.id}>
                    <span>
                      <strong>{relationship.relatedContact.displayName}</strong>
                      <small>
                        {[
                          relationship.relatedContact.kind,
                          relationship.conflictSafeLabel,
                          relationship.direction,
                          relationship.source,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      <small>
                        {relationship.visibleMatterIds.length > 0
                          ? relationship.visibleMatterIds.join(" · ")
                          : "contact-level"}
                      </small>
                      <small>
                        {[
                          relationship.effectiveOn ? `from ${relationship.effectiveOn}` : null,
                          relationship.endedOn ? `ended ${relationship.endedOn}` : null,
                          relationship.includeInConflictCheck ? "conflict included" : "excluded",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <em className={relationship.status === "review_needed" ? "risk" : undefined}>
                      {compactStatus(relationship.status)}
                    </em>
                  </div>
                ))}
                {activeContactDossier.relationships.length === 0 ? (
                  <p className="inline-empty">No visible contact relationships.</p>
                ) : null}
              </div>

              <div className="section-title">
                <h3>Conflict history</h3>
                <span>{activeContactDossier.conflictHistory.length}</span>
              </div>
              <div className="party-list">
                {activeContactDossier.conflictHistory.map((entry) => (
                  <div className="party-row" key={`${entry.matchedContactId}-${entry.id}`}>
                    <span>
                      <strong>
                        {entry.matchCount} redacted match
                        {entry.matchCount === 1 ? "" : "es"}
                      </strong>
                      <small>
                        {[entry.createdAt, ...entry.visibleMatchedMatterIds]
                          .filter(Boolean)
                          .join(" · ") || "contact-level"}
                      </small>
                    </span>
                    <em className={entry.maxSeverity === "blocker" ? "risk" : undefined}>
                      {entry.disposition} / {entry.maxSeverity}
                    </em>
                  </div>
                ))}
                {activeContactDossier.conflictHistory.length === 0 ? (
                  <p className="inline-empty">No redacted conflict history.</p>
                ) : null}
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
                    onClick={() => onSelectMatter(link.matterId)}
                    type="button"
                  >
                    <span>
                      <strong>{link.matterTitle}</strong>
                      <small>
                        {link.matterNumber} · {link.practiceArea} ·{" "}
                        {formatMatterPartyRoleLabel(link.role)}
                      </small>
                      <small>
                        {[
                          link.status ?? "active",
                          link.side,
                          link.startedOn ? `from ${link.startedOn}` : null,
                          link.endedOn ? `ended ${link.endedOn}` : null,
                          link.conflictCheckIncluded === false
                            ? "conflict excluded"
                            : "conflict included",
                        ]
                          .filter(Boolean)
                          .map(String)
                          .join(" · ")}
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
                {activeContactDossier.matters.length === 0 ? (
                  <p className="inline-empty">
                    No linked matters yet. Create a matter from this contact when one is needed.
                  </p>
                ) : null}
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
                <span>{contactDataQualityStatus}</span>
              </div>
              <div className="party-list">
                {activeContactDossier.qualityReview.signals.map((signal, index) => {
                  const signalKey = contactDataQualitySignalKey(
                    activeContactDossier.contact.id,
                    signal,
                  );
                  const latestResolution = latestContactDataQualityResolutionForSignal(
                    contactDataQualityResolutions,
                    activeContactDossier.contact.id,
                    signal,
                  );
                  return (
                    <div
                      className="party-row"
                      key={`${activeContactDossier.contact.id}-quality-${index}`}
                    >
                      <span>
                        <strong>{signal.reason}</strong>
                        <small>
                          {[signal.matchedOn, signal.matterId, signal.changedAt]
                            .filter(Boolean)
                            .join(" · ") || "contact-level"}
                        </small>
                        {summarizeContactDuplicateReviewCue(signal) ? (
                          <small>{summarizeContactDuplicateReviewCue(signal)}</small>
                        ) : null}
                        {latestResolution ? (
                          <small>
                            Latest decision:{" "}
                            {formatContactDataQualityResolutionDecision(latestResolution.decision)}{" "}
                            · {latestResolution.recordedAt}
                          </small>
                        ) : null}
                        {canRecordContactDataQualityResolution ? (
                          <span className="row-actions contact-resolution-actions">
                            {contactDataQualityResolutionActions[signal.kind].map((action) => (
                              <button
                                className="secondary-button compact-button row-button"
                                disabled={recordingContactResolutionKey === signalKey}
                                key={`${signalKey}-${action.decision}`}
                                onClick={() =>
                                  onRecordContactDataQualityResolution(signal, action.decision)
                                }
                                type="button"
                              >
                                {action.decision === "needs_follow_up" ||
                                action.decision === "revalidation_requested" ? (
                                  <ClipboardCheck size={14} aria-hidden="true" />
                                ) : (
                                  <Check size={14} aria-hidden="true" />
                                )}
                                {action.label}
                              </button>
                            ))}
                          </span>
                        ) : null}
                      </span>
                      <em className={signal.severity === "blocker" ? "risk" : undefined}>
                        {formatContactReviewSignalKind(signal.kind)}
                      </em>
                    </div>
                  );
                })}
                {activeContactDossier.qualityReview.signals.length === 0 ? (
                  <p className="inline-empty">No quality review signals.</p>
                ) : null}
              </div>

              <div className="section-title">
                <h3>Timeline activity</h3>
                <span>{contactTimelineStatus}</span>
              </div>
              <div className="calendar-attendee-form contact-timeline-filter-form">
                <label className="search-field">
                  <span>Activity filter</span>
                  <select
                    onChange={(event) =>
                      onContactTimelineActivityFilterChange(
                        event.currentTarget.value as ContactTimelineActivityFilter,
                      )
                    }
                    value={contactTimelineActivityFilter}
                  >
                    {contactTimelineActivityFilters.map((filter) => (
                      <option key={filter} value={filter}>
                        {contactTimelineActivityFilterLabels[filter]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="party-list">
                {timelineEntries.map((entry) => {
                  const cueType = contactTimelineCueValue(entry.metadata, "cueType");
                  const matterId = contactTimelineCueValue(entry.metadata, "matterId");
                  const dueAt = contactTimelineCueValue(entry.metadata, "dueAt");
                  const bucket = contactTimelineCueValue(entry.metadata, "bucket");
                  const status = contactTimelineCueValue(entry.metadata, "status");
                  const priority = contactTimelineCueValue(entry.metadata, "priority");
                  const assignmentScope = contactTimelineCueValue(
                    entry.metadata,
                    "assignmentScope",
                  );
                  const metadataLabels = contactTimelineMetadataLabels(entry, compactStatus);
                  const rowDetail =
                    entry.kind === "task"
                      ? [
                          matterId ? (matterNumberById.get(matterId) ?? "visible matter") : null,
                          dueAt,
                          bucket ? compactStatus(bucket) : null,
                          status ? compactStatus(status) : null,
                          priority ? compactStatus(priority) : null,
                          assignmentScope ? compactStatus(assignmentScope) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || entry.occurredAt
                      : [
                          entry.matterId
                            ? (matterNumberById.get(entry.matterId) ?? "visible matter")
                            : null,
                          entry.occurredAt,
                          compactStatus(entry.kind),
                          ...metadataLabels,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                  return (
                    <div className="party-row" key={entry.id}>
                      <span>
                        <strong>
                          {entry.kind === "task" ? contactTimelineCueLabel(cueType) : entry.title}
                        </strong>
                        <small>{rowDetail}</small>
                      </span>
                      <em className={priority === "high" ? "risk" : undefined}>
                        {entry.kind === "task" ? "review only" : compactStatus(entry.kind)}
                      </em>
                    </div>
                  );
                })}
                {timelineEntries.length === 0 ? (
                  <p className="inline-empty">No timeline activity matches this filter.</p>
                ) : null}
              </div>

              {canExportContactHistory ? (
                <div className="share-controls contact-history-export-controls">
                  <div className="section-title">
                    <h3>Contact-history export</h3>
                    <span>{contactHistoryExportStatus}</span>
                  </div>
                  <div className="calendar-attendee-form">
                    <label className="search-field contact-export-reason-field">
                      <span>Review reason</span>
                      <input
                        onChange={(event) =>
                          onContactHistoryExportReasonChange(event.currentTarget.value)
                        }
                        placeholder="Staff review reason"
                        value={contactHistoryExportReason}
                      />
                    </label>
                    <button
                      className="secondary-button"
                      disabled={
                        exportingContactHistory || contactHistoryExportReason.trim().length < 8
                      }
                      onClick={onExportContactHistory}
                      type="button"
                    >
                      <Download size={16} aria-hidden="true" />
                      Export JSON
                    </button>
                  </div>
                  {contactHistoryExportSummary ? (
                    <p className="inline-empty">{contactHistoryExportSummary}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="section-title">
                <h3>Resolution history</h3>
                <span>{contactDataQualityResolutions.length}</span>
              </div>
              <div className="party-list">
                {contactDataQualityResolutions.map((resolution) => (
                  <div className="party-row" key={resolution.id}>
                    <span>
                      <strong>
                        {formatContactDataQualityResolutionDecision(resolution.decision)}
                      </strong>
                      <small>
                        {[
                          formatContactReviewSignalKind(resolution.signalKind),
                          resolution.matterId,
                          resolution.relatedContactId ? "related contact noted" : null,
                          resolution.sourceRecordId ? "source record noted" : null,
                          resolution.recordedAt,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <em>{resolution.recordedByUserId}</em>
                  </div>
                ))}
                {contactDataQualityResolutions.length === 0 ? (
                  <p className="inline-empty">No reviewer decisions recorded.</p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="inline-empty">No visible contact dossier is selected.</p>
          )}
        </section>
      </div>
    </>
  );
}
