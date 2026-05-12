import type { ConnectorOperationsResponse, ConnectorOutboxItem, ConnectorSummary } from "./types";

export function emptyConnectorOperationsResponse(
  status: ConnectorOperationsResponse["status"] = "unavailable",
): ConnectorOperationsResponse {
  return {
    connectors: [],
    outbox: [],
    status,
  };
}

export function connectorDisplayName(connector?: ConnectorSummary): string {
  if (!connector) return "Unknown connector";
  return connector.displayName || `${connector.type}:${connector.key}`;
}

function isSafePayloadSummaryKey(key: string): boolean {
  return !/(secret|token|password|credential|authorization|api[-_]?key)/i.test(key);
}

export function summarizeConnectorPayload(payloadSummary: Record<string, unknown>): string {
  const keys = Object.keys(payloadSummary).filter(isSafePayloadSummaryKey).sort();
  if (keys.length === 0) return "0 payload-summary keys";
  return `${keys.length} payload-summary key${keys.length === 1 ? "" : "s"}: ${keys.join(", ")}`;
}

export function summarizeConnectorOperations(response: ConnectorOperationsResponse): string {
  if (response.status === "access_denied") {
    return "Connector operations are access-controlled for this user.";
  }
  if (response.status === "unavailable") {
    return "Connector operations endpoint is not available in this environment.";
  }

  const pending = response.outbox.filter((item) => item.status === "pending").length;
  const leased = response.outbox.filter((item) => item.status === "leased").length;
  const deadLetter = response.outbox.filter((item) => item.status === "dead_letter").length;

  return `${response.connectors.length} connector${response.connectors.length === 1 ? "" : "s"} loaded. ${response.outbox.length} outbox item${response.outbox.length === 1 ? "" : "s"}: ${pending} pending, ${leased} leased, ${deadLetter} dead letter.`;
}

export function connectorOutboxStatusTone(item: ConnectorOutboxItem): "neutral" | "ready" | "risk" {
  if (item.status === "delivered") return "ready";
  if (item.status === "failed" || item.status === "dead_letter") return "risk";
  return "neutral";
}
