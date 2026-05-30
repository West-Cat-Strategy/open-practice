CREATE TABLE "calendar_scheduling_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"matter_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'needs_review' NOT NULL,
	"title" text NOT NULL,
	"task_id" text,
	"calendar_event_id" text,
	"calendar_reminder_id" text,
	"owner_user_id" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"source_label" text NOT NULL,
	"requested_due_at" timestamp with time zone,
	"requested_starts_at" timestamp with time zone,
	"requested_ends_at" timestamp with time zone,
	"reminder_posture" text DEFAULT 'none' NOT NULL,
	"privacy" text DEFAULT 'staff_only' NOT NULL,
	"time_capture_cue" jsonb DEFAULT '{"posture":"none","existingTimeEntryCount":0,"billable":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	CONSTRAINT "calendar_scheduling_requests_kind_value" CHECK ("calendar_scheduling_requests"."kind" in ('deadline_review', 'event_scheduling', 'reminder_review')),
	CONSTRAINT "calendar_scheduling_requests_status_value" CHECK ("calendar_scheduling_requests"."status" in ('needs_review', 'reviewed', 'scheduled', 'dismissed')),
	CONSTRAINT "calendar_scheduling_requests_source_type_value" CHECK ("calendar_scheduling_requests"."source_type" in ('task_deadline', 'calendar_event', 'calendar_reminder', 'manual')),
	CONSTRAINT "calendar_scheduling_requests_reminder_posture_value" CHECK ("calendar_scheduling_requests"."reminder_posture" in ('none', 'dashboard_pending', 'delivery_opt_in_available')),
	CONSTRAINT "calendar_scheduling_requests_privacy_value" CHECK ("calendar_scheduling_requests"."privacy" in ('staff_only', 'matter_team')),
	CONSTRAINT "calendar_scheduling_requests_title_present" CHECK (length(trim("calendar_scheduling_requests"."title")) > 0),
	CONSTRAINT "calendar_scheduling_requests_source_label_present" CHECK (length(trim("calendar_scheduling_requests"."source_label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_calendar_reminder_id_calendar_event_reminders_id_fk" FOREIGN KEY ("calendar_reminder_id") REFERENCES "public"."calendar_event_reminders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_scheduling_requests" ADD CONSTRAINT "calendar_scheduling_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_scheduling_requests_matter_status_idx" ON "calendar_scheduling_requests" USING btree ("firm_id","matter_id","status");--> statement-breakpoint
CREATE INDEX "calendar_scheduling_requests_owner_status_idx" ON "calendar_scheduling_requests" USING btree ("firm_id","owner_user_id","status");
