import type {
  ConnectorDeliveryAttemptRecord,
  ConnectorOutboxRecord,
  ConnectorRecord,
  IntegrationApiCredentialRecord,
  IntegrationDeveloperAppRecord,
  IntegrationWebhookSubscriptionRecord,
} from "@open-practice/domain";
import type { ConnectorRepository } from "../connector-contracts.js";
import {
  IdempotencyKeyConflictError,
  canonicalizeForIdempotency,
  clone,
  sanitizeConnectorDeliveryMetadata,
  sanitizeConnectorDeliverySummary,
} from "../contracts.js";

export interface MemoryConnectorStore {
  connectors: ConnectorRecord[];
  connectorOutbox: ConnectorOutboxRecord[];
  connectorDeliveryAttempts: ConnectorDeliveryAttemptRecord[];
  integrationDeveloperApps: IntegrationDeveloperAppRecord[];
  integrationApiCredentials: IntegrationApiCredentialRecord[];
  integrationWebhookSubscriptions: IntegrationWebhookSubscriptionRecord[];
}

export function createMemoryConnector(
  store: MemoryConnectorStore,
  connector: ConnectorRecord,
): ConnectorRecord {
  const duplicate = store.connectors.find(
    (candidate) => candidate.firmId === connector.firmId && candidate.key === connector.key,
  );
  if (duplicate) throw new Error(`Connector key ${connector.key} already exists`);
  store.connectors.push(clone(connector));
  return clone(connector);
}

export function updateMemoryConnector(
  store: MemoryConnectorStore,
  firmId: string,
  connectorId: string,
  updates: Partial<
    Pick<ConnectorRecord, "displayName" | "status" | "secretReference" | "configSummary">
  > & { updatedAt: string },
): ConnectorRecord | undefined {
  const index = store.connectors.findIndex(
    (connector) => connector.firmId === firmId && connector.id === connectorId,
  );
  if (index < 0) return undefined;
  const current = store.connectors[index];
  const next: ConnectorRecord = {
    ...current,
    ...updates,
    secretReference:
      "secretReference" in updates ? updates.secretReference : current.secretReference,
    configSummary: updates.configSummary ?? current.configSummary,
    updatedAt: updates.updatedAt,
  };
  store.connectors[index] = clone(next);
  return clone(next);
}

export function listMemoryConnectors(
  store: MemoryConnectorStore,
  firmId: string,
  options: { type?: ConnectorRecord["type"]; status?: ConnectorRecord["status"] } = {},
): ConnectorRecord[] {
  return clone(
    store.connectors
      .filter((connector) => {
        if (connector.firmId !== firmId) return false;
        if (options.type && connector.type !== options.type) return false;
        if (options.status && connector.status !== options.status) return false;
        return true;
      })
      .sort((left, right) => left.key.localeCompare(right.key)),
  );
}

export function getMemoryConnector(
  store: MemoryConnectorStore,
  firmId: string,
  connectorId: string,
): ConnectorRecord | undefined {
  return clone(
    store.connectors.find(
      (connector) => connector.firmId === firmId && connector.id === connectorId,
    ),
  );
}

export function createMemoryConnectorOutbox(
  store: MemoryConnectorStore,
  input: ConnectorOutboxRecord,
): { outbox: ConnectorOutboxRecord; created: boolean } {
  const existing = store.connectorOutbox.find(
    (outbox) => outbox.firmId === input.firmId && outbox.idempotencyKey === input.idempotencyKey,
  );
  if (existing) {
    const existingFingerprint = canonicalizeForIdempotency({
      connectorId: existing.connectorId,
      eventType: existing.eventType,
      resourceType: existing.resourceType,
      resourceId: existing.resourceId,
      payloadSummary: existing.payloadSummary,
      maxAttempts: existing.maxAttempts,
    });
    const inputFingerprint = canonicalizeForIdempotency({
      connectorId: input.connectorId,
      eventType: input.eventType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      payloadSummary: input.payloadSummary,
      maxAttempts: input.maxAttempts,
    });
    if (existingFingerprint !== inputFingerprint) throw new IdempotencyKeyConflictError();
    return { outbox: clone(existing), created: false };
  }
  const connector = store.connectors.find(
    (candidate) => candidate.firmId === input.firmId && candidate.id === input.connectorId,
  );
  if (!connector) throw new Error(`Connector ${input.connectorId} was not found`);
  store.connectorOutbox.push(clone(input));
  return { outbox: clone(input), created: true };
}

