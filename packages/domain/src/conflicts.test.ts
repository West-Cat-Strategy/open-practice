import { describe, expect, it } from "vitest";
import { runConflictCheck } from "./conflicts.js";
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
});
