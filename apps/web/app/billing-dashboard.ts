import type {
  BillingDashboardResponse,
  BillingExpenseItem,
  BillingInvoiceSummary,
  BillingTimeItem,
  MatterSummary,
} from "./types";

const clientLikeRoles = new Set([
  "client",
  "prospective_client",
  "notary_client",
  "paralegal_client",
]);

export interface CreatedDraftInvoiceResponse {
  id: string;
  matterId: string;
  invoiceNumber: string;
  status: BillingInvoiceSummary["status"];
  totalCents: number;
  balanceDueCents: number;
  issuedAt?: string;
  dueAt?: string;
}

export interface CreatedDraftTimeEntryResponse {
  id: string;
  matterId: string;
  userId?: string;
  performedAt: string;
  minutes: number;
  rateCents: number;
  rateRuleId?: string;
  rateSnapshot?: BillingTimeItem["rateSnapshot"];
  narrative: string;
  billable: boolean;
  billingStatus: BillingTimeItem["status"];
}

export interface CreatedDraftExpenseEntryResponse {
  id: string;
  matterId: string;
  incurredAt: string;
  amountCents: number;
  category: string;
  description: string;
  reimbursable: boolean;
  billingStatus: BillingExpenseItem["status"];
}

export interface DraftInvoicePayload {
  matterId: string;
  clientContactId?: string;
  dueAt?: string;
  timeEntryIds: string[];
  expenseEntryIds: string[];
  taxName?: string;
  taxRateBps: number;
}

export interface DraftTimeEntryPayload {
  matterId: string;
  performedAt: string;
  minutes: number;
  rateCents?: number;
  narrative: string;
  billable: true;
}

export interface DraftExpenseEntryPayload {
  matterId: string;
  incurredAt: string;
  amountCents: number;
  category: string;
  description: string;
  reimbursable: boolean;
}

export function inferBillingClientContactId(
  matter: Pick<MatterSummary, "parties">,
): string | undefined {
  return matter.parties.find((party) => !party.adverse && clientLikeRoles.has(party.role))
    ?.contactId;
}

function dueDateIsoFromInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function taxRateBpsFromPercent(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0) return Number.NaN;
  return Math.round(percent * 100);
}

function centsFromDollarInput(value: string): number {
  const normalized = value.trim().replace(/^\$/, "");
  if (!normalized) return Number.NaN;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

function optionalRateCentsFromDollarInput(value: string): number | undefined {
  const normalized = value.trim().replace(/^\$/, "");
  if (!normalized) return undefined;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

function timeEntryAmountCents(entry: Pick<BillingTimeItem, "minutes" | "rateCents">): number {
  return Math.round((entry.minutes / 60) * entry.rateCents);
}

function timerElapsedMsToDraftMinutes(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error("Timer elapsed time must be positive");
  }
  return Math.max(1, Math.ceil(elapsedMs / 60_000));
}

export function formatTimerElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutesValue = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutesValue, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function buildDraftTimeEntryPayload(input: {
  matterId: string;
  elapsedMs: number;
  narrative: string;
  rateCentsPerHour: string;
  performedAt: string;
}): { payload?: DraftTimeEntryPayload; error?: string } {
  let minutes: number;
  try {
    minutes = timerElapsedMsToDraftMinutes(input.elapsedMs);
  } catch {
    return { error: "Timer must run before saving draft time." };
  }

  const narrative = input.narrative.trim();
  if (!narrative) return { error: "Time draft narrative is required." };

  const rateCents = optionalRateCentsFromDollarInput(input.rateCentsPerHour);
  if (Number.isNaN(rateCents)) return { error: "Rate must be zero or greater." };

  return {
    payload: {
      matterId: input.matterId,
      performedAt: input.performedAt,
      minutes,
      narrative,
      billable: true,
      ...(rateCents !== undefined ? { rateCents } : {}),
    },
  };
}

export function buildDraftExpenseEntryPayload(input: {
  matterId: string;
  amount: string;
  category: string;
  description: string;
  incurredAt: string;
  reimbursable: boolean;
}): { payload?: DraftExpenseEntryPayload; error?: string } {
  const amountCents = centsFromDollarInput(input.amount);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { error: "Expense amount must be greater than zero." };
  }
  const category = input.category.trim();
  if (!category) return { error: "Expense category is required." };
  const description = input.description.trim();
  if (!description) return { error: "Expense description is required." };

  return {
    payload: {
      matterId: input.matterId,
      incurredAt: input.incurredAt,
      amountCents,
      category,
      description,
      reimbursable: input.reimbursable,
    },
  };
}

export function buildDraftInvoicePayload(input: {
  matter: Pick<MatterSummary, "id" | "parties">;
  unbilledTime: BillingTimeItem[];
  unbilledExpenses: BillingExpenseItem[];
  dueAtDate: string;
  taxName: string;
  taxRatePercent: string;
}): { payload?: DraftInvoicePayload; error?: string } {
  if (input.unbilledTime.length === 0 && input.unbilledExpenses.length === 0) {
    return { error: "No approved unbilled time or reimbursable expenses are available." };
  }

  const dueAt = dueDateIsoFromInput(input.dueAtDate);
  if (input.dueAtDate.trim() && !dueAt) {
    return { error: "Due date is invalid." };
  }

  const taxRateBps = taxRateBpsFromPercent(input.taxRatePercent);
  if (Number.isNaN(taxRateBps)) {
    return { error: "Tax rate must be zero or greater." };
  }

  const taxName = input.taxName.trim();
  const clientContactId = inferBillingClientContactId(input.matter);
  return {
    payload: {
      matterId: input.matter.id,
      timeEntryIds: input.unbilledTime.map((entry) => entry.id),
      expenseEntryIds: input.unbilledExpenses.map((entry) => entry.id),
      taxRateBps,
      ...(clientContactId ? { clientContactId } : {}),
      ...(dueAt ? { dueAt } : {}),
      ...(taxName ? { taxName } : {}),
    },
  };
}

