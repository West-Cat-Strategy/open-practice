import type {
  ConnectorDeliveryAttemptRecord,
  ConnectorOutboxRecord,
  ConnectorRecord,
  IntegrationApiCredentialRecord,
  IntegrationDeveloperAppRecord,
  IntegrationWebhookSubscriptionRecord,
} from "@open-practice/domain";
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type { OpenPracticeDatabase } from "../../runtime.js";
import * as schema from "../../schema.js";
import type { ConnectorRepository } from "../connector-contracts.js";
import {
  IdempotencyKeyConflictError,
  canonicalizeForIdempotency,
  isPostgresUniqueViolation,
  sanitizeConnectorDeliveryMetadata,
  sanitizeConnectorDeliverySummary,
} from "../contracts.js";
import {
  connectorDeliveryAttemptInsert,
  connectorInsert,
  connectorOutboxInsert,
  integrationApiCredentialInsert,
  integrationDeveloperAppInsert,
  integrationWebhookSubscriptionInsert,
  mapConnectorDeliveryAttemptRow,
  mapConnectorOutboxRow,
  mapConnectorRow,
  mapIntegrationApiCredentialRow,
  mapIntegrationDeveloperAppRow,
  mapIntegrationWebhookSubscriptionRow,
} from "../drizzle-mappers.js";

export async function createDrizzleConnector(
  db: OpenPracticeDatabase,
  connector: ConnectorRecord,
): Promise<ConnectorRecord> {
  const [row] = await db.insert(schema.connectors).values(connectorInsert(connector)).returning();
  return mapConnectorRow(row);
}

export async function updateDrizzleConnector(
  db: OpenPracticeDatabase,
  firmId: string,
  connectorId: string,
  updates: Partial<
    Pick<ConnectorRecord, "displayName" | "status" | "secretReference" | "configSummary">
  > & { updatedAt: string },
): Promise<ConnectorRecord | undefined> {
  const set: Partial<typeof schema.connectors.$inferInsert> = {
    updatedAt: new Date(updates.updatedAt),
  };
  if (updates.displayName !== undefined) set.displayName = updates.displayName;
  if (updates.status !== undefined) set.status = updates.status;
  if ("secretReference" in updates) set.secretReference = updates.secretReference ?? null;
  if (updates.configSummary !== undefined) set.configSummary = updates.configSummary;
  const [row] = await db
    .update(schema.connectors)
    .set(set)
    .where(and(eq(schema.connectors.firmId, firmId), eq(schema.connectors.id, connectorId)))
    .returning();
  return row ? mapConnectorRow(row) : undefined;
}

export async function listDrizzleConnectors(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { type?: ConnectorRecord["type"]; status?: ConnectorRecord["status"] } = {},
): Promise<ConnectorRecord[]> {
  const conditions = [eq(schema.connectors.firmId, firmId)];
  if (options.type) conditions.push(eq(schema.connectors.type, options.type));
  if (options.status) conditions.push(eq(schema.connectors.status, options.status));
  const rows = await db
    .select()
    .from(schema.connectors)
    .where(and(...conditions))
    .orderBy(asc(schema.connectors.key));
  return rows.map(mapConnectorRow);
}

export async function getDrizzleConnector(
  db: OpenPracticeDatabase,
  firmId: string,
  connectorId: string,
): Promise<ConnectorRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.connectors)
    .where(and(eq(schema.connectors.firmId, firmId), eq(schema.connectors.id, connectorId)));
  return row ? mapConnectorRow(row) : undefined;
}

