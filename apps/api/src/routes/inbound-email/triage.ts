import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { InboundEmailMessageRecord } from "@open-practice/domain";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  assertInboundEmailAccess,
  currentPrivateNotes,
  inboundEmailMessageParamsSchema,
  safeFollowUp,
  serializeStaffTriageDetail,
} from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

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

function currentStaffTriage(message: InboundEmailMessageRecord): Record<string, unknown> {
  const triage = message.metadata.staffTriage;
  if (!triage || typeof triage !== "object" || Array.isArray(triage)) return {};
  return triage as Record<string, unknown>;
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

export function registerInboundEmailTriageRoutes(
  server: FastifyInstance,
  { repository }: InboundEmailRouteDependencies,
): void {
  server.patch("/api/communications/inbox/inbound-email/:id", async (request) => {
    const params = parseRequestPart(inboundEmailMessageParamsSchema, request.params, "params");
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
}