export function billingInvoiceSummaryFromCreatedInvoice(
  invoice: CreatedDraftInvoiceResponse,
): BillingInvoiceSummary {
  return {
    id: invoice.id,
    matterId: invoice.matterId,
    number: invoice.invoiceNumber,
    status: invoice.status,
    totalCents: invoice.totalCents,
    balanceDueCents: invoice.balanceDueCents,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
  };
}

export function billingTimeItemFromCreatedEntry(
  entry: CreatedDraftTimeEntryResponse,
): BillingTimeItem {
  return {
    id: entry.id,
    matterId: entry.matterId,
    userId: entry.userId,
    minutes: entry.minutes,
    rateCents: entry.rateCents,
    rateRuleId: entry.rateRuleId,
    rateSnapshot: entry.rateSnapshot,
    amountCents: timeEntryAmountCents(entry),
    narrative: entry.narrative,
    status: entry.billingStatus,
  };
}

export function billingExpenseItemFromCreatedEntry(
  entry: CreatedDraftExpenseEntryResponse,
): BillingExpenseItem {
  return {
    id: entry.id,
    matterId: entry.matterId,
    amountCents: entry.amountCents,
    category: entry.category,
    description: entry.description,
    status: entry.billingStatus,
  };
}

export function updateBillingDashboardWithCreatedDraftTime(
  dashboard: BillingDashboardResponse,
  entry: CreatedDraftTimeEntryResponse,
): BillingDashboardResponse {
  const draftTime = billingTimeItemFromCreatedEntry(entry);
  return {
    ...dashboard,
    matters: dashboard.matters.map((matter) =>
      matter.matterId === draftTime.matterId
        ? {
            ...matter,
            draftTime: [
              draftTime,
              ...matter.draftTime.filter((candidate) => candidate.id !== draftTime.id),
            ],
          }
        : matter,
    ),
  };
}

export function updateBillingDashboardWithCreatedDraftExpense(
  dashboard: BillingDashboardResponse,
  entry: CreatedDraftExpenseEntryResponse,
): BillingDashboardResponse {
  const draftExpense = billingExpenseItemFromCreatedEntry(entry);
  return {
    ...dashboard,
    matters: dashboard.matters.map((matter) =>
      matter.matterId === draftExpense.matterId
        ? {
            ...matter,
            draftExpenses: [
              draftExpense,
              ...matter.draftExpenses.filter((candidate) => candidate.id !== draftExpense.id),
            ],
          }
        : matter,
    ),
  };
}

export function updateBillingDashboardWithCreatedInvoice(
  dashboard: BillingDashboardResponse,
  input: {
    invoice: CreatedDraftInvoiceResponse;
    timeEntryIds: string[];
    expenseEntryIds: string[];
  },
): BillingDashboardResponse {
  const timeEntryIds = new Set(input.timeEntryIds);
  const expenseEntryIds = new Set(input.expenseEntryIds);
  const invoiceSummary = billingInvoiceSummaryFromCreatedInvoice(input.invoice);
  let removedTimeCents = 0;
  let removedExpenseCents = 0;

  const matters = dashboard.matters.map((matter) => {
    if (matter.matterId !== input.invoice.matterId) return matter;

    removedTimeCents = matter.unbilledTime
      .filter((entry) => timeEntryIds.has(entry.id))
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    removedExpenseCents = matter.unbilledExpenses
      .filter((entry) => expenseEntryIds.has(entry.id))
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    return {
      ...matter,
      unbilledTime: matter.unbilledTime.filter((entry) => !timeEntryIds.has(entry.id)),
      unbilledExpenses: matter.unbilledExpenses.filter((entry) => !expenseEntryIds.has(entry.id)),
      invoices: [
        invoiceSummary,
        ...matter.invoices.filter((invoice) => invoice.id !== invoiceSummary.id),
      ],
    };
  });

  const previousDraftInvoice = dashboard.matters
    .flatMap((matter) => matter.invoices)
    .find((invoice) => invoice.id === invoiceSummary.id && invoice.status === "draft");
  const draftDelta =
    (invoiceSummary.status === "draft" ? invoiceSummary.totalCents : 0) -
    (previousDraftInvoice?.totalCents ?? 0);

  return {
    ...dashboard,
    matters,
    summary: {
      ...dashboard.summary,
      unbilledTimeCents: Math.max(0, dashboard.summary.unbilledTimeCents - removedTimeCents),
      unbilledExpenseCents: Math.max(
        0,
        dashboard.summary.unbilledExpenseCents - removedExpenseCents,
      ),
      draftInvoiceCents: dashboard.summary.draftInvoiceCents + draftDelta,
    },
  };
}

export function describeDraftInvoiceCreated(
  invoice: CreatedDraftInvoiceResponse,
  sourceCount: number,
): string {
  return `Created draft ${invoice.invoiceNumber} from ${sourceCount} source record${
    sourceCount === 1 ? "" : "s"
  }.`;
}

export function describeDraftCaptureCreated(kind: "time" | "expense"): string {
  return kind === "time" ? "Draft time saved for review." : "Draft expense saved for review.";
}

export function formatDraftInvoiceApiFailure(status: number | "network"): string {
  return `Draft invoice creation failed: ${status}`;
}
