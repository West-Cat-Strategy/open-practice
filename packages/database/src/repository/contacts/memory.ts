import {
  buildContactDossiers,
  validateContactDataQualityResolutionRecord,
  validateContactRelationshipRecord,
  type ConflictCheckRecord,
  type Contact,
  type ContactDataQualityResolutionRecord,
  type ContactDossier,
  type ContactRelationshipRecord,
  type IntakeVariableProposal,
  type Matter,
  type MatterParty,
  type PortalGrant,
  type User,
} from "@open-practice/domain";
import type { ContactDataQualityResolutionListOptions } from "../contacts-contracts.js";
import { clone } from "../contracts.js";
import type { MatterSummary } from "../matter-workspace-contracts.js";

export interface MemoryContactStore {
  contacts: Contact[];
  matters: Matter[];
  matterParties: MatterParty[];
  portalGrants: PortalGrant[];
  contactRelationships: ContactRelationshipRecord[];
  intakeVariableProposals: IntakeVariableProposal[];
  conflictChecks: ConflictCheckRecord[];
  contactDataQualityResolutions: ContactDataQualityResolutionRecord[];
}

export interface MemoryContactDependencies {
  listMattersForUser(user: User): Promise<MatterSummary[]>;
}

export async function listMemoryContactDossiersForUser(
  store: MemoryContactStore,
  user: User,
  dependencies: MemoryContactDependencies,
): Promise<ContactDossier[]> {
  const matters = await dependencies.listMattersForUser(user);
  const linkedContactIds = new Set(
    matters.flatMap((matter) => matter.parties.map((party) => party.contactId)),
  );
  const matterParties = matters.flatMap((matter) =>
    matter.parties.map((party) => ({
      id: party.id,
      firmId: party.firmId,
      matterId: party.matterId,
      contactId: party.contactId,
      role: party.role,
      adverse: party.adverse,
      confidential: party.confidential,
    })),
  );
  const hasFirmWideContactVisibility = ["owner_admin", "auditor"].includes(user.role);
  const allMatterLinkedContactIds = new Set(
    store.matterParties
      .filter((party) => party.firmId === user.firmId)
      .map((party) => party.contactId),
  );
  const contacts = store.contacts.filter(
    (contact) =>
      contact.firmId === user.firmId &&
      (hasFirmWideContactVisibility ||
        linkedContactIds.has(contact.id) ||
        (contact.createdByUserId === user.id && !allMatterLinkedContactIds.has(contact.id))),
  );
  const intakeVariableProposals = store.intakeVariableProposals.filter(
    (proposal) =>
      proposal.firmId === user.firmId &&
      proposal.status === "approved" &&
      Boolean(proposal.appliedAt) &&
      matters.some((matter) => matter.id === proposal.matterId),
  );
  return buildContactDossiers({
    firmId: user.firmId,
    contacts,
    matters,
    matterParties,
    portalGrants: store.portalGrants,
    contactRelationships: store.contactRelationships,
    intakeVariableProposals,
    conflictChecks: store.conflictChecks,
  });
}

export function createMemoryContact(store: MemoryContactStore, contact: Contact): Contact {
  if (
    store.contacts.some(
      (candidate) => candidate.firmId === contact.firmId && candidate.id === contact.id,
    )
  ) {
    throw new Error(`Contact ${contact.id} already exists`);
  }
  store.contacts = [clone(contact), ...store.contacts];
  return clone(contact);
}

export function createMemoryContactRelationship(
  store: MemoryContactStore,
  relationship: ContactRelationshipRecord,
): ContactRelationshipRecord {
  const contact = store.contacts.find(
    (candidate) =>
      candidate.firmId === relationship.firmId && candidate.id === relationship.contactId,
  );
  if (!contact) throw new Error("Contact relationship contact was not found");
  const related = store.contacts.find(
    (candidate) =>
      candidate.firmId === relationship.firmId && candidate.id === relationship.relatedContactId,
  );
  if (!related) throw new Error("Contact relationship related contact was not found");
  if (relationship.matterId) {
    const matter = store.matters.find(
      (candidate) =>
        candidate.firmId === relationship.firmId && candidate.id === relationship.matterId,
    );
    if (!matter) throw new Error("Contact relationship matter was not found");
  }
  validateContactRelationshipRecord(relationship);
  store.contactRelationships = [...store.contactRelationships, clone(relationship)];
  return clone(relationship);
}

export function getMemoryContact(
  store: MemoryContactStore,
  firmId: string,
  contactId: string,
): Contact | undefined {
  return clone(
    store.contacts.find((contact) => contact.firmId === firmId && contact.id === contactId),
  );
}

export function createMemoryContactDataQualityResolution(
  store: MemoryContactStore,
  resolution: ContactDataQualityResolutionRecord,
): ContactDataQualityResolutionRecord {
  const contact = store.contacts.find(
    (candidate) => candidate.firmId === resolution.firmId && candidate.id === resolution.contactId,
  );
  if (!contact) throw new Error("Contact quality resolution contact was not found");
  if (resolution.matterId) {
    const matter = store.matters.find(
      (candidate) => candidate.firmId === resolution.firmId && candidate.id === resolution.matterId,
    );
    if (!matter) throw new Error("Contact quality resolution matter was not found");
  }
  if (resolution.relatedContactId) {
    const related = store.contacts.find(
      (candidate) =>
        candidate.firmId === resolution.firmId && candidate.id === resolution.relatedContactId,
    );
    if (!related) throw new Error("Related contact was not found");
  }
  validateContactDataQualityResolutionRecord(resolution);
  store.contactDataQualityResolutions = [...store.contactDataQualityResolutions, clone(resolution)];
  return clone(resolution);
}

export function listMemoryContactDataQualityResolutions(
  store: MemoryContactStore,
  firmId: string,
  options: ContactDataQualityResolutionListOptions = {},
): ContactDataQualityResolutionRecord[] {
  return clone(
    store.contactDataQualityResolutions
      .filter(
        (resolution) =>
          resolution.firmId === firmId &&
          (!options.contactId || resolution.contactId === options.contactId) &&
          (!options.matterId || resolution.matterId === options.matterId),
      )
      .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt)),
  );
}
