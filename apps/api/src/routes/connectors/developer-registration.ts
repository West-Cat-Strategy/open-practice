import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  IntegrationDeveloperEndpointPosture,
  IntegrationDeveloperRateLimitPosture,
} from "@open-practice/domain";
import {
  outboundWebhookEventAllowlist,
  validateOutboundWebhookDestination,
} from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import type { ApiRouteDependencies } from "../types.js";
import {
  assertCredentialScopesWithinApp,
  assertIntegrationAppHasScope,
  assertIntegrationAppUsable,
  integrationDeveloperAppParamsSchema,
  integrationWebhookDeliverScope,
  serializeIntegrationApp,
  serializeIntegrationCredential,
  serializeIntegrationWebhookSubscription,
} from "./developer-shared.js";
import {
  assertConnectorAccess,
  assertConnectorDestinationDns,
  defaultConnectorDnsResolver,
} from "./shared.js";

const integrationDeveloperAppStatusSchema = z.enum(["draft", "active", "paused", "revoked"]);
const integrationWebhookSubscriptionStatusSchema = z.enum(["active", "paused", "disabled"]);
const integrationRegionSchema = z.enum(["ca", "us", "eu", "custom"]);
const integrationDeveloperScopeSchema = z.enum([
  "matter.read",
  "document.read",
  "signature_request.read",
  "intake_session.read",
  "invoice.read",
  "email_outbox.read",
  "webhook.deliver",
]);
const integrationDeveloperEndpointSchema = z
  .object({
    region: integrationRegionSchema.default("ca"),
    endpointBaseUrl: z.string().url().max(2048).optional(),
  })
  .strict()
  .default({ region: "ca" });

const integrationDeveloperRateLimitSchema = z
  .object({
    windowSeconds: z.number().int().min(60).max(86_400).default(60),
    maxRequests: z.number().int().min(1).max(10_000).default(60),
    burstLimit: z.number().int().min(1).max(10_000).optional(),
  })
  .strict()
  .default({ windowSeconds: 60, maxRequests: 60 });

const integrationCustomActionPlaceholderSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    label: z.string().min(1).max(160),
    status: z.literal("reserved").default("reserved"),
  })
  .strict();

const integrationDeveloperAppCreateBodySchema = z
  .object({
    connectorId: z.string().min(1),
    displayName: z.string().min(1).max(160),
    status: integrationDeveloperAppStatusSchema.default("draft"),
    redirectUris: z.array(z.string().url().max(2048)).max(20).default([]),
    allowedOrigins: z.array(z.string().url().max(2048)).max(20).default([]),
    allowedScopes: z.array(integrationDeveloperScopeSchema).min(1).max(20),
    regionalEndpoint: integrationDeveloperEndpointSchema,
    rateLimit: integrationDeveloperRateLimitSchema,
    customActionPlaceholders: z.array(integrationCustomActionPlaceholderSchema).max(20).default([]),
  })
  .strict();

const integrationDeveloperAppListQuerySchema = z.object({
  connectorId: z.string().min(1).optional(),
  status: integrationDeveloperAppStatusSchema.optional(),
});

const integrationCredentialParamsSchema = z.object({
  credentialId: z.string().min(1),
});

