import { z } from "zod";
import type {
  ConnectorOutboxRecord,
  ConnectorRecord,
  IntegrationApiCredentialRecord,
  IntegrationDeveloperAppRecord,
  IntegrationWebhookSubscriptionRecord,
  JobLifecycleRecord,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { connectorOutboxAuditMetadata, serializeSecretReference } from "./shared.js";

export const integrationWebhookDeliverScope = "webhook.deliver";

export const integrationDeveloperAppParamsSchema = z.object({
  appId: z.string().min(1),
});

export function assertCredentialScopesWithinApp(
  app: IntegrationDeveloperAppRecord,
  scopes: string[],
): void {
  const allowed = new Set(app.allowedScopes);
  const rejected = scopes.filter((scope) => !allowed.has(scope));
  if (rejected.length === 0) return;
  throw new ApiHttpError(
    400,
    "INTEGRATION_CREDENTIAL_SCOPE_DENIED",
    `Credential scopes are not registered for this integration app: ${rejected.sort().join(", ")}`,
  );
}

export function assertIntegrationAppHasScope(
  app: IntegrationDeveloperAppRecord,
  scope: string,
): void {
  if (app.allowedScopes.includes(scope)) return;
  throw new ApiHttpError(
    403,
    "INTEGRATION_APP_SCOPE_REQUIRED",
    `Integration developer app must register the ${scope} scope for this action`,
    {
      appId: app.id,
      requiredScope: scope,
    },
  );
}

export function assertIntegrationAppUsable(app: IntegrationDeveloperAppRecord): void {
  if (app.status !== "revoked") return;
  throw new ApiHttpError(
    409,
    "INTEGRATION_APP_REVOKED",
    "Revoked integration app registrations cannot be changed",
  );
}

export function assertIntegrationAppWebhookReplayReady(app: IntegrationDeveloperAppRecord): void {
  assertIntegrationAppUsable(app);
  assertIntegrationAppHasScope(app, integrationWebhookDeliverScope);
  if (app.status === "active") return;
  throw new ApiHttpError(
    409,
    "INTEGRATION_APP_NOT_ACTIVE",
    "Integration developer app must be active before webhook replay",
    {
      appId: app.id,
      status: app.status,
      requiredScope: integrationWebhookDeliverScope,
    },
  );
}

function integrationWebhookReplayDisabledReason(app: IntegrationDeveloperAppRecord) {
  if (!app.allowedScopes.includes(integrationWebhookDeliverScope)) return "scope_not_registered";
  if (app.status !== "active") return "app_not_active";
  return undefined;
}

function serializeIntegrationDeveloperApiEnforcement(app: IntegrationDeveloperAppRecord) {
  const webhookReplayDisabledReason = integrationWebhookReplayDisabledReason(app);
  return {
    scopeMode: "registered_scopes_only",
    credentialScopeMode: "subset_of_registered_scopes",
    registeredScopeCount: app.allowedScopes.length,
    webhookDelivery: {
      requiredScope: integrationWebhookDeliverScope,
      scopeRegistered: app.allowedScopes.includes(integrationWebhookDeliverScope),
      subscriptionRequiredForReplay: true,
      replayRequiresActiveApp: true,
      replayEligible: webhookReplayDisabledReason === undefined,
      disabledReason: webhookReplayDisabledReason,
    },
    rateLimit: {
      mode: app.rateLimit.mode,
      windowSeconds: app.rateLimit.windowSeconds,
      maxRequests: app.rateLimit.maxRequests,
      burstLimit: app.rateLimit.burstLimit,
      enforcement: app.rateLimit.enforcement,
    },
    customActions: {
      status: "reserved",
      count: app.customActionPlaceholders.length,
    },
  };
}

export function serializeIntegrationCredential(credential: IntegrationApiCredentialRecord) {
  return {
    id: credential.id,
    appId: credential.appId,
    label: credential.label,
    scopes: credential.scopes,
    secretReference: serializeSecretReference(credential.secretReference),
    status: credential.status,
    createdAt: credential.createdAt,
    expiresAt: credential.expiresAt,
    lastUsedAt: credential.lastUsedAt,
    revokedAt: credential.revokedAt,
  };
}

export function serializeIntegrationWebhookSubscription(
  subscription: IntegrationWebhookSubscriptionRecord,
) {
  return {
    id: subscription.id,
    appId: subscription.appId,
    connectorId: subscription.connectorId,
    status: subscription.status,
    eventTypes: subscription.eventTypes,
    destinationHost: subscription.destinationHost,
    destinationUrlPresent: Boolean(subscription.destinationUrl),
    signingSecretReference: serializeSecretReference(subscription.signingSecretReference),
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

export function serializeIntegrationApp(input: {
  app: IntegrationDeveloperAppRecord;
  connector?: ConnectorRecord;
  credentials?: IntegrationApiCredentialRecord[];
  webhookSubscriptions?: IntegrationWebhookSubscriptionRecord[];
}) {
  return {
    id: input.app.id,
    connectorId: input.app.connectorId,
    connector: input.connector
      ? {
          id: input.connector.id,
          type: input.connector.type,
          key: input.connector.key,
          status: input.connector.status,
        }
      : undefined,
    clientId: input.app.clientId,
    displayName: input.app.displayName,
    status: input.app.status,
    redirectUris: input.app.redirectUris,
    allowedOrigins: input.app.allowedOrigins,
    allowedScopes: input.app.allowedScopes,
    regionalEndpoint: input.app.regionalEndpoint,
    rateLimit: input.app.rateLimit,
    apiEnforcement: serializeIntegrationDeveloperApiEnforcement(input.app),
    customActionPlaceholders: input.app.customActionPlaceholders,
    credentialCount: input.credentials?.length ?? 0,
    webhookSubscriptionCount: input.webhookSubscriptions?.length ?? 0,
    createdAt: input.app.createdAt,
    updatedAt: input.app.updatedAt,
  };
}

export function serializeConnectorDeliveryAttempt(attempt: {
  id: string;
  outboxId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  finishedAt?: string;
  errorSummary?: string;
  metadata: Record<string, unknown>;
}) {
  const metadata = attempt.metadata;
  return {
    id: attempt.id,
    outboxId: attempt.outboxId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    errorSummary: attempt.errorSummary,
    metadata: {
      destinationHost:
        typeof metadata.destinationHost === "string" ? metadata.destinationHost : undefined,
      httpStatus: typeof metadata.httpStatus === "number" ? metadata.httpStatus : undefined,
      terminal: typeof metadata.terminal === "boolean" ? metadata.terminal : undefined,
    },
  };
}

export function integrationWebhookReplayAuditMetadata(input: {
  app: IntegrationDeveloperAppRecord;
  connector: ConnectorRecord;
  outbox: ConnectorOutboxRecord;
  beforeStatus: ConnectorOutboxRecord["status"];
  expectedStatus: ConnectorOutboxRecord["status"];
  afterStatus: ConnectorOutboxRecord["status"];
  subscription: IntegrationWebhookSubscriptionRecord;
  deliveryJob?: JobLifecycleRecord;
  idempotencyKeyPresent: boolean;
}) {
  return {
    ...connectorOutboxAuditMetadata({
      connector: input.connector,
      outbox: input.outbox,
      beforeStatus: input.beforeStatus,
      expectedStatus: input.expectedStatus,
      afterStatus: input.afterStatus,
      deliveryJob: input.deliveryJob,
    }),
    appId: input.app.id,
    appStatus: input.app.status,
    requiredScope: integrationWebhookDeliverScope,
    webhookDeliverScopeRegistered: input.app.allowedScopes.includes(integrationWebhookDeliverScope),
    rateLimitMode: input.app.rateLimit.mode,
    rateLimitEnforcement: input.app.rateLimit.enforcement,
    webhookSubscriptionMatched: true,
    webhookSubscriptionId: input.subscription.id,
    webhookSubscriptionStatus: input.subscription.status,
    appScopedReplay: true,
    idempotencyKeyPresent: input.idempotencyKeyPresent,
  };
}
