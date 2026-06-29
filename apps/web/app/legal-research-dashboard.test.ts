import { describe, expect, it } from "vitest";
import {
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
    expect(canReviewLegalResearch("firm_member")).toBe(true);
    expect(canReviewLegalResearch("auditor")).toBe(false);
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
