import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canAccess,
  type AccessRequest,
  type InboundEmailMessageRecord,
} from "@open-practice/domain";
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
const followUpSchema = z
  .object({
    channel: z.enum(["email", "phone", "portal", "sms", "in_person"]).optional(),
    consentStatus: z.enum(["unknown", "consented", "declined", "do_not_contact"]).optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (followUp) =>
      followUp.channel !== undefined ||
      followUp.consentStatus !== undefined ||
      followUp.dueAt !== undefined,
    { message: "At least one follow-up field is required" },
  );
const staffTriageSchema = z
  .object({
    status: z.enum(["needs_review", "routed", "rejected", "closed"]).optional(),
    assignedToUserId: z.string().min(1).optional(),
    contactIds: z.array(z.string().min(1)).max(20).optional(),
    privateNote: z.string().trim().min(1).max(1000).optional(),
    followUp: followUpSchema.optional(),
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
          body.staffTriage.contactIds !== undefined ||
          body.staffTriage.privateNote !== undefined ||
          body.staffTriage.followUp !== undefined)),
    { message: "At least one triage field is required" },
  );
type InboundEmailTriageBody = z.infer<typeof inboundEmailTriageBodySchema>;
type StaffTriageFollowUp = NonNullable<
  NonNullable<InboundEmailTriageBody["staffTriage"]>["followUp"]
>;
type StaffTriagePrivateNote = {
  authorUserId: string;
  createdAt: string;
  text: string;
};
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

function currentStaffTriage(message: InboundEmailMessageRecord): Record<string, unknown> {
  const triage = message.metadata.staffTriage;
  if (!triage || typeof triage !== "object" || Array.isArray(triage)) return {};
  return triage as Record<string, unknown>;
}

function currentPrivateNotes(triage: Record<string, unknown>): StaffTriagePrivateNote[] {
  return Array.isArray(triage.privateNotes)
    ? triage.privateNotes.filter(
        (note): note is StaffTriagePrivateNote =>
          Boolean(note) &&
          typeof note === "object" &&
          !Array.isArray(note) &&
          typeof (note as Record<string, unknown>).authorUserId === "string" &&
          typeof (note as Record<string, unknown>).createdAt === "string" &&
          typeof (note as Record<string, unknown>).text === "string",
      )
    : [];
}

function safeFollowUp(input: unknown): StaffTriageFollowUp | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const followUp = input as Record<string, unknown>;
  const output: StaffTriageFollowUp = {};
  if (["email", "phone", "portal", "sms", "in_person"].includes(String(followUp.channel))) {
    output.channel = followUp.channel as StaffTriageFollowUp["channel"];
  }
  if (
    ["unknown", "consented", "declined", "do_not_contact"].includes(String(followUp.consentStatus))
  ) {
    output.consentStatus = followUp.consentStatus as StaffTriageFollowUp["consentStatus"];
  }
  if (typeof followUp.dueAt === "string") output.dueAt = followUp.dueAt;
  return Object.values(output).some((value) => value !== undefined) ? output : undefined;
}

function buildStaffTriageMetadata(
  message: InboundEmailMessageRecord,
  input: InboundEmailTriageBody["staffTriage"],
  actorUserId: string,
) {
  if (!input) return undefined;
  const existing = currentStaffTriage(message);
  const now = new Date().toISOString();
  const privateNotes = currentPrivateNotes(existing);
  const nextPrivateNotes = input.privateNote
    ? [
        ...privateNotes,
        {
          authorUserId: actorUserId,
          createdAt: now,
          text: input.privateNote.trim(),
        },
      ].slice(-25)
    : privateNotes;
  const existingFollowUp = safeFollowUp(existing.followUp);
  const followUp = input.followUp
    ? safeFollowUp({ ...(existingFollowUp ?? {}), ...input.followUp })
    : existingFollowUp;
  const triage = {
    status: input.status ?? (typeof existing.status === "string" ? existing.status : undefined),
    assignedToUserId:
      input.assignedToUserId ??
      (typeof existing.assignedToUserId === "string" ? existing.assignedToUserId : undefined),
    contactIds:
      input.contactIds ??
      (Array.isArray(existing.contactIds)
        ? existing.contactIds.filter((id): id is string => typeof id === "string")
        : undefined),
    privateNotes: nextPrivateNotes.length > 0 ? nextPrivateNotes : undefined,
    followUp,
    updatedAt: now,
    updatedByUserId: actorUserId,
  };
  return Object.fromEntries(Object.entries(triage).filter(([, value]) => value !== undefined));
}

