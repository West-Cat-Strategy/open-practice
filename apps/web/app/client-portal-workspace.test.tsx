import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ClientPortalWorkspaceView,
  clientPortalWorkspaceTestExports,
} from "./client-portal-workspace";
import type { ClientPortalWorkspaceResponse } from "./types";

function workspaceFixture(
  overrides: Partial<ClientPortalWorkspaceResponse> = {},
): ClientPortalWorkspaceResponse {
  return {
    account: {
      userId: "user-client-001",
      displayName: "Ada Morgan",
      email: "ada@example.test",
      role: "client_external",
    },
    access: {
      status: "active",
      activeAccountCount: 1,
      activeGrantCount: 1,
      contactCount: 1,
      matchedBy: "contact_email",
      redacted: true,
    },
    boundaries: {
      publicTokenRoutesPreserved: true,
      realtimeChat: "out_of_scope",
      broadDocumentBrowsing: "out_of_scope",
      livePayments: "out_of_scope",
      nativeMobile: "out_of_scope",
    },
    matters: [
      {
        matterId: "matter-private-001",
        contact: {
          id: "contact-client-001",
          displayName: "Ada Morgan",
        },
        access: {
          grantCount: 1,
          permissions: ["view_documents", "upload_documents"],
          expiresAt: "2026-06-01T00:00:00.000Z",
          redacted: true,
        },
        summaries: {
          secureShares: {
            activeLinkCount: 1,
            emailVerificationRequiredCount: 0,
            sharedDocumentCount: 2,
          },
          externalUploads: {
            activeLinkCount: 1,
            remainingUploadSlots: 1,
            reviewCounts: { pending: 1 },
          },
          intake: {
            activeLinkCount: 1,
            submittedLinkCount: 0,
            draftLinkCount: 1,
            itemActionCounts: { waiting: 1 },
          },
          guestSessions: {
            activeLinkCount: 1,
            statusCounts: { waiting: 1 },
          },
          receipts: {
            pendingCount: 1,
            recordedCount: 1,
            expiredCount: 0,
          },
          signatures: {
            pendingCount: 1,
            completedCount: 0,
          },
        },
        clientActions: [
          {
            id: "upload-action",
            kind: "external_upload",
            title: "Upload requested files",
            detail: "1 slot available",
            status: "Open",
            tone: "risk",
          },
          {
            id: "receipt-action",
            kind: "email_receipt",
            title: "Receipt recorded",
            detail: "Confirmation available",
            status: "Recorded",
            tone: "neutral",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("client portal workspace", () => {
  it("renders the empty workspace state without a staff shell", () => {
    const workspace = workspaceFixture({
      access: {
        status: "no_active_grants",
        activeAccountCount: 0,
        activeGrantCount: 0,
        contactCount: 0,
        matchedBy: "contact_email",
        redacted: true,
      },
      matters: [],
    });
    const markup = renderToStaticMarkup(
      createElement(ClientPortalWorkspaceView, { workspace, status: "Workspace loaded." }),
    );

    expect(markup).toContain("No active portal workspace");
    expect(markup).toContain("No client actions need attention right now.");
    expect(markup).toContain("Recent updates");
    expect(markup).not.toContain("DashboardClient");
    expect(markup).not.toContain("Staff dashboard");
  });

  it("renders mixed action states across needs attention and recent updates", () => {
    const workspace = workspaceFixture();
    const markup = renderToStaticMarkup(
      createElement(ClientPortalWorkspaceView, { workspace, status: "Workspace loaded." }),
    );

    expect(markup).toContain("Needs attention");
    expect(markup).toContain("1 open");
    expect(markup).toContain("Upload requested files");
    expect(markup).toContain("Receipt recorded");
    expect(markup).toContain("Recent updates");
    expect(clientPortalWorkspaceTestExports.portalNeedsAttentionItems(workspace)).toHaveLength(1);
    expect(clientPortalWorkspaceTestExports.portalRecentUpdates(workspace)).toHaveLength(1);
    expect(
      clientPortalWorkspaceTestExports.buildPortalApiUrl(
        "http://api.example.test",
        clientPortalWorkspaceTestExports.clientPortalWorkspacePath,
      ),
    ).toBe("http://api.example.test/api/client-portal/workspace");
    expect(clientPortalWorkspaceTestExports.countLabel(1, "grant")).toBe("1 grant");
    expect(clientPortalWorkspaceTestExports.countLabel(2, "grant")).toBe("2 grants");
    expect(clientPortalWorkspaceTestExports.formatPermission("view_documents")).toBe(
      "Shared documents",
    );
    expect(
      clientPortalWorkspaceTestExports.compactStatusCounts({ waiting: 1, admitted: 2, revoked: 0 }),
    ).toBe("1 waiting / 2 admitted");
    expect(clientPortalWorkspaceTestExports.credentialedGetInit()).toEqual({
      credentials: "include",
    });
    expect(clientPortalWorkspaceTestExports.credentialedLogoutInit()).toEqual({
      method: "POST",
      credentials: "include",
    });
  });

  it("keeps the rendered view redacted and out of the staff dashboard", () => {
    const markup = renderToStaticMarkup(
      createElement(ClientPortalWorkspaceView, {
        workspace: workspaceFixture(),
        status: "Workspace loaded.",
      }),
    );

    expect(markup).toContain("Redacted view");
    expect(markup).toContain("Document access summarized");
    expect(markup).not.toContain("matter-private-001");
    expect(markup).not.toContain("owner_admin");
    expect(markup).not.toContain("Dashboard");
  });
});