export async function createDrizzleConnectorOutbox(
  db: OpenPracticeDatabase,
  input: ConnectorOutboxRecord,
): Promise<{ outbox: ConnectorOutboxRecord; created: boolean }> {
  const connector = await getDrizzleConnector(db, input.firmId, input.connectorId);
  if (!connector) throw new Error(`Connector ${input.connectorId} was not found`);
  try {
    const [row] = await db
      .insert(schema.connectorOutbox)
      .values(connectorOutboxInsert(input))
      .returning();
    return { outbox: mapConnectorOutboxRow(row), created: true };
  } catch (error) {
    if (!isPostgresUniqueViolation(error, "connector_outbox_firm_idempotency_idx")) {
      throw error;
    }
    const [existingRow] = await db
      .select()
      .from(schema.connectorOutbox)
      .where(
        and(
          eq(schema.connectorOutbox.firmId, input.firmId),
          eq(schema.connectorOutbox.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (!existingRow) throw error;
    const existing = mapConnectorOutboxRow(existingRow);
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
    return { outbox: existing, created: false };
  }
}

export async function listDrizzleConnectorOutbox(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    connectorId?: string;
    status?: ConnectorOutboxRecord["status"];
    limit?: number;
  } = {},
): Promise<ConnectorOutboxRecord[]> {
  const conditions = [eq(schema.connectorOutbox.firmId, firmId)];
  if (options.connectorId)
    conditions.push(eq(schema.connectorOutbox.connectorId, options.connectorId));
  if (options.status) conditions.push(eq(schema.connectorOutbox.status, options.status));
  const rows = await db
    .select()
    .from(schema.connectorOutbox)
    .where(and(...conditions))
    .orderBy(desc(schema.connectorOutbox.createdAt))
    .limit(options.limit ?? 50);
  return rows.map(mapConnectorOutboxRow);
}

export async function getDrizzleConnectorOutbox(
  db: OpenPracticeDatabase,
  firmId: string,
  outboxId: string,
): Promise<ConnectorOutboxRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.connectorOutbox)
    .where(and(eq(schema.connectorOutbox.firmId, firmId), eq(schema.connectorOutbox.id, outboxId)));
  return row ? mapConnectorOutboxRow(row) : undefined;
}

export async function retryDrizzleConnectorOutbox(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "failed" | "dead_letter">;
    occurredAt: string;
  },
): Promise<ConnectorOutboxRecord | undefined> {
  const current = await getDrizzleConnectorOutbox(db, input.firmId, input.outboxId);
  if (!current || current.status !== input.expectedStatus) return undefined;
  const occurredAt = new Date(input.occurredAt);
  const [row] = await db
    .update(schema.connectorOutbox)
    .set({
      status: "pending",
      maxAttempts:
        current.attemptCount >= current.maxAttempts
          ? current.attemptCount + 1
          : current.maxAttempts,
      nextAttemptAt: occurredAt,
      leaseId: null,
      leasedUntil: null,
      deadLetteredAt: null,
      lastErrorSummary: null,
      updatedAt: occurredAt,
    })
    .where(
      and(
        eq(schema.connectorOutbox.firmId, input.firmId),
        eq(schema.connectorOutbox.id, input.outboxId),
        eq(schema.connectorOutbox.status, input.expectedStatus),
      ),
    )
    .returning();
  return row ? mapConnectorOutboxRow(row) : undefined;
}

export async function deadLetterDrizzleConnectorOutbox(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    outboxId: string;
    expectedStatus: Extract<ConnectorOutboxRecord["status"], "pending" | "failed" | "leased">;
    occurredAt: string;
    errorSummary: string;
  },
): Promise<ConnectorOutboxRecord | undefined> {
  const occurredAt = new Date(input.occurredAt);
  const [row] = await db
    .update(schema.connectorOutbox)
    .set({
      status: "dead_letter",
      leaseId: null,
      leasedUntil: null,
      nextAttemptAt: null,
      deadLetteredAt: occurredAt,
      lastErrorSummary: sanitizeConnectorDeliverySummary(input.errorSummary) ?? null,
      updatedAt: occurredAt,
    })
    .where(
      and(
        eq(schema.connectorOutbox.firmId, input.firmId),
        eq(schema.connectorOutbox.id, input.outboxId),
        eq(schema.connectorOutbox.status, input.expectedStatus),
      ),
    )
    .returning();
  return row ? mapConnectorOutboxRow(row) : undefined;
}

export async function createDrizzleConnectorDeliveryAttempt(
  db: OpenPracticeDatabase,
  attempt: ConnectorDeliveryAttemptRecord,
): Promise<ConnectorDeliveryAttemptRecord> {
  const [outbox] = await db
    .select()
    .from(schema.connectorOutbox)
    .where(
      and(
        eq(schema.connectorOutbox.firmId, attempt.firmId),
        eq(schema.connectorOutbox.id, attempt.outboxId),
        eq(schema.connectorOutbox.connectorId, attempt.connectorId),
      ),
    );
  if (!outbox) throw new Error(`Connector outbox ${attempt.outboxId} was not found`);
  const [row] = await db
    .insert(schema.connectorDeliveryAttempts)
    .values(connectorDeliveryAttemptInsert(attempt))
    .returning();
  return mapConnectorDeliveryAttemptRow(row);
}

