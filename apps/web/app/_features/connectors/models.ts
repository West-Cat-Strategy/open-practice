export interface ConnectorSummary {
  id: string;
  type: "calendar" | "document_processing" | "email" | "generic" | "inbound_email" | string;
  key: string;
  displayName: string;
  status: "disabled" | "enabled" | "paused" | "error" | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectorsResponse {
  connectors: ConnectorSummary[];
}

export interface ConnectorOutboxItem {
  id: string;
  connectorId: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  idempotencyKeyPresent: boolean;
  status: "pending" | "leased" | "delivered" | "failed" | "dead_letter" | "cancelled" | string;
  payloadSummary: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  leasePresent: boolean;
  leasedUntil?: string;
  deliveredAt?: string;
  deadLetteredAt?: string;
  lastErrorSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectorOutboxResponse {
  outbox: ConnectorOutboxItem[];
}

export interface ConnectorOutboxRecoveryResponse {
  outbox: ConnectorOutboxItem;
  deliveryJob?: {
    id: string;
    queueName: string;
    jobName: string;
    status: string;
    bullJobId?: string;
    targetResourceType?: string;
    targetResourceId?: string;
    queuedAt?: string;
    idempotencyKeyPresent: boolean;
  };
}

export interface ConnectorOperationsResponse {
  connectors: ConnectorSummary[];
  outbox: ConnectorOutboxItem[];
  status: "available" | "access_denied" | "unavailable";
}
