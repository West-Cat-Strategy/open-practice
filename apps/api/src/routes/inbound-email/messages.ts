import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseRequestPart } from "../../http/validation.js";
import {
  assertInboundEmailAccess,
  inboundEmailMessageParamsSchema,
  serializeInboundEmailAttachment,
  serializeInboundEmailMessage,
} from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

const inboundEmailQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

export function registerInboundEmailMessageRoutes(
  server: FastifyInstance,
  { repository }: InboundEmailRouteDependencies,
): void {
  server.get("/api/inbound-email/messages", async (request) => {
    const query = parseRequestPart(inboundEmailQuerySchema, request.query, "query");
    if (query.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "read",
        matterId: query.matterId,
      });
    } else if (request.auth.user.role !== "owner_admin" && request.auth.user.role !== "auditor") {
      throw Object.assign(new Error("Matter scope required"), { statusCode: 403 });
    }

    const messages = await repository.listInboundEmailMessages(request.auth.firmId, {
      matterId: query.matterId,
    });

    return {
      status: "available",
      messages: messages.map(serializeInboundEmailMessage),
    };
  });

  server.get("/api/inbound-email/messages/:id", async (request) => {
    const params = parseRequestPart(inboundEmailMessageParamsSchema, request.params, "params");
    const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
    if (!message) {
      throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
    }

    if (message.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "read",
        matterId: message.matterId,
      });
    } else if (request.auth.user.role !== "owner_admin" && request.auth.user.role !== "auditor") {
      throw Object.assign(new Error("Matter scope required"), { statusCode: 403 });
    }

    const attachments = await repository.listInboundEmailAttachments(
      request.auth.firmId,
      message.id,
    );

    return {
      status: "available",
      message: serializeInboundEmailMessage(message),
      attachments: attachments.map(serializeInboundEmailAttachment),
    };
  });
}
