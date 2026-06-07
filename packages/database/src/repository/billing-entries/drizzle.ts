import { and, eq } from "drizzle-orm";
import type { ExpenseEntry, TimeEntry } from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import { mapExpenseEntryRow, mapTimeEntryRow } from "../drizzle-mappers.js";

export async function listDrizzleTimeEntries(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; status?: TimeEntry["billingStatus"] } = {},
): Promise<TimeEntry[]> {
  const filters = [eq(schema.timeEntries.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.timeEntries.matterId, options.matterId));
  if (options.status) filters.push(eq(schema.timeEntries.billingStatus, options.status));
  const rows = await db
    .select()
    .from(schema.timeEntries)
    .where(and(...filters));
  return rows.map(mapTimeEntryRow);
}

export async function getDrizzleTimeEntry(
  db: OpenPracticeDatabase,
  firmId: string,
  entryId: string,
): Promise<TimeEntry | undefined> {
  const [row] = await db
    .select()
    .from(schema.timeEntries)
    .where(and(eq(schema.timeEntries.firmId, firmId), eq(schema.timeEntries.id, entryId)));
  return row ? mapTimeEntryRow(row) : undefined;
}

export async function createDrizzleTimeEntry(
  db: OpenPracticeDatabase,
  entry: TimeEntry,
): Promise<TimeEntry> {
  await db.insert(schema.timeEntries).values({
    ...entry,
    performedAt: new Date(entry.performedAt),
  });
  return clone(entry);
}

export async function updateDrizzleTimeEntry(
  db: OpenPracticeDatabase,
  firmId: string,
  entryId: string,
  updates: Partial<TimeEntry>,
): Promise<TimeEntry> {
  const [row] = await db
    .update(schema.timeEntries)
    .set({
      ...updates,
      performedAt: updates.performedAt ? new Date(updates.performedAt) : undefined,
      rateRuleId: "rateRuleId" in updates ? (updates.rateRuleId ?? null) : undefined,
      rateSnapshot: "rateSnapshot" in updates ? (updates.rateSnapshot ?? null) : undefined,
    })
    .where(and(eq(schema.timeEntries.firmId, firmId), eq(schema.timeEntries.id, entryId)))
    .returning();
  if (!row) throw new Error("Time entry was not found");
  return mapTimeEntryRow(row);
}

export async function listDrizzleExpenseEntries(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { matterId?: string; status?: ExpenseEntry["billingStatus"] } = {},
): Promise<ExpenseEntry[]> {
  const filters = [eq(schema.expenseEntries.firmId, firmId)];
  if (options.matterId) filters.push(eq(schema.expenseEntries.matterId, options.matterId));
  if (options.status) filters.push(eq(schema.expenseEntries.billingStatus, options.status));
  const rows = await db
    .select()
    .from(schema.expenseEntries)
    .where(and(...filters));
  return rows.map(mapExpenseEntryRow);
}

export async function getDrizzleExpenseEntry(
  db: OpenPracticeDatabase,
  firmId: string,
  entryId: string,
): Promise<ExpenseEntry | undefined> {
  const [row] = await db
    .select()
    .from(schema.expenseEntries)
    .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)));
  return row ? mapExpenseEntryRow(row) : undefined;
}

export async function createDrizzleExpenseEntry(
  db: OpenPracticeDatabase,
  entry: ExpenseEntry,
): Promise<ExpenseEntry> {
  await db.insert(schema.expenseEntries).values({
    ...entry,
    incurredAt: new Date(entry.incurredAt),
  });
  return clone(entry);
}

export async function updateDrizzleExpenseEntry(
  db: OpenPracticeDatabase,
  firmId: string,
  entryId: string,
  updates: Partial<ExpenseEntry>,
): Promise<ExpenseEntry> {
  const [row] = await db
    .update(schema.expenseEntries)
    .set({
      ...updates,
      incurredAt: updates.incurredAt ? new Date(updates.incurredAt) : undefined,
    })
    .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)))
    .returning();
  if (!row) throw new Error("Expense entry was not found");
  return mapExpenseEntryRow(row);
}
