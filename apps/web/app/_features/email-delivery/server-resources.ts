import { apiGetOptional } from "../../_shared/server-api";
import type { MatterSummary } from "../../types";
import type {
  EmailDeliveryDashboardResponse,
  EmailDeliveryHistoryItem,
  EmailDeliveryHistoryResponse,
} from "./models";

export function buildEmailDeliveryHistoryPath(matterId: string, limit = 5): string {
  return `/api/mail/outbox?matterId=${encodeURIComponent(matterId)}&limit=${limit}`;
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

export async function loadEmailDeliveryDashboardResources(input: {
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<EmailDeliveryDashboardResponse> {
  return loadEmailDeliveryDashboardData({
    matters: input.matters,
    listDeliveryHistoryForMatter: (matterId) =>
      apiGetOptional<EmailDeliveryHistoryResponse>(
        buildEmailDeliveryHistoryPath(matterId),
        { emails: [] },
        input.headers,
        { emails: [] },
      ),
  });
}
