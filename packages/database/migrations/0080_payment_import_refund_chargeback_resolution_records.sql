CREATE TABLE "payment_import_refund_chargeback_resolution_records" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"payment_import_review_record_id" text NOT NULL,
	"candidate_invoice_id" text,
	"candidate_hosted_payment_request_id" text,
	"candidate_manual_payment_id" text,
	"latest_review_id" text NOT NULL,
	"category" text NOT NULL,
	"resolution_posture" text NOT NULL,
	"reason_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latest_reviewer_metadata" jsonb NOT NULL,
	"no_side_effect_flags" jsonb DEFAULT '{"rawProviderPayloadRetained":false,"invoiceBalanceMutation":"none","ledgerReversal":"none","providerCommand":"none","refundArtifactStorage":false,"disputeArtifactStorage":false,"freeFormNotes":false,"clientNotification":"none","trustPosting":"none","fundsMovement":"none"}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"resolution_fingerprint" text NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_import_rc_res_category_value" CHECK ("payment_import_refund_chargeback_resolution_records"."category" in ('refund', 'chargeback')),
	CONSTRAINT "payment_import_rc_res_resolution_posture_value" CHECK ("payment_import_refund_chargeback_resolution_records"."resolution_posture" in ('confirmed_exception', 'rejected_exception', 'needs_more_evidence')),
	CONSTRAINT "payment_import_rc_res_idempotency_key_format" CHECK ("payment_import_refund_chargeback_resolution_records"."idempotency_key" ~ '^[A-Za-z0-9_.:-]+$')
);
--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_payment_import_review_record_id_payment_import_review_records_id_fk" FOREIGN KEY ("payment_import_review_record_id") REFERENCES "public"."payment_import_review_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_candidate_invoice_id_invoices_id_fk" FOREIGN KEY ("candidate_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_candidate_hosted_payment_request_id_hosted_payment_requests_id_fk" FOREIGN KEY ("candidate_hosted_payment_request_id") REFERENCES "public"."hosted_payment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_candidate_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("candidate_manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_latest_review_id_payment_import_refund_chargeback_reviews_id_fk" FOREIGN KEY ("latest_review_id") REFERENCES "public"."payment_import_refund_chargeback_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_import_refund_chargeback_resolution_records" ADD CONSTRAINT "payment_import_refund_chargeback_resolution_records_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_import_rc_res_firm_matter_recorded_idx" ON "payment_import_refund_chargeback_resolution_records" USING btree ("firm_id","matter_id","recorded_at");--> statement-breakpoint
CREATE INDEX "payment_import_rc_res_firm_import_record_idx" ON "payment_import_refund_chargeback_resolution_records" USING btree ("firm_id","payment_import_review_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_import_rc_res_firm_record_idempotency_idx" ON "payment_import_refund_chargeback_resolution_records" USING btree ("firm_id","payment_import_review_record_id","idempotency_key");
