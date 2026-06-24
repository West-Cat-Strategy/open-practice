import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "@open-practice/database";
import type {
  ConversationMessageNotificationRecord,
  EmailEventRecord,
  EmailOutboxRecord,
  JobLifecycleRecord,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import { authorizationFixtureCases } from "@open-practice/domain/authorization-fixtures";
import { hashToken } from "../http/auth-helpers.js";
import { registerClientPortalRoutes } from "./client-portal.js";

const jwtSecret = "client-portal-test-secret-at-least-32-chars";
const servers: FastifyInstance[] = [];
const dayMs = 24 * 60 * 60 * 1000;

function futureIso(msFromNow = 7 * dayMs): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
    client_external: "client-ada",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId: "firm-west-legal",
    displayName: `Test ${role}`,
    email: role === "client_external" ? "ada@example.test" : `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: false,
  };
}

function testServer(input: {
  repository: InMemoryOpenPracticeRepository;
  authUser?: User;
  jwtSecret?: string;
}): FastifyInstance {
  const server = Fastify({ logger: false });
  const authUser = input.authUser ?? user("owner_admin", ["matter-001", "matter-002"]);
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerClientPortalRoutes(server, {
    repository: input.repository,
    jwtSecret: input.jwtSecret ?? jwtSecret,
  });
  servers.push(server);
  return server;
}

class ClientPortalWorkspaceBatchRepository extends InMemoryOpenPracticeRepository {
  grantContactPairReads = 0;
  workspaceBatchReads = 0;
  blockPerSignatureWorkspaceReads = false;

  override async listClientPortalGrantContactPairs(
    input: Parameters<InMemoryOpenPracticeRepository["listClientPortalGrantContactPairs"]>[0],
  ): ReturnType<InMemoryOpenPracticeRepository["listClientPortalGrantContactPairs"]> {
    this.grantContactPairReads += 1;
    return super.listClientPortalGrantContactPairs(input);
  }

  override async listClientPortalWorkspaceBatch(
    firmId: Parameters<InMemoryOpenPracticeRepository["listClientPortalWorkspaceBatch"]>[0],
    options: Parameters<InMemoryOpenPracticeRepository["listClientPortalWorkspaceBatch"]>[1],
  ): ReturnType<InMemoryOpenPracticeRepository["listClientPortalWorkspaceBatch"]> {
    this.workspaceBatchReads += 1;
    return super.listClientPortalWorkspaceBatch(firmId, options);
  }

  override async listSignatureRequests(
    firmId: Parameters<InMemoryOpenPracticeRepository["listSignatureRequests"]>[0],
    options: Parameters<InMemoryOpenPracticeRepository["listSignatureRequests"]>[1] = {},
  ): ReturnType<InMemoryOpenPracticeRepository["listSignatureRequests"]> {
    if (this.blockPerSignatureWorkspaceReads) {
      throw new Error("Client portal workspace should use the workspace batch signature requests");
    }
    return super.listSignatureRequests(firmId, options);
  }

  override async listSignatureRequestSigners(
    firmId: Parameters<InMemoryOpenPracticeRepository["listSignatureRequestSigners"]>[0],
    signatureRequestId: Parameters<
      InMemoryOpenPracticeRepository["listSignatureRequestSigners"]
    >[1],
  ): ReturnType<InMemoryOpenPracticeRepository["listSignatureRequestSigners"]> {
    if (this.blockPerSignatureWorkspaceReads) {
      throw new Error("Client portal workspace should use batched signature signers");
    }
    return super.listSignatureRequestSigners(firmId, signatureRequestId);
  }

  override async listSignatureProviderEvents(
    firmId: Parameters<InMemoryOpenPracticeRepository["listSignatureProviderEvents"]>[0],
    options: Parameters<InMemoryOpenPracticeRepository["listSignatureProviderEvents"]>[1] = {},
  ): ReturnType<InMemoryOpenPracticeRepository["listSignatureProviderEvents"]> {
    if (this.blockPerSignatureWorkspaceReads) {
      throw new Error("Client portal workspace should use batched signature events");
    }
    return super.listSignatureProviderEvents(firmId, options);
  }
}

class ClientPortalNotificationRepository extends InMemoryOpenPracticeRepository {
  syntheticConversationNotifications: ConversationMessageNotificationRecord[] = [];

  override async listConversationMessageNotifications(
    firmId: Parameters<InMemoryOpenPracticeRepository["listConversationMessageNotifications"]>[0],
    options: Parameters<
      InMemoryOpenPracticeRepository["listConversationMessageNotifications"]
    >[1] = {},
  ): ReturnType<InMemoryOpenPracticeRepository["listConversationMessageNotifications"]> {
    const threadIds = options.threadId ? [options.threadId] : options.threadIds;
    const syntheticNotifications = this.syntheticConversationNotifications.filter(
      (notification) => {
        if (notification.firmId !== firmId) return false;
        if (threadIds && !threadIds.includes(notification.threadId)) return false;
        if (options.matterId && notification.matterId !== options.matterId) return false;
        if (options.recipientUserId && notification.recipientUserId !== options.recipientUserId) {
          return false;
        }
        if (options.messageId && notification.messageId !== options.messageId) return false;
        return true;
      },
    );
    return [
      ...(await super.listConversationMessageNotifications(firmId, options)),
      ...syntheticNotifications,
    ].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
  }
}

class ClientPortalFocusedSignatureRepository extends InMemoryOpenPracticeRepository {
  focusedSignatureReads = 0;

  override async getSignatureRequest(
    firmId: Parameters<InMemoryOpenPracticeRepository["getSignatureRequest"]>[0],
    signatureRequestId: Parameters<InMemoryOpenPracticeRepository["getSignatureRequest"]>[1],
  ): ReturnType<InMemoryOpenPracticeRepository["getSignatureRequest"]> {
    this.focusedSignatureReads += 1;
    return super.getSignatureRequest(firmId, signatureRequestId);
  }

  override async listSignatureRequests(
    firmId: Parameters<InMemoryOpenPracticeRepository["listSignatureRequests"]>[0],
    options: Parameters<InMemoryOpenPracticeRepository["listSignatureRequests"]>[1] = {},
  ): ReturnType<InMemoryOpenPracticeRepository["listSignatureRequests"]> {
    if (!options.matterId) {
      throw new Error("Client portal signature detail should use focused signature lookup");
    }
    return super.listSignatureRequests(firmId, options);
  }
}

async function addMatterTwoAdaPortalGrant(
  repository: InMemoryOpenPracticeRepository,
  clientAccount: User,
): Promise<void> {
  await repository.createMatterContactAssociation({
    id: `party-${clientAccount.id}-matter-002`,
    firmId: "firm-west-legal",
    matterId: "matter-002",
    contactId: "contact-ada",
    role: "client",
    adverse: false,
    confidential: true,
  });
  await repository.createPortalGrant({
    id: `portal-grant-${clientAccount.id}-matter-002`,
    firmId: "firm-west-legal",
    matterId: "matter-002",
    contactId: "contact-ada",
    accountUserId: clientAccount.id,
    grantedByUserId: "user-admin",
    permissions: ["message"],
  });
}

async function addMatterOneAdaPortalGrant(
  repository: InMemoryOpenPracticeRepository,
  clientAccount: User,
): Promise<void> {
  await repository.createPortalGrant({
    id: `portal-grant-${clientAccount.id}-matter-001`,
    firmId: "firm-west-legal",
    matterId: "matter-001",
    contactId: "contact-ada",
    accountUserId: clientAccount.id,
    grantedByUserId: "user-admin",
    permissions: ["message"],
  });
}

async function addConversationThread(
  repository: InMemoryOpenPracticeRepository,
  input: {
    id: string;
    matterId: string;
    status?: "open" | "closed" | "revoked";
    accessRevokedAt?: string;
    updatedAt?: string;
  },
): Promise<void> {
  const createdAt = "2026-05-22T10:00:00.000Z";
  await repository.createConversationThread({
    id: input.id,
    firmId: "firm-west-legal",
    matterId: input.matterId,
    topic: `Synthetic ${input.id}`,
    status: input.status ?? "open",
    exportState: "not_requested",
    accessRevokedAt: input.accessRevokedAt,
    notificationBoundary: "internal_only",
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: { privateTopic: "not exposed" },
  });
}

function syntheticConversationNotification(input: {
  id: string;
  matterId: string;
  threadId: string;
  recipientUserId: string;
  createdAt?: string;
  readAt?: string;
  mutedAt?: string;
}): ConversationMessageNotificationRecord {
  return {
    id: input.id,
    firmId: "firm-west-legal",
    matterId: input.matterId,
    threadId: input.threadId,
    messageId: `message-${input.id}`,
    recipientUserId: input.recipientUserId,
    readAt: input.readAt,
    mutedAt: input.mutedAt,
    createdAt: input.createdAt ?? "2026-05-22T10:01:00.000Z",
    updatedAt: input.createdAt ?? "2026-05-22T10:01:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: {},
  };
}

async function createClientShareableDocument(
  repository: InMemoryOpenPracticeRepository,
  input: { id: string; title?: string },
): Promise<void> {
  const checksumSha256 = "a".repeat(64);
  await repository.createDocumentUploadIntent({
    id: input.id,
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: input.title ?? "Client visible disclosure.pdf",
    storageKey: `matters/matter-001/private-${input.id}.pdf`,
    checksumSha256,
    classification: "general",
    legalHold: false,
  });
  await repository.completeDocumentUpload({
    firmId: "firm-west-legal",
    documentId: input.id,
    checksumSha256,
    scanStatus: "passed",
  });
}

async function addClientPortalRecords(repository: InMemoryOpenPracticeRepository): Promise<void> {
  const durableLinkExpiry = futureIso(30 * dayMs);
  const actionExpiry = futureIso();
  const grant = (await repository.listPortalGrants("firm-west-legal")).find(
    (candidate) =>
      candidate.matterId === "matter-001" &&
      candidate.contactId === "contact-ada" &&
      candidate.accountUserId &&
      candidate.permissions.includes("view_documents"),
  );
  if (!grant) throw new Error("Client portal grant missing from test setup");

  await createClientShareableDocument(repository, {
    id: "doc-portal-visible-001",
    title: "Client visible disclosure.pdf",
  });
  await repository.createPortalDocumentAccess({
    id: "portal-document-access-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    documentId: "doc-portal-visible-001",
    portalGrantId: grant.id,
    permission: "view_document",
    grantedByUserId: "user-admin",
    createdAt: "2026-05-20T11:00:00.000Z",
    expiresAt: durableLinkExpiry,
  });

  const clientMeetingEvent = await repository.getCalendarEvent(
    "firm-west-legal",
    "matter-001",
    "calendar-event-002",
  );
  if (!clientMeetingEvent) throw new Error("Client meeting event missing from test setup");
  await repository.upsertCalendarEvent({
    ...clientMeetingEvent,
    updatedAt: "2026-05-20T14:50:00.000Z",
    attendees: [
      ...(clientMeetingEvent.attendees ?? []),
      {
        id: "calendar-attendee-client-portal-ada",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-002",
        name: "Ada Morgan",
        email: "ada@example.test",
        role: "required",
        responseStatus: "needs_action",
        invitationStatus: "not_sent",
        createdAt: "2026-05-20T14:50:00.000Z",
        updatedAt: "2026-05-20T14:50:00.000Z",
        createdByUserId: "user-admin",
        updatedByUserId: "user-admin",
      },
    ],
  });
  await repository.upsertCalendarEvent({
    id: "calendar-event-other-client-portal-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    uid: "calendar-event-other-client-portal-001@open-practice.local",
    title: "Other client preparation call",
    startsAt: "2026-05-08T18:00:00.000Z",
    endsAt: "2026-05-08T18:30:00.000Z",
    status: "tentative",
    sequence: 0,
    createdAt: "2026-05-20T14:51:00.000Z",
    updatedAt: "2026-05-20T14:51:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    attendees: [
      {
        id: "calendar-attendee-client-portal-other",
        firmId: "firm-west-legal",
        matterId: "matter-001",
        eventId: "calendar-event-other-client-portal-001",
        name: "Other Client",
        email: "other-client@example.test",
        role: "required",
        responseStatus: "needs_action",
        invitationStatus: "not_sent",
        createdAt: "2026-05-20T14:51:00.000Z",
        updatedAt: "2026-05-20T14:51:00.000Z",
        createdByUserId: "user-admin",
        updatedByUserId: "user-admin",
      },
    ],
  });

  await repository.createSignatureRequest({
    request: {
      id: "signature-client-portal-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      documentId: "doc-portal-visible-001",
      title: "Client portal retainer signature",
      requestedByUserId: "user-admin",
      provider: "embedded",
      externalId: "embedded:private-client-portal-signature",
      status: "sent",
      signingUrl: "https://sign.example.test/private-signing-url",
      consentText: "PRIVATE signature consent text",
      evidence: { privateProviderEvidence: "do not expose" },
      createdAt: "2026-05-20T11:05:00.000Z",
    },
    signers: [
      {
        id: "signature-client-portal-signer-001",
        firmId: "firm-west-legal",
        signatureRequestId: "signature-client-portal-001",
        name: "Ada Morgan",
        email: "ada@example.test",
        role: "client",
        status: "sent",
        signingUrl: "https://sign.example.test/private-signer-url",
      },
      {
        id: "signature-client-portal-signer-002",
        firmId: "firm-west-legal",
        signatureRequestId: "signature-client-portal-001",
        name: "Synthetic Witness",
        email: "witness@example.test",
        role: "witness",
        status: "sent",
        signingUrl: "https://sign.example.test/private-witness-url",
      },
    ],
    event: {
      id: "signature-client-portal-event-001",
      firmId: "firm-west-legal",
      signatureRequestId: "signature-client-portal-001",
      provider: "embedded",
      externalId: "embedded:private-client-portal-signature",
      status: "sent",
      occurredAt: "2026-05-20T11:05:00.000Z",
      evidence: { privateProviderEvidence: "do not expose" },
    },
  });

  await repository.createShareLink({
    id: "share-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    tokenHash: "secret-share-token-hash",
    grantedByUserId: "user-admin",
    permissions: ["view_documents"],
    requireEmailVerification: true,
    expiresAt: durableLinkExpiry,
    createdAt: "2026-05-20T12:00:00.000Z",
  });

  await repository.createExternalUploadLink({
    id: "external-upload-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    tokenHash: "secret-upload-token-hash",
    requestedByUserId: "user-admin",
    expiresAt: durableLinkExpiry,
    maxUploads: 2,
    usedUploads: 1,
    createdAt: "2026-05-20T13:00:00.000Z",
  });
  await repository.createDocumentUploadIntent({
    id: "doc-external-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    title: "Client upload.pdf",
    storageKey: "external-uploads/external-upload-client-001/client-upload.pdf",
    checksumSha256: "c".repeat(64),
    classification: "general",
    legalHold: false,
    externalUploadLinkId: "external-upload-client-001",
  });
  await repository.completeDocumentUpload({
    firmId: "firm-west-legal",
    documentId: "doc-external-client-001",
    checksumSha256: "c".repeat(64),
    scanStatus: "passed",
  });
  await repository.reviewUploadedDocument({
    firmId: "firm-west-legal",
    documentId: "doc-external-client-001",
    status: "retry_requested",
    decision: "request_retry",
    reason: "unreadable",
    metadata: { privateReviewNote: "do not expose" },
    reviewedByUserId: "user-admin",
    reviewedAt: "2026-05-21T10:00:00.000Z",
  });

  await repository.createIntakeFormLink({
    id: "intake-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    intakeSessionId: "intake-session-001",
    tokenHash: "secret-intake-token-hash",
    requestedByUserId: "user-admin",
    clientContactId: "contact-ada",
    expiresAt: actionExpiry,
    createdAt: "2026-05-20T14:00:00.000Z",
  });
  await repository.upsertIntakeFormItemAction({
    id: "intake-action-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    intakeSessionId: "intake-session-001",
    formLinkId: "intake-client-001",
    itemId: "evidence-upload",
    kind: "upload",
    status: "intent_created",
    evidence: { storageKey: "private-intake-storage-key" },
    createdAt: "2026-05-20T14:05:00.000Z",
  });

  await repository.createCalendarMeetingSession({
    id: "meeting-session-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    eventId: "calendar-event-002",
    status: "lobby_open",
    retentionUntil: futureIso(14 * dayMs),
    createdAt: "2026-05-20T14:55:00.000Z",
    updatedAt: "2026-05-20T14:55:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: {},
  });

  await repository.createCalendarGuestLink({
    id: "guest-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    eventId: "calendar-event-002",
    sessionId: "meeting-session-001",
    tokenHash: "secret-guest-token-hash",
    status: "issued",
    expiresAt: actionExpiry,
    createdAt: "2026-05-20T15:00:00.000Z",
    updatedAt: "2026-05-20T15:00:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: { providerRoomId: "private-room-id" },
  });

  await repository.createCalendarMeetingSession({
    id: "meeting-session-other-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    eventId: "calendar-event-other-client-portal-001",
    status: "lobby_open",
    retentionUntil: futureIso(14 * dayMs),
    createdAt: "2026-05-20T15:05:00.000Z",
    updatedAt: "2026-05-20T15:05:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: {},
  });
  await repository.createCalendarGuestLink({
    id: "guest-other-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    eventId: "calendar-event-other-client-portal-001",
    sessionId: "meeting-session-other-client-001",
    tokenHash: "secret-other-guest-token-hash",
    status: "issued",
    expiresAt: actionExpiry,
    createdAt: "2026-05-20T15:06:00.000Z",
    updatedAt: "2026-05-20T15:06:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: { providerRoomId: "private-other-room-id" },
  });

  const email: EmailOutboxRecord = {
    id: "email-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    templateKey: "client.update",
    status: "sent",
    to: ["ada@example.test"],
    cc: [],
    bcc: [],
    from: "office@example.test",
    subject: "Synthetic update",
    htmlBody: "<p>PRIVATE HTML BODY</p>",
    textBody: "PRIVATE TEXT BODY",
    queuedAt: "2026-05-20T16:00:00.000Z",
    sentAt: "2026-05-20T16:02:00.000Z",
    attemptCount: 1,
    metadata: { privateMetadata: "do not expose" },
  };
  const event: EmailEventRecord = {
    id: "email-event-client-001",
    firmId: "firm-west-legal",
    emailId: email.id,
    eventType: "sent",
    occurredAt: "2026-05-20T16:02:00.000Z",
    source: "api",
    metadata: {},
  };
  const job: JobLifecycleRecord = {
    id: "job-email-client-001",
    firmId: "firm-west-legal",
    queueName: "email",
    jobName: "send_email",
    status: "completed",
    targetResourceType: "email_outbox",
    targetResourceId: email.id,
    attemptsMade: 1,
    maxAttempts: 3,
    queuedAt: "2026-05-20T16:00:00.000Z",
    finishedAt: "2026-05-20T16:02:00.000Z",
    metadata: { emailId: email.id },
  };
  await repository.createQueuedEmailOutbox({ email, event, job });
  const otherClientEmail: EmailOutboxRecord = {
    ...email,
    id: "email-client-other-001",
    to: ["other-client@example.test"],
    subject: "Other synthetic update",
    queuedAt: "2026-05-20T16:05:00.000Z",
    sentAt: "2026-05-20T16:06:00.000Z",
  };
  await repository.createQueuedEmailOutbox({
    email: otherClientEmail,
    event: {
      ...event,
      id: "email-event-client-other-001",
      emailId: otherClientEmail.id,
      occurredAt: "2026-05-20T16:06:00.000Z",
    },
    job: {
      ...job,
      id: "job-email-client-other-001",
      targetResourceId: otherClientEmail.id,
      finishedAt: "2026-05-20T16:06:00.000Z",
      metadata: { emailId: otherClientEmail.id },
    },
  });
  await repository.createEmailReceiptToken({
    id: "receipt-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    emailId: email.id,
    tokenHash: "secret-receipt-token-hash",
    purpose: "delivery_receipt",
    expiresAt: actionExpiry,
    createdAt: "2026-05-20T16:01:00.000Z",
    metadata: { privateReceiptMetadata: "do not expose" },
  });

  await repository.createConversationThread({
    id: "thread-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    topic: "PRIVATE client message topic",
    status: "open",
    exportState: "not_requested",
    notificationBoundary: "internal_only",
    createdAt: "2026-05-20T16:30:00.000Z",
    updatedAt: "2026-05-20T16:35:00.000Z",
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    metadata: { privateThreadMetadata: "do not expose" },
  });

  await repository.createInvoice({
    invoice: {
      id: "invoice-client-paid-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      clientContactId: "contact-ada",
      invoiceNumber: "INV-2026-PAID",
      status: "paid",
      issuedAt: "2026-05-19T12:00:00.000Z",
      dueAt: "2026-05-30T12:00:00.000Z",
      memo: "PRIVATE paid invoice memo",
      createdByUserId: "user-admin",
      createdAt: "2026-05-19T12:00:00.000Z",
      subtotalCents: 5000,
      taxCents: 250,
      totalCents: 5250,
      paidCents: 5250,
      balanceDueCents: 0,
    },
    lines: [
      {
        id: "invoice-line-client-paid-001",
        firmId: "firm-west-legal",
        invoiceId: "invoice-client-paid-001",
        matterId: "matter-001",
        kind: "adjustment",
        description: "PRIVATE paid line detail",
        quantity: 1,
        unitAmountCents: 5000,
        subtotalCents: 5000,
        taxRateBps: 500,
        taxCents: 250,
        totalCents: 5250,
        createdAt: "2026-05-19T12:00:00.000Z",
      },
    ],
  });

  for (const invoice of [
    {
      id: "invoice-client-draft-001",
      clientContactId: "contact-ada",
      invoiceNumber: "INV-2026-DRAFT",
      status: "draft" as const,
      memo: "PRIVATE draft invoice memo",
    },
    {
      id: "invoice-client-approved-001",
      clientContactId: "contact-ada",
      invoiceNumber: "INV-2026-APPROVED",
      status: "approved" as const,
      memo: "PRIVATE approved invoice memo",
    },
    {
      id: "invoice-client-void-001",
      clientContactId: "contact-ada",
      invoiceNumber: "INV-2026-VOID",
      status: "void" as const,
      memo: "PRIVATE void invoice memo",
    },
    {
      id: "invoice-other-client-001",
      clientContactId: "contact-other-client",
      invoiceNumber: "INV-2026-OTHER",
      status: "issued" as const,
      memo: "PRIVATE other-client invoice memo",
    },
  ]) {
    await repository.createInvoice({
      invoice: {
        ...invoice,
        firmId: "firm-west-legal",
        matterId: "matter-001",
        createdByUserId: "user-admin",
        createdAt: "2026-05-19T12:30:00.000Z",
        issuedAt: invoice.status === "issued" ? "2026-05-19T12:30:00.000Z" : undefined,
        dueAt: "2026-05-30T12:30:00.000Z",
        subtotalCents: 1000,
        taxCents: 50,
        totalCents: 1050,
        paidCents: 0,
        balanceDueCents: 1050,
      },
      lines: [
        {
          id: `line-${invoice.id}`,
          firmId: "firm-west-legal",
          invoiceId: invoice.id,
          matterId: "matter-001",
          kind: "adjustment",
          description: `PRIVATE ${invoice.invoiceNumber} line detail`,
          quantity: 1,
          unitAmountCents: 1000,
          subtotalCents: 1000,
          taxRateBps: 500,
          taxCents: 50,
          totalCents: 1050,
          createdAt: "2026-05-19T12:30:00.000Z",
        },
      ],
    });
  }

  await repository.createHostedPaymentRequest({
    id: "payment-request-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    invoiceId: "invoice-001",
    clientContactId: "contact-ada",
    status: "sent",
    amountCents: 13230,
    currency: "CAD",
    hostedPath: "/payments/private-client-path",
    delivery: {
      status: "sent",
      channel: "portal",
      recipientCount: 1,
      deliveredAt: "2026-05-20T17:01:00.000Z",
    },
    reminder: {
      status: "scheduled",
      reminderCount: 1,
      nextReminderAt: futureIso(2 * dayMs),
    },
    paymentPlan: {
      status: "not_offered",
      enforcement: "none",
    },
    creditWriteOffPosture: {
      status: "none",
      movement: "none",
    },
    processor: {
      status: "checkout_session_created",
      provider: "stripe",
      externalSessionId: "private-stripe-session",
      checkoutUrl: "https://payments.example.test/private-checkout",
      createdAt: "2026-05-20T17:00:00.000Z",
      expiresAt: futureIso(),
    },
    evidence: { privatePaymentEvidence: "do not expose" },
    createdByUserId: "user-admin",
    createdAt: "2026-05-20T17:00:00.000Z",
    updatedAt: "2026-05-20T17:01:00.000Z",
    expiresAt: futureIso(),
  });

  await repository.createHostedPaymentRequest({
    id: "payment-request-other-client-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    invoiceId: "invoice-001",
    clientContactId: "contact-other-client",
    status: "sent",
    amountCents: 5000,
    currency: "CAD",
    hostedPath: "/payments/other-client-private-path",
    delivery: { status: "sent", channel: "portal", recipientCount: 1 },
    reminder: { status: "not_scheduled", reminderCount: 0 },
    paymentPlan: { status: "not_offered", enforcement: "none" },
    creditWriteOffPosture: { status: "none", movement: "none" },
    processor: { status: "not_started" },
    evidence: { privateOtherClientEvidence: "do not expose" },
    createdByUserId: "user-admin",
    createdAt: "2026-05-20T17:05:00.000Z",
    updatedAt: "2026-05-20T17:05:00.000Z",
    expiresAt: futureIso(),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("client portal routes", () => {
  it("covers the account-bound portal document fixture row", () => {
    expect(
      authorizationFixtureCases
        .filter((item) => item.id === "document:portal-grant:metadata-visible")
        .map((item) => ({
          relation: item.relation,
          expectedDecision: item.expectedDecision,
          listVisible: item.listVisible,
        })),
    ).toEqual([
      {
        relation: "account_bound_portal_grant_holder",
        expectedDecision: "allow",
        listVisible: true,
      },
    ]);
  });

  it("lets staff set up a client account without exposing credential hashes", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });

    const response = await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      account: { id: string; email: string; role: string };
      grant: { status: string; permissions: string[] };
      setup: { status: string; token?: string; expiresAt?: string; userId: string };
    }>();
    expect(body.account).toMatchObject({
      email: "ada@example.test",
      role: "client_external",
    });
    expect(body.grant).toMatchObject({
      status: "active",
      permissions: [
        "view_documents",
        "upload_documents",
        "message",
        "complete_intake",
        "view_invoices",
        "view_appointments_tasks",
        "sign",
      ],
    });
    expect(body.setup.status).toBe("token_created");
    expect(body.setup.token).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("tokenHash");
    const grants = await repository.listPortalGrants("firm-west-legal");
    expect(grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountUserId: body.account.id,
          matterId: "matter-001",
          contactId: "contact-ada",
        }),
      ]),
    );

    const token = await repository.consumePasswordSetupToken(
      hashToken(body.setup.token!, jwtSecret),
      "2026-05-28T12:00:00.000Z",
    );
    expect(token?.userId).toBe(body.account.id);
    const audit = await repository.listAuditEvents("firm-west-legal");
    expect(audit.events.at(-1)).toMatchObject({
      action: "portal.account_setup.created",
      resourceType: "portal_grant",
      metadata: expect.objectContaining({
        matterId: "matter-001",
        contactId: "contact-ada",
        setupTokenStatus: "token_created",
      }),
    });
    expect(JSON.stringify(audit.events.at(-1))).not.toContain("ada@example.test");
    expect(JSON.stringify(audit.events.at(-1))).not.toContain(body.setup.token);
  });

  it("requires account-bound grants before granting confidential client file visibility", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    await createClientShareableDocument(repository, {
      id: "doc-route-visible-001",
      title: "Client visible route disclosure.pdf",
    });

    const legacyGrantResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/document-access",
      payload: {
        matterId: "matter-001",
        contactId: "contact-ada",
        documentId: "doc-route-visible-001",
      },
    });

    expect(legacyGrantResponse.statusCode).toBe(409);
    expect(legacyGrantResponse.json()).toMatchObject({
      code: "PORTAL_DOCUMENT_ACCOUNT_GRANT_REQUIRED",
    });

    await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });
    const grantResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/document-access",
      payload: {
        matterId: "matter-001",
        contactId: "contact-ada",
        documentId: "doc-route-visible-001",
      },
    });

    expect(grantResponse.statusCode).toBe(201);
    expect(grantResponse.json()).toMatchObject({
      access: {
        matterId: "matter-001",
        documentId: "doc-route-visible-001",
        permission: "view_document",
      },
    });
    const access = grantResponse.json<{ access: { portalGrantId: string } }>().access;
    const accountBoundGrant = (await repository.listPortalGrants("firm-west-legal")).find(
      (grant) => grant.id === access.portalGrantId,
    );
    expect(accountBoundGrant?.accountUserId).toBeTruthy();

    const listResponse = await server.inject({
      method: "GET",
      url: "/api/client-portal/document-access?matterId=matter-001&contactId=contact-ada",
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      access: [expect.objectContaining({ documentId: "doc-route-visible-001" })],
    });
  });

  it("keeps adverse contacts and unsafe documents blocked from portal file visibility", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository });
    await createClientShareableDocument(repository, { id: "doc-route-safe-001" });
    await server.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });

    const adverseResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/document-access",
      payload: {
        matterId: "matter-001",
        contactId: "contact-river",
        documentId: "doc-route-safe-001",
      },
    });
    expect(adverseResponse.statusCode).toBe(409);
    expect(adverseResponse.json()).toMatchObject({
      code: "PORTAL_DOCUMENT_CONTACT_NOT_ELIGIBLE",
    });

    const unsafeDocumentResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/document-access",
      payload: {
        matterId: "matter-001",
        contactId: "contact-ada",
        documentId: "doc-001",
      },
    });
    expect(unsafeDocumentResponse.statusCode).toBe(422);
    expect(unsafeDocumentResponse.json()).toMatchObject({
      code: "PORTAL_DOCUMENT_NOT_SHAREABLE",
    });
  });

  it("returns a redacted logged-in workspace over existing client action records", async () => {
    const repository = new ClientPortalWorkspaceBatchRepository();
    const setupServer = testServer({ repository });
    const setup = await setupServer.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });
    const setupBody = setup.json<{ account: { email: string } }>();
    const clientAccount = await repository.getUserByEmail(
      "firm-west-legal",
      setupBody.account.email,
    );
    expect(clientAccount).toBeTruthy();
    await addClientPortalRecords(repository);
    const invoiceBefore = await repository.getInvoice("firm-west-legal", "invoice-001");
    const paymentRequestBefore = await repository.getHostedPaymentRequest(
      "firm-west-legal",
      "payment-request-client-001",
    );
    const auditBefore = await repository.listAuditEvents("firm-west-legal");
    const ledgerBefore = await repository.getLedger("firm-west-legal", { matterId: "matter-001" });

    const server = testServer({ repository, authUser: clientAccount! });
    repository.blockPerSignatureWorkspaceReads = true;
    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });
    repository.blockPerSignatureWorkspaceReads = false;

    expect(response.statusCode).toBe(200);
    expect(repository.grantContactPairReads).toBe(1);
    expect(repository.workspaceBatchReads).toBe(1);
    const body = response.json<{
      account: { role: string };
      access: { posture: string; activeGrantCount: number };
      portalActivity: {
        readState: string;
        notificationPosture: string;
        actionCount: number;
        attentionCount: number;
        unreadNotificationCount: number;
        latestActivityAt?: string;
        matters: Array<{
          matterId: string;
          readState: string;
          notificationPosture: string;
          actionCount: number;
          attentionCount: number;
          unreadNotificationCount: number;
          latestActivityAt?: string;
        }>;
      };
      matters: Array<{
        number: string;
        actionCount: number;
        readState?: string;
        notificationPosture?: string;
        latestActivityAt?: string;
      }>;
      billing: {
        billCount: number;
        totalBalanceDueCents: number;
        openPaymentRequestCount: number;
        attentionBillCount: number;
        matterBills: Array<{
          matterNumber: string;
          billCount: number;
          balanceDueCents: number;
          bills: Array<{
            invoiceNumber: string;
            status: string;
            totalCents: number;
            paidCents: number;
            balanceDueCents: number;
            paymentRequests: Array<{
              id: string;
              status: string;
              amountCents: number;
              currency: string;
              deliveryStatus: string;
              reminderStatus: string;
              paymentPlanStatus: string;
              expiresAt?: string;
              updatedAt: string;
            }>;
          }>;
        }>;
      };
      matterActions: Array<{
        matterNumber: string;
        actionCount: number;
        attentionCount: number;
        actions: Array<{ id: string; family: string; status: string; detail: string }>;
      }>;
      matterDetails: Array<{
        number: string;
        practiceArea: string;
        jurisdiction: string;
        documentCount: number;
        signatureCount: number;
        attentionCount: number;
        readState: string;
        notificationPosture: string;
        unreadNotificationCount: number;
        latestActivityAt?: string;
      }>;
      documents: Array<{
        id: string;
        title: string;
        classification: string;
        accessStatus: string;
        accessId: string;
      }>;
      signatures: Array<{
        id: string;
        title: string;
        documentTitle?: string;
        signerStatus: string;
        actionState: string;
      }>;
      actions: Array<{
        id: string;
        family: string;
        status: string;
        detail: string;
        details?: Array<{ label: string; value: string }>;
      }>;
    }>();
    expect(body.account.role).toBe("client_external");
    expect(body.access).toMatchObject({ posture: "active", activeGrantCount: 1 });
    expect(body.portalActivity).toMatchObject({
      readState: "attention_required",
      notificationPosture: "attention_required",
      actionCount: expect.any(Number),
      attentionCount: expect.any(Number),
      unreadNotificationCount: 0,
    });
    expect(body.portalActivity.latestActivityAt).toBeTruthy();
    expect(body.portalActivity.matters).toEqual([
      expect.objectContaining({
        matterId: "matter-001",
        readState: "attention_required",
        notificationPosture: "attention_required",
        unreadNotificationCount: 0,
        latestActivityAt: expect.any(String),
      }),
    ]);
    expect(body.matters).toEqual([
      expect.objectContaining({
        number: "2026-0001",
        actionCount: expect.any(Number),
        readState: "attention_required",
        notificationPosture: "attention_required",
        latestActivityAt: expect.any(String),
      }),
    ]);
    expect(body.matterDetails).toEqual([
      expect.objectContaining({
        number: "2026-0001",
        practiceArea: "Residential tenancy",
        jurisdiction: "BC",
        documentCount: 1,
        signatureCount: 2,
        attentionCount: expect.any(Number),
        readState: "attention_required",
        notificationPosture: "attention_required",
        unreadNotificationCount: 0,
        latestActivityAt: expect.any(String),
      }),
    ]);
    expect(body.documents).toEqual([
      expect.objectContaining({
        id: "doc-portal-visible-001",
        title: "Client visible disclosure.pdf",
        classification: "general",
        accessStatus: "active",
        accessId: "portal-document-access-client-001",
      }),
    ]);
    expect(body.signatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "signature-client-portal-001",
          title: "Client portal retainer signature",
          documentTitle: "Client visible disclosure.pdf",
          signerStatus: "sent",
          actionState: "ready_to_sign",
        }),
      ]),
    );
    expect(body.billing).toMatchObject({
      billCount: 2,
      totalBalanceDueCents: 13230,
      openPaymentRequestCount: 1,
      attentionBillCount: 1,
    });
    expect(body.billing.matterBills).toEqual([
      expect.objectContaining({
        matterNumber: "2026-0001",
        billCount: 2,
        balanceDueCents: 13230,
        bills: expect.arrayContaining([
          expect.objectContaining({
            invoiceNumber: "INV-2026-0001",
            status: "issued",
            totalCents: 13230,
            paidCents: 0,
            balanceDueCents: 13230,
            paymentRequests: expect.arrayContaining([
              expect.objectContaining({
                id: "payment-request-client-001",
                status: "sent",
                amountCents: 13230,
                deliveryStatus: "sent",
                reminderStatus: "scheduled",
                paymentPlanStatus: "not_offered",
              }),
            ]),
          }),
          expect.objectContaining({
            invoiceNumber: "INV-2026-PAID",
            status: "paid",
            totalCents: 5250,
            paidCents: 5250,
            balanceDueCents: 0,
            paymentRequests: [],
          }),
        ]),
      }),
    ]);
    const visibleInvoiceNumbers = body.billing.matterBills.flatMap((group) =>
      group.bills.map((bill) => bill.invoiceNumber),
    );
    expect(visibleInvoiceNumbers).toEqual(
      expect.arrayContaining(["INV-2026-0001", "INV-2026-PAID"]),
    );
    expect(visibleInvoiceNumbers).not.toEqual(
      expect.arrayContaining([
        "INV-2026-DRAFT",
        "INV-2026-APPROVED",
        "INV-2026-VOID",
        "INV-2026-OTHER",
      ]),
    );
    const visiblePaymentRequest = body.billing.matterBills
      .flatMap((group) => group.bills)
      .flatMap((bill) => bill.paymentRequests)
      .find((request) => request.id === "payment-request-client-001");
    expect(Object.keys(visiblePaymentRequest ?? {}).sort()).toEqual([
      "amountCents",
      "currency",
      "deliveryStatus",
      "expiresAt",
      "id",
      "paymentPlanStatus",
      "reminderStatus",
      "status",
      "updatedAt",
    ]);
    const families = body.actions.map((action) => action.family);
    expect(families).toEqual(
      expect.arrayContaining([
        "intake",
        "guest_session",
        "receipt",
        "client_update",
        "client_action",
        "payment_request",
        "signature",
      ]),
    );
    expect(families).not.toContain("secure_share");
    expect(families).not.toContain("external_upload");
    expect(body.matterActions).toEqual([
      expect.objectContaining({
        matterNumber: "2026-0001",
        actionCount: body.actions.length,
        attentionCount: expect.any(Number),
      }),
    ]);
    expect(body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: "client_update", status: "sent" }),
        expect.objectContaining({ family: "receipt", status: "open" }),
        expect.objectContaining({ family: "guest_session", status: "issued" }),
        expect.objectContaining({ family: "client_action", status: "intent_created" }),
        expect.objectContaining({ family: "payment_request", status: "sent" }),
      ]),
    );
    const paymentAction = body.actions.find(
      (action) => action.id === "payment-request:payment-request-client-001",
    );
    expect(paymentAction?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Amount", value: "CAD 132.30" }),
        expect.objectContaining({ label: "Delivery", value: "sent" }),
      ]),
    );
    expect(
      body.actions.filter((action) => action.family === "client_update").map((action) => action.id),
    ).toEqual(["client-update:email-client-001"]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secure-share:share-client-001");
    expect(serialized).not.toContain("external-upload:external-upload-client-001");
    expect(serialized).not.toContain("doc-external-client-001");
    expect(serialized).not.toContain("guest-session:guest-other-client-001");
    expect(serialized).not.toContain("client-action:conversation:matter-001");
    expect(serialized).not.toContain("redacted message thread");
    expect(serialized).not.toContain("secret-share-token-hash");
    expect(serialized).not.toContain("secret-upload-token-hash");
    expect(serialized).not.toContain("secret-intake-token-hash");
    expect(serialized).not.toContain("secret-guest-token-hash");
    expect(serialized).not.toContain("secret-other-guest-token-hash");
    expect(serialized).not.toContain("secret-receipt-token-hash");
    expect(serialized).not.toContain("PRIVATE HTML BODY");
    expect(serialized).not.toContain("PRIVATE TEXT BODY");
    expect(serialized).not.toContain("Synthetic update");
    expect(serialized).not.toContain("Other synthetic update");
    expect(serialized).not.toContain("office@example.test");
    expect(serialized).not.toContain("private-intake-storage-key");
    expect(serialized).not.toContain("private-room-id");
    expect(serialized).not.toContain("private-other-room-id");
    expect(serialized).not.toContain("PRIVATE client message topic");
    expect(serialized).not.toContain("privateThreadMetadata");
    expect(serialized).not.toContain("/payments/private-client-path");
    expect(serialized).not.toContain("/payments/other-client-private-path");
    expect(serialized).not.toContain("private-stripe-session");
    expect(serialized).not.toContain("private-checkout");
    expect(serialized).not.toContain("privatePaymentEvidence");
    expect(serialized).not.toContain("privateOtherClientEvidence");
    expect(serialized).not.toContain("private-client-visible-disclosure");
    expect(serialized).not.toContain("private-signing-url");
    expect(serialized).not.toContain("private-signer-url");
    expect(serialized).not.toContain("PRIVATE signature consent text");
    expect(serialized).not.toContain("privateProviderEvidence");
    expect(serialized).not.toContain("embedded:private-client-portal-signature");
    expect(serialized).not.toContain("payment-request-other-client-001");
    expect(serialized).not.toContain("Initial tenancy dispute invoice");
    expect(serialized).not.toContain("Reviewed tenancy branch materials");
    expect(serialized).not.toContain("contact-other-client");
    expect(serialized).not.toContain("PRIVATE paid invoice memo");
    expect(serialized).not.toContain("PRIVATE paid line detail");
    expect(serialized).not.toContain("PRIVATE draft invoice memo");
    expect(serialized).not.toContain("PRIVATE approved invoice memo");
    expect(serialized).not.toContain("PRIVATE void invoice memo");
    expect(serialized).not.toContain("PRIVATE other-client invoice memo");

    expect(await repository.getInvoice("firm-west-legal", "invoice-001")).toEqual(invoiceBefore);
    expect(
      await repository.getHostedPaymentRequest("firm-west-legal", "payment-request-client-001"),
    ).toEqual(paymentRequestBefore);
    expect(await repository.listAuditEvents("firm-west-legal")).toEqual(auditBefore);
    expect(await repository.getLedger("firm-west-legal", { matterId: "matter-001" })).toEqual(
      ledgerBefore,
    );

    const documentResponse = await server.inject({
      method: "GET",
      url: "/api/client-portal/documents/doc-portal-visible-001",
    });
    expect(documentResponse.statusCode).toBe(200);
    expect(documentResponse.json()).toMatchObject({
      document: {
        id: "doc-portal-visible-001",
        title: "Client visible disclosure.pdf",
        accessStatus: "active",
      },
    });
    expect(JSON.stringify(documentResponse.json())).not.toContain("storageKey");

    const terminalSignatureResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/signatures/signature-client-portal-001/events",
      payload: {
        status: "completed",
        consentText: "PRIVATE portal signature consent",
        evidence: {
          tokenHash: "private-token-hash",
          publicEventId: "portal-signature-event-001",
        },
      },
    });
    expect(terminalSignatureResponse.statusCode).toBe(400);
    expect(JSON.stringify(terminalSignatureResponse.json())).not.toContain(
      "PRIVATE portal signature consent",
    );

    const timestampForgeryResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/signatures/signature-client-portal-001/events",
      payload: {
        status: "viewed",
        occurredAt: "2001-01-01T00:00:00.000Z",
      },
    });
    expect(timestampForgeryResponse.statusCode).toBe(400);

    const signatureResponse = await server.inject({
      method: "POST",
      url: "/api/client-portal/signatures/signature-client-portal-001/events",
      payload: {
        status: "viewed",
        evidence: {
          tokenHash: "private-token-hash",
          publicEventId: "portal-signature-event-001",
        },
      },
    });
    expect(signatureResponse.statusCode).toBe(200);
    expect(signatureResponse.json()).toMatchObject({
      status: "processed",
      signature: {
        id: "signature-client-portal-001",
        signerStatus: "viewed",
        actionState: "viewed",
      },
    });
    expect(JSON.stringify(signatureResponse.json())).not.toContain("private-token-hash");
    const clientPortalSignature = (await repository.listSignatureRequests("firm-west-legal")).find(
      (request) => request.id === "signature-client-portal-001",
    );
    expect(clientPortalSignature?.status).toBe("sent");
    await expect(
      repository.listSignatureRequestSigners("firm-west-legal", "signature-client-portal-001"),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "signature-client-portal-signer-001",
          status: "viewed",
        }),
        expect.objectContaining({
          id: "signature-client-portal-signer-002",
          status: "sent",
        }),
      ]),
    );
    const clientPortalSignatureEvent = (
      await repository.listSignatureProviderEvents("firm-west-legal", {
        signatureRequestId: "signature-client-portal-001",
      })
    ).find((event) => event.status === "viewed");
    expect(clientPortalSignatureEvent).toMatchObject({
      status: "viewed",
      evidence: expect.objectContaining({
        mode: "client_portal_embedded",
        signerId: "signature-client-portal-signer-001",
      }),
    });
    expect(clientPortalSignatureEvent?.occurredAt).not.toBe("2001-01-01T00:00:00.000Z");
    expect(clientPortalSignatureEvent?.evidence).not.toHaveProperty("consentText");
    const signatureAudit = await repository.listAuditEvents("firm-west-legal");
    expect(signatureAudit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "signature_client_portal_event.recorded",
          resourceType: "signature_request",
          resourceId: "signature-client-portal-001",
        }),
      ]),
    );
  });

  it("hides workspace action families when granular portal permissions are missing", async () => {
    const repository = new ClientPortalWorkspaceBatchRepository();
    const setupServer = testServer({ repository });
    const setup = await setupServer.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: {
        matterId: "matter-001",
        contactId: "contact-ada",
        permissions: ["view_documents", "message"],
      },
    });
    const setupBody = setup.json<{ account: { email: string } }>();
    const clientAccount = await repository.getUserByEmail(
      "firm-west-legal",
      setupBody.account.email,
    );
    if (!clientAccount) throw new Error("expected synthetic client account");
    await addClientPortalRecords(repository);

    const response = await testServer({ repository, authUser: clientAccount }).inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      billing: { billCount: number; matterBills: Array<{ bills: unknown[] }> };
      signatures: unknown[];
      actions: Array<{ family: string }>;
    }>();
    const families = body.actions.map((action) => action.family);
    expect(families).toEqual(expect.arrayContaining(["receipt", "client_update"]));
    expect(families).not.toEqual(
      expect.arrayContaining(["intake", "guest_session", "payment_request", "signature"]),
    );
    expect(body.billing.billCount).toBe(0);
    expect(body.billing.matterBills.flatMap((group) => group.bills)).toHaveLength(0);
    expect(body.signatures).toHaveLength(0);
  });

  it("ignores notifications on revoked and access-revoked threads in portal activity", async () => {
    const repository = new ClientPortalNotificationRepository();
    const clientAccount = user("client_external", []);
    await repository.createUser(clientAccount);
    await addMatterTwoAdaPortalGrant(repository, clientAccount);
    await addConversationThread(repository, {
      id: "thread-portal-revoked-001",
      matterId: "matter-002",
      status: "revoked",
      accessRevokedAt: "2026-05-22T10:05:00.000Z",
      updatedAt: "2026-05-22T10:05:00.000Z",
    });
    await addConversationThread(repository, {
      id: "thread-portal-access-revoked-001",
      matterId: "matter-002",
      status: "open",
      accessRevokedAt: "2026-05-22T10:10:00.000Z",
      updatedAt: "2026-05-22T10:10:00.000Z",
    });
    repository.syntheticConversationNotifications.push(
      syntheticConversationNotification({
        id: "notification-revoked-thread",
        matterId: "matter-002",
        threadId: "thread-portal-revoked-001",
        recipientUserId: clientAccount.id,
        createdAt: "2026-05-22T10:06:00.000Z",
      }),
      syntheticConversationNotification({
        id: "notification-access-revoked-thread",
        matterId: "matter-002",
        threadId: "thread-portal-access-revoked-001",
        recipientUserId: clientAccount.id,
        createdAt: "2026-05-22T10:11:00.000Z",
      }),
    );

    const server = testServer({ repository, authUser: clientAccount });
    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      portalActivity: {
        readState: string;
        notificationPosture: string;
        unreadNotificationCount: number;
        matters: Array<{
          matterId: string;
          readState: string;
          notificationPosture: string;
          actionCount: number;
          unreadNotificationCount: number;
          messageThreadCount: number;
        }>;
      };
      matters: Array<{
        id: string;
        number: string;
        readState: string;
        notificationPosture: string;
        unreadNotificationCount: number;
      }>;
    }>();
    expect(body.portalActivity).toMatchObject({
      readState: "current",
      notificationPosture: "none",
      unreadNotificationCount: 0,
    });
    expect(body.portalActivity.matters).toEqual([
      expect.objectContaining({
        matterId: "matter-002",
        readState: "current",
        notificationPosture: "none",
        actionCount: 0,
        unreadNotificationCount: 0,
        messageThreadCount: 0,
      }),
    ]);
    expect(body.matters).toEqual([
      expect.objectContaining({
        id: "matter-002",
        number: "2026-0002",
        readState: "current",
        notificationPosture: "none",
        unreadNotificationCount: 0,
      }),
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("thread-portal-revoked-001");
    expect(serialized).not.toContain("thread-portal-access-revoked-001");
    expect(serialized).not.toContain("notification-revoked-thread");
  });

  it("keeps portal notification counts scoped by matter and recipient", async () => {
    const repository = new ClientPortalNotificationRepository();
    const clientAccount: User = {
      ...user("client_external", []),
      id: "client-ada-multi-matter",
    };
    await repository.createUser(clientAccount);
    await addMatterOneAdaPortalGrant(repository, clientAccount);
    await addMatterTwoAdaPortalGrant(repository, clientAccount);
    await addConversationThread(repository, {
      id: "thread-portal-matter-001",
      matterId: "matter-001",
      updatedAt: "2026-05-22T11:00:00.000Z",
    });
    await addConversationThread(repository, {
      id: "thread-portal-matter-002",
      matterId: "matter-002",
      updatedAt: "2026-05-22T11:05:00.000Z",
    });
    repository.syntheticConversationNotifications.push(
      syntheticConversationNotification({
        id: "notification-matter-001-client",
        matterId: "matter-001",
        threadId: "thread-portal-matter-001",
        recipientUserId: clientAccount.id,
        createdAt: "2026-05-22T11:01:00.000Z",
      }),
      syntheticConversationNotification({
        id: "notification-matter-002-client",
        matterId: "matter-002",
        threadId: "thread-portal-matter-002",
        recipientUserId: clientAccount.id,
        createdAt: "2026-05-22T11:06:00.000Z",
      }),
      syntheticConversationNotification({
        id: "notification-matter-002-other-recipient",
        matterId: "matter-002",
        threadId: "thread-portal-matter-002",
        recipientUserId: "client-other-recipient",
        createdAt: "2026-05-22T11:07:00.000Z",
      }),
    );

    const server = testServer({ repository, authUser: clientAccount });
    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      portalActivity: {
        unreadNotificationCount: number;
        matters: Array<{
          matterId: string;
          readState: string;
          notificationPosture: string;
          unreadNotificationCount: number;
          messageThreadCount: number;
        }>;
      };
    }>();
    const activityByMatterId = new Map(
      body.portalActivity.matters.map((activity) => [activity.matterId, activity]),
    );
    expect(body.portalActivity.unreadNotificationCount).toBe(2);
    expect(activityByMatterId.get("matter-001")).toMatchObject({
      unreadNotificationCount: 1,
      messageThreadCount: 1,
    });
    expect(activityByMatterId.get("matter-002")).toMatchObject({
      readState: "unread",
      notificationPosture: "unread",
      unreadNotificationCount: 1,
      messageThreadCount: 1,
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("client-other-recipient");
    expect(serialized).not.toContain("notification-matter-002-other-recipient");
  });

  it("uses a focused signature lookup for client portal signature detail", async () => {
    const repository = new ClientPortalFocusedSignatureRepository();
    const setupServer = testServer({ repository });
    const setup = await setupServer.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });
    const setupBody = setup.json<{ account: { email: string } }>();
    const clientAccount = await repository.getUserByEmail(
      "firm-west-legal",
      setupBody.account.email,
    );
    expect(clientAccount).toBeTruthy();
    await addClientPortalRecords(repository);

    const server = testServer({ repository, authUser: clientAccount! });
    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/signatures/signature-client-portal-001",
    });

    expect(response.statusCode).toBe(200);
    expect(repository.focusedSignatureReads).toBe(1);
    expect(response.json()).toMatchObject({
      signature: {
        id: "signature-client-portal-001",
        documentTitle: "Client visible disclosure.pdf",
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("private-signing-url");
  });

  it("hides revoked per-file document access from the client workspace", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const setupServer = testServer({ repository });
    const setup = await setupServer.inject({
      method: "POST",
      url: "/api/client-portal/accounts",
      payload: { matterId: "matter-001", contactId: "contact-ada" },
    });
    const setupBody = setup.json<{ account: { email: string } }>();
    const clientAccount = await repository.getUserByEmail(
      "firm-west-legal",
      setupBody.account.email,
    );
    expect(clientAccount).toBeTruthy();
    await addClientPortalRecords(repository);
    await repository.revokePortalDocumentAccess({
      firmId: "firm-west-legal",
      id: "portal-document-access-client-001",
      revokedAt: "2026-05-21T10:00:00.000Z",
    });

    const server = testServer({ repository, authUser: clientAccount! });
    const documentResponse = await server.inject({
      method: "GET",
      url: "/api/client-portal/documents/doc-portal-visible-001",
    });
    expect(documentResponse.statusCode).toBe(404);

    const workspaceResponse = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });
    expect(workspaceResponse.statusCode).toBe(200);
    expect(
      workspaceResponse
        .json<{ documents: Array<{ id: string }> }>()
        .documents.some((document) => document.id === "doc-portal-visible-001"),
    ).toBe(false);
  });

  it("rejects non-client users from the client workspace", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const server = testServer({ repository, authUser: user("licensee") });

    const response = await server.inject({
      method: "GET",
      url: "/api/client-portal/workspace",
    });

    expect(response.statusCode).toBe(403);
  });
});
