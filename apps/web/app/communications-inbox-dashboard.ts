import type {
  CommunicationsChannelHistoryItem,
  CommunicationsInboxDashboardResponse,
  CommunicationsInboxMatterResponse,
  CommunicationsInboxOutboundDelivery,
} from "./_features/communications/models";
import { describeEmailDeliveryHandoff } from "./email-delivery-dashboard";
import type { MatterSummary } from "./types";

export function buildCommunicationsInboxPath(matterId: string): string {
  return `/api/communications/inbox?matterId=${encodeURIComponent(matterId)}`;
}

export function describeCommunicationsDeliveryState(email: CommunicationsInboxOutboundDelivery): {
  label: string;
  detail: string;
  retryEligible: boolean;
  tone?: "risk";
} {
  const handoff = describeEmailDeliveryHandoff(email);
  return {
    label: handoff.label,
    detail: handoff.detail,
    retryEligible: handoff.retryEligible,
    tone: handoff.tone,
  };
}

export function describeCommunicationsHistoryState(item: CommunicationsChannelHistoryItem): {
  label: string;
  tone?: "risk";
} {
  if (item.status === "failed" || item.status === "thread_revoked") {
    return { label: item.status.replaceAll("_", " "), tone: "risk" };
  }
  return { label: item.status.replaceAll("_", " ") };
}

export async function loadCommunicationsInboxDashboardData(input: {
  matters: MatterSummary[];
  getInboxForMatter: (matterId: string) => Promise<CommunicationsInboxMatterResponse>;
}): Promise<CommunicationsInboxDashboardResponse> {
  const inboxByMatterId: CommunicationsInboxDashboardResponse["inboxByMatterId"] = {};
  await Promise.all(
    input.matters.map(async (matter) => {
      inboxByMatterId[matter.id] = await input.getInboxForMatter(matter.id);
    }),
  );
  return { inboxByMatterId, unscopedInboundEmail: { status: "unavailable", messages: [] } };
}
