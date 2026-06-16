CREATE TABLE "intake_template_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "template_id" text NOT NULL,
  "version" integer NOT NULL,
  "definition_version" integer NOT NULL,
  "definition" jsonb NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_by_user_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "intake_template_versions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_template_versions_template_id_intake_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."intake_templates"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "intake_template_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX "intake_template_versions_template_version_idx" ON "intake_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "intake_template_versions_firm_template_idx" ON "intake_template_versions" USING btree ("firm_id","template_id");--> statement-breakpoint

INSERT INTO "intake_template_versions" (
  "id",
  "firm_id",
  "template_id",
  "version",
  "definition_version",
  "definition",
  "published_at",
  "metadata"
)
SELECT
  "id" || ':v' || "definition_version",
  "firm_id",
  "id",
  "definition_version",
  "definition_version",
  "definition",
  "updated_at",
  jsonb_build_object('source', 'migration-0056-current-template-backfill')
FROM "intake_templates"
ON CONFLICT DO NOTHING;--> statement-breakpoint

ALTER TABLE "intake_sessions" ADD COLUMN "published_template_version_id" text;--> statement-breakpoint
UPDATE "intake_sessions"
SET "published_template_version_id" = "intake_template_versions"."id"
FROM "intake_template_versions"
WHERE "intake_sessions"."firm_id" = "intake_template_versions"."firm_id"
  AND "intake_sessions"."template_id" = "intake_template_versions"."template_id"
  AND "intake_template_versions"."version" = (
    SELECT max("candidate"."version")
    FROM "intake_template_versions" AS "candidate"
    WHERE "candidate"."firm_id" = "intake_sessions"."firm_id"
      AND "candidate"."template_id" = "intake_sessions"."template_id"
  );--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_published_template_version_id_intake_template_versions_id_fk" FOREIGN KEY ("published_template_version_id") REFERENCES "public"."intake_template_versions"("id") ON DELETE no action ON UPDATE no action;
