import { describe, expect, it } from "vitest";
import { type User } from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";

describe("repository contact dossier quality review", () => {
  it("records append-only contact data-quality resolutions without mutating dossiers", async () => {
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
    const beforeContact = await repository.getContact("firm-west-legal", "contact-river");
    const beforeDossiers = await repository.listContactDossiersForUser(user);

    await repository.createContactDataQualityResolution({
      id: "contact-resolution-001",
      firmId: "firm-west-legal",
      contactId: "contact-river",
      signalKind: "protected_party_cue",
      decision: "acknowledged",
      matterId: "matter-001",
      resolutionNote: "Synthetic reviewer noted the protected-party cue.",
      recordedByUserId: "user-licensee",
      recordedAt: "2026-05-19T12:00:00.000Z",
    });
    await repository.createContactDataQualityResolution({
      id: "contact-resolution-002",
      firmId: "firm-west-legal",
      contactId: "contact-river",
      signalKind: "protected_party_cue",
      decision: "needs_follow_up",
      matterId: "matter-001",
      resolutionNote: "Synthetic follow-up decision for the same cue.",
      recordedByUserId: "user-licensee",
      recordedAt: "2026-05-19T12:05:00.000Z",
    });

    await expect(
      repository.listContactDataQualityResolutions("firm-west-legal", {
        contactId: "contact-river",
      }),
    ).resolves.toMatchObject([
      { id: "contact-resolution-002", decision: "needs_follow_up" },
      { id: "contact-resolution-001", decision: "acknowledged" },
    ]);
    await expect(repository.getContact("firm-west-legal", "contact-river")).resolves.toEqual(
      beforeContact,
    );
    await expect(repository.listContactDossiersForUser(user)).resolves.toEqual(beforeDossiers);
    await expect(
      repository.createContactDataQualityResolution({
        id: "contact-resolution-invalid",
        firmId: "firm-west-legal",
        contactId: "contact-river",
        signalKind: "duplicate_candidate",
        decision: "revalidation_completed",
        resolutionNote: "Synthetic invalid decision.",
        recordedByUserId: "user-licensee",
        recordedAt: "2026-05-19T12:10:00.000Z",
      }),
    ).rejects.toThrow("Contact data-quality resolution decision is invalid");
  });

  it("surfaces relationship graph summaries without leaking hidden contacts or related ids", async () => {
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
    await repository.createContactRelationship({
      id: "relationship-visible-review",
      firmId: "firm-west-legal",
      contactId: "contact-river",
      relatedContactId: "contact-ada",
      relationshipKind: "opposing_party_for",
      label: "Counterparty relationship",
      matterId: "matter-001",
      source: "matter_party",
      status: "review_needed",
      createdAt: "2026-05-29T13:00:00.000Z",
      updatedAt: "2026-05-29T13:00:00.000Z",
    });

    const dossiers = await repository.listContactDossiersForUser(user);
    const ada = dossiers.find((dossier) => dossier.contact.id === "contact-ada")!;
    const river = dossiers.find((dossier) => dossier.contact.id === "contact-river")!;

    expect(ada.crmTaxonomy.labels.map((label) => label.key)).toEqual(
      expect.arrayContaining(["client_contact", "relationship_graph"]),
    );
    expect(ada.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "contact-relationship-ada-river-counterparty",
          direction: "outbound",
          relationshipKind: "opposing_party_for",
          relatedContact: {
            kind: "organization",
            displayName: "River City Rentals Inc.",
          },
          visibleMatterIds: ["matter-001"],
        }),
      ]),
    );
    expect(river.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "relationship-visible-review",
          direction: "outbound",
          conflictSafeLabel: "Counterparty relationship needs review",
          status: "review_needed",
          relatedContact: {
            kind: "person",
            displayName: "Ada Morgan",
          },
        }),
      ]),
    );
    const serialized = JSON.stringify(dossiers);
    expect(serialized).not.toContain("contact-northstar");
    expect(serialized).not.toContain("North Star Holdings");
    expect(serialized).not.toContain('"relatedContact":{"id"');
  });

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
      relationships: [
        {
          id: "contact-relationship-ada-river-counterparty",
          direction: "outbound",
          relationshipKind: "opposing_party_for",
          label: "Matter counterparty",
          conflictSafeLabel: "Matter counterparty",
          status: "active",
          source: "matter_party",
          relatedContact: {
            kind: "organization",
            displayName: "River City Rentals Inc.",
          },
          visibleMatterIds: ["matter-001"],
        },
      ],
      crmTaxonomy: {
        entityType: "person",
        labels: expect.arrayContaining([
          expect.objectContaining({ key: "person", label: "person" }),
          expect.objectContaining({ key: "client_contact", label: "client contact" }),
          expect.objectContaining({ key: "relationship_graph", severity: "info" }),
        ]),
        relationshipSummary: expect.objectContaining({
          activeCount: 1,
          organizationCount: 1,
        }),
      },
    });
    expect(
      dossiers.find((dossier) => dossier.contact.id === "contact-river")?.relationships,
    ).toEqual([
      expect.objectContaining({
        id: "contact-relationship-ada-river-counterparty",
        direction: "inbound",
        label: "Matter counterparty",
        conflictSafeLabel: "Matter counterparty",
        relatedContact: {
          kind: "person",
          displayName: "Ada Morgan",
        },
        visibleMatterIds: ["matter-001"],
      }),
    ]);
    expect(JSON.stringify(dossiers)).not.toContain("proposal-inaccessible-contact-name");
    expect(JSON.stringify(dossiers.map((dossier) => dossier.relationships))).not.toContain(
      "contact-northstar",
    );
    expect(dossiers.find((dossier) => dossier.contact.id === "contact-ada")).toMatchObject({
      qualityReview: {
        summary: { revalidationPromptCount: 1, retentionHoldCueCount: 1 },
        signals: expect.arrayContaining([
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
          expect.objectContaining({
            kind: "retention_hold_review",
            matterId: "matter-001",
          }),
        ]),
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

  it("reuses preloaded contact visibility for portal grants and timelines", async () => {
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
    const dossiers = await repository.listContactDossiersForUser(user);
    const dossier = dossiers.find((candidate) => candidate.contact.id === "contact-ada")!;
    const expectedGrants = await repository.listContactPortalGrantsForUser(user, "contact-ada");
    const expectedTimeline = await repository.listContactTimelineForUser(user, "contact-ada");
    repository.listMattersForUser = async () => {
      throw new Error("unexpected contact dossier hydration");
    };

    await expect(
      repository.listContactPortalGrantsForUser(user, "contact-ada", {
        visibleDossier: dossier,
        portalGrants: expectedGrants,
      }),
    ).resolves.toEqual(expectedGrants);
    await expect(
      repository.listContactTimelineForUser(user, "contact-ada", {
        visibleDossier: dossier,
        portalGrants: expectedGrants,
      }),
    ).resolves.toEqual(expectedTimeline);
  });
});
