import { and, asc, eq, inArray } from "drizzle-orm";
import {
  appendAuditEvent,
  canShareDocumentThroughPortal,
  clientTrustBalanceByMatter,
  ledgerBalanceByMatter,
  postLedgerTransaction,
  runConflictCheck,
  verifyAuditChain,
  type ActivityTimelineEntry,
  type AuditEvent,
  type Contact,
  type DocumentRecord,
  type ExpenseEntry,
  type Firm,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerTransaction,
  type Matter,
  type MatterParty,
  type PortalGrant,
  type PostedLedgerTransaction,
  type TimeEntry,
  type User,
} from "@open-practice/domain";
import {
  sampleAuditEvents,
  sampleContacts,
  sampleDocuments,
  sampleExpenseEntries,
  sampleFirm,
  sampleGeneratedDocuments,
  sampleIntakeSessions,
  sampleIntakeTemplates,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleMatterParties,
  sampleMatters,
  samplePortalGrants,
  sampleSignatureProviderEvents,
  sampleSignatureRequestSigners,
  sampleSignatureRequests,
  sampleSignatureWebhookAttempts,
  sampleTimeEntries,
  sampleUsers,
} from "@open-practice/domain/sample-data";
import type {
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureProviderStatus,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "@open-practice/domain";
import type { OpenPracticeDatabase } from "./runtime.js";
import * as schema from "./schema.js";

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

export interface DocumentUploadIntent {
  id: string;
  firmId: string;
  matterId: string;
  title: string;
  storageKey: string;
  checksumSha256: string;
  classification: DocumentRecord["classification"];
  legalHold: boolean;
}

export interface OpenPracticeRepository {
  getUser(firmId: string, userId: string): Promise<User | undefined>;
  getOverview(firmId: string): Promise<PracticeOverview>;
  listMattersForUser(user: User): Promise<MatterSummary[]>;
  getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined>;
  runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }>;
  getLedger(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }>;
  validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void>;
  postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction>;
  listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }>;
  listPortalGrants(firmId: string): Promise<PortalGrant[]>;
  createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord>;
  completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord>;
  listSignatureRequests(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<SignatureRequestRecord[]>;
  createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }>;
  recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord>;
  listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]>;
  listIntakeSessions(
    firmId: string,
    options?: { matterId?: string },
  ): Promise<IntakeSessionRecord[]>;
  getIntakeSession(firmId: string, sessionId: string): Promise<IntakeSessionRecord | undefined>;
  createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord>;
  createGeneratedDocument(document: GeneratedDocumentRecord): Promise<GeneratedDocumentRecord>;
}

function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

function dateToIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function matterTrustBalance(
  entries: LedgerEntry[],
  accounts: LedgerAccount[],
  matter: Matter,
  parties: MatterParty[],
): number {
  const clientParty = parties.find((party) => party.matterId === matter.id && !party.adverse);
  if (!clientParty) return 0;
  const key = `${clientParty.contactId}:${matter.id}`;
  return clientTrustBalanceByMatter(entries, accounts)[key] ?? 0;
}

function userHasFirmWideLedgerAccess(user: User): boolean {
  return ["owner_admin", "auditor", "billing_bookkeeper"].includes(user.role);
}

function mapDocumentRow(row: typeof schema.documents.$inferSelect): DocumentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    title: row.title,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    version: row.version,
    classification: row.classification,
    legalHold: row.legalHold,
    uploadStatus: row.uploadStatus as DocumentRecord["uploadStatus"],
    checksumStatus: row.checksumStatus as DocumentRecord["checksumStatus"],
    scanStatus: row.scanStatus as DocumentRecord["scanStatus"],
    duplicateOfDocumentId: row.duplicateOfDocumentId ?? undefined,
    uploadedAt: dateToIso(row.uploadedAt),
    verifiedAt: dateToIso(row.verifiedAt),
  };
}

function mapSignatureRequestRow(
  row: typeof schema.signatureRequests.$inferSelect,
): SignatureRequestRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    documentId: row.documentId,
    title: row.title,
    requestedByUserId: row.requestedByUserId,
    provider: row.provider as SignatureRequestRecord["provider"],
    externalId: row.externalId,
    status: row.status as SignatureProviderStatus,
    signingUrl: row.signingUrl ?? undefined,
    consentText: row.consentText,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    completedAt: dateToIso(row.completedAt),
    declinedAt: dateToIso(row.declinedAt),
  };
}

