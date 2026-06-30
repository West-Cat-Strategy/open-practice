import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { legalResearchArtifactReviewBusyKey } from "@open-practice/domain/operational-actions";
import type { LegalResearchWorkspaceResponse } from "../types";
import { ResearchSection } from "./research-section";

const workspace: LegalResearchWorkspaceResponse = {
  status: "available",
  matterId: "matter-001",
  artifacts: [
    {
      id: "legal-research-source-note-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "cited_source_note",
      status: "ready_for_review",
      title: "Residential tenancy source note",
      note: "Synthetic staff-authored note.",
      sourceReferences: [{ sourceType: "statute", label: "Staff source label" }],
      contextLinks: [{ resourceType: "matter", resourceId: "matter-001" }],
      createdByUserId: "user-licensee",
      createdAt: "2026-06-01T18:00:00.000Z",
      updatedAt: "2026-06-01T18:00:00.000Z",
      reviewOnly: true,
      metadata: {},
    },
    {
      id: "legal-research-document-analysis-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "document_analysis_status",
      status: "rejected",
      title: "Document conversion review posture",
      note: "Synthetic raw OCR text must not render.",
      sourceReferences: [],
      contextLinks: [{ resourceType: "document", resourceId: "doc-001" }],
      documentAnalysis: {
        documentId: "doc-001",
        status: "ready_for_review",
        extractionStatus: "completed",
        artifactStatus: "metadata_only",
        sourceTextLength: 47,
      },
      reviewDecision: "rejected",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-27T14:00:00.000Z",
      createdByUserId: "user-licensee",
      createdAt: "2026-06-27T13:00:00.000Z",
      updatedAt: "2026-06-27T14:00:00.000Z",
      reviewOnly: true,
      metadata: {
        rawOcrText: "Synthetic provider OCR body must not render.",
        providerPayload: { private: "Synthetic provider payload must not render." },
        storageKey: "private/synthetic-object",
        generatedSummary: "Synthetic generated summary must not render.",
      },
    },
  ],
  summary: {
    total: 2,
    draft: 0,
    readyForReview: 1,
    reviewed: 0,
    rejected: 1,
    sourceReferenceCount: 1,
    contextLinkCount: 2,
    documentAnalysisCount: 1,
    strategyTimelineCount: 0,
    openCheckpointCount: 0,
    byKind: {
      cited_source_note: 1,
      matter_context_attachment: 0,
      document_analysis_status: 1,
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
  providerJobs: [
    {
      id: "job-legal-research-001",
      queueName: "ai_triage",
      jobName: "legal_research_provider_review",
      status: "skipped",
      targetResourceType: "legal_research",
      targetResourceId: "matter-001",
      queuedAt: "2026-06-04T18:00:00.000Z",
      finishedAt: "2026-06-04T18:01:00.000Z",
      terminal: true,
      idempotencyKeyPresent: true,
      metadata: {
        requestType: "citation_review",
        citationReferenceCount: 2,
        providerStatus: "reserved",
        sourceTextIncluded: false,
        promptIncluded: false,
        providerEvidenceStored: false,
      },
    },
  ],
  providerJobSummary: {
    total: 1,
    queued: 0,
    active: 0,
    completed: 0,
    skipped: 1,
    failed: 0,
    deadLetter: 0,
    latestQueuedAt: "2026-06-04T18:00:00.000Z",
    reviewOnly: true,
  },
  citationPacketReadiness: {
    sourceReferenceCount: 1,
    sourceReferenceCountsByType: {
      case_law: 0,
      statute: 1,
      regulation: 0,
      policy: 0,
      secondary_source: 0,
      internal_note: 0,
      unknown: 0,
    },
    readyForReviewArtifactCount: 1,
    readyForReviewArtifactIds: ["legal-research-source-note-001"],
    openCheckpointCount: 0,
    openCheckpointArtifactIds: [],
    contextLinkCount: 2,
    contextLinkCountsByType: {
      matter: 1,
      document: 1,
      draft: 0,
      contact: 0,
      task: 0,
      calendar_event: 0,
      intake_session: 0,
    },
    staffReviewReady: true,
    blockedReasons: [],
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
  },
};

describe("ResearchSection", () => {
  it("renders review controls only for authorized staff", () => {
    const writableHtml = renderToStaticMarkup(
      createElement(ResearchSection, {
        canReview: true,
        compactDate: (value?: string) => value ?? "none",
        onReviewArtifact: () => {},
        reviewStatus: "Research workspace artifacts loaded.",
        workspace,
      }),
    );
    const readOnlyHtml = renderToStaticMarkup(
      createElement(ResearchSection, {
        canReview: false,
        compactDate: (value?: string) => value ?? "none",
        onReviewArtifact: () => {},
        reviewStatus: "Research workspace artifacts loaded.",
        workspace,
      }),
    );

    expect(writableHtml).toContain("Research workspace");
    expect(writableHtml).toContain("Citation packet");
    expect(writableHtml).toContain("staff review ready");
    expect(writableHtml).toContain("0 case");
    expect(writableHtml).toContain("1 statute");
    expect(writableHtml).toContain("0 open checkpoints");
    expect(writableHtml).toContain("1 matters");
    expect(writableHtml).toContain("1 documents");
    expect(writableHtml).toContain("reserved no provider execution");
    expect(writableHtml).toContain("No provider run");
    expect(writableHtml).toContain("no verification claim");
    expect(writableHtml).toContain("no legal advice");
    expect(writableHtml).toContain("1 provider jobs recorded");
    expect(writableHtml).toContain("Citation review");
    expect(writableHtml).toContain("citation review");
    expect(writableHtml).toContain("latest decision rejected at 2026-06-27T14:00:00.000Z");
    expect(writableHtml).toContain("reviewer user-licensee");
    expect(writableHtml).toContain("metadata only");
    expect(writableHtml).toContain("no provider evidence");
    expect(writableHtml).toContain("no downstream mutation");
    expect(writableHtml).toContain("no raw OCR returned");
    expect(writableHtml).not.toContain("Synthetic staff-authored note.");
    expect(writableHtml).not.toContain("Staff source label");
    expect(writableHtml).not.toContain("Synthetic raw OCR text must not render.");
    expect(writableHtml).not.toContain("Synthetic provider OCR body must not render.");
    expect(writableHtml).not.toContain("Synthetic provider payload must not render.");
    expect(writableHtml).not.toContain("private/synthetic-object");
    expect(writableHtml).not.toContain("Synthetic generated summary must not render.");
    expect(writableHtml).toContain('data-action-key="legal_research_artifact.review"');
    expect(writableHtml).toContain('data-action-key="legal_research_artifact.reject"');
    expect(writableHtml).toContain('aria-label="Review"');
    expect(writableHtml).toContain('aria-label="Reject"');
    expect(writableHtml).toContain('title="Review"');
    expect(writableHtml).toContain('title="Reject"');
    expect(writableHtml).toContain("Review</button>");
    expect(writableHtml).toContain("Reject</button>");
    expect(readOnlyHtml).not.toContain("legal_research_artifact.review");
    expect(readOnlyHtml).not.toContain("legal_research_artifact.reject");
    expect(readOnlyHtml).not.toContain("Review</button>");
    expect(readOnlyHtml).not.toContain("Reject</button>");
  });

  it("renders descriptor-backed busy review button status", () => {
    const busyHtml = renderToStaticMarkup(
      createElement(ResearchSection, {
        canReview: true,
        compactDate: (value?: string) => value ?? "none",
        onReviewArtifact: () => {},
        reviewBusyId: legalResearchArtifactReviewBusyKey(
          "reviewed",
          "legal-research-source-note-001",
        ),
        reviewStatus: "Recording reviewed research review...",
        workspace,
      }),
    );

    expect(busyHtml).toContain('data-action-key="legal_research_artifact.review"');
    expect(busyHtml).toContain('data-action-key="legal_research_artifact.reject"');
    expect(busyHtml).toContain('aria-label="Saving: review in progress"');
    expect(busyHtml).toContain('title="Saving: review in progress"');
    expect(busyHtml).toContain(">Saving</button>");
    expect(busyHtml).toContain('aria-label="Reject: review action in progress"');
    expect(busyHtml).toContain('title="Reject: review action in progress"');
    expect(busyHtml.match(/disabled=""/g) ?? []).toHaveLength(2);
  });
});
