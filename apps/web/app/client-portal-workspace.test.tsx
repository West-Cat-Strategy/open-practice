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
  matters: [
    {
      id: "matter-001",
      number: "2026-0001",
      title: "Synthetic matter",
      status: "open",
      permissions: ["view_documents", "upload_documents", "message"],
      actionCount: 2,
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
    expect(html).toContain("Billing");
    expect(html).toContain("2026-0001");
    expect(html).toContain("INV-2026-0001");
    expect(html).toContain("Payment request pending");
    expect(html).toContain("CAD 132.30");
    expect(html).toContain("1 open");
    expect(html).toContain("Bodies");
    expect(html).toContain("redacted");
    expect(html).not.toContain("tokenHash");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("PRIVATE HTML BODY");
    expect(html).not.toContain("private-checkout");
    expect(html).not.toContain("/payments/private-client-path");
    expect(html).not.toContain("externalSessionId");
  });
});
