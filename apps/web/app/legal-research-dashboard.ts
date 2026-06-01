import type { LegalResearchArtifactRecord, User } from "@open-practice/domain";
import type {
  LegalResearchDashboardResponse,
  LegalResearchWorkspaceResponse,
  MatterSummary,
} from "./types";

export function buildLegalResearchWorkspacePath(matterId: string): string {
  return `/api/legal-research/workspace?matterId=${encodeURIComponent(matterId)}`;
}

export function buildLegalResearchReviewPath(artifactId: string): string {
  return `/api/legal-research/artifacts/${encodeURIComponent(artifactId)}/review`;
}

export function emptyLegalResearchWorkspace(
  matterId: string,
  status: LegalResearchWorkspaceResponse["status"] = "unavailable",
): LegalResearchWorkspaceResponse {
  return {
    status,
    matterId,
    artifacts: [],
    summary: {
      total: 0,
      draft: 0,
      readyForReview: 0,
      reviewed: 0,
      rejected: 0,
      sourceReferenceCount: 0,
      contextLinkCount: 0,
      documentAnalysisCount: 0,
      strategyTimelineCount: 0,
      openCheckpointCount: 0,
      byKind: {
        cited_source_note: 0,
        matter_context_attachment: 0,
        document_analysis_status: 0,
        strategy_timeline_note: 0,
        review_checkpoint: 0,
      },
      reviewOnly: true,
    },
    policy: {
      liveResearchProvider: false,
      scrapedAuthorityStorage: false,
      automatedLegalAdvice: false,
      citationVerificationClaims: false,
      downstreamMutation: false,
    },
    provider: {
      status: "disabled",
      reason: "not_configured",
      liveResearchProvider: false,
    },
  };
}

export async function loadLegalResearchDashboardData(input: {
  matters: MatterSummary[];
  getWorkspace: (matterId: string) => Promise<LegalResearchWorkspaceResponse>;
}): Promise<LegalResearchDashboardResponse> {
  const entries = await Promise.all(
    input.matters.map(async (matter) => [matter.id, await input.getWorkspace(matter.id)] as const),
  );
  return { workbenchesByMatterId: Object.fromEntries(entries) };
}

export function replaceLegalResearchArtifact(
  workspace: LegalResearchWorkspaceResponse,
  artifact: LegalResearchArtifactRecord,
): LegalResearchWorkspaceResponse {
  const artifacts = workspace.artifacts.map((candidate) =>
    candidate.id === artifact.id ? artifact : candidate,
  );
  return {
    ...workspace,
    artifacts,
    summary: summarizeLegalResearchWorkspace(artifacts),
  };
}

function summarizeLegalResearchWorkspace(
  artifacts: LegalResearchArtifactRecord[],
): LegalResearchWorkspaceResponse["summary"] {
  const summary = emptyLegalResearchWorkspace("").summary;
  for (const artifact of artifacts) {
    summary.total += 1;
    summary.byKind[artifact.kind] += 1;
    summary.sourceReferenceCount += artifact.sourceReferences.length;
    summary.contextLinkCount += artifact.contextLinks.length;
    if (artifact.documentAnalysis) summary.documentAnalysisCount += 1;
    if (artifact.timeline) summary.strategyTimelineCount += 1;
    if (artifact.checkpoint && !["reviewed", "rejected"].includes(artifact.status)) {
      summary.openCheckpointCount += 1;
    }
    if (artifact.status === "draft") summary.draft += 1;
    else if (artifact.status === "ready_for_review") summary.readyForReview += 1;
    else if (artifact.status === "reviewed") summary.reviewed += 1;
    else summary.rejected += 1;
  }
  return summary;
}

export function summarizeLegalResearchWorkspaceStatus(
  workspace: LegalResearchWorkspaceResponse,
): string {
  if (workspace.status === "access_denied") return "Research workspace is not available.";
  if (workspace.status === "unavailable") return "Research workspace is unavailable.";
  return `${workspace.summary.total} artifacts · ${workspace.summary.readyForReview} ready · ${workspace.summary.openCheckpointCount} checkpoints`;
}

export function formatLegalResearchValue(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

export function canReviewLegalResearch(role: User["role"]): boolean {
  return ["owner_admin", "licensee", "firm_member"].includes(role);
}
