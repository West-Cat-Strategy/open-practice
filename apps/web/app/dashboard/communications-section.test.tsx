import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EmailDeliveryHistoryItem } from "../_features/email-delivery/models";
import type { CommunicationsInboxMatterResponse, MatterSummary } from "../types";
import { CommunicationsSection } from "./communications-section";

const failedDelivery: EmailDeliveryHistoryItem = {
  id: "email-delivery-synthetic",
  matterId: "matter-synthetic",
  templateKey: "client.update",
  status: "failed",
  recipientCount: 2,
  attemptCount: 3,
  queuedAt: "2026-06-20T10:00:00.000Z",
  lastAttemptAt: "2026-06-20T10:05:00.000Z",
  failedAt: "2026-06-20T10:05:00.000Z",
  terminalFailureAt: "2026-06-20T10:05:00.000Z",
  failureSummary: "Synthetic SMTP failure",
  events: [],
};

const inbox: CommunicationsInboxMatterResponse = {
  status: "available",
  matterId: "matter-synthetic",
  channelState: {
    inboundEmailStatus: "configured",
    outboundEmailStatus: "configured",
    inboundEmailAddressCount: 1,
    enabledInboundEmailAddressCount: 1,
  },
  inboundEmail: [],
  outboundDeliveryHistory: [failedDelivery],
  conversations: [],
  channelHistory: [],
  clientUpdateDraftRequests: [],
  contactCues: [],
};

const activeMatter = {
  id: "matter-synthetic",
  number: "OP-SYN-001",
  title: "Synthetic tenant file",
} as unknown as MatterSummary;

describe("CommunicationsSection", () => {
  it("surfaces retry handoff detail in visible communications rows", () => {
    const html = renderToStaticMarkup(
      createElement(CommunicationsSection, {
        activeCommunicationsInbox: inbox,
        activeEmailDeliveries: [failedDelivery],
        activeMatter,
        compactDate: (value?: string) => value ?? "No date",
        compactStatus: (value?: string) => value?.replaceAll("_", " ") ?? "unknown",
      }),
    );

    expect(html).toContain("retry handoff");
    expect(html).toContain(
      "Failed delivery can be retried by staff after confirming recipients; no automatic send starts from the dashboard summary.",
    );
    expect(html).toContain("Synthetic SMTP failure");
  });
});
