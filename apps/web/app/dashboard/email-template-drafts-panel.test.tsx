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
            textBody: "Draft private compare body",
            htmlBody: "<p>Draft private compare body</p>",
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
          textBody: "Editor text body value may render",
          htmlBody: "<p>Editor HTML body value may render</p>",
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
        reviewedOutboundPreviews: [
          {
            id: "reviewed-preview-001",
            firmId: "firm-west-legal",
            templateDraftId: "template-draft-001",
            publishedVersionId: "published-version-002",
            publishedVersion: 2,
            matterId: "matter-001",
            contactId: "contact-ada",
            contactMethodId: "contact-method-ada-email",
            createdByUserId: "user-admin",
            templateKey: "matter.update",
            subjectPreview: "Reviewed synthetic subject",
            body: {
              textPreview: "Synthetic reviewed preview",
              contentTypes: { text: true, html: false },
            },
            recipientSummary: { toCount: 1, ccCount: 0, bccCount: 0, recipientCount: 1 },
            reviewStatus: "reviewed_preview",
            warnings: [],
            delivery: { persisted: true, queued: false },
            outboxDraftReview: {
              status: "draft_review",
              mode: "outbox_draft_review",
              reviewedOutboundPreviewId: "reviewed-preview-001",
              templateDraftId: "template-draft-001",
              publishedVersionId: "published-version-002",
              publishedVersion: 2,
              matterId: "matter-001",
              contactId: "contact-ada",
              contactMethodId: "contact-method-ada-email",
              recipientCount: 1,
              warningCount: 0,
              createdByUserId: "user-admin",
              createdAt: "2026-06-16T10:09:00.000Z",
              delivery: {
                persisted: true,
                queued: false,
                emailOutboxRecordCreated: false,
                jobQueued: false,
                providerDeliverySideEffect: false,
                campaignAutomation: false,
                bulkSend: false,
                subscriptionManagement: false,
              },
            },
            createdAt: "2026-06-16T10:09:00.000Z",
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
            textBody: "Published private compare body",
            htmlBody: "<p>Published private compare body</p>",
            recipientHints: ["primary_client"],
            publishedByUserId: "user-admin",
            publishedAt: "2026-06-16T10:08:00.000Z",
          },
        ],
        reviewedPreviewRecipientOptions: [
          {
            key: "contact-ada:contact-method-ada-email",
            contactId: "contact-ada",
            contactMethodId: "contact-method-ada-email",
            label: "Ada Morgan · work",
          },
        ],
        selectedReviewedPreviewRecipientKey: "contact-ada:contact-method-ada-email",
        status: "Saved",
        saving: false,
        previewing: false,
        publishing: false,
        creatingReviewedPreview: false,
        onSelectDraft: noop,
        onNewDraft: noop,
        onFieldChange: noop,
        onSaveDraft: noop,
        onCreatePreviewSnapshot: noop,
        onPublishDraft: noop,
        onReviewedPreviewRecipientChange: noop,
        onCreateReviewedOutboundPreview: noop,
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
    expect(html).toContain("Body content redacted;");
    expect(html).toContain("metadata-only comparison");
    expect(html).toContain("Saved draft · 26 characters · text/plain present");
    expect(html).toContain("Published version · 30 characters · text/plain present");
    expect(html).toContain("Saved draft · 33 characters · text/html present");
    expect(html).toContain("Published version · 37 characters · text/html present");
    expect(html).not.toContain("Draft private compare body");
    expect(html).not.toContain("&lt;p&gt;Draft private compare body&lt;/p&gt;");
    expect(html).not.toContain("Published private compare body");
    expect(html).not.toContain("&lt;p&gt;Published private compare body&lt;/p&gt;");
    expect(html).toContain("Same");
    expect(html).toContain("Changed");
    expect(html).toContain("Preview snapshots");
    expect(html).toContain("Reviewed previews");
    expect(html).toContain("Matter contact");
    expect(html).toContain("Ada Morgan · work");
    expect(html).toContain("Create reviewed preview");
    expect(html).toContain("Reviewed synthetic subject");
    expect(html).toContain("matter.update · published v2 · 1 recipient");
    expect(html).toContain("draft review");
    expect(html).toContain("not queued");
    expect(html).toContain("reviewed");
    expect(html).not.toContain("Confirm and send");
    expect(html).not.toContain("Create outbox");
    expect(html).not.toContain("campaign");
    expect(html).not.toContain("Bulk send");
    expect(html).not.toContain("Provider delivery");
    expect(html).not.toContain("Queue job");
    expect(html).not.toContain("Send job");
    expect(html).not.toContain("Subscription");
  });

  it("keeps reviewed preview creation disabled without a published version or eligible recipient", () => {
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
            subject: "Updated synthetic subject",
            textBody: "Editor text body value may render",
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
          subject: "Updated synthetic subject",
          textBody: "Editor text body value may render",
          htmlBody: "",
          recipientHints: "primary_client",
        },
        previewSnapshots: [],
        reviewedOutboundPreviews: [],
        publishedVersions: [],
        reviewedPreviewRecipientOptions: [],
        selectedReviewedPreviewRecipientKey: "",
        status: undefined,
        saving: false,
        previewing: false,
        publishing: false,
        creatingReviewedPreview: false,
        onSelectDraft: noop,
        onNewDraft: noop,
        onFieldChange: noop,
        onSaveDraft: noop,
        onCreatePreviewSnapshot: noop,
        onPublishDraft: noop,
        onReviewedPreviewRecipientChange: noop,
        onCreateReviewedOutboundPreview: noop,
      }),
    );

    expect(html).toContain("No published template versions.");
    expect(html).toContain("No reviewed previews for this matter.");
    expect(html).toContain('<select disabled=""');
    expect(html).toContain('<button class="secondary-button compact-button" disabled=""');
    expect(html).not.toContain("Confirm and send");
    expect(html).not.toContain("Bulk send");
    expect(html).not.toContain("Provider delivery");
    expect(html).not.toContain("Queue job");
    expect(html).not.toContain("Subscription");
  });
});
