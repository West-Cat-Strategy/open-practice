import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import { appendRouteAuditEvent } from "../audit-events.js";
import {
  assertInboundEmailAccess,
  inboundEmailMessageParamsSchema,
  serializeInboundEmailMatterDraft,
} from "./shared.js";
import type { InboundEmailRouteDependencies } from "./shared.js";

const provinceSchema = z.enum(["BC", "ON", "CANADA", "OTHER"]);

const matterDraftBodySchema = z
  .object({
    redactedBodySummary: z.string().trim().min(1).max(600),
    proposedMatter: z
      .object({
        title: z.string().trim().min(1).max(160),
        practiceArea: z.string().trim().min(1).max(120),
        jurisdiction: provinceSchema,
        client: z
          .object({
            kind: z.enum(["person", "organization"]),
            displayName: z.string().trim().min(1).max(160),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

type MatterDraftBody = z.infer<typeof matterDraftBodySchema>;

function senderSummary(fromAddress: string): string {
  const domain = fromAddress.includes("@") ? fromAddress.split("@").pop()?.trim() : undefined;
  return domain ? `redacted sender at ${domain.slice(0, 120)}` : "redacted sender";
}

function buildMatterDraftMetadata(input: {
  body: MatterDraftBody;
  createdAt: string;
  createdByUserId: string;
  message: {
    id: string;
    messageId?: string;
    fromAddress: string;
    toAddresses: string[];
    subject: string;
    receivedAt: string;
  };
  attachmentCount: number;
}) {
  return {
    status: "drafted",
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    source: {
      inboundMessageId: input.message.id,
      providerMessageIdPresent: Boolean(input.message.messageId),
      receivedAt: input.message.receivedAt,
      recipientCount: input.message.toAddresses.length,
      subjectPresent: input.message.subject.trim().length > 0,
      senderSummary: senderSummary(input.message.fromAddress),
      attachmentCount: input.attachmentCount,
    },
    redactedBodySummary: input.body.redactedBodySummary.trim(),
    proposedMatter: {
      title: input.body.proposedMatter.title.trim(),
      practiceArea: input.body.proposedMatter.practiceArea.trim(),
      jurisdiction: input.body.proposedMatter.jurisdiction,
      client: {
        kind: input.body.proposedMatter.client.kind,
        displayName: input.body.proposedMatter.client.displayName.trim(),
      },
    },
    automaticMatterCreation: false,
    bodyRedacted: true,
    metadataRedacted: true,
  };
}

export function registerInboundEmailMatterDraftRoutes(
  server: FastifyInstance,
  { repository }: InboundEmailRouteDependencies,
): void {
  server.post("/api/inbound-email/messages/:id/matter-draft", async (request) => {
    const params = parseRequestPart(inboundEmailMessageParamsSchema, request.params, "params");
    const body = parseRequestPart(matterDraftBodySchema, request.body ?? {}, "body");
    const message = await repository.getInboundEmailMessage(request.auth.firmId, params.id);
    if (!message) {
      throw Object.assign(new Error("Inbound email message was not found"), { statusCode: 404 });
    }
    if (message.matterId) {
      throw Object.assign(new Error("Matter draft requires an unscoped inbound email"), {
        statusCode: 400,
      });
    }

    assertInboundEmailAccess(request.auth, {
      resource: "inbound_email",
      action: "read",
    });
    assertInboundEmailAccess(request.auth, {
      resource: "inbound_email",
      action: "update",
    });
    const matterCreateAccess = requireAccess(request.auth, {
      resource: "matter",
      action: "create",
    });
    if (!matterCreateAccess.ok) throw matterCreateAccess.error;

    const attachments = await repository.listInboundEmailAttachments(
      request.auth.firmId,
      message.id,
    );
    const createdAt = new Date().toISOString();
    const matterDraft = buildMatterDraftMetadata({
      body,
      createdAt,
      createdByUserId: request.auth.user.id,
      message,
      attachmentCount: attachments.length,
    });
    const updated = await repository.updateInboundEmailMessage(request.auth.firmId, message.id, {
      metadata: {
        ...message.metadata,
        matterDraft,
      },
    });

    await appendRouteAuditEvent(repository, request.auth, {
      action: "inbound_email.matter_draft.confirmed",
      resourceType: "inbound_email",
      resourceId: updated.id,
      metadata: {
        sourceMessageId: updated.id,
        providerMessageIdPresent: Boolean(updated.messageId),
        receivedAt: updated.receivedAt,
        recipientCount: updated.toAddresses.length,
        attachmentCount: attachments.length,
        subjectPresent: updated.subject.trim().length > 0,
        redactedSummaryLength: matterDraft.redactedBodySummary.length,
        proposedTitleLength: matterDraft.proposedMatter.title.length,
        proposedPracticeArea: matterDraft.proposedMatter.practiceArea,
        proposedJurisdiction: matterDraft.proposedMatter.jurisdiction,
        clientKind: matterDraft.proposedMatter.client.kind,
        automaticMatterCreation: false,
      },
    });

    return {
      status: "drafted",
      message: {
        id: updated.id,
        matterId: updated.matterId,
        status: updated.status,
        matterDraft: serializeInboundEmailMatterDraft(updated.metadata.matterDraft),
      },
    };
  });
}
