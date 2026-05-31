import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  EmailEventRecord,
  EmailOutboxRecord,
  InboundEmailMessageRecord,
  JobLifecycleRecord,
  ProfessionalRole,
  User,
} from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "../../../../packages/database/src/repository/memory.js";
import { registerCommunicationsRoutes } from "./communications.js";

const firmId = "firm-west-legal";
const now = "2026-05-05T12:00:00.000Z";
const servers: FastifyInstance[] = [];

function user(role: ProfessionalRole, assignedMatterIds: string[] = ["matter-001"]): User {
  const idByRole: Partial<Record<ProfessionalRole, string>> = {
    owner_admin: "user-admin",
    licensee: "user-licensee",
    firm_member: "user-staff",
    auditor: "user-auditor",
  };
  return {
    id: idByRole[role] ?? `user-${role}`,
    firmId,
    displayName: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    assignedMatterIds,
    mfaEnabled: true,
  };
}

function testServer(
  repository: InMemoryOpenPracticeRepository,
  authUser: User = user("owner_admin", ["matter-001", "matter-002"]),
): FastifyInstance {
  const server = Fastify({ logger: false });
  server.addHook("preHandler", async (request) => {
    request.auth = { firmId: authUser.firmId, user: authUser };
  });
  registerCommunicationsRoutes(server, { repository });
  servers.push(server);
  return server;
}

function inboundMessage(
  overrides: Partial<InboundEmailMessageRecord> = {},
): InboundEmailMessageRecord {
  return {
    id: "inbound-message-001",
    firmId,
    addressId: "inbound-address-001",
    matterId: "matter-001",
    messageId: "<message-001@example.test>",
    fromAddress: "client@example.test",
    toAddresses: ["matter-001@open-practice.test"],
    subject: "Privileged filing strategy",
    receivedAt: now,
    rawStorageKey: "inbound/raw/message-001.eml",
    parsedText: "Private email body must not appear.",
    parsedHtmlStorageKey: "inbound/html/message-001.html",
    labels: ["client"],
    status: "triage_pending",
    metadata: {
      staffTriage: {
        status: "needs_review",
        note: "Private staff note must not appear.",
        assignedToUserId: "user-staff",
        contactIds: ["contact-ada"],
        privateNotes: [
          {
            authorUserId: "user-licensee",
            createdAt: "2026-05-05T12:15:00.000Z",
            text: "Internal call-back context must not appear.",
          },
        ],
        followUp: {
          channel: "phone",
          consentStatus: "consented",
          dueAt: "2026-05-06T18:00:00.000Z",
        },
      },
      providerId: "provider-private-id",
    },
    ...overrides,
  };
}

function emailOutbox(overrides: Partial<EmailOutboxRecord> = {}): EmailOutboxRecord {
  return {
    id: "email-outbox-001",
    firmId,
    matterId: "matter-001",
    templateKey: "client.update",
    status: "failed",
    to: ["client@example.test"],
    cc: ["staff@example.test"],
    bcc: ["audit@example.test"],
    from: "Open Practice <no-reply@example.test>",
    subject: "Private outbound subject",
    htmlBody: "<p>Private outbound HTML</p>",
    textBody: "Private outbound text",
    queuedAt: now,
    attemptCount: 1,
    lastAttemptAt: now,
    failedAt: now,
    terminalFailureAt: now,
    terminalFailureReason: "Mailbox unavailable for client@example.test token=secret-token",
    metadata: { providerMessageId: "provider-message-private" },
    ...overrides,
  };
}

function emailEvent(emailId: string, overrides: Partial<EmailEventRecord> = {}): EmailEventRecord {
  return {
    id: "email-event-001",
    firmId,
    emailId,
    eventType: "failed",
    occurredAt: now,
    providerMessageId: "provider-message-private",
    attemptNumber: 1,
    jobId: "email-job-private",
    source: "provider",
    errorMessage: "Provider failure summary without addresses",
    metadata: { token: "private-token" },
    ...overrides,
  };
}

