import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AccessRequest,
  ContactDossier,
  ConversationMessageRecord,
  ConversationThreadRecord,
  EmailEventRecord,
  EmailOutboxRecord,
  EmailReceiptTokenRecord,
  InboundEmailMessageRecord,
} from "@open-practice/domain";
import { requireAccess } from "../../http/auth-guards.js";
import { parseRequestPart } from "../../http/validation.js";
import type { ApiAuthContext } from "../../server.js";
import { emailDeliveryReceiptStatus } from "../outbound-email.js";
import type { ApiRouteDependencies } from "../types.js";

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

type CommunicationsChannelHistoryKind =
  | "inbound_email"
  | "outbound_email"
  | "conversation"
  | "phone_note_placeholder"
  | "text_note_placeholder"
  | "client_update_draft";

type CommunicationsChannelHistoryDirection =
  | "inbound"
  | "outbound"
  | "internal"
  | "planned_outbound";

interface CommunicationsChannelHistoryItem {
  id: string;
  matterId: string;
  kind: CommunicationsChannelHistoryKind;
  channel: "email" | "conversation" | "phone" | "text" | "client_update";
  direction: CommunicationsChannelHistoryDirection;
  occurredAt: string;
  status: string;
  title: string;
  detail: string;
  sourceResourceType:
    | "inbound_email"
    | "email_outbox"
    | "conversation_thread"
    | "conversation_message";
  sourceResourceId: string;
  metadataRedacted: true;
  bodyRedacted?: true;
  consentStatus?: string;
  recipientCount?: number;
  attachmentCount?: number;
  messageCount?: number;
  eventCount?: number;
  bodyLength?: number;
}