export async function leaseDrizzleConnectorOutbox(input: {
  db: OpenPracticeDatabase;
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
> {
  const now = new Date(input.now);
  return input.db.transaction(async (tx) => {
    const rows = await tx
      .select({
        outbox: schema.connectorOutbox,
        connector: schema.connectors,
      })
      .from(schema.connectorOutbox)
      .innerJoin(
        schema.connectors,
        and(
          eq(schema.connectors.firmId, schema.connectorOutbox.firmId),
          eq(schema.connectors.id, schema.connectorOutbox.connectorId),
        ),
      )
      .where(
        and(
          eq(schema.connectorOutbox.firmId, input.firmId),
          eq(schema.connectors.status, "enabled"),
          or(
            and(
              inArray(schema.connectorOutbox.status, ["pending", "failed"]),
              or(
                isNull(schema.connectorOutbox.nextAttemptAt),
                lte(schema.connectorOutbox.nextAttemptAt, now),
              ),
            ),
            and(
              eq(schema.connectorOutbox.status, "leased"),
              or(
                isNull(schema.connectorOutbox.leasedUntil),
                lte(schema.connectorOutbox.leasedUntil, now),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(schema.connectorOutbox.nextAttemptAt), asc(schema.connectorOutbox.createdAt))
      .limit(input.limit ?? 10);

    const leased: Array<{
      connector: ConnectorRecord;
      outbox: ConnectorOutboxRecord;
      attempt: ConnectorDeliveryAttemptRecord;
    }> = [];
    for (const row of rows) {
      const attemptNumber = row.outbox.attemptCount + 1;
      const [updatedOutbox] = await tx
        .update(schema.connectorOutbox)
        .set({
          status: "leased",
          attemptCount: attemptNumber,
          leaseId: input.leaseId,
          leasedUntil: new Date(input.leasedUntil),
          lastErrorSummary: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.connectorOutbox.firmId, input.firmId),
            eq(schema.connectorOutbox.id, row.outbox.id),
            or(
              inArray(schema.connectorOutbox.status, ["pending", "failed"]),
              and(
                eq(schema.connectorOutbox.status, "leased"),
                or(
                  isNull(schema.connectorOutbox.leasedUntil),
                  lte(schema.connectorOutbox.leasedUntil, now),
                ),
              ),
            ),
          ),
        )
        .returning();
      if (!updatedOutbox) continue;
      const attempt: ConnectorDeliveryAttemptRecord = {
        id: crypto.randomUUID(),
        firmId: updatedOutbox.firmId,
        connectorId: updatedOutbox.connectorId,
        outboxId: updatedOutbox.id,
        attemptNumber,
        status: "leased",
        idempotencyKey: updatedOutbox.idempotencyKey,
        leaseId: input.leaseId,
        startedAt: input.now,
        metadata: {
          eventType: updatedOutbox.eventType,
          resourceType: updatedOutbox.resourceType ?? undefined,
          resourceId: updatedOutbox.resourceId ?? undefined,
        },
      };
      const [attemptRow] = await tx
        .insert(schema.connectorDeliveryAttempts)
        .values(connectorDeliveryAttemptInsert(attempt))
        .returning();
      leased.push({
        connector: mapConnectorRow(row.connector),
        outbox: mapConnectorOutboxRow(updatedOutbox),
        attempt: mapConnectorDeliveryAttemptRow(attemptRow),
      });
    }
    return leased;
  });
}

export async function recordDrizzleConnectorDeliveryResult(input: {
  db: OpenPracticeDatabase;
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
}> {
  const occurredAt = new Date(input.occurredAt);
  const failureSummary = sanitizeConnectorDeliverySummary(input.errorSummary);
  return input.db.transaction(async (tx) => {
    const [outboxRow] = await tx
      .update(schema.connectorOutbox)
      .set(
        input.status === "delivered"
          ? {
              status: "delivered",
              leaseId: null,
              leasedUntil: null,
              deliveredAt: occurredAt,
              nextAttemptAt: null,
              lastErrorSummary: null,
              updatedAt: occurredAt,
            }
          : {
              status: input.terminal ? "dead_letter" : "failed",
              leaseId: null,
              leasedUntil: null,
              nextAttemptAt:
                input.terminal || !input.nextAttemptAt ? null : new Date(input.nextAttemptAt),
              deadLetteredAt: input.terminal ? occurredAt : null,
              lastErrorSummary: failureSummary ?? null,
              updatedAt: occurredAt,
            },
      )
      .where(
        and(
          eq(schema.connectorOutbox.firmId, input.firmId),
          eq(schema.connectorOutbox.connectorId, input.connectorId),
          eq(schema.connectorOutbox.id, input.outboxId),
          eq(schema.connectorOutbox.leaseId, input.leaseId),
        ),
      )
      .returning();
    if (!outboxRow) throw new Error(`Connector outbox ${input.outboxId} lease was not found`);

    const [existingAttempt] = await tx
      .select()
      .from(schema.connectorDeliveryAttempts)
      .where(
        and(
          eq(schema.connectorDeliveryAttempts.firmId, input.firmId),
          eq(schema.connectorDeliveryAttempts.id, input.attemptId),
          eq(schema.connectorDeliveryAttempts.outboxId, input.outboxId),
          eq(schema.connectorDeliveryAttempts.leaseId, input.leaseId),
        ),
      );
    if (!existingAttempt) throw new Error(`Connector attempt ${input.attemptId} was not found`);

    const [attemptRow] = await tx
      .update(schema.connectorDeliveryAttempts)
      .set({
        status: input.status,
        finishedAt: occurredAt,
        errorSummary: failureSummary ?? null,
        metadata: {
          ...existingAttempt.metadata,
          ...sanitizeConnectorDeliveryMetadata(input.metadata),
          terminal: input.status === "failed" ? Boolean(input.terminal) : true,
        },
      })
      .where(eq(schema.connectorDeliveryAttempts.id, input.attemptId))
      .returning();
    return {
      outbox: mapConnectorOutboxRow(outboxRow),
      attempt: mapConnectorDeliveryAttemptRow(attemptRow),
    };
  });
}

export async function listDrizzleConnectorDeliveryAttempts(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { outboxId?: string; connectorId?: string } = {},
): Promise<ConnectorDeliveryAttemptRecord[]> {
  const conditions = [eq(schema.connectorDeliveryAttempts.firmId, firmId)];
  if (options.outboxId)
    conditions.push(eq(schema.connectorDeliveryAttempts.outboxId, options.outboxId));
  if (options.connectorId) {
    conditions.push(eq(schema.connectorDeliveryAttempts.connectorId, options.connectorId));
  }
  const rows = await db
    .select()
    .from(schema.connectorDeliveryAttempts)
    .where(and(...conditions))
    .orderBy(desc(schema.connectorDeliveryAttempts.startedAt));
  return rows.map(mapConnectorDeliveryAttemptRow);
}

export async function createDrizzleIntegrationDeveloperApp(
  db: OpenPracticeDatabase,
  app: IntegrationDeveloperAppRecord,
): Promise<IntegrationDeveloperAppRecord> {
  const connector = await getDrizzleConnector(db, app.firmId, app.connectorId);
  if (!connector) throw new Error(`Connector ${app.connectorId} was not found`);
  const [row] = await db
    .insert(schema.integrationDeveloperApps)
    .values(integrationDeveloperAppInsert(app))
    .returning();
  return mapIntegrationDeveloperAppRow(row);
}

export async function updateDrizzleIntegrationDeveloperApp(
  db: OpenPracticeDatabase,
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
): Promise<IntegrationDeveloperAppRecord | undefined> {
  const set: Partial<typeof schema.integrationDeveloperApps.$inferInsert> = {
    updatedAt: new Date(updates.updatedAt),
  };
  if (updates.displayName !== undefined) set.displayName = updates.displayName;
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.redirectUris !== undefined) set.redirectUris = updates.redirectUris;
  if (updates.allowedOrigins !== undefined) set.allowedOrigins = updates.allowedOrigins;
  if (updates.allowedScopes !== undefined) set.allowedScopes = updates.allowedScopes;
  if (updates.regionalEndpoint !== undefined) set.regionalEndpoint = updates.regionalEndpoint;
  if (updates.rateLimit !== undefined) set.rateLimit = updates.rateLimit;
  if (updates.customActionPlaceholders !== undefined) {
    set.customActionPlaceholders = updates.customActionPlaceholders;
  }
  const [row] = await db
    .update(schema.integrationDeveloperApps)
    .set(set)
    .where(
      and(
        eq(schema.integrationDeveloperApps.firmId, firmId),
        eq(schema.integrationDeveloperApps.id, appId),
      ),
    )
    .returning();
  return row ? mapIntegrationDeveloperAppRow(row) : undefined;
}

export async function listDrizzleIntegrationDeveloperApps(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { connectorId?: string; status?: IntegrationDeveloperAppRecord["status"] } = {},
): Promise<IntegrationDeveloperAppRecord[]> {
  const conditions = [eq(schema.integrationDeveloperApps.firmId, firmId)];
  if (options.connectorId) {
    conditions.push(eq(schema.integrationDeveloperApps.connectorId, options.connectorId));
  }
  if (options.status) conditions.push(eq(schema.integrationDeveloperApps.status, options.status));
  const rows = await db
    .select()
    .from(schema.integrationDeveloperApps)
    .where(and(...conditions))
    .orderBy(desc(schema.integrationDeveloperApps.createdAt));
  return rows.map(mapIntegrationDeveloperAppRow);
}

export async function getDrizzleIntegrationDeveloperApp(
  db: OpenPracticeDatabase,
  firmId: string,
  appId: string,
): Promise<IntegrationDeveloperAppRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.integrationDeveloperApps)
    .where(
      and(
        eq(schema.integrationDeveloperApps.firmId, firmId),
        eq(schema.integrationDeveloperApps.id, appId),
      ),
    );
  return row ? mapIntegrationDeveloperAppRow(row) : undefined;
}

export async function createDrizzleIntegrationApiCredential(
  db: OpenPracticeDatabase,
  credential: IntegrationApiCredentialRecord,
): Promise<IntegrationApiCredentialRecord> {
  const app = await getDrizzleIntegrationDeveloperApp(db, credential.firmId, credential.appId);
  if (!app) throw new Error(`Integration app ${credential.appId} was not found`);
  const [row] = await db
    .insert(schema.integrationApiCredentials)
    .values(integrationApiCredentialInsert(credential))
    .returning();
  return mapIntegrationApiCredentialRow(row);
}

export async function listDrizzleIntegrationApiCredentials(
  db: OpenPracticeDatabase,
  firmId: string,
  options: { appId?: string; status?: IntegrationApiCredentialRecord["status"] } = {},
): Promise<IntegrationApiCredentialRecord[]> {
  const conditions = [eq(schema.integrationApiCredentials.firmId, firmId)];
  if (options.appId) conditions.push(eq(schema.integrationApiCredentials.appId, options.appId));
  if (options.status) {
    conditions.push(eq(schema.integrationApiCredentials.status, options.status));
  }
  const rows = await db
    .select()
    .from(schema.integrationApiCredentials)
    .where(and(...conditions))
    .orderBy(desc(schema.integrationApiCredentials.createdAt));
  return rows.map(mapIntegrationApiCredentialRow);
}

export async function getDrizzleIntegrationApiCredential(
  db: OpenPracticeDatabase,
  firmId: string,
  credentialId: string,
): Promise<IntegrationApiCredentialRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.integrationApiCredentials)
    .where(
      and(
        eq(schema.integrationApiCredentials.firmId, firmId),
        eq(schema.integrationApiCredentials.id, credentialId),
      ),
    );
  return row ? mapIntegrationApiCredentialRow(row) : undefined;
}

export async function revokeDrizzleIntegrationApiCredential(
  db: OpenPracticeDatabase,
  input: {
    firmId: string;
    credentialId: string;
    revokedAt: string;
  },
): Promise<IntegrationApiCredentialRecord | undefined> {
  const [row] = await db
    .update(schema.integrationApiCredentials)
    .set({
      status: "revoked",
      revokedAt: new Date(input.revokedAt),
    })
    .where(
      and(
        eq(schema.integrationApiCredentials.firmId, input.firmId),
        eq(schema.integrationApiCredentials.id, input.credentialId),
      ),
    )
    .returning();
  return row ? mapIntegrationApiCredentialRow(row) : undefined;
}

export async function createDrizzleIntegrationWebhookSubscription(
  db: OpenPracticeDatabase,
  subscription: IntegrationWebhookSubscriptionRecord,
): Promise<IntegrationWebhookSubscriptionRecord> {
  const app = await getDrizzleIntegrationDeveloperApp(db, subscription.firmId, subscription.appId);
  if (!app) throw new Error(`Integration app ${subscription.appId} was not found`);
  if (app.connectorId !== subscription.connectorId) {
    throw new Error(`Connector ${subscription.connectorId} is not linked to integration app`);
  }
  const [row] = await db
    .insert(schema.integrationWebhookSubscriptions)
    .values(integrationWebhookSubscriptionInsert(subscription))
    .returning();
  return mapIntegrationWebhookSubscriptionRow(row);
}

export async function listDrizzleIntegrationWebhookSubscriptions(
  db: OpenPracticeDatabase,
  firmId: string,
  options: {
    appId?: string;
    connectorId?: string;
    status?: IntegrationWebhookSubscriptionRecord["status"];
  } = {},
): Promise<IntegrationWebhookSubscriptionRecord[]> {
  const conditions = [eq(schema.integrationWebhookSubscriptions.firmId, firmId)];
  if (options.appId)
    conditions.push(eq(schema.integrationWebhookSubscriptions.appId, options.appId));
  if (options.connectorId) {
    conditions.push(eq(schema.integrationWebhookSubscriptions.connectorId, options.connectorId));
  }
  if (options.status) {
    conditions.push(eq(schema.integrationWebhookSubscriptions.status, options.status));
  }
  const rows = await db
    .select()
    .from(schema.integrationWebhookSubscriptions)
    .where(and(...conditions))
    .orderBy(desc(schema.integrationWebhookSubscriptions.createdAt));
  return rows.map(mapIntegrationWebhookSubscriptionRow);
}

export function createDrizzleConnectorRepository(db: OpenPracticeDatabase): ConnectorRepository {
  return {
    createConnector: (connector) => createDrizzleConnector(db, connector),
    updateConnector: (firmId, connectorId, updates) =>
      updateDrizzleConnector(db, firmId, connectorId, updates),
    listConnectors: (firmId, options) => listDrizzleConnectors(db, firmId, options),
    getConnector: (firmId, connectorId) => getDrizzleConnector(db, firmId, connectorId),
    createConnectorOutbox: (input) => createDrizzleConnectorOutbox(db, input),
    listConnectorOutbox: (firmId, options) => listDrizzleConnectorOutbox(db, firmId, options),
    getConnectorOutbox: (firmId, outboxId) => getDrizzleConnectorOutbox(db, firmId, outboxId),
    retryConnectorOutbox: (input) => retryDrizzleConnectorOutbox(db, input),
    deadLetterConnectorOutbox: (input) => deadLetterDrizzleConnectorOutbox(db, input),
    createConnectorDeliveryAttempt: (attempt) => createDrizzleConnectorDeliveryAttempt(db, attempt),
    leaseConnectorOutbox: (input) => leaseDrizzleConnectorOutbox({ db, ...input }),
    recordConnectorDeliveryResult: (input) =>
      recordDrizzleConnectorDeliveryResult({ db, ...input }),
    listConnectorDeliveryAttempts: (firmId, options) =>
      listDrizzleConnectorDeliveryAttempts(db, firmId, options),
    createIntegrationDeveloperApp: (app) => createDrizzleIntegrationDeveloperApp(db, app),
    updateIntegrationDeveloperApp: (firmId, appId, updates) =>
      updateDrizzleIntegrationDeveloperApp(db, firmId, appId, updates),
    listIntegrationDeveloperApps: (firmId, options) =>
      listDrizzleIntegrationDeveloperApps(db, firmId, options),
    getIntegrationDeveloperApp: (firmId, appId) =>
      getDrizzleIntegrationDeveloperApp(db, firmId, appId),
    createIntegrationApiCredential: (credential) =>
      createDrizzleIntegrationApiCredential(db, credential),
    listIntegrationApiCredentials: (firmId, options) =>
      listDrizzleIntegrationApiCredentials(db, firmId, options),
    getIntegrationApiCredential: (firmId, credentialId) =>
      getDrizzleIntegrationApiCredential(db, firmId, credentialId),
    revokeIntegrationApiCredential: (input) => revokeDrizzleIntegrationApiCredential(db, input),
    createIntegrationWebhookSubscription: (subscription) =>
      createDrizzleIntegrationWebhookSubscription(db, subscription),
    listIntegrationWebhookSubscriptions: (firmId, options) =>
      listDrizzleIntegrationWebhookSubscriptions(db, firmId, options),
  };
}
