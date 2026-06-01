import { Check, X } from "lucide-react";
import type { LegalResearchArtifactRecord } from "@open-practice/domain";
import type { LegalResearchWorkspaceResponse } from "../types";
import {
  formatLegalResearchValue,
  summarizeLegalResearchWorkspaceStatus,
} from "../legal-research-dashboard";

export interface ResearchSectionProps {
  canReview: boolean;
  compactDate: (value?: string) => string;
  onReviewArtifact: (
    artifact: LegalResearchArtifactRecord,
    decision: "reviewed" | "rejected",
  ) => void;
  reviewBusyId?: string;
  reviewStatus: string;
  workspace: LegalResearchWorkspaceResponse;
}

function artifactDetail(artifact: LegalResearchArtifactRecord): string {
  if (artifact.documentAnalysis) {
    return `${formatLegalResearchValue(artifact.documentAnalysis.status)} · ${formatLegalResearchValue(
      artifact.documentAnalysis.extractionStatus,
    )}`;
  }
  if (artifact.timeline) {
    return `${formatLegalResearchValue(artifact.timeline.noteType)} · ${artifact.timeline.dueAt ?? artifact.timeline.eventDate ?? "undated"}`;
  }
  if (artifact.checkpoint) {
    return `${formatLegalResearchValue(artifact.checkpoint.checkpointType)} · ${
      artifact.checkpoint.assignedUserId ?? "unassigned"
    }`;
  }
  return `${artifact.sourceReferences.length} sources · ${artifact.contextLinks.length} context links`;
}

export function ResearchSection({
  canReview,
  compactDate,
  onReviewArtifact,
  reviewBusyId = "",
  reviewStatus,
  workspace,
}: ResearchSectionProps) {
  const readyArtifacts = workspace.artifacts.filter(
    (artifact) => artifact.status === "ready_for_review",
  );

  return (
    <>
      <div className="section-title">
        <h3>Research workspace</h3>
        <span>{summarizeLegalResearchWorkspaceStatus(workspace)}</span>
      </div>
      <div className="detail-grid compact-detail-grid">
        <div>
          <span className="field-label">Artifacts</span>
          <strong>{workspace.summary.total}</strong>
          <small>{workspace.summary.readyForReview} ready</small>
        </div>
        <div>
          <span className="field-label">Source notes</span>
          <strong>{workspace.summary.byKind.cited_source_note}</strong>
          <small>{workspace.summary.sourceReferenceCount} source references</small>
        </div>
        <div>
          <span className="field-label">Analysis</span>
          <strong>{workspace.summary.documentAnalysisCount}</strong>
          <small>{workspace.summary.contextLinkCount} context links</small>
        </div>
        <div>
          <span className="field-label">Provider</span>
          <strong>{formatLegalResearchValue(workspace.provider.status)}</strong>
          <small>Staff-authored review artifacts</small>
        </div>
      </div>
      <p className="inline-empty" role="status" aria-live="polite" aria-atomic="true">
        {reviewStatus}
      </p>
      <div className="party-list">
        {workspace.artifacts.map((artifact) => {
          const busy = reviewBusyId === artifact.id;
          const showReviewControls =
            canReview && artifact.status === "ready_for_review" && workspace.status === "available";
          return (
            <div className="party-row" key={artifact.id}>
              <span>
                <strong>{artifact.title}</strong>
                <small>
                  {formatLegalResearchValue(artifact.kind)} ·{" "}
                  {formatLegalResearchValue(artifact.status)} · {compactDate(artifact.updatedAt)}
                </small>
                <small>{artifactDetail(artifact)}</small>
                {artifact.note ? <small>{artifact.note}</small> : null}
              </span>
              {showReviewControls ? (
                <div className="draft-assist-actions">
                  <button
                    className="secondary-button compact-button"
                    disabled={busy}
                    onClick={() => onReviewArtifact(artifact, "reviewed")}
                    type="button"
                  >
                    <Check size={16} />
                    {busy ? "Saving" : "Review"}
                  </button>
                  <button
                    className="secondary-button compact-button"
                    disabled={busy}
                    onClick={() => onReviewArtifact(artifact, "rejected")}
                    type="button"
                  >
                    <X size={16} />
                    Reject
                  </button>
                </div>
              ) : (
                <em className={artifact.status === "rejected" ? "risk" : undefined}>
                  {formatLegalResearchValue(artifact.status)}
                </em>
              )}
            </div>
          );
        })}
        {workspace.artifacts.length === 0 ? (
          <p className="inline-empty">No research artifacts are linked to this matter.</p>
        ) : null}
      </div>
      {readyArtifacts.length === 0 ? null : (
        <p className="inline-empty">
          {readyArtifacts.length} research artifacts await staff review.
        </p>
      )}
    </>
  );
}
