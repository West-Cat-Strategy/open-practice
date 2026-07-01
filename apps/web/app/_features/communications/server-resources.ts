import { apiGetOptional } from "../../_shared/server-api";
import {
  buildCommunicationsInboxPath,
  emptyInboundParserReplayInventory,
  loadCommunicationsInboxDashboardData,
} from "../../communications-inbox-dashboard";
import type { MatterSummary } from "../../types";
import type {
  CommunicationsInboxDashboardResponse,
  InboundEmailMatterDraft,
  InboundParserReplayInventoryResponse,
  CommunicationsInboxMatterResponse,
  UnscopedInboundEmailReviewMessage,
  UnscopedInboundEmailReviewResponse,
} from "./models";

function emptyCommunicationsInboxMatter(
  matterId: string,
  status: CommunicationsInboxMatterResponse["status"],
): CommunicationsInboxMatterResponse {
  return {
    status,
    matterId,
    channelState: {
      inboundEmailStatus: "disabled",
      outboundEmailStatus: "disabled",
      inboundEmailAddressCount: 0,
      enabledInboundEmailAddressCount: 0,
    },
    inboundEmail: [],
    outboundDeliveryHistory: [],
    conversations: [],
    channelHistory: [],
    clientUpdateDraftRequests: [],
    contactCues: [],
  };
}

type InboundEmailMessagesResponse = {
  status: "available" | "access_denied" | "unavailable";
  messages: Array<{
    id: string;
    matterId?: string;
    messageId?: string;
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    status: string;
    labels: string[];
    receivedAt: string;
    metadata?: {
      matterDraft?: InboundEmailMatterDraft;
    };
  }>;
};

function emptyUnscopedInboundEmail(
  status: UnscopedInboundEmailReviewResponse["status"],
): UnscopedInboundEmailReviewResponse {
  return { status, messages: [] };
}

function senderSummary(fromAddress: string): string {
  const domain = fromAddress.includes("@") ? fromAddress.split("@").pop()?.trim() : undefined;
  return domain ? `redacted sender at ${domain.slice(0, 120)}` : "redacted sender";
}

function unscopedInboundMessage(
  message: InboundEmailMessagesResponse["messages"][number],
): UnscopedInboundEmailReviewMessage {
  return {
    id: message.id,
    status: message.status,
    labels: message.labels,
    receivedAt: message.receivedAt,
    recipientCount: message.toAddresses.length,
    senderSummary: senderSummary(message.fromAddress),
    providerMessageIdPresent: Boolean(message.messageId),
    subjectPresent: message.subject.trim().length > 0,
    bodyRedacted: true,
    metadataRedacted: true,
    matterDraft: message.metadata?.matterDraft,
  };
}

export async function loadCommunicationsInboxResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<CommunicationsInboxDashboardResponse> {
  const [matterScopedInbox, unscopedInbox, inboundParserReplayInventory] = await Promise.all([
    loadCommunicationsInboxDashboardData({
      matters: input.matters,
      getInboxForMatter: (matterId) =>
        apiGetOptional<CommunicationsInboxMatterResponse>(
          buildCommunicationsInboxPath(matterId),
          emptyCommunicationsInboxMatter(matterId, "unavailable"),
          input.headers,
          emptyCommunicationsInboxMatter(matterId, "access_denied"),
        ),
    }),
    apiGetOptional<InboundEmailMessagesResponse>(
      "/api/inbound-email/messages",
      { status: "unavailable", messages: [] },
      input.headers,
      { status: "access_denied", messages: [] },
    ),
    apiGetOptional<InboundParserReplayInventoryResponse>(
      "/api/inbound-email/parser-jobs/replay-inventory",
      emptyInboundParserReplayInventory("unavailable"),
      input.headers,
      emptyInboundParserReplayInventory("access_denied"),
    ),
  ]);
  return {
    ...matterScopedInbox,
    unscopedInboundEmail:
      unscopedInbox.status === "available"
        ? {
            status: "available",
            messages: unscopedInbox.messages
              .filter((message) => !message.matterId)
              .map(unscopedInboundMessage),
          }
        : emptyUnscopedInboundEmail(unscopedInbox.status),
    inboundParserReplayInventory,
  };
}
