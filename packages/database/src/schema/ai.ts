import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  AiOperationalProposalRecord,
  LegalResearchArtifactRecord,
} from "@open-practice/domain";
import { firms, users } from "./core.js";
import { matters } from "./matters.js";

export const aiTriageRecords = pgTable(
  "ai_triage_records",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("pending"),
    classification: text("classification"),
    confidence: integer("confidence"),
    extractedEntities: jsonb("extracted_entities")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    suggestedActions: jsonb("suggested_actions").$type<string[]>().notNull().default([]),
    suggestedDraft: text("suggested_draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  },
  (table) => ({
    firmSource: index("ai_triage_records_firm_source_idx").on(
      table.firmId,
      table.sourceType,
      table.sourceId,
    ),
  }),
);

export const aiOperationalProposals = pgTable(
  "ai_operational_proposals",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    source: jsonb("source").$type<AiOperationalProposalRecord["source"]>().notNull(),
    providerKey: text("provider_key").notNull(),
    providerModel: text("provider_model").notNull(),
    proposal: jsonb("proposal").$type<AiOperationalProposalRecord["proposal"]>().notNull(),
    reviewDecision: text("review_decision"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata")
      .$type<AiOperationalProposalRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmMatter: index("ai_operational_proposals_firm_matter_idx").on(
      table.firmId,
      table.matterId,
      table.createdAt,
    ),
    firmStatus: index("ai_operational_proposals_firm_status_idx").on(
      table.firmId,
      table.status,
      table.createdAt,
    ),
    firmKind: index("ai_operational_proposals_firm_kind_idx").on(
      table.firmId,
      table.kind,
      table.createdAt,
    ),
    kindValue: check(
      "ai_operational_proposals_kind_value",
      sql`${table.kind} in ('deadline_extraction', 'task_creation', 'document_organization', 'draft_invoice_cue', 'client_update_draft')`,
    ),
    statusValue: check(
      "ai_operational_proposals_status_value",
      sql`${table.status} in ('proposed', 'approved', 'rejected')`,
    ),
    sourceTypeValue: check(
      "ai_operational_proposals_source_type_value",
      sql`${table.source}->>'sourceType' in ('draft', 'document')`,
    ),
    draftSourceId: check(
      "ai_operational_proposals_draft_source_id",
      sql`${table.source}->>'sourceType' <> 'draft' or length(trim(coalesce(${table.source}->>'draftId', ''))) > 0`,
    ),
    documentSourceId: check(
      "ai_operational_proposals_document_source_id",
      sql`${table.source}->>'sourceType' <> 'document' or length(trim(coalesce(${table.source}->>'documentId', ''))) > 0`,
    ),
    sourceTextLength: check(
      "ai_operational_proposals_source_text_length",
      sql`jsonb_typeof(${table.source}->'sourceTextLength') = 'number' and (${table.source}->>'sourceTextLength')::integer >= 0`,
    ),
    proposalTitle: check(
      "ai_operational_proposals_proposal_title",
      sql`length(trim(coalesce(${table.proposal}->>'title', ''))) > 0`,
    ),
    proposalSummary: check(
      "ai_operational_proposals_proposal_summary",
      sql`length(trim(coalesce(${table.proposal}->>'summary', ''))) > 0`,
    ),
    proposalAction: check(
      "ai_operational_proposals_proposal_action",
      sql`length(trim(coalesce(${table.proposal}->>'proposedAction', ''))) > 0`,
    ),
    reviewDecisionValue: check(
      "ai_operational_proposals_review_decision_value",
      sql`${table.reviewDecision} is null or ${table.reviewDecision} in ('approved', 'rejected')`,
    ),
    statusOnlyReview: check(
      "ai_operational_proposals_status_only_review",
      sql`(
        ${table.status} = 'proposed'
        and ${table.reviewDecision} is null
        and ${table.reviewedByUserId} is null
        and ${table.reviewedAt} is null
      ) or (
        ${table.status} in ('approved', 'rejected')
        and ${table.reviewDecision} = ${table.status}
        and ${table.reviewedByUserId} is not null
        and ${table.reviewedAt} is not null
      )`,
    ),
  }),
);

export const legalResearchArtifacts = pgTable(
  "legal_research_artifacts",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    note: text("note"),
    sourceReferences: jsonb("source_references")
      .$type<LegalResearchArtifactRecord["sourceReferences"]>()
      .notNull()
      .default([]),
    contextLinks: jsonb("context_links")
      .$type<LegalResearchArtifactRecord["contextLinks"]>()
      .notNull()
      .default([]),
    documentAnalysis:
      jsonb("document_analysis").$type<LegalResearchArtifactRecord["documentAnalysis"]>(),
    timeline: jsonb("timeline").$type<LegalResearchArtifactRecord["timeline"]>(),
    checkpoint: jsonb("checkpoint").$type<LegalResearchArtifactRecord["checkpoint"]>(),
    reviewDecision: text("review_decision"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    reviewOnly: boolean("review_only").notNull().default(true),
    metadata: jsonb("metadata")
      .$type<LegalResearchArtifactRecord["metadata"]>()
      .notNull()
      .default({}),
  },
  (table) => ({
    firmMatter: index("legal_research_artifacts_firm_matter_idx").on(
      table.firmId,
      table.matterId,
      table.updatedAt,
    ),
    firmStatus: index("legal_research_artifacts_firm_status_idx").on(
      table.firmId,
      table.status,
      table.updatedAt,
    ),
    firmKind: index("legal_research_artifacts_firm_kind_idx").on(
      table.firmId,
      table.kind,
      table.updatedAt,
    ),
    kindValue: check(
      "legal_research_artifacts_kind_value",
      sql`${table.kind} in ('cited_source_note', 'matter_context_attachment', 'document_analysis_status', 'strategy_timeline_note', 'review_checkpoint')`,
    ),
    statusValue: check(
      "legal_research_artifacts_status_value",
      sql`${table.status} in ('draft', 'ready_for_review', 'reviewed', 'rejected')`,
    ),
    titlePresent: check(
      "legal_research_artifacts_title_present",
      sql`length(trim(${table.title})) > 0`,
    ),
    noteLength: check(
      "legal_research_artifacts_note_length",
      sql`${table.note} is null or length(${table.note}) <= 4000`,
    ),
    sourceReferencesArray: check(
      "legal_research_artifacts_source_references_array",
      sql`jsonb_typeof(${table.sourceReferences}) = 'array'`,
    ),
    contextLinksArray: check(
      "legal_research_artifacts_context_links_array",
      sql`jsonb_typeof(${table.contextLinks}) = 'array'`,
    ),
    reviewDecisionValue: check(
      "legal_research_artifacts_review_decision_value",
      sql`${table.reviewDecision} is null or ${table.reviewDecision} in ('reviewed', 'rejected')`,
    ),
    statusOnlyReview: check(
      "legal_research_artifacts_status_only_review",
      sql`(
        ${table.status} in ('draft', 'ready_for_review')
        and ${table.reviewDecision} is null
        and ${table.reviewedByUserId} is null
        and ${table.reviewedAt} is null
      ) or (
        ${table.status} in ('reviewed', 'rejected')
        and ${table.reviewDecision} = ${table.status}
        and ${table.reviewedByUserId} is not null
        and ${table.reviewedAt} is not null
      )`,
    ),
    reviewOnlyValue: check("legal_research_artifacts_review_only", sql`${table.reviewOnly} = true`),
  }),
);
