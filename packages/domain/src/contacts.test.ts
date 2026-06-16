import { describe, expect, it } from "vitest";
import {
  buildContactDossiers,
  validateContactRecord,
  validateContactDataQualityResolutionRecord,
  validateContactRelationshipRecord,
} from "./contacts.js";
import {
  sampleContactRelationships,
  sampleContacts,
  sampleMatterParties,
  sampleMatters,
  samplePortalGrants,
} from "./sample-data.js";

describe("contact dossiers", () => {
  it("validates legal CRM contact invariants for people, organizations, and methods", () => {
    expect(() =>
      validateContactRecord({
        id: "contact-org",
        firmId: "firm-west-legal",
        kind: "organization",
        status: "prospective",
        roleCategories: ["organization", "prospective_client"],
        displayName: "Synthetic Society",
        organizationLegalName: "Synthetic Society",
        aliases: ["Synthetic Society operating name"],
        formerNames: ["Synthetic Association"],
        identifiers: [{ type: "business_number", value: "BN-900" }],
        contactMethods: [
          {
            id: "method-service",
            type: "address",
            label: "service",
            address: { line1: "1 Synthetic Way", city: "Vancouver", province: "BC" },
            conflictCheckIncluded: true,
          },
        ],
        preferredContactMethodId: "method-service",
      }),
    ).not.toThrow();
    expect(() =>
      validateContactRecord({
        id: "contact-bad",
        firmId: "firm-west-legal",
        kind: "person",
        displayName: "Synthetic Person",
        aliases: [],
        identifiers: [],
        contactMethods: [
          {
            id: "method-email",
            type: "email",
            label: "work",
          },
        ],
      }),
    ).toThrow("Contact method value is required");
  });

  it("groups contacts by accessible matter links and active portal grants", () => {
    const dossiers = buildContactDossiers({
      firmId: "firm-west-legal",
      contacts: sampleContacts.map((contact) =>
        contact.id === "contact-ada" ? { ...contact, notes: "Private contact note" } : contact,
      ),
      matters: sampleMatters.filter((matter) => matter.id === "matter-001"),
      matterParties: sampleMatterParties,
      portalGrants: samplePortalGrants,
      contactRelationships: sampleContactRelationships,
      now: "2026-05-02T12:00:00.000Z",
    });

    expect(dossiers.map((dossier) => dossier.contact.id)).toEqual([
      "contact-ada",
      "contact-northstar",
      "contact-river",
    ]);
    expect(dossiers.find((dossier) => dossier.contact.id === "contact-northstar")).toMatchObject({
      contact: { displayName: "North Star Holdings Ltd." },
      matters: [],
      portal: { activeGrantCount: 0 },
    });
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
          expect.objectContaining({ key: "person", label: "person", severity: "info" }),
          expect.objectContaining({ key: "client_contact", label: "client contact" }),
          expect.objectContaining({ key: "confidential_handling", severity: "review" }),
          expect.objectContaining({ key: "portal_enabled", severity: "review" }),
          expect.objectContaining({ key: "relationship_graph", severity: "info" }),
        ]),
        relatedMatterSummary: {
          total: 1,
          clientRoleCount: 1,
          adverseRoleCount: 0,
          confidentialRoleCount: 1,
          portalMatterCount: 1,
        },
        relationshipSummary: {
          activeCount: 1,
          reviewNeededCount: 0,
          organizationCount: 1,
          personCount: 0,
        },
      },
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

  it("adds conflict-safe CRM taxonomy and relationship graph summaries", () => {
    const dossiers = buildContactDossiers({
      firmId: "firm-west-legal",
      contacts: sampleContacts,
      matters: sampleMatters.filter((matter) => matter.id === "matter-001"),
      matterParties: sampleMatterParties,
      portalGrants: samplePortalGrants,
      contactRelationships: sampleContactRelationships,
      now: "2026-05-29T12:00:00.000Z",
    });

    const ada = dossiers.find((dossier) => dossier.contact.id === "contact-ada")!;
    expect(ada.crmTaxonomy).toMatchObject({
      entityType: "person",
      relatedMatterSummary: {
        total: 1,
        clientRoleCount: 1,
        adverseRoleCount: 0,
        confidentialRoleCount: 1,
        portalMatterCount: 1,
      },
      relationshipSummary: {
        activeCount: 1,
        reviewNeededCount: 0,
        organizationCount: 1,
        personCount: 0,
      },
    });
    expect(ada.crmTaxonomy.labels.map((label) => label.key)).toEqual(
      expect.arrayContaining([
        "person",
        "client_contact",
        "confidential_handling",
        "portal_enabled",
        "relationship_graph",
      ]),
    );
    expect(ada.relationships).toEqual([
      expect.objectContaining({
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
      }),
    ]);
    expect(JSON.stringify(ada.relationships)).not.toContain("contact-river");
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
      contactRelationships: sampleContactRelationships,
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
        id: "contact-relationship-ada-river-counterparty",
        direction: "inbound",
        relationshipKind: "opposing_party_for",
        label: "Matter counterparty",
        conflictSafeLabel: "Matter counterparty",
        status: "active",
        source: "matter_party",
        relatedContact: {
          kind: "person",
          displayName: "Ada Morgan",
        },
        visibleMatterIds: ["matter-001"],
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
        ...sampleContacts.map((contact) =>
          contact.id === "contact-ada"
            ? {
                ...contact,
                contactMethods: [
                  {
                    id: "method-ada-phone",
                    type: "phone" as const,
                    label: "mobile" as const,
                    value: "604-555-0100",
                    conflictCheckIncluded: true,
                  },
                  {
                    id: "method-ada-service",
                    type: "address" as const,
                    label: "service" as const,
                    address: {
                      line1: "10 Synthetic Way",
                      city: "Vancouver",
                      province: "BC" as const,
                      postalCode: "V6B 0A0",
                    },
                    conflictCheckIncluded: true,
                  },
                ],
              }
            : contact,
        ),
        {
          id: "contact-ada-duplicate",
          firmId: "firm-west-legal",
          kind: "person",
          displayName: "Ada Morgan",
          status: "prospective",
          roleCategories: ["prospective_client"],
          aliases: ["Ada M. Nguyen"],
          identifiers: [{ type: "email", value: "ada@example.test" }],
          contactMethods: [
            {
              id: "method-ada-duplicate-phone",
              type: "phone",
              label: "mobile",
              value: "604-555-0100",
              conflictCheckIncluded: true,
            },
            {
              id: "method-ada-duplicate-service",
              type: "address",
              label: "service",
              address: {
                line1: "10 Synthetic Way",
                city: "Vancouver",
                province: "BC" as const,
                postalCode: "V6B 0A0",
              },
              conflictCheckIncluded: true,
            },
          ],
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
          reason: "Possible duplicate contact by address, alias, identifier, name, phone",
          relatedContactIds: ["contact-ada-duplicate"],
          matchedOn: "name",
          duplicateReview: {
            candidate: {
              contactId: "contact-ada-duplicate",
              displayName: "Ada Morgan",
              kind: "person",
              status: "prospective",
              roleCategories: ["prospective_client"],
            },
            matchedFields: ["address", "alias", "identifier", "name", "phone"],
            matchCount: 9,
            sharedVisibleMatterIds: ["matter-001"],
            sharedVisibleMatterCount: 1,
            reviewSeverity: "review",
          },
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

  it("validates contact relationship records", () => {
    const relationship = {
      id: "relationship-001",
      firmId: "firm-west-legal",
      contactId: "contact-ada",
      relatedContactId: "contact-river",
      relationshipKind: "opposing_party_for",
      label: "Matter counterparty",
      matterId: "matter-001",
      source: "matter_party",
      status: "active",
      createdAt: "2026-05-29T12:00:00.000Z",
      updatedAt: "2026-05-29T12:00:00.000Z",
    } as const;

    expect(() => validateContactRelationshipRecord(relationship)).not.toThrow();
    expect(() =>
      validateContactRelationshipRecord({
        ...relationship,
        relatedContactId: "contact-ada",
      }),
    ).toThrow("related contact must differ");
    expect(() =>
      validateContactRelationshipRecord({
        ...relationship,
        relationshipKind: "unsupported" as never,
      }),
    ).toThrow("kind is invalid");
    expect(() =>
      validateContactRelationshipRecord({
        ...relationship,
        createdAt: "not-a-date",
      }),
    ).toThrow("created timestamp is invalid");
  });
});
