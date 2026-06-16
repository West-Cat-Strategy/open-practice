"use client";

import type {
  EmailTemplateDraftItem,
  EmailTemplatePreviewSnapshotItem,
} from "../_features/email-templates/models";

export interface EmailTemplateDraftFormState {
  id?: string;
  name: string;
  category: string;
  templateKey: string;
  from: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  recipientHints: string;
}

export interface EmailTemplateDraftsPanelProps {
  activeMatterId?: string;
  templateDrafts: EmailTemplateDraftItem[];
  selectedTemplateDraftId?: string;
  form: EmailTemplateDraftFormState;
  previewSnapshots: EmailTemplatePreviewSnapshotItem[];
  status?: string;
  saving: boolean;
  previewing: boolean;
  onSelectDraft: (templateDraftId: string) => void;
  onNewDraft: () => void;
  onFieldChange: (field: keyof EmailTemplateDraftFormState, value: string) => void;
  onSaveDraft: () => void;
  onCreatePreviewSnapshot: () => void;
}

function compactDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function EmailTemplateDraftsPanel({
  activeMatterId,
  templateDrafts,
  selectedTemplateDraftId,
  form,
  previewSnapshots,
  status,
  saving,
  previewing,
  onSelectDraft,
  onNewDraft,
  onFieldChange,
  onSaveDraft,
  onCreatePreviewSnapshot,
}: EmailTemplateDraftsPanelProps) {
  const selectedDraft = templateDrafts.find((draft) => draft.id === selectedTemplateDraftId);
  const canSave =
    form.name.trim().length > 0 &&
    form.templateKey.trim().length > 0 &&
    form.subject.trim().length > 0 &&
    (form.textBody.trim().length > 0 || form.htmlBody.trim().length > 0);

  return (
    <section className="activity-card email-template-drafts-panel" aria-label="Email templates">
      <div className="section-title">
        <h3>Email templates</h3>
        <span>{templateDrafts.length} saved</span>
      </div>
      <div className="upload-create-grid">
        <div className="party-list">
          {templateDrafts.map((draft) => (
            <button
              className="party-row row-button"
              key={draft.id}
              onClick={() => onSelectDraft(draft.id)}
              type="button"
            >
              <span>
                <strong>{draft.name}</strong>
                <small>
                  {draft.category} · {draft.templateKey} · v{draft.version}
                </small>
              </span>
              <em>{draft.id === selectedTemplateDraftId ? "selected" : draft.status}</em>
            </button>
          ))}
          {templateDrafts.length === 0 ? (
            <p className="inline-empty">No saved email templates.</p>
          ) : null}
          <button className="secondary-button compact-button" onClick={onNewDraft} type="button">
            New draft
          </button>
        </div>

        <div className="party-list">
          <label className="search-field compact">
            <span>Name</span>
            <input
              onChange={(event) => onFieldChange("name", event.target.value)}
              value={form.name}
            />
          </label>
          <label className="search-field compact">
            <span>Category</span>
            <input
              onChange={(event) => onFieldChange("category", event.target.value)}
              value={form.category}
            />
          </label>
          <label className="search-field compact">
            <span>Template key</span>
            <input
              onChange={(event) => onFieldChange("templateKey", event.target.value)}
              value={form.templateKey}
            />
          </label>
          <label className="search-field compact">
            <span>From</span>
            <input
              onChange={(event) => onFieldChange("from", event.target.value)}
              value={form.from}
            />
          </label>
          <label className="search-field compact">
            <span>Subject</span>
            <input
              onChange={(event) => onFieldChange("subject", event.target.value)}
              value={form.subject}
            />
          </label>
          <label className="search-field compact">
            <span>Recipient hints</span>
            <input
              onChange={(event) => onFieldChange("recipientHints", event.target.value)}
              value={form.recipientHints}
            />
          </label>
          <label className="search-field compact">
            <span>Text body</span>
            <textarea
              onChange={(event) => onFieldChange("textBody", event.target.value)}
              rows={4}
              value={form.textBody}
            />
          </label>
          <label className="search-field compact">
            <span>HTML body</span>
            <textarea
              onChange={(event) => onFieldChange("htmlBody", event.target.value)}
              rows={4}
              value={form.htmlBody}
            />
          </label>
          <div className="button-row">
            <button
              className="primary-button compact-button"
              disabled={!canSave || saving}
              onClick={onSaveDraft}
              type="button"
            >
              {saving ? "Saving" : "Save draft"}
            </button>
            <button
              className="secondary-button compact-button"
              disabled={!activeMatterId || !selectedDraft || previewing}
              onClick={onCreatePreviewSnapshot}
              type="button"
            >
              {previewing ? "Saving snapshot" : "Save snapshot"}
            </button>
          </div>
          {status ? <p className="inline-empty">{status}</p> : null}
        </div>
      </div>

      <div className="section-title">
        <h3>Preview snapshots</h3>
        <span>{previewSnapshots.length} recent</span>
      </div>
      <div className="party-list">
        {previewSnapshots.map((snapshot) => (
          <div className="party-row" key={snapshot.id}>
            <span>
              <strong>{snapshot.subjectPreview}</strong>
              <small>
                {snapshot.templateKey} · {snapshot.recipientSummary.recipientCount} recipients ·{" "}
                {compactDate(snapshot.createdAt)}
              </small>
              {snapshot.warnings.length > 0 ? <small>{snapshot.warnings.join(", ")}</small> : null}
            </span>
            <em>{snapshot.delivery.queued ? "queued" : "snapshot"}</em>
          </div>
        ))}
        {previewSnapshots.length === 0 ? (
          <p className="inline-empty">No saved preview snapshots for this matter.</p>
        ) : null}
      </div>
    </section>
  );
}