export function listMemoryConnectorOutbox(
  store: MemoryConnectorStore,
  firmId: string,
  options: {
    connectorId?: string;
    status?: ConnectorOutboxRecord["status"];
    limit?: number;
  } = {},
): ConnectorOutboxRecord[] {
  const limit = options.limit ?? 50;
  return clone(
    store.connectorOutbox
      .filter((outbox) => {
        if (outbox.firmId !== firmId) return false;
        if (options.connectorId && outbox.connectorId !== options.connectorId) return false;
        if (options.status && outbox.status !== options.status) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit),
  );
}

export function getMemoryConnectorOutbox(
  store: MemoryConnectorStore,
  firmId: string,
  outboxId: string,
): ConnectorOutboxRecord | undefined {
  return clone(
    store.connectorOutbox.find((outbox) => outbox.firmId === firmId && outbox.id === outboxId),
  );
}

export function retryMemoryConnectorOutbox(
  store: MemoryConnectorStore,
  input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "failed" | "dead_letter">;
    occurredAt: string;
  },
): ConnectorOutboxRecord | undefined {
  const index = store.connectorOutbox.findIndex(
    (outbox) =>
      outbox.firmId === input.firmId &&
      outbox.id === input.outboxId &&
      outbox.status === input.expectedStatus,
  );
  if (index < 0) return undefined;
  const current = store.connectorOutbox[index];
  const next: ConnectorOutboxRecord = {
    ...current,
    status: "pending",
    maxAttempts:
      current.attemptCount >= current.maxAttempts ? current.attemptCount + 1 : current.maxAttempts,
    nextAttemptAt: input.occurredAt,
    leaseId: undefined,
    leasedUntil: undefined,
    deadLetteredAt: undefined,
    lastErrorSummary: undefined,
    updatedAt: input.occurredAt,
  };
  store.connectorOutbox[index] = clone(next);
  return clone(next);
}

export function deadLetterMemoryConnectorOutbox(
  store: MemoryConnectorStore,
  input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "pending" | "failed" | "leased">;
    occurredAt: string;
    errorSummary: string;
  },
): ConnectorOutboxRecord | undefined {
  const index = store.connectorOutbox.findIndex(
    (outbox) =>
      outbox.firmId === input.firmId &&
      outbox.id === input.outboxId &&
      outbox.status === input.expectedStatus,
  );
  if (index < 0) return undefined;
  const current = store.connectorOutbox[index];
  const next: ConnectorOutboxRecord = {
    ...current,
    status: "dead_letter",
    nextAttemptAt: undefined,
    leaseId: undefined,
    leasedUntil: undefined,
    deadLetteredAt: input.occurredAt,
    lastErrorSummary: sanitizeConnectorDeliverySummary(input.errorSummary),
    updatedAt: input.occurredAt,
  };
  store.connectorOutbox[index] = clone(next);
  return clone(next);
}

export function createMemoryConnectorDeliveryAttempt(
  store: MemoryConnectorStore,
  attempt: ConnectorDeliveryAttemptRecord,
): ConnectorDeliveryAttemptRecord {
  const outbox = store.connectorOutbox.find(
    (candidate) =>
      candidate.firmId === attempt.firmId &&
      candidate.id === attempt.outboxId &&
      candidate.connectorId === attempt.connectorId,
  );
  if (!outbox) throw new Error(`Connector outbox ${attempt.outboxId} was not found`);
  store.connectorDeliveryAttempts.push(clone(attempt));
  return clone(attempt);
}

