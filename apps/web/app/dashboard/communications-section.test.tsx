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
  inboundEmail: [
    {
      id: "inbound-message-synthetic",
      matterId: "matter-synthetic",
      status: "triage_pending",
      labels: ["client"],
      receivedAt: "2026-06-20T09:30:00.000Z",
      attachmentCount: 1,
      matterDraft: {
        status: "drafted",
        createdAt: "2026-06-20T09:45:00.000Z",
        createdByUserId: "user-synthetic",
        source: {
          inboundMessageId: "inbound-message-synthetic",
          providerMessageIdPresent: true,
          receivedAt: "2026-06-20T09:30:00.000Z",
          recipientCount: 1,
          subjectPresent: true,
          senderSummary: "redacted sender at example.test",
          attachmentCount: 1,
        },
        redactedBodySummary: "Synthetic review summary with private facts removed.",
        proposedMatter: {
          title: "Synthetic inbound matter",
          practiceArea: "Residential tenancy",
          jurisdiction: "BC",
          client: {
            kind: "person",
            displayName: "Synthetic Client",
          },
        },
        automaticMatterCreation: false,
        bodyRedacted: true,
        metadataRedacted: true,
        reviewCues: {
          duplicateCandidates: [
            {
              contactId: "contact-private-unsafe-looking",
              displayName: "Private Candidate Name",
              kind: "person",
              status: "active",
              matchedFields: ["email"],
              matchCount: 1,
              visibleSharedMatterCount: 1,
              severity: "review",
            },
          ],
          existingMatterCandidates: [
            {
              matterId: "matter-private-unsafe-looking",
              number: "PRIVATE-001",
              title: "Private existing matter title",
              status: "open",
              practiceArea: "Residential tenancy",
              jurisdiction: "BC",
              matchReasons: ["private match reason"],
            },
          ],
          checklist: [
            {
              key: "synthetic-complete",
              label: "Synthetic complete cue",
              description: "Synthetic complete cue description",
              state: "complete",
              source: "draft",
            },
            {
              key: "synthetic-attention",
              label: "Synthetic attention cue",
              description: "Synthetic attention cue description",
              state: "needs_attention",
              source: "draft",
            },
            {
              key: "synthetic-review",
              label: "Synthetic review cue",
              description: "Synthetic review cue description",
              state: "review",
              source: "existing_matter",
              matterId: "matter-private-unsafe-looking",
            },
          ],
          boundary: {
            automaticMatterCreation: false,
            bodyRedacted: true,
            metadataRedacted: true,
            matterPermissionsExpanded: false,
          },
        },
      },
    },
  ],
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
    expect(html).toContain("1 duplicate candidate");
    expect(html).toContain("1 existing matter candidate");
    expect(html).toContain("1 complete · 1 needs attention · 1 review");
    expect(html).toContain("no auto-create · no permission widening");
    expect(html).toContain(
      "Failed delivery can be retried by staff after confirming recipients; no automatic send starts from the dashboard summary.",
    );
    expect(html).toContain("Synthetic SMTP failure");
    expect(html).not.toContain("Private Candidate Name");
    expect(html).not.toContain("contact-private-unsafe-looking");
    expect(html).not.toContain("PRIVATE-001");
    expect(html).not.toContain("Private existing matter title");
    expect(html).not.toContain("private match reason");
    expect(html).not.toContain("Synthetic complete cue description");
  });
});
