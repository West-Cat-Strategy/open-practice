import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { allowedOcrLanguages, type DocumentRecord } from "@open-practice/domain";
import { ApiHttpError } from "../../http/response.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import { assertInboundEmailAccess, serializeInboundEmailAttachment } from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

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
  queueOcr: z.boolean().default(false),
  language: z.enum(allowedOcrLanguages).default("eng"),
});

function serializePromotedInboundEmailDocument(document: DocumentRecord) {
  const safe = { ...document } as Omit<DocumentRecord, "storageKey"> &
    Partial<Pick<DocumentRecord, "storageKey">>;
  delete safe.storageKey;
  return safe;
}

export function registerInboundEmailAttachmentPromotionRoutes(
  server: FastifyInstance,
  { repository }: InboundEmailRouteDependencies,
): void {
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
      if (body.queueOcr) {
        throw new ApiHttpError(
          409,
          "DOCUMENT_SCAN_REQUIRED",
          "Inbound email attachments must pass document scanning before OCR can be queued",
        );
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

      return {
        status: "promoted",
        created: promoted.created,
        inboundMessageId: message.id,
        attachment: serializeInboundEmailAttachment(promoted.attachment),
        document: serializePromotedInboundEmailDocument(promoted.document),
      };
    },
  );
}
