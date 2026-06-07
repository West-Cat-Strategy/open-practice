import { loadCalendarDashboardData } from "../../calendar-dashboard";
import { apiGet } from "../../_shared/server-api";
import type { MatterSummary } from "../../types";
import type {
  CalendarCredentialsResponse,
  CalendarDashboardResponse,
  CalendarEventsResponse,
} from "./models";

export function emptyCalendarDashboard(): CalendarDashboardResponse {
  return {
    eventsByMatterId: {},
    guestSessionsByEventId: {},
    schedulingRequestsByMatterId: {},
    linksByMatterId: {},
    credentials: [],
  };
}

export async function loadCalendarDashboardResources({
  enabled,
  headers,
  matters,
}: {
  enabled: boolean;
  headers: Record<string, string>;
  matters: MatterSummary[];
}): Promise<CalendarDashboardResponse> {
  if (!enabled) return emptyCalendarDashboard();

  return loadCalendarDashboardData({
    matters,
    listEventsForMatter: (matterId) =>
      apiGet<CalendarEventsResponse>(
        `/api/calendar/events?matterId=${encodeURIComponent(matterId)}`,
        headers,
      ),
    listCredentials: async () =>
      (await apiGet<CalendarCredentialsResponse>("/api/calendar/credentials", headers)).credentials,
  });
}
