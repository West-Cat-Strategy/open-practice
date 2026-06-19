import {
  appendAuditEvent,
  buildMatterLifecycleCommandAuditMetadata,
  buildMatterLifecycleCommandExecution,
  buildMatterLifecycleTransitionAuditMetadata,
  buildMatterLifecycleTransitionRecord,
  matterLifecycleCommandRequiredStatus,
  matterLifecycleTargetStatus,
  type ContactIdentifier,
  type Matter,
  type MatterLifecycleTransitionRecord,
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
import { MatterLifecycleCommandError } from "../matter-lifecycle-contracts.js";
import type { MatterSummary } from "../matter-workspace-contracts.js";
import { mapMatter, mapMatterLifecycleTransitionRow } from "../drizzle-mappers.js";
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

    if (input.client) {
      await tx.insert(schema.contacts).values({
        id: input.contactId,
        firmId: input.firmId,
        kind: input.client.kind,
        displayName: input.client.displayName,
        aliases: [],
        identifiers: input.client.identifiers,
        createdByUserId: input.actorUserId,
      });
    } else {
      const [existingContact] = await tx
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(eq(schema.contacts.firmId, input.firmId), eq(schema.contacts.id, input.contactId)),
        );
      if (!existingContact) throw new Error(`Contact ${input.contactId} was not found`);
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
        clientContactCreated: Boolean(input.client),
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
      createdByUserId: input.actorUserId,
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
          createdByUserId: input.actorUserId,
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

export async function listDrizzleMatterLifecycleTransitions(
  db: OpenPracticeDatabase,
  firmId: string,
  matterId: string,
): Promise<MatterLifecycleTransitionRecord[]> {
  const rows = await db
    .select()
    .from(schema.matterLifecycleTransitionRecords)
    .where(
      and(
        eq(schema.matterLifecycleTransitionRecords.firmId, firmId),
        eq(schema.matterLifecycleTransitionRecords.matterId, matterId),
      ),
    )
    .orderBy(desc(schema.matterLifecycleTransitionRecords.reviewedAt));
  return rows.map(mapMatterLifecycleTransitionRow);
}

export async function createDrizzleMatterLifecycleTransition(
  db: OpenPracticeDatabase,
  input: Parameters<
    import("../matter-lifecycle-contracts.js").MatterLifecycleRepository["createMatterLifecycleTransition"]
  >[0],
): Promise<MatterLifecycleTransitionRecord> {
  return db.transaction(async (tx) => {
    const [matterRow] = await tx
      .select()
      .from(schema.matters)
      .where(and(eq(schema.matters.firmId, input.firmId), eq(schema.matters.id, input.matterId)));
    if (!matterRow) throw new Error(`Matter ${input.matterId} was not found`);
    const [reviewerRow] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(eq(schema.users.firmId, input.firmId), eq(schema.users.id, input.reviewedByUserId)),
      );
    if (!reviewerRow) throw new Error(`Unknown user ${input.reviewedByUserId}`);

    const matter = mapMatter(matterRow);
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
    const [row] = await tx
      .insert(schema.matterLifecycleTransitionRecords)
      .values({
        ...record,
        reviewedAt: new Date(record.reviewedAt),
        createdAt: new Date(record.createdAt),
      })
      .returning();

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
      actorId: input.reviewedByUserId,
      action: "matter.lifecycle_transition_reviewed",
      resourceType: "matter",
      resourceId: input.matterId,
      occurredAt: input.reviewedAt,
      metadata: buildMatterLifecycleTransitionAuditMetadata(record),
    });
    await tx.insert(schema.auditEvents).values({
      ...audit,
      occurredAt: new Date(audit.occurredAt),
      metadata: audit.metadata,
    });

    return mapMatterLifecycleTransitionRow(row);
  });
}

function commandStatusMismatch(message: string): MatterLifecycleCommandError {
  return new MatterLifecycleCommandError("MATTER_LIFECYCLE_EXPECTED_STATUS_MISMATCH", message);
}

function commandNotAvailable(command: string): MatterLifecycleCommandError {
  return new MatterLifecycleCommandError(
    "MATTER_LIFECYCLE_COMMAND_NOT_AVAILABLE",
    `Matter lifecycle command ${command} is not available from the current matter status`,
  );
}

function commandReadinessNotReady(): MatterLifecycleCommandError {
  return new MatterLifecycleCommandError(
    "MATTER_LIFECYCLE_READINESS_NOT_READY",
    "Lifecycle command requires the latest ready review evidence",
  );
}

export async function executeDrizzleMatterLifecycleCommand(
  db: OpenPracticeDatabase,
  input: Parameters<
    import("../matter-lifecycle-contracts.js").MatterLifecycleRepository["executeMatterLifecycleCommand"]
  >[0],
  dependencies: DrizzleMatterLifecycleDependencies,
): ReturnType<
  import("../matter-lifecycle-contracts.js").MatterLifecycleRepository["executeMatterLifecycleCommand"]
