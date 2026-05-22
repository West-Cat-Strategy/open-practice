CREATE TABLE "contact_data_quality_resolutions" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "contact_id" text NOT NULL,
  "signal_kind" text NOT NULL,
  "decision" text NOT NULL,
  "resolution_note" text NOT NULL,
  "matter_id" text,
  "related_contact_id" text,
  "source_record_id" text,
  "recorded_by_user_id" text NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  CONSTRAINT "contact_data_quality_resolutions_signal_kind_value" CHECK ("contact_data_quality_resolutions"."signal_kind" in ('duplicate_candidate', 'protected_party_cue', 'conflict_revalidation')),
  CONSTRAINT "contact_data_quality_resolutions_decision_value" CHECK ("contact_data_quality_resolutions"."decision" in ('acknowledged', 'false_positive', 'needs_follow_up', 'revalidation_requested', 'revalidation_completed')),
  CONSTRAINT "contact_data_quality_resolutions_note_present" CHECK (length(trim("contact_data_quality_resolutions"."resolution_note")) > 0)
);
--> statement-breakpoint
ALTER TABLE "contact_data_quality_resolutions" ADD CONSTRAINT "contact_data_quality_resolutions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_data_quality_resolutions" ADD CONSTRAINT "contact_data_quality_resolutions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_data_quality_resolutions" ADD CONSTRAINT "contact_data_quality_resolutions_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_data_quality_resolutions" ADD CONSTRAINT "contact_data_quality_resolutions_related_contact_id_contacts_id_fk" FOREIGN KEY ("related_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_data_quality_resolutions" ADD CONSTRAINT "contact_data_quality_resolutions_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "contact_data_quality_resolutions_contact_recorded_idx" ON "contact_data_quality_resolutions" USING btree ("firm_id", "contact_id", "recorded_at");
--> statement-breakpoint
CREATE INDEX "contact_data_quality_resolutions_matter_recorded_idx" ON "contact_data_quality_resolutions" USING btree ("firm_id", "matter_id", "recorded_at");
--> statement-breakpoint
CREATE TABLE "billing_period_locks" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "reason" text,
  "locked_by_user_id" text NOT NULL,
  "locked_at" timestamp with time zone NOT NULL,
  CONSTRAINT "billing_period_locks_valid_period" CHECK ("billing_period_locks"."period_end" > "billing_period_locks"."period_start")
);
--> statement-breakpoint
ALTER TABLE "billing_period_locks" ADD CONSTRAINT "billing_period_locks_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_period_locks" ADD CONSTRAINT "billing_period_locks_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "billing_period_locks_firm_period_idx" ON "billing_period_locks" USING btree ("firm_id", "period_start", "period_end");
--> statement-breakpoint
CREATE TABLE "billing_rate_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "label" text NOT NULL,
  "matter_id" text,
  "user_id" text,
  "role" text,
  "scope" text NOT NULL,
  "rate_cents" integer NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_until" timestamp with time zone,
  "active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "billing_rate_rules_scope_value" CHECK ("billing_rate_rules"."scope" in ('firm', 'role', 'user', 'matter', 'matter_user')),
  CONSTRAINT "billing_rate_rules_non_negative_rate" CHECK ("billing_rate_rules"."rate_cents" >= 0),
  CONSTRAINT "billing_rate_rules_valid_effective_period" CHECK ("billing_rate_rules"."effective_until" is null or "billing_rate_rules"."effective_until" > "billing_rate_rules"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "billing_rate_rules" ADD CONSTRAINT "billing_rate_rules_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_rate_rules" ADD CONSTRAINT "billing_rate_rules_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_rate_rules" ADD CONSTRAINT "billing_rate_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_rate_rules" ADD CONSTRAINT "billing_rate_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "billing_rate_rules_firm_scope_active_idx" ON "billing_rate_rules" USING btree ("firm_id", "scope", "active");
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "rate_rule_id" text;
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "rate_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_rate_rule_id_billing_rate_rules_id_fk" FOREIGN KEY ("rate_rule_id") REFERENCES "public"."billing_rate_rules"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "email_receipt_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "email_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "purpose" text DEFAULT 'delivery_receipt' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "recorded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "email_receipt_tokens_purpose_value" CHECK ("email_receipt_tokens"."purpose" in ('delivery_receipt'))
);
--> statement-breakpoint
ALTER TABLE "email_receipt_tokens" ADD CONSTRAINT "email_receipt_tokens_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_receipt_tokens" ADD CONSTRAINT "email_receipt_tokens_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_receipt_tokens" ADD CONSTRAINT "email_receipt_tokens_email_id_email_outbox_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email_outbox"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "email_receipt_tokens_token_hash_idx" ON "email_receipt_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "email_receipt_tokens_email_purpose_idx" ON "email_receipt_tokens" USING btree ("firm_id", "email_id", "purpose");