export function leaseMemoryConnectorOutbox(input: {
  store: MemoryConnectorStore;
  firmId: string;
  leaseId: string;
  leasedUntil: string;
  now: string;
  limit?: number;
}): Array<{
  connector: ConnectorRecord;
  outbox: ConnectorOutboxRecord;
  attempt: ConnectorDeliveryAttemptRecord;
}> {
  const limit = input.limit ?? 10;
  const nowMs = Date.parse(input.now);
  const candidates = input.store.connectorOutbox
    .filter((outbox) => {
      if (outbox.firmId !== input.firmId) return false;
      if (outbox.status === "cancelled" || outbox.status === "delivered") return false;
      const connector = input.store.connectors.find(
        (candidate) =>
          candidate.firmId === outbox.firmId &&
          candidate.id === outbox.connectorId &&
          candidate.status === "enabled",
      );
      if (!connector) return false;
      if (outbox.status === "leased") {
        return outbox.leasedUntil ? Date.parse(outbox.leasedUntil) <= nowMs : true;
      }
      if (outbox.status !== "pending" && outbox.status !== "failed") return false;
      return !outbox.nextAttemptAt || Date.parse(outbox.nextAttemptAt) <= nowMs;
    })
    .sort((left, right) => {
      const leftNext = left.nextAttemptAt ?? left.createdAt;
      const rightNext = right.nextAttemptAt ?? right.createdAt;
      return leftNext.localeCompare(rightNext);
    })
    .slice(0, limit);

  return candidates.map((candidate) => {
    const index = input.store.connectorOutbox.findIndex(
      (outbox) => outbox.firmId === candidate.firmId && outbox.id === candidate.id,
    );
    const current = input.store.connectorOutbox[index];
    const attemptNumber = current.attemptCount + 1;
    const outbox: ConnectorOutboxRecord = {
      ...current,
      status: "leased",
      attemptCount: attemptNumber,
      leaseId: input.leaseId,
      leasedUntil: input.leasedUntil,
      lastErrorSummary: undefined,
      updatedAt: input.now,
    };
    input.store.connectorOutbox[index] = outbox;
    const connector = input.store.connectors.find(
      (item) => item.firmId === outbox.firmId && item.id === outbox.connectorId,
    );
    if (!connector) throw new Error(`Connector ${outbox.connectorId} was not found`);
    const attempt: ConnectorDeliveryAttemptRecord = {
      id: crypto.randomUUID(),
      firmId: outbox.firmId,
      connectorId: outbox.connectorId,
      outboxId: outbox.id,
      attemptNumber,
      status: "leased",
      idempotencyKey: outbox.idempotencyKey,
      leaseId: input.leaseId,
      startedAt: input.now,
      metadata: {
        eventType: outbox.eventType,
        resourceType: outbox.resourceType,
        resourceId: outbox.resourceId,
      },
    };
    input.store.connectorDeliveryAttempts.push(clone(attempt));
    return { connector: clone(connector), outbox: clone(outbox), attempt: clone(attempt) };
  });
}

export function recordMemoryConnectorDeliveryResult(input: {
  store: MemoryConnectorStore;
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
}): {
  outbox: ConnectorOutboxRecord;
  attempt: ConnectorDeliveryAttemptRecord;
} {
  const outboxIndex = input.store.connectorOutbox.findIndex(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.id === input.outboxId &&
      candidate.connectorId === input.connectorId &&
      candidate.leaseId === input.leaseId,
  );
  if (outboxIndex < 0) throw new Error(`Connector outbox ${input.outboxId} lease was not found`);
  const outbox = input.store.connectorOutbox[outboxIndex];
  const attemptIndex = input.store.connectorDeliveryAttempts.findIndex(
    (candidate) =>
      candidate.firmId === input.firmId &&
      candidate.id === input.attemptId &&
      candidate.outboxId === input.outboxId &&
      candidate.leaseId === input.leaseId,
  );
  if (attemptIndex < 0) throw new Error(`Connector attempt ${input.attemptId} was not found`);
  const failureSummary = sanitizeConnectorDeliverySummary(input.errorSummary);
  const updatedOutbox: ConnectorOutboxRecord =
    input.status === "delivered"
      ? {
          ...outbox,
          status: "delivered",
          leaseId: undefined,
          leasedUntil: undefined,
          deliveredAt: input.occurredAt,
          nextAttemptAt: undefined,
          lastErrorSummary: undefined,
          updatedAt: input.occurredAt,
        }
      : {
          ...outbox,
          status: input.terminal ? "dead_letter" : "failed",
          leaseId: undefined,
          leasedUntil: undefined,
          nextAttemptAt: input.terminal ? undefined : input.nextAttemptAt,
          deadLetteredAt: input.terminal ? input.occurredAt : outbox.deadLetteredAt,
          lastErrorSummary: failureSummary,
          updatedAt: input.occurredAt,
        };
  const attempt: ConnectorDeliveryAttemptRecord = {
    ...input.store.connectorDeliveryAttempts[attemptIndex],
    status: input.status,
    finishedAt: input.occurredAt,
    errorSummary: failureSummary,
    metadata: {
      ...input.store.connectorDeliveryAttempts[attemptIndex].metadata,
      ...sanitizeConnectorDeliveryMetadata(input.metadata),
      terminal: input.status === "failed" ? Boolean(input.terminal) : true,
    },
  };
  input.store.connectorOutbox[outboxIndex] = updatedOutbox;
  input.store.connectorDeliveryAttempts[attemptIndex] = attempt;
  return { outbox: clone(updatedOutbox), attempt: clone(attempt) };
}

