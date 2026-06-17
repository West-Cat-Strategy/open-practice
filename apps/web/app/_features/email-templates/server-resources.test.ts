import { describe, expect, it } from "vitest";
import {
  buildEmailTemplateDraftsPath,
  buildEmailTemplatePreviewSnapshotsPath,
  loadEmailTemplateDashboardData,
} from "./server-resources";

describe("email template server resources", () => {
  it("builds template draft and preview snapshot API paths", () => {
    expect(buildEmailTemplateDraftsPath()).toBe("/api/email/template-drafts");
    expect(buildEmailTemplatePreviewSnapshotsPath("draft 1", "matter/001", 3)).toBe(
      "/api/email/template-drafts/draft%201/preview-snapshots?matterId=matter%2F001&limit=3",
    );
  });

  it("loads draft lists without requiring snapshot side effects", async () => {
    await expect(
      loadEmailTemplateDashboardData({
        listTemplateDrafts: async () => ({
          templateDrafts: [
            {
              id: "template-draft-001",
              firmId: "firm-west-legal",
              name: "Matter update",
              category: "matter_update",
              templateKey: "matter.update",
              from: "Open Practice <no-reply@open-practice.local>",
              subject: "Matter update",
              textBody: "Synthetic body",
              htmlBody: "",
              recipientHints: [],
              status: "draft",
              version: 1,
              createdByUserId: "user-admin",
              updatedByUserId: "user-admin",
              createdAt: "2026-06-16T10:00:00.000Z",
              updatedAt: "2026-06-16T10:00:00.000Z",
            },
          ],
        }),
      }),
    ).resolves.toMatchObject({
      templateDrafts: [expect.objectContaining({ id: "template-draft-001" })],
      previewSnapshotsByMatterId: {},
    });
  });

  it("hydrates recent preview snapshots by visible matter when a loader is provided", async () => {
    await expect(
      loadEmailTemplateDashboardData({
        recentMatterIds: ["matter-001"],
        listTemplateDrafts: async () => ({
          templateDrafts: [
            {
              id: "template-draft-001",
              firmId: "firm-west-legal",
              name: "Matter update",
              category: "matter_update",
              templateKey: "matter.update",
              from: "Open Practice <no-reply@open-practice.local>",
              subject: "Matter update",
              textBody: "Synthetic body",
              htmlBody: "",
              recipientHints: [],
              status: "draft",
              version: 1,
              createdByUserId: "user-admin",
              updatedByUserId: "user-admin",
              createdAt: "2026-06-16T10:00:00.000Z",
              updatedAt: "2026-06-16T10:00:00.000Z",
            },
          ],
        }),
        listPreviewSnapshots: async (templateDraftId, matterId) => ({
          previewSnapshots: [
            {
              id: "preview-snapshot-001",
              firmId: "firm-west-legal",
              templateDraftId,
              matterId,
              createdByUserId: "user-admin",
              templateKey: "matter.update",
              subjectPreview: "Matter update",
              body: {
                textPreview: "Synthetic preview",
                contentTypes: { text: true, html: false },
              },
              recipientSummary: {
                toCount: 1,
                ccCount: 0,
                bccCount: 0,
                recipientCount: 1,
              },
              warnings: [],
              delivery: { persisted: true, queued: false },
              createdAt: "2026-06-16T10:05:00.000Z",
            },
          ],
        }),
      }),
    ).resolves.toMatchObject({
      previewSnapshotsByMatterId: {
        "matter-001": [expect.objectContaining({ id: "preview-snapshot-001" })],
      },
    });
  });
});
