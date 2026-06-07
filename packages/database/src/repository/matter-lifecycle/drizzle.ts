import {
  appendAuditEvent,
  type ContactIdentifier,
  type Matter,
  type PublicConsultationIntakeRecord,
  type User,
} from "@open-practice/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  ConvertPublicConsultationIntakeInput,
  CreateMatterWithClientInput,
} from "../matter-lifecycle-contracts.js";
import type { MatterSummary } from "../matter-workspace-contracts.js";
import { mapMatter } from "../drizzle-mappers.js";
import { mapPublicConsultationIntakeRow } from "../public-consultation-intakes/mappers.js";

export interface DrizzleMatterLifecycleDependencies {
  getUser(firmId: string, userId: string): Promise<User | undefined>;
  listMattersForUser(user: User): Promise<MatterSummary[]>;
}

function nextMatterNumber(
  matters: Array<Pick<Matter, "firmId" | "number">>,
  firmId: string,
  openedOn: string,
): string {
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

export async function createDrizzleMatterWithClient(
  db: OpenPracticeDatabase,
  input: CreateMatterWithClientInput,
  dependencies: DrizzleMatterLifecycleDependencies,
): Promise<MatterSummary> {
  await db.transaction(async (tx) => {
    const existingMatters = await tx
      .select()
      .from(schema.matters)
      .where(eq(schema.matters.firmId, input.firmId));
    const matter: Matter = {
      id: input.matterId,
      firmId: input.firmId,
      number: nextMatterNumber(existingMatters.map(mapMatter), input.firmId, input.openedOn),
      title: input.title,
      practiceArea: input.practiceArea,
      status: "intake",
      jurisdiction: input.jurisdiction,
      responsibleUserId: input.actorUserId,
      openedOn: input.openedOn,
    };

    await tx.insert(schema.contacts).values({
      id: input.contactId,
      firmId: input.firmId,
      kind: input.client.kind,
      displayName: input.client.displayName,
      aliases: [],
      identifiers: input.client.identifiers,
    });
    await tx.insert(schema.matters).values({
      ...matter,
      openedOn: new Date(input.openedOn),
      closedOn: null,
    });
    await tx.insert(schema.matterAssignments).values({
      matterId: input.matterId,
      userId: input.actorUserId,
    });
    await tx.insert(schema.matterParties).values({
      id: input.partyId,
      firmId: input.firmId,
      matterId: input.matterId,
      contactId: input.contactId,
      role: "prospective_client",
      adverse: false,
      confidential: true,
    });

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.firmId}, 0))`);
    const [previousRow] = await tx
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, input.firmId))
      .orderBy(desc(schema.auditEvents.sequence))
      .limit(1);
    const previous = previousRow
      ? {
          ...previousRow,
          occurredAt: previousRow.occurredAt.toISOString(),
          metadata: previousRow.metadata as Record<string, unknown>,
        }
      : undefined;
    const audit = appendAuditEvent(previous, {
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
        clientContactCreated: true,
        partyRole: "prospective_client",
      },
    });
    await tx.insert(schema.auditEvents).values({
      ...audit,
      occurredAt: new Date(audit.occurredAt),
      metadata: audit.metadata,
    });
  });

  const actor = await dependencies.getUser(input.firmId, input.actorUserId);
  if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);
  const created = (await dependencies.listMattersForUser(actor)).find(
    (matter) => matter.id === input.matterId,
  );
  if (!created) throw new Error(`Created matter ${input.matterId} was not visible`);
  return created;
}

export async function convertDrizzlePublicConsultationIntakeToMatter(
  db: OpenPracticeDatabase,
  input: ConvertPublicConsultationIntakeInput,
  dependencies: DrizzleMatterLifecycleDependencies,
): Promise<{ intake: PublicConsultationIntakeRecord; matter: MatterSummary }> {
  const intake = await db.transaction(async (tx) => {
    const [actorRow] = await tx
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.firmId, input.firmId), eq(schema.users.id, input.actorUserId)));
    if (!actorRow) throw new Error(`Unknown user ${input.actorUserId}`);

    const [intakeRow] = await tx
      .select()
      .from(schema.publicConsultationIntakes)
      .where(
        and(
          eq(schema.publicConsultationIntakes.firmId, input.firmId),
          eq(schema.publicConsultationIntakes.id, input.intakeId),
        ),
      );
    if (!intakeRow) throw new Error(`Public consultation intake ${input.intakeId} not found`);
    const currentIntake = mapPublicConsultationIntakeRow(intakeRow);
    if (currentIntake.status !== "pending") {
      throw new Error("PUBLIC_CONSULTATION_INTAKE_NOT_PENDING");
    }

    const existingMatters = await tx
      .select()
      .from(schema.matters)
      .where(eq(schema.matters.firmId, input.firmId));
    const matter: Matter = {
      id: input.matterId,
      firmId: input.firmId,
      number: nextMatterNumber(existingMatters.map(mapMatter), input.firmId, input.openedOn),
      title: input.title,
      practiceArea: input.practiceArea,
      status: "intake",
      jurisdiction: input.jurisdiction,
      responsibleUserId: input.actorUserId,
      openedOn: input.openedOn,
    };
    const clientIdentifiers: ContactIdentifier[] = [];
    if (currentIntake.email) {
      clientIdentifiers.push({ type: "email", value: currentIntake.email });
    }
    if (currentIntake.telephone) {
      clientIdentifiers.push({ type: "phone", value: currentIntake.telephone });
    }

    await tx.insert(schema.contacts).values({
      id: input.clientContactId,
      firmId: input.firmId,
      kind: "person",
      displayName: currentIntake.clientName,
      aliases: [],
      identifiers: clientIdentifiers,
    });
    if (input.opposingParties.length > 0) {
      await tx.insert(schema.contacts).values(
        input.opposingParties.map((party) => ({
          id: party.contactId,
          firmId: input.firmId,
          kind: "person" as const,
          displayName: party.displayName,
          aliases: [],
          identifiers: [],
        })),
      );
    }
    await tx.insert(schema.matters).values({
      ...matter,
      openedOn: new Date(input.openedOn),
      closedOn: null,
    });
    await tx.insert(schema.matterAssignments).values({
      matterId: input.matterId,
      userId: input.actorUserId,
    });
    await tx.insert(schema.matterParties).values([
      {
        id: input.clientPartyId,
        firmId: input.firmId,
        matterId: input.matterId,
        contactId: input.clientContactId,
        role: "prospective_client",
        adverse: false,
        confidential: true,
      },
      ...input.opposingParties.map((party) => ({
        id: party.partyId,
        firmId: input.firmId,
        matterId: input.matterId,
        contactId: party.contactId,
        role: "opposing_party" as const,
        adverse: true,
        confidential: false,
      })),
    ]);

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.firmId}, 0))`);
    const [previousRow] = await tx
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, input.firmId))
      .orderBy(desc(schema.auditEvents.sequence))
      .limit(1);
    const previous = previousRow
      ? {
          ...previousRow,
          occurredAt: previousRow.occurredAt.toISOString(),
          metadata: previousRow.metadata as Record<string, unknown>,
        }
      : undefined;
    const audit = appendAuditEvent(previous, {
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
        opposingPartyCount: input.opposingParties.length,
      },
    });
    await tx.insert(schema.auditEvents).values({
      ...audit,
      occurredAt: new Date(audit.occurredAt),
      metadata: audit.metadata,
    });

    const [updatedIntakeRow] = await tx
      .update(schema.publicConsultationIntakes)
      .set({
        status: "converted",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(input.occurredAt),
        convertedMatterId: input.matterId,
        metadata: {
          ...currentIntake.metadata,
          convertedMatterId: input.matterId,
          opposingPartyCount: input.opposingParties.length,
        },
      })
      .where(
        and(
          eq(schema.publicConsultationIntakes.firmId, input.firmId),
          eq(schema.publicConsultationIntakes.id, input.intakeId),
        ),
      )
      .returning();
    return mapPublicConsultationIntakeRow(updatedIntakeRow);
  });

  const actor = await dependencies.getUser(input.firmId, input.actorUserId);
  if (!actor) throw new Error(`Unknown user ${input.actorUserId}`);
  const created = (await dependencies.listMattersForUser(actor)).find(
    (matter) => matter.id === input.matterId,
  );
  if (!created) throw new Error(`Created matter ${input.matterId} was not visible`);
  return { intake, matter: created };
}
