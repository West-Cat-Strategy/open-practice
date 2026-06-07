import {
  buildMatterSetupProfile,
  type AccessLogRecord,
  type AuditEvent,
  type CalendarEventRecord,
  type Contact,
  type DocumentRecord,
  type EmailOutboxRecord,
  type ExpenseEntry,
  type ExternalUploadLinkRecord,
  type Firm,
  type GeneratedDocumentRecord,
  type IntakeSessionRecord,
  type InvoiceLineRecord,
  type InvoiceRecord,
  type LedgerAccount,
  type ManualPaymentRecord,
  type Matter,
  type MatterParty,
  type PaymentAllocationRecord,
  type PortalGrant,
  type PostedLedgerTransaction,
  type ShareLinkRecord,
  type SignatureRequestRecord,
  type TaskDeadlineRecord,
  type TimeEntry,
  type TrustTransferRequestRecord,
  type User,
} from "@open-practice/domain";
import { clone } from "../contracts.js";
import { buildActivityTimeline, matterTrustBalance } from "../drizzle-mappers.js";
import type { LedgerSnapshot } from "../ledger-core-contracts.js";
import type { MatterSummary, PracticeOverview } from "../matter-workspace-contracts.js";

export interface MemoryMatterWorkspaceStore {
  firms: Firm[];
  users: User[];
  matters: Matter[];
  matterParties: MatterParty[];
  contacts: Contact[];
  documents: DocumentRecord[];
  timeEntries: TimeEntry[];
  expenseEntries: ExpenseEntry[];
  portalGrants: PortalGrant[];
  shareLinks: ShareLinkRecord[];
  externalUploadLinks: ExternalUploadLinkRecord[];
  accessLogs: AccessLogRecord[];
  auditEvents: AuditEvent[];
  emailOutbox: EmailOutboxRecord[];
  signatureRequests: SignatureRequestRecord[];
  intakeSessions: IntakeSessionRecord[];
  generatedDocuments: GeneratedDocumentRecord[];
  calendarEvents: CalendarEventRecord[];
  taskDeadlines: TaskDeadlineRecord[];
  invoices: InvoiceRecord[];
  invoiceLines: InvoiceLineRecord[];
  manualPayments: ManualPaymentRecord[];
  paymentAllocations: PaymentAllocationRecord[];
  trustTransferRequests: TrustTransferRequestRecord[];
  ledgerAccounts: LedgerAccount[];
  postedTransactions: PostedLedgerTransaction[];
}

export interface MemoryMatterWorkspaceDependencies {
  getLedger(firmId: string): Promise<LedgerSnapshot>;
}

function isFirmWideMatterReader(user: User): boolean {
  return user.role === "owner_admin" || user.role === "auditor";
}

export async function getMemoryMatterWorkspaceOverview(
  store: MemoryMatterWorkspaceStore,
  firmId: string,
  dependencies: MemoryMatterWorkspaceDependencies,
): Promise<PracticeOverview> {
  const firm = store.firms.find((candidate) => candidate.id === firmId);
  if (!firm) throw new Error(`Unknown firm ${firmId}`);
  const matters = store.matters.filter((matter) => matter.firmId === firmId);
  const ledger = await dependencies.getLedger(firmId);
  return {
    firm: clone(firm),
    metrics: {
      openMatters: matters.filter((matter) => matter.status === "open").length,
      intakeMatters: matters.filter((matter) => matter.status === "intake").length,
      portalGrants: store.portalGrants.filter(
        (grant) => grant.firmId === firmId && !grant.revokedAt,
      ).length,
      trustBalanceCents: Object.values(ledger.trustBalances).reduce((sum, value) => sum + value, 0),
      unbilledMinutes: store.timeEntries
        .filter(
          (entry) =>
            entry.firmId === firmId &&
            entry.billable &&
            ["draft", "submitted", "approved"].includes(entry.billingStatus),
        )
        .reduce((sum, entry) => sum + entry.minutes, 0),
    },
    users: clone(store.users.filter((user) => user.firmId === firmId)),
  };
}

export function listMemoryMatterWorkspaceMattersForUser(
  store: MemoryMatterWorkspaceStore,
  user: User,
): MatterSummary[] {
  const entries = store.postedTransactions.flatMap((transaction) => transaction.entries);
  const visibleMatterIds = new Set(user.assignedMatterIds);
  return store.matters
    .filter(
      (matter) =>
        matter.firmId === user.firmId &&
        (isFirmWideMatterReader(user) || visibleMatterIds.has(matter.id)),
    )
    .map((matter) => {
      const parties = store.matterParties
        .filter((party) => party.matterId === matter.id)
        .map((party) => ({
          ...party,
          contact: store.contacts.find((contact) => contact.id === party.contactId)!,
        }));
      const documents = store.documents.filter((document) => document.matterId === matter.id);
      const timeEntries = store.timeEntries.filter((entry) => entry.matterId === matter.id);
      const expenses = store.expenseEntries.filter((entry) => entry.matterId === matter.id);
      const activity = buildActivityTimeline({
        firmId: user.firmId,
        matter,
        contacts: store.contacts,
        matterParties: store.matterParties,
        documents: store.documents,
        portalGrants: store.portalGrants,
        shareLinks: store.shareLinks,
        externalUploadLinks: store.externalUploadLinks,
        accessLogs: store.accessLogs,
        auditEvents: store.auditEvents,
        emailOutbox: store.emailOutbox,
        signatureRequests: store.signatureRequests,
        intakeSessions: store.intakeSessions,
        generatedDocuments: store.generatedDocuments,
        calendarEvents: store.calendarEvents,
        taskDeadlines: store.taskDeadlines,
        timeEntries: store.timeEntries,
        expenses: store.expenseEntries,
        invoices: store.invoices.map((invoice) => ({
          ...invoice,
          lines: store.invoiceLines.filter((line) => line.invoiceId === invoice.id),
        })),
        payments: store.manualPayments.map((payment) => ({
          ...payment,
          allocations: store.paymentAllocations.filter(
            (allocation) => allocation.paymentId === payment.id,
          ),
        })),
        trustTransferRequests: store.trustTransferRequests,
        ledgerAccounts: store.ledgerAccounts,
        ledgerEntries: entries,
      });
      const trustBalanceCents = matterTrustBalance(
        entries,
        store.ledgerAccounts,
        matter,
        store.matterParties,
      );
      return {
        ...matter,
        parties,
        documents,
        timeEntries,
        expenses,
        activity,
        trustBalanceCents,
        setupProfile: buildMatterSetupProfile({
          matter,
          parties,
          documents,
          timeEntries,
          expenses,
          activity,
          trustBalanceCents,
          users: store.users.filter((candidate) => candidate.firmId === user.firmId),
        }),
      };
    });
}
