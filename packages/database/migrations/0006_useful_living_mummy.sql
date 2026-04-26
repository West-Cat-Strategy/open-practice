CREATE TYPE "public"."auth_action_token_purpose" AS ENUM('password_reset', 'magic_link', 'account_recovery', 'email_verification');
--> statement-breakpoint
CREATE TYPE "public"."auth_challenge_purpose" AS ENUM('passkey_registration', 'passkey_authentication', 'totp_setup');
--> statement-breakpoint
CREATE TYPE "public"."job_lifecycle_status" AS ENUM('queued', 'active', 'completed', 'failed', 'dead_letter', 'skipped');
--> statement-breakpoint
CREATE TYPE "public"."job_queue_name" AS ENUM('email', 'inbound_email', 'ai_triage', 'ocr', 'transcription', 'media');
--> statement-breakpoint
CREATE TYPE "public"."provider_setting_kind" AS ENUM('smtp', 'inbound_email', 'ai', 'ocr', 'transcription', 'media', 'storage');
--> statement-breakpoint
CREATE TABLE "access_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"actor_id" text,
	"share_link_id" text,
	"external_upload_link_id" text,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"action" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_triage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"classification" text,
	"confidence" integer,
	"extracted_entities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suggested_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_draft" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "auth_action_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" "auth_action_token_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text,
	"challenge_hash" text NOT NULL,
	"purpose" "auth_challenge_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_text_extractions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"document_id" text NOT NULL,
	"engine" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"language" text DEFAULT 'eng' NOT NULL,
	"confidence" integer,
	"text_storage_key" text,
	"extracted_text" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"storage_key" text,
	"editor_json" jsonb,
	"created_by_user_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"email_id" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_message_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"template_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"from_address" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"text_body" text NOT NULL,
	"related_resource_type" text,
	"related_resource_id" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_upload_links" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"max_uploads" integer DEFAULT 1 NOT NULL,
	"used_uploads" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_email_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"address" text NOT NULL,
	"matter_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_email_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"inbound_message_id" text NOT NULL,
	"document_id" text,
	"filename" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"storage_key" text NOT NULL,
	"checksum_sha256" text
);
--> statement-breakpoint
CREATE TABLE "inbound_email_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"address_id" text,
	"matter_id" text,
	"message_id" text,
	"from_address" text NOT NULL,
	"to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"raw_storage_key" text NOT NULL,
	"parsed_text" text,
	"parsed_html_storage_key" text,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_lifecycle_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"queue_name" "job_queue_name" NOT NULL,
	"job_name" text NOT NULL,
	"bull_job_id" text,
	"status" "job_lifecycle_status" DEFAULT 'queued' NOT NULL,
	"target_resource_type" text,
	"target_resource_id" text,
	"attempts_made" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_derivatives" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"document_id" text NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"document_id" text NOT NULL,
	"engine" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"transcript_storage_key" text,
	"text" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"event_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"kind" "provider_setting_kind" NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"encrypted_config" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"require_email_verification" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"label" text NOT NULL,
	"verified_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_external_upload_link_id_external_upload_links_id_fk" FOREIGN KEY ("external_upload_link_id") REFERENCES "public"."external_upload_links"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_triage_records" ADD CONSTRAINT "ai_triage_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_triage_records" ADD CONSTRAINT "ai_triage_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_text_extractions" ADD CONSTRAINT "document_text_extractions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_text_extractions" ADD CONSTRAINT "document_text_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_email_outbox_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email_outbox"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "external_upload_links" ADD CONSTRAINT "external_upload_links_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "external_upload_links" ADD CONSTRAINT "external_upload_links_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "external_upload_links" ADD CONSTRAINT "external_upload_links_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_addresses" ADD CONSTRAINT "inbound_email_addresses_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_addresses" ADD CONSTRAINT "inbound_email_addresses_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_attachments" ADD CONSTRAINT "inbound_email_attachments_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_attachments" ADD CONSTRAINT "inbound_email_attachments_inbound_message_id_inbound_email_messages_id_fk" FOREIGN KEY ("inbound_message_id") REFERENCES "public"."inbound_email_messages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_attachments" ADD CONSTRAINT "inbound_email_attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_messages" ADD CONSTRAINT "inbound_email_messages_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_messages" ADD CONSTRAINT "inbound_email_messages_address_id_inbound_email_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."inbound_email_addresses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_email_messages" ADD CONSTRAINT "inbound_email_messages_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_lifecycle_records" ADD CONSTRAINT "job_lifecycle_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "media_derivatives" ADD CONSTRAINT "media_derivatives_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "media_derivatives" ADD CONSTRAINT "media_derivatives_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "media_transcripts" ADD CONSTRAINT "media_transcripts_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "media_transcripts" ADD CONSTRAINT "media_transcripts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "provider_settings" ADD CONSTRAINT "provider_settings_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "access_logs_firm_resource_idx" ON "access_logs" USING btree ("firm_id","resource_type","resource_id");
