import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository conversation threads", () => {
  it("stores and filters matter-scoped conversation thread records", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createConversationThread({
      id: "conversation-thread-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      topic: "Synthetic thread",
      status: "open",
      retentionUntil: "2026-06-01T00:00:00.000Z",
      exportState: "not_requested",
      notificationBoundary: "disabled",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: { safeOperationalNote: "synthetic" },
    });

    await expect(
      repository.listConversationThreads("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toMatchObject([
      {
        id: "conversation-thread-001",
        matterId: "matter-001",
        topic: "Synthetic thread",
        retentionUntil: "2026-06-01T00:00:00.000Z",
      },
    ]);
    await expect(
      repository.listConversationThreads("firm-west-legal", { matterId: "matter-002" }),
    ).resolves.toEqual([]);
  });

  it("updates conversation lifecycle state without exporting thread content", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createConversationThread({
      id: "conversation-thread-lifecycle",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      topic: "Synthetic lifecycle",
      status: "open",
      exportState: "not_requested",
      notificationBoundary: "disabled",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: { safeOperationalNote: "synthetic" },
    });

    await expect(
      repository.updateConversationThreadLifecycle({
        firmId: "firm-west-legal",
        threadId: "conversation-thread-lifecycle",
        action: "request_export",
        occurredAt: "2026-05-01T12:00:00.000Z",
        actorUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({
      exportState: "requested",
      status: "open",
      updatedAt: "2026-05-01T12:00:00.000Z",
    });

    await expect(
      repository.updateConversationThreadLifecycle({
        firmId: "firm-west-legal",
        threadId: "conversation-thread-lifecycle",
        action: "revoke_access",
        occurredAt: "2026-05-01T12:05:00.000Z",
        actorUserId: "user-licensee",
      }),
    ).resolves.toMatchObject({
      status: "revoked",
      accessRevokedAt: "2026-05-01T12:05:00.000Z",
      exportState: "requested",
    });

    await expect(
      repository.updateConversationThreadLifecycle({
        firmId: "firm-west-legal",
        threadId: "conversation-thread-lifecycle",
        action: "reopen",
        occurredAt: "2026-05-01T12:10:00.000Z",
        actorUserId: "user-licensee",
      }),
    ).rejects.toThrow("CONVERSATION_THREAD_REVOKED");
  });

  it("stores message records under matter-scoped conversation threads", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createConversationThread({
      id: "conversation-thread-message",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      topic: "Synthetic message records",
      status: "open",
      exportState: "not_requested",
      notificationBoundary: "disabled",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-licensee",
      updatedByUserId: "user-licensee",
      metadata: {},
    });

    await repository.createConversationMessage({
      id: "conversation-message-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      threadId: "conversation-thread-message",
      kind: "internal_note",
      bodyText: "Synthetic staff-visible message body.",
      authoredAt: "2026-05-01T12:00:00.000Z",
      authoredByUserId: "user-licensee",
      createdAt: "2026-05-01T12:00:01.000Z",
      createdByUserId: "user-licensee",
      metadata: { privateRoutingNote: "not for inbox summaries" },
    });

    await expect(
      repository.listConversationMessages("firm-west-legal", {
        threadId: "conversation-thread-message",
      }),
    ).resolves.toMatchObject([
      {
        id: "conversation-message-001",
        matterId: "matter-001",
        threadId: "conversation-thread-message",
        bodyText: "Synthetic staff-visible message body.",
      },
    ]);
    await expect(
      repository.listConversationMessages("firm-west-legal", { matterId: "matter-002" }),
    ).resolves.toEqual([]);
    await expect(
      repository.getConversationThread("firm-west-legal", "conversation-thread-message"),
    ).resolves.toMatchObject({
      updatedAt: "2026-05-01T12:00:00.000Z",
      updatedByUserId: "user-licensee",
    });
    await expect(
      repository.listConversationMessageNotifications("firm-west-legal", {
        threadId: "conversation-thread-message",
      }),
    ).resolves.toEqual([]);
  });

  it("creates staff-only conversation notification records with mutable mute/read posture", async () => {
    const repository = new InMemoryOpenPracticeRepository();

    await repository.createConversationThread({
      id: "conversation-thread-notifications",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      topic: "Synthetic notification posture",
      status: "open",
      exportState: "not_requested",
      notificationBoundary: "internal_only",
      createdAt: now,
      updatedAt: now,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      metadata: {},
    });

    await repository.createConversationMessage({
      id: "conversation-message-notifications",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      threadId: "conversation-thread-notifications",
      kind: "internal_note",
      bodyText: "Synthetic staff-only notification body.",
      authoredAt: "2026-05-01T12:20:00.000Z",
      authoredByUserId: "user-admin",
      createdAt: "2026-05-01T12:20:01.000Z",
      createdByUserId: "user-admin",
      metadata: {},
    });

    const notifications = await repository.listConversationMessageNotifications("firm-west-legal", {
      threadId: "conversation-thread-notifications",
    });
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: "conversation-message-notifications",
          recipientUserId: "user-staff",
        }),
      ]),
    );
    expect(notifications).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ recipientUserId: "user-admin" })]),
    );

    const staffNotification = notifications.find(
      (notification) => notification.recipientUserId === "user-staff",
    );
    expect(staffNotification).toBeDefined();
    expect(staffNotification?.readAt).toBeUndefined();
    expect(staffNotification?.mutedAt).toBeUndefined();
    await expect(
      repository.updateConversationMessageNotificationPosture({
        firmId: "firm-west-legal",
        notificationId: staffNotification!.id,
        action: "mute",
        occurredAt: "2026-05-01T12:25:00.000Z",
        actorUserId: staffNotification!.recipientUserId,
      }),
    ).resolves.toMatchObject({
      mutedAt: "2026-05-01T12:25:00.000Z",
      readAt: undefined,
    });
    await expect(
      repository.updateConversationMessageNotificationPosture({
        firmId: "firm-west-legal",
        notificationId: staffNotification!.id,
        action: "mark_read",
        occurredAt: "2026-05-01T12:26:00.000Z",
        actorUserId: staffNotification!.recipientUserId,
      }),
    ).resolves.toMatchObject({
      mutedAt: "2026-05-01T12:25:00.000Z",
      readAt: "2026-05-01T12:26:00.000Z",
    });
    await expect(
      repository.updateConversationMessageNotificationPosture({
        firmId: "firm-west-legal",
        notificationId: staffNotification!.id,
        action: "unmute",
        occurredAt: "2026-05-01T12:27:00.000Z",
        actorUserId: staffNotification!.recipientUserId,
      }),
    ).resolves.toMatchObject({
      mutedAt: undefined,
      readAt: "2026-05-01T12:26:00.000Z",
    });
  });
});
