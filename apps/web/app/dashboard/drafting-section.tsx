import { ArrowLeft, Clock3, Download, FilePenLine, Plus, Save, Sparkles, X } from "lucide-react";

import {
  draftMergeFields,
  extractDraftPlainText,
  formatDraftExportSize,
} from "../drafting-dashboard";
import DraftEditor from "../drafting/DraftEditor";
import type {
  AiOperationalProposalsResponse,
  DraftAssistRecordsResponse,
  DraftAssistStatusResponse,
  DraftExportResponse,
  DraftingDashboardResponse,
} from "../types";

type DashboardDraft = DraftingDashboardResponse["draftsByMatterId"][string][number];
type DashboardDraftAssistRecord = DraftAssistRecordsResponse["records"][number];
type DashboardDraftTemplate = DraftingDashboardResponse["templates"][number];
type DashboardDraftMergeField = (typeof draftMergeFields)[number];
type DashboardDraftExportFormat = DraftExportResponse["format"];

interface DraftingSectionProps {
  activeDraftAssistRecords: DashboardDraftAssistRecord[];
  activeDraftExports: DraftExportResponse[];
  activeDrafts: DashboardDraft[];
  aiOperationalProposals: AiOperationalProposalsResponse;
  aiOperationalProposalStatus: string;
  creatingTemplateId: string;
  drafting: DraftingDashboardResponse;
  draftAssistInstruction: string;
  draftAssistMessage: string;
  draftAssistStatus: DraftAssistStatusResponse;
  draftAssistTask: DashboardDraftAssistRecord["task"];
  draftEditorJson: DashboardDraft["editorJson"] | null;
  draftExportFormat: DashboardDraftExportFormat;
  draftExportTitle: string;
  draftHasChanges: boolean;
  draftMergeField: DashboardDraftMergeField;
  draftStatus: string;
  exportingDraftFormat: DashboardDraftExportFormat | "";
  queueingAiOperationalProposals: boolean;
  runningDraftAssist: boolean;
  savingDraft: boolean;
  selectedDraft?: DashboardDraft;
  onCloseDraftEditor: () => void;
  onCreateBlankDraft: () => void;
  onCreateDraftFromTemplate: (template: DashboardDraftTemplate) => void;
  onDraftAssistInstructionChange: (value: string) => void;
  onDraftAssistTaskChange: (value: DashboardDraftAssistRecord["task"]) => void;
  onDraftEditorJsonChange: (value: DashboardDraft["editorJson"]) => void;
  onDraftExportFormatChange: (value: DashboardDraftExportFormat) => void;
  onDraftExportTitleChange: (value: string) => void;
  onDraftMergeFieldChange: (value: DashboardDraftMergeField) => void;
  onExportDraft: () => void;
  onInsertDraftAssistRecord: (record: DashboardDraftAssistRecord) => void;
  onInsertMergeField: () => void;
  onOpenDraft: (draft: DashboardDraft) => void;
  onQueueDraftOperationalProposals: () => void;
  onReviewDraftAssistRecord: (
    record: DashboardDraftAssistRecord,
    decision: "reviewed" | "rejected",
  ) => void;
  onRunDraftAssist: () => void;
  onSaveDraft: () => void;
}

