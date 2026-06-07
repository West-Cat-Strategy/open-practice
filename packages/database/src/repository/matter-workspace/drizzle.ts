import {
  buildMatterSetupProfile,
  type AccessLogRecord,
  type AuditEvent,
  type Contact,
  type DocumentRecord,
  type ExpenseEntry,
  type ExternalUploadLinkRecord,
  type IntakeSessionRecord,
  type MatterParty,
  type PortalGrant,
  type ShareLinkRecord,
  type SignatureRequestRecord,
  type TaskDeadlineRecord,
  type TimeEntry,
  type TrustTransferRequestRecord,
  type User,
} from "@open-practice/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type {
  InvoiceWithLines,
  PaymentWithAllocations,
} from "../billing-invoices-payments-contracts.js";
import {
  buildActivityTimeline,
  mapCalendarEventRow,
  mapEmailOutboxRow,
  mapGeneratedDocumentRow,
  mapMatter,
  matterTrustBalance,
} from "../drizzle-mappers.js";
import type { LedgerSnapshot } from "../ledger-core-contracts.js";
import type { MatterSummary, PracticeOverview } from "../matter-workspace-contracts.js";

export interface DrizzleMatterWorkspaceDependencies {
  listUsers(firmId: string): Promise<User[]>;
  listPortalGrants(firmId: string): Promise<PortalGrant[]>;
  getLedger(firmId: string): Promise<LedgerSnapshot>;
  listMatterParties(firmId: string): Promise<MatterParty[]>;
  listContacts(firmId: string): Promise<Contact[]>;
  listDocuments(firmId: string): Promise<DocumentRecord[]>;
  listTimeEntries(firmId: string): Promise<TimeEntry[]>;
  listExpenseEntries(firmId: string): Promise<ExpenseEntry[]>;
  listShareLinks(firmId: string): Promise<ShareLinkRecord[]>;
  listExternalUploadLinks(firmId: string): Promise<ExternalUploadLinkRecord[]>;
  listAccessLogs(firmId: string): Promise<AccessLogRecord[]>;
  listAuditEvents(firmId: string): Promise<{ events: AuditEvent[] }>;
  listSignatureRequests(firmId: string): Promise<SignatureRequestRecord[]>;
  listIntakeSessions(firmId: string): Promise<IntakeSessionRecord[]>;
  listTaskDeadlines(
    firmId: string,
    options?: { matterIds?: string[]; includeCompleted?: boolean },
  ): Promise<TaskDeadlineRecord[]>;
  listInvoices(firmId: string): Promise<InvoiceWithLines[]>;
  listPayments(firmId: string): Promise<PaymentWithAllocations[]>;
  listTrustTransferRequests(firmId: string): Promise<TrustTransferRequestRecord[]>;
}

function isFirmWideMatterReader(user: User): boolean {
  return user.role === "owner_admin" || user.role === "auditor";
}

export async function getDrizzleMatterWorkspaceOverview(
  db: OpenPracticeDatabase,
  firmId: string,
  dependencies: Pick<
    DrizzleMatterWorkspaceDependencies,
    "getLedger" | "listPortalGrants" | "listUsers"
  >,
): Promise<PracticeOverview> {
  const [firmRow] = await db.select().from(schema.firms).where(eq(schema.firms.id, firmId));
  if (!firmRow) throw new Error(`Unknown firm ${firmId}`);
  const users = await dependencies.listUsers(firmId);
  const matters = await db.select().from(schema.matters).where(eq(schema.matters.firmId, firmId));
  const grants = await dependencies.listPortalGrants(firmId);
  const ledger = await dependencies.getLedger(firmId);
  const timeEntries = await db
    .select()
    .from(schema.timeEntries)
    .where(eq(schema.timeEntries.firmId, firmId));
  return {
    firm: { id: firmRow.id, name: firmRow.name, defaultProvince: firmRow.defaultProvince },
    metrics: {
      openMatters: matters.filter((matter) => matter.status === "open").length,
      intakeMatters: matters.filter((matter) => matter.status === "intake").length,
      portalGrants: grants.filter((grant) => !grant.revokedAt).length,
      trustBalanceCents: Object.values(ledger.trustBalances).reduce((sum, value) => sum + value, 0),
      unbilledMinutes: timeEntries
        .filter(
          (entry) =>
            entry.billable && ["draft", "submitted", "approved"].includes(entry.billingStatus),
        )
        .reduce((sum, entry) => sum + entry.minutes, 0),
    },
    users,
  };
}

