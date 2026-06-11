import {
  buildContactDossiers,
  validateContactDataQualityResolutionRecord,
  validateContactRelationshipRecord,
  type Contact,
  type ContactDataQualityResolutionRecord,
  type ContactDossier,
  type ContactRelationshipRecord,
  type IntakeVariableProposal,
  type PortalGrant,
  type User,
} from "@open-practice/domain";
import { and, desc, eq } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { ContactDataQualityResolutionListOptions } from "../contacts-contracts.js";
import type { MatterSummary } from "../matter-workspace-contracts.js";
import {
  mapConflictCheckRow,
  mapContactDataQualityResolutionRow,
  mapContactRelationshipRow,
  mapContactRow,
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

export async function createDrizzleContact(
  db: OpenPracticeDatabase,
  contact: Contact,
): Promise<Contact> {
  const [row] = await db
    .insert(schema.contacts)
    .values({
      id: contact.id,
      firmId: contact.firmId,
      kind: contact.kind,
      displayName: contact.displayName,
      aliases: contact.aliases,
      identifiers: contact.identifiers,
      notes: contact.notes ?? null,
      createdByUserId: contact.createdByUserId ?? null,
    })
    .returning();
  return mapContactRow(row!);
}

export async function createDrizzleContactRelationship(
  db: OpenPracticeDatabase,
  relationship: ContactRelationshipRecord,
): Promise<ContactRelationshipRecord> {
  validateContactRelationshipRecord(relationship);
  await db.insert(schema.contactRelationships).values({
    id: relationship.id,
    firmId: relationship.firmId,
    contactId: relationship.contactId,
    relatedContactId: relationship.relatedContactId,
    relationshipKind: relationship.relationshipKind,
    label: relationship.label,
    matterId: relationship.matterId ?? null,
    source: relationship.source,
    status: relationship.status,
    createdAt: new Date(relationship.createdAt),
    updatedAt: new Date(relationship.updatedAt),
  });
  return relationship;
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
