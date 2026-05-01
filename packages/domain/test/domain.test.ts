import { describe, expect, it } from "vitest";
import {
  appendAuditEvent,
  assertBillingStatusTransition,
  calculateInvoiceTotals,
  canAccess,
  canShareDocumentThroughPortal,
  clientTrustBalanceByMatter,
  clientTrustBalanceDeltas,
  createReversalTransaction,
  dashboardCapabilities,
  isBillableUnbilled,
  ledgerBalanceByMatter,
  postLedgerTransaction,
  runConflictCheck,
  type Contact,
  type Matter,
  type MatterParty,
  type PortalGrant,
  type PostedLedgerTransaction,
  type User,
  verifyAuditChain,
  type AuditEvent,
} from "../src/index.js";
import {
  sampleAuditEvents,
  sampleContacts,
  sampleDocuments,
  sampleFirm,
  sampleInvoiceLines,
  samplePaymentAllocations,
  sampleTimeEntries,
  sampleTrustTransferRequests,
  sampleLedgerAccounts,
  sampleLedgerEntries,
  sampleMatterParties,
  sampleMatters,
  samplePortalGrants,
  sampleUsers,
} from "../src/sample-data.js";

describe("billing helpers", () => {
  it("computes invoice totals and outstanding balances", () => {
    expect(
      calculateInvoiceTotals({ lines: sampleInvoiceLines, allocations: samplePaymentAllocations }),
    ).toMatchObject({
      subtotalCents: 12600,
      taxCents: 630,
      totalCents: 13230,
      balanceDueCents: 13230,
    });
  });

  it("keeps trust-transfer requests as requests until explicitly postable", () => {
    expect(sampleTrustTransferRequests[0]!.status).toBe("pending_approval");
    expect(sampleTrustTransferRequests[0]!.ledgerTransactionId).toBeUndefined();
    expect(isBillableUnbilled(sampleTimeEntries[0]!)).toBe(true);
  });

  it("rejects invalid billing status transitions", () => {
    expect(() => assertBillingStatusTransition("approved", "submitted")).toThrow(
      /Invalid billing status transition/,
    );
  });
});

describe("conflict checks", () => {
  it("flags normalized aliases and entity markers", () => {
    const matches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "Northstar Holdings, Limited",
      aliases: [],
      includeClosedMatters: true,
      contacts: sampleContacts,
      matters: sampleMatters,
      matterParties: sampleMatterParties,
    });

    expect(matches.some((match) => match.contactId === "contact-northstar")).toBe(true);
  });

  it("blocks shared identifiers and adverse-party matches", () => {
    const matches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "River City Rentals",
      identifiers: [{ type: "email", value: "legal@rivercity.example" }],
      prospectiveRole: "client",
      includeClosedMatters: true,
      contacts: sampleContacts,
      matters: sampleMatters,
      matterParties: sampleMatterParties,
    });

    expect(matches.some((match) => match.severity === "blocker")).toBe(true);
  });

  it("checks every matter linked to a matched contact", () => {
    const matters: Matter[] = [
      {
        id: "matter-closed",
        firmId: sampleFirm.id,
        number: "2026-0101",
        title: "Closed file",
        practiceArea: "Civil",
        status: "closed",
        jurisdiction: "BC",
        responsibleUserId: "user-admin",
      },
      {
        id: "matter-open",
        firmId: sampleFirm.id,
        number: "2026-0102",
        title: "Open file",
        practiceArea: "Civil",
        status: "open",
        jurisdiction: "BC",
        responsibleUserId: "user-admin",
      },
    ];
    const contacts: Contact[] = [
      {
        id: "contact-shared",
        firmId: sampleFirm.id,
        kind: "person",
        displayName: "Shared Client",
        aliases: [],
        identifiers: [],
      },
    ];
    const matterParties: MatterParty[] = [
      {
        id: "party-closed",
        firmId: sampleFirm.id,
        matterId: "matter-closed",
        contactId: "contact-shared",
        role: "client",
        adverse: false,
        confidential: false,
      },
      {
        id: "party-open",
        firmId: sampleFirm.id,
        matterId: "matter-open",
        contactId: "contact-shared",
        role: "opposing_party",
        adverse: true,
        confidential: false,
      },
    ];

    const matches = runConflictCheck({
      firmId: sampleFirm.id,
      prospectiveName: "Shared Client",
      includeClosedMatters: false,
      contacts,
      matters,
      matterParties,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ matterId: "matter-open", severity: "blocker" });
  });
});

