CREATE TABLE "payment_import_review_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"provider_label" text NOT NULL,
	"event_family" text NOT NULL,
	"event_status" text NOT NULL,
	"external_event_id" text NOT NULL,
	"external_payment_id" text,
	"external_deposit_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"observed_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by_user_id" text NOT NULL,
	"candidate_invoice_id" text,
	"candidate_hosted_payment_request_id" text,
	"duplicate_of_record_id" text,
	"conflict_reason" text,
	"review_state" text DEFAULT 'needs_review' NOT NULL,
	"normalized_evidence_fingerprint" text NOT NULL,
	"boundaries" jsonb DEFAULT '{"rawProviderPayloadRetained":false,"invoiceBalanceMutation":"none","settlementAutomation":false,"reconciliationMutation":"none","refundHandling":"review_only","chargebackHandling":"review_only","trustPosting":"none","providerCommand":"none","clientNotification":"none","depositMatching":"review_cue_only"}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_import_review_records_provider_label_format" CHECK ("payment_import_review_records"."provider_label" ~ '^[a-z0-9_.:-]+$'),
	CONSTRAINT "payment_import_review_records_event_family_value" CHECK ("payment_import_review_records"."event_family" in ('payment', 'deposit')),
	CONSTRAINT "payment_import_review_records_event_status_format" CHECK ("payment_import_review_records"."event_status" ~ '^[a-z0-9_.:-]+$'),
	CONSTRAINT "payment_import_review_records_external_event_id_format" CHECK ("payment_import_review_records"."external_event_id" ~ '^[A-Za-z0-9_.:-]+$'),
	CONSTRAINT "payment_import_review_records_external_payment_id_format" CHECK ("payment_import_review_records"."external_payment_id" is null or "payment_import_review_records"."external_payment_id" ~ '^[A-Za-z0-9_.:-]+$'),
	CONSTRAINT "payment_import_review_records_external_deposit_id_format" CHECK ("payment_import_review_records"."external_deposit_id" is null or "payment_import_review_records"."external_deposit_id" ~ '^[A-Za-z0-9_.:-]+$'),
	CONSTRAINT "payment_import_review_records_positive_amount" CHECK ("payment_import_review_records"."amount_cents" > 0),
	CONSTRAINT "payment_import_review_records_cad_currency" CHECK ("payment_import_review_records"."currency" = 'CAD')
);
--> statement-breakpoint
ALTER TABLE "payment_import_review_records" ADD CONSTRAINT "payment_import_review_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_review_records" ADD CONSTRAINT "payment_import_review_records_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_review_records" ADD CONSTRAINT "payment_import_review_records_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_review_records" ADD CONSTRAINT "payment_import_review_records_candidate_invoice_id_invoices_id_fk" FOREIGN KEY ("candidate_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_review_records" ADD CONSTRAINT "payment_import_review_records_candidate_hosted_payment_request_id_hosted_payment_requests_id_fk" FOREIGN KEY ("candidate_hosted_payment_request_id") REFERENCES "public"."hosted_payment_requests"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payment_import_review_records_firm_matter_imported_idx" ON "payment_import_review_records" USING btree ("firm_id","matter_id","imported_at");
--> statement-breakpoint
CREATE INDEX "payment_import_review_records_firm_invoice_idx" ON "payment_import_review_records" USING btree ("firm_id","candidate_invoice_id");
--> statement-breakpoint
CREATE INDEX "payment_import_review_records_firm_payment_request_idx" ON "payment_import_review_records" USING btree ("firm_id","candidate_hosted_payment_request_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_import_review_records_firm_provider_event_idx" ON "payment_import_review_records" USING btree ("firm_id","provider_label","external_event_id");
