import { describe, expect, it } from "vitest";
import type { Contact, MatterParty, ProfessionalRole, User } from "@open-practice/domain";
import {
  sampleContacts,
  sampleMatterParties,
  sampleUsers,
} from "@open-practice/domain/sample-data";
import {
  listDrizzleContactsForUser,
  type DrizzleContactDependencies,
} from "../src/repository/contacts/drizzle.js";
import { contactInsert, matterPartyInsert } from "../src/repository/drizzle-mappers.js";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import * as schema from "../src/schema.js";

type ContactListDb = Parameters<typeof listDrizzleContactsForUser>[0];

const standaloneContact: Contact = {
  id: "contact-standalone-creator",
  firmId: "firm-west-legal",
  kind: "person",
  displayName: "Synthetic Standalone Contact",
  aliases: ["Standalone Synthetic"],
  identifiers: [{ type: "email", value: "standalone@example.test" }],
  contactMethods: [
    {
      id: "method-standalone-email",
      type: "email",
      label: "work",
      value: "standalone@example.test",
    },
  ],
  createdByUserId: "user-staff",
};

function user(
  role: ProfessionalRole,
  assignedMatterIds: string[] = ["matter-001", "matter-002"],
): User {
  const sample = sampleUsers.find((candidate) => candidate.role === role);
  return {
    id: sample?.id ?? `user-${role}`,
    firmId: "firm-west-legal",
    displayName: sample?.displayName ?? `Test ${role}`,
    email: sample?.email ?? `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function contactRows(contacts: Contact[]) {
  return contacts.map((contact) => contactInsert(contact));
}

function matterPartyRows(parties: MatterParty[]) {
  return parties.map((party) => matterPartyInsert(party));
}

function contactListDbWithRows(input: {
  contacts: Contact[];
  matterPartyResponses?: Array<Array<MatterParty>>;
}) {
  const tableReads: string[] = [];
  let matterPartyReadIndex = 0;
  const contactRowSet = contactRows(input.contacts);
  const matterPartyRowSets = (input.matterPartyResponses ?? []).map(matterPartyRows);
  const tableLabel = (table: unknown) => {
    if (table === schema.contacts) return "contacts";
    if (table === schema.matterParties) return "matter_parties";
    if (table === schema.conflictChecks) return "conflict_checks";
    if (table === schema.contactRelationships) return "contact_relationships";
    return "unknown";
  };
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          tableReads.push(tableLabel(table));
          if (table === schema.contacts) return contactRowSet;
          if (table === schema.matterParties) {
            return matterPartyRowSets[matterPartyReadIndex++] ?? [];
          }
          return [];
        },
      }),
    }),
  } as unknown as ContactListDb;
  return { db, tableReads };
}

function throwingDossierDependencies() {
  const calls: string[] = [];
  const fail = (name: string) => async () => {
    calls.push(name);
    throw new Error(`listDrizzleContactsForUser called dossier dependency ${name}`);
  };
  const dependencies: DrizzleContactDependencies = {
    listMattersForUser: fail("listMattersForUser"),
    listPortalGrants: fail("listPortalGrants"),
    listTaskDeadlines: fail("listTaskDeadlines"),
    listCalendarSchedulingRequests: fail("listCalendarSchedulingRequests"),
    listIntakeVariableProposals: fail("listIntakeVariableProposals"),
  };
  return { dependencies, calls };
}

async function memoryContactIds(authUser: User, options = {}) {
  const repository = new InMemoryOpenPracticeRepository();
  await repository.createContact(standaloneContact);
  return (await repository.listContactsForUser(authUser, options)).map((contact) => contact.id);
}

describe("Drizzle contact list repository", () => {
  it("lists firm-wide contacts directly without dossier-only hydration", async () => {
    const authUser = { ...user("owner_admin", []), id: "user-admin" };
    const { db, tableReads } = contactListDbWithRows({
      contacts: [...sampleContacts, standaloneContact],
    });
    const { dependencies, calls } = throwingDossierDependencies();

    const contacts = await listDrizzleContactsForUser(db, authUser, dependencies);

    expect(contacts.map((contact) => contact.id)).toEqual(await memoryContactIds(authUser));
    expect(tableReads).toEqual(["contacts"]);
    expect(tableReads).not.toContain("conflict_checks");
    expect(tableReads).not.toContain("contact_relationships");
    expect(calls).toEqual([]);
  });

  it("derives matter-scoped contact lists from assigned matter parties and standalone creator contacts", async () => {
    const licensee = { ...user("licensee", ["matter-001"]), id: "user-licensee" };
    const staffCreator = { ...user("firm_member", []), id: "user-staff" };
    const allContacts = [...sampleContacts, standaloneContact];
    const matterOneParties = sampleMatterParties.filter((party) => party.matterId === "matter-001");
    const licenseeCreatedLinkedParties = sampleMatterParties.filter((party) =>
      ["contact-ada", "contact-river"].includes(party.contactId),
    );

    const licenseeDb = contactListDbWithRows({
      contacts: allContacts,
      matterPartyResponses: [matterOneParties, licenseeCreatedLinkedParties],
    });
    const staffDb = contactListDbWithRows({
      contacts: allContacts,
      matterPartyResponses: [[]],
    });
    const { dependencies } = throwingDossierDependencies();

    const licenseeContacts = await listDrizzleContactsForUser(
      licenseeDb.db,
      licensee,
      dependencies,
    );
    const staffContacts = await listDrizzleContactsForUser(staffDb.db, staffCreator, dependencies);

    expect(licenseeContacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contact-ada" }),
        expect.objectContaining({ id: "contact-river" }),
      ]),
    );
    expect(staffContacts).toEqual([expect.objectContaining({ id: "contact-standalone-creator" })]);
    expect(licenseeContacts.map((contact) => contact.id)).toEqual(await memoryContactIds(licensee));
    expect(staffContacts.map((contact) => contact.id)).toEqual(
      await memoryContactIds(staffCreator),
    );
    expect(licenseeDb.tableReads).toEqual([
      "matter_parties",
      "contacts",
      "matter_parties",
      "contacts",
    ]);
    expect(staffDb.tableReads).toEqual(["contacts", "matter_parties"]);
  });

  it("keeps hidden matter contacts out of search and preserves memory ordering/filter semantics", async () => {
    const licensee = { ...user("licensee", ["matter-001"]), id: "user-licensee" };
    const owner = { ...user("owner_admin", []), id: "user-admin" };
    const allContacts = [...sampleContacts, standaloneContact];
    const matterOneParties = sampleMatterParties.filter((party) => party.matterId === "matter-001");
    const licenseeCreatedLinkedParties = sampleMatterParties.filter((party) =>
      ["contact-ada", "contact-river"].includes(party.contactId),
    );
    const { dependencies, calls } = throwingDossierDependencies();

    const hiddenSearchDb = contactListDbWithRows({
      contacts: allContacts,
      matterPartyResponses: [matterOneParties, licenseeCreatedLinkedParties],
    });
    const ownerSearchDb = contactListDbWithRows({ contacts: allContacts });

    await expect(
      listDrizzleContactsForUser(hiddenSearchDb.db, licensee, dependencies, { search: "North" }),
    ).resolves.toEqual([]);
    await expect(
      listDrizzleContactsForUser(ownerSearchDb.db, owner, dependencies, { search: "North" }).then(
        (contacts) => contacts.map((contact) => contact.id),
      ),
    ).resolves.toEqual(await memoryContactIds(owner, { search: "North" }));
    expect(calls).toEqual([]);
    expect(hiddenSearchDb.tableReads).not.toContain("conflict_checks");
    expect(hiddenSearchDb.tableReads).not.toContain("contact_relationships");
  });
});
