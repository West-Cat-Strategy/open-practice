import {
  buildContactDossiers,
  validateContactRecord,
  validateContactDataQualityResolutionRecord,
  validateContactRelationshipRecord,
  type ActivityTimelineEntry,
  type Contact,
  type ContactDataQualityResolutionRecord,
  type ContactDossier,
  type ContactRelationshipRecord,
  type IntakeVariableProposal,
  type MatterParty,
  type PortalGrant,
  type User,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  ContactDataQualityResolutionListOptions,
  ContactListOptions,
  ContactRelationshipUpdateInput,
  ContactUpdateInput,
  MatterContactAssociationUpdateInput,
} from "../contacts-contracts.js";
import type { MatterSummary } from "../matter-workspace-contracts.js";
import {
  contactInsert,
  contactRelationshipInsert,
  mapConflictCheckRow,
  mapContactDataQualityResolutionRow,
  mapContactRelationshipRow,
  mapContactRow,
  mapMatterPartyRow,
  matterPartyInsert,
} from "../drizzle-mappers.js";

export interface DrizzleContactDependencies {
  listMattersForUser(user: User): Promise<MatterSummary[]>;
  listPortalGrants(firmId: string): Promise<PortalGrant[]>;
  listIntakeVariableProposals(
    firmId: string,
    options?: { matterId?: string; status?: IntakeVariableProposal["status"] },
  ): Promise<IntakeVariableProposal[]>;
}

