CREATE TABLE "task_checklist_items" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "task_id" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "assigned_to_user_id" text,
  "due_at" timestamp with time zone,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by_user_id" text,
  "archived_at" timestamp with time zone,
  "archived_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_user_id" text,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "task_checklist_items_status_value" CHECK ("task_checklist_items"."status" in ('open', 'completed', 'blocked')),
  CONSTRAINT "task_checklist_items_completed_fields" CHECK ("task_checklist_items"."status" <> 'completed' or "task_checklist_items"."completed_at" is not null),
  CONSTRAINT "task_checklist_items_version_positive" CHECK ("task_checklist_items"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "task_id" text NOT NULL,
  "body" text NOT NULL,
  "archived_at" timestamp with time zone,
  "archived_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "matter_id" text NOT NULL,
  "task_id" text NOT NULL,
  "depends_on_task_id" text NOT NULL,
  "dependency_type" text NOT NULL,
  "archived_at" timestamp with time zone,
  "archived_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text,
  CONSTRAINT "task_dependencies_type_value" CHECK ("task_dependencies"."dependency_type" in ('blocks', 'relates_to')),
  CONSTRAINT "task_dependencies_no_self_dependency" CHECK ("task_dependencies"."task_id" <> "task_dependencies"."depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "default_title" text,
  "default_priority" text DEFAULT 'medium' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_user_id" text,
  "archived_at" timestamp with time zone,
  "archived_by_user_id" text,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "task_templates_default_priority_value" CHECK ("task_templates"."default_priority" in ('high', 'medium', 'low')),
  CONSTRAINT "task_templates_status_value" CHECK ("task_templates"."status" in ('active', 'archived')),
  CONSTRAINT "task_templates_archive_fields" CHECK ("task_templates"."status" <> 'archived' or "task_templates"."archived_at" is not null),
  CONSTRAINT "task_templates_version_positive" CHECK ("task_templates"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "task_template_items" (
  "id" text PRIMARY KEY NOT NULL,
  "firm_id" text NOT NULL,
  "template_id" text NOT NULL,
  "title" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "default_assignee_user_id" text,
  "due_offset_days" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_default_assignee_user_id_users_id_fk" FOREIGN KEY ("default_assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_template_items" ADD CONSTRAINT "task_template_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "task_checklist_items_task_order_idx" ON "task_checklist_items" USING btree ("firm_id","task_id","archived_at","sort_order");
--> statement-breakpoint
CREATE INDEX "task_checklist_items_matter_status_due_idx" ON "task_checklist_items" USING btree ("firm_id","matter_id","status","due_at");
--> statement-breakpoint
CREATE INDEX "task_comments_task_created_idx" ON "task_comments" USING btree ("firm_id","task_id","archived_at","created_at");
--> statement-breakpoint
CREATE INDEX "task_dependencies_task_active_idx" ON "task_dependencies" USING btree ("firm_id","task_id","archived_at");
--> statement-breakpoint
CREATE INDEX "task_dependencies_dependency_active_idx" ON "task_dependencies" USING btree ("firm_id","depends_on_task_id","archived_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependencies_active_pair_idx" ON "task_dependencies" USING btree ("firm_id","task_id","depends_on_task_id","dependency_type") WHERE "task_dependencies"."archived_at" is null;
--> statement-breakpoint
CREATE INDEX "task_templates_firm_status_name_idx" ON "task_templates" USING btree ("firm_id","status","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "task_templates_active_name_idx" ON "task_templates" USING btree ("firm_id","name") WHERE "task_templates"."status" = 'active';
--> statement-breakpoint
CREATE INDEX "task_template_items_template_order_idx" ON "task_template_items" USING btree ("firm_id","template_id","sort_order");