export function listMemoryConnectorDeliveryAttempts(
  store: MemoryConnectorStore,
  firmId: string,
  options: { outboxId?: string; connectorId?: string } = {},
): ConnectorDeliveryAttemptRecord[] {
  return clone(
    store.connectorDeliveryAttempts
      .filter((attempt) => {
        if (attempt.firmId !== firmId) return false;
        if (options.outboxId && attempt.outboxId !== options.outboxId) return false;
        if (options.connectorId && attempt.connectorId !== options.connectorId) return false;
        return true;
      })
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
  );
}

export function createMemoryIntegrationDeveloperApp(
  store: MemoryConnectorStore,
  app: IntegrationDeveloperAppRecord,
): IntegrationDeveloperAppRecord {
  const connector = store.connectors.find(
    (candidate) => candidate.firmId === app.firmId && candidate.id === app.connectorId,
  );
  if (!connector) throw new Error(`Connector ${app.connectorId} was not found`);
  const duplicate = store.integrationDeveloperApps.find(
    (candidate) => candidate.firmId === app.firmId && candidate.clientId === app.clientId,
  );
  if (duplicate) throw new Error(`Integration client ${app.clientId} already exists`);
  store.integrationDeveloperApps.push(clone(app));
  return clone(app);
}

export function updateMemoryIntegrationDeveloperApp(
  store: MemoryConnectorStore,
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
): IntegrationDeveloperAppRecord | undefined {
  const index = store.integrationDeveloperApps.findIndex(
    (app) => app.firmId === firmId && app.id === appId,
  );
  if (index < 0) return undefined;
  const current = store.integrationDeveloperApps[index];
  const next: IntegrationDeveloperAppRecord = {
    ...current,
    ...updates,
    updatedAt: updates.updatedAt,
  };
  store.integrationDeveloperApps[index] = clone(next);
  return clone(next);
}

