import type {
  InvoiceLineRecord,
  InvoiceRecord,
  ManualPaymentRecord,
  PaymentAllocationRecord,
  TrustTransferRequestRecord,
} from "./billing.js";
import type {
  Contact,
  DocumentRecord,
  ExpenseEntry,
  Firm,
  Matter,
  MatterParty,
  PortalGrant,
  TimeEntry,
  User,
} from "./models.js";
import type { LedgerAccount, LedgerEntry } from "./ledger.js";
import type {
  GeneratedDocumentRecord,
  IntakeSessionRecord,
  IntakeTemplateRecord,
  SignatureProviderEventRecord,
  SignatureRequestRecord,
  SignatureRequestSignerRecord,
  SignatureWebhookAttemptRecord,
} from "./signatures.js";
import { appendAuditEvent, type AuditEvent } from "./audit.js";
import { buildBasicDraftTemplates } from "./drafting.js";

export const sampleFirm: Firm = {
  id: "firm-west-legal",
  name: "West Coast Legal Services Collective",
  defaultProvince: "BC",
};

export const sampleUsers: User[] = [
  {
    id: "user-admin",
    firmId: sampleFirm.id,
    displayName: "Avery Chen",
    email: "avery@example.test",
    role: "owner_admin",
    assignedMatterIds: ["matter-001", "matter-002"],
    mfaEnabled: true,
  },
  {
    id: "user-licensee",
    firmId: sampleFirm.id,
    displayName: "Mina Patel",
    email: "mina@example.test",
    role: "licensee",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: true,
  },
  {
    id: "user-staff",
    firmId: sampleFirm.id,
    displayName: "Jordan Lee",
    email: "jordan@example.test",
    role: "firm_member",
    assignedMatterIds: ["matter-001"],
    mfaEnabled: false,
  },
];

export const sampleContacts: Contact[] = [
  {
    id: "contact-ada",
    firmId: sampleFirm.id,
    kind: "person",
    displayName: "Ada Morgan",
    aliases: ["Ada M. Nguyen"],
    identifiers: [{ type: "email", value: "ada@example.test" }],
  },
  {
    id: "contact-northstar",
    firmId: sampleFirm.id,
    kind: "organization",
    displayName: "North Star Holdings Ltd.",
    aliases: ["Northstar Holdings"],
    identifiers: [{ type: "registry_id", value: "BC1234567" }],
  },
  {
    id: "contact-river",
    firmId: sampleFirm.id,
    kind: "organization",
    displayName: "River City Rentals Inc.",
    aliases: [],
    identifiers: [{ type: "email", value: "legal@rivercity.example" }],
  },
];

export const sampleMatters: Matter[] = [
  {
    id: "matter-001",
    firmId: sampleFirm.id,
    number: "2026-0001",
    title: "Morgan tenancy dispute",
    practiceArea: "Residential tenancy",
    status: "open",
    jurisdiction: "BC",
    responsibleUserId: "user-licensee",
    openedOn: "2026-04-01",
  },
  {
    id: "matter-002",
    firmId: sampleFirm.id,
    number: "2026-0002",
    title: "North Star corporate records",
    practiceArea: "Notarial services",
    status: "intake",
    jurisdiction: "BC",
    responsibleUserId: "user-admin",
  },
];

export const sampleMatterParties: MatterParty[] = [
  {
    id: "party-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    contactId: "contact-ada",
    role: "client",
    adverse: false,
    confidential: true,
  },
  {
    id: "party-002",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    contactId: "contact-river",
    role: "opposing_party",
    adverse: true,
    confidential: false,
  },
  {
    id: "party-003",
    firmId: sampleFirm.id,
    matterId: "matter-002",
    contactId: "contact-northstar",
    role: "notary_client",
    adverse: false,
    confidential: true,
  },
];

export const sampleDocuments: DocumentRecord[] = [
  {
    id: "doc-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    title: "Retainer agreement.pdf",
    storageKey: "matters/matter-001/retainer-v1.pdf",
    checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
    version: 1,
    classification: "privileged",
    legalHold: true,
    uploadStatus: "verified",
    checksumStatus: "verified",
    scanStatus: "passed",
    uploadedAt: "2026-04-01T20:15:00.000Z",
    verifiedAt: "2026-04-01T20:16:00.000Z",
  },
];

export const sampleSignatureRequests: SignatureRequestRecord[] = [
  {
    id: "sig-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    documentId: "doc-001",
    title: "Retainer agreement",
    requestedByUserId: "user-licensee",
    provider: "embedded",
    externalId: "embedded:matter-001:doc-001",
    status: "sent",
    consentText: "I consent to electronic signature.",
    evidence: { mode: "seed" },
    createdAt: "2026-04-03T18:30:00.000Z",
  },
];

export const sampleSignatureRequestSigners: SignatureRequestSignerRecord[] = [
  {
    id: "sig-signer-001",
    firmId: sampleFirm.id,
    signatureRequestId: "sig-001",
    name: "Ada Morgan",
    email: "ada@example.test",
    role: "client",
    status: "sent",
  },
];

export const sampleSignatureProviderEvents: SignatureProviderEventRecord[] = [
  {
    id: "sig-event-001",
    firmId: sampleFirm.id,
    signatureRequestId: "sig-001",
    provider: "embedded",
    externalId: "embedded:matter-001:doc-001",
    status: "sent",
    occurredAt: "2026-04-03T18:30:00.000Z",
    evidence: { mode: "seed" },
  },
];

export const sampleSignatureWebhookAttempts: SignatureWebhookAttemptRecord[] = [];

