import type { CalendarCredentialRecord } from "@open-practice/domain";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { CalendarCredentialRevokeInput } from "../calendar-credentials-contracts.js";
import { mapCalendarCredentialRow } from "../drizzle-mappers.js";

export async function createDrizzleCalendarCredential(
  db: OpenPracticeDatabase,
  credential: CalendarCredentialRecord,
): Promise<CalendarCredentialRecord> {
  const [row] = await db
    .insert(schema.calendarCredentials)
    .values({
      id: credential.id,
      firmId: credential.firmId,
      userId: credential.userId,
      username: credential.username,
      label: credential.label,
      passwordHash: credential.passwordHash,
      createdAt: new Date(credential.createdAt),
      createdByUserId: credential.createdByUserId,
      lastUsedAt: credential.lastUsedAt ? new Date(credential.lastUsedAt) : null,
      revokedAt: credential.revokedAt ? new Date(credential.revokedAt) : null,
    })
    .returning();
  return mapCalendarCredentialRow(row);
}

export async function listDrizzleCalendarCredentials(
  db: OpenPracticeDatabase,
  firmId: string,
  userId: string,
): Promise<CalendarCredentialRecord[]> {
  const rows = await db
    .select()
    .from(schema.calendarCredentials)
    .where(
      and(
        eq(schema.calendarCredentials.firmId, firmId),
        eq(schema.calendarCredentials.userId, userId),
      ),
    )
    .orderBy(asc(schema.calendarCredentials.createdAt));
  return rows.map(mapCalendarCredentialRow);
}

export async function getDrizzleCalendarCredentialByUsername(
  db: OpenPracticeDatabase,
  username: string,
): Promise<CalendarCredentialRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.calendarCredentials)
    .where(
      and(
        eq(schema.calendarCredentials.username, username),
        isNull(schema.calendarCredentials.revokedAt),
      ),
    );
  return row ? mapCalendarCredentialRow(row) : undefined;
}

export async function touchDrizzleCalendarCredential(
  db: OpenPracticeDatabase,
  id: string,
  lastUsedAt: string,
): Promise<void> {
  await db
    .update(schema.calendarCredentials)
    .set({ lastUsedAt: new Date(lastUsedAt) })
    .where(eq(schema.calendarCredentials.id, id));
}

export async function revokeDrizzleCalendarCredential(
  db: OpenPracticeDatabase,
  input: CalendarCredentialRevokeInput,
): Promise<CalendarCredentialRecord | undefined> {
  const [row] = await db
    .update(schema.calendarCredentials)
    .set({ revokedAt: new Date(input.revokedAt) })
    .where(
      and(
        eq(schema.calendarCredentials.firmId, input.firmId),
        eq(schema.calendarCredentials.userId, input.userId),
        eq(schema.calendarCredentials.id, input.credentialId),
      ),
    )
    .returning();
  return row ? mapCalendarCredentialRow(row) : undefined;
}
