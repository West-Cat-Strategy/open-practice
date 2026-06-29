CREATE TABLE "payment_import_refund_chargeback_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"payment_import_review_record_id" text NOT NULL,
	"category" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"reviewer_evidence_present" boolean DEFAULT true NOT NULL,
	"idempotency_key" text NOT NULL,
	"decision_fingerprint" text NOT NULL,
	"boundaries" jsonb DEFAULT '{"rawProviderPayloadRetained":false,"refundArtifactRetained":false,"disputeArtifactRetained":false,"invoiceBalanceMutation":"none","ledgerReversal":"none","trustPosting":"none","providerCommand":"none","clientNotification":"none","fundsMovement":"none","refundHandling":"review_decision_only","chargebackHandling":"review_decision_only"}'::jsonb NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_import_rc_reviews_category_value" CHECK ("payment_import_refund_chargeback_reviews"."category" in ('refund', 'chargeback')),
	CONSTRAINT "payment_import_rc_reviews_decision_value" CHECK ("payment_import_refund_chargeback_reviews"."decision" in ('exception_confirmed', 'exception_rejected', 'needs_more_evidence')),
	CONSTRAINT "payment_import_rc_reviews_reason_value" CHECK ("payment_import_refund_chargeback_reviews"."reason" in ('refund_observed', 'chargeback_observed', 'duplicate_or_conflict', 'candidate_reference_mismatch', 'missing_reviewer_evidence', 'status_unclear')),
	CONSTRAINT "payment_import_rc_reviews_reviewer_evidence_required" CHECK ("payment_import_refund_chargeback_reviews"."reviewer_evidence_present" = true),
	CONSTRAINT "payment_import_rc_reviews_idempotency_key_format" CHECK ("payment_import_refund_chargeback_reviews"."idempotency_key" ~ '^[A-Za-z0-9_.:-]+$')
);
--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_reviews" ADD CONSTRAINT "payment_import_refund_chargeback_reviews_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_reviews" ADD CONSTRAINT "payment_import_refund_chargeback_reviews_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_reviews" ADD CONSTRAINT "payment_import_refund_chargeback_reviews_payment_import_review_record_id_payment_import_review_records_id_fk" FOREIGN KEY ("payment_import_review_record_id") REFERENCES "public"."payment_import_review_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_reviews" ADD CONSTRAINT "payment_import_refund_chargeback_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_import_rc_reviews_firm_matter_reviewed_idx" ON "payment_import_refund_chargeback_reviews" USING btree ("firm_id","matter_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "payment_import_rc_reviews_firm_import_record_idx" ON "payment_import_refund_chargeback_reviews" USING btree ("firm_id","payment_import_review_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_import_rc_reviews_firm_record_idempotency_idx" ON "payment_import_refund_chargeback_reviews" USING btree ("firm_id","payment_import_review_record_id","idempotency_key");