function emailJob(emailId: string): JobLifecycleRecord {
  return {
    id: "email-job-001",
    firmId,
    queueName: "email",
    jobName: "send_email",
    status: "queued",
    queuedAt: now,
    targetResourceType: "email_outbox",
    targetResourceId: emailId,
    attemptsMade: 0,
    maxAttempts: 3,
    metadata: { matterId: "matter-001", emailId },
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("communications inbox routes", () => {
  it("returns a matter-scoped redacted communications aggregate", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createInboundEmailAddress({
      id: "inbound-address-001",
      firmId,
      address: "matter-001@open-practice.test",
      matterId: "matter-001",
      enabled: true,
      createdAt: now,
    });
    await repository.upsertProviderSetting({
      id: "provider-inbound-001",
      firmId,
      kind: "inbound_email",
      key: "inbound-sink",
      enabled: true,
      encryptedConfig: "private-inbound-config",
      createdAt: now,
      updatedAt: now,
    });
    await repository.upsertProviderSetting({
      id: "provider-smtp-001",
      firmId,
      kind: "smtp",
      key: "smtp-sink",
      enabled: true,
      encryptedConfig: "private-smtp-config",
      createdAt: now,
      updatedAt: now,
    });
    await repository.createInboundEmailMessage(inboundMessage());
    await repository.createInboundEmailAttachment({
      id: "inbound-attachment-001",
      firmId,
      inboundMessageId: "inbound-message-001",
      filename: "private-filing.pdf",
      contentType: "application/pdf",
      sizeBytes: 256,
      storageKey: "inbound/message-001/private-filing.pdf",
      checksumSha256: "a".repeat(64),
    });
    const email = emailOutbox();
    await repository.createQueuedEmailOutbox({
      email,
      event: emailEvent(email.id, { eventType: "queued", providerMessageId: undefined }),
      job: emailJob(email.id),
    });
    await repository.recordEmailDeliveryResult({
      firmId,
      emailId: email.id,
      status: "failed",
      occurredAt: now,
      providerMessageId: "provider-message-private",
      attemptNumber: 1,
      terminal: true,
      errorMessage: "Mailbox unavailable for client@example.test token=secret-token",
      metadata: { storageKey: "private-storage-key" },
    });
    await repository.createConversationThread({
      id: "conversation-thread-001",
      firmId,
      matterId: "matter-001",
      topic: "Repair evidence follow-up",
      status: "open",
      exportState: "not_requested",
      notificationBoundary: "internal_only",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      metadata: { rawNote: "Private conversation note" },
    });
    await repository.createConversationMessage({
      id: "conversation-message-001",
      firmId,
      matterId: "matter-001",
      threadId: "conversation-thread-001",
      kind: "internal_note",
      bodyText: "Private conversation message body",
      authoredAt: "2026-05-05T12:30:00.000Z",
      authoredByUserId: "user-admin",
      createdAt: "2026-05-05T12:30:01.000Z",
      createdByUserId: "user-admin",
      metadata: { rawNote: "Private message routing note" },
    });
    await repository.createConversationMessage({
      id: "conversation-message-draft-001",
      firmId,
      matterId: "matter-001",
      threadId: "conversation-thread-001",
      kind: "client_message",
      bodyText: "Private client update draft body",
      authoredAt: "2026-05-05T13:00:00.000Z",
      authoredByUserId: "user-admin",
      createdAt: "2026-05-05T13:00:01.000Z",
      createdByUserId: "user-admin",
      metadata: { privateDraftPrompt: "Private client update draft metadata" },
    });

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/communications/inbox?matterId=matter-001",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload).toMatchObject({
      status: "available",
      matterId: "matter-001",
      channelState: {
        inboundEmailStatus: "configured",
        outboundEmailStatus: "configured",
        inboundEmailAddressCount: 1,
        enabledInboundEmailAddressCount: 1,
      },
      inboundEmail: [
        {
          id: "inbound-message-001",
          matterId: "matter-001",
          status: "triage_pending",
          labels: ["client"],
          attachmentCount: 1,
          triage: {
            status: "needs_review",
            assignedToUserId: "user-staff",
            contactIds: ["contact-ada"],
            privateNoteCount: 1,
            latestPrivateNoteAt: "2026-05-05T12:15:00.000Z",
            followUp: {
              channel: "phone",
              consentStatus: "consented",
              dueAt: "2026-05-06T18:00:00.000Z",
            },
          },
        },
      ],
      outboundDeliveryHistory: [
        expect.objectContaining({
          id: "email-outbox-001",
          templateKey: "client.update",
          recipientCount: 3,
          failureSummary: "Mailbox unavailable for [redacted-email] token=[redacted]",
        }),
      ],
      conversations: [
        expect.objectContaining({
          id: "conversation-thread-001",
          topic: "Repair evidence follow-up",
          notificationBoundary: "internal_only",
          messageCount: 2,
          latestMessageAt: "2026-05-05T13:00:00.000Z",
        }),
      ],
      clientUpdateDraftRequests: [
        {
          id: "client-update-draft:conversation-message-draft-001",
          matterId: "matter-001",
          threadId: "conversation-thread-001",
          messageId: "conversation-message-draft-001",
          status: "draft_requested",
          requestedAt: "2026-05-05T13:00:00.000Z",
          requestedByUserIdPresent: true,
          bodyLength: "Private client update draft body".length,
          bodyRedacted: true,
          metadataRedacted: true,
          automaticSendEnabled: false,
          portalComposerEnabled: false,
        },
      ],
      channelHistory: expect.arrayContaining([
        expect.objectContaining({
          id: "inbound-email:inbound-message-001",
          kind: "inbound_email",
          channel: "email",
          direction: "inbound",
          bodyRedacted: true,
          metadataRedacted: true,
          attachmentCount: 1,
        }),
        expect.objectContaining({
          id: "phone-note-placeholder:inbound-message-001",
          kind: "phone_note_placeholder",
          channel: "phone",
          direction: "planned_outbound",
          consentStatus: "consented",
          bodyRedacted: true,
          metadataRedacted: true,
        }),
        expect.objectContaining({
          id: "outbound-email:email-outbox-001",
          kind: "outbound_email",
          title: "client.update",
          recipientCount: 3,
          bodyRedacted: true,
          metadataRedacted: true,
        }),
        expect.objectContaining({
          id: "conversation-thread:conversation-thread-001",
          kind: "conversation",
          messageCount: 2,
          bodyRedacted: true,
          metadataRedacted: true,
        }),
        expect.objectContaining({
          id: "client-update-draft:conversation-message-draft-001",
          kind: "client_update_draft",
          direction: "planned_outbound",
          bodyLength: "Private client update draft body".length,
          bodyRedacted: true,
          metadataRedacted: true,
        }),
      ]),
    });
    expect(payload.contactCues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contact: expect.objectContaining({ id: "contact-ada" }),
          matterLinks: [expect.objectContaining({ matterId: "matter-001", role: "client" })],
        }),
      ]),
    );
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("Private email body");
    expect(serialized).not.toContain("Privileged filing strategy");
    expect(serialized).not.toContain("client@example.test");
    expect(serialized).not.toContain("matter-001@open-practice.test");
    expect(serialized).not.toContain("private-filing.pdf");
    expect(serialized).not.toContain("private-storage-key");
    expect(serialized).not.toContain("provider-message-private");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("email-job-private");
    expect(serialized).not.toContain("private-smtp-config");
    expect(serialized).not.toContain("Private staff note");
    expect(serialized).not.toContain("Internal call-back context");
    expect(serialized).not.toContain("Private conversation note");
    expect(serialized).not.toContain("Private conversation message body");
    expect(serialized).not.toContain("Private message routing note");
    expect(serialized).not.toContain("Private client update draft body");
    expect(serialized).not.toContain("Private client update draft metadata");
  });

  it("denies cross-matter aggregate reads", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    const response = await testServer(repository, user("licensee", ["matter-001"])).inject({
      method: "GET",
      url: "/api/communications/inbox?matterId=matter-002",
    });

    expect(response.statusCode).toBe(403);
  });

  it("surfaces staff-only conversation notification posture for the current user", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await repository.createConversationThread({
      id: "conversation-thread-notifications",
      firmId,
      matterId: "matter-001",
      topic: "Synthetic notification posture summary",
      status: "open",
      exportState: "not_requested",
      notificationBoundary: "internal_only",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: {},
    });
    await repository.createConversationMessage({
      id: "conversation-message-notifications",
      firmId,
      matterId: "matter-001",
      threadId: "conversation-thread-notifications",
      kind: "internal_note",
      bodyText: "Synthetic message for notification posture.",
      authoredAt: now,
      authoredByUserId: "user-licensee",
      createdAt: now,
      createdByUserId: "user-licensee",
      metadata: {},
    });

    const recipient = user("owner_admin", ["matter-001"]);
    const firstResponse = await testServer(repository, recipient).inject({
      method: "GET",
      url: "/api/communications/inbox?matterId=matter-001",
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toMatchObject({
      conversations: [
        expect.objectContaining({
          id: "conversation-thread-notifications",
          notificationSummary: {
            notificationCount: 1,
            unreadNotificationCount: 1,
            mutedNotificationCount: 0,
            latestNotificationAt: now,
          },
        }),
      ],
    });

    const [recipientNotification] = await repository.listConversationMessageNotifications(firmId, {
      threadId: "conversation-thread-notifications",
      recipientUserId: recipient.id,
    });
    await repository.updateConversationMessageNotificationPosture({
      firmId,
      notificationId: recipientNotification.id,
      action: "mute",
      occurredAt: "2026-05-05T12:45:00.000Z",
      actorUserId: recipient.id,
    });

    const mutedResponse = await testServer(repository, recipient).inject({
      method: "GET",
      url: "/api/communications/inbox?matterId=matter-001",
    });
    expect(mutedResponse.statusCode).toBe(200);
    expect(mutedResponse.json()).toMatchObject({
      conversations: [
        expect.objectContaining({
          id: "conversation-thread-notifications",
          notificationSummary: {
            notificationCount: 1,
            unreadNotificationCount: 1,
            mutedNotificationCount: 1,
            latestNotificationAt: now,
            latestMutedAt: "2026-05-05T12:45:00.000Z",
          },
        }),
      ],
    });
  });
});
