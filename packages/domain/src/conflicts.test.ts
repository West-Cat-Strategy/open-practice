import { describe, expect, it } from "vitest";
import { runConflictCheck } from "./conflicts.js";
import type { ContactRelationshipRecord } from "./contacts.js";
import type { Contact, Matter, MatterParty } from "./models.js";
import { sampleContacts, sampleFirm, sampleMatterParties, sampleMatters } from "./sample-data.js";

describe("conflict checks", () => {
  it("flags normalized aliases, shared identifiers, and adverse-party matches", () => {
    const aliasMatches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "Northstar Holdings, Limited",
      aliases: [],
      includeClosedMatters: true,
      contacts: sampleContacts,
      matters: sampleMatters,
      matterParties: sampleMatterParties,
    });
    const identifierMatches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "River City Rentals",
      identifiers: [{ type: "email", value: "legal@rivercity.example" }],
      prospectiveRole: "client",
      includeClosedMatters: true,
      contacts: sampleContacts,
      matters: sampleMatters,
      matterParties: sampleMatterParties,
    });

    expect(aliasMatches.some((match) => match.contactId === "contact-northstar")).toBe(true);
    expect(identifierMatches.some((match) => match.severity === "blocker")).toBe(true);
  });

  it("checks every matter linked to a matched contact", () => {
    const matters: Matter[] = [
      {
        id: "matter-closed",
        firmId: sampleFirm.id,
        number: "2026-0101",
        title: "Closed file",
        practiceArea: "Civil",
        status: "closed",
        jurisdiction: "BC",
        responsibleUserId: "user-admin",
      },
      {
        id: "matter-open",
        firmId: sampleFirm.id,
        number: "2026-0102",
        title: "Open file",
        practiceArea: "Civil",
        status: "open",
        jurisdiction: "BC",
        responsibleUserId: "user-admin",
      },
    ];
    const contacts: Contact[] = [
      {
        id: "contact-shared",
        firmId: sampleFirm.id,
        kind: "person",
        displayName: "Shared Client",
        aliases: [],
        identifiers: [],
      },
    ];
    const matterParties: MatterParty[] = [
      {
        id: "party-closed",
        firmId: sampleFirm.id,
        matterId: "matter-closed",
        contactId: "contact-shared",
        role: "client",
        adverse: false,
        confidential: false,
      },
      {
        id: "party-open",
        firmId: sampleFirm.id,
        matterId: "matter-open",
        contactId: "contact-shared",
        role: "opposing_party",
        adverse: true,
        confidential: false,
      },
    ];

    const matches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "Shared Client",
      includeClosedMatters: false,
      contacts,
      matters,
      matterParties,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ matterId: "matter-open", severity: "blocker" });
  });

  it("uses organizations, former names, contact methods, and relationships as CRM match sources", () => {
    const contacts: Contact[] = [
      {
        id: "contact-org",
        firmId: sampleFirm.id,
        kind: "organization",
        status: "restricted",
        roleCategories: ["opposing_party"],
        displayName: "Pacific Transit Authority",
        organizationLegalName: "Pacific Transit Authority",
        aliases: [],
        formerNames: ["Coastal Rail Board"],
        identifiers: [{ type: "business_number", value: "BN-123" }],
        contactMethods: [
          {
            id: "method-service-address",
            type: "address",
            label: "service",
            address: { line1: "100 Hearing Way", city: "Vancouver", province: "BC" },
            conflictCheckIncluded: true,
          },
        ],
        conflictSensitive: true,
      },
      {
        id: "contact-lawyer",
        firmId: sampleFirm.id,
        kind: "person",
        displayName: "Sam Counsel",
        aliases: [],
        identifiers: [],
      },
    ];
    const matters: Matter[] = [
      {
        id: "matter-transit",
        firmId: sampleFirm.id,
        number: "2026-0310",
        title: "Transit tribunal file",
        practiceArea: "Administrative law",
        status: "open",
        jurisdiction: "BC",
        responsibleUserId: "user-admin",
      },
    ];
    const matterParties: MatterParty[] = [
      {
        id: "party-transit",
        firmId: sampleFirm.id,
        matterId: "matter-transit",
        contactId: "contact-org",
        role: "opposing_party",
        adverse: true,
        confidential: false,
        conflictCheckIncluded: true,
      },
    ];
    const relationships: ContactRelationshipRecord[] = [
      {
        id: "relationship-counsel-org",
        firmId: sampleFirm.id,
        contactId: "contact-lawyer",
        relatedContactId: "contact-org",
        relationshipKind: "lawyer_for",
        label: "Lawyer for",
        matterId: "matter-transit",
        source: "manual",
        status: "active",
        includeInConflictCheck: true,
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      },
    ];

    const matches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "Coastal Rail Board",
      identifiers: [
        { type: "business_number", value: "BN-123" },
        { type: "address", value: "100 Hearing Way" },
      ],
      prospectiveRole: "client",
      includeClosedMatters: true,
      contacts,
      matters,
      matterParties,
      contactRelationships: relationships,
    });

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactId: "contact-org",
          matchCategory: "former_name",
          riskLevel: "high",
        }),
        expect.objectContaining({
          contactId: "contact-org",
          matchCategory: "identifier",
        }),
        expect.objectContaining({
          contactId: "contact-org",
          matchCategory: "contact_method",
        }),
        expect.objectContaining({
          contactId: "contact-org",
          matchCategory: "conflict_flag",
        }),
        expect.objectContaining({
          contactId: "contact-lawyer",
          relatedContactId: "contact-org",
          matchCategory: "related_party",
          relationshipId: "relationship-counsel-org",
        }),
      ]),
    );
  });
});
