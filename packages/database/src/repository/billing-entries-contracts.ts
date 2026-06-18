import type { BillingExpenseCategoryRecord, ExpenseEntry, TimeEntry } from "@open-practice/domain";

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
        | "incurredAt"
        | "amountCents"
        | "category"
        | "categoryCode"
        | "description"
        | "reimbursable"
        | "billingStatus"
      >
    >,
  ): Promise<ExpenseEntry>;
  listBillingExpenseCategories(
    firmId: string,
    options?: { activeOnly?: boolean; matterId?: string },
  ): Promise<BillingExpenseCategoryRecord[]>;
  getBillingExpenseCategory(
    firmId: string,
    categoryId: string,
  ): Promise<BillingExpenseCategoryRecord | undefined>;
  getBillingExpenseCategoryByCode(
    firmId: string,
    code: string,
  ): Promise<BillingExpenseCategoryRecord | undefined>;
  createBillingExpenseCategory(
    category: BillingExpenseCategoryRecord,
  ): Promise<BillingExpenseCategoryRecord>;
  updateBillingExpenseCategory(
    firmId: string,
    categoryId: string,
    updates: Partial<
      Pick<
        BillingExpenseCategoryRecord,
        | "label"
        | "active"
        | "defaultReimbursable"
        | "reimbursableAllowed"
        | "matterId"
        | "practiceAreas"
        | "jurisdictions"
        | "reviewCue"
        | "updatedByUserId"
        | "updatedAt"
      >
    >,
  ): Promise<BillingExpenseCategoryRecord>;
}
