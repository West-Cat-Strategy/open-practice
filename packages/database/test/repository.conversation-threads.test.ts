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
});
