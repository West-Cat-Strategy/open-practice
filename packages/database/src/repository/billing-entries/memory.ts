import type { ExpenseEntry, TimeEntry } from "@open-practice/domain";
import { clone } from "../contracts.js";

export interface MemoryBillingEntriesStore {
  timeEntries: TimeEntry[];
  expenseEntries: ExpenseEntry[];
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