function mapIntakeSessionRow(row: typeof schema.intakeSessions.$inferSelect): IntakeSessionRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    matterId: row.matterId,
    templateId: row.templateId,
    provider: row.provider as IntakeSessionRecord["provider"],
    externalId: row.externalId,
    status: row.status as IntakeSessionRecord["status"],
    clientContactId: row.clientContactId ?? undefined,
    interviewUrl: row.interviewUrl ?? undefined,
    evidence: row.evidence as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildActivityTimeline(input: {
  firmId: string;
  matterId: string;
  documents: DocumentRecord[];
  portalGrants: PortalGrant[];
  auditEvents: AuditEvent[];
  signatureRequests: SignatureRequestRecord[];
  intakeSessions: IntakeSessionRecord[];
}): ActivityTimelineEntry[] {
  const entries: ActivityTimelineEntry[] = [
    ...input.auditEvents
      .filter((event) => event.firmId === input.firmId)
      .filter(
        (event) =>
          event.resourceId === input.matterId ||
          event.metadata.matterId === input.matterId ||
          event.resourceType === "conflict_check",
      )
      .map((event) => ({
        id: event.id,
        firmId: event.firmId,
        matterId:
          typeof event.metadata.matterId === "string" ? event.metadata.matterId : input.matterId,
        occurredAt: event.occurredAt,
        title: event.action.replaceAll("_", " ").replaceAll(".", " "),
        kind: event.resourceType === "conflict_check" ? ("conflict" as const) : ("audit" as const),
        actorId: event.actorId,
        metadata: event.metadata,
      })),
    ...input.documents
      .filter((document) => document.matterId === input.matterId)
      .map((document) => ({
        id: `document:${document.id}`,
        firmId: document.firmId,
        matterId: document.matterId,
        occurredAt: document.verifiedAt ?? document.uploadedAt ?? new Date(0).toISOString(),
        title: `Document ${document.uploadStatus}: ${document.title}`,
        kind: "document" as const,
        metadata: {
          checksumStatus: document.checksumStatus,
          scanStatus: document.scanStatus,
          portalShareable: input.portalGrants.some((grant) =>
            canShareDocumentThroughPortal({ document, grant }),
          ),
        },
      })),
    ...input.portalGrants
      .filter((grant) => grant.matterId === input.matterId)
      .map((grant) => ({
        id: `portal:${grant.id}`,
        firmId: grant.firmId,
        matterId: grant.matterId,
        occurredAt: grant.expiresAt ?? new Date(0).toISOString(),
        title: grant.revokedAt ? "Portal grant revoked" : "Portal grant active",
        kind: "portal" as const,
        actorId: grant.grantedByUserId,
        metadata: { permissions: grant.permissions, contactId: grant.contactId },
      })),
    ...input.signatureRequests
      .filter((request) => request.matterId === input.matterId)
      .map((request) => ({
        id: `signature:${request.id}`,
        firmId: request.firmId,
        matterId: request.matterId,
        occurredAt: request.completedAt ?? request.declinedAt ?? request.createdAt,
        title: `Signature ${request.status}: ${request.title}`,
        kind: "signature" as const,
        actorId: request.requestedByUserId,
        metadata: { provider: request.provider, documentId: request.documentId },
      })),
    ...input.intakeSessions
      .filter((session) => session.matterId === input.matterId)
      .map((session) => ({
        id: `intake:${session.id}`,
        firmId: session.firmId,
        matterId: session.matterId,
        occurredAt: session.updatedAt,
        title: `Intake ${session.status}`,
        kind: "intake" as const,
        metadata: { templateId: session.templateId, provider: session.provider },
      })),
  ];

  return entries
    .filter((entry) => entry.occurredAt !== new Date(0).toISOString())
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export class InMemoryOpenPracticeRepository implements OpenPracticeRepository {
  private readonly firm = clone(sampleFirm);
  private readonly users = clone(sampleUsers);
  private readonly contacts = clone(sampleContacts);
  private readonly matters = clone(sampleMatters);
  private readonly matterParties = clone(sampleMatterParties);
  private readonly documents = clone(sampleDocuments);
  private readonly portalGrants = clone(samplePortalGrants);
  private readonly timeEntries = clone(sampleTimeEntries);
  private readonly expenseEntries = clone(sampleExpenseEntries);
  private readonly ledgerAccounts = clone(sampleLedgerAccounts);
  private readonly intakeTemplates = clone(sampleIntakeTemplates);
  private signatureRequestSigners = clone(sampleSignatureRequestSigners);
  private signatureProviderEvents = clone(sampleSignatureProviderEvents);
  private signatureWebhookAttempts = clone(sampleSignatureWebhookAttempts);
  private signatureRequests = clone(sampleSignatureRequests);
  private intakeSessions = clone(sampleIntakeSessions);
  private generatedDocuments = clone(sampleGeneratedDocuments);
  private auditEvents = clone(sampleAuditEvents);
  private postedTransactions: PostedLedgerTransaction[] = [
    {
      id: "trust-retainer",
      firmId: this.firm.id,
      idempotencyKey: "retainer",
      requestFingerprint: "seed:retainer",
      entries: clone(sampleLedgerEntries),
    },
  ];

  async getUser(firmId: string, userId: string): Promise<User | undefined> {
    return clone(this.users.find((user) => user.firmId === firmId && user.id === userId));
  }

  async getOverview(firmId: string): Promise<PracticeOverview> {
    const matters = this.matters.filter((matter) => matter.firmId === firmId);
    const ledger = await this.getLedger(firmId);
    return {
      firm: clone(this.firm),
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        intakeMatters: matters.filter((matter) => matter.status === "intake").length,
        portalGrants: this.portalGrants.filter(
          (grant) => grant.firmId === firmId && !grant.revokedAt,
        ).length,
        trustBalanceCents: Object.values(ledger.trustBalances).reduce(
          (sum, value) => sum + value,
          0,
        ),
        unbilledMinutes: this.timeEntries
          .filter((entry) => entry.firmId === firmId && entry.billable)
          .reduce((sum, entry) => sum + entry.minutes, 0),
      },
      users: clone(this.users.filter((user) => user.firmId === firmId)),
    };
  }

  async listMattersForUser(user: User): Promise<MatterSummary[]> {
    const entries = this.postedTransactions.flatMap((transaction) => transaction.entries);
    return this.matters
      .filter(
        (matter) => matter.firmId === user.firmId && user.assignedMatterIds.includes(matter.id),
      )
      .map((matter) => {
        const parties = this.matterParties
          .filter((party) => party.matterId === matter.id)
          .map((party) => ({
            ...party,
            contact: this.contacts.find((contact) => contact.id === party.contactId)!,
          }));
        return {
          ...matter,
          parties,
          documents: this.documents.filter((document) => document.matterId === matter.id),
          timeEntries: this.timeEntries.filter((entry) => entry.matterId === matter.id),
          expenses: this.expenseEntries.filter((entry) => entry.matterId === matter.id),
          activity: buildActivityTimeline({
            firmId: user.firmId,
            matterId: matter.id,
            documents: this.documents,
            portalGrants: this.portalGrants,
            auditEvents: this.auditEvents,
            signatureRequests: this.signatureRequests,
            intakeSessions: this.intakeSessions,
          }),
          trustBalanceCents: matterTrustBalance(
            entries,
            this.ledgerAccounts,
            matter,
            this.matterParties,
          ),
        };
      });
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    return clone(
      this.documents.find((document) => document.firmId === firmId && document.id === documentId),
    );
  }

  async runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }> {
    const results = runConflictCheck({
      ...input,
      contacts: this.contacts,
      matters: this.matters,
      matterParties: this.matterParties,
    });
    this.auditEvents = [
      ...this.auditEvents,
      appendAuditEvent(this.auditEvents.at(-1), {
        id: `audit-${String(this.auditEvents.length + 1).padStart(3, "0")}`,
        firmId: input.firmId,
        actorId: input.actorId,
        action: "conflict_check.completed",
        resourceType: "conflict_check",
        resourceId: `conflict-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
      }),
    ];
    return { results, auditChainValid: this.auditEvents.length > 0 };
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }> {
    const accounts = this.ledgerAccounts.filter((account) => account.firmId === firmId);
    const entries = this.postedTransactions
      .flatMap((transaction) => transaction.entries)
      .filter(
        (entry) =>
          entry.firmId === firmId && (!options.matterId || entry.matterId === options.matterId),
      );
    return {
      accounts: clone(accounts),
      entries: clone(entries),
      balances: ledgerBalanceByMatter(entries),
      trustBalances: clientTrustBalanceByMatter(entries, accounts),
    };
  }

  async validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void> {
    if (input.transaction.firmId !== input.user.firmId) {
      throw new Error("Ledger transaction firm does not match authenticated user");
    }

    const firmWide = userHasFirmWideLedgerAccess(input.user);
    for (const entry of input.transaction.entries) {
      if (entry.firmId !== input.user.firmId) {
        throw new Error("Ledger entry firm does not match authenticated user");
      }
      if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
        throw new Error("Ledger entry is outside the authenticated matter scope");
      }
      const matter = this.matters.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
      );
      if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
      const contact = this.contacts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
      );
      if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
      const account = this.ledgerAccounts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
      );
      if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
      const party = this.matterParties.find(
        (candidate) =>
          candidate.firmId === input.user.firmId &&
          candidate.matterId === entry.matterId &&
          candidate.contactId === entry.clientId &&
          !candidate.adverse,
      );
      if (!party) {
        throw new Error("Ledger client must be a non-adverse party on the matter");
      }
    }
  }

  async postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction> {
    const posted = postLedgerTransaction(
      { postedTransactions: this.postedTransactions, accounts: this.ledgerAccounts },
      transaction,
    );
    if (!this.postedTransactions.some((existing) => existing.id === posted.id)) {
      this.postedTransactions = [...this.postedTransactions, posted];
    }
    return clone(posted);
  }

  async listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const events = this.auditEvents.filter((event) => event.firmId === firmId);
    return { events: clone(events), valid: verifyAuditChain(events) };
  }

  async listPortalGrants(firmId: string): Promise<PortalGrant[]> {
    return clone(this.portalGrants.filter((grant) => grant.firmId === firmId));
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    const document: DocumentRecord = {
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: input.storageKey,
      checksumSha256: input.checksumSha256,
      version: 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "intent_created",
      checksumStatus: "pending",
      scanStatus: "pending",
    };
    this.documents.push(document);
    return clone(document);
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const document = this.documents.find(
      (candidate) => candidate.firmId === input.firmId && candidate.id === input.documentId,
    );
    if (!document) throw new Error(`Unknown document ${input.documentId}`);

    const duplicate = this.documents.find(
      (candidate) =>
        candidate.firmId === input.firmId &&
        candidate.id !== input.documentId &&
        candidate.checksumSha256 === input.checksumSha256 &&
        candidate.checksumStatus === "verified",
    );
    const now = new Date().toISOString();
    document.uploadedAt = now;
    document.verifiedAt = now;

    if (document.checksumSha256 !== input.checksumSha256) {
      document.uploadStatus = "rejected";
      document.checksumStatus = "mismatch";
      document.scanStatus = "failed";
      return clone(document);
    }

    document.uploadStatus = "verified";
    document.checksumStatus = duplicate ? "duplicate" : "verified";
    document.duplicateOfDocumentId = duplicate?.id;
    document.scanStatus = input.scanStatus ?? "queued";
    return clone(document);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<SignatureRequestRecord[]> {
    return clone(
      this.signatureRequests.filter(
        (request) =>
          request.firmId === firmId && (!options.matterId || request.matterId === options.matterId),
      ),
    );
  }

  async createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }> {
    this.signatureRequests = [...this.signatureRequests, clone(input.request)];
    this.signatureRequestSigners = [...this.signatureRequestSigners, ...clone(input.signers)];
    this.signatureProviderEvents = [...this.signatureProviderEvents, clone(input.event)];
    return { request: clone(input.request), signers: clone(input.signers) };
  }

  async recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord> {
    this.signatureProviderEvents = [...this.signatureProviderEvents, clone(event)];
    if (webhookAttempt) {
      this.signatureWebhookAttempts = [...this.signatureWebhookAttempts, clone(webhookAttempt)];
    }
    this.signatureRequests = this.signatureRequests.map((request) =>
      request.firmId === event.firmId && request.id === event.signatureRequestId
        ? {
            ...request,
            status: event.status,
            completedAt: event.status === "completed" ? event.occurredAt : request.completedAt,
            declinedAt: event.status === "declined" ? event.occurredAt : request.declinedAt,
            evidence: event.evidence,
          }
        : request,
    );
    return clone(event);
  }

  async listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]> {
    return clone(this.intakeTemplates.filter((template) => template.firmId === firmId));
  }

  async listIntakeSessions(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<IntakeSessionRecord[]> {
    return clone(
      this.intakeSessions.filter(
        (session) =>
          session.firmId === firmId && (!options.matterId || session.matterId === options.matterId),
      ),
    );
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): Promise<IntakeSessionRecord | undefined> {
    return clone(
      this.intakeSessions.find((session) => session.firmId === firmId && session.id === sessionId),
    );
  }

  async createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord> {
    this.intakeSessions = [...this.intakeSessions, clone(session)];
    return clone(session);
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    this.generatedDocuments = [...this.generatedDocuments, clone(document)];
    return clone(document);
  }
}

export class DrizzleOpenPracticeRepository implements OpenPracticeRepository {
  constructor(private readonly db: OpenPracticeDatabase) {}

  async getUser(firmId: string, userId: string): Promise<User | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.firmId, firmId), eq(schema.users.id, userId)));
    if (!row) return undefined;
    const assignments = await this.db
      .select()
      .from(schema.matterAssignments)
      .where(eq(schema.matterAssignments.userId, userId));
    return {
      id: row.id,
      firmId: row.firmId,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      assignedMatterIds: assignments.map((assignment) => assignment.matterId),
      mfaEnabled: row.mfaEnabled,
    };
  }

  async getOverview(firmId: string): Promise<PracticeOverview> {
    const [firmRow] = await this.db.select().from(schema.firms).where(eq(schema.firms.id, firmId));
    if (!firmRow) throw new Error(`Unknown firm ${firmId}`);
    const users = await this.listUsers(firmId);
    const matters = await this.db
      .select()
      .from(schema.matters)
      .where(eq(schema.matters.firmId, firmId));
    const grants = await this.listPortalGrants(firmId);
    const ledger = await this.getLedger(firmId);
    const timeEntries = await this.db
      .select()
      .from(schema.timeEntries)
      .where(eq(schema.timeEntries.firmId, firmId));
    return {
      firm: { id: firmRow.id, name: firmRow.name, defaultProvince: firmRow.defaultProvince },
      metrics: {
        openMatters: matters.filter((matter) => matter.status === "open").length,
        intakeMatters: matters.filter((matter) => matter.status === "intake").length,
        portalGrants: grants.filter((grant) => !grant.revokedAt).length,
        trustBalanceCents: Object.values(ledger.trustBalances).reduce(
          (sum, value) => sum + value,
          0,
        ),
        unbilledMinutes: timeEntries
          .filter((entry) => entry.billable)
          .reduce((sum, entry) => sum + entry.minutes, 0),
      },
      users,
    };
  }

  async listMattersForUser(user: User): Promise<MatterSummary[]> {
    if (user.assignedMatterIds.length === 0) return [];
    const matterRows = await this.db
      .select()
      .from(schema.matters)
      .where(inArray(schema.matters.id, user.assignedMatterIds));
    const ledger = await this.getLedger(user.firmId);
    const allParties = await this.listMatterParties(user.firmId);
    const contacts = await this.listContacts(user.firmId);
    const documents = await this.listDocuments(user.firmId);
    const timeEntries = await this.listTimeEntries(user.firmId);
    const expenses = await this.listExpenseEntries(user.firmId);
    const grants = await this.listPortalGrants(user.firmId);
    const audit = await this.listAuditEvents(user.firmId);
    const signatureRequests = await this.listSignatureRequests(user.firmId);
    const intakeSessions = await this.listIntakeSessions(user.firmId);

    return matterRows.map((row) => {
      const matter = mapMatter(row);
      const parties = allParties
        .filter((party) => party.matterId === matter.id)
        .map((party) => ({
          ...party,
          contact: contacts.find((contact) => contact.id === party.contactId)!,
        }));
      return {
        ...matter,
        parties,
        documents: documents.filter((document) => document.matterId === matter.id),
        timeEntries: timeEntries.filter((entry) => entry.matterId === matter.id),
        expenses: expenses.filter((entry) => entry.matterId === matter.id),
        activity: buildActivityTimeline({
          firmId: user.firmId,
          matterId: matter.id,
          documents,
          portalGrants: grants,
          auditEvents: audit.events,
          signatureRequests,
          intakeSessions,
        }),
        trustBalanceCents: matterTrustBalance(ledger.entries, ledger.accounts, matter, allParties),
      };
    });
  }

  async getDocument(firmId: string, documentId: string): Promise<DocumentRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.firmId, firmId), eq(schema.documents.id, documentId)));
    return row ? mapDocumentRow(row) : undefined;
  }

  async runConflictCheck(input: {
    firmId: string;
    actorId: string;
    prospectiveName: string;
    aliases?: string[];
    identifiers?: Array<{ type: string; value: string }>;
    prospectiveRole?: "client" | "opposing_party" | "third_party";
    includeClosedMatters: boolean;
  }): Promise<{ results: ReturnType<typeof runConflictCheck>; auditChainValid: boolean }> {
    const contacts = await this.listContacts(input.firmId);
    const matters = (
      await this.db.select().from(schema.matters).where(eq(schema.matters.firmId, input.firmId))
    ).map(mapMatter);
    const matterParties = await this.listMatterParties(input.firmId);
    const results = runConflictCheck({ ...input, contacts, matters, matterParties });
    const previous = (await this.listAuditEvents(input.firmId)).events.at(-1);
    const event = appendAuditEvent(previous, {
      id: crypto.randomUUID(),
      firmId: input.firmId,
      actorId: input.actorId,
      action: "conflict_check.completed",
      resourceType: "conflict_check",
      resourceId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      metadata: { prospectiveName: input.prospectiveName, matchCount: results.length },
    });
    await this.db.insert(schema.auditEvents).values({
      ...event,
      occurredAt: new Date(event.occurredAt),
    });
    return { results, auditChainValid: (await this.listAuditEvents(input.firmId)).valid };
  }

  async getLedger(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<{
    accounts: LedgerAccount[];
    entries: LedgerEntry[];
    balances: Record<string, number>;
    trustBalances: Record<string, number>;
  }> {
    const accounts = (await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.firmId, firmId))) as LedgerAccount[];
    const rows = await this.db
      .select()
      .from(schema.trustLedgerEntries)
      .where(
        options.matterId
          ? and(
              eq(schema.trustLedgerEntries.firmId, firmId),
              eq(schema.trustLedgerEntries.matterId, options.matterId),
            )
          : eq(schema.trustLedgerEntries.firmId, firmId),
      );
    const transactionRows = await this.db
      .select()
      .from(schema.trustTransactions)
      .where(eq(schema.trustTransactions.firmId, firmId));
    const postedAtByTransactionId = new Map(
      transactionRows.map((transaction) => [transaction.id, transaction.postedAt.toISOString()]),
    );
    const entries: LedgerEntry[] = rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      firmId: row.firmId,
      matterId: row.matterId,
      clientId: row.clientId,
      accountId: row.accountId,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      memo: row.memo,
      postedAt: postedAtByTransactionId.get(row.transactionId) ?? "",
    }));
    return {
      accounts,
      entries,
      balances: ledgerBalanceByMatter(entries),
      trustBalances: clientTrustBalanceByMatter(entries, accounts),
    };
  }

  async validateLedgerTransactionScope(input: {
    user: User;
    transaction: LedgerTransaction;
  }): Promise<void> {
    if (input.transaction.firmId !== input.user.firmId) {
      throw new Error("Ledger transaction firm does not match authenticated user");
    }

    const firmWide = userHasFirmWideLedgerAccess(input.user);
    const matterIds = [...new Set(input.transaction.entries.map((entry) => entry.matterId))];
    const clientIds = [...new Set(input.transaction.entries.map((entry) => entry.clientId))];
    const accountIds = [...new Set(input.transaction.entries.map((entry) => entry.accountId))];

    const [matters, contacts, accounts, parties] = await Promise.all([
      this.db.select().from(schema.matters).where(inArray(schema.matters.id, matterIds)),
      this.db.select().from(schema.contacts).where(inArray(schema.contacts.id, clientIds)),
      this.db
        .select()
        .from(schema.ledgerAccounts)
        .where(inArray(schema.ledgerAccounts.id, accountIds)),
      this.db
        .select()
        .from(schema.matterParties)
        .where(inArray(schema.matterParties.matterId, matterIds)),
    ]);

    for (const entry of input.transaction.entries) {
      if (entry.firmId !== input.user.firmId) {
        throw new Error("Ledger entry firm does not match authenticated user");
      }
      if (!firmWide && !input.user.assignedMatterIds.includes(entry.matterId)) {
        throw new Error("Ledger entry is outside the authenticated matter scope");
      }
      const matter = matters.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.matterId,
      );
      if (!matter) throw new Error(`Unknown ledger matter ${entry.matterId}`);
      const contact = contacts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.clientId,
      );
      if (!contact) throw new Error(`Unknown ledger client ${entry.clientId}`);
      const account = accounts.find(
        (candidate) => candidate.firmId === input.user.firmId && candidate.id === entry.accountId,
      );
      if (!account) throw new Error(`Unknown ledger account ${entry.accountId}`);
      const party = parties.find(
        (candidate) =>
          candidate.firmId === input.user.firmId &&
          candidate.matterId === entry.matterId &&
          candidate.contactId === entry.clientId &&
          !candidate.adverse,
      );
      if (!party) {
        throw new Error("Ledger client must be a non-adverse party on the matter");
      }
    }
  }

  async postLedgerTransaction(transaction: LedgerTransaction): Promise<PostedLedgerTransaction> {
    const existingRows = await this.db
      .select()
      .from(schema.trustTransactions)
      .where(eq(schema.trustTransactions.firmId, transaction.firmId));
    const entryRows = await this.db
      .select()
      .from(schema.trustLedgerEntries)
      .where(eq(schema.trustLedgerEntries.firmId, transaction.firmId));
    const postedTransactions: PostedLedgerTransaction[] = existingRows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      idempotencyKey: row.idempotencyKey,
      requestFingerprint: row.requestFingerprint,
      reversesTransactionId: row.reversesTransactionId ?? undefined,
      entries: entryRows
        .filter((entry) => entry.transactionId === row.id)
        .map((entry) => ({
          id: entry.id,
          transactionId: entry.transactionId,
          firmId: entry.firmId,
          matterId: entry.matterId,
          clientId: entry.clientId,
          accountId: entry.accountId,
          debitCents: entry.debitCents,
          creditCents: entry.creditCents,
          memo: entry.memo,
          postedAt: row.postedAt.toISOString(),
        })),
    }));
    const accounts = (await this.db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.firmId, transaction.firmId))) as LedgerAccount[];
    const posted = postLedgerTransaction({ postedTransactions, accounts }, transaction);
    const alreadySaved = postedTransactions.some((existing) => existing.id === posted.id);
    if (!alreadySaved) {
      await this.db.transaction(async (tx) => {
        await tx.insert(schema.trustTransactions).values({
          id: posted.id,
          firmId: posted.firmId,
          idempotencyKey: posted.idempotencyKey,
          requestFingerprint: posted.requestFingerprint,
          postedByUserId: transaction.postedByUserId,
          postedAt: new Date(transaction.postedAt),
          reversesTransactionId: posted.reversesTransactionId,
        });
        await tx.insert(schema.trustLedgerEntries).values(posted.entries);
      });
    }
    return posted;
  }

  async listAuditEvents(firmId: string): Promise<{ events: AuditEvent[]; valid: boolean }> {
    const rows = await this.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.firmId, firmId))
      .orderBy(asc(schema.auditEvents.occurredAt));
    const events = rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
      metadata: row.metadata as Record<string, unknown>,
    }));
    return { events, valid: verifyAuditChain(events) };
  }

  async listPortalGrants(firmId: string): Promise<PortalGrant[]> {
    const rows = await this.db
      .select()
      .from(schema.portalGrants)
      .where(eq(schema.portalGrants.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      matterId: row.matterId,
      contactId: row.contactId,
      grantedByUserId: row.grantedByUserId,
      permissions: row.permissions as PortalGrant["permissions"],
      expiresAt: dateToIso(row.expiresAt),
      revokedAt: dateToIso(row.revokedAt),
    }));
  }

  async createDocumentUploadIntent(input: DocumentUploadIntent): Promise<DocumentRecord> {
    const document = {
      id: input.id,
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      storageKey: input.storageKey,
      checksumSha256: input.checksumSha256,
      version: 1,
      classification: input.classification,
      legalHold: input.legalHold,
      uploadStatus: "intent_created" as const,
      checksumStatus: "pending" as const,
      scanStatus: "pending" as const,
    };
    await this.db.insert(schema.documents).values(document);
    return document;
  }

  async completeDocumentUpload(input: {
    firmId: string;
    documentId: string;
    checksumSha256: string;
    scanStatus?: DocumentRecord["scanStatus"];
  }): Promise<DocumentRecord> {
    const document = await this.getDocument(input.firmId, input.documentId);
    if (!document) throw new Error(`Unknown document ${input.documentId}`);
    const documents = await this.listDocuments(input.firmId);
    const duplicate = documents.find(
      (candidate) =>
        candidate.id !== input.documentId &&
        candidate.checksumSha256 === input.checksumSha256 &&
        candidate.checksumStatus === "verified",
    );
    const now = new Date();
    const checksumMatches = document.checksumSha256 === input.checksumSha256;
    const [row] = await this.db
      .update(schema.documents)
      .set({
        uploadStatus: checksumMatches ? "verified" : "rejected",
        checksumStatus: checksumMatches ? (duplicate ? "duplicate" : "verified") : "mismatch",
        scanStatus: checksumMatches ? (input.scanStatus ?? "queued") : "failed",
        duplicateOfDocumentId: duplicate?.id,
        uploadedAt: now,
        verifiedAt: now,
      })
      .where(
        and(eq(schema.documents.firmId, input.firmId), eq(schema.documents.id, input.documentId)),
      )
      .returning();
    if (!row) throw new Error(`Unknown document ${input.documentId}`);
    return mapDocumentRow(row);
  }

  async listSignatureRequests(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<SignatureRequestRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.signatureRequests)
      .where(
        options.matterId
          ? and(
              eq(schema.signatureRequests.firmId, firmId),
              eq(schema.signatureRequests.matterId, options.matterId),
            )
          : eq(schema.signatureRequests.firmId, firmId),
      );
    return rows.map(mapSignatureRequestRow);
  }

  async createSignatureRequest(input: {
    request: SignatureRequestRecord;
    signers: SignatureRequestSignerRecord[];
    event: SignatureProviderEventRecord;
  }): Promise<{ request: SignatureRequestRecord; signers: SignatureRequestSignerRecord[] }> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.signatureRequests).values({
        ...input.request,
        createdAt: new Date(input.request.createdAt),
        completedAt: input.request.completedAt ? new Date(input.request.completedAt) : null,
        declinedAt: input.request.declinedAt ? new Date(input.request.declinedAt) : null,
      });
      await tx.insert(schema.signatureRequestSigners).values(
        input.signers.map((signer) => ({
          ...signer,
          completedAt: signer.completedAt ? new Date(signer.completedAt) : null,
        })),
      );
      await tx.insert(schema.signatureProviderEvents).values({
        ...input.event,
        occurredAt: new Date(input.event.occurredAt),
      });
    });
    return { request: input.request, signers: input.signers };
  }

  async recordSignatureProviderEvent(
    event: SignatureProviderEventRecord,
    webhookAttempt?: SignatureWebhookAttemptRecord,
  ): Promise<SignatureProviderEventRecord> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.signatureProviderEvents).values({
        ...event,
        occurredAt: new Date(event.occurredAt),
      });
      if (webhookAttempt) {
        await tx.insert(schema.signatureWebhookAttempts).values({
          ...webhookAttempt,
          receivedAt: new Date(webhookAttempt.receivedAt),
          processedAt: webhookAttempt.processedAt ? new Date(webhookAttempt.processedAt) : null,
        });
      }
      await tx
        .update(schema.signatureRequests)
        .set({
          status: event.status,
          evidence: event.evidence,
          completedAt: event.status === "completed" ? new Date(event.occurredAt) : undefined,
          declinedAt: event.status === "declined" ? new Date(event.occurredAt) : undefined,
        })
        .where(
          and(
            eq(schema.signatureRequests.firmId, event.firmId),
            eq(schema.signatureRequests.id, event.signatureRequestId),
          ),
        );
    });
    return event;
  }

  async listIntakeTemplates(firmId: string): Promise<IntakeTemplateRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.intakeTemplates)
      .where(eq(schema.intakeTemplates.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      name: row.name,
      provider: row.provider as IntakeTemplateRecord["provider"],
      externalTemplateId: row.externalTemplateId,
      active: row.active,
    }));
  }

  async listIntakeSessions(
    firmId: string,
    options: { matterId?: string } = {},
  ): Promise<IntakeSessionRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.intakeSessions)
      .where(
        options.matterId
          ? and(
              eq(schema.intakeSessions.firmId, firmId),
              eq(schema.intakeSessions.matterId, options.matterId),
            )
          : eq(schema.intakeSessions.firmId, firmId),
      );
    return rows.map(mapIntakeSessionRow);
  }

  async getIntakeSession(
    firmId: string,
    sessionId: string,
  ): Promise<IntakeSessionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.intakeSessions)
      .where(
        and(eq(schema.intakeSessions.firmId, firmId), eq(schema.intakeSessions.id, sessionId)),
      );
    return row ? mapIntakeSessionRow(row) : undefined;
  }

  async createIntakeSession(session: IntakeSessionRecord): Promise<IntakeSessionRecord> {
    await this.db.insert(schema.intakeSessions).values({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    });
    return session;
  }

  async createGeneratedDocument(
    document: GeneratedDocumentRecord,
  ): Promise<GeneratedDocumentRecord> {
    await this.db.insert(schema.generatedDocuments).values({
      ...document,
      createdAt: new Date(document.createdAt),
    });
    return document;
  }

  private async listUsers(firmId: string): Promise<User[]> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.firmId, firmId));
    return Promise.all(rows.map((row) => this.getUser(row.firmId, row.id))).then((users) =>
      users.filter((user): user is User => Boolean(user)),
    );
  }

  private async listContacts(firmId: string): Promise<Contact[]> {
    const rows = await this.db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.firmId, firmId));
    return rows.map((row) => ({
      id: row.id,
      firmId: row.firmId,
      kind: row.kind,
      displayName: row.displayName,
      aliases: row.aliases,
      identifiers: row.identifiers as Contact["identifiers"],
      notes: row.notes ?? undefined,
    }));
  }

  private async listMatterParties(firmId: string): Promise<MatterParty[]> {
    return this.db
      .select()
      .from(schema.matterParties)
      .where(eq(schema.matterParties.firmId, firmId));
  }

  private async listDocuments(firmId: string): Promise<DocumentRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.firmId, firmId));
    return rows.map(mapDocumentRow);
  }

  private async listTimeEntries(firmId: string): Promise<TimeEntry[]> {
    return this.db.select().from(schema.timeEntries).where(eq(schema.timeEntries.firmId, firmId));
  }

  private async listExpenseEntries(firmId: string): Promise<ExpenseEntry[]> {
    return this.db
      .select()
      .from(schema.expenseEntries)
      .where(eq(schema.expenseEntries.firmId, firmId));
  }
}

function mapMatter(row: typeof schema.matters.$inferSelect): Matter {
  return {
    id: row.id,
    firmId: row.firmId,
    number: row.number,
    title: row.title,
    practiceArea: row.practiceArea,
    status: row.status,
    jurisdiction: row.jurisdiction,
    responsibleUserId: row.responsibleUserId,
    openedOn: dateToIso(row.openedOn),
    closedOn: dateToIso(row.closedOn),
  };
}
