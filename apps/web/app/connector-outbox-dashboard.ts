import {
  describeOperationalActionState,
  disabledOperationalAction,
  type OperationalActionState,
} from "@open-practice/domain/operational-actions";
import type { ConnectorOperationsResponse, ConnectorOutboxItem, ConnectorSummary } from "./types";

export type ConnectorRecoveryAction = "retry" | "dead_letter";

export interface PendingConnectorRecovery {
  action: ConnectorRecoveryAction;
  outboxId: string;
  expectedStatus: ConnectorOutboxItem["status"];
}

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

export function buildConnectorOutboxRetryPath(outboxId: string): string {
  return `/api/connectors/outbox/${encodeURIComponent(outboxId)}/retry`;
}

export function buildConnectorOutboxDeadLetterPath(outboxId: string): string {
  return `/api/connectors/outbox/${encodeURIComponent(outboxId)}/dead-letter`;
}

export function compactConnectorActionReason(value?: string): string {
  return value ? value.replaceAll("_", " ") : "available";
}

export function describeConnectorOutboxRetryAction(
  item: ConnectorOutboxItem,
  canManageConnectorRecovery: boolean,
): OperationalActionState {
  return describeOperationalActionState({
    actionKey: "connector_outbox.retry",
    label: "Retry",
    availableTone: "risk",
    disabledWhen: [
      !canManageConnectorRecovery && disabledOperationalAction("permission_required"),
      item.status !== "failed" &&
        item.status !== "dead_letter" &&
        disabledOperationalAction("status_not_retryable"),
    ],
  });
}

export function canRetryConnectorOutbox(
  item: ConnectorOutboxItem,
  canManageConnectorRecovery: boolean,
): boolean {
  return describeConnectorOutboxRetryAction(item, canManageConnectorRecovery).available;
}

function connectorLeaseBlocksDeadLetter(item: ConnectorOutboxItem, now: Date): boolean {
  if (item.status !== "leased") return false;
  if (!item.leasedUntil) return false;
  const leasedUntil = Date.parse(item.leasedUntil);
  return !Number.isFinite(leasedUntil) || leasedUntil > now.getTime();
}

export function describeConnectorOutboxDeadLetterAction(
  item: ConnectorOutboxItem,
  canManageConnectorRecovery: boolean,
  now: Date = new Date(),
): OperationalActionState {
  return describeOperationalActionState({
    actionKey: "connector_outbox.dead_letter",
    label: "Dead-letter",
    availableTone: "risk",
    disabledWhen: [
      !canManageConnectorRecovery && disabledOperationalAction("permission_required"),
      connectorLeaseBlocksDeadLetter(item, now) &&
        disabledOperationalAction("lease_active_or_unconfirmed"),
      item.status !== "pending" &&
        item.status !== "failed" &&
        item.status !== "leased" &&
        disabledOperationalAction("status_not_dead_letterable"),
    ],
  });
}

export function canDeadLetterConnectorOutbox(
  item: ConnectorOutboxItem,
  canManageConnectorRecovery: boolean,
  now: Date = new Date(),
): boolean {
  return describeConnectorOutboxDeadLetterAction(item, canManageConnectorRecovery, now).available;
}

export function buildConnectorOutboxRetryPayload(
  item: ConnectorOutboxItem,
  idempotencyKey?: string,
) {
  if (item.status !== "failed" && item.status !== "dead_letter") {
    throw new Error("Connector outbox row is not retryable");
  }
  return {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    confirmation: {
      confirmed: true,
      action: "retry",
      outboxId: item.id,
      expectedStatus: item.status,
    },
  };
}

export function buildConnectorOutboxDeadLetterPayload(item: ConnectorOutboxItem) {
  if (item.status !== "pending" && item.status !== "failed" && item.status !== "leased") {
    throw new Error("Connector outbox row cannot be dead-lettered");
  }
  return {
    confirmation: {
      confirmed: true,
      action: "dead_letter",
      outboxId: item.id,
      expectedStatus: item.status,
    },
  };
}
