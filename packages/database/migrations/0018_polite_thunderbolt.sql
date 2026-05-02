ALTER TABLE "documents" ADD COLUMN "review_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "review_decision" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "review_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "external_upload_link_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_external_upload_link_id_external_upload_links_id_fk" FOREIGN KEY ("external_upload_link_id") REFERENCES "public"."external_upload_links"("id") ON DELETE no action ON UPDATE no action;