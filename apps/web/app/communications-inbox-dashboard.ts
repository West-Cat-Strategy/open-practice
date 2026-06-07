import type {
  CommunicationsChannelHistoryItem,
  CommunicationsInboxDashboardResponse,
  CommunicationsInboxMatterResponse,
  CommunicationsInboxOutboundDelivery,
} from "./_features/communications/models";
import type { MatterSummary } from "./types";

export function buildCommunicationsInboxPath(matterId: string): string {
  return `/api/communications/inbox?matterId=${encodeURIComponent(matterId)}`;
}

export function describeCommunicationsDeliveryState(email: CommunicationsInboxOutboundDelivery): {
  label: string;
  tone?: "risk";
} {
  if (email.status === "failed") return { label: "failed", tone: "risk" };
  if (email.status === "sent") return { label: "sent" };
  if (email.status === "sending") return { label: "sending" };
  return { label: email.status.replaceAll("_", " ") };
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
  return { inboxByMatterId };
}