const integrationApiCredentialCreateBodySchema = z
  .object({
    label: z.string().min(1).max(160),
    scopes: z.array(integrationDeveloperScopeSchema).min(1).max(20),
    secretReference: z
      .object({
        id: z.string().min(1).max(160),
        label: z.string().min(1).max(160).optional(),
        version: z.string().min(1).max(80).optional(),
        lastRotatedAt: z.string().datetime().optional(),
      })
      .strict(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

const integrationWebhookSubscriptionCreateBodySchema = z
  .object({
    status: integrationWebhookSubscriptionStatusSchema.default("paused"),
    eventTypes: z.array(z.enum(outboundWebhookEventAllowlist)).min(1).max(20),
    destinationUrl: z.string().url().max(2048),
    signingSecretReference: z
      .object({
        id: z.string().min(1).max(160),
        label: z.string().min(1).max(160).optional(),
        version: z.string().min(1).max(80).optional(),
        lastRotatedAt: z.string().datetime().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeHttpsUrl(value: string, code: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiHttpError(400, code, `${field} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new ApiHttpError(400, code, `${field} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new ApiHttpError(400, code, `${field} must not include URL credentials`);
  }
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed.toString();
}

function normalizeAllowedOrigin(value: string): string {
  const normalized = normalizeHttpsUrl(
    value,
    "INTEGRATION_ORIGIN_DENIED",
    "allowedOrigins entries",
  );
  const parsed = new URL(normalized);
  return parsed.origin;
}

function normalizeIntegrationEndpoint(
  input: z.infer<typeof integrationDeveloperEndpointSchema>,
): IntegrationDeveloperEndpointPosture {
  if (!input.endpointBaseUrl) return { region: input.region, posture: "cue_only" };
  const endpoint = validateOutboundWebhookDestination(input.endpointBaseUrl);
  if (!endpoint.ok) {
    throw new ApiHttpError(
      400,
      "INTEGRATION_ENDPOINT_DENIED",
      "Regional endpoint cue failed guardrail validation",
      { reason: endpoint.reason },
    );
  }
  return {
    region: input.region,
    endpointBaseUrl: endpoint.normalizedUrl,
    posture: "cue_only",
  };
}

function normalizeRateLimitPosture(
  input: z.infer<typeof integrationDeveloperRateLimitSchema>,
): IntegrationDeveloperRateLimitPosture {
  return {
    mode: "documented",
    windowSeconds: input.windowSeconds,
    maxRequests: input.maxRequests,
    burstLimit: input.burstLimit,
    enforcement: "reserved",
  };
}

export function registerConnectorDeveloperRegistrationRoutes(
  server: FastifyInstance,
  dependencies: ApiRouteDependencies,
): void {
  const { repository } = dependencies;
  const connectorDnsResolver = dependencies.connectorDnsResolver ?? defaultConnectorDnsResolver;

  server.get("/api/connectors/developer/apps", async (request) => {
    const query = parseRequestPart(integrationDeveloperAppListQuerySchema, request.query, "query");
    assertConnectorAccess(request.auth, { resource: "connector", action: "read" });
    const [apps, connectors, credentials, webhookSubscriptions] = await Promise.all([
      repository.listIntegrationDeveloperApps(request.auth.firmId, query),
      repository.listConnectors(request.auth.firmId),
      repository.listIntegrationApiCredentials(request.auth.firmId),
      repository.listIntegrationWebhookSubscriptions(request.auth.firmId),
    ]);
    const connectorsById = new Map(connectors.map((connector) => [connector.id, connector]));
    return {
      apps: apps.map((app) =>
        serializeIntegrationApp({
          app,
          connector: connectorsById.get(app.connectorId),
          credentials: credentials.filter((credential) => credential.appId === app.id),
          webhookSubscriptions: webhookSubscriptions.filter(
            (subscription) => subscription.appId === app.id,
          ),
        }),
      ),
    };
  });

  server.post("/api/connectors/developer/apps", async (request, reply) => {
    const body = parseRequestPart(integrationDeveloperAppCreateBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "create" });
    const connector = await repository.getConnector(request.auth.firmId, body.connectorId);
    if (!connector) {
      throw new ApiHttpError(404, "CONNECTOR_NOT_FOUND", "Connector was not found");
    }
    const now = new Date().toISOString();
    const app = await repository.createIntegrationDeveloperApp({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      connectorId: connector.id,
      clientId: `op_client_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
      displayName: body.displayName,
      status: body.status,
      redirectUris: uniqueSorted(
        body.redirectUris.map((uri) =>
          normalizeHttpsUrl(uri, "INTEGRATION_REDIRECT_URI_DENIED", "redirectUris entries"),
        ),
      ),
      allowedOrigins: uniqueSorted(body.allowedOrigins.map(normalizeAllowedOrigin)),
      allowedScopes: uniqueSorted(body.allowedScopes),
      regionalEndpoint: normalizeIntegrationEndpoint(body.regionalEndpoint),
      rateLimit: normalizeRateLimitPosture(body.rateLimit),
      customActionPlaceholders: body.customActionPlaceholders,
      createdByUserId: request.auth.user.id,
      createdAt: now,
      updatedAt: now,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "integration_developer_app.registered",
      resourceType: "integration_developer_app",
      resourceId: app.id,
      occurredAt: now,
      metadata: {
        appId: app.id,
        connectorId: connector.id,
        connectorType: connector.type,
        connectorKey: connector.key,
        status: app.status,
        scopeCount: app.allowedScopes.length,
        redirectUriCount: app.redirectUris.length,
        allowedOriginCount: app.allowedOrigins.length,
        endpointRegion: app.regionalEndpoint.region,
        endpointBaseUrlPresent: Boolean(app.regionalEndpoint.endpointBaseUrl),
        rateLimitWindowSeconds: app.rateLimit.windowSeconds,
        rateLimitMaxRequests: app.rateLimit.maxRequests,
        rateLimitEnforcement: app.rateLimit.enforcement,
        customActionCount: app.customActionPlaceholders.length,
      },
    });

    reply.code(201);
    return { app: serializeIntegrationApp({ app, connector }) };
  });

  server.post("/api/connectors/developer/apps/:appId/credentials", async (request, reply) => {
    const params = parseRequestPart(integrationDeveloperAppParamsSchema, request.params, "params");
    const body = parseRequestPart(integrationApiCredentialCreateBodySchema, request.body, "body");
    assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
    const app = await repository.getIntegrationDeveloperApp(request.auth.firmId, params.appId);
    if (!app) {
      throw new ApiHttpError(
        404,
        "INTEGRATION_APP_NOT_FOUND",
        "Integration developer app was not found",
      );
    }
    assertIntegrationAppUsable(app);
    assertCredentialScopesWithinApp(app, body.scopes);
    const now = new Date().toISOString();
    const credential = await repository.createIntegrationApiCredential({
      id: crypto.randomUUID(),
      firmId: request.auth.firmId,
      appId: app.id,
      label: body.label,
      scopes: uniqueSorted(body.scopes),
      secretReference: body.secretReference,
      status: "active",
      createdByUserId: request.auth.user.id,
      createdAt: now,
      expiresAt: body.expiresAt,
    });
    await appendRouteAuditEvent(repository, request.auth, {
      action: "integration_api_credential.created",
      resourceType: "integration_api_credential",
      resourceId: credential.id,
      occurredAt: now,
      metadata: {
        appId: app.id,
        credentialId: credential.id,
        connectorId: app.connectorId,
        scopeCount: credential.scopes.length,
        secretReferencePresent: true,
        expiresAtPresent: Boolean(credential.expiresAt),
      },
    });

    reply.code(201);
    return { credential: serializeIntegrationCredential(credential) };
  });

  server.post("/api/connectors/developer/credentials/:credentialId/revoke", async (request) => {
    const params = parseRequestPart(integrationCredentialParamsSchema, request.params, "params");
    assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
    const existing = await repository.getIntegrationApiCredential(
      request.auth.firmId,
      params.credentialId,
    );
    if (!existing) {
      throw new ApiHttpError(
        404,
        "INTEGRATION_CREDENTIAL_NOT_FOUND",
        "Integration API credential was not found",
      );
    }
    const now = new Date().toISOString();
    const credential = await repository.revokeIntegrationApiCredential({
      firmId: request.auth.firmId,
      credentialId: existing.id,
      revokedAt: now,
    });
    if (!credential) {
      throw new ApiHttpError(
        404,
        "INTEGRATION_CREDENTIAL_NOT_FOUND",
        "Integration API credential was not found",
      );
    }
    await appendRouteAuditEvent(repository, request.auth, {
      action: "integration_api_credential.revoked",
      resourceType: "integration_api_credential",
      resourceId: credential.id,
      occurredAt: now,
      metadata: {
        appId: credential.appId,
        credentialId: credential.id,
        revokedAt: credential.revokedAt,
      },
    });

    return { credential: serializeIntegrationCredential(credential) };
  });

  server.post(
    "/api/connectors/developer/apps/:appId/webhook-subscriptions",
    async (request, reply) => {
      const params = parseRequestPart(
        integrationDeveloperAppParamsSchema,
        request.params,
        "params",
      );
      const body = parseRequestPart(
        integrationWebhookSubscriptionCreateBodySchema,
        request.body,
        "body",
      );
      assertConnectorAccess(request.auth, { resource: "connector", action: "update" });
      const app = await repository.getIntegrationDeveloperApp(request.auth.firmId, params.appId);
      if (!app) {
        throw new ApiHttpError(
          404,
          "INTEGRATION_APP_NOT_FOUND",
          "Integration developer app was not found",
        );
      }
      assertIntegrationAppUsable(app);
      assertIntegrationAppHasScope(app, integrationWebhookDeliverScope);
      const destination = validateOutboundWebhookDestination(body.destinationUrl);
      if (!destination.ok) {
        throw new ApiHttpError(
          400,
          "INTEGRATION_WEBHOOK_DESTINATION_DENIED",
          "Integration webhook subscription destination failed guardrail validation",
          { reason: destination.reason },
        );
      }
      await assertConnectorDestinationDns(destination, "destinationUrl", connectorDnsResolver);
      const now = new Date().toISOString();
      const subscription = await repository.createIntegrationWebhookSubscription({
        id: crypto.randomUUID(),
        firmId: request.auth.firmId,
        appId: app.id,
        connectorId: app.connectorId,
        status: body.status,
        eventTypes: uniqueSorted(body.eventTypes),
        destinationUrl: destination.normalizedUrl,
        destinationHost: destination.host,
        signingSecretReference: body.signingSecretReference,
        createdByUserId: request.auth.user.id,
        createdAt: now,
        updatedAt: now,
      });
      await appendRouteAuditEvent(repository, request.auth, {
        action: "integration_webhook_subscription.created",
        resourceType: "integration_webhook_subscription",
        resourceId: subscription.id,
        occurredAt: now,
        metadata: {
          appId: app.id,
          connectorId: app.connectorId,
          subscriptionId: subscription.id,
          status: subscription.status,
          eventCount: subscription.eventTypes.length,
          destinationHost: subscription.destinationHost,
          signingSecretReferencePresent: Boolean(subscription.signingSecretReference),
        },
      });

      reply.code(201);
      return { subscription: serializeIntegrationWebhookSubscription(subscription) };
    },
  );
}
