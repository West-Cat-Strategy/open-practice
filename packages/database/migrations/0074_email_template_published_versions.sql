CREATE TABLE "email_template_published_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"template_draft_id" text NOT NULL,
	"version" integer NOT NULL,
	"draft_version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"template_key" text NOT NULL,
	"from_address" text NOT NULL,
	"subject" text NOT NULL,
	"text_body" text DEFAULT '' NOT NULL,
	"html_body" text DEFAULT '' NOT NULL,
	"recipient_hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_resource_type" text,
	"published_by_user_id" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "email_template_published_versions_positive_version" CHECK ("email_template_published_versions"."version" > 0),
	CONSTRAINT "email_template_published_versions_positive_draft_version" CHECK ("email_template_published_versions"."draft_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "email_template_published_versions" ADD CONSTRAINT "email_template_published_versions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_published_versions" ADD CONSTRAINT "email_template_published_versions_template_draft_id_email_template_drafts_id_fk" FOREIGN KEY ("template_draft_id") REFERENCES "public"."email_template_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_published_versions" ADD CONSTRAINT "email_template_published_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_published_versions_template_version_idx" ON "email_template_published_versions" USING btree ("firm_id","template_draft_id","version");--> statement-breakpoint
CREATE INDEX "email_template_published_versions_template_published_idx" ON "email_template_published_versions" USING btree ("firm_id","template_draft_id","published_at");