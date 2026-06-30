CREATE TABLE "email_template_reviewed_outbound_previews" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"template_draft_id" text NOT NULL,
	"published_version_id" text NOT NULL,
	"published_version" integer NOT NULL,
	"matter_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"contact_method_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"template_key" text NOT NULL,
	"subject_preview" text NOT NULL,
	"text_preview" text,
	"html_preview" text,
	"recipient_summary" jsonb DEFAULT '{"toCount":1,"ccCount":0,"bccCount":0,"recipientCount":1}'::jsonb NOT NULL,
	"review_status" text DEFAULT 'reviewed_preview' NOT NULL,
	"related_resource_type" text,
	"related_resource_id" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery" jsonb DEFAULT '{"persisted":true,"queued":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "email_template_reviewed_previews_positive_published_version" CHECK ("email_template_reviewed_outbound_previews"."published_version" > 0),
	CONSTRAINT "email_template_reviewed_previews_review_status_value" CHECK ("email_template_reviewed_outbound_previews"."review_status" in ('reviewed_preview'))
);
--> statement-breakpoint
ALTER TABLE "email_template_reviewed_outbound_previews" ADD CONSTRAINT "email_template_reviewed_outbound_previews_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_reviewed_outbound_previews" ADD CONSTRAINT "email_template_reviewed_outbound_previews_template_draft_id_email_template_drafts_id_fk" FOREIGN KEY ("template_draft_id") REFERENCES "public"."email_template_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_reviewed_outbound_previews" ADD CONSTRAINT "email_template_reviewed_outbound_previews_published_version_id_email_template_published_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."email_template_published_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_reviewed_outbound_previews" ADD CONSTRAINT "email_template_reviewed_outbound_previews_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_reviewed_outbound_previews" ADD CONSTRAINT "email_template_reviewed_outbound_previews_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_reviewed_outbound_previews" ADD CONSTRAINT "email_template_reviewed_outbound_previews_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_template_reviewed_previews_template_created_idx" ON "email_template_reviewed_outbound_previews" USING btree ("firm_id","template_draft_id","created_at");--> statement-breakpoint
CREATE INDEX "email_template_reviewed_previews_matter_created_idx" ON "email_template_reviewed_outbound_previews" USING btree ("firm_id","matter_id","created_at");--> statement-breakpoint
CREATE INDEX "email_template_reviewed_previews_published_version_idx" ON "email_template_reviewed_outbound_previews" USING btree ("firm_id","published_version_id");