import { describe, expect, it } from "vitest";
import {
  buildLegalResearchCitationPacketDecisionPath,
  buildLegalResearchProviderJobPath,
  buildLegalResearchReviewPath,
  buildLegalResearchWorkspacePath,
  canReviewLegalResearch,
  describeLegalResearchDocumentAnalysisDecision,
  emptyLegalResearchWorkspace,
  replaceLegalResearchArtifact,
  summarizeLegalResearchWorkspaceStatus,
} from "./legal-research-dashboard";

describe("legal research dashboard helpers", () => {
  it("builds paths and disabled empty workspace posture", () => {
    const workspace = emptyLegalResearchWorkspace("matter 001", "access_denied");

    expect(buildLegalResearchWorkspacePath("matter 001")).toBe(
      "/api/legal-research/workspace?matterId=matter%20001",
    );
    expect(buildLegalResearchReviewPath("artifact 001")).toBe(
      "/api/legal-research/artifacts/artifact%20001/review",
    );
    expect(buildLegalResearchProviderJobPath()).toBe("/api/legal-research/provider-jobs");
    expect(buildLegalResearchCitationPacketDecisionPath()).toBe(
      "/api/legal-research/citation-packet-decisions",
    );
    expect(workspace.provider).toMatchObject({
      status: "disabled",
      reason: "not_configured",
      liveResearchProvider: false,
    });
    expect(workspace.citationReview).toMatchObject({
      staffReviewRequired: true,
      providerEvidenceStored: false,
      citationVerificationClaims: false,
      sourceTextSubmittedToProvider: false,
      promptSubmittedToProvider: false,
    });
    expect(workspace.providerJobBoundary).toMatchObject({
      queueName: "ai_triage",
      jobName: "legal_research_provider_review",
      status: "reserved",
      providerConfigured: false,
      liveResearchProvider: false,
    });
    expect(workspace.providerJobSummary.total).toBe(0);
    expect(workspace.citationPacketReadiness).toMatchObject({
      sourceReferenceCount: 0,
      readyForReviewArtifactCount: 0,
      openCheckpointCount: 0,
      contextLinkCount: 0,
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
    });
    expect(summarizeLegalResearchWorkspaceStatus(workspace)).toBe(
      "Research workspace is not available.",
    );
  });

  it("replaces reviewed artifacts and hides mutation permissions for auditors", () => {
    const workspace = emptyLegalResearchWorkspace("matter-001", "available");
    const artifact = {
      id: "legal-research-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "review_checkpoint" as const,
      status: "reviewed" as const,
      title: "Review checkpoint",
      sourceReferences: [],
      contextLinks: [],
      checkpoint: { checkpointType: "source_review" as const },
      reviewDecision: "reviewed" as const,
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-06-01T19:00:00.000Z",
      createdByUserId: "user-admin",
      createdAt: "2026-06-01T18:00:00.000Z",
      updatedAt: "2026-06-01T19:00:00.000Z",
      reviewOnly: true as const,
      metadata: {},
    };

    const updated = replaceLegalResearchArtifact(
      {
        ...workspace,
        artifacts: [
          {
            ...artifact,
            status: "ready_for_review",
            reviewDecision: undefined,
            reviewedByUserId: undefined,
            reviewedAt: undefined,
          },
        ],
      },
      artifact,
    );

    expect(updated.summary.reviewed).toBe(1);
    expect(updated.summary.openCheckpointCount).toBe(0);
    expect(updated.citationPacketReadiness).toMatchObject({
      sourceReferenceCount: 0,
      readyForReviewArtifactCount: 0,
      readyForReviewArtifactIds: [],
      openCheckpointCount: 0,
      staffReviewReady: false,
      blockedReasons: ["no_source_references", "no_ready_for_review_artifacts"],
      providerExecuted: false,
      citationVerificationClaimed: false,
      legalAdviceGenerated: false,
      downstreamMutation: false,
    });
    expect(canReviewLegalResearch("firm_member")).toBe(true);
    expect(canReviewLegalResearch("auditor")).toBe(false);
  });

  it("summarizes latest citation packet decisions without private metadata", () => {
    const workspace = emptyLegalResearchWorkspace("matter-001", "available");
    const sourceArtifact = {
      id: "legal-research-source-note-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "cited_source_note" as const,
      status: "ready_for_review" as const,
      title: "Source note",
      note: "Synthetic source note must not appear.",
      sourceReferences: [{ sourceType: "statute" as const, label: "Synthetic source label" }],
      contextLinks: [{ resourceType: "matter" as const, resourceId: "matter-001" }],
      createdByUserId: "user-admin",
      createdAt: "2026-06-30T16:00:00.000Z",
      updatedAt: "2026-06-30T16:00:00.000Z",
      reviewOnly: true as const,
      metadata: {},
    };
    const decisionArtifact = {
      id: "legal-research-citation-packet-decision-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "review_checkpoint" as const,
      status: "reviewed" as const,
      title: "Citation packet readiness decision",
      sourceReferences: [],
      contextLinks: [],
      checkpoint: { checkpointType: "source_review" as const, assignedUserId: "user-admin" },
      reviewDecision: "reviewed" as const,
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-06-30T17:00:00.000Z",
      createdByUserId: "user-admin",
      createdAt: "2026-06-30T17:00:00.000Z",
      updatedAt: "2026-06-30T17:00:00.000Z",
      reviewOnly: true as const,
      metadata: {
        source: "legal_research_citation_packet_decision",
        decision: "needs_source_review",
        decidedByUserId: "user-admin",
        decidedAt: "2026-06-30T17:00:00.000Z",
        sourceReferenceCount: 1,
        readyForReviewArtifactCount: 1,
        openCheckpointCount: 0,
        contextLinkCount: 1,
        prompt: "Synthetic prompt must not appear.",
        sourceText: "Synthetic source text must not appear.",
        providerEvidence: "Synthetic provider evidence must not appear.",
      },
    };

    const updated = replaceLegalResearchArtifact(
      { ...workspace, artifacts: [sourceArtifact, decisionArtifact] },
      decisionArtifact,
    );

    expect(updated.citationPacketReadiness.latestDecision).toMatchObject({
      artifactId: "legal-research-citation-packet-decision-001",
      decision: "needs_source_review",
      decidedByUserId: "user-admin",
      decidedAt: "2026-06-30T17:00:00.000Z",
      sourceReferenceCount: 1,
      readyForReviewArtifactCount: 1,
      openCheckpointCount: 0,
      metadataOnly: true,
      providerEvidenceStored: false,
      citationVerificationClaimed: false,
      legalAdviceGenerated: false,
      downstreamMutation: false,
    });
    expect(JSON.stringify(updated.citationPacketReadiness)).not.toContain(
      "Synthetic source note must not appear.",
    );
    expect(JSON.stringify(updated.citationPacketReadiness)).not.toContain("Synthetic source label");
    expect(JSON.stringify(updated.citationPacketReadiness)).not.toContain(
      "Synthetic prompt must not appear.",
    );
    expect(JSON.stringify(updated.citationPacketReadiness)).not.toContain(
      "Synthetic source text must not appear.",
    );
    expect(JSON.stringify(updated.citationPacketReadiness)).not.toContain(
      "Synthetic provider evidence must not appear.",
    );
  });

  it("describes terminal document-analysis decisions without artifact bodies", () => {
    const artifact = {
      id: "legal-research-document-analysis-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "document_analysis_status" as const,
      status: "reviewed" as const,
      title: "Document conversion review posture",
      note: "Synthetic raw OCR note must not be used.",
      sourceReferences: [],
      contextLinks: [{ resourceType: "document" as const, resourceId: "doc-001" }],
      documentAnalysis: {
        documentId: "doc-001",
        status: "ready_for_review" as const,
        extractionStatus: "completed" as const,
        artifactStatus: "metadata_only" as const,
        sourceTextLength: 47,
      },
      reviewDecision: "reviewed" as const,
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-06-27T14:05:00.000Z",
      createdByUserId: "user-admin",
      createdAt: "2026-06-27T13:00:00.000Z",
      updatedAt: "2026-06-27T14:05:00.000Z",
      reviewOnly: true as const,
      metadata: {
        rawOcrText: "Synthetic private text",
        providerPayload: { private: "Synthetic provider payload" },
        generatedSummary: "Synthetic generated summary",
      },
    };

    const description = describeLegalResearchDocumentAnalysisDecision(artifact);

    expect(description).toBe(
      "latest decision reviewed at 2026-06-27T14:05:00.000Z · reviewer user-admin · artifact metadata only · metadata only · review only · no downstream mutation · no provider evidence · no raw OCR returned",
    );
    expect(description).not.toContain("Synthetic raw OCR note");
    expect(description).not.toContain("Synthetic private text");
    expect(description).not.toContain("Synthetic provider payload");
    expect(description).not.toContain("Synthetic generated summary");
  });
});
