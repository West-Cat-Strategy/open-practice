import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ClientPortalWorkspace from "./client-portal-workspace";
import type { ClientPortalWorkspaceResponse } from "./types";

const workspace: ClientPortalWorkspaceResponse = {
  account: {
    id: "client-001",
    displayName: "Ada Morgan",
    email: "ada@example.test",
    role: "client_external",
  },
  access: {
    posture: "active",
    activeGrantCount: 1,
    matterCount: 1,
    permissions: ["view_documents", "upload_documents", "message"],
  },
  portalActivity: {
    latestActivityAt: "2026-06-11T10:00:00.000Z",
    readState: "attention_required",
    notificationPosture: "attention_required",
    actionCount: 2,
    attentionCount: 1,
    unreadNotificationCount: 0,
    mutedNotificationCount: 0,
    matters: [
      {
        matterId: "matter-001",
        latestActivityAt: "2026-06-11T10:00:00.000Z",
        readState: "attention_required",
        notificationPosture: "attention_required",
        actionCount: 2,
        attentionCount: 1,
        unreadNotificationCount: 0,
        mutedNotificationCount: 0,
        messageThreadCount: 1,
        documentCount: 1,
        signatureCount: 1,
      },
    ],
  },
  matters: [
    {
      id: "matter-001",
      number: "2026-0001",
      title: "Synthetic matter",
      status: "open",
      permissions: ["view_documents", "upload_documents", "message"],
      actionCount: 2,
      latestActivityAt: "2026-06-11T10:00:00.000Z",
      readState: "attention_required",
      notificationPosture: "attention_required",
      unreadNotificationCount: 0,
    },
  ],
  matterDetails: [
    {
      id: "matter-001",
      number: "2026-0001",
      title: "Synthetic matter",
      status: "open",
      practiceArea: "Residential tenancy",
      jurisdiction: "BC",
      openedOn: "2026-01-10",
      permissions: ["view_documents", "upload_documents", "message", "sign"],
      documentCount: 1,
      signatureCount: 1,
      actionCount: 3,
      attentionCount: 1,
      latestActivityAt: "2026-06-11T10:00:00.000Z",
      readState: "attention_required",
      notificationPosture: "attention_required",
      unreadNotificationCount: 0,
    },
  ],
  documents: [
    {
      id: "doc-001",
      matterId: "matter-001",
      title: "Client visible disclosure.pdf",
      classification: "general",
      version: 2,
      uploadedAt: "2026-06-10T10:00:00.000Z",
      verifiedAt: "2026-06-10T10:10:00.000Z",
      accessId: "portal-document-access-001",
      accessStatus: "active",
      expiresAt: "2026-07-01T00:00:00.000Z",
    },
  ],
  signatures: [
    {
      id: "signature-001",
      matterId: "matter-001",
      documentId: "doc-001",
      documentTitle: "Client visible disclosure.pdf",
      title: "Disclosure acknowledgment",
      status: "sent",
      signerStatus: "sent",
      createdAt: "2026-06-11T10:00:00.000Z",
      actionState: "ready_to_sign",
    },
  ],
  billing: {
    currency: "CAD",
    billCount: 1,
    totalBalanceDueCents: 13230,
    openPaymentRequestCount: 1,
    attentionBillCount: 1,
    matterBills: [
      {
        matterId: "matter-001",
        matterNumber: "2026-0001",
        matterTitle: "Synthetic matter",
        billCount: 1,
        balanceDueCents: 13230,
        attentionCount: 1,
        bills: [
          {
            id: "invoice-001",
            matterId: "matter-001",
            invoiceNumber: "INV-2026-0001",
            status: "issued",
            issuedAt: "2026-04-06T17:00:00.000Z",
            dueAt: "2026-05-06T17:00:00.000Z",
            totalCents: 13230,
            paidCents: 0,
            balanceDueCents: 13230,
            currency: "CAD",
            tone: "risk",
            paymentRequestCount: 1,
            paymentRequests: [
              {
                id: "payment-request-client-001",
                status: "sent",
                amountCents: 13230,
                currency: "CAD",
                deliveryStatus: "sent",
                reminderStatus: "scheduled",
                paymentPlanStatus: "not_offered",
                updatedAt: "2026-05-20T17:01:00.000Z",
              },
            ],
          },
        ],
      },
    ],
  },
  matterActions: [
    {
      matterId: "matter-001",
      matterNumber: "2026-0001",
      matterTitle: "Synthetic matter",
      actionCount: 2,
      attentionCount: 1,
      actions: [
        {
          id: "payment-request:001",
          family: "payment_request",
          matterId: "matter-001",
          title: "Payment request pending",
          detail: "Invoice INV-2026-0001 has a CAD 132.30 hosted payment request.",
          status: "sent",
          tone: "risk",
          details: [
            { label: "Amount", value: "CAD 132.30" },
            { label: "Delivery", value: "sent" },
          ],
        },
        {
          id: "client-action:conversation:matter-001",
          family: "client_action",
          matterId: "matter-001",
          title: "Message thread available",
          detail: "1 redacted message thread is linked to this matter.",
          status: "open",
          tone: "neutral",
          details: [{ label: "Bodies", value: "redacted" }],
        },
      ],
    },
  ],
  actions: [],
};

describe("ClientPortalWorkspace", () => {
  it("renders grouped matter actions and redacted detail chips", () => {
    const html = renderToStaticMarkup(createElement(ClientPortalWorkspace, { workspace }));

    expect(html).toContain("Matter action workspace");
    expect(html).toContain("Matter details");
    expect(html).toContain("Residential tenancy");
    expect(html).toContain("Shared files");
    expect(html).toContain("Client visible disclosure.pdf");
    expect(html).toContain("Signatures");
    expect(html).toContain("Disclosure acknowledgment");
    expect(html).toContain("Ready to sign");
    expect(html).toContain("Mark viewed");
    expect(html).toContain("Confirm signed");
    expect(html).toContain("Decline signing");
    expect(html).toContain("Billing");
    expect(html).toContain("2026-0001");
    expect(html).toContain("INV-2026-0001");
    expect(html).toContain("Payment request pending");
    expect(html).toContain("CAD 132.30");
    expect(html).toContain("1 open");
    expect(html).toContain("1 need attention");
    expect(html).toContain("Activity");
    expect(html).toContain("Bodies");
    expect(html).toContain("redacted");
    expect(html).not.toContain("tokenHash");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("signingUrl");
    expect(html).not.toContain("providerEvidence");
    expect(html).not.toContain("rawConsentEvidence");
    expect(html).not.toContain("PRIVATE HTML BODY");
    expect(html).not.toContain("private-checkout");
    expect(html).not.toContain("/payments/private-client-path");
    expect(html).not.toContain("externalSessionId");
  });
});
