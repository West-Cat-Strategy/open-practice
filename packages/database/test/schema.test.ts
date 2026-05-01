import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  answerSnapshots,
  authAccounts,
  authPasswordSetupTokens,
  authSessions,
  accessLogs,
  aiTriageRecords,
  authActionTokens,
  authChallenges,
  billingTrustTransferRequests,
  calendarCredentials,
  calendarEventAttendees,
  calendarEvents,
  documentTextExtractions,
  documentVersions,
  documents,
  drafts,
  draftAssistRecords,
  draftTemplates,
  emailEvents,
  emailOutbox,
  externalUploadLinks,
  firmSettings,
  inboundEmailAddresses,
  inboundEmailAttachments,
  inboundEmailMessages,
  invoiceLines,
  invoices,
  generatedDocuments,
  intakeTemplates,
  intakeSessions,
  jobLifecycleRecords,
  manualPayments,
  mediaDerivatives,
  mediaTranscripts,
  paymentAllocations,
  providerSettings,
  recoveryCodes,
  shareLinks,
  signatureProviderEvents,
  signatureRequestSigners,
  signatureRequests,
  totpCredentials,
  trustClientBalances,
  trustReconciliations,
  trustLedgerEntries,
  trustTransactionApprovals,
  trustTransactions,
} from "../src/schema.js";

