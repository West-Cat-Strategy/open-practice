import { describe, expect, it } from "vitest";
import {
  assertLegalResearchArtifactKind,
  buildLegalResearchArtifactAuditMetadata,
  buildLegalResearchWorkspace,
  legalResearchArtifactKinds,
  reviewLegalResearchArtifactRecord,
  summarizeLegalResearchArtifacts,
  validateLegalResearchArtifactRecord,
  type LegalResearchArtifactRecord,
} from "./legal-research.js";

const baseArtifact: LegalResearchArtifactRecord = {
  id: "research-artifact-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  kind: "cited_source_note",
  status: "ready_for_review",
  title: "Residential tenancy source note",
  note: "Synthetic staff-authored note for internal review.",
  sourceReferences: [
    {
      sourceType: "statute",
      label: "Residential Tenancy Act review label",
      jurisdiction: "BC",
      staffCitationLabel: "Staff-entered citation label",
    },
  ],
  contextLinks: [
    { resourceType: "matter", resourceId: "matter-001", label: "Matter context" },
    { resourceType: "document", resourceId: "doc-001", label: "Retainer agreement" },
  ],
  createdByUserId: "user-licensee",
  createdAt: "2026-06-01T18:00:00.000Z",
  updatedAt: "2026-06-01T18:00:00.000Z",
  reviewOnly: true,
  metadata: { source: "test" },
};

describe("legal research artifacts", () => {
  it("validates supported artifact kinds and review-only record shape", () => {
    for (const kind of legalResearchArtifactKinds) {
      expect(() => assertLegalResearchArtifactKind(kind)).not.toThrow();
    }
    expect(() => assertLegalResearchArtifactKind("automatic_legal_advice")).toThrow(
      "Unsupported legal research artifact kind",
    );
    expect(() => validateLegalResearchArtifactRecord(baseArtifact)).not.toThrow();
    expect(() =>
      validateLegalResearchArtifactRecord({
        ...baseArtifact,
        title: "",
      }),
    ).toThrow("Legal research artifact title is required");
    expect(() =>
      validateLegalResearchArtifactRecord({
        ...baseArtifact,
        reviewOnly: false as true,
      }),
    ).toThrow("Legal research artifacts are review-only records");
  });

  it("records review decisions as status-only transitions", () => {
    const reviewed = reviewLegalResearchArtifactRecord({
      record: baseArtifact,
      decision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-06-01T19:00:00.000Z",
    });

    expect(reviewed).toMatchObject({
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-06-01T19:00:00.000Z",
    });
    expect(() => validateLegalResearchArtifactRecord(reviewed)).not.toThrow();
  });

  it("builds safe audit metadata without note bodies or source labels", () => {
    const metadata = buildLegalResearchArtifactAuditMetadata(baseArtifact);

    expect(metadata).toMatchObject({
      matterId: "matter-001",
      artifactId: "research-artifact-001",
      artifactKind: "cited_source_note",
      status: "ready_for_review",
      sourceReferenceCount: 1,
      contextLinkCount: 2,
      titleLength: baseArtifact.title.length,
      noteLength: baseArtifact.note?.length,
      reviewOnly: true,
    });
    expect(JSON.stringify(metadata)).not.toContain(baseArtifact.note);
    expect(JSON.stringify(metadata)).not.toContain("Residential Tenancy Act review label");
    expect(JSON.stringify(metadata)).not.toContain("Staff-entered citation label");
  });

  it("summarizes workspace posture across artifact kinds", () => {
    const documentArtifact: LegalResearchArtifactRecord = {
      ...baseArtifact,
      id: "research-artifact-002",
      kind: "document_analysis_status",
      status: "draft",
      sourceReferences: [],
      contextLinks: [{ resourceType: "document", resourceId: "doc-001" }],
      documentAnalysis: {
        documentId: "doc-001",
        status: "in_review",
        extractionStatus: "completed",
        artifactStatus: "metadata_only",
        sourceTextLength: 360,
      },
    };
    const checkpoint: LegalResearchArtifactRecord = {
      ...baseArtifact,
      id: "research-artifact-003",
      kind: "review_checkpoint",
      status: "ready_for_review",
      sourceReferences: [],
      contextLinks: [],
      checkpoint: { checkpointType: "supervising_lawyer_review", assignedUserId: "user-admin" },
    };
    const summary = summarizeLegalResearchArtifacts([baseArtifact, documentArtifact, checkpoint]);

    expect(summary).toMatchObject({
      total: 3,
      draft: 1,
      readyForReview: 2,
      sourceReferenceCount: 1,
      contextLinkCount: 3,
      documentAnalysisCount: 1,
      openCheckpointCount: 1,
      reviewOnly: true,
    });
    expect(summary.byKind.document_analysis_status).toBe(1);
    expect(summary.byKind.strategy_timeline_note).toBe(0);

    expect(
      buildLegalResearchWorkspace({ matterId: "matter-001", artifacts: [baseArtifact] }).policy,
    ).toMatchObject({
      liveResearchProvider: false,
      scrapedAuthorityStorage: false,
      automatedLegalAdvice: false,
      citationVerificationClaims: false,
      downstreamMutation: false,
    });
  });
});