interface ClientUpdateDraftRequestSummary {
  id: string;
  matterId: string;
  threadId: string;
  messageId: string;
  status: "draft_requested" | "thread_closed" | "thread_revoked";
  requestedAt: string;
  requestedByUserIdPresent: boolean;
  bodyLength: number;
  bodyRedacted: true;
  metadataRedacted: true;
  automaticSendEnabled: false;
  portalComposerEnabled: false;
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

function pluralized(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
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

function lastEventAt(email: EmailOutboxRecord, events: EmailEventRecord[]): string {
  return (
    [...events].reverse().find((event) => event.occurredAt)?.occurredAt ??
    email.sentAt ??
    email.failedAt ??
    email.lastAttemptAt ??
    email.queuedAt
  );
}

function serializeConversationThread(
  thread: ConversationThreadRecord,
  messageAuthoredAts: string[],
  notificationSummaries: Array<{ createdAt: string; readAt?: string; mutedAt?: string }> = [],
) {
  const notificationCount = notificationSummaries.length;
  const unreadNotificationCount = notificationSummaries.filter(
    (notification) => !notification.readAt,
  ).length;
  const mutedNotificationCount = notificationSummaries.filter(
    (notification) => notification.mutedAt,
  ).length;
  const latestNotificationAt = notificationSummaries.at(-1)?.createdAt;
  const latestReadAt = [...notificationSummaries]
    .reverse()
    .find((notification) => notification.readAt)?.readAt;
  const latestMutedAt = [...notificationSummaries]
    .reverse()
    .find((notification) => notification.mutedAt)?.mutedAt;
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
    notificationSummary:
      notificationCount > 0
        ? {
            notificationCount,
            unreadNotificationCount,
            mutedNotificationCount,
            latestNotificationAt,
            latestReadAt,
            latestMutedAt,
          }
        : undefined,
  };
}

function conversationLatestAt(
  thread: ConversationThreadRecord,
  messages: ConversationMessageRecord[],
): string {
  return messages.map((message) => message.authoredAt).at(-1) ?? thread.updatedAt;
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

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function sanitizeFollowUp(value: unknown):
  | {
      channel?: string;
      consentStatus?: string;
      dueAt?: string;
    }
  | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const followUp = value as Record<string, unknown>;
  const output = {
    channel: safeString(followUp.channel),
    consentStatus: safeString(followUp.consentStatus),
    dueAt: safeString(followUp.dueAt),
  };
  return output.channel || output.consentStatus || output.dueAt ? output : undefined;
}

function followUpFromInboundMessage(
  message: InboundEmailMessageRecord,
): ReturnType<typeof sanitizeFollowUp> {
  const metadata = message.metadata.staffTriage;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  return sanitizeFollowUp((metadata as Record<string, unknown>).followUp);
}

function normalizePhoneTextChannel(channel: string | undefined): "phone" | "text" | undefined {
  if (channel === "phone") return "phone";
  if (channel === "text" || channel === "sms") return "text";
  return undefined;
}

function isClientUpdateDraftRequest(message: ConversationMessageRecord): boolean {
  return message.metadata.clientUpdateDraft === true;
}

function clientUpdateStatus(
  thread: ConversationThreadRecord,
): ClientUpdateDraftRequestSummary["status"] {
  if (thread.status === "closed") return "thread_closed";
  if (thread.status === "revoked") return "thread_revoked";
  return "draft_requested";
}

function buildClientUpdateDraftRequests(
  conversations: Array<{ thread: ConversationThreadRecord; messages: ConversationMessageRecord[] }>,
): ClientUpdateDraftRequestSummary[] {
  return conversations
    .flatMap(({ thread, messages }) =>
      messages.filter(isClientUpdateDraftRequest).map((message) => ({
        id: `client-update-draft:${message.id}`,
        matterId: message.matterId,
        threadId: thread.id,
        messageId: message.id,
        status: clientUpdateStatus(thread),
        requestedAt: message.authoredAt,
        requestedByUserIdPresent: Boolean(message.authoredByUserId),
        bodyLength: message.bodyText.length,
        bodyRedacted: true as const,
        metadataRedacted: true as const,
        automaticSendEnabled: false as const,
        portalComposerEnabled: false as const,
      })),
    )
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
}

function sortChannelHistory(
  entries: CommunicationsChannelHistoryItem[],
): CommunicationsChannelHistoryItem[] {
  return [...entries].sort((left, right) => {
    const byDate = right.occurredAt.localeCompare(left.occurredAt);
    return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
  });
}

function buildChannelHistory(input: {
  inboundMessages: Array<{
    message: InboundEmailMessageRecord;
    attachmentCount: number;
  }>;
  outboundEmails: Array<{ email: EmailOutboxRecord; events: EmailEventRecord[] }>;
  conversations: Array<{ thread: ConversationThreadRecord; messages: ConversationMessageRecord[] }>;
  clientUpdateDraftRequests: ClientUpdateDraftRequestSummary[];
}): CommunicationsChannelHistoryItem[] {
  const entries: CommunicationsChannelHistoryItem[] = [];

  for (const { message, attachmentCount } of input.inboundMessages) {
    if (!message.matterId) continue;
    entries.push({
      id: `inbound-email:${message.id}`,
      matterId: message.matterId,
      kind: "inbound_email",
      channel: "email",
      direction: "inbound",
      occurredAt: message.receivedAt,
      status: message.status,
      title: "Inbound email",
      detail: `${pluralized(attachmentCount, "attachment")} linked`,
      sourceResourceType: "inbound_email",
      sourceResourceId: message.id,
      metadataRedacted: true,
      bodyRedacted: true,
      attachmentCount,
    });

    const followUp = followUpFromInboundMessage(message);
    const channel = normalizePhoneTextChannel(followUp?.channel);
    if (!channel) continue;
    entries.push({
      id: `${channel}-note-placeholder:${message.id}`,
      matterId: message.matterId,
      kind: channel === "phone" ? "phone_note_placeholder" : "text_note_placeholder",
      channel,
      direction: "planned_outbound",
      occurredAt: followUp?.dueAt ?? message.receivedAt,
      status: "follow_up_placeholder",
      title: channel === "phone" ? "Phone note placeholder" : "Text note placeholder",
      detail: "Staff triage follow-up placeholder",
      sourceResourceType: "inbound_email",
      sourceResourceId: message.id,
      metadataRedacted: true,
      bodyRedacted: true,
      consentStatus: followUp?.consentStatus,
    });
  }

  for (const { email, events } of input.outboundEmails) {
    if (!email.matterId) continue;
    entries.push({
      id: `outbound-email:${email.id}`,
      matterId: email.matterId,
      kind: "outbound_email",
      channel: "email",
      direction: "outbound",
      occurredAt: lastEventAt(email, events),
      status: email.status,
      title: email.templateKey,
      detail: `${pluralized(recipientCount(email), "recipient")} · ${pluralized(
        events.length,
        "delivery event",
      )}`,
      sourceResourceType: "email_outbox",
      sourceResourceId: email.id,
      metadataRedacted: true,
      bodyRedacted: true,
      recipientCount: recipientCount(email),
      eventCount: events.length,
    });
  }

  for (const { thread, messages } of input.conversations) {
    entries.push({
      id: `conversation-thread:${thread.id}`,
      matterId: thread.matterId,
      kind: "conversation",
      channel: "conversation",
      direction: "internal",
      occurredAt: conversationLatestAt(thread, messages),
      status: thread.status,
      title: thread.topic,
      detail: `${pluralized(messages.length, "message")} · ${thread.notificationBoundary.replaceAll(
        "_",
        " ",
      )}`,
      sourceResourceType: "conversation_thread",
      sourceResourceId: thread.id,
      metadataRedacted: true,
      bodyRedacted: true,
      messageCount: messages.length,
    });
  }

  for (const draft of input.clientUpdateDraftRequests) {
    entries.push({
      id: draft.id,
      matterId: draft.matterId,
      kind: "client_update_draft",
      channel: "client_update",
      direction: "planned_outbound",
      occurredAt: draft.requestedAt,
      status: draft.status,
      title: "Client update draft",
      detail: "Draft-only client update request",
      sourceResourceType: "conversation_message",
      sourceResourceId: draft.messageId,
      metadataRedacted: true,
      bodyRedacted: true,
      bodyLength: draft.bodyLength,
    });
  }

  return sortChannelHistory(entries);
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

export function registerCommunicationsInboxRoutes(
  server: FastifyInstance,
  { repository }: Pick<ApiRouteDependencies, "repository">,
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
        notifications: await repository.listConversationMessageNotifications(request.auth.firmId, {
          threadId: thread.id,
          recipientUserId: request.auth.user.id,
        }),
      })),
    );
    const clientUpdateDraftRequests = buildClientUpdateDraftRequests(conversationMessageSummaries);
    const contactCues = contactDossiers
      .filter((dossier) => dossier.matters.some((matter) => matter.matterId === query.matterId))
      .map((dossier) => serializeContactCue(dossier, query.matterId));
    const scopedAddresses = addresses.filter((address) => address.matterId === query.matterId);
    const outboundDeliveryHistory = outboundEvents.map(({ email, events }) =>
      serializeOutboundEmail(email, events, receiptTokenByEmailId.get(email.id)),
    );
    const conversations = conversationMessageSummaries.map(({ thread, messages, notifications }) =>
      serializeConversationThread(
        thread,
        messages.map((message) => message.authoredAt),
        notifications,
      ),
    );

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
      outboundDeliveryHistory,
      conversations,
      channelHistory: buildChannelHistory({
        inboundMessages: inboundWithAttachments.map(({ message, attachments }) => ({
          message,
          attachmentCount: attachments.length,
        })),
        outboundEmails: outboundEvents,
        conversations: conversationMessageSummaries,
        clientUpdateDraftRequests,
      }),
      clientUpdateDraftRequests,
      contactCues,
    };
  });
}
