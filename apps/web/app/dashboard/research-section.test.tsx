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
  provider: {
    status: "disabled",
    reason: "not_configured",
    liveResearchProvider: false,
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
    expect(writableHtml).toContain("Staff-authored review artifacts");
    expect(writableHtml).toContain("Review</button>");
    expect(writableHtml).toContain("Reject</button>");
    expect(readOnlyHtml).not.toContain("Review</button>");
    expect(readOnlyHtml).not.toContain("Reject</button>");
  });
});
