ALTER TABLE "job_lifecycle_records" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "external_upload_links" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "job_lifecycle_records_firm_idempotency_idx" ON "job_lifecycle_records" USING btree ("firm_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_firm_idempotency_idx" ON "email_outbox" USING btree ("firm_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "external_upload_links_firm_idempotency_idx" ON "external_upload_links" USING btree ("firm_id","idempotency_key");
