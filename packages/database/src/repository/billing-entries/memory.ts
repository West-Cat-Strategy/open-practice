import {
  normalizeExpenseCategoryCode,
  validateBillingExpenseCategory,
  type BillingExpenseCategoryRecord,
  type ExpenseEntry,
  type TimeEntry,
} from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryBillingEntriesStore {
  timeEntries: TimeEntry[];
  expenseEntries: ExpenseEntry[];
  billingExpenseCategories: BillingExpenseCategoryRecord[];
}

export function listMemoryTimeEntries(
  store: MemoryBillingEntriesStore,
  firmId: string,
  options: { matterId?: string; status?: TimeEntry["billingStatus"] } = {},
): TimeEntry[] {
  return clone(
    store.timeEntries.filter(
      (entry) =>
        entry.firmId === firmId &&
        (!options.matterId || entry.matterId === options.matterId) &&
        (!options.status || entry.billingStatus === options.status),
    ),
  );
}

export function getMemoryTimeEntry(
  store: MemoryBillingEntriesStore,
  firmId: string,
  entryId: string,
): TimeEntry | undefined {
  return clone(store.timeEntries.find((entry) => entry.firmId === firmId && entry.id === entryId));
}

export function createMemoryTimeEntry(
  store: MemoryBillingEntriesStore,
  entry: TimeEntry,
): TimeEntry {
  store.timeEntries = [...store.timeEntries, clone(entry)];
  return clone(entry);
}

export function updateMemoryTimeEntry(
  store: MemoryBillingEntriesStore,
  firmId: string,
  entryId: string,
  updates: Partial<TimeEntry>,
): TimeEntry {
  const index = store.timeEntries.findIndex(
    (entry) => entry.firmId === firmId && entry.id === entryId,
  );
  if (index === -1) throw new Error("Time entry was not found");
  const updated = { ...store.timeEntries[index]!, ...updates };
  store.timeEntries = store.timeEntries.map((entry, candidateIndex) =>
    candidateIndex === index ? updated : entry,
  );
  return clone(updated);
}

export function listMemoryExpenseEntries(
  store: MemoryBillingEntriesStore,
  firmId: string,
  options: { matterId?: string; status?: ExpenseEntry["billingStatus"] } = {},
): ExpenseEntry[] {
  return clone(
    store.expenseEntries.filter(
      (entry) =>
        entry.firmId === firmId &&
        (!options.matterId || entry.matterId === options.matterId) &&
        (!options.status || entry.billingStatus === options.status),
    ),
  );
}

export function getMemoryExpenseEntry(
  store: MemoryBillingEntriesStore,
  firmId: string,
  entryId: string,
): ExpenseEntry | undefined {
  return clone(
    store.expenseEntries.find((entry) => entry.firmId === firmId && entry.id === entryId),
  );
}

export function createMemoryExpenseEntry(
  store: MemoryBillingEntriesStore,
  entry: ExpenseEntry,
): ExpenseEntry {
  store.expenseEntries = [...store.expenseEntries, clone(entry)];
  return clone(entry);
}

export function updateMemoryExpenseEntry(
  store: MemoryBillingEntriesStore,
  firmId: string,
  entryId: string,
  updates: Partial<ExpenseEntry>,
): ExpenseEntry {
  const index = store.expenseEntries.findIndex(
    (entry) => entry.firmId === firmId && entry.id === entryId,
  );
  if (index === -1) throw new Error("Expense entry was not found");
  const updated = { ...store.expenseEntries[index]!, ...updates };
  store.expenseEntries = store.expenseEntries.map((entry, candidateIndex) =>
    candidateIndex === index ? updated : entry,
  );
  return clone(updated);
}

export function listMemoryBillingExpenseCategories(
  store: MemoryBillingEntriesStore,
  firmId: string,
  options: { activeOnly?: boolean; matterId?: string } = {},
): BillingExpenseCategoryRecord[] {
  return clone(
    store.billingExpenseCategories
      .filter(
        (category) =>
          category.firmId === firmId &&
          (!options.activeOnly || category.active) &&
          (!options.matterId || !category.matterId || category.matterId === options.matterId),
      )
      .sort((left, right) => left.code.localeCompare(right.code)),
  );
}

export function getMemoryBillingExpenseCategory(
  store: MemoryBillingEntriesStore,
  firmId: string,
  categoryId: string,
): BillingExpenseCategoryRecord | undefined {
  return clone(
    store.billingExpenseCategories.find(
      (category) => category.firmId === firmId && category.id === categoryId,
    ),
  );
}

export function getMemoryBillingExpenseCategoryByCode(
  store: MemoryBillingEntriesStore,
  firmId: string,
  code: string,
): BillingExpenseCategoryRecord | undefined {
  const normalizedCode = normalizeExpenseCategoryCode(code);
  return clone(
    store.billingExpenseCategories.find(
      (category) => category.firmId === firmId && category.code === normalizedCode,
    ),
  );
}

export function createMemoryBillingExpenseCategory(
  store: MemoryBillingEntriesStore,
  category: BillingExpenseCategoryRecord,
): BillingExpenseCategoryRecord {
  validateBillingExpenseCategory(category);
  const duplicate = store.billingExpenseCategories.some(
    (candidate) => candidate.firmId === category.firmId && candidate.code === category.code,
  );
  if (duplicate) throw new Error("Billing expense category code already exists");
  store.billingExpenseCategories = [...store.billingExpenseCategories, clone(category)];
  return clone(category);
}

export function updateMemoryBillingExpenseCategory(
  store: MemoryBillingEntriesStore,
  firmId: string,
  categoryId: string,
  updates: Partial<BillingExpenseCategoryRecord>,
): BillingExpenseCategoryRecord {
  const index = store.billingExpenseCategories.findIndex(
    (category) => category.firmId === firmId && category.id === categoryId,
  );
  if (index === -1) throw new Error("Billing expense category was not found");
  const existing = store.billingExpenseCategories[index]!;
  const updated = { ...existing, ...updates, code: existing.code };
  validateBillingExpenseCategory(updated);
  store.billingExpenseCategories = store.billingExpenseCategories.map((category, candidateIndex) =>
    candidateIndex === index ? updated : category,
  );
  return clone(updated);
}
