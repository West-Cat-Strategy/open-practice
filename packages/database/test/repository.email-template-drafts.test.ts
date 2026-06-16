import { describe, expect, it } from "vitest";
import { buildEmailTemplatePreviewSnapshot } from "@open-practice/domain";
import { InMemoryOpenPracticeRepository } from "../src/repository/memory.js";
import { now } from "./repository.fixtures.js";

describe("repository email template drafts", () => {
  it("creates, updates, and lists firm-scoped template drafts", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const created = await repository.createEmailTemplateDraft({
      id: "template-draft-test-001",
      firmId: "firm-west-legal",
      name: "Retainer follow-up",
      category: "matter_update",
      templateKey: "retainer.follow_up",
      from: "Open Practice <no-reply@open-practice.local>",
      subject: "Synthetic follow-up",
      textBody: "Synthetic body",
      htmlBody: "<p>Synthetic body</p>",
      recipientHints: ["primary_client"],
      status: "draft",
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: { source: "test" },
    });

    await expect(repository.listEmailTemplateDrafts("firm-west-legal")).resolves.toEqual([
      expect.objectContaining({ id: created.id, status: "draft" }),
    ]);

    const updated = await repository.updateEmailTemplateDraft("firm-west-legal", created.id, {
      name: "Archived follow-up",
      status: "archived",
      updatedByUserId: "user-licensee",
      updatedAt: "2026-04-25T13:00:00.000Z",
      metadata: { updatedByTest: true },
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: "Archived follow-up",
      status: "archived",
      version: 2,
      updatedByUserId: "user-licensee",
      metadata: { source: "test", updatedByTest: true },
    });

    await expect(repository.listEmailTemplateDrafts("firm-west-legal")).resolves.toEqual([]);
    await expect(
      repository.listEmailTemplateDrafts("firm-west-legal", { activeOnly: false }),
    ).resolves.toEqual([expect.objectContaining({ id: created.id, status: "archived" })]);
  });

  it("creates and lists matter-scoped preview snapshots", async () => {
    const repository = new InMemoryOpenPracticeRepository();
    const draft = await repository.createEmailTemplateDraft({
      id: "template-draft-test-002",
      firmId: "firm-west-legal",
      name: "Matter update",
      category: "matter_update",
      templateKey: "matter.update",
      from: "Open Practice <no-reply@open-practice.local>",
      subject: "Synthetic private subject",
      textBody: "Synthetic private body.",
      htmlBody: '<p onclick="alert(1)">Synthetic private body.</p><script>secret()</script>',
      recipientHints: [],
      status: "draft",
      version: 1,
      createdByUserId: "user-admin",
      updatedByUserId: "user-admin",
      createdAt: now,
      updatedAt: now,
      metadata: {},
    });
    const snapshot = buildEmailTemplatePreviewSnapshot({
      id: "template-preview-snapshot-test-001",
      firmId: "firm-west-legal",
      templateDraft: draft,
      matterId: "matter-001",
      createdByUserId: "user-admin",
      to: ["client@example.test"],
      relatedResource: { type: "document", id: "doc-001" },
      createdAt: "2026-04-25T13:05:00.000Z",
    });

    await repository.createEmailTemplatePreviewSnapshot(snapshot);

    await expect(
      repository.listEmailTemplatePreviewSnapshots("firm-west-legal", draft.id, {
        matterId: "matter-001",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: snapshot.id,
        templateDraftId: draft.id,
        matterId: "matter-001",
        recipientSummary: { toCount: 1, ccCount: 0, bccCount: 0, recipientCount: 1 },
        warnings: expect.arrayContaining(["html_body_sanitized"]),
        delivery: { persisted: true, queued: false },
      }),
    ]);
    await expect(
      repository.listEmailTemplatePreviewSnapshots("firm-west-legal", draft.id, {
        matterId: "matter-002",
      }),
    ).resolves.toEqual([]);
  });
});
