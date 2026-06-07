import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { DraftAssistRecord } from "@open-practice/domain";
import { firms, users } from "./core.js";
import { documents } from "./documents.js";
import { matters } from "./matters.js";

export const drafts = pgTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id").references(() => matters.id),
    title: text("title").notNull(),
    editorJson: jsonb("editor_json").$type<Record<string, unknown>>().notNull(),
    renderedHtml: text("rendered_html"),
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
    firmMatter: index("drafts_firm_matter_idx").on(table.firmId, table.matterId),
  }),
);

export const draftTemplates = pgTable(
  "draft_templates",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    description: text("description"),
    editorJson: jsonb("editor_json").$type<Record<string, unknown>>().notNull(),
    category: text("category").notNull().default("general"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    firmCategory: index("draft_templates_firm_category_idx").on(table.firmId, table.category),
  }),
);

export const draftAssistRecords = pgTable(
  "draft_assist_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    sourceType: text("source_type").notNull(),
    draftId: text("draft_id").references(() => drafts.id),
    documentId: text("document_id").references(() => documents.id),
    task: text("task").notNull(),
    providerKey: text("provider_key").notNull(),
    providerModel: text("provider_model").notNull(),
    status: text("status").notNull(),
    suggestedText: text("suggested_text").notNull(),
    summary: text("summary"),
    reviewDecision: text("review_decision"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<DraftAssistRecord["metadata"]>().notNull().default({}),
  },
  (table) => ({
    firmMatter: index("draft_assist_records_firm_matter_idx").on(table.firmId, table.matterId),
    firmDraft: index("draft_assist_records_firm_draft_idx").on(table.firmId, table.draftId),
    firmDocument: index("draft_assist_records_firm_document_idx").on(
      table.firmId,
      table.documentId,
    ),
  }),
);