export async function listDrizzleContactDossiersForUser(
  db: OpenPracticeDatabase,
  user: User,
  dependencies: DrizzleContactDependencies,
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
  const firmContacts = (
    await db.select().from(schema.contacts).where(eq(schema.contacts.firmId, user.firmId))
  ).map(mapContactRow);
  const allMatterLinkedContactIds = new Set(
    (
      await db
        .select({ contactId: schema.matterParties.contactId })
        .from(schema.matterParties)
        .where(eq(schema.matterParties.firmId, user.firmId))
    ).map((party) => party.contactId),
  );
  const hasFirmWideContactVisibility = ["owner_admin", "auditor"].includes(user.role);
  const contacts = firmContacts.filter(
    (contact) =>
      hasFirmWideContactVisibility ||
      linkedContactIds.has(contact.id) ||
      (contact.createdByUserId === user.id && !allMatterLinkedContactIds.has(contact.id)),
  );
  const portalGrants = await dependencies.listPortalGrants(user.firmId);
  const intakeVariableProposals = (
    await dependencies.listIntakeVariableProposals(user.firmId, {
      status: "approved",
    })
  ).filter(
    (proposal) =>
      Boolean(proposal.appliedAt) && matters.some((matter) => matter.id === proposal.matterId),
  );
  const conflictChecks = (
    await db
      .select()
      .from(schema.conflictChecks)
      .where(eq(schema.conflictChecks.firmId, user.firmId))
  ).map(mapConflictCheckRow);
  const contactRelationships = (
    await db
      .select()
      .from(schema.contactRelationships)
      .where(eq(schema.contactRelationships.firmId, user.firmId))
  ).map(mapContactRelationshipRow);
  return buildContactDossiers({
    firmId: user.firmId,
    contacts,
    matters,
    matterParties,
    portalGrants,
    contactRelationships,
    intakeVariableProposals,
    conflictChecks,
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

export async function listDrizzleContactsForUser(
  db: OpenPracticeDatabase,
  user: User,
  dependencies: DrizzleContactDependencies,
  options: ContactListOptions = {},
): Promise<Contact[]> {
  const dossiers = await listDrizzleContactDossiersForUser(db, user, dependencies);
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 100;
  return dossiers
    .map((dossier) => dossier.contact)
    .filter((contact) => contactMatchesOptions(contact, options))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(offset, offset + limit);
}

export async function createDrizzleContact(
  db: OpenPracticeDatabase,
  contact: Contact,
): Promise<Contact> {
  validateContactRecord(contact);
  const [row] = await db.insert(schema.contacts).values(contactInsert(contact)).returning();
  return mapContactRow(row!);
}

export async function updateDrizzleContact(
  db: OpenPracticeDatabase,
  input: ContactUpdateInput,
): Promise<Contact | undefined> {
  const current = await getDrizzleContact(db, input.firmId, input.contactId);
  if (!current) return undefined;
  validateContactRecord({ ...current, ...input.updates });
  const updates = input.updates;
  const set: Partial<typeof schema.contacts.$inferInsert> = { updatedAt: new Date() };
  const nullableStringFields = [
    "canonicalName",
    "givenName",
    "middleName",
    "familyName",
    "title",
    "pronouns",
    "organizationLegalName",
    "organizationOperatingName",
    "organizationRegisteredName",
    "organizationType",
    "website",
    "preferredContactMethodId",
    "preferredLanguage",
    "timezone",
    "communicationNotes",
    "accessibilityNotes",
    "privateNotes",
    "notes",
    "updatedByUserId",
  ] as const;
  for (const field of nullableStringFields) {
    if (updates[field] !== undefined) set[field] = updates[field] ?? null;
  }
  if (updates.kind !== undefined) set.kind = updates.kind;
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.roleCategories !== undefined) set.roleCategories = updates.roleCategories;
  if (updates.displayName !== undefined) set.displayName = updates.displayName;
  if (updates.aliases !== undefined) set.aliases = updates.aliases;
  if (updates.formerNames !== undefined) set.formerNames = updates.formerNames;
  if (updates.identifiers !== undefined) set.identifiers = updates.identifiers;
  if (updates.contactMethods !== undefined) set.contactMethods = updates.contactMethods;
  if (updates.riskFlags !== undefined) set.riskFlags = updates.riskFlags;
  if (updates.conflictSensitive !== undefined) set.conflictSensitive = updates.conflictSensitive;
  if (updates.adverse !== undefined) set.adverse = updates.adverse;
  if (updates.confidentialityMarker !== undefined) {
    set.confidentialityMarker = updates.confidentialityMarker;
  }
  if (updates.doNotContact !== undefined) set.doNotContact = updates.doNotContact;
  const [row] = await db
    .update(schema.contacts)
    .set(set)
    .where(and(eq(schema.contacts.firmId, input.firmId), eq(schema.contacts.id, input.contactId)))
    .returning();
  return row ? mapContactRow(row) : undefined;
}

export async function createDrizzleContactRelationship(
  db: OpenPracticeDatabase,
  relationship: ContactRelationshipRecord,
): Promise<ContactRelationshipRecord> {
  validateContactRelationshipRecord(relationship);
  await db.insert(schema.contactRelationships).values(contactRelationshipInsert(relationship));
  return relationship;
}

export async function updateDrizzleContactRelationship(
  db: OpenPracticeDatabase,
  input: ContactRelationshipUpdateInput,
): Promise<ContactRelationshipRecord | undefined> {
  const existing = (
    await db
      .select()
      .from(schema.contactRelationships)
      .where(
        and(
          eq(schema.contactRelationships.firmId, input.firmId),
          eq(schema.contactRelationships.id, input.relationshipId),
        ),
      )
  )[0];
  if (!existing) return undefined;
  const current = mapContactRelationshipRow(existing);
  const updated: ContactRelationshipRecord = {
    ...current,
    ...input.updates,
    updatedAt: new Date().toISOString(),
  };
  validateContactRelationshipRecord(updated);
  const set: Partial<typeof schema.contactRelationships.$inferInsert> = {
    relationshipKind: updated.relationshipKind,
    label: updated.label,
    reciprocalLabel: updated.reciprocalLabel ?? null,
    matterId: updated.matterId ?? null,
    source: updated.source,
    status: updated.status,
    effectiveOn: updated.effectiveOn ? new Date(updated.effectiveOn) : null,
    endedOn: updated.endedOn ? new Date(updated.endedOn) : null,
    notes: updated.notes ?? null,
    privateNotes: updated.privateNotes ?? null,
    includeInConflictCheck: updated.includeInConflictCheck ?? true,
    updatedByUserId: updated.updatedByUserId ?? null,
    updatedAt: new Date(updated.updatedAt),
  };
  const [row] = await db
    .update(schema.contactRelationships)
    .set(set)
    .where(
      and(
        eq(schema.contactRelationships.firmId, input.firmId),
        eq(schema.contactRelationships.id, input.relationshipId),
      ),
    )
    .returning();
  return row ? mapContactRelationshipRow(row) : undefined;
}

export async function createDrizzleMatterContactAssociation(
  db: OpenPracticeDatabase,
  party: MatterParty,
): Promise<MatterParty> {
  const [contact] = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(and(eq(schema.contacts.firmId, party.firmId), eq(schema.contacts.id, party.contactId)));
  if (!contact) throw new Error("Matter-contact association contact was not found");
  const [matter] = await db
    .select({ id: schema.matters.id })
    .from(schema.matters)
    .where(and(eq(schema.matters.firmId, party.firmId), eq(schema.matters.id, party.matterId)));
  if (!matter) throw new Error("Matter-contact association matter was not found");
  const [row] = await db.insert(schema.matterParties).values(matterPartyInsert(party)).returning();
  return mapMatterPartyRow(row!);
}

export async function updateDrizzleMatterContactAssociation(
  db: OpenPracticeDatabase,
  input: MatterContactAssociationUpdateInput,
): Promise<MatterParty | undefined> {
  const updates = input.updates;
  const set: Partial<typeof schema.matterParties.$inferInsert> = { updatedAt: new Date() };
  if (updates.role !== undefined) set.role = updates.role;
  if (updates.adverse !== undefined) set.adverse = updates.adverse;
  if (updates.confidential !== undefined) set.confidential = updates.confidential;
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.side !== undefined) set.side = updates.side ?? null;
  if (updates.startedOn !== undefined) {
    set.startedOn = updates.startedOn ? new Date(updates.startedOn) : null;
  }
  if (updates.endedOn !== undefined) {
    set.endedOn = updates.endedOn ? new Date(updates.endedOn) : null;
  }
  if (updates.notes !== undefined) set.notes = updates.notes ?? null;
  if (updates.privateNotes !== undefined) set.privateNotes = updates.privateNotes ?? null;
  if (updates.conflictCheckIncluded !== undefined) {
    set.conflictCheckIncluded = updates.conflictCheckIncluded;
  }
  if (updates.updatedByUserId !== undefined) set.updatedByUserId = updates.updatedByUserId ?? null;
  const [row] = await db
    .update(schema.matterParties)
    .set(set)
    .where(
      and(
        eq(schema.matterParties.firmId, input.firmId),
        eq(schema.matterParties.id, input.associationId),
      ),
    )
    .returning();
  return row ? mapMatterPartyRow(row) : undefined;
}

export async function getDrizzleContact(
  db: OpenPracticeDatabase,
  firmId: string,
  contactId: string,
): Promise<Contact | undefined> {
  const [row] = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.firmId, firmId), eq(schema.contacts.id, contactId)));
  return row ? mapContactRow(row) : undefined;
}

