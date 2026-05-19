CREATE TABLE "email_receipt_links" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "email_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "purpose" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "first_recorded_at" timestamp with time zone,
  "last_recorded_at" timestamp with time zone,
  "record_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "email_receipt_links_purpose_value" CHECK ("email_receipt_links"."purpose" in ('delivery_receipt', 'read_receipt', 'client_acknowledgement')),
  CONSTRAINT "email_receipt_links_non_negative_record_count" CHECK ("email_receipt_links"."record_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "email_receipt_links" ADD CONSTRAINT "email_receipt_links_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_receipt_links" ADD CONSTRAINT "email_receipt_links_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_receipt_links" ADD CONSTRAINT "email_receipt_links_email_id_email_outbox_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email_outbox"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_receipt_links" ADD CONSTRAINT "email_receipt_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "email_receipt_links_token_hash_idx" ON "email_receipt_links" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "email_receipt_links_email_purpose_idx" ON "email_receipt_links" USING btree ("firm_id","email_id","purpose");
--> statement-breakpoint
CREATE INDEX "email_receipt_links_matter_expiry_idx" ON "email_receipt_links" USING btree ("matter_id","expires_at");
