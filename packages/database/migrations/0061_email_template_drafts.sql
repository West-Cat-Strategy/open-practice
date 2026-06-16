CREATE TABLE "email_template_drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL REFERENCES "firms"("id"),
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
  "status" text DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "updated_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "email_template_drafts_status_value" CHECK ("status" in ('draft', 'archived')),
  CONSTRAINT "email_template_drafts_positive_version" CHECK ("version" > 0)
);

CREATE INDEX "email_template_drafts_firm_status_updated_idx"
  ON "email_template_drafts" ("firm_id", "status", "updated_at");

CREATE INDEX "email_template_drafts_firm_category_idx"
  ON "email_template_drafts" ("firm_id", "category");

CREATE TABLE "email_template_preview_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL REFERENCES "firms"("id"),
  "template_draft_id" text NOT NULL REFERENCES "email_template_drafts"("id"),
  "matter_id" text NOT NULL REFERENCES "matters"("id"),
  "created_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "template_key" text NOT NULL,
  "subject_preview" text NOT NULL,
  "text_preview" text,
  "html_preview" text,
  "recipient_summary" jsonb DEFAULT '{"toCount":0,"ccCount":0,"bccCount":0,"recipientCount":0}'::jsonb NOT NULL,
  "related_resource_type" text,
  "related_resource_id" text,
  "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "delivery" jsonb DEFAULT '{"persisted":true,"queued":false}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX "email_template_preview_snapshots_template_created_idx"
  ON "email_template_preview_snapshots" ("firm_id", "template_draft_id", "created_at");

CREATE INDEX "email_template_preview_snapshots_matter_created_idx"
  ON "email_template_preview_snapshots" ("firm_id", "matter_id", "created_at");
