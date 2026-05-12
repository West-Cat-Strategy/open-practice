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
});
