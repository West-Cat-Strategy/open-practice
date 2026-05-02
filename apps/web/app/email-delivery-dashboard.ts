import type {
  EmailDeliveryDashboardResponse,
  EmailDeliveryHistoryItem,
  EmailDeliveryHistoryResponse,
  MatterSummary,
} from "./types";

export function buildEmailDeliveryHistoryPath(matterId: string, limit = 5): string {
  return `/api/mail/outbox?matterId=${encodeURIComponent(matterId)}&limit=${limit}`;
}

export function describeEmailDeliveryState(email: EmailDeliveryHistoryItem): {
  label: string;
  tone?: "risk";
} {
  if (email.status === "failed") return { label: "failed", tone: "risk" };
  if (email.status === "sent") return { label: "sent" };
  if (email.status === "sending") return { label: "sending" };
  return { label: email.status.replaceAll("_", " ") };
}

export async function loadEmailDeliveryDashboardData(input: {
  matters: MatterSummary[];
  listDeliveryHistoryForMatter: (matterId: string) => Promise<EmailDeliveryHistoryResponse>;
}): Promise<EmailDeliveryDashboardResponse> {
  const emailsByMatterId: Record<string, EmailDeliveryHistoryItem[]> = {};
  await Promise.all(
    input.matters.map(async (matter) => {
      const response = await input.listDeliveryHistoryForMatter(matter.id);
      emailsByMatterId[matter.id] = response.emails;
    }),
  );
  return { emailsByMatterId };
}
