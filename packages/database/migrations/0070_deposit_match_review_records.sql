ALTER TABLE "payment_import_review_records" ADD COLUMN "candidate_manual_payment_id" text;
--> statement-breakpoint
ALTER TABLE "payment_import_review_records" ADD CONSTRAINT "payment_import_review_records_candidate_manual_payment_id_manual_payments_id_fk" FOREIGN KEY ("candidate_manual_payment_id") REFERENCES "public"."manual_payments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payment_import_review_records_firm_manual_payment_idx" ON "payment_import_review_records" USING btree ("firm_id","candidate_manual_payment_id");
