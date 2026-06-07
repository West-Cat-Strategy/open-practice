import {
  appendAuditEvent,
  verifyAuditChain,
  type AuditEvent,
  type NewAuditEvent,
} from "@open-practice/domain";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";

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
