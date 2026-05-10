import { describe, expect, it } from "vitest";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository drafts", () => {
  it("seeds basic draft templates and versions draft updates", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    await expect(repository.listDraftTemplates("firm-west-legal")).resolves.toMatchObject([
      {
        id: "draft-template-legal-letter",
        category: "correspondence",
        active: true,
      },
      {
        id: "draft-template-meeting-notes",
        category: "internal",
        active: true,
      },
    ]);

    const created = await repository.createDraft({
      id: "draft-test-001",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      title: "Draft test",
      editorJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Initial" }] }],
      },
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    });
    const updated = await repository.updateDraft("firm-west-legal", created.id, {
      title: "Updated draft test",
      updatedByUserId: "user-licensee",
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: "Updated draft test",
      version: 2,
      updatedByUserId: "user-licensee",
    });
  });

  it("maps draft assist records and review decisions", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const created = await repository.createDraftAssistRecord({
      id: "draft-assist-record-test",
      firmId: "firm-west-legal",
      matterId: "matter-001",
      sourceType: "draft",
      draftId: "draft-001",
      task: "summarize",
      providerKey: "fake-local-ai",
      providerModel: "fake-model",
      status: "suggested",
      suggestedText: "Synthetic suggestion",
      summary: "Synthetic summary",
      createdByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: { sourceTextLength: 24 },
    });
    const reviewed = await repository.updateDraftAssistRecord({
      ...created,
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
      reviewedAt: "2026-05-01T00:05:00.000Z",
      updatedAt: "2026-05-01T00:05:00.000Z",
    });

    expect(reviewed).toMatchObject({
      id: "draft-assist-record-test",
      status: "reviewed",
      reviewDecision: "reviewed",
      reviewedByUserId: "user-admin",
    });
    await expect(
      repository.listDraftAssistRecords("firm-west-legal", { matterId: "matter-001" }),
    ).resolves.toEqual([expect.objectContaining({ id: "draft-assist-record-test" })]);
    await expect(
      repository.listDraftAssistRecords("firm-west-legal", { draftId: "missing" }),
    ).resolves.toEqual([]);
  });
});
