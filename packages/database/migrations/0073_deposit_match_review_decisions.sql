CREATE TABLE "payment_import_deposit_match_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"payment_import_review_record_id" text NOT NULL,
	"candidate_manual_payment_id" text NOT NULL,
	"candidate_invoice_id" text,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"import_amount_cents" integer NOT NULL,
	"manual_payment_amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"candidate_manual_payment_status" text NOT NULL,
	"reviewer_evidence_present" boolean DEFAULT true NOT NULL,
	"idempotency_key" text NOT NULL,
	"decision_fingerprint" text NOT NULL,
	"boundaries" jsonb DEFAULT '{"rawProviderPayloadRetained":false,"invoiceBalanceMutation":"none","settlementAutomation":false,"reconciliationMutation":"none","refundHandling":"none","chargebackHandling":"none","trustPosting":"none","providerCommand":"none","clientNotification":"none","depositMatching":"review_decision_only"}'::jsonb NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_import_deposit_match_reviews_decision_value" CHECK ("payment_import_deposit_match_reviews"."decision" in ('candidate_supported', 'candidate_rejected', 'needs_more_evidence')),
	CONSTRAINT "payment_import_deposit_match_reviews_reason_value" CHECK ("payment_import_deposit_match_reviews"."reason" in ('candidate_evidence_matches', 'amount_mismatch', 'status_conflict', 'duplicate_or_conflict', 'manual_payment_not_pending', 'invoice_candidate_mismatch', 'missing_reviewer_evidence')),
	CONSTRAINT "payment_import_deposit_match_reviews_manual_payment_status_value" CHECK ("payment_import_deposit_match_reviews"."candidate_manual_payment_status" in ('pending_reconciliation', 'received', 'void')),
	CONSTRAINT "payment_import_deposit_match_reviews_positive_import_amount" CHECK ("payment_import_deposit_match_reviews"."import_amount_cents" > 0),
	CONSTRAINT "payment_import_deposit_match_reviews_positive_manual_payment_amount" CHECK ("payment_import_deposit_match_reviews"."manual_payment_amount_cents" > 0),
	CONSTRAINT "payment_import_deposit_match_reviews_cad_currency" CHECK ("payment_import_deposit_match_reviews"."currency" = 'CAD'),
	CONSTRAINT "payment_import_deposit_match_reviews_reviewer_evidence_required" CHECK ("payment_import_deposit_match_reviews"."reviewer_evidence_present" = true),
	CONSTRAINT "payment_import_deposit_match_reviews_idempotency_key_format" CHECK ("payment_import_deposit_match_reviews"."idempotency_key" ~ '^[A-Za-z0-9_.:-]+$')
);
--> statement-breakpoint
ALTER TABLE "payment_import_deposit_match_reviews" ADD CONSTRAINT "payment_import_deposit_match_reviews_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_deposit_match_reviews" ADD CONSTRAINT "payment_import_deposit_match_reviews_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_deposit_match_reviews" ADD CONSTRAINT "payment_import_deposit_match_reviews_payment_import_review_record_id_payment_import_review_records_id_fk" FOREIGN KEY ("payment_import_review_record_id") REFERENCES "public"."payment_import_review_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_deposit_match_reviews" ADD CONSTRAINT "payment_import_deposit_match_reviews_candidate_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("candidate_manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_deposit_match_reviews" ADD CONSTRAINT "payment_import_deposit_match_reviews_candidate_invoice_id_invoices_id_fk" FOREIGN KEY ("candidate_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_import_deposit_match_reviews" ADD CONSTRAINT "payment_import_deposit_match_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payment_import_deposit_match_reviews_firm_matter_reviewed_idx" ON "payment_import_deposit_match_reviews" USING btree ("firm_id","matter_id","reviewed_at");
--> statement-breakpoint
CREATE INDEX "payment_import_deposit_match_reviews_firm_import_record_idx" ON "payment_import_deposit_match_reviews" USING btree ("firm_id","payment_import_review_record_id");
--> statement-breakpoint
CREATE INDEX "payment_import_deposit_match_reviews_firm_manual_payment_idx" ON "payment_import_deposit_match_reviews" USING btree ("firm_id","candidate_manual_payment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_import_deposit_match_reviews_firm_record_idempotency_idx" ON "payment_import_deposit_match_reviews" USING btree ("firm_id","payment_import_review_record_id","idempotency_key");
