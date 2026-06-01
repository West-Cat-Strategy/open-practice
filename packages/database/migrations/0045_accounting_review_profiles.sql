CREATE TABLE "trust_statement_match_rule_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"reference_strategy" text NOT NULL,
	"description_strategy" text NOT NULL,
	"date_window_days" integer NOT NULL,
	"amount_tolerance_cents" integer NOT NULL,
	"variance_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewer_explanation_required" boolean DEFAULT true NOT NULL,
	"review_only" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trust_statement_match_profiles_name_present" CHECK (length(trim("trust_statement_match_rule_profiles"."name")) > 0),
	CONSTRAINT "trust_statement_match_profiles_reference_strategy_value" CHECK ("trust_statement_match_rule_profiles"."reference_strategy" in ('strict_reference', 'normalized_reference', 'date_amount_reference', 'amount_only_review')),
	CONSTRAINT "trust_statement_match_profiles_description_strategy_value" CHECK ("trust_statement_match_rule_profiles"."description_strategy" in ('exact', 'normalized_contains', 'review_required')),
	CONSTRAINT "trust_statement_match_profiles_date_window_range" CHECK ("trust_statement_match_rule_profiles"."date_window_days" >= 0 and "trust_statement_match_rule_profiles"."date_window_days" <= 30),
	CONSTRAINT "trust_statement_match_profiles_tolerance_range" CHECK ("trust_statement_match_rule_profiles"."amount_tolerance_cents" >= 0 and "trust_statement_match_rule_profiles"."amount_tolerance_cents" <= 100000),
	CONSTRAINT "trust_statement_match_profiles_variance_categories_nonempty" CHECK (jsonb_typeof("trust_statement_match_rule_profiles"."variance_categories") = 'array' and jsonb_array_length("trust_statement_match_rule_profiles"."variance_categories") > 0),
	CONSTRAINT "trust_statement_match_profiles_review_only_value" CHECK ("trust_statement_match_rule_profiles"."review_only" = true)
);
--> statement-breakpoint
CREATE TABLE "ledger_accounting_review_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"account_id" text NOT NULL,
	"account_type" text NOT NULL,
	"boundary_posture" text NOT NULL,
	"protected_funds" jsonb NOT NULL,
	"bank_feed_import" jsonb NOT NULL,
	"dimensions" jsonb NOT NULL,
	"review_only" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounting_review_profiles_account_type_value" CHECK ("ledger_accounting_review_profiles"."account_type" in ('trust_asset', 'client_liability', 'operating_revenue', 'expense')),
	CONSTRAINT "ledger_accounting_review_profiles_boundary_posture_value" CHECK ("ledger_accounting_review_profiles"."boundary_posture" in ('trust_only', 'operating_only', 'expense_only', 'review_required')),
	CONSTRAINT "ledger_accounting_review_profiles_protected_funds_reason" CHECK (("ledger_accounting_review_profiles"."protected_funds"->>'protected') <> 'true' or length(trim(coalesce("ledger_accounting_review_profiles"."protected_funds"->>'reason', ''))) > 0),
	CONSTRAINT "ledger_accounting_review_profiles_bank_feed_auto_match_off" CHECK ("ledger_accounting_review_profiles"."bank_feed_import"->>'automaticMatching' = 'false'),
	CONSTRAINT "ledger_accounting_review_profiles_bank_feed_source_label" CHECK ("ledger_accounting_review_profiles"."bank_feed_import"->>'status' = 'not_configured' or length(trim(coalesce("ledger_accounting_review_profiles"."bank_feed_import"->>'sourceLabel', ''))) > 0),
	CONSTRAINT "ledger_accounting_review_profiles_client_matter_required" CHECK ("ledger_accounting_review_profiles"."dimensions"->>'clientMatterTracking' = 'required'),
	CONSTRAINT "ledger_accounting_review_profiles_review_only_value" CHECK ("ledger_accounting_review_profiles"."review_only" = true)
);
--> statement-breakpoint
ALTER TABLE "trust_statement_match_rule_profiles" ADD CONSTRAINT "trust_statement_match_rule_profiles_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_statement_match_rule_profiles" ADD CONSTRAINT "trust_statement_match_rule_profiles_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_statement_match_rule_profiles" ADD CONSTRAINT "trust_statement_match_rule_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounting_review_profiles" ADD CONSTRAINT "ledger_accounting_review_profiles_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounting_review_profiles" ADD CONSTRAINT "ledger_accounting_review_profiles_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounting_review_profiles" ADD CONSTRAINT "ledger_accounting_review_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trust_statement_match_profiles_account_created_idx" ON "trust_statement_match_rule_profiles" USING btree ("firm_id","account_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_accounting_review_profiles_account_created_idx" ON "ledger_accounting_review_profiles" USING btree ("firm_id","account_id","created_at");
