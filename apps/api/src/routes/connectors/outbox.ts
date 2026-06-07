import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { rethrowIdempotencyConflict } from "../idempotency.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertAllowlistedConnectorEvent,
  assertConnectorAccess,
  assertRecoveryConfirmationMatches,
  assertRedactedSummary,
  connectorOutboxAuditMetadata,
  isConnectorOutboxLeaseActive,
  normalizePayloadSummary,
  scheduleConnectorDeliveryJob,
  serializeOutbox,
  summarizeConnectorDeliveryJob,
} from "./shared.js";

const connectorOutboxStatusSchema = z.enum([
  "pending",
  "leased",
  "delivered",
  "failed",
  "dead_letter",
  "cancelled",
]);

const connectorOutboxQuerySchema = z.object({
  connectorId: z.string().min(1).optional(),
  status: connectorOutboxStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const connectorOutboxCreateBodySchema = z
  .object({
    connectorId: z.string().min(1),
    eventType: z.string().min(1).max(160),
    resourceType: z.string().min(1).max(120).optional(),
    resourceId: z.string().min(1).max(160).optional(),
    idempotencyKey: z.string().min(8).max(180),
    payloadSummary: z.record(z.string(), z.unknown()).default({}),
    maxAttempts: z.number().int().min(1).max(10).default(3),
    nextAttemptAt: z.string().datetime().optional(),
  })
  .strict();

const connectorOutboxParamsSchema = z.object({
  outboxId: z.string().min(1),
});

const connectorRetryConfirmationSchema = z
  .object({
    confirmed: z.literal(true),
    action: z.literal("retry"),
    outboxId: z.string().min(1),
    expectedStatus: z.enum(["failed", "dead_letter"]),
  })
  .strict();

const connectorDeadLetterConfirmationSchema = z
  .object({
    confirmed: z.literal(true),
    action: z.literal("dead_letter"),
    outboxId: z.string().min(1),
    expectedStatus: z.enum(["pending", "failed", "leased"]),
  })
  .strict();

const connectorOutboxRetryBodySchema = z
  .object({
    idempotencyKey: z.string().min(8).max(180).optional(),
    confirmation: connectorRetryConfirmationSchema,
  })
  .strict();

const connectorOutboxDeadLetterBodySchema = z
  .object({
    confirmation: connectorDeadLetterConfirmationSchema,
  })
  .strict();

export function registerConnectorOutboxRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository } = dependencies;

  server.get("/api/connectors/outbox", async (request) => {
    const query = parseRequestPart(connectorOutboxQuerySchema, request.query, "query");
    assertConnectorAccess(request.auth, { resource: "connector", action: "read" });
    const outbox = await repository.listConnectorOutbox(request.auth.firmId, query);
    return { outbox: outbox.map(serializeOutbox) };
  });

  server.post("/api/connectors/outbox/:outboxId/retry", async (request, reply) => {
    const params = parseRequestPart(connectorOutboxParamsSchema, request.params, "params");
    const body = parseRequestPart(connectorOutboxRetryBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
    const existing = await repository.getConnectorOutbox(request.auth.firmId, params.outboxId);
    if (!existing) {
      throw new ApiHttpError(
        404,
        "CONNECTOR_OUTBOX_NOT_FOUND",
        "Connector outbox row was not found",
      );
    }
    assertRecoveryConfirmationMatches(body.confirmation, existing);
    if (existing.status !== "failed" && existing.status !== "dead_letter") {
      throw new ApiHttpError(
        409,
        "CONNECTOR_OUTBOX_RETRY_NOT_ALLOWED",
        "Only failed or dead-letter connector outbox rows can be manually retried",
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
        "Connector must be enabled before manual retry",
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
        action: `connectors.manual_retry.${retried.attemptCount}`,
        clientKey: body.idempotencyKey,
        metadata: {
          source: "api.connectors.outbox.retry",
          previousStatus: existing.status,
          manualRecoveryAction: "retry",
          attemptCount: retried.attemptCount,
        },
      });
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "connector_outbox.manual_retry",
      resourceType: "connector_outbox",
      resourceId: retried.id,
      occurredAt: now,
      metadata: connectorOutboxAuditMetadata({
        connector,
        outbox: retried,
        beforeStatus: existing.status,
        expectedStatus: body.confirmation.expectedStatus,
        afterStatus: retried.status,
        deliveryJob,
      }),
    });

    reply.code(202);
    return {
      outbox: serializeOutbox(retried),
      deliveryJob: summarizeConnectorDeliveryJob(deliveryJob),
    };
  });

  server.post("/api/connectors/outbox/:outboxId/dead-letter", async (request) => {
    const params = parseRequestPart(connectorOutboxParamsSchema, request.params, "params");
    const body = parseRequestPart(connectorOutboxDeadLetterBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
    const existing = await repository.getConnectorOutbox(request.auth.firmId, params.outboxId);
    if (!existing) {
      throw new ApiHttpError(
        404,
        "CONNECTOR_OUTBOX_NOT_FOUND",
        "Connector outbox row was not found",
      );
    }
    assertRecoveryConfirmationMatches(body.confirmation, existing);
    if (!["pending", "failed", "leased"].includes(existing.status)) {
      throw new ApiHttpError(
        409,
        "CONNECTOR_OUTBOX_DEAD_LETTER_NOT_ALLOWED",
        "Only pending, failed, or expired leased connector outbox rows can be dead-lettered",
      );
    }
    const now = new Date().toISOString();
    if (isConnectorOutboxLeaseActive(existing, now)) {
      throw new ApiHttpError(
        409,
        "CONNECTOR_OUTBOX_LEASE_ACTIVE",
        "Active connector leases must expire before manual dead-letter",
      );
    }
    const connector = await repository.getConnector(request.auth.firmId, existing.connectorId);
    if (!connector) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    const deadLettered = await repository.deadLetterConnectorOutbox({
      firmId: request.auth.firmId,
      outboxId: existing.id,
      expectedStatus: body.confirmation.expectedStatus,
      occurredAt: now,
      errorSummary: "Connector outbox manually moved to dead letter by owner review",
    });
    if (!deadLettered) {
      throw new ApiHttpError(
        409,
        "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
        "Connector outbox recovery confirmation does not match the current row state",
      );
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "connector_outbox.manual_dead_letter",
      resourceType: "connector_outbox",
      resourceId: deadLettered.id,
      occurredAt: now,
      metadata: connectorOutboxAuditMetadata({
        connector,
        outbox: deadLettered,
        beforeStatus: existing.status,
        expectedStatus: body.confirmation.expectedStatus,
        afterStatus: deadLettered.status,
      }),
    });

    return { outbox: serializeOutbox(deadLettered) };
  });

  server.post("/api/connectors/outbox", async (request, reply) => {
    const body = parseRequestPart(connectorOutboxCreateBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "create" });
    assertRedactedSummary(body.payloadSummary, "payloadSummary");
    assertAllowlistedConnectorEvent(body.eventType);
    const payloadSummary = normalizePayloadSummary(body.payloadSummary);
    const connector = await repository.getConnector(request.auth.firmId, body.connectorId);
    if (!connector) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    const now = new Date().toISOString();
    let queued: Awaited<ReturnType<typeof repository.createConnectorOutbox>>;
    try {
      queued = await repository.createConnectorOutbox({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        connectorId: connector.id,
        eventType: body.eventType,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        idempotencyKey: body.idempotencyKey,
        status: "pending",
        payloadSummary,
        attemptCount: 0,
        maxAttempts: body.maxAttempts,
        nextAttemptAt: body.nextAttemptAt ?? now,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      rethrowIdempotencyConflict(error);
    }
    if (queued.created) {
      await appendRouteAuditEvent(repository, request.auth, {
        action: "connector_outbox.queued",
        resourceType: "connector_outbox",
        resourceId: queued.outbox.id,
        occurredAt: now,
        metadata: {
          connectorId: connector.id,
          connectorType: connector.type,
          eventType: queued.outbox.eventType,
          idempotencyKeyPresent: Boolean(queued.outbox.idempotencyKey),
          resourceType: queued.outbox.resourceType,
          resourceId: queued.outbox.resourceId,
        },
      });
    }

    const deliveryJob = queued.created
      ? await scheduleConnectorDeliveryJob(dependencies, request.auth, queued.outbox, now)
      : undefined;

    reply.code(queued.created ? 201 : 200);
    return {
      outbox: serializeOutbox(queued.outbox),
      created: queued.created,
      deliveryJob: summarizeConnectorDeliveryJob(deliveryJob),
    };
  });
}
