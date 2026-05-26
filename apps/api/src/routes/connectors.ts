import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  ConnectorOutboxRecord,
  ConnectorRecord,
  ConnectorSecretReference,
  JobLifecycleRecord,
} from "@open-practice/domain";
import { outboundWebhookEventAllowlist } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import {
  buildIdempotencyKey,
  idempotencyMetadata,
  rethrowIdempotencyConflict,
} from "./idempotency.js";
import { enqueueFailureError, markJobEnqueueFailed } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const connectorTypeSchema = z.enum([
  "calendar",
  "document_processing",
  "email",
  "generic",
  "inbound_email",
]);
const connectorStatusSchema = z.enum(["disabled", "enabled", "paused", "error"]);
const connectorOutboxStatusSchema = z.enum([
  "pending",
  "leased",
  "delivered",
  "failed",
  "dead_letter",
  "cancelled",
]);

const secretReferenceSchema = z
  .object({
    id: z.string().min(1).max(160),
    label: z.string().min(1).max(160).optional(),
    version: z.string().min(1).max(80).optional(),
    lastRotatedAt: z.string().datetime().optional(),
  })
  .strict();

const maskedSecretReferenceId = "__open_practice_connector_secret_unchanged__";
const CONNECTOR_DELIVERY_JOB_NAME = "deliver_connectors";
const CONNECTOR_JOB_MAX_ATTEMPTS = 3;

const maskedSecretReferenceSchema = secretReferenceSchema
  .extend({
    id: z.literal(maskedSecretReferenceId),
    redacted: z.literal(true),
  })
  .strict();

const connectorCreateBodySchema = z
  .object({
    type: connectorTypeSchema,
    key: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    displayName: z.string().min(1).max(160),
    status: connectorStatusSchema.default("disabled"),
    secretReference: secretReferenceSchema.optional(),
    configSummary: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const connectorPatchBodySchema = z
  .object({
    displayName: z.string().min(1).max(160).optional(),
    status: connectorStatusSchema.optional(),
    secretReference: z
      .union([secretReferenceSchema, maskedSecretReferenceSchema, z.null()])
      .optional(),
    configSummary: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one connector field is required",
  });

const connectorListQuerySchema = z.object({
  type: connectorTypeSchema.optional(),
  status: connectorStatusSchema.optional(),
});

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

const connectorParamsSchema = z.object({
  connectorId: z.string().min(1),
});

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

const sensitiveKeyPattern =
  /(api[_-]?key|authorization|bearer|credential|password|private[_-]?key|secret|token)/i;
const sensitiveValuePattern =
  /(bearer\s+[a-z0-9._~+/=-]+|secret:\/\/|token=|api[_-]?key|credential|password|private[_-]?key|storage[_-]?key|matters\/|generated\/)/i;

function assertConnectorAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function containsSensitiveConfigKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSensitiveConfigKey);
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => sensitiveKeyPattern.test(key) || containsSensitiveConfigKey(child),
  );
}

function containsSensitiveSummaryValue(value: unknown): boolean {
  if (typeof value === "string") return sensitiveValuePattern.test(value);
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSensitiveSummaryValue);
  return Object.values(value as Record<string, unknown>).some(containsSensitiveSummaryValue);
}

function assertRedactedSummary(summary: Record<string, unknown>, field: string): void {
  if (!containsSensitiveConfigKey(summary) && !containsSensitiveSummaryValue(summary)) return;
  throw new ApiHttpError(
    400,
    "CONNECTOR_SECRET_SUMMARY_REJECTED",
    `${field} must contain redacted operational metadata only`,
  );
}

const allowedConnectorEvents = new Set<string>(outboundWebhookEventAllowlist);
const allowedPayloadSummaryKeys = new Set([
  "actionCount",
  "attemptCount",
  "checksumStatus",
  "completedAt",
  "documentId",
  "emailId",
  "eventCount",
  "fieldCount",
  "invoiceId",
  "itemCount",
  "linkId",
  "matterId",
  "recipientCount",
  "resourceId",
  "resourceType",
  "signatureRequestId",
  "status",
  "templateId",
]);

function assertAllowlistedConnectorEvent(eventType: string): void {
  if (allowedConnectorEvents.has(eventType)) return;
  throw new ApiHttpError(
    400,
    "CONNECTOR_EVENT_NOT_ALLOWLISTED",
    "Connector outbox event type is not allowlisted for delivery",
  );
}

function safePayloadSummaryValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") return value.length <= 160 ? value : undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function normalizePayloadSummary(summary: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const rejectedKeys: string[] = [];
  for (const [key, value] of Object.entries(summary)) {
    if (!allowedPayloadSummaryKeys.has(key)) {
      rejectedKeys.push(key);
      continue;
    }
    const safeValue = safePayloadSummaryValue(value);
    if (safeValue === undefined) {
      rejectedKeys.push(key);
      continue;
    }
    normalized[key] = safeValue;
  }
  if (rejectedKeys.length > 0) {
    throw new ApiHttpError(
      400,
      "CONNECTOR_PAYLOAD_SUMMARY_REJECTED",
      `payloadSummary contains unsupported delivery fields: ${rejectedKeys.sort().join(", ")}`,
    );
  }
  return normalized;
}

