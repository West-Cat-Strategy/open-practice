import {
  buildContactTimelineTaskCues,
  buildContactDossiers,
  validateContactRecord,
  validateContactDataQualityResolutionRecord,
  validateContactRelationshipRecord,
  type ActivityTimelineEntry,
  type CalendarSchedulingRequestRecord,
  type ConflictCheckRecord,
  type Contact,
  type ContactDataQualityResolutionRecord,
  type ContactDossier,
  type ContactRelationshipRecord,
  type IntakeVariableProposal,
  type Matter,
  type MatterParty,
  type PortalGrant,
  type TaskDeadlineRecord,
  type User,
} from "@open-practice/domain";
import type {
  ContactDataQualityResolutionListOptions,
  ContactListOptions,
  ContactRelationshipUpdateInput,
  ContactUpdateInput,
  MatterContactAssociationUpdateInput,
} from "../contacts-contracts.js";
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
  listTaskDeadlines(
    firmId: string,
    options?: { matterIds?: string[]; includeCompleted?: boolean },
  ): Promise<TaskDeadlineRecord[]>;
  listCalendarSchedulingRequests(
    firmId: string,
    options?: { matterId?: string; status?: CalendarSchedulingRequestRecord["status"] },
  ): Promise<CalendarSchedulingRequestRecord[]>;
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
    matter.parties.map(({ contact, ...party }) => {
      void contact;
      return party;
    }),
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

function contactMatchesOptions(contact: Contact, options: ContactListOptions = {}): boolean {
  if (options.kind && contact.kind !== options.kind) return false;
  if (options.status && (contact.status ?? "active") !== options.status) return false;
  if (options.roleCategory && !(contact.roleCategories ?? []).includes(options.roleCategory)) {
    return false;
  }
  if (!options.search?.trim()) return true;
  const query = options.search.trim().toLowerCase();
  return [
    contact.displayName,
    contact.canonicalName,
    contact.givenName,
    contact.middleName,
    contact.familyName,
    contact.organizationLegalName,
    contact.organizationOperatingName,
    contact.organizationRegisteredName,
    ...(contact.aliases ?? []),
    ...(contact.formerNames ?? []),
    ...contact.identifiers.map((identifier) => identifier.value),
    ...(contact.contactMethods ?? []).map((method) => method.value ?? ""),
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

export async function listMemoryContactsForUser(
  store: MemoryContactStore,
  user: User,
  dependencies: MemoryContactDependencies,
  options: ContactListOptions = {},
): Promise<Contact[]> {
  const dossiers = await listMemoryContactDossiersForUser(store, user, dependencies);
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 100;
  return clone(
    dossiers
      .map((dossier) => dossier.contact)
      .filter((contact) => contactMatchesOptions(contact, options))
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .slice(offset, offset + limit),
  );
}

export function createMemoryContact(store: MemoryContactStore, contact: Contact): Contact {
  validateContactRecord(contact);
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

export function updateMemoryContact(
  store: MemoryContactStore,
  input: ContactUpdateInput,
): Contact | undefined {
  const contact = store.contacts.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.contactId,
  );
  if (!contact) return undefined;
  const updated = { ...contact, ...input.updates, updatedAt: new Date().toISOString() };
  validateContactRecord(updated);
  Object.assign(contact, updated);
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

export function updateMemoryContactRelationship(
  store: MemoryContactStore,
  input: ContactRelationshipUpdateInput,
): ContactRelationshipRecord | undefined {
  const relationship = store.contactRelationships.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.relationshipId,
  );
  if (!relationship) return undefined;
  const updated: ContactRelationshipRecord = {
    ...relationship,
    ...input.updates,
    updatedAt: new Date().toISOString(),
  };
  validateContactRelationshipRecord(updated);
  Object.assign(relationship, updated);
  return clone(relationship);
}

export function createMemoryMatterContactAssociation(
  store: MemoryContactStore,
  party: MatterParty,
): MatterParty {
  const contact = store.contacts.find(
    (candidate) => candidate.firmId === party.firmId && candidate.id === party.contactId,
  );
  if (!contact) throw new Error("Matter-contact association contact was not found");
  const matter = store.matters.find(
    (candidate) => candidate.firmId === party.firmId && candidate.id === party.matterId,
  );
  if (!matter) throw new Error("Matter-contact association matter was not found");
  if (
    store.matterParties.some(
      (candidate) => candidate.firmId === party.firmId && candidate.id === party.id,
    )
  ) {
    throw new Error(`Matter-contact association ${party.id} already exists`);
  }
  store.matterParties = [clone(party), ...store.matterParties];
  return clone(party);
}

export function updateMemoryMatterContactAssociation(
  store: MemoryContactStore,
  input: MatterContactAssociationUpdateInput,
): MatterParty | undefined {
  const party = store.matterParties.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.associationId,
  );
  if (!party) return undefined;
  Object.assign(party, input.updates, { updatedAt: new Date().toISOString() });
  return clone(party);
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

export async function listMemoryContactPortalGrantsForUser(
  store: MemoryContactStore,
  user: User,
  contactId: string,
  dependencies: MemoryContactDependencies,
): Promise<PortalGrant[]> {
  const dossiers = await listMemoryContactDossiersForUser(store, user, dependencies);
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) return [];
  const visibleMatterIds = new Set(dossier.matters.map((matter) => matter.matterId));
  return clone(
    store.portalGrants
      .filter(
        (grant) =>
          grant.firmId === user.firmId &&
          grant.contactId === contactId &&
          visibleMatterIds.has(grant.matterId),
      )
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "")),
  );
}

