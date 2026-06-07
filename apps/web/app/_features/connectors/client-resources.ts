import { dashboardApiStatus, requestDashboardJson } from "../../api-client";
import { emptyConnectorOperationsResponse } from "../../connector-outbox-dashboard";
import type {
  ConnectorOperationsResponse,
  ConnectorOutboxResponse,
  ConnectorsResponse,
} from "./models";

export async function requestConnectorOperationsForDashboard(
  apiBaseUrl: string,
  headers: Record<string, string>,
): Promise<ConnectorOperationsResponse> {
  try {
    const [connectors, outbox] = await Promise.all([
      requestDashboardJson<ConnectorsResponse>(apiBaseUrl, "/api/connectors", { headers }),
      requestDashboardJson<ConnectorOutboxResponse>(apiBaseUrl, "/api/connectors/outbox", {
        headers,
      }),
    ]);
    return {
      status: "available",
      connectors: connectors.connectors,
      outbox: outbox.outbox,
    };
  } catch (error) {
    const status = dashboardApiStatus(error);
    if (status === 403) return emptyConnectorOperationsResponse("access_denied");
    if (status === 404) return emptyConnectorOperationsResponse("unavailable");
    throw error;
  }
}
