import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { rethrowIdempotencyConflict } from "../idempotency.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertConnectorAccess,
  assertRecoveryConfirmationMatches,
  scheduleConnectorDeliveryJob,
  serializeOutbox,
  summarizeConnectorDeliveryJob,
} from "./shared.js";
import {
  assertIntegrationAppWebhookReplayReady,
  integrationDeveloperAppParamsSchema,
  integrationWebhookDeliverScope,
  integrationWebhookReplayAuditMetadata,
  serializeConnectorDeliveryAttempt,
  serializeIntegrationApp,
  serializeIntegrationWebhookSubscription,
} from "./developer-shared.js";

const integrationDeliveryHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const integrationWebhookReplayConfirmationSchema = z
  .object({
    confirmed: z.literal(true),
    action: z.literal("replay"),
    outboxId: z.string().min(1),
    expectedStatus: z.enum(["failed", "dead_letter"]),
  })
  .strict();

const integrationWebhookReplayBodySchema = z
  .object({
    idempotencyKey: z.string().min(8).max(180).optional(),
    confirmation: integrationWebhookReplayConfirmationSchema,
  })
  .strict();

export function registerConnectorDeveloperRecoveryRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository } = dependencies;

  server.get("/api/connectors/developer/apps/:appId/delivery-history", async (request) => {
    const params = parseRequestPart(integrationDeveloperAppParamsSchema, request.params, "params");
    const query = parseRequestPart(integrationDeliveryHistoryQuerySchema, request.query, "query");
    assertConnectorAccess(request.auth, { resource: "connector", action: "read" });
    const app = await repository.getIntegrationDeveloperApp(request.auth.firmId, params.appId);
    if (!app) {
      throw new ApiHttpError(
        404,
        "INTEGRATION_APP_NOT_FOUND",
        "Integration developer app was not found",
      );
    }
    const [connector, outbox, attempts, subscriptions] = await Promise.all([
      repository.getConnector(request.auth.firmId, app.connectorId),
      repository.listConnectorOutbox(request.auth.firmId, {
        connectorId: app.connectorId,
        limit: query.limit,
      }),
      repository.listConnectorDeliveryAttempts(request.auth.firmId, {
        connectorId: app.connectorId,
      }),
      repository.listIntegrationWebhookSubscriptions(request.auth.firmId, {
        appId: app.id,
      }),
    ]);
    const outboxIds = new Set(outbox.map((record) => record.id));
    return {
      app: serializeIntegrationApp({
        app,
        connector,
        webhookSubscriptions: subscriptions,
      }),
      webhookSubscriptions: subscriptions.map(serializeIntegrationWebhookSubscription),
      deliveries: outbox.map((record) => ({
        outbox: serializeOutbox(record),
        attempts: attempts
          .filter((attempt) => attempt.outboxId === record.id && outboxIds.has(attempt.outboxId))
          .map(serializeConnectorDeliveryAttempt),
      })),
    };
  });

  server.post("/api/connectors/developer/apps/:appId/webhook-replays", async (request, reply) => {
    const params = parseRequestPart(integrationDeveloperAppParamsSchema, request.params, "params");
    const body = parseRequestPart(integrationWebhookReplayBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
    const app = await repository.getIntegrationDeveloperApp(request.auth.firmId, params.appId);
    if (!app) {
      throw new ApiHttpError(
        404,
        "INTEGRATION_APP_NOT_FOUND",
        "Integration developer app was not found",
      );
    }
    assertIntegrationAppWebhookReplayReady(app);
    const existing = await repository.getConnectorOutbox(
      request.auth.firmId,
      body.confirmation.outboxId,
    );
    if (!existing) {
      throw new ApiHttpError(
        404,
        "CONNECTOR_OUTBOX_NOT_FOUND",
        "Connector outbox row was not found",
      );
    }
    if (existing.connectorId !== app.connectorId) {
      throw new ApiHttpError(
        403,
        "INTEGRATION_WEBHOOK_REPLAY_SCOPE_MISMATCH",
        "Connector outbox row is outside this integration app boundary",
      );
    }
    assertRecoveryConfirmationMatches(body.confirmation, existing);
    if (existing.status !== "failed" && existing.status !== "dead_letter") {
      throw new ApiHttpError(
        409,
        "CONNECTOR_OUTBOX_RETRY_NOT_ALLOWED",
        "Only failed or dead-letter connector outbox rows can be replayed",
      );
    }
    const connector = await repository.getConnector(request.auth.firmId, existing.connectorId);
    if (!connector) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    if (connector.status !== "enabled") {
      throw new ApiHttpError(
        409,
        "CONNECTOR_NOT_ENABLED",
        "Connector must be enabled before webhook replay",
      );
    }
    const subscriptions = await repository.listIntegrationWebhookSubscriptions(
      request.auth.firmId,
      {
        appId: app.id,
        connectorId: connector.id,
        status: "active",
      },
    );
    const subscription = subscriptions.find((candidate) =>
      candidate.eventTypes.includes(existing.eventType),
    );
    if (!subscription) {
      throw new ApiHttpError(
        409,
        "INTEGRATION_WEBHOOK_SUBSCRIPTION_REQUIRED",
        "An active matching webhook subscription is required before replay",
        {
          appId: app.id,
          connectorId: connector.id,
          eventType: existing.eventType,
          requiredScope: integrationWebhookDeliverScope,
        },
      );
    }
    if (!dependencies.connectorJobQueue) {
      throw new ApiHttpError(
        503,
        "CONNECTOR_QUEUE_NOT_CONFIGURED",
        "Connector queue is not configured",
      );
    }

    const now = new Date().toISOString();
    const retried = await repository.retryConnectorOutbox({
      firmId: request.auth.firmId,
      outboxId: existing.id,
      expectedStatus: body.confirmation.expectedStatus,
      occurredAt: now,
    });
    if (!retried) {
      throw new ApiHttpError(
        409,
        "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
        "Connector outbox recovery confirmation does not match the current row state",
      );
    }
    let deliveryJob: Awaited<ReturnType<typeof scheduleConnectorDeliveryJob>>;
    try {
      deliveryJob = await scheduleConnectorDeliveryJob(dependencies, request.auth, retried, now, {
        action: `connectors.developer_webhook_replay.${app.id}.${retried.attemptCount}`,
        clientKey: body.idempotencyKey,
        metadata: {
          source: "api.connectors.developer.webhook_replay",
          previousStatus: existing.status,
          manualRecoveryAction: "webhook_replay",
          integrationAppId: app.id,
          webhookSubscriptionId: subscription.id,
          webhookDeliverScopeRegistered: true,
          rateLimitEnforcement: app.rateLimit.enforcement,
          attemptCount: retried.attemptCount,
        },
      });
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "integration_developer_app.webhook_replay_requested",
      resourceType: "connector_outbox",
      resourceId: retried.id,
      occurredAt: now,
      metadata: integrationWebhookReplayAuditMetadata({
        app,
        connector,
        outbox: retried,
        beforeStatus: existing.status,
        expectedStatus: body.confirmation.expectedStatus,
        afterStatus: retried.status,
        subscription,
        deliveryJob,
        idempotencyKeyPresent: Boolean(body.idempotencyKey),
      }),
    });

    reply.code(202);
    return {
      app: serializeIntegrationApp({
        app,
        connector,
        webhookSubscriptions: subscriptions,
      }),
      replay: {
        requiredScope: integrationWebhookDeliverScope,
        scopeRegistered: true,
        rateLimitEnforcement: app.rateLimit.enforcement,
        webhookSubscriptionMatched: true,
        webhookSubscriptionId: subscription.id,
      },
      outbox: serializeOutbox(retried),
      deliveryJob: summarizeConnectorDeliveryJob(deliveryJob),
    };
  });
}
