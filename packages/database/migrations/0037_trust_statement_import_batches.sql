CREATE TABLE "trust_statement_import_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "account_id" text NOT NULL,
  "source_label" text NOT NULL,
  "checksum_sha256" text NOT NULL,
  "imported_statement_row_count" integer NOT NULL,
  "duplicate_statement_row_count" integer NOT NULL,
  "status" text NOT NULL,
  "matching_profile_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "trust_statement_import_batches_source_label_present" CHECK (length(trim("trust_statement_import_batches"."source_label")) > 0),
  CONSTRAINT "trust_statement_import_batches_checksum_value" CHECK ("trust_statement_import_batches"."checksum_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "trust_statement_import_batches_positive_row_count" CHECK ("trust_statement_import_batches"."imported_statement_row_count" > 0),
  CONSTRAINT "trust_statement_import_batches_duplicate_count_range" CHECK ("trust_statement_import_batches"."duplicate_statement_row_count" >= 0 and "trust_statement_import_batches"."duplicate_statement_row_count" <= "trust_statement_import_batches"."imported_statement_row_count"),
  CONSTRAINT "trust_statement_import_batches_status_value" CHECK ("trust_statement_import_batches"."status" in ('previewed', 'review_ready', 'discarded')),
  CONSTRAINT "trust_statement_import_batches_matching_profile_present" CHECK ("trust_statement_import_batches"."matching_profile_id" is null or length(trim("trust_statement_import_batches"."matching_profile_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "trust_statement_import_batches" ADD CONSTRAINT "trust_statement_import_batches_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trust_statement_import_batches" ADD CONSTRAINT "trust_statement_import_batches_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trust_statement_import_batches" ADD CONSTRAINT "trust_statement_import_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "trust_statement_import_batches_account_created_idx" ON "trust_statement_import_batches" USING btree ("firm_id", "account_id", "created_at");
--> statement-breakpoint
CREATE INDEX "trust_statement_import_batches_checksum_idx" ON "trust_statement_import_batches" USING btree ("firm_id", "checksum_sha256");
