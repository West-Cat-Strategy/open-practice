import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type { DocumentAutomationProvider, SignatureProvider } from "@open-practice/domain";
import { createApiServer } from "./server.js";

const servers: Array<{ close: () => Promise<void> }> = [];
type CreateServerOptions = Parameters<typeof createApiServer>[0];

function testServer(overrides: Partial<CreateServerOptions> = {}) {
  const server = createApiServer({
    repository: new InMemoryOpenPracticeRepository(),
    devFirmId: "firm-west-legal",
    devUserId: "user-admin",
    ...overrides,
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("API auth and persistence boundaries", () => {
  it("rejects unauthenticated production requests", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await testServer().inject({ method: "GET", url: "/api/overview" });
      expect(response.statusCode).toBe(401);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("scopes matter lists to the authenticated user", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/matters",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(200);
    const matters = response.json<Array<{ id: string }>>();
    expect(matters.map((matter) => matter.id)).toEqual(["matter-001"]);
  });

  it("returns server-derived dashboard capabilities", async () => {
    const response = await testServer().inject({ method: "GET", url: "/api/capabilities" });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ sections: Array<{ key: string; enabled: boolean }> }>().sections,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "matters", enabled: true }),
        expect.objectContaining({ key: "documents", enabled: true }),
        expect.objectContaining({ key: "signatures", enabled: true }),
      ]),
    );
  });

  it("requires explicit matter scope for matter-scoped ledger reads", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/ledger",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("lists signature and intake records across assigned matters for matter-scoped users", async () => {
    const headers = {
      "x-open-practice-user-id": "user-licensee",
      "x-open-practice-firm-id": "firm-west-legal",
    };
    const server = testServer();
    const signatures = await server.inject({
      method: "GET",
      url: "/api/signature-requests",
      headers,
    });
    const intake = await server.inject({ method: "GET", url: "/api/intake-sessions", headers });

    expect(signatures.statusCode).toBe(200);
    expect(signatures.json<Array<{ matterId: string }>>().map((record) => record.matterId)).toEqual(
      ["matter-001"],
    );
    expect(intake.statusCode).toBe(200);
    expect(
      intake
        .json<{ sessions: Array<{ matterId: string }> }>()
        .sessions.map((record) => record.matterId),
    ).toEqual(["matter-001"]);
  });

  it("persists conflict audit events through the repository boundary", async () => {
    const server = testServer();
    const before = await server.inject({ method: "GET", url: "/api/audit" });
    const beforeCount = before.json<{ events: unknown[] }>().events.length;

    const conflict = await server.inject({
      method: "POST",
      url: "/api/conflicts/check",
      payload: { prospectiveName: "River City Rentals", includeClosedMatters: true },
    });

    expect(conflict.statusCode).toBe(200);
    const after = await server.inject({ method: "GET", url: "/api/audit" });
    expect(after.json<{ events: unknown[] }>().events).toHaveLength(beforeCount + 1);
  });

  it("posts ledger transactions through validated request bodies", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        id: "earned-fee-001",
        idempotencyKey: "earned-fee-001",
        entries: [
          {
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 75000,
            creditCents: 0,
            memo: "Transfer earned fee from trust liability",
          },
          {
            matterId: "matter-001",
            clientId: "contact-ada",
            accountId: "acct-operating-revenue",
            debitCents: 0,
            creditCents: 75000,
            memo: "Recognize earned fee",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ firmId: string; idempotencyKey: string }>()).toMatchObject({
      firmId: "firm-west-legal",
      idempotencyKey: "earned-fee-001",
    });
  });

  it("rejects ledger entries whose client is not linked to the target matter", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/ledger/transactions",
      payload: {
        id: "bad-client-link",
        idempotencyKey: "bad-client-link",
        entries: [
          {
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-trust-bank",
            debitCents: 100,
            creditCents: 0,
            memo: "Bad client matter link",
          },
          {
            matterId: "matter-002",
            clientId: "contact-ada",
            accountId: "acct-client-liability",
            debitCents: 0,
            creditCents: 100,
            memo: "Bad client matter link",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toMatch(/non-adverse party/);
  });

  it("marks completed document uploads with checksum and scan states", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/doc-001/upload-complete",
      payload: {
        checksumSha256: "c8a1d42f0a2d4a4ef5ac21ad1f3b1d85e422bbf721e783f611bce97c7a0f4f4c",
        scanStatus: "passed",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "doc-001",
      uploadStatus: "verified",
      checksumStatus: "verified",
      scanStatus: "passed",
    });
  });

  it("updates document scan state after upload completion", async () => {
    const response = await testServer().inject({
      method: "POST",
      url: "/api/documents/doc-001/scan-status",
      payload: { scanStatus: "failed" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "doc-001", scanStatus: "failed" });
  });

  it("persists signature requests and provider events", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: {
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer agreement",
        consentText: "I consent to electronic signature.",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
      },
    });

    expect(created.statusCode).toBe(200);
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const event = await server.inject({
      method: "POST",
      url: "/api/signature-requests/provider-events",
      payload: {
        signatureRequestId: requestId,
        provider: "manual",
        externalId: `manual:matter-001:doc-001`,
        status: "completed",
        evidence: { completedBy: "Ada Morgan" },
      },
    });

    expect(event.statusCode).toBe(200);
    const list = await server.inject({ method: "GET", url: "/api/signature-requests" });
    expect(list.json<Array<{ id: string; status: string }>>()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requestId, status: "completed" })]),
    );
  });

  it("rejects mismatched provider events for signature requests", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: {
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer agreement",
        consentText: "I consent to electronic signature.",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
      },
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const event = await server.inject({
      method: "POST",
      url: "/api/signature-requests/provider-events",
      payload: {
        signatureRequestId: requestId,
        provider: "docuseal",
        externalId: "docuseal-submission-001",
        status: "completed",
      },
    });

    expect(event.statusCode).toBe(409);
  });

  it("verifies DocuSeal webhooks, rejects replay, and preserves terminal ordering", async () => {
    const signatureProvider: SignatureProvider = {
      async createSubmission() {
        return {
          provider: "docuseal",
          externalId: "docuseal-submission-001",
          status: "sent",
        };
      },
    };
    const server = testServer({
      signatureProvider,
      docusealWebhook: {
        secretHeader: "x-docuseal-secret",
        secretValue: "secret-value",
        replayWindowSeconds: 300,
      },
    });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: {
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer agreement",
        consentText: "I consent to electronic signature.",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
      },
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const payload = {
      firmId: "firm-west-legal",
      signatureRequestId: requestId,
      externalId: "docuseal-submission-001",
      status: "completed",
      eventId: "docuseal-event-001",
      occurredAt: "2026-04-24T12:00:00.000Z",
    };

    const accepted = await server.inject({
      method: "POST",
      url: "/api/signature-requests/webhooks/docuseal",
      headers: { "x-docuseal-secret": "secret-value" },
      payload,
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/api/signature-requests/webhooks/docuseal",
      headers: { "x-docuseal-secret": "secret-value" },
      payload,
    });
    const outOfOrder = await server.inject({
      method: "POST",
      url: "/api/signature-requests/webhooks/docuseal",
      headers: { "x-docuseal-secret": "secret-value" },
      payload: { ...payload, status: "viewed", eventId: "docuseal-event-002" },
    });
    const list = await server.inject({ method: "GET", url: "/api/signature-requests" });

    expect(accepted.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json()).toMatchObject({ status: "duplicate" });
    expect(outOfOrder.statusCode).toBe(200);
    expect(list.json<Array<{ id: string; status: string }>>()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requestId, status: "completed" })]),
    );
  });

  it("rejects DocuSeal webhooks with bad secrets or unknown requests", async () => {
    const server = testServer({
      docusealWebhook: {
        secretHeader: "x-docuseal-secret",
        secretValue: "secret-value",
        replayWindowSeconds: 300,
      },
    });
    const payload = {
      firmId: "firm-west-legal",
      signatureRequestId: "missing-signature",
      externalId: "docuseal-submission-404",
      status: "completed",
      eventId: "docuseal-event-404",
    };

    const rejectedSecret = await server.inject({
      method: "POST",
      url: "/api/signature-requests/webhooks/docuseal",
      headers: { "x-docuseal-secret": "wrong-value" },
      payload,
    });
    const unknownRequest = await server.inject({
      method: "POST",
      url: "/api/signature-requests/webhooks/docuseal",
      headers: { "x-docuseal-secret": "secret-value" },
      payload,
    });

    expect(rejectedSecret.statusCode).toBe(401);
    expect(unknownRequest.statusCode).toBe(404);
  });

  it("rejects DocuSeal webhooks that mismatch a known request provider payload", async () => {
    const server = testServer({
      docusealWebhook: {
        secretHeader: "x-docuseal-secret",
        secretValue: "secret-value",
        replayWindowSeconds: 300,
      },
    });
    const created = await server.inject({
      method: "POST",
      url: "/api/signature-requests",
      payload: {
        matterId: "matter-001",
        documentId: "doc-001",
        title: "Retainer agreement",
        consentText: "I consent to electronic signature.",
        signers: [{ name: "Ada Morgan", email: "ada@example.test", role: "client" }],
      },
    });
    const requestId = created.json<{ request: { id: string } }>().request.id;
    const mismatch = await server.inject({
      method: "POST",
      url: "/api/signature-requests/webhooks/docuseal",
      headers: { "x-docuseal-secret": "secret-value" },
      payload: {
        firmId: "firm-west-legal",
        signatureRequestId: requestId,
        externalId: "docuseal-submission-001",
        status: "completed",
        eventId: "docuseal-event-mismatch",
      },
    });

    expect(mismatch.statusCode).toBe(409);
  });

  it("persists intake sessions and generated document records", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-001",
        templateId: "intake-template-001",
        clientContactId: "contact-ada",
      },
    });

    expect(created.statusCode).toBe(200);
    const sessionId = created.json<{ id: string }>().id;
    const generated = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/generated-documents`,
      payload: { title: "Draft notice package" },
    });

    expect(generated.statusCode).toBe(200);
    expect(generated.json()).toMatchObject({
      intakeSessionId: sessionId,
      matterId: "matter-001",
      title: "Draft notice package",
    });
  });

  it("persists answer snapshots and docassemble generated document metadata", async () => {
    const automationProvider: DocumentAutomationProvider = {
      async startInterview() {
        return {
          provider: "docassemble",
          externalId: "docassemble-session-001",
          interviewUrl: "https://docassemble.example/interview/1",
          status: "in_progress",
          evidence: { started: true },
        };
      },
      async getInterviewStatus() {
        return {
          provider: "docassemble",
          externalId: "docassemble-session-001",
          status: "ready_to_generate",
        };
      },
      async renderDocument(input) {
        return {
          provider: "docassemble",
          externalId: "docassemble-document-001",
          title: input.documentTitle,
          storageKey: "generated/docassemble-document-001.pdf",
          checksumSha256: "a".repeat(64),
          evidence: { rendered: true },
        };
      },
    };
    const server = testServer({ automationProvider });
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-001",
        templateId: "docassemble-template-001",
        clientContactId: "contact-ada",
      },
    });
    const sessionId = created.json<{ id: string }>().id;
    const snapshot = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/answer-snapshots`,
      payload: { answers: { issue: "repair" } },
    });
    const snapshots = await server.inject({
      method: "GET",
      url: `/api/intake-sessions/${sessionId}/answer-snapshots`,
    });
    const generated = await server.inject({
      method: "POST",
      url: `/api/intake-sessions/${sessionId}/generated-documents`,
      payload: { title: "Docassemble notice package" },
    });

    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ provider: "docassemble" });
    expect(snapshot.statusCode).toBe(200);
    expect(
      snapshots.json<{ snapshots: Array<{ answers: Record<string, unknown> }> }>().snapshots[0]
        ?.answers,
    ).toEqual({ issue: "repair" });
    expect(generated.statusCode).toBe(200);
    expect(generated.json()).toMatchObject({
      provider: "docassemble",
      externalId: "docassemble-document-001",
      storageKey: "generated/docassemble-document-001.pdf",
    });
  });

  it("enforces matter access on answer snapshots", async () => {
    const server = testServer();
    const created = await server.inject({
      method: "POST",
      url: "/api/intake-sessions",
      payload: {
        matterId: "matter-002",
        templateId: "intake-template-001",
        clientContactId: "contact-northstar",
      },
    });
    const sessionId = created.json<{ id: string }>().id;
    const forbidden = await server.inject({
      method: "GET",
      url: `/api/intake-sessions/${sessionId}/answer-snapshots`,
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(forbidden.statusCode).toBe(403);
  });

  it("records ledger approvals, reconciliations, and queue exceptions", async () => {
    const server = testServer();
    const approval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      payload: { decision: "approved", notes: "Reviewed source statement" },
    });
    const reconciliation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: {
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T23:59:59.000Z",
        expectedBalanceCents: 150000,
        actualBalanceCents: 149500,
        evidence: { statement: "April" },
      },
    });
    const queues = await server.inject({ method: "GET", url: "/api/queues" });

    expect(approval.statusCode).toBe(200);
    expect(approval.json()).toMatchObject({
      transactionId: "trust-retainer",
      decision: "approved",
    });
    expect(reconciliation.statusCode).toBe(200);
    expect(reconciliation.json()).toMatchObject({ status: "exception" });
    expect(
      queues
        .json<{ sections: Array<{ key: string; items: Array<{ id: string }> }> }>()
        .sections.find((section) => section.key === "ledger")?.items,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: reconciliation.json().id })]));
  });

  it("rejects unauthorized ledger control writes and hides firm ledger queue items", async () => {
    const server = testServer();
    const reconciliation = await server.inject({
      method: "POST",
      url: "/api/ledger/reconciliations",
      payload: {
        accountId: "acct-trust-bank",
        statementPeriodStart: "2026-04-01T00:00:00.000Z",
        statementPeriodEnd: "2026-04-30T23:59:59.000Z",
        expectedBalanceCents: 150000,
        actualBalanceCents: 149500,
      },
    });
    const forbiddenApproval = await server.inject({
      method: "POST",
      url: "/api/ledger/transactions/trust-retainer/approvals",
      headers: {
        "x-open-practice-user-id": "user-staff",
        "x-open-practice-firm-id": "firm-west-legal",
      },
      payload: { decision: "approved" },
    });
    const scopedQueues = await server.inject({
      method: "GET",
      url: "/api/queues",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(reconciliation.statusCode).toBe(200);
    expect(forbiddenApproval.statusCode).toBe(403);
    expect(
      scopedQueues
        .json<{ sections: Array<{ key: string; items: Array<{ id: string }> }> }>()
        .sections.find((section) => section.key === "ledger")?.items,
    ).toEqual([]);
  });

  it("runs the billing lifecycle without posting trust ledger transactions", async () => {
    const server = testServer();
    const ledgerBefore = await server.inject({ method: "GET", url: "/api/ledger" });
    const beforeEntryCount = ledgerBefore.json<{ entries: unknown[] }>().entries.length;

    const time = await server.inject({
      method: "POST",
      url: "/api/time-entries",
      payload: {
        id: "time-billing-api",
        matterId: "matter-001",
        minutes: 60,
        rateCents: 18000,
        narrative: "Prepare tenancy hearing materials.",
      },
    });
    const expense = await server.inject({
      method: "POST",
      url: "/api/expense-entries",
      payload: {
        id: "expense-billing-api",
        matterId: "matter-001",
        amountCents: 2500,
        category: "Filing",
        description: "Courier evidence package.",
      },
    });
    const submitTime = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-billing-api/submit",
    });
    const approveTime = await server.inject({
      method: "POST",
      url: "/api/time-entries/time-billing-api/approve",
    });
    const submitExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-billing-api/submit",
    });
    const approveExpense = await server.inject({
      method: "POST",
      url: "/api/expense-entries/expense-billing-api/approve",
    });

    expect(time.statusCode).toBe(200);
    expect(expense.statusCode).toBe(200);
    expect(submitTime.statusCode).toBe(200);
    expect(approveTime.statusCode).toBe(200);
    expect(submitExpense.statusCode).toBe(200);
    expect(approveExpense.statusCode).toBe(200);

    const invoice = await server.inject({
      method: "POST",
      url: "/api/invoices",
      payload: {
        id: "invoice-billing-api",
        matterId: "matter-001",
        clientContactId: "contact-ada",
        invoiceNumber: "INV-API-001",
        timeEntryIds: ["time-billing-api"],
        expenseEntryIds: ["expense-billing-api"],
        taxName: "GST",
        taxRateBps: 500,
      },
    });
    const invoiceBody = invoice.json<{ totalCents: number; balanceDueCents: number }>();
    const approvedInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-billing-api/approve",
    });
    const issuedInvoice = await server.inject({
      method: "POST",
      url: "/api/invoices/invoice-billing-api/issue",
    });
    const billedTime = await server.inject({
      method: "GET",
      url: "/api/time-entries?matterId=matter-001&status=billed",
    });

    expect(invoice.statusCode).toBe(200);
    expect(invoiceBody).toMatchObject({ totalCents: 21525, balanceDueCents: 21525 });
    expect(approvedInvoice.statusCode).toBe(200);
    expect(issuedInvoice.statusCode).toBe(200);
    expect(
      billedTime.json<{ entries: Array<{ id: string }> }>().entries.map((entry) => entry.id),
    ).toContain("time-billing-api");

    const payment = await server.inject({
      method: "POST",
      url: "/api/payments",
      payload: {
        id: "payment-billing-api",
        matterId: "matter-001",
        invoiceId: "invoice-billing-api",
        amountCents: invoiceBody.totalCents,
        method: "cheque",
        reference: "CHK-1",
      },
    });
    const paidInvoice = await server.inject({
      method: "GET",
      url: "/api/invoices/invoice-billing-api",
    });

    expect(payment.statusCode).toBe(200);
    expect(paidInvoice.json<{ status: string; balanceDueCents: number }>()).toMatchObject({
      status: "paid",
      balanceDueCents: 0,
    });

    const transferRequest = await server.inject({
      method: "POST",
      url: "/api/billing/trust-transfer-requests",
      payload: {
        id: "trust-transfer-billing-api",
        matterId: "matter-001",
        invoiceId: "invoice-billing-api",
        amountCents: invoiceBody.totalCents,
        reason: "Request trust transfer approval only.",
      },
    });
    const ledgerAfter = await server.inject({ method: "GET", url: "/api/ledger" });

    expect(transferRequest.statusCode).toBe(200);
    expect(transferRequest.json()).toMatchObject({ status: "pending_approval" });
    expect(transferRequest.json()).not.toHaveProperty("ledgerTransactionId");
    expect(ledgerAfter.json<{ entries: unknown[] }>().entries).toHaveLength(beforeEntryCount);
  });

  it("enforces matter access on billing routes", async () => {
    const response = await testServer().inject({
      method: "GET",
      url: "/api/time-entries?matterId=matter-002",
      headers: {
        "x-open-practice-user-id": "user-licensee",
        "x-open-practice-firm-id": "firm-west-legal",
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
