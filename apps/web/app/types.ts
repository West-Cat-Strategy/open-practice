import type {
  Contact,
  ConflictCandidate,
  DocumentRecord,
  ExpenseEntry,
  Firm,
  ActivityTimelineEntry,
  DashboardSectionCapability,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  Matter,
  MatterParty,
  SignatureRequestRecord,
  TimeEntry,
  User,
} from "@open-practice/domain";

export interface MatterSummary extends Matter {
  parties: Array<MatterParty & { contact: Contact }>;
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  activity: ActivityTimelineEntry[];
  trustBalanceCents: number;
}

export interface PracticeOverview {
  firm: Firm;
  metrics: {
    openMatters: number;
    intakeMatters: number;
    portalGrants: number;
    trustBalanceCents: number;
    unbilledMinutes: number;
  };
  users: User[];
}

export interface ConflictResponse {
  results: ConflictCandidate[];
  auditChainValid: boolean;
}

export interface SessionResponse {
  user: User;
}

export interface CapabilitiesResponse {
  sections: DashboardSectionCapability[];
}

export interface IntakeSessionsResponse {
  templates: IntakeTemplateRecord[];
  sessions: IntakeSessionRecord[];
}

export type SignatureRequestsResponse = SignatureRequestRecord[];

export type BillingEntryStatus = "draft" | "submitted" | "approved" | "billed" | "written_off";

export interface BillingTimeItem {
  id: string;
  matterId: string;
  userId?: string;
  minutes: number;
  rateCents: number;
  amountCents: number;
  narrative: string;
  status: BillingEntryStatus;
}

export interface BillingExpenseItem {
  id: string;
  matterId: string;
  amountCents: number;
  category: string;
  description: string;
  status: BillingEntryStatus;
}

export interface BillingInvoiceSummary {
  id: string;
  matterId: string;
  number: string;
  status: "draft" | "approved" | "issued" | "partially_paid" | "paid" | "void";
  totalCents: number;
  balanceDueCents: number;
  issuedAt?: string;
  dueAt?: string;
}

export interface BillingPaymentSummary {
  id: string;
  matterId: string;
  invoiceId?: string;
  amountCents: number;
  method: "cash" | "card" | "eft" | "cheque" | "other";
  receivedAt: string;
  reference?: string;
}

export interface MatterBillingSummary {
  matterId: string;
  unbilledTime: BillingTimeItem[];
  unbilledExpenses: BillingExpenseItem[];
  invoices: BillingInvoiceSummary[];
  payments: BillingPaymentSummary[];
}

export interface BillingDashboardResponse {
  canView: boolean;
  summary: {
    unbilledTimeCents: number;
    unbilledExpenseCents: number;
    draftInvoiceCents: number;
    issuedBalanceDueCents: number;
  };
  matters: MatterBillingSummary[];
}

export interface QueueItem {
  id: string;
  matterId?: string;
  title: string;
  status: string;
  priority: "low" | "medium" | "high";
}

export interface QueueSection {
  key: string;
  label: string;
  items: QueueItem[];
}

export interface QueuesResponse {
  sections: QueueSection[];
}

export interface SetupStatusResponse {
  required: boolean;
  blocked: boolean;
  reason?: string;
  setupKeyRequired: boolean;
}
