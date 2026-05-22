import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  ContactDossier,
  ConversationThreadRecord,
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  InboundEmailMessageRecord,
} from "@open-practice/domain";
import { requireAccess } from "../http/auth-guards.js";
import { parseRequestPart } from "../http/validation.js";
import type { ApiAuthContext } from "../server.js";
import { emailDeliveryReceiptStatus } from "./outbound-email.js";
import type { ApiRouteDependencies } from "./types.js";

const inboxQuerySchema = z.object({
  matterId: z.string().min(1),
});

function assertCommunicationsAccess(
  context: ApiAuthContext,
  request: Omit<AccessRequest, "firmId" | "user">,
): void {
  const access = requireAccess(context, request);
  if (!access.ok) throw access.error;
}

function recipientCount(email: EmailOutboxRecord): number {
  return email.to.length + email.cc.length + email.bcc.length;
}

function sanitizeFailureSummary(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const redacted = message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(
      /\b(token|provider(?:Message)?Id|message[-_\s]?id|storage[-_\s]?key|checksum)\s*[:=]\s*[^,\s;]+/gi,
      "$1=[redacted]",
    );
  return redacted.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function serializeInboundEmail(message: InboundEmailMessageRecord, attachmentCount: number) {
  return {
    id: message.id,
    matterId: message.matterId,
    status: message.status,
    labels: message.labels,
    receivedAt: message.receivedAt,
    attachmentCount,
    triage: sanitizeStaffTriage(message.metadata.staffTriage),
  };
}

function serializeOutboundEmail(
  email: EmailOutboxRecord,
  events: EmailEventRecord[],
  receiptToken?: EmailReceiptTokenRecord,
) {
  const latestFailure = [...events].reverse().find((event) => event.eventType === "failed");
  return {
    id: email.id,
    matterId: email.matterId,
    templateKey: email.templateKey,
    status: email.status,
    relatedResourceType: email.relatedResourceType,
    relatedResourceId: email.relatedResourceId,
    recipientCount: recipientCount(email),
    attemptCount: email.attemptCount,
    queuedAt: email.queuedAt,
    lastAttemptAt: email.lastAttemptAt,
    sentAt: email.sentAt,
    failedAt: email.failedAt,
    terminalFailureAt: email.terminalFailureAt,
    failureSummary:
      sanitizeFailureSummary(email.terminalFailureReason) ??
      sanitizeFailureSummary(latestFailure?.errorMessage),
    deliveryReceipt: emailDeliveryReceiptStatus(email, receiptToken),
    events: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      attemptNumber: event.attemptNumber,
      source: event.source,
      errorSummary: sanitizeFailureSummary(event.errorMessage),
    })),
  };
}

function serializeConversationThread(
  thread: ConversationThreadRecord,
  messageAuthoredAts: string[],
) {
  return {
    id: thread.id,
    matterId: thread.matterId,
    topic: thread.topic,
    status: thread.status,
    exportState: thread.exportState,
    notificationBoundary: thread.notificationBoundary,
    retentionUntil: thread.retentionUntil,
    accessRevokedAt: thread.accessRevokedAt,
    updatedAt: thread.updatedAt,
    messageCount: messageAuthoredAts.length,
    latestMessageAt: messageAuthoredAts.at(-1),
  };
}

function serializeContactCue(dossier: ContactDossier, matterId: string) {
  const matterLinks = dossier.matters.filter((matter) => matter.matterId === matterId);
  return {
    contact: {
      id: dossier.contact.id,
      kind: dossier.contact.kind,
      displayName: dossier.contact.displayName,
    },
    matterLinks: matterLinks.map((link) => ({
      matterId: link.matterId,
      role: link.role,
      adverse: link.adverse,
      confidential: link.confidential,
      portalActive: link.portalActive,
      portalPermissionCount: link.portalPermissions.length,
    })),
    cueSummary: {
      conflictCueCount: dossier.conflictCues.filter(
        (cue) => !cue.matterId || cue.matterId === matterId,
      ).length,
      qualitySignalCount: dossier.qualityReview.signals.filter(
        (signal) => !signal.matterId || signal.matterId === matterId,
      ).length,
      portalActiveGrantCount: matterLinks.filter((link) => link.portalActive).length,
    },
  };
}