export async function listDrizzleMatterWorkspaceMattersForUser(
  db: OpenPracticeDatabase,
  user: User,
  dependencies: DrizzleMatterWorkspaceDependencies,
): Promise<MatterSummary[]> {
  const firmWide = isFirmWideMatterReader(user);
  if (!firmWide && user.assignedMatterIds.length === 0) return [];
  const matterRows = firmWide
    ? await db.select().from(schema.matters).where(eq(schema.matters.firmId, user.firmId))
    : await db
        .select()
        .from(schema.matters)
        .where(
          and(
            eq(schema.matters.firmId, user.firmId),
            inArray(schema.matters.id, user.assignedMatterIds),
          ),
        );
  const visibleMatterIds = matterRows.map((matter) => matter.id);
  if (visibleMatterIds.length === 0) return [];
  const ledger = await dependencies.getLedger(user.firmId);
  const allParties = await dependencies.listMatterParties(user.firmId);
  const contacts = await dependencies.listContacts(user.firmId);
  const users = await dependencies.listUsers(user.firmId);
  const documents = await dependencies.listDocuments(user.firmId);
  const timeEntries = await dependencies.listTimeEntries(user.firmId);
  const expenses = await dependencies.listExpenseEntries(user.firmId);
  const grants = await dependencies.listPortalGrants(user.firmId);
  const shareLinks = await dependencies.listShareLinks(user.firmId);
  const externalUploadLinks = await dependencies.listExternalUploadLinks(user.firmId);
  const accessLogs = await dependencies.listAccessLogs(user.firmId);
  const audit = await dependencies.listAuditEvents(user.firmId);
  const emailRows = await db
    .select()
    .from(schema.emailOutbox)
    .where(
      and(
        eq(schema.emailOutbox.firmId, user.firmId),
        inArray(schema.emailOutbox.matterId, visibleMatterIds),
      ),
    );
  const emailOutbox = emailRows.map(mapEmailOutboxRow);
  const signatureRequests = await dependencies.listSignatureRequests(user.firmId);
  const intakeSessions = await dependencies.listIntakeSessions(user.firmId);
  const calendarRows = await db
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.firmId, user.firmId),
        inArray(schema.calendarEvents.matterId, visibleMatterIds),
        isNull(schema.calendarEvents.deletedAt),
      ),
    );
  const calendarEvents = calendarRows.map(mapCalendarEventRow);
  const taskDeadlines = await dependencies.listTaskDeadlines(user.firmId, {
    matterIds: visibleMatterIds,
    includeCompleted: true,
  });
  const generatedDocumentRows = await db
    .select()
    .from(schema.generatedDocuments)
    .where(eq(schema.generatedDocuments.firmId, user.firmId));
  const generatedDocuments = generatedDocumentRows.map(mapGeneratedDocumentRow);
  const invoices = await dependencies.listInvoices(user.firmId);
  const payments = await dependencies.listPayments(user.firmId);
  const trustTransferRequests = await dependencies.listTrustTransferRequests(user.firmId);

  return matterRows.map((row) => {
    const matter = mapMatter(row);
    const parties = allParties
      .filter((party) => party.matterId === matter.id)
      .map((party) => ({
        ...party,
        contact: contacts.find((contact) => contact.id === party.contactId)!,
      }));
    const matterDocuments = documents.filter((document) => document.matterId === matter.id);
    const matterTimeEntries = timeEntries.filter((entry) => entry.matterId === matter.id);
    const matterExpenses = expenses.filter((entry) => entry.matterId === matter.id);
    const activity = buildActivityTimeline({
      firmId: user.firmId,
      matter,
      contacts,
      matterParties: allParties,
      documents,
      portalGrants: grants,
      shareLinks,
      externalUploadLinks,
      accessLogs,
      auditEvents: audit.events,
      emailOutbox,
      signatureRequests,
      intakeSessions,
      generatedDocuments,
      calendarEvents,
      taskDeadlines,
      timeEntries,
      expenses,
      invoices,
      payments,
      trustTransferRequests,
      ledgerAccounts: ledger.accounts,
      ledgerEntries: ledger.entries,
    });
    const trustBalanceCents = matterTrustBalance(
      ledger.entries,
      ledger.accounts,
      matter,
      allParties,
    );
    return {
      ...matter,
      parties,
      documents: matterDocuments,
      timeEntries: matterTimeEntries,
      expenses: matterExpenses,
      activity,
      trustBalanceCents,
      setupProfile: buildMatterSetupProfile({
        matter,
        parties,
        documents: matterDocuments,
        timeEntries: matterTimeEntries,
        expenses: matterExpenses,
        activity,
        trustBalanceCents,
        users,
      }),
    };
  });
}