export async function listMemoryContactTimelineForUser(
  store: MemoryContactStore,
  user: User,
  contactId: string,
  dependencies: MemoryContactDependencies,
): Promise<ActivityTimelineEntry[]> {
  const dossiers = await listMemoryContactDossiersForUser(store, user, dependencies);
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) return [];
  const visibleMatterIds = new Set(dossier.matters.map((matter) => matter.matterId));
  const contact = store.contacts.find(
    (candidate) => candidate.firmId === user.firmId && candidate.id === contactId,
  );
  const entries: ActivityTimelineEntry[] = [];
  if (contact?.createdAt) {
    entries.push({
      id: `contact-created:${contact.id}`,
      firmId: contact.firmId,
      occurredAt: contact.createdAt,
      title: "Contact created",
      kind: "contact",
      actorId: contact.createdByUserId,
      metadata: { contactId: contact.id, kind: contact.kind },
    });
  }
  if (contact?.updatedAt) {
    entries.push({
      id: `contact-updated:${contact.id}`,
      firmId: contact.firmId,
      occurredAt: contact.updatedAt,
      title: "Contact updated",
      kind: "contact",
      actorId: contact.updatedByUserId,
      metadata: { contactId: contact.id, status: contact.status ?? "active" },
    });
  }
  for (const link of dossier.matters) {
    entries.push({
      id: `matter-contact:${link.matterId}:${contactId}`,
      firmId: user.firmId,
      matterId: link.matterId,
      occurredAt: link.startedOn ?? contact?.createdAt ?? "1970-01-01T00:00:00.000Z",
      title: "Matter association",
      kind: "contact",
      metadata: {
        contactId,
        role: link.role,
        status: link.status ?? "active",
        adverse: link.adverse,
        confidential: link.confidential,
      },
    });
  }
  for (const relationship of dossier.relationships) {
    entries.push({
      id: `relationship:${relationship.id}`,
      firmId: user.firmId,
      matterId: relationship.visibleMatterIds[0],
      occurredAt: relationship.effectiveOn ?? contact?.createdAt ?? "1970-01-01T00:00:00.000Z",
      title: "Contact relationship",
      kind: "contact",
      metadata: {
        relationshipId: relationship.id,
        relationshipKind: relationship.relationshipKind,
        status: relationship.status,
      },
    });
  }
  for (const grant of await listMemoryContactPortalGrantsForUser(
    store,
    user,
    contactId,
    dependencies,
  )) {
    entries.push({
      id: `portal-grant:${grant.id}`,
      firmId: grant.firmId,
      matterId: grant.matterId,
      occurredAt:
        grant.revokedAt ??
        grant.suspendedAt ??
        grant.activatedAt ??
        grant.invitedAt ??
        grant.createdAt ??
        "1970-01-01T00:00:00.000Z",
      title: `Portal access ${grant.status ?? "active"}`,
      kind: "portal",
      actorId: grant.updatedByUserId ?? grant.grantedByUserId,
      metadata: { portalGrantId: grant.id, contactId, status: grant.status ?? "active" },
    });
  }
  for (const resolution of store.contactDataQualityResolutions.filter(
    (candidate) => candidate.firmId === user.firmId && candidate.contactId === contactId,
  )) {
    if (resolution.matterId && !visibleMatterIds.has(resolution.matterId)) continue;
    entries.push({
      id: `contact-quality:${resolution.id}`,
      firmId: resolution.firmId,
      matterId: resolution.matterId,
      occurredAt: resolution.recordedAt,
      title: "Data-quality resolution",
      kind: "audit",
      actorId: resolution.recordedByUserId,
      metadata: {
        contactId,
        signalKind: resolution.signalKind,
        decision: resolution.decision,
      },
    });
  }
  const visibleMatterIdList = [...visibleMatterIds].sort();
  const tasks =
    visibleMatterIdList.length > 0
      ? await dependencies.listTaskDeadlines(user.firmId, {
          matterIds: visibleMatterIdList,
          includeCompleted: false,
        })
      : [];
  const schedulingRequests =
    visibleMatterIdList.length > 0
      ? (
          await Promise.all(
            visibleMatterIdList.map((matterId) =>
              dependencies.listCalendarSchedulingRequests(user.firmId, {
                matterId,
                status: "needs_review",
              }),
            ),
          )
        ).flat()
      : [];
  entries.push(
    ...buildContactTimelineTaskCues({
      contactId,
      firmId: user.firmId,
      tasks,
      schedulingRequests,
      userId: user.id,
      visibleMatterIds: visibleMatterIdList,
    }),
  );
  return entries.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
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