export const sampleIntakeTemplates: IntakeTemplateRecord[] = [
  {
    id: "intake-template-001",
    firmId: sampleFirm.id,
    name: "Residential tenancy intake",
    provider: "embedded",
    externalTemplateId: "residential-tenancy-intake",
    active: true,
  },
];

export const sampleIntakeSessions: IntakeSessionRecord[] = [
  {
    id: "intake-session-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    templateId: "intake-template-001",
    provider: "embedded",
    externalId: "embedded:intake-session-001",
    status: "in_progress",
    clientContactId: "contact-ada",
    evidence: { mode: "seed" },
    createdAt: "2026-04-01T18:00:00.000Z",
    updatedAt: "2026-04-01T18:00:00.000Z",
  },
];

export const sampleGeneratedDocuments: GeneratedDocumentRecord[] = [];

export const sampleDraftTemplates = buildBasicDraftTemplates(
  sampleFirm.id,
  "2026-04-01T00:00:00.000Z",
);

export const samplePortalGrants: PortalGrant[] = [
  {
    id: "grant-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    contactId: "contact-ada",
    grantedByUserId: "user-licensee",
    permissions: ["view_documents", "upload_documents", "message", "sign"],
  },
];

export const sampleTimeEntries: TimeEntry[] = [
  {
    id: "time-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    userId: "user-licensee",
    performedAt: "2026-04-04T16:30:00.000Z",
    minutes: 42,
    rateCents: 18000,
    narrative: "Reviewed tenancy branch materials and client chronology.",
    billable: true,
    billingStatus: "approved",
  },
];

export const sampleExpenseEntries: ExpenseEntry[] = [
  {
    id: "expense-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    incurredAt: "2026-04-04T18:00:00.000Z",
    amountCents: 1250,
    category: "Filing",
    description: "Tribunal evidence package upload fee",
    reimbursable: true,
    billingStatus: "approved",
  },
];

export const sampleInvoices: InvoiceRecord[] = [
  {
    id: "invoice-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientContactId: "contact-ada",
    invoiceNumber: "INV-2026-0001",
    status: "issued",
    issuedAt: "2026-04-06T17:00:00.000Z",
    dueAt: "2026-05-06T17:00:00.000Z",
    memo: "Initial tenancy dispute invoice",
    createdByUserId: "user-licensee",
    createdAt: "2026-04-06T17:00:00.000Z",
    subtotalCents: 12600,
    taxCents: 630,
    totalCents: 13230,
    paidCents: 0,
    balanceDueCents: 13230,
  },
];

export const sampleInvoiceLines: InvoiceLineRecord[] = [
  {
    id: "invoice-line-001",
    firmId: sampleFirm.id,
    invoiceId: "invoice-001",
    matterId: "matter-001",
    kind: "time",
    description: "Reviewed tenancy branch materials and client chronology.",
    quantity: 42,
    unitAmountCents: 300,
    subtotalCents: 12600,
    taxName: "GST",
    taxRateBps: 500,
    taxCents: 630,
    totalCents: 13230,
    timeEntryId: "time-001",
    createdAt: "2026-04-06T17:00:00.000Z",
  },
];

export const sampleManualPayments: ManualPaymentRecord[] = [];

export const samplePaymentAllocations: PaymentAllocationRecord[] = [];

export const sampleTrustTransferRequests: TrustTransferRequestRecord[] = [
  {
    id: "trust-transfer-request-001",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientContactId: "contact-ada",
    invoiceId: "invoice-001",
    requestedByUserId: "user-licensee",
    amountCents: 13230,
    status: "pending_approval",
    reason: "Apply trust funds to issued invoice after approval.",
    requestedAt: "2026-04-06T18:00:00.000Z",
  },
];

export const sampleLedgerAccounts: LedgerAccount[] = [
  { id: "acct-trust-bank", firmId: sampleFirm.id, name: "Pooled trust bank", type: "trust_asset" },
  {
    id: "acct-client-liability",
    firmId: sampleFirm.id,
    name: "Client trust liability",
    type: "client_liability",
  },
  {
    id: "acct-operating-revenue",
    firmId: sampleFirm.id,
    name: "Operating revenue",
    type: "operating_revenue",
  },
];

export const sampleLedgerEntries: LedgerEntry[] = [
  {
    id: "trust-retainer-1",
    transactionId: "trust-retainer",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientId: "contact-ada",
    accountId: "acct-trust-bank",
    debitCents: 150000,
    creditCents: 0,
    memo: "Retainer received into pooled trust",
    postedAt: "2026-04-02T17:00:00.000Z",
  },
  {
    id: "trust-retainer-2",
    transactionId: "trust-retainer",
    firmId: sampleFirm.id,
    matterId: "matter-001",
    clientId: "contact-ada",
    accountId: "acct-client-liability",
    debitCents: 0,
    creditCents: 150000,
    memo: "Client trust liability",
    postedAt: "2026-04-02T17:00:00.000Z",
  },
];

const firstAudit = appendAuditEvent(undefined, {
  id: "audit-001",
  firmId: sampleFirm.id,
  actorId: "user-licensee",
  action: "matter.opened",
  resourceType: "matter",
  resourceId: "matter-001",
  occurredAt: "2026-04-01T16:30:00.000Z",
  metadata: { jurisdiction: "BC", practiceArea: "Residential tenancy" },
});

export const sampleAuditEvents: AuditEvent[] = [
  firstAudit,
  appendAuditEvent(firstAudit, {
    id: "audit-002",
    firmId: sampleFirm.id,
    actorId: "user-licensee",
    action: "portal.grant.created",
    resourceType: "portal_grant",
    resourceId: "grant-001",
    occurredAt: "2026-04-03T18:15:00.000Z",
    metadata: { permissions: ["view_documents", "upload_documents", "message", "sign"] },
  }),
];
