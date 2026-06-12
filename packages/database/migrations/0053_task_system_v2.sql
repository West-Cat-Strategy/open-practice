ALTER TABLE "tasks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "completed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "archived_by_user_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "tasks"
SET "status" = 'completed',
    "completed_by_user_id" = coalesce("completed_by_user_id", "assigned_to_user_id")
WHERE "completed_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_firm_matter_status_due_idx" ON "tasks" USING btree ("firm_id","matter_id","status","due_at");--> statement-breakpoint
CREATE INDEX "tasks_firm_assignee_status_due_idx" ON "tasks" USING btree ("firm_id","assigned_to_user_id","status","due_at");--> statement-breakpoint
CREATE INDEX "tasks_firm_source_idx" ON "tasks" USING btree ("firm_id","source_type","source_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_value" CHECK ("tasks"."status" in ('open', 'completed', 'archived'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_value" CHECK ("tasks"."priority" in ('high', 'medium', 'low'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_type_value" CHECK ("tasks"."source_type" is null or "tasks"."source_type" in ('manual', 'intake_review', 'inbound_email_follow_up', 'signature_follow_up', 'calendar_scheduling', 'operational_view', 'system_import'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_pair" CHECK (("tasks"."source_type" is null and "tasks"."source_id" is null) or ("tasks"."source_type" is not null and length(trim(coalesce("tasks"."source_id", ''))) > 0));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_archive_fields" CHECK ("tasks"."status" <> 'archived' or "tasks"."archived_at" is not null);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_fields" CHECK ("tasks"."status" <> 'completed' or "tasks"."completed_at" is not null);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_version_positive" CHECK ("tasks"."version" >= 1);
