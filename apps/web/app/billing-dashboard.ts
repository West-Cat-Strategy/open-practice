import type { BillingPeriodLockRecord } from "@open-practice/domain";
import type {
  BillingDashboardResponse,
  BillingExpenseItem,
  BillingInvoiceSummary,
  BillingPaymentRequestSummary,
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

export interface DraftInvoicePayload {
  matterId: string;
  clientContactId?: string;
  dueAt?: string;
  timeEntryIds: string[];
  expenseEntryIds: string[];
  taxName?: string;
  taxRateBps: number;
}

export interface TimerDraftTimeEntryPayload {
  matterId: string;
  startedAt: string;
  stoppedAt: string;
  rateCents?: number;
  narrative: string;
  billable: boolean;
}

export interface ExpenseReviewDraftPayload {
  matterId: string;
  incurredAt?: string;
  amountCents: number;
  categoryProfileKey?: string;
  category?: string;
  description: string;
  reimbursable: boolean;
}

export type CreatedTimerDraftTimeEntryResponse = Omit<BillingTimeItem, "amountCents" | "status"> & {
  billable: boolean;
  billingStatus: BillingTimeItem["status"];
};

export type CreatedExpenseReviewDraftResponse = Omit<
  BillingExpenseItem,
  "categoryProfileKey" | "status"
> & {
  reimbursable: boolean;
  billingStatus: BillingExpenseItem["status"];
};

export interface PaymentSettlementReviewSummary {
  paymentRequestCount: number;
  receivedEventCount: number;
  pendingEventCount: number;
  amountMismatchCount: number;
  refundOrChargebackReviewCount: number;
  automaticInvoiceBalanceMutation: false;
  automaticReconciliation: false;
  trustPosting: false;
  rawWebhookBodyStorage: false;
}

export function summarizePaymentSettlementReview(
  requests: BillingPaymentRequestSummary[],
): PaymentSettlementReviewSummary {
  const reviews = requests
    .map((request) => ({ request, review: request.processor.settlementReview }))
    .filter(({ review }) => review?.status === "needs_review");
  return {
    paymentRequestCount: requests.length,
    receivedEventCount: reviews.length,
    pendingEventCount: Math.max(0, requests.length - reviews.length),
    amountMismatchCount: reviews.filter(
      ({ request, review }) =>
        review?.amountCents !== undefined && review.amountCents !== request.amountCents,
    ).length,
    refundOrChargebackReviewCount: reviews.filter(
      ({ review }) =>
        review?.eventType === "charge_refunded" || review?.eventType === "charge_dispute_created",
    ).length,
    automaticInvoiceBalanceMutation: false,
    automaticReconciliation: false,
    trustPosting: false,
    rawWebhookBodyStorage: false,
  };
}

export function describePaymentSettlementReview(request: BillingPaymentRequestSummary): string {
  const review = request.processor.settlementReview;
  if (!review || review.status === "not_received") return "No settlement event received";
  const eventLabel = review.eventType?.replaceAll("_", " ") ?? "settlement event";
  const paymentStatus = review.paymentStatus?.replaceAll("_", " ") ?? "unknown";
  const amountCue =
    review.amountCents !== undefined && review.amountCents !== request.amountCents
      ? " · amount mismatch"
      : "";
  return `${eventLabel} · ${paymentStatus} · manual reconciliation required${amountCue}`;
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

function centsFromDecimalInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

function isoFromDateInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function timerWindowOverlapsLock(
  input: Pick<TimerDraftTimeEntryPayload, "startedAt" | "stoppedAt"> & {
    locks: BillingPeriodLockRecord[];
  },
): BillingPeriodLockRecord | undefined {
  const startedAt = Date.parse(input.startedAt);
  const stoppedAt = Date.parse(input.stoppedAt);
  if (Number.isNaN(startedAt) || Number.isNaN(stoppedAt) || stoppedAt <= startedAt) {
    return undefined;
  }
  return input.locks.find(
    (lock) => startedAt < Date.parse(lock.periodEnd) && Date.parse(lock.periodStart) < stoppedAt,
  );
}

export function billingTimerLockCue(input: {
  startedAt: string;
  stoppedAt: string;
  locks: BillingPeriodLockRecord[];
}): string | undefined {
  const lock = timerWindowOverlapsLock(input);
  if (!lock) return undefined;
  return `Timer overlaps locked billing period ending ${new Date(lock.periodEnd).toLocaleDateString(
    "en-CA",
  )}.`;
}

export function expenseDateLockCue(input: {
  incurredAtDate: string;
  locks: BillingPeriodLockRecord[];
}): string | undefined {
  const incurredAt = isoFromDateInput(input.incurredAtDate);
  if (!incurredAt) return undefined;
  const value = Date.parse(incurredAt);
  const lock = input.locks.find(
    (candidate) =>
      value >= Date.parse(candidate.periodStart) && value < Date.parse(candidate.periodEnd),
  );
  if (!lock) return undefined;
  return `Expense date is inside locked billing period ending ${new Date(
    lock.periodEnd,
  ).toLocaleDateString("en-CA")}.`;
}

export function buildTimerDraftTimeEntryPayload(input: {
  matter: Pick<MatterSummary, "id"> | undefined;
  startedAt: string;
  stoppedAt: string;
  rateHourly: string;
  narrative: string;
  billable: boolean;
  locks?: BillingPeriodLockRecord[];
}): { payload?: TimerDraftTimeEntryPayload; error?: string } {
  if (!input.matter) return { error: "Select a matter before creating a timer draft." };
  const startedAtInput = input.startedAt.trim();
  const stoppedAtInput = input.stoppedAt.trim();
  if (!startedAtInput || !stoppedAtInput) {
    return { error: "Start and stop the local timer first." };
  }
  const startedAt = isoFromDateInput(startedAtInput);
  const stoppedAt = isoFromDateInput(stoppedAtInput);
  if (!startedAt || !stoppedAt) {
    return { error: "Timer start or stop time is invalid." };
  }
  if (Date.parse(stoppedAt) <= Date.parse(startedAt)) {
    return { error: "Timer stop time must be after start time." };
  }
  const lockCue = billingTimerLockCue({ startedAt, stoppedAt, locks: input.locks ?? [] });
  if (lockCue) return { error: lockCue };
  const narrative = input.narrative.trim();
  if (!narrative) return { error: "Timer draft narrative is required." };
  const rateCents = centsFromDecimalInput(input.rateHourly);
  if (Number.isNaN(rateCents)) return { error: "Hourly rate must be zero or greater." };
  return {
    payload: {
      matterId: input.matter.id,
      startedAt,
      stoppedAt,
      ...(rateCents !== undefined ? { rateCents } : {}),
      narrative,
      billable: input.billable,
    },
  };
}

export function buildExpenseReviewDraftPayload(input: {
  matter: Pick<MatterSummary, "id"> | undefined;
  amount: string;
  incurredAtDate: string;
  categoryProfileKey: string;
  customCategory: string;
  description: string;
  reimbursable: boolean;
  locks?: BillingPeriodLockRecord[];
}): { payload?: ExpenseReviewDraftPayload; error?: string } {
  if (!input.matter) return { error: "Select a matter before creating an expense draft." };
  const amountCents = centsFromDecimalInput(input.amount);
  if (amountCents === undefined || amountCents <= 0) {
    return { error: "Expense amount is required." };
  }
  if (Number.isNaN(amountCents)) return { error: "Expense amount must be zero or greater." };
  const incurredAt = isoFromDateInput(input.incurredAtDate);
  if (input.incurredAtDate.trim() && !incurredAt) return { error: "Expense date is invalid." };
  const lockCue = expenseDateLockCue({
    incurredAtDate: input.incurredAtDate,
    locks: input.locks ?? [],
  });
  if (lockCue) return { error: lockCue };
  const description = input.description.trim();
  if (!description) return { error: "Expense description is required." };
  const customCategory = input.customCategory.trim();
  if (!input.categoryProfileKey && !customCategory) {
    return { error: "Expense category or profile is required." };
  }
  return {
    payload: {
      matterId: input.matter.id,
      amountCents,
      ...(incurredAt ? { incurredAt } : {}),
      ...(input.categoryProfileKey ? { categoryProfileKey: input.categoryProfileKey } : {}),
      ...(!input.categoryProfileKey && customCategory ? { category: customCategory } : {}),
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

function timerDraftDashboardItem(
  entry: BillingTimeItem | CreatedTimerDraftTimeEntryResponse,
): BillingTimeItem {
  if ("status" in entry) return entry;
  return {
    id: entry.id,
    matterId: entry.matterId,
    userId: entry.userId,
    performedAt: entry.performedAt,
    minutes: entry.minutes,
    rateCents: entry.rateCents,
    rateRuleId: entry.rateRuleId,
    rateSnapshot: entry.rateSnapshot,
    amountCents: Math.round((entry.minutes * entry.rateCents) / 60),
    narrative: entry.narrative,
    billable: entry.billable,
    status: entry.billingStatus,
  };
}

function expenseDraftDashboardItem(
  entry: BillingExpenseItem | CreatedExpenseReviewDraftResponse,
): BillingExpenseItem {
  if ("status" in entry) return entry;
  return {
    id: entry.id,
    matterId: entry.matterId,
    incurredAt: entry.incurredAt,
    amountCents: entry.amountCents,
    category: entry.category,
    description: entry.description,
    status: entry.billingStatus,
  };
}

export function updateBillingDashboardWithTimerDraft(
  dashboard: BillingDashboardResponse,
  entry: BillingTimeItem | CreatedTimerDraftTimeEntryResponse,
): BillingDashboardResponse {
  const item = timerDraftDashboardItem(entry);
  return {
    ...dashboard,
    matters: dashboard.matters.map((matter) =>
      matter.matterId === item.matterId
        ? {
            ...matter,
            captureReviewTime: [
              item,
              ...(matter.captureReviewTime ?? []).filter((candidate) => candidate.id !== item.id),
            ],
          }
        : matter,
    ),
  };
}

export function updateBillingDashboardWithExpenseDraft(
  dashboard: BillingDashboardResponse,
  entry: BillingExpenseItem | CreatedExpenseReviewDraftResponse,
): BillingDashboardResponse {
  const item = expenseDraftDashboardItem(entry);
  return {
    ...dashboard,
    matters: dashboard.matters.map((matter) =>
      matter.matterId === item.matterId
        ? {
            ...matter,
            captureReviewExpenses: [
              item,
              ...(matter.captureReviewExpenses ?? []).filter(
                (candidate) => candidate.id !== item.id,
              ),
            ],
          }
        : matter,
    ),
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

export function formatDraftInvoiceApiFailure(status: number | "network"): string {
  return `Draft invoice creation failed: ${status}`;
}

export function formatTimerDraftApiFailure(status: number | "network"): string {
  return `Timer draft creation failed: ${status}`;
}

export function formatExpenseDraftApiFailure(status: number | "network"): string {
  return `Expense draft creation failed: ${status}`;
}
