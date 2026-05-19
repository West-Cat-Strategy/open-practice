CREATE TABLE "trust_reconciliation_exception_resolutions" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "account_id" text NOT NULL,
  "statement_row" jsonb NOT NULL,
  "variance_decision" text NOT NULL,
  "resolution_note" text NOT NULL,
  "recorded_by_user_id" text NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  CONSTRAINT "trust_reconciliation_exception_resolutions_variance_decision_value" CHECK ("trust_reconciliation_exception_resolutions"."variance_decision" in ('ledger_entry_expected', 'statement_duplicate', 'statement_source_issue', 'operational_variance_acknowledged', 'needs_follow_up')),
  CONSTRAINT "trust_reconciliation_exception_resolutions_note_present" CHECK (length(trim("trust_reconciliation_exception_resolutions"."resolution_note")) > 0)
);
--> statement-breakpoint
ALTER TABLE "trust_reconciliation_exception_resolutions" ADD CONSTRAINT "trust_reconciliation_exception_resolutions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trust_reconciliation_exception_resolutions" ADD CONSTRAINT "trust_reconciliation_exception_resolutions_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trust_reconciliation_exception_resolutions" ADD CONSTRAINT "trust_reconciliation_exception_resolutions_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "trust_reconciliation_exception_resolutions_account_recorded_idx" ON "trust_reconciliation_exception_resolutions" USING btree ("firm_id", "account_id", "recorded_at");
