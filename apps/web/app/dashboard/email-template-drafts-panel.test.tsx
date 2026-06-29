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
            description: "Saved draft text",
            category: "matter_update",
            templateKey: "matter.update",
            from: "Open Practice <no-reply@open-practice.local>",
            subject: "Updated synthetic subject",
            textBody: "Updated synthetic body",
            htmlBody: "<p>Updated synthetic body</p>",
            recipientHints: ["primary_client", "assistant"],
            relatedResourceType: "document",
            status: "draft",
            version: 3,
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
          subject: "Updated synthetic subject",
          textBody: "Updated synthetic body",
          htmlBody: "<p>Updated synthetic body</p>",
          recipientHints: "primary_client, assistant",
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
        publishedVersions: [
          {
            id: "published-version-001",
            firmId: "firm-west-legal",
            templateDraftId: "template-draft-001",
            version: 1,
            draftVersion: 1,
            name: "Matter update",
            description: "Original published text",
            category: "matter_update",
            templateKey: "matter.update",
            from: "Open Practice <no-reply@open-practice.local>",
            subject: "Original synthetic subject",
            textBody: "Original synthetic body",
            htmlBody: "<p>Original synthetic body</p>",
            recipientHints: ["primary_client"],
            publishedByUserId: "user-admin",
            publishedAt: "2026-06-16T10:06:00.000Z",
          },
          {
            id: "published-version-002",
            firmId: "firm-west-legal",
            templateDraftId: "template-draft-001",
            version: 2,
            draftVersion: 2,
            name: "Matter update",
            description: "Published draft text",
            category: "matter_update",
            templateKey: "matter.update",
            from: "Open Practice <no-reply@open-practice.local>",
            subject: "Published synthetic subject",
            textBody: "Published synthetic body",
            htmlBody: "<p>Published synthetic body</p>",
            recipientHints: ["primary_client"],
            publishedByUserId: "user-admin",
            publishedAt: "2026-06-16T10:08:00.000Z",
          },
        ],
        status: "Saved",
        saving: false,
        previewing: false,
        publishing: false,
        onSelectDraft: noop,
        onNewDraft: noop,
        onFieldChange: noop,
        onSaveDraft: noop,
        onCreatePreviewSnapshot: noop,
        onPublishDraft: noop,
      }),
    );

    expect(html).toContain("Email templates");
    expect(html).toContain("Matter update");
    expect(html).toContain("Save draft");
    expect(html).toContain("Save snapshot");
    expect(html).toContain("Publish version");
    expect(html).toContain("Version history");
    expect(html).toContain("Compare saved draft");
    expect(html).toContain("draft v3 vs published v2");
    expect(html).toContain("6 changed fields");
    expect(html).toContain("Updated synthetic subject");
    expect(html).toContain("Published synthetic subject");
    expect(html).toContain("&lt;p&gt;Updated synthetic body&lt;/p&gt;");
    expect(html).toContain("&lt;p&gt;Published synthetic body&lt;/p&gt;");
    expect(html).toContain("Same");
    expect(html).toContain("Changed");
    expect(html).toContain("Preview snapshots");
    expect(html).not.toContain("Confirm and send");
    expect(html).not.toContain("campaign");
    expect(html).not.toContain("Bulk send");
    expect(html).not.toContain("Provider delivery");
    expect(html).not.toContain("Queue job");
    expect(html).not.toContain("Send job");
    expect(html).not.toContain("Subscription");
  });
});
