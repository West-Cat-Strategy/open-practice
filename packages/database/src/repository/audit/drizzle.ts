import {
  appendAuditEvent,
  verifyAuditChain,
  type AuditEvent,
  type NewAuditEvent,
} from "@open-practice/domain";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { AuditEventReadFilter } from "../audit-contracts.js";

function mapAuditEventRow(row: typeof schema.auditEvents.$inferSelect): AuditEvent {
  return {
    ...row,
    occurredAt: row.occurredAt.toISOString(),
    metadata: row.metadata as Record<string, unknown>,
  };
}

export async function listDrizzleAuditEvents(
  db: OpenPracticeDatabase,
  firmId: string,
): Promise<{ events: AuditEvent[]; valid: boolean }> {
  const rows = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.firmId, firmId))
    .orderBy(asc(schema.auditEvents.sequence));
  const events = rows.map(mapAuditEventRow);
  return { events, valid: verifyAuditChain(events) };
}

function metadataContainsJson(value: Record<string, unknown>): SQL {
  return sql`${schema.auditEvents.metadata} @> ${JSON.stringify(value)}::jsonb`;
}

function auditEventMatterFilter(matterId: string): SQL {
  const expression = or(
    and(eq(schema.auditEvents.resourceType, "matter"), eq(schema.auditEvents.resourceId, matterId)),
    metadataContainsJson({ matterId }),
    metadataContainsJson({ matterId: [matterId] }),
    metadataContainsJson({ matterIds: [matterId] }),
    metadataContainsJson({ previousMatterId: matterId }),
    metadataContainsJson({ previousMatterId: [matterId] }),
  );
  if (!expression) {
    throw new Error("Audit event matter filter requires at least one predicate.");
  }
  return expression;
}

export async function listDrizzleFilteredAuditEvents(
  db: OpenPracticeDatabase,
  firmId: string,
  filter: AuditEventReadFilter,
): Promise<AuditEvent[]> {
  if (filter.actions?.length === 0) return [];

  const clauses: SQL[] = [eq(schema.auditEvents.firmId, firmId)];
  if (filter.actions) {
    const actions = [...new Set(filter.actions)];
    clauses.push(
      actions.length === 1
        ? eq(schema.auditEvents.action, actions[0])
        : inArray(schema.auditEvents.action, actions),
    );
  }
  if (filter.resourceType) clauses.push(eq(schema.auditEvents.resourceType, filter.resourceType));
  if (filter.resourceId) clauses.push(eq(schema.auditEvents.resourceId, filter.resourceId));
  if (filter.matterId) clauses.push(auditEventMatterFilter(filter.matterId));

  const rows = await db
    .select()
    .from(schema.auditEvents)
    .where(and(...clauses))
    .orderBy(asc(schema.auditEvents.sequence));
  return rows.map(mapAuditEventRow);
}

export async function appendDrizzleAuditEvent(
  db: OpenPracticeDatabase,
  event: NewAuditEvent,
): Promise<AuditEvent> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${event.firmId}, 0))`);
    const [previousRow] = await tx
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, event.firmId))
      .orderBy(desc(schema.auditEvents.sequence))
      .limit(1);
    const previous = previousRow ? mapAuditEventRow(previousRow) : undefined;
    const appended = appendAuditEvent(previous, event);
    await tx.insert(schema.auditEvents).values({
      ...appended,
      occurredAt: new Date(appended.occurredAt),
      metadata: appended.metadata,
    });
    return appended;
  });
}

export async function recordDrizzleAuditEvent(
  db: OpenPracticeDatabase,
  event: AuditEvent,
): Promise<void> {
  await appendDrizzleAuditEvent(db, {
    id: event.id,
    firmId: event.firmId,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    occurredAt: event.occurredAt,
    metadata: event.metadata,
  });
}