> {
  const lifecycleCommand = await db.transaction(async (tx) => {
    const [matterRow] = await tx
      .select()
      .from(schema.matters)
      .where(and(eq(schema.matters.firmId, input.firmId), eq(schema.matters.id, input.matterId)));
    if (!matterRow) {
      throw new MatterLifecycleCommandError(
        "MATTER_LIFECYCLE_MATTER_NOT_FOUND",
        "Matter was not found",
      );
    }
    const [actorRow] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(eq(schema.users.firmId, input.firmId), eq(schema.users.id, input.executedByUserId)),
      );
    if (!actorRow) throw new Error(`Unknown user ${input.executedByUserId}`);

    const matter = mapMatter(matterRow);
    const requiredStatus = matterLifecycleCommandRequiredStatus(input.command);
    if (input.expectedStatus !== requiredStatus) {
      throw commandStatusMismatch(
        `Matter lifecycle command ${input.command} expected status must be ${requiredStatus}`,
      );
    }
    if (matter.status !== input.expectedStatus) throw commandNotAvailable(input.command);

    const [latestForCommandRow] = await tx
      .select()
      .from(schema.matterLifecycleTransitionRecords)
      .where(
        and(
          eq(schema.matterLifecycleTransitionRecords.firmId, input.firmId),
          eq(schema.matterLifecycleTransitionRecords.matterId, input.matterId),
          eq(schema.matterLifecycleTransitionRecords.transition, input.command),
        ),
      )
      .orderBy(desc(schema.matterLifecycleTransitionRecords.reviewedAt))
      .limit(1);
    const latestForCommand = latestForCommandRow
      ? mapMatterLifecycleTransitionRow(latestForCommandRow)
      : undefined;
    if (
      !latestForCommand ||
      latestForCommand.id !== input.transitionRecordId ||
      latestForCommand.readiness !== "ready" ||
      latestForCommand.currentStatus !== matter.status ||
      latestForCommand.targetStatus !== matterLifecycleTargetStatus(input.command)
    ) {
      throw commandReadinessNotReady();
    }

    const execution = buildMatterLifecycleCommandExecution({
      command: input.command,
      matterId: input.matterId,
      transitionRecordId: input.transitionRecordId,
      beforeStatus: matter.status,
      expectedStatus: input.expectedStatus,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      executedAt: input.executedAt,
      executedByUserId: input.executedByUserId,
    });
    const [updatedMatterRow] = await tx
      .update(schema.matters)
      .set({ status: execution.afterStatus })
      .where(
        and(
          eq(schema.matters.firmId, input.firmId),
          eq(schema.matters.id, input.matterId),
          eq(schema.matters.status, input.expectedStatus),
          sql`exists (
            select 1
            from matter_lifecycle_transition_records command_record
            where command_record.id = ${input.transitionRecordId}
              and command_record.firm_id = ${input.firmId}
              and command_record.matter_id = ${input.matterId}
              and command_record.transition = ${input.command}
              and command_record.current_status = ${input.expectedStatus}
              and command_record.target_status = ${execution.afterStatus}
              and command_record.readiness = 'ready'
              and not exists (
                select 1
                from matter_lifecycle_transition_records newer_record
                where newer_record.firm_id = command_record.firm_id
                  and newer_record.matter_id = command_record.matter_id
                  and newer_record.transition = command_record.transition
                  and newer_record.reviewed_at > command_record.reviewed_at
              )
          )`,
        ),
      )
      .returning();
    if (!updatedMatterRow) {
      const [currentMatterRow] = await tx
        .select({ status: schema.matters.status })
        .from(schema.matters)
        .where(and(eq(schema.matters.firmId, input.firmId), eq(schema.matters.id, input.matterId)));
      if (!currentMatterRow || currentMatterRow.status !== input.expectedStatus) {
        throw commandStatusMismatch("Matter status changed during command");
      }
      throw commandReadinessNotReady();
    }

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
      actorId: input.executedByUserId,
      action: "matter.lifecycle_command_executed",
      resourceType: "matter",
      resourceId: input.matterId,
      occurredAt: input.executedAt,
      metadata: buildMatterLifecycleCommandAuditMetadata(execution, {
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      }),
    });
    await tx.insert(schema.auditEvents).values({
      ...audit,
      occurredAt: new Date(audit.occurredAt),
      metadata: audit.metadata,
    });
    return execution;
  });

  const actor = await dependencies.getUser(input.firmId, input.executedByUserId);
  if (!actor) throw new Error(`Unknown user ${input.executedByUserId}`);
  const matter = (await dependencies.listMattersForUser(actor)).find(
    (candidate) => candidate.id === input.matterId,
  );
  if (!matter) throw new Error(`Updated matter ${input.matterId} was not visible`);
  return { matter, lifecycleCommand };
}
