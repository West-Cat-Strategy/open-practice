import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  answerSnapshots,
  authAccounts,
  authPasswordSetupTokens,
  authSessions,
  accessLogs,
  aiOperationalProposals,
  aiTriageRecords,
  authActionTokens,
  authChallenges,
  billingPeriodLocks,
  billingRateRules,
  billingTrustTransferRequests,
  calendarCredentials,
  calendarEventAttendees,
  calendarEventReminders,
  calendarEvents,
  calendarGuestLinks,
  calendarMeetingSessions,
  calendarSchedulingRequests,
  connectorDeliveryAttempts,
  connectorOutbox,
  connectors,
  contactRelationships,
  conversationMessages,
  conversationThreads,
  documentAssemblyPackages,
  documentAssemblySetDefinitions,
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
  integrationApiCredentials,
  integrationDeveloperApps,
  integrationWebhookSubscriptions,
  invoiceLines,
  invoices,
  generatedDocuments,
  hostedPaymentRequests,
  intakeFormLinks,
  intakeFormReviews,
  intakeTemplates,
  intakeSessions,
  jobLifecycleRecords,
  legalClinicMatterProfiles,
  legalClinicPrograms,
  legalResearchArtifacts,
  manualPayments,
  mediaDerivatives,
  mediaTranscripts,
  paymentAllocations,
  providerSettings,
  recoveryCodes,
  savedOperationalViewDefinitions,
  shareLinks,
  signatureEnvelopes,
  signatureProviderEvents,
  signatureRequestSigners,
  signatureRequests,
  totpCredentials,
  ledgerAccountingReviewProfiles,
  trustClientBalances,
  trustReconciliationExceptionResolutions,
  trustReconciliations,
  trustStatementMatchRuleProfiles,
  trustStatementImportBatches,
  trustLedgerEntries,
  trustTransactionApprovals,
  trustTransactions,
  timeEntries,
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
        "size_bytes",
        "supersedes_document_id",
        "superseded_at",
        "verified_at",
      ]),
    );
  });

  it("persists contact relationship graph records with safe relationship constraints", () => {
    const config = getTableConfig(contactRelationships);

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "contact_id",
        "related_contact_id",
        "relationship_kind",
        "label",
        "matter_id",
        "source",
        "status",
        "created_at",
        "updated_at",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "contact_relationships_contact_status_idx",
        "contact_relationships_related_contact_status_idx",
        "contact_relationships_matter_status_idx",
      ]),
    );
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "contact_relationships_kind_value",
        "contact_relationships_source_value",
        "contact_relationships_status_value",
        "contact_relationships_label_present",
        "contact_relationships_different_contacts",
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
        "meeting_link_mode",
        "meeting_link_url",
        "meeting_room_id",
        "meeting_provider_key",
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by_user_id",
        "updated_by_user_id",
      ]),
    );
    expect(uidIndex?.config.unique).toBe(true);
    expect(uidIndex?.config.where).toBeDefined();
    expect(
      config.checks.some((check) => check.name === "calendar_events_meeting_link_mode_value"),
    ).toBe(true);
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

  it("persists manual reminder state for calendar events", () => {
    const config = getTableConfig(calendarEventReminders);
    const columns = config.columns.map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "event_id",
        "remind_at",
        "channel",
        "status",
        "note",
        "created_at",
        "updated_at",
        "deleted_at",
        "created_by_user_id",
        "updated_by_user_id",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "calendar_event_reminders_event_active_idx",
        "calendar_event_reminders_status_due_idx",
      ]),
    );
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "calendar_event_reminders_channel_value",
        "calendar_event_reminders_status_value",
      ]),
    );
  });

  it("persists reviewed calendar scheduling request records", () => {
    const config = getTableConfig(calendarSchedulingRequests);
    const columns = config.columns.map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "kind",
        "status",
        "title",
        "task_id",
        "calendar_event_id",
        "calendar_reminder_id",
        "owner_user_id",
        "source_type",
        "source_id",
        "source_label",
        "requested_due_at",
        "requested_starts_at",
        "requested_ends_at",
        "reminder_posture",
        "privacy",
        "time_capture_cue",
        "created_by_user_id",
        "updated_by_user_id",
        "reviewed_at",
        "reviewed_by_user_id",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "calendar_scheduling_requests_matter_status_idx",
        "calendar_scheduling_requests_owner_status_idx",
      ]),
    );
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "calendar_scheduling_requests_kind_value",
        "calendar_scheduling_requests_status_value",
        "calendar_scheduling_requests_source_type_value",
        "calendar_scheduling_requests_reminder_posture_value",
        "calendar_scheduling_requests_privacy_value",
        "calendar_scheduling_requests_title_present",
        "calendar_scheduling_requests_source_label_present",
      ]),
    );
  });

  it("persists hosted calendar meeting sessions and hash-only guest links", () => {
    const sessionConfig = getTableConfig(calendarMeetingSessions);
    const guestLinkConfig = getTableConfig(calendarGuestLinks);

    expect(sessionConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "event_id",
        "status",
        "retention_until",
        "ended_at",
        "created_by_user_id",
        "updated_by_user_id",
        "metadata",
      ]),
    );
    expect(sessionConfig.indexes.map((index) => index.config.name)).toContain(
      "calendar_meeting_sessions_firm_matter_event_idx",
    );
    expect(sessionConfig.checks.map((check) => check.name)).toContain(
      "calendar_meeting_sessions_status_value",
    );

    const guestColumns = guestLinkConfig.columns.map((column) => column.name);
    expect(guestColumns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "event_id",
        "session_id",
        "token_hash",
        "status",
        "expires_at",
        "retention_until",
        "checked_in_at",
        "revoked_at",
        "admitted_at",
        "denied_at",
        "created_by_user_id",
        "updated_by_user_id",
        "metadata",
      ]),
    );
    expect(sessionConfig.columns.map((column) => column.name)).not.toContain("room_id");
    expect(sessionConfig.columns.map((column) => column.name)).not.toContain("provider_key");
    expect(guestColumns).not.toContain("token");
    expect(guestColumns).not.toContain("raw_token");
    expect(guestColumns).not.toContain("display_name");
    expect(guestColumns).not.toContain("email");
    expect(
      guestLinkConfig.indexes.find(
        (index) => index.config.name === "calendar_guest_links_token_hash_idx",
      )?.config.unique,
    ).toBe(true);
    expect(guestLinkConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "calendar_guest_links_session_status_idx",
        "calendar_guest_links_expiry_idx",
      ]),
    );
    expect(guestLinkConfig.checks.map((check) => check.name)).toContain(
      "calendar_guest_links_status_value",
    );
  });

  it("persists matter-scoped conversation thread boundary fields", () => {
    const config = getTableConfig(conversationThreads);
    const columns = config.columns.map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "topic",
        "status",
        "retention_until",
        "export_state",
        "access_revoked_at",
        "notification_boundary",
        "created_by_user_id",
        "updated_by_user_id",
        "metadata",
      ]),
    );
    expect(
      config.indexes.some(
        (index) => index.config.name === "conversation_threads_firm_matter_updated_idx",
      ),
    ).toBe(true);
    expect(
      config.indexes.find(
        (index) => index.config.name === "conversation_threads_firm_matter_topic_idx",
      )?.config.unique,
    ).toBe(true);
  });

  it("persists matter-scoped conversation message records", () => {
    const config = getTableConfig(conversationMessages);
    const columns = config.columns.map((column) => column.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "thread_id",
        "kind",
        "body_text",
        "authored_at",
        "authored_by_user_id",
        "created_by_user_id",
        "metadata",
      ]),
    );
    expect(
      config.indexes.some(
        (index) => index.config.name === "conversation_messages_firm_matter_thread_authored_idx",
      ),
    ).toBe(true);
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

  it("persists provider-neutral connectors and idempotent outbox rows", () => {
    const connectorConfig = getTableConfig(connectors);
    const outboxConfig = getTableConfig(connectorOutbox);
    const attemptConfig = getTableConfig(connectorDeliveryAttempts);

    expect(connectorConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "type",
        "key",
        "display_name",
        "status",
        "secret_reference",
        "config_summary",
      ]),
    );
    expect(
      connectorConfig.indexes.find((index) => index.config.name === "connectors_firm_key_idx")
        ?.config.unique,
    ).toBe(true);
    expect(outboxConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "connector_id",
        "event_type",
        "idempotency_key",
        "status",
        "payload_summary",
        "attempt_count",
        "max_attempts",
        "next_attempt_at",
      ]),
    );
    expect(
      outboxConfig.indexes.find(
        (index) => index.config.name === "connector_outbox_firm_idempotency_idx",
      )?.config.unique,
    ).toBe(true);
    expect(attemptConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "connector_id",
        "outbox_id",
        "attempt_number",
        "status",
        "idempotency_key",
        "error_summary",
      ]),
    );
  });

  it("persists integration developer app boundary records", () => {
    const appConfig = getTableConfig(integrationDeveloperApps);
    const credentialConfig = getTableConfig(integrationApiCredentials);
    const subscriptionConfig = getTableConfig(integrationWebhookSubscriptions);

    expect(appConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "connector_id",
        "client_id",
        "display_name",
        "status",
        "redirect_uris",
        "allowed_origins",
        "allowed_scopes",
        "regional_endpoint",
        "rate_limit",
        "custom_action_placeholders",
        "created_by_user_id",
      ]),
    );
    expect(
      appConfig.indexes.find(
        (index) => index.config.name === "integration_developer_apps_firm_client_idx",
      )?.config.unique,
    ).toBe(true);
    expect(credentialConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "app_id",
        "label",
        "scopes",
        "secret_reference",
        "status",
        "expires_at",
        "last_used_at",
        "revoked_at",
      ]),
    );
    expect(subscriptionConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "app_id",
        "connector_id",
        "status",
        "event_types",
        "destination_url",
        "destination_host",
        "signing_secret_reference",
      ]),
    );
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

  it("persists legal clinic programs and one matter profile per matter", () => {
    const programConfig = getTableConfig(legalClinicPrograms);
    const profileConfig = getTableConfig(legalClinicMatterProfiles);
    const profileMatterIndex = profileConfig.indexes.find(
      (index) => index.config.name === "legal_clinic_matter_profiles_firm_matter_idx",
    );

    expect(programConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "name",
        "status",
        "service_area",
        "eligibility_summary",
        "default_referral_source",
        "default_referral_status",
        "metadata",
      ]),
    );
    expect(profileConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "program_id",
        "eligibility_status",
        "referral_source",
        "referral_status",
        "referral_date",
        "next_review_date",
        "clinic_relationship_role",
        "notes",
        "updated_by_user_id",
      ]),
    );
    expect(profileMatterIndex?.config.unique).toBe(true);
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

  it("persists review-only AI operational proposals", () => {
    const config = getTableConfig(aiOperationalProposals);

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "kind",
        "status",
        "source",
        "provider_key",
        "provider_model",
        "proposal",
        "review_decision",
        "reviewed_by_user_id",
        "reviewed_at",
        "metadata",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "ai_operational_proposals_firm_matter_idx",
        "ai_operational_proposals_firm_status_idx",
        "ai_operational_proposals_firm_kind_idx",
      ]),
    );
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "ai_operational_proposals_kind_value",
        "ai_operational_proposals_status_value",
        "ai_operational_proposals_source_type_value",
        "ai_operational_proposals_status_only_review",
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
      expect.arrayContaining([
        "matter_id",
        "template_key",
        "status",
        "to_addresses",
        "html_body",
        "text_body",
        "attempt_count",
        "last_attempt_at",
        "terminal_failure_at",
        "terminal_failure_reason",
      ]),
    );
    expect(getTableConfig(emailEvents).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "email_id",
        "event_type",
        "provider_message_id",
        "attempt_number",
        "job_id",
        "source",
        "error_message",
        "metadata",
      ]),
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
    expect(getTableConfig(legalResearchArtifacts).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "kind",
        "status",
        "title",
        "note",
        "source_references",
        "context_links",
        "document_analysis",
        "review_only",
      ]),
    );
    expect(getTableConfig(legalResearchArtifacts).checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "legal_research_artifacts_kind_value",
        "legal_research_artifacts_status_value",
        "legal_research_artifacts_status_only_review",
        "legal_research_artifacts_review_only",
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

  it("persists private saved operational view definitions", () => {
    const config = getTableConfig(savedOperationalViewDefinitions);
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "owner_user_id",
        "surface",
        "name",
        "filters",
        "columns",
        "sort",
        "row_limit",
        "dashboard_behavior",
        "permission_scope",
        "status",
        "archived_at",
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "saved_operational_views_owner_surface_status_idx",
        "saved_operational_views_firm_surface_name_idx",
      ]),
    );
    expect(config.checks.map((check) => check.name)).toContain(
      "saved_operational_views_positive_row_limit",
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

  it("persists document assembly sets, packages, and signature envelope metadata", () => {
    const setConfig = getTableConfig(documentAssemblySetDefinitions);
    const packageConfig = getTableConfig(documentAssemblyPackages);
    const envelopeConfig = getTableConfig(signatureEnvelopes);

    expect(setConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "name",
        "document_refs",
        "required_merge_fields",
        "active",
        "metadata",
      ]),
    );
    expect(packageConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "definition_id",
        "status",
        "population_status",
        "document_ids",
        "generated_document_ids",
        "signature_request_ids",
      ]),
    );
    expect(envelopeConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "assembly_package_id",
        "signature_request_id",
        "signer_order",
        "field_placements",
        "validation_status",
      ]),
    );
    expect(packageConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "document_assembly_packages_status_value",
        "document_assembly_packages_population_status_value",
      ]),
    );
    expect(envelopeConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "signature_envelopes_status_value",
        "signature_envelopes_validation_status_value",
      ]),
    );
  });

  it("persists submitted intake review lifecycle state", () => {
    const linkConfig = getTableConfig(intakeFormLinks);
    const reviewConfig = getTableConfig(intakeFormReviews);

    expect(linkConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "parent_form_link_id",
        "answer_snapshot_id",
        "client_submission_id",
        "submission_fingerprint",
        "draft_answers",
        "draft_updated_at",
        "submitted_at",
      ]),
    );
    expect(linkConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "intake_form_links_parent_idx",
        "intake_form_links_snapshot_idx",
        "intake_form_links_submission_idx",
      ]),
    );
    expect(reviewConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "matter_id",
        "intake_session_id",
        "form_link_id",
        "answer_snapshot_id",
        "decision",
        "decided_by_user_id",
        "decided_at",
        "reason",
        "follow_up_form_link_id",
      ]),
    );
    expect(reviewConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "intake_form_reviews_form_link_idx",
        "intake_form_reviews_snapshot_idx",
        "intake_form_reviews_matter_decision_idx",
      ]),
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
        "beginning_balance_cents",
        "ending_balance_cents",
        "expected_balance_cents",
        "actual_balance_cents",
        "statement_rows",
        "variance_explanation",
        "status",
      ]),
    );
    expect(reconciliationConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "trust_reconciliations_valid_period",
        "trust_reconciliations_status_value",
      ]),
    );
    const importBatchConfig = getTableConfig(trustStatementImportBatches);
    expect(importBatchConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "source_label",
        "checksum_sha256",
        "imported_statement_row_count",
        "duplicate_statement_row_count",
        "status",
        "matching_profile_id",
        "created_by_user_id",
        "created_at",
      ]),
    );
    expect(importBatchConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "trust_statement_import_batches_account_created_idx",
        "trust_statement_import_batches_checksum_idx",
      ]),
    );
    expect(importBatchConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "trust_statement_import_batches_source_label_present",
        "trust_statement_import_batches_checksum_value",
        "trust_statement_import_batches_positive_row_count",
        "trust_statement_import_batches_duplicate_count_range",
        "trust_statement_import_batches_status_value",
        "trust_statement_import_batches_matching_profile_present",
      ]),
    );
    const matchProfileConfig = getTableConfig(trustStatementMatchRuleProfiles);
    expect(matchProfileConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "name",
        "reference_strategy",
        "description_strategy",
        "date_window_days",
        "amount_tolerance_cents",
        "variance_categories",
        "reviewer_explanation_required",
        "review_only",
        "created_by_user_id",
        "created_at",
        "updated_at",
      ]),
    );
    expect(matchProfileConfig.indexes.map((index) => index.config.name)).toContain(
      "trust_statement_match_profiles_account_created_idx",
    );
    expect(matchProfileConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "trust_statement_match_profiles_name_present",
        "trust_statement_match_profiles_reference_strategy_value",
        "trust_statement_match_profiles_description_strategy_value",
        "trust_statement_match_profiles_date_window_range",
        "trust_statement_match_profiles_tolerance_range",
        "trust_statement_match_profiles_variance_categories_nonempty",
        "trust_statement_match_profiles_review_only_value",
      ]),
    );
    const accountingProfileConfig = getTableConfig(ledgerAccountingReviewProfiles);
    expect(accountingProfileConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "account_type",
        "boundary_posture",
        "protected_funds",
        "bank_feed_import",
        "dimensions",
        "review_only",
        "created_by_user_id",
        "created_at",
        "updated_at",
      ]),
    );
    expect(accountingProfileConfig.indexes.map((index) => index.config.name)).toContain(
      "ledger_accounting_review_profiles_account_created_idx",
    );
    expect(accountingProfileConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "ledger_accounting_review_profiles_account_type_value",
        "ledger_accounting_review_profiles_boundary_posture_value",
        "ledger_accounting_review_profiles_protected_funds_reason",
        "ledger_accounting_review_profiles_bank_feed_auto_match_off",
        "ledger_accounting_review_profiles_bank_feed_source_label",
        "ledger_accounting_review_profiles_client_matter_required",
        "ledger_accounting_review_profiles_review_only_value",
      ]),
    );
    const exceptionResolutionConfig = getTableConfig(trustReconciliationExceptionResolutions);
    expect(exceptionResolutionConfig.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "account_id",
        "statement_row",
        "variance_decision",
        "resolution_note",
        "recorded_by_user_id",
        "recorded_at",
      ]),
    );
    expect(exceptionResolutionConfig.columns.map((column) => column.name)).not.toContain(
      "evidence",
    );
    expect(exceptionResolutionConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "trust_reconciliation_exception_resolutions_variance_decision_value",
        "trust_reconciliation_exception_resolutions_note_present",
      ]),
    );
  });

  it("persists native billing workflow tables", () => {
    expect(getTableConfig(timeEntries).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["rate_rule_id", "rate_snapshot"]),
    );
    expect(getTableConfig(billingPeriodLocks).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "period_start",
        "period_end",
        "reason",
        "locked_by_user_id",
        "locked_at",
      ]),
    );
    expect(getTableConfig(billingRateRules).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "firm_id",
        "label",
        "matter_id",
        "user_id",
        "role",
        "scope",
        "rate_cents",
        "effective_from",
        "effective_until",
        "active",
      ]),
    );
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
    expect(getTableConfig(hostedPaymentRequests).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "invoice_id",
        "amount_cents",
        "hosted_path",
        "delivery_state",
        "reminder_state",
        "payment_plan_placeholder",
        "credit_write_off_posture",
        "processor_state",
        "evidence",
      ]),
    );
    expect(getTableConfig(hostedPaymentRequests).checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "hosted_payment_requests_status_value",
        "hosted_payment_requests_positive_amount",
        "hosted_payment_requests_cad_currency",
      ]),
    );
    expect(
      getTableConfig(billingTrustTransferRequests).columns.map((column) => column.name),
    ).toEqual(
      expect.arrayContaining(["invoice_id", "amount_cents", "status", "ledger_transaction_id"]),
    );
  });
});
