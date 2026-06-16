import {
  boolean,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  EmbeddedIntakeTemplateDefinition,
  IntakeFormItemActionRecord,
  IntakeFormReviewRecord,
  IntakeResolutionSnapshot,
  IntakeVariableProposal,
} from "@open-practice/domain";
import { contacts } from "./contacts.js";
import { firms, users } from "./core.js";
import { documents } from "./documents.js";
import { matters } from "./matters.js";
import { signatureRequests } from "./signatures.js";

export const intakeTemplates = pgTable("intake_templates", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  provider: text("provider").notNull(),
  externalTemplateId: text("external_template_id").notNull(),
  active: boolean("active").notNull().default(true),
  definitionVersion: integer("definition_version").notNull().default(1),
  definition: jsonb("definition").$type<EmbeddedIntakeTemplateDefinition>().notNull().default({
    schemaVersion: 1,
    questions: [],
    branchRules: [],
    packages: [],
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
});

export const intakeTemplateVersions = pgTable(
  "intake_template_versions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    templateId: text("template_id")
      .notNull()
      .references(() => intakeTemplates.id),
    version: integer("version").notNull(),
    definitionVersion: integer("definition_version").notNull(),
    definition: jsonb("definition").$type<EmbeddedIntakeTemplateDefinition>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    publishedByUserId: text("published_by_user_id").references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    templateVersion: uniqueIndex("intake_template_versions_template_version_idx").on(
      table.templateId,
      table.version,
    ),
    firmTemplate: index("intake_template_versions_firm_template_idx").on(
      table.firmId,
      table.templateId,
    ),
  }),
);

export const intakeSessions = pgTable("intake_sessions", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  matterId: text("matter_id")
    .notNull()
    .references(() => matters.id),
  templateId: text("template_id")
    .notNull()
    .references(() => intakeTemplates.id),
  publishedTemplateVersionId: text("published_template_version_id").references(
    () => intakeTemplateVersions.id,
  ),
  provider: text("provider").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  clientContactId: text("client_contact_id").references(() => contacts.id),
  interviewUrl: text("interview_url"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const answerSnapshots = pgTable("answer_snapshots", {
  id: text("id").primaryKey(),
  firmId: text("firm_id")
    .notNull()
    .references(() => firms.id),
  intakeSessionId: text("intake_session_id")
    .notNull()
    .references(() => intakeSessions.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  answers: jsonb("answers").notNull(),
  resolution: jsonb("resolution").$type<IntakeResolutionSnapshot>().notNull().default({
    templateId: "",
    templateVersion: 1,
    visibleQuestionIds: [],
    matchedBranchRuleIds: [],
    eligiblePackageIds: [],
    selectedPackageIds: [],
    packageSummaries: [],
    packageDocuments: [],
  }),
});

export const intakeFormLinks = pgTable(
  "intake_form_links",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    intakeSessionId: text("intake_session_id")
      .notNull()
      .references(() => intakeSessions.id),
    tokenHash: text("token_hash").notNull(),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    clientContactId: text("client_contact_id").references(() => contacts.id),
    parentFormLinkId: text("parent_form_link_id").references((): AnyPgColumn => intakeFormLinks.id),
    answerSnapshotId: text("answer_snapshot_id").references(() => answerSnapshots.id),
    clientSubmissionId: text("client_submission_id"),
    submissionFingerprint: text("submission_fingerprint"),
    draftAnswers: jsonb("draft_answers").$type<Record<string, unknown>>(),
    draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHash: uniqueIndex("intake_form_links_token_hash_idx").on(table.tokenHash),
    matterExpiry: index("intake_form_links_matter_expiry_idx").on(table.matterId, table.expiresAt),
    parent: index("intake_form_links_parent_idx").on(table.parentFormLinkId),
    snapshot: index("intake_form_links_snapshot_idx").on(table.answerSnapshotId),
    submission: index("intake_form_links_submission_idx").on(table.id, table.clientSubmissionId),
  }),
);

export const intakeFormReviews = pgTable(
  "intake_form_reviews",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    intakeSessionId: text("intake_session_id")
      .notNull()
      .references(() => intakeSessions.id),
    formLinkId: text("form_link_id")
      .notNull()
      .references(() => intakeFormLinks.id),
    answerSnapshotId: text("answer_snapshot_id")
      .notNull()
      .references(() => answerSnapshots.id),
    decision: text("decision").$type<IntakeFormReviewRecord["decision"]>().notNull(),
    decidedByUserId: text("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    followUpFormLinkId: text("follow_up_form_link_id").references(() => intakeFormLinks.id),
  },
  (table) => ({
    formLink: uniqueIndex("intake_form_reviews_form_link_idx").on(table.formLinkId),
    snapshot: index("intake_form_reviews_snapshot_idx").on(table.answerSnapshotId),
    matterDecision: index("intake_form_reviews_matter_decision_idx").on(
      table.matterId,
      table.decision,
    ),
  }),
);

export const intakeFormItemActions = pgTable(
  "intake_form_item_actions",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    intakeSessionId: text("intake_session_id")
      .notNull()
      .references(() => intakeSessions.id),
    formLinkId: text("form_link_id")
      .notNull()
      .references(() => intakeFormLinks.id),
    itemId: text("item_id").notNull(),
    kind: text("kind").$type<IntakeFormItemActionRecord["kind"]>().notNull(),
    status: text("status").$type<IntakeFormItemActionRecord["status"]>().notNull(),
    documentId: text("document_id").references(() => documents.id),
    signatureRequestId: text("signature_request_id").references(() => signatureRequests.id),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    linkItem: index("intake_form_item_actions_link_item_idx").on(table.formLinkId, table.itemId),
  }),
);

export const intakeVariableProposals = pgTable(
  "intake_variable_proposals",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .references(() => firms.id),
    matterId: text("matter_id")
      .notNull()
      .references(() => matters.id),
    intakeSessionId: text("intake_session_id")
      .notNull()
      .references(() => intakeSessions.id),
    answerSnapshotId: text("answer_snapshot_id")
      .notNull()
      .references(() => answerSnapshots.id),
    sourceQuestionId: text("source_question_id").notNull(),
    targetScope: text("target_scope").$type<IntakeVariableProposal["targetScope"]>().notNull(),
    targetField: text("target_field").$type<IntakeVariableProposal["targetField"]>().notNull(),
    targetRecordId: text("target_record_id").notNull(),
    proposedValue: text("proposed_value").notNull(),
    status: text("status").$type<IntakeVariableProposal["status"]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => ({
    matterStatus: index("intake_variable_proposals_matter_status_idx").on(
      table.matterId,
      table.status,
    ),
    snapshot: index("intake_variable_proposals_snapshot_idx").on(table.answerSnapshotId),
  }),
);