function serializeStaffTriageDetail(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (typeof input.status === "string") output.status = input.status;
  if (typeof input.assignedToUserId === "string") output.assignedToUserId = input.assignedToUserId;
  if (Array.isArray(input.contactIds)) {
    output.contactIds = input.contactIds.filter((id): id is string => typeof id === "string");
  }
  const privateNotes = currentPrivateNotes(input);
  if (privateNotes.length > 0) {
    output.privateNoteCount = privateNotes.length;
    output.latestPrivateNoteAt = privateNotes.at(-1)?.createdAt;
  }
  const followUp = safeFollowUp(input.followUp);
  if (followUp) output.followUp = followUp;
  if (typeof input.updatedAt === "string") output.updatedAt = input.updatedAt;
  if (typeof input.updatedByUserId === "string") output.updatedByUserId = input.updatedByUserId;
  return Object.keys(output).length > 0 ? output : undefined;
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
  const staffTriage = buildStaffTriageMetadata(message, body.staffTriage, actorUserId);
  if (staffTriage) {
    updates.metadata = {
      ...message.metadata,
      staffTriage,
    };
  }
  return updates;
}

export async function buildInboundEmailStatus(input: {
  repository: ApiRouteDependencies["repository"];
  firmId: string;
  auth?: ApiAuthContext;
}) {
  const [providers, addresses] = await Promise.all([
    input.repository.listProviderSettings(input.firmId, {
      kind: "inbound_email",
    }),
    input.repository.listInboundEmailAddresses(input.firmId),
  ]);
  const enabled = providers.find((provider) => provider.enabled);
  const auth = input.auth;
  const addressesForUser = auth
    ? addresses.filter((address) => {
        if (auth.user.role === "owner_admin" || auth.user.role === "auditor") {
          return true;
        }
        return Boolean(
          address.matterId &&
          canAccess({
            user: auth.user,
            firmId: auth.firmId,
            resource: "inbound_email",
            action: "read",
            matterId: address.matterId,
          }),
        );
      })
    : addresses;

  return {
    status: enabled ? "configured" : "disabled",
    reason: enabled ? undefined : "not_configured",
    provider:
      !input.auth || input.auth.user.role === "owner_admin" || input.auth.user.role === "auditor"
        ? enabled?.key
        : undefined,
    addresses: addressesForUser.map(({ id, address, matterId, enabled, createdAt }) => ({
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
    return buildInboundEmailStatus({ repository, firmId: request.auth.firmId, auth: request.auth });
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
    const requiresTargetMatter = Boolean(
      contactIds.length > 0 ||
      body.staffTriage?.assignedToUserId ||
      body.staffTriage?.privateNote ||
      body.staffTriage?.followUp,
    );
    if (requiresTargetMatter && !targetMatter) {
      throw Object.assign(
        new Error("Staff triage ownership and follow-up require a target matter"),
        {
          statusCode: 400,
        },
      );
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
    const staffTriageDetail = serializeStaffTriageDetail(updated.metadata.staffTriage);
    const followUp =
      staffTriageDetail?.followUp &&
      typeof staffTriageDetail.followUp === "object" &&
      !Array.isArray(staffTriageDetail.followUp)
        ? (staffTriageDetail.followUp as Record<string, unknown>)
        : undefined;

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
        privateNoteAdded: Boolean(body.staffTriage?.privateNote),
        privateNoteCount: staffTriageDetail?.privateNoteCount,
        followUpChannel: followUp?.channel,
        followUpConsentStatus: followUp?.consentStatus,
        followUpDueAt: followUp?.dueAt,
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
        staffTriage: staffTriageDetail,
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
