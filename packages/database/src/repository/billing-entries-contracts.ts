import type { ExpenseEntry, TimeEntry } from "@open-practice/domain";

export interface BillingEntriesRepository {
  listTimeEntries(
    firmId: string,
    options?: { matterId?: string; status?: TimeEntry["billingStatus"] },
  ): Promise<TimeEntry[]>;
  getTimeEntry(firmId: string, entryId: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: TimeEntry): Promise<TimeEntry>;
  updateTimeEntry(
    firmId: string,
    entryId: string,
    updates: Partial<
      Pick<
        TimeEntry,
        | "performedAt"
        | "minutes"
        | "rateCents"
        | "rateRuleId"
        | "rateSnapshot"
        | "narrative"
        | "billable"
        | "billingStatus"
      >
    >,
  ): Promise<TimeEntry>;
  listExpenseEntries(
    firmId: string,
    options?: { matterId?: string; status?: ExpenseEntry["billingStatus"] },
  ): Promise<ExpenseEntry[]>;
  getExpenseEntry(firmId: string, entryId: string): Promise<ExpenseEntry | undefined>;
  createExpenseEntry(entry: ExpenseEntry): Promise<ExpenseEntry>;
  updateExpenseEntry(
    firmId: string,
    entryId: string,
    updates: Partial<
      Pick<
        ExpenseEntry,
        "incurredAt" | "amountCents" | "category" | "description" | "reimbursable" | "billingStatus"
      >
    >,
  ): Promise<ExpenseEntry>;
}
