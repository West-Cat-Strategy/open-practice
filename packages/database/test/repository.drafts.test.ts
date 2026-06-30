import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository drafts", () => {
  it("seeds basic draft templates and versions draft updates", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await expect(repository.listDraftTemplates("firm-west-legal")).resolves.toMatchObject([
      {
        id: "draft-template-legal-letter",
        category: "correspondence",
        active: true,
      },
      {
        id: "draft-template-meeting-notes",
        category: "internal",
        active: true,
      },
    ]);

    const created = await repository.createDraft({
      id: "draft-test-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Draft test",
      editorJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Initial" }] }],
      },
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    });
    const updated = await repository.updateDraft("firm-west-legal", created.id, {
      title: "Updated draft test",
      updatedByUserId: "user-licensee",
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: "Updated draft test",
      version: 2,
      updatedByUserId: "user-licensee",
    });
  });

  it("maps draft assist records and review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const created = await repository.createDraftAssistRecord({
      id: "draft-assist-record-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      sourceType: "draft",
      draftId: "draft-001",
      task: "summarize",
      providerKey: "fake-local-ai",
      providerModel: "fake-model",
      status: "suggested",
      suggestedText: "Synthetic suggestion",
      summary: "Synthetic summary",
      createdByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: { sourceTextLength: 24 },
    });
    const reviewed = await repository.updateDraftAssistRecord({
      ...created,
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-05-01T00:05:00.000Z",
      updatedAt: "2026-05-01T00:05:00.000Z",
    });

    expect(reviewed).toMatchObject({
      id: "draft-assist-record-test",
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
    });
    await expect(
      repository.listDraftAssistRecords("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([expect.objectContaining({ id: "draft-assist-record-test" })]);
    await expect(
      repository.listDraftAssistRecords("firm-west-legal", { draftId: "missing" }),
    ).resolves.toEqual([]);
  });

  it("maps AI operational proposals and status-only review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const created = await repository.createAiOperationalProposal({
      id: "ai-proposal-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "task_creation",
      status: "proposed",
      source: {
        sourceType: "draft",
        draftId: "draft-001",
        sourceLabel: "Synthetic draft",
        sourceTextLength: 42,
      },
      providerKey: "fake-local-ai",
      providerModel: "fake-operational-proposals-v1",
      proposal: {
        title: "Review proposed task",
        summary: "Synthetic task proposal",
        proposedAction: "Review before creating any task record.",
        task: { title: "Review action item" },
      },
      createdByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: { statusOnlyReview: true },
    });
    const reviewed = await repository.updateAiOperationalProposal({
      ...created,
      status: "approved",
      reviewDecision: "approved",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-05-01T00:05:00.000Z",
      updatedAt: "2026-05-01T00:05:00.000Z",
    });

    expect(reviewed).toMatchObject({
      id: "ai-proposal-test",
      status: "approved",
      reviewDecision: "approved",
      reviewedByUserId: "user-admin",
    });
    await expect(
      repository.listAiOperationalProposals("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "ai-proposal-test" })]),
    );
    await expect(
      repository.listAiOperationalProposals("firm-west-legal", { kind: "deadline_extraction" }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "ai-proposal-deadline-001" })]),
    );
  });

  it("maps legal research artifacts and status-only review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const created = await repository.createLegalResearchArtifact({
      id: "legal-research-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "strategy_timeline_note",
      status: "ready_for_review",
      title: "Synthetic research timeline",
      note: "Synthetic staff-authored strategy note.",
      sourceReferences: [
        {
          sourceType: "internal_note",
          label: "Internal issue label",
        },
      ],
      contextLinks: [{ resourceType: "matter", resourceId: "matter-001" }],
      timeline: { noteType: "strategy", dueAt: "2026-06-07T17:00:00.000Z" },
      createdByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      reviewOnly: true,
      metadata: { shellOnly: true },
    });
    const reviewed = await repository.updateLegalResearchArtifact({
      ...created,
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-05-01T00:05:00.000Z",
      updatedAt: "2026-05-01T00:05:00.000Z",
    });

    expect(reviewed).toMatchObject({
      id: "legal-research-test",
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewOnly: true,
    });
    await expect(
      repository.listLegalResearchArtifacts("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "legal-research-test" })]),
    );
    await expect(
      repository.listLegalResearchArtifacts("firm-west-legal", { kind: "cited_source_note" }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "legal-research-source-note-001" })]),
    );

    const checkpoint = await repository.createLegalResearchArtifact({
      id: "legal-research-semantic-checkpoint-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      kind: "review_checkpoint",
      status: "ready_for_review",
      title: "Document semantic review checkpoint",
      sourceReferences: [],
      contextLinks: [
        { resourceType: "document", resourceId: "doc-001" },
        { resourceType: "legal_research_artifact", resourceId: "legal-research-test" },
      ],
      checkpoint: { checkpointType: "document_analysis", assignedUserId: "user-admin" },
      createdByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      reviewOnly: true,
      metadata: {
        source: "document_conversion_semantic_review_checkpoint",
        documentId: "doc-001",
        conversionReviewArtifactId: "legal-research-test",
        counts: { sourceTextLength: 47, wordCount: 6 },
        metadataOnly: true,
        reviewOnly: true,
        downstreamMutation: false,
        providerPayloadsStored: false,
        generatedSummariesStored: false,
      },
    });

    expect(checkpoint).toMatchObject({
      kind: "review_checkpoint",
      status: "ready_for_review",
      sourceReferences: [],
      contextLinks: [
        { resourceType: "document", resourceId: "doc-001" },
        { resourceType: "legal_research_artifact", resourceId: "legal-research-test" },
      ],
      checkpoint: { checkpointType: "document_analysis", assignedUserId: "user-admin" },
      metadata: expect.objectContaining({
        source: "document_conversion_semantic_review_checkpoint",
        metadataOnly: true,
        reviewOnly: true,
      }),
    });
    await expect(
      repository.listLegalResearchArtifacts("firm-west-legal", { kind: "review_checkpoint" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legal-research-semantic-checkpoint-test" }),
      ]),
    );
  });
});
