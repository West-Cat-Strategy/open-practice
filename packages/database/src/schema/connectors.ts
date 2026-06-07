import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  ConnectorSecretReference,
  IntegrationDeveloperCustomActionPlaceholder,
  IntegrationDeveloperEndpointPosture,
  IntegrationDeveloperRateLimitPosture,
} from "@open-practice/domain";
import { firms, users } from "./core.js";

export const connectors = pgTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    type: text("type").notNull(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("disabled"),
    secretReference: jsonb("secret_reference").$type<ConnectorSecretReference>(),
    configSummary: jsonb("config_summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmKey: uniqueIndex("connectors_firm_key_idx").on(table.firmId, table.key),
    firmTypeStatus: index("connectors_firm_type_status_idx").on(
      table.firmId,
      table.type,
      table.status,
    ),
    statusValue: check(
      "connectors_status_value",
      sql`${table.status} in ('disabled', 'enabled', 'paused', 'error')`,
    ),
    typeValue: check(
      "connectors_type_value",
      sql`${table.type} in ('calendar', 'document_processing', 'email', 'generic', 'inbound_email')`,
    ),
  }),
);

export const connectorOutbox = pgTable(
  "connector_outbox",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    eventType: text("event_type").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    payloadSummary: jsonb("payload_summary").$type<Record<string, unknown>>().notNull().default({}),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    leaseId: text("lease_id"),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    lastErrorSummary: text("last_error_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmIdempotency: uniqueIndex("connector_outbox_firm_idempotency_idx").on(
      table.firmId,
      table.idempotencyKey,
    ),
    firmStatusNextAttempt: index("connector_outbox_firm_status_next_attempt_idx").on(
      table.firmId,
      table.status,
      table.nextAttemptAt,
    ),
    connectorStatus: index("connector_outbox_connector_status_idx").on(
      table.connectorId,
      table.status,
    ),
    statusValue: check(
      "connector_outbox_status_value",
      sql`${table.status} in ('pending', 'leased', 'delivered', 'failed', 'dead_letter', 'cancelled')`,
    ),
  }),
);

export const connectorDeliveryAttempts = pgTable(
  "connector_delivery_attempts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    outboxId: text("outbox_id")
      .notNull()
      .references(() => connectorOutbox.id),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    leaseId: text("lease_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorSummary: text("error_summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    outboxAttempt: uniqueIndex("connector_delivery_attempts_outbox_attempt_idx").on(
      table.outboxId,
      table.attemptNumber,
    ),
    firmConnectorStarted: index("connector_delivery_attempts_firm_connector_started_idx").on(
      table.firmId,
      table.connectorId,
      table.startedAt,
    ),
    statusValue: check(
      "connector_delivery_attempts_status_value",
      sql`${table.status} in ('leased', 'delivered', 'failed')`,
    ),
  }),
);

export const integrationDeveloperApps = pgTable(
  "integration_developer_apps",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    clientId: text("client_id").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("draft"),
    redirectUris: jsonb("redirect_uris").$type<string[]>().notNull().default([]),
    allowedOrigins: jsonb("allowed_origins").$type<string[]>().notNull().default([]),
    allowedScopes: jsonb("allowed_scopes").$type<string[]>().notNull().default([]),
    regionalEndpoint: jsonb("regional_endpoint")
      .$type<IntegrationDeveloperEndpointPosture>()
      .notNull()
      .default({ region: "ca", posture: "cue_only" }),
    rateLimit: jsonb("rate_limit")
      .$type<IntegrationDeveloperRateLimitPosture>()
      .notNull()
      .default({ mode: "documented", windowSeconds: 60, maxRequests: 60, enforcement: "reserved" }),
    customActionPlaceholders: jsonb("custom_action_placeholders")
      .$type<IntegrationDeveloperCustomActionPlaceholder[]>()
      .notNull()
      .default([]),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmClient: uniqueIndex("integration_developer_apps_firm_client_idx").on(
      table.firmId,
      table.clientId,
    ),
    firmConnectorStatus: index("integration_developer_apps_firm_connector_status_idx").on(
      table.firmId,
      table.connectorId,
      table.status,
    ),
    statusValue: check(
      "integration_developer_apps_status_value",
      sql`${table.status} in ('draft', 'active', 'paused', 'revoked')`,
    ),
  }),
);

export const integrationApiCredentials = pgTable(
  "integration_api_credentials",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    appId: text("app_id")
      .notNull()
      .references(() => integrationDeveloperApps.id),
    label: text("label").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    secretReference: jsonb("secret_reference").$type<ConnectorSecretReference>().notNull(),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    firmAppStatus: index("integration_api_credentials_firm_app_status_idx").on(
      table.firmId,
      table.appId,
      table.status,
    ),
    statusValue: check(
      "integration_api_credentials_status_value",
      sql`${table.status} in ('active', 'revoked')`,
    ),
  }),
);

export const integrationWebhookSubscriptions = pgTable(
  "integration_webhook_subscriptions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    appId: text("app_id")
      .notNull()
      .references(() => integrationDeveloperApps.id),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    status: text("status").notNull().default("paused"),
    eventTypes: jsonb("event_types").$type<string[]>().notNull().default([]),
    destinationUrl: text("destination_url").notNull(),
    destinationHost: text("destination_host").notNull(),
    signingSecretReference: jsonb("signing_secret_reference").$type<ConnectorSecretReference>(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    firmAppStatus: index("integration_webhook_subscriptions_firm_app_status_idx").on(
      table.firmId,
      table.appId,
      table.status,
    ),
    connectorStatus: index("integration_webhook_subscriptions_connector_status_idx").on(
      table.connectorId,
      table.status,
    ),
    statusValue: check(
      "integration_webhook_subscriptions_status_value",
      sql`${table.status} in ('active', 'paused', 'disabled')`,
    ),
  }),
);