export function listMemoryIntegrationDeveloperApps(
  store: MemoryConnectorStore,
  firmId: string,
  options: { connectorId?: string; status?: IntegrationDeveloperAppRecord["status"] } = {},
): IntegrationDeveloperAppRecord[] {
  return clone(
    store.integrationDeveloperApps
      .filter((app) => {
        if (app.firmId !== firmId) return false;
        if (options.connectorId && app.connectorId !== options.connectorId) return false;
        if (options.status && app.status !== options.status) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
}

export function getMemoryIntegrationDeveloperApp(
  store: MemoryConnectorStore,
  firmId: string,
  appId: string,
): IntegrationDeveloperAppRecord | undefined {
  return clone(
    store.integrationDeveloperApps.find((app) => app.firmId === firmId && app.id === appId),
  );
}

export function createMemoryIntegrationApiCredential(
  store: MemoryConnectorStore,
  credential: IntegrationApiCredentialRecord,
): IntegrationApiCredentialRecord {
  const app = store.integrationDeveloperApps.find(
    (candidate) => candidate.firmId === credential.firmId && candidate.id === credential.appId,
  );
  if (!app) throw new Error(`Integration app ${credential.appId} was not found`);
  store.integrationApiCredentials.push(clone(credential));
  return clone(credential);
}

export function listMemoryIntegrationApiCredentials(
  store: MemoryConnectorStore,
  firmId: string,
  options: { appId?: string; status?: IntegrationApiCredentialRecord["status"] } = {},
): IntegrationApiCredentialRecord[] {
  return clone(
    store.integrationApiCredentials
      .filter((credential) => {
        if (credential.firmId !== firmId) return false;
        if (options.appId && credential.appId !== options.appId) return false;
        if (options.status && credential.status !== options.status) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
}

export function getMemoryIntegrationApiCredential(
  store: MemoryConnectorStore,
  firmId: string,
  credentialId: string,
): IntegrationApiCredentialRecord | undefined {
  return clone(
    store.integrationApiCredentials.find(
      (credential) => credential.firmId === firmId && credential.id === credentialId,
    ),
  );
}

export function revokeMemoryIntegrationApiCredential(
  store: MemoryConnectorStore,
  input: {
    firmId: string;
    credentialId: string;
    revokedAt: string;
  },
): IntegrationApiCredentialRecord | undefined {
  const index = store.integrationApiCredentials.findIndex(
    (credential) => credential.firmId === input.firmId && credential.id === input.credentialId,
  );
  if (index < 0) return undefined;
  const current = store.integrationApiCredentials[index];
  const next: IntegrationApiCredentialRecord = {
    ...current,
    status: "revoked",
    revokedAt: input.revokedAt,
  };
  store.integrationApiCredentials[index] = clone(next);
  return clone(next);
}

export function createMemoryIntegrationWebhookSubscription(
  store: MemoryConnectorStore,
  subscription: IntegrationWebhookSubscriptionRecord,
): IntegrationWebhookSubscriptionRecord {
  const app = store.integrationDeveloperApps.find(
    (candidate) => candidate.firmId === subscription.firmId && candidate.id === subscription.appId,
  );
  if (!app) throw new Error(`Integration app ${subscription.appId} was not found`);
  if (app.connectorId !== subscription.connectorId) {
    throw new Error(`Connector ${subscription.connectorId} is not linked to integration app`);
  }
  store.integrationWebhookSubscriptions.push(clone(subscription));
  return clone(subscription);
}

export function listMemoryIntegrationWebhookSubscriptions(
  store: MemoryConnectorStore,
  firmId: string,
  options: {
    appId?: string;
    connectorId?: string;
    status?: IntegrationWebhookSubscriptionRecord["status"];
  } = {},
): IntegrationWebhookSubscriptionRecord[] {
  return clone(
    store.integrationWebhookSubscriptions
      .filter((subscription) => {
        if (subscription.firmId !== firmId) return false;
        if (options.appId && subscription.appId !== options.appId) return false;
        if (options.connectorId && subscription.connectorId !== options.connectorId) return false;
        if (options.status && subscription.status !== options.status) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
}

export function createMemoryConnectorRepository(store: MemoryConnectorStore): ConnectorRepository {
  return {
    createConnector: async (connector) => createMemoryConnector(store, connector),
    updateConnector: async (firmId, connectorId, updates) =>
      updateMemoryConnector(store, firmId, connectorId, updates),
    listConnectors: async (firmId, options) => listMemoryConnectors(store, firmId, options),
    getConnector: async (firmId, connectorId) => getMemoryConnector(store, firmId, connectorId),
    createConnectorOutbox: async (input) => createMemoryConnectorOutbox(store, input),
    listConnectorOutbox: async (firmId, options) =>
      listMemoryConnectorOutbox(store, firmId, options),
    getConnectorOutbox: async (firmId, outboxId) =>
      getMemoryConnectorOutbox(store, firmId, outboxId),
    retryConnectorOutbox: async (input) => retryMemoryConnectorOutbox(store, input),
    deadLetterConnectorOutbox: async (input) => deadLetterMemoryConnectorOutbox(store, input),
    createConnectorDeliveryAttempt: async (attempt) =>
      createMemoryConnectorDeliveryAttempt(store, attempt),
    leaseConnectorOutbox: async (input) => leaseMemoryConnectorOutbox({ store, ...input }),
    recordConnectorDeliveryResult: async (input) =>
      recordMemoryConnectorDeliveryResult({ store, ...input }),
    listConnectorDeliveryAttempts: async (firmId, options) =>
      listMemoryConnectorDeliveryAttempts(store, firmId, options),
    createIntegrationDeveloperApp: async (app) => createMemoryIntegrationDeveloperApp(store, app),
    updateIntegrationDeveloperApp: async (firmId, appId, updates) =>
      updateMemoryIntegrationDeveloperApp(store, firmId, appId, updates),
    listIntegrationDeveloperApps: async (firmId, options) =>
      listMemoryIntegrationDeveloperApps(store, firmId, options),
    getIntegrationDeveloperApp: async (firmId, appId) =>
      getMemoryIntegrationDeveloperApp(store, firmId, appId),
    createIntegrationApiCredential: async (credential) =>
      createMemoryIntegrationApiCredential(store, credential),
    listIntegrationApiCredentials: async (firmId, options) =>
      listMemoryIntegrationApiCredentials(store, firmId, options),
    getIntegrationApiCredential: async (firmId, credentialId) =>
      getMemoryIntegrationApiCredential(store, firmId, credentialId),
    revokeIntegrationApiCredential: async (input) =>
      revokeMemoryIntegrationApiCredential(store, input),
    createIntegrationWebhookSubscription: async (subscription) =>
      createMemoryIntegrationWebhookSubscription(store, subscription),
    listIntegrationWebhookSubscriptions: async (firmId, options) =>
      listMemoryIntegrationWebhookSubscriptions(store, firmId, options),
  };
}
