import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmailTemplateDraftsPanel } from "./email-template-drafts-panel";

function noop(): void {}

describe("EmailTemplateDraftsPanel", () => {
  it("renders saved drafts and preview snapshots without delivery controls", () => {
    const html = renderToStaticMarkup(
      createElement(EmailTemplateDraftsPanel, {
        activeMatterId: "matter-001",
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
            recipientHints: ["primary_client"],
            status: "draft",
            version: 1,
            createdByUserId: "user-admin",
            updatedByUserId: "user-admin",
            createdAt: "2026-06-16T10:00:00.000Z",
            updatedAt: "2026-06-16T10:00:00.000Z",
          },
        ],
        selectedTemplateDraftId: "template-draft-001",
        form: {
          id: "template-draft-001",
          name: "Matter update",
          category: "matter_update",
          templateKey: "matter.update",
          from: "Open Practice <no-reply@open-practice.local>",
          subject: "Matter update",
          textBody: "Synthetic body",
          htmlBody: "",
          recipientHints: "primary_client",
        },
        previewSnapshots: [
          {
            id: "snapshot-001",
            firmId: "firm-west-legal",
            templateDraftId: "template-draft-001",
            matterId: "matter-001",
            createdByUserId: "user-admin",
            templateKey: "matter.update",
            subjectPreview: "Matter update",
            body: {
              textPreview: "Synthetic body",
              contentTypes: { text: true, html: false },
            },
            recipientSummary: { toCount: 1, ccCount: 0, bccCount: 0, recipientCount: 1 },
            warnings: [],
            delivery: { persisted: true, queued: false },
            createdAt: "2026-06-16T10:05:00.000Z",
          },
        ],
        status: "Saved",
        saving: false,
        previewing: false,
        onSelectDraft: noop,
        onNewDraft: noop,
        onFieldChange: noop,
        onSaveDraft: noop,
        onCreatePreviewSnapshot: noop,
      }),
    );

    expect(html).toContain("Email templates");
    expect(html).toContain("Matter update");
    expect(html).toContain("Save draft");
    expect(html).toContain("Save snapshot");
    expect(html).toContain("Preview snapshots");
    expect(html).not.toContain("Confirm and send");
    expect(html).not.toContain("campaign");
  });
});
