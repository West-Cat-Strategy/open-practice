import { and, asc, eq, isNull, or } from "drizzle-orm";
import {
  normalizeExpenseCategoryCode,
  validateBillingExpenseCategory,
  type BillingExpenseCategoryRecord,
  type ExpenseEntry,
  type TimeEntry,
} from "@open-practice/domain";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import { clone } from "../contracts.js";
import {
  billingExpenseCategoryInsert,
  mapBillingExpenseCategoryRow,
  mapExpenseEntryRow,
  mapTimeEntryRow,
} from "../drizzle-mappers.js";

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
    categoryCode: entry.categoryCode ?? null,
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
      categoryCode: "categoryCode" in updates ? (updates.categoryCode ?? null) : undefined,
      incurredAt: updates.incurredAt ? new Date(updates.incurredAt) : undefined,
    })
    .where(and(eq(schema.expenseEntries.firmId, firmId), eq(schema.expenseEntries.id, entryId)))
    .returning();
  if (!row) throw new Error("Expense entry was not found");
  return mapExpenseEntryRow(row);
}

export async function listDrizzleBillingExpenseCategories(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { activeOnly?: boolean; matterId?: string } = {},
): Promise<BillingExpenseCategoryRecord[]> {
  const filters = [eq(schema.billingExpenseCategories.firmId, firmId)];
  if (options.activeOnly) filters.push(eq(schema.billingExpenseCategories.active, true));
  if (options.matterId) {
    const matterFilter = or(
      isNull(schema.billingExpenseCategories.matterId),
      eq(schema.billingExpenseCategories.matterId, options.matterId),
    );
    if (matterFilter) filters.push(matterFilter);
  }
  const rows = await db
    .select()
    .from(schema.billingExpenseCategories)
    .where(and(...filters))
    .orderBy(asc(schema.billingExpenseCategories.code));
  return rows.map(mapBillingExpenseCategoryRow);
}

export async function getDrizzleBillingExpenseCategory(
  db: OpenPracticeDatabase,
  firmId: string,
  categoryId: string,
): Promise<BillingExpenseCategoryRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.billingExpenseCategories)
    .where(
      and(
        eq(schema.billingExpenseCategories.firmId, firmId),
        eq(schema.billingExpenseCategories.id, categoryId),
      ),
    );
  return row ? mapBillingExpenseCategoryRow(row) : undefined;
}

export async function getDrizzleBillingExpenseCategoryByCode(
  db: OpenPracticeDatabase,
  firmId: string,
  code: string,
): Promise<BillingExpenseCategoryRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.billingExpenseCategories)
    .where(
      and(
        eq(schema.billingExpenseCategories.firmId, firmId),
        eq(schema.billingExpenseCategories.code, normalizeExpenseCategoryCode(code)),
      ),
    );
  return row ? mapBillingExpenseCategoryRow(row) : undefined;
}

export async function createDrizzleBillingExpenseCategory(
  db: OpenPracticeDatabase,
  category: BillingExpenseCategoryRecord,
): Promise<BillingExpenseCategoryRecord> {
  validateBillingExpenseCategory(category);
  const existing = await getDrizzleBillingExpenseCategoryByCode(db, category.firmId, category.code);
  if (existing) throw new Error("Billing expense category code already exists");
  await db.insert(schema.billingExpenseCategories).values(billingExpenseCategoryInsert(category));
  return clone(category);
}

export async function updateDrizzleBillingExpenseCategory(
  db: OpenPracticeDatabase,
  firmId: string,
  categoryId: string,
  updates: Partial<BillingExpenseCategoryRecord>,
): Promise<BillingExpenseCategoryRecord> {
  const existing = await getDrizzleBillingExpenseCategory(db, firmId, categoryId);
  if (!existing) throw new Error("Billing expense category was not found");
  const candidate = { ...existing, ...updates, code: existing.code };
  validateBillingExpenseCategory(candidate);
  const [row] = await db
    .update(schema.billingExpenseCategories)
    .set({
      label: updates.label,
      active: updates.active,
      defaultReimbursable: updates.defaultReimbursable,
      reimbursableAllowed: updates.reimbursableAllowed,
      matterId: "matterId" in updates ? (updates.matterId ?? null) : undefined,
      practiceAreas: updates.practiceAreas,
      jurisdictions: updates.jurisdictions,
      reviewCue: "reviewCue" in updates ? (updates.reviewCue ?? null) : undefined,
      updatedByUserId: "updatedByUserId" in updates ? (updates.updatedByUserId ?? null) : undefined,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : undefined,
    })
    .where(
      and(
        eq(schema.billingExpenseCategories.firmId, firmId),
        eq(schema.billingExpenseCategories.id, categoryId),
      ),
    )
    .returning();
  if (!row) throw new Error("Billing expense category was not found");
  return mapBillingExpenseCategoryRow(row);
}
