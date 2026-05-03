import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  ConnectorOutboxRecord,
  ConnectorRecord,
  ConnectorSecretReference,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
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

const sensitiveKeyPattern =
  /(api[_-]?key|authorization|bearer|credential|password|private[_-]?key|secret|token)/i;

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

function assertRedactedSummary(summary: Record<string, unknown>, field: string): void {
  if (!containsSensitiveConfigKey(summary)) return;
  throw new ApiHttpError(
    400,
    "CONNECTOR_SECRET_SUMMARY_REJECTED",
    `${field} must contain redacted operational metadata only`,
  );
}

function serializeSecretReference(reference: ConnectorSecretReference | undefined) {
  if (!reference) return undefined;
  return {
    id: reference.id,
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
    idempotencyKey: outbox.idempotencyKey,
    status: outbox.status,
    payloadSummary: outbox.payloadSummary,
    attemptCount: outbox.attemptCount,
    maxAttempts: outbox.maxAttempts,
    nextAttemptAt: outbox.nextAttemptAt,
    leaseId: outbox.leaseId,
    leasedUntil: outbox.leasedUntil,
    deliveredAt: outbox.deliveredAt,
    deadLetteredAt: outbox.deadLetteredAt,
    lastErrorSummary: outbox.lastErrorSummary,
    createdAt: outbox.createdAt,
    updatedAt: outbox.updatedAt,
  };
}

export function registerConnectorRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/connectors", async (request) => {
    const query = parseRequestPart(connectorListQuerySchema, request.query, "query");
    assertConnectorAccess(request.auth, { resource: "connector", action: "read" });
    const connectors = await repository.listConnectors(request.auth.firmId, query);
    return { connectors: connectors.map(serializeConnector) };
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

  server.post("/api/connectors/outbox", async (request, reply) => {
    const body = parseRequestPart(connectorOutboxCreateBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "create" });
    assertRedactedSummary(body.payloadSummary, "payloadSummary");
    const connector = await repository.getConnector(request.auth.firmId, body.connectorId);
    if (!connector) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    const now = new Date().toISOString();
    const queued = await repository.createConnectorOutbox({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      connectorId: connector.id,
      eventType: body.eventType,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      idempotencyKey: body.idempotencyKey,
      status: "pending",
      payloadSummary: body.payloadSummary,
      attemptCount: 0,
      maxAttempts: body.maxAttempts,
      nextAttemptAt: body.nextAttemptAt ?? now,
      createdAt: now,
      updatedAt: now,
    });
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
          idempotencyKey: queued.outbox.idempotencyKey,
          resourceType: queued.outbox.resourceType,
          resourceId: queued.outbox.resourceId,
        },
      });
    }

    reply.code(queued.created ? 201 : 200);
    return { outbox: serializeOutbox(queued.outbox), created: queued.created };
  });
}
