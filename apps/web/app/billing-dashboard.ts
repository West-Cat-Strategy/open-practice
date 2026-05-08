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

export interface DraftInvoicePayload {
  matterId: string;
  clientContactId?: string;
  dueAt?: string;
  timeEntryIds: string[];
  expenseEntryIds: string[];
  taxName?: string;
  taxRateBps: number;
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
