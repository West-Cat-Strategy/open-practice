import { describe, expect, it } from "vitest";
import {
  clientPortalAccessLabel,
  clientPortalActionFamilyLabel,
  clientPortalAttentionCount,
  clientPortalDocumentsForMatter,
  clientPortalMatterDetails,
  clientPortalMatterActionGroups,
  clientPortalMatterActionLabel,
  clientPortalMatterBillingGroups,
  clientPortalMoneyLabel,
  clientPortalSignaturesForMatter,
} from "./client-portal-workspace-utils";
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
    permissions: ["view_documents", "upload_documents"],
  },
  matters: [
    {
      id: "matter-001",
      number: "2026-0001",
      title: "Synthetic matter",
      status: "open",
      permissions: ["view_documents"],
      actionCount: 2,
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
      permissions: ["view_documents", "sign"],
      documentCount: 1,
      signatureCount: 1,
      actionCount: 3,
    },
  ],
  documents: [
    {
      id: "doc-001",
      matterId: "matter-001",
      title: "Client visible disclosure.pdf",
      classification: "general",
      version: 1,
      uploadedAt: "2026-06-10T10:00:00.000Z",
      verifiedAt: "2026-06-10T10:10:00.000Z",
      accessId: "portal-document-access-001",
      accessStatus: "active",
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
  actions: [
    {
      id: "external-upload:001",
      family: "external_upload",
      matterId: "matter-001",
      title: "Upload requested documents",
      detail: "One upload remains.",
      status: "active",
      tone: "risk",
    },
    {
      id: "receipt:001",
      family: "receipt",
      matterId: "matter-001",
      title: "Email receipt status",
      detail: "Recorded.",
      status: "recorded",
      tone: "ready",
    },
  ],
};

describe("client portal workspace helpers", () => {
  it("labels account posture and action families without leaking implementation names", () => {
    expect(clientPortalAccessLabel(workspace.access)).toBe("1 active grant across 1 matter");
    expect(clientPortalActionFamilyLabel("secure_share")).toBe("Secure share");
    expect(clientPortalActionFamilyLabel("client_update")).toBe("Client update");
    expect(clientPortalActionFamilyLabel("client_action")).toBe("Client action");
    expect(clientPortalActionFamilyLabel("payment_request")).toBe("Payment request");
    expect(clientPortalActionFamilyLabel("signature")).toBe("Signature");
  });

  it("summarizes attention and matter action counts", () => {
    expect(clientPortalAttentionCount(workspace)).toBe(1);
    expect(clientPortalMatterActionLabel(1)).toBe("1 action");
    expect(clientPortalMatterActionLabel(2)).toBe("2 actions");
    expect(clientPortalMoneyLabel(13230)).toBe("CAD 132.30");
  });

  it("derives matter action groups from flat actions for older workspace payloads", () => {
    expect(clientPortalMatterActionGroups(workspace)).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        matterNumber: "2026-0001",
        actionCount: 2,
        attentionCount: 1,
      }),
    ]);
  });

  it("prefers enriched matter action groups while preserving matter scope", () => {
    const enriched: ClientPortalWorkspaceResponse = {
      ...workspace,
      matterActions: [
        {
          matterId: "matter-001",
          matterNumber: "2026-0001",
          matterTitle: "Synthetic matter",
          actionCount: 1,
          attentionCount: 0,
          actions: [
            {
              id: "payment-request:001",
              family: "payment_request",
              matterId: "matter-001",
              title: "Payment request pending",
              detail: "Invoice request is pending.",
              status: "sent",
              tone: "ready",
              details: [{ label: "Amount", value: "CAD 132.30" }],
            },
          ],
        },
        {
          matterId: "matter-hidden",
          matterNumber: "2026-HIDDEN",
          matterTitle: "Hidden matter",
          actionCount: 1,
          attentionCount: 1,
          actions: [
            {
              id: "external-upload:hidden",
              family: "external_upload",
              matterId: "matter-hidden",
              title: "Hidden upload",
              detail: "Hidden matter detail",
              status: "active",
              tone: "risk",
            },
          ],
        },
      ],
    };

    const groups = clientPortalMatterActionGroups(enriched);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      matterId: "matter-001",
      actionCount: 1,
      actions: [expect.objectContaining({ family: "payment_request" })],
    });
  });

  it("filters client billing groups to visible matters", () => {
    const enriched: ClientPortalWorkspaceResponse = {
      ...workspace,
      billing: {
        currency: "CAD",
        billCount: 2,
        totalBalanceDueCents: 18230,
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
            bills: [],
          },
          {
            matterId: "matter-hidden",
            matterNumber: "2026-HIDDEN",
            matterTitle: "Hidden matter",
            billCount: 1,
            balanceDueCents: 5000,
            attentionCount: 1,
            bills: [],
          },
        ],
      },
    };

    expect(clientPortalMatterBillingGroups(enriched)).toEqual([
      expect.objectContaining({ matterId: "matter-001", balanceDueCents: 13230 }),
    ]);
  });

  it("groups safe matter details, shared files, and signatures by visible matter", () => {
    const enriched: ClientPortalWorkspaceResponse = {
      ...workspace,
      matterDetails: [
        ...(workspace.matterDetails ?? []),
        {
          id: "matter-hidden",
          number: "2026-HIDDEN",
          title: "Hidden matter",
          status: "open",
          practiceArea: "Hidden",
          jurisdiction: "OTHER",
          permissions: ["view_documents"],
          documentCount: 1,
          signatureCount: 1,
          actionCount: 0,
        },
      ],
      documents: [
        ...(workspace.documents ?? []),
        {
          id: "doc-hidden",
          matterId: "matter-hidden",
          title: "Hidden.pdf",
          classification: "general",
          version: 1,
          accessId: "portal-document-access-hidden",
          accessStatus: "active",
        },
      ],
      signatures: [
        ...(workspace.signatures ?? []),
        {
          id: "signature-hidden",
          matterId: "matter-hidden",
          documentId: "doc-hidden",
          title: "Hidden signature",
          status: "sent",
          signerStatus: "sent",
          createdAt: "2026-06-11T10:00:00.000Z",
          actionState: "ready_to_sign",
        },
      ],
    };

    expect(clientPortalMatterDetails(enriched)).toEqual([
      expect.objectContaining({ id: "matter-001", documentCount: 1, signatureCount: 1 }),
    ]);
    expect(clientPortalDocumentsForMatter(enriched, "matter-001")).toEqual([
      expect.objectContaining({ id: "doc-001", accessStatus: "active" }),
    ]);
    expect(clientPortalSignaturesForMatter(enriched, "matter-001")).toEqual([
      expect.objectContaining({ id: "signature-001", actionState: "ready_to_sign" }),
    ]);
  });
});
