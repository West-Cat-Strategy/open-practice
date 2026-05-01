import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest } from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { appendRouteAuditEvent } from "./audit-events.js";
import { queueDocumentOcr } from "./document-processing.js";
import type { ApiRouteDependencies } from "./types.js";

const inboundEmailQuerySchema = z.object({
  matterId: z.string().min(1).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const promoteAttachmentParamsSchema = z.object({
  id: z.string().min(1),
  attachmentId: z.string().min(1),
});
const promoteAttachmentBodySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  classification: z
    .enum(["general", "privileged", "work_product", "financial", "identity"])
    .default("general"),
  legalHold: z.boolean().default(false),
  queueOcr: z.boolean().default(true),
  language: z.string().trim().min(2).max(24).default("eng"),
});

function assertInboundEmailAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

export function registerInboundEmailRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/inbound-email/status", async (request) => {
    const [providers, addresses] = await Promise.all([
      repository.listProviderSettings(request.auth.firmId, {
        kind: "inbound_email",
      }),
      repository.listInboundEmailAddresses(request.auth.firmId),
    ]);
    const enabled = providers.find((provider) => provider.enabled);
    return {
      status: enabled ? "configured" : "disabled",
      reason: enabled ? undefined : "not_configured",
      provider: enabled?.key,
      addresses: addresses.map(({ id, address, matterId, enabled, createdAt }) => ({
        id,
        address,
        matterId,
        enabled,
        createdAt,
      })),
    };
  });

  server.get("/api/inbound-email/messages", async (request) => {
    const query = parseRequestPart(inboundEmailQuerySchema, request.query, "query");
    if (query.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "portal_message",
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
      messages,
    };
  });

  server.get("/api/inbound-email/messages/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
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
      message,
      attachments,
    };
  });

  server.post(
    "/api/inbound-email/messages/:id/attachments/:attachmentId/promote-document",
    async (request) => {
      const params = parseRequestPart(promoteAttachmentParamsSchema, request.params, "params");
      const body = parseRequestPart(promoteAttachmentBodySchema, request.body ?? {}, "body");
      const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
      if (!message) {
        throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
      }
      if (!message.matterId) {
        throw Object.assign(
          new Error("Inbound email message must be matter-scoped before promotion"),
          { statusCode: 409 },
        );
      }

      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "read",
        matterId: message.matterId,
      });
      assertInboundEmailAccess(request.auth, {
        resource: "document",
        action: "create",
        matterId: message.matterId,
      });
      assertInboundEmailAccess(request.auth, {
        resource: "document",
        action: "update",
        matterId: message.matterId,
      });
      const attachments = await repository.listInboundEmailAttachments(
        request.auth.firmId,
        message.id,
      );
      const attachment = attachments.find((candidate) => candidate.id === params.attachmentId);
      if (!attachment) {
        throw Object.assign(new Error("Inbound email attachment was not found"), {
          statusCode: 404,
        });
      }
      if (!attachment.checksumSha256) {
        throw Object.assign(
          new Error("Inbound email attachment checksum is required for document promotion"),
          { statusCode: 409 },
        );
      }
      if (body.queueOcr && !ocrJobQueue) {
        throw Object.assign(new Error("OCR queue is not configured"), { statusCode: 503 });
      }

      const promoted = await repository.promoteInboundEmailAttachmentToDocument({
        firmId: request.auth.firmId,
        messageId: message.id,
        attachmentId: attachment.id,
        matterId: message.matterId,
        title: body.title ?? attachment.filename,
        classification: body.classification,
        legalHold: body.legalHold,
      });

      await appendRouteAuditEvent(repository, request.auth, {
        action: "inbound_email.attachment.promoted_to_document",
        resourceType: "document",
        resourceId: promoted.document.id,
        metadata: {
          matterId: message.matterId,
          inboundMessageId: message.id,
          attachmentId: promoted.attachment.id,
          documentId: promoted.document.id,
          created: promoted.created,
          promotionStatus: "promoted",
          documentUploadStatus: promoted.document.uploadStatus,
          checksumStatus: promoted.document.checksumStatus,
          scanStatus: promoted.document.scanStatus,
        },
      });

      const queuedOcr = body.queueOcr
        ? await queueDocumentOcr({
            repository,
            ocrJobQueue,
            auth: request.auth,
            document: promoted.document,
            language: body.language,
          })
        : undefined;

      return {
        status: "promoted",
        created: promoted.created,
        inboundMessageId: message.id,
        attachment: promoted.attachment,
        document: promoted.document,
        queuedOcr,
      };
    },
  );
}
