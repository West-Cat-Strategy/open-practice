ALTER TABLE "intake_form_links" ADD COLUMN "client_submission_id" text;
ALTER TABLE "intake_form_links" ADD COLUMN "submission_fingerprint" text;
ALTER TABLE "intake_form_links" ADD COLUMN "draft_answers" jsonb;
ALTER TABLE "intake_form_links" ADD COLUMN "draft_updated_at" timestamp with time zone;
CREATE INDEX "intake_form_links_submission_idx" ON "intake_form_links" USING btree ("id","client_submission_id");