function serializeSecretReference(reference: ConnectorSecretReference | undefined) {
  if (!reference) return undefined;
  return {
    id: maskedSecretReferenceId,
    label: reference.label,
    version: reference.version,
    lastRotatedAt: reference.lastRotatedAt,
    redacted: true,
  };
}

function serializeConnector(connector: ConnectorRecord) {
  return {
    id: connector.id,
    type: connector.type,
    key: connector.key,
    displayName: connector.displayName,
    status: connector.status,
    secretReference: serializeSecretReference(connector.secretReference),
    configSummary: connector.configSummary,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  };
}

function serializeOutbox(outbox: ConnectorOutboxRecord) {
  return {
    id: outbox.id,
    connectorId: outbox.connectorId,
    eventType: outbox.eventType,
    resourceType: outbox.resourceType,
    resourceId: outbox.resourceId,
    idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
    status: outbox.status,
    payloadSummary: outbox.payloadSummary,
    attemptCount: outbox.attemptCount,
    maxAttempts: outbox.maxAttempts,
    nextAttemptAt: outbox.nextAttemptAt,
    leasePresent: Boolean(outbox.leaseId),
    leasedUntil: outbox.leasedUntil,
    deliveredAt: outbox.deliveredAt,
    deadLetteredAt: outbox.deadLetteredAt,
    lastErrorSummary: outbox.lastErrorSummary,
    createdAt: outbox.createdAt,
    updatedAt: outbox.updatedAt,
  };
}

function isConnectorOutboxLeaseActive(outbox: ConnectorOutboxRecord, now: string): boolean {
  return (
    outbox.status === "leased" &&
    outbox.leasedUntil !== undefined &&
    Date.parse(outbox.leasedUntil) > Date.parse(now)
  );
}

function assertRecoveryConfirmationMatches(
  confirmation: {
    outboxId: string;
    expectedStatus: ConnectorOutboxRecord["status"];
  },
  outbox: ConnectorOutboxRecord,
): void {
  if (confirmation.outboxId === outbox.id && confirmation.expectedStatus === outbox.status) return;
  throw new ApiHttpError(
    409,
    "CONNECTOR_RECOVERY_CONFIRMATION_MISMATCH",
    "Connector outbox recovery confirmation does not match the current row state",
  );
}

function connectorOutboxAuditMetadata(input: {
  connector: ConnectorRecord;
  outbox: ConnectorOutboxRecord;
  beforeStatus: ConnectorOutboxRecord["status"];
  expectedStatus: ConnectorOutboxRecord["status"];
  afterStatus: ConnectorOutboxRecord["status"];
  deliveryJob?: JobLifecycleRecord;
}) {
  return {
    connectorId: input.connector.id,
    connectorType: input.connector.type,
    connectorKey: input.connector.key,
    outboxId: input.outbox.id,
    eventType: input.outbox.eventType,
    resourceType: input.outbox.resourceType,
    resourceId: input.outbox.resourceId,
    beforeStatus: input.beforeStatus,
    expectedStatus: input.expectedStatus,
    afterStatus: input.afterStatus,
    attemptCount: input.outbox.attemptCount,
    maxAttempts: input.outbox.maxAttempts,
    idempotencyKeyPresent: Boolean(input.outbox.idempotencyKey),
    deliveryJobQueued: Boolean(input.deliveryJob),
    queueName: input.deliveryJob?.queueName,
  };
}

