import type {
  LegalResearchArtifactRecord,
  LegalResearchContextResourceType,
  LegalResearchSourceType,
  User,
} from "@open-practice/domain";
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

export function buildLegalResearchProviderJobPath(): string {
  return "/api/legal-research/provider-jobs";
}

const legalResearchSourceTypes = [
  "case_law",
  "statute",
  "regulation",
  "policy",
  "secondary_source",
  "internal_note",
  "unknown",
] as const satisfies LegalResearchSourceType[];

const legalResearchContextResourceTypes = [
  "matter",
  "document",
  "draft",
  "contact",
  "task",
  "calendar_event",
  "intake_session",
] as const satisfies LegalResearchContextResourceType[];

function emptyLegalResearchCitationPacketReadiness(): LegalResearchWorkspaceResponse["citationPacketReadiness"] {
  return {
    sourceReferenceCount: 0,
    sourceReferenceCountsByType: Object.fromEntries(
      legalResearchSourceTypes.map((sourceType) => [sourceType, 0]),
    ) as Record<LegalResearchSourceType, number>,
    readyForReviewArtifactCount: 0,
    readyForReviewArtifactIds: [],
    openCheckpointCount: 0,
    openCheckpointArtifactIds: [],
    contextLinkCount: 0,
    contextLinkCountsByType: Object.fromEntries(
      legalResearchContextResourceTypes.map((resourceType) => [resourceType, 0]),
    ) as Record<LegalResearchContextResourceType, number>,
    staffReviewReady: false,
    blockedReasons: ["no_source_references", "no_ready_for_review_artifacts"],
    reservedProviderJobPosture: "reserved_no_provider_execution",
    providerExecuted: false,
    authorityScraped: false,
    sourceTextStored: false,
    promptStored: false,
    providerEvidenceStored: false,
    citationVerificationClaimed: false,
    legalAdviceGenerated: false,
    downstreamMutation: false,
    reviewOnly: true,
  };
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
    citationReview: {
      staffReviewRequired: true,
      citationVerificationClaims: false,
      providerEvidenceStored: false,
      sourceTextSubmittedToProvider: false,
      promptSubmittedToProvider: false,
      downstreamMutation: false,
      reviewOnly: true,
    },
    provider: {
      status: "disabled",
      reason: "not_configured",
      liveResearchProvider: false,
    },
    providerJobBoundary: {
      queueName: "ai_triage",
      jobName: "legal_research_provider_review",
      status: "reserved",
      reason: "deferred_worker",
      providerConfigured: false,
      liveResearchProvider: false,
      reviewOnly: true,
    },
    providerJobs: [],
    providerJobSummary: {
      total: 0,
      queued: 0,
      active: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      deadLetter: 0,
      reviewOnly: true,
    },
    citationPacketReadiness: emptyLegalResearchCitationPacketReadiness(),
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
    citationPacketReadiness: summarizeLegalResearchCitationPacketReadiness(artifacts),
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

function summarizeLegalResearchCitationPacketReadiness(
  artifacts: LegalResearchArtifactRecord[],
): LegalResearchWorkspaceResponse["citationPacketReadiness"] {
  const readiness = emptyLegalResearchCitationPacketReadiness();
  readiness.blockedReasons = [];
  for (const artifact of artifacts) {
    readiness.sourceReferenceCount += artifact.sourceReferences.length;
    readiness.contextLinkCount += artifact.contextLinks.length;
    for (const source of artifact.sourceReferences) {
      readiness.sourceReferenceCountsByType[source.sourceType] += 1;
    }
    for (const link of artifact.contextLinks) {
      readiness.contextLinkCountsByType[link.resourceType] += 1;
    }
    if (artifact.status === "ready_for_review") {
      readiness.readyForReviewArtifactIds.push(artifact.id);
    }
    if (artifact.checkpoint && !["reviewed", "rejected"].includes(artifact.status)) {
      readiness.openCheckpointArtifactIds.push(artifact.id);
    }
  }
  readiness.readyForReviewArtifactCount = readiness.readyForReviewArtifactIds.length;
  readiness.openCheckpointCount = readiness.openCheckpointArtifactIds.length;
  if (readiness.sourceReferenceCount === 0) readiness.blockedReasons.push("no_source_references");
  if (readiness.readyForReviewArtifactCount === 0) {
    readiness.blockedReasons.push("no_ready_for_review_artifacts");
  }
  if (readiness.openCheckpointCount > 0) readiness.blockedReasons.push("open_checkpoints");
  readiness.staffReviewReady = readiness.blockedReasons.length === 0;
  return readiness;
}

export function summarizeLegalResearchWorkspaceStatus(
  workspace: LegalResearchWorkspaceResponse,
): string {
  if (workspace.status === "access_denied") return "Research workspace is not available.";
  if (workspace.status === "unavailable") return "Research workspace is unavailable.";
  return `${workspace.summary.total} artifacts · ${workspace.summary.readyForReview} ready · ${workspace.providerJobSummary.total} provider jobs`;
}

export function formatLegalResearchValue(value?: string): string {
  return value ? value.replaceAll("_", " ") : "none";
}

export function describeLegalResearchDocumentAnalysisDecision(
  artifact: LegalResearchArtifactRecord,
  compactDate: (value?: string) => string = (value?: string) => value ?? "none",
): string | undefined {
  if (artifact.kind !== "document_analysis_status") return undefined;
  const decision =
    artifact.reviewDecision === "reviewed" || artifact.reviewDecision === "rejected"
      ? artifact.reviewDecision
      : artifact.status === "reviewed" || artifact.status === "rejected"
        ? artifact.status
        : undefined;
  if (!decision || !artifact.reviewedAt || !artifact.reviewedByUserId) return undefined;
  return [
    `latest decision ${formatLegalResearchValue(decision)} at ${compactDate(artifact.reviewedAt)}`,
    `reviewer ${artifact.reviewedByUserId}`,
    `artifact ${formatLegalResearchValue(artifact.documentAnalysis?.artifactStatus ?? "metadata_only")}`,
    "metadata only",
    artifact.reviewOnly ? "review only" : undefined,
    "no downstream mutation",
    "no provider evidence",
    "no raw OCR returned",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function canReviewLegalResearch(role: User["role"]): boolean {
  return ["owner_admin", "licensee", "firm_member"].includes(role);
}
