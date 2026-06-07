import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ConnectorRecord } from "@open-practice/domain";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { registerConnectorDeveloperRecoveryRoutes } from "./connectors/developer-recovery.js";
import { registerConnectorDeveloperRegistrationRoutes } from "./connectors/developer-registration.js";
import { registerConnectorOutboxRoutes } from "./connectors/outbox.js";
import {
  assertConnectorAccess,
  assertConnectorDeliveryUrl,
  assertRedactedSummary,
  defaultConnectorDnsResolver,
  maskedSecretReferenceId,
  serializeSecretReference,
} from "./connectors/shared.js";
import type { ApiRouteDependencies } from "./types.js";

const connectorTypeSchema = z.enum([
  "calendar",
  "document_processing",
  "email",
  "generic",
  "inbound_email",
]);
const connectorStatusSchema = z.enum(["disabled", "enabled", "paused", "error"]);

const secretReferenceSchema = z
  .object({
    id: z.string().min(1).max(160),
    label: z.string().min(1).max(160).optional(),
    version: z.string().min(1).max(80).optional(),
    lastRotatedAt: z.string().datetime().optional(),
  })
  .strict();

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

const connectorParamsSchema = z.object({
  connectorId: z.string().min(1),
});

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

export function registerConnectorRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository } = dependencies;
  const connectorDnsResolver = dependencies.connectorDnsResolver ?? defaultConnectorDnsResolver;

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
    if (body.configSummary) {
      assertRedactedSummary(body.configSummary, "configSummary");
      await assertConnectorDeliveryUrl(body.configSummary, "configSummary", connectorDnsResolver);
    }
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
    await assertConnectorDeliveryUrl(body.configSummary, "configSummary", connectorDnsResolver);
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

  registerConnectorDeveloperRegistrationRoutes(server, dependencies);
  registerConnectorDeveloperRecoveryRoutes(server, dependencies);
  registerConnectorOutboxRoutes(server, dependencies);
}