export function DraftingSection({
  activeDraftAssistRecords,
  activeDraftExports,
  activeDrafts,
  aiOperationalProposals,
  aiOperationalProposalStatus,
  creatingTemplateId,
  drafting,
  draftAssistInstruction,
  draftAssistMessage,
  draftAssistStatus,
  draftAssistTask,
  draftEditorJson,
  draftExportFormat,
  draftExportTitle,
  draftHasChanges,
  draftMergeField,
  draftStatus,
  exportingDraftFormat,
  queueingAiOperationalProposals,
  runningDraftAssist,
  savingDraft,
  selectedDraft,
  onCloseDraftEditor,
  onCreateBlankDraft,
  onCreateDraftFromTemplate,
  onDraftAssistInstructionChange,
  onDraftAssistTaskChange,
  onDraftEditorJsonChange,
  onDraftExportFormatChange,
  onDraftExportTitleChange,
  onDraftMergeFieldChange,
  onExportDraft,
  onInsertDraftAssistRecord,
  onInsertMergeField,
  onOpenDraft,
  onQueueDraftOperationalProposals,
  onReviewDraftAssistRecord,
  onRunDraftAssist,
  onSaveDraft,
}: DraftingSectionProps) {
  if (selectedDraft && draftEditorJson) {
    return (
      <div className="draft-editor-panel">
        <div className="draft-editor-header">
          <button
            aria-label="Back to matter drafts"
            className="icon-button"
            onClick={onCloseDraftEditor}
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
            onClick={onSaveDraft}
            type="button"
          >
            <Save size={16} />
            {savingDraft ? "Saving..." : "Save"}
          </button>
        </div>
        <DraftEditor
          key={selectedDraft.id}
          content={draftEditorJson}
          onChange={onDraftEditorJsonChange}
        />
        <div className="draft-office-panel">
          <div className="section-title">
            <h3>Office output</h3>
            <span>{activeDraftExports.length} exports</span>
          </div>
          <div className="draft-office-controls">
            <label>
              <span>Merge field</span>
              <select
                value={draftMergeField}
                onChange={(event) =>
                  onDraftMergeFieldChange(event.target.value as DashboardDraftMergeField)
                }
              >
                {draftMergeFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button compact-button"
              onClick={onInsertMergeField}
              type="button"
            >
              <Plus size={16} />
              Insert
            </button>
            <label>
              <span>Export title</span>
              <input
                value={draftExportTitle}
                onChange={(event) => onDraftExportTitleChange(event.target.value)}
                placeholder={selectedDraft.title}
              />
            </label>
            <label>
              <span>Format</span>
              <select
                value={draftExportFormat}
                onChange={(event) =>
                  onDraftExportFormatChange(event.target.value as DashboardDraftExportFormat)
                }
              >
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
              </select>
            </label>
            <button
              className="secondary-button compact-button"
              disabled={draftHasChanges || exportingDraftFormat.length > 0}
              onClick={onExportDraft}
              type="button"
            >
              <Download size={16} />
              {exportingDraftFormat ? "Exporting..." : "Export"}
            </button>
          </div>
          {draftHasChanges ? (
            <p className="inline-empty">Save draft changes before exporting.</p>
          ) : null}
          <div className="party-list">
            {activeDraftExports.map((record) => (
              <div className="party-row draft-export-row" key={record.generatedDocument.id}>
                <span>
                  <strong>{record.title}</strong>
                  <small>
                    {record.format.toUpperCase()} · {formatDraftExportSize(record.byteLength)} ·{" "}
                    {record.document.title}
                  </small>
                  <small>checksum {record.checksumSha256.slice(0, 12)}...</small>
                </span>
                <em>{record.document.scanStatus}</em>
              </div>
            ))}
            {activeDraftExports.length === 0 ? (
              <p className="inline-empty">No exports created for this draft.</p>
            ) : null}
          </div>
        </div>
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
                  onDraftAssistTaskChange(event.target.value as DashboardDraftAssistRecord["task"])
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
                onChange={(event) => onDraftAssistInstructionChange(event.target.value)}
                placeholder="Optional review instruction"
              />
            </label>
            <button
              className="secondary-button compact-button"
              disabled={draftAssistStatus.status !== "configured" || runningDraftAssist}
              onClick={onRunDraftAssist}
              type="button"
            >
              <Sparkles size={16} />
              {runningDraftAssist ? "Drafting..." : "Assist"}
            </button>
            <button
              className="secondary-button compact-button"
              disabled={
                aiOperationalProposals.generation.status !== "configured" ||
                queueingAiOperationalProposals
              }
              onClick={onQueueDraftOperationalProposals}
              type="button"
            >
              <Clock3 size={16} />
              {queueingAiOperationalProposals ? "Queueing..." : "Queue proposals"}
            </button>
          </div>
          <p className="inline-empty">{draftAssistMessage}</p>
          <p className="inline-empty">{aiOperationalProposalStatus}</p>
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
                    onClick={() => onReviewDraftAssistRecord(record, "reviewed")}
                    type="button"
                  >
                    Review
                  </button>
                  <button
                    className="secondary-button compact-button"
                    onClick={() => onInsertDraftAssistRecord(record)}
                    type="button"
                  >
                    Insert
                  </button>
                  <button
                    aria-label="Reject assist suggestion"
                    className="icon-button"
                    onClick={() => onReviewDraftAssistRecord(record, "rejected")}
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
    );
  }

  return (
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
            onClick={onCreateBlankDraft}
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
              onClick={() => onCreateDraftFromTemplate(template)}
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
            onClick={() => onOpenDraft(draft)}
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
  );
}
