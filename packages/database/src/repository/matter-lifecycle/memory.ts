import {
  buildMatterLifecycleTransitionAuditMetadata,
  buildMatterLifecycleTransitionRecord,
  type AuditEvent,
  type Contact,
  type ContactIdentifier,
  type Matter,
  type MatterLifecycleTransitionRecord,
  type MatterParty,
  type NewAuditEvent,
  type PublicConsultationIntakeRecord,
  type User,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import type {
  ConvertPublicConsultationIntakeInput,
  CreateMatterWithClientInput,
} from "../matter-lifecycle-contracts.js";
import type { MatterSummary } from "../matter-workspace-contracts.js";

export interface MemoryMatterLifecycleStore {
  users: User[];
  contacts: Contact[];
  matters: Matter[];
  matterParties: MatterParty[];
  publicConsultationIntakes: PublicConsultationIntakeRecord[];
  matterLifecycleTransitions: MatterLifecycleTransitionRecord[];
}

export interface MemoryMatterLifecycleDependencies {
  appendAuditEvent(event: NewAuditEvent): Promise<AuditEvent>;
  listMattersForUser(user: User): Promise<MatterSummary[]>;
}

function nextMatterNumber(matters: Matter[], firmId: string, openedOn: string): string {
  const year = new Date(openedOn).getUTCFullYear();
  const prefix = `${year}-`;
  const maxExisting = matters
    .filter((matter) => matter.firmId === firmId && matter.number.startsWith(prefix))
    .reduce((max, matter) => {
      const value = Number.parseInt(matter.number.slice(prefix.length), 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
  return `${prefix}${String(maxExisting + 1).padStart(4, "0")}`;
}

export async function createMemoryMatterWithClient(
  store: MemoryMatterLifecycleStore,
  input: CreateMatterWithClientInput,
  dependencies: MemoryMatterLifecycleDependencies,
): Promise<MatterSummary> {
  const actor = store.users.find(
    (user) => user.firmId === input.firmId && user.id === input.actorUserId,
  );
  if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);

  const matter: Matter = {
    id: input.matterId,
    firmId: input.firmId,
    number: nextMatterNumber(store.matters, input.firmId, input.openedOn),
    title: input.title,
    practiceArea: input.practiceArea,
    status: "intake",
    jurisdiction: input.jurisdiction,
    responsibleUserId: input.actorUserId,
    openedOn: input.openedOn,
  };
  const existingContact = store.contacts.find(
    (contact) => contact.firmId === input.firmId && contact.id === input.contactId,
  );
  if (!input.client && !existingContact) {
    throw new Error(`Contact ${input.contactId} was not found`);
  }
  const contact: Contact | undefined = input.client
    ? {
        id: input.contactId,
        firmId: input.firmId,
        kind: input.client.kind,
        displayName: input.client.displayName,
        aliases: [],
        identifiers: input.client.identifiers,
        createdByUserId: input.actorUserId,
      }
    : undefined;
  const party: MatterParty = {
    id: input.partyId,
    firmId: input.firmId,
    matterId: input.matterId,
    contactId: input.contactId,
    role: "prospective_client",
    adverse: false,
    confidential: true,
  };

  if (contact) store.contacts = [clone(contact), ...store.contacts];
  store.matters = [clone(matter), ...store.matters];
  store.matterParties = [clone(party), ...store.matterParties];
  store.users = store.users.map((user) =>
    user.firmId === input.firmId && user.id === input.actorUserId
      ? {
          ...user,
          assignedMatterIds: Array.from(new Set([input.matterId, ...user.assignedMatterIds])),
        }
      : user,
  );
  await dependencies.appendAuditEvent({
    id: input.auditEventId,
    firmId: input.firmId,
    actorId: input.actorUserId,
    action: "matter.opened",
    resourceType: "matter",
    resourceId: input.matterId,
    occurredAt: input.occurredAt,
    metadata: {
      matterId: input.matterId,
      source: "dashboard_zero_matter",
      clientContactCreated: Boolean(input.client),
      partyRole: "prospective_client",
    },
  });

  const [created] = await dependencies.listMattersForUser({
    ...actor,
    assignedMatterIds: Array.from(new Set([input.matterId, ...actor.assignedMatterIds])),
  });
  const summary = created?.id === input.matterId ? created : undefined;
  if (!summary) throw new Error(`Created matter ${input.matterId} was not visible`);
  return summary;
}

export async function convertMemoryPublicConsultationIntakeToMatter(
  store: MemoryMatterLifecycleStore,
  input: ConvertPublicConsultationIntakeInput,
  dependencies: MemoryMatterLifecycleDependencies,
): Promise<{ intake: PublicConsultationIntakeRecord; matter: MatterSummary }> {
  const actor = store.users.find(
    (user) => user.firmId === input.firmId && user.id === input.actorUserId,
  );
  if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);
  const intakeIndex = store.publicConsultationIntakes.findIndex(
    (intake) => intake.firmId === input.firmId && intake.id === input.intakeId,
  );
  if (intakeIndex < 0) throw new Error(`Public consultation intake ${input.intakeId} not found`);
  const intake = store.publicConsultationIntakes[intakeIndex];
  if (intake.status !== "pending") throw new Error("PUBLIC_CONSULTATION_INTAKE_NOT_PENDING");

  const clientIdentifiers: ContactIdentifier[] = [];
  if (intake.email) clientIdentifiers.push({ type: "email", value: intake.email });
  if (intake.telephone) clientIdentifiers.push({ type: "phone", value: intake.telephone });

  const matter: Matter = {
    id: input.matterId,
    firmId: input.firmId,
    number: nextMatterNumber(store.matters, input.firmId, input.openedOn),
    title: input.title,
    practiceArea: input.practiceArea,
    status: "intake",
    jurisdiction: input.jurisdiction,
    responsibleUserId: input.actorUserId,
    openedOn: input.openedOn,
  };
  const clientContact: Contact = {
    id: input.clientContactId,
    firmId: input.firmId,
    kind: "person",
    displayName: intake.clientName,
    aliases: [],
    identifiers: clientIdentifiers,
    createdByUserId: input.actorUserId,
  };
  const clientParty: MatterParty = {
    id: input.clientPartyId,
    firmId: input.firmId,
    matterId: input.matterId,
    contactId: input.clientContactId,
    role: "prospective_client",
    adverse: false,
    confidential: true,
  };
  const opposingContacts: Contact[] = input.opposingParties.map((party) => ({
    id: party.contactId,
    firmId: input.firmId,
    kind: "person",
    displayName: party.displayName,
    aliases: [],
    identifiers: [],
    createdByUserId: input.actorUserId,
  }));
  const opposingMatterParties: MatterParty[] = input.opposingParties.map((party) => ({
    id: party.partyId,
    firmId: input.firmId,
    matterId: input.matterId,
    contactId: party.contactId,
    role: "opposing_party",
    adverse: true,
    confidential: false,
  }));

  store.contacts = [clone(clientContact), ...opposingContacts.map(clone), ...store.contacts];
  store.matters = [clone(matter), ...store.matters];
  store.matterParties = [
    clone(clientParty),
    ...opposingMatterParties.map(clone),
    ...store.matterParties,
  ];
  store.users = store.users.map((user) =>
    user.firmId === input.firmId && user.id === input.actorUserId
      ? {
          ...user,
          assignedMatterIds: Array.from(new Set([input.matterId, ...user.assignedMatterIds])),
        }
      : user,
  );
  const reviewedIntake: PublicConsultationIntakeRecord = {
    ...intake,
    status: "converted",
    reviewedByUserId: input.actorUserId,
    reviewedAt: input.occurredAt,
    convertedMatterId: input.matterId,
    metadata: {
      ...intake.metadata,
      convertedMatterId: input.matterId,
      opposingPartyCount: opposingMatterParties.length,
    },
  };
  store.publicConsultationIntakes[intakeIndex] = clone(reviewedIntake);

  await dependencies.appendAuditEvent({
    id: input.auditEventId,
    firmId: input.firmId,
    actorId: input.actorUserId,
    action: "matter.opened",
    resourceType: "matter",
    resourceId: input.matterId,
    occurredAt: input.occurredAt,
    metadata: {
      matterId: input.matterId,
      source: "public_consultation_intake",
      publicConsultationIntakeId: input.intakeId,
      clientContactCreated: true,
      partyRole: "prospective_client",
      opposingPartyCount: opposingMatterParties.length,
    },
  });

  const [created] = await dependencies.listMattersForUser({
    ...actor,
    assignedMatterIds: Array.from(new Set([input.matterId, ...actor.assignedMatterIds])),
  });
  const summary = created?.id === input.matterId ? created : undefined;
  if (!summary) throw new Error(`Created matter ${input.matterId} was not visible`);
  return { intake: clone(reviewedIntake), matter: summary };
}

export function listMemoryMatterLifecycleTransitions(
  store: MemoryMatterLifecycleStore,
  firmId: string,
  matterId: string,
): MatterLifecycleTransitionRecord[] {
  return clone(
    store.matterLifecycleTransitions
      .filter((record) => record.firmId === firmId && record.matterId === matterId)
      .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt)),
  );
}

