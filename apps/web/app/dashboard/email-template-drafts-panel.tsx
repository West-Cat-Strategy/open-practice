"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compareEmailTemplateDraftWithPublishedVersion,
  type EmailTemplateComparisonField,
  type EmailTemplateDraftPublishedVersionComparison,
} from "@open-practice/domain/email-template-draft-comparison";
import type {
  EmailTemplateDraftItem,
  EmailTemplatePublishedVersionItem,
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
  publishedVersions: EmailTemplatePublishedVersionItem[];
  status?: string;
  saving: boolean;
  previewing: boolean;
  publishing: boolean;
  onSelectDraft: (templateDraftId: string) => void;
  onNewDraft: () => void;
  onFieldChange: (field: keyof EmailTemplateDraftFormState, value: string) => void;
  onSaveDraft: () => void;
  onCreatePreviewSnapshot: () => void;
  onPublishDraft: () => void;
}

function compactDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function newestPublishedVersion(
  versions: EmailTemplatePublishedVersionItem[],
): EmailTemplatePublishedVersionItem | undefined {
  return versions.reduce<EmailTemplatePublishedVersionItem | undefined>((latest, version) => {
    if (!latest) return version;
    if (version.version !== latest.version) {
      return version.version > latest.version ? version : latest;
    }
    return Date.parse(version.publishedAt) > Date.parse(latest.publishedAt) ? version : latest;
  }, undefined);
}

function compareValueLabel(value: EmailTemplateComparisonField["draftValue"]): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "(none)";
  if (value === undefined || value.trim().length === 0) return "(empty)";
  return value;
}

function isEmailTemplateBodyComparisonField(
  field: EmailTemplateComparisonField,
): field is EmailTemplateComparisonField & { field: "textBody" | "htmlBody" } {
  return field.field === "textBody" || field.field === "htmlBody";
}

function bodyComparisonContentTypeLabel(field: "textBody" | "htmlBody"): string {
  return field === "textBody" ? "text/plain" : "text/html";
}

function bodyComparisonLength(value: EmailTemplateComparisonField["draftValue"]): number {
  return typeof value === "string" ? value.length : 0;
}

function bodyComparisonPresence(value: EmailTemplateComparisonField["draftValue"]): string {
  return bodyComparisonLength(value) > 0 ? "present" : "absent";
}

export function EmailTemplateDraftsPanel({
  activeMatterId,
  templateDrafts,
  selectedTemplateDraftId,
  form,
  previewSnapshots,
  publishedVersions,
  status,
  saving,
  previewing,
  publishing,
  onSelectDraft,
  onNewDraft,
  onFieldChange,
  onSaveDraft,
  onCreatePreviewSnapshot,
  onPublishDraft,
}: EmailTemplateDraftsPanelProps) {
  const [selectedPublishedVersionId, setSelectedPublishedVersionId] = useState("");
  const selectedDraft = templateDrafts.find((draft) => draft.id === selectedTemplateDraftId);
  const matchingPublishedVersions = selectedDraft
    ? publishedVersions.filter(
        (version) =>
          version.firmId === selectedDraft.firmId && version.templateDraftId === selectedDraft.id,
      )
    : [];
  const latestPublishedVersion = newestPublishedVersion(matchingPublishedVersions);
  const selectedPublishedVersion =
    matchingPublishedVersions.find((version) => version.id === selectedPublishedVersionId) ??
    latestPublishedVersion;
  const comparison = useMemo<EmailTemplateDraftPublishedVersionComparison | undefined>(() => {
    if (!selectedDraft || !selectedPublishedVersion) return undefined;
    return compareEmailTemplateDraftWithPublishedVersion(selectedDraft, selectedPublishedVersion);
  }, [selectedDraft, selectedPublishedVersion]);
  const canSave =
    form.name.trim().length > 0 &&
    form.templateKey.trim().length > 0 &&
    form.subject.trim().length > 0 &&
    (form.textBody.trim().length > 0 || form.htmlBody.trim().length > 0);

  useEffect(() => {
    setSelectedPublishedVersionId(latestPublishedVersion?.id ?? "");
  }, [latestPublishedVersion?.id, selectedDraft?.id]);

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
            <button
              className="secondary-button compact-button"
              disabled={!selectedDraft || publishing}
              onClick={onPublishDraft}
              type="button"
            >
              {publishing ? "Publishing" : "Publish version"}
            </button>
          </div>
          {status ? <p className="inline-empty">{status}</p> : null}
        </div>
      </div>

      <div className="section-title">
        <h3>Version history</h3>
        <span>{matchingPublishedVersions.length} published</span>
      </div>
      <div className="party-list">
        {matchingPublishedVersions.map((version) => (
          <div className="party-row" key={version.id}>
            <span>
              <strong>
                v{version.version} · {version.name}
              </strong>
              <small>
                draft v{version.draftVersion} · {version.templateKey} ·{" "}
                {compactDate(version.publishedAt)}
              </small>
            </span>
            <em>published</em>
          </div>
        ))}
        {publishedVersions.length === 0 ? (
          <p className="inline-empty">No published template versions.</p>
        ) : null}
      </div>

      <div className="section-title">
        <h3>Compare saved draft</h3>
        <span>
          {comparison
            ? `draft v${comparison.draftVersion} vs published v${comparison.publishedVersion}`
            : "No published version selected"}
        </span>
      </div>
      {selectedDraft && matchingPublishedVersions.length > 0 ? (
        <div className="email-template-compare">
          <label className="search-field compact">
            <span>Compare version</span>
            <select
              onChange={(event) => setSelectedPublishedVersionId(event.target.value)}
              value={selectedPublishedVersion?.id ?? ""}
            >
              {matchingPublishedVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version} published {compactDate(version.publishedAt)}
                </option>
              ))}
            </select>
          </label>
          {comparison ? (
            <>
              <div className="party-row email-template-compare-summary">
                <span>
                  <strong>{comparison.changedFieldCount} changed fields</strong>
                  <small>
                    Saved draft v{comparison.draftVersion} compared with immutable published v
                    {comparison.publishedVersion}.
                  </small>
                </span>
                <em>{comparison.changedFieldCount === 0 ? "Same" : "Changed"}</em>
              </div>
              <div className="email-template-compare-grid">
                {comparison.fields.map((field) => (
                  <div className="party-row email-template-compare-row" key={field.field}>
                    {isEmailTemplateBodyComparisonField(field) ? (
                      <span>
                        <strong>{field.label}</strong>
                        <small>
                          {field.changed ? "Changed" : "Unchanged"} · Body content redacted;
                          metadata-only comparison
                        </small>
                        <small>
                          Saved draft · {bodyComparisonLength(field.draftValue)} characters ·{" "}
                          {bodyComparisonContentTypeLabel(field.field)}{" "}
                          {bodyComparisonPresence(field.draftValue)}
                        </small>
                        <small>
                          Published version · {bodyComparisonLength(field.publishedValue)}{" "}
                          characters · {bodyComparisonContentTypeLabel(field.field)}{" "}
                          {bodyComparisonPresence(field.publishedValue)}
                        </small>
                      </span>
                    ) : (
                      <span>
                        <strong>{field.label}</strong>
                        <small>Saved draft</small>
                        <pre>{compareValueLabel(field.draftValue)}</pre>
                        <small>Published version</small>
                        <pre>{compareValueLabel(field.publishedValue)}</pre>
                      </span>
                    )}
                    <em>{field.changed ? "Changed" : "Same"}</em>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className="inline-empty">
          Publish a template version to compare against the saved draft.
        </p>
      )}

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