export async function listDrizzleContactPortalGrantsForUser(
  db: OpenPracticeDatabase,
  user: User,
  contactId: string,
  dependencies: DrizzleContactDependencies,
): Promise<PortalGrant[]> {
  const dossiers = await listDrizzleContactDossiersForUser(db, user, dependencies);
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) return [];
  const visibleMatterIds = new Set(dossier.matters.map((matter) => matter.matterId));
  return (await dependencies.listPortalGrants(user.firmId))
    .filter(
      (grant) =>
        grant.contactId === contactId &&
        grant.firmId === user.firmId &&
        visibleMatterIds.has(grant.matterId),
    )
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

export async function listDrizzleContactTimelineForUser(
  db: OpenPracticeDatabase,
  user: User,
  contactId: string,
  dependencies: DrizzleContactDependencies,
): Promise<ActivityTimelineEntry[]> {
  const dossiers = await listDrizzleContactDossiersForUser(db, user, dependencies);
  const dossier = dossiers.find((candidate) => candidate.contact.id === contactId);
  if (!dossier) return [];
  const contact = await getDrizzleContact(db, user.firmId, contactId);
  const visibleMatterIds = new Set(dossier.matters.map((matter) => matter.matterId));
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
  for (const grant of await listDrizzleContactPortalGrantsForUser(
    db,
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
  for (const resolution of await listDrizzleContactDataQualityResolutions(db, user.firmId, {
    contactId,
  })) {
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
  return entries.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}

export async function createDrizzleContactDataQualityResolution(
  db: OpenPracticeDatabase,
  resolution: ContactDataQualityResolutionRecord,
): Promise<ContactDataQualityResolutionRecord> {
  validateContactDataQualityResolutionRecord(resolution);
  await db.insert(schema.contactDataQualityResolutions).values({
    id: resolution.id,
    firmId: resolution.firmId,
    contactId: resolution.contactId,
    signalKind: resolution.signalKind,
    decision: resolution.decision,
    resolutionNote: resolution.resolutionNote,
    matterId: resolution.matterId ?? null,
    relatedContactId: resolution.relatedContactId ?? null,
    sourceRecordId: resolution.sourceRecordId ?? null,
    recordedByUserId: resolution.recordedByUserId,
    recordedAt: new Date(resolution.recordedAt),
  });
  return resolution;
}

export async function listDrizzleContactDataQualityResolutions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: ContactDataQualityResolutionListOptions = {},
): Promise<ContactDataQualityResolutionRecord[]> {
  const filters = [eq(schema.contactDataQualityResolutions.firmId, firmId)];
  if (options.contactId) {
    filters.push(eq(schema.contactDataQualityResolutions.contactId, options.contactId));
  }
  if (options.matterId) {
    filters.push(eq(schema.contactDataQualityResolutions.matterId, options.matterId));
  }
  const rows = await db
    .select()
    .from(schema.contactDataQualityResolutions)
    .where(and(...filters))
    .orderBy(desc(schema.contactDataQualityResolutions.recordedAt));
  return rows.map(mapContactDataQualityResolutionRow);
}