describe("matter-scoped RBAC", () => {
  it("denies cross-matter access even when a role can read matters", () => {
    const user = sampleUsers.find((candidate) => candidate.id === "user-licensee")!;

    expect(
      canAccess({
        user,
        firmId: sampleFirm.id,
        resource: "matter",
        action: "read",
        matterId: "matter-002",
      }),
    ).toBe(false);
  });

  it("allows assigned licensees to approve signature requests for their matter", () => {
    const user = sampleUsers.find((candidate) => candidate.id === "user-licensee")!;

    expect(
      canAccess({
        user,
        firmId: sampleFirm.id,
        resource: "signature_request",
        action: "approve",
        matterId: "matter-001",
      }),
    ).toBe(true);
  });

  it("allows assigned users to read calendar events only inside their matter scope", () => {
    const user = sampleUsers.find((candidate) => candidate.id === "user-licensee")!;

    expect(
      canAccess({
        user,
        firmId: sampleFirm.id,
        resource: "calendar_event",
        action: "read",
        matterId: "matter-001",
      }),
    ).toBe(true);

    expect(
      canAccess({
        user,
        firmId: sampleFirm.id,
        resource: "calendar_event",
        action: "read",
        matterId: "matter-002",
      }),
    ).toBe(false);
  });

  it("keeps billing bookkeepers out of calendar event reads", () => {
    const user: User = {
      id: "user-bookkeeper",
      firmId: sampleFirm.id,
      displayName: "Synthetic Bookkeeper",
      email: "bookkeeper@example.test",
      role: "billing_bookkeeper",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    };

    expect(
      canAccess({
        user,
        firmId: sampleFirm.id,
        resource: "calendar_event",
        action: "read",
        matterId: "matter-001",
      }),
    ).toBe(false);
  });

  it("denies matter-scoped access without an explicit matter scope", () => {
    const user = sampleUsers.find((candidate) => candidate.id === "user-licensee")!;

    expect(
      canAccess({
        user,
        firmId: sampleFirm.id,
        resource: "document",
        action: "read",
      }),
    ).toBe(false);
  });

  it("requires active portal grants for external clients", () => {
    const externalUser: User = {
      id: "user-client",
      firmId: sampleFirm.id,
      displayName: "Ada Morgan",
      email: "ada@example.test",
      role: "client_external",
      assignedMatterIds: [],
      mfaEnabled: true,
    };

    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        matterId: "matter-001",
        contactId: "contact-ada",
        portalGrants: samplePortalGrants,
        resource: "document",
        action: "read",
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(true);

    const revokedGrant: PortalGrant = { ...samplePortalGrants[0]!, revokedAt: "2026-04-09" };
    expect(
      canAccess({
        user: externalUser,
        firmId: sampleFirm.id,
        matterId: "matter-001",
        contactId: "contact-ada",
        portalGrants: [revokedGrant],
        resource: "document",
        action: "read",
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("derives dashboard section capabilities from server-side policy", () => {
    const user = sampleUsers.find((candidate) => candidate.id === "user-licensee")!;

    expect(dashboardCapabilities({ user, firmId: sampleFirm.id, matterId: "matter-001" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "matters", enabled: true }),
        expect.objectContaining({ key: "funds", enabled: true }),
        expect.objectContaining({ key: "drafting", enabled: true }),
        expect.objectContaining({ key: "calendar", enabled: true }),
        expect.objectContaining({ key: "audit", enabled: true }),
      ]),
    );

    const bookkeeper: User = {
      id: "user-bookkeeper",
      firmId: sampleFirm.id,
      displayName: "Synthetic Bookkeeper",
      email: "bookkeeper@example.test",
      role: "billing_bookkeeper",
      assignedMatterIds: ["matter-001"],
      mfaEnabled: true,
    };
    expect(
      dashboardCapabilities({ user: bookkeeper, firmId: sampleFirm.id, matterId: "matter-001" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "drafting", enabled: false }),
        expect.objectContaining({ key: "calendar", enabled: false }),
      ]),
    );
  });

  it("blocks portal document sharing until ingestion and legal gates pass", () => {
    const document = {
      ...sampleDocuments[0]!,
      legalHold: false,
      classification: "general" as const,
      uploadStatus: "verified" as const,
      checksumStatus: "verified" as const,
      scanStatus: "passed" as const,
    };

    expect(
      canShareDocumentThroughPortal({
        document,
        grant: samplePortalGrants[0]!,
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(true);

    expect(
      canShareDocumentThroughPortal({
        document: { ...document, checksumStatus: "duplicate" },
        grant: samplePortalGrants[0]!,
        now: "2026-04-10T12:00:00.000Z",
      }),
    ).toBe(false);

    expect(
      canShareDocumentThroughPortal({
        document: { ...document, supersededAt: "2026-04-11T12:00:00.000Z" },
        grant: samplePortalGrants[0]!,
        now: "2026-04-12T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("audit hash chain", () => {
  it("verifies canonical chained audit events", () => {
    expect(verifyAuditChain(sampleAuditEvents)).toBe(true);
  });

  it("detects modified audit payloads", () => {
    const tampered: AuditEvent[] = [
      { ...sampleAuditEvents[0]!, metadata: { jurisdiction: "ON" } },
      sampleAuditEvents[1]!,
    ];

    expect(verifyAuditChain(tampered)).toBe(false);
  });

  it("links new events to the prior hash", () => {
    const next = appendAuditEvent(sampleAuditEvents.at(-1), {
      id: "audit-003",
      firmId: sampleFirm.id,
      actorId: "user-admin",
      action: "trust.transaction.posted",
      resourceType: "trust_ledger",
      resourceId: "trust-retainer",
      occurredAt: "2026-04-04T19:00:00.000Z",
      metadata: { amountCents: 150000 },
    });

    expect(next.previousHash).toBe(sampleAuditEvents.at(-1)!.hash);
  });
});

describe("funds ledger", () => {
  it("requires balanced double-entry transactions", () => {
    expect(() =>
      postLedgerTransaction(
        { postedTransactions: [], accounts: sampleLedgerAccounts },
        {
          id: "bad",
          firmId: sampleFirm.id,
          idempotencyKey: "bad",
          postedByUserId: "user-admin",
          postedAt: "2026-04-05T12:00:00.000Z",
          entries: [
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 100,
              creditCents: 0,
              memo: "Bad transaction",
            },
          ],
        },
      ),
    ).toThrow(/balanced/);
  });

  it("rejects matter-level trust overdrafts", () => {
    expect(() =>
      postLedgerTransaction(
        {
          postedTransactions: [
            {
              id: "trust-retainer",
              firmId: sampleFirm.id,
              idempotencyKey: "retainer",
              requestFingerprint: "seed",
              entries: sampleLedgerEntries,
            },
          ],
          accounts: sampleLedgerAccounts,
        },
        {
          id: "overdraft",
          firmId: sampleFirm.id,
          idempotencyKey: "overdraft",
          postedByUserId: "user-admin",
          postedAt: "2026-04-05T12:00:00.000Z",
          entries: [
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-client-liability",
              debitCents: 200000,
              creditCents: 0,
              memo: "Overdraw client liability",
            },
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 0,
              creditCents: 200000,
              memo: "Overdraw trust asset",
            },
          ],
        },
      ),
    ).toThrow(/overdraw/);
  });

  it("computes matter balances from posted ledger entries", () => {
    expect(ledgerBalanceByMatter(sampleLedgerEntries)["contact-ada:matter-001"]).toBe(0);
    expect(
      clientTrustBalanceByMatter(sampleLedgerEntries, sampleLedgerAccounts)[
        "contact-ada:matter-001"
      ],
    ).toBe(150000);
  });

  it("summarizes client liability balance deltas for persistent guards", () => {
    expect(clientTrustBalanceDeltas(sampleLedgerEntries, sampleLedgerAccounts)).toEqual([
      {
        firmId: sampleFirm.id,
        matterId: "matter-001",
        clientId: "contact-ada",
        deltaCents: 150000,
      },
    ]);
  });

  it("rejects idempotency replays with different payloads", () => {
    const first = postLedgerTransaction(
      { postedTransactions: [], accounts: sampleLedgerAccounts },
      {
        id: "trust-retainer",
        firmId: sampleFirm.id,
        idempotencyKey: "bank-event-001",
        postedByUserId: "user-admin",
        postedAt: "2026-04-05T12:00:00.000Z",
        entries: [
          {
            firmId: sampleFirm.id,
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 100,
            creditCents: 0,
            memo: "Retainer",
          },
          {
            firmId: sampleFirm.id,
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 0,
            creditCents: 100,
            memo: "Retainer",
          },
        ],
      },
    );

    expect(() =>
      postLedgerTransaction(
        { postedTransactions: [first], accounts: sampleLedgerAccounts },
        {
          id: "trust-retainer-replay",
          firmId: sampleFirm.id,
          idempotencyKey: "bank-event-001",
          postedByUserId: "user-admin",
          postedAt: "2026-04-05T12:05:00.000Z",
          entries: [
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-trust-bank",
              debitCents: 200,
              creditCents: 0,
              memo: "Changed retainer",
            },
            {
              firmId: sampleFirm.id,
              matterId: "matter-001",
              clientId: "contact-ada",
              accountId: "acct-client-liability",
              debitCents: 0,
              creditCents: 200,
              memo: "Changed retainer",
            },
          ],
        },
      ),
    ).toThrow(/different ledger payload/);
  });

  it("constructs and validates exact reversing transactions", () => {
    const original: PostedLedgerTransaction = {
      id: "trust-retainer",
      firmId: sampleFirm.id,
      idempotencyKey: "bank-event-002",
      requestFingerprint: "seed",
      entries: sampleLedgerEntries,
    };
    const reversal = createReversalTransaction(original, {
      id: "trust-retainer-reversal",
      idempotencyKey: "bank-event-002-reversal",
      postedByUserId: "user-admin",
      postedAt: "2026-04-05T12:00:00.000Z",
    });

    const posted = postLedgerTransaction(
      { postedTransactions: [original], accounts: sampleLedgerAccounts },
      reversal,
    );

    expect(posted.reversesTransactionId).toBe(original.id);
    expect(
      clientTrustBalanceByMatter(posted.entries, sampleLedgerAccounts)["contact-ada:matter-001"],
    ).toBe(-150000);
  });
});
