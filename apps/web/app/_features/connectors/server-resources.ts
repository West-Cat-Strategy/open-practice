import { apiGetOptionalWithStatus } from "../../_shared/server-api";
import { emptyConnectorOperationsResponse } from "../../connector-outbox-dashboard";
import type {
  ConnectorOperationsResponse,
  ConnectorOutboxResponse,
  ConnectorsResponse,
} from "./models";

export async function loadConnectorOperations(
  headers: Record<string, string>,
): Promise<ConnectorOperationsResponse> {
  const [connectorsResult, outboxResult] = await Promise.all([
    apiGetOptionalWithStatus<ConnectorsResponse>("/api/connectors", { connectors: [] }, headers),
    apiGetOptionalWithStatus<ConnectorOutboxResponse>(
      "/api/connectors/outbox",
      { outbox: [] },
      headers,
    ),
  ]);
  const status =
    connectorsResult.status === "access_denied" || outboxResult.status === "access_denied"
      ? "access_denied"
      : connectorsResult.status === "unavailable" || outboxResult.status === "unavailable"
        ? "unavailable"
        : "available";

  return {
    ...emptyConnectorOperationsResponse(status),
    connectors: connectorsResult.data.connectors,
    outbox: outboxResult.data.outbox,
  };
}
