import { Search } from "lucide-react";
import { contactDossierRiskClass, summarizeContactDossier } from "../contact-dossiers-dashboard";
import { formatMatterPartyRoleLabel } from "../participant-role-labels";
import type { ContactDossier, ContactDossiersResponse } from "../types";

export function ContactsSection({
  activeContactDossier,
  compactStatus,
  contactDossiers,
  contactSearch,
  filteredContactDossiers,
  onContactSearchChange,
  onPrepareConflictCheckFromContact,
  onSelectContact,
  onSelectMatter,
}: {
  activeContactDossier?: ContactDossier;
  compactStatus: (value?: string) => string;
  contactDossiers: ContactDossiersResponse;
  contactSearch: string;
  filteredContactDossiers: ContactDossiersResponse;
  onContactSearchChange: (value: string) => void;
  onPrepareConflictCheckFromContact: () => void;
  onSelectContact: (contactId: string) => void;
  onSelectMatter: (matterId: string) => void;
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
  );
}
