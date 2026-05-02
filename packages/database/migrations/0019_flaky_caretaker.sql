ALTER TABLE "email_events" ADD COLUMN "attempt_number" integer;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "job_id" text;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "source" text DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "matter_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "terminal_failure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "terminal_failure_reason" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_events_email_occurred_idx" ON "email_events" USING btree ("email_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_outbox_firm_matter_queued_idx" ON "email_outbox" USING btree ("firm_id","matter_id","queued_at");