import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
  ],
  summary: {
    total: 1,
    draft: 0,
    readyForReview: 1,
    reviewed: 0,
    rejected: 0,
    sourceReferenceCount: 1,
    contextLinkCount: 1,
    documentAnalysisCount: 0,
    strategyTimelineCount: 0,
    openCheckpointCount: 0,
    byKind: {
      cited_source_note: 1,
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
    expect(writableHtml).toContain("1 provider jobs recorded");
    expect(writableHtml).toContain("Citation review");
    expect(writableHtml).toContain("citation review");
    expect(writableHtml).toContain("Review</button>");
    expect(writableHtml).toContain("Reject</button>");
    expect(readOnlyHtml).not.toContain("Review</button>");
    expect(readOnlyHtml).not.toContain("Reject</button>");
  });
});
