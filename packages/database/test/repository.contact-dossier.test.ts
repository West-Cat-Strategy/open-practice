import { describe, expect, it } from "vitest";
import { type User } from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository contact dossier quality review", () => {
  it("surfaces conflict-check revalidation prompts only from accessible applied contact changes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const user: User = {
      id: "user-licensee",
      firmId: "firm-west-legal",
      displayName: "Test Licensee",
      email: "licensee@example.test",
      role: "licensee",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    };
    await repository.createIntakeVariableProposals([
      {
        id: "proposal-accessible-contact-name",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        intakeSessionId: "intake-001",
        answerSnapshotId: "snapshot-001",
        sourceQuestionId: "client_display_name",
        targetScope: "client",
        targetField: "displayName",
        targetRecordId: "contact-ada",
        proposedValue: "Ada M. Nguyen",
        status: "approved",
        createdAt: "2026-05-01T10:00:00.000Z",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-05-01T11:00:00.000Z",
        appliedAt: "2026-05-01T11:00:00.000Z",
      },
      {
        id: "proposal-inaccessible-contact-name",
        firmId: "firm-west-legal",
        matterId: "matter-002",
        intakeSessionId: "intake-002",
        answerSnapshotId: "snapshot-002",
        sourceQuestionId: "client_display_name",
        targetScope: "client",
        targetField: "displayName",
        targetRecordId: "contact-northstar",
        proposedValue: "North Star Holdings",
        status: "approved",
        createdAt: "2026-05-01T10:00:00.000Z",
        reviewedByUserId: "user-licensee",
        reviewedAt: "2026-05-01T11:00:00.000Z",
        appliedAt: "2026-05-01T11:00:00.000Z",
      },
    ]);
    await repository.runConflictCheck({
      firmId: "firm-west-legal",
      actorId: "user-licensee",
      prospectiveName: "River City Rentals",
      includeClosedMatters: true,
    });
    await repository.runConflictCheck({
      firmId: "firm-west-legal",
      actorId: "user-licensee",
      prospectiveName: "North Star Holdings",
      includeClosedMatters: true,
    });

    const dossiers = await repository.listContactDossiersForUser(user);

    expect(dossiers.map((dossier) => dossier.contact.id)).toEqual(["contact-ada", "contact-river"]);
    expect(dossiers.find((dossier) => dossier.contact.id === "contact-ada")).toMatchObject({
      qualityReview: {
        summary: { revalidationPromptCount: 1 },
        signals: [
          expect.objectContaining({
            kind: "protected_party_cue",
            matterId: "matter-001",
          }),
          expect.objectContaining({
            kind: "protected_party_cue",
            matterId: "matter-001",
          }),
          expect.objectContaining({
            kind: "conflict_revalidation",
            sourceRecordId: "proposal-accessible-contact-name",
            matterId: "matter-001",
          }),
        ],
      },
    });
    const river = dossiers.find((dossier) => dossier.contact.id === "contact-river")!;
    expect(river.conflictHistory).toEqual([
      expect.objectContaining({
        matchedContactId: "contact-river",
        visibleMatchedMatterIds: ["matter-001"],
        matchCount: 1,
        maxSeverity: "blocker",
      }),
    ]);
    expect(JSON.stringify(dossiers)).not.toContain("proposal-inaccessible-contact-name");
    expect(JSON.stringify(dossiers)).not.toContain("North Star Holdings");
    expect(JSON.stringify(dossiers)).not.toContain("matter-002");
  });

  it("stores append-only contact quality decisions within visible dossier scope", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const user: User = {
      id: "user-licensee",
      firmId: "firm-west-legal",
      displayName: "Test Licensee",
      email: "licensee@example.test",
      role: "licensee",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    };

    await repository.createContactQualityReviewDecision({
      id: "contact-quality-decision-visible-protected",
      firmId: "firm-west-legal",
      contactId: "contact-river",
      signalKind: "protected_party_cue",
      decision: "protected_party_handling_confirmed",
      matterId: "matter-001",
      relatedContactIds: [],
      decidedByUserId: "user-licensee",
      decidedAt: "2026-05-19T12:00:00.000Z",
      evidence: { reviewedSource: "contact_review_queue" },
      createdAt: "2026-05-19T12:00:00.000Z",
    });
    await repository.createContactQualityReviewDecision({
      id: "contact-quality-decision-visible-duplicate",
      firmId: "firm-west-legal",
      contactId: "contact-ada",
      signalKind: "duplicate_candidate",
      decision: "not_duplicate",
      relatedContactIds: ["contact-river"],
      decidedByUserId: "user-licensee",
      decidedAt: "2026-05-19T12:05:00.000Z",
      evidence: { reviewedSource: "contact_review_queue" },
      createdAt: "2026-05-19T12:05:00.000Z",
    });
    await repository.createContactQualityReviewDecision({
      id: "contact-quality-decision-hidden",
      firmId: "firm-west-legal",
      contactId: "contact-northstar",
      signalKind: "protected_party_cue",
      decision: "protected_party_handling_confirmed",
      matterId: "matter-002",
      relatedContactIds: [],
      decidedByUserId: "user-licensee",
      decidedAt: "2026-05-19T12:10:00.000Z",
      evidence: { reviewedSource: "contact_review_queue" },
      createdAt: "2026-05-19T12:10:00.000Z",
    });

    const decisions = await repository.listContactQualityReviewDecisionsForUser(user);

    expect(decisions.map((decision) => decision.id)).toEqual([
      "contact-quality-decision-visible-duplicate",
      "contact-quality-decision-visible-protected",
    ]);
    expect(JSON.stringify(decisions)).not.toContain("contact-quality-decision-hidden");
    await expect(
      repository.createContactQualityReviewDecision({
        id: "contact-quality-decision-rewrite",
        firmId: "firm-west-legal",
        contactId: "contact-river",
        signalKind: "protected_party_cue",
        decision: "protected_party_handling_confirmed",
        matterId: "matter-001",
        relatedContactIds: [],
        decidedByUserId: "user-licensee",
        decidedAt: "2026-05-19T12:15:00.000Z",
        evidence: { contactRewrite: { displayName: "Do not mutate" } },
        createdAt: "2026-05-19T12:15:00.000Z",
      }),
    ).rejects.toThrow("evidence must stay review-only");
  });
});
