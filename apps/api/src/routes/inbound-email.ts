import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AccessRequest, InboundEmailMessageRecord } from "@open-practice/domain";
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
const staffTriageSchema = z
  .object({
    status: z.enum(["needs_review", "routed", "rejected", "closed"]).optional(),
    assignedToUserId: z.string().min(1).optional(),
    contactIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .strict();
const inboundEmailTriageBodySchema = z
  .object({
    status: z.enum(["received", "parsed", "triage_pending", "triaged", "rejected"]).optional(),
    labels: z.array(z.string().trim().min(1).max(64)).max(12).optional(),
    matterId: z.string().min(1).optional(),
    staffTriage: staffTriageSchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.status !== undefined ||
      body.labels !== undefined ||
      body.matterId !== undefined ||
      (body.staffTriage !== undefined &&
        (body.staffTriage.status !== undefined ||
          body.staffTriage.assignedToUserId !== undefined ||
          body.staffTriage.contactIds !== undefined)),
    { message: "At least one triage field is required" },
  );
type InboundEmailTriageBody = z.infer<typeof inboundEmailTriageBodySchema>;
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

function redactedStaffTriage(input: InboundEmailTriageBody["staffTriage"]) {
  if (!input) return undefined;
  const triage = {
    status: input.status,
    assignedToUserId: input.assignedToUserId,
    contactIds: input.contactIds,
    updatedAt: new Date().toISOString(),
  };
  return Object.fromEntries(Object.entries(triage).filter(([, value]) => value !== undefined));
}

function buildInboundEmailTriageUpdates(
  message: InboundEmailMessageRecord,
  body: InboundEmailTriageBody,
  actorUserId: string,
): Partial<Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">> {
  const updates: Partial<
    Pick<InboundEmailMessageRecord, "status" | "matterId" | "labels" | "metadata">
  > = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.labels !== undefined) updates.labels = body.labels;
  if (body.matterId !== undefined) updates.matterId = body.matterId;
  const staffTriage = redactedStaffTriage(body.staffTriage);
  if (staffTriage) {
    updates.metadata = {
      ...message.metadata,
      staffTriage: {
        ...staffTriage,
        updatedByUserId: actorUserId,
      },
    };
  }
  return updates;
}

export async function buildInboundEmailStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
}) {
  const [providers, addresses] = await Promise.all([
    input.repository.listProviderSettings(input.firmId, {
      kind: "inbound_email",
    }),
    input.repository.listInboundEmailAddresses(input.firmId),
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
}

export function registerInboundEmailRoutes(
  server: FastifyInstance,
  { repository, ocrJobQueue }: ApiRouteDependencies,
): void {
  server.get("/api/inbound-email/status", async (request) => {
    return buildInboundEmailStatus({ repository, firmId: request.auth.firmId });
  });

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

  server.patch("/api/communications/inbox/inbound-email/:id", async (request) => {
    const params = parseRequestPart(idParamsSchema, request.params, "params");
    const body = parseRequestPart(inboundEmailTriageBodySchema, request.body ?? {}, "body");
    const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
    if (!message) {
      throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
    }

    const targetMatterId = body.matterId ?? message.matterId;
    if (message.matterId && body.matterId && body.matterId !== message.matterId) {
      throw Object.assign(new Error("Scoped inbound email cannot be moved to another matter"), {
        statusCode: 403,
      });
    }
    if (message.matterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "update",
        matterId: message.matterId,
      });
    } else if (!targetMatterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "update",
      });
    }
    if (targetMatterId) {
      assertInboundEmailAccess(request.auth, {
        resource: "inbound_email",
        action: "update",
        matterId: targetMatterId,
      });
    }

    const accessibleMatters = await repository.listMattersForUser(request.auth.user);
    const targetMatter = targetMatterId
      ? accessibleMatters.find((matter) => matter.id === targetMatterId)
      : undefined;
    if (targetMatterId && !targetMatter) {
      throw Object.assign(new Error("Target matter was not found"), { statusCode: 404 });
    }

    const contactIds = body.staffTriage?.contactIds ?? [];
    if ((contactIds.length > 0 || body.staffTriage?.assignedToUserId) && !targetMatter) {
      throw Object.assign(new Error("Staff triage assignments require a target matter"), {
        statusCode: 400,
      });
    }
    if (contactIds.length > 0) {
      const linkedContactIds = new Set(targetMatter?.parties.map((party) => party.contactId) ?? []);
      const unlinkedContactId = contactIds.find((contactId) => !linkedContactIds.has(contactId));
      if (unlinkedContactId) {
        throw Object.assign(new Error("Triage contact is not linked to the target matter"), {
          statusCode: 403,
        });
      }
    }

    if (body.staffTriage?.assignedToUserId && targetMatter) {
      const assignedUser = await repository.getUser(
        request.auth.firmId,
        body.staffTriage.assignedToUserId,
      );
      if (!assignedUser) {
        throw Object.assign(new Error("Assigned user was not found"), { statusCode: 404 });
      }
      assertInboundEmailAccess(
        { firmId: request.auth.firmId, user: assignedUser },
        { resource: "inbound_email", action: "update", matterId: targetMatterId },
      );
    }

    const updated = await repository.updateInboundEmailMessage(
      request.auth.firmId,
      message.id,
      buildInboundEmailTriageUpdates(message, body, request.auth.user.id),
    );

    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.triage_updated",
      resourceType: "inbound_email",
      resourceId: updated.id,
      metadata: {
        matterId: updated.matterId,
        previousMatterId: message.matterId,
        status: updated.status,
        labelCount: updated.labels.length,
        staffTriageStatus:
          typeof updated.metadata.staffTriage === "object" &&
          updated.metadata.staffTriage !== null &&
          !Array.isArray(updated.metadata.staffTriage)
            ? (updated.metadata.staffTriage as Record<string, unknown>).status
            : undefined,
        assignedToUserId: body.staffTriage?.assignedToUserId,
        contactIds: body.staffTriage?.contactIds,
      },
    });

    return {
      status: "updated",
      message: {
        id: updated.id,
        matterId: updated.matterId,
        status: updated.status,
        labels: updated.labels,
        receivedAt: updated.receivedAt,
        staffTriage:
          typeof updated.metadata.staffTriage === "object" &&
          updated.metadata.staffTriage !== null &&
          !Array.isArray(updated.metadata.staffTriage)
            ? updated.metadata.staffTriage
            : undefined,
      },
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
