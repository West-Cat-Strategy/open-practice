import { describe, expect, it } from "vitest";
import { buildContactDossiers, validateContactDataQualityResolutionRecord } from "./contacts.js";
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
      relationships: [
        {
          source: "matter_party",
          relationshipLabel: "client to opposing party",
          relatedContact: {
            kind: "organization",
            displayName: "River City Rentals Inc.",
          },
          matter: {
            matterId: "matter-001",
            matterNumber: "2026-0001",
            matterTitle: "Morgan tenancy dispute",
          },
          contactRole: "client",
          relatedRole: "opposing_party",
          conflictSafeLabels: [
            "confidential handling",
            "conflict caution",
            "related adverse party",
          ],
        },
      ],
      crmTaxonomy: {
        contactType: "person",
        primaryLabel: "Person",
        cues: expect.arrayContaining([
          expect.objectContaining({ kind: "contact_type", label: "Person" }),
          expect.objectContaining({ kind: "matter_role", label: "client", count: 1 }),
          expect.objectContaining({
            kind: "relationship_context",
            label: "client to opposing party",
            count: 1,
          }),
          expect.objectContaining({ kind: "privacy_flag", label: "confidential matter", count: 1 }),
          expect.objectContaining({ kind: "portal_access", label: "portal contact", count: 1 }),
        ]),
      },
      conflictCues: [
        {
          severity: "review",
          reason: "Linked to a confidential matter party record",
          matterId: "matter-001",
        },
      ],
    });
    const adaRelationship = dossiers.find((dossier) => dossier.contact.id === "contact-ada")!
      .relationships[0]!;
    expect(adaRelationship.relatedContact).not.toHaveProperty("id");
    expect(adaRelationship.relatedContact).not.toHaveProperty("aliases");
    expect(adaRelationship.relatedContact).not.toHaveProperty("identifiers");
    expect(adaRelationship.relatedContact).not.toHaveProperty("notes");
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

  it("adds redacted conflict-check history for visible matched matters", () => {
    const dossiers = buildContactDossiers({
      firmId: "firm-west-legal",
      contacts: sampleContacts,
      matters: sampleMatters.filter((matter) => matter.id === "matter-001"),
      matterParties: sampleMatterParties,
      portalGrants: [],
      conflictChecks: [
        {
          id: "conflict-check-visible",
          firmId: "firm-west-legal",
          requestedByUserId: "user-licensee",
          prospectiveName: "River City Rentals",
          querySnapshot: {
            prospectiveName: "River City Rentals",
            aliases: [],
            identifiers: [],
            includeClosedMatters: true,
          },
          resultSnapshot: [
            {
              contactId: "contact-river",
              matterId: "matter-001",
              severity: "blocker",
              reason: "Prospective party matches an adverse party",
              matchedValue: "river city rentals",
            },
            {
              contactId: "contact-northstar",
              matterId: "matter-002",
              severity: "review",
              reason: "Name or alias match",
              matchedValue: "north star holdings",
            },
          ],
          disposition: "pending_review",
          createdAt: "2026-05-10T12:00:00.000Z",
        },
      ],
    });

    const river = dossiers.find((dossier) => dossier.contact.id === "contact-river")!;
    expect(river.relationships).toEqual([
      expect.objectContaining({
        relationshipLabel: "opposing party to client",
        relatedContact: {
          kind: "person",
          displayName: "Ada Morgan",
        },
        conflictSafeLabels: expect.arrayContaining([
          "confidential handling",
          "conflict caution",
          "related confidential party",
        ]),
      }),
    ]);
    expect(JSON.stringify(river.relationships)).not.toContain("ada@example.test");
    expect(JSON.stringify(river.relationships)).not.toContain("contact-ada");
    expect(river.conflictHistory).toEqual([
      {
        id: "conflict-check-visible",
        createdAt: "2026-05-10T12:00:00.000Z",
        disposition: "pending_review",
        matchedContactId: "contact-river",
        visibleMatchedMatterIds: ["matter-001"],
        matchCount: 1,
        maxSeverity: "blocker",
      },
    ]);
    expect(JSON.stringify(river.conflictHistory)).not.toContain("River City Rentals");
    expect(JSON.stringify(river.conflictHistory)).not.toContain("river city rentals");
    expect(JSON.stringify(dossiers)).not.toContain("matter-002");
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

  it("validates contact data-quality resolution records", () => {
    const resolution = {
      id: "contact-quality-resolution-001",
      firmId: "firm-west-legal",
      contactId: "contact-river",
      signalKind: "duplicate_candidate",
      decision: "needs_follow_up",
      relatedContactId: "contact-river-duplicate",
      resolutionNote: "Synthetic reviewer note.",
      recordedByUserId: "user-licensee",
      recordedAt: "2026-05-19T12:00:00.000Z",
    } as const;

    expect(() => validateContactDataQualityResolutionRecord(resolution)).not.toThrow();
    expect(() =>
      validateContactDataQualityResolutionRecord({
        ...resolution,
        id: "contact-quality-resolution-invalid-pair",
        signalKind: "protected_party_cue",
        decision: "false_positive",
        matterId: "matter-001",
      }),
    ).toThrow("decision is invalid for the signal kind");
    expect(() =>
      validateContactDataQualityResolutionRecord({
        ...resolution,
        id: "contact-quality-resolution-empty-note",
        resolutionNote: "",
      }),
    ).toThrow("note is required");
    expect(() =>
      validateContactDataQualityResolutionRecord({
        ...resolution,
        id: "contact-quality-resolution-invalid-timestamp",
        recordedAt: "not-a-date",
      }),
    ).toThrow("timestamp is invalid");
  });
});
