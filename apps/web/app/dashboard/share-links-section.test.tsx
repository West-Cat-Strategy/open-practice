import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ShareLinkRecord } from "../_features/share-links/models";
import type { MatterSummary } from "../types";
import { ShareLinksSection } from "./share-links-section";

const syntheticContactParty = {
  id: "party_synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  contactId: "contact_synthetic",
  adverse: false,
  confidential: false,
  role: "client",
  contact: {
    id: "contact_synthetic",
    firmId: "firm_synthetic",
    kind: "person",
    displayName: "Synthetic Client",
    aliases: [],
    identifiers: [{ type: "email", value: "client@example.test" }],
  },
} as MatterSummary["parties"][number];

const syntheticShare: ShareLinkRecord = {
  id: "share-link-synthetic",
  firmId: "firm_synthetic",
  matterId: "matter_synthetic",
  grantedByUserId: "user_synthetic",
  permissions: ["view_documents"],
  expiresAt: "2035-06-06T00:00:00.000Z",
  createdAt: "2026-06-06T00:00:00.000Z",
  requireEmailVerification: true,
};

function noop(): void {}

describe("ShareLinksSection", () => {
  it("renders secure share operations without changing copy or classes", () => {
    const html = renderToStaticMarkup(
      createElement(ShareLinksSection, {
        activeClientPortalContacts: [syntheticContactParty],
        activeShares: [syntheticShare],
        clientPortalSetupToken: "synthetic-password-token",
        clientPortalStatus: "No client portal account setup run in this session.",
        creatingClientPortalAccount: false,
        creatingShare: false,
        requireEmailVerification: true,
        revokingShareId: "",
        selectedClientPortalContactId: "contact_synthetic",
        shareExpiresAt: "2035-06-06",
        shareLinksCreateAvailable: true,
        shareLinksStatus: {
          createStatus: "enabled",
          provider: "shares",
          reason: "matter-scoped",
        },
        shareNotificationEmail: "client@example.test",
        shareOneTimeToken: "synthetic-share-token",
        sharePermissions: ["view_documents"],
        shareStatus: "No share links are active for this matter.",
        onCreateClientPortalAccount: noop,
        onCreateShareLink: noop,
        onRevokeShareLink: noop,
        onSetClientPortalContactId: noop,
        onSetRequireEmailVerification: noop,
        onSetShareExpiresAt: noop,
        onSetShareNotificationEmail: noop,
        onToggleSharePermission: noop,
      }),
    );

    expect(html).toContain('class="detail-grid share-control-grid"');
    expect(html).toContain("Create status");
    expect(html).toContain("Provider");
    expect(html).toContain("Matter links");
    expect(html).toContain("Active links");
    expect(html).toContain("Create share link");
    expect(html).toContain("View documents");
    expect(html).toContain("Require email verification");
    expect(html).toContain("client@example.test");
    expect(html).toContain("Create link");
    expect(html).toContain("One-time token");
    expect(html).toContain("Client account setup");
    expect(html).toContain("Synthetic Client");
    expect(html).toContain("Password setup token");
    expect(html).toContain("Matter share links");
    expect(html).toContain("share-link-synthetic");
    expect(html).toContain("email verification required");
    expect(html).toContain("Revoke");
    expect(html).toContain("No share links are active for this matter.");
  });

  it("keeps the empty share-link state visible", () => {
    const html = renderToStaticMarkup(
      createElement(ShareLinksSection, {
        activeClientPortalContacts: [],
        activeShares: [],
        clientPortalSetupToken: "",
        clientPortalStatus: "No client portal account setup run in this session.",
        creatingClientPortalAccount: false,
        creatingShare: false,
        requireEmailVerification: false,
        revokingShareId: "",
        selectedClientPortalContactId: "",
        shareExpiresAt: "",
        shareLinksCreateAvailable: false,
        shareLinksStatus: {
          createStatus: "disabled",
          reason: "share_routes_unavailable",
        },
        shareNotificationEmail: "",
        shareOneTimeToken: "",
        sharePermissions: ["view_documents"],
        shareStatus: "Share links have not loaded yet.",
        onCreateClientPortalAccount: noop,
        onCreateShareLink: noop,
        onRevokeShareLink: noop,
        onSetClientPortalContactId: noop,
        onSetRequireEmailVerification: noop,
        onSetShareExpiresAt: noop,
        onSetShareNotificationEmail: noop,
        onToggleSharePermission: noop,
      }),
    );

    expect(html).toContain("0 eligible contacts");
    expect(html).toContain('disabled=""');
    expect(html).toContain("No share links are linked to this matter.");
    expect(html).toContain("Share links have not loaded yet.");
  });
});
