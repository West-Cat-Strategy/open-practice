import { apiGetOptional } from "../../_shared/server-api";
import {
  buildCommunicationsInboxPath,
  loadCommunicationsInboxDashboardData,
} from "../../communications-inbox-dashboard";
import type { MatterSummary } from "../../types";
import type {
  CommunicationsInboxDashboardResponse,
  CommunicationsInboxMatterResponse,
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

export async function loadCommunicationsInboxResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<CommunicationsInboxDashboardResponse> {
  return loadCommunicationsInboxDashboardData({
    matters: input.matters,
    getInboxForMatter: (matterId) =>
      apiGetOptional<CommunicationsInboxMatterResponse>(
        buildCommunicationsInboxPath(matterId),
        emptyCommunicationsInboxMatter(matterId, "unavailable"),
        input.headers,
        emptyCommunicationsInboxMatter(matterId, "access_denied"),
      ),
  });
}
