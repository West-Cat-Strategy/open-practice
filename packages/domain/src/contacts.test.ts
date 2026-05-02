import { describe, expect, it } from "vitest";
import { buildContactDossiers } from "./contacts.js";
import {
  sampleContacts,
  sampleMatterParties,
  sampleMatters,
  samplePortalGrants,
} from "./sample-data.js";

describe("contact dossiers", () => {
  it("groups contacts by accessible matter links and active portal grants", () => {
    const dossiers = buildContactDossiers({
      firmId: "firm-west-legal",
      contacts: sampleContacts.map((contact) =>
        contact.id === "contact-ada" ? { ...contact, notes: "Private contact note" } : contact,
      ),
      matters: sampleMatters.filter((matter) => matter.id === "matter-001"),
      matterParties: sampleMatterParties,
      portalGrants: samplePortalGrants,
      now: "2026-05-02T12:00:00.000Z",
    });

    expect(dossiers.map((dossier) => dossier.contact.id)).toEqual(["contact-ada", "contact-river"]);
    expect(dossiers.find((dossier) => dossier.contact.id === "contact-ada")).toMatchObject({
      contact: { displayName: "Ada Morgan" },
      portal: { activeGrantCount: 1 },
      matters: [
        {
          matterId: "matter-001",
          role: "client",
          confidential: true,
          portalActive: true,
        },
      ],
      conflictCues: [
        {
          severity: "review",
          reason: "Linked to a confidential matter party record",
          matterId: "matter-001",
        },
      ],
    });
    expect(dossiers[0].contact).not.toHaveProperty("notes");
  });

  it("marks adverse party links without adding conflict-check records", () => {
    const dossiers = buildContactDossiers({
      firmId: "firm-west-legal",
      contacts: sampleContacts,
      matters: sampleMatters,
      matterParties: sampleMatterParties,
      portalGrants: [],
    });

    expect(dossiers.find((dossier) => dossier.contact.id === "contact-river")).toMatchObject({
      conflictCues: [
        {
          severity: "blocker",
          reason: "Linked as an adverse party on an accessible matter",
          matterId: "matter-001",
        },
      ],
    });
  });

  it("adds duplicate, protected-party, and contact-change revalidation quality signals", () => {
    const dossiers = buildContactDossiers({
      firmId: "firm-west-legal",
      contacts: [
        ...sampleContacts,
        {
          id: "contact-ada-duplicate",
          firmId: "firm-west-legal",
          kind: "person",
          displayName: "Ada M Nguyen",
          aliases: [],
          identifiers: [{ type: "email", value: "ada@example.test" }],
        },
      ],
      matters: sampleMatters.filter((matter) => matter.id === "matter-001"),
      matterParties: [
        ...sampleMatterParties,
        {
          id: "party-ada-duplicate",
          firmId: "firm-west-legal",
          matterId: "matter-001",
          contactId: "contact-ada-duplicate",
          role: "third_party",
          adverse: false,
          confidential: false,
        },
      ],
      portalGrants: samplePortalGrants,
      intakeVariableProposals: [
        {
          id: "proposal-contact-name",
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
      ],
      now: "2026-05-02T12:00:00.000Z",
    });

    const ada = dossiers.find((dossier) => dossier.contact.id === "contact-ada")!;
    expect(ada.qualityReview.summary).toEqual({
      duplicateCandidateCount: 1,
      sensitivePartyCueCount: 2,
      revalidationPromptCount: 1,
    });
    expect(ada.qualityReview.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "duplicate_candidate",
          reason: "Possible duplicate contact name or alias",
          relatedContactIds: ["contact-ada-duplicate"],
        }),
        expect.objectContaining({
          kind: "duplicate_candidate",
          reason: "Possible duplicate contact identifier",
          relatedContactIds: ["contact-ada-duplicate"],
          matchedOn: "identifier",
        }),
        expect.objectContaining({
          kind: "protected_party_cue",
          reason: "Confidential party link requires scoped handling",
          matterId: "matter-001",
        }),
        expect.objectContaining({
          kind: "protected_party_cue",
          reason: "Active portal access protects contact-matter communications",
          matterId: "matter-001",
        }),
        expect.objectContaining({
          kind: "conflict_revalidation",
          sourceRecordId: "proposal-contact-name",
          changedAt: "2026-05-01T11:00:00.000Z",
        }),
      ]),
    );

    const river = dossiers.find((dossier) => dossier.contact.id === "contact-river")!;
    expect(river.qualityReview.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "protected_party_cue",
          severity: "blocker",
          reason: "Adverse party link requires sensitive-party caution",
        }),
      ]),
    );
  });
});
