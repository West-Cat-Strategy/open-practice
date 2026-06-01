import { describe, expect, it } from "vitest";
import {
  aiOperationalProposalKinds,
  assertAiOperationalProposalKind,
  assertAiOperationalProposalKinds,
  buildAiOperationalProposalAuditMetadata,
  reviewAiOperationalProposalRecord,
  summarizeAiOperationalProposals,
  validateAiOperationalProposalRecord,
  type AiOperationalProposalRecord,
} from "./ai-operational-proposals.js";

const baseProposal: AiOperationalProposalRecord = {
  id: "proposal-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  kind: "deadline_extraction",
  status: "proposed",
  source: {
    sourceType: "draft",
    draftId: "draft-001",
    sourceLabel: "Synthetic draft",
    sourceTextLength: 240,
    confidence: "medium",
  },
  providerKey: "fake-local-ai",
  providerModel: "fake-operational-proposals-v1",
  proposal: {
    title: "Review potential response deadline",
    summary: "Synthetic proposal summary",
    proposedAction: "Review the proposed deadline before adding anything to Calendar.",
    deadline: { suggestedDueAt: "2026-06-15T16:00:00.000Z" },
  },
  createdByUserId: "user-admin",
  createdAt: "2026-06-01T16:00:00.000Z",
  updatedAt: "2026-06-01T16:00:00.000Z",
  metadata: { source: "test" },
};

describe("AI operational proposals", () => {
  it("validates supported proposal kinds and record shape", () => {
    for (const kind of aiOperationalProposalKinds) {
      expect(() => assertAiOperationalProposalKind(kind)).not.toThrow();
    }
    expect(() => assertAiOperationalProposalKind("legal_advice")).toThrow(
      "Unsupported AI operational proposal kind",
    );
    expect(() =>
      assertAiOperationalProposalKinds(["deadline_extraction", "task_creation"]),
    ).not.toThrow();
    expect(() => assertAiOperationalProposalKinds([])).toThrow(
      "At least one AI operational proposal kind is required",
    );
    expect(() => validateAiOperationalProposalRecord(baseProposal)).not.toThrow();
    expect(() =>
      validateAiOperationalProposalRecord({
        ...baseProposal,
        source: { sourceType: "document", sourceTextLength: 24 },
      }),
    ).toThrow("Document-sourced AI operational proposals require documentId");
  });

  it("reviews proposals as status-only records", () => {
    const reviewed = reviewAiOperationalProposalRecord({
      record: baseProposal,
      decision: "approved",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-01T17:00:00.000Z",
    });

    expect(reviewed).toMatchObject({
      status: "approved",
      reviewDecision: "approved",
      reviewedByUserId: "user-licensee",
      reviewedAt: "2026-06-01T17:00:00.000Z",
    });
    expect(() => validateAiOperationalProposalRecord(reviewed)).not.toThrow();
  });

  it("builds audit metadata without generated proposal or source text", () => {
    const metadata = buildAiOperationalProposalAuditMetadata(baseProposal);

    expect(metadata).toMatchObject({
      matterId: "matter-001",
      proposalId: "proposal-001",
      proposalKind: "deadline_extraction",
      sourceTextLength: 240,
      proposalTitleLength: baseProposal.proposal.title.length,
      proposalSummaryLength: baseProposal.proposal.summary.length,
    });
    expect(JSON.stringify(metadata)).not.toContain(baseProposal.proposal.summary);
    expect(JSON.stringify(metadata)).not.toContain(baseProposal.proposal.proposedAction);
  });

  it("summarizes proposal review posture by status and kind", () => {
    const summary = summarizeAiOperationalProposals([
      baseProposal,
      { ...baseProposal, id: "proposal-002", kind: "task_creation", status: "approved" },
      { ...baseProposal, id: "proposal-003", kind: "client_update_draft", status: "rejected" },
    ]);

    expect(summary).toMatchObject({
      total: 3,
      proposed: 1,
      approved: 1,
      rejected: 1,
      statusOnlyReview: true,
    });
    expect(summary.byKind.task_creation).toBe(1);
    expect(summary.byKind.document_organization).toBe(0);
  });
});