function sanitizeStaffTriage(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (typeof input.status === "string") output.status = input.status;
  if (typeof input.assignedToUserId === "string") output.assignedToUserId = input.assignedToUserId;
  if (Array.isArray(input.contactIds)) {
    output.contactIds = input.contactIds.filter((id): id is string => typeof id === "string");
  }
  const privateNotes = Array.isArray(input.privateNotes)
    ? input.privateNotes.filter(
        (note): note is { createdAt: string } =>
          Boolean(note) &&
          typeof note === "object" &&
          !Array.isArray(note) &&
          typeof (note as Record<string, unknown>).createdAt === "string",
      )
    : [];
  if (privateNotes.length > 0) {
    output.privateNoteCount = privateNotes.length;
    output.latestPrivateNoteAt = privateNotes.at(-1)?.createdAt;
  }
  if (input.followUp && typeof input.followUp === "object" && !Array.isArray(input.followUp)) {
    const followUp = input.followUp as Record<string, unknown>;
    const safeFollowUp: Record<string, unknown> = {};
    if (typeof followUp.channel === "string") safeFollowUp.channel = followUp.channel;
    if (typeof followUp.consentStatus === "string") {
      safeFollowUp.consentStatus = followUp.consentStatus;
    }
    if (typeof followUp.dueAt === "string") safeFollowUp.dueAt = followUp.dueAt;
    if (Object.keys(safeFollowUp).length > 0) output.followUp = safeFollowUp;
  }
  if (typeof input.updatedAt === "string") output.updatedAt = input.updatedAt;
  if (typeof input.updatedByUserId === "string") output.updatedByUserId = input.updatedByUserId;
  return Object.keys(output).length > 0 ? output : undefined;
}

export function registerCommunicationsRoutes(
  server: FastifyInstance,
  { repository }: ApiRouteDependencies,
): void {
  server.get("/api/communications/inbox", async (request) => {
    const query = parseRequestPart(inboxQuerySchema, request.query, "query");
    assertCommunicationsAccess(request.auth, {
      resource: "inbound_email",
      action: "read",
      matterId: query.matterId,
    });
    assertCommunicationsAccess(request.auth, {
      resource: "email",
      action: "read",
      matterId: query.matterId,
    });
    assertCommunicationsAccess(request.auth, {
      resource: "conversation_thread",
      action: "read",
      matterId: query.matterId,
    });
    assertCommunicationsAccess(request.auth, { resource: "contact", action: "read" });

    const [
      inboundMessages,
      outboundEmails,
      conversationThreads,
      contactDossiers,
      addresses,
      inboundProviders,
      smtpProviders,
    ] = await Promise.all([
      repository.listInboundEmailMessages(request.auth.firmId, { matterId: query.matterId }),
      repository.listEmailOutbox(request.auth.firmId, { matterId: query.matterId, limit: 10 }),
      repository.listConversationThreads(request.auth.firmId, { matterId: query.matterId }),
      repository.listContactDossiersForUser(request.auth.user),
      repository.listInboundEmailAddresses(request.auth.firmId),
      repository.listProviderSettings(request.auth.firmId, { kind: "inbound_email" }),
      repository.listProviderSettings(request.auth.firmId, { kind: "smtp" }),
    ]);
    const inboundWithAttachments = await Promise.all(
      inboundMessages.map(async (message) => ({
        message,
        attachments: await repository.listInboundEmailAttachments(request.auth.firmId, message.id),
      })),
    );
    const outboundEvents = await Promise.all(
      outboundEmails.map(async (email) => ({
        email,
        events: await repository.listEmailEvents(request.auth.firmId, { emailId: email.id }),
      })),
    );
    const receiptTokens = await repository.listEmailReceiptTokens(request.auth.firmId, {
      matterId: query.matterId,
    });
    const receiptTokenByEmailId = new Map(
      receiptTokens.map((receiptToken) => [receiptToken.emailId, receiptToken]),
    );
    const conversationMessageSummaries = await Promise.all(
      conversationThreads.map(async (thread) => ({
        thread,
        messages: await repository.listConversationMessages(request.auth.firmId, {
          threadId: thread.id,
        }),
      })),
    );
    const contactCues = contactDossiers
      .filter((dossier) => dossier.matters.some((matter) => matter.matterId === query.matterId))
      .map((dossier) => serializeContactCue(dossier, query.matterId));
    const scopedAddresses = addresses.filter((address) => address.matterId === query.matterId);

    return {
      status: "available",
      matterId: query.matterId,
      channelState: {
        inboundEmailStatus: inboundProviders.some((provider) => provider.enabled)
          ? "configured"
          : "disabled",
        outboundEmailStatus: smtpProviders.some((provider) => provider.enabled)
          ? "configured"
          : "disabled",
        inboundEmailAddressCount: scopedAddresses.length,
        enabledInboundEmailAddressCount: scopedAddresses.filter((address) => address.enabled)
          .length,
      },
      inboundEmail: inboundWithAttachments.map(({ message, attachments }) =>
        serializeInboundEmail(message, attachments.length),
      ),
      outboundDeliveryHistory: outboundEvents.map(({ email, events }) =>
        serializeOutboundEmail(email, events, receiptTokenByEmailId.get(email.id)),
      ),
      conversations: conversationMessageSummaries.map(({ thread, messages }) =>
        serializeConversationThread(
          thread,
          messages.map((message) => message.authoredAt),
        ),
      ),
      contactCues,
    };
  });
}
