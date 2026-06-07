import type {
  ConnectorDeliveryAttemptRecord,
  ConnectorOutboxRecord,
  ConnectorRecord,
  IntegrationApiCredentialRecord,
  IntegrationDeveloperAppRecord,
  IntegrationWebhookSubscriptionRecord,
} from "@open-practice/domain";

export interface ConnectorRepository {
  createConnector(connector: ConnectorRecord): Promise<ConnectorRecord>;
  updateConnector(
    firmId: string,
    connectorId: string,
    updates: Partial<
      Pick<ConnectorRecord, "displayName" | "status" | "secretReference" | "configSummary">
    > & { updatedAt: string },
  ): Promise<ConnectorRecord | undefined>;
  listConnectors(
    firmId: string,
    options?: { type?: ConnectorRecord["type"]; status?: ConnectorRecord["status"] },
  ): Promise<ConnectorRecord[]>;
  getConnector(firmId: string, connectorId: string): Promise<ConnectorRecord | undefined>;
  createConnectorOutbox(input: ConnectorOutboxRecord): Promise<{
    outbox: ConnectorOutboxRecord;
    created: boolean;
  }>;
  listConnectorOutbox(
    firmId: string,
    options?: {
      connectorId?: string;
      status?: ConnectorOutboxRecord["status"];
      limit?: number;
    },
  ): Promise<ConnectorOutboxRecord[]>;
  getConnectorOutbox(firmId: string, outboxId: string): Promise<ConnectorOutboxRecord | undefined>;
  retryConnectorOutbox(input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "failed" | "dead_letter">;
    occurredAt: string;
  }): Promise<ConnectorOutboxRecord | undefined>;
  deadLetterConnectorOutbox(input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "pending" | "failed" | "leased">;
    occurredAt: string;
    errorSummary: string;
  }): Promise<ConnectorOutboxRecord | undefined>;
  createConnectorDeliveryAttempt(
    attempt: ConnectorDeliveryAttemptRecord,
  ): Promise<ConnectorDeliveryAttemptRecord>;
  leaseConnectorOutbox(input: {
    firmId: string;
    leaseId: string;
    leasedUntil: string;
    now: string;
    limit?: number;
  }): Promise<
    Array<{
      connector: ConnectorRecord;
      outbox: ConnectorOutboxRecord;
      attempt: ConnectorDeliveryAttemptRecord;
    }>
  >;
  recordConnectorDeliveryResult(input: {
    firmId: string;
    connectorId: string;
    outboxId: string;
    attemptId: string;
    leaseId: string;
    status: "delivered" | "failed";
    occurredAt: string;
    terminal?: boolean;
    nextAttemptAt?: string;
    errorSummary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    outbox: ConnectorOutboxRecord;
    attempt: ConnectorDeliveryAttemptRecord;
  }>;
  listConnectorDeliveryAttempts(
    firmId: string,
    options?: { outboxId?: string; connectorId?: string },
  ): Promise<ConnectorDeliveryAttemptRecord[]>;
  createIntegrationDeveloperApp(
    app: IntegrationDeveloperAppRecord,
  ): Promise<IntegrationDeveloperAppRecord>;
  updateIntegrationDeveloperApp(
    firmId: string,
    appId: string,
    updates: Partial<
      Pick<
        IntegrationDeveloperAppRecord,
        | "displayName"
        | "status"
        | "redirectUris"
        | "allowedOrigins"
        | "allowedScopes"
        | "regionalEndpoint"
        | "rateLimit"
        | "customActionPlaceholders"
      >
    > & { updatedAt: string },
  ): Promise<IntegrationDeveloperAppRecord | undefined>;
  listIntegrationDeveloperApps(
    firmId: string,
    options?: { connectorId?: string; status?: IntegrationDeveloperAppRecord["status"] },
  ): Promise<IntegrationDeveloperAppRecord[]>;
  getIntegrationDeveloperApp(
    firmId: string,
    appId: string,
  ): Promise<IntegrationDeveloperAppRecord | undefined>;
  createIntegrationApiCredential(
    credential: IntegrationApiCredentialRecord,
  ): Promise<IntegrationApiCredentialRecord>;
  listIntegrationApiCredentials(
    firmId: string,
    options?: { appId?: string; status?: IntegrationApiCredentialRecord["status"] },
  ): Promise<IntegrationApiCredentialRecord[]>;
  getIntegrationApiCredential(
    firmId: string,
    credentialId: string,
  ): Promise<IntegrationApiCredentialRecord | undefined>;
  revokeIntegrationApiCredential(input: {
    firmId: string;
    credentialId: string;
    revokedAt: string;
  }): Promise<IntegrationApiCredentialRecord | undefined>;
  createIntegrationWebhookSubscription(
    subscription: IntegrationWebhookSubscriptionRecord,
  ): Promise<IntegrationWebhookSubscriptionRecord>;
  listIntegrationWebhookSubscriptions(
    firmId: string,
    options?: {
      appId?: string;
      connectorId?: string;
      status?: IntegrationWebhookSubscriptionRecord["status"];
    },
  ): Promise<IntegrationWebhookSubscriptionRecord[]>;
}