describe("database schema hardening", () => {
  it("requires idempotency request fingerprints on trust transactions", () => {
    const columns = getTableConfig(trustTransactions).columns;
    const fingerprint = columns.find((column) => column.name === "request_fingerprint");

    expect(fingerprint?.notNull).toBe(true);
  });

  it("defines amount integrity checks for trust ledger entries", () => {
    const checks = getTableConfig(trustLedgerEntries).checks.map((check) => check.name);

    expect(checks).toContain("trust_ledger_entries_non_negative_amounts");
    expect(checks).toContain("trust_ledger_entries_one_sided_amount");
  });

  it("persists non-negative client trust balance guards", () => {
    const config = getTableConfig(trustClientBalances);

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "matter_id", "client_id", "balance_cents", "updated_at"]),
    );
    expect(config.primaryKeys).toHaveLength(1);
    expect(config.checks.map((check) => check.name)).toContain(
      "trust_client_balances_non_negative_balance",
    );
  });

  it("tracks document ingestion state", () => {
    const columns = getTableConfig(documents).columns.map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "upload_status",
        "checksum_status",
        "scan_status",
        "supersedes_document_id",
        "superseded_at",
        "verified_at",
      ]),
    );
  });

  it("persists matter-scoped calendar events", () => {
    const config = getTableConfig(calendarEvents);
    const columns = config.columns.map((column) => column.name);
    const uidIndex = config.indexes.find(
      (index) => index.config.name === "calendar_events_firm_matter_uid_idx",
    );

    expect(columns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "uid",
        "title",
        "starts_at",
        "ends_at",
        "description",
        "location",
        "status",
        "sequence",
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by_user_id",
        "updated_by_user_id",
      ]),
    );
    expect(uidIndex?.config.unique).toBe(true);
    expect(uidIndex?.config.where).toBeDefined();
  });

  it("persists meeting attendees for calendar events", () => {
    const config = getTableConfig(calendarEventAttendees);
    const columns = config.columns.map((column) => column.name);
    const emailIndex = config.indexes.find(
      (index) => index.config.name === "calendar_event_attendees_firm_event_email_idx",
    );

    expect(columns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "event_id",
        "name",
        "email",
        "role",
        "response_status",
        "invitation_status",
        "invited_at",
        "invitation_email_id",
        "invitation_job_id",
        "deleted_at",
      ]),
    );
    expect(emailIndex?.config.unique).toBe(true);
    expect(emailIndex?.config.where).toBeDefined();
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "calendar_event_attendees_role_value",
        "calendar_event_attendees_response_status_value",
        "calendar_event_attendees_invitation_status_value",
      ]),
    );
  });

  it("persists revocable calendar app-password credentials", () => {
    const config = getTableConfig(calendarCredentials);
    const usernameIndex = config.indexes.find(
      (index) => index.config.name === "calendar_credentials_username_idx",
    );

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "user_id",
        "username",
        "label",
        "password_hash",
        "created_at",
        "created_by_user_id",
        "last_used_at",
        "revoked_at",
      ]),
    );
    expect(usernameIndex?.config.unique).toBe(true);
  });

  it("documents the calendar migration cleanup before matter-scoped constraints", () => {
    const migration = readFileSync(
      new URL("../migrations/0011_tiny_lethal_legion.sql", import.meta.url),
      "utf8",
    );
    const cleanupIndex = migration.indexOf(
      'DELETE FROM "calendar_events" WHERE "matter_id" IS NULL;',
    );
    const matterRequiredIndex = migration.indexOf(
      'ALTER TABLE "calendar_events" ALTER COLUMN "matter_id" SET NOT NULL;',
    );
    const createdByRequiredIndex = migration.indexOf(
      'ALTER TABLE "calendar_events" ALTER COLUMN "created_by_user_id" SET NOT NULL;',
    );
    const userBackfillIndex = migration.indexOf(
      'UPDATE "calendar_events" AS "event"\nSET "created_by_user_id" = "matter"."responsible_user_id"',
    );

    expect(migration).toContain("legacy rows without a matter cannot be exposed safely");
    expect(cleanupIndex).toBeGreaterThanOrEqual(0);
    expect(cleanupIndex).toBeLessThan(matterRequiredIndex);
    expect(userBackfillIndex).toBeGreaterThan(matterRequiredIndex);
    expect(userBackfillIndex).toBeLessThan(createdByRequiredIndex);
  });

  it("persists signature lifecycle tables", () => {
    expect(getTableConfig(signatureRequests).columns.map((column) => column.name)).toContain(
      "requested_by_user_id",
    );
    expect(getTableConfig(signatureRequestSigners).columns.map((column) => column.name)).toContain(
      "signature_request_id",
    );
    expect(getTableConfig(signatureProviderEvents).columns.map((column) => column.name)).toContain(
      "occurred_at",
    );
  });

  it("persists guided intake sessions", () => {
    expect(getTableConfig(intakeSessions).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["matter_id", "template_id", "external_id", "status"]),
    );
  });

  it("persists non-authoritative draft assist records", () => {
    const config = getTableConfig(draftAssistRecords);

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "source_type",
        "draft_id",
        "document_id",
        "task",
        "provider_key",
        "provider_model",
        "status",
        "suggested_text",
        "review_decision",
        "metadata",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "draft_assist_records_firm_matter_idx",
        "draft_assist_records_firm_draft_idx",
        "draft_assist_records_firm_document_idx",
      ]),
    );
  });

  it("persists embedded auth accounts and sessions", () => {
    expect(getTableConfig(authAccounts).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "user_id", "password_hash", "password_updated_at"]),
    );
    expect(getTableConfig(authSessions).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "user_id",
        "token_hash",
        "expires_at",
        "revoked_at",
        "last_seen_at",
      ]),
    );
    expect(getTableConfig(authPasswordSetupTokens).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["token_hash", "expires_at", "used_at", "created_by_user_id"]),
    );
  });

  it("persists first-run firm settings", () => {
    expect(getTableConfig(firmSettings).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "business_address",
        "office_email",
        "office_phone",
        "practice_areas",
        "invoice_prefix",
        "default_payment_terms_days",
        "trust_account_label",
        "trust_funds_caveat_accepted_at",
        "trust_funds_caveat_accepted_by_user_id",
      ]),
    );
  });

  it("persists provider settings and queue lifecycle records", () => {
    expect(getTableConfig(providerSettings).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "kind", "key", "enabled", "encrypted_config"]),
    );
    expect(getTableConfig(jobLifecycleRecords).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "queue_name",
        "job_name",
        "bull_job_id",
        "status",
        "attempts_made",
        "max_attempts",
        "metadata",
      ]),
    );
  });

  it("persists email, inbound, and AI triage workflow tables", () => {
    expect(getTableConfig(emailOutbox).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["template_key", "status", "to_addresses", "html_body", "text_body"]),
    );
    expect(getTableConfig(emailEvents).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["email_id", "event_type", "provider_message_id", "metadata"]),
    );
    expect(getTableConfig(inboundEmailAddresses).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "address", "matter_id", "enabled"]),
    );
    expect(getTableConfig(inboundEmailMessages).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["message_id", "raw_storage_key", "parsed_text", "labels", "status"]),
    );
    expect(getTableConfig(inboundEmailAttachments).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "inbound_message_id",
        "document_id",
        "storage_key",
        "checksum_sha256",
      ]),
    );
    expect(getTableConfig(aiTriageRecords).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "source_type",
        "source_id",
        "provider",
        "model",
        "classification",
        "extracted_entities",
      ]),
    );
  });

  it("persists passkey, TOTP, and recovery records", () => {
    expect(getTableConfig(authChallenges).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["challenge_hash", "purpose", "expires_at", "consumed_at"]),
    );
    expect(getTableConfig(authActionTokens).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["token_hash", "purpose", "expires_at", "consumed_at"]),
    );
    expect(getTableConfig(totpCredentials).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["encrypted_secret", "verified_at", "disabled_at"]),
    );
    expect(getTableConfig(recoveryCodes).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["code_hash", "used_at"]),
    );
  });

  it("persists document processing, sharing, and external upload records", () => {
    expect(getTableConfig(documentVersions).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["document_id", "version", "storage_key", "editor_json"]),
    );
    expect(getTableConfig(documentTextExtractions).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["document_id", "engine", "language", "confidence", "extracted_text"]),
    );
    expect(getTableConfig(mediaTranscripts).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["document_id", "engine", "model", "transcript_storage_key"]),
    );
    expect(getTableConfig(mediaDerivatives).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["document_id", "kind", "storage_key", "content_type"]),
    );
    expect(getTableConfig(shareLinks).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["matter_id", "token_hash", "permissions", "expires_at"]),
    );
    expect(getTableConfig(externalUploadLinks).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["matter_id", "token_hash", "max_uploads", "used_uploads"]),
    );
    expect(getTableConfig(accessLogs).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["resource_type", "resource_id", "action", "occurred_at"]),
    );
  });

  it("persists answer snapshots for intake sessions", () => {
    expect(getTableConfig(answerSnapshots).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "intake_session_id",
        "captured_at",
        "answers",
        "resolution",
      ]),
    );
    expect(getTableConfig(intakeTemplates).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["definition_version", "definition"]),
    );
    expect(getTableConfig(generatedDocuments).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["package_id", "package_document_id"]),
    );
    expect(getTableConfig(intakeTemplates).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["description", "category", "created_at", "updated_at", "metadata"]),
    );
  });

  it("persists structured drafts and draft templates", () => {
    expect(getTableConfig(drafts).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "title",
        "editor_json",
        "rendered_html",
        "version",
        "created_by_user_id",
        "updated_by_user_id",
      ]),
    );
    expect(getTableConfig(draftTemplates).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["firm_id", "name", "editor_json", "category", "active"]),
    );
  });

  it("persists trust approval and reconciliation controls", () => {
    const approvalConfig = getTableConfig(trustTransactionApprovals);
    const reconciliationConfig = getTableConfig(trustReconciliations);

    expect(approvalConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["transaction_id", "decision", "decided_by_user_id", "decided_at"]),
    );
    expect(approvalConfig.checks.map((check) => check.name)).toContain(
      "trust_transaction_approvals_decision_value",
    );
    expect(reconciliationConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "statement_period_start",
        "statement_period_end",
        "expected_balance_cents",
        "actual_balance_cents",
        "status",
      ]),
    );
    expect(reconciliationConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "trust_reconciliations_valid_period",
        "trust_reconciliations_status_value",
      ]),
    );
  });

  it("persists native billing workflow tables", () => {
    expect(getTableConfig(invoices).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "matter_id",
        "invoice_number",
        "status",
        "subtotal_cents",
        "tax_cents",
        "total_cents",
        "paid_cents",
        "balance_due_cents",
      ]),
    );
    expect(getTableConfig(invoiceLines).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "invoice_id",
        "kind",
        "tax_name",
        "tax_rate_bps",
        "tax_cents",
        "time_entry_id",
        "expense_entry_id",
      ]),
    );
    expect(getTableConfig(manualPayments).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["received_at", "amount_cents", "method", "received_by_user_id"]),
    );
    expect(getTableConfig(paymentAllocations).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["payment_id", "invoice_id", "amount_cents", "allocated_at"]),
    );
    expect(
      getTableConfig(billingTrustTransferRequests).columns.map((column) => column.name),
    ).toEqual(
      expect.arrayContaining(["invoice_id", "amount_cents", "status", "ledger_transaction_id"]),
    );
  });
});
