import { describe, expect, it } from "vitest";
import {
  buildEmailTemplatePublishedVersion,
  buildEmailTemplatePreviewSnapshot,
  compareEmailTemplateDraftWithPublishedVersion,
  normalizeEmailTemplateHtmlPreview,
  normalizeEmailTemplateTextPreview,
  type EmailTemplateDraftRecord,
} from "./email-template-drafts.js";

function templateDraft(
  overrides: Partial<EmailTemplateDraftRecord> = {},
): EmailTemplateDraftRecord {
  return {
    id: "template-draft-001",
    firmId: "firm-west-legal",
    name: "Retainer follow-up",
    category: "matter_update",
    templateKey: "retainer.follow_up",
    from: "Open Practice <no-reply@open-practice.local>",
    subject: "Retainer next steps",
    textBody: "Hello,  this is a concise follow-up.",
    htmlBody: "<p>Hello</p>",
    recipientHints: ["primary_client"],
    status: "draft",
    version: 1,
    createdByUserId: "user-admin",
    updatedByUserId: "user-admin",
    createdAt: "2026-06-16T10:00:00.000Z",
    updatedAt: "2026-06-16T10:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("email template drafts", () => {
  it("normalizes text previews and reports truncation", () => {
    const preview = normalizeEmailTemplateTextPreview(` ${"alpha ".repeat(400)} `);

    expect(preview?.value.length).toBe(1200);
    expect(preview?.truncated).toBe(true);
    expect(preview?.value).not.toContain("  ");
  });

  it("sanitizes html previews and reports truncation", () => {
    const preview = normalizeEmailTemplateHtmlPreview(
      `<p>${"follow-up ".repeat(250)}</p><script>alert("private")</script>`,
    );

    expect(preview?.value).not.toContain("<script");
    expect(preview?.sanitized).toBe(true);
    expect(preview?.truncated).toBe(true);
  });

  it("builds persisted preview snapshots with counts and safe metadata only", () => {
    const snapshot = buildEmailTemplatePreviewSnapshot({
      id: "template-preview-snapshot-001",
      firmId: "firm-west-legal",
      templateDraft: templateDraft({
        htmlBody: `<p>Hello</p><script>alert("secret")</script>`,
        textBody: "Hello client@example.test. This is preview body text.",
      }),
      matterId: "matter-001",
      createdByUserId: "user-admin",
      to: ["client@example.test"],
      cc: ["assistant@example.test"],
      bcc: ["private@example.test"],
      relatedResource: { type: "draft", id: "draft-001" },
      createdAt: "2026-06-16T10:30:00.000Z",
    });

    expect(snapshot.delivery).toEqual({ persisted: true, queued: false });
    expect(snapshot.recipientSummary).toEqual({
      toCount: 1,
      ccCount: 1,
      bccCount: 1,
      recipientCount: 3,
    });
    expect(snapshot.body.htmlPreview).not.toContain("<script");
    expect(snapshot.warnings).toContain("html_body_sanitized");

    const metadata = JSON.stringify(snapshot.metadata);
    expect(metadata).toContain("warningCount");
    expect(metadata).not.toContain("client@example.test");
    expect(metadata).not.toContain("private@example.test");
    expect(metadata).not.toContain("Hello client");
  });

  it("builds immutable published versions with safe posture metadata", () => {
    const publishedVersion = buildEmailTemplatePublishedVersion({
      id: "template-published-version-001",
      firmId: "firm-west-legal",
      templateDraft: templateDraft({
        version: 3,
        subject: "Synthetic private publish subject",
        textBody: "Synthetic private publish body.",
        htmlBody: "<p>Synthetic private publish body.</p>",
      }),
      version: 2,
      publishedByUserId: "user-admin",
      publishedAt: "2026-06-29T10:30:00.000Z",
    });

    expect(publishedVersion).toMatchObject({
      id: "template-published-version-001",
      templateDraftId: "template-draft-001",
      version: 2,
      draftVersion: 3,
      subject: "Synthetic private publish subject",
      textBody: "Synthetic private publish body.",
      publishedByUserId: "user-admin",
    });
    expect(publishedVersion.metadata).toMatchObject({
      publishedVersionId: "template-published-version-001",
      templateDraftId: "template-draft-001",
      publishedVersion: 2,
      draftVersion: 3,
      publishedAt: "2026-06-29T10:30:00.000Z",
      subjectLength: "Synthetic private publish subject".length,
      textLength: "Synthetic private publish body.".length,
      providerNeutral: true,
      deliveryQueued: false,
      providerDeliverySideEffect: false,
      campaignAutomation: false,
      bulkSend: false,
    });

    const metadata = JSON.stringify(publishedVersion.metadata);
    expect(metadata).not.toContain("Synthetic private publish subject");
    expect(metadata).not.toContain("Synthetic private publish body");
    expect(metadata).not.toContain("retainer.follow_up");
  });

  it("compares saved drafts against immutable published versions", () => {
    const draft = templateDraft({
      version: 4,
      name: "Matter update",
      description: "Latest staff draft",
      subject: "Updated synthetic subject",
      textBody: "Updated synthetic text.",
      htmlBody: "<p>Updated synthetic text.</p>",
      recipientHints: ["primary_client", "assistant"],
      relatedResourceType: "document",
    });
    const publishedVersion = buildEmailTemplatePublishedVersion({
      id: "template-published-version-002",
      firmId: "firm-west-legal",
      templateDraft: templateDraft({
        version: 3,
        name: "Matter update",
        description: "Published staff draft",
        subject: "Published synthetic subject",
        textBody: "Published synthetic text.",
        htmlBody: "<p>Published synthetic text.</p>",
        recipientHints: ["primary_client"],
      }),
      version: 2,
      publishedByUserId: "user-admin",
      publishedAt: "2026-06-29T11:00:00.000Z",
    });

    const comparison = compareEmailTemplateDraftWithPublishedVersion(draft, publishedVersion);

    expect(comparison).toMatchObject({
      templateDraftId: "template-draft-001",
      draftVersion: 4,
      publishedVersionId: "template-published-version-002",
      publishedVersion: 2,
      changedFieldCount: 6,
    });
    expect(comparison.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
          label: "Name",
          changed: false,
        }),
        expect.objectContaining({
          field: "description",
          label: "Description",
          changed: true,
          draftValue: "Latest staff draft",
          publishedValue: "Published staff draft",
        }),
        expect.objectContaining({
          field: "recipientHints",
          changed: true,
          draftValue: ["primary_client", "assistant"],
          publishedValue: ["primary_client"],
        }),
        expect.objectContaining({
          field: "relatedResourceType",
          changed: true,
          draftValue: "document",
          publishedValue: undefined,
        }),
      ]),
    );
  });

  it("treats optional empty strings and undefined values as unchanged", () => {
    const draft = templateDraft({ description: "", relatedResourceType: "" });
    const publishedVersion = buildEmailTemplatePublishedVersion({
      id: "template-published-version-003",
      firmId: "firm-west-legal",
      templateDraft: templateDraft({
        description: undefined,
        relatedResourceType: undefined,
      }),
      version: 1,
      publishedByUserId: "user-admin",
      publishedAt: "2026-06-29T11:05:00.000Z",
    });

    const comparison = compareEmailTemplateDraftWithPublishedVersion(draft, publishedVersion);

    expect(comparison.fields.find((field) => field.field === "description")).toMatchObject({
      changed: false,
    });
    expect(comparison.fields.find((field) => field.field === "relatedResourceType")).toMatchObject({
      changed: false,
    });
    expect(comparison.changedFieldCount).toBe(0);
  });

  it("compares recipient hints in stored order", () => {
    const publishedVersion = buildEmailTemplatePublishedVersion({
      id: "template-published-version-004",
      firmId: "firm-west-legal",
      templateDraft: templateDraft({
        recipientHints: ["primary_client", "assistant"],
      }),
      version: 1,
      publishedByUserId: "user-admin",
      publishedAt: "2026-06-29T11:10:00.000Z",
    });

    const comparison = compareEmailTemplateDraftWithPublishedVersion(
      templateDraft({ recipientHints: ["assistant", "primary_client"] }),
      publishedVersion,
    );

    expect(comparison.fields.find((field) => field.field === "recipientHints")).toMatchObject({
      changed: true,
    });
    expect(comparison.changedFieldCount).toBe(1);
  });

  it("rejects mismatched draft and published version records", () => {
    const publishedVersion = buildEmailTemplatePublishedVersion({
      id: "template-published-version-005",
      firmId: "firm-west-legal",
      templateDraft: templateDraft(),
      version: 1,
      publishedByUserId: "user-admin",
      publishedAt: "2026-06-29T11:15:00.000Z",
    });

    expect(() =>
      compareEmailTemplateDraftWithPublishedVersion(
        templateDraft({ id: "template-draft-other" }),
        publishedVersion,
      ),
    ).toThrow("published version must belong to the compared draft");
    expect(() =>
      compareEmailTemplateDraftWithPublishedVersion(
        templateDraft({ firmId: "firm-other" }),
        publishedVersion,
      ),
    ).toThrow("must belong to the same firm");
  });
});