export async function createMemoryMatterLifecycleTransition(
  store: MemoryMatterLifecycleStore,
  input: Parameters<
    import("../matter-lifecycle-contracts.js").MatterLifecycleRepository["createMatterLifecycleTransition"]
  >[0],
  dependencies: MemoryMatterLifecycleDependencies,
): Promise<MatterLifecycleTransitionRecord> {
  const matter = store.matters.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.matterId,
  );
  if (!matter) throw new Error(`Matter ${input.matterId} was not found`);
  const reviewer = store.users.find(
    (user) => user.firmId === input.firmId && user.id === input.reviewedByUserId,
  );
  if (!reviewer) throw new Error(`Unknown user ${input.reviewedByUserId}`);
  const record = buildMatterLifecycleTransitionRecord({
    id: input.id,
    firmId: input.firmId,
    matterId: input.matterId,
    transition: input.transition,
    currentStatus: matter.status,
    readiness: input.readiness,
    reason: input.reason,
    blockers: input.blockers,
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: input.reviewedAt,
    createdAt: input.createdAt,
  });
  store.matterLifecycleTransitions = [clone(record), ...store.matterLifecycleTransitions];
  await dependencies.appendAuditEvent({
    id: input.auditEventId,
    firmId: input.firmId,
    actorId: input.reviewedByUserId,
    action: "matter.lifecycle_transition_reviewed",
    resourceType: "matter",
    resourceId: input.matterId,
    occurredAt: input.reviewedAt,
    metadata: buildMatterLifecycleTransitionAuditMetadata(record),
  });
  return clone(record);
}
