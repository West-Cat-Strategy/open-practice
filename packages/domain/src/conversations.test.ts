import { describe, expect, it } from "vitest";
import type { ConversationMessageRecord, ConversationThreadRecord } from "./models.js";
import { buildRedactedConversationExportArtifact } from "./conversations.js";

const thread: ConversationThreadRecord = {
  id: "thread-export-001",
  firmId: "firm-west-legal",
  matterId: "matter-001",
  topic: "Synthetic export topic",
  status: "open",
  retentionUntil: "2026-06-01T00:00:00.000Z",
  exportState: "requested",
  notificationBoundary: "internal_only",
  createdAt: "2026-05-26T10:00:00.000Z",
  updatedAt: "2026-05-26T10:02:00.000Z",
  createdByUserId: "user-admin",
  updatedByUserId: "user-admin",
  metadata: {
    privateSummary: "Synthetic thread metadata value",
    routing: { private: true },
  },
};

function message(overrides: Partial<ConversationMessageRecord> = {}): ConversationMessageRecord {
  return {
    id: "message-export-001",
    firmId: "firm-west-legal",
    matterId: "matter-001",
    threadId: "thread-export-001",
    kind: "internal_note",
    bodyText: "Synthetic privileged message body must not be exported.",
    authoredAt: "2026-05-26T10:01:00.000Z",
    authoredByUserId: "user-licensee",
    createdAt: "2026-05-26T10:01:00.000Z",
    createdByUserId: "user-licensee",
    metadata: {
      privateNote: "Synthetic message metadata value",
      source: "staff",
    },
    ...overrides,
  };
}

describe("conversation exports", () => {
  it("builds a redacted conversation export artifact without body text or metadata values", () => {
    const artifact = buildRedactedConversationExportArtifact({
      thread,
      generatedAt: "2026-05-26T11:00:00.000Z",
      messages: [
        message(),
        message({
          id: "message-other-thread",
          threadId: "thread-other",
          bodyText: "Synthetic other-thread body",
        }),
      ],
    });

    expect(artifact).toMatchObject({
      generatedAt: "2026-05-26T11:00:00.000Z",
      reportType: "conversation_thread",
      reportScope: "matter",
      redactionPolicy: "message_bodies_and_metadata_values_redacted",
      thread: {
        id: "thread-export-001",
        matterId: "matter-001",
        metadataKeys: ["privateSummary", "routing"],
      },
      messageCount: 1,
      messages: [
        {
          id: "message-export-001",
          kind: "internal_note",
          authoredByUserId: "user-licensee",
          authoredByUserIdPresent: true,
          bodyLength: "Synthetic privileged message body must not be exported.".length,
          bodyRedacted: true,
          metadataKeys: ["privateNote", "source"],
        },
      ],
    });

    const serialized = JSON.stringify(artifact);
    expect(serialized).not.toContain("Synthetic privileged message body");
    expect(serialized).not.toContain("Synthetic message metadata value");
    expect(serialized).not.toContain("Synthetic thread metadata value");
    expect(serialized).not.toContain("Synthetic other-thread body");
  });
});
