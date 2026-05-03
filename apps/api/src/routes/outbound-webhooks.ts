import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildOutboundWebhookTestDeliverySimulation,
  outboundWebhookEventAllowlist,
  validateOutboundWebhookDestination,
  type AccessRequest,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { ApiHttpError } from "../http/response.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import type { ApiRouteDependencies } from "./types.js";

const outboundWebhookTestDeliveryBodySchema = z.object({
  destinationUrl: z.string().url(),
  events: z.array(z.enum(outboundWebhookEventAllowlist)).min(1).max(20),
  signingKeyReference: z.string().trim().min(1).max(128).optional(),
});

function assertOutboundWebhookAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerOutboundWebhookRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.post("/api/outbound-webhooks/test-deliveries", async (request, reply) => {
    const body = parseRequestPart(outboundWebhookTestDeliveryBodySchema, request.body, "body");
    assertOutboundWebhookAccess(request.auth, {
      resource: "outbound_webhook",
      action: "create",
    });

    const destination = validateOutboundWebhookDestination(body.destinationUrl);
    if (!destination.ok) {
      throw new ApiHttpError(
        400,
        "OUTBOUND_WEBHOOK_DESTINATION_DENIED",
        "Outbound webhook destination failed guardrail validation",
        { reason: destination.reason },
      );
    }

    const deliveryId = crypto.randomUUID();
    const simulation = buildOutboundWebhookTestDeliverySimulation({
      deliveryId,
      destination,
      events: body.events,
      secretReference: body.signingKeyReference,
    });

    await appendRouteAuditEvent(repository, request.auth, {
      action: "outbound_webhook.test_delivery_simulated",
      resourceType: "outbound_webhook",
      resourceId: deliveryId,
      metadata: {
        deliveryId,
        destinationScheme: destination.scheme,
        destinationHost: destination.host,
        destinationPort: destination.port,
        eventCount: body.events.length,
        events: body.events,
        signingAlgorithm: simulation.signing.algorithm,
        signatureHeader: simulation.signing.signatureHeader,
        simulationOnly: true,
      },
    });

    reply.code(202);
    return { simulation };
  });
}