function jobDelayUntil(nextAttemptAt: string | undefined, now: string): number | undefined {
  if (!nextAttemptAt) return undefined;
  const delay = Date.parse(nextAttemptAt) - Date.parse(now);
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

function connectorDeliveryJobMetadata(
  outbox: ConnectorOutboxRecord,
  now: string,
  recoveryMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const delay = jobDelayUntil(outbox.nextAttemptAt, now);
  return {
    resourceType: "connector_outbox",
    resourceId: outbox.id,
    eventCount: 1,
    maxAttempts: outbox.maxAttempts,
    idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
    ...recoveryMetadata,
    ...(delay ? { nextRetryAt: outbox.nextAttemptAt } : {}),
    ...idempotencyMetadata({
      outboxId: outbox.id,
      connectorId: outbox.connectorId,
      eventType: outbox.eventType,
      resourceType: outbox.resourceType,
      resourceId: outbox.resourceId,
      nextAttemptAt: outbox.nextAttemptAt,
      attemptCount: outbox.attemptCount,
      maxAttempts: outbox.maxAttempts,
      ...recoveryMetadata,
    }),
  };
}

function summarizeConnectorDeliveryJob(job: JobLifecycleRecord | undefined) {
  if (!job) return undefined;
  return {
    id: job.id,
    queueName: job.queueName,
    jobName: job.jobName,
    status: job.status,
    bullJobId: job.bullJobId,
    targetResourceType: job.targetResourceType,
    targetResourceId: job.targetResourceId,
    queuedAt: job.queuedAt,
    idempotencyKeyPresent: Boolean(job.idempotencyKey),
  };
}

async function scheduleConnectorDeliveryJob(
  { repository, connectorJobQueue }: ApiRouteDependencies,
  auth: ApiAuthContext,
  outbox: ConnectorOutboxRecord,
  now: string,
  options: {
    action?: string;
    clientKey?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<JobLifecycleRecord | undefined> {
  if (!connectorJobQueue) return undefined;

  const jobId = crypto.randomUUID();
  const metadata = connectorDeliveryJobMetadata(outbox, now, options.metadata);
  const idempotencyKey = buildIdempotencyKey({
    scope: "job",
    firmId: auth.firmId,
    resourceType: "connector_outbox",
    resourceId: outbox.id,
    action: options.action ?? "connectors.deliver",
    providerOrTemplate: CONNECTOR_DELIVERY_JOB_NAME,
    clientKey: options.clientKey,
  });
  const job = await repository.createJobLifecycleRecord({
    id: jobId,
    firmId: auth.firmId,
    queueName: "connectors",
    jobName: CONNECTOR_DELIVERY_JOB_NAME,
    status: "queued",
    targetResourceType: "connector_outbox",
    targetResourceId: outbox.id,
    idempotencyKey,
    attemptsMade: 0,
    maxAttempts: CONNECTOR_JOB_MAX_ATTEMPTS,
    queuedAt: now,
    metadata,
  });
  if (job.id !== jobId) return job;

  let bullJobId: string | undefined;
  try {
    const delay = jobDelayUntil(outbox.nextAttemptAt, now);
    const bullJob = await connectorJobQueue.add(
      CONNECTOR_DELIVERY_JOB_NAME,
      {
        firmId: auth.firmId,
        resourceType: "connector_outbox",
        resourceId: outbox.id,
        metadata: {
          resourceType: "connector_outbox",
          resourceId: outbox.id,
          eventCount: 1,
          maxAttempts: outbox.maxAttempts,
          idempotencyKeyPresent: Boolean(outbox.idempotencyKey),
          ...options.metadata,
        },
      },
      delay === undefined ? { jobId } : { jobId, delay },
    );
    bullJobId = bullJob.id === undefined ? undefined : String(bullJob.id);
  } catch {
    await markJobEnqueueFailed(repository, auth.firmId, job, now);
    throw enqueueFailureError();
  }

  return repository.updateJobLifecycleRecord(auth.firmId, job.id, { bullJobId });
}

export function registerConnectorRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository } = dependencies;

  server.get("/api/connectors", async (request) => {
    const query = parseRequestPart(connectorListQuerySchema, request.query, "query");
    assertConnectorAccess(request.auth, { resource: "connector", action: "read" });
    const connectors = await repository.listConnectors(request.auth.firmId, query);
    return { connectors: connectors.map(serializeConnector) };
  });

  server.patch("/api/connectors/:connectorId", async (request) => {
    const params = parseRequestPart(connectorParamsSchema, request.params, "params");
    const body = parseRequestPart(connectorPatchBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
    if (body.configSummary) assertRedactedSummary(body.configSummary, "configSummary");
    const existing = await repository.getConnector(request.auth.firmId, params.connectorId);
    if (!existing) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    const now = new Date().toISOString();
    const secretReference =
      body.secretReference && body.secretReference.id === maskedSecretReferenceId
        ? existing.secretReference
        : body.secretReference === null
          ? undefined
          : body.secretReference;
    const connector = await repository.updateConnector(request.auth.firmId, existing.id, {
      displayName: body.displayName,
      status: body.status,
      ...(body.secretReference !== undefined ? { secretReference } : {}),
      configSummary: body.configSummary,
      updatedAt: now,
    });
    if (!connector) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "connector.updated",
      resourceType: "connector",
      resourceId: connector.id,
      occurredAt: now,
      metadata: {
        connectorId: connector.id,
        connectorType: connector.type,
        connectorKey: connector.key,
        status: connector.status,
        secretReferencePresent: Boolean(connector.secretReference),
        secretReferenceChanged:
          body.secretReference !== undefined &&
          !(body.secretReference && body.secretReference.id === maskedSecretReferenceId),
      },
    });

    return { connector: serializeConnector(connector) };
  });

  server.post("/api/connectors", async (request, reply) => {
    const body = parseRequestPart(connectorCreateBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "create" });
    assertRedactedSummary(body.configSummary, "configSummary");
    const now = new Date().toISOString();
    const connector = await repository.createConnector({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      type: body.type,
      key: body.key,
      displayName: body.displayName,
      status: body.status,
      secretReference: body.secretReference,
      configSummary: body.configSummary,
      createdAt: now,
      updatedAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "connector.created",
      resourceType: "connector",
      resourceId: connector.id,
      occurredAt: now,
      metadata: {
        connectorId: connector.id,
        connectorType: connector.type,
        connectorKey: connector.key,
        status: connector.status,
        secretReferencePresent: Boolean(connector.secretReference),
      },
    });

    reply.code(201);
    return { connector: serializeConnector(connector) };
  });

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