--> statement-breakpoint
CREATE INDEX "ai_triage_records_firm_source_idx" ON "ai_triage_records" USING btree ("firm_id","source_type","source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_action_tokens_token_hash_idx" ON "auth_action_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "auth_action_tokens_user_purpose_idx" ON "auth_action_tokens" USING btree ("firm_id","user_id","purpose");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_challenges_challenge_hash_idx" ON "auth_challenges" USING btree ("challenge_hash");
--> statement-breakpoint
CREATE INDEX "auth_challenges_firm_purpose_idx" ON "auth_challenges" USING btree ("firm_id","purpose");
--> statement-breakpoint
CREATE INDEX "document_text_extractions_document_status_idx" ON "document_text_extractions" USING btree ("document_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_document_version_idx" ON "document_versions" USING btree ("document_id","version");
--> statement-breakpoint
CREATE INDEX "email_events_email_event_idx" ON "email_events" USING btree ("email_id","event_type");
--> statement-breakpoint
CREATE INDEX "email_outbox_firm_status_idx" ON "email_outbox" USING btree ("firm_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "external_upload_links_token_hash_idx" ON "external_upload_links" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "external_upload_links_matter_expiry_idx" ON "external_upload_links" USING btree ("matter_id","expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_email_addresses_firm_address_idx" ON "inbound_email_addresses" USING btree ("firm_id","address");
--> statement-breakpoint
CREATE INDEX "inbound_email_messages_firm_received_idx" ON "inbound_email_messages" USING btree ("firm_id","received_at");
--> statement-breakpoint
CREATE INDEX "job_lifecycle_records_firm_status_idx" ON "job_lifecycle_records" USING btree ("firm_id","status");
--> statement-breakpoint
CREATE INDEX "job_lifecycle_records_bull_job_id_idx" ON "job_lifecycle_records" USING btree ("bull_job_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "media_derivatives_document_kind_idx" ON "media_derivatives" USING btree ("document_id","kind");
--> statement-breakpoint
CREATE INDEX "media_transcripts_document_status_idx" ON "media_transcripts" USING btree ("document_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_event_idx" ON "notification_preferences" USING btree ("firm_id","user_id","channel","event_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_settings_firm_kind_key_idx" ON "provider_settings" USING btree ("firm_id","kind","key");
--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_codes_code_hash_idx" ON "recovery_codes" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX "recovery_codes_user_unused_idx" ON "recovery_codes" USING btree ("firm_id","user_id","used_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_hash_idx" ON "share_links" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "share_links_matter_expiry_idx" ON "share_links" USING btree ("matter_id","expires_at");
--> statement-breakpoint
CREATE INDEX "totp_credentials_user_active_idx" ON "totp_credentials" USING btree ("firm_id","user_id","disabled_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credentials_credential_id_idx" ON "webauthn_credentials" USING btree ("credential_id");
--> statement-breakpoint
CREATE INDEX "webauthn_credentials_user_idx" ON "webauthn_credentials" USING btree ("firm_id","user_id");
