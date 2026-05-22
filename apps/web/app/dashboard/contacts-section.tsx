import { Check, ClipboardCheck, Search } from "lucide-react";
import {
  contactDataQualityResolutionActions,
  contactDataQualitySignalKey,
  contactDossierRiskClass,
  formatContactDataQualityResolutionDecision,
  contactReviewQueueRiskClass,
  formatContactReviewSignalKind,
  latestContactDataQualityResolutionForSignal,
  summarizeContactDossier,
  summarizeContactReviewQueueItem,
} from "../contact-dossiers-dashboard";
import { formatMatterPartyRoleLabel } from "../participant-role-labels";
import type {
  ContactDataQualityResolutionRecord,
  ContactDossier,
  ContactDossiersResponse,
  ContactReviewQueueResponse,
} from "../types";

export function ContactsSection({
  activeContactDossier,
  canRecordContactDataQualityResolution,
  compactStatus,
  contactDataQualityResolutions,
  contactDataQualityStatus,
  contactDossiers,
  contactReviewQueue,
  contactSearch,
  filteredContactDossiers,
  onRecordContactDataQualityResolution,
  onContactSearchChange,
  onPrepareConflictCheckFromContact,
  onSelectContact,
  onSelectMatter,
  recordingContactResolutionKey,
}: {
  activeContactDossier?: ContactDossier;
  canRecordContactDataQualityResolution: boolean;
  compactStatus: (value?: string) => string;
  contactDataQualityResolutions: ContactDataQualityResolutionRecord[];
  contactDataQualityStatus: string;
  contactDossiers: ContactDossiersResponse;
  contactReviewQueue?: ContactReviewQueueResponse;
  contactSearch: string;
  filteredContactDossiers: ContactDossiersResponse;
  onRecordContactDataQualityResolution: (
    signal: ContactDossier["qualityReview"]["signals"][number],
    decision: ContactDataQualityResolutionRecord["decision"],
  ) => void;
  onContactSearchChange: (value: string) => void;
  onPrepareConflictCheckFromContact: () => void;
  onSelectContact: (contactId: string) => void;
  onSelectMatter: (matterId: string) => void;
  recordingContactResolutionKey: string;
}) {
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
                <button
                  className="secondary-button compact-action-button"
                  onClick={onPrepareConflictCheckFromContact}
                  type="button"
                >
                  <Search size={16} />
                  Check this contact
                </button>
              </div>
              <p className="detail-note">
                {activeContactDossier.contact.kind} · {activeContactDossier.conflictHistory.length}{" "}
                conflict history{" "}
                {activeContactDossier.conflictHistory.length === 1 ? "entry" : "entries"}
              </p>
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
                      ? activeContactDossier.portal.permissionLabels.map(compactStatus).join(", ")
                      : "none"}
                  </strong>
                </div>
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
