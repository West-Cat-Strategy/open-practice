import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  EmailTemplatePreviewSnapshotRecord,
  EmailTemplateReviewedOutboundPreviewRecord,
  EmailTemplateRecipientSummary,
} from "@open-practice/domain";
import { contacts } from "./contacts.js";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const emailTemplateDrafts = pgTable(
  "email_template_drafts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull().default("general"),
    templateKey: text("template_key").notNull(),
    from: text("from_address").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull().default(""),
    htmlBody: text("html_body").notNull().default(""),
    recipientHints: jsonb("recipient_hints").$type<string[]>().notNull().default([]),
    relatedResourceType: text("related_resource_type"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmStatusUpdated: index("email_template_drafts_firm_status_updated_idx").on(
      table.firmId,
      table.status,
      table.updatedAt,
    ),
    firmCategory: index("email_template_drafts_firm_category_idx").on(table.firmId, table.category),
    statusValue: check(
      "email_template_drafts_status_value",
      sql`${table.status} in ('draft', 'archived')`,
    ),
    positiveVersion: check("email_template_drafts_positive_version", sql`${table.version} > 0`),
  }),
);

export const emailTemplatePreviewSnapshots = pgTable(
  "email_template_preview_snapshots",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    templateDraftId: text("template_draft_id")
      .notNull()
      .references(() => emailTemplateDrafts.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    templateKey: text("template_key").notNull(),
    subjectPreview: text("subject_preview").notNull(),
    textPreview: text("text_preview"),
    htmlPreview: text("html_preview"),
    recipientSummary: jsonb("recipient_summary")
      .$type<EmailTemplateRecipientSummary>()
      .notNull()
      .default({
        toCount: 0,
        ccCount: 0,
        bccCount: 0,
        recipientCount: 0,
      }),
    relatedResourceType: text("related_resource_type"),
    relatedResourceId: text("related_resource_id"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    delivery: jsonb("delivery")
      .$type<EmailTemplatePreviewSnapshotRecord["delivery"]>()
      .notNull()
      .default({ persisted: true, queued: false }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmTemplateCreated: index("email_template_preview_snapshots_template_created_idx").on(
      table.firmId,
      table.templateDraftId,
      table.createdAt,
    ),
    firmMatterCreated: index("email_template_preview_snapshots_matter_created_idx").on(
      table.firmId,
      table.matterId,
      table.createdAt,
    ),
  }),
);

export const emailTemplatePublishedVersions = pgTable(
  "email_template_published_versions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    templateDraftId: text("template_draft_id")
      .notNull()
      .references(() => emailTemplateDrafts.id),
    version: integer("version").notNull(),
    draftVersion: integer("draft_version").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull().default("general"),
    templateKey: text("template_key").notNull(),
    from: text("from_address").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull().default(""),
    htmlBody: text("html_body").notNull().default(""),
    recipientHints: jsonb("recipient_hints").$type<string[]>().notNull().default([]),
    relatedResourceType: text("related_resource_type"),
    publishedByUserId: text("published_by_user_id")
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmTemplateVersion: uniqueIndex("email_template_published_versions_template_version_idx").on(
      table.firmId,
      table.templateDraftId,
      table.version,
    ),
    firmTemplatePublished: index("email_template_published_versions_template_published_idx").on(
      table.firmId,
      table.templateDraftId,
      table.publishedAt,
    ),
    positiveVersion: check(
      "email_template_published_versions_positive_version",
      sql`${table.version} > 0`,
    ),
    positiveDraftVersion: check(
      "email_template_published_versions_positive_draft_version",
      sql`${table.draftVersion} > 0`,
    ),
  }),
);

export const emailTemplateReviewedOutboundPreviews = pgTable(
  "email_template_reviewed_outbound_previews",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    templateDraftId: text("template_draft_id")
      .notNull()
      .references(() => emailTemplateDrafts.id),
    publishedVersionId: text("published_version_id")
      .notNull()
      .references(() => emailTemplatePublishedVersions.id),
    publishedVersion: integer("published_version").notNull(),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    contactMethodId: text("contact_method_id").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    templateKey: text("template_key").notNull(),
    subjectPreview: text("subject_preview").notNull(),
    textPreview: text("text_preview"),
    htmlPreview: text("html_preview"),
    recipientSummary: jsonb("recipient_summary")
      .$type<EmailTemplateRecipientSummary>()
      .notNull()
      .default({
        toCount: 1,
        ccCount: 0,
        bccCount: 0,
        recipientCount: 1,
      }),
    reviewStatus: text("review_status").notNull().default("reviewed_preview"),
    relatedResourceType: text("related_resource_type"),
    relatedResourceId: text("related_resource_id"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    delivery: jsonb("delivery")
      .$type<EmailTemplateReviewedOutboundPreviewRecord["delivery"]>()
      .notNull()
      .default({ persisted: true, queued: false }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmTemplateCreated: index("email_template_reviewed_previews_template_created_idx").on(
      table.firmId,
      table.templateDraftId,
      table.createdAt,
    ),
    firmMatterCreated: index("email_template_reviewed_previews_matter_created_idx").on(
      table.firmId,
      table.matterId,
      table.createdAt,
    ),
    firmPublishedVersion: index("email_template_reviewed_previews_published_version_idx").on(
      table.firmId,
      table.publishedVersionId,
    ),
    positivePublishedVersion: check(
      "email_template_reviewed_previews_positive_published_version",
      sql`${table.publishedVersion} > 0`,
    ),
    reviewStatusValue: check(
      "email_template_reviewed_previews_review_status_value",
      sql`${table.reviewStatus} in ('reviewed_preview')`,
    ),
  }),
);
