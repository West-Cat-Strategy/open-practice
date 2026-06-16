import type { AuditEvent } from "./audit.js";

export type FinancialCommandJournalFamily =
  | "trust_transfer"
  | "trust_transaction"
  | "invoice_approval"
  | "reconciliation";

export interface FinancialCommandJournalEntry {
  auditEventId: string;
  actorId: string;
  occurredAt: string;
  action: string;
  family: FinancialCommandJournalFamily;
  decision: string;
  resourceType: string;
  resourceId: string;
  matterId?: string;
  matterIds?: string[];
  accountId?: string;
  accountIds?: string[];
  invoiceId?: string;
  transactionId?: string;
  trustTransferRequestId?: string;
  paymentId?: string;
  statementRowId?: string;
  status?: string;
  previousStatus?: string;
  amountCents?: number;
  totalCents?: number;
  balanceDueCents?: number;
  allocationCount?: number;
  entryCount?: number;
  statementRowCount?: number;
  matchedStatementRowCount?: number;
  unmatchedStatementRowCount?: number;
  varianceCents?: number;
  evidencePresent?: boolean;
}

export interface FinancialCommandJournal {
  scope: { kind: "firm" } | { kind: "matter"; matterId: string };
  chainValid: boolean;
  reviewOnly: true;
  entries: FinancialCommandJournalEntry[];
  summary: {
    total: number;
    byFamily: Record<FinancialCommandJournalFamily, number>;
    byDecision: Record<string, number>;
  };
  policy: {
    source: "audit_metadata";
    rawMetadataValues: "redacted_allowlisted_cues_only";
    postingAutomation: false;
    settlementAutomation: false;
    publicExposure: false;
  };
}

interface FinancialCommandJournalDefinition {
  family: FinancialCommandJournalFamily;
  decision: (event: AuditEvent) => string;
}

const financialCommandJournalDefinitions: Record<string, FinancialCommandJournalDefinition> = {
  "trust_transfer_request.approved": {
    family: "trust_transfer",
    decision: () => "approved",
  },
  "trust_transfer_request.rejected": {
    family: "trust_transfer",
    decision: () => "rejected",
  },
  "trust_transfer_request.linked": {
    family: "trust_transfer",
    decision: () => "linked",
  },
  "ledger.transaction_approval.decided": {
    family: "trust_transaction",
    decision: (event) => asString(event.metadata.decision) ?? "decided",
  },
  "invoice.approved": {
    family: "invoice_approval",
    decision: () => "approved",
  },
  "ledger.reconciliation.created": {
    family: "reconciliation",
    decision: (event) => asString(event.metadata.status) ?? "created",
  },
  "ledger.reconciliation_exception_resolution.recorded": {
    family: "reconciliation",
    decision: (event) => asString(event.metadata.varianceDecision) ?? "recorded",
  },
  "manual_payment.reconciled": {
    family: "reconciliation",
    decision: () => "reconciled",
  },
};

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : [value];
  const strings = [
    ...new Set(
      values.map((item) => asString(item)).filter((item): item is string => Boolean(item)),
    ),
  ];
  return strings.length > 0 ? strings : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function auditEventTouchesMatter(event: AuditEvent, matterId: string): boolean {
  if (asString(event.metadata.matterId) === matterId) return true;
  return asStringArray(event.metadata.matterIds)?.includes(matterId) ?? false;
}

function financialCommandJournalEntry(event: AuditEvent): FinancialCommandJournalEntry | undefined {
  const definition = financialCommandJournalDefinitions[event.action];
  if (!definition) return undefined;

  return {
    auditEventId: event.id,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
    action: event.action,
    family: definition.family,
    decision: definition.decision(event),
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    matterId: asString(event.metadata.matterId),
    matterIds: asStringArray(event.metadata.matterIds),
    accountId: asString(event.metadata.accountId),
    accountIds: asStringArray(event.metadata.accountIds),
    invoiceId: asString(event.metadata.invoiceId),
    transactionId: asString(event.metadata.transactionId),
    trustTransferRequestId: asString(event.metadata.trustTransferRequestId),
    paymentId: asString(event.metadata.paymentId),
    statementRowId: asString(event.metadata.statementRowId),
    status: asString(event.metadata.status),
    previousStatus: asString(event.metadata.previousStatus),
    amountCents: asNumber(event.metadata.amountCents),
    totalCents: asNumber(event.metadata.totalCents),
    balanceDueCents: asNumber(event.metadata.balanceDueCents),
    allocationCount: asNumber(event.metadata.allocationCount),
    entryCount: asNumber(event.metadata.entryCount),
    statementRowCount: asNumber(event.metadata.statementRowCount),
    matchedStatementRowCount: asNumber(event.metadata.matchedStatementRowCount),
    unmatchedStatementRowCount: asNumber(event.metadata.unmatchedStatementRowCount),
    varianceCents: asNumber(event.metadata.varianceCents),
    evidencePresent: asBoolean(event.metadata.evidencePresent),
  };
}

function emptyFamilyCounts(): Record<FinancialCommandJournalFamily, number> {
  return {
    trust_transfer: 0,
    trust_transaction: 0,
    invoice_approval: 0,
    reconciliation: 0,
  };
}

export function buildFinancialCommandJournal({
  audit,
  matterId,
}: {
  audit: { events: AuditEvent[]; valid: boolean };
  matterId?: string;
}): FinancialCommandJournal {
  const entries = audit.events
    .filter((event) => !matterId || auditEventTouchesMatter(event, matterId))
    .map(financialCommandJournalEntry)
    .filter((entry): entry is FinancialCommandJournalEntry => Boolean(entry))
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime() ||
        right.auditEventId.localeCompare(left.auditEventId),
    );
  const byFamily = emptyFamilyCounts();
  const byDecision: Record<string, number> = {};

  for (const entry of entries) {
    byFamily[entry.family] += 1;
    byDecision[entry.decision] = (byDecision[entry.decision] ?? 0) + 1;
  }

  return {
    scope: matterId ? { kind: "matter", matterId } : { kind: "firm" },
    chainValid: audit.valid,
    reviewOnly: true,
    entries,
    summary: {
      total: entries.length,
      byFamily,
      byDecision,
    },
    policy: {
      source: "audit_metadata",
      rawMetadataValues: "redacted_allowlisted_cues_only",
      postingAutomation: false,
      settlementAutomation: false,
      publicExposure: false,
    },
  };
}
